/**
 * Publishing and editing client sites from the ops board (server only).
 *
 * Publish = validate the content → attach <slug>.machinemindconsulting.com to
 * the mm-sites Vercel project (DNS must already point there: the wildcard
 * CNAME at GoDaddy) → status 'published' → purge the renderer's cache → mark
 * the signup delivered through the board's own "→ Entregada" code path (which
 * is what makes the scheduler send the "Web lista" WhatsApp) → alert.
 * If Vercel isn't configured or the hostname can't serve yet, nothing is
 * published and the signup is NOT delivered: the client is never told about a
 * site that doesn't load.
 */
import { siteContentSchema, SITES_ROOT_DOMAIN, type SiteContentV1 } from "../site-content";
import { countryLabel, sitePublishedMessage } from "../notify";
import { BUILDING_STATUSES, getDb } from "../server";
import type { ServerErrorCode, WebGratisErrorCode } from "../schema";
import { fixPalette } from "./contrast";
import { missingVercelEnv, previewUrl, SITES_TABLE, type MmSitesEnv, type SiteRow, type VercelEnv } from "./db";
import { revalidateSite } from "./mm-sites";
import { getSignup, getSite, slugTaken, type SitesDeps } from "./pipeline";
import { dnsRecordsFor, normalizeDomain, publicSiteUrl, slugProblem, type DnsRecord, type SiteQuickEdits } from "./shared";
import { attachDomain, detachDomain, type DomainVerification } from "./vercel";

type ErrorCode = ServerErrorCode | WebGratisErrorCode;

export type ActionResult<T> = ({ ok: true } & T) | { ok: false; status: number; code: ErrorCode; message: string };

export interface PublishDeps {
  now: () => Date;
  fetch: typeof fetch;
  vercel: VercelEnv | null;
  /** mm-sites for cache purges (undefined = read from env). */
  mm?: MmSitesEnv | null;
  alert: SitesDeps["alert"];
  /**
   * Mark the signup delivered / update its site link through the board's own
   * PATCH /api/web-gratis/admin/signups/:id (the path "→ Entregada" uses).
   */
  markDelivered: (signupId: string, body: { status?: "entregada"; siteUrl: string }) => Promise<{ ok: boolean; message: string }>;
}

/**
 * A preview can be generated for a lead who hasn't finished the form (scripts/sites/generate-preview.mts),
 * but nothing goes live until they submit it and accept the terms.
 */
export const NOT_SUBMITTED_MESSAGE =
  "Este cliente aún no terminó su registro (no aceptó los términos). Envíele la vista previa y pídale terminar el formulario.";

const CLOSED_FOR_PUBLISH: Record<string, string> = {
  borrador: NOT_SUBMITTED_MESSAGE,
  descartada: "La solicitud está descartada.",
  cancelada: "La solicitud está cancelada.",
  pausada: "La solicitud está pausada (no pagó): reábrala en su tarjeta antes de publicar.",
};

/** Why this signup's site can't go live, or null. */
export function publishBlocker(signup: { status: string; terms_accepted_at: string | null }): string | null {
  if (signup.status === "borrador" || !signup.terms_accepted_at) return NOT_SUBMITTED_MESSAGE;
  return CLOSED_FOR_PUBLISH[signup.status] ?? null;
}

const DNS_MISSING =
  "Falta el registro DNS comodín *.machinemindconsulting.com en GoDaddy (CNAME * → cname.vercel-dns.com). La dirección ya quedó agregada en Vercel: publique de nuevo cuando el DNS esté listo. No se le avisó al cliente.";

function verificationText(v: DomainVerification[]): string {
  return v.length ? v.map((r) => `${r.type} ${r.domain} = ${r.value}`).join(" · ") : "revise el dominio en Vercel";
}

async function revalidate(slug: string, deps: { fetch: typeof fetch; mm?: MmSitesEnv | null }): Promise<string | null> {
  const res = await revalidateSite(slug, { fetch: deps.fetch, env: deps.mm });
  return res.ok ? null : `No se pudo refrescar la caché de la web (${res.error}); se actualiza sola en unos minutos.`;
}

