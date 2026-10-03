/** Inactive fixed-deadline billing domain. No environment, DB, network or sends. */
export const DAY = 86400;
export const CHECKOUT_LIFETIME = 3600;
export const PROGRAM = 'web_gratis_fixed_v1';
export const STRIPE_ACCOUNT = 'acct_1QvaObIS8EYk0ASL';
export type Identity = {
    ownerId: string;
    tenantId: string;
    signupId: string;
    siteId: string;
};
/** Construct only from the server's authenticated session / verified registry. */
export type Principal = {
    role: 'client' | 'operator';
    subject: string;
    ownerId: string;
    tenantId: string;
};
export type Plan = {
    key: 'standard20' | 'michoacana19';
    cents: 2000 | 1900;
    currency: 'usd';
    interval: 'month';
};
export type Acceptance = {
    at: number;
    subject: string;
    evidence: string;
    terms: string;
    siteVersion: number;
    cents: number;
    remindersAgreed: boolean;
};
export type Audit = {
    at: number;
    kind: string;
    actor: string;
    evidence: string;
};
export type Link = {
    generation: number;
    issuedAt: number;
    expiresAt: number;
};
export type Attempt = {
    id: string;
    generation: number;
    kind: 'trial' | 'charge_now';
    priceId: string;
    createdAt: number;
    expiresAt: number;
    confirmationAt: number | null;
    requestJson: string;
    status: 'creating' | 'open' | 'complete' | 'expired';
    sessionId: string | null;
    url: string | null;
};
export type Lifecycle = Identity & {
    version: 1;
    plan: Plan;
    acceptance: Acceptance | null;
    approval: {
        at: number;
        subject: string;
        siteVersion: number;
        evidence: string;
    } | null;
    goLiveAt: number | null;
    trialEnd: number | null;
    publicationEvidence: string | null;
    withdrawnAt: number | null;
    messaging: 'allowed' | 'opted_out' | 'human_owned';
    link: Link | null;
    attempts: Attempt[];
    subscriptionId: string | null;
    customerId: string | null;
    enrollment: 'none' | 'trialing' | 'active' | 'past_due' | 'incomplete' | 'paused' | 'canceled';
    paymentMethodReady: boolean;
    cancelAtPeriodEnd: boolean;
    paidThrough: number | null;
    invoices: Record<string, {
        paidAt: number;
        cents: number;
        periodEnd: number;
    }>;
    events: Record<string, string>;
    reminders: Partial<Record<15 | 20, 'drafted' | 'sent' | 'failed'>>;
    audit: Audit[];
};
export function requireThat(value: unknown, reason: string): asserts value {
    if (!value)
        throw new Error(reason);
}
export function time(now: number) { requireThat(Number.isSafeInteger(now) && now > 0, 'invalid_time'); }
export function assertOwner(s: Identity, p: Principal, role?: Principal['role']) {
    requireThat(p.ownerId === s.ownerId && p.tenantId === s.tenantId && !!p.subject && (!role || p.role === role), 'ownership_mismatch');
}
export function audit(s: Lifecycle, at: number, kind: string, actor: string, evidence: string) {
    time(at);
    requireThat(evidence.length > 0 && evidence.length <= 500, 'evidence_required');
    s.audit.push({ at, kind, actor, evidence });
}
/** Exceptions use verified immutable signup IDs, never editable display names or request amounts. */
export function planFor(signupId: string, verifiedMichoacanaSignupId: string): Plan {
    requireThat(!!verifiedMichoacanaSignupId && !!signupId, 'verified_price_binding_required');
    return signupId === verifiedMichoacanaSignupId
        ? { key: 'michoacana19', cents: 1900, currency: 'usd', interval: 'month' }
        : { key: 'standard20', cents: 2000, currency: 'usd', interval: 'month' };
}
export function newLifecycle(identity: Identity, verifiedMichoacanaSignupId: string): Lifecycle {
    for (const value of Object.values(identity))
        requireThat(/^[A-Za-z0-9_-]{1,100}$/.test(value), 'invalid_identity');
    return { ...identity, version: 1, plan: planFor(identity.signupId, verifiedMichoacanaSignupId),
        acceptance: null, approval: null, goLiveAt: null, trialEnd: null, publicationEvidence: null,
        withdrawnAt: null, messaging: 'allowed', link: null, attempts: [], subscriptionId: null,
        customerId: null, enrollment: 'none', paymentMethodReady: false, cancelAtPeriodEnd: false,
        paidThrough: null, invoices: {}, events: {}, reminders: {}, audit: [] };
}
export function accept(s: Lifecycle, p: Principal, input: {
    siteVersion: number;
    terms: string;
    cents: number;
    currency: 'usd';
    interval: 'month';
    approveSiteAndGoLive: boolean;
    agreeBilling: boolean;
    remindersAgreed: boolean;
    evidence: string;
}, now: number) {
    assertOwner(s, p, 'client');
    time(now);
    requireThat(!s.withdrawnAt && !s.goLiveAt, 'agreement_locked');
    requireThat(typeof input.remindersAgreed === 'boolean', 'explicit_reminder_agreement_required');
    requireThat(input.approveSiteAndGoLive === true && input.agreeBilling === true, 'explicit_client_acceptance_required');
    requireThat(input.cents === s.plan.cents && input.currency === s.plan.currency && input.interval === s.plan.interval, 'quote_mismatch');
    requireThat(input.terms.length > 0 && input.terms.length <= 100 && Number.isSafeInteger(input.siteVersion) && input.siteVersion > 0, 'invalid_agreement');
    if (s.acceptance) {
        requireThat(s.acceptance.evidence === input.evidence && s.acceptance.subject === p.subject && s.acceptance.siteVersion === input.siteVersion && s.acceptance.terms === input.terms && s.acceptance.remindersAgreed === input.remindersAgreed, 'acceptance_already_recorded');
        return;
    }
    audit(s, now, 'client_accepted', p.subject, input.evidence);
    s.acceptance = { at: now, subject: p.subject, evidence: input.evidence, terms: input.terms,
        siteVersion: input.siteVersion, cents: input.cents, remindersAgreed: input.remindersAgreed };
}
export function approve(s: Lifecycle, p: Principal, siteVersion: number, evidence: string, now: number) {
    assertOwner(s, p, 'operator');
    time(now);
    requireThat(!s.goLiveAt && !s.withdrawnAt && Number.isSafeInteger(siteVersion) && siteVersion > 0, 'approval_locked');
    audit(s, now, 'operator_approved', p.subject, evidence);
    s.approval = { at: now, subject: p.subject, siteVersion, evidence };
}
/** Call only after successful publication + fresh public serving verification. Never from site_only. */
export function confirmGoLive(s: Lifecycle, p: Principal, proof: {
    mode: 'site_only' | 'accepted_go_live';
    siteId: string;
    signupId: string;
    siteVersion: number;
    served: boolean;
    evidence: string;
}, now: number) {
    assertOwner(s, p, 'operator');
    time(now);
    if (proof.mode === 'site_only')
        return; // Even prior public concepts do not imply consent.
    requireThat(!s.withdrawnAt && proof.served === true && proof.siteId === s.siteId && proof.signupId === s.signupId, 'publication_unverified');
    requireThat(s.acceptance && s.approval && s.acceptance.at <= now && s.approval.at <= now && s.acceptance.siteVersion === proof.siteVersion && s.approval.siteVersion === proof.siteVersion, 'acceptance_and_approval_required');
    if (s.goLiveAt !== null) {
        requireThat(s.publicationEvidence === proof.evidence, 'go_live_immutable');
        return;
    }
    audit(s, now, 'accepted_site_live', p.subject, proof.evidence);
    s.goLiveAt = now;
    s.trialEnd = now + 30 * DAY;
    s.publicationEvidence = proof.evidence;
}
export function withdraw(s: Lifecycle, p: Principal, evidence: string, now: number) {
    assertOwner(s, p, 'client');
    time(now);
    if (s.withdrawnAt)
        return;
    audit(s, now, 'client_withdrew', p.subject, evidence);
    s.withdrawnAt = now;
    s.link = null;
    // Provider cancellation is a separately acknowledged operation; never pretend local withdrawal canceled Stripe.
}
export function issueLink(s: Lifecycle, p: Principal, now: number, lifetime = 7 * DAY): Link {
    assertOwner(s, p, 'operator');
    time(now);
    requireThat(s.acceptance && s.goLiveAt && s.trialEnd && !s.withdrawnAt && s.enrollment === 'none', 'not_link_eligible');
    requireThat(!s.attempts.some(a => a.status === 'creating' || a.status === 'open' || a.status === 'complete'), 'reconcile_existing_checkout');
    requireThat(Number.isSafeInteger(lifetime) && lifetime > 0 && lifetime <= 7 * DAY, 'invalid_link_lifetime');
    const generation = (s.link?.generation ?? s.attempts.at(-1)?.generation ?? 0) + 1;
    s.link = { generation, issuedAt: now, expiresAt: now + lifetime };
    audit(s, now, 'billing_link_issued', p.subject, `generation:${generation}`);
    return s.link;
}
export type CalendarItem = {
    kind: 'day15' | 'day20' | 'first_charge';
    at: number;
    status: string;
    label: string;
};
export function calendar(s: Lifecycle, now: number): CalendarItem[] {
    time(now);
    if (!s.goLiveAt || !s.trialEnd || !s.acceptance)
        return [];
    const reminders = ([15, 20] as const).map(day => ({ kind: `day${day}` as 'day15' | 'day20', at: s.goLiveAt! + day * DAY,
        status: reminderStatus(s, day, now), label: `Configurar pago · día ${day}` }));
    return [...reminders, { kind: 'first_charge', at: s.trialEnd, status: s.withdrawnAt || s.enrollment === 'canceled' || s.cancelAtPeriodEnd ? 'canceled' : s.enrollment === 'trialing' && s.paymentMethodReady ? 'scheduled' : Object.keys(s.invoices).length ? 'paid' : now >= s.trialEnd ? 'confirmation_required' : 'awaiting_enrollment', label: `Primer cobro previsto · USD ${(s.plan.cents / 100).toFixed(2)}` }];
}
export function reminderStatus(s: Lifecycle, day: 15 | 20, now: number): string {
    time(now);
    requireThat(day === 15 || day === 20, 'invalid_reminder_day');
    if (!s.acceptance?.remindersAgreed || !s.goLiveAt || !s.trialEnd || s.withdrawnAt || s.messaging !== 'allowed')
        return 'suppressed';
    // Failure/cancellation requires a specific recovery conversation, not another setup reminder.
    if (s.enrollment !== 'none')
        return 'suppressed';
    if (s.reminders[day])
        return s.reminders[day]!;
    const at = s.goLiveAt + day * DAY;
    if (now < at)
        return 'scheduled';
    if (now >= at + DAY || now >= s.trialEnd)
        return 'missed'; // Never catch up two reminders in one run.
    if (s.attempts.some(a => a.status === 'creating' || a.status === 'open'))
        return 'checkout_pending';
    return 'draft_due';
}
export function nextAction(s: Lifecycle, now: number): string {
    if (s.withdrawnAt)
        return s.subscriptionId || s.attempts.some(a => a.status !== 'expired') ? 'Confirmar cancelación en Stripe; bloquear enlaces y recordatorios' : 'Consentimiento retirado; no cobrar';
    if (!s.acceptance)
        return 'Obtener aceptación real del cliente';
    if (!s.approval)
        return 'Revisar aprobación de Phil';
    if (!s.goLiveAt)
        return 'Verificar publicación real y confirmar inicio';
    if (s.enrollment === 'canceled' || s.cancelAtPeriodEnd)
        return 'Cancelación registrada; no reinscribir automáticamente';
    if (['past_due', 'incomplete', 'paused'].includes(s.enrollment))
        return 'Revisar pago con el cliente; no crear otra suscripción';
    if (s.enrollment === 'active')
        return 'Consultar próxima factura';
    if (s.enrollment === 'trialing')
        return s.paymentMethodReady ? 'Pago preparado para la fecha acordada' : 'Revisar método de pago sin reiniciar prueba';
    if (s.attempts.some(a => ['creating', 'open', 'complete'].includes(a.status)))
        return 'Conciliar sesión existente';
    if (now >= s.trialEnd!)
        return 'Mostrar importe exacto y solicitar confirmación de cobro ahora';
    if (now >= s.trialEnd! - 2 * DAY - CHECKOUT_LIFETIME)
        return 'Revisión asistida: conservar día 30, no cobrar antes';
    return 'Preparar enlace de configuración con vencimiento fijo';
}
export function reminderDraft(s: Lifecycle, day: 15 | 20, now: number, billingUrl: string, timezone: string) {
    requireThat(reminderStatus(s, day, now) === 'draft_due', 'reminder_not_due');
    const url = new URL(billingUrl);
    requireThat(url.protocol === 'https:', 'invalid_billing_url');
    const end = new Intl.DateTimeFormat('es-SV', { dateStyle: 'long', timeStyle: 'short', timeZone: timezone }).format(new Date(s.trialEnd! * 1000));
    const amount = `USD ${(s.plan.cents / 100).toFixed(2)}`;
    return `Hola. ${day === 15 ? 'Su sitio lleva 15 días publicado desde su aprobación.' : 'Le recordamos la configuración de pago de su sitio.'} Como acordamos, sus 30 días gratuitos terminan el ${end} (${timezone}). Después, el servicio cuesta ${amount} al mes. Puede registrar su tarjeta aquí: ${billingUrl}. No se cobra hoy; el primer cobro está previsto para esa fecha. El enlace no reinicia los 30 días. Si no desea continuar o necesita ayuda, responda a este mensaje. Borrador pendiente de revisión; no enviado.`;
}
/** Reserve an unsent draft atomically; a future sender must recheck consent/enrollment
 * immediately before delivery and enforce unique key in a durable outbox. No sending here. */
