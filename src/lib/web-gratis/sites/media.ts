/**
 * Client uploads → what the generator can use: real type from the bytes (never
 * the file name), pixel size from the header, SVG brand colors, a sanitized SVG
 * for the public bucket, and a downscaled copy for the model.
 *
 * Downscaling uses `sharp` when the runtime has it (Next.js ships it as an
 * optional dependency for image optimization). Without it, an image is sent to
 * the model as-is only when it fits the API's per-image limit; otherwise it is
 * published without being "seen" and the team is told.
 */
import type { Sharp, SharpOptions } from "sharp";

export type MediaKind = "png" | "jpeg" | "gif" | "webp" | "svg" | "pdf" | "heic" | "other";

export const CONTENT_TYPE: Partial<Record<MediaKind, string>> = {
  png: "image/png",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  pdf: "application/pdf",
};

/** Formats a browser can show and the public bucket accepts. */
export const WEB_IMAGE_KINDS: readonly MediaKind[] = ["png", "jpeg", "gif", "webp", "svg"];
/** Formats the model accepts as images. */
const VISION_KINDS: readonly MediaKind[] = ["png", "jpeg", "gif", "webp"];

/** Anthropic's limit is 5 MB of base64 per image (≈ 3.75 MB raw); keep a margin. */
const VISION_RAW_MAX = 3_600_000;
const VISION_EDGE = 1568;

export function sniff(buf: Buffer): MediaKind {
  if (buf.length >= 8 && buf[0] === 0x89 && buf.toString("ascii", 1, 4) === "PNG") return "png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length >= 6 && buf.toString("ascii", 0, 4) === "GIF8") return "gif";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (buf.length >= 5 && buf.toString("ascii", 0, 5) === "%PDF-") return "pdf";
  if (buf.length >= 12 && buf.toString("ascii", 4, 8) === "ftyp" && /^(heic|heix|hevc|hevx|mif1|msf1|heim|heis|avif)$/.test(buf.toString("ascii", 8, 12))) {
    return "heic";
  }
  const head = buf.toString("utf8", 0, Math.min(buf.length, 1024)).trimStart().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg")) || (head.startsWith("<!doctype svg"))) return "svg";
  if (head.includes("<svg")) return "svg";
  return "other";
}

/** Pixel size from the file header (no decoding), or null. */
export function imageSize(buf: Buffer, kind: MediaKind): { width: number; height: number } | null {
  try {
    if (kind === "png" && buf.length >= 24) return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    if (kind === "gif" && buf.length >= 10) return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
    if (kind === "webp" && buf.length >= 30) {
      const chunk = buf.toString("ascii", 12, 16);
      if (chunk === "VP8 ") return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
      if (chunk === "VP8L") {
        const b = buf.readUInt32LE(21);
        return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
      }
      if (chunk === "VP8X") return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
    }
    if (kind === "jpeg") {
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) {
          i++;
          continue;
        }
        const marker = buf[i + 1];
        const len = buf.readUInt16BE(i + 2);
        // SOF0–SOF15 except DHT (C4), JPG (C8), DAC (CC)
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        }
        i += 2 + len;
      }
    }
    if (kind === "svg") {
      const text = buf.toString("utf8", 0, Math.min(buf.length, 4096));
      const tag = /<svg\b[^>]*>/i.exec(text)?.[0] ?? "";
      const w = /\bwidth=["']?(\d+(?:\.\d+)?)(px)?["']?/i.exec(tag);
      const h = /\bheight=["']?(\d+(?:\.\d+)?)(px)?["']?/i.exec(tag);
      if (w && h) return { width: Math.round(Number(w[1])), height: Math.round(Number(h[1])) };
      const vb = /\bviewBox=["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(tag);
      if (vb) return { width: Math.round(Number(vb[1])), height: Math.round(Number(vb[2])) };
    }
  } catch (error) {
    console.error("[Sites:media] header parse failed", kind, error);
  }
  return null;
}

/** Sizes the contract accepts (positive, ≤ 8000) or null. */
export function contractSize(size: { width: number; height: number } | null): { width: number | null; height: number | null } {
  const ok = (n: number) => Number.isInteger(n) && n > 0 && n <= 8000;
  return size && ok(size.width) && ok(size.height) ? size : { width: null, height: null };
}

const NAMED: Record<string, string> = {
  black: "#000000", white: "#ffffff", red: "#ff0000", green: "#008000", blue: "#0000ff", yellow: "#ffff00",
  orange: "#ffa500", purple: "#800080", pink: "#ffc0cb", gray: "#808080", grey: "#808080", navy: "#000080",
  teal: "#008080", maroon: "#800000", gold: "#ffd700", brown: "#a52a2a",
};

/** Brand colors declared in an SVG (fill / stroke / stop-color / style), most used first. */
export function svgColors(svg: string): string[] {
  const counts = new Map<string, number>();
  const add = (hex: string) => counts.set(hex, (counts.get(hex) ?? 0) + 1);
  for (const m of svg.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
    const h = m[1].toLowerCase();
    add(`#${h.length === 3 ? h.split("").map((c) => c + c).join("") : h}`);
  }
  for (const m of svg.matchAll(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/gi)) {
    add(`#${[m[1], m[2], m[3]].map((v) => Math.min(255, Number(v)).toString(16).padStart(2, "0")).join("")}`);
  }
  for (const m of svg.matchAll(/(?:fill|stroke|stop-color|color)\s*[=:]\s*["']?([a-z]+)\b/gi)) {
    const named = NAMED[m[1].toLowerCase()];
    if (named) add(named);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([hex]) => hex).slice(0, 12);
}

const codePoint = (cp: number): string => (Number.isInteger(cp) && cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : "");

/** Numeric / named entities a browser would decode inside an attribute (so "&#106;avascript:" can't hide). */
function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]{1,6});?/gi, (_, hex: string) => codePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d{1,7});?/g, (_, dec: string) => codePoint(Number(dec)))
    .replace(/&colon;/gi, ":")
    .replace(/&(tab|newline);/gi, "");
}