function vercelMissing(): ActionResult<never> {
  return {
    ok: false,
    status: 503,
    code: "not_configured",
    message: `Falta configurar Vercel en el servidor (${missingVercelEnv().join(", ")}). No se publicó nada.`,
  };
}

// ─── Publish ────────────────────────────────────────────────────────────────

export async function publishSite(
  siteId: string,
  deps: PublishDeps,
): Promise<ActionResult<{ site: SiteRow; url: string; delivered: "marked" | "already" | "url_updated" | "failed"; warnings: string[] }>> {
  const site = await getSite(siteId);
  if (!site) return { ok: false, status: 404, code: "not_found", message: "No existe esa web." };
  if (site.status === "generating") return { ok: false, status: 409, code: "not_eligible", message: "Se está generando: espere a que termine." };
  if (!["draft", "paused", "published"].includes(site.status)) {
    return { ok: false, status: 409, code: "not_eligible", message: "Genere la web primero (está en estado «falló» o archivada)." };
  }
  const parsed = siteContentSchema.safeParse(site.content);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, status: 409, code: "invalid", message: `El contenido no es válido (${first?.path.join(".")}: ${first?.message}). Regenérela o corríjala.` };
  }
  const signup = await getSignup(site.signup_id);
  if (!signup) return { ok: false, status: 404, code: "not_found", message: "La solicitud ya no existe." };
  const blocked = publishBlocker(signup);
  if (blocked) return { ok: false, status: 409, code: "not_eligible", message: blocked };
  if (!deps.vercel) return vercelMissing();

  const host = `${site.slug}.${SITES_ROOT_DOMAIN}`;
  const url = publicSiteUrl(site.slug);
  const attach = await attachDomain(host, { fetch: deps.fetch, env: deps.vercel });
  if (!attach.ok) return { ok: false, status: 502, code: "send_failed", message: `${attach.message} No se publicó ni se le avisó al cliente.` };
  if (!attach.configChecked) {
    return {
      ok: false,
      status: 502,
      code: "send_failed",
      message: `Vercel no dejó comprobar el DNS de ${host} (respuesta ${attach.configStatus || "sin conexión"}): revise que VERCEL_TOKEN tenga acceso a los dominios del equipo. No se publicó ni se le avisó al cliente.`,
    };
  }
  if (attach.misconfigured) return { ok: false, status: 409, code: "send_failed", message: DNS_MISSING };
  if (!attach.verified) {
    return {
      ok: false,
      status: 409,
      code: "send_failed",
      message: `Vercel pide verificar ${host} antes de servirla (${verificationText(attach.verification)}). No se publicó.`,
    };
  }

  const nowIso = deps.now().toISOString();
  const { data: published, error } = await getDb()
    .from(SITES_TABLE)
    .update({ status: "published", published_at: site.published_at ?? nowIso, paused_at: null })
    .eq("id", site.id)
    .in("status", ["draft", "paused", "published"])
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!published) return { ok: false, status: 409, code: "not_eligible", message: "La web cambió mientras tanto: actualice e intente de nuevo." };
  const live = published as SiteRow;

  const warnings: string[] = [];
  const cacheWarning = await revalidate(live.slug, deps);
  if (cacheWarning) warnings.push(cacheWarning);

  // Deliver through the board's own path (it starts the free month and the "Web lista" WhatsApp).
  let delivered: "marked" | "already" | "url_updated" | "failed" = "already";
  if (BUILDING_STATUSES.includes(signup.status)) {
    const res = await deps.markDelivered(signup.id, { status: "entregada", siteUrl: url });
    delivered = res.ok ? "marked" : "failed";
    if (!res.ok) warnings.push(`La web está en línea, pero no se pudo marcar «Entregada» (${res.message}): hágalo desde la tarjeta con el link ${url}.`);
  } else if ((signup.site_url ?? "").replace(/\/$/, "") !== url) {
    const res = await deps.markDelivered(signup.id, { siteUrl: url });
    delivered = res.ok ? "url_updated" : "failed";
    if (!res.ok) warnings.push(`No se pudo guardar el link en la solicitud (${res.message}).`);
  }

  const message = sitePublishedMessage({
    business: signup.business_name,
    city: signup.city,
    whatsapp: signup.whatsapp,
    country: countryLabel(signup),
    slug: live.slug,
    version: live.version,
    previewUrl: previewUrl(live.slug, live.preview_token),
    publicUrl: url,
    warnings,
  });
  await deps.alert("site_published", `published:${live.id}:${nowIso.slice(0, 13)}`, signup.id, message).catch((alertError: unknown) => {
    console.error("[Sites:publish] alert failed", live.id, alertError);
    return false;
  });
  return { ok: true, site: live, url, delivered, warnings };
}

