// Offline only: actual TS handlers, Zod and cache client; in-memory DB and fetch.
// No environment files, live DB, assets, providers, models or message sends.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const TABLE = 'web_gratis_sites';
const ID = '00000000-0000-4000-8000-000000000001';
const OTHER_ID = '00000000-0000-4000-8000-000000000002';
const STORAGE = 'https://fixture.supabase.invalid';
const SLUG = 'reviewed-client';
const TOKEN = 'fixture-admin-token';
const NOW = new Date('2026-10-02T12:00:00.000Z');
const clone = value => JSON.parse(JSON.stringify(value));
const image = () => ({
  src: `${STORAGE}/storage/v1/object/public/web-gratis-public/${SLUG}/logo.jpg`,
  alt: 'Logo autorizado de la empresa', width: 800, height: 800,
  credit: { name: 'Autor', url: 'https://commons.wikimedia.org/wiki/File:Example.jpg' },
});
function content() {
  return {
    version: 1, lang: 'es',
    business: { name: 'Empresa revisada', tagline: 'Una página revisada', type: 'Restaurante', city: 'Armenia', country: 'SV' },
    seo: { title: 'Empresa revisada', description: 'Información pública revisada.', keywords: ['Armenia'] },
    hero: { eyebrow: 'Armenia', headline: 'Empresa revisada', subheadline: 'Conozca nuestro menú.', ctaLabel: 'Consultar', image: image() },
    about: { title: 'Nuestra propuesta', body: ['Contenido revisado.'], highlights: ['Menú proporcionado'] },
    services: { title: 'Menú', intro: null, items: [{ name: 'Tacos', description: null, price: '$5', image: image() }] },
    gallery: [image()], differentiators: { title: 'Detalles', items: [{ title: 'Primero', body: 'Uno.' }, { title: 'Segundo', body: 'Dos.' }] },
    hours: { title: 'Horario', lines: ['Consulte el horario vigente'] },
    location: { title: 'Ubicación', address: null, mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Armenia', areaServed: 'Armenia' },
    contact: { title: 'Hable con nosotros', body: 'Consulte disponibilidad.', whatsapp: '50370000001', whatsappMessage: 'Hola.', email: null, instagram: 'https://www.instagram.com/empresa/', facebook: null, website: null },
    faq: [{ q: '¿Cómo consultar?', a: 'Contáctenos.' }],
    theme: { palette: { bg: '#FFFFFF', surface: '#FFF0F0', text: '#111111', muted: '#555555', primary: '#FF0088', primaryText: '#000000', accent: '#FFBBCC' }, mode: 'light', font: 'serif', vertical: 'food', mood: 'Rosa', logo: image() },
    footer: { credit: 'Hecho por MachineMind', referralUrl: 'https://machinemindconsulting.com/web?ref=ABCDEF' },
  };
}
function site(overrides = {}) {
  return {
    id: ID, signup_id: '00000000-0000-4000-8000-000000000010', slug: SLUG,
    status: 'draft', content: content(), version: 3, sources: { notes: 'PRIVATE_SOURCE_SENTINEL' },
    instructions: 'PRIVATE_INSTRUCTIONS_SENTINEL', preview_token: 'fixture-preview-token',
    published_at: null, paused_at: null, generated_at: '2026-10-01T12:00:00Z',
    custom_domain: null, domain_status: null, generation_error: null, generation_attempts: 0,
    generation_lease_until: null, created_at: '2026-10-01T12:00:00Z', updated_at: '2026-10-01T12:00:00Z',
    ...overrides,
  };
}

function load(file, modules, env = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports, process: { env }, console: { error() {} }, Date, URL, AbortSignal, Request, Response, Buffer, setTimeout,
    fetch: async () => { throw new Error('Unexpected global network access'); },
    require: name => {
      assert.ok(Object.hasOwn(modules, name), `Unexpected dependency (generation/billing/outbox prohibited): ${name}`);
      return modules[name];
    },
  }, { filename: file });
  return exports;
}

