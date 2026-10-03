import { z } from 'zod';
import { STRIPE_ACCOUNT, requireThat, type Lifecycle } from '../core';
import { assertCheckoutSubmissionAllowed, metadata, type CheckoutParams, type Price, type PriceCatalog } from '../checkout';
import type { Provider } from '../service';
import type { ProviderSnapshot, VerifiedEvent } from '../webhook';
export const STRIPE_API_VERSION = '2026-04-22.dahlia';
const id = z.string().min(1).max(200), epoch = z.number().int().positive(), money = z.number().int().nonnegative();
const reference = z.union([id, z.object({ id })]).nullable();
export const referenceId = (value: unknown): string | null => { const x = reference.parse(value); return typeof x === 'string' ? x : x?.id ?? null; };
const tags = z.record(z.string(), z.string());
const priceSchema = z.object({ id, livemode: z.boolean(), active: z.boolean(), product: reference, unit_amount: money, currency: id, type: z.enum(['recurring', 'one_time']), tax_behavior: z.enum(['inclusive', 'exclusive', 'unspecified']), recurring: z.object({ interval: id, interval_count: z.number().int().positive(), usage_type: z.literal('licensed') }).nullable(), billing_scheme: z.literal('per_unit'), transform_quantity: z.null() });
export const sessionSchema = z.object({ id, livemode: z.boolean(), status: z.enum(['open', 'complete', 'expired']), mode: z.enum(['subscription', 'payment']), customer: reference, subscription: reference, payment_intent: reference, invoice: reference, payment_link: reference, client_reference_id: id.nullable(), metadata: tags, amount_total: money.nullable(), currency: id.nullable(), expires_at: epoch, created: epoch, url: z.string().url().nullable(), payment_status: z.enum(['paid', 'unpaid', 'no_payment_required']), total_details: z.object({ amount_discount: money, amount_shipping: money, amount_tax: money }) });
const lineSchema = z.object({ id, quantity: z.number().int().positive(), price: priceSchema, amount_total: money, currency: id });
export const subscriptionSchema = z.object({ id, livemode: z.boolean(), customer: reference, status: z.enum(['trialing', 'active', 'past_due', 'unpaid', 'incomplete', 'incomplete_expired', 'paused', 'canceled']), trial_end: epoch.nullable(), cancel_at_period_end: z.boolean(), default_payment_method: reference, metadata: tags, items: z.object({ has_more: z.literal(false), data: z.array(z.object({ id, quantity: z.number().int().positive(), price: priceSchema, current_period_start: epoch, current_period_end: epoch })) }) });
export const invoiceSchema = z.object({ id, livemode: z.boolean(), customer: reference, status: z.string().nullable(), amount_paid: money, total: z.number().int(), amount_due: money, currency: id, starting_balance: z.number().int(), ending_balance: z.number().int().nullable(), status_transitions: z.object({ paid_at: epoch.nullable() }), parent: z.object({ subscription_details: z.object({ subscription: reference }).nullable() }).nullable() });
const invoiceLineSchema = z.object({ id, livemode: z.boolean(), amount: z.number().int(), currency: id, quantity: z.number().int().positive(), period: z.object({ start: epoch, end: epoch }), pricing: z.object({ price_details: z.object({ price: reference }) }).nullable(), parent: z.object({ subscription_item_details: z.object({ subscription: reference, proration: z.boolean() }).nullable() }).nullable(), discount_amounts: z.array(z.object({ amount: money })).nullable(), pretax_credit_amounts: z.array(z.unknown()).nullable() });
function form(value: unknown, out = new URLSearchParams(), path = ''): URLSearchParams {
    if (value === undefined || value === null)
        return out;
    if (Array.isArray(value))
        value.forEach((v, n) => form(v, out, `${path}[${n}]`));
    else if (typeof value === 'object')
        for (const [k, v] of Object.entries(value))
            form(v, out, path ? `${path}[${k}]` : k);
    else
        out.append(path, String(value));
    return out;
}
/** Concrete bounded Stripe REST client; transport/key are explicitly injected. Nothing
 * connects at import/construction. Tests inject a synthetic transport; no global fallback. */
