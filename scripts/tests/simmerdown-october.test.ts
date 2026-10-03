import test from 'node:test';
import assert from 'node:assert/strict';
import { SIMMERDOWN, emptySimmerState, reserveSimmerDownCheckout, recordSimmerOctoberPaid, recordSimmerOctoberLinkPaid, recordSimmerRecurringEnrollment, assertSimmerSubmissionAllowed, type SimmerAgreement, type SimmerPrice } from '../../src/lib/billing/simmerdown-october';
const now = Date.parse('2026-10-03T12:00:00Z') / 1000, anchor = Date.parse('2026-11-01T12:00:00Z') / 1000;
const agreement: SimmerAgreement = { ownerId: 'fixture_owner', clientId: 'fixture_simmerdown', customerId: 'cus_fixture', agreementId: 'fixture_agreement', acceptedByClient: true, acceptedAt: now, evidence: 'fixture-explicit-consent', octoberTotalCents: 30000, monthlyTotalCents: 30000, currency: 'usd', nextChargeAt: anchor, billingTimeZone: 'UTC', everyFirstAgreed: true };
const recurring: SimmerPrice = { id: 'price_fixture_recurring300', product: 'prod_fixture_test', account: SIMMERDOWN.account, livemode: false, active: true, type: 'recurring', cents: 30000, currency: 'usd', taxBehavior: 'inclusive', interval: 'month', intervalCount: 1 };
const october: SimmerPrice = { ...recurring, id: 'price_fixture_october300', product: 'prod_fixture_october', type: 'one_time' };
const catalog = { verifiedProductId: 'prod_fixture_test', verifiedOctoberProductId: 'prod_fixture_october', combinedAuthorization: { combinedAuthorized: true as const, oneTimeLinkInactiveVerified: true as const, evidence: 'fixture-owner-control', verifiedAt: now }, recurring, october, livemode: false }, origin = 'https://billing.example.test';
function fixture() {
    const s = emptySimmerState(), r = reserveSimmerDownCheckout(s, agreement, catalog, origin, now);
    if (r.kind !== 'ready')
        throw Error();
    return { s, r };
}
test('separate program with fixed November 1 and two line items; no relative trial/anchor/proration fields', () => {
    const { r } = fixture();
    assert.equal(r.params.subscription_data.trial_end, anchor);
    assert.equal(r.params.line_items.length, 2);
    for (const key of ['trial_period_days', 'billing_cycle_anchor', 'proration_behavior'])
        assert.equal(key in r.params.subscription_data, false);
    assert.equal(r.params.metadata.program, SIMMERDOWN.program);
    assert.match(r.params.custom_text.submit.message, /USD 300.00 hoy/);
    assert.match(r.params.custom_text.submit.message, /Octubre no es gratis/);
});
test('missing one-time price held; existing recurring price cannot masquerade as October price', () => { assert.equal(reserveSimmerDownCheckout(emptySimmerState(), agreement, { ...catalog, october: null }, origin, now).kind, 'held'); assert.throws(() => reserveSimmerDownCheckout(emptySimmerState(), agreement, { ...catalog, october: recurring }, origin, now)); });
for (const change of [{ acceptedByClient: false }, { everyFirstAgreed: false }, { monthlyTotalCents: 20000 }, { octoberTotalCents: 60000 }, { currency: 'eur' }, { customerId: '' }, { nextChargeAt: anchor + 86400 }])
    test(`consent/schedule mismatch ${JSON.stringify(change)} rejected`, () => assert.throws(() => reserveSimmerDownCheckout(emptySimmerState(), { ...agreement, ...change }, catalog, origin, now)));
for (const change of [{ taxBehavior: 'exclusive' }, { cents: 29999 }, { account: 'acct_wrong' }, { active: false }, { interval: 'year' }])
    test(`recurring verification ${JSON.stringify(change)} rejected`, () => assert.throws(() => reserveSimmerDownCheckout(emptySimmerState(), agreement, { ...catalog, recurring: { ...recurring, ...change } }, origin, now)));
