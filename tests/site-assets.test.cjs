// Offline execution of the real route/helper. All DB/storage boundaries are
// in-memory; sharp is the existing local codec, with no provider or env access.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const sharp = require('sharp');

const ID = '00000000-0000-4000-8000-000000000001';
const SIGNUP_ID = '00000000-0000-4000-8000-000000000002';
const TABLE = 'web_gratis_sites';
const BUCKET = 'web-gratis-public';
const PRIVATE = 'private-original-file-client-notes';
const ROOT = path.join(__dirname, '..');

function moduleAt(relative, stubs) {
  const file = path.join(ROOT, relative);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports, require(name) {
      assert.ok(Object.hasOwn(stubs, name), `Forbidden dependency: ${name}`);
      return stubs[name];
    }, Buffer, Request, Response, FormData, Blob, URL, Date, console: { error() {} },
  }, { filename: file });
  return exports;
}

function fixture(options = {}) {
  let row = { id: ID, signup_id: SIGNUP_ID, slug: 'client-one', status: 'draft', version: 7,
    generation_lease_until: null, ...options.row };
  const calls = [], uploads = [];
  let reads = 0;
  const db = {
    from(table) {
      assert.equal(table, TABLE, 'No signup, billing, trial, outbox or other table access');
      calls.push(['from', table]);
      const filters = [];
      const query = {
        select(columns) { assert.equal(columns, 'id,signup_id,slug,version,status,generation_lease_until'); return query; },
        eq(key, value) { filters.push([key, value]); return query; },
        async maybeSingle() {
          reads++;
          if (reads === 2 && options.race) row = { ...row, ...options.race };
          calls.push(['read', filters]);
          if (options.readError) return { data: null, error: new Error('private database detail') };
          return { data: options.missing || !filters.every(([k, v]) => row[k] === v) ? null : { ...row }, error: null };
        },
        insert() { assert.fail('No inserts allowed'); }, update() { assert.fail('No updates allowed'); }, delete() { assert.fail('No deletes allowed'); },
      };
      return query;
    },
    storage: { from(bucket) {
      assert.equal(bucket, BUCKET);
      calls.push(['bucket', bucket]);
      return {
        getPublicUrl(key) { return { data: { publicUrl: options.url ?? `https://storage.example.test/storage/v1/object/public/${bucket}/${key}` } }; },
        async upload(key, bytes, config) {
          uploads.push({ key, bytes: Buffer.from(bytes), config });
          if (options.uploadError) return { error: new Error('private storage detail') };
          return { data: { path: key }, error: null };
        },
        remove() { assert.fail('No object removals allowed'); }, createBucket() { assert.fail('No bucket creation allowed'); },
      };
    } },
  };
  const helper = moduleAt('src/lib/web-gratis/sites/assets.ts', {
    crypto: require('node:crypto'), zod: require('zod'), sharp: options.codecUnavailable ? undefined : sharp,
    '../server': { getDb() { calls.push(['getDb']); return db; } },
    './db': { PUBLIC_BUCKET: BUCKET, SITES_TABLE: TABLE },
    './shared': { slugProblem: slug => /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])$/.test(slug) && !slug.includes('--') && !['admin', 'www'].includes(slug) ? null : 'invalid' },
  });
  const route = moduleAt('src/app/api/web-gratis/admin/sites/[id]/assets/route.ts', {
    zod: require('zod'),
    '@/lib/web-gratis/admin': { async requireAdmin() { calls.push(['auth']); return options.denied ? Response.json({ error: 'unauthorized' }, { status: 401 }) : null; } },
    '@/lib/web-gratis/http': {
      ok: data => Response.json({ data, error: null, message: null }),
      fail: (status, error, message = null) => Response.json({ data: null, error, message }, { status }),
    },
    '@/lib/web-gratis/sites/assets': helper,
  });
  return { helper, calls, uploads, get row() { return row; },
    async post(request, id = ID) { const response = await route.POST(request, { params: Promise.resolve({ id }) }); return { status: response.status, body: await response.json() }; },
  };
}

