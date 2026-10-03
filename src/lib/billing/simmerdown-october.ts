/** SimmerDown-only offline request planner. No routes, environment, provider calls or sends.
 * This paid October period is NOT the new-client website trial lifecycle.
 */
import { createHash } from 'node:crypto';
export const SIMMERDOWN = {
    program: 'simmerdown_october2026_v1', account: 'acct_1QvaObIS8EYk0ASL',
    octoberProduct: 'prod_VNLj77Hpcpw7F0', octoberPrice: 'price_1UMb2VIS8EYk0ASLlYJZGmsJ', octoberLink: 'plink_1UMb2zIS8EYk0ASLSwvGPI1l',
    product: 'prod_VNKvEtP59oLKBH', recurringPrice: 'price_1UMaFfIS8EYk0ASLS0Tn1GfG', cents: 30000,
} as const;
export type SimmerPrice = {
    id: string;
    product: string;
    account: string;
    livemode: boolean;
    active: boolean;
    type: 'one_time' | 'recurring';
    cents: number;
    currency: string;
    taxBehavior: string;
    interval?: string;
    intervalCount?: number;
};
export type SimmerAgreement = {
    ownerId: string;
    clientId: string;
    customerId: string;
    agreementId: string;
    acceptedByClient: boolean;
    acceptedAt: number;
    evidence: string;
    octoberTotalCents: number;
    monthlyTotalCents: number;
    currency: string;
    nextChargeAt: number;
    billingTimeZone: string;
    everyFirstAgreed: boolean;
};
export type SimmerState = {
    request: null | {
        kind: 'combined' | 'recurring_only';
        bindingDigest: string;
        livemode: boolean;
        idempotencyKey: string;
        json: string;
        expiresAt: number;
    };
    octoberPayment: null | {
        source: 'one_time_link';
        account: string;
        livemode: boolean;
        ownerId: string;
        clientId: string;
        customerId: string;
        receiptId: string;
        fingerprint: string;
    };
    octoberInvoiceId: string | null;
    subscriptionId: string | null;
    canceled: boolean;
};
export const emptySimmerState = (): SimmerState => ({ request: null, octoberPayment: null, octoberInvoiceId: null, subscriptionId: null, canceled: false });
function check(v: unknown, message: string): asserts v {
    if (!v)
        throw new Error(message);
}
function priceOK(p: SimmerPrice | null, type: SimmerPrice['type'], live: boolean, productId: string): p is SimmerPrice {
    return !!p && /^price_[A-Za-z0-9_]+$/.test(p.id) && p.product === productId && p.account === SIMMERDOWN.account && p.livemode === live && p.active && p.type === type && p.cents === 30000 && p.currency === 'usd' && p.taxBehavior === 'inclusive' && (type === 'one_time' ? (!live || p.id === SIMMERDOWN.octoberPrice) : (p.interval === 'month' && p.intervalCount === 1 && (!live || p.id === SIMMERDOWN.recurringPrice)));
}
function localDay(epoch: number, zone: string) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(epoch * 1000));
    return Object.fromEntries(parts.map(p => [p.type, p.value]));
}
function validateAgreement(a: SimmerAgreement, now: number) {
    check(Number.isSafeInteger(now) && now > 0 && Number.isSafeInteger(a.nextChargeAt), 'invalid_clock');
    check(a.acceptedByClient === true && a.everyFirstAgreed === true && !!a.agreementId && !!a.evidence && Number.isSafeInteger(a.acceptedAt) && a.acceptedAt > 0 && a.acceptedAt <= now, 'explicit_client_schedule_consent_required');
    check(a.octoberTotalCents === 30000 && a.monthlyTotalCents === 30000 && a.currency === 'usd', 'exact_300_tax_inclusive_required');
    check(!!a.ownerId && !!a.clientId && /^cus_[A-Za-z0-9_]+$/.test(a.customerId), 'verified_existing_customer_required');
    const date = new Date(a.nextChargeAt * 1000), first = localDay(a.nextChargeAt, a.billingTimeZone);
    check(first.year === '2026' && first.month === '11' && first.day === '01' && date.getUTCDate() === 1 && date.getUTCMonth() === 10 && date.getUTCFullYear() === 2026, 'fixed_november_first_required');
    // Stripe month anchoring uses UTC. Prove it remains the local first through DST changes.
    for (let month = 0; month < 13; month++) {
        const epoch = Date.UTC(2026, 10 + month, 1, date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()) / 1000;
        check(localDay(epoch, a.billingTimeZone).day === '01', 'timezone_first_day_drift');
    }
}
export function reserveSimmerDownCheckout(s: SimmerState, a: SimmerAgreement, catalog: {
    /** Injected from separately verified mode-specific catalog; no lookup or configuration here. */
    verifiedProductId: string;
    verifiedOctoberProductId: string;
    /** Trusted owner evidence, never browser input. Required only for unpaid combined creation. */
    combinedAuthorization?: { combinedAuthorized: true; oneTimeLinkInactiveVerified: true; evidence: string; verifiedAt: number };
    recurring: SimmerPrice;
    october: SimmerPrice | null;
    livemode: boolean;
}, origin: string, now: number) {
    validateAgreement(a, now);
    check(!s.canceled && !s.subscriptionId, 'already_enrolled_or_canceled');
    check(!s.octoberInvoiceId || s.octoberPayment, 'verified_october_payment_binding_required');
    const paid = s.octoberPayment;
    if (paid) check(paid.ownerId === a.ownerId && paid.clientId === a.clientId && paid.customerId === a.customerId && paid.account === SIMMERDOWN.account && paid.livemode === catalog.livemode, 'october_payment_ownership_mismatch');
    const kind = paid ? 'recurring_only' : 'combined';
    check(/^prod_[A-Za-z0-9_]+$/.test(catalog.verifiedProductId) && (catalog.livemode ? catalog.verifiedProductId === SIMMERDOWN.product : catalog.verifiedProductId !== SIMMERDOWN.product), 'mode_specific_product_not_verified');
    check(priceOK(catalog.recurring, 'recurring', catalog.livemode, catalog.verifiedProductId), 'recurring_price_not_verified');
    if (!paid && !catalog.october)
        return { kind: 'held' as const, reason: 'verified_one_time_october_price_required' };
    if (!paid) check(/^prod_[A-Za-z0-9_]+$/.test(catalog.verifiedOctoberProductId) && (catalog.livemode ? catalog.verifiedOctoberProductId === SIMMERDOWN.octoberProduct : catalog.verifiedOctoberProductId !== SIMMERDOWN.octoberProduct) && priceOK(catalog.october, 'one_time', catalog.livemode, catalog.verifiedOctoberProductId) && catalog.october.id !== catalog.recurring.id, 'october_one_time_price_not_verified');
    const bindingDigest = createHash('sha256').update(JSON.stringify({ agreement: a, recurring: catalog.recurring.id, october: paid ? null : catalog.october!.id, kind, receipt: paid?.receiptId ?? null, live: catalog.livemode, product: catalog.verifiedProductId, octoberProduct: paid ? null : catalog.verifiedOctoberProductId })).digest('hex');
    if (s.request) {
        check(s.request.bindingDigest === bindingDigest, 'existing_checkout_binding_changed');
        check(now < s.request.expiresAt, 'reconcile_expired_checkout_before_any_replacement');
        assertSimmerSubmissionAllowed(s.request.expiresAt, now);
        return { kind: 'ready' as const, idempotencyKey: s.request.idempotencyKey, params: JSON.parse(s.request.json) as SimmerCheckoutParams };
    }
    if (!paid) {
        const control = catalog.combinedAuthorization;
        if (!control || control.combinedAuthorized !== true || control.oneTimeLinkInactiveVerified !== true || !control.evidence || !Number.isSafeInteger(control.verifiedAt) || control.verifiedAt > now || now - control.verifiedAt > 300)
            return { kind: 'held' as const, reason: 'owner_must_reconcile_and_disable_competing_october_link' };
    }
    const today = localDay(now, a.billingTimeZone);
    if (today.year !== '2026' || today.month !== '10' || a.nextChargeAt - now <= 48 * 3600 + 3600)
        return { kind: 'held' as const, reason: 'late_or_stale_october_schedule_manual_review' };
    const base = new URL(origin);
    check(base.protocol === 'https:' && base.pathname === '/' && !base.username && !base.password && !base.search && !base.hash, 'trusted_origin_required');
    const idempotencyKey = `${SIMMERDOWN.program}_${createHash('sha256').update(`${a.ownerId}:${a.clientId}:${a.customerId}:2026-10:${kind}:${paid?.receiptId ?? ''}`).digest('hex').slice(0, 40)}`;
    const tags = { program: SIMMERDOWN.program, owner_id: a.ownerId, client_id: a.clientId, agreement_id: a.agreementId, billing_period: '2026-10', attempt_id: idempotencyKey, next_charge_at: String(a.nextChargeAt), checkout_kind: kind, october_paid_receipt: paid?.receiptId ?? '' };
    const dateLabel = new Intl.DateTimeFormat('es', { timeZone: a.billingTimeZone, dateStyle: 'long', timeStyle: 'short' }).format(new Date(a.nextChargeAt * 1000));
    const params: SimmerCheckoutParams = {
        mode: 'subscription', customer: a.customerId, client_reference_id: a.clientId, payment_method_types: ['card'], payment_method_collection: 'always', locale: 'es',
        line_items: paid ? [{ price: catalog.recurring.id, quantity: 1 }] : [{ price: catalog.recurring.id, quantity: 1 }, { price: catalog.october!.id, quantity: 1 }],
        subscription_data: { trial_end: a.nextChargeAt, trial_settings: { end_behavior: { missing_payment_method: 'cancel' } }, metadata: tags },
        metadata: tags, expires_at: now + 3600, allow_promotion_codes: false, automatic_tax: { enabled: false }, adaptive_pricing: { enabled: false },
        success_url: `${base.origin}/billing/simmerdown/receipt?session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${base.origin}/billing/simmerdown`,
        custom_text: { submit: { message: paid
            ? `Octubre de 2026 ya está pagado. Hoy no se cobra. Próximo cobro completo: USD 300.00 el ${dateLabel} (${a.billingTimeZone}); luego USD 300.00 cada día 1, impuestos incluidos. Octubre no se cobra otra vez.`
            : `USD 300.00 hoy por mantenimiento de octubre de 2026, impuestos incluidos. Próximo cobro completo: USD 300.00 el ${dateLabel} (${a.billingTimeZone}); luego USD 300.00 cada día 1. Octubre no es gratis. No hay prorrateo ni otro cobro de octubre.` } },
    };
    // Persist under a unique account/customer/period lock before future provider submission.
    s.request = { kind, bindingDigest, livemode: catalog.livemode, idempotencyKey, json: JSON.stringify(params), expiresAt: params.expires_at };
    return { kind: 'ready' as const, idempotencyKey, params };
}
/** Future adapter must call immediately before submission and use a bounded request timeout.
 * After this cutoff, reconcile the frozen request; do not mint a new October charge. */
