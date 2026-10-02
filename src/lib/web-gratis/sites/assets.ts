/** Reviewed raster uploads only; no content, generation or commercial writes. */
import { randomUUID } from "crypto";
import { z } from "zod";
import { getDb } from "../server";
import { PUBLIC_BUCKET, SITES_TABLE } from "./db";
import { slugProblem } from "./shared";
import type { ActionResult } from "./publish";

/** Leave headroom below the hosting function's 4.5 MB request limit. */
export const MAX_SITE_ASSET_BYTES = 4 * 1024 * 1024;
const MAX_MULTIPART_BYTES = MAX_SITE_ASSET_BYTES + 16 * 1024;
const MAX_PIXELS = 32_000_000;
type RasterKind = "jpeg" | "png" | "webp";

export interface UploadedSiteAsset {
  src: string;
  width: number;
  height: number;
}

/** Bound the entire body even when Content-Length is missing or dishonest. */
export async function parseSiteAssetUpload(request: Request): Promise<ActionResult<{ file: File; expectedVersion: number }>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data\s*;/i.test(contentType) || !request.body) {
    return { ok: false, status: 400, code: "invalid", message: "Use un archivo de imagen y la versión de la web." };
  }
  const declaredLength = Number(request.headers.get("content-length"));
  if (declaredLength > MAX_MULTIPART_BYTES) {
    return { ok: false, status: 413, code: "too_large", message: "La imagen debe pesar como máximo 4 MiB." };
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_MULTIPART_BYTES) {
        await reader.cancel();
        return { ok: false, status: 413, code: "too_large", message: "La imagen debe pesar como máximo 4 MiB." };
      }
      chunks.push(value);
    }
    const form = await new Response(Buffer.concat(chunks), { headers: { "content-type": contentType } }).formData();
    const fields = [...form.keys()];
    // No client-selected bucket, path, tenant, purpose, URL or metadata.
    if (fields.length !== 2 || form.getAll("file").length !== 1 || form.getAll("expectedVersion").length !== 1) {
      return { ok: false, status: 400, code: "invalid", message: "Solo se permite file y expectedVersion, una vez cada uno." };
    }
    const file = form.get("file");
    const version = form.get("expectedVersion");
    if (!file || typeof file === "string" || typeof version !== "string" || !/^(0|[1-9][0-9]*)$/.test(version) || !Number.isSafeInteger(Number(version))) {
      return { ok: false, status: 400, code: "invalid", message: "Archivo o versión inválidos." };
    }
    if (!file.size || file.size > MAX_SITE_ASSET_BYTES) {
      return { ok: false, status: file.size ? 413 : 400, code: file.size ? "too_large" : "invalid", message: "Use una imagen de hasta 4 MiB." };
    }
    return { ok: true, file, expectedVersion: Number(version) };
  } catch {
    return { ok: false, status: 400, code: "invalid", message: "No se pudo leer el archivo." };
  } finally {
    reader.releaseLock();
  }
}

function rasterKind(bytes: Buffer): RasterKind | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "png";
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "jpeg";
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

/** Decode locally and strip EXIF/XMP/comments; never publish the original bytes. */
export async function normalizeSiteAsset(bytes: Buffer): Promise<ActionResult<{ bytes: Buffer; kind: RasterKind; width: number; height: number }>> {
  if (!bytes.length || bytes.length > MAX_SITE_ASSET_BYTES) {
    return { ok: false, status: bytes.length ? 413 : 400, code: bytes.length ? "too_large" : "invalid", message: "Use una imagen de hasta 4 MiB." };
  }
  const kind = rasterKind(bytes);
  if (!kind) return { ok: false, status: 415, code: "unsupported_type", message: "Solo se aceptan imágenes JPEG, PNG o WebP." };
  // Next.js already supplies sharp. Fail closed if the local codec is absent;
  // no fallback that could expose embedded private metadata or malformed data.
  const sharp = await import("sharp").then((m) => m.default).catch(() => null);
  if (!sharp) return { ok: false, status: 503, code: "not_configured", message: "El procesamiento local de imágenes no está disponible." };
  try {
    const image = sharp(bytes, { failOn: "warning", limitInputPixels: MAX_PIXELS, animated: false });
    const metadata = await image.metadata();
    if (metadata.format !== kind || (metadata.pages ?? 1) !== 1 || !metadata.width || !metadata.height || metadata.width > 8000 || metadata.height > 8000) {
      return { ok: false, status: 400, code: "invalid", message: "Use una imagen estática de hasta 8000 píxeles por lado." };
    }
    const oriented = image.rotate();
    const output = kind === "jpeg" ? oriented.jpeg({ quality: 100, chromaSubsampling: "4:4:4" }) : kind === "png" ? oriented.png() : oriented.webp({ lossless: true });
    // Without keepMetadata/withMetadata, sharp removes all source metadata.
    const { data, info } = await output.toBuffer({ resolveWithObject: true });
    if (data.length > MAX_SITE_ASSET_BYTES) {
      return { ok: false, status: 413, code: "too_large", message: "La imagen procesada supera 4 MiB; use una imagen más pequeña." };
    }
    return { ok: true, bytes: data, kind, width: info.width, height: info.height };
  } catch {
    return { ok: false, status: 400, code: "invalid", message: "La imagen está dañada o supera el tamaño permitido." };
  }
}

