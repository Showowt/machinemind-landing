/**
 * PREVIEW-FIRST (Phil 2026-09-28): an automatic website preview for a chat lead who just said
 * yes — BEFORE they accept any terms — so the "¿le confirmo su solicitud?" comes with THEIR site
 * on screen instead of a paragraph of conditions (47 one-tap offers without it → 0 "sí").
 *
 *   Rewired  → POST /api/web-gratis/draft (public, attribution utm_medium=preview) → borrador row
 *   Rewired  → POST /api/web-gratis/preview {signupId} (signed) → requestChatPreview()
 *   this     → 202 + generate in the background (after()) → callback
 *   this     → POST {REWIRED_BASE_URL}/api/web-gratis/preview-ready (signed) {signupId, state, …}
 *   Rewired  → sends the preview link + terms to the lead; their "sí" submits the SAME draft id,
 *              so the borrador row becomes the signup and this draft site is reviewed + published
 *              on the board like any other (adoptChatPreviews moves it to en_construccion).
 *
 * The request is idempotent: asking again returns `ready` with the link once it exists (Rewired
 * polls as the safety net if the callback is lost). The site row is only ever 'draft' — never
 * 'generating', which the live cron would claim — with generation_lease_until as the in-progress
 * lock. A failed generation removes its version-0 row, so after a later "sí" the normal pipeline
 * still builds the site. Publishing stays blocked until the signup is submitted (publishBlocker),
 * and mm-sites refuses to export a never-published site (the link is sent before any terms).
 */
import { getDb, SIGNUPS_TABLE, type WebGratisSignup } from "../server";
import { BRIDGE_SIGNATURE_HEADER, bridgeSecret, signBridgeBody } from "../bridge-auth";
import { rewiredBaseUrl } from "../rewired";
import { generatorEnv, previewUrl, SITES_TABLE, type SiteRow } from "./db";
import { GenerationError, generateSite } from "./generate";
import { getSignup, siteForSignup, slugTaken } from "./pipeline";
import { allocateSlug } from "./slug";

const LOG = "[Sites:chat-preview]";
/** The attribution medium Rewired sets on the drafts it creates for a preview. */
export const PREVIEW_MEDIUM = "preview";
/** In-progress lock; longer than the job budget so a live job never loses it. */
const LEASE_MS = 330_000;
/** Wall-clock budget for one generation (the route's maxDuration is 300 s). */
const JOB_BUDGET_MS = 270_000;
const CALLBACK_PATH = "/api/web-gratis/preview-ready";

export type ChatPreviewState = "ready" | "started" | "generating";

export type ChatPreviewRequest =
  | { kind: "ok"; status: 200 | 202; state: ChatPreviewState; slug: string; previewUrl: string; job: SiteRow | null }
  | { kind: "refused"; status: 404 | 409 | 503; error: "not_found" | "not_eligible" | "not_configured"; message: string };

const iso = (d: Date) => d.toISOString();

/** A draft Rewired created for a chat preview (never a form the lead is filling themselves). */
export function isChatPreviewSignup(signup: Pick<WebGratisSignup, "utm_medium">): boolean {
  return signup.utm_medium === PREVIEW_MEDIUM;
}

function hasContent(site: SiteRow): boolean {
  return site.version > 0 && !!site.content && site.status !== "archived";
}

/**
 * Decide what to do for a preview request and take the in-progress lock when a generation must
 * start. `job` (non-null only when this call took the lock) is what the caller runs after the
 * response. Never generates by itself.
 */
