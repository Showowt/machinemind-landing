/**
 * Free-website funnel — the billing timeline: when each client's payment is
 * due and what the scheduler will do about it.
 *
 * ONE source for the ops board ("Cobros"), the CSV export and the team's daily
 * "💳 COBROS" digest. Pure (no DB, no network, no clock of its own): the same
 * inputs always give the same timeline. Every date rule comes from the payment
 * calendar in templates.ts (FREE_MONTH_FLOW, RENEWAL_FLOW, nextSendDay,
 * pauseDecision) that the WhatsApp scheduler itself runs on, so "próximo
 * recordatorio el 23 oct" is exactly when the cron will send it.
 *
 * The offer: the site is free for FREE_DAYS from delivery (free_until), then
 * MONTHLY_PRICE_USD a month — Stripe (a subscription that renews on its own) or
 * PayPal / cash (one month at a time: paid_through, renewed from the board).
 *
 * Day N of the free month is 1-based from the delivery day: delivered today =
 * day 1, and free_until (delivery + FREE_DAYS) is the first day that is due.
 * All dates are El Salvador calendar days (YYYY-MM-DD).
 *
 * Client-safe: imported by the board (types) and server routes; the server row
 * type is a type-only import.
 */
import { FREE_DAYS, MONTHLY_PRICE_USD, payUrl } from "./config";
import type { WebGratisSignup } from "./server";
import {
  addDays,
  daysBetween,
  DUE_SOON_DAYS,
  FREE_MONTH_FLOW,
  isHoldCode,
  nextSendDay,
  PAUSE_AFTER_ASK_HOURS,
  pauseDecision,
  REACHED_STATUSES,
  RENEWAL_FLOW,
  svDay,
  TEMPLATE_WINDOW,
  type PaymentFlow,
  type TemplateName,
} from "./templates";

// ─── Contract ───────────────────────────────────────────────────────────────

export type BillingState = "building" | "free" | "due_soon" | "due_today" | "overdue" | "paused" | "paid" | "renewal_due" | "cancelled";

export interface BillingEvent {
  /** YYYY-MM-DD in SV time. */
  date: string;
  kind: "reminder_day28" | "reminder_day30" | "pause_notice" | "auto_pause" | "renewal_reminder" | "renewal_due" | "renewal_pause" | "payment";
  /** Spanish, e.g. "Recordatorio día 28". */
  label: string;
  template: string | null;
  /**
   * Message events: the ledger row's status ("held" = queued behind a system
   * hold, e.g. template not approved yet). Planned events: "scheduled", or
   * "held" when it can't go out yet (no payment method; a client never asked
   * to pay isn't paused automatically). Non-message events that already
   * happened (a payment, a pause) are "sent"; an ask whose days passed without
   * going out is "skipped".
   */
  status: "scheduled" | "queued" | "sent" | "delivered" | "read" | "failed" | "skipped" | "held";
}

export interface BillingTimeline {
  signupId: string;
  business: string;
  code: string;
  whatsapp: string;
  state: BillingState;
  /** Day N of the free month, 1-based (delivery day = 1); null outside it. */
  day: number | null;
  freeDays: number;
  freeUntil: string | null;
  paidThrough: string | null;
  paidVia: string | null;
  dueDate: string | null;
  /** Negative = overdue. */
  daysLeft: number | null;
  next: BillingEvent | null;
  history: BillingEvent[];
  payUrl: string;
  monthly: number;
}

// ─── Inputs ─────────────────────────────────────────────────────────────────

/**
 * The signup columns the timeline reads — a full row (select("*")) fits. The
 * billing columns of migration 20260929 are optional so a row type that
 * doesn't list them yet still compiles.
 */
export type BillingSignup = Pick<
  WebGratisSignup,
  | "id"
  | "status"
  | "business_name"
  | "whatsapp"
  | "referral_code"
  | "delivered_at"
  | "free_until"
  | "activated_at"
  | "paused_at"
  | "paid_via"
  | "paid_through"
  | "declined_at"
  | "opted_out_at"
  | "no_whatsapp_at"
> & {
  /** Latest recorded payment (payments ledger trigger / Stripe webhook). */
  last_payment_at?: string | null;
  /** Stripe subscription trouble: "payment_failed" | "subscription_canceled". */
  billing_issue?: string | null;
  billing_issue_at?: string | null;
};

