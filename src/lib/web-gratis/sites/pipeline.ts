/**
 * Website generation lifecycle (server only).
 *
 *   signup submitted ≥ 10 min ago (WhatsApp files have time to arrive)
 *     → site row created with a free slug, status 'generating'
 *     → claimed with a lease (generation_lease_until) — one generator per site
 *     → generated → 'draft' (version + 1) + "WEB LISTA PARA REVISAR" alert,
 *       signup nuevo → en_construccion
 *     → failure: retried by the next tick; the 3rd failure → 'failed' + URGENTE alert.
 *
 * Claims are compare-and-set updates on (status, generation_attempts, lease),
 * so two cron ticks, or a tick and the board's "Generar ahora", can never
 * generate the same site at once. Results are written only if the claim still
 * holds (a board reset in the meantime wins).
 *
 * Time comes from deps.now() and alerts / fetch are injectable, so the D5
 * harness runs all of it against the real DB with stubbed APIs.
 */
import { countryLabel, siteFailedMessage, siteReadyMessage, type SiteAlertMessage } from "../notify";
import { enqueueSiteAlert, enqueueSystem, type SiteAlertKind } from "../outbox";
import { getDb, SIGNUPS_TABLE, type WebGratisSignup } from "../server";
import { generatorEnv, previewUrl, SITES_TABLE, type GeneratorEnv, type SiteRow } from "./db";
import { GenerationError, generateSite, unreadFiles } from "./generate";
import { revalidateSite } from "./mm-sites";
import { MAX_GENERATION_ATTEMPTS, publicSiteUrl } from "./shared";
import { allocateSlug } from "./slug";

/** Longer than the run route's 300 s, so a live job never loses its lease. */
export const LEASE_MS = 330_000;
/** Submitted this long ago before a site is generated automatically. */
export const AUTO_START_DELAY_MS = 10 * 60_000;
/** Wall-clock budget for one generation (model calls + copies). */
const JOB_BUDGET_MS = 270_000;

const AUTO_STATUSES = ["nuevo", "en_construccion"] as const;
/** Signup statuses a site can be (re)generated for. */
const GENERATABLE: readonly string[] = ["nuevo", "en_construccion", "entregada", "compartida", "activa", "pausada"];

export interface SitesDeps {
  now: () => Date;
  fetch: typeof fetch;
  generator: () => GeneratorEnv | null;
  alert: (kind: SiteAlertKind, key: string, signupId: string | null, message: SiteAlertMessage) => Promise<boolean>;
  /** Plain system alert (throttled by key). */
  system: (key: string, text: string) => Promise<boolean>;
}

export function defaultSitesDeps(): SitesDeps {
  return {
    now: () => new Date(),
    fetch: (input, init) => fetch(input, init),
    generator: generatorEnv,
    alert: (kind, key, signupId, message) => enqueueSiteAlert(kind, key, signupId, message),
    system: (key, text) => enqueueSystem(key, text),
  };
}

const iso = (d: Date) => d.toISOString();

function errText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String((error as { message: unknown }).message);
  return String(error);
}

// ─── Reads ──────────────────────────────────────────────────────────────────

export async function getSite(id: string): Promise<SiteRow | null> {
  const { data, error } = await getDb().from(SITES_TABLE).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as SiteRow | null) ?? null;
}

export async function siteForSignup(signupId: string): Promise<SiteRow | null> {
  const { data, error } = await getDb().from(SITES_TABLE).select("*").eq("signup_id", signupId).maybeSingle();
  if (error) throw error;
  return (data as SiteRow | null) ?? null;
}

export async function getSignup(id: string): Promise<WebGratisSignup | null> {
  const { data, error } = await getDb().from(SIGNUPS_TABLE).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as WebGratisSignup | null) ?? null;
}

export async function slugTaken(slug: string, exceptSiteId?: string): Promise<boolean> {
  let q = getDb().from(SITES_TABLE).select("id", { count: "exact", head: true }).eq("slug", slug);
  if (exceptSiteId) q = q.neq("id", exceptSiteId);
  const { count, error } = await q;
  if (error) throw error;
  return (count ?? 0) > 0;
}

