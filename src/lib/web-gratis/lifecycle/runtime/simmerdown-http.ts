import { z } from 'zod';
import { SimmerRuntime } from './simmerdown';
import type { AuthenticatedSubject } from './http';
import type { Principal } from '../core';
import { requireThat } from '../core';
const safe = (v: unknown) => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; form-action 'self' https://checkout.stripe.com; frame-ancestors 'none'; base-uri 'none'" };
/** Unmounted concrete handlers for one explicitly configured SimmerDown binding. */
export function simmerdownHttp(o: {
    runtime: SimmerRuntime;
    authenticate: (r: Request) => Promise<AuthenticatedSubject | null>;
    webhookSecret: string;
}) {
    return async (request: Request) => {
        try {
            const u = new URL(request.url), runtime = o.runtime;
            requireThat(u.origin === new URL(runtime.o.origin).origin, 'origin_mismatch');
            if (u.pathname === '/api/billing/simmerdown/webhook') {
                requireThat(request.method === 'POST', 'method_not_allowed');
                const raw = await request.text();
                requireThat(Buffer.byteLength(raw) <= 1000000, 'body_too_large');
                return Response.json({ result: await runtime.webhook(raw, request.headers.get('stripe-signature'), o.webhookSecret) }, { headers });
            }
            const actor = await o.authenticate(request);
            if (!actor)
                return Response.json({ error: 'authentication_required' }, { status: 401, headers });
            const q = await runtime.o.store.connection(db => db.query('SELECT r.state,b.role FROM billing_private.records r JOIN billing_private.identity_bindings b ON b.record_key=r.record_key WHERE r.record_key=$1 AND r.program=$2 AND r.account_id=$3 AND r.livemode=$4 AND b.issuer=$5 AND b.subject=$6 AND b.revoked_at IS NULL', [runtime.key, runtime.scope.program, runtime.scope.account, runtime.scope.livemode, actor.issuer, actor.subject]));
            requireThat(q.rows.length === 1 && ['client', 'operator'].includes(String(q.rows[0].role)), 'authenticated_binding_required');
            const role = q.rows[0].role as Principal['role'], principal: Principal = { ownerId: runtime.scope.ownerId, tenantId: runtime.scope.tenantId, subject: actor.subject, role };
            const authed = new SimmerRuntime({ ...runtime.o, actor: { ...actor, role } }), state = await authed.transaction(principal, s => structuredClone(s));
            if (request.method === 'GET') {
                requireThat(['/billing/simmerdown', '/billing/simmerdown/receipt'].includes(u.pathname), 'route_not_found');
                const a = state.agreement, at = new Intl.DateTimeFormat('es', { timeZone: a.billingTimeZone, dateStyle: 'long', timeStyle: 'short' }).format(new Date(a.nextChargeAt * 1000));
                const form = role === 'client' && !a.acceptedByClient ? `<form method="post" action="/api/billing/simmerdown/accept"><label><input type="checkbox" name="acceptedSchedule" required>Acepto USD300 mensuales, impuestos incluidos, desde ${safe(at)} (${safe(a.billingTimeZone)}) y luego cada día1.</label><input type="hidden" name="nextChargeAt" value="${a.nextChargeAt}"><button>Aceptar calendario</button></form>` : role === 'client' && !state.billing.canceled && !state.billing.subscriptionId ? '<form method="post" action="/api/billing/simmerdown/checkout"><button>Verificar octubre y continuar</button></form>' : '';
                return new Response(`<!doctype html><html lang="es"><meta charset="utf-8"><title>SimmerDown · mantenimiento</title><body><h1>USD300 mensuales, impuestos incluidos</h1><p>Próximo cobro: ${safe(at)} (${safe(a.billingTimeZone)}).</p><p>${state.billing.octoberPayment || state.billing.octoberInvoiceId ? 'Pago de octubre registrado; octubre no se cobra otra vez.' : 'Pago de octubre pendiente de verificación. No se abrirá otra vía de cobro mientras exista incertidumbre.'}</p>${form}<p>La aceptación del calendario mensual es independiente del pago único de octubre.</p></body></html>`, { headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } });
            }
            requireThat(request.method === 'POST' && request.headers.get('origin') === u.origin && (!request.headers.get('sec-fetch-site') || request.headers.get('sec-fetch-site') === 'same-origin'), 'csrf_origin_mismatch');
            const raw = await request.text();
            requireThat(Buffer.byteLength(raw) <= 65536, 'body_too_large');
            const isForm = request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded');
            const fields = new URLSearchParams(raw);
            if (isForm)
                requireThat([...fields.keys()].every(k => fields.getAll(k).length === 1), 'duplicate_form_field');
            else
                requireThat(request.headers.get('content-type')?.startsWith('application/json'), 'content_type_required');
            const input = isForm ? Object.fromEntries(fields) : JSON.parse(raw);
            let result: unknown;
            const path = u.pathname;
            if (path === '/api/billing/simmerdown/accept') {
                const accepted = z.object({ acceptedSchedule: z.literal(true), nextChargeAt: z.number().int().positive() }).strict().parse(isForm ? { acceptedSchedule: input.acceptedSchedule === 'on', nextChargeAt: Number(input.nextChargeAt) } : input);
                requireThat(accepted.nextChargeAt === state.agreement.nextChargeAt, 'schedule_changed');
                result = await authed.accept(principal);
            }
            else if (path === '/api/billing/simmerdown/checkout') {
                z.object({}).strict().parse(input);
                requireThat(role === 'client', 'client_required');
                result = await authed.checkout(principal);
            }
            else if (path === '/api/billing/simmerdown/approve-combined') {
                requireThat(role === 'operator', 'operator_required');
                const p = z.object({ evidence: z.string().min(1).max(500) }).strict().parse(input);
                result = await authed.approveCombined(principal, p.evidence);
            }
            else if (path === '/api/billing/simmerdown/reconcile') {
                requireThat(role === 'operator', 'operator_required');
                z.object({}).strict().parse(input);
                result = await authed.reconcile(principal);
            }
            else if (path === '/api/billing/simmerdown/withdraw') {
                const p = z.object({ evidence: z.string().min(1).max(500) }).strict().parse(input);
                result = await authed.withdraw(principal, p.evidence);
            }
            else
                throw Error('route_not_found');
            if (isForm && typeof result === 'object' && result && 'url' in result)
                return new Response(null, { status: 303, headers: { ...headers, Location: String(result.url) } });
            if (isForm)
                return new Response(null, { status: 303, headers: { ...headers, Location: '/billing/simmerdown' } });
            return Response.json({ result: result ?? 'ok' }, { headers });
        }
        catch (e) {
            const m = e instanceof Error ? e.message : '';
            const status = e instanceof z.ZodError ? 400 : /authentication|binding|actor|csrf|origin|operator_required|client_required/.test(m) ? 403 : m === 'route_not_found' ? 404 : 503;
            return Response.json({ error: status === 403 ? 'access_denied' : 'billing_action_held' }, { status, headers });
        }
    };
}
