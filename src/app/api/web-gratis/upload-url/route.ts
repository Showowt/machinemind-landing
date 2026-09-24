/**
 * POST /api/web-gratis/upload-url — mint a signed upload URL for one file.
 *
 * Files go straight from the phone to the private `web-gratis` bucket (no 4.5 MB
 * function body limit) and are uploaded the moment they're picked, so an iOS
 * in-app browser reload can't lose them. Only an existing draft may upload, and
 * each draft folder is capped.
 */
import { randomBytes } from "crypto";
import { ALLOWED_UPLOAD_TYPES, MAX_OBJECTS_PER_DRAFT, MAX_UPLOAD_BYTES } from "@/lib/web-gratis/config";
import { fail, ok } from "@/lib/web-gratis/http";
import { uploadUrlRequestSchema } from "@/lib/web-gratis/schema";
import { getDb, listDraftFiles, SIGNUPS_TABLE, storage } from "@/lib/web-gratis/server";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid");
  }

  const parsed = uploadUrlRequestSchema.safeParse(body);
  if (!parsed.success) return fail(400, "invalid");
  const { draftId, kind, contentType, size } = parsed.data;

  const ext = ALLOWED_UPLOAD_TYPES[contentType.toLowerCase()];
  if (!ext) return fail(415, "unsupported_type");
  if (size > MAX_UPLOAD_BYTES) return fail(413, "too_large");

  try {
    const { data: row, error } = await getDb()
      .from(SIGNUPS_TABLE)
      .select("id, status")
      .eq("id", draftId)
      .maybeSingle();
    if (error) throw error;
    if (!row || row.status !== "borrador") return fail(404, "draft_not_found");

    const existing = await listDraftFiles(draftId);
    if (existing.length >= MAX_OBJECTS_PER_DRAFT) return fail(429, "too_many_files");

    const path = `${draftId}/${kind}-${Date.now()}-${randomBytes(3).toString("hex")}.${ext}`;
    const { data, error: signError } = await storage().createSignedUploadUrl(path);
    if (signError || !data) throw signError ?? new Error("no signed url");

    return ok({ path, signedUrl: data.signedUrl });
  } catch (error) {
    console.error("[WebGratis:upload-url]", error);
    return fail(500, "server_error");
  }
}