/** A template row of web_gratis_messages (a full MessageRow fits). */
export interface BillingMessage {
  template: string | null;
  status: string;
  sent_at: string | null;
  created_at: string;
  next_attempt_at?: string | null;
  last_error_code?: string | null;
  /**
   * Renewal cycle the row belongs to (the paid_through date it asks about);
   * null = the free month. Undefined (column not loaded) → inferred.
   */
  cycle?: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const LIVE_FREE: readonly string[] = ["entregada", "compartida"];
const BUILDING: readonly string[] = ["borrador", "nuevo", "en_construccion"];
const PAYPAL_LIKE: readonly string[] = ["paypal", "manual"];
const PENDING: readonly BillingEvent["status"][] = ["scheduled", "queued", "held"];

const VIA_LABEL: Record<string, string> = { stripe: "Stripe", paypal: "PayPal", manual: "a mano" };

const KIND_ORDER: Record<BillingEvent["kind"], number> = {
  payment: 0,
  renewal_reminder: 1,
  reminder_day28: 2,
  reminder_day30: 3,
  renewal_due: 4,
  pause_notice: 5,
  auto_pause: 6,
  renewal_pause: 7,
};

const dayOf = (iso: string) => svDay(new Date(iso));
const maxDate = (...dates: string[]) => dates.reduce((a, b) => (b > a ? b : a));

function eventStatus(m: BillingMessage): BillingEvent["status"] {
  switch (m.status) {
    case "queued":
      return isHoldCode(m.last_error_code) ? "held" : "queued";
    case "sent":
    case "delivered":
    case "read":
    case "failed":
    case "skipped":
      return m.status;
    default:
      return "sent";
  }
}

function isPending(m: BillingMessage): boolean {
  return m.status === "queued";
}

function reached(m: BillingMessage): boolean {
  return REACHED_STATUSES.includes(m.status) && !!m.sent_at;
}

/** Date shown for a message row: when it went out, or when it will (queued), or when it was created. */
function messageDate(m: BillingMessage, today: string): string {
  if (m.sent_at) return dayOf(m.sent_at);
  if (isPending(m)) return maxDate(today, m.next_attempt_at ? dayOf(m.next_attempt_at) : today);
  return dayOf(m.created_at);
}

function messageEvent(m: BillingMessage, kind: BillingEvent["kind"], label: string, today: string): BillingEvent {
  return { date: messageDate(m, today), kind, label, template: m.template, status: eventStatus(m) };
}

/** The latest row of a template in a list (by creation). */
function latest(list: BillingMessage[], template: TemplateName): BillingMessage | undefined {
  let found: BillingMessage | undefined;
  for (const m of list) if (m.template === template && (!found || m.created_at >= found.created_at)) found = m;
  return found;
}

function latestSent(list: BillingMessage[]): string | null {
  let at: string | null = null;
  for (const m of list) if (reached(m) && (!at || (m.sent_at as string) > at)) at = m.sent_at as string;
  return at;
}

/** Cycle of a row when the caller didn't load the column (the board's short log). */
function inferCycle(m: BillingMessage, s: BillingSignup): string | null {
  if (m.cycle !== undefined) return m.cycle;
  if (m.template === "cqv_web_renewal") return s.paid_through ?? null;
  if (m.template === "cqv_web_pause_notice" && s.activated_at && messageDateRaw(m) >= dayOf(s.activated_at)) return s.paid_through ?? null;
  return null;
}

function messageDateRaw(m: BillingMessage): string {
  return dayOf(m.sent_at ?? m.created_at);
}

interface FlowSpec {
  flow: PaymentFlow;
  due: string;
  /** Rows of this flow's cycle. */
  rows: BillingMessage[];
  messageable: boolean;
  asks: { template: TemplateName; kind: BillingEvent["kind"]; label: string; range: readonly [number, number] }[];
  pauseKind: "auto_pause" | "renewal_pause";
  pauseLabel: string;
}

/**
 * The flow's asks (sent rows → history, the rest planned exactly as the
 * scheduler will send them) and the predicted auto-pause.
 */
function planFlow(spec: FlowSpec, now: Date, hasPaymentMethod: boolean, history: BillingEvent[], planned: BillingEvent[]): void {
  const today = svDay(now);
  const { flow, due } = spec;
  let noticeDay: string | null = null;
  let noticeImpossible = false;
  let noticeReachedAt: string | null = null;

  for (const ask of spec.asks) {
    const row = latest(spec.rows, ask.template);
    const isNotice = ask.template === "cqv_web_pause_notice";
    if (row) {
      const ev = messageEvent(row, ask.kind, ask.label, today);
      (PENDING.includes(ev.status) ? planned : history).push(ev);
      if (isNotice) {
        if (reached(row)) noticeReachedAt = row.sent_at;
        else if (isPending(row)) noticeDay = ev.date;
        else noticeImpossible = true; // failed / skipped: the row exists, the scheduler won't make another
      }
      continue;
    }
    const from = addDays(due, ask.range[0]);
    const to = addDays(due, ask.range[1]);
    const day = spec.messageable ? nextSendDay(TEMPLATE_WINDOW[ask.template], from, to, now) : null;
    if (day) {
      planned.push({ date: day, kind: ask.kind, label: ask.label, template: ask.template, status: hasPaymentMethod ? "scheduled" : "held" });
      if (isNotice) noticeDay = day;
    } else {
      if (spec.messageable && today >= from) {
        history.push({ date: to, kind: ask.kind, label: ask.label, template: ask.template, status: "skipped" });
      }
      if (isNotice) noticeImpossible = true;
    }
  }

  // Predicted auto-pause (never before due + pauseFrom).
  const floor = maxDate(today, addDays(due, flow.pauseFrom));
  const pause = (date: string, status: BillingEvent["status"]) =>
    planned.push({ date, kind: spec.pauseKind, label: spec.pauseLabel, template: null, status });
  const lastAskAt = latestSent(spec.rows);
  const graceDay = addDays(due, flow.graceOver);
  const afterAsk = (at: string) => dayOf(new Date(Date.parse(at) + PAUSE_AFTER_ASK_HOURS * 3_600_000).toISOString());

  if (!spec.messageable || noticeReachedAt) {
    // Exactly the scheduler's rule once it's a candidate.
    const decision = pauseDecision(flow, { due, messageable: spec.messageable, noticeSentAt: noticeReachedAt, lastAskAt }, now);
    if (decision.action === "pause") pause(today, "scheduled");
    else if (decision.action === "wait" && !spec.messageable) pause(floor, "scheduled");
    else if (noticeReachedAt) pause(maxDate(floor, afterAsk(noticeReachedAt)), "scheduled");
    return;
  }
  if (noticeDay && !noticeImpossible) {
    // The notice goes out on noticeDay (09:00–15:59) → paused about 20 h later, the next day.
    const byNotice = maxDate(floor, addDays(noticeDay, 1));
    if (byNotice <= graceDay) {
      pause(byNotice, hasPaymentMethod ? "scheduled" : "held");
      return;
    }
  }
  // The notice can't go out (in time): paused at the end of the grace if an earlier ask reached them.
  if (lastAskAt) pause(maxDate(floor, graceDay, afterAsk(lastAskAt)), "scheduled");
  else pause(maxDate(floor, graceDay), "held");
}

function viaLabel(via: string | null | undefined): string {
  return via ? (VIA_LABEL[via] ?? via) : "pago";
}

// ─── The timeline ───────────────────────────────────────────────────────────

export function billingTimeline(
  signup: BillingSignup,
  messages: readonly BillingMessage[],
  now: Date,
  opts: { hasPaymentMethod: boolean },
): BillingTimeline {
  const s = signup;
  const today = svDay(now);
  const status: string = s.status;
  const paidVia = s.paid_via ?? null;
  const deliveredDay = s.delivered_at ? dayOf(s.delivered_at) : null;
  const freeUntil = s.free_until ?? null;
  const span = deliveredDay && freeUntil ? daysBetween(deliveredDay, freeUntil) : 0;
  const freeDays = span > 0 ? span : FREE_DAYS;
  const paidThrough = s.paid_through ?? null;
  const issue = s.billing_issue ?? null;

  const billingRows = messages.filter((m) => !!m.template && (m.template === "cqv_web_renewal" || m.template === "cqv_web_day28" || m.template === "cqv_web_day30" || m.template === "cqv_web_pause_notice"));
  const freeRows = billingRows.filter((m) => inferCycle(m, s) === null && m.template !== "cqv_web_renewal");
  const cycleRows = (cycle: string) => billingRows.filter((m) => inferCycle(m, s) === cycle);

  let state: BillingState;
  let dueDate: string | null = null;
  let flow: "free" | "renewal" | null = null;
  /** Live, unpaid, in (or just past) the free month: the only place "day N" means anything. */
  let freeMonth = false;

  if (status === "cancelada" || status === "descartada") {
    state = "cancelled";
  } else if (status === "pausada") {
    state = "paused";
    dueDate = s.activated_at ? (paidThrough ?? freeUntil) : freeUntil;
  } else if (BUILDING.includes(status)) {
    state = s.activated_at ? "paid" : "building";
    dueDate = s.activated_at ? paidThrough : null;
  } else if (status === "activa") {
    if (paidVia === "stripe") {
      state = issue === "subscription_canceled" ? "cancelled" : issue === "payment_failed" ? "overdue" : "paid";
      dueDate = paidThrough;
    } else if (!paidThrough || !paidVia || !PAYPAL_LIKE.includes(paidVia)) {
      // The scheduler only renews PayPal / manual payers with a "pagado hasta" (T8): nothing to plan.
      state = "paid";
      dueDate = paidThrough;
    } else {
      const left = daysBetween(today, paidThrough);
      state = left > DUE_SOON_DAYS ? "paid" : left > 0 ? "due_soon" : "renewal_due";
      dueDate = paidThrough;
      flow = "renewal";
    }
  } else if (LIVE_FREE.includes(status) && !s.activated_at) {
    freeMonth = true;
    if (!freeUntil) {
      state = "free";
    } else {
      const left = daysBetween(today, freeUntil);
      state = left > DUE_SOON_DAYS ? "free" : left > 0 ? "due_soon" : left === 0 ? "due_today" : "overdue";
      dueDate = freeUntil;
      flow = "free";
    }
  } else {
    // Delivered and paid but not flipped to 'activa' (shouldn't happen): it's paying.
    state = "paid";
    dueDate = paidThrough;
  }

  const daysLeft = dueDate ? daysBetween(today, dueDate) : null;
  // Only inside the free month: a PayPal payer's renewal "due_soon" (or a payer with no free_until,
  // e.g. paid before delivery) is not "day 61 of 30".
  const day =
    freeMonth && (state === "free" || state === "due_soon") && deliveredDay && (!freeUntil || today < freeUntil)
      ? Math.max(1, daysBetween(deliveredDay, today) + 1)
      : null;

  const history: BillingEvent[] = [];
  const planned: BillingEvent[] = [];

  // Payments (first activation, latest payment) and a pause that already happened.
  if (s.activated_at) {
    history.push({ date: dayOf(s.activated_at), kind: "payment", label: `Pago recibido (${viaLabel(paidVia)})`, template: null, status: "sent" });
  }
  if (s.last_payment_at && (!s.activated_at || dayOf(s.last_payment_at) !== dayOf(s.activated_at))) {
    history.push({ date: dayOf(s.last_payment_at), kind: "payment", label: `Pago recibido (${viaLabel(paidVia)})`, template: null, status: "sent" });
  }
  if (status === "pausada" && s.paused_at) {
    const renewalPause = !!s.activated_at;
    history.push({
      date: dayOf(s.paused_at),
      kind: renewalPause ? "renewal_pause" : "auto_pause",
      label: renewalPause ? "Pausada (no renovó)" : "Pausada (no activó)",
      template: null,
      status: "sent",
    });
  }

  // Every billing message ever sent, including past cycles; the current flow's are planned below.
  const currentCycle = flow === "renewal" ? paidThrough : null;
  for (const m of billingRows) {
    const cycle = inferCycle(m, s);
    const inCurrent = flow === "free" ? cycle === null && m.template !== "cqv_web_renewal" : flow === "renewal" ? cycle === currentCycle : false;
    if (inCurrent) continue;
    const renewal = cycle !== null || m.template === "cqv_web_renewal";
    const kind: BillingEvent["kind"] =
      m.template === "cqv_web_renewal"
        ? "renewal_reminder"
        : m.template === "cqv_web_day28"
          ? "reminder_day28"
          : m.template === "cqv_web_day30"
            ? "reminder_day30"
            : "pause_notice";
    const label =
      kind === "renewal_reminder"
        ? `Recordatorio de renovación${cycle ? ` (vence ${cycle})` : ""}`
        : kind === "reminder_day28"
          ? "Recordatorio día 28"
          : kind === "reminder_day30"
            ? "Recordatorio día 30"
            : renewal
              ? "Aviso de pausa (renovación)"
              : "Aviso de pausa";
    const ev = messageEvent(m, kind, label, today);
    history.push(ev.status === "queued" || ev.status === "held" ? { ...ev, status: "skipped" } : ev);
  }

  if (flow === "free" && dueDate) {
    planFlow(
      {
        flow: FREE_MONTH_FLOW,
        due: dueDate,
        rows: freeRows,
        messageable: !s.opted_out_at && !s.no_whatsapp_at && !s.declined_at,
        asks: [
          { template: "cqv_web_day28", kind: "reminder_day28", label: "Recordatorio día 28", range: FREE_MONTH_FLOW.ask },
          { template: "cqv_web_day30", kind: "reminder_day30", label: "Recordatorio día 30", range: FREE_MONTH_FLOW.dueAsk ?? [0, 1] },
          { template: "cqv_web_pause_notice", kind: "pause_notice", label: "Aviso de pausa", range: FREE_MONTH_FLOW.notice },
        ],
        pauseKind: "auto_pause",
        pauseLabel: "Pausa automática",
      },
      now,
      opts.hasPaymentMethod,
      history,
      planned,
    );
  } else if (flow === "renewal" && dueDate) {
    const paidSince = s.last_payment_at ?? s.activated_at ?? "";
    const declinedThisCycle = !!s.declined_at && s.declined_at > paidSince;
    if (dueDate > today) {
      planned.push({ date: dueDate, kind: "renewal_due", label: "Vence la mensualidad", template: null, status: "scheduled" });
    }
    planFlow(
      {
        flow: RENEWAL_FLOW,
        due: dueDate,
        rows: cycleRows(dueDate),
        messageable: !s.opted_out_at && !s.no_whatsapp_at && !declinedThisCycle,
        asks: [
          { template: "cqv_web_renewal", kind: "renewal_reminder", label: "Recordatorio de renovación", range: RENEWAL_FLOW.ask },
          { template: "cqv_web_pause_notice", kind: "pause_notice", label: "Aviso de pausa (renovación)", range: RENEWAL_FLOW.notice },
        ],
        pauseKind: "renewal_pause",
        pauseLabel: "Pausa automática (no renovó)",
      },
      now,
      opts.hasPaymentMethod,
      history,
      planned,
    );
  } else if (status === "activa" && paidVia === "stripe" && state === "paid" && paidThrough && paidThrough >= today) {
    planned.push({ date: paidThrough, kind: "payment", label: "Cobro automático (Stripe)", template: null, status: "scheduled" });
  }

  const byDate = (a: BillingEvent, b: BillingEvent) => (a.date === b.date ? KIND_ORDER[a.kind] - KIND_ORDER[b.kind] : a.date < b.date ? -1 : 1);
  history.sort(byDate);
  planned.sort(byDate);

  return {
    signupId: s.id,
    business: s.business_name,
    code: s.referral_code,
    whatsapp: s.whatsapp,
    state,
    day,
    freeDays,
    freeUntil,
    paidThrough,
    paidVia,
    dueDate,
    daysLeft,
    next: planned[0] ?? null,
    history,
    payUrl: payUrl(s.referral_code),
    monthly: MONTHLY_PRICE_USD,
  };
}

// ─── Totals ─────────────────────────────────────────────────────────────────

/**
 * Counters for the board chips and the digest's total line. Additive per
 * client (the board sums billingSummary([t]) of each):
 *   dueToday     — the free month or a PayPal/manual month ends today;
 *   dueThisWeek  — something unpaid (not Stripe) comes due in the next 7 days;
 *   overdue      — free month over, PayPal month lapsed or Stripe charge failed, not paused yet;
 *   paused       — paused sites;
 *   paying / mrr — clients who pay (any method), not paused or cancelled;
 *   renewalsDue  — PayPal/manual payers whose month ends within DUE_SOON_DAYS or already ended.
 */
export function billingSummary(
  timelines: BillingTimeline[],
  now: Date,
): { dueToday: number; dueThisWeek: number; overdue: number; paused: number; paying: number; mrr: number; renewalsDue: number } {
  const today = svDay(now);
  const weekEnd = addDays(today, 6);
  const out = { dueToday: 0, dueThisWeek: 0, overdue: 0, paused: 0, paying: 0, mrr: 0, renewalsDue: 0 };
  for (const t of timelines) {
    const open = t.state !== "paused" && t.state !== "cancelled" && t.state !== "building";
    if (t.dueDate === today && (t.state === "due_today" || t.state === "renewal_due")) out.dueToday++;
    if (open && t.dueDate && t.paidVia !== "stripe" && t.dueDate >= today && t.dueDate <= weekEnd) out.dueThisWeek++;
    if (t.state === "overdue" || (t.state === "renewal_due" && (t.daysLeft ?? 0) < 0)) out.overdue++;
    if (t.state === "paused") out.paused++;
    if (t.paidVia && t.state !== "paused" && t.state !== "cancelled") {
      out.paying++;
      out.mrr += t.monthly;
    }
    if (t.paidVia && PAYPAL_LIKE.includes(t.paidVia) && (t.state === "due_soon" || t.state === "renewal_due")) out.renewalsDue++;
  }
  return out;
}
