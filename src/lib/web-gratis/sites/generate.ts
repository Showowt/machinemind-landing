/**
 * Website generator: one signup (form + logo + photos + documents) → one
 * SiteContentV1, ready for Phil to review.
 *
 *  1. Sources: the newest logo (raster → the model sees it for the palette; SVG →
 *     its declared colors + a render when sharp exists; PDF → read as a
 *     document; AI/EPS/PSD/HEIC → noted for the team), up to 8 photos (seen,
 *     for alt text and hero / gallery / service choice), up to 3 PDFs ≤ 10 MB
 *     and up to 3 document images (menus, price lists). Anything else is
 *     listed as "not read" for the team.
 *  2. The model writes the site through the `guardar_sitio` tool; the draft is
 *     validated (tool schema, then SiteContentV1) and, if invalid, sent back
 *     once with the validation errors.
 *  3. Server-side: contact data, footer, country and logo are filled from the
 *     signup (never by the model); honesty guards drop invented prices,
 *     numbers, testimonials and claims; the palette is brought to WCAG AA.
 *  4. Unless it's a dry run, the logo and every photo the site uses are copied
 *     (same bytes, same name) to the public bucket under <slug>/ and the
 *     content points at their public URLs. A dry run writes nothing and points
 *     at 7-day signed URLs of the private files instead.
 *  5. Place photos (imagery.ts): a place-bound business (tours, events, real
 *     estate, services with a city) with fewer than 2 usable photos gets up to 6
 *     credited reference photos of its city / area from Wikimedia Commons, shown
 *     to the model as "Lugar N". They go only to the hero and an all-place
 *     gallery, never on services, and only when the final vertical allows them.
 *     Used ones are copied to <slug>/stock-<pageid>.jpg (a dry run hotlinks
 *     Commons' own 1920 px file).
 */
import { countryFromE164, referralLink } from "../config";
import { getDb, storage, type WebGratisSignup } from "../server";
import { siteContentSchema, slugify, type SiteContentV1, type SiteImage } from "../site-content";
import { createMessage, type ContentBlockParam, type MessageParam, type ResponseBlock } from "./anthropic";
import { fixPalette } from "./contrast";
import { PUBLIC_BUCKET, type SiteSources } from "./db";
import { clip, CopyGuard, emailOrNull, facebookUrl, guardContent, instagramUrl, locationFrom, norm, servesEnglishSpeakers, whatsappMessageFor } from "./guards";
import { gatherPlaceImagery, placeImage, planPlaceImagery, publishPlacePhoto, STOCK_VERTICALS, stockPath, type PlacePhoto } from "./imagery";
import { CONTENT_TYPE, contractSize, forVision, imageSize, loadSharp, sanitizeSvg, sniff, svgColors, WEB_IMAGE_KINDS, type MediaKind } from "./media";
import { buildBrief, MAX_PHOTOS, siteDraftSchema, siteTool, SYSTEM_PROMPT, TOOL_NAME, type BriefFile, type SiteDraft } from "./prompt";

export const FOOTER_CREDIT = "Hecho por MachineMind · ¿Quiere su web gratis?";
const MAX_PDFS = 3;
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_DOC_IMAGES = 3;
/** Keep the request well under the API's 32 MB. */
const REQUEST_MEDIA_BUDGET = 20 * 1024 * 1024;
const MAX_TOKENS = 16_000;
const EFFORT = "high";
/** The place-photo step gets at most this long, and always leaves the site model this much. */
const IMAGERY_BUDGET_MS = 85_000;
const IMAGERY_RESERVE_MS = 150_000;

/** Every visible text of a site except image alts (which may name what a photo shows). */
function visibleTexts(c: SiteContentV1): string[] {
  return [
    c.business.tagline,
    c.business.type,
    c.seo.title,
    c.seo.description,
    ...c.seo.keywords,
    c.hero.eyebrow,
    c.hero.headline,
    c.hero.subheadline,
    c.about.title,
    ...c.about.body,
    ...c.about.highlights,
    c.services.title,
    c.services.intro ?? "",
    ...c.services.items.flatMap((i) => [i.name, i.description ?? ""]),
    ...(c.differentiators ? [c.differentiators.title, ...c.differentiators.items.flatMap((d) => [d.title, d.body])] : []),
    ...(c.hours ? [c.hours.title, ...c.hours.lines] : []),
    ...(c.location ? [c.location.title, c.location.areaServed ?? ""] : []),
    c.contact.title,
    c.contact.body,
    ...c.faq.flatMap((f) => [f.q, f.a]),
  ];
}

