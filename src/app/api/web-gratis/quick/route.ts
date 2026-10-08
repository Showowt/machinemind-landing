/**
 * POST /api/web-gratis/quick — the number-only capture (/web since 2026-09-30).
 *
 * The page asks for ONE thing: the WhatsApp number. The row is created as
 * 'borrador' with quick_capture_at set, and a "LLAMAR AHORA" alert goes out
 * instantly so Fernanda dials within 5 minutes (9:00–18:00 SV, Mon–Sat —
 * web_gratis_settings). Off shift, the reply tells the lead the funnel line
 * answers now and Fernanda calls when her shift starts. Every other field —
 * name, business, photos — is collected on the call, on WhatsApp, or through
 * the team form (/web?form=full&draft=<id>), which updates this SAME row.
 *
 * A repeat submit of the same number inside 24 h returns the existing row
 * instead of inserting (and alerting) again.
 */
import { after } from "next/server";
import { sendCapiEvent } from "@/lib/web-gratis/capi";
import {
  agentNextStart,
  agentOnDuty,
  countryFromE164,
  isClosedMarketNumber,
  toE164,
  WHATSAPP_CONSENT_VERSION_QUICK,
} from "@/lib/web-gratis/config";
import { fail, ok } from "@/lib/web-gratis/http";
import { notifySaveFailed, quickLeadAlert } from "@/lib/web-gratis/notify";
import { drainIfQuiet, enqueueQuickLead, enqueueSystem } from "@/lib/web-gratis/outbox";
import { quickRequestSchema } from "@/lib/web-gratis/schema";
import { sendQuickHeadsUp } from "@/lib/web-gratis/whatsapp";
import {
  agentScheduleOf,
  findReferrer,
  getDb,
  ipHash,
  isReferralCodeCollision,
  loadSettings,
  newReferralCode,
  recentDraftsFromIp,
  SIGNUPS_TABLE,
  type WebGratisSignup,
} from "@/lib/web-gratis/server";

export const maxDuration = 30;

// Same CGNAT-aware limits as /draft (Salvadoran carriers share IPs).
const SOFT_PER_IP_PER_HOUR = 150;
const HARD_PER_IP_PER_HOUR = 1000;

interface Duty {
  onDuty: boolean;
  nextStart: string;
}

async function dutyNow(): Promise<Duty> {
  try {
    const schedule = agentScheduleOf(await loadSettings());
    return { onDuty: agentOnDuty(schedule), nextStart: agentNextStart(schedule) };
  } catch (error) {
    // Settings unreachable: assume on duty — the worst case is optimistic copy.
    console.error("[WebGratis:quick] settings", error);
    return { onDuty: true, nextStart: "mañana a las 9" };
  }
}

/** Re-entry repairs an interrupted alert enqueue using the saved row's unique
 * quick:<id> key. Attribution and conversion identity always belong to that row. */
