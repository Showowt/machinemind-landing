/**
 * POST /api/web-gratis/admin/sites/:id/state — {action: "pause" | "resume"}.
 * "Pausar sitio" hides a published site (status paused); "Reanudar" puts it
 * back online. Purges the renderer's cache either way. Bearer token.
 */
import { z } from "zod";
import { requireAdmin } from "@/lib/web-gratis/admin";
import { fail, ok } from "@/lib/web-gratis/http";
import { setSitePaused } from "@/lib/web-gratis/sites/publish";
import { toSummary } from "@/lib/web-gratis/sites/summary";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ action: z.enum(["pause", "resume"]) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return fail(400, "invalid");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid");
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return fail(400, "invalid", parsed.error.issues[0]?.message);
  try {
    const res = await setSitePaused(id, parsed.data.action === "pause", { now: () => new Date(), fetch: (input, init) => fetch(input, init) });
    if (!res.ok) return fail(res.status, res.code, res.message);
    const message = [parsed.data.action === "pause" ? "Web pausada (fuera de línea)." : "Web en línea de nuevo.", ...res.warnings].join(" ");
    return ok({ site: toSummary(res.site, null), message });
  } catch (error) {
    console.error("[Sites:admin:state]", id, error);
    return fail(500, "server_error", "No se pudo cambiar. Intente de nuevo.");
  }
}
