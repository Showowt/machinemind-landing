/**
 * Client websites — tables, row shape and environment (server only).
 *
 * Every integration reads its env here and reports "not configured" as a
 * value, never as a crash: a missing key must show up as a clear message on the
 * ops board and in the alerts, not as a 500.
 */
import type { SiteContentV1 } from "../site-content";
import type { SiteStatus } from "./shared";

export const SITES_TABLE = "web_gratis_sites";
export const SITE_EVENTS_TABLE = "web_gratis_site_events";
/** Public bucket for published site images: web-gratis-public/<slug>/<file>. */
export const PUBLIC_BUCKET = "web-gratis-public";

export const DEFAULT_SITES_MODEL = "claude-sonnet-5";

export interface SiteSources {
  model?: string;
  generatedAt?: string;
  instructions?: string | null;
  /** Model calls this generation took (1 = valid first time). */
  calls?: number;
  /** Validation errors sent back to the model when its first draft was invalid. */
  retryFeedback?: string | null;
  logo?: { path: string; how: string; publicUrl: string | null; note: string | null } | null;
  svgColors?: string[];
  photos?: { path: string; seen: boolean; usedIn: string[]; publicUrl: string | null; note: string | null }[];
  documents?: { path: string; read: boolean; how: string; note: string | null }[];
  sourcePrices?: string[];
  guards?: { pricesRemoved: string[]; sentencesRemoved: string[]; contrastFixes: string[] };
  notes?: string | null;
  usage?: { inputTokens: number; outputTokens: number };
  /** Set by quick edits from the board. */
  lastEdit?: { at: string; fields: string[] };
  /** Place photos from Wikimedia Commons (imagery.ts): what was searched, picked and used. */
  stock?: StockSources | null;
}

/** One Wikimedia Commons file the imagery step picked (and, once used, where it went). */
export interface StockPick {
  /** "Lugar N" as the generator saw it. */
  n: number;
  role: "hero" | "gallery";
  title: string;
  pageUrl: string;
  author: string;
  license: string;
  alt: string;
}

export interface StockSources {
  /** Why imagery ran (the place-bound vertical guessed from the form). */
  vertical: string;
  place: string | null;
  queries: string[];
  /** Files the searches returned / that passed the license, size, place and content filters. */
  found: number;
  candidates: number;
  picked: StockPick[];
  used: (StockPick & { publicUrl: string | null; usedIn: string[] })[];
  /** Why nothing (or less) was used, for the team; null when all went well. */
  note: string | null;
  ms: number;
}

export interface SiteRow {
  id: string;
  signup_id: string;
  slug: string;
  status: SiteStatus;
  content: SiteContentV1 | null;
  version: number;
  instructions: string | null;
  preview_token: string;
  custom_domain: string | null;
  domain_status: string | null;
  sources: SiteSources;
  generation_error: string | null;
  generation_attempts: number;
  generation_lease_until: string | null;
  generated_at: string | null;
  published_at: string | null;
  paused_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Environment ────────────────────────────────────────────────────────────

const env = (name: string): string | null => {
  const v = process.env[name]?.replace(/\\n/g, "").trim();
  return v ? v : null;
};

export interface GeneratorEnv {
  apiKey: string;
  model: string;
}

/** Anthropic credentials for generation, or null (sites stay queued and the team is told). */
export function generatorEnv(): GeneratorEnv | null {
  const apiKey = env("ANTHROPIC_API_KEY");
  if (!apiKey) return null;
  return { apiKey, model: env("SITES_MODEL") ?? DEFAULT_SITES_MODEL };
}

export interface MmSitesEnv {
  /** Base origin of the mm-sites deployment, no trailing slash. */
  url: string;
  revalidateSecret: string | null;
}

export function mmSitesEnv(): MmSitesEnv | null {
  const raw = env("MM_SITES_URL");
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return { url: u.origin, revalidateSecret: env("MM_SITES_REVALIDATE_SECRET") };
  } catch {
    console.error("[Sites:env] MM_SITES_URL is not a URL");
    return null;
  }
}

export interface VercelEnv {
  token: string;
  teamId: string;
  projectId: string;
}

export function vercelEnv(): VercelEnv | null {
  const token = env("VERCEL_TOKEN");
  const teamId = env("VERCEL_TEAM_ID");
  const projectId = env("MM_SITES_PROJECT_ID");
  return token && teamId && projectId ? { token, teamId, projectId } : null;
}

/** Which of VERCEL_TOKEN / VERCEL_TEAM_ID / MM_SITES_PROJECT_ID are missing (for the board's message). */
export function missingVercelEnv(): string[] {
  return ["VERCEL_TOKEN", "VERCEL_TEAM_ID", "MM_SITES_PROJECT_ID"].filter((n) => !env(n));
}

export function previewUrl(slug: string, token: string, mm: MmSitesEnv | null = mmSitesEnv()): string | null {
  return mm ? `${mm.url}/p/${slug}?t=${token}` : null;
}

export function exportUrl(slug: string, token: string, mm: MmSitesEnv | null = mmSitesEnv()): string | null {
  return mm ? `${mm.url}/api/export/${slug}?t=${token}` : null;
}
