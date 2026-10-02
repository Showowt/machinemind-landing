// Offline execution of the real publish handler and route. Every DB/provider
// boundary is an in-memory fixture; environment files and live services are absent.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const SITE_ID = '00000000-0000-4000-8000-000000000001';
const SIGNUP_ID = '00000000-0000-4000-8000-000000000002';
const OTHER_ID = '00000000-0000-4000-8000-000000000003';
const NOW = new Date('2026-10-02T12:00:00Z');
const SITES = 'web_gratis_sites';
const ADMIN_TOKEN = 'offline-admin-fixture';
const VERCEL = { token: 'offline-vercel-fixture', teamId: 'team_existing', projectId: 'prj_existing' };
const MM = { url: 'https://renderer.example.invalid', revalidateSecret: 'offline-purge-fixture' };
const MODE = { mode: 'site_only', expectedVersion: 2 };
const plain = value => JSON.parse(JSON.stringify(value));
const clone = value => structuredClone(value);

function load(file, modules = {}, env = {}) {
  const exports = {};
  const filename = path.join(__dirname, '..', file);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(source, {
    exports, process: { env }, console: { error() {} }, Date, Buffer,
    URL, Request, Response, AbortSignal, structuredClone,
    // Auth's wrong-key delay is deterministic and immediate only in this fixture.
    setTimeout: callback => { callback(); return 0; },
    fetch: async () => { throw new Error('Unexpected global network request'); },
    require: name => {
      assert.ok(Object.hasOwn(modules, name), `Unexpected dependency: ${name}`);
      return modules[name];
    },
  }, { filename });
  return exports;
}

const schema = load('src/lib/web-gratis/site-content.ts', { zod: require('zod') });
const shared = load('src/lib/web-gratis/sites/shared.ts', { '../site-content': schema });
const contrast = load('src/lib/web-gratis/sites/contrast.ts');
const vercel = load('src/lib/web-gratis/sites/vercel.ts');
const config = load('src/lib/web-gratis/config.ts');
const templates = load('src/lib/web-gratis/templates.ts', { './config': config });
const http = load('src/lib/web-gratis/http.ts', { 'next/server': { NextResponse: Response } });

function content() {
  return {
    version: 1, lang: 'es',
    business: { name: 'Negocio de prueba', tagline: 'Texto verificado', type: 'Servicios', city: 'Ciudad', country: 'SV' },
    seo: { title: 'Negocio de prueba', description: 'Descripción verificada.', keywords: [] },
    hero: { eyebrow: 'Servicios', headline: 'Negocio de prueba', subheadline: 'Texto verificado.', ctaLabel: 'Contactar', image: null },
    about: { title: 'Nosotros', body: ['Información verificada.'], highlights: [] },
    services: { title: 'Servicios', intro: null, items: [{ name: 'Servicio verificado', description: null, price: null, image: null }] },
    gallery: [], differentiators: null, hours: null, location: null,
    contact: { title: 'Contacto', body: 'Escríbanos.', whatsapp: '50370000000', whatsappMessage: 'Hola', email: null, instagram: null, facebook: null, website: null },
    faq: [],
    theme: { palette: { bg: '#ffffff', surface: '#eeeeee', text: '#111111', muted: '#333333', primary: '#111111', primaryText: '#ffffff', accent: '#333333' }, mode: 'light', font: 'sans', vertical: 'services', mood: 'Sencillo', logo: null },
    footer: { credit: 'Hecho por MachineMind', referralUrl: 'https://machinemindconsulting.com/web' },
  };
}