export class StripeClient {
    readonly account = STRIPE_ACCOUNT;
    private verified = false;
    constructor(readonly options: {
        secretKey: string;
        livemode: boolean;
        transport: typeof fetch;
        now: () => number;
    }) {
        requireThat(new RegExp(`^(sk|rk)_${options.livemode ? 'live' : 'test'}_`).test(options.secretKey), 'stripe_key_mode_mismatch');
    }
    get livemode() { return this.options.livemode; }
    get now() { return this.options.now(); }
    async request(method: 'GET' | 'POST' | 'DELETE', path: string, params: unknown = {}, key?: string): Promise<unknown> {
        requireThat(/^\/v1\/[a-z_]+(?:\/[A-Za-z0-9_]+)*$/.test(path), 'invalid_provider_path');
        if (!this.verified && path !== '/v1/account') {
            const account = z.object({ id }).parse(await this.request('GET', '/v1/account'));
            requireThat(account.id === this.account, 'stripe_account_mismatch');
            this.verified = true;
        }
        const encoded = form(params), url = new URL(path, 'https://api.stripe.com');
        if (method === 'GET')
            url.search = encoded.toString();
        const headers: Record<string, string> = { Authorization: `Bearer ${this.options.secretKey}`, 'Stripe-Version': STRIPE_API_VERSION };
        if (key)
            headers['Idempotency-Key'] = key;
        if (method !== 'GET')
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
        const response = await this.options.transport(url, { method, headers, body: method === 'GET' ? undefined : encoded.toString(), redirect: 'error', signal: AbortSignal.timeout(10000) });
        requireThat(response.ok, `stripe_request_failed_${response.status}`);
        const raw = await response.text();
        requireThat(raw.length <= 2000000, 'stripe_response_too_large');
        return JSON.parse(raw);
    }
    async list(path: string, params: Record<string, unknown> = {}): Promise<unknown[]> {
        const result: unknown[] = [];
        let cursor: string | undefined;
        for (let page = 0; page < 20; page++) {
            const r = z.object({ data: z.array(z.object({ id }).passthrough()), has_more: z.boolean() }).parse(await this.request('GET', path, { ...params, limit: 100, starting_after: cursor }));
            result.push(...r.data);
            if (!r.has_more)
                return result;
            requireThat(r.data.length > 0 && r.data.at(-1)!.id !== cursor, 'stripe_pagination_invalid');
            cursor = r.data.at(-1)!.id;
        }
        throw Error('stripe_pagination_review_required');
    }
    async price(priceId: string): Promise<Price & {
        product: string;
        type: 'recurring' | 'one_time';
    }> {
        const p = priceSchema.parse(await this.request('GET', `/v1/prices/${priceId}`));
        requireThat(p.id === priceId && p.livemode === this.livemode, 'price_mode_mismatch');
        const product = z.object({ id, active: z.boolean(), livemode: z.boolean() }).parse(await this.request('GET', `/v1/products/${referenceId(p.product)}`));
        requireThat(product.id === referenceId(p.product) && product.livemode === this.livemode && product.active, 'product_mode_mismatch');
        return { id: p.id, account: this.account, livemode: p.livemode, active: p.active, cents: p.unit_amount, currency: p.currency, interval: p.recurring?.interval ?? '', intervalCount: p.recurring?.interval_count ?? 0, taxBehavior: p.tax_behavior, product: product.id, type: p.type };
    }
    async catalog(standard20: string, michoacana19: string): Promise<PriceCatalog> { return { standard20: await this.price(standard20), michoacana19: await this.price(michoacana19) }; }
    async session(sessionId: string) { const s = sessionSchema.parse(await this.request('GET', `/v1/checkout/sessions/${sessionId}`)); requireThat(s.id === sessionId && s.livemode === this.livemode, 'session_mode_mismatch'); return s; }
    async sessionLines(sessionId: string) { return (await this.list(`/v1/checkout/sessions/${sessionId}/line_items`)).map(x => lineSchema.parse(x)); }
    async subscription(subId: string) { const s = subscriptionSchema.parse(await this.request('GET', `/v1/subscriptions/${subId}`)); requireThat(s.id === subId && s.livemode === this.livemode, 'subscription_mode_mismatch'); return s; }
    async findSession(attemptId: string, createdAt: number, sessionId: string | null, event?: VerifiedEvent) {
        if (sessionId)
            return this.session(sessionId);
        if (event?.type.startsWith('checkout.session.'))
            return this.session(event.data.object.id);
        const found = (await this.list('/v1/checkout/sessions', { created: { gte: createdAt - 60, lte: this.now } })).map(x => sessionSchema.parse(x)).filter(s => s.metadata.attempt_id === attemptId);
        requireThat(found.length === 1, 'uncertain_checkout_requires_reconciliation');
        return this.session(found[0].id);
    }
    async paidInvoices(subId: string, customerId: string, priceId: string, cents: number, excludedInvoiceIds: string[] = []): Promise<ProviderSnapshot['paidInvoices']> {
        const invoices = (await this.list('/v1/invoices', { subscription: subId })).map(x => invoiceSchema.parse(x)), paid: ProviderSnapshot['paidInvoices'] = [];
        for (const i of invoices) {
            requireThat(i.livemode === this.livemode && referenceId(i.customer) === customerId && referenceId(i.parent?.subscription_details?.subscription ?? null) === subId, 'invoice_ownership_mismatch');
            if (excludedInvoiceIds.includes(i.id) || i.status !== 'paid' || i.amount_paid === 0)
                continue;
            requireThat(i.amount_paid === cents && i.total === cents && i.amount_due === cents && i.currency === 'usd' && i.starting_balance === 0 && (i.ending_balance === 0 || i.ending_balance === null) && i.status_transitions.paid_at, 'invoice_exact_total_required');
            const lines = (await this.list(`/v1/invoices/${i.id}/lines`)).map(x => invoiceLineSchema.parse(x));
            requireThat(lines.length === 1, 'invoice_addon_review_required');
            const l = lines[0];
            requireThat(l.livemode === this.livemode && referenceId(l.pricing?.price_details.price ?? null) === priceId && referenceId(l.parent?.subscription_item_details?.subscription ?? null) === subId && !l.parent?.subscription_item_details?.proration && l.quantity === 1 && l.amount === cents && l.currency === 'usd' && !(l.discount_amounts ?? []).some(d => d.amount > 0) && !(l.pretax_credit_amounts ?? []).length && l.period.end > l.period.start, 'invoice_line_mismatch');
            paid.push({ id: i.id, subscriptionId: subId, customerId, cents: i.amount_paid, currency: i.currency, paidAt: i.status_transitions.paid_at, periodStart: l.period.start, periodEnd: l.period.end });
        }
        return paid;
    }
    async cancelOwnedSubscription(subId: string, customerId: string, expected: Record<string, string>, key: string) {
        const sub = await this.subscription(subId);
        requireThat(referenceId(sub.customer) === customerId && Object.entries(expected).every(([k, v]) => sub.metadata[k] === v), 'cancellation_owner_mismatch');
        if (!['canceled', 'incomplete_expired'].includes(sub.status))
            await this.request('DELETE', `/v1/subscriptions/${subId}`, { invoice_now: false, prorate: false }, key);
        requireThat(['canceled', 'incomplete_expired'].includes((await this.subscription(subId)).status), 'cancellation_pending');
    }
    async create(params: CheckoutParams | Record<string, unknown>, key: string) {
        const p = params as CheckoutParams;
        assertCheckoutSubmissionAllowed(p.expires_at, this.now);
        requireThat(p.mode === 'subscription' && p.line_items.length >= 1 && p.line_items.length <= 2, 'checkout_request_invalid');
        const expectedCents = p.metadata.program === 'web_gratis_fixed_v1' ? Number(p.metadata.amount_cents) : p.metadata.program === 'simmerdown_october2026_v1' ? 30000 : 0;
        requireThat([1900, 2000, 30000].includes(expectedCents), 'checkout_program_invalid');
        let dueNow = 0;
        for (const line of p.line_items) {
            const price = await this.price(line.price);
            requireThat(price.active && price.cents === expectedCents && price.currency === 'usd' && price.taxBehavior !== 'exclusive' && line.quantity === 1, 'checkout_catalog_changed');
            if (price.type === 'recurring')
                requireThat(price.interval === 'month' && price.intervalCount === 1, 'checkout_interval_changed');
            if (price.type === 'one_time' || !p.subscription_data.trial_end)
                dueNow += price.cents;
        }
        if (p.customer) {
            const customer = z.object({ id, livemode: z.boolean(), balance: z.literal(0), deleted: z.literal(false).optional() }).passthrough().parse(await this.request('GET', `/v1/customers/${p.customer}`));
            requireThat(customer.id === p.customer && customer.livemode === this.livemode && customer.discount == null && (!Array.isArray(customer.discounts) || customer.discounts.length === 0), 'customer_balance_or_discount_review');
            requireThat((await this.list('/v1/invoiceitems', { customer: p.customer, pending: true })).length === 0, 'pending_customer_items_review');
            const subscriptions = await this.list('/v1/subscriptions', { customer: p.customer, status: 'all' });
            requireThat(!subscriptions.some(raw => { const sub = subscriptionSchema.parse(raw); return sub.metadata.program === p.metadata.program && !['canceled', 'incomplete_expired'].includes(sub.status); }), 'existing_subscription_requires_reconciliation');
        }
        assertCheckoutSubmissionAllowed(p.expires_at, this.now);
        const response = sessionSchema.parse(await this.request('POST', '/v1/checkout/sessions', params, key));
        requireThat(response.livemode === this.livemode && response.mode === p.mode && response.expires_at === p.expires_at && response.url && response.status === 'open' && (!p.customer || referenceId(response.customer) === p.customer) && response.client_reference_id === p.client_reference_id && Object.entries(p.metadata).every(([k, v]) => response.metadata[k] === v) && response.amount_total === dueNow && response.currency === 'usd' && response.total_details.amount_discount === 0 && response.total_details.amount_shipping === 0, 'created_session_mismatch');
        const actualLines = await this.sessionLines(response.id);
        requireThat(actualLines.length === p.line_items.length && p.line_items.every(line => actualLines.filter(actual => actual.price.id === line.price && actual.quantity === 1 && actual.price.livemode === this.livemode).length === 1), 'created_session_lines_mismatch');
        const url = new URL(response.url);
        requireThat(url.protocol === 'https:' && url.hostname === 'checkout.stripe.com' && !url.username && !url.password, 'untrusted_checkout_url');
        return { id: response.id, url: response.url, expiresAt: response.expires_at };
    }
}
export function stripeWebsiteProvider(client: StripeClient, loadAttempt: (id: string) => Promise<{
    state: Lifecycle;
    attemptId: string;
}>): Provider {
    return { account: client.account, livemode: client.livemode,
        createCheckout: (params, key) => client.create(params, key),
        async snapshot(attemptId, sessionId, event) {
            const { state: s } = await loadAttempt(attemptId), a = s.attempts.find(a => a.id === attemptId);
            requireThat(a, 'attempt_missing');
            const session = await client.findSession(attemptId, a.createdAt, sessionId, event), expected = metadata(s, a);
            requireThat(Object.entries(expected).every(([k, v]) => session.metadata[k] === v), 'session_metadata_mismatch');
            const lines = await client.sessionLines(session.id);
            requireThat(lines.length === 1, 'checkout_line_count_mismatch');
            const line = lines[0];
            requireThat(line.price.livemode === client.livemode && session.total_details.amount_discount === 0 && session.total_details.amount_shipping === 0 && session.amount_total !== null && session.currency, 'checkout_total_unverified');
            const subId = referenceId(session.subscription), sub = subId ? await client.subscription(subId) : null;
            let eventObject: ProviderSnapshot['eventObject'] = { id: event.data.object.id, subscriptionId: subId, customerId: referenceId(session.customer) };
            if (event.type.startsWith('invoice.')) {
                const i = invoiceSchema.parse(await client.request('GET', `/v1/invoices/${event.data.object.id}`));
                requireThat(i.livemode === client.livemode, 'invoice_mode_mismatch');
                eventObject = { id: i.id, subscriptionId: referenceId(i.parent?.subscription_details?.subscription ?? null), customerId: referenceId(i.customer) };
            }
            if (event.type.startsWith('customer.subscription.'))
                requireThat(subId === event.data.object.id, 'event_subscription_mismatch');
            if (sub)
                requireThat(sub.items.data.length === 1, 'subscription_item_count_mismatch');
            const item = sub?.items.data[0];
            return { account: client.account, livemode: client.livemode, retrievedAt: client.now, eventObject,
                session: { id: session.id, status: session.status, mode: z.literal('subscription').parse(session.mode), customerId: referenceId(session.customer), subscriptionId: subId, clientReferenceId: session.client_reference_id ?? '', metadata: session.metadata, priceId: line.price.id, quantity: line.quantity, currency: session.currency, amountTotal: session.amount_total, expiresAt: session.expires_at },
                subscription: sub && item ? { id: sub.id, customerId: referenceId(sub.customer)!, status: sub.status, priceId: item.price.id, quantity: item.quantity, cents: item.price.unit_amount, currency: item.price.currency, interval: item.price.recurring?.interval ?? '', intervalCount: item.price.recurring?.interval_count ?? 0, trialEnd: sub.trial_end, paymentMethodReady: !!referenceId(sub.default_payment_method), cancelAtPeriodEnd: sub.cancel_at_period_end, currentPeriodEnd: item.current_period_end, metadata: sub.metadata } : null,
                paidInvoices: sub ? await client.paidInvoices(sub.id, referenceId(sub.customer)!, a.priceId, s.plan.cents) : [] };
        },
        async cancelEnrollment(s, key) {
            for (const a of s.attempts.filter(a => a.status !== 'expired')) {
                let session = await client.findSession(a.id, a.createdAt, a.sessionId);
                requireThat(Object.entries(metadata(s, a)).every(([k, v]) => session.metadata[k] === v), 'cancellation_owner_mismatch');
                if (session.status === 'open') {
                    await client.request('POST', `/v1/checkout/sessions/${session.id}/expire`, {}, `${key}_${session.id}`);
                    session = await client.session(session.id);
                }
                requireThat(session.status !== 'open', 'session_expiry_pending');
                const subId = referenceId(session.subscription);
                if (subId) {
                    const sub = await client.subscription(subId);
                    requireThat(referenceId(sub.customer) === referenceId(session.customer) && Object.entries(metadata(s, a)).every(([k, v]) => sub.metadata[k] === v), 'cancellation_owner_mismatch');
                    if (!['canceled', 'incomplete_expired'].includes(sub.status))
                        await client.request('DELETE', `/v1/subscriptions/${subId}`, { invoice_now: false, prorate: false }, `${key}_${subId}`);
                    requireThat(['canceled', 'incomplete_expired'].includes((await client.subscription(subId)).status), 'cancellation_pending');
                }
            }
            return { canceled: true };
        } };
}
