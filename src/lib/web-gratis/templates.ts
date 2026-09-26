/**
 * Free-website funnel — the Meta WhatsApp templates on the dedicated line
 * (WABA 760506473408925, language "es"), their send windows and parameters,
 * and the payment-flow calendar they follow. Client-safe (the ops board and
 * billing.ts import it); no secrets, no DB.
 *
 * Wording mirrors what was submitted to Meta so the ledger (and the responder's
 * conversation history) shows what the business actually received.
 *
 * Names here are LOGICAL (DB, scheduler, board). Rewired maps the payment asks
 * to the Meta templates carrying the $19 price and the hosting choice (we keep
 * hosting with full support, or they self-host) — cqv_web_day28 → cqv_web_day28_c19,
 * cqv_web_day30 → cqv_web_day30_c19, cqv_web_pause_notice → cqv_web_pause_c19 —
 * falling back to the plain $19 versions (_v19) only until Meta approves the _c19
 * ones, and never to the retired $20 ones. cqv_web_renewal (monthly renewal of a
 * PayPal / manual payer, submitted 2026-09-25) is accepted under its logical
 * name. The previews below mirror what Meta has. The price and free days in the
 * previews come from config; Meta's copy is fixed text, so a price change means
 * submitting new templates too.
 *
 * The payment calendar (FREE_MONTH_FLOW / RENEWAL_FLOW, PAUSE_AFTER_ASK_HOURS,
 * pauseDecision, nextSendDay) is the ONE definition both the scheduler
 * (whatsapp.ts) and the billing timeline (billing.ts, the board) read, so the
 * board always shows what the cron will actually do.
 */
import { DEFAULT_PAYPAL_LINK, demoUrl, FREE_DAYS, MONTHLY_PRICE_USD, payUrl } from "./config";
import type { SignupStatus } from "./server";

export const TEMPLATE_NAMES = [
  "cqv_web_confirm",
  "cqv_web_ready",
  "cqv_web_day28",
  "cqv_web_day30",
  "cqv_web_pause_notice",
  "cqv_web_rescue",
  "cqv_web_renewal",
] as const;

export type TemplateName = (typeof TEMPLATE_NAMES)[number];

/** Free-month payment reminders: each needs a payment method and stops once the client pays or says no. */
export const REMINDER_TEMPLATES: readonly TemplateName[] = ["cqv_web_day28", "cqv_web_day30", "cqv_web_pause_notice"];

/** Every template that asks for money (free month + renewals): none goes out without a payment method on /pagar. */
export const PAYMENT_TEMPLATES: readonly TemplateName[] = [...REMINDER_TEMPLATES, "cqv_web_renewal"];

/** Templates a monthly renewal cycle sends (one row per signup, template and cycle). */
export const RENEWAL_TEMPLATES: readonly TemplateName[] = ["cqv_web_renewal", "cqv_web_pause_notice"];

/** Message statuses that mean the template reached Meta (and the client's phone, as far as we know). */
export const REACHED_STATUSES: readonly string[] = ["sent", "delivered", "read"];

/**
 * last_error_code of a send whose outcome is unknown (Rewired timed out / 5xx
 * after possibly reaching Meta). Such a row is never re-sent automatically; the
 * board asks a person to check the chat before resending.
 */
export const UNKNOWN_OUTCOME_CODE = "send_unknown";

/** Global holds: nothing can go out until someone fixes the line / bridge (the attempt isn't counted). */
export const GLOBAL_HOLD_CODES: ReadonlySet<string> = new Set(["disabled", "kill_switch", "number_unhealthy", "not_configured", "unauthorized"]);

/** Template-level condition (not approved yet / paused by Meta): only that template waits. */
export function isTemplateLevelCode(code: string): boolean {
  return code === "template_not_approved" || (/^1320(0[1-9]|1[0-6])$/.test(code) && code !== "132012");
}

/** A queued row waiting on a system-level condition rather than a failed attempt. */
export function isHoldCode(code: string | null | undefined): boolean {
  return !!code && (GLOBAL_HOLD_CODES.has(code) || isTemplateLevelCode(code));
}

/**
 * transactional — 07:00–20:59 El Salvador time, any day.
 * reminder      — 09:00–15:59 El Salvador time, Monday–Saturday (never Sunday).
 */