function fixture({ site = {}, signup = {}, adminEnv = { WEB_GRATIS_ADMIN_TOKEN: ADMIN_TOKEN } } = {}) {
  const rows = [{
    id: SITE_ID, signup_id: SIGNUP_ID, slug: 'negocio-fixture', status: 'draft', version: 2,
    content: content(), published_at: null, paused_at: null, preview_token: 'fixture-preview-token',
    updated_at: '2026-10-01T12:00:00Z', sources: { privateNote: 'Do not publish' }, ...site,
  }, { id: OTHER_ID, signup_id: 'another-signup', slug: 'another-tenant', status: 'published', version: 8, content: content(), published_at: '2026-09-01T12:00:00Z' }];
  const owner = {
    id: SIGNUP_ID, status: 'en_construccion', terms_accepted_at: '2026-10-01T10:00:00Z',
    business_name: 'Negocio de prueba', city: 'Ciudad', country: 'SV', whatsapp: '+50370000000',
    site_url: null, delivered_at: null, free_until: null, activated_at: null, paid_via: null,
    paid_through: null, updated_at: '2026-10-01T11:00:00Z', last_payment_at: null,
    rung2_interest_at: null, declined_at: null, ...signup,
  };
  const calls = { fetch: [], writes: [], delivery: [], alerts: [], signupReads: [], siteReads: [] };
  const f = { rows, owner, calls, missingSite: false, missingSignup: false, beforeWrite: null,
    afterAttach: null, addStatus: 200, configStatus: 200, verified: true, misconfigured: false,
    cacheStatus: 200, failWrite: false, vercelEnv: VERCEL };
  const db = { from(table) {
    // Proves this path cannot write messages, outbox, signups, payments, or another table.
    assert.equal(table, SITES, `Forbidden table access: ${table}`);
    const filters = [];
    let value;
    const q = {
      update(v) { value = plain(v); return q; },
      eq(k, v) { filters.push(r => r[k] === v); return q; },
      in(k, v) { filters.push(r => v.includes(r[k])); return q; },
      select() { return q; },
      async maybeSingle() {
        if (f.beforeWrite) { const cb = f.beforeWrite; f.beforeWrite = null; cb(); }
        if (f.failWrite) return { data: null, error: new Error('Offline write failure') };
        const matches = rows.filter(r => filters.every(match => match(r)));
        assert.ok(matches.length <= 1, 'Tenant write must never match multiple records');
        if (!matches.length) return { data: null, error: null };
        const row = matches[0];
        calls.writes.push({ table, id: row.id, value });
        Object.assign(row, value, { updated_at: new Date(NOW.getTime() + calls.writes.length).toISOString() });
        return { data: clone(row), error: null };
      },
    };
    return q;
  } };
  const server = {
    getDb: () => db, BUILDING_STATUSES: ['nuevo', 'en_construccion'], LIVE_FREE_STATUSES: ['entregada', 'compartida'],
    svDate: d => new Date(d.getTime() - 6 * 3600000).toISOString().slice(0, 10),
  };
  const dbModule = { SITES_TABLE: SITES, missingVercelEnv: () => ['VERCEL_TOKEN'],
    previewUrl: slug => `${MM.url}/p/${slug}?t=fixture`, mmSitesEnv: () => MM, vercelEnv: () => f.vercelEnv };
  const renderer = load('src/lib/web-gratis/sites/mm-sites.ts', { '../server': server, './db': dbModule });
  const doFetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const body = init.body ? JSON.parse(init.body) : null;
    calls.fetch.push({ url: String(url), method: init.method, body, headers: init.headers });
    if (String(url) === `${MM.url}/api/revalidate`) return new Response(null, { status: f.cacheStatus });
    assert.equal(url.origin, 'https://api.vercel.com', 'No model, message or other provider calls');
    assert.equal(url.searchParams.get('teamId'), VERCEL.teamId);
    const domain = `${rows[0].slug}.machinemindconsulting.com`;
    if (url.pathname === `/v10/projects/${VERCEL.projectId}/domains`) {
      assert.equal(init.method, 'POST');
      assert.equal(body.name, domain);
      if (f.afterAttach) { const cb = f.afterAttach; f.afterAttach = null; cb(); }
      return Response.json({ error: { code: f.addStatus === 409 ? 'already_in_use' : 'unauthorized', message: 'fixture' } }, { status: f.addStatus });
    }
    if (url.pathname.startsWith(`/v9/projects/${VERCEL.projectId}/domains/`)) {
      return Response.json({ verified: f.verified, verification: [{ type: 'TXT', domain: '_vercel.fixture', value: 'fixture' }] });
    }
    if (url.pathname.startsWith('/v6/domains/') && url.pathname.endsWith('/config')) {
      return Response.json({ misconfigured: f.misconfigured }, { status: f.configStatus });
    }
    throw new Error(`Unexpected Vercel route: ${url.pathname}`);
  };
  const pipeline = {
    getSite: async id => { calls.siteReads.push(id); return f.missingSite ? null : clone(rows.find(r => r.id === id) ?? null); },
    getSignup: async id => { calls.signupReads.push(id); assert.equal(id, SIGNUP_ID); return f.missingSignup ? null : clone(owner); },
    slugTaken: async () => { throw new Error('Unexpected slug mutation'); },
  };
  const markDelivered = async (id, body) => {
    calls.delivery.push({ id, body: plain(body) });
    assert.equal(id, SIGNUP_ID);
    owner.site_url = body.siteUrl;
    if (body.status) { owner.status = body.status; owner.delivered_at = NOW.toISOString(); owner.free_until = '2026-11-01'; }
    return { ok: true, message: 'ok' };
  };
  const deps = { now: () => NOW, fetch: doFetch, vercel: f.vercelEnv, mm: MM,
    markDelivered, alert: async (...args) => { calls.alerts.push(plain(args)); return true; } };
  pipeline.defaultSitesDeps = () => ({ ...deps });
  const publish = load('src/lib/web-gratis/sites/publish.ts', {
    '../site-content': schema, '../server': server, './contrast': contrast, './db': dbModule,
    './mm-sites': renderer, './pipeline': pipeline, './shared': shared, './vercel': vercel,
    '../notify': { countryLabel: () => 'El Salvador', sitePublishedMessage: info => info },
  });
  const admin = load('src/lib/web-gratis/admin.ts', { crypto: require('node:crypto'), './config': config, './http': http }, adminEnv);
  const route = load('src/app/api/web-gratis/admin/sites/[id]/publish/route.ts', {
    zod: require('zod'), '@/lib/web-gratis/admin': admin, '@/lib/web-gratis/http': http,
    '@/lib/web-gratis/sites/db': dbModule, '@/lib/web-gratis/sites/pipeline': pipeline,
    '@/lib/web-gratis/sites/publish': publish,
    '@/lib/web-gratis/sites/summary': { toSummary: row => ({ id: row.id, slug: row.slug, version: row.version, status: row.status, publishedAt: row.published_at }) },
    '@/app/api/web-gratis/admin/signups/[id]/route': { PATCH: async (req, { params }) => {
      assert.equal(req.headers.get('authorization'), `Bearer ${ADMIN_TOKEN}`);
      const result = await markDelivered((await params).id, await req.json());
      return http.ok(result);
    } },
  });
  const wa = load('src/lib/web-gratis/whatsapp.ts', {
    crypto: require('node:crypto'), './config': config, './templates': templates, './server': server,
    './outbox': { enqueueSystem: () => { throw new Error('No outbox allowed'); } },
    './rewired': { sendViaRewired: () => { throw new Error('No provider sends allowed'); } },
    './sites/mm-sites': renderer,
  });
  return Object.assign(f, { api: publish, deps, wa, async request(body, { id = SITE_ID, token = ADMIN_TOKEN } = {}) {
    return route.POST(new Request(`https://authoring.example.invalid/api/web-gratis/admin/sites/${id}/publish`, {
      method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {},
      ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
    }), { params: Promise.resolve({ id }) });
  } });
}

