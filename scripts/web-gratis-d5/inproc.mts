/**
 * In-process tests: scheduler (fake clock + mock Rewired), bridge handlers,
 * Stripe signature + event handling. Real DB, ZZ rows only, scoped runs,
 * alerts captured (never written to the real outbox).
 */
import net from "node:net";
import {
  BRIDGE_SECRET,
  RUN,
  STRIPE_SECRET,
  check,
  db,
  errReply,
  fakePhone,
  messagesOf,
  okReply,
  section,
  seed,
  signup,
  site,
  startMockRewired,
  templateRow,
  type MockRewired,
} from "./lib.mts";

type Settings = Awaited<ReturnType<typeof site.server.loadSettings>>;
type WaDeps = Parameters<typeof site.wa.runWhatsAppScheduler>[0];

const alerts: { key: string; text: string }[] = [];
let clock = new Date();
const now = () => new Date(clock.getTime());
const H = 3_600_000;
const D = 24 * H;

/** A Date for YYYY-MM-DD hh:mm in El Salvador (UTC-6). */
function sv(date: string, hh: number, mm = 0): Date {
  return new Date(Date.parse(`${date}T00:00:00Z`) + (hh + 6) * H + mm * 60_000);
}
const FRI = "2026-09-25";
const SAT = "2026-09-26";
const SUN = "2026-09-27";
const MON = "2026-09-28";
const TUE = "2026-09-29";
const plus = (date: string, days: number) => site.wa.svDateOf(date, days);
const iso = (d: Date) => d.toISOString();

let settings: Settings = {
  delivery_days: 5,
  high_demand: false,
  pay_link: "https://buy.stripe.com/test_zz",
  demo_link: null,
  paypal_link: "https://paypal.me/MachineMind/20USD",
};

function waDeps(mock: MockRewired): WaDeps {
  return {
    now,
    send: (req) => site.rewired.sendViaRewired(req, { baseUrl: mock.url, secret: BRIDGE_SECRET, timeoutMs: 4000 }),
    alert: async (key, text) => {
      alerts.push({ key, text });
      return true;
    },
    sleep: async () => undefined,
    settings: async () => settings,
  };
}

const alertsSince = (n: number) => alerts.slice(n);

