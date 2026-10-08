// Execute the actual CAPI helper with synthetic environment values and an
// in-memory fetch. No provider request, production configuration or lead data.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');

const NOW = Date.parse('2026-10-08T17:00:00.000Z');
const ID = '00000000-0000-4000-8000-000000000001';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

function fixture({ token = 'synthetic-offline-token', failure = null } = {}) {
  const calls = [], errors = [];
  const exports = {};
  const filename = path.join(__dirname, '../src/lib/web-gratis/capi.ts');
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(source, {
    exports,
    require: name => { assert.equal(name, 'crypto'); return crypto; },
    process: { env: token == null ? {} : { META_CAPI_TOKEN: token } },
    Date: { now: () => NOW },
    AbortSignal: { timeout: ms => { assert.equal(ms, 6000); return 'synthetic-abort-signal'; } },
    console: { error: (...args) => errors.push(args) },
    fetch: async (url, init) => {
      calls.push({ url, init, body: JSON.parse(init.body) });
      if (failure === 'network') throw new Error('synthetic network failure');
      return { ok: failure !== 'http', status: failure === 'http' ? 500 : 200, text: async () => 'synthetic provider failure' };
    },
  }, { filename });
  return { calls, errors, async send(changes = {}, headers = {}) {
    await exports.sendCapiEvent({
      eventName: 'Lead', eventId: `${ID}-lead`, whatsapp: '+50761234567', externalId: ID,
      sourceUrl: 'https://example.invalid/web?utm_source=ig&fbclid=synthetic-click',
      fbclid: 'synthetic-click', request: new Request('https://example.invalid/api/web-gratis/quick', {
        headers: { 'user-agent': 'Offline CAPI fixture', 'x-forwarded-for': '192.0.2.1, 192.0.2.2', ...headers },
      }), ...changes,
    });
  } };
}

test('Panama CAPI hashes pa and phone, retaining canonical Lead ID, fbclid and landing URL', async () => {
  const f = fixture();
  await f.send();
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].init.method, 'POST');
  const event = f.calls[0].body.data[0];
  assert.equal(event.event_name, 'Lead');
  assert.equal(event.event_id, `${ID}-lead`);
  assert.equal(event.event_time, NOW / 1000);
  assert.equal(event.event_source_url, 'https://example.invalid/web?utm_source=ig&fbclid=synthetic-click');
  assert.deepEqual(event.user_data.country, [hash('pa')]);
  assert.deepEqual(event.user_data.ph, [hash('50761234567')]);
  assert.deepEqual(event.user_data.external_id, [hash(ID)]);
  assert.equal(event.user_data.fbc, `fb.1.${NOW}.synthetic-click`);
  assert.equal(event.user_data.client_ip_address, '192.0.2.1');
  assert.equal(event.user_data.client_user_agent, 'Offline CAPI fixture');
  assert.ok(!f.calls[0].init.body.includes('50761234567'));
  assert.equal(f.errors.length, 0);
});

test('malformed optional Meta cookies never throw and fall back to saved fbclid when available', async () => {
  for (const fbclid of ['synthetic-click', null]) {
    const f = fixture();
    await assert.doesNotReject(f.send({ fbclid }, { cookie: '_fbp=%E0%A4%A; _fbc=%broken' }));
    assert.equal(f.calls.length, 1);
    const user = f.calls[0].body.data[0].user_data;
    assert.equal(user.fbp, undefined);
    assert.equal(user.fbc, fbclid ? `fb.1.${NOW}.${fbclid}` : undefined);
  }
});

test('provider HTTP 500 is logged without failing the saved-lead caller', async () => {
  const f = fixture({ failure: 'http' });
  await assert.doesNotReject(f.send());
  assert.equal(f.calls.length, 1);
  assert.equal(f.errors.length, 1);
  assert.equal(f.errors[0][2], 500);
});

test('provider network failure is logged without throwing to the saved-lead caller', async () => {
  const f = fixture({ failure: 'network' });
  await assert.doesNotReject(f.send());
  assert.equal(f.calls.length, 1);
  assert.equal(f.errors.length, 1);
  assert.match(f.errors[0][2].message, /synthetic network failure/);
});

test('missing or blank CAPI token performs no request', async () => {
  for (const token of [null, '', '   ']) {
    const f = fixture({ token });
    await assert.doesNotReject(f.send());
    assert.equal(f.calls.length, 0);
    assert.equal(f.errors.length, 0);
  }
});