// ─── Pause / resume ─────────────────────────────────────────────────────────

export async function setSitePaused(
  siteId: string,
  paused: boolean,
  deps: Pick<PublishDeps, "now" | "fetch" | "mm">,
): Promise<ActionResult<{ site: SiteRow; warnings: string[] }>> {
  const site = await getSite(siteId);
  if (!site) return { ok: false, status: 404, code: "not_found", message: "No existe esa web." };
  if (paused && site.status !== "published") return { ok: false, status: 409, code: "not_eligible", message: "Solo se pausa una web publicada." };
  if (!paused) {
    if (site.status !== "paused") return { ok: false, status: 409, code: "not_eligible", message: "La web no está pausada." };
    if (!site.published_at) return { ok: false, status: 409, code: "not_eligible", message: "Nunca se publicó: use «Publicar»." };
    const signup = await getSignup(site.signup_id);
    const closed = signup ? publishBlocker(signup) : "La solicitud ya no existe.";
    if (closed) return { ok: false, status: 409, code: "not_eligible", message: closed };
  }
  const { data, error } = await getDb()
    .from(SITES_TABLE)
    .update(paused ? { status: "paused", paused_at: deps.now().toISOString() } : { status: "published", paused_at: null })
    .eq("id", site.id)
    .eq("status", paused ? "published" : "paused")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, status: 409, code: "not_eligible", message: "La web cambió mientras tanto: actualice e intente de nuevo." };
  const warning = await revalidate(site.slug, deps);
  return { ok: true, site: data as SiteRow, warnings: warning ? [warning] : [] };
}

// ─── Custom domain ──────────────────────────────────────────────────────────

