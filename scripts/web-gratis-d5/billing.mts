/**
 * Billing checks (2026-09-25, day one of the first real client): the billing
 * timeline (billing.ts), the payment-method gate (Stripe OR PayPal), monthly
 * renewals of PayPal / manual payers (per-cycle idempotency, "Pagó otro mes"
 * opens a new cycle, renewal pause flow), the payments ledger + "💰 PAGO
 * RECIBIDO" alerts, Stripe invoice state, and the daily "💳 COBROS" digest.
 *
 * Fake clock + mocked Rewired, every scheduler / digest / alert run scoped to
 * this run's ZZ rows (onlySignupIds), alerts and digests captured in-process —
 * nothing reaches the real outbox. The one general (unscoped) digest sweep is
 * read-only and captured too: it proves test rows never make it into a digest.
 */
import {
  BRIDGE_SECRET,
  RUN,
  check,
  db,
  messagesOf,
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

const H = 3_600_000;
const D = 24 * H;
const iso = (d: Date) => d.toISOString();
/** A Date for YYYY-MM-DD hh:mm in El Salvador (UTC-6). */
const sv = (date: string, hh: number, mm = 0) => new Date(Date.parse(`${date}T00:00:00Z`) + (hh + 6) * H + mm * 60_000);
const plus = (date: string, days: number): string => site.templates.addDays(date, days);
const FRI = "2026-09-25";
const MON = "2026-09-28";
const TUE = "2026-09-29";
const PAYPAL = "https://paypal.me/MachineMind/19USD";

let clock = sv(MON, 10);
const now = () => new Date(clock.getTime());
const alerts: { key: string; text: string }[] = [];
const alertsSince = (n: number) => alerts.slice(n);
let settings: Settings = { delivery_days: 5, high_demand: false, pay_link: null, demo_link: null, paypal_link: PAYPAL };

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

/** A billing row for the pure timeline checks (no DB). */
function row(over: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-00000000c0de",
    status: "entregada",
    business_name: "Negocio de prueba",
    whatsapp: "+50370000001",
    referral_code: "TSTZZ2",
    delivered_at: null,
    free_until: null,
    activated_at: null,
    paused_at: null,
    paid_via: null,
    paid_through: null,
    declined_at: null,
    opted_out_at: null,
    no_whatsapp_at: null,
    last_payment_at: null,
    billing_issue: null,
    billing_issue_at: null,
    ...over,
  };
}
const msg = (template: string, status: string, at: Date, cycle: string | null = null) => ({
  template,
  status,
  sent_at: ["sent", "delivered", "read"].includes(status) ? iso(at) : null,
  created_at: iso(at),
  next_attempt_at: status === "queued" ? iso(at) : null,
  last_error_code: null,
  cycle,
});