function noEffects(f, before) {
  assert.deepEqual(f.owner, before);
  assert.equal(f.calls.delivery.length, 0);
  assert.equal(f.calls.alerts.length, 0);
}

for (const signup of [ {}, { status: 'nuevo' }, { terms_accepted_at: null },
  { status: 'borrador', terms_accepted_at: null, submitted_at: null }, { status: 'borrador' }, { activated_at: '2026-09-30T10:00:00Z', paid_via: 'stripe', paid_through: '2026-10-30' }, { status: 'entregada', site_url: 'https://previous.example.invalid', delivered_at: '2026-09-30T10:00:00Z', free_until: '2026-10-30' } ]) {
  test(`site_only publishes one tenant without signup/send effects: ${JSON.stringify(signup)}`, async () => {
    const f = fixture({ signup });
    const owner = clone(f.owner), other = clone(f.rows[1]);
    const result = await f.api.publishSite(SITE_ID, f.deps, MODE);
    assert.equal(result.ok, true);
    assert.equal(result.delivered, 'skipped');
    assert.equal(result.site.status, 'published');
    assert.equal(result.site.published_at, NOW.toISOString());
    assert.equal(result.site.version, 2);
    noEffects(f, owner);
    assert.deepEqual(f.rows[1], other);
    assert.deepEqual(f.calls.writes, [{ table: SITES, id: SITE_ID, value: { status: 'published', published_at: NOW.toISOString(), paused_at: null } }]);
    const purges = f.calls.fetch.filter(c => c.url === `${MM.url}/api/revalidate`);
    assert.equal(purges.length, 1);
    assert.deepEqual(purges[0].body, { slug: 'negocio-fixture' });
    assert.equal(purges[0].headers['x-revalidate-secret'], MM.revalidateSecret);
    assert.equal(f.calls.fetch.filter(c => c.url.includes('/v10/projects/prj_existing/domains')).length, 1);
  });
}