export type SendWindow = "transactional" | "reminder";

export const TEMPLATE_WINDOW: Record<TemplateName, SendWindow> = {
  cqv_web_confirm: "transactional",
  cqv_web_ready: "transactional",
  cqv_web_day28: "reminder",
  cqv_web_day30: "reminder",
  cqv_web_pause_notice: "reminder",
  cqv_web_rescue: "reminder",
  cqv_web_renewal: "reminder",
};

export const TEMPLATE_LABEL: Record<TemplateName, string> = {
  cqv_web_confirm: "Confirmación",
  cqv_web_ready: "Web lista",
  cqv_web_day28: "Día 28",
  cqv_web_day30: "Día 30",
  cqv_web_pause_notice: "Aviso de pausa",
  cqv_web_rescue: "Rescate (citas)",
  cqv_web_renewal: "Renovación",
};

export const WINDOW_LABEL: Record<SendWindow, string> = {
  transactional: "7:00–20:59 hora SV, todos los días",
  reminder: "9:00–15:59 hora SV, lunes a sábado",
};

/** First and last SV hour each window is open. */
const WINDOW_HOURS: Record<SendWindow, { from: number; to: number; sunday: boolean }> = {
  transactional: { from: 7, to: 20, sunday: true },
  reminder: { from: 9, to: 15, sunday: false },
};

// ─── El Salvador calendar (UTC-6 all year, no DST) ──────────────────────────

/** Same offset as server.ts SV_OFFSET_MS; kept here so client code (board, billing) needs no server import. */
const SV_OFFSET_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD of `date` in El Salvador, shifted by `days` (same result as server.ts svDate). */
export function svDay(date: Date, days = 0): string {
  const sv = new Date(date.getTime() - SV_OFFSET_MS);
  sv.setUTCDate(sv.getUTCDate() + days);
  return sv.toISOString().slice(0, 10);
}

/** YYYY-MM-DD plus `days` (calendar arithmetic on a date string). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY_MS);
}

/** 0 = Sunday … 6 = Saturday, for a YYYY-MM-DD. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

/** The instant an El Salvador calendar day starts. */
export function svDayStart(date: string): Date {
  return new Date(Date.parse(`${date}T00:00:00Z`) + SV_OFFSET_MS);
}

const MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const WEEKDAYS_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** "2026-10-25" → "25 de octubre" (the renewal template's due date and the team alerts). */
export function formatDateEs(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${d} de ${MONTHS_ES[(m ?? 1) - 1] ?? ""}`;
}

/** "2026-09-25" → "viernes 25 de septiembre". */
export function formatDayEs(date: string): string {
  return `${WEEKDAYS_ES[weekdayOf(date)]} ${formatDateEs(date)}`;
}

/** Hour (0–23) and weekday (0 = Sunday) in El Salvador (UTC-6, no DST). */
export function svClock(now: Date): { hour: number; weekday: number } {
  const sv = new Date(now.getTime() - SV_OFFSET_MS);
  return { hour: sv.getUTCHours(), weekday: sv.getUTCDay() };
}

export function windowOpen(window: SendWindow, now: Date): boolean {
  const { hour, weekday } = svClock(now);
  const w = WINDOW_HOURS[window];
  return (w.sunday || weekday !== 0) && hour >= w.from && hour <= w.to;
}

/**
 * The first SV day in [from, to] on which a template of this window can still
 * go out, seen from `now` (today counts only while the window hasn't closed for
 * the day), or null when none is left — the scheduler then never sends it.
 */
export function nextSendDay(window: SendWindow, from: string, to: string, now: Date): string | null {
  const today = svDay(now);
  const { hour } = svClock(now);
  const w = WINDOW_HOURS[window];
  for (let d = from > today ? from : today; d <= to; d = addDays(d, 1)) {
    if (!w.sunday && weekdayOf(d) === 0) continue;
    if (d === today && hour > w.to) continue;
    return d;
  }
  return null;
}

// ─── Payment calendar (free month + monthly renewals) ───────────────────────

/**
 * Day offsets from the due date (free_until, or paid_through for a renewal):
 * each ask goes out on the first open day of its [from, to] range (a Sunday or a
 * missed day never makes two asks land at once); auto-pause candidates start
 * at `pauseFrom`; `graceOver` is when a client whose pause notice never went out
 * (but an earlier ask did) is paused anyway.
 */
export interface PaymentFlow {
  /** The first ask ("day 28" / the renewal reminder). */
  ask: readonly [number, number];
  /** The due-day ask ("day 30"), when the flow has one. */
  dueAsk: readonly [number, number] | null;
  notice: readonly [number, number];
  pauseFrom: number;
  graceOver: number;
}

/** Free month: day28 = free_until−2, day30 = free_until, pause notice = free_until+2..+4, auto-pause from +3. */
export const FREE_MONTH_FLOW: PaymentFlow = { ask: [-2, -1], dueAsk: [0, 1], notice: [2, 4], pauseFrom: 3, graceOver: 6 };

/** PayPal / manual renewals: reminder = paid_through−3, pause notice = paid_through+3..+5, auto-pause from +4. */
export const RENEWAL_FLOW: PaymentFlow = { ask: [-3, -1], dueAsk: null, notice: [3, 5], pauseFrom: 4, graceOver: 7 };

/** Hours between the last payment ask that reached the client and the auto-pause ("se pausa mañana"). */
export const PAUSE_AFTER_ASK_HOURS = 20;

/** "Vence pronto": the due date is this many days away or fewer. */
export const DUE_SOON_DAYS = 3;

/** Whether `today` falls inside a flow range relative to `due`. */
export function inFlowRange(today: string, due: string, range: readonly [number, number]): boolean {
  return today >= addDays(due, range[0]) && today <= addDays(due, range[1]);
}

export interface PauseInput {
  due: string;
  /** Not opted out, has WhatsApp, didn't say no. */
  messageable: boolean;
  /** When the pause notice of this cycle reached them, or null. */
  noticeSentAt: string | null;
  /** When the latest ask of this cycle (any template) reached them, or null. */
  lastAskAt: string | null;
}

export type PauseDecision =
  | { action: "pause"; reason: "unreachable" | "notice" | "asked" }
  | { action: "wait"; until: Date }
  | { action: "wait_notice" }
  | { action: "held" };

/**
 * Auto-pause rule shared by the free month and renewals: only clients who were
 * asked to pay — a day after the pause notice reached them; or, if the notice
 * never could, once the grace is over and an earlier ask did. Never-asked
 * clients are held for a person. Clients we can't / mustn't message pause as
 * soon as they're candidates.
 */
export function pauseDecision(flow: PaymentFlow, p: PauseInput, now: Date): PauseDecision {
  const today = svDay(now);
  const from = addDays(p.due, flow.pauseFrom);
  if (today < from) return { action: "wait", until: svDayStart(from) };
  if (!p.messageable) return { action: "pause", reason: "unreachable" };
  const after = (at: string) => new Date(Date.parse(at) + PAUSE_AFTER_ASK_HOURS * 3_600_000);
  if (p.noticeSentAt) {
    const until = after(p.noticeSentAt);
    return now < until ? { action: "wait", until } : { action: "pause", reason: "notice" };
  }
  if (today < addDays(p.due, flow.graceOver)) return { action: "wait_notice" };
  if (!p.lastAskAt) return { action: "held" };
  const until = after(p.lastAskAt);
  return now < until ? { action: "wait", until } : { action: "pause", reason: "asked" };
}

// ─── Payment method ─────────────────────────────────────────────────────────

/**
 * /pagar can take a payment: a Stripe Payment Link, or PayPal (the board's link,
 * else the default). Reminders only go out — and unpaid sites only pause — when
 * this is true. `defaultPaypal` is the fallback /pagar uses (tests pass null).
 */
export function hasPaymentMethod(
  settings: { pay_link: string | null; paypal_link?: string | null } | null,
  defaultPaypal: string | null = DEFAULT_PAYPAL_LINK,
): boolean {
  if (settings?.pay_link?.trim()) return true;
  return !!(settings?.paypal_link?.trim() || defaultPaypal?.trim());
}

// ─── Parameters + previews ──────────────────────────────────────────────────

export interface TemplateSubject {
  business_name: string;
  referral_code: string;
  site_url: string | null;
}

export interface TemplatePayload {
  bodyParams: string[];
  buttonParam?: string;
}

/**
 * Meta rejects a body parameter containing newlines, tabs or 4+ consecutive
 * spaces (error 132000-family); collapse whitespace and keep it short.
 */
export function cleanParam(value: string, max = 80): string {
  const flat = value.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trim()}…` : flat;
}

const TLDS =
  "com|net|org|info|biz|io|co|me|ly|gl|gg|app|site|xyz|sv|gt|hn|ni|cr|pa|mx|us|es|la|online|store|shop|link|click|top|live|to|cc|tk|ws|ru|cn|page|dev|tv|website|club";
const URLISH = new RegExp(
  `(?:https?:\\/\\/|www\\.)\\S*|(?<![\\p{L}\\p{N}])[\\p{L}\\p{N}-]+\\.(?:${TLDS})(?![\\p{L}\\p{N}])(?:\\/\\S*)?|\\S+\\.\\S+\\/\\S*`,
  "giu",
);

/**
 * The business name as a template parameter. It comes straight from a public,
 * unverified form and lands in a message from MachineMind's verified line, so
 * anything that could turn it into a phishing lure is removed: links and
 * domains, @handles/e-mails, phone-like digit runs (4+ digits) and WhatsApp
 * formatting marks. Short (the confirmation caps at 30). Empty → `fallback`.
 */
export function businessParam(value: string, max: number, fallback: string): string {
  const cleaned = value
    .replace(URLISH, " ")
    .replace(/\S*@\S*/g, " ")
    .replace(/(?:\d[\s().\-/]*){4,}/g, " ")
    .replace(/[*_~`]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s,.;:!¡?¿\-–—|/]+|[\s,;:\-–—|/]+$/g, "")
    .trim();
  return cleaned.length >= 2 ? cleanParam(cleaned, max) : fallback;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parameters for one template, or null when a required value is missing (no
 * site URL yet; a renewal without its cycle — the paid_through date it's about).
 */
export function templatePayload(name: TemplateName, s: TemplateSubject, opts: { cycle?: string | null } = {}): TemplatePayload | null {
  const business = businessParam(s.business_name, 60, "estimado cliente");
  const code = s.referral_code;
  switch (name) {
    case "cqv_web_confirm":
      // Goes to a number nobody has verified yet: shortest, cleanest version.
      return { bodyParams: [businessParam(s.business_name, 30, "gracias")] };
    case "cqv_web_ready": {
      const site = s.site_url ? cleanParam(s.site_url, 300) : "";
      return site ? { bodyParams: [site], buttonParam: code } : null;
    }
    case "cqv_web_day28":
    case "cqv_web_day30":
    case "cqv_web_pause_notice":
      return { bodyParams: [business, payUrl(code)], buttonParam: code };
    case "cqv_web_rescue":
      return { bodyParams: [business, demoUrl(code)] };
    case "cqv_web_renewal":
      return opts.cycle && DATE_RE.test(opts.cycle)
        ? { bodyParams: [business, formatDateEs(opts.cycle), payUrl(code)], buttonParam: code }
        : null;
  }
}

/** The text the business sees (for the ledger, the board log and the responder's history). */
export function templatePreview(name: TemplateName, s: TemplateSubject, opts: { cycle?: string | null } = {}): string {
  const p = templatePayload(name, s, opts);
  const [a = "", b = "", c = ""] = p?.bodyParams ?? [];
  switch (name) {
    case "cqv_web_confirm":
      return `¡Recibido, ${a}! Ya empezamos a armar su página web. Le confirmo por acá cuando esté lista (pocos días).`;
    case "cqv_web_ready":
      return `¡Su página web ya está lista! 🎉 ${a} — échele un ojo y dígame si quiere ajustar algo. [Botón: Ver mi web]`;
    case "cqv_web_day28":
      return `Recordatorio amistoso, ${a}: su mes gratis termina en 2 días. Si quiere que se la sigamos alojando, son $${MONTHLY_PRICE_USD} USD/mes con soporte completo, sin contrato: ${b}. Si prefiere alojarla usted mismo, respóndanos y le entregamos los archivos (sin nuestra asistencia). [Botón: Activar mi web]`;
    case "cqv_web_day30":
      return `Hola ${a}, hoy se cumplen sus ${FREE_DAYS} días gratis. Para que se la sigamos alojando con soporte completo son $${MONTHLY_PRICE_USD} USD/mes, sin contrato: ${b}. Si prefiere alojarla usted mismo, respóndanos y le entregamos los archivos (sin nuestra asistencia). [Botón: Activar mi web]`;
    case "cqv_web_pause_notice":
      return `Aviso sobre su página web, ${a}: mañana pausamos su alojamiento porque no se activó el plan de $${MONTHLY_PRICE_USD} USD/mes con soporte completo. Actívelo aquí: ${b}. Si prefiere alojarla usted mismo, respóndanos y le entregamos los archivos. [Botón: Activar mi web]`;
    case "cqv_web_rescue":
      return `Hola ${a}, ¿sabía que su web puede AGENDAR las citas sola por WhatsApp, 24/7? Le muestro cómo se vería con su negocio 👉 ${b}. Responda NO para no recibir más mensajes.`;
    case "cqv_web_renewal":
      return `Hola ${a}, la mensualidad de su página web ($${MONTHLY_PRICE_USD} USD, hosting y soporte completo) vence el ${b || "—"}. Para mantenerla en línea, renuévela aquí: ${c || "—"} (sin contrato). [Botón: /pagar]`;
  }
}

export function isTemplateName(value: string): value is TemplateName {
  return (TEMPLATE_NAMES as readonly string[]).includes(value);
}

// ─── What a person may send by hand ─────────────────────────────────────────

/** What a person's send (board button, or a queued row they started) is checked against. */
export interface ManualGuardInput extends TemplateSubject {
  status: SignupStatus;
  activated_at: string | null;
  declined_at: string | null;
  opted_out_at: string | null;
  no_whatsapp_at: string | null;
  /** Needed for a renewal (PayPal / manual payer and the month it runs to). */
  paid_via?: "stripe" | "paypal" | "manual" | null;
  paid_through?: string | null;
}

const CLOSED_STATUSES: readonly SignupStatus[] = ["borrador", "descartada", "cancelada"];

const NO_METHOD_BLOCK =
  "No hay forma de pago en /pagar (ni enlace de Stripe ni de PayPal en «Capacidad, pago y demo»): el recordatorio llevaría a una página sin cómo pagar.";

/**
 * Why a person may NOT send this template, or null when it's allowed. Looser
 * than the scheduler (any day of the reminder cycle, "Web lista" to a client
 * who already paid) but never past an opt-out, a "no", a number without
 * WhatsApp, or a payment ask with no way to pay on /pagar (Stripe or PayPal).
 * A renewal is only for an active PayPal / manual payer with a "pagado hasta".
 * Shared by the ops board and the server.
 */
export function manualBlock(
  t: TemplateName,
  s: ManualGuardInput,
  settings: { pay_link: string | null; paypal_link?: string | null } | null,
): string | null {
  if (s.opted_out_at) return "Se dio de baja: no se le pueden enviar mensajes.";
  if (s.no_whatsapp_at) return "Ese número no tiene WhatsApp: corrija el número en su tarjeta primero.";
  if (CLOSED_STATUSES.includes(s.status)) return "Esta solicitud no está activa.";
  if (t === "cqv_web_renewal") {
    if (s.status !== "activa" || !(s.paid_via === "paypal" || s.paid_via === "manual") || !s.paid_through) {
      return "La renovación es solo para clientes activos que pagan por PayPal o a mano (con «pagado hasta»).";
    }
    if (settings && !hasPaymentMethod(settings)) return NO_METHOD_BLOCK;
    return templatePayload(t, s, { cycle: s.paid_through }) ? null : "Falta la fecha de «pagado hasta».";
  }
  const paid = s.status === "activa" || !!s.activated_at;
  if (paid && t !== "cqv_web_ready" && t !== "cqv_web_confirm") return "Ya pagó: no se le envían recordatorios ni ofertas automáticas.";
  const reminderOrOffer = REMINDER_TEMPLATES.includes(t) || t === "cqv_web_rescue";
  if (s.declined_at && reminderOrOffer) return "Dijo que no: no se le envían recordatorios ni ofertas.";
  if (REMINDER_TEMPLATES.includes(t) && settings && !hasPaymentMethod(settings)) return NO_METHOD_BLOCK;
  if (!templatePayload(t, s)) return "Falta el link de su web.";
  return null;
}