type UploadSite = { id: string; signup_id: string; slug: string; version: number; status: string; generation_lease_until: string | null };
const SITE_COLUMNS = "id,signup_id,slug,version,status,generation_lease_until";

function eligible(site: UploadSite, expectedVersion: number): boolean {
  return ["draft", "published", "paused"].includes(site.status) && site.version === expectedVersion &&
    site.slug === site.slug.trim().toLowerCase() && !slugProblem(site.slug) &&
    (!site.generation_lease_until || Date.parse(site.generation_lease_until) <= Date.now());
}

export async function uploadSiteAsset(siteId: string, expectedVersion: number, bytes: Buffer): Promise<ActionResult<{ asset: UploadedSiteAsset }>> {
  if (!z.uuid().safeParse(siteId).success || !Number.isSafeInteger(expectedVersion) || expectedVersion < 0) {
    return { ok: false, status: 400, code: "invalid", message: "Identificador o versión de web inválidos." };
  }
  const db = getDb();
  const { data: stored, error: readError } = await db.from(SITES_TABLE).select(SITE_COLUMNS).eq("id", siteId).maybeSingle();
  if (readError) throw readError;
  if (!stored) return { ok: false, status: 404, code: "not_found", message: "No existe esa web." };
  const site = stored as UploadSite;
  if (!eligible(site, expectedVersion)) {
    return { ok: false, status: 409, code: "not_eligible", message: "La web cambió o no está lista para recibir imágenes. Actualice y revise antes de subir." };
  }
  const normalized = await normalizeSiteAsset(bytes);
  if (!normalized.ok) return normalized;

  // Encoding can take time: recheck the exact tenant/version/state immediately
  // before creating an object. This endpoint never attaches it to site content;
  // the separate content import must still pass its own optimistic guard.
  const { data: current, error: checkError } = await db.from(SITES_TABLE).select(SITE_COLUMNS)
    .eq("id", site.id).eq("signup_id", site.signup_id).eq("slug", site.slug)
    .eq("version", expectedVersion).eq("status", site.status).maybeSingle();
  if (checkError) throw checkError;
  if (!current || !eligible(current as UploadSite, expectedVersion)) {
    return { ok: false, status: 409, code: "not_eligible", message: "La web cambió mientras tanto. Actualice y vuelva a revisar la imagen." };
  }
  const extension = normalized.kind === "jpeg" ? "jpg" : normalized.kind;
  const path = `${site.slug}/asset-${randomUUID()}.${extension}`;
  const bucket = db.storage.from(PUBLIC_BUCKET);
  const { data: urlData } = bucket.getPublicUrl(path);
  // Generated from the configured storage origin; never accept a submitted URL.
  const publicUrl = new URL(urlData.publicUrl);
  if (publicUrl.protocol !== "https:" || publicUrl.username || publicUrl.password || publicUrl.search || publicUrl.hash ||
      publicUrl.pathname !== `/storage/v1/object/public/${PUBLIC_BUCKET}/${path}`) {
    return { ok: false, status: 503, code: "not_configured", message: "El almacenamiento público no está configurado correctamente." };
  }
  const { error } = await bucket.upload(path, normalized.bytes, {
    contentType: `image/${normalized.kind}`, cacheControl: "31536000", upsert: false,
  });
  if (error) throw error;
  return { ok: true, asset: { src: publicUrl.href, width: normalized.width, height: normalized.height } };
}
