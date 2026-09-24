/**
 * Free-website funnel — server-only helpers (service-role DB, attribution,
 * referral codes). Imported only by API routes; never from a client component.
 */
import { createHash, randomInt } from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { REFERRAL_CODE_RE, STORAGE_BUCKET } from "./config";

export interface WebGratisSignup {
  id: string;
  status:
    | "borrador"
    | "nuevo"
    | "en_construccion"
    | "entregada"
    | "compartida"
    | "activa"
    | "pausada"
    | "cancelada"
    | "descartada";
  step: number;
  lang: "es" | "en";
  business_name: string;
  business_type: string;
  city: string;
  whatsapp: string;
  services: string[];
  differentiator: string | null;
  hours: string | null;
  instagram: string | null;
  facebook: string | null;
  style: string | null;
  site_goal: "whatsapp" | "citas" | "mostrar" | null;
  logo_paths: string[];
  photo_paths: string[];
  referral_code: string;
  referred_by_id: string | null;
  ref_raw: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  fbclid: string | null;
  landing_url: string | null;
  user_agent: string | null;
  ip_hash: string | null;
  terms_accepted_at: string | null;
  share_commitment_at: string | null;
  whatsapp_consent_at: string | null;
  submitted_at: string | null;
  // Ops lifecycle (filled by the team / board)
  delivered_at: string | null;
  site_url: string | null;
  shared_at: string | null;
  free_until: string | null;
  activated_at: string | null;
  notes: string | null;
  confirmed_at: string | null;
  last_touch_at: string | null;
  last_touch_kind: string | null;
  // WhatsApp automation, payments, referral (20260925 migration)
  whatsapp_consent_version: string | null;
  last_inbound_at: string | null;
  opted_out_at: string | null;
  opt_out_reason: string | null;
  no_whatsapp_at: string | null;
  paused_at: string | null;
  recontact_after: string | null;
  paid_via: "stripe" | "paypal" | "manual" | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  referred_by_text: string | null;
  rung2_interest_at: string | null;
  share_confirmed_at: string | null;
  handoff_at: string | null;
  handoff_kind: "handoff_hot" | "handoff_help" | "call_request" | null;
  wants_changes_at: string | null;
  declined_at: string | null;
  /** PayPal / manual payers: the month is paid up to this SV date (Stripe renews on its own). */
  paid_through: string | null;
  created_at: string;
  updated_at: string;
}

export type SignupStatus = WebGratisSignup["status"];

/** Single-row operational settings (web_gratis_settings). */
export interface WebGratisSettings {
  delivery_days: number | null;
  high_demand: boolean;
  pay_link: string | null;
  demo_link: string | null;
  paypal_link: string | null;
}

export const SETTINGS_TABLE = "web_gratis_settings";

export async function loadSettings(): Promise<WebGratisSettings> {
  const { data, error } = await getDb()
    .from(SETTINGS_TABLE)
    .select("delivery_days, high_demand, pay_link, demo_link, paypal_link")
    .eq("id", 1)
    .single();
  if (error) throw error;
  return data as WebGratisSettings;
}

/** El Salvador is UTC-6 all year (no DST). */
export const SV_OFFSET_MS = 6 * 60 * 60 * 1000;

/** Statuses of a request whose site is still being built. */
export const BUILDING_STATUSES: readonly SignupStatus[] = ["nuevo", "en_construccion"];
/** Statuses of a site that is live and still in its free month. */
export const LIVE_FREE_STATUSES: readonly SignupStatus[] = ["entregada", "compartida"];

/** YYYY-MM-DD of `date` in El Salvador, shifted by `days`. */
export function svDate(date: Date, days = 0): string {
  const sv = new Date(date.getTime() - SV_OFFSET_MS);
  sv.setUTCDate(sv.getUTCDate() + days);
  return sv.toISOString().slice(0, 10);
}