async function pixels(format = 'png', metadata = false) {
  let image = sharp({ create: { width: 2, height: 3, channels: 4, background: '#e469a0' } });
  if (metadata) image = image.withExif({ IFD0: { Artist: PRIVATE, ImageDescription: PRIVATE } });
  return image[format]().toBuffer();
}
function request(bytes, { version = '7', name = `${PRIVATE}.html`, type = 'text/html', extra = [], fields = [] } = {}) {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type }), name);
  form.append('expectedVersion', version);
  for (const [key, value] of [...extra, ...fields]) form.append(key, value);
  return new Request('https://example.test/api/assets', { method: 'POST', body: form });
}

test('auth is first and denial never reads body, tenant or storage', async () => {
  const f = fixture({ denied: true });
  const result = await f.post({ get headers() { assert.fail('Unauthorized request body examined'); } }, 'not-a-uuid');
  assert.equal(result.status, 401);
  assert.deepEqual(f.calls, [['auth']]);
});

test('invalid tenant UUID is rejected before reading body', async () => {
  const f = fixture();
  const result = await f.post({ get headers() { assert.fail('Invalid tenant request body examined'); } }, '../other');
  assert.equal(result.status, 400);
  assert.deepEqual(f.calls, [['auth']]);
});

test('strict multipart fields reject cross-scope selectors, metadata, duplicates and noninteger versions', async () => {
  const image = await pixels();
  for (const key of ['siteId', 'signupId', 'slug', 'path', 'bucket', 'url', 'purpose', 'metadata', 'expectedVersion', 'file']) {
    const f = fixture();
    const result = await f.post(request(image, { extra: [[key, 'other-client']] }));
    assert.equal(result.status, 400, key);
    assert.deepEqual(f.calls, [['auth']]);
  }
  for (const version of ['', '-1', '7.0', '07', '1e2', '9007199254740992']) {
    const f = fixture();
    assert.equal((await f.post(request(image, { version }))).status, 400, version);
    assert.deepEqual(f.calls, [['auth']]);
  }
  const f = fixture();
  assert.equal((await f.post(new Request('https://example.test', { method: 'POST', body: '{}' }))).status, 400);
  assert.equal((await f.post(new Request('https://example.test', { method: 'POST', body: 'broken', headers: { 'content-type': 'multipart/form-data; boundary=x' } }))).status, 400);
  assert.deepEqual(f.calls, [['auth'], ['auth']]);
});

test('empty, oversize file and absent/dishonest length streams are bounded before DB use', async () => {
  const f = fixture();
  assert.equal((await f.post(request(Buffer.alloc(0)))).status, 400);
  assert.equal((await f.post(request(Buffer.alloc(f.helper.MAX_SITE_ASSET_BYTES + 1)))).status, 413);
  let canceled = false;
  const stream = new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(1024 * 1024)); },
    cancel() { canceled = true; },
  });
  const result = await f.post(new Request('https://example.test', { method: 'POST', body: stream, duplex: 'half',
    headers: { 'content-type': 'multipart/form-data; boundary=x', 'content-length': '10' } }));
  assert.equal(result.status, 413);
  assert.equal(canceled, true);
  const oversized = request(Buffer.from('small'));
  oversized.headers.set('content-length', '999999999');
  assert.equal((await f.post(oversized)).status, 413);
  assert.deepEqual(f.calls, [['auth'], ['auth'], ['auth'], ['auth']]);
});

test('MIME and filenames cannot make SVG/HTML/PDF/GIF or fake signatures public', async () => {
  for (const bytes of [Buffer.from('<svg onload="alert(1)"></svg>'), Buffer.from('<html>secret</html>'), Buffer.from('%PDF-1.4'), Buffer.from('GIF89a')]) {
    const f = fixture();
    const result = await f.post(request(bytes, { name: 'logo.png', type: 'image/png' }));
    assert.equal(result.status, 415);
    assert.equal(f.uploads.length, 0);
  }
  for (const bytes of [Buffer.from([255, 216, 255]), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.from('RIFF0000WEBP')]) {
    const f = fixture();
    assert.equal((await f.post(request(bytes))).status, 400);
    assert.equal(f.uploads.length, 0);
  }
});

