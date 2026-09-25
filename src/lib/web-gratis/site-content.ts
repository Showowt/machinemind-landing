/**
 * SiteContentV1 — the ONE contract between the website generator (this repo, writes
 * web_gratis_sites.content) and the renderer (the multi-tenant `mm-sites` app, which keeps a
 * byte-identical copy of this file at src/lib/site-content.ts). Change both together.
 *
 * Rules the generator must keep (the schema enforces the shape; the prompt enforces the rest):
 * - Spanish, usted register, the business's own voice; never invent facts: no prices, awards,
 *   years in business, addresses, phone numbers, reviews or testimonials the client didn't give.
 * - Prices only when the client wrote them (form text or their uploaded menu/price list).
 * - Images are only the client's own uploads (published to the public bucket) or Unsplash photos
 *   with credit; `null` when there is nothing fitting — the renderer has designed fallbacks.
 * - Colors come from the client's logo / stated style / vertical — NOT MachineMind black + gold.
 * Client-safe: no secrets.
 */
import { z } from "zod";

export const SITE_VERTICALS = [
  "food", "beauty", "retail", "tours", "health", "services", "auto", "education", "events", "other",
] as const;
export type SiteVertical = (typeof SITE_VERTICALS)[number];

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const text = (max: number) => z.string().trim().min(1).max(max);
const optText = (max: number) => z.string().trim().max(max).nullable();

export const siteImageSchema = z.object({
  /** Absolute https URL (public bucket or images.unsplash.com). */
  src: z.url().max(1000),
  alt: text(160),
  width: z.number().int().positive().max(8000).nullable(),
  height: z.number().int().positive().max(8000).nullable(),
  /** Required for Unsplash photos (photographer + profile link); null for the client's own. */
  credit: z.object({ name: text(80), url: z.url().max(500) }).nullable(),
});
export type SiteImage = z.infer<typeof siteImageSchema>;

export const sitePaletteSchema = z.object({
  bg: hex, // page background (light OR dark — per business, not always dark)
  surface: hex, // cards / alternating sections
  text: hex, // main text on bg (must reach WCAG AA 4.5:1 on bg)
  muted: hex, // secondary text on bg (≥ 3:1 on bg)
  primary: hex, // brand color (buttons, accents)
  primaryText: hex, // text on primary (≥ 4.5:1 on primary)
  accent: hex, // secondary highlight
});
export type SitePalette = z.infer<typeof sitePaletteSchema>;

export const siteContentSchema = z.object({
  version: z.literal(1),
  lang: z.literal("es"),
  business: z.object({
    name: text(80),
    tagline: text(120),
    type: text(120),
    city: text(80),
    country: z.enum(["SV", "CO", "OTHER"]),
  }),
  seo: z.object({
    title: text(70),
    description: text(170),
    keywords: z.array(text(40)).max(12),
  }),
  hero: z.object({
    eyebrow: text(60),
    headline: text(90),
    subheadline: text(220),
    ctaLabel: text(40),
    image: siteImageSchema.nullable(),
  }),
  about: z.object({
    title: text(70),
    body: z.array(text(600)).min(1).max(3),
    highlights: z.array(text(60)).max(4),
  }),
  services: z.object({
    title: text(70),
    intro: optText(260),
    items: z
      .array(
        z.object({
          name: text(80),
          description: optText(240),
          /** Exactly as the client wrote it ("$12", "desde $25") — null when they gave none. */
          price: optText(40),
          image: siteImageSchema.nullable(),
        }),
      )
      .min(1)
      .max(24),
  }),
  gallery: z.array(siteImageSchema).max(12),
  differentiators: z
    .object({
      title: text(70),
      items: z.array(z.object({ title: text(60), body: text(220) })).min(2).max(4),
    })
    .nullable(),
  hours: z.object({ title: text(60), lines: z.array(text(80)).min(1).max(8) }).nullable(),
  location: z
    .object({
      title: text(60),
      address: optText(200),
      /** Google Maps link given by the client, or a search URL built from their address. */
      mapsUrl: z.url().max(600).nullable(),
      areaServed: optText(160),
    })
    .nullable(),
  contact: z.object({
    title: text(70),
    body: text(260),
    /** Digits only, with country code (e.g. "50378570611"). */
    whatsapp: z.string().regex(/^\d{8,15}$/),
    whatsappMessage: text(200),
    email: z.email().max(200).nullable(),
    instagram: z.url().max(300).nullable(),
    facebook: z.url().max(300).nullable(),
    website: z.url().max(300).nullable(),
  }),
  faq: z.array(z.object({ q: text(140), a: text(400) })).max(6),
  theme: z.object({
    palette: sitePaletteSchema,
    mode: z.enum(["light", "dark"]),
    font: z.enum(["serif", "sans", "rounded", "condensed"]),
    vertical: z.enum(SITE_VERTICALS),
    /** One short phrase the renderer can use for motion/texture choices ("cálido y artesanal"). */
    mood: text(60),
    logo: siteImageSchema.nullable(),
  }),
  footer: z.object({
    /** "Hecho por MachineMind · ¿Quiere su web gratis?" */
    credit: text(120),
    /** https://machinemindconsulting.com/web?ref=<CODE> */
    referralUrl: z.url().max(300),
  }),
});
export type SiteContentV1 = z.infer<typeof siteContentSchema>;

/** Subdomains that can never be a client slug. */
export const RESERVED_SLUGS = new Set([
  "www", "api", "app", "admin", "mail", "email", "smtp", "ftp", "web", "webs", "sites", "site", "blog",
  "shop", "store", "tienda", "pagar", "pay", "status", "help", "ayuda", "soporte", "support", "docs",
  "dev", "staging", "preview", "test", "demo", "demos", "cdn", "static", "assets", "img", "images",
  "machinemind", "verificar", "viceroy", "voxlink", "espanol", "citas", "s", "q", "activate", "projects",
]);

/** "Cabalito sv" → "cabalito-sv". Returns null if nothing usable is left. */
export function slugify(raw: string): string | null {
  const s = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return s.length >= 2 ? s : null;
}

/** The client site's public origin on MachineMind's domain. */
export const SITES_ROOT_DOMAIN = "machinemindconsulting.com";
export function siteOrigin(slug: string): string {
  return `https://${slug}.${SITES_ROOT_DOMAIN}`;
}
