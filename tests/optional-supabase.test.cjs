const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, env, modules, localStorage) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, {
    exports, process: { env }, localStorage, console, Date,
    require: name => {
      assert.ok(Object.hasOwn(modules, name), `Unexpected import ${name}`);
      return modules[name];
    },
  });
  return exports;
}

function fixture(env = {}) {
  const calls = [];
  const writes = [];
  const stored = new Map();
  const localStorage = {
    getItem: key => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value),
    removeItem: key => stored.delete(key),
  };
  let cloud = null;
  const client = { from(table) {
    assert.equal(table, 'espanol_progress');
    const query = {
      select() { return query; }, eq() { return query; },
      single: async () => ({ data: cloud }),
      upsert: payload => { writes.push(payload); return Promise.resolve({ error: null }); },
    };
    return query;
  } };
  const shared = load('src/lib/supabase.ts', env, {
    '@supabase/supabase-js': { createClient: (...args) => { calls.push(args); return client; } },
  }, localStorage);
  const store = load('src/app/espanol/lib/store.ts', env, {
    zustand: require('zustand'),
    'zustand/middleware': require('zustand/middleware'),
    '@/lib/supabase': shared,
  }, localStorage).useEspanolStore;
  return { shared, store, calls, writes, stored, setCloud: data => { cloud = data; } };
}

test('missing configuration does not construct a client or overwrite local progress', async () => {
  const f = fixture();
  f.store.getState().completeMission(7);
  f.store.getState().setMounted(true);
  await f.store.getState().loadFromSupabase();
  f.store.getState().syncToSupabase();
  assert.equal(f.shared.getSupabase(), null);
  assert.equal(f.calls.length, 0);
  assert.equal(f.writes.length, 0);
  assert.equal(f.store.getState().done.includes(7), true);
  assert.equal(f.store.getState().mounted, true);
  assert.equal(JSON.parse(f.stored.get('espanol-os-v2')).state.done.includes(7), true);
});

test('partial configuration remains unavailable instead of constructing an invalid client', () => {
  for (const env of [{ NEXT_PUBLIC_SUPABASE_URL: 'https://example.invalid' }, { NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fake' }]) {
    const f = fixture(env);
    assert.equal(f.shared.getSupabase(), null);
    assert.equal(f.calls.length, 0);
  }
});

test('configured clients are lazy and reused; cloud load and sync still work', async () => {
  const f = fixture({ NEXT_PUBLIC_SUPABASE_URL: 'https://example.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fake' });
  assert.equal(f.calls.length, 0);
  f.setCloud({ done: [3] });
  await f.store.getState().loadFromSupabase();
  assert.equal(f.store.getState().done[0], 3);
  f.store.getState().syncToSupabase();
  f.shared.getSupabase();
  assert.equal(f.calls.length, 1);
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].done[0], 3);
  assert.equal(f.writes[0].id, 'phil_espanol_v2');
});