for (const format of ['png', 'jpeg', 'webp']) {
  test(`${format}: real pixels validated, metadata removed, random exact tenant key; no other effects`, async () => {
    const f = fixture();
    const before = JSON.stringify(f.row);
    const bytes = await pixels(format, true);
    const result = await f.post(request(bytes));
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(f.uploads.length, 1);
    const upload = f.uploads[0];
    assert.match(upload.key, new RegExp(`^client-one/asset-[0-9a-f-]{36}\\.${format === 'jpeg' ? 'jpg' : format}$`));
    assert.equal(upload.config.upsert, false);
    assert.equal(upload.config.contentType, `image/${format}`);
    assert.deepEqual(Object.keys(upload.config).sort(), ['cacheControl', 'contentType', 'upsert']);
    assert.equal(upload.bytes.includes(Buffer.from(PRIVATE)), false);
    const decoded = await sharp(upload.bytes).metadata();
    assert.equal(decoded.width, 2);
    assert.equal(decoded.height, 3);
    assert.equal(decoded.exif, undefined);
    assert.equal(decoded.xmp, undefined);
    assert.equal(decoded.iptc, undefined);
    assert.equal(decoded.icc, undefined);
    assert.deepEqual(result.body.data.asset, {
      src: `https://storage.example.test/storage/v1/object/public/${BUCKET}/${upload.key}`, width: 2, height: 3,
    });
    assert.equal(JSON.stringify(result.body).includes(PRIVATE), false);
    assert.equal(JSON.stringify(f.row), before);
    assert.equal(f.calls.filter(c => c[0] === 'read').length, 2);
    assert.deepEqual(f.calls.filter(c => c[0] === 'read')[1][1], [
      ['id', ID], ['signup_id', SIGNUP_ID], ['slug', 'client-one'], ['version', 7], ['status', 'draft'],
    ]);
    // Decode both images: PNG/WebP retain the actual colors as well as size.
    if (format !== 'jpeg') assert.deepEqual(await sharp(upload.bytes).raw().toBuffer(), await sharp(bytes).raw().toBuffer());
  });
}

test('missing tenant, stale version, inactive states, unsafe slug and generation leases never upload', async () => {
  const image = await pixels();
  for (const row of [
    { version: 8 }, { status: 'generating' }, { status: 'archived' }, { status: 'failed' },
    { slug: '../other-client' }, { slug: 'Client-One' }, { slug: 'admin' }, { slug: 'a--b' },
    { generation_lease_until: '2999-01-01T00:00:00Z' }, { generation_lease_until: 'malformed' },
  ]) {
    const f = fixture({ row });
    assert.equal((await f.post(request(image))).status, 409, JSON.stringify(row));
    assert.equal(f.uploads.length, 0);
    assert.equal(f.calls.some(c => c[0] === 'bucket'), false);
  }
  const missing = fixture({ missing: true });
  assert.equal((await missing.post(request(image))).status, 404);
  assert.equal(missing.uploads.length, 0);
});

test('tenant/version/slug/status/lease races while processing reject before creating object', async () => {
  const image = await pixels();
  for (const race of [
    { id: SIGNUP_ID }, { signup_id: ID }, { slug: 'client-two' }, { version: 8 }, { status: 'archived' },
    { generation_lease_until: '2999-01-01T00:00:00Z' },
  ]) {
    const f = fixture({ race });
    assert.equal((await f.post(request(image))).status, 409, JSON.stringify(race));
    assert.equal(f.uploads.length, 0);
    assert.equal(f.calls.some(c => c[0] === 'bucket'), false);
  }
});

test('paused/published uploads do not change status, version or invoke delivery/cache/provider integrations', async () => {
  for (const status of ['paused', 'published']) {
    const f = fixture({ row: { status } });
    assert.equal((await f.post(request(await pixels()))).status, 200);
    assert.equal(f.row.status, status);
    assert.equal(f.row.version, 7);
  }
});

