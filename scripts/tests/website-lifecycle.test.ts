import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { DAY, STRIPE_ACCOUNT, newLifecycle, accept, approve, confirmGoLive, issueLink, withdraw, calendar, reminderStatus, reminderDraft, nextAction, type Lifecycle, type Identity } from '../../src/lib/web-gratis/lifecycle/core';
import { signLink, verifyLink, reserveCheckout, metadata, recordCheckout, type PriceCatalog } from '../../src/lib/web-gratis/lifecycle/checkout';
import { verifyEvent, reconcile, type ProviderSnapshot } from '../../src/lib/web-gratis/lifecycle/webhook';
import { billingService, type Repository } from '../../src/lib/web-gratis/lifecycle/service';
const T = Date.parse('2026-10-03T18:00:00Z') / 1000, KEY = 'fixture-only-not-a-secret-not-for-production';
const identity: Identity = { ownerId: 'owner_fixture', tenantId: 'tenant_fixture', signupId: 'signup_fixture', siteId: 'site_fixture' };
const client = { role: 'client' as const, subject: 'client_fixture', ownerId: identity.ownerId, tenantId: identity.tenantId };
const operator = { ...client, role: 'operator' as const, subject: 'operator_fixture' };
const catalog: PriceCatalog = { standard20: { id: 'price_fixture20', account: STRIPE_ACCOUNT, livemode: false, active: true, cents: 2000, currency: 'usd', interval: 'month', intervalCount: 1, taxBehavior: 'unspecified' }, michoacana19: null };
const terms = { siteVersion: 2, terms: 'offer-v1', cents: 2000, currency: 'usd' as const, interval: 'month' as const, approveSiteAndGoLive: true, agreeBilling: true, remindersAgreed: true, evidence: 'fixture-client-acceptance' };
const proof = { mode: 'accepted_go_live' as const, siteId: identity.siteId, signupId: identity.signupId, siteVersion: 2, served: true, evidence: 'fixture-verified-live' };
const options = { signingKey: KEY, catalog, livemode: false, origin: 'https://billing.example.test' };
const fresh = () => newLifecycle(identity, 'michoacana_fixture');
function live() { const s = fresh(); accept(s, client, terms, T); approve(s, operator, 2, 'phil-review', T); confirmGoLive(s, operator, proof, T + 60); return s; }
function linked(day = 15) { const s = live(), now = s.goLiveAt! + day * DAY; issueLink(s, operator, now); return { s, now, token: signLink(s, KEY) }; }
function reserved(day = 15) { const f = linked(day); const d = reserveCheckout(f.s, client, f.token, options, f.now); if (d.kind !== 'ready')
    throw Error(); return { ...f, d }; }
const signature = (raw: string, now: number) => `t=${now},v1=${createHmac('sha256', KEY).update(`${now}.${raw}`).digest('hex')}`;
function event(now: number, id = 'evt_fixture', type = 'checkout.session.completed', objectId = 'cs_fixture') {
    const raw = JSON.stringify({ id, type, created: now, livemode: false, data: { object: { id: objectId } } });
    return verifyEvent(raw, signature(raw, now), KEY, { account: STRIPE_ACCOUNT, livemode: false }, now);
}
function snapshot(s: Lifecycle, now: number): ProviderSnapshot { const a = s.attempts[0]; return { account: STRIPE_ACCOUNT, livemode: false, retrievedAt: now, eventObject: { id: 'cs_fixture', subscriptionId: 'sub_fixture', customerId: 'cus_fixture' }, session: { id: 'cs_fixture', status: 'complete', mode: 'subscription', customerId: 'cus_fixture', subscriptionId: 'sub_fixture', clientReferenceId: s.signupId, metadata: metadata(s, a), priceId: a.priceId, quantity: 1, currency: 'usd', amountTotal: 0, expiresAt: a.expiresAt }, subscription: { id: 'sub_fixture', customerId: 'cus_fixture', status: 'trialing', priceId: a.priceId, quantity: 1, cents: s.plan.cents, currency: 'usd', interval: 'month', intervalCount: 1, trialEnd: s.trialEnd, paymentMethodReady: true, cancelAtPeriodEnd: false, currentPeriodEnd: s.trialEnd!, metadata: metadata(s, a) }, paidInvoices: [] }; }
test('verified exception gets $19; every other signup $20', () => { assert.equal(fresh().plan.cents, 2000); assert.equal(newLifecycle({ ...identity, signupId: 'michoacana_fixture' }, 'michoacana_fixture').plan.cents, 1900); assert.throws(() => newLifecycle(identity, '')); });
test('Phil cannot accept for client; approval alone does not start clock', () => { const s = fresh(); approve(s, operator, 2, 'review', T); assert.equal(s.acceptance, null); assert.throws(() => confirmGoLive(s, operator, proof, T)); assert.throws(() => accept(s, operator, terms, T)); });
for (const accepted of [false, true])
    test(`site_only leaves trial untouched (accepted=${accepted})`, () => { const s = fresh(); if (accepted) {
        accept(s, client, terms, T);
        approve(s, operator, 2, 'review', T);
    } const before = structuredClone(s); confirmGoLive(s, operator, { ...proof, mode: 'site_only' }, T); assert.deepEqual(s, before); assert.deepEqual(calendar(s, T), []); });
