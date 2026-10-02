/** Reviewed content only: no generation, uploads, signup changes or delivery. */
import { z } from "zod";
import { getDb } from "../server";
import { siteContentSchema, type SiteContentV1, type SiteImage } from "../site-content";
import { PUBLIC_BUCKET, SITES_TABLE, type MmSitesEnv, type SiteRow } from "./db";
import { revalidateSite } from "./mm-sites";
import type { ActionResult } from "./publish";

/** The shared renderer schema strips extra keys; an import must reject them. */
function unexpectedKey(input: unknown, parsed: unknown, path: (string | number)[] = []): (string | number)[] | null {
  if (Array.isArray(input) && Array.isArray(parsed)) {
    for (let i = 0; i < input.length; i++) {
      const extra = unexpectedKey(input[i], parsed[i], [...path, i]);
      if (extra) return extra;
    }
  } else if (input && parsed && typeof input === "object" && typeof parsed === "object") {
    for (const key of Object.keys(input)) {
      if (!Object.hasOwn(parsed, key)) return [...path, key];
      const extra = unexpectedKey((input as Record<string, unknown>)[key], (parsed as Record<string, unknown>)[key], [...path, key]);
      if (extra) return extra;
    }
  }
  return null;
}

export const reviewedSiteContentSchema = z.unknown().transform((input, ctx) => {
  const parsed = siteContentSchema.safeParse(input);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) ctx.addIssue({ code: "custom", path: issue.path, message: issue.message });
    return z.NEVER;
  }
  const extra = unexpectedKey(input, parsed.data);
  if (extra) {
    ctx.addIssue({ code: "custom", path: extra, message: "Campo no permitido en el contenido público." });
    return z.NEVER;
  }
  return parsed.data;
});

export const siteContentImportSchema = z.object({
  content: reviewedSiteContentSchema,
  expectedVersion: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1),
}).strict();

export interface ImportSiteContentDeps {
  now: () => Date;
  fetch: typeof fetch;
  mm?: MmSitesEnv | null;
  /** Public origin, not a credential. Undefined uses the existing configured origin. */
  publicStorageUrl?: string | null;
}

function publicHttpsUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

/** No signed/private/remote URLs, query credentials or another tenant's images. */
export function isTenantPublicImage(src: string, slug: string, storageUrl: string | null | undefined): boolean {
  const base = storageUrl ? publicHttpsUrl(storageUrl) : null;
  const url = publicHttpsUrl(src);
  if (!base || !url || base.pathname !== "/" || base.search || base.hash) return false;
  if (url.origin !== base.origin || src.includes("?") || src.includes("#") || src !== url.href) return false;
  const prefix = `/storage/v1/object/public/${PUBLIC_BUCKET}/${slug}/`;
  if (!url.pathname.startsWith(prefix)) return false;
  // The existing generator stores flat filenames under the slug. Reject path
  // traversal and encoded delimiters rather than letting storage reinterpret them.
  return /^[a-zA-Z0-9_-][a-zA-Z0-9._-]*\.(?:jpe?g|png|webp|gif|avif|svg)$/i.test(url.pathname.slice(prefix.length));
}

function contentUrlProblem(content: SiteContentV1, slug: string, storageUrl: string | null | undefined): string | null {
  const images: [string, SiteImage | null][] = [
    ["theme.logo", content.theme.logo], ["hero.image", content.hero.image],
    ...content.services.items.map((item, i): [string, SiteImage | null] => [`services.items.${i}.image`, item.image]),
    ...content.gallery.map((image, i): [string, SiteImage | null] => [`gallery.${i}`, image]),
  ];
  for (const [path, image] of images) {
    if (image && !isTenantPublicImage(image.src, slug, storageUrl)) {
      return `${path}.src: use una imagen pública guardada en ${PUBLIC_BUCKET}/${slug}/, sin enlaces privados ni parámetros.`;
    }
    if (image?.credit && !publicHttpsUrl(image.credit.url)) return `${path}.credit.url: use un enlace HTTPS público sin credenciales.`;
  }
  const links = [content.location?.mapsUrl, content.contact.instagram, content.contact.facebook, content.contact.website, content.footer.referralUrl];
  if (links.some((url) => url && !publicHttpsUrl(url))) return "Los enlaces del sitio deben ser HTTPS y no incluir credenciales.";
  return null;
}

export async function importSiteContent(
  siteId: string,
  input: unknown,
  deps: ImportSiteContentDeps,
): Promise<ActionResult<{ site: SiteRow; warnings: string[] }>> {
  if (!z.uuid().safeParse(siteId).success) return { ok: false, status: 400, code: "invalid", message: "Identificador de web inválido." };
  const parsed = siteContentImportSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, status: 400, code: "invalid", message: `Revise ${issue?.path.join(".") || "los datos"}: ${issue?.message || "Datos inválidos."}` };
  }
  const { content, expectedVersion } = parsed.data;
  const db = getDb();
  const { data: stored, error: readError } = await db.from(SITES_TABLE).select("*").eq("id", siteId).maybeSingle();
  if (readError) throw readError;
  if (!stored) return { ok: false, status: 404, code: "not_found", message: "No existe esa web." };
  const site = stored as SiteRow;
  if (!["draft", "paused", "published"].includes(site.status)) {
    return { ok: false, status: 409, code: "not_eligible", message: "Solo puede importar contenido en una web lista para revisar, pausada o publicada." };
  }
  if (site.version !== expectedVersion) {
    return { ok: false, status: 409, code: "not_eligible", message: `La web cambió (ahora v${site.version}): actualice y vuelva a revisar el contenido.` };
  }
  const storageUrl = deps.publicStorageUrl === undefined ? process.env.NEXT_PUBLIC_SUPABASE_URL : deps.publicStorageUrl;
  const problem = contentUrlProblem(content, site.slug, storageUrl);
  if (problem) return { ok: false, status: 400, code: "invalid", message: problem };

  const { data, error } = await db.from(SITES_TABLE).update({
    content,
    version: expectedVersion + 1,
    sources: { ...(site.sources ?? {}), lastEdit: { at: deps.now().toISOString(), fields: ["content"] } },
  })
    .eq("id", site.id)
    .eq("signup_id", site.signup_id)
    .eq("version", expectedVersion)
    .eq("status", site.status)
    .eq("slug", site.slug)
    // Sources are merged from this snapshot; preserve same-version changes to
    // notes/instructions or other metadata made while the import was validating.
    .eq("updated_at", site.updated_at)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, status: 409, code: "not_eligible", message: "La web cambió mientras tanto: actualice y vuelva a revisar el contenido." };
  const warnings: string[] = [];
  if (site.status === "published") {
    const refresh = await revalidateSite(site.slug, { fetch: deps.fetch, env: deps.mm });
    if (!refresh.ok) warnings.push(`Contenido guardado; no se pudo refrescar la caché (${refresh.error}). Se actualiza sola en unos minutos.`);
  }
  return { ok: true, site: data as SiteRow, warnings };
}
