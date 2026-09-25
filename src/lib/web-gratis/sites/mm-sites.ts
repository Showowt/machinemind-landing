/**
 * Talking to the multi-tenant renderer (mm-sites): cache purge after any
 * change that affects what a public site shows (publish, pause, edits, the
 * signup being paused / cancelled / reopened).
 *
 * POST <MM_SITES_URL>/api/revalidate  {slug}  x-revalidate-secret: <secret>
 */
import { getDb } from "../server";
import { mmSitesEnv, SITES_TABLE, type MmSitesEnv } from "./db";

export type RevalidateResult = { ok: true } | { ok: false; error: string };

export async function revalidateSite(
  slug: string,
  deps: { fetch?: typeof fetch; env?: MmSitesEnv | null } = {},
): Promise<RevalidateResult> {
  const mm = deps.env === undefined ? mmSitesEnv() : deps.env;
  if (!mm) return { ok: false, error: "MM_SITES_URL no está configurado" };
  if (!mm.revalidateSecret) return { ok: false, error: "MM_SITES_REVALIDATE_SECRET no está configurado" };
  const doFetch = deps.fetch ?? fetch;
  try {
    const res = await doFetch(`${mm.url}/api/revalidate`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-revalidate-secret": mm.revalidateSecret },
      body: JSON.stringify({ slug }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (res.ok) return { ok: true };
    return { ok: false, error: `mm-sites respondió ${res.status}` };
  } catch (error) {
    console.error("[Sites:revalidate]", slug, error);
    return { ok: false, error: `mm-sites no respondió (${error instanceof Error ? error.message : String(error)})` };
  }
}

/**
 * Purge a signup's site after its status changed (pausada / cancelada /
 * descartada / reopened): the renderer hides a site whose signup is closed, but
 * only once its cached page is purged. No-op when the signup has no live site.
 */
export async function revalidateSignupSite(signupId: string): Promise<void> {
  try {
    const { data, error } = await getDb()
      .from(SITES_TABLE)
      .select("slug, published_at")
      .eq("signup_id", signupId)
      .maybeSingle();
    if (error) throw error;
    if (!data?.published_at) return;
    const res = await revalidateSite(String(data.slug));
    if (!res.ok) console.error("[Sites:revalidate] signup status change", signupId, res.error);
  } catch (error) {
    console.error("[Sites:revalidate] signup status change", signupId, error);
  }
}
