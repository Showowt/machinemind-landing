import { z } from 'zod';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import BillingLifecycleCalendar from '@/app/admin/web-gratis/BillingLifecycleCalendar';
import { billingService, type Dependencies } from '../service';
import { requireThat, nextAction, sophiaSnapshot, type Identity } from '../core';
import { sha256 } from '../checkout';
import { PostgresWebsiteRepository } from './postgres';
import { StripeClient, stripeWebsiteProvider } from './stripe';
import { recoverWebsite } from './recovery';
import { signedSophiaProjection } from './integration';
import type { PriceCatalog } from '../checkout';
const esc = (v: unknown) => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; form-action 'self' https://checkout.stripe.com; frame-ancestors 'none'; base-uri 'none'" };
const json = (value: unknown, status = 200) => Response.json(value, { status, headers });
export type AuthenticatedSubject = {
    issuer: string;
    subject: string;
};
export type RuntimeOptions = {
    repository: PostgresWebsiteRepository;
    stripe: StripeClient;
    now: () => number;
    origin: string;
    signingKey: string;
    webhookSecret: string;
    catalog: PriceCatalog;
    agreement: {
        revision: string;
        summary: string;
    };
    displayTimezone: string;
    bridgeSecret?: string;
    /** Must verify the existing approved session cryptographically before returning.
     * No header/body/phone inference. Missing approved issuer/session contract is a gate. */
    authenticate: (request: Request) => Promise<AuthenticatedSubject | null>;
    verifyPublication: NonNullable<Dependencies['verifyPublication']>;
};
const acceptSchema = z.object({ siteVersion: z.number().int().positive(), terms: z.string().min(1).max(100), cents: z.union([z.literal(1900), z.literal(2000)]), currency: z.literal('usd'), interval: z.literal('month'), approveSiteAndGoLive: z.literal(true), agreeBilling: z.literal(true), remindersAgreed: z.boolean(), evidence: z.string().min(1).max(500) }).strict();
const confirmationSchema = z.object({ confirmed: z.literal(true), cents: z.union([z.literal(1900), z.literal(2000)]), currency: z.literal('usd'), interval: z.literal('month'), trialEnd: z.number().int().positive(), terms: z.string().min(1).max(100), generation: z.number().int().positive(), evidence: z.string().min(1).max(500) }).strict();
async function body(request: Request) {
    requireThat(Number(request.headers.get('content-length') ?? 0) <= 65536, 'body_too_large');
    const raw = await request.text();
    requireThat(Buffer.byteLength(raw) <= 65536, 'body_too_large');
    const type = request.headers.get('content-type')?.split(';')[0];
    if (type === 'application/json')
        return z.record(z.string(), z.unknown()).parse(JSON.parse(raw));
    requireThat(type === 'application/x-www-form-urlencoded', 'content_type_required');
    const form = new URLSearchParams(raw), out: Record<string, unknown> = {};
    for (const [k, v] of form) {
        requireThat(!(k in out), 'duplicate_form_field');
        out[k] = v;
    }
    return out;
}
/** Factory is not mounted by any Next route. Fully executable with explicitly supplied
 * approved dependencies; no environment discovery, feature flag or send scheduler. */
