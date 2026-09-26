/**
 * Free-website funnel — automatic WhatsApp scheduler ("no human in the loop").
 *
 * Runs inside the 1-minute cron. Each run:
 *   1. retries queued template rows that are due (only templates whose send
 *      window is open, so rows waiting for their window never block others),
 *   2. evaluates triggers T1–T7 in order and sends what's due,
 *   3. auto-pauses unpaid sites (T6, no message) — only after they were asked
 *      to pay, and a day after the pause notice when it went out,
 *   4. T8/T9: monthly renewals of PayPal / manual payers — a reminder 3 days
 *      before paid_through, the pause notice 3 days after it if still unpaid,
 *      and the same auto-pause rule a day later.
 *
 * Payment asks (day 28 / day 30 / pause notice / renewal) go out whenever
 * /pagar can take a payment: a Stripe Payment Link OR PayPal (the board's link,
 * else DEFAULT_PAYPAL_LINK). Only when neither exists are they held, with one
 * "configure a payment method" alert a day.
 *
 * Idempotency lives in the database: a send is an INSERT into
 * web_gratis_messages, UNIQUE (signup_id, template, cycle) NULLS NOT DISTINCT —
 * a conflict means another run already owns that template for that signup (and
 * renewal cycle: cycle = the paid_through date the renewal asks about; null for
 * everything else, so the free month keeps one row per template ever). Rows
 * carry a short lease (locked_until) while a sender is talking to Rewired, so
 * overlapping cron runs and a manual "reintentar" from the board can never send
 * the same row twice. A send whose outcome is unknown (Rewired timed out / 5xx
 * after possibly reaching Meta) is never re-sent automatically: a person checks
 * the chat.
 *
 * The date rules (which day each ask goes out, when a site pauses) are the
 * payment calendar in templates.ts — the same one billing.ts shows on the board.
 *
 * The site never calls Meta: sends go through Rewired OS (rewired.ts), which
 * owns the number, its health gates and the opt-out stores. Every failure is
 * either retried with backoff or ends as 'failed' + a team alert.
 *
 * Test rows ("ZZ …", the D5 harness) are never acted on by a general sweep.
 * Time comes from deps.now() so the scheduler can be exercised with a fake
 * clock; alerts, sends and site purges are injectable for the same reason.
 */
import { randomBytes } from "crypto";
import { MONTHLY_PRICE_USD } from "./config";
import { enqueueSystem } from "./outbox";
import { sendViaRewired, type RewiredSendRequest, type SendOutcome } from "./rewired";
import {
  BUILDING_STATUSES,
  getDb,
  LIVE_FREE_STATUSES,
  loadSettings,
  SIGNUPS_TABLE,
  svDate,
  type SignupStatus,
  type WebGratisSettings,
} from "./server";
import { revalidateSignupSite } from "./sites/mm-sites";
import {
  addDays,
  FREE_MONTH_FLOW,
  formatDateEs,
  GLOBAL_HOLD_CODES,
  hasPaymentMethod,
  inFlowRange,
  isTemplateLevelCode,
  manualBlock,
  pauseDecision,
  REACHED_STATUSES,
  REMINDER_TEMPLATES,
  RENEWAL_FLOW,
  RENEWAL_TEMPLATES,
  TEMPLATE_LABEL,
  TEMPLATE_NAMES,
  TEMPLATE_WINDOW,
  templatePayload,
  templatePreview,
  UNKNOWN_OUTCOME_CODE,
  windowOpen,
  WINDOW_LABEL,
  type PauseDecision,
  type PaymentFlow,
  type TemplateName,
} from "./templates";

export const MESSAGES_TABLE = "web_gratis_messages";
const STATE_VIEW = "web_gratis_wa_state";

export const MAX_ATTEMPTS = 12;
const LEASE_MS = 3 * 60 * 1000;
const MIN = 60;
const HOUR = 60 * MIN;
const DAY_MS = 24 * 3_600_000;

const READY_MAX_AGE_MS = 14 * DAY_MS;
/** The form is public and unverified: the confirmation waits so the business's own "Confirmar por WhatsApp" tap (or a person) gets there first. */
const T1_DELAY_MS = 15 * 60 * 1000;
/** Grace after "→ Entregada" so a "Web lista" sent by hand from the board is seen before the template goes out. */
const T2_DELAY_MS = 10 * 60 * 1000;
/** Automatic confirmations per network fingerprint (ip_hash) per hour; the rest are held for a person. */
const T1_PER_IP_PER_HOUR = 3;
/** Never auto-confirm the same phone twice within this period (whichever request it belongs to). */
const T1_PHONE_COOLDOWN_MS = 7 * DAY_MS;
/** Paused sites are offered a re-contact after this many days. */
const RECONTACT_AFTER_DAYS = 60;

const LIVE_FREE = LIVE_FREE_STATUSES;
const BUILDING = BUILDING_STATUSES;
const REACHED = REACHED_STATUSES;
/** Payers who pay one month at a time (Stripe renews on its own). */
const MONTHLY_PAYERS = ["paypal", "manual"] as const;

// ─── Types ──────────────────────────────────────────────────────────────────

export type MessageStatus = "queued" | "sent" | "delivered" | "read" | "failed" | "skipped" | "received";
export type MessageSource = "scheduler" | "admin" | "responder" | "stripe" | "inbound";

export interface MessageRow {
  id: number;
  signup_id: string | null;
  phone: string;
  direction: "inbound" | "outbound";
  template: TemplateName | null;
  source: MessageSource;
  msg_type: string | null;
  body: string | null;
  media_path: string | null;
  wa_message_id: string | null;
  status: MessageStatus;
  attempts: number;
  idempotency_key: string | null;
  next_attempt_at: string | null;
  locked_until: string | null;
  scheduled_for: string | null;
  received_at: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  failed_at: string | null;
  last_error_code: string | null;
  last_error: string | null;
  /** Renewal cycle (the paid_through date a renewal ask is about); null for every other send (migration 20260929). */
  cycle: string | null;
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** One row of the web_gratis_wa_state view. */
export interface WaStateRow {
  id: string;
  status: SignupStatus;
  business_name: string;
  whatsapp: string;
  referral_code: string;
  lang: "es" | "en";
  site_url: string | null;
  submitted_at: string | null;
  delivered_at: string | null;
  free_until: string | null;
  activated_at: string | null;
  paused_at: string | null;
  opted_out_at: string | null;
  no_whatsapp_at: string | null;
  last_inbound_at: string | null;
  rung2_interest_at: string | null;
  declined_at: string | null;
  templates: string[];
  last_template_at: string | null;
  confirmed_at: string | null;
  last_touch_kind: string | null;
  last_touch_at: string | null;
}

/** A signup read straight from the table (not the view), with its payment columns. */
export interface PayerRow extends WaStateRow {
  paid_via: "stripe" | "paypal" | "manual" | null;
  paid_through: string | null;
  last_payment_at: string | null;
}

/** Signup columns that make up a WaStateRow (for signups the view doesn't cover, e.g. 'activa'). */
const SUBJECT_COLUMNS =
  "id, status, business_name, whatsapp, referral_code, lang, site_url, submitted_at, delivered_at, free_until, activated_at, paused_at, opted_out_at, no_whatsapp_at, last_inbound_at, rung2_interest_at, declined_at, confirmed_at, last_touch_kind, last_touch_at";
/** …plus what renewals need. */
const PAYER_COLUMNS = `${SUBJECT_COLUMNS}, paid_via, paid_through, last_payment_at`;

function asPayer(row: Omit<PayerRow, "templates" | "last_template_at">): PayerRow {
  return { ...row, templates: [], last_template_at: null };
}

export interface WaDeps {
  now: () => Date;
  send: (req: RewiredSendRequest) => Promise<SendOutcome>;
  alert: (key: string, text: string) => Promise<boolean>;
  sleep: (ms: number) => Promise<void>;
  settings: () => Promise<WebGratisSettings>;
  /** Purge a paused site's cached page so it actually goes offline (best effort; omitted in tests). */
  purgeSite?: (signupId: string) => Promise<void>;
}

export function defaultWaDeps(): WaDeps {
  return {
    now: () => new Date(),
    send: (req) => sendViaRewired(req),
    alert: (key, text) => enqueueSystem(key, text),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    settings: () => loadSettings(),
    purgeSite: (signupId) => revalidateSignupSite(signupId),
  };
}

export interface SchedulerOptions {
  /** Hard cap on Rewired calls per run. */
  maxSends?: number;
  /** Pause between Rewired calls. */
  spacingMs?: number;
  /** Real wall-clock deadline (epoch ms); no new send starts after it. */
  deadline?: number;
  /** Restrict the run to these signups (manual actions, tests). */
  onlySignupIds?: string[];
  /**
   * PayPal fallback /pagar shows when the board has no PayPal link
   * (default DEFAULT_PAYPAL_LINK). Tests pass null to simulate "no payment method".
   */
  defaultPaypalLink?: string | null;
}

export interface SchedulerReport {
  retried: number;
  sent: number;
  queuedForRetry: number;
  failed: number;
  skipped: number;
  paused: number;
  /** Auto-pauses held because the client was never asked to pay. */
  pauseHeld: number;
  deferred: number;
  stopped: string | null;
  errors: string[];
}

type AttemptResult = {
  sent: boolean;
  /** Global condition (sending disabled, bridge down…): stop the whole run. */
  stopRun: string | null;
  /** Template-level condition (not approved yet): skip this template for the rest of the run. */
  skipTemplate: boolean;
};

// ─── Small helpers ──────────────────────────────────────────────────────────

const iso = (d: Date) => d.toISOString();
const plusSec = (d: Date, sec: number) => new Date(d.getTime() + sec * 1000);

function errText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String((error as { message: unknown }).message);
  return String(error);
}