test('codec absence and invalid public URL fail closed before upload', async () => {
  const image = await pixels();
  const absent = fixture({ codecUnavailable: true });
  assert.equal((await absent.post(request(image))).status, 503);
  assert.equal(absent.uploads.length, 0);
  for (const url of [
    'http://storage.example.test/a', 'https://storage.example.test/private?token=secret',
    'https://user:pass@storage.example.test/storage/v1/object/public/web-gratis-public/client-one/a.png',
    'https://storage.example.test/storage/v1/object/public/web-gratis-public/client-two/a.png',
  ]) {
    const f = fixture({ url });
    assert.equal((await f.post(request(image))).status, 503);
    assert.equal(f.uploads.length, 0);
  }
});

test('storage/read failures expose no internal error details and never mutate rows', async () => {
  for (const options of [{ readError: true }, { uploadError: true }]) {
    const f = fixture(options);
    const before = JSON.stringify(f.row);
    const result = await f.post(request(await pixels()));
    assert.equal(result.status, 500);
    assert.equal(result.body.error, 'server_error');
    assert.equal(JSON.stringify(result.body).includes('private'), false);
    assert.equal(JSON.stringify(f.row), before);
  }
});

test('oversize dimensions and truncated real raster are rejected by local decode', async () => {
  const f = fixture();
  const wide = await sharp({ create: { width: 8001, height: 1, channels: 3, background: '#000000' } }).png().toBuffer();
  assert.equal((await f.post(request(wide))).status, 400);
  const jpeg = await pixels('jpeg');
  const truncated = jpeg.subarray(0, Math.floor(jpeg.length / 2));
  assert.equal((await f.post(request(truncated))).status, 400);
  assert.equal(f.uploads.length, 0);
});

test('JPEG normalization keeps full chroma detail and applies orientation without exposing EXIF', async () => {
  const rgb = Buffer.alloc(64 * 64 * 3);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const i = (y * 64 + x) * 3;
    rgb[i] = x % 2 ? 255 : 0;
    rgb[i + 1] = y % 2 ? 255 : 0;
    rgb[i + 2] = (x + y) % 2 ? 255 : 0;
  }
  const source = await sharp(rgb, { raw: { width: 64, height: 64, channels: 3 } })
    .jpeg({ quality: 100, chromaSubsampling: '4:4:4' }).toBuffer();
  const f = fixture();
  assert.equal((await f.post(request(source))).status, 200);
  const metadata = await sharp(f.uploads[0].bytes).metadata();
  assert.equal(metadata.chromaSubsampling, '4:4:4');
  const sourcePixels = await sharp(source).raw().toBuffer();
  const uploadedPixels = await sharp(f.uploads[0].bytes).raw().toBuffer();
  const meanError = uploadedPixels.reduce((sum, value, i) => sum + Math.abs(value - sourcePixels[i]), 0) / uploadedPixels.length;
  assert.ok(meanError < 1, `Unnecessary JPEG detail loss: ${meanError}`);

  const rotated = await sharp({ create: { width: 2, height: 3, channels: 3, background: '#e469a0' } })
    .withMetadata({ orientation: 6 }).jpeg().toBuffer();
  const result = await f.post(request(rotated));
  assert.equal(result.status, 200);
  assert.equal(result.body.data.asset.width, 3);
  assert.equal(result.body.data.asset.height, 2);
  assert.equal((await sharp(f.uploads[1].bytes).metadata()).exif, undefined);
});

test('repeated uploads create independent keys and never overwrite or attach either object', async () => {
  const f = fixture();
  const image = await pixels();
  assert.equal((await f.post(request(image))).status, 200);
  assert.equal((await f.post(request(image))).status, 200);
  assert.notEqual(f.uploads[0].key, f.uploads[1].key);
  assert.ok(f.uploads.every(upload => upload.config.upsert === false));
  assert.equal(f.row.version, 7);
  assert.equal(f.row.status, 'draft');
});
