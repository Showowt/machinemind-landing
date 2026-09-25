/**
 * Honesty guards for generated site copy (server-side, after the model).
 *
 * The prompt tells the model never to invent facts; these make it true even
 * when it does. Every rule is conservative: a sentence that fails is dropped
 * (and reported to the team), a required field that ends up empty gets a plain
 * fallback built from the client's own form data.
 *
 *  - Prices survive only when their amounts appear in what the client wrote
 *    (services, differentiator, notes), in Phil's regeneration notes, or — when a
 *    client document (menu / price list) was actually read; never a logo or a
 *    photo — in the verbatim snippets the model returned in `sourcePrices`.
 *  - A sentence is dropped when it carries a number the client never gave
 *    ("más de 10 años", "desde 2015", "500 clientes"), a quoted testimonial, a
 *    phone / e-mail / link / @handle, an award or superlative claim that isn't in
 *    the form ("el mejor", "premiado", "certificado", "garantizado"), a
 *    capability or offer the client never stated ("envíos", "a domicilio", "al
 *    por mayor", "descuento", "gratis"), or any mention of the government.
 */
import { z } from "zod";
import type { SiteContentV1 } from "../site-content";

// ─── Text helpers ───────────────────────────────────────────────────────────

/** Lower-case, no accents, single spaces — for "does the client's text contain this". */
export function norm(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.–—-]+$/, "")}…`;
}

// ─── Amounts ────────────────────────────────────────────────────────────────

const NUMBER_RE = /\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?(?!\d)|\d+(?:[.,]\d+)?/g;

/** Every plausible reading of one number token ("25.000" → 25000 and 25; "3,50" → 3.5). */
function readings(token: string): number[] {
  const out = new Set<number>();
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(token)) {
    out.add(Number(token.replace(/[.,]/g, "")));
    if ((token.match(/[.,]/g) ?? []).length === 1) out.add(Number(token.replace(",", ".")));
  } else if (/^\d{1,3}(?:[.,]\d{3})+[.,]\d{1,2}$/.test(token)) {
    const cut = Math.max(token.lastIndexOf("."), token.lastIndexOf(","));
    out.add(Number(`${token.slice(0, cut).replace(/[.,]/g, "")}.${token.slice(cut + 1)}`));
  } else {
    out.add(Number(token.replace(",", ".")));
  }
  return [...out].filter((n) => Number.isFinite(n));
}

const key = (n: number) => n.toFixed(2);

/** Number tokens in a text, each with its readings. */
export function numberTokens(text: string): { token: string; values: number[] }[] {
  return (text.match(NUMBER_RE) ?? []).map((token) => ({ token, values: readings(token) }));
}

/** All amounts a text supports (every reading of every number in it). */
export function amountSet(text: string): Set<string> {
  const out = new Set<string>();
  for (const t of numberTokens(text)) for (const v of t.values) out.add(key(v));
  return out;
}

function supported(token: { values: number[] }, allowed: Set<string>): boolean {
  return token.values.some((v) => allowed.has(key(v)));
}

// ─── Sources ────────────────────────────────────────────────────────────────

export interface GuardSources {
  /** Everything the client wrote + Phil's instructions (+ verbatim document snippets when documents were read). */
  factText: string;
  /** Only the text prices may come from. */
  priceText: string;
  /** The client's WhatsApp digits (the one phone number the copy may carry). */
  whatsappDigits: string;
}

export interface GuardReport {
  pricesRemoved: string[];
  sentencesRemoved: string[];
}

const QUOTE_RE = /[“”«»"„]([^“”«»"„]{8,})[“”«»"„]/;
const CONTACT_RE = /(https?:\/\/|www\.|[\w.+-]+@[\w-]+\.[\w.]+|(^|\s)@[\w.]{2,})/i;
const PHONE_RE = /(?:\+?\d[\s().-]*){7,}/g;
/** "8:00 a.m.", "5 p.m.", "5pm", "17:00" — hour in group 1 or 3, minutes in 2 or 4. */
const TIME_RE = /\b(\d{1,2})(?::(\d{2}))?\s*(?:a\.?\s?m\.?|p\.?\s?m\.?)(?![a-z])|\b(\d{1,2}):(\d{2})\b/gi;
const GOVERNMENT_RE =/\b(gobierno|gubernament\w*|ministerio|presidencia|presidente|alcaldia|estado salvadoreno|estado colombiano)\b/;
/**
 * Claims the copy may only make when the client's own text supports them:
 * the sentence survives when any of `words` appears in what the client wrote.
 * Covers awards / superlatives and the capabilities the prompt forbids
 * inventing (shipping, home delivery, wholesale, discounts, free offers).
 */
const CLAIM_PATTERNS: { re: RegExp; words: string[] }[] = [
  { re: /\b(el|la|los|las) mejor(es)?\b/, words: ["mejor"] },
  { re: /\bnumero uno\b/, words: ["numero uno"] },
  { re: /#\s?1\b/, words: ["#1"] },
  { re: /\bpremi(o|os|ad[oa]s?)\b/, words: ["premi"] },
  { re: /\bgalardon/, words: ["galardon"] },
  { re: /\bcertificad[oa]s?\b/, words: ["certificad"] },
  { re: /\blider(es)? (en|del|de)\b/, words: ["lider"] },
  { re: /\breconocid[oa]s? (como|por)\b/, words: ["reconocid"] },
  { re: /\bgarantiz/, words: ["garantiz"] },
  { re: /\bclientes (satisfechos|felices|contentos)\b/, words: ["clientes satisfechos"] },
  { re: /\bmiles de\b/, words: ["miles de"] },
  { re: /\bcientos de\b/, words: ["cientos de"] },
  { re: /\benvios?\b/, words: ["envio", "enviamos", "delivery", "domicilio"] },
  { re: /\ba domicilio\b/, words: ["domicilio", "delivery", "envio", "enviamos"] },
  { re: /\bdelivery\b/, words: ["delivery", "domicilio", "envio", "enviamos"] },
  { re: /\b(todo el pais|a nivel nacional)\b/, words: ["todo el pais", "nacional"] },
  { re: /\b(al por mayor|mayoreo|mayoristas?)\b/, words: ["por mayor", "mayoreo", "mayorista"] },
  { re: /\b(descuentos?|promocion(es)?)\b/, words: ["descuento", "promocion"] },
  { re: /\b(gratis|gratuit[oa]s?|sin costo)\b/, words: ["gratis", "gratuit", "sin costo"] },
  { re: /\bmismo dia\b/, words: ["mismo dia"] },
];

export class CopyGuard {
  readonly report: GuardReport = { pricesRemoved: [], sentencesRemoved: [] };
  private readonly facts: Set<string>;
  private readonly prices: Set<string>;
  private readonly factNorm: string;
  private readonly priceNorm: string;

  constructor(private readonly sources: GuardSources) {
    this.facts = amountSet(sources.factText);
    this.prices = amountSet(sources.priceText);
    this.factNorm = norm(sources.factText);
    this.priceNorm = norm(sources.priceText);
  }

  /**
   * A clock time the client gave: its hour appears in what they wrote (as
   * written, or in 12/24-hour form: "5 p.m." ↔ "17:00"), and its minutes are
   * ":00" or also given.
   */
  private timeOk(hour: number, minutes: number | null): boolean {
    const hourOk = [hour, hour - 12, hour + 12].some((h) => h >= 0 && h <= 24 && this.facts.has(key(h)));
    return hourOk && (minutes === null || minutes === 0 || this.facts.has(key(minutes)));
  }

  /** Why this sentence must go, or null to keep it. */
  private reject(sentence: string): string | null {
    const n = norm(sentence);
    const quoted = QUOTE_RE.exec(sentence);
    if (quoted && quoted[1].trim().split(/\s+/).length >= 3 && !this.factNorm.includes(norm(quoted[1]))) return "testimonio o cita";
    if (CONTACT_RE.test(sentence)) return "dato de contacto en el texto";
    for (const run of sentence.match(PHONE_RE) ?? []) {
      const digits = run.replace(/\D/g, "");
      if (digits.length >= 7 && digits !== this.sources.whatsappDigits && !this.sources.whatsappDigits.endsWith(digits)) return "teléfono";
    }
    if (GOVERNMENT_RE.test(n)) return "menciona al gobierno";
    for (const m of sentence.matchAll(TIME_RE)) {
      const hour = Number(m[1] ?? m[3]);
      const minutes = m[2] ?? m[4];
      if (!this.timeOk(hour, minutes === undefined ? null : Number(minutes))) return `hora que el cliente no dio (${m[0].trim()})`;
    }
    for (const t of numberTokens(sentence.replace(TIME_RE, " "))) {
      if (!supported(t, this.facts)) return `número que el cliente no dio (${t.token})`;
    }
    for (const c of CLAIM_PATTERNS) {
      if (c.re.test(n) && !c.words.some((w) => this.factNorm.includes(w))) return `afirmación no respaldada («${c.words[0]}»)`;
    }
    return null;
  }

  /** The text with every unsupported sentence removed ("" when nothing survives). */
  text(value: string): string {
    const sentences = value
      .split(/(?<=[.!?…])\s+|\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const kept: string[] = [];
    for (const s of sentences) {
      const why = this.reject(s);
      if (why) this.report.sentencesRemoved.push(`${clip(s, 90)} — ${why}`);
      else kept.push(s);
    }
    return kept.join(" ").trim();
  }

  /** Guarded text, or `fallback` (already safe) when nothing survives. */
  required(value: string, fallback: string, max: number): string {
    const kept = this.text(value);
    return clip(kept || fallback, max);
  }

  optional(value: string | null, max: number): string | null {
    if (!value) return null;
    const kept = this.text(value);
    return kept ? clip(kept, max) : null;
  }

  /** A price the client actually gave, or null. */
  price(value: string | null): string | null {
    if (!value) return null;
    const tokens = numberTokens(value);
    const ok = tokens.length
      ? tokens.every((t) => supported(t, this.prices))
      : this.priceNorm.includes(norm(value));
    if (!ok) {
      this.report.pricesRemoved.push(value);
      return null;
    }
    return value.trim();
  }
}

// ─── Whole-content pass ─────────────────────────────────────────────────────

export interface Fallbacks {
  name: string;
  type: string;
  city: string;
  services: string[];
  ctaLabel: string;
}

/**
 * Run every visible text field through the guard. Keeps the content valid
 * against SiteContentV1 (minimum list sizes, required fields) by falling back
 * to plain copy built from the client's own form answers.
 */
export function guardContent(content: SiteContentV1, guard: CopyGuard, fb: Fallbacks): SiteContentV1 {
  const typeInCity = `${fb.type} en ${fb.city}`;
  const serviceList = fb.services.slice(0, 4).join(", ");
  const aboutFallback = serviceList
    ? `En ${fb.name} ofrecemos ${serviceList} en ${fb.city}. Escríbanos por WhatsApp y con gusto le atendemos.`
    : `${fb.name}: ${typeInCity}. Escríbanos por WhatsApp y con gusto le atendemos.`;

  const c = structuredClone(content);
  c.business.tagline = guard.required(c.business.tagline, typeInCity, 120);
  c.business.type = guard.required(c.business.type, clip(fb.type, 120), 120);
  c.seo.title = guard.required(c.seo.title, `${fb.name} | ${typeInCity}`, 70);
  c.seo.description = guard.required(c.seo.description, `${fb.name}: ${typeInCity}. Escríbanos por WhatsApp.`, 170);
  c.seo.keywords = c.seo.keywords.map((k) => guard.text(k)).filter((k) => k.length > 0).map((k) => clip(k, 40));

  c.hero.eyebrow = guard.required(c.hero.eyebrow, fb.city, 60);
  c.hero.headline = guard.required(c.hero.headline, clip(typeInCity, 90), 90);
  c.hero.subheadline = guard.required(c.hero.subheadline, serviceList ? `${fb.name}: ${serviceList}.` : `${fb.name}, ${typeInCity}.`, 220);
  c.hero.ctaLabel = guard.required(c.hero.ctaLabel, fb.ctaLabel, 40);

  c.about.title = guard.required(c.about.title, `Sobre ${fb.name}`, 70);
  const body = c.about.body.map((p) => guard.text(p)).filter(Boolean).map((p) => clip(p, 600));
  c.about.body = body.length ? body : [clip(aboutFallback, 600)];
  c.about.highlights = c.about.highlights.map((h) => guard.text(h)).filter(Boolean).map((h) => clip(h, 60));

  c.services.title = guard.required(c.services.title, "Nuestros servicios", 70);
  c.services.intro = guard.optional(c.services.intro, 260);
  const items = c.services.items
    .map((item) => ({
      ...item,
      name: guard.text(item.name),
      description: guard.optional(item.description, 240),
      price: guard.price(item.price),
    }))
    .filter((item) => item.name.length > 0)
    .map((item) => ({ ...item, name: clip(item.name, 80) }));
  c.services.items = items.length
    ? items
    : (fb.services.length ? fb.services : [fb.type]).slice(0, 24).map((name) => ({ name: clip(name, 80), description: null, price: null, image: null }));

  if (c.differentiators) {
    const title = guard.text(c.differentiators.title);
    const kept = c.differentiators.items
      .map((d) => ({ title: guard.text(d.title), body: guard.text(d.body) }))
      .filter((d) => d.title && d.body)
      .map((d) => ({ title: clip(d.title, 60), body: clip(d.body, 220) }));
    c.differentiators = kept.length >= 2 ? { title: clip(title || "Por qué elegirnos", 70), items: kept.slice(0, 4) } : null;
  }

  if (c.hours) {
    const lines = c.hours.lines.map((l) => guard.text(l)).filter(Boolean).map((l) => clip(l, 80));
    c.hours = lines.length ? { title: guard.required(c.hours.title, "Horario", 60), lines } : null;
  }

  if (c.location) {
    c.location.title = guard.required(c.location.title, "Dónde estamos", 60);
    c.location.areaServed = guard.optional(c.location.areaServed, 160);
    if (!c.location.address && !c.location.mapsUrl && !c.location.areaServed) c.location = null;
  }

  c.contact.title = guard.required(c.contact.title, "Escríbanos", 70);
  c.contact.body = guard.required(c.contact.body, "Escríbanos por WhatsApp y le respondemos con gusto.", 260);

  c.faq = c.faq
    .map((f) => ({ q: guard.text(f.q), a: guard.text(f.a) }))
    .filter((f) => f.q && f.a)
    .map((f) => ({ q: clip(f.q, 140), a: clip(f.a, 400) }));
  return c;
}

// ─── Contact fields (server-filled, never from the model) ───────────────────

export function whatsappMessageFor(goal: string | null): string {
  return goal === "citas" ? "Hola, vi su página web y quiero agendar una cita" : "Hola, vi su página web y quiero información";
}

const MAPS_HOST_RE = /^https?:\/\/([^/]*\.)?(google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i;

/**
 * The address block: a pasted Google Maps link becomes the map link (no street
 * text — we don't know it); a written address gets a Maps search link.
 */
export function locationFrom(address: string | null, city: string, countryName: string): { address: string | null; mapsUrl: string | null } {
  const raw = (address ?? "").trim();
  if (!raw) return { address: null, mapsUrl: null };
  const link = /^https?:\/\//i.test(raw) ? raw.split(/\s+/)[0] : null;
  if (link) return { address: null, mapsUrl: MAPS_HOST_RE.test(link) && link.length <= 600 ? link : null };
  const street = clip(raw, 200);
  const query = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  let url = query(`${street}, ${city}, ${countryName}`);
  if (url.length > 600) url = query(clip(street, 120));
  return { address: street, mapsUrl: url.length <= 600 ? url : null };
}

export function instagramUrl(raw: string | null): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  const fromUrl = /^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})/i.exec(value);
  const handle = fromUrl?.[1] ?? (/^@?([A-Za-z0-9._]{1,30})$/.exec(value)?.[1] ?? null);
  if (!handle || ["p", "reel", "explore", "stories"].includes(handle.toLowerCase())) return null;
  return `https://www.instagram.com/${handle}`;
}