function fixture(overrides = {}) {
  const rows = [site(overrides), site({ id: OTHER_ID, signup_id: 'other-signup', slug: 'other-client' })];
  const calls = [], writes = [], network = [];
  let beforeUpdate = null, dbError = null, cacheStatus = 200;
  const db = { from(table) {
    assert.equal(table, TABLE, 'Never read or write signups, trials, billing, messages, outbox or provider tables');
    const filters = [];
    let patch;
    const query = {
      select() { return query; },
      eq(key, value) { filters.push([key, value]); return query; },
      update(value) { patch = value; return query; },
      async maybeSingle() {
        calls.push({ table, kind: patch ? 'update' : 'select', filters: clone(filters) });
        if (dbError) return { data: null, error: dbError };
        if (patch && beforeUpdate) beforeUpdate(rows[0]);
        const row = rows.find(row => filters.every(([key, value]) => row[key] === value));
        if (row && patch) { writes.push(clone(patch)); Object.assign(row, clone(patch)); }
        return { data: row ? clone(row) : null, error: null };
      },
    };
    return query;
  } };
  const dbModule = { SITES_TABLE: TABLE, PUBLIC_BUCKET: 'web-gratis-public', mmSitesEnv: () => null };
  const schema = load('src/lib/web-gratis/site-content.ts', { zod: require('zod') });
  const cache = load('src/lib/web-gratis/sites/mm-sites.ts', { '../server': { getDb: () => db }, './db': dbModule });
  const api = load('src/lib/web-gratis/sites/import.ts', {
    zod: require('zod'), '../server': { getDb: () => db }, '../site-content': schema, './db': dbModule, './mm-sites': cache,
  }, { NEXT_PUBLIC_SUPABASE_URL: STORAGE });
  const deps = {
    now: () => NOW, publicStorageUrl: STORAGE,
    mm: { url: 'https://renderer.invalid', revalidateSecret: 'fixture-cache-secret' },
    fetch: async (url, options) => {
      assert.equal(url, 'https://renderer.invalid/api/revalidate');
      assert.equal(options.method, 'POST');
      assert.deepEqual(JSON.parse(options.body), { slug: SLUG });
      network.push({ url, options });
      return new Response('', { status: cacheStatus });
    },
  };
  return { api, deps, rows, calls, writes, network,
    beforeUpdate(fn) { beforeUpdate = fn; }, failDb() { dbError = new Error('fixture DB failure'); },
    cacheStatus(value) { cacheStatus = value; },
  };
}
const input = value => ({ content: value ?? content(), expectedVersion: 3 });

test('draft import changes only selected content/version/internal audit; no network or commercial side effects', async () => {
  const f = fixture(), before = clone(f.rows), next = content();
  next.hero.headline = 'Nuevo contenido revisado';
  const result = await f.api.importSiteContent(ID, input(next), f.deps);
  assert.equal(result.ok, true);
  assert.equal(f.rows[0].version, 4);
  assert.equal(f.rows[0].content.hero.headline, next.hero.headline);
  assert.deepEqual(Object.keys(f.writes[0]).sort(), ['content', 'sources', 'version']);
  assert.deepEqual(f.rows[0].sources, { ...before[0].sources, lastEdit: { at: NOW.toISOString(), fields: ['content'] } });
  for (const key of Object.keys(before[0]).filter(k => !['content', 'version', 'sources'].includes(k))) assert.deepEqual(f.rows[0][key], before[0][key]);
  assert.deepEqual(f.rows[1], before[1], 'Other tenant is unchanged');
  assert.equal(JSON.stringify(f.rows[0].content).includes('PRIVATE_'), false);
  assert.equal(f.network.length, 0);
  assert.equal(f.calls.length, 2);
});

test('published import refreshes only selected slug; paused import stays paused without network', async () => {
  for (const status of ['published', 'paused']) {
    const f = fixture({ status, published_at: '2026-10-01T14:00:00Z', paused_at: status === 'paused' ? '2026-10-02T10:00:00Z' : null });
    const result = await f.api.importSiteContent(ID, input(), f.deps);
    assert.equal(result.ok, true);
    assert.equal(result.site.status, status);
    assert.equal(result.site.published_at, '2026-10-01T14:00:00Z');
    assert.equal(f.network.length, status === 'published' ? 1 : 0);
  }
});

test('stale version, missing site, generating/failed/archived states never mutate or fetch', async () => {
  for (const overrides of [{ version: 4 }, { status: 'generating' }, { status: 'failed' }, { status: 'archived' }]) {
    const f = fixture(overrides);
    const result = await f.api.importSiteContent(ID, input(), f.deps);
    assert.equal(result.status, 409); assert.equal(f.writes.length, 0); assert.equal(f.network.length, 0);
  }
  const f = fixture();
  assert.equal((await f.api.importSiteContent('00000000-0000-4000-8000-000000000099', input(), f.deps)).status, 404);
  assert.equal(f.writes.length, 0);
});

