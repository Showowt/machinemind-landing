// Offline execution of the real CSV GET handler and admin guard. Only synthetic
// rows/configuration are available; all database methods are read-only fixtures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));

const ADMIN_TOKEN = 'offline-export-fixture';
const SIGNUPS = 'web_gratis_signups';
const SETTINGS = 'web_gratis_settings';
const MESSAGES = 'web_gratis_messages';
const ID = '00000000-0000-4000-8000-000000000001';
const OTHER_ID = '00000000-0000-4000-8000-000000000002';
const ORIGINAL_HEADERS = [
  'estado', 'pais', 'negocio', 'rubro', 'ciudad', 'whatsapp', 'servicios',
  'diferencia', 'horario', 'instagram', 'facebook', 'web_actual', 'direccion',
  'correo', 'estilo', 'quiere', 'algo_mas', 'fotos', 'logo', 'documentos',
  'archivos_documentos', 'codigo_referido', 'enlace_referido', 'referido_por_id',
  'quien_lo_recomendo', 'utm_source', 'utm_campaign', 'creado', 'enviado',
  'confirmado', 'entregado', 'gratis_hasta', 'web', 'compartida', 'activada',
  'pago_por', 'pagado_hasta', 'estado_cobro', 'dia_mes_gratis', 'vence',
  'dias_para_vencer', 'proximo_recordatorio', 'proximo_recordatorio_fecha',
  'proximo_recordatorio_estado', 'enlace_pago', 'pausada', 'recontactar_desde',
  'dijo_que_no', 'baja_whatsapp', 'sin_whatsapp', 'consentimiento_whatsapp', 'notas',
];
const APPENDED_HEADERS = ['signup_id', 'proximo_seguimiento', 'nota_seguimiento', 'resultado_ultima_llamada'];

function load(file, modules = {}, env = {}) {
  const filename = path.resolve(testDirectory, '..', file);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    reportDiagnostics: true,
  });
  assert.deepEqual(compiled.diagnostics, []);
  const exports = {};
  vm.runInNewContext(compiled.outputText, {
    exports, Buffer, Date, URL, Response, process: { env },
    console: { error() {} },
    setTimeout: callback => { callback(); return 0; },
    fetch: () => { throw new Error('Network is unavailable in the export fixture'); },
    require: name => {
      assert.ok(Object.hasOwn(modules, name), `Unexpected dependency: ${name}`);
      return modules[name];
    },
  }, { filename });
  return exports;
}

const config = load('src/lib/web-gratis/config.ts');
const http = load('src/lib/web-gratis/http.ts', { 'next/server': { NextResponse: Response } });

function row(overrides = {}) {
  return {
    id: ID, status: 'nuevo', country: 'SV', business_name: 'Negocio sintético',
    business_type: 'Servicios', city: 'Ciudad', whatsapp: '+50370000000',
    services: ['Servicio verificado'], photo_paths: [], logo_paths: [], document_paths: [],
    referral_code: 'ABCD23', created_at: '2026-10-07T12:00:00.000Z',
    delivered_at: null, activated_at: null, notes: 'Nota previa',
    next_follow_up_at: '2026-10-08T15:30:00.000Z',
    follow_up_note: 'Confirmar horario con el cliente', last_call_outcome: 'no_contesto',
    ...overrides,
  };
}

function fixture(rows, { token = ADMIN_TOKEN } = {}) {
  const reads = [];
  const db = { from(table) {
    assert.ok([SIGNUPS, SETTINGS, MESSAGES].includes(table), `Unexpected table: ${table}`);
    reads.push(table);
    const filters = [];
    const query = {
      select() { return query; }, order() { return query; },
      in(column, values) { filters.push(value => values.includes(value[column])); return query; },
      eq() { return query; },
      async range(from, to) {
        assert.notEqual(table, SETTINGS);
        const source = table === SIGNUPS ? rows : [];
        return { data: source.filter(value => filters.every(match => match(value))).slice(from, to + 1), error: null };
      },
      async maybeSingle() {
        assert.equal(table, SETTINGS);
        return { data: { pay_link: null, paypal_link: null }, error: null };
      },
    };
    // There is deliberately no insert/update/delete/upsert/rpc provider boundary.
    return query;
  } };
  const admin = load('src/lib/web-gratis/admin.ts', {
    crypto, './config': config, './http': http,
  }, token === null ? {} : { WEB_GRATIS_ADMIN_TOKEN: token });
  const route = load('src/app/api/web-gratis/admin/export/route.ts', {
    '@/lib/web-gratis/admin': admin,
    '@/lib/web-gratis/billing': { billingTimeline: () => undefined },
    '@/lib/web-gratis/config': config,
    '@/lib/web-gratis/http': http,
    '@/lib/web-gratis/server': {
      getDb: () => db, SETTINGS_TABLE: SETTINGS, SIGNUPS_TABLE: SIGNUPS,
      svDate: date => new Date(date.getTime() - 6 * 3600000).toISOString().slice(0, 10),
    },
    '@/lib/web-gratis/templates': { hasPaymentMethod: () => false, PAYMENT_TEMPLATES: [] },
    '@/lib/web-gratis/whatsapp': { isTestSignupName: name => /^ZZ /.test(name), MESSAGES_TABLE: MESSAGES },
  });
  return {
    reads,
    get: (authorization = `Bearer ${ADMIN_TOKEN}`) => route.GET(new Request(
      'https://example.invalid/api/web-gratis/admin/export?view=todas',
      { headers: authorization === null ? {} : { authorization } },
    )),
  };
}

