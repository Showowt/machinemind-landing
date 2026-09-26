/**
 * Client websites — in-process checks (real DB + storage, ZZ rows only,
 * Anthropic / Vercel / mm-sites stubbed through injected fetch, alerts captured,
 * never the real outbox): slug allocation, contrast fixer, honesty guards,
 * generation with the validation retry, the pipeline's lease + attempts cap,
 * publish (happy path through the board's own delivery PATCH → "Web lista"
 * becomes due) and publish failures, quick edits, slug, pause / resume and the
 * revalidation sweep.
 */
import { createHash } from "node:crypto";
import { ADMIN_TOKEN, BRIDGE_SECRET, REPO, RUN, check, db, okReply, section, seed, signup, site as core, startMockRewired } from "./lib.mts";

const contrast = await import(`${REPO}/src/lib/web-gratis/sites/contrast.ts`);
const slugs = await import(`${REPO}/src/lib/web-gratis/sites/slug.ts`);
const guards = await import(`${REPO}/src/lib/web-gratis/sites/guards.ts`);
const pipeline = await import(`${REPO}/src/lib/web-gratis/sites/pipeline.ts`);
const publish = await import(`${REPO}/src/lib/web-gratis/sites/publish.ts`);
const generate = await import(`${REPO}/src/lib/web-gratis/sites/generate.ts`);
const media = await import(`${REPO}/src/lib/web-gratis/sites/media.ts`);
const contract = await import(`${REPO}/src/lib/web-gratis/site-content.ts`);
const signupRoute = await import(`${REPO}/src/app/api/web-gratis/admin/signups/[id]/route.ts`);
const sharp = (await import("sharp")).default;

type Json = Record<string, unknown>;
interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: Json | null;
}

// ─── Stubs ──────────────────────────────────────────────────────────────────

const H = 3_600_000;
let clock = new Date();
const now = () => new Date(clock.getTime());

const alerts: { kind: string; key: string; signupId: string | null; html: string; text: string }[] = [];
const systemAlerts: { key: string; text: string }[] = [];

/** fetch stub: routes by URL, records every call. */
function stubFetch(route: (call: Call) => { status: number; json: unknown }) {
  const calls: Call[] = [];
  const fn = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((v, k) => (headers[k] = v));
    let body: Json | null = null;
    try {
      body = init?.body ? (JSON.parse(String(init.body)) as Json) : null;
    } catch {
      body = null;
    }
    const call = { url, method: init?.method ?? "GET", headers, body };
    calls.push(call);
    const reply = route(call);
    return new Response(JSON.stringify(reply.json), { status: reply.status, headers: { "content-type": "application/json" } });
  };
  return { fn: fn as typeof fetch, calls };
}

function deps(fetchFn: typeof fetch, generator = true) {
  return {
    now,
    fetch: fetchFn,
    generator: () => (generator ? { apiKey: "zz-test-key", model: "claude-sonnet-5" } : null),
    alert: async (kind: string, key: string, signupId: string | null, m: { html: string; text: string }) => {
      alerts.push({ kind, key, signupId, html: m.html, text: m.text });
      return true;
    },
    system: async (key: string, text: string) => {
      systemAlerts.push({ key, text });
      return true;
    },
  };
}

/** A draft the model could return (all fields valid). */
function validDraft(over: Json = {}): Json {
  return {
    business: { name: "Barbería Prueba", tagline: "Cortes con calma y buen pulso", type: "Barbería", city: "San Salvador" },
    seo: { title: "Barbería Prueba | Cortes en San Salvador", description: "Cortes y barba en San Salvador. Escríbanos por WhatsApp.", keywords: ["barbería San Salvador"] },
    hero: { eyebrow: "Barbería · San Salvador", headline: "Su corte, sin prisa", subheadline: "Cortes y barba en San Salvador.", ctaLabel: "Agendar cita", image: { photo: 1, alt: "Silla de barbero junto a la ventana" } },
    about: { title: "Quiénes somos", body: ["Fundada en 1987. Cortamos con tijera y navaja."], highlights: ["Diseños a mano"] },
    services: {
      title: "Servicios",
      intro: null,
      items: [
        { name: "Corte", description: "Corte a tijera.", price: "$12", image: null },
        { name: "Barba", description: "Perfilado con navaja.", price: null, image: { photo: 1, alt: "Perfilado de barba" } },
      ],
    },
    gallery: [{ photo: 1, alt: "Duplicado del hero" }],
    places: null,
    differentiators: null,
    hours: null,
    location: null,
    contact: { title: "Escríbanos", body: "Cuéntenos qué corte quiere y le damos hora." },
    faq: [{ q: "¿Cómo agendo?", a: "Por WhatsApp." }],
    theme: {
      palette: { bg: "#ffffff", surface: "#f6f6f6", text: "#9a9a9a", muted: "#cfcfcf", primary: "#ffd400", primaryText: "#ffffff", accent: "#1b7a8c" },
      mode: "light",
      font: "sans",
      vertical: "beauty",
      mood: "cálido y preciso",
    },
    sourcePrices: [],
    notesForTeam: "Prueba ZZ.",
    ...over,
  };
}

function toolResponse(input: Json, id = "toolu_zz") {
  return {
    status: 200,
    json: {
      id: `msg_${Math.random().toString(36).slice(2)}`,
      model: "claude-sonnet-5",
      content: [
        { type: "thinking", thinking: "", signature: "zz" },
        { type: "tool_use", id, name: "guardar_sitio", input },
      ],
      stop_reason: "tool_use",
      usage: { input_tokens: 1000, output_tokens: 800 },
    },
  };
}

async function uploadPrivate(signupId: string, kind: "logo" | "photo" | "document", buf: Buffer, ext: string, contentType: string): Promise<string> {
  const path = `${signupId}/${kind}-${Date.now()}-${Math.random().toString(16).slice(2, 8).padEnd(6, "0")}.${ext}`;
  const { error } = await db.storage.from("web-gratis").upload(path, buf, { contentType, upsert: false });
  if (error) throw new Error(`upload ${path}: ${error.message}`);
  return path;
}

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

/** A valid SiteContentV1 for a seeded signup (publish / edit checks here and in http.mts). */
export function sampleContent(s: { business_name: string; whatsapp: string; referral_code: string }) {
  return {
    version: 1,
    lang: "es",
    business: { name: s.business_name.slice(0, 80), tagline: "Frase", type: "Barbería", city: "San Salvador", country: "SV" },
    seo: { title: "Título", description: "Descripción", keywords: [] },
    hero: { eyebrow: "Barbería", headline: "Titular", subheadline: "Subtítulo", ctaLabel: "Escríbanos", image: null },
    about: { title: "Sobre", body: ["Párrafo."], highlights: [] },
    services: { title: "Servicios", intro: null, items: [{ name: "Corte", description: null, price: null, image: { src: "https://example.com/a.jpg", alt: "Foto", width: 10, height: 10, credit: null } }] },
    gallery: [],
    differentiators: null,
    hours: null,
    location: null,
    contact: { title: "Escríbanos", body: "Por WhatsApp.", whatsapp: s.whatsapp.replace(/\D/g, ""), whatsappMessage: "Hola", email: null, instagram: null, facebook: null, website: null },
    faq: [],
    theme: { palette: { bg: "#faf7f2", surface: "#f0ebe3", text: "#1d1d1d", muted: "#555555", primary: "#1b7a8c", primaryText: "#ffffff", accent: "#e8871e" }, mode: "light", font: "sans", vertical: "beauty", mood: "cálido", logo: null },
    footer: { credit: generate.FOOTER_CREDIT, referralUrl: `https://machinemindconsulting.com/web?ref=${s.referral_code}` },
  };
}