test('actual publication anchors 30 days; acceptance and old publication never backdate it', () => { const s = fresh(); accept(s, client, terms, T); approve(s, operator, 2, 'review', T); confirmGoLive(s, operator, proof, T + 3 * DAY); assert.equal(s.trialEnd, T + 33 * DAY); confirmGoLive(s, operator, proof, T + 5 * DAY); assert.equal(s.trialEnd, T + 33 * DAY); assert.throws(() => confirmGoLive(s, operator, { ...proof, evidence: 'different' }, T + 6 * DAY)); });
for (const change of [{ served: false }, { siteId: 'foreign' }, { signupId: 'foreign' }, { siteVersion: 3 }])
    test(`publication proof ${JSON.stringify(change)} rejected`, () => { const s = fresh(); accept(s, client, terms, T); approve(s, operator, 2, 'review', T); assert.throws(() => confirmGoLive(s, operator, { ...proof, ...change }, T)); assert.equal(s.goLiveAt, null); });
for (const change of [{ cents: 1900 }, { agreeBilling: false }, { approveSiteAndGoLive: false }, { terms: '' }])
    test(`acceptance ${JSON.stringify(change)} rejected`, () => assert.throws(() => accept(fresh(), client, { ...terms, ...change }, T)));
test('cross tenant/owner principals rejected', () => { assert.throws(() => accept(fresh(), { ...client, tenantId: 'foreign' }, terms, T)); assert.throws(() => issueLink(live(), { ...operator, ownerId: 'foreign' }, T)); });
for (const day of [15, 20])
    test(`day${day} checkout charges at original day30`, () => { const { s, d } = reserved(day); assert.equal(d.params.subscription_data.trial_end, s.goLiveAt! + 30 * DAY); assert.equal('trial_period_days' in d.params.subscription_data, false); assert.equal(d.params.line_items[0].price, 'price_fixture20'); assert.match(d.params.custom_text.submit.message, /Hoy no se cobra/); });