// ─── Site rows ──────────────────────────────────────────────────────────────

/**
 * The signup's site row, created with a free slug when it doesn't exist yet.
 * `created` is false when another process created it first.
 */
export async function ensureSiteRow(
  signup: Pick<WebGratisSignup, "id" | "business_name" | "business_type" | "city" | "referral_code">,
  instructions: string | null = null,
): Promise<{ site: SiteRow; created: boolean }> {
  const db = getDb();
  for (let attempt = 0; attempt < 6; attempt++) {
    const existing = await siteForSignup(signup.id);
    if (existing) return { site: existing, created: false };
    const slug = await allocateSlug(
      { businessName: signup.business_name, businessType: signup.business_type, city: signup.city, code: signup.referral_code },
      (s) => slugTaken(s),
    );
    const { data, error } = await db
      .from(SITES_TABLE)
      .insert({ signup_id: signup.id, slug, status: "generating", instructions })
      .select("*")
      .single();
    if (!error) return { site: data as SiteRow, created: true };
    if (error.code !== "23505") throw error;
    // Unique violation: either this signup's row appeared (loop returns it) or the slug was just taken (next candidate).
  }
  throw new Error(`[Sites:pipeline] could not create a site row for ${signup.id}`);
}

// ─── Claims ─────────────────────────────────────────────────────────────────

async function alertFor(kind: SiteAlertKind, site: SiteRow, signup: WebGratisSignup | null, extra: { error?: string; attempts?: number }, deps: SitesDeps) {
  if (!signup) return;
  const info = {
    business: signup.business_name,
    city: signup.city,
    whatsapp: signup.whatsapp,
    country: countryLabel(signup),
    slug: site.slug,
    version: site.version,
    previewUrl: previewUrl(site.slug, site.preview_token),
    publicUrl: publicSiteUrl(site.slug),
    notes: site.sources?.notes ?? null,
    unread: unreadFiles(site.sources ?? {}),
    guards: guardLines(site),
    error: extra.error ?? null,
    attempts: extra.attempts,
  };
  const message = kind === "site_ready" ? siteReadyMessage(info) : siteFailedMessage(info);
  const key = kind === "site_ready" ? `ready:${site.id}:v${site.version}` : `failed:${site.id}:${iso(deps.now()).slice(0, 13)}`;
  const queued = await deps.alert(kind, key, signup.id, message).catch((error: unknown) => {
    console.error("[Sites:pipeline] alert enqueue failed", kind, site.id, error);
    return false;
  });
  if (!queued) console.error("[Sites:pipeline] alert not queued", kind, site.id);
}

/** Human lines for the guards that fired (board + alert). */
export function guardLines(site: Pick<SiteRow, "sources">): string[] {
  const g = site.sources?.guards;
  if (!g) return [];
  const out: string[] = [];
  if (g.pricesRemoved.length) out.push(`${g.pricesRemoved.length} precio(s) quitado(s) (no estaban en lo que envió el cliente)`);
  if (g.sentencesRemoved.length) out.push(`${g.sentencesRemoved.length} frase(s) quitada(s) por datos no respaldados`);
  if (g.contrastFixes.length) out.push(`colores ajustados para que se lean (${g.contrastFixes.length})`);
  return out;
}

/** Mark a site failed (once) and alert. */
async function failSite(site: SiteRow, message: string, deps: SitesDeps): Promise<void> {
  const { data, error } = await getDb()
    .from(SITES_TABLE)
    .update({ status: "failed", generation_error: message.slice(0, 2000), generation_lease_until: null })
    .eq("id", site.id)
    .eq("status", "generating")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) return;
  const signup = await getSignup(site.signup_id);
  await alertFor("site_failed", data as SiteRow, signup, { error: message, attempts: site.generation_attempts }, deps);
}

/**
 * Take the lease on a site waiting to be generated. Null when it isn't
 * waiting, someone else holds it, or it ran out of attempts (then it's marked
 * failed and the team is alerted).
 */
