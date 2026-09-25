/**
 * Free-website funnel (El Salvador + Colombia) — shared constants.
 * Client-safe: no secrets in this file.
 */

export const WEB_GRATIS_PATH = "/web";
export const SITE_ORIGIN = "https://machinemindconsulting.com";

/** Monthly price after the free month, in USD. Stated on the form before submit. */
export const MONTHLY_PRICE_USD = 19;
export const FREE_DAYS = 30;

/**
 * The dedicated free-website funnel line (+1 786-257-0284, Meta Cloud API on
 * WABA 760506473408925). Every "Confirmar por WhatsApp" / help link opens a chat
 * here, so the business's first message opens the 24-hour window on the same
 * number the automatic reminders come from — and the Rewired responder answers.
 */
export const MM_WHATSAPP = "17862570284";
/** The same line, formatted for people to read. */
export const MM_WHATSAPP_DISPLAY = "+1 786-257-0284";

/** Handle businesses tag when they share their new site. */
export const MM_INSTAGRAM = "machinemindconsulting";

// ─── Markets ────────────────────────────────────────────────────────────────

/** Markets the /web page is framed for (copy, phone default, city examples). */
export const MARKETS = ["SV", "CO"] as const;
export type Market = (typeof MARKETS)[number];
/** Value of web_gratis_signups.country — always derived from the WhatsApp number. */
export type SignupCountry = Market | "OTHER";

export const MARKET_INFO: Record<
  Market,
  { dial: string; name: string; timezone: string; cities: readonly string[]; phoneExample: string }
> = {
  SV: {
    dial: "503",
    name: "El Salvador",
    timezone: "America/El_Salvador",
    cities: ["San Salvador", "Santa Tecla", "San Miguel", "Santa Ana"],
    phoneExample: "7000 0000",
  },
  CO: {
    dial: "57",
    name: "Colombia",
    timezone: "America/Bogota",
    cities: ["Bogotá", "Medellín", "Cali", "Barranquilla", "Cartagena"],
    phoneExample: "300 123 4567",
  },
};

/** "sv" | "co" | "el-salvador" | "Colombia" | ISO code → Market, else null. */
export function parseMarket(raw: string | null | undefined): Market | null {
  const v = (raw ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s_-]+/g, "");
  if (v === "sv" || v === "slv" || v === "elsalvador" || v === "salvador") return "SV";
  if (v === "co" || v === "col" || v === "colombia") return "CO";
  return null;
}

/** Country of a validated E.164 number, so the DB column always matches the number. */
export function countryFromE164(e164: string): SignupCountry {
  if (e164.startsWith("+503")) return "SV";
  if (e164.startsWith("+57")) return "CO";
  return "OTHER";
}

// ─── Uploads ────────────────────────────────────────────────────────────────

export const STORAGE_BUCKET = "web-gratis";
export const MAX_UPLOAD_MB = 25;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
export const MAX_PHOTOS = 8;
export const MAX_LOGOS = 1;
export const MAX_DOCUMENTS = 10;
/** Hard cap on objects per draft folder (includes replaced/removed files). */
export const MAX_OBJECTS_PER_DRAFT = 40;

/** Upload kinds; the object name starts with "<kind>-" and the server sorts on it. */
export const UPLOAD_KINDS = ["logo", "photo", "document"] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/gif": "gif",
};

/** Logo design files on top of images. */
const LOGO_EXTRA_TYPES: Record<string, string> = {
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
  "application/illustrator": "ai",
  "application/postscript": "eps",
  "image/vnd.adobe.photoshop": "psd",
};

/** Menus, price lists, catalogs, brochures. Images count too (a photo of a menu). */
const DOCUMENT_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.oasis.opendocument.text": "odt",
  "application/vnd.oasis.opendocument.spreadsheet": "ods",
  "text/plain": "txt",
  "text/csv": "csv",
};

/** MIME type → stored file extension, per upload kind (validated against the KIND). */
export const UPLOAD_TYPES_BY_KIND: Record<UploadKind, Record<string, string>> = {
  logo: { ...IMAGE_TYPES, ...LOGO_EXTRA_TYPES },
  photo: { ...IMAGE_TYPES },
  document: { ...DOCUMENT_TYPES, ...IMAGE_TYPES },
};

