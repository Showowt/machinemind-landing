/**
 * POST /api/web-gratis/stripe-webhook — Stripe events for the $19/mes plan.
 *
 * Signature verified by hand (HMAC-SHA256 of `${t}.${rawBody}` with
 * STRIPE_WEBHOOK_SECRET_WEBGRATIS, 5-minute tolerance). Without the secret the
 * endpoint answers 503 so Stripe keeps retrying until it's configured — no
 * event is ever accepted unverified. Handled events: checkout.session.completed
 * (+ async payment succeeded/failed) → activa + referral credit + alert;
 * invoice.payment_failed / customer.subscription.deleted → alert only.
 * Idempotent on the event id.
 */
import { fail, ok } from "@/lib/web-gratis/http";
import { enqueueSystem } from "@/lib/web-gratis/outbox";
import { handleStripeEvent, stripeEventSchema, stripeWebhookSecret, verifyStripeSignature } from "@/lib/web-gratis/payments";
import { sendViaRewired } from "@/lib/web-gratis/rewired";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return fail(400, "invalid");
  }

  const secret = stripeWebhookSecret();
  if (!secret) {
    console.error("[WebGratis:stripe] STRIPE_WEBHOOK_SECRET_WEBGRATIS not configured — event refused (Stripe will retry)");
    return fail(503, "not_configured");
  }
  const check = verifyStripeSignature(raw, request.headers.get("stripe-signature"), secret);
  if (!check.ok) return fail(400, "unauthorized", check.reason);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail(400, "invalid", "json");
  }
  const parsed = stripeEventSchema.safeParse(body);
  if (!parsed.success) return fail(400, "invalid");

  try {
    const result = await handleStripeEvent(parsed.data, {
      now: () => new Date(),
      send: (req) => sendViaRewired(req, { timeoutMs: 8_000 }),
      alert: (key, text) => enqueueSystem(key, text),
    });
    return ok({ received: true, ...result });
  } catch (error) {
    console.error("[WebGratis:stripe]", parsed.data.id, parsed.data.type, error);
    return fail(500, "server_error");
  }
}
