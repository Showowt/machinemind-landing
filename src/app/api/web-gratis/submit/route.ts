/**
 * POST /api/web-gratis/submit — final submission of the free-website form.
 *
 * Flips the draft to 'nuevo' with the price + share acknowledgements recorded,
 * attaches the files that actually exist in storage, then notifies the team
 * (Telegram to every chat + email) after the response. Idempotent: a second
 * submit of an already-submitted draft returns the same result without
 * re-notifying. If the database write fails, the raw request is pushed to
 * Telegram so the lead is never silently lost.
 */
import { after } from "next/server";
import { MAX_LOGOS, MAX_PHOTOS, splitServices, toE164 } from "@/lib/web-gratis/config";
import { fail, ok } from "@/lib/web-gratis/http";
import { emailSubmitted, notifySaveFailed, notifySubmitted } from "@/lib/web-gratis/notify";
import { submitRequestSchema } from "@/lib/web-gratis/schema";
import {
  findReferrer,
  getDb,
  ipHash,
  isDuplicateBusiness,
  isReferralCodeCollision,
  listDraftFiles,
  newReferralCode,
  recentDraftsFromIp,
  signedLinks,
  SIGNUPS_TABLE,
  type Referrer,
  type WebGratisSignup,
} from "@/lib/web-gratis/server";

const SUBMITS_PER_IP_PER_HOUR = 20;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid");
  }

  const parsed = submitRequestSchema.safeParse(body);
  if (!parsed.success) return fail(400, "invalid");
  const req = parsed.data;

  if (req.website) return ok({ referralCode: newReferralCode(), businessName: req.fields.businessName });

  const whatsapp = toE164(req.fields.countryCode, req.fields.whatsappLocal);
  if (!whatsapp) return fail(400, "invalid_whatsapp");
  const services = splitServices(req.fields.services);
  if (services.length === 0) return fail(400, "invalid");

  const now = new Date().toISOString();
  const content = {
    business_name: req.fields.businessName,
    business_type: req.fields.businessType,
    city: req.fields.city,
    whatsapp,
    lang: req.lang,
    services,
    differentiator: req.fields.differentiator ?? null,
    hours: req.fields.hours ?? null,
    instagram: req.fields.instagram ?? null,
    facebook: req.fields.facebook ?? null,
    style: req.fields.style ?? null,
    site_goal: req.fields.siteGoal ?? null,
  };

  try {
    const db = getDb();

    // Attach only files the user kept AND that really landed in storage.
    const stored = new Set(await listDraftFiles(req.draftId));
    const kept = req.uploadPaths.filter((p) => stored.has(p)).sort();
    const logo_paths = kept.filter((p) => p.startsWith(`${req.draftId}/logo-`)).slice(-MAX_LOGOS);
    const photo_paths = kept.filter((p) => p.startsWith(`${req.draftId}/photo-`)).slice(0, MAX_PHOTOS);

    const submission = {
      ...content,
      status: "nuevo",
      step: 3,
      logo_paths,
      photo_paths,
      submitted_at: now,
      terms_accepted_at: now,
      share_commitment_at: now,
      whatsapp_consent_at: now,
    };

    const { data: existing, error: readError } = await db
      .from(SIGNUPS_TABLE)
      .select("*")
      .eq("id", req.draftId)
      .maybeSingle();
    if (readError) throw readError;

    let row: WebGratisSignup | null = null;
    let referrer: Referrer | null = null;

    if (existing) {
      const current = existing as WebGratisSignup;
      if (current.status !== "borrador") {
        return ok({ referralCode: current.referral_code, businessName: current.business_name });
      }
      const { data, error } = await db
        .from(SIGNUPS_TABLE)
        .update(submission)
        .eq("id", req.draftId)
        .eq("status", "borrador")
        .select("*")
        .maybeSingle();
      if (error) {
        if (isDuplicateBusiness(error)) return fail(409, "duplicate");
        throw error;
      }
      if (!data) {
        // Lost a race with a concurrent submit of the same draft — report its result.
        const { data: again } = await db.from(SIGNUPS_TABLE).select("referral_code, business_name").eq("id", req.draftId).maybeSingle();
        if (again) return ok({ referralCode: again.referral_code as string, businessName: again.business_name as string });
        throw new Error("draft vanished during submit");
      }
      row = data as WebGratisSignup;
      if (row.referred_by_id) {
        const { data: ref } = await db
          .from(SIGNUPS_TABLE)
          .select("id, business_name, whatsapp, referral_code")
          .eq("id", row.referred_by_id)
          .maybeSingle();
        referrer = (ref as Referrer | null) ?? null;
      }
    } else {
      // No draft on the server (step-1 save never landed, or a restored old draft).
      const hash = ipHash(request);
      if ((await recentDraftsFromIp(hash)) >= SUBMITS_PER_IP_PER_HOUR) return fail(429, "rate_limited");
      const found = await findReferrer(req.attribution?.ref);
      referrer = found && found.whatsapp !== whatsapp ? found : null;
      const a = req.attribution ?? {};
      for (let attempt = 0; attempt < 4 && !row; attempt++) {
        const { data, error } = await db
          .from(SIGNUPS_TABLE)
          .insert({
            id: req.draftId,
            ...submission,
            referral_code: newReferralCode(),
            referred_by_id: referrer?.id ?? null,
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
        if (error) {
          if (isDuplicateBusiness(error)) return fail(409, "duplicate");
          throw error;
        }
        row = data as WebGratisSignup;
      }
      if (!row) throw new Error("referral code generation exhausted");
    }

    const { count: otherRequests } = await db
      .from(SIGNUPS_TABLE)
      .select("id", { count: "exact", head: true })
      .eq("whatsapp", row.whatsapp)
      .neq("id", row.id)
      .neq("status", "borrador");
    const links = await signedLinks([...row.logo_paths, ...row.photo_paths]);

    const saved = row;
    const ctx = { referrer, links, otherRequestsSameWhatsapp: otherRequests ?? 0 };
    after(async () => {
      await Promise.all([notifySubmitted(saved, ctx), emailSubmitted(saved, ctx)]);
    });

    return ok({ referralCode: saved.referral_code, businessName: saved.business_name });
  } catch (error) {
    console.error("[WebGratis:submit]", error);
    const reason = error instanceof Error ? error.message : JSON.stringify(error);
    after(() =>
      notifySaveFailed(
        {
          negocio: content.business_name,
          rubro: content.business_type,
          ciudad: content.city,
          whatsapp: content.whatsapp,
          servicios: content.services.join(", "),
          horario: content.hours,
          instagram: content.instagram,
          facebook: content.facebook,
          draft: req.draftId,
        },
        reason,
      ),
    );
    return fail(500, "save_failed");
  }
}
