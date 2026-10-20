import type { SiteSummary } from "@/lib/web-gratis/sites/shared";
import type { SiteReadback } from "@/lib/web-gratis/sites/readback";
import { getExpiryHold, getExpiryHoldState } from "@/lib/web-gratis/expiry-holds";

export interface ReviewedReadback { json: string; version: number; updatedAt: string }
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

/** Display only the explicit readback projection, never the bearer links in the surrounding response. */
export function reviewedReadback(data: unknown, expected: Pick<SiteSummary, "id" | "signupId">): ReviewedReadback | null {
  if (!object(data) || !Object.hasOwn(data, "content") || !object(data.site) || !object(data.readback)) return null;
  const readback = data.readback;
  if (readback.kind !== "web-gratis-admin-readback" || readback.schemaVersion !== 1 ||
      readback.consistency !== "sequential_reads_no_lock" || !object(readback.site) || !object(readback.signup)) return null;
  const site = readback.site;
  if (site.id !== expected.id || site.signup_id !== expected.signupId || readback.signup.id !== expected.signupId ||
      data.site.id !== expected.id || data.site.signupId !== expected.signupId ||
      !Number.isSafeInteger(site.version) || Number(site.version) < 0 || site.version !== data.site.version ||
      typeof site.updated_at !== "string" || site.updated_at !== data.site.updatedAt ||
      !Object.hasOwn(site, "content") || JSON.stringify(site.content) !== JSON.stringify(data.content)) return null;
  if (typeof readback.startedAt !== "string" || typeof readback.capturedAt !== "string" ||
      !Number.isFinite(Date.parse(readback.startedAt)) || !Number.isFinite(Date.parse(readback.capturedAt)) ||
      Date.parse(readback.startedAt) > Date.parse(readback.capturedAt)) return null;
  // Do not export an unrecognized response shape or accidentally include top-level capabilities.
  const hasPolicy = Object.hasOwn(readback, "operationalPolicy");
  const keys = Object.keys(readback).sort().join(",");
  const expectedKeys = hasPolicy
    ? "capturedAt,consistency,kind,operationalPolicy,schemaVersion,signup,site,startedAt"
    : "capturedAt,consistency,kind,schemaVersion,signup,site,startedAt";
  if (keys !== expectedKeys ||
      "preview_token" in site || "previewUrl" in site || "exportUrl" in site) return null;
  if (hasPolicy) {
    // The optional runtime policy is separate from persisted evidence. Accept only
    // the reviewed policy for this exact tenant, at the server's capture instant.
    const policy = readback.operationalPolicy;
    const hold = getExpiryHold(expected.signupId);
    if (!object(policy) || !hold || hold.siteId !== expected.id ||
        hold.referralCode !== readback.signup.referral_code || policy.observedAt !== readback.capturedAt) return null;
    const expectedPolicy = { ...getExpiryHoldState(expected.signupId, new Date(readback.capturedAt)), observedAt: readback.capturedAt };
    // Current policy fields are all scalar. Exact keys/values reject capabilities,
    // malformed evidence, and policy from another source revision without coercion.
    const expectedEntries = Object.entries(expectedPolicy);
    if (Object.keys(policy).length !== expectedEntries.length ||
        !expectedEntries.every(([key, value]) => Object.hasOwn(policy, key) && policy[key] === value)) return null;
  }
  return { json: JSON.stringify(readback as unknown as SiteReadback, null, 2), version: site.version as number, updatedAt: site.updated_at };
}