export function facebookUrl(raw: string | null): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  const m = /^(?:https?:\/\/)?(?:[a-z-]+\.)?(?:facebook|fb)\.com\/(.+)$/i.exec(value);
  if (m) {
    const rest = m[1].replace(/#.*$/, "");
    const profile = /^profile\.php\?id=(\d{5,20})/.exec(rest);
    if (profile) return `https://www.facebook.com/profile.php?id=${profile[1]}`;
    const path = rest.replace(/\?.*$/, "").replace(/\/+$/, "");
    return /^[A-Za-z0-9.\-/]{2,200}$/.test(path) ? `https://www.facebook.com/${path}` : null;
  }
  const page = /^@?([A-Za-z0-9.\-]{2,80})$/.exec(value)?.[1];
  return page ? `https://www.facebook.com/${page}` : null;
}

/** Exactly the contract's rule (contact.email): a value it would reject must never reach the content. */
const contactEmail = z.email().max(200);

/**
 * The client's e-mail when SiteContentV1 accepts it, else null. Server-filled
 * fields must always validate: the model can't fix them, so an address like
 * "ana@gmail.com." would otherwise fail every generation attempt.
 */
export function emailOrNull(raw: string | null): string | null {
  const value = (raw ?? "").trim().toLowerCase();
  return value && contactEmail.safeParse(value).success ? value : null;
}