test('late October and stale November sessions held instead of shifting date or charging unexpectedly', () => {
    for (const time of [anchor - 48 * 3600, anchor, anchor + 86400])
        assert.equal(reserveSimmerDownCheckout(emptySimmerState(), agreement, catalog, origin, time).kind, 'held');
});
test('DST date drift blocked; safe first-of-month UTC hour retains local first', () => { const risky = { ...agreement, billingTimeZone: 'America/Los_Angeles', nextChargeAt: Date.parse('2026-11-01T07:00:00Z') / 1000 }; assert.throws(() => reserveSimmerDownCheckout(emptySimmerState(), risky, catalog, origin, now), /timezone/); assert.equal(reserveSimmerDownCheckout(emptySimmerState(), { ...agreement, billingTimeZone: 'America/Los_Angeles' }, catalog, origin, now).kind, 'ready'); });
test('one durable October reservation and stable parameters across retries', () => { const { s, r } = fixture(); assert.deepEqual(reserveSimmerDownCheckout(s, agreement, catalog, 'https://changed.example.test', now + 10), r); assert.throws(() => reserveSimmerDownCheckout(s, agreement, catalog, origin, now + 1800)); assert.throws(() => reserveSimmerDownCheckout(s, { ...agreement, customerId: 'cus_other' }, catalog, origin, now + 1)); });
function receipt(id: string) { return { account: SIMMERDOWN.account, livemode: false, customerId: agreement.customerId, attemptId: id, sessionStatus: 'complete', paymentStatus: 'paid', invoiceId: 'in_fixture', subscriptionId: 'sub_fixture', cents: 30000, currency: 'usd', trialEnd: anchor, oneTimePriceId: october.id, oneTimeCents: 30000, recurringCentsNow: 0 }; }
test('October payment recorded once and blocks another subscription/charge', () => { const { s, r } = fixture(), p = receipt(r.idempotencyKey); assert.equal(recordSimmerOctoberPaid(s, agreement, p), 'paid'); assert.equal(recordSimmerOctoberPaid(s, agreement, p), 'duplicate'); assert.throws(() => recordSimmerOctoberPaid(s, agreement, { ...p, invoiceId: 'in_other' })); assert.throws(() => reserveSimmerDownCheckout(s, agreement, catalog, origin, now + 1)); });
for (const change of [{ cents: 60000 }, { recurringCentsNow: 30000 }, { oneTimeCents: 29000 }, { paymentStatus: 'unpaid' }, { customerId: 'cus_other' }, { trialEnd: anchor + 86400 }])
    test(`invoice anomaly ${JSON.stringify(change)} rejected`, () => { const { s, r } = fixture(); assert.throws(() => recordSimmerOctoberPaid(s, agreement, { ...receipt(r.idempotencyKey), ...change })); assert.equal(s.octoberInvoiceId, null); });
test('proposed El Salvador midnight anchor is explicit and remains November first', () => { const r = reserveSimmerDownCheckout(emptySimmerState(), { ...agreement, billingTimeZone: 'America/El_Salvador', nextChargeAt: 1793512800 }, catalog, origin, now); assert.equal(r.kind, 'ready'); if (r.kind === 'ready')
    assert.equal(r.params.subscription_data.trial_end, 1793512800); });

test('creation delay keeps valid expiry; frozen late submission must reconcile', () => {
    const { s, r } = fixture();
    assert.ok(r.params.expires_at - (now + 1) >= 1800);
    assertSimmerSubmissionAllowed(r.params.expires_at, now + 600);
    assert.deepEqual(reserveSimmerDownCheckout(s, agreement, catalog, origin, now + 600), r);
    assert.throws(() => assertSimmerSubmissionAllowed(r.params.expires_at, now + 901), /reconcile/);
    assert.throws(() => reserveSimmerDownCheckout(s, agreement, catalog, origin, now + 901), /reconcile/);
    assert.equal(s.request!.json, JSON.stringify(r.params));
});
test('verified test products differ from live products; prices match their own product', () => {
    assert.notEqual(catalog.verifiedProductId, SIMMERDOWN.product);
    assert.equal(fixture().r.kind, 'ready');
    assert.throws(() => reserveSimmerDownCheckout(emptySimmerState(), agreement, { ...catalog, verifiedProductId: SIMMERDOWN.product }, origin, now), /product/);
    assert.throws(() => reserveSimmerDownCheckout(emptySimmerState(), agreement, { ...catalog, october: { ...october, product: 'prod_other_test' } }, origin, now), /price/);
    assert.throws(() => reserveSimmerDownCheckout(emptySimmerState(), agreement, { ...catalog, livemode: true }, origin, now), /product/);
});
test('live catalog retains exact product and recurring price pins', () => {
    const live = { combinedAuthorization: catalog.combinedAuthorization, verifiedProductId: SIMMERDOWN.product, verifiedOctoberProductId: SIMMERDOWN.octoberProduct, livemode: true, recurring: { ...recurring, product: SIMMERDOWN.product, livemode: true, id: SIMMERDOWN.recurringPrice }, october: { ...october, id: SIMMERDOWN.octoberPrice, product: SIMMERDOWN.octoberProduct, livemode: true } };
    // Synthetic input validation only; no provider calls or real one-time ID.
    assert.equal(reserveSimmerDownCheckout(emptySimmerState(), agreement, live, origin, now).kind, 'ready');
    assert.throws(() => reserveSimmerDownCheckout(emptySimmerState(), agreement, { ...live, recurring: { ...live.recurring, id: 'price_wrong' } }, origin, now), /price/);
});