export const SIGNUPS_TABLE = "web_gratis_signups";

let client: SupabaseClient | null = null;

export function getDb(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("[WebGratis] Supabase service credentials missing");
  // Every read must hit the live DB: Next's Data Cache would otherwise keep
  // serving a stale answer for a constant PostgREST URL (e.g. /pagar after a payment).
  const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: "no-store" });
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: noStoreFetch },
  });
  return client;
}

export function storage() {
  return getDb().storage.from(STORAGE_BUCKET);
}

/** Stable, non-reversible fingerprint for rate limiting (never store raw IPs). */
export function ipHash(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const pepper = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "mm-web-gratis";
  return createHash("sha256").update(`${ip}|${pepper}`).digest("hex").slice(0, 32);
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newReferralCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

/** Postgres unique-violation on the referral_code column (retryable). */
export function isReferralCodeCollision(error: { code?: string; message?: string } | null): boolean {
  return !!error && error.code === "23505" && /referral_code/.test(error.message ?? "");
}

/** Unique-violation on the one-live-request-per-business index. */
export function isDuplicateBusiness(error: { code?: string; message?: string } | null): boolean {
  return !!error && error.code === "23505" && /web_gratis_one_live_per_business/.test(error.message ?? "");
}

/** The signup behind a public code (/pagar, /s, /citas). Null for a malformed or unknown code. */
export async function findSignupByCode(raw: string): Promise<WebGratisSignup | null> {
  let code: string;
  try {
    code = decodeURIComponent(raw).trim().toUpperCase();
  } catch {
    return null;
  }
  if (!REFERRAL_CODE_RE.test(code)) return null;
  const { data, error } = await getDb().from(SIGNUPS_TABLE).select("*").eq("referral_code", code).maybeSingle();
  if (error) throw error;
  return (data as WebGratisSignup | null) ?? null;
}

export interface Referrer {
  id: string;
  business_name: string;
  whatsapp: string;
  referral_code: string;
}

/** Resolve a ?ref= code to the referring business (ignores drafts and dead rows). */
export async function findReferrer(rawRef: string | undefined): Promise<Referrer | null> {
  const code = (rawRef ?? "").trim().toUpperCase();
  if (!REFERRAL_CODE_RE.test(code)) return null;
  const { data, error } = await getDb()
    .from(SIGNUPS_TABLE)
    .select("id, business_name, whatsapp, referral_code, status")
    .eq("referral_code", code)
    .maybeSingle();
  if (error) {
    console.error("[WebGratis] referrer lookup failed", error);
    return null;
  }
  if (!data || ["borrador", "descartada", "cancelada"].includes(data.status as string)) return null;
  return {
    id: data.id as string,
    business_name: data.business_name as string,
    whatsapp: data.whatsapp as string,
    referral_code: data.referral_code as string,
  };
}

/** Drafts created from one network fingerprint in the last hour. */
export async function recentDraftsFromIp(hash: string): Promise<number> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await getDb()
    .from(SIGNUPS_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", hash)
    .gte("created_at", since);
  if (error) {
    console.error("[WebGratis] rate-limit count failed", error);
    return 0;
  }
  return count ?? 0;
}

/** Files actually present in a draft's storage folder. */
export async function listDraftFiles(draftId: string): Promise<string[]> {
  const { data, error } = await storage().list(draftId, { limit: 100 });
  if (error) {
    console.error("[WebGratis] storage list failed", error);
    return [];
  }
  return (data ?? []).filter((f) => f.id).map((f) => `${draftId}/${f.name}`);
}

/** 7-day signed links so the team can open uploads from Telegram / email. */
export async function signedLinks(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await storage().createSignedUrls(paths, 60 * 60 * 24 * 7);
  if (error || !data) {
    console.error("[WebGratis] signed urls failed", error);
    return {};
  }
  const out: Record<string, string> = {};
  for (const item of data) {
    if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
  }
  return out;
}