function shortName(t: TemplateName): string {
  return t.replace(/^cqv_web_/, "");
}

const GLOBAL_STOP_CODES = new Set([...GLOBAL_HOLD_CODES, "130429"]);

/**
 * System-level holds (sending switched off, number unhealthy, template not
 * approved yet, bridge misconfigured): the message was never attempted with
 * Meta, so these don't consume the row's 12 attempts — a pre-launch week with
 * WEB_GRATIS_WA_ENABLED off must not turn every confirmation into 'failed'.
 */
function isHold(code: string): boolean {
  return GLOBAL_HOLD_CODES.has(code) || isTemplateLevelCode(code);
}

/** Seconds until the next try for a transient failure (attempts = tries so far, ≥ 1). */
export function backoffSeconds(code: string, attempts: number, retryAfterSec: number | null): number {
  let base: number;
  if (code === "130429") base = MIN;
  else if (code === "131049") base = 25 * HOUR;
  else if (code === "template_not_approved" || GLOBAL_HOLD_CODES.has(code) || isTemplateLevelCode(code)) base = HOUR;
  else base = Math.min(24 * HOUR, 15 * MIN * 2 ** Math.max(0, attempts - 1));
  return Math.max(base, retryAfterSec ?? 0);
}

function idempotencyKeyFor(row: Pick<MessageRow, "id" | "idempotency_key">): string {
  return row.idempotency_key ?? `wg-${row.id}-1`;
}

/**
 * A key that has never been used for this row (random suffix), for a retry of a
 * send that definitely did NOT go out. Never derived from the previous key, so
 * it can't collide with a key Rewired remembers as successful (it replays those
 * for 24 h and would hand back the old wamid without sending).
 */
export function freshKey(rowId: number, tag: string): string {
  return `wg-${rowId}-${tag}-${randomBytes(3).toString("hex")}`;
}

/** YYYY-MM-DD plus `days` (calendar arithmetic on a date string). Same as templates.ts addDays. */
export function svDateOf(date: string, days: number): string {
  return addDays(date, days);
}

// ─── Eligibility (shared by triggers, retries and manual sends) ─────────────

export interface EligibilityInput {
  status: SignupStatus;
  site_url: string | null;
  delivered_at: string | null;
  free_until: string | null;
  activated_at: string | null;
  rung2_interest_at: string | null;
  declined_at: string | null;
}

/**
 * Whether a (non-renewal) template still makes sense for this signup today.
 * Reminder templates are bounded to their own days (FREE_MONTH_FLOW) so a
 * backlog (e.g. no payment method for a few days) never fires day-28, day-30
 * and the pause notice in one burst.
 */
export function templateStillApplies(t: TemplateName, s: EligibilityInput, now: Date): boolean {
  const today = svDate(now);
  const free = s.free_until;
  const live = LIVE_FREE.includes(s.status) && !s.activated_at;
  switch (t) {
    case "cqv_web_confirm":
      return BUILDING.includes(s.status);
    case "cqv_web_ready":
      // "Your site is ready" only makes sense close to delivery (weeks later they've been told).
      return (
        LIVE_FREE.includes(s.status) &&
        !!s.site_url &&
        !!s.delivered_at &&
        now.getTime() - Date.parse(s.delivered_at) <= READY_MAX_AGE_MS
      );
    case "cqv_web_day28":
      return live && !s.declined_at && !!free && inFlowRange(today, free, FREE_MONTH_FLOW.ask);
    case "cqv_web_day30":
      return live && !s.declined_at && !!free && !!FREE_MONTH_FLOW.dueAsk && inFlowRange(today, free, FREE_MONTH_FLOW.dueAsk);
    case "cqv_web_pause_notice":
      return live && !s.declined_at && !!free && inFlowRange(today, free, FREE_MONTH_FLOW.notice);
    case "cqv_web_rescue":
      return (
        !s.rung2_interest_at &&
        !s.declined_at &&
        !s.activated_at &&
        (LIVE_FREE.includes(s.status) || s.status === "pausada")
      );
    case "cqv_web_renewal":
      // Only ever sent per cycle (renewalStillApplies).
      return false;
  }
}

export interface RenewalInput {
  status: SignupStatus;
  paid_via: string | null;
  paid_through: string | null;
  activated_at: string | null;
  last_payment_at?: string | null;
  declined_at: string | null;
  opted_out_at: string | null;
  no_whatsapp_at: string | null;
}

/** An active payer we may ask to renew: not opted out, has WhatsApp, didn't say no since their last payment. */
export function renewalMessageable(s: RenewalInput): boolean {
  const paidSince = s.last_payment_at ?? s.activated_at ?? "";
  return !s.opted_out_at && !s.no_whatsapp_at && !(s.declined_at && s.declined_at > paidSince);
}

/**
 * Whether a renewal-cycle template (renewal reminder / pause notice) still
 * makes sense: the client is still active, still pays by PayPal / by hand, the
 * cycle is still their current month (a new payment starts a new cycle) and
 * today is inside that ask's days (RENEWAL_FLOW).
 */
export function renewalStillApplies(t: TemplateName, s: RenewalInput, cycle: string | null, now: Date): boolean {
  if (!cycle || s.status !== "activa" || !(MONTHLY_PAYERS as readonly string[]).includes(s.paid_via ?? "") || s.paid_through !== cycle) return false;
  if (!renewalMessageable(s)) return false;
  const today = svDate(now);
  if (t === "cqv_web_renewal") return inFlowRange(today, cycle, RENEWAL_FLOW.ask);
  if (t === "cqv_web_pause_notice") return inFlowRange(today, cycle, RENEWAL_FLOW.notice);
  return false;
}

// ─── Core: one send attempt for one owned row ───────────────────────────────

interface Subject {
  id: string;
  business_name: string;
  whatsapp: string;
  referral_code: string;
  site_url: string | null;
}

/**
 * Send one template row the caller already owns (inserted or leased). Records
 * the outcome on the row and the signup, raises alerts, and tells the caller
 * whether to keep going.
 */