async function captureSaved(row: WebGratisSignup, request: Request) {
  const duty = await dutyNow();
  const capturedAt = row.quick_capture_at ? Date.parse(row.quick_capture_at) : NaN;
  const pendingQuick = row.status === "borrador" && Number.isFinite(capturedAt)
    && capturedAt > Date.now() - 24 * 60 * 60 * 1000 && capturedAt <= Date.now()
    && !row.opted_out_at && !row.no_whatsapp_at && !row.declined_at;
  if (!pendingQuick) {
    return ok({ referralCode: row.referral_code, leadEventId: null, onDuty: duty.onDuty, nextStart: duty.nextStart });
  }
  let alerted = false;
  try {
    alerted = await enqueueQuickLead(row.id, quickLeadAlert(row, duty));
  } catch (error) {
    console.error("[WebGratis:quick] enqueue", error);
  }
  after(async () => {
    try {
      if (alerted) await drainIfQuiet();
      else await notifySaveFailed({ whatsapp: row.whatsapp, quick: row.id }, "El número quedó guardado pero la alerta no se pudo encolar.");
    } catch (error) {
      console.error("[WebGratis:quick] drain", error);
    }
    try {
      const outcome = await sendQuickHeadsUp(row.id);
      if (outcome === "failed") console.error("[WebGratis:quick] heads-up send failed", row.id);
    } catch (error) {
      console.error("[WebGratis:quick] heads-up", error);
    }
    await sendCapiEvent({
      eventName: "Lead",
      eventId: `${row.id}-lead`,
      whatsapp: row.whatsapp,
      externalId: row.id,
      sourceUrl: row.landing_url,
      fbclid: row.fbclid,
      request,
    });
  });
  return ok({ referralCode: row.referral_code, leadEventId: `${row.id}-lead`, onDuty: duty.onDuty, nextStart: duty.nextStart });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid");
  }

  const parsed = quickRequestSchema.safeParse(body);
  if (!parsed.success) return fail(400, "invalid");
  const req = parsed.data;

  // Honeypot filled → a bot. Pretend success, store nothing.
  if (req.website) return ok({ referralCode: newReferralCode(), leadEventId: null, onDuty: true, nextStart: "" });

  const whatsapp = toE164(req.countryCode, req.whatsappLocal);
  if (!whatsapp) return fail(400, "invalid_whatsapp");
  if (isClosedMarketNumber(whatsapp)) return fail(400, "market_closed");

  try {
    const db = getDb();

    // Idempotent double-tap on the same quickId.
    const { data: existing, error: readError } = await db
      .from(SIGNUPS_TABLE)
      .select("*")
      .eq("id", req.quickId)
      .maybeSingle();
    if (readError) throw readError;
    if (existing) {
      if (existing.whatsapp !== whatsapp) return fail(409, "invalid");
      return captureSaved(existing as WebGratisSignup, request);
    }

    // The same phone re-submitted (reload, second tap with a fresh id) inside
    // 24 h: hand back the live row instead of a second row + second alert.
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: samePhone, error: phoneError } = await db
      .from(SIGNUPS_TABLE)
      .select("*")
      .eq("whatsapp", whatsapp)
      .eq("status", "borrador")
      .not("quick_capture_at", "is", null)
      .gte("created_at", dayAgo)
      .limit(1)
      .maybeSingle();
    if (phoneError) throw phoneError;
    if (samePhone) {
      return captureSaved(samePhone as WebGratisSignup, request);
    }

    const hash = ipHash(request);
    const fromThisIp = await recentDraftsFromIp(hash);
    if (fromThisIp >= SOFT_PER_IP_PER_HOUR) {
      const hour = new Date().toISOString().slice(0, 13);
      const blocked = fromThisIp >= HARD_PER_IP_PER_HOUR;
      after(() =>
        enqueueSystem(
          `${blocked ? "ipblock" : "iphigh"}:${hash.slice(0, 12)}:${hour}`,
          blocked
            ? `Una misma conexión superó ${HARD_PER_IP_PER_HOUR} formularios en una hora: se bloquea como bot. Último intento: ${whatsapp}.`
            : `Volumen alto desde una misma conexión (${fromThisIp}+ formularios en una hora — red compartida de operador o bot). Se siguen aceptando; revise el tablero si parecen falsos.`,
        ),
      );
      if (blocked) return fail(429, "rate_limited");
    }

    const referrer = await findReferrer(req.attribution?.ref);
    const validReferrer = referrer && referrer.whatsapp !== whatsapp ? referrer : null;
    const a = req.attribution ?? {};

    let inserted: WebGratisSignup | null = null;
    const now = new Date().toISOString();
    for (let attempt = 0; attempt < 4 && !inserted; attempt++) {
      const { data, error } = await db
        .from(SIGNUPS_TABLE)
        .insert({
          id: req.quickId,
          whatsapp,
          country: countryFromE164(whatsapp),
          lang: req.lang,
          step: 1,
          quick_capture_at: now,
          // The consent line sits under the number field ("la llamamos y le escribimos por WhatsApp").
          whatsapp_consent_at: now,
          whatsapp_consent_version: WHATSAPP_CONSENT_VERSION_QUICK,
          referral_code: newReferralCode(),
          referred_by_id: validReferrer?.id ?? null,
          ref_raw: a.ref ?? null,
          utm_source: a.utm_source ?? null,
          utm_medium: a.utm_medium ?? null,
          utm_campaign: a.utm_campaign ?? null,
          utm_content: a.utm_content ?? null,
          utm_term: a.utm_term ?? null,
          fbclid: a.fbclid ?? null,
          landing_url: a.landing_url ?? null,
          user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
          ip_hash: hash,
        })
        .select("*")
        .single();
      if (error && isReferralCodeCollision(error)) continue;
      if (error && error.code === "23505" && /_pkey/.test(error.message ?? "")) {
        const { data: winner, error: winnerError } = await db.from(SIGNUPS_TABLE).select("*").eq("id", req.quickId).single();
        if (winnerError) throw winnerError;
        if (winner) {
          if (winner.whatsapp !== whatsapp) return fail(409, "invalid");
          return captureSaved(winner as WebGratisSignup, request);
        }
      }
      if (error) throw error;
      inserted = data as WebGratisSignup;
    }
    if (!inserted) throw new Error("referral code generation exhausted");

    return captureSaved(inserted, request);
  } catch (error) {
    console.error("[WebGratis:quick]", error);
    if (req.attempt === undefined || req.attempt >= 2) {
      const reason = error instanceof Error ? error.message : JSON.stringify(error);
      after(() => notifySaveFailed({ whatsapp, quick: req.quickId }, `Registro rápido no se guardó: ${reason}`));
    }
    return fail(500, "save_failed");
  }
}
