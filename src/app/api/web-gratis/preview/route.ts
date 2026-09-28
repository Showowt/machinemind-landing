/**
 * POST /api/web-gratis/preview — Rewired OS asks for the automatic website preview of a chat
 * lead's draft (preview-first, 2026-09-28; see lib/web-gratis/sites/chat-preview.ts).
 *
 * Auth: `x-wg-signature` (same HMAC as /api/web-gratis/bridge), fails closed without
 * WEB_GRATIS_BRIDGE_SECRET. Body: `{ signupId }`. Idempotent:
 *   200 { state: "ready", slug, previewUrl }                      the preview exists
 *   202 { state: "started" | "generating", slug, previewUrl }     being built; Rewired gets a
 *        signed callback at /api/web-gratis/preview-ready (and may simply ask again)
 *   404 / 409 / 503 { error }                                     no such draft / not a chat
 *        preview / generator not configured
 * The generation runs after the response (up to 300 s), so Rewired never waits on a model call.
 */
import { after } from "next/server";
import { z } from "zod";
import { BRIDGE_SIGNATURE_HEADER, bridgeSecret, verifySignedBody } from "@/lib/web-gratis/bridge-auth";
import { fail, ok } from "@/lib/web-gratis/http";
import { requestChatPreview, runChatPreviewJob } from "@/lib/web-gratis/sites/chat-preview";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_BODY_BYTES = 4 * 1024;
const bodySchema = z.object({ signupId: z.uuid() });

export async function POST(request: Request) {
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return fail(400, "invalid");
  }
  if (raw.length > MAX_BODY_BYTES) return fail(413, "too_large");

  const check = verifySignedBody(request.headers.get(BRIDGE_SIGNATURE_HEADER), raw, bridgeSecret());
  if (!check.ok) {
    if (check.reason === "no_secret") console.error("[WebGratis:preview] WEB_GRATIS_BRIDGE_SECRET not configured — refusing");
    return fail(401, "unauthorized", check.reason);
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    const result = bodySchema.safeParse(JSON.parse(raw));
    if (!result.success) return fail(400, "invalid", result.error.issues[0]?.message);
    parsed = result.data;
  } catch {
    return fail(400, "invalid", "json");
  }

  try {
    const res = await requestChatPreview(parsed.signupId);
    if (res.kind === "refused") return fail(res.status, res.error, res.message);
    const job = res.job;
    if (job) after(() => runChatPreviewJob(job).then(() => undefined));
    return ok({ state: res.state, slug: res.slug, previewUrl: res.previewUrl }, { status: res.status, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[WebGratis:preview]", parsed.signupId, error);
    return fail(500, "server_error");
  }
}
