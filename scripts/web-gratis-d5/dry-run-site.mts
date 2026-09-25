/**
 * Real generation for one signup WITHOUT writing anything: no site row, no
 * public-bucket copies (images are 7-day signed links of the private files).
 * Calls the real Anthropic API (needs ANTHROPIC_API_KEY; SITES_MODEL optional).
 *
 *   npx tsx scripts/web-gratis-d5/dry-run-site.mts <signup-id> <content-out.json> [sources-out.json]
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../../", import.meta.url)).replace(/\/$/, "");
const require = createRequire(`${REPO}/package.json`);
require("@next/env").loadEnvConfig(REPO, false);

const [signupId, contentOut, sourcesOut] = process.argv.slice(2);
if (!signupId || !contentOut) {
  console.error("usage: dry-run-site.mts <signup-id> <content-out.json> [sources-out.json]");
  process.exit(2);
}

const { generateSite } = await import(`${REPO}/src/lib/web-gratis/sites/generate.ts`);
const { generatorEnv } = await import(`${REPO}/src/lib/web-gratis/sites/db.ts`);
const { getSignup, siteForSignup, slugTaken } = await import(`${REPO}/src/lib/web-gratis/sites/pipeline.ts`);
const { allocateSlug } = await import(`${REPO}/src/lib/web-gratis/sites/slug.ts`);
const { siteContentSchema } = await import(`${REPO}/src/lib/web-gratis/site-content.ts`);

const gen = generatorEnv();
if (!gen) {
  console.error("ANTHROPIC_API_KEY missing");
  process.exit(2);
}
const signup = await getSignup(signupId);
if (!signup) {
  console.error("signup not found");
  process.exit(2);
}
const existing = await siteForSignup(signupId);
const slug =
  existing?.slug ??
  (await allocateSlug(
    { businessName: signup.business_name, businessType: signup.business_type, city: signup.city, code: signup.referral_code },
    (s: string) => slugTaken(s),
  ));

const started = Date.now();
const result = await generateSite(
  { signup, slug, instructions: null, dryRun: true },
  { fetch, apiKey: gen.apiKey, model: gen.model, now: () => new Date(), deadline: Date.now() + 280_000 },
);
const valid = siteContentSchema.safeParse(result.content).success;
mkdirSync(dirname(contentOut), { recursive: true });
writeFileSync(contentOut, `${JSON.stringify(result.content, null, 2)}\n`);
if (sourcesOut) writeFileSync(sourcesOut, `${JSON.stringify(result.sources, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      slug,
      model: gen.model,
      seconds: Math.round((Date.now() - started) / 1000),
      valid,
      calls: result.sources.calls,
      retryFeedback: result.sources.retryFeedback ?? null,
      usage: result.sources.usage,
      guards: result.sources.guards,
      notes: result.sources.notes,
      palette: result.content.theme.palette,
      mode: result.content.theme.mode,
      font: result.content.theme.font,
    },
    null,
    2,
  ),
);
