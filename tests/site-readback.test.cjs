// Real helper + GET handler, entirely offline. All database mutation methods,
// global fetch and unrelated dependencies fail immediately.
/* eslint-disable @typescript-eslint/no-require-imports -- Offline CommonJS harness follows the existing test suite. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const SITE = '11111111-1111-4111-8111-111111111111';
const SIGNUP = '22222222-2222-4222-8222-222222222222';
const OTHER = '33333333-3333-4333-8333-333333333333';
const NOW = '2026-10-17T22:30:00.000Z';
const START = '2026-10-17T22:29:59.000Z';
const clone = value => JSON.parse(JSON.stringify(value));
class Clock extends Date {
  constructor(...args) { super(...(args.length ? args : [NOW])); }
  static now() { return Date.parse(NOW); }
}

function load(file, modules) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports, Date: Clock, Request, Response, URL,
    console: { error() {} },
    fetch: () => { throw new Error('Network is prohibited in readback tests'); },
    require: name => {
      assert.ok(Object.hasOwn(modules, name), `Unexpected dependency: ${name}`);
      return modules[name];
    },
  }, { filename: file });
  return exports;
}

function site() {
  return {
    id: SITE, signup_id: SIGNUP, slug: 'review-fixture', status: 'draft', version: 0,
    content: null, sources: { notes: 'Existing internal rollback source' }, instructions: null,
    generation_lease_until: null, generation_attempts: 0, generation_error: null,
    generated_at: null, published_at: null, paused_at: null, custom_domain: null,
    domain_status: null, created_at: START, updated_at: START,
    preview_token: 'SECRET_PREVIEW_TOKEN', previewUrl: 'SECRET_PREVIEW_URL',
    exportUrl: 'SECRET_EXPORT_URL', unrelated: 'SECRET_SITE_EXTRA',
  };
}

function harness() {
  const calls = [], mutationAttempts = [];
  let signup = null, foundSite = site(), denied = false, readError = null;
  const db = { from(table) {
    assert.equal(table, 'web_gratis_signups');
    calls.push({ op: 'from', table });
    const query = {
      select(columns) { calls.push({ op: 'select', columns }); return query; },
      eq(column, value) { calls.push({ op: 'eq', column, value }); return query; },
      async maybeSingle() {
        calls.push({ op: 'maybeSingle' });
        return { data: signup ? clone(signup) : null, error: readError };
      },
    };
    for (const operation of ['insert', 'update', 'upsert', 'delete', 'rpc']) {
      query[operation] = () => { mutationAttempts.push(operation); throw new Error(`Forbidden write: ${operation}`); };
    }
    return query;
  }, rpc() { mutationAttempts.push('rpc'); throw new Error('Forbidden RPC'); } };
  const helper = load('src/lib/web-gratis/sites/readback.ts', {
    zod: require('zod'), '../server': { getDb: () => db, SIGNUPS_TABLE: 'web_gratis_signups' },
    '../expiry-holds': load('src/lib/web-gratis/expiry-holds.ts', {}),
  });
  signup = Object.fromEntries(helper.READBACK_SIGNUP_FIELDS.map(key => [key, null]));
  Object.assign(signup, {
    id: SIGNUP, referral_code: 'ABCDEF', business_name: 'Review fixture', business_type: 'Consulta',
    city: 'Ciudad de Panamá', country: 'PA', whatsapp: '+50760000001', services: ['Consulta'],
    status: 'borrador', step: 1, lang: 'es', logo_paths: [], photo_paths: [], document_paths: [],
    call_attempts: 0, created_at: START, updated_at: START,
    notes: 'SECRET_NOTES', extra_notes: 'SECRET_EXTRA_NOTES', follow_up_note: 'SECRET_FOLLOWUP',
    opt_out_reason: 'SECRET_OPTOUT_TEXT', user_agent: 'SECRET_USER_AGENT', ip_hash: 'SECRET_IP_HASH',
    utm_source: 'SECRET_UTM', utm_medium: 'SECRET_MEDIUM', fbclid: 'SECRET_FBCLID',
    landing_url: 'SECRET_LANDING', authorization: 'SECRET_AUTH', unrelated: 'SECRET_SIGNUP_EXTRA',
  });
  const response = (data, status = 200, init) => new Response(JSON.stringify(data), { ...init, status });
  const denyWrite = () => { mutationAttempts.push('handler-write'); throw new Error('Forbidden handler write'); };
  const route = load('src/app/api/web-gratis/admin/sites/[id]/route.ts', {
    zod: require('zod'),
    '@/lib/web-gratis/admin': { requireAdmin: async () => {
      calls.push({ op: 'requireAdmin' });
      return denied ? response({ data: null, error: 'invalid', message: 'unauthorized' }, 401) : null;
    } },
    '@/lib/web-gratis/http': {
      ok: (data, init) => response({ data, error: null, message: null }, 200, init),
      fail: (status, error, message = null) => response({ data: null, error, message }, status),
    },
    '@/lib/web-gratis/sites/pipeline': { getSite: async id => {
      calls.push({ op: 'getSite', id }); return foundSite ? clone(foundSite) : null;
    } },
    '@/lib/web-gratis/sites/readback': helper,
    '@/lib/web-gratis/sites/publish': { changeSlug: denyWrite, editSiteContent: denyWrite, saveInstructions: denyWrite },
    '@/lib/web-gratis/sites/summary': {
      statsFor: async id => { calls.push({ op: 'statsFor', id }); return { views30: 1, whatsapp30: 0 }; },
      toSummary: row => ({ id: row.id, signupId: row.signup_id, status: row.status, version: row.version, previewUrl: 'EXISTING_SUMMARY_TOKEN_URL' }),
    },
  });
  return {
    helper, route, calls, mutationAttempts,
    get signup() { return signup; }, set signup(value) { signup = value; },
    get site() { return foundSite; }, set site(value) { foundSite = value; },
    deny() { denied = true; }, failRead() { readError = new Error('Synthetic DB error'); },
    read() { return helper.readSiteReadback(foundSite, new Date(START)); },
    get(id = SITE) { return route.GET(new Request(`https://fixture.invalid/api/web-gratis/admin/sites/${id}`), { params: Promise.resolve({ id }) }); },
  };
}

test('readback selects only the linked signup and returns raw allowlisted observations with explicit null', async () => {
  const h = harness(), before = clone({ site: h.site, signup: h.signup });
  const result = await h.read();
  assert.equal(result.kind, 'web-gratis-admin-readback');
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.startedAt, START);
  assert.equal(result.capturedAt, NOW);
  assert.equal(result.consistency, 'sequential_reads_no_lock');
  assert.equal(result.site.content, null);
  assert.equal(result.site.generation_lease_until, null);
  assert.equal(result.signup.terms_accepted_at, null);
  assert.equal(result.signup.stripe_subscription_id, null);
  assert.deepEqual(clone(Object.keys(result.site)), clone(h.helper.READBACK_SITE_FIELDS));
  assert.deepEqual(clone(Object.keys(result.signup)), clone(h.helper.READBACK_SIGNUP_FIELDS));
  assert.deepEqual(h.calls, [
    { op: 'from', table: 'web_gratis_signups' },
    { op: 'select', columns: h.helper.READBACK_SIGNUP_FIELDS.join(',') },
    { op: 'eq', column: 'id', value: SIGNUP }, { op: 'maybeSingle' },
  ]);
  assert.ok(!JSON.stringify(result).includes('SECRET_'));
  assert.deepEqual(clone({ site: h.site, signup: h.signup }), before);
  assert.deepEqual(h.mutationAttempts, []);
});

test('raw active lease remains visible even when status is draft', async () => {
  const h = harness(); h.site.generation_lease_until = '2026-10-17T23:00:00.000Z';
  const result = await h.read();
  assert.equal(result.site.status, 'draft');
  assert.equal(result.site.generation_lease_until, h.site.generation_lease_until);
});

for (const status of ['draft', 'generating', 'published', 'paused', 'failed', 'archived']) {
  test(`readback observes ${status} without authorizing or changing state`, async () => {
    const h = harness(); h.site.status = status; h.site.version = 7;
    h.site.content = { preserved: 'Existing JSON, not a new import' };
    h.signup.status = 'activa'; h.signup.activated_at = START; h.signup.paid_via = 'stripe';
    const result = await h.read();
    assert.equal(result.site.status, status);
    assert.equal(result.site.version, 7);
    assert.deepEqual(clone(result.site.content), h.site.content);
    assert.equal(result.signup.activated_at, START);
    assert.equal(result.signup.paid_via, 'stripe');
    assert.deepEqual(h.mutationAttempts, []);
  });
}

const fields = harness().helper;
for (const key of fields.READBACK_SITE_FIELDS) {
  test(`missing site.${key} fails closed rather than fabricating a null`, async () => {
    const h = harness(); delete h.site[key];
    await assert.rejects(h.read(), /Readback field unavailable/);
    assert.equal(h.calls.length, 0);
  });
}
for (const key of fields.READBACK_SIGNUP_FIELDS) {
  test(`missing signup.${key} fails closed rather than fabricating a null`, async () => {
    const h = harness(); delete h.signup[key];
    await assert.rejects(h.read(), /Readback (field|linked signup) unavailable/);
    assert.deepEqual(h.mutationAttempts, []);
  });
}

test('explicit undefined is rejected and persisted country null is not derived from phone', async () => {
  const h = harness(); h.signup.country = null;
  assert.equal((await h.read()).signup.country, null);
  h.site.content = undefined;
  await assert.rejects(h.read(), /Readback field unavailable/);
});

test('missing, wrong and malformed identities or signup errors fail closed', async () => {
  for (const scenario of ['missing', 'wrong', 'bad-site', 'bad-signup', 'empty-referral', 'query']) {
    const h = harness();
    if (scenario === 'missing') h.signup = null;
    if (scenario === 'wrong') h.signup.id = OTHER;
    if (scenario === 'bad-site') h.site.id = 'bad';
    if (scenario === 'bad-signup') h.site.signup_id = 'bad';
    if (scenario === 'empty-referral') h.signup.referral_code = '';
    if (scenario === 'query') h.failRead();
    await assert.rejects(h.read(), /Readback/);
    assert.deepEqual(h.mutationAttempts, []);
  }
});

test('invalid start time and backwards observation clock fail closed', async () => {
  const h = harness();
  await assert.rejects(h.helper.readSiteReadback(h.site, new Date('invalid')), /observation time/);
  await assert.rejects(h.helper.readSiteReadback(h.site, new Date('2026-10-18T00:00:00Z')), /clock changed/);
});

test('actual GET adds readback while retaining existing data, private no-store and no mutation', async () => {
  const h = harness(), res = await h.get(), body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(Object.keys(body.data), ['site', 'content', 'sources', 'readback']);
  assert.equal(body.data.content, null);
  assert.equal(body.data.readback.site.content, null);
  assert.equal(body.data.readback.site.id, SITE);
  assert.equal(body.data.readback.startedAt, NOW);
  assert.ok(!JSON.stringify(body.data.readback).includes('SECRET_'));
  assert.ok(!JSON.stringify(body.data.readback).includes('EXISTING_SUMMARY_TOKEN_URL'));
  assert.equal(body.data.site.previewUrl, 'EXISTING_SUMMARY_TOKEN_URL');
  assert.equal(h.calls[0].op, 'requireAdmin');
  assert.deepEqual(h.calls[1], { op: 'getSite', id: SITE });
  assert.deepEqual(h.mutationAttempts, []);
});

test('actual GET denies auth before any persistence read', async () => {
  const h = harness(); h.deny();
  const res = await h.get();
  assert.equal(res.status, 401);
  assert.deepEqual(h.calls, [{ op: 'requireAdmin' }]);
  assert.equal((await res.json()).data, null);
});

test('actual GET rejects invalid ID without persistence reads', async () => {
  const h = harness(), res = await h.get('invalid');
  assert.equal(res.status, 400);
  assert.deepEqual(h.calls, [{ op: 'requireAdmin' }]);
  assert.equal((await res.json()).data, null);
});

test('actual GET returns no readback for absent site', async () => {
  const h = harness(); h.site = null;
  const res = await h.get();
  assert.equal(res.status, 404);
  assert.equal((await res.json()).data, null);
  assert.equal(h.calls.filter(call => call.op === 'from').length, 0);
});

for (const failure of ['wrong-site', 'wrong-signup', 'missing-signup', 'missing-content', 'missing-consent', 'query-error']) {
  test(`actual GET emits no partial snapshot on ${failure}`, async () => {
    const h = harness();
    if (failure === 'wrong-site') h.site.id = OTHER;
    if (failure === 'wrong-signup') h.signup.id = OTHER;
    if (failure === 'missing-signup') h.signup = null;
    if (failure === 'missing-content') delete h.site.content;
    if (failure === 'missing-consent') delete h.signup.terms_accepted_at;
    if (failure === 'query-error') h.failRead();
    const res = await h.get(), body = await res.json();
    assert.equal(res.status, 500);
    assert.equal(body.data, null);
    assert.equal(body.error, 'server_error');
    assert.deepEqual(h.mutationAttempts, []);
  });
}

test('actual GET observes published content without cache invalidation or billing operations', async () => {
  const h = harness(); h.site.status = 'published'; h.site.published_at = START;
  h.site.content = { original: 'Persisted content' };
  const res = await h.get(), body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.data.readback.site.published_at, START);
  assert.deepEqual(body.data.content, h.site.content);
  assert.deepEqual(h.calls.filter(call => call.op === 'statsFor'), [{ op: 'statsFor', id: SITE }]);
  assert.deepEqual(h.mutationAttempts, []);
});


test('JA readback separates source policy from untouched persisted lifecycle fields', async () => {
  const h = harness();
  h.site.id = '65005b57-c4bd-4837-8420-8fb6c2d9e283';
  h.site.signup_id = h.signup.id = '1afdbfc5-8703-4ecd-9405-fa2aebb4d708';
  h.signup.referral_code = 'E67BBT';
  h.signup.free_until = '2026-10-26';
  h.signup.delivered_at = '2026-09-26T18:50:30.114+00:00';
  const before = clone({ site: h.site, signup: h.signup });
  const result = await h.read();
  assert.equal(result.operationalPolicy.storage, 'reviewed_source_policy');
  assert.equal(result.operationalPolicy.phase, 'awaiting_dates');
  assert.equal(result.operationalPolicy.observedAt, NOW);
  assert.equal(result.operationalPolicy.startsAt, null);
  assert.equal(result.operationalPolicy.endsAt, null);
  assert.equal(result.operationalPolicy.intervalApproved, false);
  assert.equal(result.operationalPolicy.doesNotActivateBilling, true);
  assert.equal(result.operationalPolicy.legacyAutomaticPauseHeld, true);
  assert.equal(result.signup.free_until, '2026-10-26');
  assert.equal(result.signup.activated_at, null);
  assert.deepEqual(clone({ site: h.site, signup: h.signup }), before);
  assert.deepEqual(h.mutationAttempts, []);
});

for (const wrong of ['site', 'referral']) test(`JA policy refuses wrong ${wrong} binding`, async () => {
  const h = harness();
  h.site.id = wrong === 'site' ? SITE : '65005b57-c4bd-4837-8420-8fb6c2d9e283';
  h.site.signup_id = h.signup.id = '1afdbfc5-8703-4ecd-9405-fa2aebb4d708';
  h.signup.referral_code = wrong === 'referral' ? 'ABCDEF' : 'E67BBT';
  await assert.rejects(h.read(), /identity mismatch/);
  assert.deepEqual(h.mutationAttempts, []);
});

test('unrelated tenant readback has no policy field or new behavior', async () => {
  const h = harness();
  assert.equal(Object.hasOwn(await h.read(), 'operationalPolicy'), false);
});
