/**
 * POST /api/web-gratis/admin/sites — board actions on a signup's website.
 *
 *   { signupId, action: "generate", instructions? }
 *     "Generar ahora" / "Regenerar": creates the site row (free slug) if needed,
 *     saves Phil's instructions, and starts the generation right after the
 *     response (1–2 min; the board refreshes). A published site must be paused
 *     first. The per-minute runner picks it up too if this invocation dies.
 *
 *   { signupId, action: "dry_run", instructions? }
 *     Generates and returns the content JSON without writing anything (no site
 *     row change, no public-bucket copies; images are 7-day signed links).
 *
 * Bearer WEB_GRATIS_ADMIN_TOKEN.
 */
import { after } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/web-gratis/admin";
import { fail, ok } from "@/lib/web-gratis/http";
import { SITES_ROOT_DOMAIN } from "@/lib/web-gratis/site-content";
import { GenerationError, generateSite } from "@/lib/web-gratis/sites/generate";
import { claimSite, defaultSitesDeps, getSignup, requestGeneration, runJob, siteForSignup, slugTaken } from "@/lib/web-gratis/sites/pipeline";
import { allocateSlug } from "@/lib/web-gratis/sites/slug";
import { toSummary } from "@/lib/web-gratis/sites/summary";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const bodySchema = z.object({
  signupId: z.uuid(),
  action: z.enum(["generate", "dry_run"]),
  instructions: z
    .union([z.string().trim().max(2000), z.null()])
    .optional()
    .transform((v) => (v ? v : null)),
});

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid");
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return fail(400, "invalid", parsed.error.issues[0]?.message);
  const { signupId, action, instructions } = parsed.data;
  const deps = defaultSitesDeps();

  try {
    if (action === "dry_run") {
      const gen = deps.generator();
      if (!gen) return fail(503, "not_configured", "Falta ANTHROPIC_API_KEY en el servidor.");
      const signup = await getSignup(signupId);
      if (!signup) return fail(404, "not_found", "No existe esa solicitud.");
      const existing = await siteForSignup(signupId);
      const slug =
        existing?.slug ??
        (await allocateSlug(
          { businessName: signup.business_name, businessType: signup.business_type, city: signup.city, code: signup.referral_code },
          (s) => slugTaken(s),
        ));
      const result = await generateSite(
        { signup, slug, instructions: instructions ?? existing?.instructions ?? null, dryRun: true },
        { fetch: deps.fetch, apiKey: gen.apiKey, model: gen.model, now: deps.now, deadline: Date.now() + 280_000 },
      );
      return ok({ slug, url: `https://${slug}.${SITES_ROOT_DOMAIN}`, content: result.content, sources: result.sources });
    }

    if (!deps.generator()) return fail(503, "not_configured", "Falta ANTHROPIC_API_KEY en el servidor: no se puede generar.");
    const res = await requestGeneration(signupId, instructions, deps);
    if (!res.ok) return fail(res.code === "not_found" ? 404 : 409, res.code, res.message);
    const siteId = res.site.id;
    after(async () => {
      try {
        const claimed = await claimSite(siteId, deps);
        if (!claimed) return; // the per-minute runner got it first
        const outcome = await runJob(claimed, deps);
        if (!outcome.ok) console.error("[Sites:admin:generate] did not finish", siteId, outcome.reason);
      } catch (error) {
        console.error("[Sites:admin:generate]", siteId, error);
      }
    });
    return ok({ site: toSummary(res.site, null), message: res.message });
  } catch (error) {
    if (error instanceof GenerationError) return fail(502, "send_failed", error.message);
    console.error("[Sites:admin:sites]", action, signupId, error);
    return fail(500, "server_error", "No se pudo completar. Intente de nuevo.");
  }
}