test('tampered, foreign, expired and old-generation signed links fail', () => { const { s, token, now } = linked(); assert.throws(() => verifyLink(s, token + 'x', KEY, now)); assert.throws(() => verifyLink({ ...s, siteId: 'foreign' }, token, KEY, now)); assert.throws(() => verifyLink(s, token, KEY, now + 8 * DAY)); issueLink(s, operator, now + 1); assert.throws(() => verifyLink(s, token, KEY, now + 1)); });
test('withdrawal revokes link and drafts without pretending Stripe was canceled', () => { const { s, token, now } = linked(); withdraw(s, client, 'client-stop', now); assert.throws(() => verifyLink(s, token, KEY, now)); assert.equal(reminderStatus(s, 15, now), 'suppressed'); assert.match(nextAction(s, now), /no cobrar/); });
test('day29 setup holds; no early charge or trial extension', () => { const { s, token, now } = linked(29); assert.deepEqual(reserveCheckout(s, client, token, options, now), { kind: 'assisted_setup_required' }); assert.equal(s.attempts.length, 0); });
test('day30 explicit exact charge confirmation creates no trial and no backbilling', () => { const { s, token, now } = linked(30); assert.deepEqual(reserveCheckout(s, client, token, options, now), { kind: 'charge_confirmation_required' }); const confirmation = { confirmed: true as const, cents: 2000, currency: 'usd' as const, interval: 'month' as const, trialEnd: s.trialEnd!, terms: terms.terms, generation: s.link!.generation, evidence: 'fixture-confirmed-exact-charge' }; assert.throws(() => reserveCheckout(s, client, token, { ...options, confirmation: { ...confirmation, cents: 1900 } }, now)); const d = reserveCheckout(s, client, token, { ...options, confirmation }, now); assert.equal(d.kind, 'ready'); if (d.kind === 'ready') {
    assert.equal(d.params.subscription_data.trial_end, undefined);
    assert.match(d.params.custom_text.submit.message, /No se cobran días anteriores/);
} });
for (const change of [{ account: 'acct_other' }, { cents: 1900 }, { currency: 'eur' }, { interval: 'year' }, { livemode: true }, { taxBehavior: 'exclusive' as const }, { active: false }])
    test(`price mismatch ${JSON.stringify(change)} fails`, () => { const { s, token, now } = linked(); assert.throws(() => reserveCheckout(s, client, token, { ...options, catalog: { ...catalog, standard20: { ...catalog.standard20, ...change } } }, now)); assert.equal(s.attempts.length, 0); });
test('retry reuses identical idempotency key/deadline; unresolved attempts block new links', () => { const { s, token, now, d } = reserved(); assert.deepEqual(reserveCheckout(s, client, token, options, now + 10), d); assert.equal(s.attempts.length, 1); assert.throws(() => issueLink(s, operator, now + 10)); assert.throws(() => reserveCheckout(s, client, token, options, now + 1800)); });
test('provider URL and session identity pinned', () => { const { s, now, d } = reserved(); assert.throws(() => recordCheckout(s, d.attempt.id, { id: 'cs_fixture', url: 'https://evil.test', expiresAt: d.attempt.expiresAt }, now)); recordCheckout(s, d.attempt.id, { id: 'cs_fixture', url: 'https://checkout.stripe.com/c/fixture', expiresAt: d.attempt.expiresAt }, now); assert.throws(() => recordCheckout(s, d.attempt.id, { id: 'cs_other', url: 'https://checkout.stripe.com/c/fixture', expiresAt: d.attempt.expiresAt }, now)); });
test('signature verifies raw body, timestamp and livemode', () => { const raw = JSON.stringify({ id: 'evt_sig', type: 'invoice.paid', created: T, livemode: false, data: { object: { id: 'in_fixture' } } }); assert.equal(verifyEvent(raw, signature(raw, T), KEY, { account: STRIPE_ACCOUNT, livemode: false }, T).id, 'evt_sig'); for (const [body, at, mode] of [[raw + ' ', T, false], [raw, T + 301, false], [raw, T, true]] as const)
    assert.throws(() => verifyEvent(body, signature(raw, T), KEY, { account: STRIPE_ACCOUNT, livemode: mode }, at)); });
test('zero-dollar trial enrollment is not revenue and suppresses setup reminders', () => { const { s, now, d } = reserved(); reconcile(s, d.attempt, event(now), snapshot(s, now), false, now); assert.equal(s.enrollment, 'trialing'); assert.equal(s.paidThrough, null); assert.deepEqual(s.invoices, {}); assert.equal(reminderStatus(s, 20, s.goLiveAt! + 20 * DAY), 'suppressed'); });
test('duplicate event is no-op; changed payload same ID rejected', () => { const { s, now, d } = reserved(), e = event(now), p = snapshot(s, now); reconcile(s, d.attempt, e, p, false, now); const before = structuredClone(s); assert.equal(reconcile(s, d.attempt, e, p, false, now), 'duplicate'); assert.deepEqual(s, before); assert.throws(() => reconcile(s, d.attempt, { ...e, digest: 'other' }, p, false, now)); });
test('out-of-order completed event cannot resurrect canceled subscription', () => { const { s, now, d } = reserved(), p = snapshot(s, now); p.subscription!.status = 'canceled'; reconcile(s, d.attempt, event(now, 'evt_new'), p, false, now); reconcile(s, d.attempt, event(now - 10, 'evt_old'), p, false, now); assert.equal(s.enrollment, 'canceled'); p.subscription!.status = 'active'; assert.throws(() => reconcile(s, d.attempt, event(now, 'evt_bad'), p, false, now)); });
for (const status of ['past_due', 'incomplete', 'paused', 'canceled', 'unpaid', 'incomplete_expired'] as const)
    test(`${status} cannot create another subscription`, () => { const { s, now, d, token } = reserved(), p = snapshot(s, now); p.subscription!.status = status; reconcile(s, d.attempt, event(now), p, false, now); assert.equal(reminderStatus(s, 15, now), 'suppressed'); assert.throws(() => reserveCheckout(s, client, token, options, now)); });
