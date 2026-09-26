/**
 * GET /api/web-gratis/cron — runs every minute (vercel.json).
 *
 * 1. Queues "abandoned form" alerts for drafts idle 20+ minutes.
 * 2. Health checks (stuck/failed alerts, storage) → system alerts.
 * 3. Automatic WhatsApp scheduler (confirm / ready / day 28 / day 30 / pause
 *    notice / rescue + auto-pause, and monthly renewals of PayPal / manual
 *    payers), max 25 sends, inside the send windows.
 * 4. Referral credits a failed write left behind are granted (idempotent).
 * 5. Billing: "💰 PAGO RECIBIDO" for every payment not alerted yet (board
 *    payments land in the ledger through a DB trigger), and the daily
 *    "💳 COBROS" digest at 08:00 SV (once a day: outbox key cobros:<SV date>).
 * 6. Drains the outbox until it's empty or the time budget runs out.
 * 0. First of all it kicks /api/web-gratis/sites/run (client-website
 *    generation, one site per minute) as a separate invocation, without
 *    awaiting it on this path — a 1–2 minute model call must never delay the
 *    WhatsApp scheduler or the alerts.
 * Vercel sends `Authorization: Bearer $CRON_SECRET`; without CRON_SECRET set
 * the route refuses everything (fail closed).
 */
import { timingSafeEqual } from "crypto";
import { after, NextResponse } from "next/server";
import { SITE_ORIGIN } from "@/lib/web-gratis/config";
import { sendTelegram, systemHtml, telegramChats } from "@/lib/web-gratis/notify";
import { drainOutbox, enqueueSystem, runMaintenance, type DrainReport } from "@/lib/web-gratis/outbox";
import { alertNewPayments, defaultBillingDeps, reconcileReferralCredits, runCobrosDigest, type DigestReport } from "@/lib/web-gratis/payments";
import { defaultWaDeps, runWhatsAppScheduler, type SchedulerReport } from "@/lib/web-gratis/whatsapp";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Start the site generator in its own invocation (it answers as soon as it has
 * claimed a site and generates after its response). Production calls the
 * public domain; previews call their own deployment.
 */
function kickSiteGenerator(request: Request): Promise<void> {
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  const origin = process.env.VERCEL_ENV === "production" ? SITE_ORIGIN : new URL(request.url).origin;
  return fetch(`${origin}/api/web-gratis/sites/run`, {
    headers: { authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  })
    .then(async (res) => {
      if (!res.ok) console.error("[WebGratis:cron] site generator kick", res.status, (await res.text().catch(() => "")).slice(0, 300));
    })
    .catch((error: unknown) => console.error("[WebGratis:cron] site generator kick failed", error));
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ data: null, error: "unauthorized", message: null }, { status: 401 });
  }

  // Runs concurrently with everything below; never awaited on the scheduler's path.
  const siteKick = kickSiteGenerator(request);
  after(() => siteKick);

  const started = Date.now();
  try {
    const maintenance = await runMaintenance();
    // The scheduler never throws past here: a WhatsApp problem must not stop team alerts.
    let whatsapp: SchedulerReport | { error: string };
    try {
      whatsapp = await runWhatsAppScheduler(defaultWaDeps(), { maxSends: 25, spacingMs: 300, deadline: started + 25_000 });
      if (whatsapp.errors.length) console.error("[WebGratis:cron] scheduler errors", whatsapp.errors);
    } catch (error) {
      console.error("[WebGratis:cron] scheduler", error);
      whatsapp = { error: error instanceof Error ? error.message : String(error) };
    }
    let creditsGranted = 0;
    try {
      creditsGranted = await reconcileReferralCredits((key, text) => enqueueSystem(key, text));
    } catch (error) {
      console.error("[WebGratis:cron] referral credit reconcile", error);
    }
    // Billing alerts: each step on its own, so one failing never stops the others or the drain.
    const billingDeps = defaultBillingDeps();
    let paymentsAlerted = 0;
    try {
      const paid = await alertNewPayments(billingDeps);
      paymentsAlerted = paid.alerted;
      if (paid.errors.length) console.error("[WebGratis:cron] payment alerts", paid.errors);
    } catch (error) {
      console.error("[WebGratis:cron] payment alerts", error);
    }
    let cobros: DigestReport | { error: string } | null = null;
    try {
      cobros = await runCobrosDigest(billingDeps);
    } catch (error) {
      console.error("[WebGratis:cron] cobros digest", error);
      cobros = { error: error instanceof Error ? error.message : String(error) };
    }
    const drains: DrainReport[] = [];
    // Keep draining while there's a full batch and time left (45s of the 60s budget).
    while (Date.now() - started < 40_000) {
      const report = await drainOutbox({ budgetMs: Math.max(5_000, 45_000 - (Date.now() - started)), limit: 80 });
      drains.push(report);
      if (report.claimed < 80) break;
    }
    return NextResponse.json({ data: { maintenance, whatsapp, creditsGranted, paymentsAlerted, cobros, drains, ms: Date.now() - started }, error: null, message: null });
  } catch (error) {
    console.error("[WebGratis:cron]", error);
    // The database may be the problem, so alert directly — at most every 10 minutes.
    if (new Date().getUTCMinutes() % 10 === 0) {
      const text = `El proceso cada-minuto falló: ${error instanceof Error ? error.message : String(error)}. Las alertas pueden estar detenidas; revise Supabase/Vercel.`;
      await Promise.all(telegramChats().map((chat) => sendTelegram(chat, systemHtml(text))));
    }
    return NextResponse.json({ data: null, error: "server_error", message: null }, { status: 500 });
  }
}
