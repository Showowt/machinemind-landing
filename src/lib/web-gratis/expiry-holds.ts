/**
 * One reviewed operational exception. This is NOT payment activation or a new trial.
 * Deploying this policy requires the operator's approval. The original signup
 * deadline/history remains untouched; release receipts audit the effective policy.
 */
export interface ApprovedEvaluationWindow {
  startsAt: string;
  endsAt: string;
  consentedAt: string;
  recordedAt: string;
  /** Hash of the separately retained, exact client-date acceptance receipt. */
  consentReceiptSha256: string;
  /** Hash of the operator approval to record this exact window. */
  operatorApprovalSha256: string;
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

/** No proposed dates are recorded as consent. A later reviewed change is required. */
const JA_HOLD: Readonly<ExpiryHold> = Object.freeze({
  policyId: "ja-legacy-expiry-consent-hold-v1",
  signupId: "1afdbfc5-8703-4ecd-9405-fa2aebb4d708",
  siteId: "65005b57-c4bd-4837-8420-8fb6c2d9e283",
  referralCode: "E67BBT",
  reason: "Vencimiento heredado retenido por discrepancia de consentimiento; evaluación y seguimiento manuales.",
  timezone: "America/El_Salvador",
  monthlyPriceUsd: 20,
  evaluation: null,
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

/** Pure validation: malformed/backdated/unapproved windows never become active. */
export function validEvaluationWindow(window: Readonly<ApprovedEvaluationWindow>): boolean {
  const canonical = (value: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
  if (![window.startsAt, window.endsAt, window.consentedAt, window.recordedAt].every(canonical)) return false;
  if (![window.consentReceiptSha256, window.operatorApprovalSha256].every((v) => /^[a-f0-9]{64}$/.test(v))) return false;
  return Date.parse(window.endsAt) - Date.parse(window.startsAt) === 30 * 24 * 60 * 60 * 1000 &&
    Date.parse(window.consentedAt) <= Date.parse(window.recordedAt) && Date.parse(window.recordedAt) <= Date.parse(window.startsAt);
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
    consentReceiptSha256: window?.consentReceiptSha256 ?? null,
    operatorApprovalSha256: window?.operatorApprovalSha256 ?? null,
    /** Explicit: this runtime policy does not write the signup's payment-activation column. */
    storage: "reviewed_source_policy" as const,
  };
}