test('repeated site_only publication preserves first timestamp and never completes delivery', async () => {
  const f = fixture();
  const owner = clone(f.owner);
  await f.api.publishSite(SITE_ID, f.deps, MODE);
  f.deps.now = () => new Date('2026-10-03T12:00:00Z');
  f.addStatus = 409;
  const again = await f.api.publishSite(SITE_ID, f.deps, MODE);
  assert.equal(again.ok, true);
  assert.equal(again.delivered, 'skipped');
  assert.equal(f.rows[0].published_at, NOW.toISOString());
  noEffects(f, owner);
});

test('stale reviewed version refuses before any domain or content writes', async () => {
  const f = fixture();
  const result = await f.api.publishSite(SITE_ID, f.deps, { ...MODE, expectedVersion: 1 });
  assert.equal(result.status, 409);
  assert.equal(f.calls.fetch.length, 0);
  assert.equal(f.calls.writes.length, 0);
});

for (const [name, change] of [
  ['content version', r => { r.version++; }],
  ['slug', r => { r.slug = 'changed-slug'; r.updated_at = NOW.toISOString(); }],
  ['pause', r => { r.status = 'paused'; r.updated_at = NOW.toISOString(); }],
  ['first publication', r => { r.status = 'published'; r.published_at = '2026-10-02T11:59:00Z'; r.updated_at = NOW.toISOString(); }],
]) {
  test(`concurrent ${name} change fails CAS without overwrite, cache purge or delivery`, async () => {
    const f = fixture();
    const owner = clone(f.owner);
    f.beforeWrite = () => change(f.rows[0]);
    const result = await f.api.publishSite(SITE_ID, f.deps, MODE);
    assert.equal(result.status, 409);
    assert.match(result.message, /Vercel/);
    assert.equal(f.calls.writes.length, 0);
    assert.equal(f.calls.fetch.some(c => c.url === `${MM.url}/api/revalidate`), false);
    noEffects(f, owner);
    if (name === 'first publication') assert.equal(f.rows[0].published_at, '2026-10-02T11:59:00Z');
  });
}

