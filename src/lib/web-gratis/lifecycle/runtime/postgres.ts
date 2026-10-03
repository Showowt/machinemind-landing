import { AsyncLocalStorage } from 'node:async_hooks';
import { PROGRAM, STRIPE_ACCOUNT, requireThat, newLifecycle, type Identity, type Lifecycle, type Principal } from '../core';
import { sha256 } from '../checkout';
import type { Repository } from '../service';
import type { VerifiedEvent } from '../webhook';
import { parseLifecycle, assertImmutable, recordKey } from './state';
/** Structural node-postgres Pool/PoolClient interface. No connection, env lookup or pool
 * creation at import time. The host supplies an already authorized server pool. */
export interface SqlClient {
    query(sql: string, values?: unknown[]): Promise<{
        rows: Record<string, unknown>[];
        rowCount: number | null;
    }>;
    release(): void;
}
export interface SqlPool {
    connect(): Promise<SqlClient>;
}
export type Scope = {
    ownerId: string;
    tenantId: string;
    account: string;
    livemode: boolean;
    program: string;
};
export class PostgresStore {
    // Nested owned reads reuse the transaction connection; they must not wait for a
    // second pool slot while holding a row lock. Async contexts stay isolated.
    private readonly currentConnection = new AsyncLocalStorage<SqlClient>();
    constructor(readonly pool: SqlPool) { }
    async connection<T>(fn: (db: SqlClient) => Promise<T>) {
        const current = this.currentConnection.getStore();
        if (current)
            return fn(current);
        const db = await this.pool.connect();
        try {
            return await this.currentConnection.run(db, () => fn(db));
        }
        finally {
            db.release();
        }
    }
    async atomic<T>(fn: (db: SqlClient) => Promise<T>): Promise<T> {
        return this.connection(async (db) => {
            await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
            try {
                await db.query("SET LOCAL lock_timeout = '5s'");
                await db.query("SET LOCAL statement_timeout = '15s'");
                const value = await fn(db);
                await db.query('COMMIT');
                return value;
            }
            catch (error) {
                await db.query('ROLLBACK');
                throw error;
            } // Never replay a callback containing provider side effects automatically.
        });
    }
    async transaction<T, S>(key: string, scope: Scope, parse: (v: unknown) => S, fn: (s: S, db: SqlClient) => Promise<T> | T, project: (db: SqlClient, before: S, after: S) => Promise<void>) {
        return this.atomic(async (db) => {
            const q = await db.query('SELECT * FROM billing_private.records WHERE record_key=$1 FOR UPDATE', [key]);
            requireThat(q.rows.length === 1, 'billing_record_missing');
            const row = q.rows[0];
            requireThat(row.owner_id === scope.ownerId && row.tenant_id === scope.tenantId && row.account_id === scope.account && row.livemode === scope.livemode && row.program === scope.program, 'record_ownership_mismatch');
            const before = parse(row.state), state = structuredClone(before), result = await fn(state, db);
            parse(state);
            if (JSON.stringify(before) === JSON.stringify(state))
                return result;
            await project(db, before, state);
            const updated = await db.query('UPDATE billing_private.records SET state=$2::jsonb,revision=revision+1,updated_at=now() WHERE record_key=$1 AND revision=$3', [key, JSON.stringify(state), row.revision]);
            requireThat(updated.rowCount === 1, 'billing_write_conflict');
            return result;
        });
    }
    async claim(db: SqlClient, scope: Scope, key: string, kind: string, id: string, attempt: string | null, digest: string) {
        const q = await db.query('INSERT INTO billing_private.provider_objects(account_id,livemode,object_kind,object_id,record_key,attempt_id,evidence_digest) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING RETURNING record_key', [scope.account, scope.livemode, kind, id, key, attempt, digest]);
        if (!q.rowCount) {
            const existing = await db.query('SELECT record_key,attempt_id FROM billing_private.provider_objects WHERE account_id=$1 AND livemode=$2 AND object_kind=$3 AND object_id=$4', [scope.account, scope.livemode, kind, id]);
            requireThat(existing.rows.length === 1 && existing.rows[0].record_key === key && existing.rows[0].attempt_id === attempt, 'provider_object_owned_elsewhere');
        }
    }
}
export class PostgresWebsiteRepository implements Repository {
    readonly scope: Pick<Scope, 'account' | 'livemode' | 'program'>;
    constructor(readonly store: PostgresStore, livemode: boolean, readonly actor?: {
        issuer: string;
        subject: string;
        role: Principal['role'];
    }) { this.scope = { account: STRIPE_ACCOUNT, livemode, program: PROGRAM }; }
    key(i: Identity) { return recordKey(PROGRAM, STRIPE_ACCOUNT, this.scope.livemode, [i.ownerId, i.tenantId, i.signupId, i.siteId]); }
    /** Trusted enrollment/import command only; never called from publication or anonymous traffic. */
    async initialize(i: Identity, michoacanaSignupId: string) {
        const s = parseLifecycle(newLifecycle(i, michoacanaSignupId));
        return this.store.atomic(async (db) => {
            const site = await db.query('SELECT id FROM public.web_gratis_sites WHERE id=$1 AND signup_id=$2 FOR SHARE', [i.siteId, i.signupId]);
            requireThat(site.rows.length === 1, 'verified_site_binding_required');
            const q = await db.query('INSERT INTO billing_private.records(record_key,program,account_id,livemode,owner_id,tenant_id,signup_id,site_id,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) ON CONFLICT DO NOTHING RETURNING record_key', [this.key(i), PROGRAM, STRIPE_ACCOUNT, this.scope.livemode, i.ownerId, i.tenantId, i.signupId, i.siteId, JSON.stringify(s)]);
            if (!q.rowCount) {
                const old = await db.query('SELECT record_key FROM billing_private.records WHERE account_id=$1 AND livemode=$2 AND site_id=$3', [STRIPE_ACCOUNT, this.scope.livemode, i.siteId]);
                requireThat(old.rows[0]?.record_key === this.key(i), 'site_owned_elsewhere');
            }
            return this.key(i);
        });
    }
    async transaction<T>(i: Identity, fn: (s: Lifecycle) => Promise<T> | T, event?: VerifiedEvent) {
        const key = this.key(i), scope = { ...this.scope, ownerId: i.ownerId, tenantId: i.tenantId };
        return this.store.transaction(key, scope, parseLifecycle, async (state, db) => {
            if (this.actor) {
                const auth = await db.query('SELECT role FROM billing_private.identity_bindings WHERE record_key=$1 AND issuer=$2 AND subject=$3 AND role=$4 AND revoked_at IS NULL', [key, this.actor.issuer, this.actor.subject, this.actor.role]);
                requireThat(auth.rows.length === 1, 'authenticated_binding_required');
            }
            requireThat(state.signupId === i.signupId && state.siteId === i.siteId, 'record_ownership_mismatch');
            return fn(state);
        }, async (db, before, after) => {
            assertImmutable(before, after);
            for (const a of after.attempts) {
                const old = before.attempts.find(x => x.id === a.id);
                if (old)
                    for (const k of ['requestJson', 'generation', 'kind', 'createdAt', 'expiresAt'] as const)
                        requireThat(old[k] === a[k], 'attempt_request_changed');
                await db.query('INSERT INTO billing_private.attempts(attempt_id,record_key,generation,kind,request_json,request_sha256,created_at_epoch,expires_at_epoch,submit_before_epoch,status,session_id,url) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(attempt_id) DO UPDATE SET status=EXCLUDED.status,session_id=EXCLUDED.session_id,url=EXCLUDED.url WHERE billing_private.attempts.record_key=EXCLUDED.record_key AND billing_private.attempts.request_sha256=EXCLUDED.request_sha256 RETURNING attempt_id', [a.id, key, a.generation, a.kind, a.requestJson, sha256(a.requestJson), a.createdAt, a.expiresAt, a.expiresAt - 2700, a.status, a.sessionId, a.url]).then(q => requireThat(q.rowCount === 1, 'attempt_ownership_conflict'));
                if (a.sessionId)
                    await this.store.claim(db, scope, key, 'session', a.sessionId, a.id, sha256(a.requestJson));
            }
            const current = after.attempts.find(a => a.status === 'complete');
            if (after.subscriptionId) {
                requireThat(current, 'subscription_attempt_missing');
                await this.store.claim(db, scope, key, 'subscription', after.subscriptionId, current.id, sha256(after.subscriptionId));
            }
            if (after.customerId) {
                const q = await db.query('INSERT INTO billing_private.customer_bindings(account_id,livemode,customer_id,owner_id,tenant_id,client_id,evidence_ref) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING RETURNING customer_id', [scope.account, scope.livemode, after.customerId, scope.ownerId, scope.tenantId, after.acceptance!.subject, `website:${key}`]);
                if (!q.rowCount) {
                    const own = await db.query('SELECT owner_id,tenant_id,client_id FROM billing_private.customer_bindings WHERE account_id=$1 AND livemode=$2 AND customer_id=$3', [scope.account, scope.livemode, after.customerId]);
                    requireThat(own.rows[0]?.owner_id === scope.ownerId && own.rows[0]?.tenant_id === scope.tenantId && own.rows[0]?.client_id === after.acceptance!.subject, 'customer_owned_elsewhere');
                }
            }
            for (const [id, p] of Object.entries(after.invoices))
                if (!before.invoices[id]) {
                    requireThat(current?.sessionId, 'invoice_session_missing');
                    await this.store.claim(db, scope, key, 'invoice', id, current.id, sha256(JSON.stringify(p)));
                    await db.query('INSERT INTO billing_private.payments(account_id,livemode,payment_key,record_key,invoice_id,session_id,source,cents,currency,paid_at_epoch,service_period_end_epoch,receipt_digest) VALUES($1,$2,$3,$4,$3,$5,\'subscription_invoice\',$6,\'usd\',$7,$8,$9)', [scope.account, scope.livemode, id, key, current.sessionId, p.cents, p.paidAt, p.periodEnd, sha256(JSON.stringify(p))]);
                }
            for (const [id, digest] of Object.entries(after.events))
                if (!before.events[id])
                    await db.query('INSERT INTO billing_private.webhook_events(account_id,livemode,event_id,body_sha256,record_key,event_type,provider_created_epoch) VALUES($1,$2,$3,$4,$5,$6,$7)', [scope.account, scope.livemode, id, digest, key, event?.type ?? 'operator.recovery', event?.created ?? after.audit.at(-1)!.at]);
            for (let n = before.audit.length; n < after.audit.length; n++) {
                const a = after.audit[n];
                await db.query('INSERT INTO billing_private.audit(record_key,sequence,at_epoch,kind,actor_subject,evidence_ref,correlation_id) VALUES($1,$2,$3,$4,$5,$6,$7)', [key, n + 1, a.at, a.kind, a.actor, a.evidence, `audit:${key}:${n + 1}`]);
            }
            for (const day of [15, 20] as const)
                if (after.reminders[day] && !before.reminders[day])
                    await db.query('INSERT INTO billing_private.reminder_outbox(record_key,go_live_epoch,day,due_epoch,window_end_epoch,status,template_revision,link_generation) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [key, after.goLiveAt, day, after.goLiveAt! + day * 86400, after.goLiveAt! + (day + 1) * 86400, after.reminders[day], 'es-v1', after.link!.generation]);
        });
    }
    async locate(event: VerifiedEvent) {
        const o = event.data.object as Record<string, unknown>;
        const nested = (o.parent as {
            subscription_details?: {
                metadata?: unknown;
            };
        } | undefined)?.subscription_details?.metadata;
        const tags = [o.metadata, nested].find(v => v && typeof v === 'object' && (v as Record<string, unknown>).program === PROGRAM && typeof (v as Record<string, unknown>).attempt_id === 'string') as Record<string, unknown> | undefined;
        const attempt = typeof tags?.attempt_id === 'string' && tags.program === PROGRAM ? tags.attempt_id : null;
        return this.store.connection(async (db) => {
            const q = await db.query('SELECT r.state,a.attempt_id FROM billing_private.records r JOIN billing_private.attempts a ON a.record_key=r.record_key LEFT JOIN billing_private.provider_objects p ON p.record_key=r.record_key AND p.attempt_id=a.attempt_id WHERE r.program=$1 AND r.account_id=$2 AND r.livemode=$3 AND (a.attempt_id=$4 OR (p.object_id=$5 AND p.account_id=$2 AND p.livemode=$3))', [PROGRAM, STRIPE_ACCOUNT, this.scope.livemode, attempt, o.id]);
            const unique = new Map(q.rows.map(r => [String(r.attempt_id), r]));
            if (!unique.size) {
                requireThat(!attempt, 'owned_event_not_located');
                return null;
            }
            requireThat(unique.size === 1, 'ambiguous_event_ownership');
            const row = [...unique.values()][0], s = parseLifecycle(row.state);
            return { identity: { ownerId: s.ownerId, tenantId: s.tenantId, signupId: s.signupId, siteId: s.siteId }, attemptId: String(row.attempt_id) };
        });
    }
    forActor(actor: {
        issuer: string;
        subject: string;
        role: Principal['role'];
    }) { return new PostgresWebsiteRepository(this.store, this.scope.livemode, actor); }
    async loadAttempt(attemptId: string) { return this.store.connection(async (db) => { const q = await db.query('SELECT r.state FROM billing_private.records r JOIN billing_private.attempts a ON a.record_key=r.record_key WHERE a.attempt_id=$1 AND r.account_id=$2 AND r.livemode=$3 AND r.program=$4', [attemptId, STRIPE_ACCOUNT, this.scope.livemode, PROGRAM]); requireThat(q.rows.length === 1, 'attempt_missing'); return { state: parseLifecycle(q.rows[0].state), attemptId }; }); }
    async site(identity: Identity) {
        return this.store.connection(async (db) => {
            // Signup-only suspension does not advance the site's content version. Read
            // the bound signup alongside the site so cached HTML cannot hide that change.
            const q = await db.query('SELECT s.id,s.signup_id,s.slug,s.status,s.version,g.status AS signup_status FROM public.web_gratis_sites s INNER JOIN public.web_gratis_signups g ON g.id=s.signup_id WHERE s.id=$1 AND s.signup_id=$2', [identity.siteId, identity.signupId]);
            requireThat(q.rows.length === 1 && q.rows[0].id === identity.siteId && q.rows[0].signup_id === identity.signupId, 'site_binding_missing');
            return q.rows[0];
        });
    }
    async authorize(key: string, actor: {
        issuer: string;
        subject: string;
    }): Promise<{
        identity: Identity;
        principal: Principal;
        state: Lifecycle;
    }> {
        return this.store.connection(async (db) => {
            const q = await db.query('SELECT r.state,b.role FROM billing_private.records r JOIN billing_private.identity_bindings b ON b.record_key=r.record_key WHERE r.record_key=$1 AND r.program=$2 AND r.account_id=$3 AND r.livemode=$4 AND b.issuer=$5 AND b.subject=$6 AND b.revoked_at IS NULL', [key, PROGRAM, STRIPE_ACCOUNT, this.scope.livemode, actor.issuer, actor.subject]);
            requireThat(q.rows.length === 1 && ['client', 'operator'].includes(String(q.rows[0].role)), 'authenticated_binding_required');
            const s = parseLifecycle(q.rows[0].state);
            return { identity: { ownerId: s.ownerId, tenantId: s.tenantId, signupId: s.signupId, siteId: s.siteId }, principal: { ownerId: s.ownerId, tenantId: s.tenantId, subject: actor.subject, role: q.rows[0].role as Principal['role'] }, state: s };
        });
    }
    /** Legacy guard: fail closed on DB errors; caller must consult before any legacy side effect. */
    async hasLifecycle(siteId: string) { return this.store.connection(async (db) => (await db.query('SELECT record_key FROM billing_private.records WHERE account_id=$1 AND livemode=$2 AND site_id=$3', [STRIPE_ACCOUNT, this.scope.livemode, siteId])).rows.length > 0); }
}
