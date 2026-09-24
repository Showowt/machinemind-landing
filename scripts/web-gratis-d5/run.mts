/**
 * Web-gratis WhatsApp automation — D5 verification (run before go-live, and after
 * any change to the scheduler, bridge, payments or board routes).
 *
 *   npm run build && npx tsx scripts/web-gratis-d5/run.mts
 *
 * What it proves, end to end: seed a test client → confirmation (C1) → delivered
 * → "web lista" (C2) → fast-forward the clock → day-28 / day-30 / pause notice
 * (C3/C4) → auto-pause only after asking → a payment stops every reminder →
 * an opt-out stops every send; plus the Rewired bridge protocol (HMAC), Stripe
 * webhook (signature, product filter, idempotency, referral credits), abuse
 * brakes, retries/holds and the board's HTTP routes.
 *
 * Safety: never talks to Meta or the real Rewired — sends go to a local mock
 * that verifies the bridge HMAC. It uses the real site database from .env.local
 * (project elflfrdutbvkzqylaazw) with "ZZ " rows only, captures alerts
 * in-process (nothing reaches Telegram), and deletes everything it created at
 * the end; the run fails if the team-alert outbox changed. Needs .env.local with
 * NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. Exit code 0 = all passed.
 */
import { cleanup, db, results, RUN } from "./lib.mts";
import { runInProcess } from "./inproc.mts";
import { runHttp } from "./http.mts";

const outboxBefore = await db.from("web_gratis_outbox").select("id", { count: "exact", head: true });
console.log(`RUN ${RUN} — outbox rows before: ${outboxBefore.count}`);
let crashed: unknown = null;
try {
  await runInProcess();
  await runHttp();
} catch (error) {
  crashed = error;
  console.error("HARNESS CRASH", error);
} finally {
  console.log(`\n${await cleanup()}`);
  const outboxAfter = await db.from("web_gratis_outbox").select("id", { count: "exact", head: true });
  console.log(`outbox rows after: ${outboxAfter.count} (must equal before: nothing queued for Telegram)`);
  if (outboxAfter.count !== outboxBefore.count) {
    results.fail++;
    results.failures.push("outbox row count changed during the run");
  }
}
console.log(`\nRESULT: ${results.pass} passed, ${results.fail} failed${crashed ? " (harness crashed)" : ""}`);
if (results.failures.length) console.log(results.failures.map((f) => `  - ${f}`).join("\n"));
process.exit(results.fail || crashed ? 1 : 0);
