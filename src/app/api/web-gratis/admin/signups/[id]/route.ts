/**
 * PATCH /api/web-gratis/admin/signups/:id — move a signup through the pipeline.
 *
 * Status changes stamp their lifecycle column once (delivered_at + free_until,
 * shared_at, activated_at, paused_at). `touch` records that a scripted WhatsApp
 * message was opened; `confirmed` marks the "¡Recibido!" confirmation as sent.
 *
 * "→ Activa" is the manual payment path (PayPal / cash): it records paid_via,
 * the month it covers (paid_through = +30 days) and credits the referrer (D4)
 * exactly like a Stripe payment; `renew` records the next month's payment.
 * Delivering a request that already paid (Stripe while still being built) makes
 * it Activa and queues the "Web lista" template.
 * Reopening a paused/closed unpaid site gives it 7 more free days and one more
 * automatic reminder → pause cycle (paused_at is cleared).
 * `whatsapp` corrects the number (clears a "no WhatsApp" mark and re-derives
 * `country` from the new prefix) — a local number is read as SV (8 digits) or,
 * for an SV/CO business, CO (mobile, 10 digits); anything else needs its code;
 * `referredByCode` links a referral the business only named in free text.
 * The saved row comes back with its country resolved (same shape as the list).
 * Bearer token.
 */
import { after } from "next/server";
import { z } from "zod";
import { normalizeOpsRow, requireAdmin, signupCountry, type BoardCountry, type OpsSignup } from "@/lib/web-gratis/admin";
import { countryFromE164, FREE_DAYS } from "@/lib/web-gratis/config";
import { fail, ok } from "@/lib/web-gratis/http";
import { enqueueSystem } from "@/lib/web-gratis/outbox";
import { CREDITS_TABLE, grantReferralCredit } from "@/lib/web-gratis/payments";
import {
  BUILDING_STATUSES,
  findReferrer,
  getDb,
  LIVE_FREE_STATUSES,
  SIGNUPS_TABLE,
  svDate,
  type SignupStatus,
} from "@/lib/web-gratis/server";
import { queueManualTemplate, svDateOf } from "@/lib/web-gratis/whatsapp";

const STATUSES = [
  "nuevo",
  "en_construccion",
  "entregada",
  "compartida",
  "activa",
  "pausada",
  "cancelada",
  "descartada",
] as const;

const patchSchema = z.object({
  status: z.enum(STATUSES).optional(),
  siteUrl: z.union([z.url({ protocol: /^https?$/ }).max(300), z.literal(""), z.null()]).optional(),
  notes: z.union([z.string().max(2000), z.null()]).optional(),
  touch: z.string().regex(/^[a-z0-9_]{2,40}$/).optional(),
  confirmed: z.literal(true).optional(),
  /** How a manual "→ Activa" was paid. */
  paidVia: z.enum(["manual", "paypal"]).optional(),
  /** PayPal / manual payer paid another month. */
  renew: z.literal(true).optional(),
  /** Corrected WhatsApp number (any common format; normalised to E.164). */
  whatsapp: z.string().trim().min(1).max(30).optional(),
  /** Referral code of the business that referred this one (from the free-text answer). */
  referredByCode: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(/^[A-HJ-NP-Z2-9]{6}$/))
    .optional(),
});

const REOPEN_FREE_DAYS = 7;
const CLOSED: readonly SignupStatus[] = ["pausada", "cancelada", "descartada"];

/**
 * "+503 7123-4567", "71234567", "0050371234567", "50371234567" → "+50371234567";
 * "300 123 4567", "+57 300 123 4567" → "+573001234567". A number with El
 * Salvador's or Colombia's prefix must be a valid one there (SV: 8 digits
 * starting 2/6/7; CO: mobile, 10 digits starting 3). Null when it can't be one.
 */