export async function requestChatPreview(signupId: string, now: Date = new Date()): Promise<ChatPreviewRequest> {
  const signup = await getSignup(signupId);
  if (!signup) return { kind: "refused", status: 404, error: "not_found", message: "No existe esa solicitud." };
  if (!isChatPreviewSignup(signup)) {
    return { kind: "refused", status: 409, error: "not_eligible", message: "No es un borrador de vista previa por chat." };
  }

  let site = await siteForSignup(signup.id);
  const link = (s: SiteRow) => previewUrl(s.slug, s.preview_token);

  // Ready (also after the lead submitted: a late poll still gets its link).
  if (site && hasContent(site)) {
    const url = link(site);
    if (!url) return { kind: "refused", status: 503, error: "not_configured", message: "MM_SITES_URL no está configurado." };
    return { kind: "ok", status: 200, state: "ready", slug: site.slug, previewUrl: url, job: null };
  }
  if (site && site.status !== "draft") {
    // generating / failed / published / paused / archived without content: the board owns it now.
    return { kind: "refused", status: 409, error: "not_eligible", message: `La web está ${site.status}.` };
  }
  if (signup.status !== "borrador") {
    return { kind: "refused", status: 409, error: "not_eligible", message: `La solicitud está ${signup.status}.` };
  }
  if (!generatorEnv()) return { kind: "refused", status: 503, error: "not_configured", message: "Falta ANTHROPIC_API_KEY." };

  const db = getDb();
  const leaseUntil = iso(new Date(now.getTime() + LEASE_MS));

  if (site) {
    // A version-0 draft: generating right now (lease) → just report; a dead attempt → take it over.
    if (site.generation_lease_until && Date.parse(site.generation_lease_until) > now.getTime()) {
      const url = link(site);
      if (!url) return { kind: "refused", status: 503, error: "not_configured", message: "MM_SITES_URL no está configurado." };
      return { kind: "ok", status: 202, state: "generating", slug: site.slug, previewUrl: url, job: null };
    }
    const { data, error } = await db
      .from(SITES_TABLE)
      .update({ generation_lease_until: leaseUntil, generation_error: null })
      .eq("id", site.id)
      .eq("status", "draft")
      .eq("version", 0)
      .or(`generation_lease_until.is.null,generation_lease_until.lt.${iso(now)}`)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    const url = link(site);
    if (!url) return { kind: "refused", status: 503, error: "not_configured", message: "MM_SITES_URL no está configurado." };
    return data
      ? { kind: "ok", status: 202, state: "started", slug: site.slug, previewUrl: url, job: data as SiteRow }
      : { kind: "ok", status: 202, state: "generating", slug: site.slug, previewUrl: url, job: null };
  }

  // New row: 'draft' + lease from the start (a 'generating' row would be claimed by the live cron).
  for (let attempt = 0; attempt < 6 && !site; attempt++) {
    const candidate = await allocateSlug(
      { businessName: signup.business_name, businessType: signup.business_type, city: signup.city, code: signup.referral_code },
      (s: string) => slugTaken(s),
    );
    const { data, error } = await db
      .from(SITES_TABLE)
      .insert({ signup_id: signup.id, slug: candidate, status: "draft", version: 0, generation_lease_until: leaseUntil })
      .select("*")
      .single();
    if (!error) {
      const created = data as SiteRow;
      const url = link(created);
      if (!url) {
        await db.from(SITES_TABLE).delete().eq("id", created.id).eq("version", 0);
        return { kind: "refused", status: 503, error: "not_configured", message: "MM_SITES_URL no está configurado." };
      }
      return { kind: "ok", status: 202, state: "started", slug: created.slug, previewUrl: url, job: created };
    }
    if (error.code !== "23505") throw error;
    // Slug taken, or a concurrent request created this signup's row (UNIQUE signup_id) — re-read.
    site = await siteForSignup(signup.id);
    if (site) {
      const url = link(site);
      if (!url) return { kind: "refused", status: 503, error: "not_configured", message: "MM_SITES_URL no está configurado." };
      return { kind: "ok", status: 202, state: hasContent(site) ? "ready" : "generating", slug: site.slug, previewUrl: url, job: null };
    }
  }
  throw new Error("No se pudo reservar una dirección para la web.");
}

export interface PreviewCallback {
  signupId: string;
  state: "ready" | "failed";
  slug: string;
  previewUrl: string | null;
  error: string | null;
}

