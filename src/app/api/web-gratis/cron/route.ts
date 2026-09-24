/**
 * GET /api/web-gratis/cron — runs every minute (vercel.json).
 *
 * 1. Queues "abandoned form" alerts for drafts idle 20+ minutes.
 * 2. Health checks (stuck/failed alerts, storage) → system alerts.
 * 3. Drains the outbox until it's empty or the time budget runs out.
 * Vercel sends `Authorization: Bearer $CRON_SECRET`; without CRON_SECRET set
 * the route refuses everything (fail closed).
 */
import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { sendTelegram, systemHtml, telegramChats } from "@/lib/web-gratis/notify";
import { drainOutbox, runMaintenance, type DrainReport } from "@/lib/web-gratis/outbox";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ data: null, error: "unauthorized", message: null }, { status: 401 });
  }

  const started = Date.now();
  try {
    const maintenance = await runMaintenance();
    const drains: DrainReport[] = [];
    // Keep draining while there's a full batch and time left (45s of the 60s budget).
    while (Date.now() - started < 40_000) {
      const report = await drainOutbox({ budgetMs: Math.max(5_000, 45_000 - (Date.now() - started)), limit: 80 });
      drains.push(report);
      if (report.claimed < 80) break;
    }
    return NextResponse.json({ data: { maintenance, drains, ms: Date.now() - started }, error: null, message: null });
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
