import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { PROGRAM, STRIPE_ACCOUNT, audit, requireThat, time, type Lifecycle, type Attempt } from './core';
import { metadata, sha256 } from './checkout';
const SUPPORTED = new Set(['checkout.session.completed', 'checkout.session.expired', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted', 'invoice.paid', 'invoice.payment_failed', 'invoice.payment_action_required']);
const eventSchema = z.object({
    id: z.string().regex(/^evt_[A-Za-z0-9_]{1,200}$/), created: z.number().int().positive(), type: z.string().max(100),
    livemode: z.boolean(), account: z.string().optional(), data: z.object({ object: z.object({ id: z.string().min(1).max(200) }).passthrough() }),
});
export type VerifiedEvent = z.infer<typeof eventSchema> & {
    digest: string;
};
/** Verify untouched request.text() before parsing or making any repository/provider calls. */
export function verifyEvent(raw: string, signature: string | null, secret: string, expected: {
    account: string;
    livemode: boolean;
}, now: number): VerifiedEvent {
    time(now);
    requireThat(secret.length >= 32 && raw.length <= 1000000 && signature && signature.length < 2000, 'webhook_unverified');
    const fields = signature.split(',').map(p => p.trim().split('='));
    const timestamps = fields.filter(([k]) => k === 't').map(([, v]) => v);
    requireThat(timestamps.length === 1 && /^\d+$/.test(timestamps[0]), 'webhook_unverified');
    const at = Number(timestamps[0]);
    requireThat(Number.isSafeInteger(at) && Math.abs(now - at) <= 300, 'webhook_unverified');
    const wanted = createHmac('sha256', secret).update(`${at}.${raw}`).digest();
    requireThat(fields.some(([k, v]) => k === 'v1' && /^[a-f0-9]{64}$/i.test(v ?? '') && timingSafeEqual(Buffer.from(v, 'hex'), wanted)), 'webhook_unverified');
    const event = eventSchema.parse(JSON.parse(raw));
    requireThat(expected.account === STRIPE_ACCOUNT && (!event.account || event.account === expected.account) && event.livemode === expected.livemode && event.created <= now + 300, 'webhook_account_mismatch');
    return { ...event, digest: sha256(raw) };
}
export function supported(event: VerifiedEvent) { return SUPPORTED.has(event.type); }
export type ProviderSnapshot = {
    account: string;
    livemode: boolean;
    retrievedAt: number;
    eventObject: {
        id: string;
        subscriptionId: string | null;
        customerId: string | null;
    };
    session: {
        id: string;
        status: 'open' | 'complete' | 'expired';
        mode: 'subscription';
        customerId: string | null;
        subscriptionId: string | null;
        clientReferenceId: string;
        metadata: Record<string, string>;
        priceId: string;
        quantity: number;
        currency: string;
        amountTotal: number;
        expiresAt: number;
    };
    subscription: null | {
        id: string;
        customerId: string;
        status: 'trialing' | 'active' | 'past_due' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'paused' | 'canceled';
        priceId: string;
        quantity: number;
        cents: number;
        currency: string;
        interval: string;
        intervalCount: number;
        trialEnd: number | null;
        paymentMethodReady: boolean;
        cancelAtPeriodEnd: boolean;
        currentPeriodEnd: number;
        metadata: Record<string, string>;
    };
    /** Only actually paid invoices; fetched from this subscription, including the triggering invoice. */
    paidInvoices: {
        id: string;
        subscriptionId: string;
        customerId: string;
        cents: number;
        currency: string;
        paidAt: number;
        periodStart: number;
        periodEnd: number;
    }[];
};
function tagsMatch(expected: Record<string, string>, actual: Record<string, string>) { return Object.entries(expected).every(([k, v]) => actual[k] === v); }
/** Events are wake-ups: use a fresh authoritative snapshot while holding the tenant lock.
 * Never derive the latest state from event.created (Stripe does not guarantee ordering).
 */
export function reconcile(s: Lifecycle, a: Attempt, event: VerifiedEvent, snapshot: ProviderSnapshot, expectedLive: boolean, now: number) {
    time(now);
    if (s.events[event.id]) {
        requireThat(s.events[event.id] === event.digest, 'event_payload_conflict');
        return 'duplicate' as const;
    }
    requireThat(snapshot.account === STRIPE_ACCOUNT && snapshot.livemode === expectedLive && snapshot.retrievedAt <= now && snapshot.retrievedAt >= now - 60, 'stale_or_foreign_snapshot');
    const session = snapshot.session;
    const sub = snapshot.subscription;
    const tags = metadata(s, a);
    requireThat(session.mode === 'subscription' && session.clientReferenceId === s.signupId && tagsMatch(tags, session.metadata) && session.priceId === a.priceId && session.quantity === 1 && session.currency === 'usd' && session.expiresAt === a.expiresAt, 'session_binding_mismatch');
    requireThat(!a.sessionId || session.id === a.sessionId, 'session_binding_mismatch');
    requireThat(session.amountTotal === (a.kind === 'trial' ? 0 : s.plan.cents), 'unexpected_checkout_total');
    const eventObject = event.data.object.id;
    requireThat(snapshot.eventObject.id === eventObject, 'event_object_mismatch');
    requireThat(eventObject === session.id || eventObject === sub?.id || (event.type.startsWith('invoice.') && sub && snapshot.eventObject.subscriptionId === sub.id && snapshot.eventObject.customerId === sub.customerId), 'event_object_mismatch');
    if (sub) {
        requireThat(s.enrollment !== 'canceled' || sub.status === 'canceled' || sub.status === 'incomplete_expired', 'terminal_subscription_conflict');
        requireThat(session.subscriptionId === sub.id && session.customerId === sub.customerId && (!s.subscriptionId || s.subscriptionId === sub.id) && (!s.customerId || s.customerId === sub.customerId), 'subscription_binding_mismatch');
        requireThat(tagsMatch(tags, sub.metadata) && sub.priceId === a.priceId && sub.quantity === 1 && sub.cents === s.plan.cents && sub.currency === 'usd' && sub.interval === 'month' && sub.intervalCount === 1, 'subscription_price_mismatch');
        requireThat(a.kind === 'trial' ? sub.trialEnd === s.trialEnd : sub.trialEnd === null, 'trial_deadline_mismatch');
        requireThat(session.status === 'complete', 'subscription_before_checkout');
    }
    else
        requireThat(session.status !== 'complete', 'subscription_not_ready_retry');
    // Validate the entire snapshot before modifying anything (repository also rolls back on error).
    for (const invoice of snapshot.paidInvoices) {
        requireThat(/^in_[A-Za-z0-9_]{1,200}$/.test(invoice.id) && sub && invoice.subscriptionId === sub.id && invoice.customerId === sub.customerId && invoice.currency === 'usd' && invoice.cents === s.plan.cents && invoice.periodEnd > invoice.periodStart && invoice.paidAt <= now, 'invoice_binding_mismatch');
        requireThat(invoice.paidAt >= s.trialEnd! && invoice.periodStart >= s.trialEnd! && (a.kind !== 'charge_now' || invoice.paidAt >= a.confirmationAt!), 'early_charge_review_required');
        if (s.invoices[invoice.id])
            requireThat(s.invoices[invoice.id].cents === invoice.cents && s.invoices[invoice.id].paidAt === invoice.paidAt && s.invoices[invoice.id].periodEnd === invoice.periodEnd, 'invoice_conflict');
    }
    a.sessionId = session.id;
    a.status = session.status;
    if (sub) {
        s.subscriptionId = sub.id;
        s.customerId = sub.customerId;
        s.enrollment = sub.status === 'unpaid' ? 'past_due' : sub.status === 'incomplete_expired' ? 'canceled' : sub.status;
        s.paymentMethodReady = sub.paymentMethodReady;
        s.cancelAtPeriodEnd = sub.cancelAtPeriodEnd;
    }
    for (const invoice of snapshot.paidInvoices) {
        s.invoices[invoice.id] = { paidAt: invoice.paidAt, cents: invoice.cents, periodEnd: invoice.periodEnd };
        s.paidThrough = Math.max(s.paidThrough ?? 0, invoice.periodEnd);
    }
    // An enrolled free trial is not revenue; only verified positive invoices enter the payment ledger.
    s.events[event.id] = event.digest;
    audit(s, now, 'stripe_reconciled', 'stripe', `${event.id}:${event.type}`);
    return 'applied' as const;
}
export { PROGRAM };