test('foreign tenant and changed trial end rejected before mutations', () => { const { s, now, d } = reserved(), before = structuredClone(s), p = snapshot(s, now); p.session.metadata.tenant_id = 'foreign'; assert.throws(() => reconcile(s, d.attempt, event(now), p, false, now)); assert.deepEqual(s, before); const p2 = snapshot(s, now); p2.subscription!.trialEnd! += 15 * DAY; assert.throws(() => reconcile(s, d.attempt, event(now), p2, false, now)); });
test('failed invoice for different subscription of same customer rejected', () => { const { s, now, d } = reserved(), p = snapshot(s, now); p.eventObject = { id: 'in_other', subscriptionId: 'sub_other', customerId: 'cus_fixture' }; assert.throws(() => reconcile(s, d.attempt, event(now, 'evt_other', 'invoice.payment_failed', 'in_other'), p, false, now)); });
test('owned positive invoice after day30 recorded once across different events', () => { const { s, d } = reserved(), now = s.trialEnd!, p = snapshot(s, now); p.subscription!.status = 'active'; p.eventObject.id = 'in_fixture'; p.paidInvoices = [{ id: 'in_fixture', subscriptionId: 'sub_fixture', customerId: 'cus_fixture', cents: 2000, currency: 'usd', paidAt: now, periodStart: now, periodEnd: now + 31 * DAY }]; for (const id of ['evt_paid', 'evt_paid2'])
    reconcile(s, d.attempt, event(now, id, 'invoice.paid', 'in_fixture'), p, false, now); assert.equal(Object.keys(s.invoices).length, 1); assert.equal(s.paidThrough, now + 31 * DAY); });
test('early paid invoice quarantined for review', () => { const { s, d, now } = reserved(), p = snapshot(s, now); p.paidInvoices = [{ id: 'in_early', subscriptionId: 'sub_fixture', customerId: 'cus_fixture', cents: 2000, currency: 'usd', paidAt: now, periodStart: now, periodEnd: now + 31 * DAY }]; assert.throws(() => reconcile(s, d.attempt, event(now), p, false, now)); assert.deepEqual(s.invoices, {}); });
test('reminders only day15/day20 windows; no catch-up burst', () => { const s = live(); for (const day of [15, 20] as const) {
    assert.equal(reminderStatus(s, day, s.goLiveAt! + day * DAY), 'draft_due');
    assert.equal(reminderStatus(s, day, s.goLiveAt! + (day + 1) * DAY), 'missed');
} assert.equal(reminderStatus(s, 15, s.goLiveAt! + 14 * DAY), 'scheduled'); s.reminders[15] = 'sent'; assert.equal(reminderStatus(s, 15, s.goLiveAt! + 15 * DAY), 'sent'); });
for (const reason of ['no-agreement', 'opted-out', 'human-owned'])
    test(`reminder suppressed: ${reason}`, () => { const s = live(); if (reason === 'no-agreement')
        s.acceptance!.remindersAgreed = false;
    else
        s.messaging = reason === 'opted-out' ? 'opted_out' : 'human_owned'; assert.equal(reminderStatus(s, 15, s.goLiveAt! + 15 * DAY), 'suppressed'); });
