/** Authenticated replacement of one existing site's reviewed public content. */
import { z } from "zod";
import { requireAdmin } from "@/lib/web-gratis/admin";
import { fail, ok } from "@/lib/web-gratis/http";
import { importSiteContent } from "@/lib/web-gratis/sites/import";
import { toSummary } from "@/lib/web-gratis/sites/summary";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return fail(400, "invalid");
  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 256_000) return fail(413, "invalid", "El contenido supera el tamaño permitido.");
    body = JSON.parse(raw);
  } catch {
    return fail(400, "invalid", "JSON inválido.");
  }
  try {
    const result = await importSiteContent(id, body, {
      now: () => new Date(),
      fetch: (input, init) => fetch(input, init),
    });
    if (!result.ok) return fail(result.status, result.code, result.message);
    return ok({
      site: toSummary(result.site, null),
      content: result.site.content,
      warnings: result.warnings,
      message: [`Contenido importado (v${result.site.version}).`, ...result.warnings].join(" "),
    });
  } catch (error) {
    console.error("[Sites:admin:content]", id, error);
    return fail(500, "server_error", "No se pudo importar el contenido. Actualice antes de intentar de nuevo.");
  }
}
