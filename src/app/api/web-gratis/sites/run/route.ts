/**
 * GET /api/web-gratis/sites/run[?site=<id>] — generate ONE client website.
 *
 * Kicked every minute by /api/web-gratis/cron (Bearer CRON_SECRET), so the
 * WhatsApp scheduler never waits on a model call. It claims the next site
 * (lease on web_gratis_sites, so overlapping runs never take the same one),
 * answers immediately, and generates after the response (up to 300 s). After
 * that it purges the renderer's cache for live sites whose signup just changed
 * (paused by the scheduler, cancelled, reopened). Fails closed without CRON_SECRET.
 */
import { timingSafeEqual } from "crypto";
import { after } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/web-gratis/http";
import {
  alertIfUnconfigured,
  claimNextJob,
  defaultSitesDeps,
  runJob,
  sweepRevalidations,
  waitingCount,
} from "@/lib/web-gratis/sites/pipeline";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) return fail(401, "unauthorized");
  const deps = defaultSitesDeps();
  const siteParam = new URL(request.url).searchParams.get("site");
  const siteId = siteParam && z.uuid().safeParse(siteParam).success ? siteParam : undefined;

  after(async () => {
    try {
      await sweepRevalidations(deps);
    } catch (error) {
      console.error("[Sites:run] revalidation sweep", error);
    }
  });

  try {
    if (!deps.generator()) {
      const waiting = await waitingCount(deps);
      await alertIfUnconfigured(deps, waiting);
      return ok({ claimed: null, reason: "ANTHROPIC_API_KEY missing", waiting });
    }
    const job = await claimNextJob(deps, { siteId });
    if (!job) return ok({ claimed: null });
    after(async () => {
      const outcome = await runJob(job, deps);
      if (!outcome.ok) console.error("[Sites:run] generation did not finish", job.id, job.slug, outcome.reason);
    });
    return ok({ claimed: job.id, slug: job.slug, attempt: job.generation_attempts });
  } catch (error) {
    console.error("[Sites:run]", error);
    return fail(500, "server_error");
  }
}
