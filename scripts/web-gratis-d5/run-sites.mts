/**
 * Client websites only — the in-process site checks, without the WhatsApp
 * (inproc) and HTTP suites:
 *
 *   npx tsx scripts/web-gratis-d5/run-sites.mts
 *
 * Why a separate entry point: the production cron runs every minute against the
 * same database. Every row the site checks create is submitted / delivered in the
 * FUTURE (the pipeline runs on a fake clock) and deleted as soon as they finish,
 * so the live scheduler never sees one as due. Use this after changes under
 * src/lib/web-gratis/sites/**; the full run.mts remains the pre-go-live gate.
 * Same guarantees as run.mts: ZZ rows only, alerts captured in-process, the
 * team-alert outbox must not change, everything created is deleted.
 */
import { cleanup, db, results, RUN } from "./lib.mts";
import { runSites } from "./sites.mts";

const outboxBefore = await db.from("web_gratis_outbox").select("id", { count: "exact", head: true });
console.log(`RUN ${RUN} (sites only) — outbox rows before: ${outboxBefore.count}`);
let crashed: unknown = null;
try {
  await runSites();
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
