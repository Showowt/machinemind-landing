/**
 * Free-website funnel — the Meta WhatsApp templates on the dedicated line
 * (WABA 760506473408925, language "es"), their send windows and parameters.
 * Client-safe (the ops board imports labels + windows); no secrets, no DB.
 *
 * Wording mirrors what was submitted to Meta so the ledger (and the responder's
 * conversation history) shows what the business actually received.
 *
 * Names here are LOGICAL (DB, scheduler, board). Rewired maps the payment asks
 * to the Meta templates carrying the $19 price — cqv_web_day28 → cqv_web_day28_v19,
 * cqv_web_day30 → cqv_web_day30_v19, cqv_web_pause_notice → cqv_web_pause_v19 —
 * and never falls back to the retired $20 ones. The price and free days in the
 * previews come from config; Meta's copy is fixed text, so a price change means
 * submitting new templates too.
 */
import { demoUrl, FREE_DAYS, MONTHLY_PRICE_USD, payUrl } from "./config";
import type { SignupStatus, WebGratisSettings } from "./server";

export const TEMPLATE_NAMES = [
  "cqv_web_confirm",
  "cqv_web_ready",
  "cqv_web_day28",
  "cqv_web_day30",
  "cqv_web_pause_notice",
  "cqv_web_rescue",
] as const;

export type TemplateName = (typeof TEMPLATE_NAMES)[number];

/** Payment reminders: each needs the Stripe pay link and stops once the client pays or says no. */
export const REMINDER_TEMPLATES: readonly TemplateName[] = ["cqv_web_day28", "cqv_web_day30", "cqv_web_pause_notice"];

/**
 * last_error_code of a send whose outcome is unknown (Rewired timed out / 5xx
 * after possibly reaching Meta). Such a row is never re-sent automatically; the
 * board asks a person to check the chat before resending.
 */
export const UNKNOWN_OUTCOME_CODE = "send_unknown";

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
};

export const TEMPLATE_LABEL: Record<TemplateName, string> = {
  cqv_web_confirm: "Confirmación",
  cqv_web_ready: "Web lista",
  cqv_web_day28: "Día 28",
  cqv_web_day30: "Día 30",
  cqv_web_pause_notice: "Aviso de pausa",
  cqv_web_rescue: "Rescate (citas)",
};

export const WINDOW_LABEL: Record<SendWindow, string> = {
  transactional: "7:00–20:59 hora SV, todos los días",
  reminder: "9:00–15:59 hora SV, lunes a sábado",
};

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

/** Parameters for one template, or null when a required value is missing (no site URL yet). */
export function templatePayload(name: TemplateName, s: TemplateSubject): TemplatePayload | null {
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
  }
}

/** The text the business sees (for the ledger, the board log and the responder's history). */
export function templatePreview(name: TemplateName, s: TemplateSubject): string {
  const p = templatePayload(name, s);
  const [a = "", b = ""] = p?.bodyParams ?? [];
  switch (name) {
    case "cqv_web_confirm":
      return `¡Recibido, ${a}! Ya empezamos a armar su página web. Le confirmo por acá cuando esté lista (pocos días).`;
    case "cqv_web_ready":
      return `¡Su página web ya está lista! 🎉 ${a} — échele un ojo y dígame si quiere ajustar algo. [Botón: Ver mi web]`;
    case "cqv_web_day28":
      return `Recordatorio amistoso, ${a}: su mes gratis termina en 2 días. Su web sigue en línea por solo $${MONTHLY_PRICE_USD}/mes — soporte, actualizaciones y que nunca se caiga. ¿Se la dejo activa? ${b} (sin contrato). [Botón: Activar mi web]`;
    case "cqv_web_day30":
      return `Hola ${a}, hoy se cumplen sus ${FREE_DAYS} días. Su web ya está trabajando para usted. Para mantenerla en línea con soporte es solo $${MONTHLY_PRICE_USD}/mes, sin contrato. Actívela aquí 👉 ${b} — cancela cuando quiera. [Botón: Activar mi web]`;
    case "cqv_web_pause_notice":
      return `Aviso sobre su página web, ${a}: se pausará mañana porque no se activó el plan de $${MONTHLY_PRICE_USD}/mes. Si quiere mantenerla en línea, actívela aquí: ${b} (sin contrato). [Botón: Activar mi web]`;
    case "cqv_web_rescue":
      return `Hola ${a}, ¿sabía que su web puede AGENDAR las citas sola por WhatsApp, 24/7? Le muestro cómo se vería con su negocio 👉 ${b}. Responda NO para no recibir más mensajes.`;
  }
}

/** Hour (0–23) and weekday (0 = Sunday) in El Salvador (UTC-6, no DST). */
export function svClock(now: Date): { hour: number; weekday: number } {
  const sv = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  return { hour: sv.getUTCHours(), weekday: sv.getUTCDay() };
}

export function windowOpen(window: SendWindow, now: Date): boolean {
  const { hour, weekday } = svClock(now);
  if (window === "transactional") return hour >= 7 && hour <= 20;
  return weekday !== 0 && hour >= 9 && hour <= 15;
}

export function isTemplateName(value: string): value is TemplateName {
  return (TEMPLATE_NAMES as readonly string[]).includes(value);
}

/** What a person's send (board button, or a queued row they started) is checked against. */
export interface ManualGuardInput extends TemplateSubject {
  status: SignupStatus;
  activated_at: string | null;
  declined_at: string | null;
  opted_out_at: string | null;
  no_whatsapp_at: string | null;
}

const CLOSED_STATUSES: readonly SignupStatus[] = ["borrador", "descartada", "cancelada"];

/**
 * Why a person may NOT send this template, or null when it's allowed. Looser
 * than the scheduler (any day of the reminder cycle, "Web lista" to a client
 * who already paid) but never past an opt-out, a "no", a number without
 * WhatsApp, or a reminder with no pay link. Shared by the ops board and the server.
 */
export function manualBlock(t: TemplateName, s: ManualGuardInput, settings: Pick<WebGratisSettings, "pay_link"> | null): string | null {
  if (s.opted_out_at) return "Se dio de baja: no se le pueden enviar mensajes.";
  if (s.no_whatsapp_at) return "Ese número no tiene WhatsApp: corrija el número en su tarjeta primero.";
  if (CLOSED_STATUSES.includes(s.status)) return "Esta solicitud no está activa.";
  const paid = s.status === "activa" || !!s.activated_at;
  if (paid && t !== "cqv_web_ready" && t !== "cqv_web_confirm") return "Ya pagó: no se le envían recordatorios ni ofertas automáticas.";
  const reminderOrOffer = REMINDER_TEMPLATES.includes(t) || t === "cqv_web_rescue";
  if (s.declined_at && reminderOrOffer) return "Dijo que no: no se le envían recordatorios ni ofertas.";
  if (REMINDER_TEMPLATES.includes(t) && settings && !settings.pay_link) {
    return "Falta el enlace de pago (Stripe) en «Capacidad, pago y demo»: el recordatorio llevaría a una página sin pago con tarjeta.";
  }
  if (!templatePayload(t, s)) return "Falta el link de su web.";
  return null;
}
