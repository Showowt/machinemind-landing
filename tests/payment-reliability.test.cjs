// Offline fault injection: execute the actual payment handler with an in-memory
// PostgREST boundary. No environment files, provider calls, or database access.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const SIGNUPS = 'web_gratis_signups';
const EVENTS = 'web_gratis_stripe_events';
const PAYMENTS = 'web_gratis_payments';
const ID = '00000000-0000-4000-8000-000000000001';
const NOW = new Date('2026-10-01T12:00:00Z');

function fixture(overrides = {}) {
  const rows = {
    [SIGNUPS]: [{ id: ID, status: 'activa', business_name: 'Test business', whatsapp: '+50370000001',
      activated_at: '2026-09-01T12:00:00Z', paid_via: 'stripe', paid_through: '2026-10-01',
      stripe_subscription_id: 'sub_plan', stripe_customer_id: 'cus_plan', billing_issue: null,
      ...overrides }],
    [EVENTS]: [], [PAYMENTS]: [],
  };
  const faults = [];
  const queued = new Map();
  let rejectAlert = false;
  const db = { from(table) {
    let op = 'select', value, one = false, required = false, filters = [], reclaim = false;
    const q = {
      select() { return q; }, insert(v) { op = 'insert'; value = v; return q; },
      update(v) { op = 'update'; value = v; return q; },
      eq(k, v) { filters.push(r => r[k] === v); return q; },
      is(k, v) { filters.push(r => (r[k] ?? null) === v); return q; },
      in(k, v) { filters.push(r => v.includes(r[k])); return q; },
      not() { return q; }, order() { return q; }, limit() { return q; },
      or() { reclaim = true; return q; },
      single() { one = true; required = true; return q; }, maybeSingle() { one = true; return q; },
      then(resolve, reject) {
        return Promise.resolve().then(() => {
          const fault = faults.findIndex(f => f.table === table && f.op === op && (!f.when || f.when(value)));
          if (fault >= 0) { faults.splice(fault, 1); return { data: null, error: new Error('injected storage failure') }; }
          const data = rows[table] ||= [];
          if (op === 'insert') {
            const key = table === PAYMENTS ? 'external_id' : 'id';
            if (value[key] && data.some(r => r[key] === value[key])) return { data: null, error: { code: '23505' } };
            data.push({ id: data.length + 1, ...value });
            return { data: null, error: null };
          }
          let matched = data.filter(r => filters.every(f => f(r)) && (!reclaim || r.status === 'failed'));
          if (op === 'update') matched.forEach(r => Object.assign(r, value));
          matched = matched.map(r => ({ ...r, ...(table === PAYMENTS ? { signup: rows[SIGNUPS][0] } : {}) }));
          if (required && matched.length !== 1) return { data: null, error: { code: 'PGRST116' } };
          return { data: one ? matched[0] ?? null : matched, error: null };
        }).then(resolve, reject);
      },
    };
    return q;
  } };
  const exports = {};
  const stubs = {
    './server': { getDb: () => db, SIGNUPS_TABLE: SIGNUPS },
    './config': { MONTHLY_PRICE_USD: 19 },
    './templates': { svDay: d => new Date(d.getTime() - 6 * 3600000).toISOString().slice(0, 10) },
    './notify': { paymentReceivedText: () => 'Payment received', amountLabel: () => '$19' },
    './whatsapp': { isTestSignupName: () => false, MESSAGES_TABLE: 'messages' },
    './billing': {}, './bridge-auth': {}, './outbox': {},
  };
  const file = path.join(__dirname, '../src/lib/web-gratis/payments.ts');
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(source, { exports, require: name => {
    if (name === 'zod') return require('zod');
    assert.ok(Object.hasOwn(stubs, name), `Unexpected dependency: ${name}`);
    return stubs[name];
  }, console: { error() {} }, Date, process: { env: {} } }, { filename: file });
  return { api: exports, rows, faults, queued,
    failAlert(v) { rejectAlert = v; },
    deps: { now: () => NOW, send: async () => { throw new Error('No sends allowed'); },
      alert: async (key, text) => { if (rejectAlert) return false; if (!queued.has(key)) queued.set(key, text); return true; } },
  };
}

function invoice(id = 'evt_invoice') {
  return { id, type: 'invoice.paid', data: { object: {
    id: 'in_month', subscription: 'sub_plan', customer: 'cus_plan', billing_reason: 'subscription_cycle',
    amount_paid: 1900, currency: 'usd', lines: { data: [{ period: { end: Date.parse('2026-11-01T12:00:00Z') / 1000 } }] },
  } } };
}
function checkout() {
  return { id: 'evt_checkout', type: 'checkout.session.completed', data: { object: {
    client_reference_id: ID, metadata: { program: 'web_gratis' }, payment_status: 'paid',
    amount_total: 1900, currency: 'usd', customer: 'cus_plan', subscription: 'sub_plan',
  } } };
}

