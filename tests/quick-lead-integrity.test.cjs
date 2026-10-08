// Offline route-level fault injection. Executes the actual quick route, request
// schema, normalization and HTTP envelope. PostgREST and every outbound effect
// are in memory; no environment files, network, credentials or real leads.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const ROOT = path.join(__dirname, '..');
const SIGNUPS = 'web_gratis_signups';
const ID = '00000000-0000-4000-8000-000000000001';
const SECOND_ID = '00000000-0000-4000-8000-000000000002';
const NOW = Date.parse('2026-10-08T17:00:00.000Z');
class Clock extends Date {
  constructor(...args) { super(...(args.length ? args : [NOW])); }
  static now() { return NOW; }
}

function fixture(initial = []) {
  const rows = initial.map(row => ({ ...row }));
  const faults = [];
  const calls = { queries: [], alerts: [], notifications: [], capi: [], headsUp: [], drains: 0 };
  const queued = new Map();
  const afterTasks = [];
  const options = { enqueue: 'ok', headsUp: 'sent', volume: 0, referrer: null, collision: 0, raceWinner: null };
  let referral = 0;
  const db = { from(table) {
    assert.equal(table, SIGNUPS, 'Only the synthetic signup table is accessible');
    let op = 'select', value, one = false, required = false, filters = [], count = Infinity, columns = '*';
    const project = row => columns === '*' ? { ...row }
      : Object.fromEntries(columns.split(',').map(key => key.trim()).map(key => [key, row[key]]));
    const q = {
      select(value = '*') { columns = value; return q; },
      insert(v) { op = 'insert'; value = v; return q; },
      eq(k, v) { filters.push(row => row[k] === v); return q; },
      not(k, operator, v) {
        assert.equal(operator, 'is'); assert.equal(v, null);
        filters.push(row => row[k] != null); return q;
      },
      gte(k, v) { filters.push(row => row[k] >= v); return q; },
      limit(n) { count = n; return q; },
      maybeSingle() { one = true; return q; },
      single() { one = true; required = true; return q; },
      then(resolve, reject) {
        return Promise.resolve().then(() => {
          calls.queries.push({ table, op, value });
          const index = faults.findIndex(f => f.op === op && (!f.when || f.when(value, calls.queries)));
          if (index >= 0) {
            const fault = faults.splice(index, 1)[0];
            return { data: null, error: fault.error ?? { code: 'XX000', message: 'injected storage failure' } };
          }
          if (op === 'insert') {
            if (options.raceWinner) {
              rows.push({ ...options.raceWinner });
              options.raceWinner = null;
            }
            if (rows.some(row => row.id === value.id)) {
              return { data: null, error: { code: '23505', message: 'web_gratis_signups_pkey' } };
            }
            if (options.collision-- > 0) {
              return { data: null, error: { code: '23505', message: 'web_gratis_signups_referral_code_key' } };
            }
            const row = { status: 'borrador', created_at: new Clock().toISOString(), ...value };
            rows.push(row);
            return { data: one ? project(row) : [project(row)], error: null };
          }
          const matched = rows.filter(row => filters.every(filter => filter(row))).slice(0, count);
          if ((required && matched.length !== 1) || (one && matched.length > 1)) {
            return { data: null, error: { code: 'PGRST116', message: 'cardinality error' } };
          }
          return { data: one ? (matched[0] ? project(matched[0]) : null) : matched.map(project), error: null };
        }).then(resolve, reject);
      },
    };
    return q;
  } };

  const stubs = {
    'next/server': {
      after: fn => afterTasks.push(fn),
      NextResponse: { json: (body, init) => Response.json(body, init) },
    },
    '@/lib/web-gratis/server': {
      getDb: () => db,
      SIGNUPS_TABLE: SIGNUPS,
      agentScheduleOf: () => ({ startHour: 9, endHour: 18, days: '123456' }),
      loadSettings: async () => ({}),
      findReferrer: async () => options.referrer,
      ipHash: () => 'synthetic-ip-hash',
      recentDraftsFromIp: async () => options.volume,
      newReferralCode: () => `TEST${String(++referral).padStart(2, '2')}`,
      isReferralCodeCollision: error => error.code === '23505' && /referral_code/.test(error.message),
    },
    '@/lib/web-gratis/notify': {
      quickLeadAlert: (row, duty) => ({ html: `Synthetic lead ${row.id}`, text: `${row.whatsapp}:${duty.onDuty}` }),
      notifySaveFailed: async (...args) => { calls.notifications.push(args); },
    },
    '@/lib/web-gratis/outbox': {
      enqueueQuickLead: async (id, message) => {
        calls.alerts.push({ id, message });
        if (options.enqueue === 'throw') throw new Error('injected enqueue exception');
        if (options.enqueue === 'false') return false;
        if (!queued.has(`quick:${id}`)) queued.set(`quick:${id}`, message);
        return true;
      },
      enqueueSystem: async (key, text) => { queued.set(`system:${key}`, text); return true; },
      drainIfQuiet: async () => { calls.drains++; },
    },
    '@/lib/web-gratis/capi': { sendCapiEvent: async event => { calls.capi.push(event); } },
    '@/lib/web-gratis/whatsapp': {
      sendQuickHeadsUp: async id => {
        calls.headsUp.push(id);
        if (options.headsUp === 'throw') throw new Error('injected heads-up exception');
        return options.headsUp;
      },
    },
  };
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    vm.runInNewContext(compiled, {
      exports,
      require: name => {
        if (Object.hasOwn(stubs, name)) return stubs[name];
        if (name === 'zod') return require('zod');
        const resolved = name.startsWith('@/') ? path.join(ROOT, 'src', name.slice(2) + '.ts')
          : name.startsWith('.') ? path.resolve(path.dirname(file), name + '.ts') : null;
        assert.ok(resolved && ['config.ts', 'schema.ts', 'http.ts'].some(end => resolved === path.join(ROOT, 'src/lib/web-gratis', end)), `Unexpected dependency: ${name}`);
        return load(resolved);
      },
      console: { error() {}, warn() {}, log() {} },
      Date: Clock, Request, Response, URL, process: { env: {} },
    }, { filename: file });
    return exports;
  }
  const api = load(path.join(ROOT, 'src/app/api/web-gratis/quick/route.ts'));
  return {
    rows, faults, calls, queued, options,
    async post(changes = {}) {
      const response = await api.POST(new Request('https://example.invalid/api/web-gratis/quick', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'Offline lead integrity fixture' },
        body: JSON.stringify({ quickId: ID, countryCode: '507', whatsappLocal: '6123 4567', lang: 'es', ...changes }),
      }));
      return { status: response.status, body: await response.json() };
    },
    async flush() { while (afterTasks.length) await afterTasks.shift()(); },
  };
}