export async function claimSite(siteId: string, deps: SitesDeps): Promise<SiteRow | null> {
  const site = await getSite(siteId);
  if (!site || site.status !== "generating") return null;
  const now = deps.now();
  if (site.generation_lease_until && Date.parse(site.generation_lease_until) > now.getTime()) return null;
  if (site.generation_attempts >= MAX_GENERATION_ATTEMPTS) {
    await failSite(site, site.generation_error ?? "Se agotaron los intentos de generación.", deps);
    return null;
  }
  const { data, error } = await getDb()
    .from(SITES_TABLE)
    .update({ generation_lease_until: iso(new Date(now.getTime() + LEASE_MS)), generation_attempts: site.generation_attempts + 1 })
    .eq("id", site.id)
    .eq("status", "generating")
    .eq("generation_attempts", site.generation_attempts)
    .or(`generation_lease_until.is.null,generation_lease_until.lt.${iso(now)}`)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return (data as SiteRow | null) ?? null;
}

/**
 * Submitted signups old enough to generate that have no site yet. The "no
 * site" filter runs in the database (anti-join on the embedded site row), so
 * signups still sitting in nuevo / en_construccion with a draft awaiting
 * review never crowd new ones out of the batch.
 */
export async function autoStartCandidates(now: Date, onlySignupIds?: string[]): Promise<WebGratisSignup[]> {
  let q = getDb()
    .from(SIGNUPS_TABLE)
    .select(`*, ${SITES_TABLE}(id)`)
    .in("status", [...AUTO_STATUSES])
    .not("submitted_at", "is", null)
    .lte("submitted_at", iso(new Date(now.getTime() - AUTO_START_DELAY_MS)))
    .is(SITES_TABLE, null)
    .order("submitted_at", { ascending: true })
    .limit(25);
  if (onlySignupIds) q = q.in("id", onlySignupIds.length ? onlySignupIds : ["00000000-0000-0000-0000-000000000000"]);
  // A general sweep (the live cron) never starts sites for D5 test rows ("ZZ …"); harness runs pass onlySignupIds.
  else q = q.not("business_name", "like", "ZZ %");
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => {
    const signup = { ...row };
    delete signup[SITES_TABLE]; // the embedded (always empty) site row
    return signup as unknown as WebGratisSignup;
  });
}

/**
 * The next site to generate, already leased: a specific one (board), else one
 * waiting / abandoned mid-run, else a new submitted signup. Null when idle.
 */
export async function claimNextJob(deps: SitesDeps, opts: { siteId?: string; onlySignupIds?: string[] } = {}): Promise<SiteRow | null> {
  if (opts.siteId) return claimSite(opts.siteId, deps);
  const nowIso = iso(deps.now());
  let q = getDb()
    .from(SITES_TABLE)
    .select(`id, ${SIGNUPS_TABLE}(business_name)`)
    .eq("status", "generating")
    .or(`generation_lease_until.is.null,generation_lease_until.lt.${nowIso}`)
    .order("updated_at", { ascending: true })
    .limit(10);
  if (opts.onlySignupIds) q = q.in("signup_id", opts.onlySignupIds.length ? opts.onlySignupIds : ["00000000-0000-0000-0000-000000000000"]);
  const { data, error } = await q;
  if (error) throw error;
  const pending = ((data ?? []) as unknown as { id: string; [k: string]: unknown }[]).filter((row) => {
    if (opts.onlySignupIds) return true;
    const owner = row[SIGNUPS_TABLE] as { business_name?: string | null } | null;
    return !/^ZZ /.test(owner?.business_name ?? ""); // never the D5 harness's rows in a general sweep
  });
  for (const row of pending) {
    const claimed = await claimSite(row.id, deps);
    if (claimed) return claimed;
  }
  for (const signup of await autoStartCandidates(deps.now(), opts.onlySignupIds)) {
    // One bad row must not block every signup behind it, minute after minute.
    try {
      const { site } = await ensureSiteRow(signup);
      const claimed = await claimSite(site.id, deps);
      if (claimed) return claimed;
    } catch (error) {
      console.error("[Sites:pipeline] could not start a site", signup.id, error);
      await deps
        .system(
          `sites-start:${signup.id}:${iso(deps.now()).slice(0, 10)}`,
          `No se pudo empezar la web de ${signup.business_name} (${signup.whatsapp}): ${errText(error).slice(0, 300)}. Use «Generar ahora» en su tarjeta.`,
        )
        .catch(() => false);
    }
  }
  return null;
}

