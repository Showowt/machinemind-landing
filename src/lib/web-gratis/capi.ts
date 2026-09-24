/**
 * Meta Conversions API (server-side) for the free-website funnel.
 *
 * Mirrors the browser pixel events (same event_id → Meta de-duplicates) so the
 * ad keeps getting conversion signal when iOS / in-app browsers block the pixel.
 * Inactive until META_CAPI_TOKEN is set (Events Manager → Settings → Conversions
 * API → Generate access token). Optional META_CAPI_TEST_CODE routes events to
 * the Test Events tab. Never throws; failures are logged only.
 */
import { createHash } from "crypto";

const PIXEL_ID = "1335865971435206";
const GRAPH_VERSION = "v23.0";

const sha256 = (value: string) => createHash("sha256").update(value.trim().toLowerCase()).digest("hex");

function cookie(request: Request, name: string): string | undefined {
  const raw = request.headers.get("cookie") ?? "";
  const match = raw.split(/;\s*/).find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

export interface CapiEvent {
  eventName: "Lead" | "CompleteRegistration";
  eventId: string;
  whatsapp: string;
  externalId: string;
  sourceUrl: string | null;
  fbclid: string | null;
  request: Request;
}

export async function sendCapiEvent(event: CapiEvent): Promise<void> {
  const token = process.env.META_CAPI_TOKEN?.trim();
  if (!token) return;

  const request = event.request;
  const digits = event.whatsapp.replace(/\D/g, "");
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
  const fbc = cookie(request, "_fbc") ?? (event.fbclid ? `fb.1.${Date.now()}.${event.fbclid}` : undefined);
  const userData: Record<string, unknown> = {
    ph: [sha256(digits)],
    external_id: [sha256(event.externalId)],
    client_ip_address: ip,
    client_user_agent: request.headers.get("user-agent") ?? undefined,
    fbp: cookie(request, "_fbp"),
    fbc,
  };
  if (digits.startsWith("503")) userData.country = [sha256("sv")];

  const body: Record<string, unknown> = {
    data: [
      {
        event_name: event.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: event.eventId,
        action_source: "website",
        event_source_url: event.sourceUrl ?? "https://machinemindconsulting.com/web",
        user_data: userData,
        custom_data: { content_name: "web_gratis" },
      },
    ],
  };
  const testCode = process.env.META_CAPI_TEST_CODE?.trim();
  if (testCode) body.test_event_code = testCode;

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) console.error("[WebGratis:capi]", event.eventName, res.status, (await res.text()).slice(0, 300));
  } catch (error) {
    console.error("[WebGratis:capi]", event.eventName, error);
  }
}
