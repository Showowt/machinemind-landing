/**
 * POST /api/web-gratis/bridge — Rewired OS reports what happens on the funnel
 * WhatsApp line (+1 786-257-0284). Server-to-server only.
 *
 * Auth: `x-wg-signature: t=<unix>,v1=<hex HMAC-SHA256(WEB_GRATIS_BRIDGE_SECRET, "t.rawBody")>`,
 * 5-minute tolerance. Fails closed: no secret configured → 401 for everything.
 * Body: one JSON object with a `type` discriminator (see lib/web-gratis/bridge.ts).
 * Response: `{ data, error, message }`.
 */
import { BRIDGE_SIGNATURE_HEADER, bridgeSecret, verifySignedBody } from "@/lib/web-gratis/bridge-auth";
import { bridgeRequestSchema, defaultBridgeDeps, handleBridge } from "@/lib/web-gratis/bridge";
import { fail } from "@/lib/web-gratis/http";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BODY_BYTES = 64 * 1024;

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
    if (check.reason === "no_secret") console.error("[WebGratis:bridge] WEB_GRATIS_BRIDGE_SECRET not configured — refusing");
    return fail(401, "unauthorized", check.reason);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail(400, "invalid", "json");
  }
  const parsed = bridgeRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(400, "invalid", issue ? `${issue.path.join(".")}: ${issue.message}` : undefined);
  }

  try {
    const result = await handleBridge(parsed.data, defaultBridgeDeps());
    return Response.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[WebGratis:bridge]", parsed.data.type, error);
    return fail(500, "server_error");
  }
}