test('CAS rejects races in version, status, slug, ownership or same-version metadata after the read', async () => {
  for (const patch of [{ version: 4 }, { status: 'generating' }, { status: 'archived' }, { slug: 'other-client' }, { signup_id: 'other-signup' },
    { updated_at: NOW.toISOString(), sources: { notes: 'Concurrent reviewed note' } },
    { updated_at: NOW.toISOString(), instructions: 'Concurrent instructions' }]) {
    const f = fixture(), originalContent = clone(f.rows[0].content);
    f.beforeUpdate(row => Object.assign(row, patch));
    const result = await f.api.importSiteContent(ID, input(), f.deps);
    assert.equal(result.status, 409); assert.equal(f.writes.length, 0); assert.equal(f.network.length, 0);
    assert.deepEqual(f.rows[0].content, originalContent);
    for (const key of Object.keys(patch)) assert.deepEqual(f.rows[0][key], patch[key], `Preserve concurrent ${key}`);
  }
});

test('strict import rejects private/unknown fields at every object level, before DB access', async () => {
  const paths = ['', 'business', 'seo', 'hero', 'hero.image', 'hero.image.credit', 'about', 'services', 'services.items.0', 'services.items.0.image', 'gallery.0', 'differentiators', 'differentiators.items.0', 'hours', 'location', 'contact', 'faq.0', 'theme', 'theme.palette', 'theme.logo', 'footer'];
  for (const location of paths) {
    const f = fixture(), next = content();
    const object = location ? location.split('.').reduce((obj, key) => obj[key], next) : next;
    object.privateDm = 'PRIVATE_DM_MUST_NOT_BE_IMPORTED';
    const result = await f.api.importSiteContent(ID, input(next), f.deps);
    assert.equal(result.status, 400, location); assert.equal(f.calls.length, 0, location);
  }
  for (const extra of ['sources', 'signupId', 'slug', 'instructions', 'billing', 'assets']) {
    const f = fixture();
    assert.equal((await f.api.importSiteContent(ID, { ...input(), [extra]: 'private' }, f.deps)).status, 400);
    assert.equal(f.calls.length, 0);
  }
});

test('schema violations and missing/invalid expectedVersion fail before DB access', async () => {
  for (const payload of [{ content: content() }, { ...input(), expectedVersion: -1 }, { ...input(), expectedVersion: 1.5 }, { ...input(), expectedVersion: '3' }, { ...input(), content: {} }, { ...input(), content: null }]) {
    const f = fixture();
    assert.equal((await f.api.importSiteContent(ID, payload, f.deps)).status, 400);
    assert.equal(f.calls.length, 0);
  }
  const f = fixture();
  assert.equal((await f.api.importSiteContent('invalid-id', input(), f.deps)).status, 400);
  assert.equal(f.calls.length, 0);
});

test('image validator rejects cross-client, private/signed, external, credential and encoded paths', async () => {
  const f = fixture(), base = `${STORAGE}/storage/v1/object/public/web-gratis-public/${SLUG}/`;
  const invalid = [
    `${STORAGE}/storage/v1/object/public/web-gratis-public/other-client/logo.jpg`,
    `${STORAGE}/storage/v1/object/sign/web-gratis-public/${SLUG}/logo.jpg?token=secret`,
    `${STORAGE}/storage/v1/object/authenticated/web-gratis-public/${SLUG}/logo.jpg`,
    `${base}logo.jpg?token=secret`, `${base}logo.jpg#secret`, `${base}../other-client/logo.jpg`,
    `${base}%2e%2e/other-client/logo.jpg`, `${base}nested/logo.jpg`, `${base}logo%2Fprivate.jpg`,
    `${base}logo.txt`, `${base}.hidden.jpg`, `${base}logo.jpg?`,
    `https://user:password@fixture.supabase.invalid/storage/v1/object/public/web-gratis-public/${SLUG}/logo.jpg`,
    `http://fixture.supabase.invalid/storage/v1/object/public/web-gratis-public/${SLUG}/logo.jpg`,
    `https://unrelated.invalid/storage/v1/object/public/web-gratis-public/${SLUG}/logo.jpg`,
    'https://images.unsplash.com/example.jpg', 'data:image/png;base64,AAAA', 'file:///tmp/logo.jpg',
  ];
  for (const src of invalid) assert.equal(f.api.isTenantPublicImage(src, SLUG, STORAGE), false, src);
  assert.equal(f.api.isTenantPublicImage(`${base}logo-123.jpg`, SLUG, STORAGE), true);
  for (const pathParts of [['hero', 'image'], ['theme', 'logo'], ['gallery', 0], ['services', 'items', 0, 'image']]) {
    const next = content(), target = pathParts.reduce((obj, key) => obj[key], next);
    target.src = invalid[0];
    assert.equal((await f.api.importSiteContent(ID, input(next), f.deps)).status, 400);
  }
  assert.equal(f.writes.length, 0); assert.equal(f.network.length, 0);
});

