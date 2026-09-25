/**
 * Vercel REST — attach a site's hostname to the mm-sites project.
 *
 * DNS is external (GoDaddy): one wildcard CNAME *.machinemindconsulting.com →
 * cname.vercel-dns.com covers every slug, but Vercel only serves (and issues a
 * certificate for) hostnames that are added to the project, so each published
 * subdomain — and each custom domain — is added here at publish time.
 *
 *   POST /v10/projects/{id}/domains            add (already on this project = fine)
 *   GET  /v9/projects/{id}/domains/{name}      verified? + TXT challenge if any
 *   GET  /v6/domains/{name}/config             misconfigured? (DNS not pointing at Vercel)
 */
import type { VercelEnv } from "./db";

const API = "https://api.vercel.com";
const TIMEOUT_MS = 15_000;

export interface DomainVerification {
  type: string;
  domain: string;
  value: string;
}

export type DomainResult =
  | {
      ok: true;
      verified: boolean;
      /** DNS doesn't point at Vercel yet — or it couldn't be checked (then `configChecked` is false). */
      misconfigured: boolean;
      /** False when Vercel's DNS-config lookup itself failed (status in `configStatus`): unknown, not "missing". */
      configChecked: boolean;
      configStatus: number;
      verification: DomainVerification[];
    }
  | { ok: false; code: "unauthorized" | "in_use" | "invalid" | "unavailable"; message: string };

interface VercelErrorBody {
  error?: { code?: string; message?: string };
}

async function call(
  deps: { fetch: typeof fetch; env: VercelEnv },
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown,
): Promise<{ status: number; json: Record<string, unknown> | null; networkError: string | null }> {
  const sep = path.includes("?") ? "&" : "?";
  try {
    const res = await deps.fetch(`${API}${path}${sep}teamId=${encodeURIComponent(deps.env.teamId)}`, {
      method,
      headers: { authorization: `Bearer ${deps.env.token}`, ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    return { status: res.status, json, networkError: null };
  } catch (error) {
    return { status: 0, json: null, networkError: error instanceof Error ? error.message : String(error) };
  }
}

function errorOf(json: Record<string, unknown> | null): { code: string; message: string } {
  const e = (json as VercelErrorBody | null)?.error;
  return { code: e?.code ?? "unknown", message: e?.message ?? "sin detalle" };
}

function verificationOf(json: Record<string, unknown> | null): DomainVerification[] {
  const list = Array.isArray(json?.verification) ? (json?.verification as unknown[]) : [];
  return list
    .map((v) => v as Partial<DomainVerification>)
    .filter((v): v is DomainVerification => typeof v.type === "string" && typeof v.domain === "string" && typeof v.value === "string");
}

/** Add `name` to the mm-sites project (idempotent) and report whether it can serve yet. */
export async function attachDomain(name: string, deps: { fetch: typeof fetch; env: VercelEnv }): Promise<DomainResult> {
  const projectPath = `/v9/projects/${encodeURIComponent(deps.env.projectId)}/domains/${encodeURIComponent(name)}`;
  const add = await call(deps, "POST", `/v10/projects/${encodeURIComponent(deps.env.projectId)}/domains`, { name });
  if (add.networkError) return { ok: false, code: "unavailable", message: `Vercel no respondió (${add.networkError}).` };
  if (add.status === 401 || add.status === 403) {
    return { ok: false, code: "unauthorized", message: "El token de Vercel no es válido o no tiene acceso al equipo/proyecto mm-sites." };
  }
  if (add.status === 429 || add.status >= 500) {
    return { ok: false, code: "unavailable", message: `Vercel está ocupado (${add.status}). Intente en un minuto.` };
  }

  let project = await call(deps, "GET", projectPath);
  if (add.status >= 400) {
    // "Already added" answers vary by API version: it's fine exactly when the project now lists it.
    if (project.status !== 200) {
      const e = errorOf(add.json);
      if (/in_use|already/i.test(e.code)) {
        return { ok: false, code: "in_use", message: `${name} ya está conectado a otro proyecto de Vercel (${e.message}).` };
      }
      return { ok: false, code: "invalid", message: `Vercel rechazó ${name}: ${e.message} (${e.code}).` };
    }
  }
  if (project.status !== 200) {
    return { ok: false, code: "unavailable", message: `No se pudo confirmar ${name} en Vercel (${project.status || project.networkError}).` };
  }

  let verified = project.json?.verified === true;
  if (!verified) {
    // Ask Vercel to re-check ownership now (a TXT record may already be in place).
    const check = await call(deps, "POST", `${projectPath}/verify`);
    if (check.status === 200 && check.json?.verified === true) {
      verified = true;
      project = check;
    }
  }

  const config = await call(deps, "GET", `/v6/domains/${encodeURIComponent(name)}/config`);
  const configChecked = config.status === 200;
  if (!configChecked) console.error("[Sites:vercel] DNS config lookup failed", name, config.status, config.networkError ?? errorOf(config.json));
  // Unknown counts as "not serving yet" (never tell a client about a site that may not load).
  const misconfigured = configChecked ? config.json?.misconfigured === true : true;
  return { ok: true, verified, misconfigured, configChecked, configStatus: config.status, verification: verified ? [] : verificationOf(project.json) };
}

/** Remove a custom domain from the project (404 = already gone = fine). */
export async function detachDomain(name: string, deps: { fetch: typeof fetch; env: VercelEnv }): Promise<{ ok: boolean; message: string }> {
  const res = await call(deps, "DELETE", `/v9/projects/${encodeURIComponent(deps.env.projectId)}/domains/${encodeURIComponent(name)}`);
  if (res.networkError) return { ok: false, message: `Vercel no respondió (${res.networkError}).` };
  if (res.status === 200 || res.status === 204 || res.status === 404) return { ok: true, message: "Dominio desconectado." };
  const e = errorOf(res.json);
  return { ok: false, message: `Vercel no lo quitó: ${e.message} (${res.status}).` };
}