export async function runBilling(): Promise<void> {
  const mock = await startMockRewired(BRIDGE_SECRET);
  const deps = waDeps(mock);
  const run = (ids: string[], opts: Record<string, unknown> = {}) =>
    site.wa.runWhatsAppScheduler(deps, { onlySignupIds: ids, spacingMs: 0, maxSends: 25, deadline: Date.now() + 60_000, ...opts });
  const callsFor = (phone: string) => mock.calls.filter((c) => c.to === phone);
  const timeline = (s: Record<string, unknown>, msgs: Record<string, unknown>[], at: Date, hasPaymentMethod = true) =>
    site.billing.billingTimeline(s, msgs, at, { hasPaymentMethod });

  try {
    // ────────────────────────────────────────────────────────────────────
    section("Billing: calendar helpers + payment-method rule (pure)");
    {
      const instants = [new Date(), sv(MON, 0, 0), new Date(sv(MON, 0, 0).getTime() - 1), sv("2026-12-31", 23, 59), sv("2027-01-01", 0, 1)];
      check("svDay (client-safe) = server svDate for every instant, ±days", instants.every((d) => [-31, -1, 0, 1, 30].every((k) => site.templates.svDay(d, k) === site.server.svDate(d, k))));
      check("formatDateEs / formatDayEs", site.templates.formatDateEs("2026-10-25") === "25 de octubre" && site.templates.formatDayEs(FRI) === "viernes 25 de septiembre");
      const hp = site.templates.hasPaymentMethod;
      check(
        "payment method = Stripe OR PayPal (board link or the default): only 'neither' is none",
        hp({ pay_link: "https://buy.stripe.com/x", paypal_link: null }, null) &&
          hp({ pay_link: null, paypal_link: PAYPAL }, null) &&
          hp({ pay_link: null, paypal_link: null }) &&
          !hp({ pay_link: null, paypal_link: null }, null) &&
          !hp({ pay_link: "  ", paypal_link: "" }, null),
      );
      check(
        "renewal template params: [business, due date in Spanish, /pagar URL] + button = code",
        JSON.stringify(site.templates.templatePayload("cqv_web_renewal", { business_name: "Cabalito sv", referral_code: "VQGZXT", site_url: null }, { cycle: "2026-10-25" })) ===
          JSON.stringify({ bodyParams: ["Cabalito sv", "25 de octubre", "https://machinemindconsulting.com/pagar/VQGZXT"], buttonParam: "VQGZXT" }) &&
          site.templates.templatePayload("cqv_web_renewal", { business_name: "X", referral_code: "VQGZXT", site_url: null }) === null,
      );
      check(
        "payment alert text: '💰 PAGO RECIBIDO — <business> · $19 · PayPal · pagado hasta <fecha>'",
        site.notify.paymentReceivedText({ business: "Cabalito sv", amount: site.notify.amountLabel(null, null), via: "paypal", paidThrough: "2026-11-24" }) ===
          "💰 PAGO RECIBIDO — Cabalito sv · $19 · PayPal · pagado hasta 24 de noviembre",
      );
    }

    // ────────────────────────────────────────────────────────────────────
    section("Billing timeline: a site delivered today (day 1, free_until +30), through the free month");
    {
      const delivered = sv(FRI, 10);
      const free = site.server.svDate(delivered, site.config.FREE_DAYS);
      const base = row({ delivered_at: iso(delivered), free_until: free });
      let t = timeline(base, [], sv(FRI, 11));
      check(
        "delivered today → state free, day 1 of 30, due 2026-10-25, 30 days left",
        free === "2026-10-25" && t.state === "free" && t.day === 1 && t.freeDays === 30 && t.daysLeft === 30 && t.dueDate === free && t.freeUntil === free,
        t,
      );
      check("…next: 'Recordatorio día 28' on Fri 23 Oct (free_until−2), scheduled", t.next?.kind === "reminder_day28" && t.next?.date === "2026-10-23" && t.next?.status === "scheduled" && t.next?.template === "cqv_web_day28", t.next);
      check("…payUrl + monthly", t.payUrl === "https://machinemindconsulting.com/pagar/TSTZZ2" && t.monthly === 19);
      t = timeline(base, [], sv(FRI, 11), false);
      check("no payment method → the reminder is 'held'", t.next?.status === "held", t.next);

      const d28 = msg("cqv_web_day28", "read", sv("2026-10-23", 10));
      t = timeline(base, [d28], sv("2026-10-24", 10));
      check("Sat 24 Oct: due_soon, day 30 of 30, 1 day left", t.state === "due_soon" && t.day === 30 && t.daysLeft === 1, t);
      check("…day-28 in history (read); next 'día 30' moves off Sunday 25 Oct to Mon 26 Oct (like the scheduler)", t.history.some((e) => e.kind === "reminder_day28" && e.status === "read") && t.next?.kind === "reminder_day30" && t.next?.date === "2026-10-26", t);
      t = timeline(base, [d28], sv("2026-10-25", 12));
      check("Sun 25 Oct: due_today, no day number, 0 days left", t.state === "due_today" && t.day === null && t.daysLeft === 0, t);

      const d30 = msg("cqv_web_day30", "delivered", sv("2026-10-26", 10));
      t = timeline(base, [d28, d30], sv("2026-10-27", 10));
      check("Tue 27 Oct unpaid: overdue (−2), next = pause notice today", t.state === "overdue" && t.daysLeft === -2 && t.next?.kind === "pause_notice" && t.next?.date === "2026-10-27", t);
      const notice = msg("cqv_web_pause_notice", "sent", sv("2026-10-27", 10));
      t = timeline(base, [d28, d30, notice], sv("2026-10-27", 11));
      check("…notice sent 10:00 → next = auto-pause Wed 28 Oct (≥ 20 h later, free_until+3)", t.next?.kind === "auto_pause" && t.next?.date === "2026-10-28" && t.next?.status === "scheduled", t.next);
      t = timeline(base, [], sv("2026-10-31", 10));
      check("never asked (reminders never went out) → pause 'held' for a person, missed asks 'skipped'", t.next?.kind === "auto_pause" && t.next?.status === "held" && t.history.filter((e) => e.status === "skipped").length === 3, t);
    }

    // ────────────────────────────────────────────────────────────────────
    section("Billing timeline: PayPal renewals, Stripe state, totals (pure)");
    {
      const payer = (pt: string, over: Record<string, unknown> = {}) =>
        row({ status: "activa", paid_via: "paypal", activated_at: iso(sv(plus(pt, -30), 12)), delivered_at: iso(sv(plus(pt, -60), 9)), free_until: plus(pt, -30), paid_through: pt, ...over });
      let t = timeline(payer(plus(MON, 3)), [], sv(MON, 10));
      check("PayPal payer, paid_through in 3 days → due_soon; next = renewal reminder today", t.state === "due_soon" && t.daysLeft === 3 && t.next?.kind === "renewal_reminder" && t.next?.date === MON && t.next?.template === "cqv_web_renewal", t);
      t = timeline(payer(plus(MON, 3)), [msg("cqv_web_renewal", "read", sv(MON, 10), plus(MON, 3))], sv(MON, 11));
      check("…reminder sent → next = 'Vence la mensualidad' on paid_through", t.next?.kind === "renewal_due" && t.next?.date === plus(MON, 3), t.next);
      t = timeline(payer(MON), [], sv(MON, 10));
      check("paid_through today, unpaid → renewal_due; next = pause notice paid_through+3", t.state === "renewal_due" && t.daysLeft === 0 && t.next?.kind === "pause_notice" && t.next?.date === plus(MON, 3), t);
      t = timeline(payer(plus(MON, 20)), [], sv(MON, 10));
      check("PayPal payer with 20 days left → paid", t.state === "paid" && t.paidThrough === plus(MON, 20) && t.paidVia === "paypal", t.state);
      t = timeline(payer(plus(MON, 2), { free_until: null }), [], sv(MON, 10));
      check("renewal due_soon of a payer with no free month (paid before delivery) → no 'day N of 30'", t.state === "due_soon" && t.day === null, { state: t.state, day: t.day });
      t = timeline(payer(plus(MON, 2), { paid_via: null }), [], sv(MON, 10));
      check("'activa' without a PayPal/manual payer → nothing planned (the scheduler's T8 only renews paypal/manual)", t.state === "paid" && t.next === null, { state: t.state, next: t.next });
      const stripe = (over: Record<string, unknown> = {}) => row({ status: "activa", paid_via: "stripe", activated_at: iso(sv(plus(MON, -10), 12)), paid_through: plus(MON, 20), ...over });
      check(
        "Stripe: paid (next = automatic charge) · failed charge → overdue · cancelled subscription → cancelled",
        timeline(stripe(), [], sv(MON, 10)).state === "paid" &&
          timeline(stripe(), [], sv(MON, 10)).next?.label === "Cobro automático (Stripe)" &&
          timeline(stripe({ billing_issue: "payment_failed" }), [], sv(MON, 10)).state === "overdue" &&
          timeline(stripe({ billing_issue: "subscription_canceled" }), [], sv(MON, 10)).state === "cancelled",
      );
      const failed = timeline(stripe({ billing_issue: "payment_failed" }), [], sv(MON, 10));
      const failedText = site.notify.billingWaText(failed, PAYPAL);
      check("digest WhatsApp text for a failed Stripe charge offers PayPal (a paying client's /pagar has no pay buttons)", failedText.includes(PAYPAL) && !failedText.includes("/pagar/"), failedText);
      const at = sv(MON, 10);
      const set = [
        timeline(row({ delivered_at: iso(sv(plus(MON, -30), 9)), free_until: MON }), [], at),
        timeline(row({ delivered_at: iso(sv(plus(MON, -28), 9)), free_until: plus(MON, 2) }), [], at),
        timeline(row({ delivered_at: iso(sv(plus(MON, -32), 9)), free_until: plus(MON, -2) }), [], at),
        timeline(payer(plus(MON, 2)), [], at),
        timeline(stripe(), [], at),
        timeline(row({ status: "pausada", paused_at: iso(sv(plus(MON, -2), 9)), free_until: plus(MON, -6) }), [], at),
        timeline(payer(plus(MON, -1)), [], at),
      ];
      const sum = site.billing.billingSummary(set, at);
      check(
        "billingSummary: dueToday 1 · dueThisWeek 3 · overdue 2 · paused 1 · paying 3 · MRR $57 · renewalsDue 2",
        sum.dueToday === 1 && sum.dueThisWeek === 3 && sum.overdue === 2 && sum.paused === 1 && sum.paying === 3 && sum.mrr === 57 && sum.renewalsDue === 2,
        sum,
      );
      const added = set.map((t) => site.billing.billingSummary([t], at)).reduce((a, b) => ({
        dueToday: a.dueToday + b.dueToday, dueThisWeek: a.dueThisWeek + b.dueThisWeek, overdue: a.overdue + b.overdue, paused: a.paused + b.paused, paying: a.paying + b.paying, mrr: a.mrr + b.mrr, renewalsDue: a.renewalsDue + b.renewalsDue,
      }));
      check("billingSummary is additive per client (the board sums them)", JSON.stringify(added) === JSON.stringify(sum), { added, sum });
    }

    // ────────────────────────────────────────────────────────────────────
    section("Scheduler: payment asks go out with PayPal only; the 'configure' nag only when there's no method");
    {
      clock = sv(MON, 10);
      settings = { ...settings, pay_link: null, paypal_link: PAYPAL };
      // The rescue (marketing, day 21+) already went out to these, so only payment asks are in play.
      const rescued = (x: { id: string; whatsapp: string }) =>
        db.from("web_gratis_messages").insert({ signup_id: x.id, phone: x.whatsapp, direction: "outbound", template: "cqv_web_rescue", source: "scheduler", status: "read", sent_at: iso(sv(plus(MON, -7), 10)) });
      const p1 = await seed("BP solo paypal", { status: "entregada", delivered_at: iso(sv(plus(MON, -28), 9)), free_until: plus(MON, 2), site_url: "https://zz-bp1.example.com" });
      await rescued(p1);
      let n0 = alerts.length;
      await run([p1.id]);
      const c1 = callsFor(p1.whatsapp);
      check("no Stripe link, PayPal set → day-28 goes out (params [business, /pagar/<code>])", c1.length === 1 && c1[0].template?.name === "cqv_web_day28" && c1[0].template?.bodyParams?.[1] === `https://machinemindconsulting.com/pagar/${p1.referral_code}`, c1);
      check("…and no 'configure' alert", !alertsSince(n0).some((a) => a.key.startsWith("paylink-missing:")), alertsSince(n0));

      const p2 = await seed("BP sin forma de pago", { status: "entregada", delivered_at: iso(sv(plus(MON, -28), 9)), free_until: plus(MON, 2), site_url: "https://zz-bp2.example.com" });
      await rescued(p2);
      settings = { ...settings, pay_link: null, paypal_link: null };
      n0 = alerts.length;
      await run([p2.id], { defaultPaypalLink: null });
      check("neither Stripe nor PayPal → held (no send, no row) + 'Configure el enlace de pago (Stripe o PayPal)' alert", callsFor(p2.whatsapp).length === 0 && !(await templateRow(p2.id, "cqv_web_day28")) && alertsSince(n0).some((a) => a.key === `paylink-missing:${MON}` && a.text.includes("Stripe o PayPal") && a.text.includes("Día 28")), alertsSince(n0));
      n0 = alerts.length;
      await run([p2.id]);
      check("board PayPal link empty but /pagar's default PayPal link exists → it goes out, no nag", callsFor(p2.whatsapp).length === 1 && !alertsSince(n0).some((a) => a.key.startsWith("paylink-missing:")), alertsSince(n0));
      settings = { ...settings, paypal_link: PAYPAL };

      const today = await seed("BP entregada hoy", { status: "entregada", delivered_at: iso(new Date()), free_until: site.server.svDate(new Date(), site.config.FREE_DAYS), site_url: "https://zz-bptoday.example.com" });
      const t = timeline(await signup(today.id), [], new Date());
      const f = site.server.svDate(new Date(), 30);
      check("DB row delivered today (as the board PATCH stamps it) → day 1, due today+30, first reminder on free_until−2 (or −1 past a Sunday)", t.day === 1 && t.dueDate === f && t.daysLeft === 30 && t.next?.kind === "reminder_day28" && [plus(f, -2), plus(f, -1)].includes(t.next?.date ?? ""), t);
    }

    // ────────────────────────────────────────────────────────────────────
    section("Scheduler: PayPal renewals — reminder at paid_through−3, once per cycle, new cycle after 'Pagó otro mes'");
    {
      clock = sv(MON, 10);
      const pt = plus(MON, 3);
      const r = await seed("BR renueva", { status: "activa", paid_via: "paypal", activated_at: iso(sv(plus(pt, -30), 12)), delivered_at: iso(sv(plus(pt, -60), 9)), free_until: plus(pt, -30), paid_through: pt, site_url: "https://zz-br.example.com" });
      await run([r.id]);
      let c = callsFor(r.whatsapp);
      check("paid_through−3 at 10:00 → one cqv_web_renewal", c.length === 1 && c[0].template?.name === "cqv_web_renewal", c.map((x) => x.template?.name));
      check("…params [business, '1 de octubre', /pagar/<code>] + URL button = code", c[0]?.template?.bodyParams?.[1] === site.templates.formatDateEs(pt) && c[0]?.template?.bodyParams?.[2] === `https://machinemindconsulting.com/pagar/${r.referral_code}` && c[0]?.template?.buttonParam === r.referral_code, c[0]);
      const rr = await templateRow(r.id, "cqv_web_renewal", pt);
      check("ledger row: status sent, cycle = paid_through, preview with the due date", rr?.status === "sent" && rr?.cycle === pt && String(rr?.body).includes(site.templates.formatDateEs(pt)), rr);
      let t = timeline(await signup(r.id), await messagesOf(r.id), now());
      check("timeline: due_soon, reminder in history, next = 'Vence la mensualidad'", t.state === "due_soon" && t.history.some((e) => e.kind === "renewal_reminder" && e.status === "sent") && t.next?.kind === "renewal_due", t);
      clock = sv(MON, 10, 5);
      await run([r.id]);
      clock = sv(TUE, 10);
      await run([r.id]);
      check("same cycle: no second reminder (10:05 and the next day)", callsFor(r.whatsapp).length === 1);
      const dup = await db.from("web_gratis_messages").insert({ signup_id: r.id, phone: r.whatsapp, direction: "outbound", template: "cqv_web_renewal", source: "scheduler", status: "queued", cycle: pt });
      check("DB guardrail: a second renewal row for the same cycle → 23505", dup.error?.code === "23505", dup.error);

      // «Pagó otro mes» — exactly what the board PATCH writes.
      const pt2 = plus(pt, 30);
      const touched = new Date().toISOString();
      const { error: renewError } = await db.from("web_gratis_signups").update({ paid_through: pt2, last_touch_at: touched, last_touch_kind: "pago_mes" }).eq("id", r.id);
      const { data: ledger } = await db.from("web_gratis_payments").select("*").eq("signup_id", r.id);
      const s = await signup(r.id);
      check("'Pagó otro mes' → ledger row (paypal, renewal, board, pagado hasta +30, not alerted yet) + last_payment_at", !renewError && (ledger ?? []).length === 1 && ledger?.[0]?.via === "paypal" && ledger?.[0]?.kind === "renewal" && ledger?.[0]?.source === "board" && ledger?.[0]?.paid_through === pt2 && ledger?.[0]?.alerted_at === null && !!s.last_payment_at, { renewError, ledger });
      const { error: creditLike } = await db.from("web_gratis_signups").update({ paid_through: plus(pt2, 30) }).eq("id", r.id);
      const { count: afterCredit } = await db.from("web_gratis_payments").select("id", { count: "exact", head: true }).eq("signup_id", r.id);
      check("a referral credit (paid_through moves, nothing paid) is NOT a payment", !creditLike && afterCredit === 1, afterCredit);
      await db.from("web_gratis_signups").update({ paid_through: pt2 }).eq("id", r.id);

      const n0 = alerts.length;
      const capture = { alert: async (key: string, text: string) => (alerts.push({ key, text }), true) };
      const first = await site.payments.alertNewPayments(capture, { onlySignupIds: [r.id] });
      check(
        "payment alert: '💰 PAGO RECIBIDO — <business> · $19 · PayPal · pagado hasta 31 de octubre' (key payment:<ledger id>)",
        first.alerted === 1 && alertsSince(n0).some((a) => a.key === `payment:${ledger?.[0]?.id}` && a.text.startsWith(`💰 PAGO RECIBIDO — ${r.business_name} · $19 · PayPal · pagado hasta ${site.templates.formatDateEs(pt2)}`) && a.text.includes("Pagó otro mes")),
        alertsSince(n0),
      );
      const second = await site.payments.alertNewPayments(capture, { onlySignupIds: [r.id] });
      const { data: marked } = await db.from("web_gratis_payments").select("alerted_at").eq("signup_id", r.id).single();
      check("…never twice (row marked alerted)", second.alerted === 0 && !!marked?.alerted_at, second);

      clock = sv(plus(pt2, -3), 10);
      await run([r.id]);
      c = callsFor(r.whatsapp);
      const renewals = (await messagesOf(r.id)).filter((m) => m.template === "cqv_web_renewal");
      check("new cycle: a second reminder at the new paid_through−3, with the new date", c.length === 2 && c[1].template?.bodyParams?.[1] === site.templates.formatDateEs(pt2), c.map((x) => x.template?.bodyParams));
      check("…two renewal rows, one per cycle", renewals.length === 2 && renewals.some((m) => m.cycle === pt) && renewals.some((m) => m.cycle === pt2), renewals.map((m) => m.cycle));

      const stripePayer = await seed("BR stripe", { status: "activa", paid_via: "stripe", activated_at: iso(sv(plus(MON, -27), 12)), delivered_at: iso(sv(plus(MON, -57), 9)), paid_through: plus(MON, 3) });
      clock = sv(MON, 10);
      await run([stripePayer.id]);
      check("Stripe subscriber → never a renewal reminder (Stripe renews on its own)", callsFor(stripePayer.whatsapp).length === 0);
    }

    // ────────────────────────────────────────────────────────────────────
    section("Scheduler: renewal unpaid → pause notice at paid_through+3, auto-pause a day later");
    {
      clock = sv(MON, 10);
      const pt = plus(MON, -3);
      const p = await seed("BR no renovó", { status: "activa", paid_via: "paypal", activated_at: iso(sv(plus(pt, -30), 12)), delivered_at: iso(sv(plus(pt, -60), 9)), free_until: plus(pt, -30), paid_through: pt, site_url: "https://zz-brp.example.com" });
      // The free month's pause notice went out weeks ago (cycle null): it must not block the renewal's.
      await db.from("web_gratis_messages").insert({ signup_id: p.id, phone: p.whatsapp, direction: "outbound", template: "cqv_web_pause_notice", source: "scheduler", status: "read", sent_at: iso(sv(plus(pt, -28), 10)) });
      let t = timeline(await signup(p.id), await messagesOf(p.id), now());
      check("paid_through 3 days ago → renewal_due (−3), next = renewal pause notice today", t.state === "renewal_due" && t.daysLeft === -3 && t.next?.kind === "pause_notice" && t.next?.date === MON, t);
      await run([p.id]);
      const c = callsFor(p.whatsapp);
      const noticeRow = await templateRow(p.id, "cqv_web_pause_notice", pt);
      check("paid_through+3 → cqv_web_pause_notice (params [business, /pagar], button) with cycle = paid_through", c.length === 1 && c[0].template?.name === "cqv_web_pause_notice" && c[0].template?.bodyParams?.length === 2 && c[0].template?.buttonParam === p.referral_code && noticeRow?.status === "sent", { c, noticeRow });
      clock = sv(MON, 23);
      await run([p.id]);
      check("13 h later → still active ('se pausa mañana' stays true)", (await signup(p.id)).status === "activa");
      t = timeline(await signup(p.id), await messagesOf(p.id), now());
      check("timeline: next = automatic pause (renewal) tomorrow", t.next?.kind === "renewal_pause" && t.next?.date === TUE, t.next);
      clock = sv(TUE, 7);
      const n0 = alerts.length;
      let r = await run([p.id]);
      const s = await signup(p.id);
      check("21 h after the notice → paused (status, paused_at, recontact +60, auto_pausa)", r.paused === 1 && s.status === "pausada" && !!s.paused_at && s.recontact_after === plus(TUE, 60) && s.last_touch_kind === "auto_pausa", { r, st: s.status });
      check("…alert '⏸ PAUSADA por falta de pago — <business>' (no renovó)", alertsSince(n0).some((a) => a.key === `paused:${p.id}:${TUE}` && a.text.startsWith(`⏸ PAUSADA por falta de pago — ${p.business_name}`) && a.text.includes("no renovó")), alertsSince(n0));
      r = await run([p.id]);
      check("never re-paused / re-alerted", r.paused === 0 && alertsSince(n0).filter((a) => a.key.startsWith(`paused:${p.id}:`)).length === 1);

      clock = sv(MON, 10);
      const gone = await seed("BR no renovó dado de baja", { status: "activa", paid_via: "manual", activated_at: iso(sv(plus(MON, -34), 12)), delivered_at: iso(sv(plus(MON, -64), 9)), paid_through: plus(MON, -4), opted_out_at: iso(sv(plus(MON, -10), 9)) });
      r = await run([gone.id]);
      check("opted-out payer 4 days late → paused without any message", callsFor(gone.whatsapp).length === 0 && (await signup(gone.id)).status === "pausada" && r.paused === 1, r);
    }

    // ────────────────────────────────────────────────────────────────────
    section("Stripe subscribers: invoice.paid → paid state + ledger + alert; failed charge / cancel → state");
    {
      clock = new Date();
      const pd = { now, send: deps.send, alert: deps.alert };
      const pt = site.server.svDate(new Date(), 1);
      const sub = `sub_ZZ${RUN}inv`;
      const cus = `cus_ZZ${RUN}inv`;
      const st = await seed("BS stripe mensual", { status: "activa", paid_via: "stripe", activated_at: iso(new Date(Date.now() - 29 * D)), delivered_at: iso(new Date(Date.now() - 59 * D)), paid_through: pt, stripe_subscription_id: sub, stripe_customer_id: cus });
      const nextEnd = plus(pt, 30);
      const periodEnd = Math.floor(Date.parse(`${nextEnd}T18:00:00Z`) / 1000);
      const inv = `in_ZZ${RUN}1`;
      const n0 = alerts.length;
      const paid = await site.payments.handleStripeEvent(
        { id: `evt_ZZ${Date.now()}invpaid`, type: "invoice.paid", data: { object: { id: inv, customer: cus, subscription: sub, billing_reason: "subscription_cycle", amount_paid: 1900, currency: "usd", lines: { data: [{ period: { start: periodEnd - 30 * 86_400, end: periodEnd } }] } } } },
        pd,
      );
      let s = await signup(st.id);
      const { data: led } = await db.from("web_gratis_payments").select("*").eq("external_id", inv).maybeSingle();
      check("invoice.paid (monthly) → paid_through = the new period's end, ledger row (stripe, renewal, $19.00)", paid.handled === "invoice_paid" && s.paid_through === nextEnd && led?.signup_id === st.id && led?.amount_cents === 1900 && led?.kind === "renewal", { paid, pt: s.paid_through, led });
      check("…'💰 PAGO RECIBIDO — <business> · $19.00 USD · Stripe · pagado hasta <fecha>'", alertsSince(n0).some((a) => a.key === `paid-invoice:${inv}` && a.text.startsWith(`💰 PAGO RECIBIDO — ${st.business_name} · $19.00 USD · Stripe · pagado hasta ${site.templates.formatDateEs(nextEnd)}`)), alertsSince(n0));
      check("…timeline: paid", timeline(s, [], new Date()).state === "paid");
      await site.payments.handleStripeEvent({ id: `evt_ZZ${Date.now()}invfail`, type: "invoice.payment_failed", data: { object: { customer: cus, subscription: sub, amount_due: 1900, currency: "usd", attempt_count: 1 } } }, pd);
      s = await signup(st.id);
      check("invoice.payment_failed → billing_issue payment_failed → timeline overdue (status stays activa)", s.billing_issue === "payment_failed" && s.status === "activa" && timeline(s, [], new Date()).state === "overdue", s.billing_issue);
      await site.payments.handleStripeEvent({ id: `evt_ZZ${Date.now()}subdel2`, type: "customer.subscription.deleted", data: { object: { id: sub, customer: cus } } }, pd);
      s = await signup(st.id);
      check("customer.subscription.deleted → subscription_canceled → timeline cancelled", s.billing_issue === "subscription_canceled" && timeline(s, [], new Date()).state === "cancelled", s.billing_issue);
      const inv2 = `in_ZZ${RUN}2`;
      await site.payments.handleStripeEvent({ id: `evt_ZZ${Date.now()}invpaid2`, type: "invoice.paid", data: { object: { id: inv2, customer: cus, subscription: sub, billing_reason: "subscription_cycle", amount_paid: 1900, currency: "usd", lines: { data: [{ period: { end: periodEnd + 30 * 86_400 } }] } } } }, pd);
      s = await signup(st.id);
      check("a later successful invoice clears the issue → paid", s.billing_issue === null && timeline(s, [], new Date()).state === "paid");
      const otherProduct = await site.payments.handleStripeEvent({ id: `evt_ZZ${Date.now()}invother`, type: "invoice.paid", data: { object: { id: `in_ZZ${RUN}x`, customer: cus, subscription: `sub_ZZ${RUN}other`, billing_reason: "subscription_cycle", amount_paid: 9900, currency: "usd" } } }, pd);
      const tagged = await site.payments.handleStripeEvent({ id: `evt_ZZ${Date.now()}invtag`, type: "invoice.paid", data: { object: { id: `in_ZZ${RUN}t`, customer: cus, billing_reason: "subscription_cycle", amount_paid: 9900, currency: "usd", parent: { subscription_details: { subscription: sub, metadata: { program: "rewired" } } } } } }, pd);
      check("shared Stripe account: same customer's other subscription / another program's invoice → ignored", otherProduct.handled === "ignored" && tagged.handled === "ignored", { otherProduct, tagged });
      const first = await site.payments.handleStripeEvent({ id: `evt_ZZ${Date.now()}invfirst`, type: "invoice.paid", data: { object: { id: `in_ZZ${RUN}0`, customer: cus, subscription: sub, billing_reason: "subscription_create", amount_paid: 1900, currency: "usd" } } }, pd);
      const { count: ledN } = await db.from("web_gratis_payments").select("id", { count: "exact", head: true }).eq("signup_id", st.id);
      check("the subscription's first invoice (the checkout already counted it) → no second ledger row / alert", first.handled === "invoice_first" && ledN === 2, { first, ledN });

      // Same customer, other things on the shared Stripe account: never the plan's state.
      const n1 = alerts.length;
      const oneOff = await site.payments.handleStripeEvent({ id: `evt_ZZ${Date.now()}invoneoff`, type: "invoice.paid", data: { object: { id: `in_ZZ${RUN}oneoff`, customer: cus, billing_reason: "manual", amount_paid: 4900, currency: "usd", lines: { data: [{ period: { end: periodEnd + 90 * 86_400 } }] } } } }, pd);
      const otherFail = await site.payments.handleStripeEvent({ id: `evt_ZZ${Date.now()}failother`, type: "invoice.payment_failed", data: { object: { customer: cus, subscription: `sub_ZZ${RUN}other`, amount_due: 9900, currency: "usd", attempt_count: 1 } } }, pd);
      const otherDel = await site.payments.handleStripeEvent({ id: `evt_ZZ${Date.now()}delother`, type: "customer.subscription.deleted", data: { object: { id: `sub_ZZ${RUN}other`, customer: cus } } }, pd);
      s = await signup(st.id);
      const { count: ledAfter } = await db.from("web_gratis_payments").select("id", { count: "exact", head: true }).eq("signup_id", st.id);
      check(
        "same customer's one-off invoice / other subscription failing or ending → ignored: no ledger row, no billing_issue, no alert, paid_through kept",
        oneOff.handled === "ignored" && otherFail.handled === "ignored" && otherDel.handled === "ignored" && ledAfter === 2 && s.billing_issue === null && s.paid_through === plus(nextEnd, 30) && alertsSince(n1).length === 0,
        { oneOff, otherFail, otherDel, ledAfter, issue: s.billing_issue, pt: s.paid_through, a: alertsSince(n1) },
      );
      const declined = await site.payments.handleStripeEvent({ id: `evt_ZZ${Date.now()}faildecl`, type: "invoice.payment_failed", data: { object: { customer: cus, subscription: sub, billing_reason: "subscription_create", amount_due: 1900, currency: "usd", attempt_count: 1 } } }, pd);
      s = await signup(st.id);
      check("a card declined on the subscription's first charge → alert for a person, but the paying client is NOT marked overdue", declined.handled === "payment_failed_alert" && s.billing_issue === null && alertsSince(n1).some((a) => a.key.startsWith("payfail:") && a.text.includes("primer cobro")), { declined, issue: s.billing_issue });
      clock = sv(MON, 10);
    }

    // ────────────────────────────────────────────────────────────────────
    section("Daily '💳 COBROS' digest: 08:00 SV, once a day, only with news, never test rows in a general sweep");
    {
      clock = sv(MON, 8, 5);
      const d1 = await seed("BD vence hoy", { status: "entregada", delivered_at: iso(sv(plus(MON, -30), 9)), free_until: MON, site_url: "https://zz-bd1.example.com" });
      const d2 = await seed("BD en dos dias", { status: "compartida", delivered_at: iso(sv(plus(MON, -28), 9)), free_until: plus(MON, 2), site_url: "https://zz-bd2.example.com" });
      const d3 = await seed("BD vencido", { status: "entregada", delivered_at: iso(sv(plus(MON, -32), 9)), free_until: plus(MON, -2) });
      const d4 = await seed("BD renovacion paypal", { status: "activa", paid_via: "paypal", activated_at: iso(sv(plus(MON, -28), 12)), delivered_at: iso(sv(plus(MON, -58), 9)), paid_through: plus(MON, 2) });
      const d5 = await seed("BD pausada", { status: "pausada", delivered_at: iso(sv(plus(MON, -40), 9)), free_until: plus(MON, -8), paused_at: iso(sv(MON, 6)) });
      const d6 = await seed("BD pago ayer", { status: "activa", paid_via: "paypal", activated_at: iso(sv(plus(MON, -40), 12)), delivered_at: iso(sv(plus(MON, -70), 9)), paid_through: plus(MON, 29) });
      const d7 = await seed("BD stripe al dia", { status: "activa", paid_via: "stripe", activated_at: iso(sv(plus(MON, -10), 12)), delivered_at: iso(sv(plus(MON, -40), 9)), paid_through: plus(MON, 20) });
      await db.from("web_gratis_payments").insert({ signup_id: d6.id, paid_at: iso(sv(plus(MON, -1), 15)), via: "paypal", kind: "renewal", paid_through: plus(MON, 29), source: "board", alerted_at: iso(new Date()) });
      const ids = [d1, d2, d3, d4, d5, d6, d7].map((x) => x.id);

      const digests: { key: string; part: { html: string; text: string; subject: string | null; emailHtml: string | null } }[] = [];
      const bdeps = {
        now,
        alert: deps.alert,
        digest: async (key: string, part: { html: string; text: string; subject: string | null; emailHtml: string | null }) => (digests.push({ key, part }), true),
        alreadyQueued: async (key: string) => digests.some((d) => d.key === key),
        settings: async () => settings,
      };
      clock = sv(MON, 7, 59);
      let rep = await site.payments.runCobrosDigest(bdeps, { onlySignupIds: ids });
      check("07:59 SV → no digest yet", !rep.ran && rep.reason === "not_digest_hour" && digests.length === 0, rep);
      clock = sv(MON, 8, 5);
      rep = await site.payments.runCobrosDigest(bdeps, { onlySignupIds: ids });
      const html = digests.map((d) => d.part.html).join("\n");
      const sentParts = digests.length;
      check(
        "08:05 SV → the digest under key cobros:<SV date> (extra parts cobros:<date>:N), first part e-mailed with the whole digest",
        rep.ran && sentParts === rep.parts && sentParts >= 1 && digests[0].key === `cobros:${MON}` && digests.slice(1).every((d, k) => d.key === `cobros:${MON}:${k + 2}` && d.part.subject === null) &&
          digests[0].part.subject === "💳 COBROS — lunes 28 de septiembre" && [d1, d2, d3, d4, d5, d6].every((x) => String(digests[0].part.emailHtml).includes(x.business_name)),
        { rep, keys: digests.map((d) => d.key) },
      );
      check(
        "sections: vencen hoy · 1–3 días (día 29/30) · vencidos · renovaciones PayPal · pausadas · pagos de ayer",
        html.includes("Vencen hoy (1)") && html.includes(d1.business_name) &&
          html.includes("Vencen en 1–3 días (1)") && html.includes(d2.business_name) && html.includes("día 29/30") &&
          html.includes("Vencidos sin pago (1)") && html.includes(d3.business_name) &&
          html.includes("Renovaciones PayPal próximas (1)") && html.includes(d4.business_name) &&
          html.includes("Pausadas por falta de pago (1)") && html.includes(d5.business_name) &&
          html.includes("Pagos recibidos ayer (1)") && html.includes(d6.business_name) &&
          !html.includes(d7.business_name),
        html,
      );
      check("one-line total: pagando 3 · MRR $57 · vencen esta semana 3", html.includes("Total: pagando 3 · MRR $57 · vencen esta semana 3"), html.match(/Total:[^<]*/)?.[0]);
      check("each client: wa.me link with a polite prefilled payment message + /pagar/<code>", html.includes(`https://wa.me/${d1.whatsapp.replace(/\D/g, "")}?text=`) && html.includes(encodeURIComponent("Le saluda MachineMind")) && html.includes(`/pagar/${d1.referral_code}`), html.slice(0, 600));
      check("every part fits one Telegram message", digests.every((d) => d.part.html.length <= 4096));
      rep = await site.payments.runCobrosDigest(bdeps, { onlySignupIds: ids });
      check("second run the same day → already sent, nothing new", rep.reason === "already_sent" && digests.length === sentParts, rep);

      const quiet = await seed("BD sin novedades", { status: "activa", paid_via: "stripe", activated_at: iso(sv(plus(MON, -5), 12)), paid_through: plus(MON, 25) });
      const quietDigests: unknown[] = [];
      rep = await site.payments.runCobrosDigest({ ...bdeps, digest: async (_k: string, p: unknown) => (quietDigests.push(p), true), alreadyQueued: async () => false }, { onlySignupIds: [quiet.id] });
      check("nothing to report → no digest", rep.reason === "nothing_to_report" && quietDigests.length === 0, rep);

      // Paid before delivery (Stripe keeps the build status): paying on the board, so paying in the digest total too.
      const early = await seed("BD pago antes de entrega", { status: "en_construccion", paid_via: "stripe", activated_at: iso(sv(plus(MON, -2), 12)), paid_through: plus(MON, 28) });
      const earlyDigests: { html: string }[] = [];
      rep = await site.payments.runCobrosDigest({ ...bdeps, digest: async (_k: string, p: { html: string }) => (earlyDigests.push(p), true), alreadyQueued: async () => false }, { onlySignupIds: [d1.id, early.id] });
      check("digest total counts a client who paid before delivery (same set as the board's «Cobros»)", rep.considered === 2 && earlyDigests.some((p) => p.html.includes("Total: pagando 1 · MRR $19")), { rep, total: earlyDigests.map((p) => p.html.match(/Total:[^<]*/)?.[0]) });

      const general: { key: string; part: { html: string; text: string } }[] = [];
      rep = await site.payments.runCobrosDigest({ ...bdeps, digest: async (key: string, part: { html: string; text: string }) => (general.push({ key, part }), true), alreadyQueued: async () => false });
      check("general sweep (the live cron) leaves every test row out", rep.testRowsExcluded >= 8 && general.every((g) => !g.part.html.includes("ZZ ") && !g.part.text.includes("ZZ ")), { excluded: rep.testRowsExcluded, reason: rep.reason, parts: general.length });
      check("outbox lookup for the once-a-day key is read-only and works", (await site.outbox.outboxHasKey(`cobros:zz-never-${RUN}`)) === false);

      // A very long day never truncates: every client lands in exactly one part.
      const many = Array.from({ length: 140 }, (_, k) =>
        timeline(row({ id: `00000000-0000-4000-8000-${String(k).padStart(12, "0")}`, business_name: `Cliente largo ${k}`, referral_code: "TSTZZ2", delivered_at: iso(sv(plus(MON, -28), 9)), free_until: plus(MON, 2) }), [], sv(MON, 8)),
      );
      const parts = site.notify.cobrosDigestMessages({ day: MON, dueToday: [], dueSoon: many, overdue: [], renewals: [], paused: [], paymentsYesterday: [], totals: { paying: 0, mrr: 0, dueThisWeek: 140 }, paypalLink: PAYPAL });
      const found = many.map((t) => parts.filter((p) => p.html.includes(`<b>${t.business}</b>`)).length);
      check("140 clients → several parts ≤ 4096 chars, each client in exactly one (never truncated)", parts.length > 1 && parts.every((p) => p.html.length <= 4096) && found.every((n) => n === 1) && parts[0].subject !== null && parts.slice(1).every((p) => p.subject === null), { parts: parts.length, lens: parts.map((p) => p.html.length) });
      clock = sv(MON, 10);
    }
  } finally {
    await mock.close();
    console.log(`\nbilling: mock Rewired ${mock.calls.length} signed calls; alerts captured in-process: ${alerts.length} (none written to the real outbox)`);
  }
}