const ACTIVE_ELEMENTS = "script|foreignobject|iframe|embed|object|handler|listener|meta|base";

/**
 * True when nothing that can run script is left in the SVG (checked on the
 * entity-decoded text, with the whitespace browsers ignore inside URL schemes
 * removed). Fails closed: anything suspicious means "don't publish it".
 */
export function svgIsSafe(text: string): boolean {
  const decoded = decodeEntities(text);
  const flat = decoded.replace(/[\u0000- ]+/g, "");
  if (new RegExp(`<\\s*(${ACTIVE_ELEMENTS})\\b`, "i").test(decoded)) return false;
  if (/[\s/"']on[a-z]+\s*=/i.test(decoded)) return false;
  if (/(javascript|vbscript|livescript):/i.test(flat)) return false;
  if (/data:(text\/html|application\/(xhtml|javascript|ecmascript|x-javascript)|image\/svg)/i.test(flat)) return false;
  if (/<\s*(set|animate\w*)\b[^>]*attributename\s*=\s*["']?\s*(on\w+|href|xlink:href)/i.test(decoded)) return false;
  // DTD entities are expanded as markup by the browser's XML parser, so one could smuggle a
  // <script>. Illustrator's plain namespace entities (<!ENTITY ns_svg "http://…">) are fine;
  // anything else (markup, references, SYSTEM / PUBLIC / parameter entities) is not.
  for (const m of decoded.matchAll(/<!\s*entity\b([^>]*)>/gi)) {
    if (!/^\s*[A-Za-z_][\w.-]*\s+(["'])[^"'<&%]*\1\s*$/.test(m[1])) return false;
  }
  return true;
}

/**
 * Strip what could run when the file is opened directly (it's public): active
 * elements, event handlers (also "<svg/onload=…>"), script links. `safe` is
 * the fail-closed re-check of the result: when false, the logo must not be
 * published. Returns the original bytes when nothing needed removing.
 */
export function sanitizeSvg(buf: Buffer): { buf: Buffer; changed: boolean; safe: boolean } {
  const text = buf.toString("utf8");
  const cleaned = text
    .replace(new RegExp(`<\\s*(${ACTIVE_ELEMENTS})\\b[\\s\\S]*?<\\/\\s*\\1\\s*>`, "gi"), "")
    .replace(new RegExp(`<\\s*(${ACTIVE_ELEMENTS})\\b[^>]*\\/?>`, "gi"), "")
    .replace(/[\s/]on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, " ")
    .replace(/((?:xlink:)?href\s*=\s*["']?)\s*(javascript|vbscript):[^"'>\s]*/gi, "$1#");
  const safe = svgIsSafe(cleaned);
  return cleaned === text ? { buf, changed: false, safe } : { buf: Buffer.from(cleaned, "utf8"), changed: true, safe };
}

type SharpFactory = (input?: Buffer, options?: SharpOptions) => Sharp;
let sharpLoader: Promise<SharpFactory | null> | null = null;

/** The runtime's sharp, or null when it isn't installed (the caller degrades). */
export function loadSharp(): Promise<SharpFactory | null> {
  sharpLoader ??= import("sharp")
    .then((m) => (m.default ?? m) as unknown as SharpFactory)
    .catch((error: unknown) => {
      console.error("[Sites:media] sharp unavailable — images go to the model at original size when small enough", error);
      return null;
    });
  return sharpLoader;
}

export interface VisionImage {
  mediaType: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
  base64: string;
}

/**
 * The image as the model should see it: ≤ 1568 px on the long edge (JPEG for
 * photos, PNG for logos so transparency survives). Null + a reason when it can't be sent.
 */
export async function forVision(buf: Buffer, kind: MediaKind, purpose: "logo" | "photo"): Promise<{ image: VisionImage | null; note: string | null }> {
  if (!VISION_KINDS.includes(kind)) {
    return { image: null, note: kind === "heic" ? "formato HEIC (iPhone): pídale la foto en JPG" : `formato ${kind} no legible` };
  }
  const sharp = await loadSharp();
  if (sharp) {
    try {
      const pipeline = sharp(buf, { failOn: "none", animated: false })
        .rotate()
        .resize({ width: VISION_EDGE, height: VISION_EDGE, fit: "inside", withoutEnlargement: true });
      const out = purpose === "logo" ? await pipeline.png().toBuffer() : await pipeline.jpeg({ quality: 80, mozjpeg: true }).toBuffer();
      if (out.length <= VISION_RAW_MAX) {
        return { image: { mediaType: purpose === "logo" ? "image/png" : "image/jpeg", base64: out.toString("base64") }, note: null };
      }
    } catch (error) {
      console.error("[Sites:media] downscale failed — trying the original", error);
    }
  }
  if (buf.length <= VISION_RAW_MAX) {
    return { image: { mediaType: CONTENT_TYPE[kind] as VisionImage["mediaType"], base64: buf.toString("base64") }, note: null };
  }
  return { image: null, note: `muy pesada para revisarla (${(buf.length / 1_048_576).toFixed(1)} MB)` };
}
