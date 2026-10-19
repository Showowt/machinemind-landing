// Entirely offline: actual policy/templates/scheduler modules; in-memory relational
// fixtures only. Public JA IDs select the exception; contacts/content are synthetic.
/* eslint-disable @typescript-eslint/no-require-imports -- Offline CommonJS VM harness. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const JA = '1afdbfc5-8703-4ecd-9405-fa2aebb4d708';
const OTHER = '11111111-2222-4333-8444-555555555555';
const SIGNUPS = 'web_gratis_signups', MESSAGES = 'web_gratis_messages', VIEW = 'web_gratis_wa_state';
const HELD = ['cqv_web_day28', 'cqv_web_day30', 'cqv_web_pause_notice', 'cqv_web_rescue', 'cqv_web_renewal'];
const clone = value => JSON.parse(JSON.stringify(value));
const forbidden = () => { throw new Error('Forbidden real database/provider/network access'); };

function load(file, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    exports, Date, console: { error() {} }, fetch: forbidden, setTimeout: forbidden,
    require(name) {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency ${name} in ${file}`);
      return dependencies[name];
    },
  }, { filename: file });
  return exports;
}
const policy = load('src/lib/web-gratis/expiry-holds.ts');
const config = load('src/lib/web-gratis/config.ts');
const templates = load('src/lib/web-gratis/templates.ts', { './config': config, './expiry-holds': policy });

function signup(id = JA, overrides = {}) {
  return {
    id, status: 'entregada', business_name: `SYNTHETIC fixture ${id === JA ? 'held' : 'control'}`,
    whatsapp: id === JA ? '+50300000001' : '+50300000002', referral_code: id === JA ? 'E67BBT' : 'TEST02',
    lang: 'es', site_url: 'https://fixture.invalid/review', submitted_at: null,
    delivered_at: '2026-09-26T15:00:00.000Z', free_until: '2026-10-26', activated_at: null,
    paused_at: null, opted_out_at: null, no_whatsapp_at: null, last_inbound_at: null,
    rung2_interest_at: '2026-09-27T15:00:00.000Z', declined_at: null,
    confirmed_at: null, last_touch_kind: null, last_touch_at: null,
    paid_via: null, paid_through: null, last_payment_at: null,
    stripe_subscription_id: null, stripe_customer_id: null, ...overrides,
  };
}
function message(id, signupId = JA, overrides = {}) {
  return {
    id, signup_id: signupId, phone: signup(signupId).whatsapp, direction: 'outbound',
    template: 'cqv_web_day28', source: 'scheduler', msg_type: null, body: 'SYNTHETIC previous body',
    media_path: null, wa_message_id: null, status: 'queued', attempts: 2,
    idempotency_key: `synthetic-key-${id}`, next_attempt_at: '2026-10-24T14:59:00.000Z',
    locked_until: null, scheduled_for: '2026-10-24T14:59:00.000Z', received_at: null,
    sent_at: null, delivered_at: null, read_at: null, failed_at: null,
    last_error_code: 'disabled', last_error: 'Synthetic prior outcome', cycle: null,
    meta: { fixture: true, previousAudit: { retained: 'yes' } },
    created_at: '2026-10-24T14:59:00.000Z', updated_at: '2026-10-24T14:59:00.000Z',
    ...overrides,
  };
}

// Evaluates the query filters the production scheduler issues, including null
// comparisons, view aggregation and compare-and-update predicates. It fails on
// unknown operations instead of silently accepting a missing branch.
function memoryDb(signups, messages) {
  const writes = [], reads = [];
  let failure = null;
  function value(row, column) {
    if (column === 'signup.business_name') return signups.find(s => s.id === row.signup_id)?.business_name ?? null;
    return row[column];
  }
  function predicate(column, op, expected) {
    return row => {
      const actual = value(row, column);
      if (op === 'is') return actual === expected;
      if (op === 'eq') return actual != null && actual === expected;
      if (op === 'neq') return actual != null && actual !== expected;
      if (op === 'in') return expected.includes(actual);
      if (op === 'cs') return expected.slice(1, -1).split(',').every(v => actual?.includes(v));
      if (op === 'like') return typeof actual === 'string' && new RegExp(`^${expected.replace(/%/g, '.*')}$`).test(actual);
      if (actual == null) return false;
      if (op === 'lt') return actual < expected;
      if (op === 'lte') return actual <= expected;
      if (op === 'gte') return actual >= expected;
      throw new Error(`Unknown filter ${op}`);
    };
  }
  function source(table) {
    if (table === SIGNUPS) return signups;
    if (table === MESSAGES) return messages;
    if (table === VIEW) return signups.filter(s => ['nuevo', 'en_construccion', 'entregada', 'compartida', 'pausada'].includes(s.status)).map(s => {
      const own = messages.filter(m => m.signup_id === s.id);
      return { ...s, templates: own.map(m => m.template), last_template_at: own.map(m => m.sent_at).filter(Boolean).sort().at(-1) ?? null };
    });
    throw new Error(`Unexpected table ${table}`);
  }
  function from(table) {
    const filters = [];
    let operation = 'select', patch = null, max = Infinity, order = null, single = false, completed;
    const q = {
      select() { return q; },
      update(data) { operation = 'update'; patch = clone(data); return q; },
      insert(data) { operation = 'insert'; patch = clone(data); return q; },
      eq(c, v) { filters.push(predicate(c, 'eq', v)); return q; },
      neq(c, v) { filters.push(predicate(c, 'neq', v)); return q; },
      is(c, v) { filters.push(predicate(c, 'is', v)); return q; },
      in(c, v) { filters.push(predicate(c, 'in', v)); return q; },
      lte(c, v) { filters.push(predicate(c, 'lte', v)); return q; },
      gte(c, v) { filters.push(predicate(c, 'gte', v)); return q; },
      not(c, op, v) { const p = predicate(c, op, v); filters.push(row => !p(row)); return q; },
      or(expression) {
        const clauses = expression.split(',').map(part => {
          const match = /^([^.]+)\.(is|lt)\.(.+)$/.exec(part);
          assert.ok(match, `Unsupported OR ${expression}`);
          return predicate(match[1], match[2], match[3] === 'null' ? null : match[3]);
        });
        filters.push(row => clauses.some(p => p(row))); return q;
      },
      order(column, options) { order = [column, options.ascending]; return q; },
      limit(n) { max = n; return q; },
      maybeSingle() { single = true; return q; },
      single() { single = true; return q; },
      then(resolve, reject) {
        if (!completed) completed = Promise.resolve().then(() => {
          if (failure && failure({ table, operation, patch })) return { data: null, error: new Error('Synthetic persistence failure') };
          let rows = source(table).filter(row => filters.every(p => p(row)));
          if (order) rows.sort((a, b) => String(value(a, order[0])).localeCompare(String(value(b, order[0]))) * (order[1] ? 1 : -1));
          rows = rows.slice(0, max);
          if (operation === 'select') reads.push({ table, ids: rows.map(row => row.id) });
          if (operation === 'update') {
            assert.notEqual(table, VIEW, 'View mutation is forbidden');
            for (const row of rows) {
              writes.push({ table, operation, id: row.id, before: clone(row), patch: clone(patch) });
              Object.assign(row, patch);
            }
          }
          if (operation === 'insert') {
            assert.equal(table, MESSAGES, 'Only message inserts are expected');
            if (messages.some(m => m.signup_id === patch.signup_id && m.template === patch.template && m.cycle === (patch.cycle ?? null))) {
              return { data: null, error: { code: '23505' } };
            }
            const row = message(Math.max(0, ...messages.map(m => m.id)) + 1, patch.signup_id, patch);
            messages.push(row); rows = [row];
            writes.push({ table, operation, id: row.id, patch: clone(patch) });
          }
          return { data: clone(single ? rows[0] ?? null : rows), error: null };
        });
        return completed.then(resolve, reject);
      },
    };
    return q;
  }
  return { from, writes, reads, failWhen(fn) { failure = fn; } };
}

function harness(now = '2026-10-24T16:00:00.000Z', people = [signup(), signup(OTHER)], history = []) {
  const signups = clone(people), messages = clone(history), db = memoryDb(signups, messages);
  const sends = [], alerts = [], purges = [];
  const wa = load('src/lib/web-gratis/whatsapp.ts', {
    './expiry-holds': policy, crypto: { randomBytes: n => ({ toString: () => 'ab'.repeat(n) }) },
    './config': config, './outbox': { enqueueSystem: forbidden },
    './rewired': { sendViaRewired: forbidden },
    './server': {
      getDb: () => db, SIGNUPS_TABLE: SIGNUPS, BUILDING_STATUSES: ['nuevo', 'en_construccion'],
      LIVE_FREE_STATUSES: ['entregada', 'compartida'], loadSettings: forbidden, svDate: templates.svDay,
    }, './sites/mm-sites': { revalidateSignupSite: forbidden }, './templates': templates,
  });
  const deps = {
    now: () => new Date(now),
    send: async request => { sends.push(clone(request)); return { ok: true, wamid: `synthetic-wamid-${sends.length}` }; },
    alert: async (key, text) => { alerts.push({ key, text }); return true; },
    sleep: async () => {}, settings: async () => ({ pay_link: 'https://fixture.invalid/pay', paypal_link: null }),
    purgeSite: async id => { purges.push(id); },
  };
  return { wa, db, deps, signups, messages, sends, alerts, purges,
    run: () => wa.runWhatsAppScheduler(deps, { spacingMs: 0, deadline: Number.MAX_SAFE_INTEGER, defaultPaypalLink: null }),
  };
}

function assertJaUnchanged(h, before) {
  assert.deepEqual(h.signups.find(s => s.id === JA), before);
  assert.ok(h.sends.every(s => s.to !== before.whatsapp));
  assert.ok(!h.purges.includes(JA));
  assert.ok(!h.db.writes.some(w => w.table === SIGNUPS && w.id === JA));
}

test('policy identifies JA only, preserves $20, and does not claim any proposed interval approved', () => {
  const state = policy.getExpiryHoldState(JA, new Date('2026-10-20T15:00:00.000Z'));
  assert.equal(state.phase, 'awaiting_dates');
  assert.equal(state.intervalApproved, false);
  assert.equal(state.startsAt, null); assert.equal(state.endsAt, null);
  assert.equal(state.monthlyPriceUsd, 20); assert.equal(state.timezone, 'America/El_Salvador');
  assert.equal(state.doesNotActivateBilling, true); assert.equal(state.legacyAutomaticPauseHeld, true);
  for (const id of [OTHER, undefined, null, '', JA.toUpperCase()]) assert.equal(policy.getExpiryHold(id), null);
  for (const t of HELD) assert.equal(policy.isLegacyExpiryTemplateHeld(JA, t), true);
  for (const t of ['cqv_web_heads_up', 'cqv_web_confirm', 'cqv_web_ready', null, 'unexpected']) assert.equal(policy.isLegacyExpiryTemplateHeld(JA, t), false);
});

for (const [date, expected] of [['2026-10-24', 'cqv_web_day28'], ['2026-10-26', 'cqv_web_day30'], ['2026-10-28', 'cqv_web_pause_notice']]) {
  test(`actual general scheduler suppresses JA's legacy ${expected} on ${date}, sends same eligible control`, async () => {
    const h = harness(`${date}T16:00:00.000Z`), before = clone(h.signups[0]);
    const report = await h.run();
    assert.deepEqual(clone(report.errors), []);
    assertJaUnchanged(h, before);
    assert.equal(h.sends.length, 1); assert.equal(h.sends[0].template.name, expected);
    assert.equal(h.messages.length, 1); assert.equal(h.messages[0].signup_id, OTHER);
    assert.equal(h.messages[0].status, 'sent');
  });
}

for (const [name, now, history, overrides] of [
  ['notice reached, +3 days', '2026-10-29T16:00:00.000Z', { template: 'cqv_web_pause_notice', status: 'delivered', sent_at: '2026-10-28T15:00:00.000Z' }, {}],
  ['earlier ask reached, +6 days Sunday', '2026-11-01T16:00:00.000Z', { template: 'cqv_web_day28', status: 'read', sent_at: '2026-10-24T16:00:00.000Z' }, {}],
  ['opted out', '2026-10-29T16:00:00.000Z', null, { opted_out_at: '2026-10-20T16:00:00.000Z' }],
  ['no WhatsApp', '2026-10-29T16:00:00.000Z', null, { no_whatsapp_at: '2026-10-20T16:00:00.000Z' }],
  ['declined', '2026-10-29T16:00:00.000Z', null, { declined_at: '2026-10-20T16:00:00.000Z' }],
]) {
  test(`actual scheduler never pauses JA when ${name}; control retains existing pause behavior`, async () => {
    const rows = history ? [message(1, JA, history), message(2, OTHER, history)] : [];
    const h = harness(now, [signup(JA, overrides), signup(OTHER, overrides)], rows), before = clone(h.signups[0]);
    const report = await h.run();
    assert.deepEqual(clone(report.errors), []);
    assertJaUnchanged(h, before);
    assert.equal(report.pauseHeld, 1); assert.equal(report.paused, 1);
    assert.equal(h.signups[1].status, 'pausada'); assert.equal(h.signups[1].paused_at, now);
    assert.deepEqual(h.purges, [OTHER]);
  });
}

test('renewal and rescue paths retain tenant isolation, including active-payer auto-pause', async () => {
  const overrides = { status: 'activa', paid_via: 'manual', paid_through: '2026-10-25', activated_at: '2026-09-25T16:00:00.000Z', last_payment_at: '2026-09-25T16:00:00.000Z', no_whatsapp_at: '2026-10-20T16:00:00.000Z' };
  const h = harness('2026-10-29T16:00:00.000Z', [signup(JA, overrides), signup(OTHER, overrides)]), before = clone(h.signups[0]);
  const report = await h.run();
  assert.deepEqual(clone(report.errors), []); assertJaUnchanged(h, before);
  assert.equal(report.paused, 1); assert.equal(report.pauseHeld, 1); assert.deepEqual(h.purges, [OTHER]);
  const rescue = harness('2026-10-23T16:00:00.000Z', [signup(JA, { rung2_interest_at: null }), signup(OTHER, { rung2_interest_at: null })]);
  assert.deepEqual(clone((await rescue.run()).errors), []);
  assert.equal(rescue.sends.length, 1); assert.equal(rescue.sends[0].to, signup(OTHER).whatsapp);
  assert.equal(rescue.sends[0].template.name, 'cqv_web_rescue');
});

test('automatic monthly renewal still reaches an eligible control while JA remains held', async () => {
  const overrides = { status: 'activa', paid_via: 'manual', paid_through: '2026-10-26', activated_at: '2026-09-26T16:00:00.000Z', last_payment_at: '2026-09-26T16:00:00.000Z' };
  const h = harness('2026-10-23T16:00:00.000Z', [signup(JA, overrides), signup(OTHER, overrides)]), before = clone(h.signups[0]);
  assert.deepEqual(clone((await h.run()).errors), []);
  assertJaUnchanged(h, before);
  assert.equal(h.sends.length, 1); assert.equal(h.sends[0].template.name, 'cqv_web_renewal');
  assert.equal(h.messages[0].signup_id, OTHER); assert.equal(h.messages[0].cycle, '2026-10-26');
});

for (const template of HELD) {
  test(`new manual, forced and queued entrypoints cannot bypass ${template} hold`, async () => {
    const h = harness(), before = clone(h.signups[0]);
    assert.equal(templates.manualBlock(template, h.signups[0], { pay_link: 'https://fixture.invalid/pay' }), policy.EXPIRY_HOLD_MESSAGE);
    assert.equal(await h.wa.queueManualTemplate(JA, template, h.deps.now(), 'Synthetic manual request'), false);
    for (const force of [false, true]) {
      const result = await h.wa.sendTemplateManually(JA, template, h.deps, { force });
      assert.equal(result.ok, false); assert.equal(result.error, 'not_eligible');
    }
    assert.deepEqual(h.db.reads, []); assert.deepEqual(h.db.writes, []); assertJaUnchanged(h, before);
  });
}

test('existing queued manual row is audited as skipped without losing history or impersonating delivery', async () => {
  const previous = message(17, JA, { source: 'admin', locked_until: '2026-10-24T15:30:00.000Z', meta: { manual: true, manual_retry_at: '2026-10-23T15:00:00.000Z', previousAudit: { retained: true } }, last_error_code: 'send_unknown', last_error: 'Unresolved historical outcome' });
  const h = harness(undefined, undefined, [previous]), before = clone(h.signups[0]);
  const report = await h.run();
  assert.deepEqual(clone(report.errors), []); assert.equal(report.skipped, 1);
  assertJaUnchanged(h, before);
  const saved = h.messages.find(m => m.id === previous.id);
  assert.equal(saved.status, 'skipped'); assert.equal(saved.last_error_code, policy.EXPIRY_HOLD_CODE);
  assert.equal(saved.next_attempt_at, null); assert.equal(saved.locked_until, null);
  for (const field of ['attempts', 'idempotency_key', 'sent_at', 'wa_message_id', 'delivered_at', 'read_at', 'body', 'source', 'created_at']) assert.deepEqual(saved[field], previous[field]);
  assert.deepEqual(saved.meta.previousAudit, previous.meta.previousAudit); assert.equal(saved.meta.manual, true);
  assert.equal(saved.meta.expiry_hold.previousStatus, 'queued');
  assert.equal(saved.meta.expiry_hold.previousNextAttemptAt, previous.next_attempt_at);
  assert.equal(saved.meta.expiry_hold.previousLockedUntil, previous.locked_until);
  assert.equal(saved.meta.expiry_hold.previousErrorCode, previous.last_error_code);
  assert.equal(saved.meta.expiry_hold.previousError, previous.last_error);
  assert.ok(h.sends.every(s => s.to === signup(OTHER).whatsapp));
});

test('a concurrent reached outcome cannot be overwritten by the hold audit update', async () => {
  const staleQueued = message(1), reached = { ...staleQueued, status: 'delivered', sent_at: '2026-10-24T15:59:00.000Z', wa_message_id: 'synthetic-existing-wamid' };
  const h = harness(undefined, [signup()], [reached]);
  assert.equal((await h.wa.attemptTemplateSend(staleQueued, h.signups[0], h.deps)).sent, false);
  assert.deepEqual(h.messages, [reached]); assert.deepEqual(h.sends, []); assert.deepEqual(h.db.writes, []);
});

for (const [label, changed] of [
  ['another worker acquired a lease', { locked_until: '2026-10-24T16:03:00.000Z' }],
  ['another worker recorded an attempt', { attempts: 3 }],
  ['another worker rescheduled the row', { next_attempt_at: '2026-10-24T17:00:00.000Z' }],
]) {
  test(`stale direct attempt cannot overwrite audit state after ${label}`, async () => {
    const stale = message(1), persisted = { ...stale, ...changed };
    const h = harness(undefined, [signup()], [persisted]);
    assert.equal((await h.wa.attemptTemplateSend(stale, h.signups[0], h.deps)).sent, false);
    assert.deepEqual(h.messages, [persisted]); assert.deepEqual(h.sends, []); assert.deepEqual(h.db.writes, []);
  });

  test(`scheduler reports a deferred hold after ${label}, without claiming a skip`, async () => {
    const original = message(1), h = harness(undefined, [signup()], [original]);
    let raced = false;
    h.db.failWhen(({ table, operation, patch }) => {
      if (!raced && table === MESSAGES && operation === 'update' && patch.last_error_code === policy.EXPIRY_HOLD_CODE) {
        raced = true;
        Object.assign(h.messages[0], changed); // Synthetic concurrent write after the queue SELECT.
      }
      return false;
    });
    const report = await h.run();
    assert.equal(raced, true); assert.deepEqual(clone(report.errors), []);
    assert.equal(report.skipped, 0); assert.equal(report.deferred, 1);
    assert.deepEqual(h.messages, [{ ...original, ...changed }]);
    assert.deepEqual(h.sends, []); assert.deepEqual(h.db.writes, []);
  });
}

test('scheduler preserves a concurrently delivered message and does not count it as skipped', async () => {
  const original = message(1), h = harness(undefined, [signup()], [original]);
  const providerReceipt = { status: 'delivered', sent_at: '2026-10-24T15:59:59.000Z', delivered_at: '2026-10-24T16:00:00.000Z', wa_message_id: 'synthetic-concurrent-wamid' };
  h.db.failWhen(({ table, operation, patch }) => {
    if (table === MESSAGES && operation === 'update' && patch.last_error_code === policy.EXPIRY_HOLD_CODE) Object.assign(h.messages[0], providerReceipt);
    return false;
  });
  const report = await h.run();
  assert.deepEqual(clone(report.errors), []); assert.equal(report.skipped, 0); assert.equal(report.deferred, 1);
  assert.deepEqual(h.messages, [{ ...original, ...providerReceipt }]);
  assert.deepEqual(h.sends, []); assert.deepEqual(h.db.writes, []);
});

for (const failure of ['database update', 'direct cross-tenant row', 'direct cross-tenant subject', 'already sent']) {
  test(`final send guard fails closed for ${failure}`, async () => {
    const row = message(1, failure === 'direct cross-tenant row' ? OTHER : JA, failure === 'already sent' ? { status: 'sent', sent_at: '2026-10-23T15:00:00.000Z' } : {});
    const h = harness(undefined, undefined, [row]);
    const subject = h.signups.find(s => s.id === (failure === 'direct cross-tenant subject' ? OTHER : JA));
    if (failure === 'database update') h.db.failWhen(({ operation }) => operation === 'update');
    const action = h.wa.attemptTemplateSend(clone(row), subject, h.deps);
    if (failure === 'database update') await assert.rejects(action, /Synthetic persistence failure/);
    else assert.equal((await action).sent, false);
    assert.deepEqual(h.sends, []); assert.deepEqual(h.purges, []); assert.deepEqual(h.alerts, []);
    assert.deepEqual(h.messages[0], row);
  });
}

test('queued hold persistence failure never reaches sender and leaves original row intact', async () => {
  const row = message(1), h = harness(undefined, [signup()], [row]);
  h.db.failWhen(({ table, operation }) => table === MESSAGES && operation === 'update');
  const report = await h.run();
  assert.ok(report.errors.some(e => e.includes('Synthetic persistence failure')));
  assert.deepEqual(h.sends, []); assert.deepEqual(h.messages, [row]); assert.deepEqual(h.purges, []);
});

test('JA neutral site-ready communication and control manual reminder retain prior behavior', async () => {
  const h = harness();
  assert.equal(templates.manualBlock('cqv_web_ready', h.signups[0], null), null);
  assert.equal((await h.wa.sendTemplateManually(JA, 'cqv_web_ready', h.deps)).ok, true);
  assert.equal((await h.wa.sendTemplateManually(OTHER, 'cqv_web_day28', h.deps)).ok, true);
  assert.deepEqual(h.sends.map(s => s.template.name), ['cqv_web_ready', 'cqv_web_day28']);
  assert.equal(h.signups[0].free_until, '2026-10-26');
  assert.equal(h.signups[0].activated_at, null); assert.equal(h.signups[0].paid_via, null);
});

// SYNTHETIC TEST WINDOW ONLY. These hashes are labeled fixtures, not evidence
// of real client consent. No window is inserted into the production policy.
const SYNTHETIC_WINDOW = {
  startsAt: '2026-10-20T15:00:00.000Z', endsAt: '2026-11-19T15:00:00.000Z',
  consentedAt: '2026-10-19T20:00:00.000Z', recordedAt: '2026-10-19T21:00:00.000Z',
  consentReceiptSha256: 'a'.repeat(64), operatorApprovalSha256: 'b'.repeat(64),
};
test('synthetic exact 30-day window uses El Salvador 09:00 and inclusive start/exclusive end', () => {
  assert.equal(policy.validEvaluationWindow(SYNTHETIC_WINDOW), true);
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/El_Salvador', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  assert.equal(f.format(new Date(SYNTHETIC_WINDOW.startsAt)), '09:00');
  assert.equal(f.format(new Date(SYNTHETIC_WINDOW.endsAt)), '09:00');
  for (const [at, phase] of [
    ['2026-10-20T14:59:59.999Z', 'scheduled'], ['2026-10-20T15:00:00.000Z', 'active'],
    ['2026-11-19T14:59:59.999Z', 'active'], ['2026-11-19T15:00:00.000Z', 'ended'],
    ['2027-01-01T00:00:00.000Z', 'ended'],
  ]) assert.equal(policy.evaluationPhase(SYNTHETIC_WINDOW, new Date(at)), phase);
  // Date classification is separate from the guard: ending never reenables legacy actions.
  for (const t of HELD) assert.equal(policy.isLegacyExpiryTemplateHeld(JA, t), true);
  assert.equal(policy.getExpiryHoldState(JA, new Date('2027-01-01T00:00:00.000Z')).legacyExpiryActionsHeld, true);
});

for (const [label, patch] of [
  ['missing evidence', { consentReceiptSha256: '' }], ['missing operator approval', { operatorApprovalSha256: undefined }],
  ['invalid hash', { consentReceiptSha256: 'x'.repeat(64) }], ['29-day interval', { endsAt: '2026-11-18T15:00:00.000Z' }],
  ['30 days plus 1ms', { endsAt: '2026-11-19T15:00:00.001Z' }], ['invalid calendar', { startsAt: '2026-02-30T15:00:00.000Z' }],
  ['noncanonical offset', { startsAt: '2026-10-20T09:00:00-06:00' }], ['date only', { startsAt: '2026-10-20' }],
  ['backdated recording', { recordedAt: '2026-10-20T15:00:00.001Z' }], ['acceptance after recording', { consentedAt: '2026-10-19T21:00:00.001Z' }],
  ['missing start', { startsAt: undefined }], ['null date', { startsAt: null }],
]) {
  test(`synthetic interval rejects ${label} and remains awaiting dates`, () => {
    const candidate = { ...SYNTHETIC_WINDOW, ...patch };
    assert.equal(policy.validEvaluationWindow(candidate), false);
    assert.equal(policy.evaluationPhase(candidate, new Date('2026-10-21T16:00:00.000Z')), 'awaiting_dates');
  });
}

test('absent window and invalid observation clock cannot activate the evaluation', () => {
  assert.equal(policy.evaluationPhase(null, new Date()), 'awaiting_dates');
  assert.equal(policy.evaluationPhase(SYNTHETIC_WINDOW, new Date('invalid')), 'awaiting_dates');
});