test('missing public storage configuration fails closed for images; safe image-free content still works', async () => {
  const f = fixture();
  assert.equal((await f.api.importSiteContent(ID, input(), { ...f.deps, publicStorageUrl: null })).status, 400);
  const next = content(); next.hero.image = null; next.theme.logo = null; next.gallery = []; next.services.items[0].image = null;
  assert.equal((await f.api.importSiteContent(ID, input(next), { ...f.deps, publicStorageUrl: null })).ok, true);
});

test('links cannot introduce executable schemes or embedded credentials', async () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,private', 'https://user:password@business.invalid/']) {
    const f = fixture(), next = content(); next.contact.website = url;
    assert.equal((await f.api.importSiteContent(ID, input(next), f.deps)).status, 400);
    assert.equal(f.writes.length, 0);
  }
});

test('storage failure propagates with no fetch; cache failure reports saved content honestly', async () => {
  const failed = fixture(); failed.failDb();
  await assert.rejects(failed.api.importSiteContent(ID, input(), failed.deps), /fixture DB failure/);
  assert.equal(failed.writes.length, 0); assert.equal(failed.network.length, 0);
  const f = fixture({ status: 'published' }); f.cacheStatus(503);
  const result = await f.api.importSiteContent(ID, input(), f.deps);
  assert.equal(result.ok, true); assert.equal(result.site.version, 4); assert.equal(result.warnings.length, 1);
});

function routeFixture(overrides = {}) {
  const f = fixture(overrides);
  const http = {
    fail: (status, error, message = null) => Response.json({ data: null, error, message }, { status }),
    ok: data => Response.json({ data, error: null, message: null }),
  };
  const admin = load('src/lib/web-gratis/admin.ts', { crypto: require('node:crypto'), './config': {}, './http': http }, { WEB_GRATIS_ADMIN_TOKEN: TOKEN });
  const route = load('src/app/api/web-gratis/admin/sites/[id]/content/route.ts', {
    zod: require('zod'), '@/lib/web-gratis/admin': admin, '@/lib/web-gratis/http': http,
    '@/lib/web-gratis/sites/import': { importSiteContent: (id, body) => f.api.importSiteContent(id, body, f.deps) },
    '@/lib/web-gratis/sites/summary': { toSummary: row => ({ id: row.id, version: row.version, status: row.status, slug: row.slug }) },
  });
  return { ...f, route,
    request: (body = JSON.stringify(input()), token = TOKEN, id = ID) => route.PUT(new Request(`https://admin.invalid/api/web-gratis/admin/sites/${id}/content`, {
      method: 'PUT', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body,
    }), { params: Promise.resolve({ id }) }),
  };
}

test('actual admin authentication rejects unauthorized import before any DB access', async () => {
  const f = routeFixture();
  assert.equal((await f.request(JSON.stringify(input()), 'wrong')).status, 401);
  assert.equal(f.calls.length, 0); assert.equal(f.network.length, 0);
});

test('route rejects malformed JSON, invalid ID, excess body and unknown payload fields', async () => {
  const f = routeFixture();
  assert.equal((await f.request('{')).status, 400);
  assert.equal((await f.request(JSON.stringify(input()), TOKEN, 'bad-id')).status, 400);
  assert.equal((await f.request(' '.repeat(256001))).status, 413);
  assert.equal((await f.request(JSON.stringify({ ...input(), sources: 'private' }))).status, 400);
  assert.equal(f.calls.length, 0);
});

test('route success returns content/summary but no sources; conflicts and failures have correct envelopes', async () => {
  const f = routeFixture();
  const response = await f.request();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.error, null); assert.equal(body.data.site.version, 4);
  assert.deepEqual(Object.keys(body.data).sort(), ['content', 'message', 'site', 'warnings']);
  assert.equal(JSON.stringify(body).includes('PRIVATE_'), false);
  assert.equal((await f.request()).status, 409);
  const failed = routeFixture(); failed.failDb();
  assert.equal((await failed.request()).status, 500);
});
