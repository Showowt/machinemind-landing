/**
 * Free-website funnel — request validation (server).
 */
import { z } from "zod";
import { COUNTRY_CODES, SITE_GOALS } from "./config";

const countryCodes = COUNTRY_CODES.map((c) => c.code) as [string, ...string[]];

const trimmed = (min: number, max: number) => z.string().trim().min(min).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

export const attributionSchema = z
  .object({
    ref: z.string().trim().max(64).optional(),
    utm_source: z.string().trim().max(200).optional(),
    utm_medium: z.string().trim().max(200).optional(),
    utm_campaign: z.string().trim().max(200).optional(),
    utm_content: z.string().trim().max(200).optional(),
    utm_term: z.string().trim().max(200).optional(),
    fbclid: z.string().trim().max(500).optional(),
    landing_url: z.string().trim().max(1000).optional(),
  })
  .partial();

export const step1Schema = z.object({
  businessName: trimmed(2, 120),
  businessType: trimmed(2, 200),
  city: trimmed(2, 100),
  countryCode: z.enum(countryCodes),
  // Length/format is judged by toE164() so the API can answer "invalid_whatsapp".
  whatsappLocal: z.string().trim().min(1).max(24),
});

export const step2Schema = z.object({
  services: z.string().trim().max(1500).optional().default(""),
  differentiator: optionalText(1000),
  hours: optionalText(300),
  instagram: optionalText(200),
  facebook: optionalText(300),
  style: optionalText(500),
  siteGoal: z.enum(SITE_GOALS).optional().nullable(),
});

export const draftRequestSchema = z.object({
  draftId: z.uuid(),
  step: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  lang: z.enum(["es", "en"]).default("es"),
  website: z.string().max(200).optional(), // honeypot — humans never see it
  fields: step1Schema.and(step2Schema.partial()),
  attribution: attributionSchema.optional(),
});

export const submitRequestSchema = z.object({
  draftId: z.uuid(),
  lang: z.enum(["es", "en"]).default("es"),
  website: z.string().max(200).optional(),
  fields: step1Schema.and(step2Schema),
  acceptTerms: z.literal(true),
  acceptShare: z.literal(true),
  uploadPaths: z.array(z.string().max(300)).max(40).default([]),
  attribution: attributionSchema.optional(),
});

export const uploadUrlRequestSchema = z.object({
  draftId: z.uuid(),
  kind: z.enum(["logo", "photo"]),
  contentType: z.string().max(100),
  size: z.number().int().positive(),
});

export type DraftRequest = z.infer<typeof draftRequestSchema>;
export type SubmitRequest = z.infer<typeof submitRequestSchema>;
export type UploadUrlRequest = z.infer<typeof uploadUrlRequestSchema>;

/** Error codes the client maps to localized messages. */
export type WebGratisErrorCode =
  | "invalid"
  | "invalid_whatsapp"
  | "rate_limited"
  | "duplicate"
  | "draft_not_found"
  | "unsupported_type"
  | "too_large"
  | "too_many_files"
  | "save_failed"
  | "server_error";
