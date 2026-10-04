import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { FixturePool, FixtureStripe, fixturePrice } from './fixtures/billing-runtime';
import { PostgresStore, PostgresWebsiteRepository } from '../../src/lib/web-gratis/lifecycle/runtime/postgres';
import { StripeClient } from '../../src/lib/web-gratis/lifecycle/runtime/stripe';
import { billingHttp, publicationVerifier } from '../../src/lib/web-gratis/lifecycle/runtime/http';
import { recoverWebsite } from '../../src/lib/web-gratis/lifecycle/runtime/recovery';
import { SimmerRuntime } from '../../src/lib/web-gratis/lifecycle/runtime/simmerdown';
import { DAY, STRIPE_ACCOUNT, type Principal } from '../../src/lib/web-gratis/lifecycle/core';
import { parseLifecycle } from '../../src/lib/web-gratis/lifecycle/runtime/state';
import { type SimmerAgreement } from '../../src/lib/billing/simmerdown-october';
const START = Date.parse('2026-10-03T12:00:00Z') / 1000, KEY = 'fixture-only-not-a-secret-not-for-production';
const origin = 'https://billing.example.test';
const identity = { ownerId: 'owner_fixture', tenantId: 'tenant_fixture', signupId: '11111111-1111-4111-8111-111111111111', siteId: '22222222-2222-4222-8222-222222222222' };
const client: Principal = { ...identity, subject: 'client_fixture', role: 'client' }, operator: Principal = { ...client, subject: 'phil_fixture', role: 'operator' };
const sign = (raw: string, at: number) => `t=${at},v1=${createHmac('sha256', KEY).update(`${at}.${raw}`).digest('hex')}`;
function bind(pool: FixturePool, key: string) {
    for (const p of [client, operator])
        pool.tables.identity_bindings.push({ record_key: key, issuer: 'fixture-issuer', subject: p.subject, role: p.role, revoked_at: null });
}
async function website(authenticate?: Parameters<typeof billingHttp>[0]['authenticate']) {
    let now = START;
    const pool = new FixturePool(), store = new PostgresStore(pool), repo = new PostgresWebsiteRepository(store, false), provider = new FixtureStripe(() => now), stripe = new StripeClient({ secretKey: 'sk_test_fixture_only', livemode: false, transport: provider.transport, now: () => now });
    pool.tables.sites.push({ id: identity.siteId, signup_id: identity.signupId, status: 'published', slug: 'fixture-site', version: 2 });
    pool.tables.signups.push({ id: identity.signupId, status: 'entregada' });
    const key = await repo.initialize(identity, '33333333-3333-4333-8333-333333333333');
    bind(pool, key);
    const catalog = await stripe.catalog('price_test20', 'price_test19');
    const publicRequests: string[] = [];
    const publicTransport: typeof fetch = async (input) => {
        publicRequests.push(String(input));
        return new Response('<!doctype html><html><body>' + 'Synthetic published fixture '.repeat(8) + '</body></html>', { headers: { 'content-type': 'text/html', 'x-mm-site-id': identity.siteId, 'x-mm-site-version': '2' } });
    };
    const handle = billingHttp({ repository: repo, stripe, now: () => now, origin, signingKey: KEY, webhookSecret: KEY, catalog, agreement: { revision: 'fixture-approved-v1', summary: 'Synthetic approved agreement; USD20 after thirty days.' }, displayTimezone: 'UTC', authenticate: authenticate ?? (async (r) => { const token = r.headers.get('authorization'); return token === 'fixture-client' ? { issuer: 'fixture-issuer', subject: client.subject } : token === 'fixture-phil' ? { issuer: 'fixture-issuer', subject: operator.subject } : null; }), verifyPublication: publicationVerifier(repo, publicTransport) });
    const req = (action: string, data: unknown = {}, role = 'client', extra: Record<string, string> = {}) => handle(new Request(`${origin}/api/web-gratis/billing/${action}?record=${key}`, { method: 'POST', headers: { authorization: `fixture-${role}`, 'content-type': 'application/json', origin, ...extra }, body: JSON.stringify(data) }));
    const state = () => parseLifecycle(pool.tables.records.find(r => r.record_key === key)!.state);
    async function live() { assert.equal((await req('accept', { siteVersion: 2, terms: 'fixture-approved-v1', cents: 2000, currency: 'usd', interval: 'month', approveSiteAndGoLive: true, agreeBilling: true, remindersAgreed: true, evidence: 'fixture-request' })).status, 200); assert.equal((await req('approve', { siteVersion: 2, evidence: 'fixture-phil-review' }, 'phil')).status, 200); assert.equal((await req('go-live', { mode: 'accepted_go_live', siteVersion: 2 }, 'phil')).status, 200); }
    async function link() { const r = await req('issue-link', {}, 'phil'); assert.equal(r.status, 200); return (await r.json()).result.token as string; }
    async function webhook(type: string, id: string, object: Record<string, unknown>) { const raw = JSON.stringify({ id, type, created: now, livemode: false, data: { object } }); return handle(new Request(`${origin}/api/web-gratis/billing/webhook`, { method: 'POST', headers: { 'stripe-signature': sign(raw, now) }, body: raw })); }
    return { pool, repo, stripe, provider, key, handle, req, state, live, link, webhook, publicTransport, publicRequests, time: (n: number) => { now = n; }, now: () => now };
}
const acceptanceInput = { siteVersion: 2, terms: 'fixture-approved-v1', cents: 2000, currency: 'usd', interval: 'month', approveSiteAndGoLive: true, agreeBilling: true, remindersAgreed: true, evidence: 'fixture-request' };
function assertAcceptanceOnly(f: Awaited<ReturnType<typeof website>>, providerRequests: number) {
    assert.equal(f.state().acceptance?.at, START);
    assert.equal(f.state().goLiveAt, null);
    assert.equal(f.state().trialEnd, null);
    assert.equal(f.pool.tables.audit.length, 1);
    assert.equal(f.pool.tables.audit[0].kind, 'client_accepted');
    for (const table of ['reminder_outbox', 'attempts', 'provider_objects', 'payments', 'webhook_events'])
        assert.equal(f.pool.tables[table].length, 0, table);
    assert.equal(f.provider.requests.length, providerRequests);
    assert.equal(f.publicRequests.length, 0);
}
test('acceptance JSON lost-response retries preserve original consent despite time, field order and supplied evidence', async () => {
    const f = await website(), providerRequests = f.provider.requests.length;
    assert.equal((await f.req('accept', acceptanceInput)).status, 200);
    const persisted = structuredClone(f.pool.tables);
    for (const elapsed of [1, 60]) {
        f.time(START + elapsed);
        const retry = Object.fromEntries(Object.entries({ ...acceptanceInput, evidence: `retry-${elapsed}` }).reverse());
        assert.equal((await f.req('accept', retry)).status, 200);
        assert.deepEqual(f.pool.tables, persisted);
    }
    assertAcceptanceOnly(f, providerRequests);
});
for (const remindersAgreed of [false, true])
    test(`acceptance form retries and equivalent JSON preserve consent (reminders=${remindersAgreed})`, async () => {
        const f = await website(), providerRequests = f.provider.requests.length;
        const fields: Record<string, string> = { siteVersion: '2', terms: acceptanceInput.terms, cents: '2000', currency: 'usd', interval: 'month', approveSiteAndGoLive: 'on', agreeBilling: 'on', ...(remindersAgreed ? { remindersAgreed: 'on' } : {}) };
        const submit = (data: Record<string, string>) => f.handle(new Request(`${origin}/api/web-gratis/billing/accept?record=${f.key}`, { method: 'POST', headers: { authorization: 'fixture-client', origin, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(data) }));
        assert.equal((await submit(fields)).status, 303);
        const persisted = structuredClone(f.pool.tables);
        f.time(START + 1);
        const retry = await submit(Object.fromEntries(Object.entries({ ...fields, evidence: 'ignored-client-value' }).reverse()));
        assert.equal(retry.status, 303);
        assert.equal(retry.headers.get('location'), `/web/billing?record=${f.key}`);
        f.time(START + 60);
        assert.equal((await f.req('accept', { ...acceptanceInput, remindersAgreed, evidence: 'json-equivalent' })).status, 200);
        assert.deepEqual(f.pool.tables, persisted);
        assert.equal(f.state().acceptance?.remindersAgreed, remindersAgreed);
        assertAcceptanceOnly(f, providerRequests);
    });
test('acceptance retry still rejects changed agreement, version, quote, reminder choice and invalid requests', async () => {
    const f = await website(), providerRequests = f.provider.requests.length;
    assert.equal((await f.req('accept', acceptanceInput)).status, 200);
    const persisted = structuredClone(f.pool.tables);
    f.time(START + 1);
    for (const [change, status] of [
        [{ terms: 'changed-revision' }, 409], [{ siteVersion: 3 }, 409], [{ cents: 1900 }, 409],
        [{ remindersAgreed: false }, 409], [{ approveSiteAndGoLive: false }, 400], [{ agreeBilling: false }, 400],
        [{ currency: 'eur' }, 400], [{ interval: 'year' }, 400], [{ evidence: '' }, 400], [{ extra: 'unexpected' }, 400],
    ] as const) {
        assert.equal((await f.req('accept', { ...acceptanceInput, ...change })).status, status, JSON.stringify(change));
        assert.deepEqual(f.pool.tables, persisted);
    }
    // Even if the published version advances, retry cannot replace accepted version 2.
    f.pool.tables.sites[0].version = 3;
    assert.equal((await f.req('accept', { ...acceptanceInput, siteVersion: 3 })).status, 409);
    assert.deepEqual(f.state(), persisted.records[0].state);
    assertAcceptanceOnly(f, providerRequests);
});
for (const actorChange of [{ issuer: 'fixture-issuer', subject: 'other-client' }, { issuer: 'other-issuer', subject: client.subject }])
    test(`acceptance retry is bound to authenticated issuer and subject: ${JSON.stringify(actorChange)}`, async () => {
        let actor = { issuer: 'fixture-issuer', subject: client.subject };
        const f = await website(async () => actor), providerRequests = f.provider.requests.length;
        assert.equal((await f.req('accept', acceptanceInput)).status, 200);
        // Both are authorized for the record, but cannot take over an existing acceptance.
        f.pool.tables.identity_bindings.push({ record_key: f.key, ...actorChange, role: 'client', revoked_at: null });
        const persisted = structuredClone(f.pool.tables);
        actor = actorChange;
        f.time(START + 1);
        assert.equal((await f.req('accept', acceptanceInput)).status, 409);
        assert.deepEqual(f.pool.tables, persisted);
        assertAcceptanceOnly(f, providerRequests);
    });
test('acceptance evidence is distinct for separately authorized records', async () => {
    const f = await website(), providerRequests = f.provider.requests.length;
    assert.equal((await f.req('accept', acceptanceInput)).status, 200);
    const second = { ...identity, signupId: '44444444-4444-4444-8444-444444444444', siteId: '55555555-5555-4555-8555-555555555555' };
    f.pool.tables.sites.push({ id: second.siteId, signup_id: second.signupId, status: 'published', slug: 'second-fixture', version: 2 });
    f.pool.tables.signups.push({ id: second.signupId, status: 'entregada' });
    const secondKey = await f.repo.initialize(second, '33333333-3333-4333-8333-333333333333');
    bind(f.pool, secondKey);
    const response = await f.handle(new Request(`${origin}/api/web-gratis/billing/accept?record=${secondKey}`, { method: 'POST', headers: { authorization: 'fixture-client', origin, 'content-type': 'application/json' }, body: JSON.stringify(acceptanceInput) }));
    assert.equal(response.status, 200);
    const other = parseLifecycle(f.pool.tables.records.find(r => r.record_key === secondKey)!.state);
    assert.notEqual(other.acceptance?.evidence, f.state().acceptance?.evidence);
    assert.equal(f.provider.requests.length, providerRequests);
    assert.equal(f.pool.tables.reminder_outbox.length, 0);
});
test('acceptance failure rolls back and retry records only the first successful acceptance', async () => {
    const f = await website(), providerRequests = f.provider.requests.length, before = structuredClone(f.pool.tables);
    f.pool.failOnce = 'INSERT INTO billing_private.audit';
    assert.equal((await f.req('accept', acceptanceInput)).status, 409);
    assert.deepEqual(f.pool.tables, before);
    assert.equal((await f.req('accept', acceptanceInput)).status, 200);
    const accepted = structuredClone(f.pool.tables);
    f.time(START + 1);
    assert.equal((await f.req('accept', acceptanceInput)).status, 200);
    assert.deepEqual(f.pool.tables, accepted);
    assertAcceptanceOnly(f, providerRequests);
});
for (const lockedBy of ['go-live', 'withdrawal'])
    test(`acceptance retry remains locked after ${lockedBy}`, async () => {
        const f = await website();
        if (lockedBy === 'go-live') await f.live();
        else {
            assert.equal((await f.req('accept', acceptanceInput)).status, 200);
            assert.equal((await f.req('withdraw', { evidence: 'fixture-withdrawal' })).status, 200);
        }
        const persisted = structuredClone(f.pool.tables), providerRequests = f.provider.requests.length;
        f.time(START + 1);
        assert.equal((await f.req('accept', acceptanceInput)).status, 409);
        assert.deepEqual(f.pool.tables, persisted);
        assert.equal(f.provider.requests.length, providerRequests);
    });
test('HTTP -> serializable repository -> Stripe-shaped day15 checkout -> day30 nested invoice -> ledger', async () => {
    const f = await website();
    assert.equal(f.state().goLiveAt, null);
    await f.live();
    const end = f.state().trialEnd!;
    f.time(START + 15 * DAY);
    const token = await f.link(), res = await f.req('checkout', { token });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.match(body.result.url, /checkout.stripe.com/);
    const formResponse=await f.handle(new Request(`${origin}/api/web-gratis/billing/checkout?record=${f.key}`,{method:'POST',headers:{authorization:'fixture-client',origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token})}));
    assert.equal(formResponse.status,303);assert.match(formResponse.headers.get('location')!,/^https:\/\/checkout\.stripe\.com\//);assert.ok(formResponse.headers.get('content-security-policy')?.includes('https://checkout.stripe.com'));
    const a = f.state().attempts[0];
    assert.equal(JSON.parse(a.requestJson).subscription_data.trial_end, end);
    const sub = f.provider.complete(a.sessionId!);
    assert.equal((await f.webhook('checkout.session.completed', 'evt_setup', { id: a.sessionId })).status, 200);
    assert.equal(f.state().enrollment, 'trialing');
    assert.equal(f.pool.tables.payments.length, 0);
    f.time(end);
    f.provider.subs[sub].status = 'active';
    const invoice = f.provider.invoice(sub, 'price_test20', end, end + 31 * DAY);
    assert.equal((await f.webhook('invoice.paid', 'evt_first_invoice', invoice)).status, 200);
    assert.equal(f.state().paidThrough, end + 31 * DAY);
    assert.equal(f.pool.tables.payments.length, 1);
    assert.equal((await f.webhook('invoice.paid', 'evt_first_invoice', invoice)).status, 200);
    assert.equal((await f.webhook('invoice.paid', 'evt_second_delivery', invoice)).status, 200);
    assert.equal(f.pool.tables.payments.length, 1);
    assert.ok(f.pool.sql.includes('BEGIN ISOLATION LEVEL SERIALIZABLE'));
    assert.ok(f.pool.sql.some(s => s.includes('FOR UPDATE')));
    assert.equal(f.pool.tables.webhook_events.length, 3);
});
test('GET has no consent side effect; wrong actor, cross-site, CSRF and Phil accepting for client fail', async () => {
    const f = await website(), before = f.state();
    const page = await f.handle(new Request(`${origin}/web/billing?record=${f.key}`, { headers: { authorization: 'fixture-client' } }));
    assert.equal(page.status, 200);
    assert.ok(page.headers.get('content-security-policy')?.includes("form-action 'self' https://checkout.stripe.com;"));
    assert.match(await page.text(), /checkbox/);
    assert.deepEqual(f.state(), before);
    assert.equal((await f.req('accept', {}, 'client', { origin: 'https://foreign.test' })).status, 403);
    assert.equal((await f.handle(new Request(`${origin}/web/billing?record=${'f'.repeat(64)}`, { headers: { authorization: 'fixture-client' } }))).status, 403);
    assert.equal((await f.req('accept', { siteVersion: 2, terms: 'fixture-approved-v1', cents: 2000, currency: 'usd', interval: 'month', approveSiteAndGoLive: true, agreeBilling: true, remindersAgreed: true, evidence: 'fixture' }, 'phil')).status, 403);
    assert.equal(f.state().acceptance, null);
});
test('site_only never calls publication verifier or starts clock; wrong served version cannot start', async () => {
    const f = await website();
    assert.equal((await f.req('go-live', { mode: 'site_only', siteVersion: 2 }, 'phil')).status, 200);
    assert.equal(f.state().trialEnd, null);
    await assert.rejects(publicationVerifier(f.repo, async () => new Response('wrong', { headers: { 'content-type': 'text/html', 'x-mm-site-id': identity.siteId, 'x-mm-site-version': '1' } }))(identity, 2), /proof/);
});
test('publication reads the identity-bound signup through a parameterized join', async () => {
    const f = await website();
    f.pool.tables.signups.push({ id: 'foreign-signup', status: 'pausada' });
    const site = await f.repo.site(identity), statement = f.pool.statements.at(-1)!;
    assert.equal(site.signup_status, 'entregada');
    assert.match(statement.sql, /INNER JOIN public\.web_gratis_signups g ON g\.id=s\.signup_id/);
    assert.match(statement.sql, /WHERE s\.id=\$1 AND s\.signup_id=\$2/);
    assert.deepEqual(statement.values, [identity.siteId, identity.signupId]);
    assert.ok(!statement.sql.includes(identity.siteId));
    await assert.rejects(f.repo.site({ ...identity, signupId: 'foreign-signup' }), /site_binding_missing/);
    await assert.rejects(f.repo.site({ ...identity, siteId: 'foreign-site' }), /site_binding_missing/);
});
for (const signupStatus of ['pausada', 'cancelada', 'descartada']) {
    test(`fresh ${signupStatus} signup rejects matching cached published HTML and preserves the unstarted clock`, async () => {
        const f = await website();
        assert.equal((await f.req('accept', { siteVersion: 2, terms: 'fixture-approved-v1', cents: 2000, currency: 'usd', interval: 'month', approveSiteAndGoLive: true, agreeBilling: true, remindersAgreed: true, evidence: 'fixture' })).status, 200);
        assert.equal((await f.req('approve', { siteVersion: 2, evidence: 'fixture-phil-review' }, 'phil')).status, 200);
        // The old public response remains available with the correct site/version.
        assert.equal((await publicationVerifier(f.repo, f.publicTransport)(identity, 2)).served, true);
        const requestsBeforePause = f.publicRequests.length;
        f.pool.tables.signups[0].status = signupStatus;
        assert.equal(f.pool.tables.sites[0].status, 'published');
        assert.equal(f.pool.tables.sites[0].version, 2);
        await assert.rejects(publicationVerifier(f.repo, f.publicTransport)(identity, 2), /publication_signup_not_eligible/);
        const before = f.state();
        assert.equal((await f.req('go-live', { mode: 'accepted_go_live', siteVersion: 2 }, 'phil')).status, 409);
        assert.deepEqual(f.state(), before);
        assert.equal(f.state().goLiveAt, null);
        assert.equal(f.state().trialEnd, null);
        assert.equal(f.publicRequests.length, requestsBeforePause);
    });
}
test('missing, unbound or unknown signup status fails closed before public transport', async () => {
    for (const state of ['missing-row', 'foreign-binding', 'null-status', 'unknown-status']) {
        const f = await website();
        if (state === 'missing-row') f.pool.tables.signups = [];
        if (state === 'foreign-binding') {
            f.pool.tables.sites[0].signup_id = 'foreign-signup';
            f.pool.tables.signups.push({ id: 'foreign-signup', status: 'entregada' });
        }
        if (state === 'null-status') f.pool.tables.signups[0].status = null;
        if (state === 'unknown-status') f.pool.tables.signups[0].status = 'future-unreviewed-state';
        await assert.rejects(publicationVerifier(f.repo, f.publicTransport)(identity, 2), /site_binding_missing|publication_signup_not_eligible/);
        assert.equal(f.publicRequests.length, 0, state);
    }
});
test('known non-suspended signup states still require and accept matching serving proof', async () => {
    const f = await website();
    for (const status of ['borrador', 'nuevo', 'en_construccion', 'entregada', 'compartida', 'activa']) {
        f.pool.tables.signups[0].status = status;
        assert.equal((await publicationVerifier(f.repo, f.publicTransport)(identity, 2)).served, true);
    }
    assert.equal(f.publicRequests.length, 6);
    assert.equal(f.state().goLiveAt, null);
});
test('database failure rolls back state, invoice, ownership and receipt atomically; webhook retry succeeds', async () => {
    const f = await website();
    await f.live();
    f.time(START + 15 * DAY);
    await f.req('checkout', { token: await f.link() });
    const a = f.state().attempts[0];
    f.provider.complete(a.sessionId!);
    f.pool.failOnce = 'INSERT INTO billing_private.webhook_events';
    assert.notEqual((await f.webhook('checkout.session.completed', 'evt_rollback', { id: a.sessionId })).status, 200);
    assert.equal(f.state().enrollment, 'none');
    assert.equal(f.pool.tables.webhook_events.length, 0);
    assert.equal(f.pool.tables.provider_objects.filter(p => p.object_kind === 'subscription').length, 0);
    assert.equal((await f.webhook('checkout.session.completed', 'evt_rollback', { id: a.sessionId })).status, 200);
});
test('provider timeout preserves reservation and byte-identical retry; concurrent clicks create one session', async () => {
    const f = await website();
    await f.live();
    f.time(START + 15 * DAY);
    const token = await f.link();
    f.provider.timeoutAfterCreate = true;
    assert.notEqual((await f.req('checkout', { token })).status, 200);
    assert.equal(f.state().attempts[0].status, 'creating');
    const frozen = f.state().attempts[0].requestJson;
    const responses = await Promise.all([f.req('checkout', { token }), f.req('checkout', { token })]);
    assert.ok(responses.every(r => r.status === 200));
    assert.equal(Object.keys(f.provider.sessions).length, 1);
    assert.equal(f.state().attempts[0].requestJson, frozen);
});
test('unknown late response recovers by actual session; no time-only expiration or replacement', async () => {
    const f = await website();
    await f.live();
    f.time(START + 15 * DAY);
    const token = await f.link();
    f.provider.timeoutAfterCreate = true;
    await f.req('checkout', { token });
    f.time(f.now() + 901);
    assert.notEqual((await f.req('checkout', { token })).status, 200);
    const authed = f.repo.forActor({ issuer: 'fixture-issuer', subject: operator.subject, role: 'operator' });
    assert.equal(await recoverWebsite(authed, f.stripe, identity, operator, 'fixture-recovery'), 'applied');
    assert.equal(f.state().attempts[0].status, 'open');
    assert.equal(Object.keys(f.provider.sessions).length, 1);
});
test('bad raw signature rejected before storage/provider reads; foreign event not claimed', async () => {
    const f = await website(), db = f.pool.sql.length, calls = f.provider.requests.length;
    const r = await f.handle(new Request(`${origin}/api/web-gratis/billing/webhook`, { method: 'POST', headers: { 'stripe-signature': 'invalid' }, body: '{}' }));
    assert.notEqual(r.status, 200);
    assert.equal(f.pool.sql.length, db);
    assert.equal(f.provider.requests.length, calls);
    assert.equal((await f.webhook('invoice.paid', 'evt_foreign', { id: 'in_unowned', metadata: {} })).status, 200);
    assert.equal(f.pool.tables.webhook_events.length, 0);
});
test('identity revocation is rechecked inside the mutation transaction', async () => {
    const f = await website();
    let revoked = false;
    f.pool.beforeQuery = sql => {
        if (sql.startsWith('BEGIN') && !revoked) {
            f.pool.tables.identity_bindings[0].revoked_at = 'fixture-now';
            revoked = true;
        }
    };
    const r = await f.req('accept', { siteVersion: 2, terms: 'fixture-approved-v1', cents: 2000, currency: 'usd', interval: 'month', approveSiteAndGoLive: true, agreeBilling: true, remindersAgreed: true, evidence: 'fixture' });
    assert.equal(r.status, 403);
    assert.equal(f.state().acceptance, null);
});
test('immutable persisted timestamps and global provider ownership fail closed', async () => {
    const f = await website();
    await f.live();
    await assert.rejects(f.repo.transaction(identity, s => { s.trialEnd! += DAY; }));
    assert.equal(f.state().trialEnd, START + 30 * DAY);
    const scope = { account: STRIPE_ACCOUNT, livemode: false, program: 'web_gratis_fixed_v1', ownerId: 'a', tenantId: 'b' };
    await f.repo.store.atomic(db => f.repo.store.claim(db, scope, f.key, 'invoice', 'in_owned', null, 'a'.repeat(64)));
    await assert.rejects(f.repo.store.atomic(db => f.repo.store.claim(db, scope, 'foreign', 'invoice', 'in_owned', null, 'b'.repeat(64))), /elsewhere/);
});
test('day30 setup requires exact charge consent and returned Checkout total must equal quote', async () => {
    const f = await website();
    await f.live();
    f.time(START + 30 * DAY);
    const token = await f.link();
    assert.equal((await (await f.req('checkout', { token })).json()).result.kind, 'charge_confirmation_required');
    const s = f.state();
    const confirmation = { confirmed: true, cents: 2000, currency: 'usd', interval: 'month', trialEnd: s.trialEnd, terms: s.acceptance!.terms, generation: s.link!.generation, evidence: 'fixture-exact-confirmation' };
    const r = await f.req('checkout', { token, confirmation });
    assert.equal(r.status, 200);
    const session = Object.values(f.provider.sessions)[0];
    assert.equal(session.amount_total, 2000);
    assert.equal(session.trialEnd, null);
});
test('reminder draft persisted unsent and enrollment suppresses later setup drafts', async () => {
    const f = await website();
    await f.live();
    f.time(START + 15 * DAY);
    const draft = await f.req('draft-reminder', { day: 15, timezone: 'UTC' }, 'phil');
    assert.equal(draft.status, 200);
    assert.equal(f.pool.tables.reminder_outbox[0].status, 'drafted');
    assert.ok(!JSON.stringify(f.pool.tables.reminder_outbox).includes('token='));
    const token = await f.link();
    await f.req('checkout', { token });
    const a = f.state().attempts[0];
    f.provider.complete(a.sessionId!);
    await f.webhook('checkout.session.completed', 'evt_enrolled', { id: a.sessionId });
    f.time(START + 20 * DAY);
    assert.notEqual((await f.req('draft-reminder', { day: 20, timezone: 'UTC' }, 'phil')).status, 200);
    assert.equal(f.pool.tables.reminder_outbox.length, 1);
});
async function simmer() {
    let now = START;
    const pool = new FixturePool(), store = new PostgresStore(pool), provider = new FixtureStripe(() => now);
    provider.prices.price_simmer_month = fixturePrice('price_simmer_month', 30000, 'recurring', 'prod_simmer_month');
    provider.prices.price_simmer_oct = fixturePrice('price_simmer_oct', 30000, 'one_time', 'prod_simmer_oct');
    provider.links.plink_fixture = { id: 'plink_fixture', livemode: false, active: true };
    const stripe = new StripeClient({ secretKey: 'sk_test_fixture_only', livemode: false, transport: provider.transport, now: () => now });
    const recurring = await stripe.price('price_simmer_month'), october = await stripe.price('price_simmer_oct');
    const options = { store, stripe, catalog: { verifiedProductId: 'prod_simmer_month', verifiedOctoberProductId: 'prod_simmer_oct', livemode: false, recurring, october }, ownerId: identity.ownerId, tenantId: identity.tenantId, clientId: 'simmer_fixture', origin, paymentLinkId: 'plink_fixture', now: () => now };
    const internal = new SimmerRuntime(options), clientRuntime = new SimmerRuntime({ ...options, actor: { issuer: 'fixture-issuer', subject: client.subject, role: 'client' } }), admin = new SimmerRuntime({ ...options, actor: { issuer: 'fixture-issuer', subject: operator.subject, role: 'operator' } });
    const agreement: SimmerAgreement = { ownerId: identity.ownerId, clientId: 'simmer_fixture', customerId: 'cus_simmer_fixture', agreementId: 'approved-fixture-schedule', acceptedByClient: false, acceptedAt: 0, evidence: '', octoberTotalCents: 30000, monthlyTotalCents: 30000, currency: 'usd', nextChargeAt: 1793512800, billingTimeZone: 'America/El_Salvador', everyFirstAgreed: false };
    await internal.initialize(agreement, { evidence: 'fixture-verified-customer', verifiedBy: 'fixture-owner' });
    bind(pool, internal.key);
    const state = () => pool.tables.records.find(r => r.record_key === internal.key)!.state as import('../../src/lib/web-gratis/lifecycle/runtime/simmerdown').SimmerRecord;
    function cash(customer: unknown = agreement.customerId) { const price = provider.prices.price_simmer_oct; provider.sessions.cs_cash = { id: 'cs_cash', livemode: false, status: 'complete', mode: 'payment', customer, subscription: null, payment_intent: 'pi_cash', invoice: null, payment_link: 'plink_fixture', client_reference_id: null, metadata: {}, amount_total: 30000, currency: 'usd', expires_at: now + 3600, created: now, url: null, payment_status: 'paid', total_details: { amount_discount: 0, amount_shipping: 0, amount_tax: 0 }, lines: [{ id: 'li_cash', quantity: 1, price, amount_total: 30000, currency: 'usd' }] }; provider.intents.pi_cash = { id: 'pi_cash', livemode: false, customer, status: 'succeeded', amount_received: 30000, currency: 'usd', created: now, latest_charge: 'ch_cash' }; provider.charges.ch_cash = { id: 'ch_cash', livemode: false, customer, payment_intent: 'pi_cash', paid: true, captured: true, refunded: false, amount_refunded: 0, amount_captured: 30000, currency: 'usd', created: now }; provider.links.plink_fixture.active = false; }
    async function event(type: string, id: string, object: Record<string, unknown>) { const raw = JSON.stringify({ id, type, created: now, livemode: false, data: { object } }); return internal.webhook(raw, sign(raw, now), KEY); }
    return { pool, provider, stripe, internal, clientRuntime, admin, agreement, state, cash, event, time: (n: number) => { now = n; }, now: () => now };
}
test('Simmer paid cash link -> persisted receipt -> zero-now recurring-only -> November and December receipts', async () => {
    const f = await simmer();
    f.cash();
    await f.clientRuntime.accept(client);
    const r = await f.clientRuntime.checkout(client);
    assert.equal(r.kind, 'session');
    const a = f.state().attempts[0];
    assert.ok(a.json.length > 500);
    assert.equal(JSON.parse(a.json).line_items.length, 1);
    assert.equal(f.pool.tables.payments.length, 1);
    const sub = f.provider.complete(a.sessionId!);
    assert.equal(await f.event('checkout.session.completed', 'evt_simmer_setup', { id: a.sessionId }), 'applied');
    f.time(f.agreement.nextChargeAt);
    f.provider.subs[sub].status = 'active';
    const invoice = f.provider.invoice(sub, 'price_simmer_month', f.now(), f.now() + 30 * DAY);
    assert.equal(await f.event('invoice.paid', 'evt_simmer_nov', invoice), 'applied');
    assert.equal(f.pool.tables.payments.length, 2);
    f.time(f.agreement.nextChargeAt + 30 * DAY);
    const december = f.provider.invoice(sub, 'price_simmer_month', f.now(), f.now() + 31 * DAY);
    await f.event('invoice.paid', 'evt_simmer_dec', december);
    assert.equal(f.pool.tables.payments.length, 3);
    assert.equal(f.pool.tables.payments.filter(p => p.billing_period === '2026-10').length, 1);
});
test('Simmer unpaid combined is held until inactive cash link and explicit operator path approval', async () => {
    const f = await simmer();
    await f.clientRuntime.accept(client);
    assert.equal((await f.clientRuntime.checkout(client)).kind, 'held');
    await f.admin.approveCombined(operator, 'fixture-controlled-path');
    assert.equal((await f.clientRuntime.checkout(client)).kind, 'held');
    f.provider.links.plink_fixture.active = false;
    assert.equal((await f.clientRuntime.checkout(client)).kind, 'session');
    const a = f.state().attempts[0];
    assert.equal(JSON.parse(a.json).line_items.length, 2);
    assert.equal(f.provider.sessions[a.sessionId!].amount_total, 30000);
    const sub = f.provider.complete(a.sessionId!), invoice = f.provider.invoice(sub, 'price_simmer_month', START, f.agreement.nextChargeAt);
    f.provider.sessions[a.sessionId!].invoice = invoice.id;
    assert.equal(await f.event('checkout.session.completed', 'evt_combined', { id: a.sessionId }), 'applied');
    assert.equal(f.pool.tables.payments.length, 1);
    assert.equal(f.state().billing.octoberInvoiceId, invoice.id);
});
for (const customer of [null, 'cus_unmapped'])
    test(`guest/unmapped paid link cannot imply unpaid October (${customer})`, async () => {
        const f = await simmer();
        f.cash(customer);
        await f.clientRuntime.accept(client);
        await f.admin.approveCombined(operator, 'fixture-path');
        await assert.rejects(f.clientRuntime.checkout(client), /unmapped/);
        assert.equal(f.state().attempts.length, 0);
        assert.equal(f.provider.requests.filter(r => r.method === 'POST').length, 0);
    });
test('refunded or wrong-amount October payment cannot authorize recurring enrollment', async () => {
    const f = await simmer();
    f.cash();
    f.provider.charges.ch_cash.refunded = true;
    await f.clientRuntime.accept(client);
    await assert.rejects(f.clientRuntime.checkout(client));
    assert.equal(f.state().billing.octoberPayment, null);
    assert.equal(f.state().attempts.length, 0);
});
test('two Simmer clients cannot bind the same Stripe customer or impersonate actor role', async () => {
    const f = await simmer();
    const other = new SimmerRuntime({ ...f.internal.o, ownerId: 'other_owner', clientId: 'other_client' });
    await assert.rejects(other.initialize({ ...f.agreement, ownerId: 'other_owner', clientId: 'other_client' }, { evidence: 'fixture', verifiedBy: 'fixture' }), /elsewhere/);
    await assert.rejects(f.internal.accept(client), /actor/);
    await assert.rejects(f.admin.accept({ ...client, subject: operator.subject }), /actor/);
});
test('valid signed foreign Simmer webhook is not claimed with or without an owned attempt', async () => {
    const f = await simmer();
    f.provider.sessions.cs_foreign = { id: 'cs_foreign', livemode: false, status: 'expired', mode: 'payment', customer: 'cus_other', subscription: null, payment_intent: null, invoice: null, payment_link: 'plink_other', client_reference_id: null, metadata: {}, amount_total: 30000, currency: 'usd', expires_at: START + 3600, created: START, url: null, payment_status: 'unpaid', total_details: { amount_discount: 0, amount_shipping: 0, amount_tax: 0 } };
    assert.equal(await f.event('checkout.session.completed', 'evt_foreign_simmer', { id: 'cs_foreign' }), 'unowned');
    assert.equal(f.pool.tables.webhook_events.length, 0);
    f.cash();
    await f.clientRuntime.accept(client);
    await f.clientRuntime.checkout(client);
    assert.equal(await f.event('checkout.session.completed', 'evt_foreign_simmer_again', { id: 'cs_foreign' }), 'unowned');
    assert.equal(f.pool.tables.webhook_events.length, 0);
});
test('Simmer withdrawal then two canceled events reconciles before November without re-enrolling', async () => {
    const f = await simmer();
    f.cash();
    await f.clientRuntime.accept(client);
    await f.clientRuntime.checkout(client);
    const a = f.state().attempts[0], sub = f.provider.complete(a.sessionId!);
    await f.event('checkout.session.completed', 'evt_enrolled_simmer', { id: a.sessionId });
    await f.clientRuntime.withdraw(client, 'fixture-stop');
    assert.equal(f.provider.subs[sub].status, 'canceled');
    assert.equal(await f.event('customer.subscription.deleted', 'evt_cancel_1', { id: sub }), 'applied');
    assert.equal(await f.event('customer.subscription.updated', 'evt_cancel_2', { id: sub }), 'applied');
    assert.equal(f.state().billing.canceled, true);
    await assert.rejects(f.clientRuntime.checkout(client));
});
test('Simmer first reconciliation after November accepts actual active state and owned paid invoice', async () => {
    const f = await simmer();
    f.cash();
    await f.clientRuntime.accept(client);
    await f.clientRuntime.checkout(client);
    const a = f.state().attempts[0], sub = f.provider.complete(a.sessionId!);
    f.time(f.agreement.nextChargeAt);
    f.provider.subs[sub].status = 'active';
    const invoice = f.provider.invoice(sub, 'price_simmer_month', f.now(), f.now() + 30 * DAY);
    assert.equal(await f.event('invoice.paid', 'evt_delayed_first', invoice), 'applied');
    assert.equal(f.state().paidThrough, f.now() + 30 * DAY);
    assert.equal(f.state().subscriptionStatus, 'active');
});
for (const change of [{ amount_total: 1 }, { currency: 'eur' }, { mode: 'payment' }, { metadata: {} }, { client_reference_id: 'foreign' }])
    test(`provider create mismatch ${JSON.stringify(change)} never exposes Checkout URL`, async () => {
        const f = await website();
        await f.live();
        f.time(START + 15 * DAY);
        const token = await f.link();
        f.provider.mutateCreated = row => Object.assign(row, change);
        const response = await f.req('checkout', { token });
        assert.notEqual(response.status, 200);
        assert.doesNotMatch(await response.text(), /checkout.stripe.com/);
        assert.equal(f.state().attempts[0].status, 'creating');
    });
test('existing Simmer customer credit or discount is held before session creation', async () => {
    for (const change of [{ balance: -30000 }, { balance: 30000 }, { discount: { id: 'discount_fixture' } }]) {
        const f = await simmer();
        f.cash();
        await f.clientRuntime.accept(client);
        f.provider.customers[f.agreement.customerId] = { id: f.agreement.customerId, livemode: false, balance: 0, ...change };
        await assert.rejects(f.clientRuntime.checkout(client));
        assert.equal(f.provider.requests.filter(r => r.method === 'POST').length, 0);
    }
});
test('changed catalog price is checked again before provider creation', async () => {
    const f = await website();
    await f.live();
    f.time(START + 15 * DAY);
    const token = await f.link();
    f.provider.prices.price_test20.unit_amount = 2100;
    assert.notEqual((await f.req('checkout', { token })).status, 200);
    assert.equal(f.provider.requests.filter(r => r.method === 'POST').length, 0);
});
test('past_due and cancellation reconcile from current provider snapshot despite event order', async () => {
    const f = await website();
    await f.live();
    f.time(START + 15 * DAY);
    await f.req('checkout', { token: await f.link() });
    const a = f.state().attempts[0], sub = f.provider.complete(a.sessionId!);
    await f.webhook('checkout.session.completed', 'evt_current_setup', { id: a.sessionId });
    f.time(START + 30 * DAY);
    const invoice = f.provider.invoice(sub, 'price_test20', f.now(), f.now() + 31 * DAY);
    invoice.status = 'open';
    invoice.amount_paid = 0;
    f.provider.subs[sub].status = 'past_due';
    assert.equal((await f.webhook('invoice.payment_failed', 'evt_failed', invoice)).status, 200);
    assert.equal(f.state().enrollment, 'past_due');
    assert.equal(f.pool.tables.payments.length, 0);
    assert.equal((await f.req('withdraw', { evidence: 'fixture-client-stop' })).status, 200);
    assert.equal(f.provider.subs[sub].status, 'canceled');
    await f.webhook('customer.subscription.updated', 'evt_old_updated', { id: sub });
    assert.equal(f.state().enrollment, 'canceled');
});
test('Simmer cash payment racing an open combined session holds until real expiration, then zero-only setup', async () => {
    const f = await simmer();
    await f.clientRuntime.accept(client);
    await f.admin.approveCombined(operator, 'fixture-path');
    f.provider.links.plink_fixture.active = false;
    await f.clientRuntime.checkout(client);
    const old = f.state().attempts[0];
    f.cash();
    await assert.rejects(f.clientRuntime.checkout(client), /binding_changed|competing/);
    assert.equal(f.provider.requests.filter(r => r.method === 'POST' && r.path === '/v1/checkout/sessions').length, 1);
    f.provider.sessions[old.sessionId!].status = 'expired';
    await f.admin.reconcile(operator);
    assert.equal(f.state().attempts[0].status, 'expired');
    assert.equal(f.state().billing.request, null);
    await f.clientRuntime.checkout(client);
    assert.equal(f.state().attempts[1].kind, 'recurring_only');
    assert.equal(JSON.parse(f.state().attempts[1].json).line_items.length, 1);
});
test('Simmer HTTP requires exact schedule, independent client binding and same-origin mutation', async () => {
    const { simmerdownHttp } = await import('../../src/lib/web-gratis/lifecycle/runtime/simmerdown-http');
    const f = await simmer();
    const handle = simmerdownHttp({ runtime: f.internal, webhookSecret: KEY, authenticate: async (r) => r.headers.get('authorization') === 'fixture-client' ? { issuer: 'fixture-issuer', subject: client.subject } : null });
    const page = await handle(new Request(`${origin}/billing/simmerdown`, { headers: { authorization: 'fixture-client' } }));
    assert.equal(page.status, 200);
    assert.ok(page.headers.get('content-security-policy')?.includes("form-action 'self' https://checkout.stripe.com;"));
    assert.match(await page.text(), /checkbox/);
    assert.equal(f.state().agreement.acceptedByClient, false);
    const req = (at: number, requestOrigin = origin) => handle(new Request(`${origin}/api/billing/simmerdown/accept`, { method: 'POST', headers: { authorization: 'fixture-client', origin: requestOrigin, 'content-type': 'application/json' }, body: JSON.stringify({ acceptedSchedule: true, nextChargeAt: at }) }));
    assert.equal((await req(f.agreement.nextChargeAt, 'https://foreign.test')).status, 403);
    assert.notEqual((await req(f.agreement.nextChargeAt + 1)).status, 200);
    assert.equal((await req(f.agreement.nextChargeAt)).status, 200);
    assert.equal(f.state().agreement.acceptedByClient, true);
    f.cash();const checkout=await handle(new Request(`${origin}/api/billing/simmerdown/checkout`,{method:'POST',headers:{authorization:'fixture-client',origin,'content-type':'application/x-www-form-urlencoded'},body:''}));
    assert.equal(checkout.status,303);assert.match(checkout.headers.get('location')!,/^https:\/\/checkout\.stripe\.com\//);assert.ok(checkout.headers.get('content-security-policy')?.includes('https://checkout.stripe.com'));
});
test('legacy guard skips owned lifecycle and fails closed on lookup failure', async () => {
    const { runLegacyUnlessFixed } = await import('../../src/lib/web-gratis/lifecycle/runtime/integration');
    const f = await website();
    let calls = 0;
    assert.equal((await runLegacyUnlessFixed(f.repo, identity.siteId, async () => { calls++; })).kind, 'skipped_fixed_lifecycle');
    assert.equal(calls, 0);
    f.pool.failOnce = 'SELECT record_key';
    await assert.rejects(runLegacyUnlessFixed(f.repo, identity.siteId, async () => { calls++; }));
    assert.equal(calls, 0);
});
test('pool factory receives explicit settings and performs no connection at construction', async () => {
    const { createBillingPool } = await import('../../src/lib/web-gratis/lifecycle/runtime/integration');
    let config: Record<string, unknown> | undefined;
    class SyntheticPool extends FixturePool {
        constructor(c: Record<string, unknown>) { super(); config = c; }
    }
    const pool = createBillingPool('postgresql://fixture:fixture@localhost/fixture', undefined, { Pool: SyntheticPool });
    assert.ok(pool);
    assert.deepEqual(config!.ssl, { rejectUnauthorized: true });
    assert.equal(config!.max, 5);
    assert.throws(() => createBillingPool('postgresql://fixture:fixture@localhost/fixture?sslmode=disable', undefined, { Pool: SyntheticPool }));
});
test('failed initial combined invoice cancels deferred subscription; retry and terminal delivery never create a payment', async () => {
    const f = await simmer();
    await f.clientRuntime.accept(client);
    await f.admin.approveCombined(operator, 'fixture-controlled-path');
    f.provider.links.plink_fixture.active = false;
    await f.clientRuntime.checkout(client);
    const a = f.state().attempts[0], sub = f.provider.complete(a.sessionId!), invoice = f.provider.invoice(sub, 'price_simmer_month', START, f.agreement.nextChargeAt);
    f.provider.sessions[a.sessionId!].invoice = invoice.id;
    f.provider.sessions[a.sessionId!].payment_status = 'unpaid';
    Object.assign(invoice, { status: 'open', amount_paid: 0, status_transitions: { paid_at: null } });
    f.pool.failOnce = 'INSERT INTO billing_private.webhook_events';
    await assert.rejects(f.event('invoice.payment_failed', 'evt_initial_failure', invoice));
    assert.equal(f.provider.subs[sub].status, 'canceled');
    assert.equal(f.state().billing.canceled, false);
    assert.equal(await f.event('invoice.payment_failed', 'evt_initial_failure', invoice), 'applied');
    assert.equal(f.state().billing.canceled, true);
    assert.equal(f.state().billing.subscriptionId, sub);
    assert.equal(f.pool.tables.payments.length, 0);
    assert.equal(await f.event('invoice.payment_failed', 'evt_initial_failure', invoice), 'duplicate');
    assert.equal(await f.event('customer.subscription.deleted', 'evt_initial_terminal', { id: sub }), 'applied');
    assert.equal(f.pool.tables.payments.length, 0);
    await assert.rejects(f.clientRuntime.checkout(client), /canceled/);
});
test('pending authentication on initial combined invoice is held without canceling until a verified failure', async () => {
    const f = await simmer();
    await f.clientRuntime.accept(client);
    await f.admin.approveCombined(operator, 'fixture-controlled-path');
    f.provider.links.plink_fixture.active = false;
    await f.clientRuntime.checkout(client);
    const a = f.state().attempts[0], sub = f.provider.complete(a.sessionId!), invoice = f.provider.invoice(sub, 'price_simmer_month', START, f.agreement.nextChargeAt);
    f.provider.sessions[a.sessionId!].invoice = invoice.id;
    f.provider.sessions[a.sessionId!].payment_status = 'unpaid';
    Object.assign(invoice, { status: 'open', amount_paid: 0, status_transitions: { paid_at: null } });
    await assert.rejects(f.event('invoice.payment_action_required', 'evt_initial_action', invoice), /pending_review/);
    assert.equal(f.provider.subs[sub].status, 'trialing');
    assert.equal(f.pool.tables.payments.length, 0);
    assert.equal(f.pool.tables.webhook_events.length, 0);
});
test('changed positive renewal receipt cannot advance paid-through on a duplicate invoice', async () => {
    const f = await simmer();
    f.cash();
    await f.clientRuntime.accept(client);
    await f.clientRuntime.checkout(client);
    const a = f.state().attempts[0], sub = f.provider.complete(a.sessionId!);
    await f.event('checkout.session.completed', 'evt_receipt_setup', { id: a.sessionId });
    f.time(f.agreement.nextChargeAt);
    f.provider.subs[sub].status = 'active';
    const invoice = f.provider.invoice(sub, 'price_simmer_month', f.now(), f.now() + 30 * DAY);
    await f.event('invoice.paid', 'evt_receipt_original', invoice);
    (f.provider.invoiceLines[invoice.id][0].period as {
        start: number;
        end: number;
    }).end += DAY;
    await assert.rejects(f.event('invoice.paid', 'evt_receipt_changed', invoice), /receipt_conflict/);
    assert.equal(f.state().paidThrough, f.now() + 30 * DAY);
});
test('go-live, webhook and recovery reuse the transaction connection with a one-connection pool', async () => {
    const f = await website(), connect = f.pool.connect.bind(f.pool);
    let active = 0, max = 0;
    f.pool.connect = async () => { assert.equal(active, 0, 'nested pool acquisition would starve a saturated pool'); const connection = await connect(); active++; max = Math.max(max, active); return { query: connection.query.bind(connection), release() { connection.release(); active--; } }; };
    await f.live();
    f.time(START + 15 * DAY);
    await f.req('checkout', { token: await f.link() });
    const a = f.state().attempts[0];
    f.provider.complete(a.sessionId!);
    assert.equal((await f.webhook('checkout.session.completed', 'evt_capacity', { id: a.sessionId })).status, 200);
    const authed = f.repo.forActor({ issuer: 'fixture-issuer', subject: operator.subject, role: 'operator' });
    assert.equal(await recoverWebsite(authed, f.stripe, identity, operator, 'fixture-capacity-recovery'), 'applied');
    assert.equal(active, 0);
    assert.equal(max, 1);
});