test('Spanish draft exact amount/date and calendar deadlines', () => { const s = live(), now = s.goLiveAt! + 15 * DAY, draft = reminderDraft(s, 15, now, 'https://billing.example.test/signed', 'America/El_Salvador'); for (const text of ['USD 20.00', 'No se cobra hoy', 'no reinicia', 'no enviado'])
    assert.ok(draft.includes(text)); assert.deepEqual(calendar(s, now).map(i => i.at), [s.goLiveAt! + 15 * DAY, s.goLiveAt! + 20 * DAY, s.goLiveAt! + 30 * DAY]); });
class MemoryRepository implements Repository {
    state: Lifecycle;
    tail = Promise.resolve();
    constructor(s: Lifecycle) { this.state = structuredClone(s); }
    async transaction<R>(id: Identity, fn: (s: Lifecycle) => Promise<R> | R): Promise<R> { let release!: () => void; const before = this.tail; this.tail = new Promise<void>(r => { release = r; }); await before; try {
        for (const k of ['ownerId', 'tenantId', 'signupId', 'siteId'] as const)
            assert.equal(id[k], this.state[k]);
        const copy = structuredClone(this.state), value = await fn(copy);
        this.state = copy;
        return structuredClone(value);
    }
    finally {
        release();
    } }
    async locate() { return { identity, attemptId: this.state.attempts[0].id }; }
}
test('provider timeout retains durable attempt; retry has identical parameters/key', async () => { const { s, token, now } = linked(), repository = new MemoryRepository(s), calls: {
    params: unknown;
    key: string;
}[] = []; const service = billingService({ repository, now: () => now, signingKey: KEY, webhookSecret: KEY, catalog, account: STRIPE_ACCOUNT, livemode: false, origin: options.origin, provider: { account: STRIPE_ACCOUNT, livemode: false, async createCheckout(params, key) { calls.push({ params, key }); if (calls.length === 1)
            throw Error('timeout'); return { id: 'cs_fixture', url: 'https://checkout.stripe.com/c/fixture', expiresAt: params.expires_at }; }, async snapshot() { throw Error('unused'); } } }); await assert.rejects(service.checkout(identity, client, token), /timeout/); assert.equal(repository.state.attempts[0].status, 'creating'); await service.checkout(identity, client, token); assert.deepEqual(calls[0], calls[1]); assert.equal(repository.state.attempts.length, 1); });
test('webhook failure rolls back receipt; valid retry works, bad signature never reaches provider', async () => { const { s, now } = reserved(), repository = new MemoryRepository(s); let reads = 0, fail = true; const service = billingService({ repository, now: () => now, signingKey: KEY, webhookSecret: KEY, catalog, account: STRIPE_ACCOUNT, livemode: false, origin: options.origin, provider: { account: STRIPE_ACCOUNT, livemode: false, async createCheckout() { throw Error('unused'); }, async snapshot() { reads++; if (fail)
            throw Error('provider-down'); return snapshot(repository.state, now); } } }); const raw = JSON.stringify({ id: 'evt_retry', created: now, type: 'checkout.session.completed', livemode: false, data: { object: { id: 'cs_fixture' } } }); await assert.rejects(service.webhook(raw, 'invalid')); assert.equal(reads, 0); await assert.rejects(service.webhook(raw, signature(raw, now))); assert.deepEqual(repository.state.events, {}); fail = false; assert.equal(await service.webhook(raw, signature(raw, now)), 'applied'); assert.equal(await service.webhook(raw, signature(raw, now)), 'duplicate'); assert.equal(reads, 2); });
test('concurrent checkout clicks use one provider idempotency key', async () => { const { s, token, now } = linked(), repository = new MemoryRepository(s), keys: string[] = []; const service = billingService({ repository, now: () => now, signingKey: KEY, webhookSecret: KEY, catalog, account: STRIPE_ACCOUNT, livemode: false, origin: options.origin, provider: { account: STRIPE_ACCOUNT, livemode: false, async createCheckout(params, key) { keys.push(key); return { id: 'cs_fixture', url: 'https://checkout.stripe.com/c/fixture', expiresAt: params.expires_at }; }, async snapshot() { throw Error('unused'); } } }); await Promise.all([service.checkout(identity, client, token), service.checkout(identity, client, token)]); assert.equal(new Set(keys).size, 1); assert.equal(repository.state.attempts.length, 1); });
test('retry preserves exact original parameters even if deployment return origin changes', () => { const { s, token, now, d } = reserved(); const again = reserveCheckout(s, client, token, { ...options, origin: 'https://changed.example.test' }, now + 1); if (again.kind !== 'ready')
    throw Error(); assert.deepEqual(again.params, d.params); });