export async function setCustomDomain(
  siteId: string,
  raw: string,
  deps: Pick<PublishDeps, "now" | "fetch" | "vercel" | "mm">,
): Promise<ActionResult<{ site: SiteRow; records: DnsRecord[]; verification: DomainVerification[]; message: string }>> {
  const domain = normalizeDomain(raw);
  if (!domain) return { ok: false, status: 400, code: "invalid", message: "Dominio inválido. Ejemplo: mitienda.com o www.mitienda.com.sv" };
  const site = await getSite(siteId);
  if (!site) return { ok: false, status: 404, code: "not_found", message: "No existe esa web." };
  const { count, error: takenError } = await getDb().from(SITES_TABLE).select("id", { count: "exact", head: true }).eq("custom_domain", domain).neq("id", site.id);
  if (takenError) throw takenError;
  if ((count ?? 0) > 0) return { ok: false, status: 409, code: "duplicate", message: "Ese dominio ya está conectado a otra web." };
  if (!deps.vercel) return vercelMissing();

  const attach = await attachDomain(domain, { fetch: deps.fetch, env: deps.vercel });
  if (!attach.ok) return { ok: false, status: 502, code: "send_failed", message: attach.message };
  const domainStatus = attach.misconfigured ? "pending_dns" : attach.verified ? "active" : "needs_verification";
  const previous = site.custom_domain && site.custom_domain !== domain ? site.custom_domain : null;

  const { data, error } = await getDb().from(SITES_TABLE).update({ custom_domain: domain, domain_status: domainStatus }).eq("id", site.id).select("*").single();
  if (error) {
    if (error.code === "23505") return { ok: false, status: 409, code: "duplicate", message: "Ese dominio ya está conectado a otra web." };
    throw error;
  }
  if (previous) {
    const gone = await detachDomain(previous, { fetch: deps.fetch, env: deps.vercel });
    if (!gone.ok) console.error("[Sites:domain] old domain not detached", previous, gone.message);
  }
  if (site.published_at) {
    const warning = await revalidate(site.slug, deps);
    if (warning) console.error("[Sites:domain]", warning);
  }
  const records = dnsRecordsFor(domain);
  const dnsText = records.map((r) => `${r.type} ${r.name} → ${r.value}`).join(" · ");
  const message =
    domainStatus === "active"
      ? `${domain} ya apunta a Vercel ✓`
      : domainStatus === "pending_dns"
        ? attach.configChecked
          ? `Agregado en Vercel. Falta el DNS en el proveedor del dominio: ${dnsText}`
          : `Agregado en Vercel, pero no se pudo comprobar su DNS (respuesta ${attach.configStatus || "sin conexión"}); use «Revisar DNS» en un minuto. Registro a crear: ${dnsText}`
        : `Agregado. Vercel pide verificar el dominio: ${verificationText(attach.verification)}`;
  return { ok: true, site: data as SiteRow, records, verification: attach.verification, message };
}

export async function removeCustomDomain(siteId: string, deps: Pick<PublishDeps, "fetch" | "vercel" | "mm">): Promise<ActionResult<{ site: SiteRow }>> {
  const site = await getSite(siteId);
  if (!site) return { ok: false, status: 404, code: "not_found", message: "No existe esa web." };
  if (!site.custom_domain) return { ok: false, status: 409, code: "not_eligible", message: "No tiene dominio propio." };
  if (!deps.vercel) return vercelMissing();
  const gone = await detachDomain(site.custom_domain, { fetch: deps.fetch, env: deps.vercel });
  if (!gone.ok) return { ok: false, status: 502, code: "send_failed", message: gone.message };
  const { data, error } = await getDb().from(SITES_TABLE).update({ custom_domain: null, domain_status: null }).eq("id", site.id).select("*").single();
  if (error) throw error;
  if (site.published_at) await revalidate(site.slug, deps);
  return { ok: true, site: data as SiteRow };
}

// ─── Quick edits + slug ─────────────────────────────────────────────────────

/** Apply the board's quick edits to a content (pure; validated by the caller). */
export function applyQuickEdits(content: SiteContentV1, edits: SiteQuickEdits): { content: SiteContentV1; fixes: string[]; fields: string[] } {
  const c = structuredClone(content);
  const fields: string[] = [];
  if (edits.tagline !== undefined) {
    c.business.tagline = edits.tagline;
    fields.push("tagline");
  }
  if (edits.heroHeadline !== undefined) {
    c.hero.headline = edits.heroHeadline;
    fields.push("hero.headline");
  }
  if (edits.heroSubheadline !== undefined) {
    c.hero.subheadline = edits.heroSubheadline;
    fields.push("hero.subheadline");
  }
  if (edits.ctaLabel !== undefined) {
    c.hero.ctaLabel = edits.ctaLabel;
    fields.push("hero.ctaLabel");
  }
  if (edits.about !== undefined) {
    c.about.body = edits.about;
    fields.push("about.body");
  }
  if (edits.services !== undefined) {
    const old = content.services.items;
    c.services.items = edits.services.map((s) => ({
      name: s.name,
      description: s.description,
      price: s.price,
      image: s.from !== null && old[s.from] ? old[s.from].image : null,
    }));
    fields.push("services.items");
  }
  let fixes: string[] = [];
  if (edits.palette && Object.keys(edits.palette).length) {
    const fixed = fixPalette({ ...c.theme.palette, ...edits.palette });
    c.theme.palette = fixed.palette;
    fixes = fixed.fixes;
    fields.push("theme.palette");
  }
  return { content: c, fixes, fields };
}