export function prepareReminder(s: Lifecycle, p: Principal, day: 15 | 20, now: number, billingUrl: string, timezone: string) {
    assertOwner(s, p, 'operator');
    const text = reminderDraft(s, day, now, billingUrl, timezone);
    const key = `${PROGRAM}:${s.ownerId}:${s.siteId}:${s.goLiveAt}:day${day}`;
    s.reminders[day] = 'drafted';
    audit(s, now, `reminder_day${day}_drafted`, p.subject, key);
    return { key, text, sendEnabled: false as const, dueAt: s.goLiveAt! + day * DAY, expiresAt: s.goLiveAt! + (day + 1) * DAY };
}
/** Minimal authoritative read model consumed by Sophia; no customer data or bearer links. */
export function sophiaSnapshot(s: Lifecycle, p: Principal, now: number) {
    assertOwner(s, p, 'operator');
    time(now);
    return { contract: PROGRAM, ownerId: s.ownerId, tenantId: s.tenantId, signupId: s.signupId, siteId: s.siteId,
        observedAt: now, acceptanceAt: s.acceptance?.at ?? null, goLiveAt: s.goLiveAt, trialEnd: s.trialEnd,
        monthlyCents: s.plan.cents, currency: s.plan.currency, interval: s.plan.interval, enrollment: s.enrollment,
        withdrawn: s.withdrawnAt !== null, remindersAgreed: s.acceptance?.remindersAgreed ?? false };
}
/** Safety check for a future outbox dispatcher. A draft reservation never authorizes a send. */
export function reminderDispatchAllowed(s: Lifecycle, day: 15 | 20, now: number): boolean {
    if (s.reminders[day] !== 'drafted')
        return false;
    return reminderStatus({ ...s, reminders: { ...s.reminders, [day]: undefined } }, day, now) === 'draft_due';
}
