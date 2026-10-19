import test from "node:test";
import assert from "node:assert/strict";
import { billingSummary, billingTimeline, type BillingMessage, type BillingSignup } from "../../src/lib/web-gratis/billing";

const JA = "1afdbfc5-8703-4ecd-9405-fa2aebb4d708";
const OTHER = "00000000-0000-4000-8000-000000000001";
const fixture = (id = JA): BillingSignup => ({
  id, status: "entregada", business_name: "Fixture", whatsapp: "+50370000000", referral_code: "FIXTUR",
  delivered_at: "2026-09-26T15:00:00.000Z", free_until: "2026-10-26", activated_at: null,
  paused_at: null, paid_via: null, paid_through: null, declined_at: null, opted_out_at: null,
  no_whatsapp_at: null, last_payment_at: null, billing_issue: null,
});
const timeline = (row: BillingSignup, at: string, messages: BillingMessage[] = []) =>
  billingTimeline(row, messages, new Date(at), { hasPaymentMethod: true });

test("JA deadline remains historical before, during and after the legacy expiry without a synthetic trial", () => {
  const row = fixture(), before = structuredClone(row);
  for (const [at, phase] of [["2026-10-19T23:59:00Z", "scheduled"], ["2026-10-24T16:00:00Z", "active"], ["2026-10-26T16:00:00Z", "active"], ["2027-01-04T16:00:00Z", "ended"]]) {
    const value = timeline(row, at);
    assert.equal(value.state, "evaluation_hold");
    assert.equal(value.freeUntil, "2026-10-26");
    assert.equal(value.monthly, 20);
    assert.equal(value.day, null);
    assert.equal(value.dueDate, null);
    assert.equal(value.daysLeft, null);
    assert.equal(value.next, null);
    assert.deepEqual(value.history, []);
    assert.equal(value.expiryHold?.phase, phase);
    assert.equal(value.expiryHold?.startsAt, "2026-10-20T15:00:00.000Z");
    assert.equal(value.expiryHold?.endsAt, "2026-11-19T15:00:00.000Z");
    assert.equal(value.expiryHold?.phaseBasis, "configured_window_clock");
    assert.equal(value.expiryHold?.actualActivationObservedAt, null);
    assert.equal(value.expiryHold?.legacyAutomaticPauseHeld, true);
    assert.equal(value.expiryHold?.doesNotActivateBilling, true);
  }
  assert.deepEqual(row, before);
});

test("JA history retains real ledger outcomes and scheduled dates without manufacturing skipped/sent events", () => {
  const messages: BillingMessage[] = [
    { template: "cqv_web_day28", status: "queued", sent_at: null, created_at: "2026-10-24T16:00:00Z", next_attempt_at: "2026-11-06T16:01:00Z", cycle: null },
    { template: "cqv_web_day30", status: "read", sent_at: "2026-10-26T16:00:00Z", created_at: "2026-10-26T15:00:00Z", cycle: null },
  ];
  const value = timeline(fixture(), "2026-11-05T16:00:00Z", messages);
  assert.equal(value.next, null);
  assert.deepEqual(value.history.map(({ date, status, kind }) => ({ date, status, kind })), [
    { date: "2026-10-26", status: "read", kind: "reminder_day30" },
    { date: "2026-11-06", status: "queued", kind: "reminder_day28" },
  ]);
});

test("JA is excluded from expiry collection counts and never represented as paid", () => {
  const at = new Date("2026-10-27T16:00:00Z");
  const value = timeline(fixture(), at.toISOString());
  assert.equal(value.paidVia, null);
  assert.equal(value.paidThrough, null);
  assert.deepEqual(billingSummary([value], at), { dueToday: 0, dueThisWeek: 0, overdue: 0, paused: 0, paying: 0, mrr: 0, renewalsDue: 0 });
});

test("other clients retain the ordinary legacy deadline and automatic reminder calculation", () => {
  const value = timeline(fixture(OTHER), "2026-10-24T16:00:00Z");
  assert.equal(value.expiryHold, undefined);
  assert.equal(value.state, "due_soon");
  assert.equal(value.day, 29);
  assert.equal(value.dueDate, "2026-10-26");
  assert.equal(value.daysLeft, 2);
  assert.equal(value.next?.kind, "reminder_day28");
  assert.equal(value.next?.date, "2026-10-24");
  const late = timeline(fixture(OTHER), "2026-10-27T16:00:00Z");
  assert.equal(late.state, "overdue");
  assert.equal(billingSummary([late], new Date("2026-10-27T16:00:00Z")).overdue, 1);
});