export async function editSiteContent(
  siteId: string,
  edits: SiteQuickEdits,
  expectedVersion: number,
  deps: Pick<PublishDeps, "now" | "fetch" | "mm">,
): Promise<ActionResult<{ site: SiteRow; fixes: string[]; warnings: string[] }>> {
  const site = await getSite(siteId);
  if (!site) return { ok: false, status: 404, code: "not_found", message: "No existe esa web." };
  if (site.status === "generating") return { ok: false, status: 409, code: "not_eligible", message: "Se está generando: espere a que termine." };
  if (!site.content) return { ok: false, status: 409, code: "not_eligible", message: "Todavía no tiene contenido." };
  if (site.version !== expectedVersion) {
    return { ok: false, status: 409, code: "not_eligible", message: `La web cambió (ahora v${site.version}): actualice y vuelva a editar.` };
  }
  const { content, fixes, fields } = applyQuickEdits(site.content, edits);
  const check = siteContentSchema.safeParse(content);
  if (!check.success) {
    const first = check.error.issues[0];
    return { ok: false, status: 400, code: "invalid", message: `Revise ${first?.path.join(".")}: ${first?.message}` };
  }
  const { data, error } = await getDb()
    .from(SITES_TABLE)
    .update({
      content: check.data,
      version: site.version + 1,
      sources: { ...(site.sources ?? {}), lastEdit: { at: deps.now().toISOString(), fields } },
    })
    .eq("id", site.id)
    .eq("version", expectedVersion)
    .neq("status", "generating")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, status: 409, code: "not_eligible", message: "La web cambió mientras tanto: actualice y vuelva a editar." };
  const warnings: string[] = [];
  if (site.status === "published") {
    const warning = await revalidate(site.slug, deps);
    if (warning) warnings.push(warning);
  }
  return { ok: true, site: data as SiteRow, fixes, warnings };
}

export async function changeSlug(siteId: string, raw: string): Promise<ActionResult<{ site: SiteRow }>> {
  const slug = raw.trim().toLowerCase();
  const problem = slugProblem(slug);
  if (problem) return { ok: false, status: 400, code: "invalid", message: problem };
  const site = await getSite(siteId);
  if (!site) return { ok: false, status: 404, code: "not_found", message: "No existe esa web." };
  if (site.published_at) return { ok: false, status: 409, code: "not_eligible", message: "Ya se publicó: la dirección no se puede cambiar." };
  if (site.slug === slug) return { ok: true, site };
  if (await slugTaken(slug, site.id)) return { ok: false, status: 409, code: "duplicate", message: `${slug}.${SITES_ROOT_DOMAIN} ya es de otra web.` };
  const { data, error } = await getDb().from(SITES_TABLE).update({ slug }).eq("id", site.id).is("published_at", null).select("*").maybeSingle();
  if (error) {
    if (error.code === "23505") return { ok: false, status: 409, code: "duplicate", message: `${slug}.${SITES_ROOT_DOMAIN} ya es de otra web.` };
    if (error.code === "23514") return { ok: false, status: 400, code: "invalid", message: "Dirección inválida." };
    throw error;
  }
  if (!data) return { ok: false, status: 409, code: "not_eligible", message: "Ya se publicó: la dirección no se puede cambiar." };
  return { ok: true, site: data as SiteRow };
}

/** Save Phil's regeneration notes without regenerating. */
export async function saveInstructions(siteId: string, instructions: string | null): Promise<ActionResult<{ site: SiteRow }>> {
  const { data, error } = await getDb().from(SITES_TABLE).update({ instructions }).eq("id", siteId).select("*").maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, status: 404, code: "not_found", message: "No existe esa web." };
  return { ok: true, site: data as SiteRow };
}