export function assertSimmerSubmissionAllowed(expiresAt: number, now: number) {
    check(Number.isSafeInteger(now) && now > 0 && expiresAt - now >= 2700, 'reconcile_checkout_before_late_submission');
}
export type SimmerCheckoutParams = {
    mode: 'subscription';
    customer: string;
    client_reference_id: string;
    payment_method_types: [
        'card'
    ];
    payment_method_collection: 'always';
    locale: 'es';
    line_items: [{ price: string; quantity: 1 }] | [{ price: string; quantity: 1 }, { price: string; quantity: 1 }];
    subscription_data: {
        trial_end: number;
        trial_settings: {
            end_behavior: {
                missing_payment_method: 'cancel';
            };
        };
        metadata: Record<string, string>;
    };
    metadata: Record<string, string>;
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
    custom_text: {
        submit: {
            message: string;
        };
    };
};
/** Verification target for the test-mode first invoice. Invoke only after signature and
 * fresh provider ownership verification; this function is not a webhook endpoint. */
export function recordSimmerOctoberPaid(s: SimmerState, a: SimmerAgreement, receipt: {
    account: string;
    livemode: boolean;
    customerId: string;
    attemptId: string;
    sessionStatus: string;
    paymentStatus: string;
    invoiceId: string;
    subscriptionId: string;
    cents: number;
    currency: string;
    trialEnd: number;
    oneTimePriceId: string;
    oneTimeCents: number;
    recurringCentsNow: number;
}) {
    check(s.request && s.request.kind === 'combined' && !s.octoberPayment, 'combined_checkout_reservation_required');
    const params = JSON.parse(s.request.json) as SimmerCheckoutParams;
    check(params.customer === a.customerId && params.client_reference_id === a.clientId && params.metadata.owner_id === a.ownerId && params.metadata.agreement_id === a.agreementId && params.subscription_data.trial_end === a.nextChargeAt, 'stored_agreement_mismatch');
    check(receipt.account === SIMMERDOWN.account && receipt.livemode === s.request.livemode && receipt.customerId === params.customer && receipt.attemptId === s.request.idempotencyKey, 'payment_ownership_mismatch');
    check(receipt.sessionStatus === 'complete' && receipt.paymentStatus === 'paid' && receipt.cents === 30000 && receipt.currency === 'usd' && receipt.trialEnd === a.nextChargeAt, 'exact_october_payment_required');
    check(receipt.oneTimePriceId === params.line_items[1]?.price && receipt.oneTimeCents === 30000 && receipt.recurringCentsNow === 0, 'double_charge_or_proration_detected');
    check(/^in_[A-Za-z0-9_]+$/.test(receipt.invoiceId) && /^sub_[A-Za-z0-9_]+$/.test(receipt.subscriptionId), 'provider_identity_required');
    if (s.octoberInvoiceId) {
        check(s.octoberInvoiceId === receipt.invoiceId && s.subscriptionId === receipt.subscriptionId, 'duplicate_october_payment_review');
        return 'duplicate';
    }
    s.octoberInvoiceId = receipt.invoiceId;
    s.subscriptionId = receipt.subscriptionId;
    return 'paid';
}