test("other-client paid renewals and payment ledger presentation remain intact", () => {
  const row = { ...fixture(OTHER), status: "activa" as const, paid_via: "manual" as const,
    activated_at: "2026-10-01T16:00:00Z", paid_through: "2026-10-31" };
  const value = timeline(row, "2026-10-19T16:00:00Z");
  assert.equal(value.state, "paid");
  assert.equal(value.day, null);
  assert.equal(value.dueDate, "2026-10-31");
  assert.equal(value.next?.kind, "renewal_reminder");
  assert.ok(value.history.some((event) => event.kind === "payment"));
  assert.equal(value.expiryHold, undefined);
  assert.equal(billingSummary([value], new Date("2026-10-19T16:00:00Z")).paying, 1);
});

test("unexpected JA Stripe activation stays visible with its provider charge and payment totals", () => {
  const row: BillingSignup = { ...fixture(), status: "activa", paid_via: "stripe", activated_at: "2026-10-01T16:00:00Z", paid_through: "2026-10-31" };
  const value = timeline(row, "2026-10-24T16:00:00Z");
  assert.equal(value.state, "paid");
  assert.equal(value.paidVia, "stripe");
  assert.equal(value.paidThrough, "2026-10-31");
  assert.equal(value.dueDate, "2026-10-31");
  assert.equal(value.expiryHold?.paymentStateRequiresReview, true);
  assert.equal(value.expiryHold?.doesNotActivateBilling, true);
  assert.equal(value.expiryHold?.legacyAutomaticPauseHeld, true);
  assert.deepEqual(value.next, { date: "2026-10-31", kind: "payment", label: "Cobro automático (Stripe)", template: null, status: "scheduled" });
  assert.ok(value.history.some((event) => event.kind === "payment" && event.label === "Pago recibido (Stripe)"));
  assert.ok(value.history.every((event) => event.kind !== "auto_pause" && event.kind !== "renewal_pause" && event.template === null));
  assert.deepEqual(billingSummary([value], new Date("2026-10-24T16:00:00Z")), { dueToday: 0, dueThisWeek: 0, overdue: 0, paused: 0, paying: 1, mrr: 20, renewalsDue: 0 });
});

test("JA Stripe failure/cancellation state is not concealed or represented as a cancelled provider charge by the hold", () => {
  const base: BillingSignup = { ...fixture(), status: "activa", paid_via: "stripe", activated_at: "2026-09-24T16:00:00Z", paid_through: "2026-10-24" };
  const failed = timeline({ ...base, billing_issue: "payment_failed" }, "2026-10-24T16:00:00Z");
  assert.equal(failed.state, "overdue");
  assert.equal(failed.expiryHold?.paymentStateRequiresReview, true);
  assert.equal(failed.next, null);
  assert.equal(billingSummary([failed], new Date("2026-10-24T16:00:00Z")).overdue, 1);
  const cancelled = timeline({ ...base, billing_issue: "subscription_canceled" }, "2026-10-24T16:00:00Z");
  assert.equal(cancelled.state, "cancelled");
  assert.equal(cancelled.expiryHold?.paymentStateRequiresReview, true);
  assert.equal(cancelled.next, null);
  assert.equal(billingSummary([cancelled], new Date("2026-10-24T16:00:00Z")).paying, 0);
});

test("JA manual payment and closed status remain visible while legacy renewal collection remains held", () => {
  const row: BillingSignup = { ...fixture(), status: "activa", paid_via: "manual", activated_at: "2026-09-24T16:00:00Z", paid_through: "2026-10-24" };
  const value = timeline(row, "2026-10-26T16:00:00Z");
  assert.equal(value.state, "renewal_due");
  assert.equal(value.paidVia, "manual");
  assert.equal(value.expiryHold?.paymentStateRequiresReview, true);
  assert.equal(value.next, null);
  assert.deepEqual(billingSummary([value], new Date("2026-10-26T16:00:00Z")), { dueToday: 0, dueThisWeek: 0, overdue: 0, paused: 0, paying: 1, mrr: 20, renewalsDue: 0 });
  const paused = timeline({ ...fixture(), status: "pausada", paused_at: "2026-10-25T16:00:00Z" }, "2026-10-26T16:00:00Z");
  assert.equal(paused.state, "paused");
  assert.ok(paused.history.some((event) => event.kind === "auto_pause"));
  assert.equal(paused.next, null);
  assert.equal(billingSummary([paused], new Date("2026-10-26T16:00:00Z")).paused, 1);
  assert.equal(timeline({ ...fixture(), status: "cancelada" }, "2026-10-26T16:00:00Z").state, "cancelled");
});