// ─── The job ────────────────────────────────────────────────────────────────

export type JobOutcome =
  | { ok: true; site: SiteRow }
  | { ok: false; reason: string; final: boolean };

/** Generate a site this process holds the lease on, and record the outcome. */
export async function runJob(site: SiteRow, deps: SitesDeps): Promise<JobOutcome> {
  const db = getDb();
  /** An update that only applies while this job still owns the site. */
  const owned = (patch: Record<string, unknown>) =>
    db.from(SITES_TABLE).update(patch).eq("id", site.id).eq("status", "generating").eq("generation_attempts", site.generation_attempts);
  let signup: WebGratisSignup | null = null;
  try {
    signup = await getSignup(site.signup_id);
    if (!signup) throw new GenerationError("La solicitud ya no existe.", false);
    if (!GENERATABLE.includes(signup.status)) {
      await db
        .from(SITES_TABLE)
        .update({ status: "archived", generation_lease_until: null, generation_error: `Solicitud ${signup.status}: no se generó.` })
        .eq("id", site.id)
        .eq("status", "generating");
      return { ok: false, reason: `solicitud ${signup.status}`, final: true };
    }
    const gen = deps.generator();
    if (!gen) throw new GenerationError("Falta ANTHROPIC_API_KEY en el servidor.", true);

    const started = Date.now();
    const result = await generateSite(
      { signup, slug: site.slug, instructions: site.instructions, dryRun: false },
      { fetch: deps.fetch, apiKey: gen.apiKey, model: gen.model, now: deps.now, deadline: started + JOB_BUDGET_MS },
    );
    const { data: saved, error } = await owned({
      status: "draft",
      content: result.content,
      version: site.version + 1,
      generated_at: iso(deps.now()),
      generation_error: null,
      generation_lease_until: null,
      sources: result.sources,
    })
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!saved) return { ok: false, reason: "reemplazada mientras se generaba (se regeneró o cambió desde el tablero)", final: true };
    const savedSite = saved as SiteRow;

    const { error: moveError } = await db.from(SIGNUPS_TABLE).update({ status: "en_construccion" }).eq("id", signup.id).eq("status", "nuevo");
    if (moveError) console.error("[Sites:job] signup → en_construccion failed", signup.id, moveError);
    await alertFor("site_ready", savedSite, signup, {}, deps);
    return { ok: true, site: savedSite };
  } catch (error) {
    const message = error instanceof GenerationError ? error.message : `Error interno: ${errText(error)}`;
    console.error("[Sites:job]", site.id, site.slug, error);
    const final = site.generation_attempts >= MAX_GENERATION_ATTEMPTS || (error instanceof GenerationError && !error.retryable);
    try {
      if (final) {
        await failSite(site, message, deps);
      } else {
        const { error: saveError } = await owned({ generation_error: message.slice(0, 2000), generation_lease_until: null });
        if (saveError) throw saveError;
      }
    } catch (recordError) {
      console.error("[Sites:job] could not record the failure (the lease expires on its own)", site.id, recordError);
    }
    return { ok: false, reason: message, final };
  }
}

// ─── Board: "Generar ahora" / "Regenerar" ───────────────────────────────────

export type RequestResult =
  | { ok: true; site: SiteRow; message: string }
  | { ok: false; code: "not_found" | "not_eligible"; message: string };

/**
 * Queue a (re)generation with Phil's optional instructions. The caller starts
 * it right away (after the response) — the per-minute tick is the fallback.
 */
