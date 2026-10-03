import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { DAY, CHECKOUT_LIFETIME, PROGRAM, STRIPE_ACCOUNT, assertOwner, audit, requireThat, time, type Attempt, type Lifecycle, type Principal } from './core';
// A one-hour Session allows a bounded 15-minute submission window with 15 minutes
// of extra provider-expiry headroom. Never mutate the frozen body on a late retry.
export const CHECKOUT_SUBMISSION_HEADROOM = 2700;
export function assertCheckoutSubmissionAllowed(expiresAt: number, now: number) {
    time(now);
    requireThat(expiresAt - now >= CHECKOUT_SUBMISSION_HEADROOM, 'checkout_reconciliation_required');
}
export const VERIFIED_MICHOACANA_PRICE = 'price_1UMa6VIS8EYk0ASLWXwh8qDK';
export const VERIFIED_STANDARD_PRICE = 'price_1UMZzZIS8EYk0ASLplu88gxR';
export type Price = {
    id: string;
    account: string;
    livemode: boolean;
    active: boolean;
    cents: number;
    currency: string;
    interval: string;
    intervalCount: number;
    taxBehavior: 'inclusive' | 'unspecified' | 'exclusive';
};
export type PriceCatalog = {
    standard20: Price;
    michoacana19: Price | null;
};
export type Binding = {
    program: typeof PROGRAM;
    ownerId: string;
    tenantId: string;
    signupId: string;
    siteId: string;
    acceptedAt: number;
    goLiveAt: number;
    trialEnd: number;
    cents: number;
    terms: string;
    generation: number;
    issuedAt: number;
    expiresAt: number;
};
export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
function equal(a: string, b: string) { const left = Buffer.from(a); const right = Buffer.from(b); return left.length === right.length && timingSafeEqual(left, right); }
function binding(s: Lifecycle): Binding {
    requireThat(s.acceptance && s.goLiveAt && s.trialEnd && s.link, 'binding_not_ready');
    return { program: PROGRAM, ownerId: s.ownerId, tenantId: s.tenantId, signupId: s.signupId, siteId: s.siteId,
        acceptedAt: s.acceptance.at, goLiveAt: s.goLiveAt, trialEnd: s.trialEnd, cents: s.plan.cents,
        terms: s.acceptance.terms, ...s.link };
}
/** Key is injected by the integration boundary. No key lookup, creation, configuration or logging here. */
export function signLink(s: Lifecycle, signingKey: string): string {
    requireThat(signingKey.length >= 32, 'signer_unavailable');
    const payload = Buffer.from(JSON.stringify(binding(s))).toString('base64url');
    return `${payload}.${createHmac('sha256', signingKey).update(payload).digest('base64url')}`;
}
export function verifyLink(s: Lifecycle, token: string, signingKey: string, now: number): Binding {
    time(now);
    requireThat(signingKey.length >= 32 && token.length < 4000, 'invalid_link');
    const parts = token.split('.');
    requireThat(parts.length === 2 && /^[A-Za-z0-9_-]+$/.test(parts[0]), 'invalid_link');
    requireThat(equal(parts[1], createHmac('sha256', signingKey).update(parts[0]).digest('base64url')), 'invalid_link');
    let parsed: unknown;
    try {
        parsed = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    }
    catch {
        throw new Error('invalid_link');
    }
    // Compare against the persisted canonical binding. Tokens can never set prices, tenant or dates.
    requireThat(JSON.stringify(parsed) === JSON.stringify(binding(s)), 'stale_or_foreign_link');
    const expected = binding(s);
    requireThat(expected.issuedAt <= now && now < expected.expiresAt, 'expired_link');
    requireThat(!s.withdrawnAt, 'consent_withdrawn');
    return expected;
}
export type ExactChargeConfirmation = {
    confirmed: true;
    cents: number;
    currency: 'usd';
    interval: 'month';
    trialEnd: number;
    terms: string;
    generation: number;
    evidence: string;
};
export type CheckoutParams = {
    mode: 'subscription';
    customer?: string;
    client_reference_id: string;
    line_items: [
        {
            price: string;
            quantity: 1;
        }
    ];
    payment_method_types: [
        'card'
    ];
    payment_method_collection: 'always';
    locale: 'es';
    expires_at: number;
    allow_promotion_codes: false;
    automatic_tax: {
        enabled: false;
    };
    adaptive_pricing: {
        enabled: false;
    };
    success_url: string;
    cancel_url: string;
    metadata: Record<string, string>;
    subscription_data: {
        metadata: Record<string, string>;
        trial_end?: number;
        trial_settings?: {
            end_behavior: {
                missing_payment_method: 'cancel';
            };
        };
    };
    custom_text: {
        submit: {
            message: string;
        };
    };
};
export type CheckoutDecision = {
    kind: 'ready';
    attempt: Attempt;
    params: CheckoutParams;
    idempotencyKey: string;
} | {
    kind: 'charge_confirmation_required' | 'assisted_setup_required';
};
function checkedPrice(s: Lifecycle, catalog: PriceCatalog, livemode: boolean): Price {
    const price = catalog[s.plan.key];
    requireThat(price && /^price_[A-Za-z0-9]+$/.test(price.id) && price.account === STRIPE_ACCOUNT && price.livemode === livemode && price.active && price.cents === s.plan.cents && price.currency === 'usd' && price.interval === 'month' && price.intervalCount === 1, 'price_not_verified');
    // No tax/discount settings may silently change the exact approved charge.
    requireThat(price.taxBehavior !== 'exclusive', 'exact_total_unverified');
    if (livemode && s.plan.key === 'michoacana19')
        requireThat(price.id === VERIFIED_MICHOACANA_PRICE, 'michoacana_price_mismatch');
    if (livemode && s.plan.key === 'standard20')
        requireThat(price.id === VERIFIED_STANDARD_PRICE, 'standard_price_mismatch');
    return price;
}
export function metadata(s: Lifecycle, a: Attempt): Record<string, string> {
    return { program: PROGRAM, owner_id: s.ownerId, tenant_id: s.tenantId, signup_id: s.signupId, site_id: s.siteId,
        accepted_at: String(s.acceptance!.at), go_live_at: String(s.goLiveAt), trial_end: String(s.trialEnd),
        terms: s.acceptance!.terms, amount_cents: String(s.plan.cents), generation: String(a.generation), attempt_id: a.id };
}
function params(s: Lifecycle, a: Attempt, origin: string): CheckoutParams {
    const base = new URL(origin);
    requireThat(base.protocol === 'https:' && base.pathname === '/' && !base.search && !base.hash && !base.username && !base.password, 'invalid_return_origin');
    const tags = metadata(s, a);
    return { mode: 'subscription', ...(s.customerId ? { customer: s.customerId } : {}), client_reference_id: s.signupId,
        line_items: [{ price: a.priceId, quantity: 1 }], payment_method_types: ['card'], payment_method_collection: 'always',
        locale: 'es', expires_at: a.expiresAt, allow_promotion_codes: false, automatic_tax: { enabled: false }, adaptive_pricing: { enabled: false },
        success_url: `${base.origin}/web/billing/receipt?session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${base.origin}/web/billing?site_id=${encodeURIComponent(s.siteId)}`, metadata: tags,
        subscription_data: { metadata: tags, ...(a.kind === 'trial' ? { trial_end: s.trialEnd!, trial_settings: { end_behavior: { missing_payment_method: 'cancel' as const } } } : {}) },
        custom_text: { submit: { message: a.kind === 'trial'
                    ? `Hoy no se cobra. Primer cobro: USD ${(s.plan.cents / 100).toFixed(2)} el ${new Date(s.trialEnd! * 1000).toISOString()}. Luego cada mes. Los 30 días no se reinician.`
                    : `Autoriza un cobro ahora de USD ${(s.plan.cents / 100).toFixed(2)} y luego ese importe cada mes. La prueba ya terminó. No se cobran días anteriores.` } } };
}
/** Must run in the durable per-tenant transaction BEFORE any provider request. */
export function reserveCheckout(s: Lifecycle, p: Principal, token: string, input: {
    signingKey: string;
    catalog: PriceCatalog;
    livemode: boolean;
    origin: string;
    confirmation?: ExactChargeConfirmation;
}, now: number): CheckoutDecision {
    assertOwner(s, p, 'client');
    verifyLink(s, token, input.signingKey, now);
    requireThat(s.enrollment === 'none' && !s.subscriptionId, 'already_enrolled');
    const price = checkedPrice(s, input.catalog, input.livemode);
    const prior = s.attempts.find(a => a.generation === s.link!.generation);
    if (prior) {
        requireThat(prior.priceId === price.id && prior.status !== 'expired', 'checkout_reconciliation_required');
        // Ambiguous creation remains reserved; a timeout never creates a fresh attempt or extends a deadline.
        requireThat(now < prior.expiresAt, 'checkout_reconciliation_required');
        if (!prior.sessionId) assertCheckoutSubmissionAllowed(prior.expiresAt, now);
        return { kind: 'ready', attempt: prior, params: JSON.parse(prior.requestJson) as CheckoutParams, idempotencyKey: prior.id };
    }
    requireThat(!s.attempts.some(a => a.status !== 'expired'), 'checkout_reconciliation_required');
    const remaining = s.trialEnd! - now;
    if (remaining > 0 && remaining <= 2 * DAY + CHECKOUT_LIFETIME)
        return { kind: 'assisted_setup_required' };
    const kind = remaining > 0 ? 'trial' : 'charge_now';
    if (kind === 'charge_now') {
        const c = input.confirmation;
        if (!c)
            return { kind: 'charge_confirmation_required' };
        requireThat(c.confirmed === true && c.cents === s.plan.cents && c.currency === s.plan.currency && c.interval === s.plan.interval && c.trialEnd === s.trialEnd && c.terms === s.acceptance!.terms && c.generation === s.link!.generation, 'exact_charge_confirmation_required');
        audit(s, now, 'client_confirmed_exact_charge_now', p.subject, c.evidence);
    }
    const expiresAt = Math.min(now + CHECKOUT_LIFETIME, s.link!.expiresAt, kind === 'trial' ? s.trialEnd! - 2 * DAY : Infinity);
    requireThat(expiresAt >= now + CHECKOUT_LIFETIME, 'renew_link_before_checkout');
    const a: Attempt = { id: `${PROGRAM}_${sha256(`${s.ownerId}:${s.tenantId}:${s.signupId}:${s.siteId}:${s.goLiveAt}:${s.link!.generation}`).slice(0, 40)}`,
        generation: s.link!.generation, kind, priceId: price.id, createdAt: now, expiresAt,
        confirmationAt: kind === 'charge_now' ? now : null, requestJson: '', status: 'creating', sessionId: null, url: null };
    const result = { kind: 'ready' as const, attempt: a, params: params(s, a, input.origin), idempotencyKey: a.id };
    a.requestJson = JSON.stringify(result.params);
    s.attempts.push(a);
    audit(s, now, 'checkout_reserved', p.subject, a.id);
    return result;
}
export function recordCheckout(s: Lifecycle, attemptId: string, response: {
    id: string;
    url: string;
    expiresAt: number;
}, now: number) {
    const a = s.attempts.find(a => a.id === attemptId);
    requireThat(a, 'unknown_attempt');
    requireThat(/^cs_[A-Za-z0-9_]+$/.test(response.id) && response.expiresAt === a.expiresAt, 'provider_session_mismatch');
    const url = new URL(response.url);
    requireThat(url.protocol === 'https:' && url.hostname === 'checkout.stripe.com' && !url.username && !url.password, 'untrusted_checkout_url');
    requireThat(!a.sessionId || a.sessionId === response.id, 'duplicate_provider_session');
    a.sessionId = response.id;
    a.url = response.url;
    if (a.status === 'creating')
        a.status = 'open';
    audit(s, now, 'checkout_recorded', 'stripe', response.id);
}