function normalizeWhatsapp(raw: string, country: BoardCountry): string | null {
  const trimmed = raw.trim();
  let digits = trimmed.replace(/\D/g, "");
  let international = trimmed.startsWith("+");
  if (!international && digits.startsWith("00")) {
    digits = digits.slice(2);
    international = true;
  }
  if (!international) {
    if (/^[267]\d{7}$/.test(digits)) return `+503${digits}`; // El Salvador, local
    if (country !== "OTHER" && /^3\d{9}$/.test(digits)) return `+57${digits}`; // Colombia mobile, local
  }
  if (digits.startsWith("503")) return /^503[267]\d{7}$/.test(digits) ? `+${digits}` : null;
  if (digits.startsWith("57")) return /^573\d{9}$/.test(digits) ? `+${digits}` : null;
  // Any other number must carry its country code: a bare 10-digit local number
  // ("305 555 0123") would otherwise be saved as +305… — a different country.
  if (international ? /^[1-9]\d{9,14}$/.test(digits) : /^[1-9]\d{10,14}$/.test(digits)) return `+${digits}`;
  return null;
}

/** A later SV date between two (null-safe). */
function laterDate(a: string | null, b: string): string {
  return a && a > b ? a : b;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return fail(400, "invalid");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid");
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return fail(400, "invalid", parsed.error.issues[0]?.message);
  const patch = parsed.data;

  try {
    const db = getDb();
    const { data: found, error: readError } = await db
      .from(SIGNUPS_TABLE)
      .select(
        "id, status, business_name, whatsapp, delivered_at, free_until, shared_at, activated_at, confirmed_at, paid_via, paused_at, paid_through, referred_by_id, no_whatsapp_at, site_url, country",
      )
      .eq("id", id)
      .maybeSingle();
    if (readError) throw readError;
    if (!found) return fail(404, "draft_not_found");
    const current = found as Pick<
      OpsSignup,
      | "country"
      | "id"
      | "status"
      | "business_name"
      | "whatsapp"
      | "delivered_at"
      | "free_until"
      | "shared_at"
      | "activated_at"
      | "confirmed_at"
      | "paid_via"
      | "paused_at"
      | "paid_through"
      | "referred_by_id"
      | "no_whatsapp_at"
      | "site_url"
    >;

    const nowDate = new Date();
    const now = nowDate.toISOString();
    const today = svDate(nowDate);
    const update: Record<string, unknown> = {};
    let paidEarlyDelivery = false;

    if (patch.status) {
      let status: SignupStatus = patch.status;
      // Paid while still being built: delivering it makes it Activa ("Web lista" is queued below).
      paidEarlyDelivery = status === "entregada" && !!current.activated_at && BUILDING_STATUSES.includes(current.status);
      if (paidEarlyDelivery) status = "activa";
      update.status = status;
      if (patch.status === "entregada" && !current.delivered_at) {
        update.delivered_at = now;
        if (!current.free_until && !paidEarlyDelivery) update.free_until = svDate(nowDate, FREE_DAYS);
      }
      if (status === "compartida" && !current.shared_at) update.shared_at = now;
      if (status === "activa" && !paidEarlyDelivery) {
        if (!current.activated_at) update.activated_at = now;
        const via = patch.paidVia ?? current.paid_via ?? "manual";
        update.paid_via = via;
        update.recontact_after = null;
        update.paused_at = null;
        // A PayPal / cash payment covers one month from today (or from the end of the month already paid).
        if (via !== "stripe") update.paid_through = svDateOf(laterDate(current.paid_through, today), 30);
      }
      if (status === "pausada" && !current.paused_at) {
        update.paused_at = now;
        update.recontact_after = svDate(nowDate, 60);
      }
      // Reopen an unpaid paused/closed site: 7 more free days and one more reminder → auto-pause cycle.
      if (LIVE_FREE_STATUSES.includes(status) && CLOSED.includes(current.status) && !current.activated_at) {
        update.paused_at = null;
        update.recontact_after = null;
        update.free_until = laterDate(current.free_until, svDate(nowDate, REOPEN_FREE_DAYS));
      }
    }

    if (patch.renew) {
      if ((update.status ?? current.status) !== "activa") return fail(409, "invalid", "Solo para clientes activos.");
      update.paid_through = svDateOf(laterDate(current.paid_through, today), 30);
      update.last_touch_at = now;
      update.last_touch_kind = "pago_mes";
    }

    if (patch.whatsapp !== undefined) {
      const phone = normalizeWhatsapp(patch.whatsapp, signupCountry(current));
      if (!phone) {
        return fail(400, "invalid_whatsapp", "Número inválido. Use +503 7123 4567 (El Salvador) o +57 300 123 4567 (Colombia), con el código del país.");
      }
      if (phone !== current.whatsapp || current.no_whatsapp_at) {
        update.whatsapp = phone;
        update.no_whatsapp_at = null;
      }
      // `country` is always derived from the WhatsApp prefix (draft/submit do the same):
      // a +503 → +57 correction moves the business to Colombia (board filter, /pagar framing, responder).
      const nextCountry = countryFromE164(phone);
      if (nextCountry !== current.country) update.country = nextCountry;
    }

    let referralLinked = false;
    if (patch.referredByCode !== undefined) {
      const referrer = await findReferrer(patch.referredByCode);
      if (!referrer) return fail(404, "not_found", "No hay ningún negocio activo con ese código.");
      if (referrer.id === id || referrer.whatsapp === current.whatsapp) {
        return fail(409, "invalid", "Un negocio no puede referirse a sí mismo.");
      }
      if (current.referred_by_id !== referrer.id) {
        const { data: credit, error: creditError } = await db.from(CREDITS_TABLE).select("id").eq("referred_id", id).maybeSingle();
        if (creditError) throw creditError;
        if (credit) return fail(409, "invalid", "Ya se le dio el mes gratis a quien lo refirió; no se puede cambiar.");
        update.referred_by_id = referrer.id;
        referralLinked = true;
      }
    }

    if (patch.siteUrl !== undefined) update.site_url = patch.siteUrl || null;
    if (patch.notes !== undefined) update.notes = patch.notes?.trim() || null;
    if (patch.touch) {
      update.last_touch_at = now;
      update.last_touch_kind = patch.touch;
    }
    if (patch.confirmed && !current.confirmed_at) update.confirmed_at = now;
    if (Object.keys(update).length === 0) return ok({ id, unchanged: true });

    const { data, error } = await db.from(SIGNUPS_TABLE).update(update).eq("id", id).select("*").single();
    if (error) {
      // 23514 = a DB guardrail (e.g. an unfinished draft can't be marked submitted).
      if (error.code === "23514") return fail(409, "invalid", "Ese cambio no es válido para esta solicitud (le faltan datos del formulario).");
      if (error.code === "23505") return fail(409, "duplicate", "Ya hay otra solicitud activa para este negocio y WhatsApp.");
      throw error;
    }
    const saved = normalizeOpsRow(data as OpsSignup);

    const becameActive = saved.status === "activa" && current.status !== "activa";
    const creditDue = !!saved.activated_at && !!saved.referred_by_id && (becameActive || referralLinked);
    if (becameActive || creditDue) {
      after(async () => {
        if (becameActive) {
          const text = paidEarlyDelivery
            ? `✅ Entregada y activa: ${saved.business_name} (${saved.whatsapp}) ya había pagado; «Web lista» sale sola por WhatsApp dentro de su horario.`
            : `💰 Activada a mano (${saved.paid_via === "paypal" ? "PayPal" : "pago manual"}): ${saved.business_name} (${saved.whatsapp}).${saved.paid_through ? ` Pagado hasta ${saved.paid_through}.` : ""} Los recordatorios de pago se detienen solos.`;
          await enqueueSystem(`paid-manual:${saved.id}:${now.slice(0, 13)}`, text);
        }
        if (paidEarlyDelivery) {
          try {
            await queueManualTemplate(saved.id, "cqv_web_ready", new Date(), "pagó antes de la entrega");
          } catch (queueError) {
            console.error("[WebGratis:admin:patch] could not queue 'Web lista'", saved.id, queueError);
            await enqueueSystem(`ready-queue-failed:${saved.id}`, `❌ No se pudo poner en cola «Web lista» para ${saved.business_name} (${saved.whatsapp}): envíela desde su tarjeta.`);
          }
        }
        if (creditDue) {
          try {
            await grantReferralCredit(saved, enqueueSystem);
          } catch (creditError) {
            console.error("[WebGratis:admin:patch] referral credit failed (the cron retries it)", saved.id, creditError);
            await enqueueSystem(
              `credit-retry:${saved.id}`,
              `⚠️ No se pudo registrar el mes gratis del referidor de ${saved.business_name}; el sistema lo reintenta solo cada minuto.`,
            );
          }
        }
      });
    }
    return ok(saved);
  } catch (error) {
    console.error("[WebGratis:admin:patch]", error);
    return fail(500, "server_error");
  }
}
