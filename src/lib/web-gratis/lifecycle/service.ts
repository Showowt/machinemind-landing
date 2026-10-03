import { STRIPE_ACCOUNT, assertOwner, requireThat, withdraw, accept, approve, confirmGoLive, issueLink, calendar, nextAction, prepareReminder, type Identity, type Lifecycle, type Principal } from './core';
import { assertCheckoutSubmissionAllowed, reserveCheckout, recordCheckout, signLink, type ExactChargeConfirmation, type PriceCatalog, type CheckoutParams } from './checkout';
import { reconcile, supported, verifyEvent, type ProviderSnapshot, type VerifiedEvent } from './webhook';
/** Production adapter must implement serializable row locking, rollback on throw, unique
 * provider account/session/subscription/invoice ownership and durable event receipts.
 * Do not replace this contract with select/update or an in-process mutex in production.
 */
export interface Repository {
    transaction<T>(identity: Identity, fn: (state: Lifecycle) => Promise<T> | T, event?: VerifiedEvent): Promise<T>;
    /** Exact persisted attempt metadata/session/subscription lookup, never email/name/amount. */
    locate(event: VerifiedEvent): Promise<{
        identity: Identity;
        attemptId: string;
    } | null>;
}
export interface Provider {
    /** Verified adapter context, checked before any provider call. */
    readonly account: string;
    readonly livemode: boolean;
    /** Retrying MUST reuse idempotencyKey AND the identical persisted parameters. */
    createCheckout(params: CheckoutParams, idempotencyKey: string): Promise<{
        id: string;
        url: string;
        expiresAt: number;
    }>;
    /** Optional until cancellation integration is reviewed; service fails closed without it.
     * Must reconcile any ambiguous creation first, expire open sessions and cancel the exact
     * owned subscription with no extra/prorated charge. Return only after provider confirmation. */
    cancelEnrollment?(state: Readonly<Lifecycle>, idempotencyKey: string): Promise<{
        canceled: true;
    }>;
    /** Fetch session + current subscription + paid invoices from the pinned account.
     * Reject if triggering invoice is not owned by that subscription before returning.
     * No provider writes. Called under the durable tenant lock to serialize reconciliation.
     */
    snapshot(attemptId: string, sessionId: string | null, event: VerifiedEvent): Promise<ProviderSnapshot>;
}
export type Dependencies = {
    repository: Repository;
    provider: Provider;
    now: () => number;
    signingKey: string;
    webhookSecret: string;
    catalog: PriceCatalog;
    account: string;
    livemode: boolean;
    origin: string;
    recordLocator?: (identity: Identity) => string;
    /** Read-only proof after an explicit accepted-go-live command; no publication side effect here. */
    verifyPublication?: (identity: Identity, version: number) => Promise<{
        served: true;
        evidence: string;
    }>;
};
/** Inactive service factory; there is deliberately no production adapter or route importing it. */
export function billingService(d: Dependencies) {
    requireThat(d.account === STRIPE_ACCOUNT && d.provider.account === d.account && d.provider.livemode === d.livemode, 'provider_context_mismatch');
    return {
        async accept(identity: Identity, principal: Principal, input: Parameters<typeof accept>[2]) {
            return d.repository.transaction(identity, s => accept(s, principal, input, d.now()));
        },
        async approve(identity: Identity, principal: Principal, version: number, evidence: string) {
            return d.repository.transaction(identity, s => approve(s, principal, version, evidence, d.now()));
        },
        async goLive(identity: Identity, principal: Principal, mode: 'site_only' | 'accepted_go_live', version: number) {
            assertOwner(identity, principal, 'operator');
            if (mode === 'site_only')
                return 'skipped';
            return d.repository.transaction(identity, async (s) => {
                requireThat(s.acceptance?.siteVersion === version && s.approval?.siteVersion === version && !s.withdrawnAt, 'acceptance_and_approval_required');
                if (s.goLiveAt)
                    return 'already_live';
                requireThat(d.verifyPublication, 'publication_verifier_required');
                const receipt = await d.verifyPublication(identity, version);
                confirmGoLive(s, principal, { ...receipt, mode, siteId: s.siteId, signupId: s.signupId, siteVersion: version }, d.now());
                return 'started';
            });
        },
        async issueLink(identity: Identity, principal: Principal) {
            return d.repository.transaction(identity, s => { issueLink(s, principal, d.now()); return signLink(s, d.signingKey); });
        },
        async calendar(identity: Identity, principal: Principal) {
            return d.repository.transaction(identity, s => { assertOwner(s, principal, 'operator'); return { events: calendar(s, d.now()), next: nextAction(s, d.now()) }; });
        },
        async draftReminder(identity: Identity, principal: Principal, day: 15 | 20, timezone: string) {
            return d.repository.transaction(identity, s => {
                issueLink(s, principal, d.now());
                const url = new URL('/web/billing', d.origin);
                requireThat(url.protocol === 'https:', 'invalid_billing_origin');
                url.searchParams.set('token', signLink(s, d.signingKey));
                if (d.recordLocator) url.searchParams.set('record',d.recordLocator(identity));
                return prepareReminder(s, principal, day, d.now(), url.toString(), timezone);
            });
        },
        async checkout(identity: Identity, principal: Principal, token: string, confirmation?: ExactChargeConfirmation) {
            assertOwner(identity, principal, 'client');
            const decision = await d.repository.transaction(identity, s => reserveCheckout(s, principal, token, {
                signingKey: d.signingKey, catalog: d.catalog, livemode: d.livemode, origin: d.origin, confirmation,
            }, d.now()));
            if (decision.kind !== 'ready')
                return decision;
            // Re-check consent under the same durable lock used by withdrawal. The reservation
            // survives a crash; the external call always retains the original idempotency key.
            return d.repository.transaction(identity, async (s) => {
                requireThat(!s.withdrawnAt && s.enrollment === 'none', 'consent_or_enrollment_changed');
                const attempt = s.attempts.find(a => a.id === decision.attempt.id);
                requireThat(attempt && d.now() < attempt.expiresAt, 'checkout_reconciliation_required');
                if (attempt.sessionId && attempt.url)
                    return { kind: 'session' as const, url: attempt.url };
                assertCheckoutSubmissionAllowed(attempt.expiresAt, d.now());
                const response = await d.provider.createCheckout(decision.params, decision.idempotencyKey);
                recordCheckout(s, attempt.id, response, d.now());
                return { kind: 'session' as const, url: response.url };
            });
        },
        async withdraw(identity: Identity, principal: Principal, evidence: string) {
            assertOwner(identity, principal, 'client');
            // Local suppression is durable even if provider cancellation fails; retry remains required.
            await d.repository.transaction(identity, s => withdraw(s, principal, evidence, d.now()));
            return d.repository.transaction(identity, async (s) => {
                const hasProviderWork = s.attempts.some(a => a.status !== 'expired') || !!s.subscriptionId;
                if (!hasProviderWork)
                    return 'withdrawn';
                requireThat(d.provider.cancelEnrollment, 'provider_cancellation_pending');
                const result = await d.provider.cancelEnrollment(s, `withdraw_${s.siteId}_${s.goLiveAt}`);
                requireThat(result.canceled === true, 'provider_cancellation_pending');
                s.enrollment = 'canceled';
                for (const a of s.attempts)
                    if (a.status !== 'complete')
                        a.status = 'expired';
                s.audit.push({ at: d.now(), kind: 'provider_cancellation_confirmed', actor: 'stripe', evidence });
                return 'canceled';
            });
        },
        async webhook(raw: string, header: string | null) {
            const event = verifyEvent(raw, header, d.webhookSecret, { account: d.account, livemode: d.livemode }, d.now());
            if (!supported(event))
                return 'ignored';
            const located = await d.repository.locate(event);
            if (!located)
                return 'unowned';
            return d.repository.transaction(located.identity, async (s) => {
                if (s.events[event.id]) {
                    requireThat(s.events[event.id] === event.digest, 'event_payload_conflict');
                    return 'duplicate';
                }
                const attempt = s.attempts.find(a => a.id === located.attemptId);
                requireThat(attempt, 'unknown_attempt');
                const snapshot = await d.provider.snapshot(attempt.id, attempt.sessionId, event);
                return reconcile(s, attempt, event, snapshot, d.livemode, d.now());
            }, event);
        },
    };
}
