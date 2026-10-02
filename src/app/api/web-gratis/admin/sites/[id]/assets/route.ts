/** Upload one reviewed public raster to an existing tenant, without publishing. */
import { z } from "zod";
import { requireAdmin } from "@/lib/web-gratis/admin";
import { fail, ok } from "@/lib/web-gratis/http";
import { parseSiteAssetUpload, uploadSiteAsset } from "@/lib/web-gratis/sites/assets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return fail(400, "invalid");
  try {
    const input = await parseSiteAssetUpload(request);
    if (!input.ok) return fail(input.status, input.code, input.message);
    const result = await uploadSiteAsset(id, input.expectedVersion, Buffer.from(await input.file.arrayBuffer()));
    if (!result.ok) return fail(result.status, result.code, result.message);
    return ok({ asset: result.asset, message: "Imagen guardada. Revise su enlace antes de incorporarla al contenido de la web." });
  } catch {
    // Do not log uploaded names, metadata, bytes or storage/provider errors.
    console.error("[Sites:admin:assets] upload failed", id);
    return fail(500, "server_error", "No se pudo guardar la imagen. Actualice antes de intentar de nuevo.");
  }
}