// Parse the delivered CSV, including quoted commas/newlines and doubled quotes.
// This does not reimplement the exporter or its escaping decisions.
function parseCsv(csv) {
  const records = [];
  let record = [], field = '', quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (char === '"') {
      if (quoted && csv[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (char === ',' || char === '\r' || char === '\n')) {
      record.push(field); field = '';
      if (char !== ',') {
        records.push(record); record = [];
        if (char === '\r' && csv[i + 1] === '\n') i++;
      }
    } else field += char;
  }
  assert.equal(quoted, false, 'CSV must not contain an unterminated quoted field');
  record.push(field); records.push(record);
  return records;
}

async function exported(f) {
  const response = await f.get();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/csv; charset=utf-8');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.deepEqual(Array.from(bytes.subarray(0, 3)), [0xef, 0xbb, 0xbf]);
  return parseCsv(bytes.subarray(3).toString('utf8'));
}

test('preserves all 52 original columns in order, then appends four existing queue fields', async () => {
  const [headers, values] = await exported(fixture([row()]));
  assert.deepEqual(headers, [...ORIGINAL_HEADERS, ...APPENDED_HEADERS]);
  assert.equal(values.length, headers.length);
  assert.equal(values[headers.indexOf('negocio')], 'Negocio sintético');
  assert.equal(values[headers.indexOf('servicios')], 'Servicio verificado');
  assert.equal(values[headers.indexOf('notas')], 'Nota previa');
  assert.equal(values[headers.indexOf('whatsapp')], "'+50370000000");
  assert.deepEqual(values.slice(ORIGINAL_HEADERS.length), [
    ID, '2026-10-08T15:30:00.000Z', 'Confirmar horario con el cliente', 'no_contesto',
  ]);
});

test('stable signup IDs distinguish equal business/contact labels and survive row reordering', async () => {
  const first = row({ id: ID, follow_up_note: 'Primera solicitud' });
  const second = row({ id: OTHER_ID, follow_up_note: 'Otra solicitud' });
  const join = records => {
    const [headers, ...values] = records;
    return Object.fromEntries(values.map(value => [value[headers.indexOf('signup_id')], value[headers.indexOf('nota_seguimiento')]]));
  };
  const forward = join(await exported(fixture([first, second])));
  const reverse = join(await exported(fixture([second, first])));
  assert.deepEqual(forward, { [ID]: 'Primera solicitud', [OTHER_ID]: 'Otra solicitud' });
  assert.deepEqual(reverse, forward);
});

test('nullable and absent legacy queue fields are blank without hiding the stable ID', async () => {
  const nullable = row({ next_follow_up_at: null, follow_up_note: null, last_call_outcome: null });
  const legacy = row({ id: OTHER_ID });
  delete legacy.next_follow_up_at;
  delete legacy.follow_up_note;
  delete legacy.last_call_outcome;
  const [, nullValues, absentValues] = await exported(fixture([nullable, legacy]));
  assert.deepEqual(nullValues.slice(ORIGINAL_HEADERS.length), [ID, '', '', '']);
  assert.deepEqual(absentValues.slice(ORIGINAL_HEADERS.length), [OTHER_ID, '', '', '']);
});

test('follow-up note round-trips commas, quotes, accents and embedded CRLF within one cell', async () => {
  const note = 'Llamar a María, preguntar "horario"\r\nNo cambiar la fecha original.';
  const [headers, values] = await exported(fixture([row({ follow_up_note: note })]));
  assert.equal(values.length, headers.length);
  assert.equal(values[headers.indexOf('nota_seguimiento')], note);
});

for (const prefix of ['=', '+', '-', '@', '\t', '\r']) {
  test(`existing spreadsheet-formula protection applies to appended notes: ${JSON.stringify(prefix)}`, async () => {
    const note = `${prefix}synthetic-formula(1)`;
    const [headers, values] = await exported(fixture([row({ follow_up_note: note })]));
    assert.equal(values[headers.indexOf('nota_seguimiento')], `'${note}`);
  });
}

for (const outcome of ['contestada', 'no_contesto', 'numero_malo']) {
  test(`exports existing call outcome without changing its meaning: ${outcome}`, async () => {
    const [headers, values] = await exported(fixture([row({ last_call_outcome: outcome })]));
    assert.equal(values[headers.indexOf('resultado_ultima_llamada')], outcome);
  });
}

test('empty export retains the complete header contract', async () => {
  assert.deepEqual(await exported(fixture([])), [[...ORIGINAL_HEADERS, ...APPENDED_HEADERS]]);
});

test('unchanged admin guard refuses unauthorized requests before any database read', async () => {
  for (const authorization of [null, 'Bearer incorrect-fixture']) {
    const f = fixture([row()]);
    assert.equal((await f.get(authorization)).status, 401);
    assert.deepEqual(f.reads, []);
  }
  const absent = fixture([row()], { token: null });
  assert.equal((await absent.get()).status, 503);
  assert.deepEqual(absent.reads, []);
});
