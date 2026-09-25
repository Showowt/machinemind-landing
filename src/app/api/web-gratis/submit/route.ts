/**
 * POST /api/web-gratis/submit — final submission of the free-website form.
 *
 * Flips the draft to 'nuevo' with the price + share acknowledgements recorded,
 * attaches the files that actually exist in storage (sorted into logo / photo /
 * document columns by their "<kind>-" filename prefix, only from this draft's
 * own folder; files already sent on WhatsApp are kept), writes `country` from
 * the validated WhatsApp number, queues the team alert in
 * the outbox and drains it right after the response (the 1-minute cron picks
 * up anything left). Idempotent: re-submitting an already-submitted draft
 * returns the same result and never re-alerts (outbox dedupe key). If the
 * database write fails on the client's final attempt, the raw request is
 * pushed straight to Telegram so the lead is never silently lost.
 */
import { after } from "next/server";
import { sendCapiEvent } from "@/lib/web-gratis/capi";
import {
  countryFromE164,
  REFERRAL_CODE_RE,
  splitServices,
  toE164,
  WHATSAPP_CONSENT_VERSION_SUBMIT,
} from "@/lib/web-gratis/config";
import { fail, ok } from "@/lib/web-gratis/http";
import { notifySaveFailed } from "@/lib/web-gratis/notify";
import { drainIfQuiet, enqueue } from "@/lib/web-gratis/outbox";
import { submitRequestSchema, validationErrorCode } from "@/lib/web-gratis/schema";
import {
  findReferrer,
  getDb,
  ipHash,
  isDuplicateBusiness,
  isReferralCodeCollision,
  mergeWhatsappUploads,
  newReferralCode,
  recentDraftsFromIp,
  SIGNUPS_TABLE,
  sortUploadPaths,
  storedTypeFitsKind,
  tryListDraftObjects,
  type WebGratisSignup,
} from "@/lib/web-gratis/server";

export const maxDuration = 60;

/** Obvious-bot ceiling only (shared carrier IPs) — see draft route. */
const HARD_PER_IP_PER_HOUR = 1000;