/** The same content with `from` replaced by `to` in every visible text (image alts untouched). */
function replaceInTexts(c: SiteContentV1, from: RegExp, to: string): SiteContentV1 {
  const r = (t: string) => t.replace(from, to).replace(/\s{2,}/g, " ").trim();
  const ro = (t: string | null) => (t === null ? null : r(t));
  return {
    ...c,
    business: { ...c.business, tagline: r(c.business.tagline), type: r(c.business.type) },
    seo: { ...c.seo, title: r(c.seo.title), description: r(c.seo.description), keywords: c.seo.keywords.map(r) },
    hero: { ...c.hero, eyebrow: r(c.hero.eyebrow), headline: r(c.hero.headline), subheadline: r(c.hero.subheadline) },
    about: { ...c.about, title: r(c.about.title), body: c.about.body.map(r), highlights: c.about.highlights.map(r) },
    services: {
      ...c.services,
      title: r(c.services.title),
      intro: ro(c.services.intro),
      items: c.services.items.map((i) => ({ ...i, name: r(i.name), description: ro(i.description) })),
    },
    differentiators: c.differentiators
      ? { title: r(c.differentiators.title), items: c.differentiators.items.map((d) => ({ title: r(d.title), body: r(d.body) })) }
      : null,
    hours: c.hours ? { title: r(c.hours.title), lines: c.hours.lines.map(r) } : null,
    location: c.location ? { ...c.location, title: r(c.location.title), areaServed: ro(c.location.areaServed) } : null,
    contact: { ...c.contact, title: r(c.contact.title), body: r(c.contact.body) },
    faq: c.faq.map((f) => ({ q: r(f.q), a: r(f.a) })),
  };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export class GenerationError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "GenerationError";
  }
}

export interface GenerateDeps {
  fetch: typeof fetch;
  apiKey: string;
  model: string;
  now: () => Date;
  /** Epoch ms by which everything (model calls + copies) must be done. */
  deadline: number;
}

export interface GenerateInput {
  signup: WebGratisSignup;
  slug: string;
  instructions: string | null;
  /** Return the content without copying anything to the public bucket. */
  dryRun: boolean;
  /** Look for place photos when the business qualifies (default true). */
  placeImagery?: boolean;
}

export interface GenerateResult {
  content: SiteContentV1;
  sources: SiteSources;
}

// ─── Client files ───────────────────────────────────────────────────────────

interface ClientFile {
  path: string;
  role: "logo" | "photo" | "document";
  kind: MediaKind;
  buf: Buffer;
  size: { width: number; height: number } | null;
}

const COUNTRY_NAME: Record<string, string> = { SV: "El Salvador", CO: "Colombia", OTHER: "" };

function extOf(path: string): string {
  return (path.split(".").pop() ?? "").toLowerCase();
}

function baseName(path: string): string {
  return path.split("/").pop() ?? path;
}

async function download(path: string, role: ClientFile["role"]): Promise<{ file: ClientFile | null; note: string | null }> {
  try {
    const { data, error } = await storage().download(path);
    if (error || !data) throw error ?? new Error("empty download");
    const buf = Buffer.from(await data.arrayBuffer());
    const kind = sniff(buf);
    return { file: { path, role, kind, buf, size: imageSize(buf, kind) }, note: null };
  } catch (error) {
    console.error("[Sites:generate] download failed", path, error);
    return { file: null, note: "no se pudo descargar del almacenamiento" };
  }
}

const READABLE_DOC_EXT = new Set(["pdf", "jpg", "jpeg", "png", "webp", "gif", "heic", "heif"]);
const IMAGE_DOC_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

/** A plain file name: no folders, no "..", nothing a public path could be steered with. */
const SAFE_FILE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/;

/**
 * Only files inside this signup's own folder are read (and later copied to the
 * public bucket). The submit route already enforces this; the generator does
 * not rely on it, because a foreign path here would publish another client's file.
 */
function ownFile(signupId: string, path: string): boolean {
  const prefix = `${signupId}/`;
  if (!path.startsWith(prefix)) return false;
  const name = path.slice(prefix.length);
  return SAFE_FILE_NAME_RE.test(name) && !name.includes("..");
}

// ─── Main ───────────────────────────────────────────────────────────────────