/** Tell Rewired the outcome. Retries 3× (it also polls, so a lost callback only delays). */
export async function notifyRewired(body: PreviewCallback, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const base = rewiredBaseUrl();
  const secret = bridgeSecret();
  if (!base || !secret) {
    console.error(LOG, "REWIRED_BASE_URL / WEB_GRATIS_BRIDGE_SECRET not configured — callback skipped", body.signupId);
    return false;
  }
  const raw = JSON.stringify(body);
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, attempt * 2000));
    try {
      const res = await fetchImpl(`${base}${CALLBACK_PATH}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", [BRIDGE_SIGNATURE_HEADER]: signBridgeBody(secret, raw) },
        body: raw,
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) return true;
      if (res.status < 500) {
        console.error(LOG, "callback rejected", res.status, body.signupId);
        return false;
      }
    } catch (error) {
      console.error(LOG, "callback failed", attempt, body.signupId, error);
    }
  }
  return false;
}

/**
 * Generate the preview this process holds the lock on, save it, and call Rewired back. Never
 * throws. A failure removes the version-0 row (so the normal pipeline can still build the site
 * after a later "sí") and reports `failed` — Rewired then sends the plain offer instead.
 */
export async function runChatPreviewJob(site: SiteRow, deps: { fetch: typeof fetch; now: () => Date } = { fetch, now: () => new Date() }): Promise<PreviewCallback> {
  const db = getDb();
  const url = previewUrl(site.slug, site.preview_token);
  let outcome: PreviewCallback;
  try {
    const signup = await getSignup(site.signup_id);
    if (!signup || !isChatPreviewSignup(signup)) throw new GenerationError("La solicitud ya no es una vista previa por chat.", false);
    if (["cancelada", "descartada"].includes(signup.status)) throw new GenerationError(`La solicitud está ${signup.status}.`, false);
    const gen = generatorEnv();
    if (!gen) throw new GenerationError("Falta ANTHROPIC_API_KEY en el servidor.", false);
    const result = await generateSite(
      { signup, slug: site.slug, instructions: null, dryRun: false, placeImagery: true },
      { fetch: deps.fetch, apiKey: gen.apiKey, model: gen.model, now: deps.now, deadline: Date.now() + JOB_BUDGET_MS },
    );
    const { data, error } = await db
      .from(SITES_TABLE)
      .update({
        status: "draft",
        content: result.content,
        version: site.version + 1,
        generated_at: iso(deps.now()),
        generation_error: null,
        generation_lease_until: null,
        sources: result.sources,
      })
      .eq("id", site.id)
      .eq("version", site.version)
      .eq("status", "draft")
      .select("slug")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new GenerationError("La web cambió mientras se generaba (tablero).", false);
    outcome = { signupId: site.signup_id, state: "ready", slug: site.slug, previewUrl: url, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(LOG, "failed", site.slug, error);
    const { error: delError } = await db.from(SITES_TABLE).delete().eq("id", site.id).eq("version", 0);
    if (delError) console.error(LOG, "could not remove the version-0 row", site.id, delError);
    outcome = { signupId: site.signup_id, state: "failed", slug: site.slug, previewUrl: null, error: message.slice(0, 300) };
  }
  await notifyRewired(outcome, deps.fetch);
  return outcome;
}

/**
 * A chat preview whose lead said "sí" (the SAME draft id was submitted): the signup is 'nuevo'
 * with a finished draft site that no pipeline job produced — so nothing moved it to
 * en_construccion or raised "WEB LISTA PARA REVISAR". Returns the adopted signups (the caller
 * alerts). Idempotent: compare-and-set on status 'nuevo'.
 */
export async function adoptChatPreviews(): Promise<Array<{ signup: WebGratisSignup; site: SiteRow }>> {
  const db = getDb();
  const { data, error } = await db
    .from(SIGNUPS_TABLE)
    .select(`*, ${SITES_TABLE}(*)`)
    .eq("status", "nuevo")
    .eq("utm_medium", PREVIEW_MEDIUM)
    .not("submitted_at", "is", null)
    .not("business_name", "like", "ZZ %")
    .limit(25);
  if (error) throw error;
  const adopted: Array<{ signup: WebGratisSignup; site: SiteRow }> = [];
  for (const row of (data ?? []) as unknown as Array<Record<string, unknown>>) {
    const embedded = row[SITES_TABLE];
    const site = (Array.isArray(embedded) ? embedded[0] : embedded) as SiteRow | null | undefined;
    if (!site || site.status !== "draft" || !hasContent(site)) continue;
    const { data: moved, error: moveError } = await db
      .from(SIGNUPS_TABLE)
      .update({ status: "en_construccion" })
      .eq("id", row.id as string)
      .eq("status", "nuevo")
      .select("id");
    if (moveError) {
      console.error(LOG, "adopt failed", row.id, moveError);
      continue;
    }
    if (!moved?.length) continue;
    const signup = { ...row } as Record<string, unknown>;
    delete signup[SITES_TABLE];
    adopted.push({ signup: signup as unknown as WebGratisSignup, site });
  }
  return adopted;
}
