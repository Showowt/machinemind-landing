/**
 * One reviewed operational exception. This is NOT payment activation or a new trial.
 * Deploying this policy requires the operator's approval. The original signup
 * deadline/history remains untouched; release receipts audit the effective policy.
 */
export interface ApprovedEvaluationWindow {
  startsAt: string;
  endsAt: string;
  recordedAt: string;
  evaluationAuthority: "owner_authorized_schedule_with_contextual_client_affirmation";
  consentBasis: "contextual_affirmative";
  /** Snapshot observation time, not an invented incoming-message timestamp. */
  consentObservedAt: string;
  clientAcknowledgmentReceivedAt: string | null;
  /** Selected client evidence, owner authorization and outgoing notice stay separate. */
  clientEvidenceReceiptSha256: string;
  operatorApprovalReceiptSha256: string;
  scheduleNoticeReceiptSha256: string;
  scheduleNoticeVerifiedAt: string;
}

export interface ExpiryHold {
  policyId: string;
  signupId: string;
  siteId: string;
  referralCode: string;
  reason: string;
  timezone: "America/El_Salvador";
  monthlyPriceUsd: 20;
  evaluation: Readonly<ApprovedEvaluationWindow> | null;
}

/**
 * Exact dates were clarified and affirmed in context, then separately authorized
 * and notified. Only receipt hashes are bundled; raw conversation stays private.
 */
const JA_HOLD: Readonly<ExpiryHold> = Object.freeze({
  policyId: "ja-legacy-expiry-consent-hold-v1",
  signupId: "1afdbfc5-8703-4ecd-9405-fa2aebb4d708",
  siteId: "65005b57-c4bd-4837-8420-8fb6c2d9e283",
  referralCode: "E67BBT",
  reason: "Vencimiento heredado retenido; período programado con consentimiento en contexto y seguimiento manual.",
  timezone: "America/El_Salvador",
  monthlyPriceUsd: 20,
  evaluation: Object.freeze({
    startsAt: "2026-10-20T15:00:00.000Z",
    endsAt: "2026-11-19T15:00:00.000Z",
    recordedAt: "2026-10-19T23:53:11.390Z",
    evaluationAuthority: "owner_authorized_schedule_with_contextual_client_affirmation",
    consentBasis: "contextual_affirmative",
    consentObservedAt: "2026-10-19T23:49:10.092Z",
    clientAcknowledgmentReceivedAt: null,
    clientEvidenceReceiptSha256: "c4dae42a4ebf51093a2d5e05f3e2e062b47a45cf811b94e74c86355b9405e916",
    operatorApprovalReceiptSha256: "afd402e02ecc58a714077282525956d844f0cc867f0837b76ec46b377c4186cb",
    scheduleNoticeReceiptSha256: "1c0367ed548282d75977d1365b9edcc53a1381f84f0bf747c4e34b11750a6b5a",
    scheduleNoticeVerifiedAt: "2026-10-19T23:49:33.941Z",
  }),
});

export const EXPIRY_HOLD_CODE = "manual_evaluation_hold";
export const EXPIRY_HOLD_MESSAGE = "Evaluación manual: cobros y avisos de vencimiento requieren una revisión y autorización separadas.";

export function getExpiryHold(signupId: string | null | undefined): Readonly<ExpiryHold> | null {
  return signupId === JA_HOLD.signupId ? JA_HOLD : null;
}

/** Commercial lifecycle templates are held; acknowledgments/site-ready stay unchanged. */
const HELD_TEMPLATES = new Set(["cqv_web_day28", "cqv_web_day30", "cqv_web_pause_notice", "cqv_web_rescue", "cqv_web_renewal"]);
export function isLegacyExpiryTemplateHeld(signupId: string | null | undefined, template: string | null | undefined): boolean {
  return !!getExpiryHold(signupId) && typeof template === "string" && HELD_TEMPLATES.has(template);
}

