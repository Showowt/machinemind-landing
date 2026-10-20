// Offline execution of the actual UI handlers/parser. No browser or network.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const ROOT = path.resolve(__dirname, '..');
const compile = source => ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
} }).outputText;
const policyModule = {};
vm.runInNewContext(compile(fs.readFileSync(path.join(ROOT, 'src/lib/web-gratis/expiry-holds.ts'), 'utf8')), {
  exports: policyModule, require() { assert.fail('Policy must stay pure'); },
});
const exported = {};
vm.runInNewContext(compile(fs.readFileSync(path.join(ROOT, 'src/app/admin/web-gratis/reviewed-site-readback.ts'), 'utf8')), {
  exports: exported, require(name) { assert.equal(name, '@/lib/web-gratis/expiry-holds'); return policyModule; },
});
const tree = ts.createSourceFile('ReviewedSiteEditor.tsx', fs.readFileSync(path.join(ROOT, 'src/app/admin/web-gratis/ReviewedSiteEditor.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function find(node, predicate) {
  if (predicate(node)) return node;
  let result; ts.forEachChild(node, child => { result = find(child, predicate); return result; }); return result;
}
function handler(name, context) {
  const node = find(tree, n => ts.isFunctionDeclaration(n) && n.name?.text === name);
  assert.ok(node, `Actual ${name} handler must exist`);
  return vm.runInNewContext(compile(`${node.getText(tree)}\n${name};`), context);
}
const ID = '10000000-0000-4000-8000-000000000001';
const SIGNUP = '20000000-0000-4000-8000-000000000002';
const site = { id: ID, signupId: SIGNUP, version: 0, updatedAt: '2026-10-17T00:00:00Z' };
const base = `/api/web-gratis/admin/sites/${ID}`;
function result(content = null) {
  return { ok: true, status: 200, message: null, data: {
    site: { ...site, previewUrl: 'PRIVATE_BEARER_PREVIEW_DO_NOT_EXPORT', exportUrl: 'PRIVATE_EXPORT_DO_NOT_EXPORT' },
    content, sources: {}, readback: {
      kind: 'web-gratis-admin-readback', schemaVersion: 1, consistency: 'sequential_reads_no_lock',
      startedAt: '2026-10-17T01:00:00Z', capturedAt: '2026-10-17T01:00:01Z',
      site: { id: ID, signup_id: SIGNUP, version: 0, updated_at: site.updatedAt, status: 'draft', content, generation_lease_until: null },
      signup: { id: SIGNUP, referral_code: 'SYN123', terms_accepted_at: null, paid_via: null },
    },
  } };
}
function editor(api = async () => result()) {
  const state = { readback: { json: 'OLD_EVIDENCE' }, draft: 'old draft', savedDraft: 'old saved', version: 9, busy: false, message: null, saved: [] };
  const calls = [];
  const context = { site, base, loadSequence: { current: 0 }, currentSite: { current: site }, reviewedReadback: exported.reviewedReadback,
    siteApi: async (p, init) => { calls.push([p, init.method]); assert.equal(p, base); assert.equal(init.method, 'GET'); assert.equal(Object.keys(init).join(','), 'method'); return api(); },
    setReadback: value => { state.readback = value; }, setDraft: value => { state.draft = value; },
    setSavedDraft: value => { state.savedDraft = value; }, setVersion: value => { state.version = value; },
    setBusy: value => { state.busy = value; }, setMessage: value => { state.message = value; },
    onSaved: value => { state.saved.push(value); },
  };
  return { state, calls, context, load: handler('load', context) };
}
test('null content retains exact current state and clears stale editor text without any write', async () => {
  const e = editor(); await e.load();
  assert.deepEqual(e.calls, [[base, 'GET']]); assert.equal(e.state.draft, ''); assert.equal(e.state.savedDraft, '');
  assert.equal(e.state.version, 0); assert.equal(e.state.saved.length, 1); assert.equal(e.state.busy, false);
  const snapshot = JSON.parse(e.state.readback.json); assert.equal(snapshot.site.content, null);
  assert.equal(snapshot.site.generation_lease_until, null); assert.equal(snapshot.signup.terms_accepted_at, null);
  assert.match(e.state.message, /null.*v0.*solo lectura/);
  assert.doesNotMatch(e.state.readback.json, /PRIVATE_BEARER|PRIVATE_EXPORT/);
});
test('existing content loads without converting snapshot into editable content', async () => {
  const content = { version: 1, business: { name: 'SYNTHETIC ONLY' } };
  const e = editor(async () => result(content)); await e.load();
  assert.deepEqual(JSON.parse(e.state.draft), content); assert.deepEqual(JSON.parse(e.state.savedDraft), content);
  assert.equal(JSON.parse(e.state.readback.json).kind, 'web-gratis-admin-readback');
});
for (const [name, mutate] of [
  ['denied GET', r => { r.ok = false; r.status = 403; r.data = null; }],
  ['missing content key', r => { delete r.data.content; }],
  ['undefined content', r => { r.data.content = undefined; }],
  ['wrong site identity', r => { r.data.site.id = SIGNUP; }],
  ['wrong signup mapping', r => { r.data.site.signupId = ID; }],
  ['missing version', r => { delete r.data.site.version; }],
  ['negative version', r => { r.data.site.version = -1; }],
]) test(`${name} clears prior evidence and never updates the editor or writes`, async () => {
  const r = result(); mutate(r); const e = editor(async () => r); await e.load();
  assert.equal(e.state.readback, null); assert.equal(e.state.draft, 'old draft');
  assert.equal(e.state.saved.length, 0); assert.equal(e.state.busy, false); assert.equal(e.calls.length, 1);
});
test('thrown/blocked normal GET has no fallback request or retained snapshot', async () => {
  const e = editor(async () => { throw new Error('blocked'); }); await e.load();
  assert.equal(e.state.readback, null); assert.equal(e.state.saved.length, 0); assert.equal(e.state.busy, false);
  assert.equal(e.calls.length, 1); assert.match(e.state.message, /No se pudo/);
});
test('older backend can load content but cannot claim complete readback', async () => {
  const r = result(); delete r.data.readback;
  const e = editor(async () => r); await e.load();
  assert.equal(e.state.readback, null); assert.equal(e.state.version, 0);
  assert.match(e.state.message, /No se recibió una instantánea verificable/);
});
test('out-of-order and unmounted load results cannot restore stale evidence', async () => {
  const pending = []; const e = editor(() => new Promise(resolve => pending.push(resolve)));
  const first = e.load(), second = e.load();
  pending[1](result()); await second;
  const retained = e.state.readback.json; pending[0]({ ok: false, message: 'older failure' }); await first;
  assert.equal(e.state.readback.json, retained); assert.equal(e.state.saved.length, 1);
  const third = e.load(); e.context.loadSequence.current++; pending[2](result()); await third;
  assert.equal(e.state.readback, null); assert.equal(e.state.saved.length, 1);
});
test('a board revision received during GET cannot be replaced with the older response', async () => {
  let complete; const e = editor(() => new Promise(resolve => { complete = resolve; }));
  const loading = e.load();
  e.context.currentSite.current = { ...site, version: 1, updatedAt: '2026-10-17T02:00:00Z' };
  complete(result()); await loading;
  assert.equal(e.state.readback, null); assert.equal(e.state.saved.length, 0);
  assert.equal(e.state.draft, 'old draft'); assert.equal(e.state.busy, false);
  assert.match(e.state.message, /otro estado durante la lectura/);
});
for (const [name, mutate] of [
  ['unknown schema', r => { r.schemaVersion = 2; }],
  ['wrong nested site', r => { r.site.id = SIGNUP; }],
  ['wrong nested signup', r => { r.signup.id = ID; }],
  ['changed version', r => { r.site.version = 1; }],
  ['changed revision', r => { r.site.updated_at = '2026-10-18T00:00:00Z'; }],
  ['missing raw content', r => { delete r.site.content; }],
  ['different raw content', r => { r.site.content = {}; }],
  ['raw bearer token', r => { r.site.preview_token = 'PRIVATE'; }],
  ['summary preview capability', r => { r.site.previewUrl = 'PRIVATE'; }],
  ['unexpected top-level field', r => { r.privateToken = 'PRIVATE'; }],
  ['invalid observation time', r => { r.capturedAt = 'not a timestamp'; }],
  ['reversed read interval', r => { r.startedAt = '2026-10-18T00:00:00Z'; }],
]) test(`unusable snapshot: ${name}`, () => {
  const r = result(); mutate(r.data.readback); assert.equal(exported.reviewedReadback(r.data, site), null);
});
test('raw non-null draft lease is preserved rather than treated as authorization', () => {
  const r = result(); r.data.readback.site.generation_lease_until = '2099-01-01T00:00:00Z';
  assert.equal(JSON.parse(exported.reviewedReadback(r.data, site).json).site.generation_lease_until, '2099-01-01T00:00:00Z');
});
test('download is local-only and exports only the readback JSON', () => {
  const value = exported.reviewedReadback(result().data, site); const calls = [];
  const anchor = { click() { calls.push(['click', anchor.download, anchor.href]); } };
  handler('downloadReadback', { visibleReadback: value, busy: false, site,
    Blob: class { constructor(parts, options) { calls.push(['blob', parts, options.type]); } },
    URL: { createObjectURL() { return 'blob:local'; }, revokeObjectURL(value) { calls.push(['revoke', value]); } },
    document: { createElement(tag) { assert.equal(tag, 'a'); return anchor; } },
    siteApi() { assert.fail('Download must not request any endpoint'); },
  })();
  assert.equal(calls[0][1][0], value.json); assert.equal(calls[0][2], 'application/json');
  assert.equal(calls[1][1], `site-readback-${ID}-v0.json`); assert.deepEqual(calls[2], ['revoke', 'blob:local']);
});
test('snapshot is hidden when current site version or revision changed', () => {
  const node = find(tree, n => ts.isVariableDeclaration(n) && n.name.getText(tree) === 'visibleReadback');
  const value = exported.reviewedReadback(result().data, site);
  const evaluate = current => vm.runInNewContext(node.initializer.getText(tree), { readback: value, site: current });
  assert.equal(evaluate(site), value); assert.equal(evaluate({ ...site, version: 1 }), null);
  assert.equal(evaluate({ ...site, updatedAt: 'changed' }), null);
});

function jaResult() {
  const r = result();
  const ja = { ...site, id: '65005b57-c4bd-4837-8420-8fb6c2d9e283', signupId: '1afdbfc5-8703-4ecd-9405-fa2aebb4d708' };
  Object.assign(r.data.site, ja);
  Object.assign(r.data.readback.site, { id: ja.id, signup_id: ja.signupId });
  Object.assign(r.data.readback.signup, { id: ja.signupId, referral_code: 'E67BBT' });
  r.data.readback.operationalPolicy = {
    ...policyModule.getExpiryHoldState(ja.signupId, new Date(r.data.readback.capturedAt)),
    observedAt: r.data.readback.capturedAt,
  };
  return { r, ja };
}
test('JA snapshot accepts the exact optional reviewed policy without changing native fields', () => {
  const { r, ja } = jaResult();
  const before = JSON.stringify(r);
  const value = exported.reviewedReadback(r.data, ja);
  assert.ok(value);
  const decoded = JSON.parse(value.json);
  assert.deepEqual(decoded, r.data.readback);
  assert.equal(decoded.operationalPolicy.phase, 'scheduled');
  assert.equal(decoded.signup.paid_via, null);
  assert.equal(JSON.stringify(r), before);
});
for (const [name, mutate] of [
  ['null policy', r => { r.data.readback.operationalPolicy = null; }],
  ['undefined policy', r => { r.data.readback.operationalPolicy = undefined; }],
  ['array policy', r => { r.data.readback.operationalPolicy = []; }],
  ['wrong referral', r => { r.data.readback.signup.referral_code = 'WRONG'; }],
  ['wrong observed time', r => { r.data.readback.operationalPolicy.observedAt = r.data.readback.startedAt; }],
  ['wrong phase', r => { r.data.readback.operationalPolicy.phase = 'active'; }],
  ['wrong date', r => { r.data.readback.operationalPolicy.startsAt = '2026-10-01T15:00:00.000Z'; }],
  ['coerced boolean', r => { r.data.readback.operationalPolicy.intervalApproved = 'true'; }],
  ['invented activation', r => { r.data.readback.operationalPolicy.actualActivationObservedAt = r.data.readback.capturedAt; }],
  ['omitted evidence', r => { delete r.data.readback.operationalPolicy.clientEvidenceReceiptSha256; }],
  ['nested capability', r => { r.data.readback.operationalPolicy.previewUrl = 'PRIVATE'; }],
  ['policy in extra top-level field', r => { r.data.readback.policy = r.data.readback.operationalPolicy; }],
]) test(`JA snapshot rejects ${name}`, () => {
  const { r, ja } = jaResult(); mutate(r);
  assert.equal(exported.reviewedReadback(r.data, ja), null);
});
test('JA policy cannot be attached to an unrelated tenant snapshot', () => {
  const r = result(); r.data.readback.operationalPolicy = jaResult().r.data.readback.operationalPolicy;
  assert.equal(exported.reviewedReadback(r.data, site), null);
});
