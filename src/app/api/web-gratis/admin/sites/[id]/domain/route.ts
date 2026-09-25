/**
 * /api/web-gratis/admin/sites/:id/domain — "Dominio propio".
 *
 * POST   {domain}  attach the business's own domain to the mm-sites Vercel
 *                  project (same flow as the subdomain), store custom_domain +
 *                  domain_status (active | pending_dns | needs_verification)
 *                  and return the DNS records to add: A 76.76.21.21 for an apex,
 *                  CNAME cname.vercel-dns.com for a subdomain. Posting the same
 *                  domain again re-checks it.
 * DELETE           disconnect it.
 * Bearer WEB_GRATIS_ADMIN_TOKEN.
 */
import { z } from "zod";
import { requireAdmin } from "@/lib/web-gratis/admin";
import { fail, ok } from "@/lib/web-gratis/http";
import { vercelEnv } from "@/lib/web-gratis/sites/db";
import { removeCustomDomain, setCustomDomain } from "@/lib/web-gratis/sites/publish";
import { toSummary } from "@/lib/web-gratis/sites/summary";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({ domain: z.string().trim().min(4).max(253) });

type Params = { params: Promise<{ id: string }> };

const deps = () => ({ now: () => new Date(), fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init), vercel: vercelEnv() });

export async function POST(request: Request, { params }: Params) {
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
  if (!parsed.success) return fail(400, "invalid", "Escriba un dominio, por ejemplo mitienda.com");
  try {
    const res = await setCustomDomain(id, parsed.data.domain, deps());
    if (!res.ok) return fail(res.status, res.code, res.message);
    return ok({ site: toSummary(res.site, null), records: res.records, verification: res.verification, message: res.message });
  } catch (error) {
    console.error("[Sites:admin:domain]", id, error);
    return fail(500, "server_error", "No se pudo conectar el dominio. Intente de nuevo.");
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return fail(400, "invalid");
  try {
    const res = await removeCustomDomain(id, deps());
    if (!res.ok) return fail(res.status, res.code, res.message);
    return ok({ site: toSummary(res.site, null), message: "Dominio desconectado." });
  } catch (error) {
    console.error("[Sites:admin:domain:delete]", id, error);
    return fail(500, "server_error", "No se pudo desconectar. Intente de nuevo.");
  }
}
