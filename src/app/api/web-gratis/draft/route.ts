/**
 * POST /api/web-gratis/draft — save onboarding progress.
 *
 * Step 1 creates the row as 'borrador' (name + WhatsApp are enough for the team
 * to rescue an abandoned form) and pings Telegram once. Later steps update the
 * same row. A row that was already submitted is never modified here.
 */
import { after } from "next/server";
import { splitServices, toE164 } from "@/lib/web-gratis/config";
import { fail, ok } from "@/lib/web-gratis/http";
import { notifyDraftStarted } from "@/lib/web-gratis/notify";
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

const DRAFTS_PER_IP_PER_HOUR = 20;

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
    if ((await recentDraftsFromIp(hash)) >= DRAFTS_PER_IP_PER_HOUR) {
      return fail(429, "rate_limited");
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
      if (error) throw error;
      inserted = data as WebGratisSignup;
    }
    if (!inserted) throw new Error("referral code generation exhausted");

    const row = inserted;
    after(() => notifyDraftStarted(row, validReferrer));
    return ok({ referralCode: row.referral_code, status: row.status });
  } catch (error) {
    console.error("[WebGratis:draft]", error);
    return fail(500, "save_failed");
  }
}