for (const [name, setup, status] of [
  ['missing site', f => { f.missingSite = true; }, 404],
  ['missing signup', f => { f.missingSignup = true; }, 404],
  ['paused signup', f => { f.owner.status = 'pausada'; }, 409],
  ['cancelled signup', f => { f.owner.status = 'cancelada'; }, 409],
  ['discarded signup', f => { f.owner.status = 'descartada'; }, 409],
  ['invalid content', f => { f.rows[0].content = {}; }, 409],
  ['generating', f => { f.rows[0].status = 'generating'; }, 409],
  ['failed', f => { f.rows[0].status = 'failed'; }, 409],
  ['archived', f => { f.rows[0].status = 'archived'; }, 409],
  ['missing configured project', f => { f.deps.vercel = null; }, 503],
]) {
  test(`${name} retains existing blocker before Vercel`, async () => {
    const f = fixture(); setup(f);
    const owner = clone(f.owner);
    const result = await f.api.publishSite(SITE_ID, f.deps, MODE);
    assert.equal(result.status, status);
    assert.equal(f.calls.fetch.length, 0);
    assert.equal(f.calls.writes.length, 0);
    noEffects(f, owner);
  });
}

for (const [name, setup] of [
  ['domain unauthorized', f => { f.addStatus = 403; }],
  ['DNS not checked', f => { f.configStatus = 403; }],
  ['DNS misconfigured', f => { f.misconfigured = true; }],
  ['ownership unverified', f => { f.verified = false; }],
]) {
  test(`${name} never publishes or delivers`, async () => {
    const f = fixture(); setup(f);
    const owner = clone(f.owner);
    const result = await f.api.publishSite(SITE_ID, f.deps, MODE);
    assert.equal(result.ok, false);
    assert.equal(f.rows[0].status, 'draft');
    assert.equal(f.rows[0].published_at, null);
    assert.equal(f.calls.writes.length, 0);
    noEffects(f, owner);
  });
}

test('cache failure reports publication and warning truthfully without delivery', async () => {
  const f = fixture(); f.cacheStatus = 503;
  const owner = clone(f.owner);
  const result = await f.api.publishSite(SITE_ID, f.deps, MODE);
  assert.equal(result.ok, true);
  assert.equal(result.site.status, 'published');
  assert.equal(result.warnings.length, 1);
  noEffects(f, owner);
});

test('storage failure never purges or delivers', async () => {
  const f = fixture(); f.failWrite = true;
  const owner = clone(f.owner);
  await assert.rejects(f.api.publishSite(SITE_ID, f.deps, MODE), /Offline write failure/);
  assert.equal(f.calls.fetch.some(c => c.url === `${MM.url}/api/revalidate`), false);
  noEffects(f, owner);
});

for (const expectedVersion of [undefined, -1, 0.5, NaN, Number.MAX_SAFE_INTEGER + 1]) {
  test(`direct site_only call requires a safe reviewed version: ${expectedVersion}`, async () => {
    const f = fixture();
    const result = await f.api.publishSite(SITE_ID, f.deps, { mode: 'site_only', expectedVersion });
    assert.equal(result.status, 400);
    assert.equal(f.calls.siteReads.length, 0);
    assert.equal(f.calls.fetch.length, 0);
  });
}

test('authenticated route accepts explicit site_only and returns skipped delivery', async () => {
  const f = fixture(); const owner = clone(f.owner);
  const response = await f.request(MODE);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.data.delivered, 'skipped');
  assert.equal(body.data.site.id, SITE_ID);
  assert.match(body.data.message, /Solo sitio/);
  noEffects(f, owner);
});

for (const body of [undefined, {}, '   ']) {
  test(`legacy route body ${JSON.stringify(body)} keeps delivery and alert behavior`, async () => {
    const f = fixture();
    const response = await f.request(body);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.data.delivered, 'marked');
    assert.equal(f.calls.delivery.length, 1);
    assert.equal(f.calls.delivery[0].body.status, 'entregada');
    assert.equal(f.calls.alerts.length, 1);
    assert.equal(f.calls.alerts[0][0], 'site_published');
    assert.equal(f.owner.status, 'entregada');
  });
}

test('legacy already-delivered publication updates only its link and keeps alert', async () => {
  const f = fixture({ signup: { status: 'entregada', site_url: 'https://old.example.invalid' } });
  const result = await f.api.publishSite(SITE_ID, f.deps);
  assert.equal(result.delivered, 'url_updated');
  assert.deepEqual(Object.keys(f.calls.delivery[0].body), ['siteUrl']);
  assert.equal(f.calls.alerts.length, 1);
  const again = await f.api.publishSite(SITE_ID, f.deps);
  assert.equal(again.delivered, 'already');
  assert.equal(f.calls.delivery.length, 1);
});

