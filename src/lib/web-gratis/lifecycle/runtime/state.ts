import { z } from 'zod';
import { DAY, requireThat, type Lifecycle } from '../core';
import { sha256 } from '../checkout';
const epoch = z.number().int().positive().safe();
const text = z.string().min(1).max(500);
const identity = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
export const lifecycleSchema = z.object({
    version: z.literal(1), ownerId: identity, tenantId: identity, signupId: identity, siteId: identity,
    plan: z.object({ key: z.enum(['standard20', 'michoacana19']), cents: z.union([z.literal(1900), z.literal(2000)]), currency: z.literal('usd'), interval: z.literal('month') }).strict(),
    acceptance: z.object({ at: epoch, subject: text, evidence: text, terms: z.string().min(1).max(100), siteVersion: z.number().int().positive(), cents: z.number().int(), remindersAgreed: z.boolean() }).strict().nullable(),
    approval: z.object({ at: epoch, subject: text, siteVersion: z.number().int().positive(), evidence: text }).strict().nullable(),
    goLiveAt: epoch.nullable(), trialEnd: epoch.nullable(), publicationEvidence: text.nullable(), withdrawnAt: epoch.nullable(),
    messaging: z.enum(['allowed', 'opted_out', 'human_owned']),
    link: z.object({ generation: z.number().int().positive(), issuedAt: epoch, expiresAt: epoch }).strict().nullable(),
    attempts: z.array(z.object({ id: text, generation: z.number().int().positive(), kind: z.enum(['trial', 'charge_now']), priceId: text, createdAt: epoch, expiresAt: epoch, confirmationAt: epoch.nullable(), requestJson: z.string().max(20000), status: z.enum(['creating', 'open', 'complete', 'expired']), sessionId: text.nullable(), url: z.string().url().nullable() }).strict()),
    subscriptionId: text.nullable(), customerId: text.nullable(), enrollment: z.enum(['none', 'trialing', 'active', 'past_due', 'incomplete', 'paused', 'canceled']),
    paymentMethodReady: z.boolean(), cancelAtPeriodEnd: z.boolean(), paidThrough: epoch.nullable(),
    invoices: z.record(text, z.object({ paidAt: epoch, cents: z.number().int().positive(), periodEnd: epoch }).strict()),
    events: z.record(text, z.string().regex(/^[a-f0-9]{64}$/)),
    reminders: z.partialRecord(z.enum(['15', '20']), z.enum(['drafted', 'sent', 'failed'])),
    audit: z.array(z.object({ at: epoch, kind: text, actor: text, evidence: text }).strict()),
}).strict();
export function parseLifecycle(value: unknown): Lifecycle {
    const s = lifecycleSchema.parse(value) as Lifecycle;
    requireThat(s.plan.cents === (s.plan.key === 'michoacana19' ? 1900 : 2000), 'stored_plan_mismatch');
    if (s.goLiveAt !== null)
        requireThat(s.acceptance && s.approval && s.publicationEvidence && s.trialEnd === s.goLiveAt + 30 * DAY && s.acceptance.at <= s.goLiveAt && s.approval.at <= s.goLiveAt && s.acceptance.siteVersion === s.approval.siteVersion && s.acceptance.cents === s.plan.cents, 'stored_deadline_invalid');
    else
        requireThat(s.trialEnd === null && s.publicationEvidence === null, 'stored_deadline_invalid');
    requireThat(new Set(s.attempts.map(a => a.id)).size === s.attempts.length && new Set(s.attempts.map(a => a.generation)).size === s.attempts.length, 'stored_attempt_duplicate');
    for (const a of s.attempts) {
        const p = JSON.parse(a.requestJson) as Record<string, unknown>;
        requireThat(p.expires_at === a.expiresAt && a.expiresAt > a.createdAt, 'stored_attempt_invalid');
    }
    return s;
}
export const recordKey = (program: string, account: string, live: boolean, identity: unknown) => sha256(JSON.stringify([program, account, live, identity]));
export function assertImmutable(before: Lifecycle, after: Lifecycle) {
    for (const key of ['ownerId', 'tenantId', 'signupId', 'siteId', 'plan'] as const)
        requireThat(JSON.stringify(before[key]) === JSON.stringify(after[key]), 'stored_identity_changed');
    if (before.goLiveAt)
        for (const key of ['acceptance', 'approval', 'goLiveAt', 'trialEnd', 'publicationEvidence'] as const)
            requireThat(JSON.stringify(before[key]) === JSON.stringify(after[key]), 'stored_agreement_changed');
    for (const [id, digest] of Object.entries(before.events))
        requireThat(after.events[id] === digest, 'event_receipt_changed');
    for (const [id, receipt] of Object.entries(before.invoices))
        requireThat(JSON.stringify(after.invoices[id]) === JSON.stringify(receipt), 'payment_receipt_changed');
    requireThat(after.audit.length >= before.audit.length && JSON.stringify(after.audit.slice(0, before.audit.length)) === JSON.stringify(before.audit), 'audit_history_changed');
}
