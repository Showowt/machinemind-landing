/**
 * Subdomain (slug) allocation for client sites.
 *
 * "Cabalito sv" in San Miguel → cabalito-sv; taken → cabalito-sv-san-miguel;
 * taken → cabalito-sv-2, -3 … Never a reserved subdomain, always the DB's slug
 * rule (≤ 40 chars). The DB's UNIQUE(slug) is the real guard: callers insert
 * and move to the next candidate on a unique violation.
 */
import { RESERVED_SLUGS, slugify } from "../site-content";
import { SLUG_RE } from "./shared";

const MAX = 40;

/** `prefix` cut so `prefix + suffix` fits in 40 chars, without a dangling hyphen. */
function fit(prefix: string, suffix = ""): string {
  const room = MAX - suffix.length;
  return `${prefix.slice(0, room).replace(/-+$/g, "")}${suffix}`;
}

function usable(slug: string): boolean {
  return SLUG_RE.test(slug) && !slug.includes("--") && !RESERVED_SLUGS.has(slug);
}

/** Every slug to try, in order (deduplicated, all valid). */
export function slugCandidates(input: { businessName: string; businessType?: string | null; city?: string | null; code: string }): string[] {
  const base =
    slugify(input.businessName) ?? slugify(input.businessType ?? "") ?? `negocio-${input.code.toLowerCase()}`;
  const city = input.city ? slugify(input.city) : null;
  const out: string[] = [];
  const push = (s: string) => {
    if (usable(s) && !out.includes(s)) out.push(s);
  };
  push(fit(base));
  if (city && !base.includes(city)) push(fit(base, `-${city}`));
  for (let n = 2; n <= 60; n++) push(fit(base, `-${n}`));
  push(fit(base, `-${input.code.toLowerCase()}`));
  return out;
}

/**
 * First candidate `isTaken` says is free. Throws only when all 60+ are taken
 * (the caller alerts the team rather than guessing).
 */
export async function allocateSlug(
  input: { businessName: string; businessType?: string | null; city?: string | null; code: string },
  isTaken: (slug: string) => Promise<boolean>,
): Promise<string> {
  for (const slug of slugCandidates(input)) {
    if (!(await isTaken(slug))) return slug;
  }
  throw new Error(`[Sites:slug] no free slug for "${input.businessName}"`);
}
