/**
 * POST /api/web-gratis/admin/sites/:id/publish — "Publicar" on the board.
 *
 * Attaches <slug>.machinemindconsulting.com to the mm-sites Vercel project,
 * publishes the site, purges the renderer's cache, and marks the signup
 * delivered by calling the board's own PATCH /api/web-gratis/admin/signups/:id
 * handler ({status: "entregada", siteUrl}) with the same bearer token — the
 * exact path the "→ Entregada" button uses, so the free month starts and the
 * scheduler sends the "Web lista" WhatsApp (T2) ~10 minutes later.
 * If Vercel isn't configured or the DNS isn't in place, nothing is published
 * and the signup is not delivered (clear Spanish error for the board).
 * Bearer WEB_GRATIS_ADMIN_TOKEN.
 */
import { z } from "zod";
import { PATCH as patchSignup } from "@/app/api/web-gratis/admin/signups/[id]/route";
import { requireAdmin } from "@/lib/web-gratis/admin";
import { fail, ok } from "@/lib/web-gratis/http";
import { vercelEnv } from "@/lib/web-gratis/sites/db";
import { defaultSitesDeps } from "@/lib/web-gratis/sites/pipeline";
import { publishSite, type PublishDeps } from "@/lib/web-gratis/sites/publish";
import { toSummary } from "@/lib/web-gratis/sites/summary";

export const dynamic = "force-dynamic";
// Up to four Vercel calls (15 s timeout each) + the cache purge + the delivery PATCH: 60 s could
// cut the function off after the site went live but before the signup was marked delivered.
export const maxDuration = 120;

/** The board's "→ Entregada" handler, called in-process with the caller's own token. */
function boardDelivery(request: Request): PublishDeps["markDelivered"] {
  return async (signupId, body) => {
    try {
      const res = await patchSignup(
        new Request(new URL(`/api/web-gratis/admin/signups/${signupId}`, request.url), {
          method: "PATCH",
          headers: { "content-type": "application/json", authorization: request.headers.get("authorization") ?? "" },
          body: JSON.stringify(body),
        }),
        { params: Promise.resolve({ id: signupId }) },
      );
      if (res.ok) return { ok: true, message: "ok" };
      const json = (await res.json().catch(() => null)) as { message?: string | null; error?: string | null } | null;
      return { ok: false, message: json?.message ?? json?.error ?? `HTTP ${res.status}` };
    } catch (error) {
      console.error("[Sites:publish] delivery via board path failed", signupId, error);
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return fail(400, "invalid");
  const sites = defaultSitesDeps();
  try {
    const res = await publishSite(id, {
      now: sites.now,
      fetch: sites.fetch,
      vercel: vercelEnv(),
      alert: sites.alert,
      markDelivered: boardDelivery(request),
    });
    if (!res.ok) return fail(res.status, res.code, res.message);
    const message = [
      `Publicada: ${res.url}.`,
      res.delivered === "marked" ? "Marcada «Entregada»: «Web lista» sale sola por WhatsApp en ~10 min (7:00–20:59)." : null,
      res.delivered === "url_updated" ? "Link actualizado en la solicitud." : null,
      ...res.warnings,
    ]
      .filter(Boolean)
      .join(" ");
    return ok({ site: toSummary(res.site, null), url: res.url, delivered: res.delivered, warnings: res.warnings, message });
  } catch (error) {
    console.error("[Sites:admin:publish]", id, error);
    return fail(500, "server_error", "No se pudo publicar. Intente de nuevo.");
  }
}