export async function generateSite(input: GenerateInput, deps: GenerateDeps): Promise<GenerateResult> {
  const { signup, slug } = input;
  // Rows older than the country column: derive it from the number, like the rest of the funnel.
  const country = signup.country ?? countryFromE164(signup.whatsapp ?? "");
  const countryName = COUNTRY_NAME[country] ?? "";
  const sources: SiteSources = {
    model: deps.model,
    instructions: input.instructions,
    photos: [],
    documents: [],
    logo: null,
  };

  // 1. Download what the client sent (only files in the signup's own folder).
  const own = (paths: readonly string[] | null | undefined): string[] => {
    const list = Array.isArray(paths) ? paths : [];
    const kept = list.filter((p) => typeof p === "string" && ownFile(signup.id, p));
    if (kept.length !== list.length) console.error("[Sites:generate] ignored paths outside the signup folder", signup.id, list.filter((p) => !kept.includes(p)));
    return kept;
  };
  const logoPaths = [...own(signup.logo_paths)].reverse(); // newest first
  const photoPaths = own(signup.photo_paths).slice(0, MAX_PHOTOS);
  const docPaths = own(signup.document_paths);

  let logo: ClientFile | null = null;
  let logoNote: string | null = null;
  for (const p of logoPaths) {
    const r = await download(p, "logo");
    if (r.file) {
      logo = r.file;
      break;
    }
    logoNote = r.note;
  }
  const photoResults = await Promise.all(photoPaths.map((p) => download(p, "photo")));

  // 2. Build the model's view of them.
  const media: ContentBlockParam[] = [];
  const briefFiles: BriefFile[] = [];
  let budget = REQUEST_MEDIA_BUDGET;
  const fits = (b64: string) => {
    if (b64.length > budget) return false;
    budget -= b64.length;
    return true;
  };
  /**
   * A client document (PDF menu / price list, or an image sent as a document)
   * was actually attached. Only then are the model's `sourcePrices` — its own
   * report of numbers "taken from a file" — trusted, and hours accepted without
   * the form's hours field. A logo or product photo is not a price source.
   */
  let docsRead = false;

  // Logo
  let logoPublishable = false;
  let logoBytes: Buffer | null = null;
  if (logo) {
    let how = "no leído";
    let note: string | null = null;
    if (["png", "jpeg", "gif", "webp"].includes(logo.kind)) {
      const v = await forVision(logo.buf, logo.kind, "logo");
      if (v.image && fits(v.image.base64)) {
        media.push({ type: "text", text: "LOGO del negocio:" }, { type: "image", source: { type: "base64", media_type: v.image.mediaType, data: v.image.base64 } });
        how = "visto (colores y estilo)";
        briefFiles.push({ label: "Logo", line: "adjunto como imagen (primera imagen). Tome de él la paleta." });
      } else {
        note = v.note ?? "no cupo en la solicitud";
        briefFiles.push({ label: "Logo", line: "lo envió, pero no se pudo adjuntar; use el rubro y el estilo para la paleta." });
      }
      logoPublishable = true;
      logoBytes = logo.buf;
    } else if (logo.kind === "svg") {
      const colors = svgColors(logo.buf.toString("utf8"));
      sources.svgColors = colors;
      const sharp = await loadSharp();
      let seen = false;
      if (sharp) {
        try {
          const png = await sharp(logo.buf, { failOn: "none" }).resize({ width: 1024, height: 1024, fit: "inside" }).png().toBuffer();
          const b64 = png.toString("base64");
          if (fits(b64)) {
            media.push({ type: "text", text: "LOGO del negocio (SVG renderizado):" }, { type: "image", source: { type: "base64", media_type: "image/png", data: b64 } });
            seen = true;
          }
        } catch (error) {
          console.error("[Sites:generate] svg render failed", logo.path, error);
        }
      }
      how = seen ? "SVG visto + colores declarados" : "SVG: colores declarados";
      briefFiles.push({
        label: "Logo",
        line: `${seen ? "adjunto (SVG renderizado)" : "SVG (no adjunto como imagen)"}; colores declarados en el archivo: ${colors.length ? colors.join(", ") : "ninguno"}.`,
      });
      const clean = sanitizeSvg(logo.buf);
      if (!clean.safe) {
        // It goes to a public bucket: an SVG that still carries active content is never published.
        note = "SVG con código activo que no se pudo limpiar: no se publica; pídale el logo en PNG";
      } else {
        if (clean.changed) note = "SVG con código activo: se limpió antes de publicarlo";
        logoPublishable = true;
        logoBytes = clean.buf;
      }
    } else if (logo.kind === "pdf" && logo.buf.length <= MAX_PDF_BYTES) {
      const b64 = logo.buf.toString("base64");
      if (fits(b64)) {
        media.push({ type: "text", text: "LOGO del negocio (PDF):" }, { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 }, title: "Logo" });
        how = "PDF leído (solo para la paleta)";
      }
      note = "logo en PDF: no se puede mostrar en la web; pídale PNG o SVG";
      briefFiles.push({ label: "Logo", line: "adjunto como PDF (solo para tomar los colores)." });
    } else {
      note =
        logo.kind === "heic"
          ? "logo en HEIC: pídale PNG o JPG"
          : `logo en formato de diseño (${extOf(logo.path).toUpperCase() || "desconocido"}): no se puede leer ni mostrar; pídale PNG o SVG`;
      briefFiles.push({ label: "Logo", line: "lo envió en un formato que no se puede ver; use el rubro y el estilo para la paleta." });
    }
    sources.logo = { path: logo.path, how, publicUrl: null, note };
  } else if (logoPaths.length) {
    sources.logo = { path: logoPaths[0], how: "no leído", publicUrl: null, note: logoNote ?? "no se pudo descargar" };
  }

  // Photos (numbered 1…8 in upload order)
  interface PhotoSlot {
    n: number;
    file: ClientFile | null;
    seen: boolean;
    publishable: boolean;
    note: string | null;
  }
  const photos: PhotoSlot[] = [];
  for (let i = 0; i < photoResults.length; i++) {
    const r = photoResults[i];
    const n = i + 1;
    if (!r.file) {
      photos.push({ n, file: null, seen: false, publishable: false, note: r.note });
      briefFiles.push({ label: `Foto ${n}`, line: "no disponible (no la use)." });
      continue;
    }
    const f = r.file;
    const publishable = WEB_IMAGE_KINDS.includes(f.kind) && f.kind !== "svg";
    const v = publishable ? await forVision(f.buf, f.kind, "photo") : { image: null, note: f.kind === "heic" ? "formato HEIC (iPhone): pídale la foto en JPG" : `formato ${f.kind} no se puede mostrar` };
    let seen = false;
    if (v.image && fits(v.image.base64)) {
      media.push({ type: "text", text: `Foto ${n}${f.size ? ` (${f.size.width}×${f.size.height})` : ""}:` }, { type: "image", source: { type: "base64", media_type: v.image.mediaType, data: v.image.base64 } });
      seen = true;
    }
    photos.push({ n, file: f, seen, publishable, note: seen ? null : (v.note ?? "no cupo en la solicitud") });
    briefFiles.push({
      label: `Foto ${n}`,
      line: seen ? "adjunta." : publishable ? "no se pudo adjuntar (el servidor la pondrá al final de la galería; no la use)." : "no se puede mostrar en la web (no la use).",
    });
  }

  // Documents (menus, price lists, catalogs): one at a time, and only while there's room for
  // them — a client can attach up to 30 files of 25 MB; they are never all held in memory.
  let pdfs = 0;
  let docImages = 0;
  for (let i = 0; i < docPaths.length; i++) {
    const path = docPaths[i];
    const n = i + 1;
    const ext = extOf(path);
    if (!READABLE_DOC_EXT.has(ext)) {
      sources.documents?.push({ path, read: false, how: "no leído", note: `formato ${ext.toUpperCase() || "?"}: el generador no lo lee` });
      briefFiles.push({ label: `Documento ${n}`, line: "no se pudo leer (no lo mencione)." });
      continue;
    }
    if ((ext === "pdf" && pdfs >= MAX_PDFS) || (IMAGE_DOC_EXT.has(ext) && docImages >= MAX_DOC_IMAGES)) {
      sources.documents?.push({ path, read: false, how: "no leído", note: ext === "pdf" ? "más de 3 PDFs: no se leyó" : "más de 3 imágenes de documentos: no se leyó" });
      briefFiles.push({ label: `Documento ${n}`, line: "no leído (límite de archivos; no lo mencione)." });
      continue;
    }
    const r = await download(path, "document");
    if (!r.file) {
      sources.documents?.push({ path, read: false, how: "no leído", note: r.note });
      briefFiles.push({ label: `Documento ${n}`, line: "no se pudo leer (no lo mencione)." });
      continue;
    }
    const f = r.file;
    if (f.kind === "pdf") {
      if (pdfs >= MAX_PDFS || f.buf.length > MAX_PDF_BYTES) {
        const note = f.buf.length > MAX_PDF_BYTES ? `PDF de ${(f.buf.length / 1_048_576).toFixed(1)} MB (máx. 10 MB)` : "más de 3 PDFs: no se leyó";
        sources.documents?.push({ path, read: false, how: "no leído", note });
        briefFiles.push({ label: `Documento ${n}`, line: "PDF no leído." });
        continue;
      }
      const b64 = f.buf.toString("base64");
      if (!fits(b64)) {
        sources.documents?.push({ path, read: false, how: "no leído", note: "no cupo en la solicitud" });
        continue;
      }
      pdfs++;
      docsRead = true;
      media.push({ type: "text", text: `Documento ${n} (PDF del cliente: menú, lista de precios o catálogo):` }, { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 }, title: `Documento ${n}` });
      sources.documents?.push({ path, read: true, how: "PDF", note: null });
      briefFiles.push({ label: `Documento ${n}`, line: "PDF adjunto. Úselo para servicios y precios." });
      continue;
    }
    if (["png", "jpeg", "gif", "webp"].includes(f.kind) && docImages < MAX_DOC_IMAGES) {
      const v = await forVision(f.buf, f.kind, "photo");
      if (v.image && fits(v.image.base64)) {
        docImages++;
        docsRead = true;
        media.push({ type: "text", text: `Documento ${n} (imagen: posible menú o lista de precios; NO es una foto para la web):` }, { type: "image", source: { type: "base64", media_type: v.image.mediaType, data: v.image.base64 } });
        sources.documents?.push({ path, read: true, how: "imagen", note: null });
        briefFiles.push({ label: `Documento ${n}`, line: "imagen adjunta (léala; no la use como foto)." });
        continue;
      }
      sources.documents?.push({ path, read: false, how: "no leído", note: v.note ?? "no cupo en la solicitud" });
      continue;
    }
    sources.documents?.push({ path, read: false, how: "no leído", note: f.kind === "heic" ? "imagen HEIC: pídala en JPG o PDF" : `formato ${extOf(path).toUpperCase()}: el generador no lo lee` });
    briefFiles.push({ label: `Documento ${n}`, line: "no se pudo leer (no lo mencione)." });
  }

  // Place photos (Wikimedia Commons) for place-bound businesses without enough photos of their own.
  const usableClientPhotos = photos.filter((p) => p.publishable && p.file).length;
  const plan = input.placeImagery === false ? null : planPlaceImagery(signup, countryName, usableClientPhotos);
  const places: PlacePhoto[] = [];
  if (plan) {
    const imagery = await gatherPlaceImagery(
      plan,
      { businessName: signup.business_name, businessType: signup.business_type, style: signup.style, services: signup.services ?? [] },
      {
        fetch: deps.fetch,
        apiKey: deps.apiKey,
        model: deps.model,
        deadline: Math.min(Date.now() + IMAGERY_BUDGET_MS, deps.deadline - IMAGERY_RESERVE_MS),
      },
    );
    sources.stock = imagery.report;
    for (const p of imagery.photos) {
      if (!fits(p.vision.base64)) continue;
      media.push(
        { type: "text", text: `Lugar ${p.n} (foto de referencia del lugar, Wikimedia Commons; NO es del negocio${p.role === "hero" ? "; sugerida para el hero" : ""}):` },
        { type: "image", source: { type: "base64", media_type: p.vision.mediaType, data: p.vision.base64 } },
      );
      places.push(p);
    }
    if (places.length < imagery.photos.length) sources.stock.note = [sources.stock.note, "algunas fotos del lugar no cupieron en la solicitud"].filter(Boolean).join("; ");
  }
  const signupText = [signup.business_name, signup.business_type, (signup.services ?? []).join(" "), signup.differentiator, signup.extra_notes, signup.style].filter(Boolean).join("\n");
  const bilingual = servesEnglishSpeakers(signupText);
  // A place only the reference photos show (the capital, when the client gave just the country)
  // must never become the business's location in the copy.
  const clientPlaces = norm([signupText, signup.city, signup.address].filter(Boolean).join(" "));
  const unstatedPlace = places.length && plan?.place && !clientPlaces.includes(norm(plan.place)) ? plan.place : null;
  const unstatedIn = (c: SiteContentV1): boolean => (unstatedPlace ? norm(visibleTexts(c).join(" \n ")).includes(norm(unstatedPlace)) : false);

  const brief = buildBrief({
    businessName: signup.business_name,
    businessType: signup.business_type,
    city: signup.city,
    countryName: countryName || "(otro país)",
    services: signup.services ?? [],
    differentiator: signup.differentiator,
    hours: signup.hours,
    style: signup.style,
    goal: signup.site_goal,
    address: signup.address,
    instagram: signup.instagram,
    facebook: signup.facebook,
    existingWebsite: signup.existing_website,
    extraNotes: signup.extra_notes,
    files: briefFiles,
    places: places.map((p) => ({ n: p.n, role: p.role, alt: p.alt, title: p.candidate.title })),
    bilingual,
    instructions: input.instructions,
  });

  // 3. Image URLs (public after the copy; signed for a dry run).
  const publicPath = (f: ClientFile) => `${slug}/${baseName(f.path)}`;
  const urlOf = new Map<string, string>();
  const usable: ClientFile[] = [...(logo && logoPublishable ? [logo] : []), ...photos.filter((p) => p.publishable && p.file).map((p) => p.file as ClientFile)];
  if (input.dryRun) {
    if (usable.length) {
      const { data, error } = await storage().createSignedUrls(usable.map((f) => f.path), 60 * 60 * 24 * 7);
      if (error) console.error("[Sites:generate] dry-run signed urls", error);
      for (const s of data ?? []) if (s.path && s.signedUrl) urlOf.set(s.path, s.signedUrl);
    }
  } else {
    for (const f of usable) urlOf.set(f.path, getDb().storage.from(PUBLIC_BUCKET).getPublicUrl(publicPath(f)).data.publicUrl);
  }

  const imageOf = (f: ClientFile | null, alt: string): SiteImage | null => {
    const src = f ? urlOf.get(f.path) : undefined;
    if (!f || !src) return null;
    const size = contractSize(f.size);
    return { src, alt: clip(alt, 160), width: size.width, height: size.height, credit: null };
  };
  const placeSrc = (p: PlacePhoto) =>
    input.dryRun ? p.candidate.thumbUrl : getDb().storage.from(PUBLIC_BUCKET).getPublicUrl(stockPath(slug, p.candidate)).data.publicUrl;

  // 4. The model, with one validation retry.
  const messages: MessageParam[] = [{ role: "user", content: [...media, { type: "text", text: brief }] }];
  const request = (msgs: MessageParam[]) => ({
    model: deps.model,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    tools: [siteTool()],
    tool_choice: { type: "auto", disable_parallel_tool_use: true },
    output_config: { effort: EFFORT },
    messages: msgs,
  });

  let draft: SiteDraft | null = null;
  let content: SiteContentV1 | null = null;
  let calls = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let degraded = false;
  const usedIn = new Map<number, string[]>();
  /** Place photo n → where the site uses it. */
  const placeUsedIn = new Map<number, string[]>();

  const buildFromDraft = (d: SiteDraft): SiteContentV1 => {
    usedIn.clear();
    placeUsedIn.clear();
    const mark = (n: number, where: string) => usedIn.set(n, [...(usedIn.get(n) ?? []), where]);
    const photoImage = (ref: { photo: number; alt: string } | null, where: string): SiteImage | null => {
      if (!ref) return null;
      const slot = photos[ref.photo - 1];
      if (!slot?.seen || !slot.publishable) return null;
      const img = imageOf(slot.file, ref.alt);
      if (img) mark(slot.n, where);
      return img;
    };
    let heroImage = photoImage(d.hero.image, "hero");
    const heroN = heroImage ? d.hero.image?.photo : undefined;
    // Place photos: only on verticals where the place is the point, only as the hero (when no
    // client photo leads) and as an all-place gallery (never mixed with the client's photos).
    const stockOk = places.length > 0 && !degraded && STOCK_VERTICALS.includes(d.theme.vertical);
    const placeOf = (n: number | null | undefined) => (n ? (places.find((p) => p.n === n) ?? null) : null);
    let heroPlace: PlacePhoto | null = null;
    if (!heroImage && stockOk && d.places) {
      heroPlace = placeOf(d.places.hero);
      if (heroPlace) {
        heroImage = placeImage(heroPlace, placeSrc(heroPlace));
        placeUsedIn.set(heroPlace.n, ["hero"]);
      }
    }
    const seenInGallery = new Set<number>();
    const gallery: SiteImage[] = [];
    for (const ref of d.gallery) {
      if (ref.photo === heroN || seenInGallery.has(ref.photo)) continue;
      const img = photoImage(ref, "galería");
      if (img) {
        seenInGallery.add(ref.photo);
        gallery.push(img);
      }
    }
    // Photos the model couldn't see still belong to the client's site.
    for (const slot of photos) {
      if (!slot.seen && slot.publishable && slot.file && gallery.length < 12) {
        const img = imageOf(slot.file, `${signup.business_name} — foto ${slot.n}`);
        if (img) {
          gallery.push(img);
          mark(slot.n, "galería (sin revisar)");
        }
      }
    }
    if (!gallery.length && stockOk && d.places) {
      for (const n of d.places.gallery) {
        const p = placeOf(n);
        if (!p || p === heroPlace || placeUsedIn.has(p.n)) continue;
        gallery.push(placeImage(p, placeSrc(p)));
        placeUsedIn.set(p.n, ["galería"]);
      }
    }
    const name = slugify(d.business.name) === slugify(signup.business_name) ? d.business.name : clip(signup.business_name, 80);
    // The model may tidy the city ("Puerto de la libertad, costa" → "Puerto de La Libertad") but
    // never swap it for another place: every word it writes must be one the client wrote (or the
    // country's). A trailing country is dropped — the renderer adds it.
    const words = (text: string) => norm(text).split(/[^a-z0-9]+/).filter(Boolean);
    const cityWords = new Set([...words(signup.city ?? ""), ...words(countryName)]);
    const modelCity = countryName
      ? d.business.city.replace(new RegExp(`[,\\s·-]+${countryName}\\s*$`, "i"), "").trim() || d.business.city
      : d.business.city;
    const modelCityWords = words(modelCity);
    const city = signup.city?.trim()
      ? modelCityWords.length > 0 && modelCityWords.every((w) => cityWords.has(w))
        ? clip(modelCity, 80)
        : clip(signup.city, 80)
      : d.business.city;
    const loc = locationFrom(signup.address, signup.city, countryName);
    const location =
      d.location || loc.address || loc.mapsUrl
        ? { title: d.location?.title ?? "Dónde estamos", address: loc.address, mapsUrl: loc.mapsUrl, areaServed: d.location?.areaServed ?? null }
        : null;
    const hours = d.hours && (signup.hours?.trim() || docsRead) ? d.hours : null;
    const logoImage = logo && logoPublishable ? imageOf(logo, `Logo de ${name}`) : null;

    return {
      version: 1,
      lang: "es",
      business: { name: clip(name, 80), tagline: d.business.tagline, type: d.business.type, city, country },
      seo: d.seo,
      hero: { ...d.hero, image: heroImage },
      about: d.about,
      services: {
        title: d.services.title,
        intro: d.services.intro || null,
        items: d.services.items.map((item, i) => ({
          name: item.name,
          description: item.description || null,
          price: item.price || null,
          image: photoImage(item.image, `servicio ${i + 1}`),
        })),
      },
      gallery,
      differentiators: d.differentiators,
      hours,
      location: location && (location.address || location.mapsUrl || location.areaServed) ? location : null,
      contact: {
        title: d.contact.title,
        body: d.contact.body,
        whatsapp: signup.whatsapp.replace(/\D/g, ""),
        whatsappMessage: whatsappMessageFor(signup.site_goal, bilingual),
        email: emailOrNull(signup.contact_email),
        instagram: instagramUrl(signup.instagram),
        facebook: facebookUrl(signup.facebook),
        website: null,
      },
      faq: d.faq,
      theme: { ...d.theme, palette: d.theme.palette, logo: logoImage },
      footer: { credit: FOOTER_CREDIT, referralUrl: referralLink(signup.referral_code) },
    };
  };

  const issuesText = (issues: readonly { path: readonly PropertyKey[]; message: string }[]) =>
    issues
      .slice(0, 30)
      .map((i) => `- ${i.path.map(String).join(".") || "(raíz)"}: ${i.message}`)
      .join("\n");

  while (!content) {
    if (calls >= 3) throw new GenerationError("El modelo no entregó una web válida tras corregirla una vez.", true);
    const res = await createMessage(request(messages), { fetch: deps.fetch, apiKey: deps.apiKey }, deps.deadline);
    calls++;
    if (!res.ok) {
      // A file the API refuses (corrupt PDF, odd image) shouldn't sink the site: retry once text-only.
      if (res.status === 400 && !degraded && media.length) {
        console.error("[Sites:generate] 400 with attachments — retrying without them", res.message);
        degraded = true;
        messages.splice(0, messages.length, { role: "user", content: [{ type: "text", text: `${brief}\n\n(Los archivos adjuntos no se pudieron procesar; trabaje solo con el formulario.)` }] });
        for (const p of photos) p.seen = false;
        if (sources.stock && places.length) sources.stock.note = [sources.stock.note, "la API rechazó los adjuntos: sin fotos del lugar"].filter(Boolean).join("; ");
        sources.documents = sources.documents?.map((d) => ({ ...d, read: false, note: d.read ? "la API no pudo leerlo" : d.note }));
        docsRead = false;
        continue;
      }
      throw new GenerationError(`Claude API: ${res.type} — ${res.message}`, res.retryable);
    }
    const msg = res.message;
    inputTokens += msg.usage?.input_tokens ?? 0;
    outputTokens += msg.usage?.output_tokens ?? 0;
    if (msg.stop_reason === "refusal") {
      throw new GenerationError(`El modelo se negó a generar (${msg.stop_details?.category ?? "sin categoría"}).`, false);
    }
    const toolUse = msg.content.find((b: ResponseBlock) => b.type === "tool_use" && b.name === TOOL_NAME) as
      | { type: "tool_use"; id: string; name: string; input: unknown }
      | undefined;
    if (!toolUse) {
      if (calls >= 2) throw new GenerationError("El modelo no llamó a la herramienta guardar_sitio.", true);
      sources.retryFeedback = "no llamó a la herramienta";
      messages.push({ role: "assistant", content: msg.content }, { role: "user", content: `Debe llamar a ${TOOL_NAME} con la web completa.` });
      continue;
    }
    const parsed = siteDraftSchema.safeParse(toolUse.input);
    let feedback: string | null = null;
    if (!parsed.success) {
      feedback = issuesText(parsed.error.issues);
    } else {
      const candidate = buildFromDraft(parsed.data);
      const check = siteContentSchema.safeParse(candidate);
      if (check.success && (!unstatedIn(check.data) || calls >= 2)) {
        draft = parsed.data;
        content = check.data;
        break;
      }
      feedback = check.success
        ? `- El texto dice «${unstatedPlace}», pero el cliente no dio ese lugar (su ubicación es «${signup.city}»). Las fotos «Lugar N» son solo de referencia: no use el nombre de lo que muestran en ningún texto (eyebrow, tagline, hero, about, servicios, contacto, SEO, areaServed). Use solo «${signup.city}».`
        : issuesText(check.error.issues);
    }
    if (calls >= 2) throw new GenerationError(`La web del modelo no pasó la validación:\n${feedback}`.slice(0, 1500), true);
    sources.retryFeedback = feedback.slice(0, 2000);
    const truncated = msg.stop_reason === "max_tokens" ? "\nLa respuesta se cortó por largo: sea más breve." : "";
    messages.push(
      { role: "assistant", content: msg.content },
      {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: toolUse.id, is_error: true, content: `La web no es válida. Corrija estos campos y vuelva a llamar a ${TOOL_NAME} con la web COMPLETA:\n${feedback}${truncated}` }],
      },
    );
  }
  if (!draft || !content) throw new GenerationError("Sin contenido del modelo.", true);

  // 5. Honesty guards + contrast. The model's sourcePrices count only when a document was read.
  const sourcePrices = docsRead ? draft.sourcePrices : [];
  const factText = [
    signup.business_name,
    signup.business_type,
    signup.city,
    (signup.services ?? []).join("\n"),
    signup.differentiator,
    signup.hours,
    signup.style,
    signup.extra_notes,
    signup.address,
    input.instructions,
    ...sourcePrices,
  ]
    .filter(Boolean)
    .join("\n");
  const priceText = [(signup.services ?? []).join("\n"), signup.differentiator, signup.extra_notes, input.instructions, ...sourcePrices].filter(Boolean).join("\n");
  const guard = new CopyGuard({ factText, priceText, whatsappDigits: signup.whatsapp.replace(/\D/g, "") });
  const ctaFallback = signup.site_goal === "citas" ? "Agendar cita" : signup.site_goal === "mostrar" ? "Escríbanos" : "Escríbanos por WhatsApp";
  if (unstatedPlace && unstatedIn(content)) {
    // Last resort after the model's retry: the client's own location replaces the photos' place.
    const name = escapeRe(unstatedPlace);
    const own = clip(signup.city || countryName, 80);
    const withCountry = countryName ? new RegExp(`${name}(,\\s*${escapeRe(countryName)})?`, "gi") : new RegExp(name, "gi");
    content = replaceInTexts(content, withCountry, own);
    sources.stock = sources.stock ? { ...sources.stock, note: [sources.stock.note, `se cambió «${unstatedPlace}» por «${own}» en el texto`].filter(Boolean).join("; ") } : sources.stock;
  }
  let guarded = guardContent(content, guard, {
    name: content.business.name,
    type: signup.business_type,
    city: signup.city,
    services: signup.services ?? [],
    ctaLabel: ctaFallback,
  });
  const { palette, fixes } = fixPalette(guarded.theme.palette);
  guarded = { ...guarded, theme: { ...guarded.theme, palette } };
  const final = siteContentSchema.safeParse(guarded);
  if (!final.success) {
    console.error("[Sites:generate] guarded content invalid", final.error.issues);
    throw new GenerationError(`La web quedó inválida después de los filtros: ${issuesText(final.error.issues)}`.slice(0, 1000), false);
  }
  let result = final.data;

  // 6. Publish the images the site uses (same bytes, same name, under <slug>/).
  if (!input.dryRun) {
    const failed = new Set<string>();
    const toCopy: { file: ClientFile; bytes: Buffer }[] = [];
    if (result.theme.logo && logo && logoBytes) toCopy.push({ file: logo, bytes: logoBytes });
    for (const slot of photos) if (slot.file && usedIn.has(slot.n)) toCopy.push({ file: slot.file, bytes: slot.file.buf });
    for (const { file, bytes } of toCopy) {
      const { error } = await getDb()
        .storage.from(PUBLIC_BUCKET)
        .upload(publicPath(file), bytes, { contentType: CONTENT_TYPE[file.kind] ?? "application/octet-stream", upsert: true, cacheControl: "86400" });
      if (error) {
        console.error("[Sites:generate] public copy failed", file.path, error);
        failed.add(urlOf.get(file.path) ?? "");
      }
    }
    const publishedSize = new Map<string, { width: number; height: number }>();
    for (const p of places) {
      if (!placeUsedIn.has(p.n)) continue;
      const size = await publishPlacePhoto(
        p,
        slug,
        async (path, bytes) => {
          const { error } = await getDb().storage.from(PUBLIC_BUCKET).upload(path, bytes, { contentType: "image/jpeg", upsert: true, cacheControl: "86400" });
          if (error) console.error("[Sites:generate] place photo copy failed", path, error);
          return !error;
        },
        { fetch: deps.fetch },
      );
      if (!size) failed.add(placeSrc(p));
      else publishedSize.set(placeSrc(p), size);
    }
    if (publishedSize.size) {
      // The stored copy may be a little smaller than Commons' rendition (a printed frame trimmed away).
      const sized = (img: SiteImage | null): SiteImage | null => {
        const real = img ? publishedSize.get(img.src) : undefined;
        return img && real ? { ...img, ...contractSize(real) } : img;
      };
      result = { ...result, hero: { ...result.hero, image: sized(result.hero.image) }, gallery: result.gallery.map((g) => sized(g) ?? g) };
    }
    if (failed.size) {
      const keep = (img: SiteImage | null) => (img && !failed.has(img.src) ? img : null);
      result = {
        ...result,
        hero: { ...result.hero, image: keep(result.hero.image) },
        services: { ...result.services, items: result.services.items.map((i) => ({ ...i, image: keep(i.image) })) },
        gallery: result.gallery.filter((g) => !failed.has(g.src)),
        theme: { ...result.theme, logo: keep(result.theme.logo) },
      };
    }
  }

  const srcOf = (f: ClientFile | null) => (f ? (urlOf.get(f.path) ?? null) : null);
  const liveSrcs = new Set([result.hero.image?.src, result.theme.logo?.src, ...result.gallery.map((g) => g.src), ...result.services.items.map((i) => i.image?.src)].filter(Boolean));
  if (sources.logo && logo) sources.logo.publicUrl = liveSrcs.has(srcOf(logo) ?? "-") ? srcOf(logo) : null;
  sources.photos = photos.map((p) => ({
    path: p.file?.path ?? photoPaths[p.n - 1] ?? "",
    seen: p.seen,
    usedIn: usedIn.get(p.n) ?? [],
    publicUrl: liveSrcs.has(srcOf(p.file) ?? "-") ? srcOf(p.file) : null,
    note: p.note,
  }));
  if (sources.stock) {
    sources.stock.used = places
      .filter((p) => placeUsedIn.has(p.n))
      .map((p) => {
        const src = placeSrc(p);
        const live = liveSrcs.has(src);
        return {
          n: p.n,
          role: p.role,
          title: p.candidate.title,
          pageUrl: p.candidate.pageUrl,
          author: p.candidate.author,
          license: p.candidate.license,
          alt: p.alt,
          publicUrl: live && !input.dryRun ? src : null,
          usedIn: live ? (placeUsedIn.get(p.n) ?? []) : [],
        };
      });
    if (places.length && !sources.stock.used.some((u) => u.usedIn.length)) {
      const why = !STOCK_VERTICALS.includes(result.theme.vertical)
        ? `la web quedó como «${result.theme.vertical}», donde no se usan fotos de referencia`
        : "el modelo no usó las fotos del lugar";
      sources.stock.note = [sources.stock.note, why].filter(Boolean).join("; ");
    }
  }
  sources.sourcePrices = sourcePrices;
  sources.guards = { pricesRemoved: guard.report.pricesRemoved, sentencesRemoved: guard.report.sentencesRemoved, contrastFixes: fixes };
  sources.notes = draft.notesForTeam;
  sources.calls = calls;
  sources.usage = { inputTokens, outputTokens };
  sources.generatedAt = deps.now().toISOString();
  return { content: result, sources };
}

/** Short Spanish list of client files the generator couldn't use (board + alerts). */
export function unreadFiles(sources: SiteSources): string[] {
  const out: string[] = [];
  if (sources.logo?.note) out.push(`Logo: ${sources.logo.note}`);
  for (const p of sources.photos ?? []) if (p.note) out.push(`${baseName(p.path)}: ${p.note}`);
  for (const d of sources.documents ?? []) if (!d.read) out.push(`${baseName(d.path)}: ${d.note ?? "no leído"}`);
  return out;
}
