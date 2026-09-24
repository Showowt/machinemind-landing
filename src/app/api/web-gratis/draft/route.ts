/**
 * POST /api/web-gratis/draft — save onboarding progress.
 *
 * Step 1 creates the row as 'borrador' — name + WhatsApp are enough for the team
 * to rescue an abandoned form (the 1-minute cron queues an "abandoned" digest
 * for drafts idle 20+ min). Later steps update the same row. A row that was
 * already submitted is never modified here. If the database write fails on the
 * client's final attempt, the raw data goes straight to Telegram.
 */
import { after } from "next/server";
import { sendCapiEvent } from "@/lib/web-gratis/capi";
import { splitServices, toE164 } from "@/lib/web-gratis/config";
import { fail, ok } from "@/lib/web-gratis/http";
import { notifySaveFailed } from "@/lib/web-gratis/notify";
import { enqueueSystem } from "@/lib/web-gratis/outbox";
import { draftRequestSchema } from "@/lib/web-gratis/schema";
import {
  findReferrer,
  getDb,
  ipHash,
  isReferralCodeCollision,
  newReferralCode,
  recentDraftsFromIp,
  SIGNUPS_TABLE,
  type WebGratisSignup,
} from "@/lib/web-gratis/server";

export const maxDuration = 30;

/**
 * Salvadoran carriers put many phones behind shared (CGNAT) IPs, so a real ad
 * burst can come from one address: past the soft limit we alert and KEEP the
 * lead; only an obvious bot volume is refused. (Load test: 180 real-looking
 * sign-ups/hour from one IP must all be accepted.)
 */
const SOFT_PER_IP_PER_HOUR = 150;
const HARD_PER_IP_PER_HOUR = 1000;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid");
  }

  const parsed = draftRequestSchema.safeParse(body);
  if (!parsed.success) return fail(400, "invalid");
  const req = parsed.data;

  // Honeypot filled → a bot. Pretend success, store nothing.
  if (req.website) return ok({ referralCode: newReferralCode(), status: "borrador" });

  const whatsapp = toE164(req.fields.countryCode, req.fields.whatsappLocal);
  if (!whatsapp) return fail(400, "invalid_whatsapp");

  const step1 = {
    business_name: req.fields.businessName,
    business_type: req.fields.businessType,
    city: req.fields.city,
    whatsapp,
    lang: req.lang,
  };
  // Step-2 columns are only written once the user has reached step 2, so a
  // step-1 re-save can never blank content entered later.
  const step2 =
    req.step >= 2
      ? {
          services: splitServices(req.fields.services ?? ""),
          differentiator: req.fields.differentiator ?? null,
          hours: req.fields.hours ?? null,
          instagram: req.fields.instagram ?? null,
          facebook: req.fields.facebook ?? null,
          style: req.fields.style ?? null,
          site_goal: req.fields.siteGoal ?? null,
        }
      : {};

  try {
    const db = getDb();
    const { data: existing, error: readError } = await db
      .from(SIGNUPS_TABLE)
      .select("id, status, step, referral_code")
      .eq("id", req.draftId)
      .maybeSingle();
    if (readError) throw readError;

    if (existing) {
      if (existing.status !== "borrador") {
        return ok({ referralCode: existing.referral_code as string, status: existing.status as string });
      }
      const { error: updateError } = await db
        .from(SIGNUPS_TABLE)
        .update({ ...step1, ...step2, step: Math.max(existing.step as number, req.step) })
        .eq("id", req.draftId)
        .eq("status", "borrador");
      if (updateError) throw updateError;
      return ok({ referralCode: existing.referral_code as string, status: "borrador" });
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
            ? `Una misma conexión superó ${HARD_PER_IP_PER_HOUR} formularios en una hora: se bloquea como bot. Último intento: ${step1.business_name} ${whatsapp}.`
            : `Volumen alto desde una misma conexión (${fromThisIp}+ formularios en una hora — red compartida de operador o bot). Se siguen aceptando; revise el tablero si parecen falsos.`,
        ),
      );
      if (blocked) return fail(429, "rate_limited");
    }

    const referrer = await findReferrer(req.attribution?.ref);
    const validReferrer = referrer && referrer.whatsapp !== whatsapp ? referrer : null;
    const a = req.attribution ?? {};

    let inserted: WebGratisSignup | null = null;
    for (let attempt = 0; attempt < 4 && !inserted; attempt++) {
      const { data, error } = await db
        .from(SIGNUPS_TABLE)
        .insert({
          id: req.draftId,
          ...step1,
          ...step2,
          step: req.step,
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
        // Concurrent first save of the same draft (double tap / client retry) — the other one won.
        const { data: winner } = await db.from(SIGNUPS_TABLE).select("referral_code, status").eq("id", req.draftId).single();
        if (winner) return ok({ referralCode: winner.referral_code as string, status: winner.status as string });
      }
      if (error) throw error;
      inserted = data as WebGratisSignup;
    }
    if (!inserted) throw new Error("referral code generation exhausted");

    const row = inserted;
    after(() =>
      sendCapiEvent({
        eventName: "Lead",
        eventId: `${row.id}-lead`,
        whatsapp: row.whatsapp,
        externalId: row.id,
        sourceUrl: row.landing_url,
        fbclid: row.fbclid,
        request,
      }),
    );
    return ok({ referralCode: row.referral_code, status: row.status });
  } catch (error) {
    console.error("[WebGratis:draft]", error);
    if (req.attempt === undefined || req.attempt >= 2) {
      const reason = error instanceof Error ? error.message : JSON.stringify(error);
      after(() =>
        notifySaveFailed(
          {
            negocio: step1.business_name,
            rubro: step1.business_type,
            ciudad: step1.city,
            whatsapp,
            paso: req.step,
            draft: req.draftId,
          },
          `Paso ${req.step} no se guardó: ${reason}`,
        ),
      );
    }
    return fail(500, "save_failed");
  }
}