function saved(changes = {}) {
  return { id: ID, referral_code: 'SAVED2', status: 'borrador', whatsapp: '+50761234567', country: 'PA',
    created_at: new Clock().toISOString(), quick_capture_at: new Clock().toISOString(), ...changes };
}

for (const phone of ['6123 4567', '+507 6123 4567', '00507 6123 4567']) {
  test(`Panama ${phone}: actual route normalizes +507 and stores PA`, async () => {
    const f = fixture();
    const result = await f.post({ whatsappLocal: phone });
    assert.equal(result.status, 200);
    assert.equal(f.rows.length, 1);
    assert.equal(f.rows[0].whatsapp, '+50761234567');
    assert.equal(f.rows[0].country, 'PA');
    assert.equal(f.rows[0].whatsapp_consent_at, new Clock().toISOString());
    assert.equal(f.rows[0].whatsapp_consent_version, 'v1-quick-2026-09-30');
    assert.equal(f.queued.size, 1);
    await f.flush();
    assert.equal(f.calls.capi[0].eventId, `${ID}-lead`);
  });
}

for (const phone of ['2123456', '51234567', '6123456', '612345678', '+50370000001']) {
  test(`Panama invalid ${phone}: no persisted row or outbound effects`, async () => {
    const f = fixture();
    const result = await f.post({ whatsappLocal: phone });
    assert.equal(result.status, 400);
    assert.equal(result.body.error, 'invalid_whatsapp');
    await f.flush();
    assert.equal(f.rows.length, 0);
    assert.equal(f.calls.queries.length, 0);
    assert.equal(f.queued.size, 0);
    assert.equal(f.calls.capi.length, 0);
  });
}

test('attribution survives persistence unchanged and CAPI uses the saved lead identity', async () => {
  const f = fixture();
  const attribution = { ref: 'FRIEND', utm_source: 'ig', utm_medium: 'dm', utm_campaign: 'ig_slot_hold',
    utm_content: '2342473256530001', utm_term: 'panama', fbclid: 'synthetic_fbclid',
    landing_url: 'https://example.invalid/web?utm_source=ig&fbclid=synthetic_fbclid' };
  f.options.referrer = { id: SECOND_ID, whatsapp: '+50370000002' };
  const result = await f.post({ attribution });
  assert.equal(result.status, 200);
  for (const [key, value] of Object.entries(attribution)) assert.equal(f.rows[0][key === 'ref' ? 'ref_raw' : key], value);
  assert.equal(f.rows[0].referred_by_id, SECOND_ID);
  assert.equal(f.rows[0].ip_hash, 'synthetic-ip-hash');
  await f.flush();
  assert.equal(f.calls.capi[0].eventName, 'Lead');
  assert.equal(f.calls.capi[0].eventId, `${ID}-lead`);
  assert.equal(f.calls.capi[0].externalId, ID);
  assert.equal(f.calls.capi[0].sourceUrl, attribution.landing_url);
  assert.equal(f.calls.capi[0].fbclid, attribution.fbclid);
});

