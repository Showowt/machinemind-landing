/**
 * Free-website funnel (El Salvador) — shared constants.
 * Client-safe: no secrets in this file.
 */

export const WEB_GRATIS_PATH = "/web";
export const SITE_ORIGIN = "https://machinemindconsulting.com";

/** Monthly price after the free month, in USD. Stated on the form before submit. */
export const MONTHLY_PRICE_USD = 20;
export const FREE_DAYS = 30;

/** MachineMind WhatsApp that businesses message to confirm (Phil). */
export const MM_WHATSAPP = "19544451638";

/** Handle businesses tag when they share their new site. */
export const MM_INSTAGRAM = "machinemindconsulting";

export const STORAGE_BUCKET = "web-gratis";
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_PHOTOS = 8;
export const MAX_LOGOS = 1;
/** Hard cap on objects per draft folder (includes replaced/removed files). */
export const MAX_OBJECTS_PER_DRAFT = 16;

export const ALLOWED_UPLOAD_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

export const COUNTRY_CODES = [
  { code: "503", label: "SV +503" },
  { code: "502", label: "GT +502" },
  { code: "504", label: "HN +504" },
  { code: "505", label: "NI +505" },
  { code: "506", label: "CR +506" },
  { code: "507", label: "PA +507" },
  { code: "52", label: "MX +52" },
  { code: "57", label: "CO +57" },
  { code: "1", label: "US +1" },
] as const;

export type CountryCode = (typeof COUNTRY_CODES)[number]["code"];

export const SITE_GOALS = ["whatsapp", "citas", "mostrar"] as const;
export type SiteGoal = (typeof SITE_GOALS)[number];

/** Referral codes: 6 chars, no I/O/0/1 so they survive being read aloud. */
export const REFERRAL_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;

/**
 * Normalize a local number + country code to E.164, or null when it can't be a
 * WhatsApp number. El Salvador: 8 digits starting with 6 or 7 (mobile) or 2.
 */
export function toE164(countryCode: string, local: string): string | null {
  let digits = local.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith(countryCode) && digits.length > countryCode.length + 5) {
    digits = digits.slice(countryCode.length);
  }
  if (countryCode === "503") {
    if (!/^[267]\d{7}$/.test(digits)) return null;
  } else if (countryCode === "1") {
    if (!/^[2-9]\d{9}$/.test(digits)) return null;
  } else if (!/^\d{6,12}$/.test(digits)) {
    return null;
  }
  return `+${countryCode}${digits}`;
}

/** Split "corte, barba\ntinte" into a clean list (max 20, each ≤ 80 chars). */
export function splitServices(raw: string): string[] {
  return raw
    .split(/[,\n;·•]+/)
    .map((s) => s.trim().replace(/\s+/g, " "))
    .filter((s) => s.length > 0)
    .map((s) => s.slice(0, 80))
    .slice(0, 20);
}

export function referralLink(code: string): string {
  return `${SITE_ORIGIN}${WEB_GRATIS_PATH}?ref=${code}`;
}
