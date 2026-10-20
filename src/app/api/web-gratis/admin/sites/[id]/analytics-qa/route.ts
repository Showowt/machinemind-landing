/** Existing staff authentication; exact JA binding; bounded, aggregate-only GET. */
import { requireAdmin } from "@/lib/web-gratis/admin";
import { fail, ok } from "@/lib/web-gratis/http";
import { getSite } from "@/lib/web-gratis/sites/pipeline";
import { isJaAnalyticsBinding, isJaQaRunId, JA_ANALYTICS_SITE_ID } from "@/lib/web-gratis/sites/analytics-shared";
import { jaQaStatsFor } from "@/lib/web-gratis/sites/analytics-qa";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const { id } = await params;
  if (id !== JA_ANALYTICS_SITE_ID) return fail(404, "not_found");
  const runId = new URL(request.url).searchParams.get("runId") ?? "";
  if (!isJaQaRunId(runId)) return fail(400, "invalid", "Use un ID de prueba de 1–40 letras minúsculas, números o guiones.");
  try {
    const site = await getSite(id);
    if (!site || !isJaAnalyticsBinding(site.id, site.signup_id)) return fail(404, "not_found");
    return ok({ qa: await jaQaStatsFor(id, runId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    // Never turn a failed read into a successful zero or echo database details.
    return fail(500, "server_error", "No se pudieron consultar las métricas de prueba. No equivale a cero eventos.");
  }
}
