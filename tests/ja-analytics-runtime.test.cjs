/* eslint-disable @typescript-eslint/no-require-imports -- Offline VM harness, no network or provider. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const forbidden = () => { throw new Error('No real DB, provider or network access'); };
function load(relative, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, Date, URL, console: { error() {} }, fetch: forbidden,
    require(id) { assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency ${id}`); return dependencies[id]; },
  }, { filename: relative });
  return exports;
}
const contract = load('src/lib/web-gratis/sites/analytics-shared.ts');
const JA = contract.JA_ANALYTICS_SITE_ID, SIGNUP = contract.JA_ANALYTICS_SIGNUP_ID;
const OTHER = '11111111-2222-4333-8444-555555555555';
const NOW = new Date('2026-10-20T01:00:00.000Z');
const P = contract.JA_QA_PATH_PREFIX;
const clone = value => JSON.parse(JSON.stringify(value));

function dbFor(events, failure = null) {
  const reads = [];
  return { reads, from(table) {
    assert.equal(table, 'events');
    const filters = [];
    const read = { table, columns: null, head: false, filters: [], limit: null };
    let desc = false;
    const q = {
      select(columns, options) { read.columns = columns; read.head = options?.head ?? false; read.count = options?.count; return q; },
      eq(c, v) { filters.push(r => r[c] === v); read.filters.push(['eq', c, v]); return q; },
      gte(c, v) { filters.push(r => r[c] >= v); read.filters.push(['gte', c, v]); return q; },
      lte(c, v) { filters.push(r => r[c] <= v); read.filters.push(['lte', c, v]); return q; },
      in(c, values) { filters.push(r => values.includes(r[c])); read.filters.push(['in', c, values]); return q; },
      or(expression) {
        // Apply Postgres LIKE semantics: literal escaped underscores, % wildcard.
        assert.equal(expression, 'path.is.null,path.not.like./\\_\\_mm\\_qa\\_\\_/ja/%');
        const pattern = expression.split('path.not.like.')[1];
        let regex = '^';
        for (let i = 0; i < pattern.length; i++) {
          const char = pattern[i];
          if (char === '\\') regex += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          else regex += char === '%' ? '.*' : char === '_' ? '.' : char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
        regex += '$';
        const matcher = new RegExp(regex);
        filters.push(r => r.path === null || !matcher.test(r.path));
        read.filters.push(['or', expression]); return q;
      },
      order(c, options) { assert.equal(c, 'created_at'); desc = options?.ascending === false; return q; },
      limit(n) { read.limit = n; return q; },
      then(resolve, reject) {
        reads.push(read);
        let rows = events.filter(r => filters.every(f => f(r)));
        if (desc) rows = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
        const count = rows.length;
        if (read.limit !== null) rows = rows.slice(0, read.limit);
        const data = read.head ? null : rows.map(row => Object.fromEntries(read.columns.split(',').map(c => [c, row[c]])));
        const result = failure ? failure(read) : null;
        return Promise.resolve(result ?? { data, count, error: null }).then(resolve, reject);
      },
    }; return q;
  } };
}
function modules(db) {
  const deps = { '../server': { getDb: () => db }, './db': { SITE_EVENTS_TABLE: 'events' }, './analytics-shared': contract };
  const qa = load('src/lib/web-gratis/sites/analytics-qa.ts', deps);
  const summary = load('src/lib/web-gratis/sites/summary.ts', {
    ...deps, './generate': { unreadFiles: () => [] }, './pipeline': { guardLines: () => [] },
    './shared': { publicSiteUrl: slug => `https://${slug}.invalid` },
  });
  return { ...qa, ...summary };
}
const event = (path, kind = 'view', site_id = JA, created_at = '2026-10-20T00:30:00.000Z') => ({
  site_id, path, kind, created_at, ua_hash: 'must-never-leave-server', ip: 'sensitive-fixture', id: 'private-event-id',
});

test('JA business totals exclude literal reserved prefix and preserve null paths and similar real paths', async () => {
  const db = dbFor([event('/'), event(null), event('/ABmmXqaYZ/ja/real'), event('/__mm_qa__/other/real'),
    event(`${P}run1`), event(`${P}run2`), event('/', 'whatsapp_click'), event(`${P}run1`, 'whatsapp_click'),
    event('/', 'view', OTHER), event('/', 'view', JA, '2026-09-01T00:00:00.000Z')]);
  assert.deepEqual(clone(await modules(db).statsFor(JA, NOW)), { views30: 4, whatsapp30: 1 });
  assert.equal(db.reads.length, 2);
  for (const read of db.reads) assert.ok(read.filters.some(f => f[0] === 'eq' && f[1] === 'site_id' && f[2] === JA));
});

test('another tenant keeps legacy totals, including same-looking QA paths, with unchanged query shape', async () => {
  const db = dbFor([event(`${P}run1`, 'view', OTHER), event(null, 'view', OTHER), event('/', 'whatsapp_click', OTHER), event('/')]);
  assert.deepEqual(clone(await modules(db).statsFor(OTHER, NOW)), { views30: 2, whatsapp30: 1 });
  assert.ok(db.reads.every(r => r.filters.every(f => f[0] !== 'or')));
});

test('JA normal counts fail visibly on missing count/error rather than creating false zero', async () => {
  for (const failure of [{ data: null, count: null, error: null }, { data: null, count: null, error: { code: 'fixture' } }]) {
    await assert.rejects(modules(dbFor([], () => failure)).statsFor(JA, NOW));
  }
});

test('QA exact run returns six exact aggregate counts and latest timestamp, no identity/raw rows', async () => {
  const events = [event(`${P}run1`), event(`${P}run1`, 'view', JA, '2026-10-20T00:45:00.000Z'),
    ...contract.SITE_EVENT_KINDS.slice(1).map(k => event(`${P}run1`, k)), event(`${P}run1`, 'unknown'),
    event(`${P}run2`), event(`${P}run1`, 'view', OTHER), event(`${P}run1`, 'view', JA, '2026-10-12T23:59:00.000Z'),
    event(`${P}run1`, 'view', JA, '2026-10-20T02:00:00.000Z')];
  const db = dbFor(events);
  const data = clone(await modules(db).jaQaStatsFor(JA, 'run1', NOW));
  assert.deepEqual(data.counts, { view: 2, whatsapp_click: 1, call_click: 1, map_click: 1, social_click: 1, email_click: 1 });
  assert.equal(data.latestAt, '2026-10-20T00:45:00.000Z');
  assert.equal(data.windowStart, '2026-10-13T01:00:00.000Z');
  assert.equal(data.windowEnd, NOW.toISOString());
  assert.equal(data.synthetic, true);
  assert.equal(data.excludedFromBusinessTotals, true);
  assert.equal(db.reads.length, 7);
  for (const read of db.reads) {
    assert.ok(read.filters.some(f => f[0] === 'eq' && f[1] === 'site_id' && f[2] === JA));
    assert.ok(read.filters.some(f => f[0] === 'eq' && f[1] === 'path' && f[2] === `${P}run1`));
    assert.ok(read.head || (read.columns === 'created_at' && read.limit === 1));
  }
  assert.ok(!/ua_hash|sensitive|private-event|"ip"|"rows"/.test(JSON.stringify(data)));
});

test('QA exact counts do not truncate at 1,000 event rows', async () => {
  const db = dbFor(Array.from({ length: 1500 }, () => event(`${P}busy-run`)));
  const data = await modules(db).jaQaStatsFor(JA, 'busy-run', NOW);
  assert.equal(data.counts.view, 1500);
  assert.equal(db.reads.filter(r => !r.head).length, 1);
});

test('QA zero is reported only after successful count and latest reads', async () => {
  const result = await modules(dbFor([])).jaQaStatsFor(JA, 'empty-run', NOW);
  assert.ok(Object.values(result.counts).every(n => n === 0));
  assert.equal(result.latestAt, null);
  for (const failure of [() => ({ count: null, data: null, error: null }), read => !read.head ? { count: null, data: null, error: null } : null,
    () => ({ count: null, data: null, error: { message: 'db unavailable' } })]) {
    await assert.rejects(modules(dbFor([], failure)).jaQaStatsFor(JA, 'empty-run', NOW));
  }
});

test('invalid runs and other sites fail before any analytics query', async () => {
  const db = dbFor([]);
  const mod = modules(db);
  for (const run of ['', 'A', '../private', 'a/b', 'a?secret=1', 'a'.repeat(41), '-bad', 'a\n', 'a\r', 'a\r\n']) await assert.rejects(mod.jaQaStatsFor(JA, run, NOW));
  await assert.rejects(mod.jaQaStatsFor(OTHER, 'valid-run', NOW));
  assert.equal(db.reads.length, 0);
});

function routeHarness({ denied = false, site = { id: JA, signup_id: SIGNUP }, statsError = false } = {}) {
  const calls = [];
  const route = load('src/app/api/web-gratis/admin/sites/[id]/analytics-qa/route.ts', {
    '@/lib/web-gratis/admin': { requireAdmin: async () => { calls.push('auth'); return denied ? { status: 401 } : null; } },
    '@/lib/web-gratis/http': { ok: (data, init) => ({ status: 200, data, headers: init?.headers }), fail: (status, error, message) => ({ status, error, message }) },
    '@/lib/web-gratis/sites/pipeline': { getSite: async () => { calls.push('site'); return site; } },
    '@/lib/web-gratis/sites/analytics-shared': contract,
    '@/lib/web-gratis/sites/analytics-qa': { jaQaStatsFor: async (siteId, runId) => { calls.push(['qa', siteId, runId]); if (statsError) throw new Error('sensitive-db-detail'); return { siteId, runId }; } },
  });
  return { calls, get: (id = JA, run = 'run1') => route.GET({ url: `https://fixture.invalid/api?runId=${encodeURIComponent(run)}` }, { params: Promise.resolve({ id }) }) };
}

test('QA route authenticates before lookup and blocks mismatched site/signup/invalid run', async () => {
  const unauth = routeHarness({ denied: true });
  assert.equal((await unauth.get()).status, 401); assert.deepEqual(unauth.calls, ['auth']);
  for (const site of [null, { id: OTHER, signup_id: SIGNUP }, { id: JA, signup_id: OTHER }]) {
    const h = routeHarness({ site }); assert.equal((await h.get()).status, 404); assert.deepEqual(h.calls, ['auth', 'site']);
  }
  const other = routeHarness(); assert.equal((await other.get(OTHER)).status, 404); assert.deepEqual(other.calls, ['auth']);
  const invalid = routeHarness(); assert.equal((await invalid.get(JA, 'bad/run')).status, 400); assert.deepEqual(invalid.calls, ['auth']);
});

test('QA successful route is private/no-store and failure does not reveal error details or fake zero', async () => {
  const h = routeHarness(); const response = await h.get();
  assert.equal(response.status, 200); assert.equal(response.headers['Cache-Control'], 'private, no-store');
  assert.deepEqual(h.calls, ['auth', 'site', ['qa', JA, 'run1']]);
  const failed = await routeHarness({ statsError: true }).get();
  assert.equal(failed.status, 500); assert.ok(!JSON.stringify(failed).includes('sensitive-db-detail'));
  assert.ok(!Object.hasOwn(failed, 'data')); assert.match(failed.message, /No equivale a cero/);
});