function paidLinkReceipt() { return { account: SIMMERDOWN.account, livemode: false, customerId: agreement.customerId, ownerId: agreement.ownerId, clientId: agreement.clientId, sessionId: 'cs_link_fixture', paymentLinkId: 'plink_fixture', paymentIntentId: 'pi_link_fixture', invoiceId: 'in_link_fixture' as string | null, mode: 'payment', status: 'complete', paymentStatus: 'paid', paymentIntentStatus: 'succeeded', cents: 30000, currency: 'usd', quantity: 1, priceId: october.id, billingPeriod: '2026-10' }; }
function alreadyPaid() { const s = emptySimmerState(); recordSimmerOctoberLinkPaid(s, agreement, catalog, paidLinkReceipt()); return s; }
test('verified October link payment creates recurring-only November enrollment with zero today', () => {
    const s = alreadyPaid(), r = reserveSimmerDownCheckout(s, agreement, catalog, origin, now);
    assert.equal(r.kind, 'ready');
    if (r.kind !== 'ready') throw Error();
    assert.equal(r.params.line_items.length, 1);
    assert.equal(r.params.line_items[0].price, recurring.id);
    assert.equal(r.params.subscription_data.trial_end, anchor);
    assert.match(r.params.custom_text.submit.message, /Hoy no se cobra/);
    assert.equal(s.request!.kind, 'recurring_only');
    assert.equal(s.octoberInvoiceId, 'in_link_fixture');
    assert.deepEqual(reserveSimmerDownCheckout(s, agreement, catalog, origin, now + 10), r);
    const enrollment = { account: SIMMERDOWN.account, livemode: false, customerId: agreement.customerId, attemptId: r.idempotencyKey, sessionStatus: 'complete', subscriptionId: 'sub_only_fixture', subscriptionStatus: 'trialing', trialEnd: anchor, priceId: recurring.id, quantity: 1, cents: 30000, currency: 'usd', amountTotalNow: 0, lineItemCount: 1, paymentMethodReady: true };
    assert.throws(() => recordSimmerRecurringEnrollment(s, agreement, { ...enrollment, amountTotalNow: 30000 }));
    assert.equal(recordSimmerRecurringEnrollment(s, agreement, enrollment), 'enrolled');
    assert.equal(recordSimmerRecurringEnrollment(s, agreement, enrollment), 'duplicate');
    assert.throws(() => reserveSimmerDownCheckout(s, agreement, catalog, origin, now + 1));
});
test('October paid receipts dedupe by invoice/payment identity, including links without invoices', () => {
    for (const invoiceId of ['in_link_fixture', null]) {
        const s = emptySimmerState(), p = { ...paidLinkReceipt(), invoiceId };
        assert.equal(recordSimmerOctoberLinkPaid(s, agreement, catalog, p), 'paid');
        assert.equal(recordSimmerOctoberLinkPaid(s, agreement, catalog, p), 'duplicate');
        assert.throws(() => recordSimmerOctoberLinkPaid(s, agreement, catalog, { ...p, paymentIntentId: 'pi_other' }), /duplicate/);
        const r = reserveSimmerDownCheckout(s, agreement, { ...catalog, october: null }, origin, now);
        assert.equal(r.kind, 'ready'); if (r.kind === 'ready') assert.equal(r.params.line_items.length, 1);
    }
});
for (const change of [{ paymentStatus: 'unpaid' }, { paymentIntentStatus: 'processing' }, { cents: 29999 }, { quantity: 2 }, { customerId: 'cus_wrong' }, { ownerId: 'wrong' }, { livemode: true }, { billingPeriod: '2026-11' }, { priceId: 'price_wrong' }])
    test(`one-time payment evidence ${JSON.stringify(change)} fails closed`, () => {
        const s = emptySimmerState();
        assert.throws(() => recordSimmerOctoberLinkPaid(s, agreement, catalog, { ...paidLinkReceipt(), ...change }));
        assert.equal(s.octoberPayment, null);
    });
test('paid link cannot silently replace uncertain combined checkout or grant recurring consent', () => {
    const { s } = fixture();
    recordSimmerOctoberLinkPaid(s, agreement, catalog, paidLinkReceipt());
    assert.throws(() => reserveSimmerDownCheckout(s, agreement, catalog, origin, now), /binding_changed/);
    assert.equal(s.request!.kind, 'combined');
    assert.throws(() => reserveSimmerDownCheckout(alreadyPaid(), { ...agreement, acceptedByClient: false }, catalog, origin, now), /consent/);
    assert.throws(() => reserveSimmerDownCheckout(alreadyPaid(), { ...agreement, customerId: 'cus_other' }, catalog, origin, now), /ownership/);
});

test('unpaid combined October checkout held while one-time link can still collect', () => {
    assert.equal(reserveSimmerDownCheckout(emptySimmerState(), agreement, { ...catalog, combinedAuthorization: undefined }, origin, now).kind, 'held');
    assert.equal(reserveSimmerDownCheckout(emptySimmerState(), agreement, { ...catalog, combinedAuthorization: { ...catalog.combinedAuthorization, verifiedAt: now - 301 } }, origin, now).kind, 'held');
    assert.equal(reserveSimmerDownCheckout(alreadyPaid(), agreement, { ...catalog, combinedAuthorization: undefined }, origin, now).kind, 'ready');
});