export async function attemptTemplateSend(row: MessageRow, subject: Subject, deps: WaDeps): Promise<AttemptResult> {
  const db = getDb();
  const template = row.template as TemplateName;
  const label = TEMPLATE_LABEL[template];
  const who = `${subject.business_name} (${subject.whatsapp})`;
  const now = deps.now();
  const cycle = row.cycle ?? null;
  const payload = templatePayload(template, subject, { cycle });

  if (!payload) {
    const missing = template === "cqv_web_renewal" ? "la fecha de vencimiento (pagado hasta)" : "el link de su web";
    await db
      .from(MESSAGES_TABLE)
      .update({
        status: "failed",
        failed_at: iso(now),
        locked_until: null,
        next_attempt_at: null,
        last_error_code: "missing_data",
        last_error: `Falta ${missing} para enviar esta plantilla.`,
      })
      .eq("id", row.id);
    await deps.alert(`wa-failed:${row.id}`, `❌ WhatsApp «${label}» no se envió a ${who}: falta ${missing} en el tablero.`);
    return { sent: false, stopRun: null, skipTemplate: false };
  }

  const key = idempotencyKeyFor(row);
  const outcome = await deps.send({
    to: subject.whatsapp,
    mode: "template",
    template: { name: template, bodyParams: payload.bodyParams, ...(payload.buttonParam ? { buttonParam: payload.buttonParam } : {}) },
    idempotencyKey: key,
  });
  const attempts = row.attempts + 1;
  const after = deps.now();

  if (outcome.ok) {
    const { error } = await db
      .from(MESSAGES_TABLE)
      .update({
        status: "sent",
        wa_message_id: outcome.wamid,
        phone: subject.whatsapp,
        sent_at: iso(after),
        attempts,
        idempotency_key: key,
        next_attempt_at: null,
        locked_until: null,
        last_error_code: null,
        last_error: null,
        body: templatePreview(template, subject, { cycle }),
      })
      .eq("id", row.id);
    if (error) console.error("[WebGratis:wa] sent but could not record wamid", row.id, outcome.wamid, error);
    const touch: Record<string, unknown> = { last_touch_at: iso(after), last_touch_kind: `wa_${shortName(template)}` };
    if (template === "cqv_web_confirm") {
      const { error: confirmError } = await db
        .from(SIGNUPS_TABLE)
        .update({ ...touch, confirmed_at: iso(after) })
        .eq("id", subject.id)
        .is("confirmed_at", null);
      if (confirmError) console.error("[WebGratis:wa] confirmed_at stamp failed", subject.id, confirmError);
    }
    const { error: touchError } = await db.from(SIGNUPS_TABLE).update(touch).eq("id", subject.id);
    if (touchError) console.error("[WebGratis:wa] touch stamp failed", subject.id, touchError);
    return { sent: true, stopRun: null, skipTemplate: false };
  }

  const code = outcome.code;
  const detail = `${code}${outcome.message && outcome.message !== code ? ` — ${outcome.message}` : ""}`.slice(0, 900);

  // Unknown outcome (timeout / dropped connection / 5xx): the template may already be on
  // the client's phone. Rewired can't de-duplicate a resend, so it is never retried
  // automatically — a person checks the chat and resends from the board if needed.
  if (!outcome.definitive) {
    await db
      .from(MESSAGES_TABLE)
      .update({
        status: "failed",
        failed_at: iso(after),
        attempts,
        idempotency_key: key,
        next_attempt_at: null,
        locked_until: null,
        last_error_code: UNKNOWN_OUTCOME_CODE,
        last_error: `No se sabe si le llegó (Rewired no confirmó: ${detail}). Revise el chat antes de reenviar.`.slice(0, 1000),
      })
      .eq("id", row.id);
    await deps.alert(
      `wa-unknown:${row.id}:${attempts}`,
      `⚠️ No sabemos si «${label}» le llegó a ${who}: Rewired no confirmó el envío (${detail}). Revise el chat de la línea +1 786-257-0284; si no le llegó, reenvíelo desde su tarjeta en el tablero.`,
    );
    return { sent: false, stopRun: code, skipTemplate: false };
  }

  const counted = outcome.transient && isHold(code) ? row.attempts : attempts;

  // Permanent, or out of retries → failed + alert.
  if (!outcome.transient || counted >= MAX_ATTEMPTS) {
    await db
      .from(MESSAGES_TABLE)
      .update({
        status: "failed",
        failed_at: iso(after),
        attempts,
        idempotency_key: key,
        next_attempt_at: null,
        locked_until: null,
        last_error_code: code.slice(0, 60),
        last_error: detail,
      })
      .eq("id", row.id);

    if (code === "opted_out") {
      await db
        .from(SIGNUPS_TABLE)
        .update({ opted_out_at: iso(after), opt_out_reason: "Rewired: número en la lista de bajas" })
        .eq("id", subject.id)
        .is("opted_out_at", null);
      await deps.alert(
        `wa-optout:${subject.id}`,
        `🚫 ${who} está en la lista de bajas de WhatsApp: no se le enviarán mensajes automáticos. Si quiere su web, contáctelo por otro medio.`,
      );
    } else if (code === "131026") {
      await db.from(SIGNUPS_TABLE).update({ no_whatsapp_at: iso(after) }).eq("id", subject.id).is("no_whatsapp_at", null);
      await deps.alert(
        `wa-nowa:${subject.id}`,
        `📵 ${who} no tiene WhatsApp (o el número está mal): «${label}» no se pudo entregar. Llámelo, o corrija el número en su tarjeta del tablero («Corregir WhatsApp») y reintente. Si nos escribe desde ese número, se reactiva solo.`,
      );
    } else {
      const why = outcome.transient ? `tras ${attempts} intentos (${detail})` : detail;
      await deps.alert(`wa-failed:${row.id}:${attempts}`, `❌ WhatsApp «${label}» NO se envió a ${who}: ${why}. Reintente desde el tablero.`);
    }
    return { sent: false, stopRun: GLOBAL_STOP_CODES.has(code) ? code : null, skipTemplate: false };
  }

  // Definitely not sent, transient → keep queued, back off, and use a never-used key next time.
  const wait = backoffSeconds(code, Math.max(1, counted), outcome.retryAfterSec);
  await db
    .from(MESSAGES_TABLE)
    .update({
      status: "queued",
      attempts: counted,
      idempotency_key: freshKey(row.id, `r${attempts}`),
      next_attempt_at: iso(plusSec(after, wait)),
      locked_until: null,
      last_error_code: code.slice(0, 60),
      last_error: detail,
    })
    .eq("id", row.id);

  const day = svDate(after);
  const hour = iso(after).slice(0, 13);
  if (code === "disabled") {
    await deps.alert(
      `wa-disabled:${day}`,
      "WhatsApp automático está APAGADO en Rewired (WEB_GRATIS_WA_ENABLED distinto de \"true\"): los mensajes quedan en cola y salen solos cuando se active.",
    );
  } else if (code === "kill_switch") {
    await deps.alert(`wa-kill:${hour}`, "WhatsApp detenido por WHATSAPP_KILL_SWITCH en Rewired: los mensajes del embudo quedan en cola.");
  } else if (code === "number_unhealthy") {
    await deps.alert(`wa-unhealthy:${hour}`, "La línea +1 786-257-0284 no está sana (estado/calidad en Meta): mensajes en pausa, reintento cada hora.");
  } else if (code === "not_configured" || code === "unauthorized") {
    await deps.alert(`wa-bridge:${hour}`, `El puente con Rewired no funciona (${detail}). Los mensajes quedan en cola.`);
  } else if (isTemplateLevelCode(code)) {
    await deps.alert(
      `wa-template:${template}:${day}`,
      `La plantilla ${template} aún no está aprobada/activa en Meta (${code}). Se reintenta cada hora; nada se pierde.`,
    );
  }

  return {
    sent: false,
    stopRun: GLOBAL_STOP_CODES.has(code) ? code : null,
    skipTemplate: isTemplateLevelCode(code),
  };
}

