/**
 * Minimal Anthropic Messages API client over fetch (server only).
 *
 * One POST /v1/messages per call, bounded by a timeout and by the caller's
 * overall deadline; overloaded / rate-limited / 5xx / network failures are
 * retried once after a short pause when time allows. `fetch` is injectable so
 * the D5 harness can stub the API.
 */

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const VERSION = "2023-06-01";
export const CALL_TIMEOUT_MS = 120_000;

export type ContentBlockParam =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string }; title?: string }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

/** Assistant turns are echoed back exactly as received (thinking blocks included). */
export type ResponseBlock = { type: string; [key: string]: unknown };

export type MessageParam =
  | { role: "user"; content: string | ContentBlockParam[] }
  | { role: "assistant"; content: ResponseBlock[] };

export interface MessageResponse {
  id: string;
  model: string;
  content: ResponseBlock[];
  stop_reason: string | null;
  stop_details?: { category?: string | null; explanation?: string | null } | null;
  usage: { input_tokens: number; output_tokens: number };
}

export type CallResult =
  | { ok: true; message: MessageResponse }
  | { ok: false; status: number; type: string; message: string; retryable: boolean };

export interface AnthropicDeps {
  fetch: typeof fetch;
  apiKey: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function once(body: Record<string, unknown>, deps: AnthropicDeps, timeoutMs: number): Promise<CallResult> {
  try {
    const res = await deps.fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": deps.apiKey,
        "anthropic-version": VERSION,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as (MessageResponse & { error?: { type?: string; message?: string } }) | null;
    if (res.ok && json && Array.isArray(json.content)) return { ok: true, message: json };
    const type = json?.error?.type ?? `http_${res.status}`;
    const message = json?.error?.message ?? `HTTP ${res.status}`;
    const retryable = res.status === 429 || res.status === 529 || res.status >= 500;
    return { ok: false, status: res.status, type, message, retryable };
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return {
      ok: false,
      status: 0,
      type: timedOut ? "timeout" : "network",
      message: timedOut ? `sin respuesta en ${Math.round(timeoutMs / 1000)} s` : error instanceof Error ? error.message : String(error),
      retryable: true,
    };
  }
}

/**
 * Create a message. `deadline` (epoch ms) caps the whole thing including the
 * retry; each try gets at most CALL_TIMEOUT_MS.
 */
export async function createMessage(body: Record<string, unknown>, deps: AnthropicDeps, deadline: number): Promise<CallResult> {
  const remaining = () => deadline - Date.now();
  if (remaining() < 5_000) return { ok: false, status: 0, type: "deadline", message: "sin tiempo para llamar al modelo", retryable: true };
  const first = await once(body, deps, Math.min(CALL_TIMEOUT_MS, remaining()));
  if (first.ok || !first.retryable || first.type === "timeout") return first;
  const pause = first.status === 429 ? 8_000 : 4_000;
  if (remaining() < pause + 30_000) return first;
  console.error("[Sites:anthropic] retrying once", first.status, first.type, first.message);
  await sleep(pause);
  return once(body, deps, Math.min(CALL_TIMEOUT_MS, remaining()));
}
