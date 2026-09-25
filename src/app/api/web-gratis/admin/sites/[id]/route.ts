/**
 * /api/web-gratis/admin/sites/:id — one website, for the board's editor.
 *
 * GET    → { site (summary), content, sources }
 * PATCH  → one of:
 *   { edits, expectedVersion }  quick edits (tagline, hero, about, services
 *                               name/description/price, palette primary/bg/text)
 *                               — Zod-validated against SiteContentV1, the
 *                               palette brought to WCAG AA, version + 1, the
 *                               live site's cache purged when published;
 *   { slug }                    change the subdomain (only before the first publish);
 *   { instructions }            save regeneration notes.
 * Bearer WEB_GRATIS_ADMIN_TOKEN.
 */
import { z } from "zod";
import { requireAdmin } from "@/lib/web-gratis/admin";
import { fail, ok } from "@/lib/web-gratis/http";
import { getSite } from "@/lib/web-gratis/sites/pipeline";
import { changeSlug, editSiteContent, saveInstructions } from "@/lib/web-gratis/sites/publish";
import { statsFor, toSummary } from "@/lib/web-gratis/sites/summary";

export const dynamic = "force-dynamic";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "color #rrggbb").transform((v) => v.toLowerCase());
const text = (max: number) => z.string().trim().min(1, "no puede quedar vacío").max(max, `máximo ${max} caracteres`);
const optText = (max: number) =>
  z
    .union([z.string().trim().max(max, `máximo ${max} caracteres`), z.null()])
    .transform((v) => (v ? v : null));

const editsSchema = z
  .object({
    tagline: text(120).optional(),
    heroHeadline: text(90).optional(),
    heroSubheadline: text(220).optional(),
    ctaLabel: text(40).optional(),
    about: z.array(text(600)).min(1).max(3).optional(),
    services: z
      .array(
        z.object({
          from: z.union([z.number().int().min(0).max(23), z.null()]),
          name: text(80),
          description: optText(240),
          price: optText(40),
        }),
      )
      .min(1)
      .max(24)
      .optional(),
    palette: z.object({ primary: hex.optional(), bg: hex.optional(), text: hex.optional() }).optional(),
  })
  .strict();

const patchSchema = z.union([
  z.object({ edits: editsSchema, expectedVersion: z.number().int().min(0) }).strict(),
  z.object({ slug: z.string().trim().min(1).max(60) }).strict(),
  z
    .object({ instructions: z.union([z.string().trim().max(2000), z.null()]) })
    .strict()
    .transform((v) => ({ instructions: v.instructions ? v.instructions : null })),
]);

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return fail(400, "invalid");
  try {
    const site = await getSite(id);
    if (!site) return fail(404, "not_found", "No existe esa web.");
    const stats = site.published_at ? await statsFor(site.id).catch(() => null) : null;
    return ok({ site: toSummary(site, stats), content: site.content, sources: site.sources });
  } catch (error) {
    console.error("[Sites:admin:get]", id, error);
    return fail(500, "server_error");
  }
}

export async function PATCH(request: Request, { params }: Params) {
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
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(400, "invalid", issue ? `Revise ${issue.path.join(".") || "los datos"}: ${issue.message}` : "Datos inválidos.");
  }
  const patch = parsed.data;
  const deps = { now: () => new Date(), fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init) };

  try {
    if ("edits" in patch) {
      const res = await editSiteContent(id, patch.edits, patch.expectedVersion, deps);
      if (!res.ok) return fail(res.status, res.code, res.message);
      const message = [`Guardado (v${res.site.version}).`, ...res.fixes.map((f) => `Ajustado: ${f}`), ...res.warnings].join(" ");
      return ok({ site: toSummary(res.site, null), content: res.site.content, fixes: res.fixes, message });
    }
    if ("slug" in patch) {
      const res = await changeSlug(id, patch.slug);
      if (!res.ok) return fail(res.status, res.code, res.message);
      return ok({ site: toSummary(res.site, null), message: `Dirección: ${toSummary(res.site, null).publicUrl}` });
    }
    const res = await saveInstructions(id, patch.instructions);
    if (!res.ok) return fail(res.status, res.code, res.message);
    return ok({ site: toSummary(res.site, null), message: "Instrucciones guardadas." });
  } catch (error) {
    console.error("[Sites:admin:patch]", id, error);
    return fail(500, "server_error", "No se pudo guardar. Intente de nuevo.");
  }
}