// ─── Claiming rows ──────────────────────────────────────────────────────────

/** Create the row for a new trigger (owned by us), or null when another run already has it (same template + cycle). */
async function claimNew(
  subject: WaStateRow,
  template: TemplateName,
  source: MessageSource,
  now: Date,
  meta: Record<string, unknown> = {},
  cycle: string | null = null,
): Promise<MessageRow | null> {
  const { data, error } = await getDb()
    .from(MESSAGES_TABLE)
    .insert({
      signup_id: subject.id,
      phone: subject.whatsapp,
      direction: "outbound",
      template,
      source,
      status: "queued",
      attempts: 0,
      scheduled_for: iso(now),
      next_attempt_at: iso(now),
      locked_until: iso(new Date(now.getTime() + LEASE_MS)),
      body: templatePreview(template, subject, { cycle }),
      cycle,
      meta,
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") return null;
    throw error;
  }
  return data as MessageRow;
}

async function insertSkipped(subject: WaStateRow, template: TemplateName, reason: string, now: Date): Promise<boolean> {
  const { error } = await getDb().from(MESSAGES_TABLE).insert({
    signup_id: subject.id,
    phone: subject.whatsapp,
    direction: "outbound",
    template,
    source: "scheduler",
    status: "skipped",
    scheduled_for: iso(now),
    last_error_code: "skipped",
    last_error: reason.slice(0, 1000),
    body: templatePreview(template, subject),
  });
  if (error && error.code !== "23505") throw error;
  return !error;
}

/** Lease a due queued row (retry). Null when someone else holds it or it's no longer due. */
async function leaseDue(rowId: number, now: Date): Promise<MessageRow | null> {
  const { data, error } = await getDb()
    .from(MESSAGES_TABLE)
    .update({ locked_until: iso(new Date(now.getTime() + LEASE_MS)) })
    .eq("id", rowId)
    .eq("status", "queued")
    .lte("next_attempt_at", iso(now))
    .or(`locked_until.is.null,locked_until.lt.${iso(now)}`)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return (data as MessageRow | null) ?? null;
}

async function markSkipped(rowId: number, reason: string): Promise<void> {
  const { error } = await getDb()
    .from(MESSAGES_TABLE)
    .update({ status: "skipped", locked_until: null, next_attempt_at: null, last_error_code: "skipped", last_error: reason })
    .eq("id", rowId)
    .eq("status", "queued");
  if (error) throw error;
}

/**
 * Queue a template a person asked for (e.g. "Web lista" to a client who paid
 * before delivery). The retry pass sends it inside its window; `manual` rows skip
 * the scheduler's date rules but keep every opt-out / "no" / payment-method guard.
 * False when that template already has a row for this signup.
 */
export async function queueManualTemplate(signupId: string, template: TemplateName, now: Date, reason: string): Promise<boolean> {
  const db = getDb();
  const { data: subject, error } = await db.from(SIGNUPS_TABLE).select(PAYER_COLUMNS).eq("id", signupId).maybeSingle();
  if (error) throw error;
  if (!subject) return false;
  const s = asPayer(subject as unknown as Omit<PayerRow, "templates" | "last_template_at">);
  const cycle = template === "cqv_web_renewal" ? s.paid_through : null;
  const { error: insertError } = await db.from(MESSAGES_TABLE).insert({
    signup_id: s.id,
    phone: s.whatsapp,
    direction: "outbound",
    template,
    source: "admin",
    status: "queued",
    attempts: 0,
    scheduled_for: iso(now),
    next_attempt_at: iso(now),
    body: templatePreview(template, s, { cycle }),
    cycle,
    meta: { manual: true, reason },
  });
  if (insertError) {
    if (insertError.code === "23505") return false;
    throw insertError;
  }
  return true;
}

// ─── Trigger queries ────────────────────────────────────────────────────────

const NO_ID = "00000000-0000-0000-0000-000000000000";

/** The scheduler view, optionally scoped to some signups. */
function viewQuery(only?: string[]) {
  const q = getDb().from(STATE_VIEW).select("*");
  return only ? q.in("id", only.length ? only : [NO_ID]) : q;
}

/** …restricted to signups we may message. */
function stateQuery(only?: string[]) {
  return viewQuery(only).is("opted_out_at", null).is("no_whatsapp_at", null);
}

/** D5 harness rows ("ZZ <run> …") — never acted on by a general production sweep. */
export function isTestSignupName(name: string | null | undefined): boolean {
  return /^ZZ /.test(name ?? "");
}

async function rows(q: PromiseLike<{ data: unknown; error: unknown }>): Promise<WaStateRow[]> {
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as WaStateRow[];
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Abuse brake for the automatic confirmation (T1): the /web form is public and
 * doesn't verify the phone, so a template must not become a way to make the
 * funnel line message strangers. Per destination phone: one automatic
 * confirmation per 7 days, whichever request it belongs to. Per network
 * fingerprint (ip_hash): at most 3 per hour. Anything over goes to a person.
 */
async function t1Guard(candidates: WaStateRow[], now: Date): Promise<{ send: WaStateRow[]; held: { s: WaStateRow; reason: string }[] }> {
  const db = getDb();
  const send: WaStateRow[] = [];
  const held: { s: WaStateRow; reason: string }[] = [];
  if (candidates.length === 0) return { send, held };

  // Phones already confirmed recently (any request).
  const phones = [...new Set(candidates.map((c) => c.whatsapp))];
  const recentPhones = new Set<string>();
  for (const group of chunks(phones, 100)) {
    const { data, error } = await db
      .from(MESSAGES_TABLE)
      .select("phone")
      .eq("template", "cqv_web_confirm")
      .neq("status", "skipped")
      .in("phone", group)
      .gte("created_at", iso(new Date(now.getTime() - T1_PHONE_COOLDOWN_MS)));
    if (error) throw error;
    for (const m of (data ?? []) as { phone: string }[]) recentPhones.add(m.phone);
  }

  // Network fingerprints of the candidates, and confirmations already sent per fingerprint this hour.
  const ipOf = new Map<string, string>();
  for (const group of chunks(candidates.map((c) => c.id), 100)) {
    const { data, error } = await db.from(SIGNUPS_TABLE).select("id, ip_hash").in("id", group);
    if (error) throw error;
    for (const r of (data ?? []) as { id: string; ip_hash: string | null }[]) if (r.ip_hash) ipOf.set(r.id, r.ip_hash);
  }
  const perIp = new Map<string, number>();
  if (ipOf.size) {
    const { data: lastHour, error } = await db
      .from(MESSAGES_TABLE)
      .select("signup_id")
      .eq("template", "cqv_web_confirm")
      .neq("status", "skipped")
      .gte("created_at", iso(new Date(now.getTime() - 3_600_000)))
      .limit(1000);
    if (error) throw error;
    const ids = [...new Set(((lastHour ?? []) as { signup_id: string | null }[]).map((m) => m.signup_id).filter((id): id is string => !!id))];
    const wanted = new Set(ipOf.values());
    for (const group of chunks(ids, 100)) {
      const { data, error: ipError } = await db.from(SIGNUPS_TABLE).select("ip_hash").in("id", group);
      if (ipError) throw ipError;
      for (const r of (data ?? []) as { ip_hash: string | null }[]) {
        if (r.ip_hash && wanted.has(r.ip_hash)) perIp.set(r.ip_hash, (perIp.get(r.ip_hash) ?? 0) + 1);
      }
    }
  }

  for (const s of candidates) {
    if (recentPhones.has(s.whatsapp)) {
      held.push({ s, reason: "Retenida: a este número ya se le envió una confirmación automática en los últimos 7 días (otra solicitud). Si es real, envíela a mano." });
      continue;
    }
    const ip = ipOf.get(s.id);
    if (ip && (perIp.get(ip) ?? 0) >= T1_PER_IP_PER_HOUR) {
      held.push({ s, reason: `Retenida: más de ${T1_PER_IP_PER_HOUR} solicitudes por hora desde la misma red (posible abuso del formulario). Si es real, envíela a mano.` });
      continue;
    }
    recentPhones.add(s.whatsapp);
    if (ip) perIp.set(ip, (perIp.get(ip) ?? 0) + 1);
    send.push(s);
  }
  return { send, held };
}

/**
 * Template rows of these signups, grouped by signup: the free-month / one-off rows (cycle null), or
 * the rows of the given renewal cycles only (every past month would otherwise pile up past
 * PostgREST's 1000-row page).
 */
async function templateRowsOf(ids: string[], templates: readonly TemplateName[], cycles: string[] | null): Promise<Map<string, MessageRow[]>> {
  const out = new Map<string, MessageRow[]>();
  if (cycles && cycles.length === 0) return out;
  for (const group of chunks(ids, 100)) {
    let q = getDb().from(MESSAGES_TABLE).select("*").in("signup_id", group).in("template", templates as TemplateName[]);
    q = cycles ? q.in("cycle", cycles) : q.is("cycle", null);
    const { data, error } = await q;
    if (error) throw error;
    for (const m of (data ?? []) as MessageRow[]) {
      if (!m.signup_id) continue;
      const list = out.get(m.signup_id) ?? [];
      list.push(m);
      out.set(m.signup_id, list);
    }
  }
  return out;
}

/** The pause notice that reached them and the latest ask that did (for pauseDecision). */
function asksOf(list: MessageRow[]): { noticeSentAt: string | null; lastAskAt: string | null } {
  const reached = list.filter((m) => REACHED.includes(m.status) && !!m.sent_at);
  const notice = reached.find((m) => m.template === "cqv_web_pause_notice");
  const lastAskAt = reached.reduce<string | null>((latest, m) => (!latest || (m.sent_at as string) > latest ? (m.sent_at as string) : latest), null);
  return { noticeSentAt: notice?.sent_at ?? null, lastAskAt };
}

// ─── The run ────────────────────────────────────────────────────────────────

export async function runWhatsAppScheduler(deps: WaDeps, options: SchedulerOptions = {}): Promise<SchedulerReport> {
  const report: SchedulerReport = {
    retried: 0,
    sent: 0,
    queuedForRetry: 0,
    failed: 0,
    skipped: 0,
    paused: 0,
    pauseHeld: 0,
    deferred: 0,
    stopped: null,
    errors: [],
  };
  const maxSends = options.maxSends ?? 25;
  const spacingMs = options.spacingMs ?? 300;
  const deadline = options.deadline ?? Date.now() + 25_000;
  const only = options.onlySignupIds;
  // Test rows ("ZZ …", the D5 harness) share the production DB. A general sweep (the live cron)
  // must never act on them — they carry random real-looking numbers (2026-09-25: the live cron sent
  // real WhatsApp confirmations to test rows mid-harness). Harness runs always pass onlySignupIds.
  const liveRows = async (q: PromiseLike<{ data: unknown; error: unknown }>): Promise<WaStateRow[]> => {
    const list = await rows(q);
    return only ? list : list.filter((r) => !isTestSignupName(r.business_name));
  };
  const db = getDb();
  const now = deps.now();
  const nowIso = iso(now);
  const today = svDate(now);
  const hourKey = nowIso.slice(0, 13);

  let calls = 0;
  const skipTemplates = new Set<TemplateName>();
  const canSend = () => !report.stopped && calls < maxSends && Date.now() < deadline;

  async function run(row: MessageRow, subject: Subject, isRetry: boolean): Promise<void> {
    if (calls > 0 && spacingMs > 0) await deps.sleep(spacingMs);
    calls++;
    if (isRetry) report.retried++;
    try {
      const res = await attemptTemplateSend(row, subject, deps);
      if (res.sent) report.sent++;
      else {
        const { data: after } = await db.from(MESSAGES_TABLE).select("status").eq("id", row.id).maybeSingle();
        if (after?.status === "failed") report.failed++;
        else report.queuedForRetry++;
      }
      if (res.stopRun) report.stopped = res.stopRun;
      if (res.skipTemplate) skipTemplates.add(row.template as TemplateName);
    } catch (error) {
      report.errors.push(`send ${row.id}: ${errText(error)}`);
      console.error("[WebGratis:wa] send attempt crashed", row.id, error);
    }
  }

  let settings: WebGratisSettings | null = null;
  try {
    settings = await deps.settings();
  } catch (error) {
    report.errors.push(`settings: ${errText(error)}`);
  }
  // Stripe OR PayPal on /pagar (unknown settings → assume the default PayPal link, like /pagar does).
  const canCharge = hasPaymentMethod(settings, options.defaultPaypalLink);
  const waitingForPayMethod: string[] = [];

  // ── 1. Retries of queued rows that are due (only templates whose window is open) ──
  const openTemplates = TEMPLATE_NAMES.filter((t) => windowOpen(TEMPLATE_WINDOW[t], now));
  if (openTemplates.length) {
    try {
      // A general sweep reads only real clients' rows (a harness run's queued rows must neither be
      // touched nor take the batch's 60 slots); a scoped run reads its own signups' rows.
      const columns: string = only ? "*" : "*, signup:web_gratis_signups!inner(business_name)";
      let q = db
        .from(MESSAGES_TABLE)
        .select(columns)
        .eq("status", "queued")
        .in("template", openTemplates)
        .lte("next_attempt_at", nowIso)
        .or(`locked_until.is.null,locked_until.lt.${nowIso}`)
        .order("next_attempt_at", { ascending: true })
        .limit(60);
      q = only ? q.in("signup_id", only.length ? only : [NO_ID]) : q.not("signup.business_name", "like", "ZZ %");
      const { data, error } = await q;
      if (error) throw error;
      const due = (data ?? []) as unknown as MessageRow[];
      const ids = [...new Set(due.map((r) => r.signup_id).filter((id): id is string => !!id))];
      // Belt and braces (the harness prefix check the rest of the scheduler uses): a general sweep
      // leaves test rows' queued messages exactly as they are — not even 'skipped'.
      const testIds = new Set<string>();
      if (!only && ids.length) {
        const { data: names, error: namesError } = await db.from(SIGNUPS_TABLE).select("id, business_name").in("id", ids);
        if (namesError) throw namesError;
        for (const n of (names ?? []) as { id: string; business_name: string }[]) if (isTestSignupName(n.business_name)) testIds.add(n.id);
      }
      const states = new Map<string, WaStateRow>();
      if (ids.length) {
        for (const s of await liveRows(db.from(STATE_VIEW).select("*").in("id", ids))) states.set(s.id, s);
      }
      // Renewal-cycle rows are for active payers (outside the view) and need their payment
      // columns; rows a person queued can be for signups outside the view too (e.g. 'activa').
      const direct = new Map<string, PayerRow>();
      const directIds = [
        ...new Set(
          due
            .filter((r) => r.signup_id && (r.cycle || (r.meta?.manual === true && !states.has(r.signup_id))))
            .map((r) => r.signup_id as string),
        ),
      ];
      for (const group of chunks(directIds, 100)) {
        const { data: found, error: directError } = await db.from(SIGNUPS_TABLE).select(PAYER_COLUMNS).in("id", group);
        if (directError) throw directError;
        for (const d of (found ?? []) as unknown as Omit<PayerRow, "templates" | "last_template_at">[]) {
          if (!only && isTestSignupName(d.business_name)) continue;
          direct.set(d.id, asPayer(d));
        }
      }
      for (const row of due) {
        if (row.signup_id && testIds.has(row.signup_id)) continue;
        const template = row.template as TemplateName;
        const manual = row.meta?.manual === true;
        const payer = row.signup_id ? direct.get(row.signup_id) : undefined;
        const s: WaStateRow | undefined = row.cycle ? payer : row.signup_id ? (states.get(row.signup_id) ?? payer) : undefined;
        let block: string | null;
        if (!s) block = "ya no aplica (cliente pagó, se cerró o se borró)";
        else if (row.cycle) {
          // A renewal ask belongs to one month: once they pay (new paid_through) it's moot.
          const p = s as PayerRow;
          if (p.paid_through !== row.cycle) block = "ya no aplica (renovó o cambió su «pagado hasta»)";
          else if (manual) block = manualBlock(template, p, settings);
          else if (!renewalStillApplies(template, p, row.cycle, now)) block = "ya no aplica a su etapa";
          else if (!canCharge) block = "sin forma de pago en /pagar";
          else block = null;
        } else if (manual) block = manualBlock(template, s, settings);
        else if (s.opted_out_at) block = "se dio de baja";
        else if (s.no_whatsapp_at) block = "el número no tiene WhatsApp";
        else if (!templateStillApplies(template, s, now)) block = "ya no aplica a su etapa";
        else block = null;
        if (block) {
          try {
            await markSkipped(row.id, block);
            report.skipped++;
          } catch (error) {
            report.errors.push(`skip ${row.id}: ${errText(error)}`);
          }
          continue;
        }
        if (skipTemplates.has(template)) {
          report.deferred++;
          continue;
        }
        if (!canSend()) break;
        const owned = await leaseDue(row.id, now).catch((error: unknown) => {
          report.errors.push(`lease ${row.id}: ${errText(error)}`);
          return null;
        });
        if (!owned || !s) continue;
        await run(owned, s, true);
      }
    } catch (error) {
      report.errors.push(`retries: ${errText(error)}`);
      console.error("[WebGratis:wa] retry pass failed", error);
    }
  }

  // ── 2. New triggers, in order ──
  async function fire(template: TemplateName, candidates: WaStateRow[]): Promise<void> {
    for (const s of candidates) {
      if (!canSend() || skipTemplates.has(template)) return;
      if (!windowOpen(TEMPLATE_WINDOW[template], now)) {
        report.deferred++;
        continue;
      }
      if (!templateStillApplies(template, s, now)) continue;
      try {
        const row = await claimNew(s, template, "scheduler", now);
        if (!row) continue;
        await run(row, s, false);
      } catch (error) {
        report.errors.push(`${template} ${s.id}: ${errText(error)}`);
        console.error("[WebGratis:wa] trigger failed", template, s.id, error);
      }
    }
  }

  // T1 — confirmation: 15 min after submitting (their own chat usually comes first),
  // skipped when they already wrote to us, capped per phone and per network.
  try {
    const t1 = await liveRows(
      stateQuery(only)
        .in("status", BUILDING)
        .not("submitted_at", "is", null)
        .lte("submitted_at", iso(new Date(now.getTime() - T1_DELAY_MS)))
        .not("templates", "cs", "{cqv_web_confirm}")
        .order("submitted_at", { ascending: true })
        .limit(100),
    );
    const eligible: WaStateRow[] = [];
    for (const s of t1) {
      if (s.last_inbound_at && s.submitted_at && Date.parse(s.last_inbound_at) >= Date.parse(s.submitted_at)) {
        const inserted = await insertSkipped(s, "cqv_web_confirm", "Ya nos escribió después de enviar el formulario; el asistente le confirmó en el chat.", now);
        if (inserted) {
          report.skipped++;
          await db.from(SIGNUPS_TABLE).update({ confirmed_at: nowIso }).eq("id", s.id).is("confirmed_at", null);
        }
      } else if (s.confirmed_at) {
        if (await insertSkipped(s, "cqv_web_confirm", "Ya se le confirmó a mano desde el tablero.", now)) report.skipped++;
      } else eligible.push(s);
    }
    const { send, held } = await t1Guard(eligible, now);
    const heldNames: string[] = [];
    for (const h of held) {
      if (await insertSkipped(h.s, "cqv_web_confirm", h.reason, now)) {
        report.skipped++;
        heldNames.push(`${h.s.business_name} (${h.s.whatsapp})`);
      }
    }
    if (heldNames.length) {
      await deps.alert(
        `t1-held:${hourKey}`,
        `🛑 ${heldNames.length} confirmación(es) automática(s) retenida(s) por posible abuso del formulario (mismo número en 7 días o más de ${T1_PER_IP_PER_HOUR}/hora desde la misma red): ${heldNames.slice(0, 8).join(", ")}${heldNames.length > 8 ? "…" : ""}. Si son negocios reales, envíeles «Confirmación» desde su tarjeta.`,
      );
    }
    await fire("cqv_web_confirm", send);
  } catch (error) {
    report.errors.push(`T1: ${errText(error)}`);
  }

  // T2 — site ready (10 min after "→ Entregada", so a "Web lista" sent by hand is seen first).
  try {
    const t2 = await liveRows(
      stateQuery(only)
        .in("status", LIVE_FREE)
        .not("site_url", "is", null)
        .gte("delivered_at", iso(new Date(now.getTime() - READY_MAX_AGE_MS)))
        .lte("delivered_at", iso(new Date(now.getTime() - T2_DELAY_MS)))
        .not("templates", "cs", "{cqv_web_ready}")
        .order("delivered_at", { ascending: true })
        .limit(100),
    );
    const toSend: WaStateRow[] = [];
    for (const s of t2) {
      const manual =
        s.last_touch_kind === "delivered" && !!s.last_touch_at && !!s.delivered_at && Date.parse(s.last_touch_at) >= Date.parse(s.delivered_at);
      if (manual) {
        if (await insertSkipped(s, "cqv_web_ready", "La web lista ya se le avisó a mano desde el tablero.", now)) report.skipped++;
      } else toSend.push(s);
    }
    await fire("cqv_web_ready", toSend);
  } catch (error) {
    report.errors.push(`T2: ${errText(error)}`);
  }

  // T3–T5 — free-month payment reminders (need a way to pay on /pagar: Stripe or PayPal).
  // free_until relative to today, from FREE_MONTH_FLOW (an ask on due+k means free_until = today−k).
  const freeReminders: { template: TemplateName; range: readonly [number, number] }[] = [
    { template: "cqv_web_day28", range: FREE_MONTH_FLOW.ask },
    ...(FREE_MONTH_FLOW.dueAsk ? [{ template: "cqv_web_day30" as TemplateName, range: FREE_MONTH_FLOW.dueAsk }] : []),
    { template: "cqv_web_pause_notice", range: FREE_MONTH_FLOW.notice },
  ];
  for (const r of freeReminders) {
    try {
      const due = await liveRows(
        stateQuery(only)
          .in("status", LIVE_FREE)
          .is("activated_at", null)
          .is("declined_at", null)
          .gte("free_until", svDate(now, -r.range[1]))
          .lte("free_until", svDate(now, -r.range[0]))
          .not("templates", "cs", `{${r.template}}`)
          .order("free_until", { ascending: true })
          .limit(100),
      );
      if (due.length === 0) continue;
      if (!canCharge) {
        waitingForPayMethod.push(`${due.length} × ${TEMPLATE_LABEL[r.template]}`);
        continue;
      }
      await fire(r.template, due);
    } catch (error) {
      report.errors.push(`${r.template}: ${errText(error)}`);
    }
  }

  const pausedAlert = async (s: WaStateRow, text: string) => {
    report.paused++;
    await deps.alert(`paused:${s.id}:${today}`, text);
    if (deps.purgeSite) {
      try {
        await deps.purgeSite(s.id);
      } catch (error) {
        console.error("[WebGratis:wa] paused site purge failed", s.id, error);
      }
    }
  };
  const neverAsked: string[] = [];
  const pauseReason = (d: Extract<PauseDecision, { action: "pause" }>, s: WaStateRow, flow: PaymentFlow): string => {
    if (d.reason === "unreachable") return s.declined_at && flow === FREE_MONTH_FLOW ? "dijo que no" : "no se le puede escribir";
    return d.reason === "notice" ? "se le avisó de la pausa" : "se le pidió el pago, pero el aviso de pausa no salió";
  };

  // T6 — auto-pause after the free month (no message). Only clients who were asked to pay: a day
  // after the pause notice reached them; or, if the notice never could, at free_until+6 when an
  // earlier reminder did. Never-asked clients are held and reported once a day.
  // Clients we can't / mustn't message (opted out, no WhatsApp, said no) pause at +3.
  try {
    const candidates = await liveRows(
      viewQuery(only)
        .in("status", LIVE_FREE)
        .is("activated_at", null)
        .is("paused_at", null)
        .lte("free_until", svDate(now, -FREE_MONTH_FLOW.pauseFrom))
        .order("free_until", { ascending: true })
        .limit(300),
    );
    const asks = await templateRowsOf(candidates.map((c) => c.id), REMINDER_TEMPLATES, null);
    for (const s of candidates) {
      if (!s.free_until) continue;
      const messageable = !s.opted_out_at && !s.no_whatsapp_at && !s.declined_at;
      const decision = pauseDecision(FREE_MONTH_FLOW, { due: s.free_until, messageable, ...asksOf(asks.get(s.id) ?? []) }, now);
      if (decision.action === "held") {
        neverAsked.push(`${s.business_name} (${s.whatsapp}, venció ${s.free_until})`);
        report.pauseHeld++;
        continue;
      }
      if (decision.action !== "pause") continue;
      const { data: paused, error } = await db
        .from(SIGNUPS_TABLE)
        .update({ status: "pausada", paused_at: nowIso, recontact_after: svDate(now, RECONTACT_AFTER_DAYS), last_touch_at: nowIso, last_touch_kind: "auto_pausa" })
        .eq("id", s.id)
        .in("status", LIVE_FREE)
        .is("activated_at", null)
        .is("paused_at", null)
        .select("id")
        .maybeSingle();
      if (error) {
        report.errors.push(`T6 ${s.id}: ${errText(error)}`);
        continue;
      }
      if (!paused) continue;
      await pausedAlert(
        s,
        `⏸ PAUSADA por falta de pago — ${s.business_name} (${s.whatsapp}): terminó su mes gratis (${formatDateEs(s.free_until)}) y no activó los $${MONTHLY_PRICE_USD}/mes (${pauseReason(decision, s, FREE_MONTH_FLOW)}). ${s.site_url ? `Web: ${s.site_url}. ` : ""}Revise que su web quede fuera de línea (archivada, no borrada). Recontactar desde ${svDate(now, RECONTACT_AFTER_DAYS)}.`,
      );
    }
  } catch (error) {
    report.errors.push(`T6: ${errText(error)}`);
  }

  // T7 — rescue (marketing, once ever): live 21+ days or paused 30+ days, no rung-2 interest, 3-day gap.
  try {
    const gapCutoff = iso(new Date(now.getTime() - 3 * DAY_MS));
    const base = () =>
      stateQuery(only)
        .is("rung2_interest_at", null)
        .is("declined_at", null)
        .is("activated_at", null)
        .not("templates", "cs", "{cqv_web_rescue}")
        .or(`last_template_at.is.null,last_template_at.lt.${gapCutoff}`);
    const live = await liveRows(
      base()
        .in("status", LIVE_FREE)
        .lte("delivered_at", iso(new Date(now.getTime() - 21 * DAY_MS)))
        .order("delivered_at", { ascending: true })
        .limit(50),
    );
    const paused = await liveRows(
      base()
        .eq("status", "pausada")
        .lte("paused_at", iso(new Date(now.getTime() - 30 * DAY_MS)))
        .order("paused_at", { ascending: true })
        .limit(50),
    );
    await fire("cqv_web_rescue", [...live, ...paused]);
  } catch (error) {
    report.errors.push(`T7: ${errText(error)}`);
  }

  // T8 + T9 — monthly renewals of PayPal / manual payers (Stripe renews on its own). The cycle is
  // the paid_through date: a reminder in its RENEWAL_FLOW.ask days, the pause notice in its
  // notice days if still unpaid, then the same auto-pause rule as the free month. "Pagó otro mes"
  // moves paid_through, which starts a new cycle (new rows allowed, old queued ones skipped).
  try {
    let q = db
      .from(SIGNUPS_TABLE)
      .select(PAYER_COLUMNS)
      .eq("status", "activa")
      .in("paid_via", [...MONTHLY_PAYERS])
      .not("paid_through", "is", null)
      .lte("paid_through", svDate(now, -RENEWAL_FLOW.ask[0]))
      .order("paid_through", { ascending: true })
      .limit(500);
    q = only ? q.in("id", only.length ? only : [NO_ID]) : q.not("business_name", "like", "ZZ %");
    const { data, error } = await q;
    if (error) throw error;
    const payers = ((data ?? []) as unknown as Omit<PayerRow, "templates" | "last_template_at">[])
      .map(asPayer)
      .filter((p) => only || !isTestSignupName(p.business_name));
    const currentCycles = [...new Set(payers.map((p) => p.paid_through as string))];
    const cycleRows = await templateRowsOf(payers.map((p) => p.id), RENEWAL_TEMPLATES, currentCycles);

    for (const p of payers) {
      const cycle = p.paid_through as string;
      const mine = (cycleRows.get(p.id) ?? []).filter((m) => m.cycle === cycle);

      // T8 — the asks of this cycle.
      for (const template of RENEWAL_TEMPLATES) {
        if (mine.some((m) => m.template === template)) continue;
        if (!renewalStillApplies(template, p, cycle, now)) continue;
        if (!canCharge) {
          waitingForPayMethod.push(`${p.business_name} × ${TEMPLATE_LABEL[template]} (renovación)`);
          continue;
        }
        if (!windowOpen(TEMPLATE_WINDOW[template], now)) {
          report.deferred++;
          continue;
        }
        if (!canSend() || skipTemplates.has(template)) continue;
        try {
          const row = await claimNew(p, template, "scheduler", now, {}, cycle);
          if (!row) continue;
          mine.push(row);
          await run(row, p, false);
        } catch (sendError) {
          report.errors.push(`T8 ${template} ${p.id}: ${errText(sendError)}`);
          console.error("[WebGratis:wa] renewal trigger failed", template, p.id, sendError);
        }
      }

      // T9 — auto-pause once the renewal is RENEWAL_FLOW.pauseFrom days late.
      if (p.paused_at || cycle > svDate(now, -RENEWAL_FLOW.pauseFrom)) continue;
      const { data: fresh, error: freshError } = await db.from(MESSAGES_TABLE).select("*").eq("signup_id", p.id).eq("cycle", cycle);
      if (freshError) {
        report.errors.push(`T9 ${p.id}: ${errText(freshError)}`);
        continue;
      }
      const decision = pauseDecision(RENEWAL_FLOW, { due: cycle, messageable: renewalMessageable(p), ...asksOf((fresh ?? []) as MessageRow[]) }, now);
      if (decision.action === "held") {
        neverAsked.push(`${p.business_name} (${p.whatsapp}, renovación vencida ${cycle})`);
        report.pauseHeld++;
        continue;
      }
      if (decision.action !== "pause") continue;
      const { data: paused, error: pauseError } = await db
        .from(SIGNUPS_TABLE)
        .update({ status: "pausada", paused_at: nowIso, recontact_after: svDate(now, RECONTACT_AFTER_DAYS), last_touch_at: nowIso, last_touch_kind: "auto_pausa" })
        .eq("id", p.id)
        .eq("status", "activa")
        .eq("paid_through", cycle)
        .is("paused_at", null)
        .select("id")
        .maybeSingle();
      if (pauseError) {
        report.errors.push(`T9 ${p.id}: ${errText(pauseError)}`);
        continue;
      }
      if (!paused) continue;
      await pausedAlert(
        p,
        `⏸ PAUSADA por falta de pago — ${p.business_name} (${p.whatsapp}): no renovó su mes de $${MONTHLY_PRICE_USD} (${p.paid_via === "paypal" ? "PayPal" : "pago a mano"}, pagado hasta ${formatDateEs(cycle)}; ${pauseReason(decision, p, RENEWAL_FLOW)}). ${p.site_url ? `Web: ${p.site_url}. ` : ""}Revise que su web quede fuera de línea (archivada, no borrada). Si paga, «→ Activa» la reactiva. Recontactar desde ${svDate(now, RECONTACT_AFTER_DAYS)}.`,
      );
    }
  } catch (error) {
    report.errors.push(`T8: ${errText(error)}`);
  }

  // One "configure a payment method" alert a day, while payment asks could actually go out.
  if (waitingForPayMethod.length && windowOpen("reminder", now)) {
    await deps.alert(
      `paylink-missing:${today}`,
      `Configure el enlace de pago (Stripe o PayPal) en el tablero → «Capacidad, pago y demo»: hay recordatorios de pago esperando (${waitingForPayMethod.slice(0, 12).join(", ")}${waitingForPayMethod.length > 12 ? "…" : ""}). Sin una forma de pago en /pagar no se le pide el pago a nadie y las webs vencidas no se pausan.`,
    );
  }
  if (neverAsked.length && windowOpen("transactional", now)) {
    await deps.alert(
      `pause-held:${today}`,
      `⏸ NO se pausan solas (nunca se les pidió el pago — ningún recordatorio les llegó): ${neverAsked.slice(0, 10).join("; ")}${neverAsked.length > 10 ? ` y ${neverAsked.length - 10} más` : ""}. Revise la forma de pago y el WhatsApp automático; luego envíeles «Día 30», «Aviso de pausa» o «Renovación» desde su tarjeta (se pausan solas ~1 día después), o use «Pausar».`,
    );
  }

  // ── 3. Holds: rows that can't go out right now wait an hour instead of sitting at the
  //       front of the queue (a probe per minute) and crowding out other retries.
  const holdAll = !!report.stopped && GLOBAL_HOLD_CODES.has(report.stopped);
  const holdTemplates = holdAll ? [...TEMPLATE_NAMES] : [...skipTemplates];
  if (holdTemplates.length) {
    try {
      let q = db
        .from(MESSAGES_TABLE)
        .update({ next_attempt_at: iso(plusSec(now, HOUR)) })
        .eq("status", "queued")
        .in("template", holdTemplates)
        .lte("next_attempt_at", nowIso)
        .or(`locked_until.is.null,locked_until.lt.${nowIso}`);
      if (only) q = q.in("signup_id", only.length ? only : [NO_ID]);
      const { error } = await q;
      if (error) throw error;
    } catch (error) {
      report.errors.push(`hold: ${errText(error)}`);
    }
  }

  return report;
}

// ─── Manual send / retry from the ops board ─────────────────────────────────

export type ManualResult =
  | { ok: true; status: "sent" | "queued" | "failed"; message: string }
  | {
      ok: false;
      error: "not_found" | "not_eligible" | "already_sent" | "window_closed" | "send_failed" | "needs_confirm";
      message: string;
    };

/**
 * One template to one signup, now. Respects opt-out, "no", no payment method
 * and the send window; a template already delivered is never sent twice (a
 * renewal: never twice in the same cycle), and one whose last outcome is
 * unknown is only resent when the person confirms (`force`) after checking the
 * chat. A queued/failed/skipped row is reused (same ledger row, never-used
 * idempotency key) and marked manual, so if it has to wait for a retry the
 * scheduler keeps it even outside its automatic dates.
 */
export async function sendTemplateManually(
  signupId: string,
  template: TemplateName,
  deps: WaDeps,
  options: { force?: boolean } = {},
): Promise<ManualResult> {
  const db = getDb();
  const now = deps.now();
  const { data: subject, error } = await db.from(SIGNUPS_TABLE).select(PAYER_COLUMNS).eq("id", signupId).maybeSingle();
  if (error) throw error;
  if (!subject) return { ok: false, error: "not_found", message: "No existe esa solicitud." };
  const s = asPayer(subject as unknown as Omit<PayerRow, "templates" | "last_template_at">);

  let settings: WebGratisSettings | null = null;
  try {
    settings = await deps.settings();
  } catch (settingsError) {
    console.error("[WebGratis:wa] manual send: settings unavailable", settingsError);
  }
  const block = manualBlock(template, s, settings);
  if (block) return { ok: false, error: "not_eligible", message: block };
  if (!windowOpen(TEMPLATE_WINDOW[template], now)) {
    return { ok: false, error: "window_closed", message: `Fuera del horario de envío (${WINDOW_LABEL[TEMPLATE_WINDOW[template]]}). Inténtelo dentro del horario.` };
  }

  const cycle = template === "cqv_web_renewal" ? s.paid_through : null;
  let lookup = db.from(MESSAGES_TABLE).select("*").eq("signup_id", signupId).eq("template", template);
  lookup = cycle ? lookup.eq("cycle", cycle) : lookup.is("cycle", null);
  const { data: existing, error: readError } = await lookup.maybeSingle();
  if (readError) throw readError;

  let row: MessageRow | null;
  if (!existing) {
    row = await claimNew(s, template, "admin", now, { manual: true, manual_at: iso(now) }, cycle);
    if (!row) return { ok: false, error: "already_sent", message: "Otro proceso lo está enviando en este momento." };
  } else {
    const current = existing as MessageRow;
    if (REACHED.includes(current.status)) {
      return { ok: false, error: "already_sent", message: `Ya se envió (${current.status}). No se envía dos veces.` };
    }
    if (current.last_error_code === UNKNOWN_OUTCOME_CODE && !options.force) {
      return {
        ok: false,
        error: "needs_confirm",
        message: "No sabemos si el intento anterior le llegó. Revise el chat de la línea +1 786-257-0284; si no le llegó, confirme el reenvío.",
      };
    }
    const nowIso = iso(now);
    const { data: leased, error: leaseError } = await db
      .from(MESSAGES_TABLE)
      .update({
        status: "queued",
        phone: s.whatsapp,
        locked_until: iso(new Date(now.getTime() + LEASE_MS)),
        next_attempt_at: nowIso,
        idempotency_key: freshKey(current.id, "m"),
        attempts: Math.min(current.attempts, MAX_ATTEMPTS - 1),
        meta: { ...(current.meta ?? {}), manual: true, manual_retry_at: nowIso },
      })
      .eq("id", current.id)
      .in("status", ["queued", "failed", "skipped"])
      .or(`locked_until.is.null,locked_until.lt.${nowIso}`)
      .select("*")
      .maybeSingle();
    if (leaseError) throw leaseError;
    if (!leased) return { ok: false, error: "already_sent", message: "Se está enviando en este momento; revise en un minuto." };
    row = leased as MessageRow;
  }

  const res = await attemptTemplateSend(row, s, deps);
  const { data: after } = await db.from(MESSAGES_TABLE).select("status, last_error").eq("id", row.id).maybeSingle();
  if (res.sent) return { ok: true, status: "sent", message: "Enviado ✓" };
  if (after?.status === "failed") return { ok: true, status: "failed", message: `No se envió: ${after.last_error ?? "error"}` };
  return {
    ok: true,
    status: "queued",
    message: `En cola: se reintenta solo dentro de su horario (${WINDOW_LABEL[TEMPLATE_WINDOW[template]]}). Motivo: ${after?.last_error ?? "Rewired no lo aceptó todavía"}`,
  };
}