test('ledger failure rejects the event; redelivery repairs it without double extension', async () => {
  const f = fixture();
  f.faults.push({ table: PAYMENTS, op: 'insert' });
  await assert.rejects(f.api.handleStripeEvent(invoice(), f.deps));
  assert.equal(f.rows[EVENTS][0].status, 'failed');
  assert.equal(f.rows[PAYMENTS].length, 0);
  assert.equal(f.queued.size, 0);
  await f.api.handleStripeEvent(invoice(), f.deps);
  assert.equal(f.rows[EVENTS][0].status, 'processed');
  assert.equal(f.rows[PAYMENTS].length, 1);
  assert.equal(f.rows[SIGNUPS][0].paid_through, '2026-11-01');
  assert.equal(f.queued.size, 1);
  assert.equal((await f.api.handleStripeEvent(invoice(), f.deps)).duplicate, true);
});

for (const [name, event] of [['renewal', invoice], ['checkout', checkout]]) {
  test(`${name}: rejected outbox enqueue stays unalerted; retry queues exactly once`, async () => {
    const f = fixture();
    f.failAlert(true);
    await assert.rejects(f.api.handleStripeEvent(event(), f.deps), /not queued/);
    assert.equal(f.rows[PAYMENTS][0].alerted_at, null);
    assert.equal(f.rows[EVENTS][0].status, 'failed');
    f.failAlert(false);
    await f.api.handleStripeEvent(event(), f.deps);
    assert.equal(f.rows[PAYMENTS].length, 1);
    assert.equal(f.rows[PAYMENTS][0].alerted_at, NOW.toISOString());
    assert.equal(f.queued.size, 1);
  });
}

test('sweep and webhook share the same key after an acknowledgment write failure', async () => {
  const f = fixture();
  f.faults.push({ table: PAYMENTS, op: 'update' });
  await assert.rejects(f.api.handleStripeEvent(invoice(), f.deps));
  assert.equal(f.rows[PAYMENTS][0].alerted_at, null);
  assert.equal(f.queued.size, 1);
  const swept = await f.api.alertNewPayments(f.deps, { onlySignupIds: [ID] });
  assert.equal(swept.alerted, 1);
  assert.equal(f.queued.size, 1);
  await f.api.handleStripeEvent(invoice(), f.deps);
  assert.equal(f.queued.size, 1);
  assert.equal(f.rows[EVENTS][0].status, 'processed');
});

test('different Stripe event IDs for the same invoice keep one ledger row and one alert', async () => {
  const f = fixture();
  await f.api.handleStripeEvent(invoice('evt_a'), f.deps);
  await f.api.handleStripeEvent(invoice('evt_b'), f.deps);
  assert.equal(f.rows[PAYMENTS].length, 1);
  assert.equal(f.queued.size, 1);
});

test('cancellation persistence failure remains retryable and never suspends the site', async () => {
  const f = fixture();
  const event = { id: 'evt_cancel', type: 'customer.subscription.deleted', data: { object: { id: 'sub_plan', customer: 'cus_plan' } } };
  f.faults.push({ table: SIGNUPS, op: 'update' });
  await assert.rejects(f.api.handleStripeEvent(event, f.deps));
  assert.equal(f.rows[EVENTS][0].status, 'failed');
  await f.api.handleStripeEvent(event, f.deps);
  assert.equal(f.rows[SIGNUPS][0].billing_issue, 'subscription_canceled');
  assert.equal(f.rows[SIGNUPS][0].status, 'activa');
});

test('event completion failure rejects; replay does not duplicate ledger or alert', async () => {
  const f = fixture();
  f.faults.push({ table: EVENTS, op: 'update', when: v => v.status === 'processed' });
  await assert.rejects(f.api.handleStripeEvent(invoice(), f.deps));
  assert.equal(f.rows[EVENTS][0].status, 'failed');
  await f.api.handleStripeEvent(invoice(), f.deps);
  assert.equal(f.rows[PAYMENTS].length, 1);
  assert.equal(f.queued.size, 1);
});

test('another product invoice is ignored without changing the signup', async () => {
  const f = fixture();
  const event = invoice();
  event.data.object.subscription_details = { metadata: { program: 'other' } };
  assert.equal((await f.api.handleStripeEvent(event, f.deps)).handled, 'ignored');
  assert.equal(f.rows[PAYMENTS].length, 0);
  assert.equal(f.rows[SIGNUPS][0].paid_through, '2026-10-01');
});

