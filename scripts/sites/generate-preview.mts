/**
 * Generate (or regenerate) a lead's website PREVIEW with the real generator — place imagery
 * included — even when the lead hasn't finished the form (status 'borrador'). The site row is
 * only ever 'draft': nothing is published, no alert / WhatsApp / e-mail is sent, and the signup
 * row is never written. Publishing stays blocked until the client submits the form and accepts
 * the terms (sites/publish.ts → publishBlocker).
 *
 *   npx tsx scripts/sites/generate-preview.mts <signup-id> [options]
 *
 *   --out <file.json>             also write the content JSON (e.g. mm-sites/src/fixtures/real-<slug>.json)
 *   --sources-out <file.json>     also write the generator's sources report
 *   --instructions "<text>"       team notes for the model (saved on the site row)
 *   --dry-run                     generate only: no site row, no public-bucket copies
 *   --no-imagery                  skip the Wikimedia Commons place photos
 *   --anthropic-key-from <file>   read ONLY ANTHROPIC_API_KEY from this dotenv file when the
 *                                 environment has none (Vercel "sensitive" vars pull empty)
 *
 * Existing site: keeps its slug and preview token, version + 1. Refuses published / paused /
 * archived sites and one that is generating right now (use the ops board for those).
 * New site: slug from the normal allocator, row inserted as 'draft' (never 'generating', which
 * the live cron would pick up); if generation fails, that new row is removed again.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

type GenerateMod = typeof import("../../src/lib/web-gratis/sites/generate");
type DbMod = typeof import("../../src/lib/web-gratis/sites/db");
type PipelineMod = typeof import("../../src/lib/web-gratis/sites/pipeline");
type SlugMod = typeof import("../../src/lib/web-gratis/sites/slug");
type ContractMod = typeof import("../../src/lib/web-gratis/site-content");
type ServerMod = typeof import("../../src/lib/web-gratis/server");
type PublishMod = typeof import("../../src/lib/web-gratis/sites/publish");
type SiteRow = import("../../src/lib/web-gratis/sites/db").SiteRow;
type GenerateResult = import("../../src/lib/web-gratis/sites/generate").GenerateResult;

const REPO = fileURLToPath(new URL("../../", import.meta.url)).replace(/\/$/, "");
const require = createRequire(`${REPO}/package.json`);
require("@next/env").loadEnvConfig(REPO, false);

const PREVIEW_ORIGIN_FALLBACK = "https://sites.machinemindconsulting.com";
const JOB_BUDGET_MS = 280_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Args {
  signupId: string;
  out: string | null;
  sourcesOut: string | null;
  instructions: string | null;
  dryRun: boolean;
  imagery: boolean;
  keyFrom: string | null;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { signupId: "", out: null, sourcesOut: null, instructions: null, dryRun: false, imagery: true, keyFrom: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => {
      const v = argv[++i];
      if (!v) throw new Error(`falta el valor de ${a}`);
      return v;
    };
    if (a === "--out") args.out = resolve(value());
    else if (a === "--sources-out") args.sourcesOut = resolve(value());
    else if (a === "--instructions") args.instructions = value().trim() || null;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--no-imagery") args.imagery = false;
    else if (a === "--anthropic-key-from") args.keyFrom = resolve(value());
    else if (a && !a.startsWith("--") && !args.signupId) args.signupId = a;
    else throw new Error(`argumento desconocido: ${a}`);
  }
  if (!UUID_RE.test(args.signupId)) throw new Error("uso: generate-preview.mts <signup-id> [--out f.json] [--sources-out f.json] [--instructions t] [--dry-run] [--no-imagery] [--anthropic-key-from .env]");
  return args;
}

/** Only ANTHROPIC_API_KEY is taken from the file — never its Supabase or other settings. The value is never printed. */
function loadAnthropicKey(file: string): void {
  const current = (process.env.ANTHROPIC_API_KEY ?? "").replace(/\\n/g, "").trim();
  if (current) return;
  const text = readFileSync(file, "utf8");
  const line = text.split(/\r?\n/).find((l) => /^\s*(export\s+)?ANTHROPIC_API_KEY\s*=/.test(l));
  const raw = line ? line.replace(/^\s*(export\s+)?ANTHROPIC_API_KEY\s*=\s*/, "") : "";
  const value = raw.replace(/^["']|["']$/g, "").replace(/\\n/g, "").trim();
  if (!value) throw new Error(`${file} no tiene ANTHROPIC_API_KEY`);
  process.env.ANTHROPIC_API_KEY = value;
}

function writeJson(file: string, data: unknown): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (args.keyFrom) loadAnthropicKey(args.keyFrom);

  // Imported only now: the modules must see the env loaded above.
  const { generateSite, GenerationError } = (await import(`${REPO}/src/lib/web-gratis/sites/generate.ts`)) as GenerateMod;
  const { generatorEnv, previewUrl, SITES_TABLE } = (await import(`${REPO}/src/lib/web-gratis/sites/db.ts`)) as DbMod;
  const { getSignup, siteForSignup, slugTaken } = (await import(`${REPO}/src/lib/web-gratis/sites/pipeline.ts`)) as PipelineMod;
  const { allocateSlug } = (await import(`${REPO}/src/lib/web-gratis/sites/slug.ts`)) as SlugMod;
  const { siteContentSchema } = (await import(`${REPO}/src/lib/web-gratis/site-content.ts`)) as ContractMod;
  const { getDb } = (await import(`${REPO}/src/lib/web-gratis/server.ts`)) as ServerMod;
  const { publishBlocker } = (await import(`${REPO}/src/lib/web-gratis/sites/publish.ts`)) as PublishMod;

  const gen = generatorEnv();
  if (!gen) throw new Error("Falta ANTHROPIC_API_KEY (use --anthropic-key-from <archivo .env>)");
  const signup = await getSignup(args.signupId);
  if (!signup) throw new Error("No existe esa solicitud.");
  if (["cancelada", "descartada"].includes(signup.status)) throw new Error(`La solicitud está ${signup.status}: no se genera.`);

  const db = getDb();
  let site: SiteRow | null = await siteForSignup(signup.id);
  let created = false;
  if (site) {
    if (["published", "paused", "archived"].includes(site.status)) {
      throw new Error(`La web está ${site.status}: regenérela desde el tablero (este script solo trabaja borradores).`);
    }
    if (site.status === "generating" && site.generation_lease_until && Date.parse(site.generation_lease_until) > Date.now()) {
      throw new Error("La web se está generando ahora mismo: espere a que termine.");
    }
  }

  let slug: string;
  if (site) {
    slug = site.slug;
  } else if (args.dryRun) {
    slug = await allocateSlug(
      { businessName: signup.business_name, businessType: signup.business_type, city: signup.city, code: signup.referral_code },
      (s: string) => slugTaken(s),
    );
  } else {
    for (let attempt = 0; attempt < 6 && !site; attempt++) {
      const candidate = await allocateSlug(
        { businessName: signup.business_name, businessType: signup.business_type, city: signup.city, code: signup.referral_code },
        (s: string) => slugTaken(s),
      );
      // 'draft' from the start: a 'generating' row would be claimed by the live cron.
      const { data, error } = await db
        .from(SITES_TABLE)
        .insert({ signup_id: signup.id, slug: candidate, status: "draft", version: 0, instructions: args.instructions })
        .select("*")
        .single();
      if (!error) {
        site = data as SiteRow;
        created = true;
        break;
      }
      if (error.code !== "23505") throw error;
      site = await siteForSignup(signup.id); // someone else created it — use theirs
    }
    if (!site) throw new Error("No se pudo reservar una dirección para la web.");
    slug = site.slug;
  }

  const started = Date.now();
  let result: GenerateResult;
  try {
    result = await generateSite(
      { signup, slug, instructions: args.instructions ?? site?.instructions ?? null, dryRun: args.dryRun, placeImagery: args.imagery },
      { fetch, apiKey: gen.apiKey, model: gen.model, now: () => new Date(), deadline: started + JOB_BUDGET_MS },
    );
  } catch (error) {
    if (created && site) {
      const { error: delError } = await db.from(SITES_TABLE).delete().eq("id", site.id).eq("version", 0);
      if (delError) console.error("[generate-preview] could not remove the reserved row", site.id, delError);
    }
    const msg = error instanceof GenerationError || error instanceof Error ? error.message : String(error);
    throw new Error(`La generación falló: ${msg}`);
  }

  const content = siteContentSchema.parse(result.content);
  if (args.out) writeJson(args.out, content);
  if (args.sourcesOut) writeJson(args.sourcesOut, result.sources);

  let version: number | null = null;
  let token: string | null = site?.preview_token ?? null;
  if (!args.dryRun && site) {
    const { data, error } = await db
      .from(SITES_TABLE)
      .update({
        status: "draft",
        content,
        version: site.version + 1,
        instructions: args.instructions ?? site.instructions,
        generated_at: new Date().toISOString(),
        generation_error: null,
        generation_lease_until: null,
        sources: result.sources,
      })
      .eq("id", site.id)
      .eq("version", site.version)
      .in("status", ["draft", "failed", "generating"])
      .select("slug, version, preview_token")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("La web cambió mientras se generaba (tablero o cron): no se guardó. Vuelva a intentarlo.");
    const saved = data as Pick<SiteRow, "slug" | "version" | "preview_token">;
    version = saved.version;
    token = saved.preview_token;
  }

  const url = token ? (previewUrl(slug, token) ?? `${PREVIEW_ORIGIN_FALLBACK}/p/${slug}?t=${token}`) : null;
  const c = content;
  console.log(
    JSON.stringify(
      {
        slug,
        version,
        dryRun: args.dryRun,
        preview: args.dryRun ? null : url,
        publishBlockedBecause: publishBlocker(signup),
        model: gen.model,
        seconds: Math.round((Date.now() - started) / 1000),
        vertical: c.theme.vertical,
        mode: c.theme.mode,
        font: c.theme.font,
        palette: c.theme.palette,
        hero: { headline: c.hero.headline, image: c.hero.image ? { alt: c.hero.image.alt, credit: c.hero.image.credit?.name ?? null } : null },
        services: c.services.items.map((i) => i.name),
        gallery: c.gallery.length,
        stock: result.sources.stock ?? null,
        guards: result.sources.guards,
        notes: result.sources.notes,
      },
      null,
      2,
    ),
  );
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error("[generate-preview]", error instanceof Error ? error.message : error);
    process.exit(1);
  });