test('cancel-at-period-end suppresses setup reminders without pretending paid', () => { const { s, d, now } = reserved(), p = snapshot(s, now); p.subscription!.cancelAtPeriodEnd = true; reconcile(s, d.attempt, event(now), p, false, now); assert.equal(reminderStatus(s, 15, now), 'suppressed'); assert.equal(s.paidThrough, null); assert.match(nextAction(s, now), /Cancelación registrada/); });
test('expired provider session requires fresh signed generation; original deadline persists', () => { const { s, d, now } = reserved(), p = snapshot(s, now); p.session.status = 'expired'; p.session.customerId = null; p.session.subscriptionId = null; p.subscription = null; reconcile(s, d.attempt, event(now, 'evt_expired', 'checkout.session.expired'), p, false, now); const end = s.trialEnd; issueLink(s, operator, now + 1); assert.equal(s.link!.generation, 2); const d2 = reserveCheckout(s, client, signLink(s, KEY), options, now + 1); if (d2.kind !== 'ready')
    throw Error(); assert.notEqual(d2.idempotencyKey, d.idempotencyKey); assert.equal(d2.params.subscription_data.trial_end, end); });
test('provider cancellation failure retains local withdrawal and blocks retry checkout', async () => { const { s, token, now } = reserved(), repository = new MemoryRepository(s); const service = billingService({ repository, now: () => now, signingKey: KEY, webhookSecret: KEY, catalog, account: STRIPE_ACCOUNT, livemode: false, origin: options.origin, provider: { account: STRIPE_ACCOUNT, livemode: false, async createCheckout() { throw Error('unused'); }, async snapshot() { throw Error('unused'); }, async cancelEnrollment() { throw Error('provider-down'); } } }); await assert.rejects(service.withdraw(identity, client, 'client-stop'), /provider-down/); assert.equal(repository.state.withdrawnAt, now); await assert.rejects(service.checkout(identity, client, token)); assert.match(nextAction(repository.state, now), /Confirmar cancelación/); });
test('provider-confirmed cancellation uses durable unique key and records receipt', async () => { const { s, now } = reserved(), repository = new MemoryRepository(s), keys: string[] = []; const service = billingService({ repository, now: () => now, signingKey: KEY, webhookSecret: KEY, catalog, account: STRIPE_ACCOUNT, livemode: false, origin: options.origin, provider: { account: STRIPE_ACCOUNT, livemode: false, async createCheckout() { throw Error('unused'); }, async snapshot() { throw Error('unused'); }, async cancelEnrollment(_state, key) { keys.push(key); return { canceled: true }; } } }); assert.equal(await service.withdraw(identity, client, 'client-stop'), 'canceled'); assert.equal(repository.state.enrollment, 'canceled'); assert.equal(repository.state.attempts[0].status, 'expired'); assert.equal(new Set(keys).size, 1); });
test('wrong provider account/live context rejected before a write can run', () => { const { s, now } = linked(); let calls = 0; for (const context of [{ account: 'acct_wrong', livemode: false }, { account: STRIPE_ACCOUNT, livemode: true }])
    assert.throws(() => billingService({ repository: new MemoryRepository(s), now: () => now, signingKey: KEY, webhookSecret: KEY, catalog, account: STRIPE_ACCOUNT, livemode: false, origin: options.origin, provider: { ...context, async createCheckout() { calls++; throw Error('unexpected'); }, async snapshot() { throw Error('unused'); } } }), /provider_context/); assert.equal(calls, 0); });