/** Trusted receipt reducer only. Future adapter must verify raw webhook signature, fetch
 * current paid Checkout/PaymentIntent (and invoice if present), verify exact line items,
 * and independently bind the actual customer to SimmerDown. Browser/redirect data is invalid.
 * Payment Links may have no invoice; dedupe their paid PaymentIntent and Session instead.
 * This receipt never grants consent for November recurring enrollment.
 */
export function recordSimmerOctoberLinkPaid(s: SimmerState, binding: Pick<SimmerAgreement, 'ownerId' | 'clientId' | 'customerId'>, catalog: {
    verifiedOctoberProductId: string; october: SimmerPrice; livemode: boolean;
}, receipt: {
    account: string; livemode: boolean; customerId: string; ownerId: string; clientId: string;
    sessionId: string; paymentIntentId: string; invoiceId: string | null; paymentLinkId: string;
    mode: string; status: string; paymentStatus: string; paymentIntentStatus: string;
    cents: number; currency: string; quantity: number; priceId: string; billingPeriod: string;
}) {
    check(receipt.account === SIMMERDOWN.account && receipt.livemode === catalog.livemode && receipt.customerId === binding.customerId && receipt.ownerId === binding.ownerId && receipt.clientId === binding.clientId && !!binding.ownerId && !!binding.clientId && /^cus_[A-Za-z0-9_]+$/.test(binding.customerId), 'october_payment_ownership_mismatch');
    check((/^prod_[A-Za-z0-9_]+$/.test(catalog.verifiedOctoberProductId)) && (catalog.livemode ? catalog.verifiedOctoberProductId === SIMMERDOWN.octoberProduct : catalog.verifiedOctoberProductId !== SIMMERDOWN.octoberProduct) && priceOK(catalog.october, 'one_time', catalog.livemode, catalog.verifiedOctoberProductId), 'october_price_not_verified');
    check(/^plink_[A-Za-z0-9_]+$/.test(receipt.paymentLinkId) && (!catalog.livemode || receipt.paymentLinkId === SIMMERDOWN.octoberLink), 'october_link_not_verified');
    check(receipt.mode === 'payment' && receipt.status === 'complete' && receipt.paymentStatus === 'paid' && receipt.paymentIntentStatus === 'succeeded' && receipt.cents === 30000 && receipt.currency === 'usd' && receipt.quantity === 1 && receipt.priceId === catalog.october.id && receipt.billingPeriod === '2026-10', 'exact_paid_october_required');
    check(/^cs_[A-Za-z0-9_]+$/.test(receipt.sessionId) && /^pi_[A-Za-z0-9_]+$/.test(receipt.paymentIntentId) && (receipt.invoiceId === null || /^in_[A-Za-z0-9_]+$/.test(receipt.invoiceId)), 'provider_payment_identity_required');
    const fingerprint = createHash('sha256').update(JSON.stringify(receipt)).digest('hex');
    if (s.octoberPayment) {
        check(s.octoberPayment.receiptId === receipt.paymentIntentId && s.octoberPayment.fingerprint === fingerprint, 'duplicate_october_payment_review');
        return 'duplicate';
    }
    check(!s.octoberInvoiceId, 'duplicate_october_payment_review');
    s.octoberPayment = { source: 'one_time_link', account: receipt.account, livemode: receipt.livemode, ownerId: binding.ownerId, clientId: binding.clientId, customerId: binding.customerId, receiptId: receipt.paymentIntentId, fingerprint };
    s.octoberInvoiceId = receipt.invoiceId;
    // Any earlier combined reservation remains held: reconcile/expire it before a
    // recurring-only replacement. Never silently clear an uncertain provider attempt.
    return 'paid';
}
/** Inactive recurring-only enrollment receipt check; exact owned provider snapshot required. */
export function recordSimmerRecurringEnrollment(s: SimmerState, a: SimmerAgreement, receipt: {
    account: string; livemode: boolean; customerId: string; attemptId: string;
    sessionStatus: string; subscriptionId: string; subscriptionStatus: string;
    trialEnd: number; priceId: string; quantity: number; cents: number; currency: string;
    amountTotalNow: number; lineItemCount: number; paymentMethodReady: boolean;
}, now?: number) {
    check(s.request?.kind === 'recurring_only' && s.octoberPayment, 'paid_october_recurring_only_required');
    const params = JSON.parse(s.request.json) as SimmerCheckoutParams;
    check(!s.canceled || ['canceled','incomplete_expired'].includes(receipt.subscriptionStatus), 'terminal_subscription_conflict');
    check(receipt.account === SIMMERDOWN.account && receipt.livemode === s.request.livemode && receipt.customerId === a.customerId && params.customer === a.customerId && params.metadata.owner_id === a.ownerId && params.client_reference_id === a.clientId && params.metadata.agreement_id === a.agreementId && receipt.attemptId === s.request.idempotencyKey && params.metadata.october_paid_receipt === s.octoberPayment.receiptId, 'recurring_enrollment_ownership_mismatch');
    check(receipt.sessionStatus === 'complete' && (['trialing','canceled','incomplete_expired'].includes(receipt.subscriptionStatus) || (Number.isSafeInteger(now) && now! >= a.nextChargeAt && ['active','past_due','unpaid','incomplete_expired','paused','canceled'].includes(receipt.subscriptionStatus))) && receipt.trialEnd === a.nextChargeAt && receipt.trialEnd === params.subscription_data.trial_end && receipt.priceId === params.line_items[0].price && receipt.quantity === 1 && receipt.cents === 30000 && receipt.currency === 'usd' && receipt.amountTotalNow === 0 && receipt.lineItemCount === 1 && (receipt.paymentMethodReady || ['canceled','incomplete_expired'].includes(receipt.subscriptionStatus) || (Number.isSafeInteger(now) && now! >= a.nextChargeAt && ['past_due','unpaid','incomplete_expired','paused','canceled'].includes(receipt.subscriptionStatus))), 'recurring_only_exact_schedule_required');
    check(/^sub_[A-Za-z0-9_]+$/.test(receipt.subscriptionId), 'provider_identity_required');
    if (s.subscriptionId) { check(s.subscriptionId === receipt.subscriptionId, 'duplicate_subscription_review'); return 'duplicate'; }
    s.subscriptionId = receipt.subscriptionId;
    return 'enrolled';
}
