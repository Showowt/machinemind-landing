/** Authenticated read-only evidence. This observes state; it never authorizes a write. */
import { z } from "zod";
import { getDb, SIGNUPS_TABLE, type WebGratisSignup } from "../server";
import type { SiteRow } from "./db";

export const READBACK_SITE_FIELDS = [
  "id", "signup_id", "slug", "status", "version", "content", "sources", "instructions",
  "generation_lease_until", "generation_attempts", "generation_error", "generated_at",
  "published_at", "paused_at", "custom_domain", "domain_status", "created_at", "updated_at",
] as const satisfies readonly (keyof SiteRow)[];

/** No notes, private attribution, signed links, messages or unrelated signup rows. */
export const READBACK_SIGNUP_FIELDS = [
  "id", "referral_code", "business_name", "business_type", "city", "country", "whatsapp", "services",
  "status", "step", "lang", "logo_paths", "photo_paths", "document_paths",
  "hours", "address", "contact_email", "instagram", "facebook", "existing_website",
  "terms_accepted_at", "share_commitment_at", "whatsapp_consent_at", "whatsapp_consent_version",
  "submitted_at", "delivered_at", "site_url", "shared_at", "free_until", "activated_at",
  "confirmed_at", "last_touch_at", "last_touch_kind", "last_inbound_at", "opted_out_at",
  "no_whatsapp_at", "paused_at", "recontact_after", "paid_via", "last_payment_at",
  "stripe_customer_id", "stripe_subscription_id", "paid_through", "billing_issue", "billing_issue_at",
  "rung2_interest_at", "share_confirmed_at", "handoff_at", "handoff_kind", "wants_changes_at",
  "declined_at", "quick_capture_at", "next_follow_up_at", "call_attempts", "last_call_outcome",
  "created_at", "updated_at",
] as const;

type ReadbackSignupRow = WebGratisSignup & {
  billing_issue: "payment_failed" | "subscription_canceled" | null;
  billing_issue_at: string | null;
};

export interface SiteReadback {
  kind: "web-gratis-admin-readback";
  schemaVersion: 1;
  startedAt: string;
  capturedAt: string;
  /** Separate reads are not a transaction or a lock on either record. */
  consistency: "sequential_reads_no_lock";
  site: Pick<SiteRow, typeof READBACK_SITE_FIELDS[number]>;
  signup: Required<Pick<ReadbackSignupRow, typeof READBACK_SIGNUP_FIELDS[number]>>;
}

/** Preserve explicit nulls and fail on omitted columns instead of inventing defaults. */
function selectPresent<T extends object, K extends keyof T>(row: T, keys: readonly K[]): Required<Pick<T, K>> {
  if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("Readback row unavailable.");
  const selected = {} as Required<Pick<T, K>>;
  for (const key of keys) {
    if (!Object.hasOwn(row, key) || row[key] === undefined) throw new Error(`Readback field unavailable: ${String(key)}.`);
    selected[key] = row[key] as Required<Pick<T, K>>[K];
  }
  return selected;
}

export async function readSiteReadback(site: SiteRow, startedAt: Date): Promise<SiteReadback> {
  if (!Number.isFinite(startedAt.getTime())) throw new Error("Readback observation time unavailable.");
  const selectedSite = selectPresent(site, READBACK_SITE_FIELDS);
  if (!z.uuid().safeParse(selectedSite.id).success || !z.uuid().safeParse(selectedSite.signup_id).success) {
    throw new Error("Readback site identity unavailable.");
  }
  const { data, error } = await getDb().from(SIGNUPS_TABLE)
    .select(READBACK_SIGNUP_FIELDS.join(","))
    .eq("id", selectedSite.signup_id)
    .maybeSingle();
  if (error) throw new Error("Readback signup query failed.");
  const raw: unknown = data;
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || !("id" in raw) || raw.id !== selectedSite.signup_id) {
    throw new Error("Readback linked signup unavailable.");
  }
  const signup = selectPresent(raw as ReadbackSignupRow, READBACK_SIGNUP_FIELDS);
  if (typeof signup.referral_code !== "string" || !signup.referral_code.trim()) {
    throw new Error("Readback signup referral unavailable.");
  }
  const capturedAt = new Date();
  if (capturedAt.getTime() < startedAt.getTime()) throw new Error("Readback observation clock changed.");
  return {
    kind: "web-gratis-admin-readback", schemaVersion: 1,
    startedAt: startedAt.toISOString(), capturedAt: capturedAt.toISOString(),
    consistency: "sequential_reads_no_lock", site: selectedSite, signup,
  };
}