export function billingHttp(options: RuntimeOptions) {
    const origin = new URL(options.origin);
    requireThat(origin.protocol === 'https:' && origin.href === `${origin.origin}/`, 'trusted_origin_required');
    const baseDeps = { repository: options.repository, provider: stripeWebsiteProvider(options.stripe, id => options.repository.loadAttempt(id)), now: options.now, signingKey: options.signingKey, webhookSecret: options.webhookSecret, catalog: options.catalog, account: options.stripe.account, livemode: options.stripe.livemode, origin: origin.origin, verifyPublication: options.verifyPublication, recordLocator: (i: Identity) => options.repository.key(i) };
    const webhookService = billingService(baseDeps);
    return async (request: Request): Promise<Response> => {
        try {
            const url = new URL(request.url);
            requireThat(url.origin === origin.origin, 'request_origin_mismatch');
            if (url.pathname === '/api/web-gratis/billing/webhook') {
                if (request.method !== 'POST')
                    return json({ error: 'method_not_allowed' }, 405);
                requireThat(Number(request.headers.get('content-length') ?? 0) <= 1000000, 'body_too_large');
                const raw = await request.text();
                requireThat(Buffer.byteLength(raw) <= 1000000, 'body_too_large');
                return json({ result: await webhookService.webhook(raw, request.headers.get('stripe-signature')) });
            }
            const actor = await options.authenticate(request);
            if (!actor)
                return json({ error: 'authentication_required' }, 401);
            requireThat(!!actor.issuer && !!actor.subject, 'authentication_required');
            let key = url.searchParams.get('record');
            if (!key && (url.searchParams.has('site_id') || url.searchParams.has('session_id'))) {
                const q = await options.repository.store.connection(db => db.query('SELECT DISTINCT r.record_key FROM billing_private.records r JOIN billing_private.identity_bindings b ON b.record_key=r.record_key LEFT JOIN billing_private.provider_objects p ON p.record_key=r.record_key WHERE r.program=$1 AND r.account_id=$2 AND r.livemode=$3 AND b.issuer=$4 AND b.subject=$5 AND b.revoked_at IS NULL AND (r.site_id::text=$6 OR (p.object_kind=\'session\' AND p.object_id=$7))', [baseDeps.repository.scope.program, options.stripe.account, options.stripe.livemode, actor.issuer, actor.subject, url.searchParams.get('site_id'), url.searchParams.get('session_id')]));
                requireThat(q.rows.length === 1, 'authenticated_binding_required');
                key = String(q.rows[0].record_key);
            }
            requireThat(key && /^[a-f0-9]{64}$/.test(key), 'record_required');
            const bound = await options.repository.authorize(key, actor), { identity, principal, state } = bound;
            const repository = options.repository.forActor({ ...actor, role: principal.role });
            const service = billingService({ ...baseDeps, repository });
            if (request.method === 'GET') {
                if (url.pathname === '/api/admin/web-gratis/billing-calendar') {
                    requireThat(principal.role === 'operator', 'operator_required');
                    return json(await service.calendar(identity, principal));
                }
                if (url.pathname === '/api/web-gratis/billing/snapshot') {
                    requireThat(principal.role === 'operator', 'operator_required');
                    if (options.bridgeSecret) {
                        const signed = signedSophiaProjection(state, principal, options.now(), options.bridgeSecret);
                        return new Response(signed.body, { headers: { ...headers, ...signed.headers } });
                    }
                    return json(sophiaSnapshot(state, principal, options.now()));
                }
                if (url.pathname === '/admin/web-gratis/billing') {
                    requireThat(principal.role === 'operator', 'operator_required');
                    return new Response('<!doctype html>' + renderToStaticMarkup(createElement(BillingLifecycleCalendar, { records: [{ name: 'Sitio autorizado', state }], principal, now: options.now(), timezone: options.displayTimezone })), { headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } });
                }
                requireThat(['/web/billing', '/web/billing/receipt'].includes(url.pathname), 'route_not_found');
                const site = await options.repository.site(identity), post = (action: string) => `/api/web-gratis/billing/${action}?record=${key}`;
                const hidden = (name: string, value: unknown) => `<input type="hidden" name="${name}" value="${esc(value)}">`;
                const token = url.searchParams.get('token') ?? '';
                let formHtml = '';
                if (principal.role === 'client' && !state.acceptance) {
                    formHtml = `<form method="post" action="${post('accept')}">${hidden('siteVersion', site.version)}${hidden('cents', state.plan.cents)}${hidden('currency', 'usd')}${hidden('interval', 'month')}${hidden('terms', options.agreement.revision)}<p>${esc(options.agreement.summary)}</p><label><input type="checkbox" name="approveSiteAndGoLive" required>Acepto el sitio y autorizo publicarlo.</label><label><input type="checkbox" name="agreeBilling" required>Acepto USD ${(state.plan.cents / 100).toFixed(2)} mensuales después de 30 días desde su publicación aceptada.</label><label><input type="checkbox" name="remindersAgreed">Acepto recordatorios de configuración en los días 15 y 20.</label><button>Aceptar</button></form>`;
                }
                else if (principal.role === 'client' && state.goLiveAt && state.enrollment === 'none' && !state.withdrawnAt && token) {
                    const late = options.now() >= state.trialEnd!;
                    formHtml = `<form method="post" action="${post('checkout')}">${hidden('token', token)}${late ? `<label><input type="checkbox" name="confirmed" required>Autorizo USD ${(state.plan.cents / 100).toFixed(2)} ahora y cada mes. No se cobran días anteriores.</label>` : ''}<button>${late ? 'Confirmar importe y continuar' : 'Configurar pago para la fecha acordada'}</button></form>`;
                }
                return new Response(`<!doctype html><html lang="es"><meta charset="utf-8"><title>Facturación de su sitio</title><body><h1>Su sitio · USD ${(state.plan.cents / 100).toFixed(2)} al mes</h1><p>${esc(nextAction(state, options.now()))}</p>${state.trialEnd ? `<p>Fecha fija del primer cobro: ${esc(new Date(state.trialEnd * 1000).toISOString())}. Los 30 días no se reinician.</p>` : ''}${formHtml}<p>Una visita a esta página no registra aceptación ni confirma un pago.</p></body></html>`, { headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } });
            }
            if (request.method !== 'POST')
                return json({ error: 'method_not_allowed' }, 405);
            requireThat(request.headers.get('origin') === origin.origin && (!request.headers.get('sec-fetch-site') || request.headers.get('sec-fetch-site') === 'same-origin'), 'csrf_origin_mismatch');
            const input = await body(request), action = url.pathname.replace('/api/web-gratis/billing/', '');
            const isForm = request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded');
            let result: unknown;
            if (action === 'accept') {
                if (isForm) {
                    input.siteVersion = Number(input.siteVersion);
                    input.cents = Number(input.cents);
                    for (const k of ['approveSiteAndGoLive', 'agreeBilling', 'remindersAgreed'])
                        input[k] = input[k] === 'on';
                    input.evidence = 'client-form'; // Forms have no caller-supplied evidence requirement.
                }
                const accepted = acceptSchema.parse(input);
                requireThat(accepted.terms === options.agreement.revision, 'agreement_revision_changed');
                // Bind the normalized agreement to the authenticated client and record.
                // A lost-response retry must retain the original acceptance/audit even
                // when time, field order or the caller's evidence string has changed.
                accepted.evidence = `client-post:${sha256(JSON.stringify([
                    'website-acceptance-v1', key, actor.issuer, actor.subject,
                    accepted.siteVersion, accepted.terms, accepted.cents, accepted.currency,
                    accepted.interval, accepted.approveSiteAndGoLive, accepted.agreeBilling,
                    accepted.remindersAgreed,
                ]))}`;
                const site = await repository.site(identity);
                requireThat(site.version === accepted.siteVersion, 'site_version_changed');
                result = await service.accept(identity, principal, accepted);
            }
            else if (action === 'approve') {
                const p = z.object({ siteVersion: z.number().int().positive(), evidence: z.string().min(1).max(500) }).strict().parse(input);
                const site = await repository.site(identity);
                requireThat(site.version === p.siteVersion, 'site_version_changed');
                result = await service.approve(identity, principal, p.siteVersion, p.evidence);
            }
            else if (action === 'go-live') {
                const p = z.object({ mode: z.enum(['site_only', 'accepted_go_live']), siteVersion: z.number().int().positive() }).strict().parse(input);
                result = await service.goLive(identity, principal, p.mode, p.siteVersion);
            }
            else if (action === 'checkout') {
                requireThat(Object.keys(input).every(k => ['token', 'confirmation', 'confirmed'].includes(k)), 'unexpected_checkout_field');
                const token = z.string().max(4000).parse(input.token);
                const confirmation = isForm && input.confirmed === 'on' ? { confirmed: true as const, cents: state.plan.cents, currency: 'usd' as const, interval: 'month' as const, trialEnd: state.trialEnd!, terms: state.acceptance!.terms, generation: state.link!.generation, evidence: `client-charge-post:${sha256(JSON.stringify([key, actor.subject, options.now(), token]))}` } : (input.confirmation ? confirmationSchema.parse(input.confirmation) : undefined);
                result = await service.checkout(identity, principal, token, confirmation);
                if (isForm && typeof result === 'object' && result && 'url' in result)
                    return new Response(null, { status: 303, headers: { ...headers, Location: String(result.url) } });
            }
            else if (action === 'reconcile') {
                requireThat(principal.role === 'operator', 'operator_required');
                const p = z.object({ evidence: z.string().min(1).max(500) }).strict().parse(input);
                result = await recoverWebsite(repository, options.stripe, identity, principal, p.evidence);
            }
            else if (action === 'withdraw')
                result = await service.withdraw(identity, principal, z.object({ evidence: z.string().min(1).max(500) }).strict().parse(input).evidence);
            else if (action === 'issue-link') {
                z.object({}).strict().parse(input);
                result = { token: await service.issueLink(identity, principal) };
            }
            else if (action === 'draft-reminder') {
                const p = z.object({ day: z.union([z.literal(15), z.literal(20)]), timezone: z.string().min(1).max(100) }).strict().parse(input);
                result = await service.draftReminder(identity, principal, p.day, p.timezone);
            }
            else
                throw Error('route_not_found');
            if (isForm)
                return new Response(null, { status: 303, headers: { ...headers, Location: `/web/billing?record=${key}` } });
            return json({ result: result ?? 'ok' });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : '';
            if (error instanceof z.ZodError || /body_too_large|content_type|duplicate_form|unexpected_/.test(message))
                return json({ error: 'invalid_request' }, 400);
            if (/authentication_required|authenticated_binding|ownership|operator_required|csrf|origin_mismatch/.test(message))
                return json({ error: 'access_denied' }, 403);
            if (message === 'route_not_found')
                return json({ error: 'not_found' }, 404);
            if (/stripe_request_failed_|pagination|uncertain|pending|not_ready|not_located|billing_write|record_missing/.test(message))
                return json({ error: 'reconciliation_required' }, 503);
            return json({ error: 'billing_action_held' }, 409);
        }
    };
}
/** Renderer owner must emit these exact headers for a version-specific serving proof.
 * Existing authoring publication status alone cannot establish that the new version is served. */
export function publicationVerifier(repository: PostgresWebsiteRepository, transport: typeof fetch) {
    return async (identity: Identity, version: number) => {
        const site = await repository.site(identity);
        requireThat(site.status === 'published' && site.version === version && /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(String(site.slug)), 'publication_not_confirmed');
        // Match the renderer's signup suspension rules without trusting its cached
        // status. Missing or newly introduced states require review, never inference.
        requireThat(typeof site.signup_status === 'string' && ['borrador', 'nuevo', 'en_construccion', 'entregada', 'compartida', 'activa'].includes(site.signup_status), 'publication_signup_not_eligible');
        const response = await transport(`https://${site.slug}.machinemindconsulting.com/`, { method: 'GET', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000) });
        requireThat(response.ok && response.headers.get('x-mm-site-id') === identity.siteId && response.headers.get('x-mm-site-version') === String(version) && response.headers.get('content-type')?.includes('text/html'), 'served_version_proof_missing');
        const html = await response.text();
        requireThat(html.length > 100 && html.length < 2000000, 'served_content_invalid');
        return { served: true as const, evidence: `public-html-sha256:${sha256(html)}` };
    };
}
