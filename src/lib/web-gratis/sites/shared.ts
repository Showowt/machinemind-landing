/**
 * Client websites — what the ops board and the server share: statuses, the
 * board's per-signup site summary, slug / custom-domain validation and the DNS
 * instructions. Client-safe (no secrets, no DB, no Node APIs).
 */
import { RESERVED_SLUGS, SITES_ROOT_DOMAIN } from "../site-content";

export const SITE_STATUSES = ["generating", "draft", "published", "paused", "failed", "archived"] as const;
export type SiteStatus = (typeof SITE_STATUSES)[number];

export const SITE_STATUS_LABEL: Record<SiteStatus, string> = {
  generating: "Generando",
  draft: "Lista para revisar",
  published: "Publicada",
  paused: "Pausada",
  failed: "Falló",
  archived: "Archivada",
};

/** Generation attempts before a site is marked 'failed' and the team is alerted. */
export const MAX_GENERATION_ATTEMPTS = 3;

/** Same rule as the DB CHECK on web_gratis_sites.slug. */
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

/** Why a slug can't be used (Spanish, for the board), or null when it's valid. */
export function slugProblem(raw: string): string | null {
  const slug = raw.trim().toLowerCase();
  if (slug.length < 2) return "Muy corta: mínimo 2 caracteres.";
  if (slug.length > 40) return "Muy larga: máximo 40 caracteres.";
  if (!SLUG_RE.test(slug)) return "Solo letras minúsculas sin tildes, números y guiones (no al inicio ni al final).";
  if (slug.includes("--")) return "Sin guiones dobles.";
  if (RESERVED_SLUGS.has(slug)) return "Esa dirección está reservada.";
  return null;
}

export function publicSiteUrl(slug: string): string {
  return `https://${slug}.${SITES_ROOT_DOMAIN}`;
}

// ─── Custom domains ─────────────────────────────────────────────────────────

/** Same rule as the DB CHECK on web_gratis_sites.custom_domain. */
const DOMAIN_RE = /^[a-z0-9.-]+\.[a-z]{2,}$/;

/** Two-part public suffixes common in our markets (so "mitienda.com.sv" is an apex). */
const TWO_PART_SUFFIXES = new Set([
  "com.sv", "org.sv", "net.sv", "edu.sv", "com.co", "net.co", "org.co", "edu.co", "nom.co",
  "com.mx", "com.gt", "com.hn", "com.ni", "co.cr", "com.pa", "com.ar", "com.br", "com.pe",
  "com.ec", "com.do", "com.uy", "com.ve", "com.bo", "com.py", "co.uk", "com.es",
]);

/** "https://www.MiTienda.com/" → "www.mitienda.com"; null when it can't be a domain we host. */
export function normalizeDomain(raw: string): string | null {
  let value = raw.trim().toLowerCase();
  value = value.replace(/^https?:\/\//, "").replace(/[/?#].*$/, "").replace(/\.$/, "");
  if (value.length < 4 || value.length > 253) return null;
  if (!DOMAIN_RE.test(value)) return null;
  const labels = value.split(".");
  if (labels.some((l) => l.length === 0 || l.length > 63 || l.startsWith("-") || l.endsWith("-"))) return null;
  // Our own domain is served by slug, never as a "custom" domain.
  if (value === SITES_ROOT_DOMAIN || value.endsWith(`.${SITES_ROOT_DOMAIN}`)) return null;
  if (value.endsWith(".vercel.app")) return null;
  return value;
}

/** True for "mitienda.com" / "mitienda.com.sv"; false for "www.mitienda.com". */
export function isApexDomain(domain: string): boolean {
  const labels = domain.split(".");
  const suffix = labels.slice(-2).join(".");
  return labels.length === (TWO_PART_SUFFIXES.has(suffix) ? 3 : 2);
}

export interface DnsRecord {
  type: "A" | "CNAME" | "TXT";
  name: string;
  value: string;
}

/** Records the business (or Phil) adds at their registrar for a custom domain. */
export function dnsRecordsFor(domain: string): DnsRecord[] {
  if (isApexDomain(domain)) return [{ type: "A", name: "@", value: "76.76.21.21" }];
  const labels = domain.split(".");
  const suffix = labels.slice(-2).join(".");
  const apexLabels = TWO_PART_SUFFIXES.has(suffix) ? 3 : 2;
  return [{ type: "CNAME", name: labels.slice(0, labels.length - apexLabels).join("."), value: "cname.vercel-dns.com" }];
}

export const DOMAIN_STATUS_LABEL: Record<string, string> = {
  active: "Activo ✓",
  pending_dns: "Esperando DNS",
  needs_verification: "Vercel pide verificación (TXT)",
  error: "Error",
};

// ─── Board payloads ─────────────────────────────────────────────────────────

export interface SiteStats {
  views30: number;
  whatsapp30: number;
}

/** One signup's website as the ops board shows it. */
export interface SiteSummary {
  id: string;
  signupId: string;
  slug: string;
  status: SiteStatus;
  version: number;
  /** A generation is running right now (lease held). */
  generatingNow: boolean;
  generationAttempts: number;
  generationError: string | null;
  instructions: string | null;
  generatedAt: string | null;
  publishedAt: string | null;
  pausedAt: string | null;
  updatedAt: string;
  publicUrl: string;
  previewUrl: string | null;
  exportUrl: string | null;
  customDomain: string | null;
  domainStatus: string | null;
  stats: SiteStats | null;
  /** The generator's note for the team (what it skipped and why). */
  notes: string | null;
  /** Client files the generator could not read (Word/Excel, HEIC, too large…). */
  unread: string[];
  /** Honesty guards that fired (prices / claims removed, contrast fixes). */
  guards: string[];
}

/** Which integrations are configured (the board explains what's missing). */
export interface SitesConfig {
  generator: boolean;
  preview: boolean;
  vercel: boolean;
}

/** The subset of SiteContentV1 the board's quick-edit form works on. */
export interface SiteQuickEdits {
  tagline?: string;
  heroHeadline?: string;
  heroSubheadline?: string;
  ctaLabel?: string;
  about?: string[];
  /** The full new list; `from` is the index of the existing item it edits (keeps its image), null for a new item. */
  services?: { from: number | null; name: string; description: string | null; price: string | null }[];
  palette?: { primary?: string; bg?: string; text?: string };
}