test('service confirms actual go-live once; site_only never calls publication verifier', async () => { const repository = new MemoryRepository(fresh()); let reads = 0; const service = billingService({ repository, now: () => T, signingKey: KEY, webhookSecret: KEY, catalog, account: STRIPE_ACCOUNT, livemode: false, origin: options.origin, provider: { account: STRIPE_ACCOUNT, livemode: false, async createCheckout() { throw Error('unused'); }, async snapshot() { throw Error('unused'); } }, async verifyPublication() { reads++; return { served: true, evidence: 'fixture-live-proof' }; } }); assert.equal(await service.goLive(identity, operator, 'site_only', 2), 'skipped'); assert.equal(reads, 0); await assert.rejects(service.goLive(identity, operator, 'accepted_go_live', 2)); await service.accept(identity, client, terms); await service.approve(identity, operator, 2, 'review'); assert.equal(await service.goLive(identity, operator, 'accepted_go_live', 2), 'started'); assert.equal(await service.goLive(identity, operator, 'accepted_go_live', 2), 'already_live'); assert.equal(reads, 1); assert.equal(repository.state.trialEnd, T + 30 * DAY); });
test('reminder dispatcher rejects invalid clock and non-approved day numbers', () => { assert.throws(() => reminderStatus(live(), 15, NaN)); assert.throws(() => reminderStatus(live(), 16 as 15, T)); });

test('delayed creation and timed-out retry retain valid expiry and identical frozen body', async () => {
    const { s, token, now } = linked(), repository = new MemoryRepository(s);
    let clock = now, calls = 0;
    const bodies: unknown[] = [];
    const service = billingService({ repository, now: () => clock, signingKey: KEY, webhookSecret: KEY, catalog, account: STRIPE_ACCOUNT, livemode: false, origin: options.origin, provider: {
        account: STRIPE_ACCOUNT, livemode: false,
        async createCheckout(params, key) {
            clock += 1; // Transport/provider creation happens after reservation.
            assert.ok(params.expires_at - clock >= 1800);
            bodies.push({ params, key });
            if (++calls === 1) throw Error('unknown-pre-provider-timeout');
            return { id: 'cs_delayed', url: 'https://checkout.stripe.com/c/delayed', expiresAt: params.expires_at };
        }, async snapshot() { throw Error('unused'); },
    } });
    await assert.rejects(service.checkout(identity, client, token), /timeout/);
    clock = now + 600;
    await service.checkout(identity, client, token);
    assert.deepEqual(bodies[0], bodies[1]);
    assert.equal(repository.state.trialEnd, s.trialEnd);
    clock = now + 1800; // Returning a known open session is safe after submission cutoff.
    assert.equal((await service.checkout(identity, client, token)).kind, 'session');
    assert.equal(calls, 2);
});
test('unknown create after submission cutoff holds without provider retry or new generation', async () => {
    const { s, token, now } = reserved(), repository = new MemoryRepository(s);
    let calls = 0;
    const service = billingService({ repository, now: () => now + 901, signingKey: KEY, webhookSecret: KEY, catalog, account: STRIPE_ACCOUNT, livemode: false, origin: options.origin, provider: {
        account: STRIPE_ACCOUNT, livemode: false,
        async createCheckout() { calls++; throw Error('must-not-submit'); }, async snapshot() { throw Error('unused'); },
    } });
    await assert.rejects(service.checkout(identity, client, token), /reconciliation/);
    assert.equal(calls, 0);
    assert.equal(repository.state.attempts.length, 1);
    assert.throws(() => issueLink(repository.state, operator, now + 902));
});
test('final trial guard reserves a full hour before provider minimum trial boundary', () => {
    const { s } = linked(); const clock = s.trialEnd! - 2 * DAY - 3600;
    issueLink(s, operator, clock);
    assert.equal(reserveCheckout(s, client, signLink(s, KEY), options, clock).kind, 'assisted_setup_required');
});

test('admin next action agrees with Checkout throughout final cutoff window', () => {
    for (const remaining of [2 * DAY + 3600, 2 * DAY + 2700, 2 * DAY + 1800]) {
        const s = live(), now = s.trialEnd! - remaining;
        issueLink(s, operator, now);
        assert.match(nextAction(s, now), /Revisión asistida/);
        assert.equal(reserveCheckout(s, client, signLink(s, KEY), options, now).kind, 'assisted_setup_required');
    }
});