export async function runInProcess(): Promise<void> {
  const mock = await startMockRewired(BRIDGE_SECRET);
  const deps = waDeps(mock);
  const run = (ids: string[], opts: Record<string, unknown> = {}) =>
    site.wa.runWhatsAppScheduler(deps, { onlySignupIds: ids, spacingMs: 0, maxSends: 25, deadline: Date.now() + 60_000, ...opts });
  const callsFor = (phone: string) => mock.calls.filter((c) => c.to === phone);

  try {
    // ────────────────────────────────────────────────────────────────────
    section("Rewired client: HMAC signing, response parsing");
    {
      const bad = await site.rewired.sendViaRewired(
        { to: "+50370000000", mode: "freeform", text: "x", idempotencyKey: "zz-k" },
        { baseUrl: mock.url, secret: "wrong-secret-wrong-secret-123456" },
      );
      check("wrong secret → mock rejects signature → unauthorized (definitive, transient)", !bad.ok && bad.code === "unauthorized" && bad.definitive && bad.transient, bad);
      check("mock counted the rejected signature and recorded no call", mock.rejectedSignatures === 1 && mock.calls.length === 0);
      const unconfigured = await site.rewired.sendViaRewired({ to: "+50370000000", mode: "freeform", text: "x", idempotencyKey: "k" }, { baseUrl: null, secret: BRIDGE_SECRET });
      check("no REWIRED_BASE_URL → not_configured (hold), no network call", !unconfigured.ok && unconfigured.code === "not_configured" && unconfigured.transient);
      mock.plan = () => errReply("meta_error", true, 200, { metaCode: 131049 });
      const meta = await site.rewired.sendViaRewired({ to: "+50370000000", mode: "freeform", text: "x", idempotencyKey: "k2" }, { baseUrl: mock.url, secret: BRIDGE_SECRET });
      check("metaCode wins over generic code", !meta.ok && meta.code === "131049" && meta.transient && meta.definitive, meta);
      mock.plan = () => ({ status: 502, json: {} });
      const gateway = await site.rewired.sendViaRewired({ to: "+50370000000", mode: "freeform", text: "x", idempotencyKey: "k3" }, { baseUrl: mock.url, secret: BRIDGE_SECRET });
      check("5xx without result → unknown outcome (not definitive)", !gateway.ok && !gateway.definitive && gateway.transient, gateway);
      mock.plan = () => errReply("131026", false);
      const perm = await site.rewired.sendViaRewired({ to: "+50370000000", mode: "freeform", text: "x", idempotencyKey: "k4" }, { baseUrl: mock.url, secret: BRIDGE_SECRET });
      check("131026 → permanent", !perm.ok && perm.code === "131026" && !perm.transient, perm);
      mock.plan = () => ({ status: 504, json: { data: null, error: "send_unknown", message: "Meta POST timed out" } });
      const unknown = await site.rewired.sendViaRewired({ to: "+50370000000", mode: "freeform", text: "x", idempotencyKey: "k5" }, { baseUrl: mock.url, secret: BRIDGE_SECRET });
      check("504 send_unknown → unknown outcome (not definitive)", !unknown.ok && unknown.code === "send_unknown" && !unknown.definitive, unknown);
      mock.plan = () => ({ status: 404, json: {} });
      const notFound = await site.rewired.sendViaRewired({ to: "+50370000000", mode: "freeform", text: "x", idempotencyKey: "k6" }, { baseUrl: mock.url, secret: BRIDGE_SECRET });
      check("4xx without result → definitely not sent", !notFound.ok && notFound.code === "http_404" && notFound.definitive, notFound);
      const closedPort = await new Promise<number>((resolve) => {
        const probe = net.createServer();
        probe.listen(0, "127.0.0.1", () => {
          const port = (probe.address() as net.AddressInfo).port;
          probe.close(() => resolve(port));
        });
      });
      const refused = await site.rewired.sendViaRewired({ to: "+50370000000", mode: "freeform", text: "x", idempotencyKey: "k7" }, { baseUrl: `http://127.0.0.1:${closedPort}`, secret: BRIDGE_SECRET, timeoutMs: 3000 });
      check("connection refused → never reached Rewired → definitive 'not sent'", !refused.ok && refused.code === "network" && refused.definitive && refused.transient, refused);
      mock.plan = okReply;
      mock.calls.length = 0;
    }

    // ────────────────────────────────────────────────────────────────────
    section("T1 confirmation: window, send, idempotency");
    {
      const a = await seed("T1 A", { status: "nuevo", submitted_at: iso(sv(MON, 5)) });
      clock = sv(MON, 6, 30); // before 07:00
      let r = await run([a.id]);
      check("06:30 SV → deferred, no call", callsFor(a.whatsapp).length === 0 && r.deferred === 1, r);
      check("no ledger row created outside the window", (await messagesOf(a.id)).length === 0);
      clock = sv(MON, 10);
      r = await run([a.id]);
      const c = callsFor(a.whatsapp);
      check("10:00 SV → exactly one Rewired call", c.length === 1, c.length);
      check("template cqv_web_confirm with [business_name], no button", c[0]?.template?.name === "cqv_web_confirm" && c[0]?.template?.bodyParams?.[0] === a.business_name && !c[0]?.template?.buttonParam, c[0]);
      check("mode template, E.164 to, stable idempotency key", c[0]?.mode === "template" && c[0]?.to === a.whatsapp && /^wg-\d+-1$/.test(c[0]?.idempotencyKey ?? ""), c[0]);
      const row = await templateRow(a.id, "cqv_web_confirm");
      check("ledger row sent + wamid + attempts 1 + body preview", row?.status === "sent" && String(row?.wa_message_id).startsWith("wamid.ZZMOCK") && row?.attempts === 1 && String(row?.body).includes(a.business_name), row);
      const s = await signup(a.id);
      check("signup confirmed_at + last_touch_kind wa_confirm stamped", !!s.confirmed_at && s.last_touch_kind === "wa_confirm", s);
      check("report: sent 1", r.sent === 1, r);
      r = await run([a.id]);
      check("second run → no second send (idempotent)", callsFor(a.whatsapp).length === 1 && r.sent === 0, r);

      const b = await seed("T1 B domingo", { status: "en_construccion", submitted_at: iso(sv(SUN, 8)) });
      clock = sv(SUN, 10);
      await run([b.id]);
      check("Sunday 10:00: transactional confirm still goes out", callsFor(b.whatsapp).length === 1);
      clock = sv(MON, 21, 5);
      const b2 = await seed("T1 B2 noche", { status: "nuevo", submitted_at: iso(sv(MON, 20)) });
      await run([b2.id]);
      check("21:05 SV → confirm deferred", callsFor(b2.whatsapp).length === 0);

      clock = sv(MON, 10);
      const fresh = await seed("T1 recién enviado", { status: "nuevo", submitted_at: iso(new Date(clock.getTime() - 5 * 60_000)) });
      await run([fresh.id]);
      check("submitted 5 min ago → not yet (15-min delay so their own chat comes first)", callsFor(fresh.whatsapp).length === 0 && !(await templateRow(fresh.id, "cqv_web_confirm")));
      clock = sv(MON, 10, 11);
      await run([fresh.id]);
      check("16 min after submitting → confirmation sent", callsFor(fresh.whatsapp).length === 1);

      clock = sv(MON, 10);
      const lure = await seed("Cuenta BAC bloqueada llame 7777-7777 bit.ly/x", { status: "nuevo", submitted_at: iso(sv(MON, 8)) });
      await run([lure.id]);
      const param = callsFor(lure.whatsapp)[0]?.template?.bodyParams?.[0] ?? "";
      check("form text in the template is defanged (no phone, no link, ≤ 30 chars)", param.length > 0 && param.length <= 30 && !/7777/.test(param) && !/bit\.ly/i.test(param), param);
    }

    // ────────────────────────────────────────────────────────────────────
    section("T1 abuse brakes: one per phone per 7 days, 3 per network per hour");
    {
      clock = sv(MON, 10);
      const shared = fakePhone();
      const g1 = await seed("T1 mismo número uno", { status: "nuevo", submitted_at: iso(sv(MON, 8)), whatsapp: shared });
      const g2 = await seed("T1 mismo número dos", { status: "nuevo", submitted_at: iso(sv(MON, 8, 5)), whatsapp: shared });
      let n0 = alerts.length;
      await run([g1.id, g2.id]);
      const held = await templateRow(g2.id, "cqv_web_confirm");
      check("same phone on two requests → ONE automatic confirmation", callsFor(shared).length === 1, callsFor(shared).length);
      check("the second is held ('skipped' + reason) with an hourly alert", held?.status === "skipped" && String(held?.last_error).includes("7 días") && alertsSince(n0).some((a) => a.key.startsWith("t1-held:")), { held, a: alertsSince(n0) });

      const ip = `zz${RUN.toLowerCase()}net`.padEnd(32, "0");
      const net = await Promise.all([1, 2, 3, 4].map((i) => seed(`T1 misma red ${i}`, { status: "nuevo", submitted_at: iso(sv(MON, 8, 10 + i)), ip_hash: ip })));
      n0 = alerts.length;
      await run(net.map((x) => x.id));
      const sentNet = net.filter((x) => callsFor(x.whatsapp).length === 1).length;
      const heldNet = (await Promise.all(net.map((x) => templateRow(x.id, "cqv_web_confirm")))).filter((r) => r?.status === "skipped");
      check("4 requests from one network in an hour → 3 confirmations, 1 held for a person", sentNet === 3 && heldNet.length === 1 && String(heldNet[0]?.last_error).includes("misma red"), { sentNet, held: heldNet.length });
      const heldOne = net.find((x) => callsFor(x.whatsapp).length === 0);
      const res = heldOne ? await site.wa.sendTemplateManually(heldOne.id, "cqv_web_confirm", deps) : null;
      check("…and the board can still send the held one by hand", !!res && res.ok && res.status === "sent", res);
    }

    // ────────────────────────────────────────────────────────────────────
    section("T1 skip when they already wrote after submitting");
    {
      const c = await seed("T1 skip", { status: "nuevo", submitted_at: iso(sv(MON, 8)), last_inbound_at: iso(sv(MON, 8, 5)) });
      clock = sv(MON, 10);
      const r = await run([c.id]);
      const row = await templateRow(c.id, "cqv_web_confirm");
      check("no send; confirm row 'skipped'", callsFor(c.whatsapp).length === 0 && row?.status === "skipped", row);
      check("confirmed_at stamped on skip", !!(await signup(c.id)).confirmed_at);
      check("report.skipped counted", r.skipped === 1, r);
    }

    // ────────────────────────────────────────────────────────────────────
    section("Manual board actions are never repeated automatically");
    {
      clock = sv(MON, 10);
      const man1 = await seed("T1 confirmado a mano", { status: "nuevo", submitted_at: iso(sv(MON, 8)), confirmed_at: iso(sv(MON, 8, 10)) });
      const man2 = await seed("T2 avisado a mano", {
        status: "entregada",
        delivered_at: iso(sv(MON, 9)),
        site_url: "https://zz-manual2.example.com",
        free_until: plus(MON, 30),
        last_touch_kind: "delivered",
        last_touch_at: iso(sv(MON, 9, 5)),
      });
      const old = await seed("T2 entregada hace 20d", {
        status: "entregada",
        delivered_at: iso(new Date(clock.getTime() - 20 * D)),
        site_url: "https://zz-old.example.com",
        free_until: plus(MON, 10),
      });
      await db.from("web_gratis_messages").insert({ signup_id: old.id, phone: old.whatsapp, direction: "outbound", template: "cqv_web_rescue", source: "scheduler", status: "read", sent_at: iso(new Date(clock.getTime() - 1 * D)) });
      await run([man1.id, man2.id, old.id]);
      check("confirmed by hand on the board → confirm template skipped, not sent", callsFor(man1.whatsapp).length === 0 && (await templateRow(man1.id, "cqv_web_confirm"))?.status === "skipped");
      check("'Web lista' sent by hand after delivery → ready template skipped", callsFor(man2.whatsapp).length === 0 && (await templateRow(man2.id, "cqv_web_ready"))?.status === "skipped");
      check("site delivered 20 days ago → no late 'ya está lista' (and no row)", callsFor(old.whatsapp).length === 0 && !(await templateRow(old.id, "cqv_web_ready")));
      const res = await site.wa.sendTemplateManually(old.id, "cqv_web_ready", deps);
      check("…but the board can still send it by hand", res.ok && res.status === "sent", res);
    }

    // ────────────────────────────────────────────────────────────────────
    section("T2 site ready");
    {
      const d = await seed("T2 lista", {
        status: "entregada",
        delivered_at: iso(sv(MON, 9)),
        site_url: "https://zz-barberia.vercel.app",
        free_until: plus(MON, 30),
      });
      clock = sv(MON, 10);
      await run([d.id]);
      const c = callsFor(d.whatsapp);
      check("one send: cqv_web_ready", c.length === 1 && c[0].template?.name === "cqv_web_ready", c);
      check("body [site_url], URL button param = code", c[0]?.template?.bodyParams?.[0] === "https://zz-barberia.vercel.app" && c[0]?.template?.buttonParam === d.referral_code, c[0]);
      check("no confirm sent to a delivered site", !(await templateRow(d.id, "cqv_web_confirm")));

      const just = await seed("T2 recién entregada", { status: "entregada", delivered_at: iso(new Date(sv(MON, 10).getTime() - 5 * 60_000)), site_url: "https://zz-just.example.com", free_until: plus(MON, 30) });
      clock = sv(MON, 10);
      await run([just.id]);
      check("delivered 5 min ago → 'Web lista' waits (a person may send it by hand first)", callsFor(just.whatsapp).length === 0);
      clock = sv(MON, 10, 6);
      await run([just.id]);
      check("11 min after delivery → 'Web lista' sent", callsFor(just.whatsapp).length === 1);
    }

    // ────────────────────────────────────────────────────────────────────
    section("T3 day-28: payment-method gate (Stripe OR PayPal), reminder window");
    {
      const e = await seed("T3 dia28", {
        status: "entregada",
        delivered_at: iso(new Date(sv(MON, 10).getTime() - 28 * D)),
        site_url: null,
        free_until: plus(MON, 2),
      });
      await db.from("web_gratis_messages").insert([
        { signup_id: e.id, phone: e.whatsapp, direction: "outbound", template: "cqv_web_ready", source: "scheduler", status: "read", sent_at: iso(new Date(sv(MON, 10).getTime() - 28 * D)) },
        { signup_id: e.id, phone: e.whatsapp, direction: "outbound", template: "cqv_web_rescue", source: "scheduler", status: "read", sent_at: iso(new Date(sv(MON, 10).getTime() - 7 * D)) },
      ]);
      const saved = settings;
      // Neither Stripe nor PayPal (and no default PayPal link): nothing to pay with on /pagar.
      settings = { ...settings, pay_link: null, paypal_link: null };
      clock = sv(MON, 10);
      const n0 = alerts.length;
      let r = await run([e.id], { defaultPaypalLink: null });
      check("no payment method at all → no day28 send", callsFor(e.whatsapp).length === 0 && !(await templateRow(e.id, "cqv_web_day28")), r);
      check("… and one 'configure pay link' alert a day, naming what waits", alertsSince(n0).some((a) => a.key === `paylink-missing:${MON}` && a.text.includes("Configure el enlace de pago") && a.text.includes("Día 28")), alertsSince(n0));
      clock = sv(MON, 23);
      const n1 = alerts.length;
      await run([e.id], { defaultPaypalLink: null });
      check("no pay-link alert at night (outside the reminder window)", !alertsSince(n1).some((a) => a.key.startsWith("paylink-missing:")), alertsSince(n1));
      clock = sv(MON, 10);
      settings = saved;
      clock = sv(MON, 16, 5);
      r = await run([e.id]);
      check("16:05 SV → reminder window closed", callsFor(e.whatsapp).length === 0 && r.deferred >= 1, r);
      clock = sv(MON, 10);
      await run([e.id]);
      const c = callsFor(e.whatsapp);
      check("10:00 Mon → day28 sent once", c.length === 1 && c[0].template?.name === "cqv_web_day28", c);
      check("params [business, /pagar/<code>] + button code", c[0]?.template?.bodyParams?.[1] === `https://machinemindconsulting.com/pagar/${e.referral_code}` && c[0]?.template?.buttonParam === e.referral_code, c[0]);
      check("rescue (already sent at day 21) not re-sent", (await messagesOf(e.id)).filter((m) => m.template === "cqv_web_rescue").length === 1);

      const sunday = await seed("T3 domingo", { status: "compartida", delivered_at: iso(new Date(sv(SUN, 10).getTime() - 28 * D)), free_until: plus(SUN, 2) });
      clock = sv(SUN, 10);
      await run([sunday.id]);
      check("Sunday → no reminder", callsFor(sunday.whatsapp).length === 0);
      const sat = await seed("T3 sabado", { status: "compartida", delivered_at: iso(new Date(sv(SAT, 10).getTime() - 28 * D)), free_until: plus(SAT, 1) });
      clock = sv(SAT, 11);
      await run([sat.id]);
      check("Saturday 11:00 → reminder allowed", callsFor(sat.whatsapp).length === 1);
    }

    // ────────────────────────────────────────────────────────────────────
    section("T4 day-30 + backlog protection (T5 only when late)");
    {
      clock = sv(MON, 10);
      const f = await seed("T4 dia30", { status: "entregada", delivered_at: iso(new Date(clock.getTime() - 30 * D)), free_until: MON });
      await run([f.id]);
      const c = callsFor(f.whatsapp);
      check("day30 sent (only template)", c.length === 1 && c[0].template?.name === "cqv_web_day30", c);
      const g = await seed("T5 atrasado", { status: "entregada", delivered_at: iso(new Date(clock.getTime() - 32 * D)), free_until: plus(MON, -2) });
      await run([g.id]);
      const cg = callsFor(g.whatsapp);
      check("free_until−2 with no reminders yet → ONLY pause notice (no day28/day30 burst)", cg.length === 1 && cg[0].template?.name === "cqv_web_pause_notice", cg.map((x) => x.template?.name));
      check("pause notice params [business, pay url] + button", cg[0]?.template?.bodyParams?.length === 2 && cg[0]?.template?.buttonParam === g.referral_code);
      check("not paused yet on day +2", (await signup(g.id)).status === "entregada");
    }

    // ────────────────────────────────────────────────────────────────────
    section("T6 auto-pause: only after asking to pay, a day after the notice");
    {
      clock = sv(MON, 17); // reminder/marketing window closed: this section checks pauses, not sends
      const n0 = alerts.length;
      const readAt = (ms: number) => iso(new Date(clock.getTime() - ms));
      const ask = (s: { id: string; whatsapp: string }, template: string, status: string, sentAt: string) =>
        db.from("web_gratis_messages").insert({ signup_id: s.id, phone: s.whatsapp, direction: "outbound", template, source: "scheduler", status, sent_at: sentAt });
      const h1 = await seed("T6 nunca avisado +5", { status: "entregada", delivered_at: readAt(35 * D), free_until: plus(MON, -5), site_url: "https://zz-h1.example.com" });
      const h1b = await seed("T6 nunca avisado +6", { status: "entregada", delivered_at: readAt(36 * D), free_until: plus(MON, -6) });
      const h1c = await seed("T6 recordado sin aviso +6", { status: "entregada", delivered_at: readAt(36 * D), free_until: plus(MON, -6), site_url: "https://zz-h1c.example.com" });
      await ask(h1c, "cqv_web_day30", "read", readAt(6 * D));
      const h2 = await seed("T6 aviso reciente", { status: "compartida", delivered_at: readAt(33 * D), free_until: plus(MON, -3) });
      await ask(h2, "cqv_web_pause_notice", "delivered", readAt(10 * H));
      const h3 = await seed("T6 aviso ayer", { status: "entregada", delivered_at: readAt(33 * D), free_until: plus(MON, -3) });
      await ask(h3, "cqv_web_pause_notice", "read", readAt(21 * H));
      const h4 = await seed("T6 dado de baja", { status: "entregada", delivered_at: readAt(33 * D), free_until: plus(MON, -3), opted_out_at: readAt(5 * D) });
      const h5 = await seed("T6 aviso fallido", { status: "entregada", delivered_at: readAt(34 * D), free_until: plus(MON, -4) });
      await ask(h5, "cqv_web_pause_notice", "failed", readAt(40 * H));
      const r = await run([h1.id, h1b.id, h1c.id, h2.id, h3.id, h4.id, h5.id]);
      const [s1, s1b, s1c, s2, s3, s4, s5] = await Promise.all([h1, h1b, h1c, h2, h3, h4, h5].map((x) => signup(x.id)));
      check("never asked to pay, +5 → NOT paused (waits for the notice window)", s1.status === "entregada" && callsFor(h1.whatsapp).length === 0, s1.status);
      check("never asked to pay, +6 → still NOT paused (held)", s1b.status === "entregada" && r.pauseHeld >= 1, { st: s1b.status, held: r.pauseHeld });
      check("…and a daily 'no se pausan solas' alert names it", alertsSince(n0).some((a) => a.key === `pause-held:${MON}` && a.text.includes(h1b.business_name)), alertsSince(n0).map((a) => a.key));
      check("asked (day 30 reached them) but the notice never went out, +6 → paused", s1c.status === "pausada");
      check("pause notice sent 10 h ago → waits (not paused)", s2.status === "compartida");
      check("pause notice sent 21 h ago → paused", s3.status === "pausada" && !!s3.paused_at && s3.recontact_after === plus(MON, 60), [s3.status, s3.recontact_after]);
      check("opted-out client (can't be messaged) still auto-paused at +3, no message", s4.status === "pausada" && callsFor(h4.whatsapp).length === 0);
      check("notice FAILED (never reached them), +4 → not paused yet", s5.status === "entregada");
      check("report.paused = 3", r.paused === 3, r);
      check("alert '⏸ PAUSADA por falta de pago — <business>' per paused client", alertsSince(n0).filter((a) => a.key.startsWith("paused:") && a.text.startsWith("⏸ PAUSADA por falta de pago — ZZ ")).length === 3, alertsSince(n0).map((a) => a.key));
      await run([h3.id]);
      check("never re-paused / re-alerted", alertsSince(n0).filter((a) => a.key.startsWith(`paused:${h3.id}:`)).length === 1);
    }

    // ────────────────────────────────────────────────────────────────────
    section("T6 when the pause notice falls on a Sunday (review scenario)");
    {
      // free_until = Friday → +2 = Sunday (no reminders on Sunday), +3 = Monday.
      const sd = await seed("T6 aviso cae domingo", { status: "entregada", delivered_at: iso(new Date(sv(FRI, 9).getTime() - 30 * D)), free_until: FRI, site_url: "https://zz-sd.example.com" });
      await db.from("web_gratis_messages").insert([
        { signup_id: sd.id, phone: sd.whatsapp, direction: "outbound", template: "cqv_web_day28", source: "scheduler", status: "read", sent_at: iso(sv(plus(FRI, -2), 10)) },
        { signup_id: sd.id, phone: sd.whatsapp, direction: "outbound", template: "cqv_web_day30", source: "scheduler", status: "read", sent_at: iso(sv(FRI, 10)) },
      ]);
      clock = sv(SUN, 10);
      await run([sd.id]);
      check("Sunday (free+2): no notice (reminders never on Sunday), not paused", callsFor(sd.whatsapp).length === 0 && (await signup(sd.id)).status === "entregada");
      clock = sv(MON, 0, 30);
      await run([sd.id]);
      check("Monday 00:30 (free+3), notice not out yet → NOT paused", (await signup(sd.id)).status === "entregada");
      clock = sv(MON, 10);
      await run([sd.id]);
      check("Monday 10:00 → pause notice goes out", callsFor(sd.whatsapp).length === 1 && callsFor(sd.whatsapp)[0].template?.name === "cqv_web_pause_notice");
      clock = sv(MON, 23);
      await run([sd.id]);
      check("13 h after the notice → still live ('se pausa mañana' stays true)", (await signup(sd.id)).status === "entregada");
      clock = sv(TUE, 7);
      await run([sd.id]);
      check("Tuesday 07:00 (21 h after) → paused", (await signup(sd.id)).status === "pausada");
    }

    // ────────────────────────────────────────────────────────────────────
    section("T7 rescue (marketing, once)");
    {
      clock = sv(MON, 11);
      const r1 = await seed("T7 viva 22d", { status: "compartida", delivered_at: iso(new Date(clock.getTime() - 22 * D)), free_until: plus(MON, 8) });
      await db.from("web_gratis_messages").insert({ signup_id: r1.id, phone: r1.whatsapp, direction: "outbound", template: "cqv_web_ready", source: "scheduler", status: "read", sent_at: iso(new Date(clock.getTime() - 22 * D)) });
      const r2 = await seed("T7 reciente", { status: "compartida", delivered_at: iso(new Date(clock.getTime() - 22 * D)), free_until: plus(MON, 8) });
      await db.from("web_gratis_messages").insert({ signup_id: r2.id, phone: r2.whatsapp, direction: "outbound", template: "cqv_web_ready", source: "admin", status: "read", sent_at: iso(new Date(clock.getTime() - 1 * D)) });
      const r3 = await seed("T7 pausada 31d", { status: "pausada", delivered_at: iso(new Date(clock.getTime() - 64 * D)), free_until: plus(MON, -34), paused_at: iso(new Date(clock.getTime() - 31 * D)) });
      const r4 = await seed("T7 ya quiere citas", { status: "compartida", delivered_at: iso(new Date(clock.getTime() - 22 * D)), free_until: plus(MON, 8), rung2_interest_at: iso(new Date(clock.getTime() - 2 * D)) });
      const r5 = await seed("T7 dijo no", { status: "compartida", delivered_at: iso(new Date(clock.getTime() - 22 * D)), free_until: plus(MON, 8), declined_at: iso(new Date(clock.getTime() - 2 * D)) });
      const r6 = await seed("T7 pausada 10d", { status: "pausada", delivered_at: iso(new Date(clock.getTime() - 43 * D)), free_until: plus(MON, -13), paused_at: iso(new Date(clock.getTime() - 10 * D)) });
      await run([r1.id, r2.id, r3.id, r4.id, r5.id, r6.id]);
      const c1 = callsFor(r1.whatsapp);
      check("live 22 d → rescue with [business, /citas/<code>], no button", c1.length === 1 && c1[0].template?.name === "cqv_web_rescue" && c1[0].template?.bodyParams?.[1] === `https://machinemindconsulting.com/citas/${r1.referral_code}` && !c1[0].template?.buttonParam, c1);
      check("template 1 day ago → no rescue (3-day gap)", callsFor(r2.whatsapp).length === 0);
      check("paused 31 d → rescue", callsFor(r3.whatsapp).length === 1);
      check("rung-2 interest → no rescue", callsFor(r4.whatsapp).length === 0);
      check("declined → no rescue", callsFor(r5.whatsapp).length === 0);
      check("paused only 10 d → no rescue", callsFor(r6.whatsapp).length === 0);
      clock = new Date(clock.getTime() + 40 * D);
      await run([r1.id, r3.id]);
      check("rescue is once ever (40 days later: nothing new)", callsFor(r1.whatsapp).length === 1 && callsFor(r3.whatsapp).length === 1);
    }

    // ────────────────────────────────────────────────────────────────────
    section("Guards: opt-out, no-WhatsApp, declined, paid");
    {
      clock = sv(MON, 10);
      const o1 = await seed("G baja", { status: "nuevo", submitted_at: iso(sv(MON, 9)), opted_out_at: iso(sv(MON, 9, 30)) });
      const o2 = await seed("G sin wa", { status: "nuevo", submitted_at: iso(sv(MON, 9)), no_whatsapp_at: iso(sv(MON, 9, 30)) });
      const o3 = await seed("G dijo no", { status: "entregada", delivered_at: iso(new Date(clock.getTime() - 28 * D)), free_until: plus(MON, 2), declined_at: iso(sv(MON, 8)) });
      const o4 = await seed("G pagó", { status: "activa", delivered_at: iso(new Date(clock.getTime() - 28 * D)), free_until: plus(MON, 2), activated_at: iso(sv(MON, 8)), paid_via: "stripe" });
      await run([o1.id, o2.id, o3.id, o4.id]);
      check("opted out → nothing", callsFor(o1.whatsapp).length === 0);
      check("no WhatsApp → nothing", callsFor(o2.whatsapp).length === 0);
      check("declined → no day28", callsFor(o3.whatsapp).length === 0);
      check("activa → no reminders", callsFor(o4.whatsapp).length === 0);

      let res = await site.wa.sendTemplateManually(o3.id, "cqv_web_day28", deps);
      check("board: 'dijo que no' → day 28 refused", !res.ok && res.error === "not_eligible" && res.message.includes("Dijo que no"), res);
      res = await site.wa.sendTemplateManually(o3.id, "cqv_web_rescue", deps);
      check("board: 'dijo que no' → rescue (marketing) refused", !res.ok && res.error === "not_eligible", res);
      res = await site.wa.sendTemplateManually(o2.id, "cqv_web_confirm", deps);
      check("board: number without WhatsApp → refused until corrected", !res.ok && res.error === "not_eligible" && res.message.includes("no tiene WhatsApp"), res);
      const noLink = await seed("G sin enlace de pago", { status: "entregada", delivered_at: iso(new Date(clock.getTime() - 28 * D)), free_until: plus(MON, 2), site_url: "https://zz-nolink.example.com" });
      const saved = settings;
      settings = { ...settings, pay_link: null };
      res = await site.wa.sendTemplateManually(noLink.id, "cqv_web_day28", deps);
      settings = saved;
      check("board: reminder with no Stripe link but PayPal on /pagar → allowed (sent)", res.ok && res.status === "sent" && callsFor(noLink.whatsapp).length === 1, res);
      res = await site.wa.sendTemplateManually(o4.id, "cqv_web_day30", deps);
      check("board: paying client → reminder refused", !res.ok && res.error === "not_eligible", res);
    }

    // ────────────────────────────────────────────────────────────────────
    section("Retry queue: closed windows and held templates never block other retries");
    {
      clock = sv(SUN, 10); // marketing window closed all Sunday, transactional open
      const crowd: { id: string; whatsapp: string }[] = [];
      for (let i = 0; i < 61; i += 10) {
        crowd.push(
          ...(await Promise.all(
            Array.from({ length: Math.min(10, 61 - i) }, (_, k) =>
              seed(`Q rescate ${i + k}`, { status: "compartida", delivered_at: iso(new Date(clock.getTime() - 25 * D)), free_until: plus(SUN, 5) }),
            ),
          )),
        );
      }
      const { error: crowdError } = await db.from("web_gratis_messages").insert(
        crowd.map((c) => ({ signup_id: c.id, phone: c.whatsapp, direction: "outbound", template: "cqv_web_rescue", source: "scheduler", status: "queued", attempts: 0, next_attempt_at: iso(new Date(clock.getTime() - 2 * H)) })),
      );
      check("61 due rescue rows seeded", !crowdError, crowdError);
      const hl = await seed("Q confirmación atrasada", { status: "nuevo", submitted_at: iso(new Date(clock.getTime() - 3 * H)) });
      await db.from("web_gratis_messages").insert({ signup_id: hl.id, phone: hl.whatsapp, direction: "outbound", template: "cqv_web_confirm", source: "scheduler", status: "queued", attempts: 1, next_attempt_at: iso(new Date(clock.getTime() - 60_000)), last_error_code: "130429" });
      mock.plan = okReply;
      const ids = [...crowd.map((c) => c.id), hl.id];
      let r = await run(ids);
      check("Sunday: the confirmation retry goes out despite 61 older rescue rows waiting for Monday", (await templateRow(hl.id, "cqv_web_confirm"))?.status === "sent" && r.retried === 1, r);
      check("…and no rescue went out on Sunday", crowd.every((c) => callsFor(c.whatsapp).length === 0));

      clock = sv(MON, 10);
      mock.plan = (call) => (call.template?.name === "cqv_web_rescue" ? errReply("template_not_approved", true) : okReply());
      r = await run(ids);
      const { data: stillDue } = await db
        .from("web_gratis_messages")
        .select("id")
        .in("signup_id", crowd.map((c) => c.id))
        .eq("status", "queued")
        .lte("next_attempt_at", iso(clock));
      const rescueCalls = crowd.reduce((n, c) => n + callsFor(c.whatsapp).length, 0);
      check("template not approved → ONE probe, then every due row of that template waits an hour", rescueCalls === 1 && (stillDue ?? []).length === 0, { rescueCalls, due: (stillDue ?? []).length, r });
      mock.plan = okReply;
    }

    // ────────────────────────────────────────────────────────────────────
    section("Manual sends the scheduler wouldn't make are retried, not dropped");
    {
      clock = sv(MON, 10);
      mock.plan = okReply;
      const early = await seed("M pagó antes de entrega", { status: "activa", activated_at: iso(sv(MON, 8)), paid_via: "stripe", delivered_at: iso(sv(MON, 9)), site_url: "https://zz-early.example.com" });
      const queued = await site.wa.queueManualTemplate(early.id, "cqv_web_ready", clock, "pagó antes de la entrega");
      await run([early.id]);
      const ready = await templateRow(early.id, "cqv_web_ready");
      check("'Web lista' queued by the board for a client who already paid → sent by the retry pass", queued && ready?.status === "sent" && callsFor(early.whatsapp).length === 1, ready);

      const off = await seed("M día 28 fuera de fecha", { status: "entregada", delivered_at: iso(new Date(clock.getTime() - 10 * D)), free_until: plus(MON, 20), site_url: "https://zz-off.example.com" });
      mock.plan = () => errReply("130429", true);
      const res = await site.wa.sendTemplateManually(off.id, "cqv_web_day28", deps);
      const row = await templateRow(off.id, "cqv_web_day28");
      check("manual day 28 outside its dates hits a rate limit → queued, marked manual", res.ok && res.status === "queued" && row?.status === "queued" && (row?.meta as { manual?: boolean })?.manual === true, { res, row });
      mock.plan = okReply;
      clock = new Date(clock.getTime() + 2 * 60_000);
      await run([off.id]);
      check("…next run retries it (not skipped as 'ya no aplica')", (await templateRow(off.id, "cqv_web_day28"))?.status === "sent" && callsFor(off.whatsapp).filter((c) => c.template?.name === "cqv_web_day28").length === 2);
      clock = sv(MON, 10);
    }

    // ────────────────────────────────────────────────────────────────────
    section("Retries, backoff, holds, permanent failures");
    {
      clock = sv(MON, 10);
      // template not approved → hold (attempt not consumed), +60 min, fresh key, alert
      const q1 = await seed("R no aprobada", { status: "nuevo", submitted_at: iso(sv(MON, 9)) });
      mock.plan = () => errReply("template_not_approved", true);
      let n0 = alerts.length;
      let r = await run([q1.id]);
      let row = await templateRow(q1.id, "cqv_web_confirm");
      check("template_not_approved → queued, attempts 0 (hold)", row?.status === "queued" && row?.attempts === 0, row);
      check("next try +60 min", Math.abs(Date.parse(String(row?.next_attempt_at)) - (clock.getTime() + 3600_000)) < 5000, row?.next_attempt_at);
      const keyAfterHold = String(row?.idempotency_key);
      check("definitive 'not sent' → a never-used idempotency key", /^wg-\d+-r1-[0-9a-f]{6}$/.test(keyAfterHold), keyAfterHold);
      check("daily per-template alert", alertsSince(n0).some((a) => a.key.startsWith("wa-template:cqv_web_confirm:")), alertsSince(n0));
      check("report.queuedForRetry", r.queuedForRetry === 1, r);
      clock = new Date(clock.getTime() + 30 * 60_000);
      mock.plan = okReply;
      await run([q1.id]);
      check("+30 min → not due, no call", callsFor(q1.whatsapp).length === 1);
      clock = new Date(clock.getTime() + 31 * 60_000);
      r = await run([q1.id]);
      row = await templateRow(q1.id, "cqv_web_confirm");
      check("+61 min → retried and sent with that new key", row?.status === "sent" && callsFor(q1.whatsapp).length === 2 && callsFor(q1.whatsapp)[1].idempotencyKey === keyAfterHold && r.retried === 1, { row, r });

      // disabled → stop the run after the first call
      clock = sv(MON, 10);
      const q2a = await seed("R apagado A", { status: "nuevo", submitted_at: iso(sv(MON, 8)) });
      const q2b = await seed("R apagado B", { status: "nuevo", submitted_at: iso(sv(MON, 8, 30)) });
      mock.plan = () => errReply("disabled", true);
      n0 = alerts.length;
      r = await run([q2a.id, q2b.id]);
      check("disabled → run stops after 1 call", callsFor(q2a.whatsapp).length + callsFor(q2b.whatsapp).length === 1 && r.stopped === "disabled", r);
      check("disabled: attempt not consumed + daily alert", (await templateRow(q2a.id, "cqv_web_confirm"))?.attempts === 0 && alertsSince(n0).some((a) => a.key.startsWith("wa-disabled:")));

      // dropped connection after Rewired got the request → unknown outcome: never auto-resent
      const q3 = await seed("R red", { status: "nuevo", submitted_at: iso(sv(MON, 9)) });
      mock.plan = () => ({ destroy: true });
      n0 = alerts.length;
      r = await run([q3.id]);
      row = await templateRow(q3.id, "cqv_web_confirm");
      check("unknown outcome → 'failed' send_unknown (NOT queued), run stopped", row?.status === "failed" && row?.last_error_code === "send_unknown" && row?.attempts === 1 && r.stopped === "network", { row, r });
      check("…with a '¿le llegó?' alert for a person", alertsSince(n0).some((a) => a.key === `wa-unknown:${row?.id}:1` && a.text.includes("No sabemos si")), alertsSince(n0));
      mock.plan = okReply;
      clock = new Date(clock.getTime() + 20 * 60_000);
      await run([q3.id]);
      check("never re-sent automatically (Rewired can't de-duplicate it)", callsFor(q3.whatsapp).length === 1);
      let manual = await site.wa.sendTemplateManually(q3.id, "cqv_web_confirm", deps);
      check("board resend without confirmation → needs_confirm, nothing sent", !manual.ok && manual.error === "needs_confirm" && callsFor(q3.whatsapp).length === 1, manual);
      manual = await site.wa.sendTemplateManually(q3.id, "cqv_web_confirm", deps, { force: true });
      row = await templateRow(q3.id, "cqv_web_confirm");
      check("…confirmed by the person → sent with a never-used key", manual.ok && manual.status === "sent" && /^wg-\d+-m-[0-9a-f]{6}$/.test(String(row?.idempotency_key)), { manual, key: row?.idempotency_key });
      clock = sv(MON, 10);

      // 130429 → +1 min
      const q4 = await seed("R 130429", { status: "nuevo", submitted_at: iso(sv(MON, 9)) });
      mock.plan = () => errReply("130429", true);
      await run([q4.id]);
      row = await templateRow(q4.id, "cqv_web_confirm");
      check("130429 → +60 s", Math.abs(Date.parse(String(row?.next_attempt_at)) - (clock.getTime() + 60_000)) < 5000 && row?.attempts === 1, row);

      // 131049 → +25 h
      const q5 = await seed("R 131049", { status: "compartida", delivered_at: iso(new Date(clock.getTime() - 22 * D)), free_until: plus(MON, 8) });
      mock.plan = () => errReply("131049", true);
      await run([q5.id]);
      row = await templateRow(q5.id, "cqv_web_rescue");
      check("131049 (marketing cap) → +25 h", Math.abs(Date.parse(String(row?.next_attempt_at)) - (clock.getTime() + 25 * H)) < 5000, row);

      // 12th attempt on a generic transient error → failed + alert
      const q6 = await seed("R 12 intentos", { status: "nuevo", submitted_at: iso(sv(MON, 7)) });
      const { data: seeded } = await db
        .from("web_gratis_messages")
        .insert({ signup_id: q6.id, phone: q6.whatsapp, direction: "outbound", template: "cqv_web_confirm", source: "scheduler", status: "queued", attempts: 11, next_attempt_at: iso(new Date(clock.getTime() - 60_000)), idempotency_key: "wg-0-11" })
        .select("id")
        .single();
      mock.plan = () => errReply("131000", true);
      n0 = alerts.length;
      await run([q6.id]);
      row = await templateRow(q6.id, "cqv_web_confirm");
      check("attempt 12 → failed", row?.status === "failed" && row?.attempts === 12, row);
      check("failure alert names the template and attempts", alertsSince(n0).some((a) => a.key === `wa-failed:${seeded?.id}:12` && a.text.includes("tras 12 intentos")), alertsSince(n0));

      // permanent 131026 → failed + no_whatsapp + alert
      const q7 = await seed("R 131026", { status: "nuevo", submitted_at: iso(sv(MON, 9)) });
      mock.plan = () => errReply("131026", false);
      n0 = alerts.length;
      await run([q7.id]);
      row = await templateRow(q7.id, "cqv_web_confirm");
      check("131026 → failed immediately", row?.status === "failed" && row?.attempts === 1, row);
      check("signup marked no_whatsapp + 📵 alert", !!(await signup(q7.id)).no_whatsapp_at && alertsSince(n0).some((a) => a.key === `wa-nowa:${q7.id}`));

      // opted_out from Rewired's stores → failed + opted_out_at + alert
      const q8 = await seed("R en bajas", { status: "nuevo", submitted_at: iso(sv(MON, 9)) });
      mock.plan = () => errReply("opted_out", false);
      n0 = alerts.length;
      await run([q8.id]);
      const s8 = await signup(q8.id);
      check("Rewired opted_out → failed + signup opted_out_at", (await templateRow(q8.id, "cqv_web_confirm"))?.status === "failed" && !!s8.opted_out_at, s8.opt_out_reason);
      check("🚫 alert for Rewired opt-out", alertsSince(n0).some((a) => a.key === `wa-optout:${q8.id}`));

      // queued day28 for someone who then paid → skipped on retry, no call
      const q9 = await seed("R pagó en cola", { status: "activa", activated_at: iso(sv(MON, 9)), delivered_at: iso(new Date(clock.getTime() - 28 * D)), free_until: plus(MON, 2) });
      await db.from("web_gratis_messages").insert({ signup_id: q9.id, phone: q9.whatsapp, direction: "outbound", template: "cqv_web_day28", source: "scheduler", status: "queued", attempts: 1, next_attempt_at: iso(new Date(clock.getTime() - 60_000)) });
      mock.plan = okReply;
      r = await run([q9.id]);
      check("queued reminder for a paying client → skipped, no call", (await templateRow(q9.id, "cqv_web_day28"))?.status === "skipped" && callsFor(q9.whatsapp).length === 0 && r.skipped === 1, r);

      // Bridge secret rejected by Rewired → unauthorized hold + alert + stop
      const q10 = await seed("R firma", { status: "nuevo", submitted_at: iso(sv(MON, 9)) });
      const badDeps: WaDeps = { ...deps, send: (req) => site.rewired.sendViaRewired(req, { baseUrl: mock.url, secret: "another-secret-another-secret-1234" }) };
      n0 = alerts.length;
      r = await site.wa.runWhatsAppScheduler(badDeps, { onlySignupIds: [q10.id], spacingMs: 0 });
      row = await templateRow(q10.id, "cqv_web_confirm");
      check("bad bridge secret → queued hold (attempts 0), stop, 'puente' alert", row?.status === "queued" && row?.attempts === 0 && r.stopped === "unauthorized" && alertsSince(n0).some((a) => a.key.startsWith("wa-bridge:")), { row, r });
    }

    // ────────────────────────────────────────────────────────────────────
    section("Concurrency + per-run cap");
    {
      clock = sv(MON, 10);
      mock.plan = okReply;
      const k = await seed("C carrera", { status: "nuevo", submitted_at: iso(sv(MON, 9)) });
      await Promise.all([run([k.id]), run([k.id]), run([k.id])]);
      check("3 overlapping runs → exactly 1 send", callsFor(k.whatsapp).length === 1, callsFor(k.whatsapp).length);
      const l = await Promise.all([1, 2, 3].map((i) => seed(`C tope ${i}`, { status: "nuevo", submitted_at: iso(sv(MON, 9, i)) })));
      const ids = l.map((x) => x.id);
      const r = await run(ids, { maxSends: 2 });
      const sentNow = l.filter((x) => callsFor(x.whatsapp).length === 1).length;
      check("maxSends 2 → 2 sends this run", sentNow === 2 && r.sent === 2, r);
      await run(ids, { maxSends: 2 });
      check("next run sends the third", l.filter((x) => callsFor(x.whatsapp).length === 1).length === 3);
    }

    // ────────────────────────────────────────────────────────────────────
    section("Manual send / retry (board)");
    {
      clock = sv(MON, 10);
      mock.plan = okReply;
      const m = await seed("M manual", { status: "entregada", delivered_at: iso(sv(MON, 9)), site_url: "https://zz-manual.example.com", free_until: plus(MON, 30) });
      let res = await site.wa.sendTemplateManually(m.id, "cqv_web_ready", deps);
      check("manual ready → sent", res.ok && res.status === "sent", res);
      check("manual row source 'admin'", (await templateRow(m.id, "cqv_web_ready"))?.source === "admin");
      res = await site.wa.sendTemplateManually(m.id, "cqv_web_ready", deps);
      check("manual again → already_sent (never twice)", !res.ok && res.error === "already_sent", res);
      clock = sv(MON, 17);
      res = await site.wa.sendTemplateManually(m.id, "cqv_web_day30", deps);
      check("reminder at 17:00 SV → window_closed", !res.ok && res.error === "window_closed", res);
      clock = sv(MON, 10);
      await db.from("web_gratis_messages").insert({ signup_id: m.id, phone: m.whatsapp, direction: "outbound", template: "cqv_web_day30", source: "scheduler", status: "failed", attempts: 12, idempotency_key: "wg-x-12", last_error: "old" });
      res = await site.wa.sendTemplateManually(m.id, "cqv_web_day30", deps);
      const day30 = await templateRow(m.id, "cqv_web_day30");
      check("failed row → manual retry sends (fresh key, same ledger row)", res.ok && res.status === "sent" && day30?.status === "sent" && /^wg-\d+-m-[0-9a-f]{6}$/.test(String(day30?.idempotency_key)), { res, day30 });
      const opted = await seed("M baja", { status: "nuevo", submitted_at: iso(sv(MON, 9)), opted_out_at: iso(sv(MON, 9)) });
      res = await site.wa.sendTemplateManually(opted.id, "cqv_web_confirm", deps);
      check("opted out → not_eligible", !res.ok && res.error === "not_eligible", res);
      const noSite = await seed("M sin link", { status: "entregada", delivered_at: iso(sv(MON, 9)), free_until: plus(MON, 30) });
      res = await site.wa.sendTemplateManually(noSite.id, "cqv_web_ready", deps);
      check("ready without site link → not_eligible", !res.ok && res.error === "not_eligible", res);
    }

    // ────────────────────────────────────────────────────────────────────
    section("Bridge handlers (inbound / status / outbound / opt_out / event / media)");
    {
      const bd = { now, alert: deps.alert };
      clock = sv(MON, 12);
      const b1 = await seed("B cliente", { status: "entregada", delivered_at: iso(sv(MON, 9)), site_url: "https://zz-b1.example.com", free_until: plus(MON, 30) });
      await db.from("web_gratis_messages").insert({ signup_id: b1.id, phone: b1.whatsapp, direction: "outbound", template: "cqv_web_ready", source: "scheduler", status: "read", sent_at: iso(sv(MON, 9, 5)), wa_message_id: `wamid.ZZT${Date.now()}r`, body: "¡Su página web ya está lista!" });
      const w1 = `wamid.ZZIN${Date.now()}a`;
      let res = await site.bridge.handleBridge({ type: "inbound", phone: b1.whatsapp, wamid: w1, msgType: "text", text: "Hola, ¿cuánto cuesta después?", profileName: "ZZ Perfil", receivedAt: String(Math.floor(clock.getTime() / 1000)) }, bd);
      const data = res.body.data as { duplicate: boolean; client: Record<string, unknown> | null; history: { direction: string; body: string }[] };
      check("inbound → 200, duplicate false", res.status === 200 && data.duplicate === false, res);
      check("client context fields", data.client?.signupId === b1.id && data.client?.code === b1.referral_code && data.client?.status === "entregada" && data.client?.payUrl === `https://machinemindconsulting.com/pagar/${b1.referral_code}` && data.client?.onboardingUrl === "https://machinemindconsulting.com/web" && data.client?.activated === false && data.client?.optedOut === false && data.client?.lastTemplate === "cqv_web_ready", data.client);
      check("referralLink + siteUrl + freeUntil + deliveryDays present", String(data.client?.referralLink).endsWith(`?ref=${b1.referral_code}`) && data.client?.siteUrl === "https://zz-b1.example.com" && data.client?.freeUntil === plus(MON, 30) && "deliveryDays" in (data.client ?? {}), data.client);
      check("history chronological, ends with this message, includes the template", data.history.at(-1)?.body === "Hola, ¿cuánto cuesta después?" && data.history.some((h) => h.direction === "outbound"), data.history);
      check("last_inbound_at stamped from receivedAt (unix seconds)", Math.abs(Date.parse(String((await signup(b1.id)).last_inbound_at)) - clock.getTime()) < 2000);
      res = await site.bridge.handleBridge({ type: "inbound", phone: b1.whatsapp, wamid: w1, msgType: "text", text: "Hola", receivedAt: null }, bd);
      check("same wamid again → duplicate:true (claim)", res.status === 200 && (res.body.data as { duplicate: boolean }).duplicate === true, res.body);
      const p9 = fakePhone();
      res = await site.bridge.handleBridge({ type: "inbound", phone: p9, wamid: `wamid.ZZIN${Date.now()}u`, msgType: "image", receivedAt: null }, bd);
      check("unknown phone → client null, message stored without signup", res.status === 200 && (res.body.data as { client: unknown }).client === null, res.body);

      const o1 = `wamid.ZZOUT${Date.now()}`;
      res = await site.bridge.handleBridge({ type: "outbound", phone: b1.whatsapp, wamid: o1, text: "Son $20 al mes, sin contrato." }, bd);
      check("outbound logged", res.status === 200 && (res.body.data as { duplicate: boolean }).duplicate === false);
      res = await site.bridge.handleBridge({ type: "outbound", phone: b1.whatsapp, wamid: o1, text: "dup" }, bd);
      check("outbound duplicate", (res.body.data as { duplicate: boolean }).duplicate === true);

      const st = async (status: "sent" | "delivered" | "read" | "failed", wamid: string, extra: Record<string, unknown> = {}) =>
        site.bridge.handleBridge({ type: "status", wamid, status, timestamp: String(Math.floor(clock.getTime() / 1000)), ...extra } as Parameters<typeof site.bridge.handleBridge>[0], bd);
      await st("delivered", o1);
      await st("read", o1);
      let late = await st("sent", o1);
      const lateDelivered = await st("delivered", o1);
      const { data: outRow } = await db.from("web_gratis_messages").select("status, delivered_at, read_at").eq("wa_message_id", o1).single();
      check("status progress delivered → read", outRow?.status === "read" && !!outRow?.delivered_at && !!outRow?.read_at, outRow);
      check("late 'sent' / 'delivered' never downgrade 'read'", (late.body.data as { updated: boolean }).updated === false && (lateDelivered.body.data as { updated: boolean }).updated === false);
      late = await st("delivered", "wamid.ZZ-unknown");
      check("unknown wamid → known:false (no error)", late.status === 200 && (late.body.data as { known: boolean }).known === false);

      const b2 = await seed("B sin wa", { status: "nuevo", submitted_at: iso(sv(MON, 9)) });
      const t1 = `wamid.ZZT${Date.now()}f`;
      await db.from("web_gratis_messages").insert({ signup_id: b2.id, phone: b2.whatsapp, direction: "outbound", template: "cqv_web_confirm", source: "scheduler", status: "sent", wa_message_id: t1, attempts: 1, sent_at: iso(clock) });
      let n0 = alerts.length;
      await st("failed", t1, { errorCode: 131026, errorTitle: "Message undeliverable" });
      check("failed 131026 → row failed + signup no_whatsapp + alert", (await templateRow(b2.id, "cqv_web_confirm"))?.status === "failed" && !!(await signup(b2.id)).no_whatsapp_at && alertsSince(n0).some((a) => a.key === `wa-nowa:${b2.whatsapp}`));

      const b2b = await seed("B cupo mkt", { status: "compartida", delivered_at: iso(new Date(clock.getTime() - 22 * D)), free_until: plus(MON, 8) });
      const t2 = `wamid.ZZT${Date.now()}g`;
      await db.from("web_gratis_messages").insert({ signup_id: b2b.id, phone: b2b.whatsapp, direction: "outbound", template: "cqv_web_rescue", source: "scheduler", status: "sent", wa_message_id: t2, attempts: 1, sent_at: iso(clock) });
      await st("failed", t2, { errorCode: "131049", errorTitle: "healthy ecosystem" });
      const requeued = await templateRow(b2b.id, "cqv_web_rescue");
      check("failed 131049 on a template → re-queued +25 h, wamid cleared, old wamid kept in meta", requeued?.status === "queued" && requeued?.wa_message_id === null && Math.abs(Date.parse(String(requeued?.next_attempt_at)) - (clock.getTime() + 25 * H)) < 5000 && JSON.stringify(requeued?.meta).includes(t2), requeued);
      check("…with a never-used idempotency key (a replayed key would return the old wamid unsent)", /^wg-\d+-d\d+-[0-9a-f]{6}$/.test(String(requeued?.idempotency_key)), requeued?.idempotency_key);

      const back = await seed("B vuelve a WhatsApp", { status: "entregada", delivered_at: iso(new Date(clock.getTime() - 3 * D)), free_until: plus(MON, 27), no_whatsapp_at: iso(new Date(clock.getTime() - D)) });
      await site.bridge.handleBridge({ type: "inbound", phone: back.whatsapp, wamid: `wamid.ZZIN${Date.now()}back`, msgType: "text", text: "Hola", receivedAt: null }, bd);
      check("inbound from a number marked 'no WhatsApp' clears the mark", (await signup(back.id)).no_whatsapp_at === null);

      const b3 = await seed("B baja", { status: "entregada", delivered_at: iso(new Date(clock.getTime() - 29 * D)), free_until: plus(MON, 1) });
      await db.from("web_gratis_messages").insert({ signup_id: b3.id, phone: b3.whatsapp, direction: "outbound", template: "cqv_web_day30", source: "scheduler", status: "queued", attempts: 0, next_attempt_at: iso(new Date(clock.getTime() + H)) });
      n0 = alerts.length;
      res = await site.bridge.handleBridge({ type: "opt_out", phone: b3.whatsapp, reason: "BAJA" }, bd);
      const s3 = await signup(b3.id);
      check("opt_out → opted_out_at + reason", res.status === 200 && !!s3.opted_out_at && s3.opt_out_reason === "BAJA", s3.opt_out_reason);
      check("opt_out cancels queued templates", (await templateRow(b3.id, "cqv_web_day30"))?.status === "skipped");
      check("opt_out → 🚫 BAJA alert", alertsSince(n0).some((a) => a.key.startsWith(`optout:${b3.whatsapp}:`) && a.text.includes("BAJA")));
      clock = sv(MON, 10);
      await run([b3.id]);
      check("scheduler never messages the opted-out phone afterwards", callsFor(b3.whatsapp).length === 0);
      clock = sv(MON, 12);

      n0 = alerts.length;
      await site.bridge.handleBridge({ type: "event", phone: b1.whatsapp, event: "handoff_hot", note: "Quiere hablar hoy" }, bd);
      let s1 = await signup(b1.id);
      check("handoff_hot → handoff_at/kind + 🔥 LLAMAR AHORA alert", !!s1.handoff_at && s1.handoff_kind === "handoff_hot" && alertsSince(n0).some((a) => a.text.startsWith("🔥 LLAMAR AHORA") && a.text.includes("Quiere hablar hoy")), alertsSince(n0));
      await site.bridge.handleBridge({ type: "event", phone: b1.whatsapp, event: "share_confirmed" }, bd);
      s1 = await signup(b1.id);
      check("share_confirmed → entregada becomes compartida + share_confirmed_at + shared_at", s1.status === "compartida" && !!s1.share_confirmed_at && !!s1.shared_at, s1.status);
      n0 = alerts.length;
      await site.bridge.handleBridge({ type: "event", phone: b1.whatsapp, event: "rung2_interest" }, bd);
      check("rung2_interest → rung2_interest_at + alert", !!(await signup(b1.id)).rung2_interest_at && alertsSince(n0).length === 1);
      n0 = alerts.length;
      await site.bridge.handleBridge({ type: "event", phone: b1.whatsapp, event: "wants_changes", note: "cambiar foto" }, bd);
      await site.bridge.handleBridge({ type: "event", phone: b1.whatsapp, event: "decline" }, bd);
      s1 = await signup(b1.id);
      check("wants_changes / decline → flags, no alert", !!s1.wants_changes_at && !!s1.declined_at && alertsSince(n0).length === 0 && s1.last_touch_kind === "wa_evt_decline");

      // media
      res = await site.bridge.handleBridge({ type: "media_upload_url", phone: b1.whatsapp, contentType: "image/jpeg", kind: "photo" }, bd);
      const up = res.body.data as { path: string; signedUrl: string } | null;
      check("media_upload_url → signed URL in the client's folder", res.status === 200 && !!up && up.path.startsWith(`${b1.id}/photo-wa-`) && up.signedUrl.includes("/upload/sign/"), res.body);
      const JPEG = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64");
      const form = new FormData();
      form.append("cacheControl", "3600");
      form.append("", new Blob([JPEG], { type: "image/jpeg" }), "wa.jpg");
      const put = await fetch(up?.signedUrl ?? "", { method: "PUT", headers: { "x-upsert": "false" }, body: form });
      check("upload to signed URL → 2xx", put.ok, put.status);
      const wImg = `wamid.ZZIN${Date.now()}img`;
      await site.bridge.handleBridge({ type: "inbound", phone: b1.whatsapp, wamid: wImg, msgType: "image", receivedAt: null }, bd);
      res = await site.bridge.handleBridge({ type: "media_attached", phone: b1.whatsapp, path: up?.path ?? "", kind: "photo", wamid: wImg }, bd);
      check("media_attached → attached, in photo_paths", (res.body.data as { attached: string })?.attached === "attached" && ((await signup(b1.id)).photo_paths as string[]).includes(up?.path ?? "-"), res.body);
      const { data: imgRow } = await db.from("web_gratis_messages").select("media_path").eq("wa_message_id", wImg).single();
      check("ledger inbound image points at the stored file", imgRow?.media_path === up?.path, imgRow);
      res = await site.bridge.handleBridge({ type: "media_attached", phone: b1.whatsapp, path: up?.path ?? "", kind: "photo" }, bd);
      check("attach twice → duplicate (no double entry)", (res.body.data as { attached: string })?.attached === "duplicate");
      res = await site.bridge.handleBridge({ type: "media_upload_url", phone: b1.whatsapp, contentType: "video/mp4", kind: "photo" }, bd);
      check("unsupported type (video) → 415", res.status === 415 && res.body.error === "unsupported_type");
      res = await site.bridge.handleBridge({ type: "media_upload_url", phone: b1.whatsapp, contentType: "text/plain", kind: "photo" }, bd);
      check("a text file sent as 'photo' is stored as a document", res.status === 200 && (res.body.data as { kind?: string; path?: string })?.kind === "document" && String((res.body.data as { path?: string })?.path).includes("/document-"), res.body);
      res = await site.bridge.handleBridge({ type: "media_upload_url", phone: p9, contentType: "image/jpeg", kind: "photo" }, bd);
      check("unknown phone → 404 unknown_client", res.status === 404 && res.body.error === "unknown_client" && res.body.data === null);
      res = await site.bridge.handleBridge({ type: "media_attached", phone: b2.whatsapp, path: up?.path ?? "", kind: "photo" }, bd);
      check("someone else's path → 404 (never attaches across clients)", res.status === 404);
      res = await site.bridge.handleBridge({ type: "media_attached", phone: b1.whatsapp, path: `${b1.id}/photo-wa-1758700000000-abcdef.jpg`, kind: "photo" }, bd);
      check("path not in storage → 404 not_found", res.status === 404 && res.body.error === "not_found");
      res = await site.bridge.handleBridge({ type: "media_attached", phone: b1.whatsapp, path: up?.path ?? "", kind: "logo" }, bd);
      check("kind/path mismatch → 400", res.status === 400);
    }

    // ────────────────────────────────────────────────────────────────────
    section("Stripe: signature");
    {
      const body = JSON.stringify({ id: "evt_ZZsig", type: "x", data: { object: {} } });
      const t = Math.floor(Date.now() / 1000);
      const sig = (secret: string, ts: number, raw: string) => `t=${ts},v1=${site.bridgeAuth.hmacHex(secret, `${ts}.${raw}`)}`;
      const v = site.payments.verifyStripeSignature;
      check("valid signature", v(body, sig(STRIPE_SECRET, t, body), STRIPE_SECRET).ok);
      check("tampered body → mismatch", (v(body + " ", sig(STRIPE_SECRET, t, body), STRIPE_SECRET) as { reason?: string }).reason === "mismatch");
      check("401 s old → stale", (v(body, sig(STRIPE_SECRET, t - 401, body), STRIPE_SECRET) as { reason?: string }).reason === "stale");
      check("no secret → no_secret", (v(body, sig(STRIPE_SECRET, t, body), null) as { reason?: string }).reason === "no_secret");
      check("rotation: one of several v1 valid → ok", v(body, `t=${t},v1=${"0".repeat(64)},v1=${site.bridgeAuth.hmacHex(STRIPE_SECRET, `${t}.${body}`)}`, STRIPE_SECRET).ok);
      check("garbage header → malformed", (v(body, "nonsense", STRIPE_SECRET) as { reason?: string }).reason === "malformed");
      check("bridge verify: fails closed without secret", (site.bridgeAuth.verifySignedBody(sig(BRIDGE_SECRET, t, body), body, null) as { reason?: string }).reason === "no_secret");
    }

    section("Stripe: events → activa, referral credit, thank-you, idempotency");
    {
      clock = new Date();
      const pd = { now, send: deps.send, alert: deps.alert };
      const referrer = await seed("S referidor", { status: "activa", activated_at: iso(new Date(Date.now() - 40 * D)), delivered_at: iso(new Date(Date.now() - 70 * D)), free_until: plus(site.server.svDate(new Date()), -40), paid_via: "manual" });
      const payer = await seed("S paga", { status: "entregada", delivered_at: iso(new Date(Date.now() - 29 * D)), free_until: site.server.svDate(new Date(), 1), referred_by_id: referrer.id, last_inbound_at: iso(new Date(Date.now() - 2 * H)) });
      const evtId = `evt_ZZ${Date.now()}paid`;
      const event = {
        id: evtId,
        type: "checkout.session.completed",
        livemode: false,
        data: { object: { id: "cs_test_zz", client_reference_id: payer.id, customer: "cus_ZZtest", subscription: "sub_ZZtest", payment_status: "paid", amount_total: 2000, currency: "usd", mode: "subscription", metadata: { program: "web_gratis" }, customer_details: { email: "zz@example.com", name: "ZZ Pagador" } } },
      };
      const n0 = alerts.length;
      const calls0 = mock.calls.length;
      mock.plan = okReply;
      const res = await site.payments.handleStripeEvent(event, pd);
      const s = await signup(payer.id);
      check("checkout.session.completed → activa + paid_via stripe + ids", res.handled === "activated" && s.status === "activa" && s.paid_via === "stripe" && s.stripe_customer_id === "cus_ZZtest" && s.stripe_subscription_id === "sub_ZZtest" && !!s.activated_at, s);
      check("💰 PAGO RECIBIDO alert (· amount · Stripe · pagado hasta; says the WhatsApp confirmation went out)", alertsSince(n0).some((a) => a.key === `paid:${evtId}` && a.text.startsWith(`💰 PAGO RECIBIDO — ${payer.business_name} · $20.00 USD · Stripe · pagado hasta `) && a.text.includes("✅ Se le confirmó por WhatsApp")), alertsSince(n0));
      const { data: ledgerPaid } = await db.from("web_gratis_payments").select("*").eq("external_id", evtId).maybeSingle();
      check("checkout → payments ledger row (stripe, first, $20.00, born alerted)", ledgerPaid?.signup_id === payer.id && ledgerPaid?.via === "stripe" && ledgerPaid?.kind === "first" && ledgerPaid?.amount_cents === 2000 && !!ledgerPaid?.alerted_at && !!s.paid_through, { ledgerPaid, pt: s.paid_through });
      const { data: credit } = await db.from("web_gratis_referral_credits").select("*").eq("referred_id", payer.id).maybeSingle();
      check("referral credit row (referrer → payer, 1 month)", credit?.referrer_id === referrer.id && credit?.months === 1, credit);
      check("🤝 REFERIDO ACTIVÓ alert names the referrer", alertsSince(n0).some((a) => a.text.startsWith("🤝 REFERIDO ACTIVÓ") && a.text.includes(referrer.business_name)));
      const thanks = mock.calls.slice(calls0).find((c) => c.mode === "freeform");
      check("inbound < 23 h → free-form thank-you via Rewired", res.thankYou === "sent" && thanks?.to === payer.whatsapp && thanks?.text === site.payments.THANK_YOU_TEXT && thanks?.idempotencyKey === `wg-thanks-${evtId}`, { res, thanks });
      const { data: ledgerThanks } = await db.from("web_gratis_messages").select("*").eq("signup_id", payer.id).eq("source", "stripe").maybeSingle();
      check("thank-you logged in the ledger", ledgerThanks?.status === "sent" && !!ledgerThanks?.wa_message_id);
      const again = await site.payments.handleStripeEvent(event, pd);
      check("same event again → duplicate, nothing re-done", again.duplicate === true && mock.calls.length === calls0 + 1);
      const { data: evRow } = await db.from("web_gratis_stripe_events").select("status, signup_id").eq("id", evtId).single();
      check("event recorded processed + linked", evRow?.status === "processed" && evRow?.signup_id === payer.id, evRow);

      clock = sv(MON, 10);
      await run([payer.id]);
      check("after payment the scheduler sends it nothing", callsFor(payer.whatsapp).filter((c) => c.mode === "template").length === 0);
      clock = new Date();

      const n1 = alerts.length;
      await site.payments.handleStripeEvent({ id: `evt_ZZ${Date.now()}fail`, type: "invoice.payment_failed", data: { object: { customer: "cus_ZZtest", subscription: "sub_ZZtest", amount_due: 2000, currency: "usd", attempt_count: 2 } } }, pd);
      check("invoice.payment_failed → alert naming the client (no status change)", alertsSince(n1).some((a) => a.text.includes(payer.business_name) && a.text.includes("intento 2")) && (await signup(payer.id)).status === "activa");
      await site.payments.handleStripeEvent({ id: `evt_ZZ${Date.now()}del`, type: "customer.subscription.deleted", data: { object: { id: "sub_ZZtest", customer: "cus_ZZtest" } } }, pd);
      check("subscription.deleted → alert only", alertsSince(n1).some((a) => a.text.includes("canceló su suscripción") && a.text.includes(payer.business_name)) && (await signup(payer.id)).status === "activa");
      const orphan = await site.payments.handleStripeEvent({ id: `evt_ZZ${Date.now()}orph`, type: "checkout.session.completed", data: { object: { payment_status: "paid", amount_total: 2000, currency: "usd", metadata: { program: "web_gratis" }, customer_details: { email: "x@zz.test" } } } }, pd);
      check("funnel payment without client_reference_id → orphan alert", orphan.handled === "orphan_payment" && alertsSince(n1).some((a) => a.key.startsWith("paid-orphan:")));
      const n2 = alerts.length;
      const other = await site.payments.handleStripeEvent({ id: `evt_ZZ${Date.now()}other`, type: "checkout.session.completed", data: { object: { payment_status: "paid", amount_total: 9900, currency: "usd", mode: "subscription", customer_details: { email: "sofia-deal@zz.test" } } } }, pd);
      check("another product's checkout on the shared Stripe account → ignored, no alert", other.handled === "ignored" && alertsSince(n2).length === 0, { other, a: alertsSince(n2) });
      const cheap = await seed("S link barato", { status: "entregada", delivered_at: iso(new Date(Date.now() - 29 * D)), free_until: site.server.svDate(new Date(), 1) });
      const cheapRes = await site.payments.handleStripeEvent({ id: `evt_ZZ${Date.now()}cheap`, type: "checkout.session.completed", data: { object: { client_reference_id: cheap.id, payment_status: "paid", amount_total: 500, currency: "usd" } } }, pd);
      check("a $5 checkout from another link naming a signup → ignored, NOT activated", cheapRes.handled === "ignored" && (await signup(cheap.id)).status === "entregada" && alertsSince(n2).length === 0, cheapRes);
      const freeRes = await site.payments.handleStripeEvent({ id: `evt_ZZ${Date.now()}free`, type: "checkout.session.completed", data: { object: { client_reference_id: cheap.id, payment_status: "no_payment_required", amount_total: 0, currency: "usd", metadata: { program: "web_gratis" } } } }, pd);
      check("no_payment_required (coupon/trial) → NOT activated, alert for a person", freeRes.handled === "no_charge" && (await signup(cheap.id)).status === "entregada" && alertsSince(n2).some((a) => a.key.startsWith("paid-free:")), freeRes);
      const invOther = await site.payments.handleStripeEvent({ id: `evt_ZZ${Date.now()}invx`, type: "invoice.payment_failed", data: { object: { customer: "cus_ZZnotours", subscription: "sub_ZZnotours", amount_due: 9900, currency: "usd", attempt_count: 1 } } }, pd);
      check("invoice.payment_failed of another subscription → ignored", invOther.handled === "ignored");
      const n3 = alerts.length;
      const invOurs = await site.payments.handleStripeEvent({ id: `evt_ZZ${Date.now()}invp`, type: "invoice.payment_failed", data: { object: { customer: "cus_ZZunknown", amount_due: 2000, currency: "usd", attempt_count: 1, parent: { subscription_details: { subscription: "sub_ZZunknown", metadata: { program: "web_gratis" } } } } } }, pd);
      check("…but one tagged program=web_gratis (new invoice shape) → alert", invOurs.handled === "payment_failed_alert" && alertsSince(n3).some((a) => a.key.startsWith("payfail:")), invOurs);
      const ignored = await site.payments.handleStripeEvent({ id: `evt_ZZ${Date.now()}ign`, type: "customer.created", data: { object: {} } }, pd);
      const { data: igRow } = await db.from("web_gratis_stripe_events").select("status").like("id", "evt_ZZ%ign").single();
      check("unhandled type → ignored + recorded", ignored.handled === "ignored" && igRow?.status === "ignored");
      const late = await seed("S sin ventana", { status: "entregada", delivered_at: iso(new Date(Date.now() - 29 * D)), free_until: site.server.svDate(new Date(), 1), last_inbound_at: iso(new Date(Date.now() - 30 * H)) });
      const lateRes = await site.payments.handleStripeEvent({ id: `evt_ZZ${Date.now()}late`, type: "checkout.session.completed", data: { object: { client_reference_id: late.id, payment_status: "paid", amount_total: 2000, currency: "usd" } } }, pd);
      check("last inbound 30 h ago → no free-form (outside 24 h window)", lateRes.thankYou === "skipped" && (await signup(late.id)).status === "activa");
      check("…and the 💰 alert tells the team to confirm by hand", alertsSince(n1).some((a) => a.key.startsWith("paid:") && a.text.includes(late.business_name) && a.text.includes("NO se le pudo confirmar")));
      check("no referrer → no credit", !(await db.from("web_gratis_referral_credits").select("id").eq("referred_id", late.id).maybeSingle()).data);

      // Paying while the site is paused / still being built.
      const n4 = alerts.length;
      const pausedPayer = await seed("S pausada paga", { status: "pausada", delivered_at: iso(new Date(Date.now() - 40 * D)), free_until: site.server.svDate(new Date(), -8), paused_at: iso(new Date(Date.now() - 5 * D)) });
      await site.payments.handleStripeEvent({ id: `evt_ZZ${Date.now()}psd`, type: "checkout.session.completed", data: { object: { client_reference_id: pausedPayer.id, payment_status: "paid", amount_total: 2000, currency: "usd", metadata: { program: "web_gratis" } } } }, pd);
      const sp = await signup(pausedPayer.id);
      check("paused client pays → activa, paused_at cleared, alert says restore the site", sp.status === "activa" && sp.paused_at === null && alertsSince(n4).some((a) => a.text.includes(pausedPayer.business_name) && a.text.includes("PAUSADA")), sp.status);
      const building = await seed("S paga en construcción", { status: "en_construccion", last_inbound_at: iso(new Date(Date.now() - 1 * H)) });
      const calls1 = mock.calls.length;
      const bRes = await site.payments.handleStripeEvent({ id: `evt_ZZ${Date.now()}bld`, type: "checkout.session.completed", data: { object: { client_reference_id: building.id, payment_status: "paid", amount_total: 2000, currency: "usd", metadata: { program: "web_gratis" } } } }, pd);
      const sb = await signup(building.id);
      check("pays before delivery → stays in 'en_construccion' (build queue), marked paid", bRes.handled === "activated" && sb.status === "en_construccion" && !!sb.activated_at && sb.paid_via === "stripe", sb.status);
      check("…alert: NOT delivered yet, build it", alertsSince(n4).some((a) => a.text.includes(building.business_name) && a.text.includes("AÚN NO está entregada")));
      check("…thank-you doesn't claim the site is live", mock.calls.slice(calls1).some((c) => c.mode === "freeform" && c.text === site.payments.THANK_YOU_BUILDING_TEXT));

      // Referral credit survives a failed first try: a redelivery finds the signup already active.
      const ref2 = await seed("S referidor 2", { status: "activa", activated_at: iso(new Date(Date.now() - 50 * D)), paid_via: "paypal", delivered_at: iso(new Date(Date.now() - 80 * D)), paid_through: site.server.svDate(new Date(), 5) });
      const already = await seed("S ya activa sin crédito", { status: "activa", activated_at: iso(new Date(Date.now() - 60_000)), paid_via: "stripe", referred_by_id: ref2.id, delivered_at: iso(new Date(Date.now() - 30 * D)) });
      await site.payments.handleStripeEvent({ id: `evt_ZZ${Date.now()}redo`, type: "checkout.session.completed", data: { object: { client_reference_id: already.id, payment_status: "paid", amount_total: 2000, currency: "usd", metadata: { program: "web_gratis" } } } }, pd);
      check("already-active signup (credit lost on a failed try) → credit granted on redelivery", !!(await db.from("web_gratis_referral_credits").select("id").eq("referred_id", already.id).maybeSingle()).data);
      const orphanCredit = await seed("S crédito perdido", { status: "activa", activated_at: iso(new Date(Date.now() - 2 * H)), paid_via: "manual", referred_by_id: ref2.id, delivered_at: iso(new Date(Date.now() - 31 * D)) });
      const n5 = alerts.length;
      const granted = await site.payments.reconcileReferralCredits(deps.alert);
      check("cron reconcile grants a credit the board's background step lost", granted >= 1 && !!(await db.from("web_gratis_referral_credits").select("id").eq("referred_id", orphanCredit.id).maybeSingle()).data && alertsSince(n5).some((a) => a.text.startsWith("🤝 REFERIDO ACTIVÓ")), granted);
      check("reconcile is idempotent", (await site.payments.reconcileReferralCredits(deps.alert)) === 0);
    }
  } finally {
    await mock.close();
    console.log(`\nmock Rewired: ${mock.calls.length} signed calls accepted, ${mock.rejectedSignatures} rejected signature(s); alerts captured in-process: ${alerts.length} (none written to the real outbox)`);
  }
}