export async function requestGeneration(signupId: string, instructions: string | null, deps: SitesDeps): Promise<RequestResult> {
  const signup = await getSignup(signupId);
  if (!signup) return { ok: false, code: "not_found", message: "No existe esa solicitud." };
  if (!GENERATABLE.includes(signup.status)) {
    return { ok: false, code: "not_eligible", message: "Esta solicitud no está activa (borrador, descartada o cancelada)." };
  }
  if (!signup.submitted_at) return { ok: false, code: "not_eligible", message: "El cliente no terminó el formulario." };
  const { site, created } = await ensureSiteRow(signup, instructions);
  if (created) return { ok: true, site, message: "Generando la web (1–2 min)…" };

  const now = deps.now();
  if (site.status === "published") {
    return { ok: false, code: "not_eligible", message: "La web está publicada: páusela antes de regenerarla, o use las ediciones rápidas." };
  }
  if (site.status === "generating" && site.generation_lease_until && Date.parse(site.generation_lease_until) > now.getTime()) {
    return { ok: false, code: "not_eligible", message: "Ya se está generando: espere uno o dos minutos." };
  }
  const { data, error } = await getDb()
    .from(SITES_TABLE)
    .update({ status: "generating", instructions, generation_attempts: 0, generation_error: null, generation_lease_until: null })
    .eq("id", site.id)
    .eq("updated_at", site.updated_at)
    .neq("status", "published")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, code: "not_eligible", message: "La web cambió mientras tanto: actualice el tablero e intente de nuevo." };
  return { ok: true, site: data as SiteRow, message: site.version > 0 ? `Regenerando (v${site.version + 1}, 1–2 min)…` : "Generando la web (1–2 min)…" };
}

// ─── Tick (cron) ────────────────────────────────────────────────────────────

/**
 * Purge the renderer's cache for live sites whose signup changed recently
 * (paused by the scheduler, cancelled, reopened…). Cheap and idempotent.
 */
export async function sweepRevalidations(deps: SitesDeps, onlySignupIds?: string[]): Promise<number> {
  const db = getDb();
  const since = iso(new Date(deps.now().getTime() - 3 * 60_000));
  let q = db.from(SIGNUPS_TABLE).select("id").gte("updated_at", since).limit(200);
  if (onlySignupIds) q = q.in("id", onlySignupIds.length ? onlySignupIds : ["00000000-0000-0000-0000-000000000000"]);
  const { data: changed, error } = await q;
  if (error) throw error;
  const ids = ((changed ?? []) as { id: string }[]).map((r) => r.id);
  if (!ids.length) return 0;
  const { data: sites, error: siteError } = await db.from(SITES_TABLE).select("slug").in("signup_id", ids).not("published_at", "is", null).limit(20);
  if (siteError) throw siteError;
  let n = 0;
  for (const s of (sites ?? []) as { slug: string }[]) {
    const res = await revalidateSite(s.slug, { fetch: deps.fetch });
    if (res.ok) n++;
    else console.error("[Sites:sweep] revalidate failed", s.slug, res.error);
  }
  return n;
}

/** Once a day, when sites are waiting and the generator has no key. */
export async function alertIfUnconfigured(deps: SitesDeps, waiting: number): Promise<void> {
  if (deps.generator() || waiting === 0) return;
  await deps.system(
    `sites-no-key:${iso(deps.now()).slice(0, 10)}`,
    `Hay ${waiting} web(s) esperando generarse, pero falta ANTHROPIC_API_KEY en Vercel (machinemind-landing). Nada se pierde: se generan solas cuando se configure.`,
  );
}

/** How many sites are waiting to be generated (for the "no key" alert). */
export async function waitingCount(deps: SitesDeps): Promise<number> {
  const db = getDb();
  const { count, error } = await db.from(SITES_TABLE).select("id", { count: "exact", head: true }).eq("status", "generating");
  if (error) throw error;
  const fresh = await autoStartCandidates(deps.now());
  return (count ?? 0) + fresh.length;
}
