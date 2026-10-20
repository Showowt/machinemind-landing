import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JA_ANALYTICS_SITE_ID, JA_ANALYTICS_SIGNUP_ID, isJaQaRunId, type JaQaRunStats } from "../../src/lib/web-gratis/sites/analytics-shared";
import type { SiteSummary } from "../../src/lib/web-gratis/sites/shared";

const root = resolve(__dirname, "../..");
const OTHER = "11111111-2222-4333-8444-555555555555";
function loadPrivate(relative: string, names: string[] = [], stubs: Record<string, unknown> = {}) {
  const filename = resolve(root, relative);
  const compiled = ts.transpileModule(`${readFileSync(filename, "utf8")}\n${names.length ? `export { ${names.join(", ")} };` : ""}`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: filename,
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
const qaModule = loadPrivate("src/app/admin/web-gratis/JaAnalyticsPanel.tsx");
const board = loadPrivate("src/app/admin/web-gratis/BoardClient.tsx", ["SitePanel"], {
  "./ReviewedSiteEditor": { __esModule: true, default: () => null },
  "./JaAnalyticsPanel": { __esModule: true, ...qaModule },
});
const Readout = qaModule.JaQaReadout as ComponentType<{ qa: JaQaRunStats | null; error: string | null }>;
const Panel = board.SitePanel as ComponentType<Record<string, unknown>>;
const noAction = () => { throw new Error("Offline render must not write, call a provider or use a real API"); };
const site = (siteId = JA_ANALYTICS_SITE_ID, signupId = JA_ANALYTICS_SIGNUP_ID): SiteSummary => ({
  id: siteId, signupId, slug: "synthetic", status: "published", version: 6, generatingNow: false,
  generationAttempts: 0, generationError: null, instructions: null, generatedAt: null, publishedAt: "2026-09-26T00:00:00Z",
  pausedAt: null, updatedAt: "2026-10-20T00:00:00Z", publicUrl: "https://synthetic.invalid", previewUrl: null, exportUrl: null,
  customDomain: null, domainStatus: null, stats: { views30: 42, whatsapp30: 3 }, notes: null, unread: [], guards: [],
});
function renderPanel(value: SiteSummary, rowId = value.signupId) {
  return renderToStaticMarkup(createElement(Panel, { row: { id: rowId, status: "entregada", business_name: "SYNTHETIC", submitted_at: null },
    site: value, config: null, siteApi: noAction, onSite: noAction, onReload: noAction }));
}
const sample: JaQaRunStats = {
  siteId: JA_ANALYTICS_SITE_ID, runId: "ja-20261020-qa1", synthetic: true, excludedFromBusinessTotals: true,
  windowStart: "2026-10-13T01:00:00.000Z", windowEnd: "2026-10-20T01:00:00.000Z", observedAt: "2026-10-20T01:00:00.000Z",
  latestAt: "2026-10-20T00:55:00.000Z", counts: { view: 1, whatsapp_click: 0, call_click: 0, map_click: 0, social_click: 0, email_click: 0 },
};

test("JA dashboard labels loads accurately and separates QA while preserving existing ordinary-client wording", () => {
  const html = renderPanel(site());
  assert.match(html, /42<\/b> cargas de página/);
  assert.match(html, /excluye QA/);
  assert.match(html, /no son personas únicas/);
  assert.match(html, /Analítica: prueba sintética separada/);
  assert.match(html, /Consultar prueba/);
  assert.match(html, /«Actualizar» vuelve a consultar el ID seleccionado/);
  assert.ok(!html.includes("42</b> visitas"));
  const other = renderPanel(site(OTHER, OTHER));
  assert.match(other, /42<\/b> visitas/);
  assert.ok(!other.includes("prueba sintética"));
  assert.ok(!other.includes("excluye QA"));
});

test("JA QA panel requires the exact site and signup pair", () => {
  assert.ok(!renderPanel(site(JA_ANALYTICS_SITE_ID, OTHER)).includes("prueba sintética"));
  assert.ok(!renderPanel(site(OTHER, JA_ANALYTICS_SIGNUP_ID)).includes("prueba sintética"));
  assert.ok(!renderPanel(site(), OTHER).includes("prueba sintética"));
});

test("missing business statistics show unavailable rather than a false zero", () => {
  const html = renderPanel({ ...site(), stats: null });
  assert.match(html, /Métricas del negocio no disponibles; no equivale a cero eventos/);
  assert.ok(!html.includes("0</b> cargas de página"));
});

test("QA readout exposes aggregate counts, run and timestamps with explicit synthetic and event limitations", () => {
  const html = renderToStaticMarkup(createElement(Readout, { qa: sample, error: null }));
  assert.match(html, /Prueba sintética/); assert.match(html, /excluida de los totales del negocio/);
  assert.match(html, /1<\/b> cargas de página/); assert.match(html, /0<\/b> clics a WhatsApp/);
  assert.match(html, /7 días/); assert.ok(html.includes(sample.observedAt)); assert.ok(html.includes(sample.latestAt!));
  assert.match(html, /no personas únicas, mensajes enviados ni ventas/);
  assert.ok(!/ua_hash|fingerprint|IP|user.agent/.test(html));
});

test("failed QA read hides stale counts and explicitly avoids false-zero confirmation", () => {
  const html = renderToStaticMarkup(createElement(Readout, { qa: sample, error: "Consulta no disponible." }));
  assert.match(html, /No se muestran ceros ni resultados anteriores como confirmación/);
  assert.ok(!html.includes(sample.runId)); assert.ok(!html.includes("1</b>"));
  const initial = renderToStaticMarkup(createElement(Readout, { qa: null, error: null }));
  assert.match(initial, /Una respuesta del beacon por sí sola no confirma/);
});

test("the client/server shared run validator rejects trailing newline and unexpected information", () => {
  for (const value of ["a\n", "a\r", "a\r\n", "person@example.com", "a/b", "a?b", "", "a".repeat(41)]) assert.equal(isJaQaRunId(value), false);
  for (const value of ["a", "ja-20261020-qa1", "a".repeat(40)]) assert.equal(isJaQaRunId(value), true);
});