test('same quickId preserves one lead and original attribution', async () => {
  const f = fixture();
  const first = await f.post({ attribution: { utm_campaign: 'first' } });
  await f.flush();
  const retry = await f.post({ attribution: { utm_campaign: 'retry' } });
  await f.flush();
  assert.equal(retry.status, 200);
  assert.equal(retry.body.data.referralCode, first.body.data.referralCode);
  assert.equal(f.rows.length, 1);
  assert.equal(f.rows[0].utm_campaign, 'first');
  assert.equal(f.queued.size, 1);
  assert.equal(new Set(f.calls.capi.map(event => event.eventId)).size, 1);
});

test('existing quickId with a different phone is refused without disclosing or changing the saved lead', async () => {
  const f = fixture([saved()]);
  const result = await f.post({ whatsappLocal: '6987 6543' });
  assert.equal(result.status, 409);
  assert.equal(result.body.error, 'invalid');
  assert.equal(result.body.data, null);
  await f.flush();
  assert.equal(f.rows.length, 1);
  assert.equal(f.rows[0].whatsapp, '+50761234567');
  assert.equal(f.queued.size, 0);
  assert.equal(f.calls.capi.length, 0);
});

test('same phone under a new quickId within 24 hours returns the existing lead', async () => {
  const f = fixture([saved()]);
  const result = await f.post({ quickId: SECOND_ID });
  assert.equal(result.status, 200);
  assert.equal(result.body.data.referralCode, 'SAVED2');
  assert.equal(f.rows.length, 1);
});

test('same phone outside 24 hours can create a new capture', async () => {
  const f = fixture([saved({ created_at: new Date(NOW - 25 * 3600000).toISOString() })]);
  assert.equal((await f.post({ quickId: SECOND_ID })).status, 200);
  assert.equal(f.rows.length, 2);
});

test('simultaneous same-ID insert winner is returned instead of a false failure', async () => {
  const f = fixture();
  f.options.raceWinner = saved();
  const result = await f.post();
  assert.equal(result.status, 200);
  assert.equal(result.body.data.referralCode, 'SAVED2');
  assert.equal(f.rows.length, 1);
});

for (const op of ['select', 'insert']) {
  test(`${op} storage failure returns retryable 500, never false success`, async () => {
    const f = fixture();
    f.faults.push({ op });
    const failed = await f.post({ attempt: 0 });
    assert.equal(failed.status, 500);
    assert.equal(failed.body.error, 'save_failed');
    await f.flush();
    assert.equal(f.rows.length, 0);
    assert.equal(f.queued.size, 0);
    assert.equal(f.calls.capi.length, 0);
    assert.equal((await f.post({ attempt: 1 })).status, 200);
    assert.equal(f.rows.length, 1);
  });
}

test('phone lookup storage failure cannot bypass deduplication and insert', async () => {
  const f = fixture();
  f.faults.push({ op: 'select', when: (_value, queries) => queries.filter(q => q.op === 'select').length === 2 });
  assert.equal((await f.post()).status, 500);
  assert.equal(f.rows.length, 0);
});

test('referral-code collision retries locally without losing the lead', async () => {
  const f = fixture();
  f.options.collision = 1;
  assert.equal((await f.post()).status, 200);
  assert.equal(f.rows.length, 1);
  assert.equal(f.calls.queries.filter(q => q.op === 'insert').length, 2);
});

test('final save failure reports a synthetic failure; earlier retries do not spam alerts', async () => {
  const f = fixture();
  for (const attempt of [0, 1, 2]) {
    f.faults.push({ op: 'select' });
    assert.equal((await f.post({ attempt })).status, 500);
    await f.flush();
  }
  assert.equal(f.calls.notifications.length, 1);
  assert.equal(f.calls.notifications[0][0].quick, ID);
});

