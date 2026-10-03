import { PROGRAM, requireThat, assertOwner, audit, type Identity, type Principal } from '../core';
import { sha256 } from '../checkout';
import { reconcile, type VerifiedEvent } from '../webhook';
import { PostgresWebsiteRepository } from './postgres';
import { StripeClient, stripeWebsiteProvider } from './stripe';
/** Explicit operator recovery; never scheduled. Unknown provider outcomes remain held.
 * Uses a fresh owned snapshot, not a clock-based local expiry or a replacement charge. */
export async function recoverWebsite(repository: PostgresWebsiteRepository, client: StripeClient, identity: Identity, principal: Principal, evidence: string) {
    assertOwner(identity, principal, 'operator');
    requireThat(evidence.length > 0 && evidence.length <= 500, 'evidence_required');
    const provider = stripeWebsiteProvider(client, id => repository.loadAttempt(id));
    return repository.transaction(identity, async (s) => {
        const attempt = s.attempts.find(a => a.status !== 'expired');
        requireThat(attempt, 'no_attempt_to_recover');
        const session = await client.findSession(attempt.id, attempt.createdAt, attempt.sessionId);
        const at = client.now, event: VerifiedEvent = { id: `evt_recovery_${sha256(`${PROGRAM}:${attempt.id}:${session.id}:${at}`).slice(0, 40)}`, type: 'checkout.session.completed', created: at, livemode: client.livemode, data: { object: { id: session.id } }, digest: sha256(JSON.stringify([attempt.id, session.id, at, evidence])) };
        const snapshot = await provider.snapshot(attempt.id, session.id, event);
        const result = reconcile(s, attempt, event, snapshot, client.livemode, client.now);
        audit(s, client.now, 'operator_recovery', principal.subject, evidence);
        return result;
    });
}
