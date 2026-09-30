/**
 * Ops-board auth: a shared bearer key (WEB_GRATIS_ADMIN_TOKEN) for Phil,
 * Sergio and Fernanda. Fails closed — with no key configured, every admin
 * call is refused. Since 2026-09-30 the key may be short (Phil wants a
 * typeable numeric code), so every WRONG attempt pays a 1-second penalty:
 * that turns a brute-force of the code space into years, not minutes, while
 * a correct login stays instant.
 *
 * Also the ops-side view of the columns added by migration 20260927
 * (country, document_paths, existing_website, address, contact_email,
 * extra_notes), shared by the board API, the CSV export and the bridge.
 */
import { timingSafeEqual } from "crypto";
import { countryFromE164, type SignupCountry } from "./config";
import { fail } from "./http";
import type { WebGratisSignup } from "./server";

const WRONG_KEY_DELAY_MS = 1000;

export async function requireAdmin(request: Request): Promise<Response | null> {
  const token = process.env.WEB_GRATIS_ADMIN_TOKEN?.trim();
  if (!token || token.length < 8) return fail(503, "server_error", "admin token not configured");
  const given = Buffer.from((request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim());
  const expected = Buffer.from(token);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    console.error("[WebGratis:admin] wrong board key", request.headers.get("x-forwarded-for") ?? "ip?");
    await new Promise((r) => setTimeout(r, WRONG_KEY_DELAY_MS));
    return fail(401, "invalid", "unauthorized");
  }
  return null;
}

export const BOARD_VIEWS = [
  "llamar",
  "seguimiento",
  "nuevo",
  "en_construccion",
  "entregada",
  "compartida",
  "activa",
  "cerradas",
  "borrador",
  "todas",
] as const;
export type BoardView = (typeof BOARD_VIEWS)[number];

/** Statuses a follow-up can still move forward (seguimiento view + digests). */
export const FOLLOW_UP_STATUSES: readonly string[] = ["borrador", "nuevo", "en_construccion", "entregada", "compartida", "activa"];

/** Which statuses each board tab shows. */
export function statusesFor(view: BoardView): string[] | null {
  switch (view) {
    case "llamar":
      return ["borrador"]; // + quick_capture_at is not null (the list route adds it)
    case "seguimiento":
      return [...FOLLOW_UP_STATUSES]; // + next_follow_up_at is not null
    case "cerradas":
      return ["pausada", "cancelada", "descartada"];
    case "todas":
      return null;
    default:
      return [view];
  }
}

// ─── Country + documents (migration 20260927) ───────────────────────────────

export const BOARD_COUNTRIES = ["SV", "PA", "CO", "OTHER"] as const satisfies readonly SignupCountry[];
export type BoardCountry = SignupCountry;

/** Columns added on 2026-09-24; optional here so this compiles whether or not server.ts's row type lists them yet. */
export interface SignupDocsCountry {
  country?: BoardCountry | null;
  document_paths?: string[] | null;
  existing_website?: string | null;
  address?: string | null;
  contact_email?: string | null;
  extra_notes?: string | null;
}

/** A signup row as the ops side reads it (`select("*")`). */
export type OpsSignup = WebGratisSignup & SignupDocsCountry;

/**
 * The market a signup belongs to. Rows saved before the column existed (or by a
 * client that didn't send it) fall back to the WhatsApp prefix.
 */
export function signupCountry(row: { country?: string | null; whatsapp?: string | null }): BoardCountry {
  if (row.country === "SV" || row.country === "PA" || row.country === "CO" || row.country === "OTHER") return row.country;
  return countryFromE164(row.whatsapp ?? "");
}

export function documentPathsOf(row: { document_paths?: string[] | null }): string[] {
  return Array.isArray(row.document_paths) ? row.document_paths : [];
}

/** `?country=` → a country, or null for "all". */
export function parseBoardCountry(value: string | null): BoardCountry | null {
  const v = (value ?? "").trim().toUpperCase();
  return (BOARD_COUNTRIES as readonly string[]).includes(v) ? (v as BoardCountry) : null;
}

/**
 * PostgREST `or` filter selecting one country — matches signupCountry(): rows
 * with no country yet are placed by their WhatsApp prefix.
 */
export function countryOrFilter(country: BoardCountry): string {
  switch (country) {
    case "SV":
      return "country.eq.SV,and(country.is.null,whatsapp.like.+503*)";
    case "PA":
      return "country.eq.PA,and(country.is.null,whatsapp.like.+507*)";
    case "CO":
      return "country.eq.CO,and(country.is.null,whatsapp.like.+57*)";
    case "OTHER":
      return "country.eq.OTHER,and(country.is.null,whatsapp.not.like.+503*,whatsapp.not.like.+507*,whatsapp.not.like.+57*)";
  }
}

/** Row with country resolved and document_paths always an array (what the board renders). */
export function normalizeOpsRow<T extends OpsSignup>(row: T): T & { country: BoardCountry; document_paths: string[] } {
  return { ...row, country: signupCountry(row), document_paths: documentPathsOf(row) };
}
