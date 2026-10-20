/** Server-only, aggregate-only QA read. No visitor or raw event rows leave here. */
import { getDb } from "../server";
import { SITE_EVENTS_TABLE } from "./db";
import { JA_ANALYTICS_SITE_ID, JA_QA_PATH_PREFIX, isJaQaRunId, JA_QA_WINDOW_DAYS, SITE_EVENT_KINDS, type JaQaRunStats } from "./analytics-shared";

export async function jaQaStatsFor(siteId: string, runId: string, now = new Date()): Promise<JaQaRunStats> {
  if (siteId !== JA_ANALYTICS_SITE_ID || !isJaQaRunId(runId)) throw new Error("Invalid QA analytics scope");
  const observedAt = now.toISOString();
  const windowStart = new Date(now.getTime() - JA_QA_WINDOW_DAYS * 86_400_000).toISOString();
  const path = `${JA_QA_PATH_PREFIX}${runId}`;
  const scope = () => getDb().from(SITE_EVENTS_TABLE);
  const counts = await Promise.all(SITE_EVENT_KINDS.map(async (kind) => {
    const { count, error } = await scope().select("id", { count: "exact", head: true })
      .eq("site_id", siteId).eq("path", path).eq("kind", kind)
      .gte("created_at", windowStart).lte("created_at", observedAt);
    if (error) throw error;
    if (count === null || !Number.isSafeInteger(count) || count < 0) throw new Error("QA count unavailable");
    return [kind, count] as const;
  }));
  // At most one timestamp is returned internally; IDs/hash/IP/UA are never selected.
  const { data, error } = await scope().select("created_at")
    .eq("site_id", siteId).eq("path", path).in("kind", [...SITE_EVENT_KINDS])
    .gte("created_at", windowStart).lte("created_at", observedAt)
    .order("created_at", { ascending: false }).limit(1);
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error("QA latest event unavailable");
  const latest = data[0]?.created_at;
  if (latest !== undefined && (typeof latest !== "string" || !Number.isFinite(Date.parse(latest)))) throw new Error("Invalid QA timestamp");
  return {
    siteId: JA_ANALYTICS_SITE_ID, runId, synthetic: true, excludedFromBusinessTotals: true,
    windowStart, windowEnd: observedAt, observedAt,
    counts: Object.fromEntries(counts) as JaQaRunStats["counts"], latestAt: latest ?? null,
  };
}
