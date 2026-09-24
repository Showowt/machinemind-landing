/**
 * Client for Rewired OS's funnel-line sender: POST {REWIRED_BASE_URL}/api/web-gratis/send.
 *
 * The site never talks to Meta. Rewired owns the WhatsApp number, its health
 * gates, opt-out stores and template approval checks; this client signs the
 * request (HMAC, see bridge-auth.ts) and turns every possible answer into a
 * SendOutcome the scheduler can act on.
 *
 * `definitive` separates "NOT sent" (Rewired answered so, or the request never
 * reached it — safe to retry under a new idempotency key) from "we don't know"
 * (timeout, dropped connection, 5xx: the POST to Meta may have gone out).
 * Rewired only remembers successful and permanent results, so an unknown
 * outcome can't be de-duplicated by resending: the scheduler never re-sends it
 * automatically (see whatsapp.ts, "send_unknown").
 */
import { z } from "zod";
import { BRIDGE_SIGNATURE_HEADER, bridgeSecret, signBridgeBody } from "./bridge-auth";
import type { TemplateName } from "./templates";

export interface RewiredSendRequest {
  to: string;
  mode: "template" | "freeform";
  template?: { name: TemplateName; bodyParams: string[]; buttonParam?: string };
  text?: string;
  idempotencyKey: string;
}

export type SendOutcome =
  | { ok: true; wamid: string }
  | {
      ok: false;
      /** Rewired gate code ("disabled", "opted_out", …) or the Meta numeric code as a string. */
      code: string;
      transient: boolean;
      definitive: boolean;
      retryAfterSec: number | null;
      message: string;
      httpStatus: number | null;
    };

/** Outcomes that must never be retried automatically. */
const PERMANENT_CODES = new Set(["131026", "132000", "132012", "131047", "131051", "opted_out", "invalid", "bad_request"]);

/** fetch() failure causes that mean the TCP/TLS connection never opened. */
const NEVER_CONNECTED = new Set(["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "EHOSTUNREACH", "ENETUNREACH", "ERR_INVALID_URL"]);

const errorObject = z
  .object({
    code: z.union([z.string(), z.number()]),
    transient: z.boolean().optional(),
    retryAfterSec: z.number().nonnegative().optional(),
    metaCode: z.union([z.string(), z.number()]).optional(),
    message: z.string().optional(),
  })
  .passthrough();

const responseSchema = z.object({
  data: z.object({ wamid: z.string().min(1) }).passthrough().nullable().optional(),
  error: z.union([z.string(), errorObject]).nullable().optional(),
  message: z.string().nullable().optional(),
});

export interface SendOptions {
  baseUrl?: string | null;
  secret?: string | null;
  timeoutMs?: number;
}

export function rewiredBaseUrl(): string | null {
  const url = process.env.REWIRED_BASE_URL?.trim().replace(/\/+$/, "");
  return url && /^https?:\/\//.test(url) ? url : null;
}

function failure(
  code: string,
  opts: { transient?: boolean; definitive: boolean; retryAfterSec?: number | null; message?: string; httpStatus?: number | null },
): SendOutcome {
  return {
    ok: false,
    code,
    transient: opts.transient ?? !PERMANENT_CODES.has(code),
    definitive: opts.definitive,
    retryAfterSec: opts.retryAfterSec ?? null,
    message: (opts.message ?? code).slice(0, 900),
    httpStatus: opts.httpStatus ?? null,
  };
}

export async function sendViaRewired(req: RewiredSendRequest, options: SendOptions = {}): Promise<SendOutcome> {
  const baseUrl = options.baseUrl === undefined ? rewiredBaseUrl() : options.baseUrl;
  const secret = options.secret === undefined ? bridgeSecret() : options.secret;
  if (!baseUrl || !secret) {
    return failure("not_configured", {
      transient: true,
      definitive: true,
      message: "REWIRED_BASE_URL o WEB_GRATIS_BRIDGE_SECRET no configurado en el sitio",
    });
  }

  const body = JSON.stringify(req);
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/web-gratis/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", [BRIDGE_SIGNATURE_HEADER]: signBridgeBody(secret, body) },
      body,
      signal: AbortSignal.timeout(options.timeoutMs ?? 12_000),
      cache: "no-store",
    });
  } catch (error) {
    // Connection never opened (DNS, refused, unreachable) → Rewired never saw it: definitely not sent.
    const causeCode = (error as { cause?: { code?: unknown } } | null)?.cause?.code;
    const neverConnected = typeof causeCode === "string" && NEVER_CONNECTED.has(causeCode);
    return failure("network", {
      transient: true,
      definitive: neverConnected,
      message: `rewired send: ${String(error)}${typeof causeCode === "string" ? ` (${causeCode})` : ""}`,
    });
  }

  const raw: unknown = await res.json().catch(() => null);
  const parsed = responseSchema.safeParse(raw);
  const json = parsed.success ? parsed.data : null;

  if (res.ok && json?.data?.wamid) return { ok: true, wamid: json.data.wamid };

  if (res.status === 401 || res.status === 403) {
    return failure("unauthorized", {
      transient: true,
      definitive: true,
      httpStatus: res.status,
      message: "Rewired rechazó la firma del puente (WEB_GRATIS_BRIDGE_SECRET distinto o reloj desfasado)",
    });
  }

  const err = json?.error;
  if (err && typeof err === "object") {
    const code = String(err.metaCode ?? err.code);
    return failure(code, {
      transient: err.transient,
      definitive: true,
      retryAfterSec: err.retryAfterSec ?? null,
      message: err.message ?? json?.message ?? code,
      httpStatus: res.status,
    });
  }
  if (typeof err === "string" && err) {
    return failure(err, {
      definitive: res.status < 500,
      message: json?.message ?? err,
      httpStatus: res.status,
    });
  }
  // No usable body: a 4xx was refused before any send; a 5xx may have died after the Meta POST.
  return failure(`http_${res.status}`, {
    transient: true,
    definitive: res.status < 500,
    httpStatus: res.status,
    message: `Rewired respondió ${res.status} sin resultado`,
  });
}