/** A signup with a ready draft site (content valid), for publish / edit checks. */
async function draftSite(label: string, fields: Json = {}) {
  const s = await seedSite(label, { status: "en_construccion", services: ["corte", "barba"], ...fields });
  const { site } = await pipeline.ensureSiteRow(s);
  const { data, error } = await db
    .from("web_gratis_sites")
    .update({ status: "draft", content: sampleContent(s), version: 1, generated_at: new Date().toISOString() })
    .eq("id", site.id)
    .select("*")
    .single();
  if (error) throw error;
  return { s, site: data as Json & { id: string; slug: string; version: number } };
}

/** The board's own "→ Entregada" handler, called exactly like the publish route does. */
function boardDelivery(signupId: string, body: Json) {
  return signupRoute
    .PATCH(
      new Request(`http://localhost/api/web-gratis/admin/signups/${signupId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", authorization: `Bearer ${ADMIN_TOKEN}` },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: signupId }) },
    )
    .then(async (res: Response) => ({ ok: res.ok, message: res.ok ? "ok" : String(((await res.json().catch(() => null)) as Json | null)?.message ?? res.status) }));
}

const VERCEL = { token: "zz-vercel-token", teamId: "team_ZZ", projectId: "prj_ZZ" };
const MM = { url: "https://mm-sites.test", revalidateSecret: "zz-revalidate-secret" };

function vercelRoutes(opts: { misconfigured?: boolean; addStatus?: number; verified?: boolean; configStatus?: number } = {}) {
  return (c: Call) => {
    if (c.url.startsWith("https://mm-sites.test/api/revalidate")) return { status: 200, json: { revalidated: true } };
    if (c.method === "POST" && /\/v10\/projects\/prj_ZZ\/domains\?/.test(c.url)) {
      const status = opts.addStatus ?? 200;
      return status === 200 ? { status, json: { name: c.body?.name, verified: opts.verified ?? true } } : { status, json: { error: { code: status === 409 ? "domain_already_in_use" : "forbidden", message: "stub" } } };
    }
    if (c.method === "GET" && /\/v9\/projects\/prj_ZZ\/domains\//.test(c.url)) return { status: 200, json: { verified: opts.verified ?? true, verification: opts.verified === false ? [{ type: "TXT", domain: "_vercel.zz", value: "vc-zz" }] : [] } };
    if (c.method === "POST" && /\/verify\?/.test(c.url)) return { status: 200, json: { verified: opts.verified ?? true } };
    if (c.method === "GET" && /\/v6\/domains\/.+\/config\?/.test(c.url)) {
      return opts.configStatus ? { status: opts.configStatus, json: { error: { code: "forbidden", message: "stub" } } } : { status: 200, json: { misconfigured: opts.misconfigured ?? false } };
    }
    return { status: 404, json: { error: { code: "not_found", message: `unrouted ${c.method} ${c.url}` } } };
  };
}


// ─── Live-cron safety ───────────────────────────────────────────────────────
// The production cron runs every minute against this same database. A ZZ row
// that looks "submitted 15+ minutes ago" or "delivered 10+ minutes ago" in REAL
// time would get a real confirmation / "Web lista" WhatsApp to its random fake
// number. So every row here is submitted in the future (the pipeline runs on the
// fake clock), published rows get a future delivered_at, and runSites deletes
// its own rows as soon as it's done.
const FUTURE = new Date(Date.now() + 3 * 24 * H);
const FUTURE_ISO = FUTURE.toISOString();
const mine = new Set<string>();

async function seedSite(label: string, fields: Json = {}) {
  const s = await seed(label, { submitted_at: FUTURE_ISO, ...fields });
  mine.add(s.id);
  return s;
}

/** 16:00 UTC (10:00 in El Salvador) on the first Monday at least 7 days from now. */
function futureSvMonday10(): Date {
  const d = new Date(Date.now() + 7 * 24 * H);
  d.setUTCHours(16, 0, 0, 0);
  while (d.getUTCDay() !== 1) d.setTime(d.getTime() + 24 * H);
  return d;
}

/** Push a delivered test signup's delivered_at into the future (the live T2 never matches it). */
async function futureDelivery(signupId: string) {
  await db.from("web_gratis_signups").update({ delivered_at: FUTURE_ISO }).eq("id", signupId);
}

/** Delete this file's rows now: public + private files, WhatsApp ledger, signups (sites cascade). */
async function purge(): Promise<string> {
  const ids = [...mine];
  let files = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { data: sites } = await db.from("web_gratis_sites").select("slug").in("signup_id", chunk);
    for (const x of (sites ?? []) as { slug: string }[]) {
      const { data: objs } = await db.storage.from("web-gratis-public").list(x.slug, { limit: 100 });
      if (objs?.length) {
        await db.storage.from("web-gratis-public").remove(objs.map((o: { name: string }) => `${x.slug}/${o.name}`));
        files += objs.length;
      }
    }
    for (const id of chunk) {
      const { data: objs } = await db.storage.from("web-gratis").list(id, { limit: 100 });
      if (objs?.length) {
        await db.storage.from("web-gratis").remove(objs.map((o: { name: string }) => `${id}/${o.name}`));
        files += objs.length;
      }
    }
    const { data: rows } = await db.from("web_gratis_signups").select("whatsapp").in("id", chunk);
    const phones = ((rows ?? []) as { whatsapp: string }[]).map((r) => r.whatsapp);
    await db.from("web_gratis_messages").delete().in("signup_id", chunk);
    if (phones.length) await db.from("web_gratis_messages").delete().in("phone", phones);
    const { error } = await db.from("web_gratis_signups").delete().in("id", chunk);
    if (error) throw error;
  }
  return `sites purge: ${ids.length} signups, ${files} files`;
}

// ─── Checks ─────────────────────────────────────────────────────────────────

export async function runSites(): Promise<void> {
  const savedEnv = { MM_SITES_URL: process.env.MM_SITES_URL, MM_SITES_REVALIDATE_SECRET: process.env.MM_SITES_REVALIDATE_SECRET, WEB_GRATIS_ADMIN_TOKEN: process.env.WEB_GRATIS_ADMIN_TOKEN };
  process.env.MM_SITES_URL = MM.url;
  process.env.MM_SITES_REVALIDATE_SECRET = MM.revalidateSecret;
  process.env.WEB_GRATIS_ADMIN_TOKEN = ADMIN_TOKEN;
  const mock = await startMockRewired(BRIDGE_SECRET);
  mock.plan = okReply;

  try {
    // ──────────────────────────────────────────────────────────────────
    section("Sites: slug allocation (reserved, accents, length, collisions)");
    {
      const c = slugs.slugCandidates({ businessName: "Cabalito sv", city: "San Miguel", code: "VQGZXT" });
      check("Cabalito sv → cabalito-sv, then -san-miguel, then -2", c[0] === "cabalito-sv" && c[1] === "cabalito-sv-san-miguel" && c[2] === "cabalito-sv-2", c.slice(0, 3));
      const r = slugs.slugCandidates({ businessName: "Admin", city: "Santa Ana", code: "ABCDEF" });
      check("reserved 'admin' is never a candidate → admin-santa-ana first", !r.includes("admin") && r[0] === "admin-santa-ana", r.slice(0, 2));
      check("accents / ñ / & → pupuseria-dona-tita-y-hijos", slugs.slugCandidates({ businessName: "Pupusería Doña Tita & Hijos", city: "", code: "ABCDEF" })[0] === "pupuseria-dona-tita-y-hijos");
      const long = slugs.slugCandidates({ businessName: "Distribuidora de Repuestos Automotrices del Oriente Salvadoreño", city: "San Miguel", code: "ABCDEF" });
      check("every candidate ≤ 40 chars and valid (suffixes fit)", long.every((s: string) => s.length <= 40 && /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(s)) && long.some((s: string) => s.endsWith("-2")), long.slice(0, 3));
      check("name with no letters → falls back to the business type", slugs.slugCandidates({ businessName: "★★★", businessType: "Floristería", city: "", code: "ABCDEF" })[0] === "floristeria");
      const taken = new Set(["cabalito-sv", "cabalito-sv-san-miguel"]);
      const got = await slugs.allocateSlug({ businessName: "Cabalito sv", city: "San Miguel", code: "VQGZXT" }, async (s: string) => taken.has(s));
      check("allocateSlug skips taken ones → cabalito-sv-2", got === "cabalito-sv-2", got);

      const same = `ZZ ${RUN} Colision`;
      const a = await seedSite("Colision", { business_name: same, city: "San Salvador" });
      const b = await seedSite("Colision b", { business_name: same, city: "San Salvador" });
      const cS = await seedSite("Colision c", { business_name: same, city: "San Salvador" });
      const sa = (await pipeline.ensureSiteRow(a)).site;
      const sb = (await pipeline.ensureSiteRow(b)).site;
      const sc = (await pipeline.ensureSiteRow(cS)).site;
      const base = contract.slugify(same);
      check("DB: same name ×3 → base, base-<city>, base-2", sa.slug === base && sb.slug === `${base}-san-salvador` && sc.slug === `${base}-2`, [sa.slug, sb.slug, sc.slug]);
      const again = await pipeline.ensureSiteRow(a);
      check("ensureSiteRow twice → same row, created:false", again.site.id === sa.id && again.created === false);
      const racers = await Promise.all([1, 2, 3].map((i) => seedSite(`Colision r${i}`, { business_name: `${same} R` })));
      const raced = await Promise.all(racers.map((r) => pipeline.ensureSiteRow(r)));
      const raceSlugs = raced.map((x: { site: { slug: string } }) => x.site.slug);
      check("3 concurrent allocations of one name → 3 distinct slugs (unique-violation retry)", new Set(raceSlugs).size === 3, raceSlugs);
    }

    // ──────────────────────────────────────────────────────────────────
    section("Sites: contrast fixer (WCAG AA)");
    {
      check("black/white = 21:1", Math.abs(contrast.contrastRatio("#000000", "#ffffff") - 21) < 0.01);
      const bad = { bg: "#ffffff", surface: "#f6f6f6", text: "#9a9a9a", muted: "#cfcfcf", primary: "#ffd400", primaryText: "#ffffff", accent: "#ff0000" };
      const { palette, fixes } = contrast.fixPalette(bad);
      const enforced = contrast.paletteReport(palette).filter((r: { enforced: boolean }) => r.enforced);
      check("low-contrast palette → every text pair ≥ 4.5:1", enforced.every((r: { ok: boolean }) => r.ok), contrast.paletteReport(palette));
      check("brand colors untouched (bg, primary, accent)", palette.bg === bad.bg && palette.primary === bad.primary && palette.accent === bad.accent);
      check("fixes reported in Spanish", fixes.length >= 3 && fixes.some((f: string) => f.startsWith("Texto ")), fixes);
      const good = { bg: "#faf7f2", surface: "#f0ebe3", text: "#1d1d1d", muted: "#555555", primary: "#1b7a8c", primaryText: "#ffffff", accent: "#e8871e" };
      check("already-AA palette unchanged", contrast.fixPalette(good).fixes.length === 0 && JSON.stringify(contrast.fixPalette(good).palette) === JSON.stringify(good));
      const dark = contrast.fixPalette({ bg: "#0f1115", surface: "#1a1d23", text: "#333333", muted: "#444444", primary: "#c0392b", primaryText: "#c0392b", accent: "#f1c40f" });
      check("dark palette: dark text pushed light, primaryText readable on primary", contrast.contrastRatio(dark.palette.text, "#0f1115") >= 4.5 && contrast.contrastRatio(dark.palette.primaryText, "#c0392b") >= 4.5, dark.palette);
      const clash = contrast.fixPalette({ bg: "#ffffff", surface: "#111111", text: "#777777", muted: "#777777", primary: "#1b7a8c", primaryText: "#ffffff", accent: "#e8871e" });
      check("page and cards too different for one text color → cards move toward the page, text passes both", contrast.contrastRatio(clash.palette.text, clash.palette.bg) >= 4.5 && contrast.contrastRatio(clash.palette.text, clash.palette.surface) >= 4.5, clash);
    }

    // ──────────────────────────────────────────────────────────────────
    section("Sites: honesty guards (prices, numbers, testimonials, claims)");
    {
      const g = new guards.CopyGuard({ factText: "Camisas $10, tazas desde $5.50. Horario 8 a 5. Barbería Prueba", priceText: "Camisas $10, tazas desde $5.50, llaveros COP 25.000", whatsappDigits: "50370000000" });
      check("price the client wrote → kept", g.price("$10") === "$10" && g.price("desde $5.50") === "desde $5.50");
      check("same amount written differently (5,50 / 25000) → kept", g.price("$5,50") === "$5,50" && g.price("COP 25000") === "COP 25000");
      check("invented price → null (and reported)", g.price("$12") === null && g.report.pricesRemoved.includes("$12"));
      check("invented years → sentence dropped, the rest kept", g.text("Tenemos más de 20 años de experiencia. Hacemos camisas.") === "Hacemos camisas.");
      check("quoted testimonial → dropped", g.text("«Excelente servicio, muy recomendados» — María. Atendemos por WhatsApp.") === "Atendemos por WhatsApp.");
      check("superlative / award not in the form → dropped", g.text("Somos los mejores de San Miguel. Cortes a tijera.") === "Cortes a tijera." && g.text("Barbería premiada.") === "");
      check("phone / link / @handle in copy → dropped", g.text("Llámenos al 7777-1234.") === "" && g.text("Visite www.x.com hoy.") === "" && g.text("Síganos en @zz.test ya.") === "");
      check("government mention → dropped", g.text("Con el apoyo del Gobierno. Cortes.") === "Cortes.");
      check("hours from the form (8 a 5 → 8:00 a.m. – 5:00 p.m. / 17:00) → kept", g.text("Lunes a viernes: 8:00 a.m. – 5:00 p.m.") !== "" && g.text("Abrimos de 8:00 a 17:00.") !== "");
      const loc = guards.locationFrom("Col. Escalón, calle 5", "San Salvador", "El Salvador");
      check("written address → Maps search link", loc.address === "Col. Escalón, calle 5" && String(loc.mapsUrl).startsWith("https://www.google.com/maps/search/?api=1&query="));
      const pasted = guards.locationFrom("https://maps.app.goo.gl/AbC123", "San Salvador", "El Salvador");
      check("pasted Maps link → used as the map link, no fake street", pasted.address === null && pasted.mapsUrl === "https://maps.app.goo.gl/AbC123");
      check("instagram @handle / URL → canonical profile URL", guards.instagramUrl("@cabalito.sv") === "https://www.instagram.com/cabalito.sv" && guards.instagramUrl("https://instagram.com/cabalito.sv/?hl=es") === "https://www.instagram.com/cabalito.sv");
      check("whatsapp message per goal", guards.whatsappMessageFor("citas").includes("agendar") && guards.whatsappMessageFor("whatsapp") === "Hola, vi su página web y quiero información");
      check("capability / offer the client never stated (envíos, a domicilio, gratis, descuentos) → dropped", g.text("Hacemos envíos a todo el país. Cortes a tijera.") === "Cortes a tijera." && g.text("Cotización gratis por WhatsApp.") === "" && g.text("Servicio a domicilio.") === "" && g.text("Pregunte por nuestros descuentos.") === "");
      const g2 = new guards.CopyGuard({ factText: "Hacemos envíos a domicilio en San Miguel", priceText: "", whatsappDigits: "50370000000" });
      check("…kept when the client said it; 'Envíenos una foto' is not a shipping claim", g2.text("Hacemos envíos a domicilio.") === "Hacemos envíos a domicilio." && g.text("Envíenos una foto de su diseño.") === "Envíenos una foto de su diseño.");
      check("server-filled e-mail must pass the contract's own rule ('ana@gmail.com.' → null, never a failed generation)", guards.emailOrNull("ana@gmail.com.") === null && guards.emailOrNull(" Ana@Gmail.com ") === "ana@gmail.com");
    }

    // ──────────────────────────────────────────────────────────────────
    section("Sites: SVG logos are sanitized and fail closed (they go to a public bucket)");
    {
      const clean = (svg: string) => media.sanitizeSvg(Buffer.from(svg, "utf8"));
      const legit = clean('<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY ns_svg "http://www.w3.org/2000/svg">]><svg xmlns="&ns_svg;" viewBox="0 0 10 10"><image href="data:image/png;base64,iVBORw0KGgo=" width="10" height="10"/><path fill="#1b7a8c" d="M0 0h10v10H0z"/></svg>');
      check("normal logo (Illustrator namespace entity, paths, embedded PNG) → untouched and publishable", !legit.changed && legit.safe);
      const onload = clean('<svg/onload=alert(1) xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>');
      check("<svg/onload=…> (no space before the handler) → stripped, publishable", onload.changed && onload.safe && !onload.buf.toString().includes("onload"), onload.buf.toString());
      const scripted = clean('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><iframe src="x"></iframe><path d="M0 0"/></svg>');
      check("<script> / <iframe> → removed, publishable", scripted.changed && scripted.safe && !/<script|<iframe/i.test(scripted.buf.toString()));
      check("entity-encoded javascript: link → NOT publishable", clean('<svg xmlns="http://www.w3.org/2000/svg"><a href="&#106;avascript:alert(1)"><text>x</text></a></svg>').safe === false);
      check("SMIL <set> turning a link into javascript: → NOT publishable", clean('<svg xmlns="http://www.w3.org/2000/svg"><a><set attributeName="href" to="javascript:alert(1)"/><text>x</text></a></svg>').safe === false);
      check("DTD entity smuggling markup → NOT publishable", clean('<!DOCTYPE svg [<!ENTITY x "&#60;script&#62;alert(1)&#60;/script&#62;">]><svg xmlns="http://www.w3.org/2000/svg">&x;</svg>').safe === false);
    }

    // ──────────────────────────────────────────────────────────────────
    section("Sites: generation (stubbed model) — sources, validation retry, guards, public copies");
    let generatedSignup: Json & { id: string } = { id: "" };
    let generatedPhotoPath = "";
    {
      const s = await seedSite("Genera", {
        status: "nuevo",
        business_name: `ZZ ${RUN} Barbería Prueba`,
        business_type: "Barbería",
        services: ["corte", "barba"],
        differentiator: "Diseños a mano",
        site_goal: "citas",
        instagram: "@zz.barberia",
      });
      generatedSignup = s;
      const logo = await sharp({ create: { width: 64, height: 64, channels: 4, background: "#1b7a8cff" } }).png().toBuffer();
      const photo = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#c9a36b" } }).jpeg().toBuffer();
      const logoPath = await uploadPrivate(s.id, "logo", logo, "png", "image/png");
      const photoPath = await uploadPrivate(s.id, "photo", photo, "jpg", "image/jpeg");
      generatedPhotoPath = photoPath;
      await db.from("web_gratis_signups").update({ logo_paths: [logoPath], photo_paths: [photoPath] }).eq("id", s.id);

      const invalid = validDraft({ hero: { ...(validDraft().hero as Json), headline: "x".repeat(200) } });
      let n = 0;
      const anthropic = stubFetch(() => (++n === 1 ? toolResponse(invalid, "toolu_1") : toolResponse(validDraft(), "toolu_2")));
      const d = deps(anthropic.fn);
      clock = new Date(FUTURE.getTime() + 11 * 60_000);
      const job = await pipeline.claimNextJob(d, { onlySignupIds: [s.id] });
      check("submitted 11 min ago, no site → auto-start creates + leases the site", !!job && job.status === "generating" && job.generation_attempts === 1 && !!job.generation_lease_until, job);
      const outcome = job ? await pipeline.runJob(job, d) : null;
      check("job ok", outcome?.ok === true, outcome);
      const first = anthropic.calls[0]?.body as Json | undefined;
      const firstContent = ((first?.messages as Json[] | undefined)?.[0]?.content ?? []) as Json[];
      check("model call 1: system prompt + guardar_sitio tool + logo and photo as images", typeof first?.system === "string" && ((first?.tools as Json[]) ?? [])[0]?.name === "guardar_sitio" && firstContent.filter((b) => b.type === "image").length === 2, firstContent.map((b) => b.type));
      check("tool schema carries the contract limits (headline maxLength 90)", JSON.stringify(first?.tools).includes('"maxLength":90'));
      const second = anthropic.calls[1]?.body as Json | undefined;
      const retryMsgs = (second?.messages as Json[] | undefined) ?? [];
      const toolResult = ((retryMsgs[2]?.content ?? []) as Json[])[0];
      check("invalid draft → retried once with the Zod errors as an is_error tool_result", anthropic.calls.length === 2 && retryMsgs[1]?.role === "assistant" && toolResult?.type === "tool_result" && toolResult?.is_error === true && String(toolResult?.content).includes("hero.headline"), toolResult);
      check("…and the assistant turn is echoed unchanged (thinking block kept)", JSON.stringify(retryMsgs[1]?.content).includes('"type":"thinking"'));

      const { data: row } = await db.from("web_gratis_sites").select("*").eq("signup_id", s.id).single();
      check("site → draft, version 1, generated_at, lease released", row?.status === "draft" && row?.version === 1 && !!row?.generated_at && row?.generation_lease_until === null, row?.status);
      check("content passes SiteContentV1", contract.siteContentSchema.safeParse(row?.content).success);
      const c = row?.content as {
        contact: Json; footer: Json; business: Json; services: { items: { price: string | null; image: Json | null }[] }; about: { body: string[] }; hero: { image: { src: string } | null };
        gallery: unknown[]; theme: { logo: { src: string } | null; palette: Record<string, string> };
      };
      check("server-filled contact: whatsapp digits, per-goal message, instagram URL, no website", c.contact.whatsapp === s.whatsapp.replace(/\D/g, "") && String(c.contact.whatsappMessage).includes("agendar") && c.contact.instagram === "https://www.instagram.com/zz.barberia" && c.contact.website === null, c.contact);
      check("footer credit + referral link with the client's code", c.footer.credit === "Hecho por MachineMind · ¿Quiere su web gratis?" && c.footer.referralUrl === `https://machinemindconsulting.com/web?ref=${s.referral_code}`);
      check("country from the signup (never the model; derived from +503 when the column is empty)", c.business.country === "SV", c.business.country);
      check("invented price $12 removed", c.services.items[0].price === null, c.services.items);
      check("invented founding year sentence removed, true sentence kept", c.about.body.join(" ") === "Cortamos con tijera y navaja.", c.about.body);
      check("hero photo not repeated in the gallery", c.gallery.length === 0, c.gallery);
      check("palette brought to AA", contrast.contrastRatio(c.theme.palette.text, c.theme.palette.bg) >= 4.5 && contrast.contrastRatio(c.theme.palette.primaryText, c.theme.palette.primary) >= 4.5, c.theme.palette);
      const pubPrefix = `/storage/v1/object/public/web-gratis-public/${row?.slug}/`;
      check("logo + hero point at the public bucket under <slug>/", String(c.theme.logo?.src).includes(pubPrefix) && String(c.hero.image?.src).includes(pubPrefix), [c.theme.logo?.src, c.hero.image?.src]);
      const { data: objs } = await db.storage.from("web-gratis-public").list(String(row?.slug), { limit: 20 });
      const names = (objs ?? []).map((o: { name: string }) => o.name);
      check("public copies keep the file names", names.includes(logoPath.split("/")[1]) && names.includes(photoPath.split("/")[1]), names);
      const dl = await db.storage.from("web-gratis-public").download(`${row?.slug}/${photoPath.split("/")[1]}`);
      check("…and the same bytes", !!dl.data && sha(Buffer.from(await dl.data.arrayBuffer())) === sha(photo));
      const src = row?.sources as Json & { guards: { pricesRemoved: string[]; sentencesRemoved: string[]; contrastFixes: string[] }; photos: { usedIn: string[] }[]; logo: { how: string } };
      check("sources record: logo seen, photo used in hero, guards that fired, retry feedback", src.logo.how.startsWith("visto") && src.photos[0].usedIn.includes("hero") && src.guards.pricesRemoved.includes("$12") && src.guards.sentencesRemoved.length >= 1 && src.guards.contrastFixes.length >= 1 && String(src.retryFeedback).includes("hero.headline"), src);
      check("signup nuevo → en_construccion", (await signup(s.id)).status === "en_construccion");
      const ready = alerts.find((a) => a.kind === "site_ready" && a.signupId === s.id);
      check("🟢 WEB LISTA PARA REVISAR alert with the preview link (mm-sites /p/<slug>?t=)", !!ready && ready.html.includes("WEB LISTA PARA REVISAR") && ready.html.includes(`${MM.url}/p/${row?.slug}?t=${row?.preview_token}`), ready?.html);
      const again = await pipeline.claimNextJob(d, { onlySignupIds: [s.id] });
      check("nothing left to claim for that signup", again === null);
    }

    // ──────────────────────────────────────────────────────────────────
    section("Sites: auto-start waits 10 min; dry run writes nothing; sourcePrices only with documents");
    {
      const fresh = await seedSite("Reciente", { status: "nuevo" });
      const stub = stubFetch(() => toolResponse(validDraft()));
      clock = new Date(FUTURE.getTime() + 5 * 60_000);
      const none = await pipeline.claimNextJob(deps(stub.fn), { onlySignupIds: [fresh.id] });
      const { count } = await db.from("web_gratis_sites").select("id", { count: "exact", head: true }).eq("signup_id", fresh.id);
      check("submitted 5 min ago → not started, no row", none === null && count === 0 && stub.calls.length === 0);
      const withSite = await seedSite("Ya tiene", { status: "en_construccion" });
      await pipeline.ensureSiteRow(withSite);
      const without = await seedSite("Sin web", { status: "en_construccion" });
      const cands = await pipeline.autoStartCandidates(new Date(FUTURE.getTime() + 11 * 60_000), [withSite.id, without.id]);
      check("auto-start candidates exclude signups that already have a site IN the query (drafts awaiting review never starve new signups)", cands.length === 1 && cands[0].id === without.id && !("web_gratis_sites" in cands[0]), cands.map((c: { id: string; business_name: string }) => c.business_name));

      const dry = await seedSite("Seco", { status: "nuevo", services: ["corte"] });
      const photo = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#224466" } }).jpeg().toBuffer();
      const photoPath = await uploadPrivate(dry.id, "photo", photo, "jpg", "image/jpeg");
      const menu = await sharp({ create: { width: 300, height: 400, channels: 3, background: "#f4efe6" } }).jpeg().toBuffer();
      const menuPath = await uploadPrivate(dry.id, "document", menu, "jpg", "image/jpeg");
      await db.from("web_gratis_signups").update({ photo_paths: [photoPath], document_paths: [menuPath] }).eq("id", dry.id);
      const drySlug = `zz-${RUN.toLowerCase()}-seco-dry`;
      const withHours = { hours: { title: "Horario", lines: ["Lunes a sábado: 9:00 a.m. – 6:00 p.m."] } };
      const res = await generate.generateSite(
        { signup: await signup(dry.id), slug: drySlug, instructions: null, dryRun: true },
        { fetch: stubFetch(() => toolResponse(validDraft({ sourcePrices: ["Corte $12"] }))).fn, apiKey: "k", model: "m", now, deadline: Date.now() + 60_000 },
      );
      const { count: siteRows } = await db.from("web_gratis_sites").select("id", { count: "exact", head: true }).eq("signup_id", dry.id);
      const { data: pubObjs } = await db.storage.from("web-gratis-public").list(drySlug, { limit: 5 });
      check("dry run → valid content, no site row, no public copies", contract.siteContentSchema.safeParse(res.content).success && siteRows === 0 && (pubObjs ?? []).length === 0);
      check("dry run images are signed private links", String(res.content.hero.image?.src).includes("/object/sign/web-gratis/"), res.content.hero.image?.src);
      check("a document (menu image) was read → a price the model quoted verbatim in sourcePrices is kept", res.content.services.items[0].price === "$12" && res.sources.documents?.[0]?.read === true, [res.content.services.items[0], res.sources.documents]);

      const photoOnly = await generate.generateSite(
        { signup: { ...(await signup(dry.id)), document_paths: [] }, slug: drySlug, instructions: null, dryRun: true },
        { fetch: stubFetch(() => toolResponse(validDraft({ sourcePrices: ["Corte $12", "1987"], ...withHours }))).fn, apiKey: "k", model: "m", now, deadline: Date.now() + 60_000 },
      );
      check("only a photo (no document) → the model's sourcePrices are NOT trusted: price removed, invented year still dropped", photoOnly.content.services.items[0].price === null && !photoOnly.content.about.body.join(" ").includes("1987") && (photoOnly.sources.sourcePrices ?? []).length === 0, [photoOnly.content.services.items[0], photoOnly.content.about.body]);
      check("…and hours the client never gave (no form hours, no document) are dropped", photoOnly.content.hours === null, photoOnly.content.hours);

      const foreign = await generate.generateSite(
        { signup: { ...(await signup(dry.id)), photo_paths: [generatedPhotoPath, photoPath], document_paths: [`${dry.id}/../${generatedSignup.id}/x.pdf`] }, slug: drySlug, instructions: null, dryRun: true },
        { fetch: stubFetch(() => toolResponse(validDraft())).fn, apiKey: "k", model: "m", now, deadline: Date.now() + 60_000 },
      );
      check("paths outside the signup's own folder are never read or linked (another client's photo, '..')", !JSON.stringify(foreign.content).includes(generatedSignup.id) && !JSON.stringify(foreign.sources).includes(generatedSignup.id) && String(foreign.content.hero.image?.src).includes(dry.id), foreign.sources.photos);
      const noDocs = await generate.generateSite(
        { signup: { ...(await signup(generatedSignup.id)), logo_paths: [], photo_paths: [], document_paths: [] }, slug: drySlug, instructions: null, dryRun: true },
        { fetch: stubFetch(() => toolResponse(validDraft({ hero: { ...(validDraft().hero as Json), image: null }, services: { title: "S", intro: null, items: [{ name: "Corte", description: null, price: "$12", image: null }] }, sourcePrices: ["Corte $12"] }))).fn, apiKey: "k", model: "m", now, deadline: Date.now() + 60_000 },
      );
      check("no file was read → the same sourcePrices claim is ignored, price removed", noDocs.content.services.items[0].price === null, noDocs.content.services.items[0]);
    }

    // ──────────────────────────────────────────────────────────────────
    section("Sites: lease exclusivity, attempts cap → failed + URGENTE alert");
    {
      const s = await seedSite("Lease", { status: "en_construccion" });
      const { site } = await pipeline.ensureSiteRow(s);
      const d = deps(stubFetch(() => toolResponse(validDraft())).fn);
      clock = new Date();
      const racers = await Promise.all([1, 2, 3, 4, 5].map(() => pipeline.claimSite(site.id, d)));
      check("5 concurrent claims → exactly 1 lease", racers.filter(Boolean).length === 1, racers.filter(Boolean).length);
      check("while leased → nobody else can claim", (await pipeline.claimSite(site.id, d)) === null);
      clock = new Date(Date.now() + 6 * 60_000);
      const late = await pipeline.claimSite(site.id, d);
      check("lease expired (crashed run) → reclaimable, attempt 2", late?.generation_attempts === 2, late?.generation_attempts);

      const f = await seedSite("Falla", { status: "en_construccion", services: ["corte"] });
      const { site: fs } = await pipeline.ensureSiteRow(f);
      const broken = stubFetch(() => toolResponse({ nope: true }));
      const fd = deps(broken.fn);
      const outcomes: unknown[] = [];
      for (let i = 0; i < 3; i++) {
        clock = new Date(Date.now() + i * 10 * 60_000);
        const claimed = await pipeline.claimSite(fs.id, fd);
        outcomes.push(claimed ? await pipeline.runJob(claimed, fd) : null);
      }
      const { data: after } = await db.from("web_gratis_sites").select("*").eq("id", fs.id).single();
      check("invalid output 3 times → 'failed' with the validation error", after?.status === "failed" && String(after?.generation_error).includes("validación") && after?.generation_attempts === 3, { st: after?.status, err: after?.generation_error, n: after?.generation_attempts });
      check("each attempt = 2 model calls (draft + one correction)", broken.calls.length === 6, broken.calls.length);
      const urgent = alerts.filter((a) => a.kind === "site_failed" && a.signupId === f.id);
      check("exactly one 🚨 URGENTE alert", urgent.length === 1 && urgent[0].html.includes("URGENTE — no se pudo generar la web"), urgent.length);
      clock = new Date(Date.now() + 60 * 60_000);
      check("failed site is never claimed again", (await pipeline.claimSite(fs.id, fd)) === null);

      const r = await seedSite("Rechazo", { status: "en_construccion" });
      const { site: rs } = await pipeline.ensureSiteRow(r);
      const refusal = stubFetch(() => ({ status: 200, json: { id: "m", model: "m", content: [], stop_reason: "refusal", stop_details: { category: "zz" }, usage: { input_tokens: 1, output_tokens: 1 } } }));
      const rd = deps(refusal.fn);
      clock = new Date();
      const rc = await pipeline.claimSite(rs.id, rd);
      const ro = rc ? await pipeline.runJob(rc, rd) : null;
      check("model refusal → failed at once (not retried)", ro?.ok === false && (ro as { final: boolean }).final === true && (await db.from("web_gratis_sites").select("status").eq("id", rs.id).single()).data?.status === "failed");

      const nk = await seedSite("Sin clave", { status: "en_construccion" });
      const { site: ns } = await pipeline.ensureSiteRow(nk);
      const nd = deps(stubFetch(() => toolResponse(validDraft())).fn, false);
      const nc = await pipeline.claimSite(ns.id, nd);
      const no = nc ? await pipeline.runJob(nc, nd) : null;
      check("no ANTHROPIC_API_KEY → clear error, stays queued for the next attempt", no?.ok === false && String((no as { reason: string }).reason).includes("ANTHROPIC_API_KEY") && (await db.from("web_gratis_sites").select("status").eq("id", ns.id).single()).data?.status === "generating");
    }

    // ──────────────────────────────────────────────────────────────────
    section("Sites: board 'Generar ahora' / 'Regenerar'");
    {
      const d = deps(stubFetch(() => toolResponse(validDraft())).fn);
      const { s, site } = await draftSite("Regenera");
      const res = await pipeline.requestGeneration(s.id, "Colores más cálidos", d);
      check("draft → queued again with Phil's instructions, attempts reset", res.ok && res.site.status === "generating" && res.site.instructions === "Colores más cálidos" && res.site.generation_attempts === 0, res);
      await db.from("web_gratis_sites").update({ status: "published", published_at: new Date().toISOString() }).eq("id", site.id);
      const pub = await pipeline.requestGeneration(s.id, null, d);
      check("published → refused (pause first / use the editor)", !pub.ok && pub.code === "not_eligible" && pub.message.includes("publicada"), pub);
      const drafty = await seedSite("Borrador", { status: "borrador", submitted_at: null, terms_accepted_at: null, share_commitment_at: null, step: 1 });
      const b = await pipeline.requestGeneration(drafty.id, null, d);
      check("unfinished form → refused", !b.ok && b.code === "not_eligible");
    }

    // ──────────────────────────────────────────────────────────────────
    section("Sites: publish happy path → signup entregada through the board's PATCH → 'Web lista' due");
    {
      const { s, site } = await draftSite("Publica");
      const stub = stubFetch(vercelRoutes());
      const res = await publish.publishSite(site.id, { now, fetch: stub.fn, vercel: VERCEL, mm: MM, alert: deps(stub.fn).alert, markDelivered: boardDelivery });
      const host = `${site.slug}.machinemindconsulting.com`;
      const deliveredAt = (await signup(s.id)).delivered_at;
      await futureDelivery(s.id);
      check("publish ok, delivered 'marked'", res.ok && res.delivered === "marked" && res.url === `https://${host}`, res);
      const add = stub.calls.find((c) => c.method === "POST" && c.url.includes("/v10/projects/prj_ZZ/domains"));
      check("Vercel: POST /v10/projects/{id}/domains?teamId= {name: <slug>.machinemindconsulting.com} with the bearer token", !!add && add.body?.name === host && add.url.includes("teamId=team_ZZ") && add.headers.authorization === "Bearer zz-vercel-token", add);
      check("Vercel: project domain + DNS config checked", stub.calls.some((c) => c.url.includes(`/v9/projects/prj_ZZ/domains/${host}`)) && stub.calls.some((c) => c.url.includes(`/v6/domains/${host}/config`)));
      const reval = stub.calls.find((c) => c.url === `${MM.url}/api/revalidate`);
      check("mm-sites revalidate {slug} with x-revalidate-secret", reval?.body?.slug === site.slug && reval?.headers["x-revalidate-secret"] === MM.revalidateSecret, reval);
      const { data: live } = await db.from("web_gratis_sites").select("*").eq("id", site.id).single();
      check("site published + published_at", live?.status === "published" && !!live?.published_at);
      const su = await signup(s.id);
      check("signup → entregada, site_url = https://<slug>.machinemindconsulting.com, delivered_at + free month", su.status === "entregada" && su.site_url === `https://${host}` && !!deliveredAt && !!su.free_until, [su.status, su.site_url, su.free_until]);
      check("✅ WEB PUBLICADA alert", alerts.some((a) => a.kind === "site_published" && a.signupId === s.id && a.html.includes("WEB PUBLICADA")));

      // T2 ("Web lista") is now the scheduler's job — prove it fires with this URL. The fake clock
      // is a Monday 10:00 SV at least a week ahead, so this row's delivered_at stays in the FUTURE
      // in real time: the live production cron can never see it as due (a fixed date would turn
      // into a real "Web lista" WhatsApp to the random test number once it passed).
      const svMon10 = futureSvMonday10();
      await db.from("web_gratis_signups").update({ delivered_at: new Date(svMon10.getTime() - 60 * 60_000).toISOString() }).eq("id", s.id);
      const eligible = core.wa.templateStillApplies("cqv_web_ready", await signup(s.id), svMon10);
      check("T2 eligible (entregada + site_url + delivered_at)", eligible === true);
      const waDeps = { now: () => svMon10, send: (req: unknown) => core.rewired.sendViaRewired(req, { baseUrl: mock.url, secret: BRIDGE_SECRET, timeoutMs: 4000 }), alert: async () => true, sleep: async () => undefined, settings: async () => core.server.loadSettings() };
      await core.wa.runWhatsAppScheduler(waDeps, { onlySignupIds: [s.id], spacingMs: 0, maxSends: 5, deadline: Date.now() + 30_000 });
      const sent = mock.calls.find((c) => c.to === s.whatsapp && c.template?.name === "cqv_web_ready");
      check("scheduler sends cqv_web_ready with the published URL", sent?.template?.bodyParams?.[0] === `https://${host}` && sent?.template?.buttonParam === s.referral_code, sent);

      const stub2 = stubFetch(vercelRoutes({ addStatus: 409 }));
      const again = await publish.publishSite(site.id, { now, fetch: stub2.fn, vercel: VERCEL, mm: MM, alert: deps(stub2.fn).alert, markDelivered: boardDelivery });
      check("publish again (domain already on the project → 409 then found) → ok, not re-delivered", again.ok && again.delivered === "already" && (await signup(s.id)).status === "entregada", again);
    }

    // ──────────────────────────────────────────────────────────────────
    section("Sites: publish failures never deliver");
    {
      const { s, site } = await draftSite("DNS falta");
      const stub = stubFetch(vercelRoutes({ misconfigured: true }));
      const res = await publish.publishSite(site.id, { now, fetch: stub.fn, vercel: VERCEL, mm: MM, alert: deps(stub.fn).alert, markDelivered: boardDelivery });
      check("DNS misconfigured → Spanish 'Falta el registro DNS comodín…' error", !res.ok && res.message.includes("Falta el registro DNS comodín *.machinemindconsulting.com en GoDaddy"), res);
      const su = await signup(s.id);
      const { data: row } = await db.from("web_gratis_sites").select("status, published_at").eq("id", site.id).single();
      check("…site stays draft, signup NOT delivered, no revalidate", row?.status === "draft" && !row?.published_at && su.status === "en_construccion" && !su.site_url && !su.delivered_at && !stub.calls.some((c) => c.url.includes("/api/revalidate")), [row, su.status, su.site_url]);
      const noEnv = await publish.publishSite(site.id, { now, fetch: stub.fn, vercel: null, mm: MM, alert: deps(stub.fn).alert, markDelivered: boardDelivery });
      check("Vercel env missing → 503 not_configured naming the variables", !noEnv.ok && noEnv.status === 503 && noEnv.code === "not_configured" && noEnv.message.includes("VERCEL_TOKEN"), noEnv);
      const denied = await publish.publishSite(site.id, { now, fetch: stubFetch(vercelRoutes({ addStatus: 403 })).fn, vercel: VERCEL, mm: MM, alert: deps(stub.fn).alert, markDelivered: boardDelivery });
      check("Vercel 403 → token error, not delivered", !denied.ok && denied.message.includes("token de Vercel") && (await signup(s.id)).status === "en_construccion", denied);
      const configDenied = await publish.publishSite(site.id, { now, fetch: stubFetch(vercelRoutes({ configStatus: 403 })).fn, vercel: VERCEL, mm: MM, alert: deps(stub.fn).alert, markDelivered: boardDelivery });
      check("Vercel DNS-config lookup fails (403) → says it couldn't check (not 'falta el DNS'), not delivered", !configDenied.ok && configDenied.message.includes("no dejó comprobar el DNS") && !configDenied.message.includes("GoDaddy") && (await signup(s.id)).status === "en_construccion", configDenied);
      const unverified = await publish.publishSite(site.id, { now, fetch: stubFetch(vercelRoutes({ verified: false })).fn, vercel: VERCEL, mm: MM, alert: deps(stub.fn).alert, markDelivered: boardDelivery });
      check("Vercel asks for TXT verification → not published, record shown", !unverified.ok && unverified.message.includes("TXT _vercel.zz = vc-zz"), unverified);
      const { s: ps, site: psite } = await draftSite("Pausada", { status: "pausada", paused_at: new Date().toISOString() });
      const paused = await publish.publishSite(psite.id, { now, fetch: stub.fn, vercel: VERCEL, mm: MM, alert: deps(stub.fn).alert, markDelivered: boardDelivery });
      check("signup pausada → refused before touching Vercel", !paused.ok && paused.code === "not_eligible" && (await signup(ps.id)).status === "pausada", paused);
    }

    // ──────────────────────────────────────────────────────────────────
    section("Sites: quick edits, slug, pause / resume, revalidation sweep");
    {
      const { s, site } = await draftSite("Edita");
      const stub = stubFetch(vercelRoutes());
      const pd = { now, fetch: stub.fn, mm: MM };
      const stale = await publish.editSiteContent(site.id, { tagline: "Nueva" }, 0, pd);
      check("stale version → 409, nothing saved", !stale.ok && stale.status === 409);
      const edited = await publish.editSiteContent(
        site.id,
        { tagline: "Cortes con calma", services: [{ from: 0, name: "Corte clásico", description: "A tijera.", price: "$10" }, { from: null, name: "Barba", description: null, price: null }], palette: { text: "#bbbbbb" } },
        1,
        pd,
      );
      const ec = edited.ok ? (edited.site.content as { business: { tagline: string }; services: { items: { name: string; price: string | null; image: Json | null }[] }; theme: { palette: Record<string, string> } }) : null;
      check("edits saved → version 2", edited.ok && edited.site.version === 2 && ec?.business.tagline === "Cortes con calma", edited);
      check("service edited in place keeps its image; new service has none; Phil's price kept", ec?.services.items[0].image !== null && ec?.services.items[0].price === "$10" && ec?.services.items[1].image === null);
      check("low-contrast text color → fixed to AA on save, reported", !!ec && contrast.contrastRatio(ec.theme.palette.text, ec.theme.palette.bg) >= 4.5 && edited.ok && edited.fixes.length > 0);
      check("draft edit → no cache purge", !stub.calls.some((c) => c.url.includes("/api/revalidate")));
      const tooLong = await publish.editSiteContent(site.id, { tagline: "x".repeat(130) }, 2, pd);
      check("invalid edit (tagline > 120) → 400 via SiteContentV1", !tooLong.ok && tooLong.status === 400, tooLong);

      const { site: other } = await draftSite("Edita otro");
      check("slug: reserved → 400", (await publish.changeSlug(site.id, "admin")).ok === false);
      const taken = await publish.changeSlug(site.id, other.slug);
      check("slug: taken by another site → 409 duplicate", !taken.ok && taken.code === "duplicate", taken);
      const newSlug = `zz-${RUN.toLowerCase()}-edita-nuevo`;
      const moved = await publish.changeSlug(site.id, newSlug);
      check("slug: free → changed before publishing", moved.ok && moved.site.slug === newSlug, moved);

      const pub = await publish.publishSite(site.id, { now, fetch: stub.fn, vercel: VERCEL, mm: MM, alert: deps(stub.fn).alert, markDelivered: boardDelivery });
      await futureDelivery(s.id);
      check("published under the new slug", pub.ok && pub.url === `https://${newSlug}.machinemindconsulting.com`, pub);
      check("slug after publishing → refused", !(await publish.changeSlug(site.id, `${newSlug}-x`)).ok);
      const n0 = stub.calls.filter((c) => c.url.includes("/api/revalidate")).length;
      const liveEdit = await publish.editSiteContent(site.id, { ctaLabel: "Agendar" }, (await db.from("web_gratis_sites").select("version").eq("id", site.id).single()).data?.version, pd);
      check("edit of a published site → cache purged", liveEdit.ok && stub.calls.filter((c) => c.url.includes("/api/revalidate")).length === n0 + 1);
      const paused = await publish.setSitePaused(site.id, true, pd);
      check("Pausar sitio → paused + purge", paused.ok && paused.site.status === "paused" && !!paused.site.paused_at);
      const resumed = await publish.setSitePaused(site.id, false, pd);
      check("Reanudar → published again", resumed.ok && resumed.site.status === "published" && resumed.site.paused_at === null);

      const sweepStub = stubFetch(vercelRoutes());
      await db.from("web_gratis_signups").update({ notes: `zz sweep ${Date.now()}` }).eq("id", s.id);
      const swept = await pipeline.sweepRevalidations({ ...deps(sweepStub.fn), now: () => new Date() }, [s.id]);
      check("signup changed (e.g. auto-paused by the scheduler) → its live site's cache is purged by the sweep", swept === 1 && sweepStub.calls.some((c) => c.body?.slug === newSlug), swept);
    }
  } finally {
    try {
      console.log(await purge());
    } catch (purgeError) {
      console.error("sites purge failed (the final cleanup removes ZZ rows)", purgeError);
    }
    await mock.close();
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    console.log(`\nsites: alerts captured in-process: ${alerts.length} (none written to the real outbox), system: ${systemAlerts.length}`);
  }
}
