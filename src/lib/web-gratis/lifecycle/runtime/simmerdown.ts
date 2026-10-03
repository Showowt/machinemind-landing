import { z } from 'zod';
import { SIMMERDOWN, emptySimmerState, reserveSimmerDownCheckout, recordSimmerOctoberLinkPaid, recordSimmerOctoberPaid, recordSimmerRecurringEnrollment, type SimmerAgreement, type SimmerState } from '@/lib/billing/simmerdown-october';
import { requireThat, type Principal } from '../core';
import { sha256 } from '../checkout';
import { verifyEvent, supported, type VerifiedEvent } from '../webhook';
import { PostgresStore, type Scope, type SqlClient } from './postgres';
import { recordKey } from './state';
import { StripeClient, sessionSchema, referenceId, invoiceSchema } from './stripe';
export type SimmerCatalog = Parameters<typeof reserveSimmerDownCheckout>[2];
const str = z.string().min(1).max(500), epoch = z.number().int().positive();
const agreementSchema = z.object({ ownerId: str, clientId: str, customerId: str, agreementId: str, acceptedByClient: z.boolean(), acceptedAt: z.number().int().nonnegative(), evidence: z.string().max(500), octoberTotalCents: z.literal(30000), monthlyTotalCents: z.literal(30000), currency: z.literal('usd'), nextChargeAt: epoch, billingTimeZone: str, everyFirstAgreed: z.boolean() }).strict();
const billingStateSchema = z.object({ request: z.object({ kind: z.enum(['combined', 'recurring_only']), bindingDigest: str, livemode: z.boolean(), idempotencyKey: str, json: z.string().min(1).max(20000), expiresAt: epoch }).strict().nullable(), octoberPayment: z.object({ source: z.literal('one_time_link'), account: str, livemode: z.boolean(), ownerId: str, clientId: str, customerId: str, receiptId: str, fingerprint: str }).strict().nullable(), octoberInvoiceId: str.nullable(), subscriptionId: str.nullable(), canceled: z.boolean() }).strict();
const receiptSchema = z.object({ invoiceId: str.nullable(), intentId: str.nullable(), sessionId: str, cents: z.literal(30000), paidAt: epoch, periodEnd: epoch.nullable(), period: z.literal('2026-10').nullable(), digest: str }).strict();
const simmerSchema = z.object({ version: z.literal(1), agreement: agreementSchema, billing: billingStateSchema,
    attempts: z.array(z.object({ id: str, json: z.string().max(20000), createdAt: epoch, expiresAt: epoch, kind: z.enum(['combined', 'recurring_only']), status: z.enum(['creating', 'open', 'complete', 'expired']), sessionId: str.nullable(), url: z.string().url().nullable() }).strict()),
    events: z.record(str, str), payments: z.record(str, receiptSchema), paidThrough: epoch.nullable(), subscriptionStatus: str.nullable(),
    combinedApproval: z.object({ subject: str, evidence: str, at: epoch }).strict().nullable(),
    audit: z.array(z.object({ at: epoch, kind: str, actor: str, evidence: str }).strict()),
}).strict();
export type SimmerRecord = z.infer<typeof simmerSchema>;
export class SimmerRuntime {
    readonly key: string;
    readonly scope: Scope;
    constructor(readonly o: {
        store: PostgresStore;
        stripe: StripeClient;
        catalog: SimmerCatalog;
        ownerId: string;
        tenantId: string;
        clientId: string;
        origin: string;
        paymentLinkId: string;
        now: () => number;
        actor?: {
            issuer: string;
            subject: string;
            role: Principal['role'];
        };
    }) {
        this.scope = { program: SIMMERDOWN.program, account: SIMMERDOWN.account, livemode: o.stripe.livemode, ownerId: o.ownerId, tenantId: o.tenantId };
        this.key = recordKey(SIMMERDOWN.program, SIMMERDOWN.account, o.stripe.livemode, [o.ownerId, o.tenantId, o.clientId, '2026-10']);
        requireThat(o.catalog.livemode === o.stripe.livemode && /^plink_[A-Za-z0-9_]+$/.test(o.paymentLinkId) && (!o.stripe.livemode || o.paymentLinkId === SIMMERDOWN.octoberLink), 'simmer_provider_context_mismatch');
    }
    /** Explicit trusted owner seed only; no inferred customer or timezone defaults. */
    async initialize(agreement: SimmerAgreement, verifiedBinding: {
        evidence: string;
        verifiedBy: string;
    }) {
        requireThat(verifiedBinding.evidence.length > 0 && verifiedBinding.verifiedBy.length > 0, 'verified_customer_binding_required');
        const a = agreementSchema.parse(agreement);
        requireThat(a.ownerId === this.scope.ownerId && a.clientId === this.o.clientId && !a.acceptedByClient && !a.everyFirstAgreed && a.acceptedAt === 0, 'unaccepted_verified_seed_required');
        const state: SimmerRecord = { version: 1, agreement: a, billing: emptySimmerState(), attempts: [], events: {}, payments: {}, paidThrough: null, subscriptionStatus: null, combinedApproval: null, audit: [] };
        return this.o.store.atomic(async (db) => { const customer = await db.query('INSERT INTO billing_private.customer_bindings(account_id,livemode,customer_id,owner_id,tenant_id,client_id,evidence_ref) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING RETURNING customer_id', [this.scope.account, this.scope.livemode, a.customerId, this.scope.ownerId, this.scope.tenantId, this.o.clientId, verifiedBinding.evidence]); if (!customer.rowCount) {
            const old = await db.query('SELECT owner_id,tenant_id,client_id FROM billing_private.customer_bindings WHERE account_id=$1 AND livemode=$2 AND customer_id=$3', [this.scope.account, this.scope.livemode, a.customerId]);
            requireThat(old.rows[0]?.owner_id === this.scope.ownerId && old.rows[0]?.tenant_id === this.scope.tenantId && old.rows[0]?.client_id === this.o.clientId, 'customer_owned_elsewhere');
        } const q = await db.query('INSERT INTO billing_private.records(record_key,program,account_id,livemode,owner_id,tenant_id,client_id,billing_period,state) VALUES($1,$2,$3,$4,$5,$6,$7,\'2026-10\',$8::jsonb) ON CONFLICT DO NOTHING RETURNING record_key', [this.key, SIMMERDOWN.program, SIMMERDOWN.account, this.scope.livemode, this.scope.ownerId, this.scope.tenantId, this.o.clientId, JSON.stringify(state)]); requireThat(q.rowCount === 1, 'simmer_seed_already_exists_or_conflicts'); return this.key; });
    }
    async transaction<T>(principal: Principal | null, fn: (s: SimmerRecord) => Promise<T> | T, event?: VerifiedEvent) {
        if (principal) {
            requireThat(principal.ownerId === this.scope.ownerId && principal.tenantId === this.scope.tenantId, 'ownership_mismatch');
            requireThat(this.o.actor && this.o.actor.subject === principal.subject && this.o.actor.role === principal.role, 'verified_actor_required');
        }
        return this.o.store.transaction(this.key, this.scope, v => simmerSchema.parse(v), async (s, db) => { const customer = await db.query('SELECT owner_id,tenant_id,client_id FROM billing_private.customer_bindings WHERE account_id=$1 AND livemode=$2 AND customer_id=$3', [this.scope.account, this.scope.livemode, s.agreement.customerId]); requireThat(customer.rows[0]?.owner_id === this.scope.ownerId && customer.rows[0]?.tenant_id === this.scope.tenantId && customer.rows[0]?.client_id === this.o.clientId, 'customer_owned_elsewhere'); if (principal && this.o.actor) {
            const q = await db.query('SELECT role FROM billing_private.identity_bindings WHERE record_key=$1 AND issuer=$2 AND subject=$3 AND role=$4 AND revoked_at IS NULL', [this.key, this.o.actor.issuer, this.o.actor.subject, this.o.actor.role]);
            requireThat(q.rows.length === 1, 'authenticated_binding_required');
        } return fn(s); }, (db, before, after) => this.project(db, before, after, event));
    }
    private async project(db: SqlClient, b: SimmerRecord, s: SimmerRecord, event?: VerifiedEvent) {
        requireThat(s.agreement.ownerId === this.scope.ownerId && s.agreement.clientId === this.o.clientId, 'simmer_state_binding_mismatch');
        const immutable = ['ownerId', 'clientId', 'customerId', 'agreementId', 'octoberTotalCents', 'monthlyTotalCents', 'currency', 'nextChargeAt', 'billingTimeZone'] as const;
        for (const k of immutable)
            requireThat(b.agreement[k] === s.agreement[k], 'simmer_agreement_changed');
        if (b.agreement.acceptedByClient)
            requireThat(JSON.stringify(b.agreement) === JSON.stringify(s.agreement), 'simmer_consent_changed');
        requireThat(JSON.stringify(s.audit.slice(0, b.audit.length)) === JSON.stringify(b.audit), 'simmer_audit_changed');
        for (const [id, r] of Object.entries(b.payments))
            requireThat(JSON.stringify(s.payments[id]) === JSON.stringify(r), 'payment_receipt_changed');
        for (const [id, d] of Object.entries(b.events))
            requireThat(s.events[id] === d, 'event_receipt_changed');
        for (const a of s.attempts) {
            const old = b.attempts.find(x => x.id === a.id);
            if (old)
                requireThat(old.json === a.json && old.expiresAt === a.expiresAt && old.kind === a.kind, 'simmer_request_changed');
            const q = await db.query('INSERT INTO billing_private.attempts(attempt_id,record_key,generation,kind,request_json,request_sha256,created_at_epoch,expires_at_epoch,submit_before_epoch,status,session_id,url) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(attempt_id) DO UPDATE SET status=EXCLUDED.status,session_id=EXCLUDED.session_id,url=EXCLUDED.url WHERE billing_private.attempts.record_key=EXCLUDED.record_key AND billing_private.attempts.request_sha256=EXCLUDED.request_sha256 RETURNING attempt_id', [a.id, this.key, null, a.kind, a.json, sha256(a.json), a.createdAt, a.expiresAt, a.expiresAt - 2700, a.status, a.sessionId, a.url]);
            requireThat(q.rowCount === 1, 'attempt_ownership_conflict');
            if (a.sessionId)
                await this.o.store.claim(db, this.scope, this.key, 'session', a.sessionId, a.id, sha256(a.json));
        }
        const complete = s.attempts.find(a => a.status === 'complete');
        if (s.billing.subscriptionId) {
            requireThat(complete, 'subscription_attempt_missing');
            await this.o.store.claim(db, this.scope, this.key, 'subscription', s.billing.subscriptionId, complete.id, sha256(s.billing.subscriptionId));
        }
        for (const [id, p] of Object.entries(s.payments))
            if (!b.payments[id]) {
                const attempt = s.attempts.find(a => a.sessionId === p.sessionId)?.id ?? null;
                await this.o.store.claim(db, this.scope, this.key, 'session', p.sessionId, attempt, p.digest);
                if (p.invoiceId)
                    await this.o.store.claim(db, this.scope, this.key, 'invoice', p.invoiceId, attempt, p.digest);
                if (p.intentId)
                    await this.o.store.claim(db, this.scope, this.key, 'payment_intent', p.intentId, attempt, p.digest);
                await db.query('INSERT INTO billing_private.payments(account_id,livemode,payment_key,record_key,invoice_id,payment_intent_id,session_id,source,billing_period,cents,currency,paid_at_epoch,service_period_end_epoch,receipt_digest) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,\'usd\',$11,$12,$13)', [this.scope.account, this.scope.livemode, id, this.key, p.invoiceId, p.intentId, p.sessionId, p.intentId ? 'one_time_link' : 'subscription_invoice', p.period, p.cents, p.paidAt, p.periodEnd, p.digest]);
            }
        for (const [id, d] of Object.entries(s.events))
            if (!b.events[id])
                await db.query('INSERT INTO billing_private.webhook_events(account_id,livemode,event_id,body_sha256,record_key,event_type,provider_created_epoch) VALUES($1,$2,$3,$4,$5,$6,$7)', [this.scope.account, this.scope.livemode, id, d, this.key, event?.type ?? 'operator.recovery', event?.created ?? this.o.now()]);
        for (let n = b.audit.length; n < s.audit.length; n++) {
            const a = s.audit[n];
            await db.query('INSERT INTO billing_private.audit(record_key,sequence,at_epoch,kind,actor_subject,evidence_ref,correlation_id) VALUES($1,$2,$3,$4,$5,$6,$7)', [this.key, n + 1, a.at, a.kind, a.actor, a.evidence, `${this.key}:${n + 1}`]);
        }
    }
    async accept(principal: Principal) { requireThat(principal.role === 'client', 'client_required'); return this.transaction(principal, s => { if (s.agreement.acceptedByClient)
        return 'already_accepted'; s.agreement.acceptedByClient = true; s.agreement.everyFirstAgreed = true; s.agreement.acceptedAt = this.o.now(); s.agreement.evidence = `client-schedule:${sha256(JSON.stringify([principal.subject, s.agreement, this.o.now()]))}`; s.audit.push({ at: this.o.now(), kind: 'client_accepted_schedule', actor: principal.subject, evidence: s.agreement.evidence }); return 'accepted'; }); }
    async approveCombined(principal: Principal, evidence: string) { requireThat(principal.role === 'operator' && evidence.length > 0 && evidence.length <= 500, 'operator_evidence_required'); return this.transaction(principal, s => { s.combinedApproval = { subject: principal.subject, evidence, at: this.o.now() }; s.audit.push({ at: this.o.now(), kind: 'combined_path_approved', actor: principal.subject, evidence }); }); }
    private async captureOctober(s: SimmerRecord) {
        const sessions = (await this.o.stripe.list('/v1/checkout/sessions', { payment_link: this.o.paymentLinkId })).map(x => sessionSchema.parse(x));
        let outstanding = false;
        for (const candidate of sessions) {
            const session = await this.o.stripe.session(candidate.id);
            requireThat(referenceId(session.payment_link) === this.o.paymentLinkId, 'cash_link_mismatch');
            if (referenceId(session.customer) !== s.agreement.customerId) {
                requireThat(session.status === 'expired', 'unmapped_october_payment_requires_owner_binding');
                continue;
            }
            if (session.status !== 'complete' || session.payment_status !== 'paid') {
                if (session.status !== 'expired')
                    outstanding = true;
                continue;
            }
            const lines = await this.o.stripe.sessionLines(session.id);
            requireThat(lines.length === 1 && lines[0].price.livemode === this.scope.livemode && session.total_details.amount_discount === 0 && session.total_details.amount_shipping === 0, 'october_line_mismatch');
            const pi = z.object({ id: z.string(), livemode: z.boolean(), customer: z.unknown(), status: z.string(), amount_received: z.number().int(), currency: z.string(), created: epoch, latest_charge: z.unknown() }).parse(await this.o.stripe.request('GET', `/v1/payment_intents/${referenceId(session.payment_intent)}`));
            requireThat(pi.id === referenceId(session.payment_intent) && pi.livemode === this.scope.livemode && referenceId(pi.customer) === s.agreement.customerId && pi.currency === 'usd' && pi.amount_received === 30000 && lines[0].amount_total === 30000, 'october_intent_mismatch');
            const charge = z.object({ id: str, livemode: z.boolean(), customer: z.unknown(), payment_intent: z.unknown(), paid: z.literal(true), captured: z.literal(true), refunded: z.literal(false), amount_refunded: z.literal(0), amount_captured: z.literal(30000), currency: z.literal('usd'), created: epoch }).parse(await this.o.stripe.request('GET', `/v1/charges/${referenceId(pi.latest_charge)}`));
            requireThat(charge.id === referenceId(pi.latest_charge) && charge.livemode === this.scope.livemode && referenceId(charge.customer) === s.agreement.customerId && referenceId(charge.payment_intent) === pi.id, 'october_charge_mismatch');
            const invoiceId = referenceId(session.invoice);
            let paidAt = charge.created;
            if (invoiceId) {
                const invoice = invoiceSchema.parse(await this.o.stripe.request('GET', `/v1/invoices/${invoiceId}`));
                requireThat(invoice.id === invoiceId && invoice.livemode === this.scope.livemode && referenceId(invoice.customer) === s.agreement.customerId && invoice.status === 'paid' && invoice.amount_paid === 30000 && invoice.total === 30000 && invoice.currency === 'usd' && invoice.status_transitions.paid_at, 'october_invoice_mismatch');
                paidAt = invoice.status_transitions.paid_at;
            }
            requireThat(this.o.catalog.october, 'october_catalog_required');
            const receipt = { account: this.scope.account, livemode: this.scope.livemode, customerId: s.agreement.customerId, ownerId: s.agreement.ownerId, clientId: s.agreement.clientId, sessionId: session.id, paymentIntentId: pi.id, invoiceId, paymentLinkId: this.o.paymentLinkId, mode: session.mode, status: session.status, paymentStatus: session.payment_status, paymentIntentStatus: pi.status, cents: session.amount_total!, currency: session.currency!, quantity: lines[0].quantity, priceId: lines[0].price.id, billingPeriod: '2026-10' };
            recordSimmerOctoberLinkPaid(s.billing as SimmerState, s.agreement, { verifiedOctoberProductId: this.o.catalog.verifiedOctoberProductId, october: this.o.catalog.october, livemode: this.scope.livemode }, receipt);
            const payment = { invoiceId, intentId: pi.id, sessionId: session.id, cents: 30000 as const, paidAt, periodEnd: null, period: '2026-10' as const, digest: sha256(JSON.stringify(receipt)) };
            if (s.payments[pi.id])
                requireThat(s.payments[pi.id].digest === payment.digest, 'october_receipt_conflict');
            else
                s.payments[pi.id] = payment;
        }
        return outstanding;
    }
    private async combinedControl(s: SimmerRecord, outstanding: boolean) {
        const link = z.object({ id: z.string(), livemode: z.boolean(), active: z.boolean() }).parse(await this.o.stripe.request('GET', `/v1/payment_links/${this.o.paymentLinkId}`));
        requireThat(link.id === this.o.paymentLinkId && link.livemode === this.scope.livemode, 'cash_link_mode_mismatch');
        if (!s.combinedApproval || link.active || outstanding)
            return undefined;
        return { combinedAuthorized: true as const, oneTimeLinkInactiveVerified: true as const, evidence: s.combinedApproval.evidence, verifiedAt: this.o.now() };
    }
    async checkout(principal: Principal) {
        requireThat(principal.role === 'client', 'client_required');
        const decision = await this.transaction(principal, async (s) => {
            const outstanding = await this.captureOctober(s), control = s.billing.octoberPayment ? undefined : await this.combinedControl(s, outstanding);
            const r = reserveSimmerDownCheckout(s.billing as SimmerState, s.agreement, { ...this.o.catalog, combinedAuthorization: control }, this.o.origin, this.o.now());
            if (r.kind === 'ready' && !s.attempts.some(a => a.id === r.idempotencyKey))
                s.attempts.push({ id: r.idempotencyKey, json: JSON.stringify(r.params), createdAt: this.o.now(), expiresAt: r.params.expires_at, kind: s.billing.request!.kind, status: 'creating', sessionId: null, url: null });
            return r;
        });
        if (decision.kind !== 'ready')
            return decision;
        return this.transaction(principal, async (s) => {
            requireThat(!s.billing.canceled && !s.billing.subscriptionId, 'already_enrolled_or_canceled');
            const a = s.attempts.find(a => a.id === decision.idempotencyKey);
            requireThat(a, 'attempt_missing');
            const outstanding = await this.captureOctober(s);
            if (a.kind === 'combined')
                requireThat(!s.billing.octoberPayment && await this.combinedControl(s, outstanding), 'competing_october_path_review');
            if (a.sessionId && a.url && this.o.now() < a.expiresAt)
                return { kind: 'session' as const, url: a.url };
            const response = await this.o.stripe.create(JSON.parse(a.json) as Record<string, unknown>, a.id);
            a.sessionId = response.id;
            a.url = response.url;
            a.status = 'open';
            return { kind: 'session' as const, url: response.url };
        });
    }
    async reconcile(principal: Principal | null, event?: VerifiedEvent) {
        return this.transaction(principal, async (s) => {
            if (event && s.events[event.id]) {
                requireThat(s.events[event.id] === event.digest, 'event_payload_conflict');
                return 'duplicate';
            }
            if (event && !await this.ownsEvent(s, event))
                return 'unowned';
            await this.captureOctober(s);
            const a = s.attempts.find(a => a.status !== 'expired');
            if (a) {
                const session = await this.o.stripe.findSession(a.id, a.createdAt, a.sessionId, event?.type.startsWith('checkout.session.') ? event : undefined), params = JSON.parse(a.json);
                requireThat(referenceId(session.customer) === s.agreement.customerId && Object.entries(params.metadata as Record<string, string>).every(([k, v]) => session.metadata[k] === v) && session.expires_at === a.expiresAt, 'simmer_session_binding_mismatch');
                const subId = referenceId(session.subscription);
                a.sessionId = session.id;
                if (session.status === 'expired' && !subId) {
                    a.status = 'expired';
                    if (a.kind === 'combined' && s.billing.octoberPayment)
                        s.billing.request = null;
                }
                else if (session.status === 'complete' && subId) {
                    const sub = await this.o.stripe.subscription(subId), lines = await this.o.stripe.sessionLines(session.id);
                    requireThat(referenceId(sub.customer) === s.agreement.customerId && sub.items.data.length === 1 && Object.entries(params.subscription_data.metadata as Record<string, string>).every(([k, v]) => sub.metadata[k] === v) && sub.trial_end === s.agreement.nextChargeAt, 'simmer_subscription_binding_mismatch');
                    const item = sub.items.data[0];
                    requireThat(item.price.id === this.o.catalog.recurring.id && item.price.livemode === this.scope.livemode && item.quantity === 1 && item.price.unit_amount === 30000 && item.price.currency === 'usd' && item.price.recurring?.interval === 'month' && item.price.recurring.interval_count === 1, 'simmer_subscription_price_mismatch');
                    if (a.kind === 'combined') {
                        const invoiceId = referenceId(session.invoice);
                        requireThat(invoiceId, 'october_invoice_required');
                        const invoice = invoiceSchema.parse(await this.o.stripe.request('GET', `/v1/invoices/${invoiceId}`));
                        requireThat(invoice.id === invoiceId && invoice.livemode === this.scope.livemode && referenceId(invoice.customer) === s.agreement.customerId && referenceId(invoice.parent?.subscription_details?.subscription ?? null) === subId && invoice.total === 30000 && invoice.amount_due === 30000 && invoice.currency === 'usd' && invoice.starting_balance === 0 && (invoice.ending_balance === 0 || invoice.ending_balance === null), 'october_invoice_binding_mismatch');
                        const failedInitial = event?.type === 'invoice.payment_failed' && event.data.object.id === invoiceId && invoice.status === 'open' && invoice.amount_paid === 0;
                        if (failedInitial) {
                            await this.o.stripe.cancelOwnedSubscription(subId, s.agreement.customerId, params.subscription_data.metadata, `failed_october_${a.id}`);
                            sub.status = 'canceled';
                        }
                        if (session.payment_status !== 'paid' && ['canceled', 'incomplete_expired'].includes(sub.status)) {
                            s.billing.subscriptionId = subId;
                            s.billing.canceled = true;
                            s.subscriptionStatus = sub.status;
                            a.status = 'complete';
                            if (event) {
                                s.events[event.id] = event.digest;
                                s.audit.push({ at: this.o.now(), kind: failedInitial ? 'initial_payment_failed_subscription_canceled' : 'unpaid_subscription_terminal', actor: 'stripe', evidence: event.id });
                            }
                            return 'applied';
                        }
                        requireThat(session.payment_status === 'paid', 'october_payment_pending_review');
                        requireThat(invoice.status === 'paid' && invoice.livemode === this.scope.livemode && referenceId(invoice.customer) === s.agreement.customerId && referenceId(invoice.parent?.subscription_details?.subscription ?? null) === subId && invoice.total === 30000 && invoice.amount_paid === 30000 && invoice.currency === 'usd' && invoice.status_transitions.paid_at, 'october_invoice_mismatch');
                        requireThat(lines.length === 2 && lines.find(l => l.price.id === this.o.catalog.recurring.id)?.amount_total === 0, 'combined_line_mismatch');
                        const oct = lines.find(l => l.price.id === this.o.catalog.october!.id);
                        requireThat(oct && oct.quantity === 1 && oct.price.livemode === this.scope.livemode, 'october_line_mismatch');
                        recordSimmerOctoberPaid(s.billing as SimmerState, s.agreement, { account: this.scope.account, livemode: this.scope.livemode, customerId: s.agreement.customerId, attemptId: a.id, sessionStatus: session.status, paymentStatus: session.payment_status, invoiceId, subscriptionId: subId, cents: session.amount_total!, currency: session.currency!, trialEnd: sub.trial_end!, oneTimePriceId: oct.price.id, oneTimeCents: oct.amount_total, recurringCentsNow: 0 });
                        if (!s.payments[invoiceId])
                            s.payments[invoiceId] = { invoiceId, intentId: null, sessionId: session.id, cents: 30000, paidAt: invoice.status_transitions.paid_at, periodEnd: null, period: '2026-10', digest: sha256(JSON.stringify([invoiceId, session.id, 30000])) };
                    }
                    else
                        recordSimmerRecurringEnrollment(s.billing as SimmerState, s.agreement, { account: this.scope.account, livemode: this.scope.livemode, customerId: s.agreement.customerId, attemptId: a.id, sessionStatus: session.status, subscriptionId: subId, subscriptionStatus: sub.status, trialEnd: sub.trial_end!, priceId: item.price.id, quantity: item.quantity, cents: item.price.unit_amount, currency: item.price.currency, amountTotalNow: session.amount_total!, lineItemCount: lines.length, paymentMethodReady: !!referenceId(sub.default_payment_method) }, this.o.now());
                    requireThat(!s.billing.canceled || ['canceled', 'incomplete_expired'].includes(sub.status), 'terminal_subscription_conflict');
                    s.subscriptionStatus = sub.status;
                    if (['canceled', 'incomplete_expired'].includes(sub.status))
                        s.billing.canceled = true;
                    a.status = 'complete';
                    const paid = await this.o.stripe.paidInvoices(sub.id, s.agreement.customerId, item.price.id, 30000, s.billing.octoberInvoiceId ? [s.billing.octoberInvoiceId] : []);
                    for (const p of paid) {
                        requireThat(p.periodStart >= s.agreement.nextChargeAt && p.paidAt >= s.agreement.nextChargeAt, 'simmer_early_renewal');
                        const digest = sha256(JSON.stringify(p));
                        if (s.payments[p.id])
                            requireThat(s.payments[p.id].digest === digest, 'renewal_receipt_conflict');
                        else
                            s.payments[p.id] = { invoiceId: p.id, intentId: null, sessionId: session.id, cents: 30000, paidAt: p.paidAt, periodEnd: p.periodEnd, period: null, digest };
                        s.paidThrough = Math.max(s.paidThrough ?? 0, p.periodEnd);
                    }
                }
                else
                    requireThat(session.status === 'open', 'simmer_subscription_not_ready');
            }
            if (event) {
                s.events[event.id] = event.digest;
                s.audit.push({ at: this.o.now(), kind: 'stripe_reconciled', actor: 'stripe', evidence: event.id });
            }
            return 'applied';
        }, event);
    }
    private async ownsEvent(s: SimmerRecord, event: VerifiedEvent) {
        const id = event.data.object.id;
        if (event.type.startsWith('checkout.session.')) {
            const session = await this.o.stripe.session(id);
            return referenceId(session.customer) === s.agreement.customerId && (referenceId(session.payment_link) === this.o.paymentLinkId || s.attempts.some(a => a.id === session.metadata.attempt_id && session.metadata.program === SIMMERDOWN.program));
        }
        if (event.type.startsWith('customer.subscription.')) {
            const sub = await this.o.stripe.subscription(id);
            return referenceId(sub.customer) === s.agreement.customerId && sub.metadata.program === SIMMERDOWN.program && s.attempts.some(a => a.id === sub.metadata.attempt_id);
        }
        if (event.type.startsWith('invoice.')) {
            const invoice = invoiceSchema.parse(await this.o.stripe.request('GET', `/v1/invoices/${id}`));
            if (invoice.livemode !== this.scope.livemode || referenceId(invoice.customer) !== s.agreement.customerId)
                return false;
            const subId = referenceId(invoice.parent?.subscription_details?.subscription ?? null);
            if (subId) {
                const sub = await this.o.stripe.subscription(subId);
                return referenceId(sub.customer) === s.agreement.customerId && sub.metadata.program === SIMMERDOWN.program && s.attempts.some(a => a.id === sub.metadata.attempt_id);
            }
            const cash = (await this.o.stripe.list('/v1/checkout/sessions', { payment_link: this.o.paymentLinkId })).map(x => sessionSchema.parse(x));
            return cash.some(c => referenceId(c.invoice) === id && referenceId(c.customer) === s.agreement.customerId && referenceId(c.payment_link) === this.o.paymentLinkId);
        }
        return false;
    }
    async webhook(raw: string, signature: string | null, secret: string) { const event = verifyEvent(raw, signature, secret, { account: this.scope.account, livemode: this.scope.livemode }, this.o.now()); if (!supported(event))
        return 'ignored'; return this.reconcile(null, event); }
    async withdraw(principal: Principal, evidence: string) {
        requireThat(principal.role === 'client' && evidence.length > 0 && evidence.length <= 500, 'client_evidence_required');
        await this.transaction(principal, s => { s.billing.canceled = true; s.audit.push({ at: this.o.now(), kind: 'client_withdrew', actor: principal.subject, evidence }); });
        return this.transaction(principal, async (s) => { for (const a of s.attempts.filter(a => a.status !== 'expired')) {
            let session = await this.o.stripe.findSession(a.id, a.createdAt, a.sessionId);
            const params = JSON.parse(a.json);
            requireThat(referenceId(session.customer) === s.agreement.customerId && session.metadata.attempt_id === a.id, 'cancellation_owner_mismatch');
            if (session.status === 'open') {
                await this.o.stripe.request('POST', `/v1/checkout/sessions/${session.id}/expire`, {}, `withdraw_${a.id}`);
                session = await this.o.stripe.session(session.id);
            }
            requireThat(session.status !== 'open', 'session_expiry_pending');
            const sub = referenceId(session.subscription);
            if (sub)
                await this.o.stripe.cancelOwnedSubscription(sub, s.agreement.customerId, params.subscription_data.metadata, `withdraw_${sub}`);
            else
                a.status = 'expired';
        } s.subscriptionStatus = 'canceled'; return 'canceled'; });
    }
}
