import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { billingTimeline, type BillingSignup, type BillingTimeline } from "../../src/lib/web-gratis/billing";

const root = resolve(__dirname, "../..");
const JA = "1afdbfc5-8703-4ecd-9405-fa2aebb4d708";
const OTHER = "00000000-0000-4000-8000-000000000001";
const fixture = (id: string): BillingSignup => ({ id, status: "entregada", business_name: "Fixture", whatsapp: "+50370000000", referral_code: "FIXTUR", delivered_at: "2026-09-26T15:00:00Z", free_until: "2026-10-26", activated_at: null, paused_at: null, paid_via: null, paid_through: null, declined_at: null, opted_out_at: null, no_whatsapp_at: null });

/** Execute the production component/context in memory; exports and read stubs exist only in this test. */
function loadPrivate(relative: string, names: string[], stubs: Record<string, unknown> = {}) {
  const filename = resolve(root, relative);
  const compiled = ts.transpileModule(`${readFileSync(filename, "utf8")}\nexport { ${names.join(", ")} };`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  const local = createRequire(filename);
  const sandboxModule = { exports: {} as Record<string, unknown> };
  const safeRequire = (id: string) => {
    if (Object.hasOwn(stubs, id)) return stubs[id];
    if (id.endsWith(".module.css")) return {};
    if (id.startsWith("@/")) return local(resolve(root, "src", id.slice(2)));
    return local(id);
  };
  const run = vm.runInNewContext(`(function(require,module,exports){${compiled}\n})`, { console, URL, Date, Set, Map, Intl, Buffer, process: { env: {} } }, { filename });
  run(safeRequire, sandboxModule, sandboxModule.exports);
  return sandboxModule.exports;
}

const board = loadPrivate("src/app/admin/web-gratis/BoardClient.tsx", ["BillingRow", "expiryHoldDescription"], {
  "./ReviewedSiteEditor": { __esModule: true, default: () => null },
});
const BillingRow = board.BillingRow as ComponentType<{ t: BillingTimeline; info: { status: BillingSignup["status"] }; paypalLink: string; today: string; onPatch: () => Promise<boolean> }>;
const renderRow = (id: string, overrides: Partial<BillingSignup> = {}) => renderToStaticMarkup(createElement(BillingRow, {
  t: billingTimeline({ ...fixture(id), ...overrides }, [], new Date("2026-10-24T16:00:00Z"), { hasPaymentMethod: true }),
  info: { status: overrides.status ?? "entregada" }, paypalLink: "https://example.invalid/pay", today: "2026-10-24",
  onPatch: async () => { throw new Error("A render must never write"); },
}));

test("JA billing render shows the clock-derived period and contextual consent and no payment send/link/activation controls", () => {
  const html = renderRow(JA);
  assert.match(html, /Dentro del período programado según el reloj/);
  assert.match(html, /Fechas confirmadas por respuesta en contexto/);
  assert.match(html, /no registra una activación/);
  assert.match(html, /Vencimiento legado retenido/);
  assert.match(html, /Sin activación de pago registrada/);
  for (const forbidden of ["WhatsApp: pedir el pago", "Pagó (PayPal)", "Pagó (a mano)", "Copiar enlace de pago", "wa.me/", "Vence pronto"]) assert.ok(!html.includes(forbidden), forbidden);
  const ordinary = renderRow(OTHER);
  assert.match(ordinary, /WhatsApp: pedir el pago/);
  assert.match(ordinary, /Pagó \(PayPal\)/);
  assert.match(ordinary, /wa.me\//);
  assert.ok(!ordinary.includes("Vencimiento legado retenido"));
});

test("synthetic approved interval descriptions distinguish scheduled, active and ended without activating payment", () => {
  const value = billingTimeline(fixture(JA), [], new Date("2026-10-19T16:00:00Z"), { hasPaymentMethod: true });
  const describe = board.expiryHoldDescription as (timeline: BillingTimeline) => string;
  for (const [phase, phrase] of [["scheduled", "aún no iniciado"], ["active", "Dentro del período programado según el reloj"], ["ended", "revisión manual pendiente"]] as const) {
    const synthetic: BillingTimeline = { ...value, expiryHold: { ...value.expiryHold!, phase, startsAt: "2026-10-20T15:00:00.000Z", endsAt: "2026-11-19T15:00:00.000Z" } };
    assert.ok(describe(synthetic).includes(phrase));
    assert.ok(describe(synthetic).includes("Esta retención no activa cobros"));
    assert.ok(describe(synthetic).includes("9:00"));
  }
});

test("unexpected JA Stripe activation renders its real payment state and warns that the hold does not cancel provider charges", () => {
  const html = renderRow(JA, { status: "activa", paid_via: "stripe", activated_at: "2026-10-01T16:00:00Z", paid_through: "2026-10-31" });
  assert.match(html, /Pagando/);
  assert.match(html, /Cobro automático \(Stripe\)/);
  assert.match(html, /Stripe renueva solo/);
  assert.match(html, /Hay activación o datos de pago registrados/);
  assert.match(html, /esta retención no cancela cobros del proveedor/);
  assert.ok(!html.includes("Sin activación de pago registrada"));
  for (const forbidden of ["Recordatorio día 28", "Pausa automática", "WhatsApp: pedir el pago", "Pagó (PayPal)", "wa.me/"]) assert.ok(!html.includes(forbidden), forbidden);
});

test("bridge context suppresses only JA operative legacy deadline and retains history without changing activation", async () => {
  let reads = 0;
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "not", "in", "order", "limit"]) query[method] = () => query;
  query.maybeSingle = async () => { reads++; return { data: null, error: null }; };
  const bridgeModule = loadPrivate("src/lib/web-gratis/bridge.ts", ["buildContext"], {
    "./server": { SIGNUPS_TABLE: "fixture", getDb: () => ({ from: () => query }), loadSettings: async () => null },
    "./admin": { signupCountry: () => "SV" },
    "./outbox": { enqueueSystem: () => { throw new Error("No alerts allowed"); } },
    "./whatsapp": { MESSAGES_TABLE: "fixture_messages" },
  });
  const context = bridgeModule.buildContext as (row: Record<string, unknown>) => Promise<Record<string, unknown>>;
  const extra = { business_type: "artesanía", city: "fixture", lang: "es", step: 6, quick_capture_at: null, services: [] };
  const ja = await context({ ...fixture(JA), ...extra });
  assert.equal(ja.freeUntil, null);
  assert.equal(ja.legacyFreeUntil, "2026-10-26");
  assert.equal(ja.paymentRequestsAllowed, false);
  assert.equal(ja.activated, false);
  assert.ok(["scheduled", "active", "ended"].includes((ja.expiryHold as Record<string, unknown>).phase as string));
  assert.equal((ja.expiryHold as Record<string, unknown>).phaseBasis, "configured_window_clock");
  assert.equal((ja.expiryHold as Record<string, unknown>).actualActivationObservedAt, null);
  assert.equal((ja.expiryHold as Record<string, unknown>).consentBasis, "contextual_affirmative");
  const ordinary = await context({ ...fixture(OTHER), ...extra });
  assert.equal(ordinary.freeUntil, "2026-10-26");
  assert.equal(ordinary.activated, false);
  assert.equal(Object.hasOwn(ordinary, "expiryHold"), false);
  assert.equal(Object.hasOwn(ordinary, "legacyFreeUntil"), false);
  assert.equal(Object.hasOwn(ordinary, "paymentRequestsAllowed"), false);
  assert.equal(reads, 2);
});
