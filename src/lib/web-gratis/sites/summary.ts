/**
 * What the ops board shows about each signup's website (server only): the
 * site row without its content, links, the generator's notes and 30-day stats
 * (views + WhatsApp clicks from web_gratis_site_events).
 */
import { getDb } from "../server";
import { exportUrl, generatorEnv, mmSitesEnv, previewUrl, SITE_EVENTS_TABLE, SITES_TABLE, vercelEnv, type SiteRow } from "./db";
import { unreadFiles } from "./generate";
import { guardLines } from "./pipeline";
import { publicSiteUrl, type SiteStats, type SiteSummary, type SitesConfig } from "./shared";

/** Every column except the (large) content JSON. */
export const SUMMARY_COLUMNS =
  "id, signup_id, slug, status, version, instructions, preview_token, custom_domain, domain_status, sources, generation_error, generation_attempts, generation_lease_until, generated_at, published_at, paused_at, created_at, updated_at";

export function sitesConfig(): SitesConfig {
  return { generator: !!generatorEnv(), preview: !!mmSitesEnv(), vercel: !!vercelEnv() };
}

export function toSummary(row: Omit<SiteRow, "content">, stats: SiteStats | null, now: Date = new Date()): SiteSummary {
  const mm = mmSitesEnv();
  return {
    id: row.id,
    signupId: row.signup_id,
    slug: row.slug,
    status: row.status,
    version: row.version,
    generatingNow: row.status === "generating" && !!row.generation_lease_until && Date.parse(row.generation_lease_until) > now.getTime(),
    generationAttempts: row.generation_attempts,
    generationError: row.generation_error,
    instructions: row.instructions,
    generatedAt: row.generated_at,
    publishedAt: row.published_at,
    pausedAt: row.paused_at,
    updatedAt: row.updated_at,
    publicUrl: publicSiteUrl(row.slug),
    previewUrl: previewUrl(row.slug, row.preview_token, mm),
    exportUrl: row.version > 0 ? exportUrl(row.slug, row.preview_token, mm) : null,
    customDomain: row.custom_domain,
    domainStatus: row.domain_status,
    stats,
    notes: row.sources?.notes ?? null,
    unread: unreadFiles(row.sources ?? {}),
    guards: guardLines(row),
  };
}

async function countEvents(siteId: string, kind: "view" | "whatsapp_click", since: string): Promise<number> {
  const { count, error } = await getDb()
    .from(SITE_EVENTS_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("site_id", siteId)
    .eq("kind", kind)
    .gte("created_at", since);
  if (error) throw error;
  return count ?? 0;
}

export async function statsFor(siteId: string, now: Date = new Date()): Promise<SiteStats> {
  const since = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const [views30, whatsapp30] = await Promise.all([countEvents(siteId, "view", since), countEvents(siteId, "whatsapp_click", since)]);
  return { views30, whatsapp30 };
}

/** Site summaries keyed by signup id (signups without a site are absent). */
export async function siteSummaries(signupIds: string[]): Promise<Record<string, SiteSummary>> {
  if (!signupIds.length) return {};
  const { data, error } = await getDb().from(SITES_TABLE).select(SUMMARY_COLUMNS).in("signup_id", signupIds);
  if (error) throw error;
  const rows = (data ?? []) as unknown as Omit<SiteRow, "content">[];
  const now = new Date();
  const out: Record<string, SiteSummary> = {};
  await Promise.all(
    rows.map(async (row) => {
      let stats: SiteStats | null = null;
      if (row.published_at) {
        try {
          stats = await statsFor(row.id, now);
        } catch (statsError) {
          console.error("[Sites:summary] stats", row.id, statsError);
        }
      }
      out[row.signup_id] = toSummary(row, stats, now);
    }),
  );
  return out;
}
