/** Offline visual QA; no server, credentials, remote calls or real customer data. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Calendar from '../../src/app/admin/web-gratis/BillingLifecycleCalendar';
import { newLifecycle, accept, approve, confirmGoLive, prepareReminder, sophiaSnapshot, type Lifecycle } from '../../src/lib/web-gratis/lifecycle/core';
const now = Date.parse('2026-10-18T18:00:00Z') / 1000, start = now - 15 * 86400;
const operator = { role: 'operator' as const, subject: 'Operador de ejemplo', ownerId: 'fixture_owner', tenantId: 'fixture_tenant' };
const client = { ...operator, role: 'client' as const, subject: 'Cliente de ejemplo' };
const make = (id: string) => newLifecycle({ ownerId: operator.ownerId, tenantId: operator.tenantId, signupId: id, siteId: 'site_' + id }, 'michoacana_fixture');
function activate(s: Lifecycle) { accept(s, client, { siteVersion: 2, terms: 'oferta-fixture-v1', cents: s.plan.cents, currency: 'usd', interval: 'month', approveSiteAndGoLive: true, agreeBilling: true, remindersAgreed: true, evidence: 'Aceptación explícita · datos ficticios' }, start); approve(s, operator, 2, 'Aprobación de ejemplo', start); confirmGoLive(s, operator, { mode: 'accepted_go_live', siteId: s.siteId, signupId: s.signupId, siteVersion: 2, served: true, evidence: 'Publicación verificada de ejemplo' }, start); return s; }
const records = [{ name: 'Concepto aún sin aceptación', state: make('concept_fixture') }, { name: 'Cliente estándar · día 15', state: activate(make('standard_fixture')) }, { name: 'Excepción Michoacana · ejemplo de USD 19', state: activate(make('michoacana_fixture')) }];
const html = renderToStaticMarkup(createElement(Calendar, { records, principal: operator, now, timezone: 'America/El_Salvador' }));
mkdirSync('../evidence', { recursive: true });
writeFileSync('../evidence/calendar-preview.html', `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Calendario de facturación · ejemplos</title><style>body{font:16px system-ui,sans-serif;background:#f4f6f8;color:#172a38;margin:0;padding:30px}section{max-width:1080px;margin:auto}h2{font-size:30px}article{background:white;border:1px solid #ccd6de;border-radius:14px;padding:24px;margin:22px 0}dl{display:grid;grid-template-columns:220px 1fr;gap:10px}dt{font-weight:600}dd{margin:0}table{width:100%;border-collapse:collapse;text-align:left}th,td{padding:12px;border-bottom:1px solid #dee5ea}caption{text-align:left;font-weight:700;padding:12px 0}details{margin-top:18px}summary{cursor:pointer}@media(max-width:600px){body{padding:12px}article{padding:16px}dl{grid-template-columns:1fr;gap:6px}dd{margin-bottom:9px}table{font-size:12px}th,td{padding:6px}}</style>${html}</html>`);
writeFileSync('../evidence/spanish-reminder-drafts.md', records.slice(1).map(({ name, state }) => `## ${name}\n\n${[15, 20].map(day => prepareReminder(state, operator, day as 15 | 20, start + day * 86400, 'https://billing.example.test/ENLACE_PERSONAL_PENDIENTE', 'America/El_Salvador').text).join('\n\n')}`).join('\n\n'));
writeFileSync('../evidence/sophia-contract-fixture.json', JSON.stringify(sophiaSnapshot(records[1].state, operator, now), null, 2));