test('first-payment ledger failure does not reclassify a retry as a renewal', async () => {
  const f = fixture({ status: 'entregada', activated_at: null, paid_through: null });
  f.faults.push({ table: PAYMENTS, op: 'insert' });
  await assert.rejects(f.api.handleStripeEvent(checkout(), f.deps));
  assert.equal(f.rows[SIGNUPS][0].activated_at, null);
  await f.api.handleStripeEvent(checkout(), f.deps);
  assert.equal(f.rows[PAYMENTS][0].kind, 'first');
  assert.equal(f.rows[SIGNUPS][0].status, 'activa');
});

test('reactivation ledger failure preserves classification and paid access on retry', async () => {
  const f = fixture({ status: 'pausada' });
  f.faults.push({ table: PAYMENTS, op: 'insert' });
  await assert.rejects(f.api.handleStripeEvent(invoice(), f.deps));
  assert.equal(f.rows[SIGNUPS][0].status, 'pausada');
  await f.api.handleStripeEvent(invoice(), f.deps);
  assert.equal(f.rows[PAYMENTS][0].kind, 'reactivation');
  assert.equal(f.rows[SIGNUPS][0].status, 'activa');
});

test('checkout redelivery the next day uses original ledger coverage', async () => {
  const f = fixture({ status: 'entregada', activated_at: null, paid_through: null });
  f.failAlert(true);
  await assert.rejects(f.api.handleStripeEvent(checkout(), f.deps));
  const originalCoverage = f.rows[PAYMENTS][0].paid_through;
  f.deps.now = () => new Date('2026-10-02T12:00:00Z');
  f.failAlert(false);
  await f.api.handleStripeEvent(checkout(), f.deps);
  assert.equal(f.rows[SIGNUPS][0].paid_through, originalCoverage);
  assert.equal(f.rows[SIGNUPS][0].last_payment_at, f.rows[PAYMENTS][0].paid_at);
  assert.equal(f.rows[SIGNUPS][0].last_payment_at, f.rows[SIGNUPS][0].activated_at);
  assert.equal(f.rows[PAYMENTS].length, 1);
});

for (const [name, event] of [['checkout', checkout], ['renewal', invoice]]) {
  test(`${name}: reactivation warning survives a rejected enqueue and retry`, async () => {
    const f = fixture({ status: 'pausada' });
    f.failAlert(true);
    await assert.rejects(f.api.handleStripeEvent(event(), f.deps));
    assert.equal(f.rows[SIGNUPS][0].status, 'activa');
    f.failAlert(false);
    await f.api.handleStripeEvent(event(), f.deps);
    assert.equal(f.queued.size, 1);
    assert.match([...f.queued.values()][0], /restaur/i);
  });
}

test('sweep winning the webhook race preserves build and confirmation warnings', async () => {
  const f = fixture({ status: 'en_construccion', activated_at: null, paid_through: null });
  const enqueue = f.deps.alert;
  let swept = false;
  f.deps.alert = async (key, text) => {
    if (!swept) {
      swept = true;
      await f.api.alertNewPayments({ alert: enqueue }, { onlySignupIds: [ID] });
    }
    return enqueue(key, text);
  };
  await f.api.handleStripeEvent(checkout(), f.deps);
  assert.equal(f.queued.size, 1);
  const text = [...f.queued.values()][0];
  assert.match(text, /AÚN NO está entregada/);
  assert.match(text, /confirmación por WhatsApp/);
  assert.match(text, /consentimiento/);
  assert.equal(f.rows[SIGNUPS][0].status, 'en_construccion');
});

test('a failed ledger read after insert retries using the original persisted payment', async () => {
  const f = fixture({ status: 'entregada', activated_at: null, paid_through: null });
  f.faults.push({ table: PAYMENTS, op: 'select' });
  await assert.rejects(f.api.handleStripeEvent(checkout(), f.deps));
  assert.equal(f.rows[SIGNUPS][0].activated_at, null);
  assert.equal(f.rows[PAYMENTS].length, 1);
  f.deps.now = () => new Date('2026-10-02T12:00:00Z');
  await f.api.handleStripeEvent(checkout(), f.deps);
  assert.equal(f.rows[PAYMENTS].length, 1);
  assert.equal(f.rows[SIGNUPS][0].paid_through, f.rows[PAYMENTS][0].paid_through);
  assert.equal(f.rows[PAYMENTS][0].kind, 'first');
});