for (const mode of ['false', 'throw']) {
  for (const retryId of [ID, SECOND_ID]) {
    test(`alert enqueue ${mode}: ${retryId === ID ? 'same-ID' : 'same-phone'} retry repairs durable notification without a duplicate lead`, async () => {
      const f = fixture();
      f.options.enqueue = mode;
      const first = await f.post();
      assert.equal(first.status, 200, 'Persisted lead must be acknowledged even when its notification fails');
      await f.flush();
      assert.equal(f.rows.length, 1, 'Lead is persisted even when the notification queue fails');
      assert.equal(f.queued.size, 0);
      f.options.enqueue = 'ok';
      assert.equal((await f.post({ quickId: retryId })).status, 200);
      await f.flush();
      assert.equal(f.rows.length, 1);
      assert.equal(f.queued.size, 1, 'Retry must repair the missing durable alert');
      assert.ok(f.queued.has(`quick:${ID}`));
    });
  }
}

test('all success paths expose the authoritative Meta Lead event ID for browser/server deduplication', async () => {
  const f = fixture();
  const first = await f.post();
  const sameId = await f.post();
  const samePhone = await f.post({ quickId: SECOND_ID });
  await f.flush();
  for (const result of [first, sameId, samePhone]) {
    assert.equal(result.body.data.leadEventId, `${ID}-lead`);
  }
  assert.ok(f.calls.capi.every(event => event.eventId === `${ID}-lead`));
});

test('primary-key race response also exposes the winning saved lead event ID', async () => {
  const f = fixture();
  f.options.raceWinner = saved();
  const result = await f.post();
  assert.equal(result.body.data.leadEventId, `${ID}-lead`);
});

for (const [label, changes] of [
  ['full-form draft', { quick_capture_at: null }],
  ['promoted lead', { status: 'nuevo' }],
  ['discarded lead', { status: 'descartada' }],
  ['opted-out lead', { opted_out_at: new Clock().toISOString() }],
  ['unreachable WhatsApp', { no_whatsapp_at: new Clock().toISOString() }],
  ['declined lead', { declined_at: new Clock().toISOString() }],
  ['stale quick capture', { quick_capture_at: new Date(NOW - 25 * 3600000).toISOString() }],
]) {
  test(`same-ID retry of ${label} does not restart contact or emit a conversion`, async () => {
    const f = fixture([saved(changes)]);
    const result = await f.post();
    assert.equal(result.status, 200);
    assert.equal(result.body.data.leadEventId, null);
    await f.flush();
    assert.equal(f.rows.length, 1);
    assert.equal(f.queued.size, 0);
    assert.equal(f.calls.capi.length, 0);
    assert.equal(f.calls.headsUp.length, 0);
  });
}

test('primary-key race for a different phone never acknowledges the unsaved number', async () => {
  const f = fixture();
  f.options.raceWinner = saved({ whatsapp: '+50769999999' });
  const result = await f.post();
  assert.equal(result.status, 409);
  assert.equal(result.body.error, 'invalid');
  await f.flush();
  assert.equal(f.queued.size, 0);
  assert.equal(f.calls.capi.length, 0);
});

for (const [label, changes] of [
  ['invalid UUID', { quickId: 'not-a-uuid' }],
  ['unknown dial', { countryCode: '999' }],
  ['oversized attribution', { attribution: { fbclid: 'x'.repeat(501) } }],
]) {
  test(`schema rejects ${label} before any storage or external work`, async () => {
    const f = fixture();
    const result = await f.post(changes);
    assert.equal(result.status, 400);
    assert.equal(result.body.error, 'invalid');
    await f.flush();
    assert.equal(f.calls.queries.length, 0);
    assert.equal(f.queued.size, 0);
    assert.equal(f.calls.capi.length, 0);
  });
}

test('heads-up provider failure cannot erase the stored lead or queued team alert', async () => {
  const f = fixture();
  f.options.headsUp = 'throw';
  assert.equal((await f.post()).status, 200);
  await f.flush();
  assert.equal(f.rows.length, 1);
  assert.equal(f.queued.size, 1);
  assert.equal(f.calls.capi.length, 1);
});

test('honeypot and closed-market submissions never create real leads', async () => {
  const f = fixture();
  const bot = await f.post({ website: 'bot.example.invalid' });
  assert.equal(bot.status, 200);
  assert.equal(bot.body.data.leadEventId, null, 'Synthetic honeypot success must not count as a Meta lead');
  const closed = await f.post({ countryCode: '57', whatsappLocal: '3001234567' });
  assert.equal(closed.status, 400);
  assert.equal(closed.body.error, 'market_closed');
  await f.flush();
  assert.equal(f.rows.length, 0);
  assert.equal(f.calls.queries.length, 0);
  assert.equal(f.queued.size, 0);
});