/** "¿Quién le recomendó?" answered with a referral code (e.g. "K7M2QX") → a real referral. */
function codeInText(text: string | null): string | null {
  if (!text) return null;
  const token = text
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .find((t) => REFERRAL_CODE_RE.test(t));
  return token ?? null;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid");
  }

  const parsed = submitRequestSchema.safeParse(body);
  if (!parsed.success) return fail(400, validationErrorCode(parsed.error));
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
    country: countryFromE164(whatsapp),
    lang: req.lang,
    services,
    differentiator: req.fields.differentiator ?? null,
    hours: req.fields.hours ?? null,
    instagram: req.fields.instagram ?? null,
    facebook: req.fields.facebook ?? null,
    style: req.fields.style ?? null,
    site_goal: req.fields.siteGoal ?? null,
    referred_by_text: req.fields.referredBy ?? null,
    existing_website: req.fields.existingWebsite ?? null,
    address: req.fields.address ?? null,
    contact_email: req.fields.contactEmail ?? null,
    extra_notes: req.fields.extraNotes ?? null,
  };

  try {
    const db = getDb();

    // Attach only files the user kept AND that really landed in this draft's folder
    // with a content type their kind accepts. If storage can't be listed right now,
    // keep the client's paths rather than silently dropping every file:
    // sortUploadPaths still confines them to this draft's folder and to
    // well-formed "<kind>-<ts>-<rand>.<ext>" names.
    const listed = await tryListDraftObjects(req.draftId);
    const stored = listed ? new Map(listed.map((o) => [o.path, o.mimetype])) : null;
    const formUploads = sortUploadPaths(
      req.draftId,
      stored
        ? req.uploadPaths.filter((p) => stored.has(p) && storedTypeFitsKind(p, stored.get(p) ?? null))
        : req.uploadPaths,
    );

    const { data: existing, error: readError } = await db
      .from(SIGNUPS_TABLE)
      .select("id, status, referral_code, business_name, whatsapp_consent_at, referred_by_id, logo_paths, photo_paths, document_paths")
      .eq("id", req.draftId)
      .maybeSingle();
    if (readError) throw readError;

    const submission = {
      ...content,
      ...mergeWhatsappUploads(formUploads, existing),
      status: "nuevo",
      step: 3,
      submitted_at: now,
      terms_accepted_at: now,
      share_commitment_at: now,
    };
    // First consent wins: the step-1 timestamp/wording is kept; submit records one only if none exists.
    const firstConsent = { whatsapp_consent_at: now, whatsapp_consent_version: WHATSAPP_CONSENT_VERSION_SUBMIT };

    // A referral code typed into "¿Quién le recomendó?" counts when no ?ref= link did.
    const typedCode = codeInText(content.referred_by_text);
    const typedReferrer =
      typedCode && !(existing?.referred_by_id as string | null | undefined) ? await findReferrer(typedCode) : null;
    const typedReferral =
      typedReferrer && typedReferrer.whatsapp !== whatsapp && typedReferrer.id !== req.draftId
        ? { referred_by_id: typedReferrer.id }
        : {};

    let row: WebGratisSignup | null = null;

    if (existing) {
      if (existing.status !== "borrador") {
        return ok({ referralCode: existing.referral_code as string, businessName: existing.business_name as string });
      }
      const { data, error } = await db
        .from(SIGNUPS_TABLE)
        .update({ ...submission, ...(existing.whatsapp_consent_at ? {} : firstConsent), ...typedReferral })
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
    } else {
      // No draft on the server (step-1 save never landed, or a restored old draft).
      const hash = ipHash(request);
      if ((await recentDraftsFromIp(hash)) >= HARD_PER_IP_PER_HOUR) return fail(429, "rate_limited");
      const found = await findReferrer(req.attribution?.ref);
      const referrer = found && found.whatsapp !== whatsapp ? found : null;
      const a = req.attribution ?? {};
      for (let attempt = 0; attempt < 4 && !row; attempt++) {
        const { data, error } = await db
          .from(SIGNUPS_TABLE)
          .insert({
            id: req.draftId,
            ...submission,
            ...firstConsent,
            referral_code: newReferralCode(),
            referred_by_id: referrer?.id ?? (typedReferral.referred_by_id ?? null),
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
          // A concurrent request created this draft first — report whichever state won.
          const { data: winner } = await db.from(SIGNUPS_TABLE).select("referral_code, business_name").eq("id", req.draftId).single();
          if (winner) return ok({ referralCode: winner.referral_code as string, businessName: winner.business_name as string });
        }
        if (error) {
          if (isDuplicateBusiness(error)) return fail(409, "duplicate");
          throw error;
        }
        row = data as WebGratisSignup;
      }
      if (!row) throw new Error("referral code generation exhausted");
    }

    const saved = row;
    const queued = await enqueue("submitted", `submitted:${saved.id}`, saved.id);
    after(async () => {
      if (queued) {
        await drainIfQuiet().catch((error: unknown) =>
          console.error("[WebGratis:submit] drain after submit failed (cron will retry)", error),
        );
      } else {
        await notifySaveFailed(
          {
            negocio: saved.business_name,
            rubro: saved.business_type,
            ciudad: saved.city,
            pais: saved.country,
            whatsapp: saved.whatsapp,
            servicios: saved.services.join(", "),
            archivos: `logo ${saved.logo_paths.length} · fotos ${saved.photo_paths.length} · documentos ${(saved.document_paths ?? []).length}`,
            draft: saved.id,
          },
          "La solicitud SÍ se guardó, pero la alerta no pudo entrar a la cola. Revise el tablero.",
        );
      }
      await sendCapiEvent({
        eventName: "CompleteRegistration",
        eventId: `${saved.id}-complete`,
        whatsapp: saved.whatsapp,
        externalId: saved.id,
        sourceUrl: saved.landing_url,
        fbclid: saved.fbclid,
        request,
      });
    });

    return ok({ referralCode: saved.referral_code, businessName: saved.business_name });
  } catch (error) {
    console.error("[WebGratis:submit]", error);
    if (req.attempt === undefined || req.attempt >= 2) {
      const reason = error instanceof Error ? error.message : JSON.stringify(error);
      after(() =>
        notifySaveFailed(
          {
            negocio: content.business_name,
            rubro: content.business_type,
            ciudad: content.city,
            pais: content.country,
            whatsapp: content.whatsapp,
            servicios: content.services.join(", "),
            horario: content.hours,
            instagram: content.instagram,
            facebook: content.facebook,
            web_actual: content.existing_website,
            direccion: content.address,
            email: content.contact_email,
            notas: content.extra_notes,
            archivos_enviados: req.uploadPaths.length,
            draft: req.draftId,
          },
          reason,
        ),
      );
    }
    return fail(500, "save_failed");
  }
}