for (const body of [
  { mode: 'site_only' }, { mode: 'site_only', expectedVersion: '2' }, { mode: 'site_only', expectedVersion: -1 },
  { mode: 'site_only', expectedVersion: 2.5 }, { mode: 'site_only', expectedVersion: 2, projectId: 'different' },
  { mode: 'deliver' }, { mode: 'unexpected', expectedVersion: 2 }, { expectedVersion: 2 }, null, [], 'invalid json',
]) {
  test(`route rejects invalid/unknown publication input: ${JSON.stringify(body)}`, async () => {
    const f = fixture();
    const response = await f.request(body);
    assert.equal(response.status, 400);
    assert.equal(f.calls.siteReads.length, 0);
    assert.equal(f.calls.fetch.length, 0);
  });
}

for (const [name, options, adminEnv, status] of [
  ['missing auth', { token: null }, undefined, 401],
  ['wrong auth', { token: 'wrong' }, undefined, 401],
  ['unconfigured auth', {}, {}, 503],
  ['invalid tenant ID', { id: 'not-a-uuid' }, undefined, 400],
]) {
  test(`route ${name} fails closed`, async () => {
    const f = fixture({ ...(adminEnv ? { adminEnv } : {}) });
    assert.equal((await f.request(MODE, options)).status, status);
    assert.equal(f.calls.siteReads.length, 0);
    assert.equal(f.calls.fetch.length, 0);
    assert.equal(f.calls.delivery.length, 0);
  });
}

test('site-only publication leaves real WhatsApp template eligibility unchanged', async () => {
  const f = fixture();
  const eligibility = () => Object.fromEntries(templates.TEMPLATE_NAMES.map(t => [t, f.wa.templateStillApplies(t, f.owner, NOW)]));
  const before = eligibility();
  await f.api.publishSite(SITE_ID, f.deps, MODE);
  assert.deepEqual(eligibility(), before);
  assert.equal(before.cqv_web_ready, false);
  // Existing confirmation eligibility is not silently suppressed or relabelled.
  assert.equal(before.cqv_web_confirm, true);
});

for (const signup of [
  { status: 'en_construccion', terms_accepted_at: null },
  { status: 'borrador', terms_accepted_at: null, submitted_at: null },
  { status: 'borrador' },
]) {
  test(`legacy delivery keeps its terms/registration gate: ${JSON.stringify(signup)}`, async () => {
    const f = fixture({ signup });
    const owner = clone(f.owner);
    const response = await f.request({});
    assert.equal(response.status, 409);
    assert.match((await response.json()).message, /términos/);
    assert.equal(f.calls.fetch.length, 0);
    assert.equal(f.calls.writes.length, 0);
    noEffects(f, owner);
  });
}

for (const status of ['pausada', 'cancelada', 'descartada']) {
  test(`site_only still rejects ${status} without terms acceptance`, async () => {
    const f = fixture({ signup: { status, terms_accepted_at: null } });
    const owner = clone(f.owner);
    const response = await f.request(MODE);
    assert.equal(response.status, 409);
    assert.match((await response.json()).message, new RegExp(status));
    assert.equal(f.calls.fetch.length, 0);
    assert.equal(f.calls.writes.length, 0);
    noEffects(f, owner);
  });
}

test('site_only route publishes an unfinished signup without stamping terms or starting its trial', async () => {
  const f = fixture({ signup: { status: 'borrador', terms_accepted_at: null, submitted_at: null } });
  const owner = clone(f.owner);
  const response = await f.request(MODE);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.delivered, 'skipped');
  assert.equal(f.rows[0].status, 'published');
  assert.equal(f.owner.terms_accepted_at, null);
  assert.equal(f.owner.delivered_at, null);
  assert.equal(f.owner.free_until, null);
  assert.equal(f.owner.status, 'borrador');
  noEffects(f, owner);
});