/** Every MIME type any kind accepts (matches the bucket's allowed list). */
export const ALLOWED_UPLOAD_TYPES: Record<string, string> = {
  ...UPLOAD_TYPES_BY_KIND.photo,
  ...UPLOAD_TYPES_BY_KIND.logo,
  ...UPLOAD_TYPES_BY_KIND.document,
};

/** File extension → MIME type, for pickers that report an empty or generic type. */
export const UPLOAD_EXTENSION_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  gif: "image/gif",
  svg: "image/svg+xml",
  ai: "application/illustrator",
  eps: "application/postscript",
  psd: "image/vnd.adobe.photoshop",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  txt: "text/plain",
  csv: "text/csv",
};

/** Stored extension for this MIME type when the kind accepts it, else null. */
export function uploadExtension(kind: UploadKind, contentType: string): string | null {
  const mime = contentType.toLowerCase().split(";")[0].trim();
  return UPLOAD_TYPES_BY_KIND[kind][mime] ?? null;
}

/**
 * <input accept> per kind. iOS Safari only offers the Files picker for types it
 * recognises, so documents list both MIME types and extensions.
 */
export const UPLOAD_ACCEPT: Record<UploadKind, string> = {
  logo: "image/*,.svg,.pdf,.ai,.eps,.psd,image/svg+xml,application/pdf,application/illustrator,application/postscript,image/vnd.adobe.photoshop",
  photo: "image/*,.heic,.heif",
  document: [
    ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.odt,.ods",
    Object.keys(DOCUMENT_TYPES).join(","),
    "image/*",
  ].join(","),
};

// ─── Phone ──────────────────────────────────────────────────────────────────

export const COUNTRY_CODES = [
  { code: "503", label: "SV +503" },
  { code: "57", label: "CO +57" },
  { code: "502", label: "GT +502" },
  { code: "504", label: "HN +504" },
  { code: "505", label: "NI +505" },
  { code: "506", label: "CR +506" },
  { code: "507", label: "PA +507" },
  { code: "52", label: "MX +52" },
  { code: "1", label: "US +1" },
] as const;

export type CountryCode = (typeof COUNTRY_CODES)[number]["code"];

export const SITE_GOALS = ["whatsapp", "citas", "mostrar"] as const;
export type SiteGoal = (typeof SITE_GOALS)[number];

/** Referral codes: 6 chars, no I/O/0/1 so they survive being read aloud. */
export const REFERRAL_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;

/** Optional contact email (same rule on the form and the server). */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Normalize a local number + country code to E.164, or null when it can't be a
 * WhatsApp number. El Salvador: 8 digits starting with 2, 6 or 7. Colombia:
 * a 10-digit mobile starting with 3. US: 10 digits.
 */
export function toE164(countryCode: string, local: string): string | null {
  let digits = local.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith(countryCode) && digits.length > countryCode.length + 5) {
    digits = digits.slice(countryCode.length);
  }
  if (countryCode === "503") {
    if (!/^[267]\d{7}$/.test(digits)) return null;
  } else if (countryCode === "57") {
    if (!/^3\d{9}$/.test(digits)) return null;
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

/** Wording version of the WhatsApp consent line shown at step 1 of /web. */
export const WHATSAPP_CONSENT_VERSION_STEP1 = "v1-step1-2026-09-24";
/** Consent recorded at submit when no step-1 draft ever reached the server. */
export const WHATSAPP_CONSENT_VERSION_SUBMIT = "v1-submit-2026-09-24";

/** PayPal fallback when the board has no PayPal link saved. */
export const DEFAULT_PAYPAL_LINK = "https://paypal.me/MachineMind/19USD";

/** Payment page for one signup (the day-28/30 templates link here). */
export function payUrl(code: string): string {
  return `${SITE_ORIGIN}/pagar/${code}`;
}

/** Short link to the client's live site (the "site ready" template button). */
export function siteShortUrl(code: string): string {
  return `${SITE_ORIGIN}/s/${code}`;
}

/** Booking-demo link used by the rescue template. */
export function demoUrl(code: string): string {
  return `${SITE_ORIGIN}/citas/${code}`;
}

/** Footer line every delivered site carries — new leads land in the same funnel. */
export function footerSnippet(code: string): string {
  return `Hecho por MachineMind · ¿Quiere su web gratis? machinemindconsulting.com${WEB_GRATIS_PATH}?ref=${code}`;
}
