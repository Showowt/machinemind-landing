/**
 * Free-website funnel — request validation (server).
 */
import { z } from "zod";
import { COUNTRY_CODES, EMAIL_RE, SITE_GOALS, UPLOAD_KINDS } from "./config";

const countryCodes = COUNTRY_CODES.map((c) => c.code) as [string, ...string[]];

const trimmed = (min: number, max: number) => z.string().trim().min(min).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

/** Optional email: blank → null, otherwise it must look like an address. */
const optionalEmail = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((v) => (v && v.length > 0 ? v.toLowerCase() : null))
  .refine((v) => v === null || EMAIL_RE.test(v), { message: "email" });

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
  /** Market the person picked on /web. The stored column is derived from the number. */
  country: z.enum(["SV", "CO", "OTHER"]).optional(),
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
  /** "¿Quién le recomendó?" — free text, for referrals that didn't come through a ?ref= link. */
  referredBy: optionalText(120),
  /** "¿Ya tiene página web?" — we update it for free or build a new one. */
  existingWebsite: optionalText(300),
  /** Street address or a Google Maps link. */
  address: optionalText(300),
  contactEmail: optionalEmail,
  /** "¿Algo más que debamos saber?" */
  extraNotes: optionalText(1500),
});

/** Client retry counter (0-based); the server alerts the team only on the final try. */
const attemptSchema = z.number().int().min(0).max(10).optional();

export const draftRequestSchema = z.object({
  draftId: z.uuid(),
  attempt: attemptSchema,
  step: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  lang: z.enum(["es", "en"]).default("es"),
  website: z.string().max(200).optional(), // honeypot — humans never see it
  fields: step1Schema.and(step2Schema.partial()),
  attribution: attributionSchema.optional(),
});

export const submitRequestSchema = z.object({
  draftId: z.uuid(),
  attempt: attemptSchema,
  lang: z.enum(["es", "en"]).default("es"),
  website: z.string().max(200).optional(),
  fields: step1Schema.and(step2Schema),
  acceptTerms: z.literal(true),
  acceptShare: z.literal(true),
  uploadPaths: z.array(z.string().max(300)).max(60).default([]),
  attribution: attributionSchema.optional(),
});

export const uploadUrlRequestSchema = z.object({
  draftId: z.uuid(),
  kind: z.enum(UPLOAD_KINDS),
  contentType: z.string().max(200),
  size: z.number().int().positive(),
});

export type DraftRequest = z.infer<typeof draftRequestSchema>;
export type SubmitRequest = z.infer<typeof submitRequestSchema>;
export type UploadUrlRequest = z.infer<typeof uploadUrlRequestSchema>;

/** Error codes the client maps to localized messages. */
export type WebGratisErrorCode =
  | "invalid"
  | "invalid_whatsapp"
  | "invalid_email"
  | "rate_limited"
  | "duplicate"
  | "draft_not_found"
  | "unsupported_type"
  | "too_large"
  | "too_many_files"
  | "save_failed"
  | "server_error";

/** A failed draft/submit parse → the most helpful code for the person filling the form. */
export function validationErrorCode(error: z.ZodError): WebGratisErrorCode {
  return error.issues.some((issue) => issue.path.includes("contactEmail")) ? "invalid_email" : "invalid";
}

/** Error codes only server-to-server callers see (bridge, webhooks, admin). */
export type ServerErrorCode =
  | "unauthorized"
  | "not_configured"
  | "unknown_client"
  | "not_found"
  | "already_sent"
  | "window_closed"
  | "not_eligible"
  | "send_failed"
  | "needs_confirm";