/** Pure validation: malformed, backdated or incompletely evidenced windows stay held. */
export function validEvaluationWindow(window: Readonly<ApprovedEvaluationWindow>): boolean {
  const canonical = (value: unknown): value is string => typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
  if (![window.startsAt, window.endsAt, window.consentObservedAt, window.scheduleNoticeVerifiedAt, window.recordedAt].every(canonical)) return false;
  if (window.evaluationAuthority !== "owner_authorized_schedule_with_contextual_client_affirmation" || window.consentBasis !== "contextual_affirmative") return false;
  const hashes = [window.clientEvidenceReceiptSha256, window.operatorApprovalReceiptSha256, window.scheduleNoticeReceiptSha256];
  if (!hashes.every((value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value)) || new Set(hashes).size !== 3) return false;
  if (window.clientAcknowledgmentReceivedAt !== null && (!canonical(window.clientAcknowledgmentReceivedAt) ||
    Date.parse(window.clientAcknowledgmentReceivedAt) > Date.parse(window.consentObservedAt))) return false;
  return Date.parse(window.endsAt) - Date.parse(window.startsAt) === 30 * 24 * 60 * 60 * 1000 &&
    Date.parse(window.consentObservedAt) <= Date.parse(window.scheduleNoticeVerifiedAt) &&
    Date.parse(window.scheduleNoticeVerifiedAt) <= Date.parse(window.recordedAt) &&
    Date.parse(window.recordedAt) <= Date.parse(window.startsAt);
}

export type EvaluationPhase = "awaiting_dates" | "scheduled" | "active" | "ended";
export function evaluationPhase(window: Readonly<ApprovedEvaluationWindow> | null, now: Date): EvaluationPhase {
  if (!window || !validEvaluationWindow(window) || !Number.isFinite(now.getTime())) return "awaiting_dates";
  if (now.getTime() < Date.parse(window.startsAt)) return "scheduled";
  return now.getTime() < Date.parse(window.endsAt) ? "active" : "ended";
}

export function getExpiryHoldState(signupId: string | null | undefined, now: Date) {
  const hold = getExpiryHold(signupId);
  if (!hold) return null;
  const window = hold.evaluation && validEvaluationWindow(hold.evaluation) ? hold.evaluation : null;
  return {
    policyId: hold.policyId,
    reason: hold.reason,
    phase: evaluationPhase(window, now),
    startsAt: window?.startsAt ?? null,
    endsAt: window?.endsAt ?? null,
    timezone: hold.timezone,
    monthlyPriceUsd: hold.monthlyPriceUsd,
    legacyExpiryActionsHeld: true as const,
    doesNotActivateBilling: true as const,
    legacyAutomaticPauseHeld: true as const,
    intervalApproved: !!window,
    phaseBasis: "configured_window_clock" as const,
    /** No native evaluation-start event is inferred from crossing a clock boundary. */
    actualActivationObservedAt: null,
    doesNotGrantPaymentAuthorization: true as const,
    evaluationAuthority: window?.evaluationAuthority ?? null,
    consentBasis: window?.consentBasis ?? null,
    consentObservedAt: window?.consentObservedAt ?? null,
    clientAcknowledgmentReceivedAt: window?.clientAcknowledgmentReceivedAt ?? null,
    recordedAt: window?.recordedAt ?? null,
    clientEvidenceReceiptSha256: window?.clientEvidenceReceiptSha256 ?? null,
    operatorApprovalReceiptSha256: window?.operatorApprovalReceiptSha256 ?? null,
    scheduleNoticeReceiptSha256: window?.scheduleNoticeReceiptSha256 ?? null,
    scheduleNoticeVerifiedAt: window?.scheduleNoticeVerifiedAt ?? null,
    /** Explicit: this runtime policy does not write the signup's payment-activation column. */
    storage: "reviewed_source_policy" as const,
  };
}
