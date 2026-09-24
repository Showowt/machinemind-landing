/**
 * HMAC signatures for the site ⇄ Rewired OS bridge (and the same primitive for
 * Stripe's webhook signature).
 *
 * Header: `x-wg-signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, `${t}.${rawBody}`)>`.
 * Verification fails closed: no secret, a malformed header, a timestamp more
 * than 5 minutes away, or a mismatched digest all mean "reject".
 */
import { createHmac, timingSafeEqual } from "crypto";

export const BRIDGE_SIGNATURE_HEADER = "x-wg-signature";
export const SIGNATURE_TOLERANCE_SEC = 300;

export function hmacHex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

/** Constant-time comparison of two hex digests. */
export function hexEqual(a: string, b: string): boolean {
  if (!/^[0-9a-f]+$/i.test(a) || !/^[0-9a-f]+$/i.test(b)) return false;
  const left = Buffer.from(a.toLowerCase(), "hex");
  const right = Buffer.from(b.toLowerCase(), "hex");
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

export function bridgeSecret(): string | null {
  const secret = process.env.WEB_GRATIS_BRIDGE_SECRET?.trim();
  return secret && secret.length >= 16 ? secret : null;
}

export function signBridgeBody(secret: string, rawBody: string, nowSec = Math.floor(Date.now() / 1000)): string {
  return `t=${nowSec},v1=${hmacHex(secret, `${nowSec}.${rawBody}`)}`;
}

/** Parse `t=…,v1=…[,v1=…]` (Stripe sends several v1 values during secret rotation). */
export function parseSignatureHeader(header: string | null): { t: number; v1: string[] } | null {
  if (!header) return null;
  let t: number | null = null;
  const v1: string[] = [];
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "t" && /^\d{1,12}$/.test(value)) t = Number(value);
    else if (key === "v1" && value) v1.push(value);
  }
  return t === null || v1.length === 0 ? null : { t, v1 };
}

export type SignatureCheck = { ok: true } | { ok: false; reason: "no_secret" | "malformed" | "stale" | "mismatch" };

export function verifySignedBody(
  header: string | null,
  rawBody: string,
  secret: string | null,
  nowSec = Math.floor(Date.now() / 1000),
  toleranceSec = SIGNATURE_TOLERANCE_SEC,
): SignatureCheck {
  if (!secret) return { ok: false, reason: "no_secret" };
  const parsed = parseSignatureHeader(header);
  if (!parsed) return { ok: false, reason: "malformed" };
  if (Math.abs(nowSec - parsed.t) > toleranceSec) return { ok: false, reason: "stale" };
  const expected = hmacHex(secret, `${parsed.t}.${rawBody}`);
  return parsed.v1.some((candidate) => hexEqual(candidate, expected)) ? { ok: true } : { ok: false, reason: "mismatch" };
}
