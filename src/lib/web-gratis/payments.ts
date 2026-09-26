/**
 * Free-website funnel — payments (MONTHLY_PRICE_USD a month, $19), the payments
 * ledger and its team alerts, and referral credits.
 *
 * Stripe: the /pagar/<code> button opens the Payment Link with
 * client_reference_id = signup id. The webhook (verified by hand — no Stripe
 * SDK) flips the signup to 'activa', which stops the day-28/30/pause reminders
 * because every trigger requires activated_at IS NULL. Events are claimed by id
 * first, so a Stripe retry never double-activates or double-alerts. Monthly
 * renewals (invoice.paid) extend paid_through to the new period's end; a failed
 * charge or a cancelled subscription is recorded on the signup (billing_issue)
 * so the board and the billing timeline show it until a payment clears it.
 *
 * Every payment lands in web_gratis_payments (the ledger): Stripe ones here
 * (idempotent on the Stripe event / invoice id), board ones (→ Activa, «Pagó
 * otro mes») through a database trigger. alertNewPayments() turns unalerted
 * ledger rows into "💰 PAGO RECIBIDO" team alerts; runCobrosDigest() sends the
 * daily "💳 COBROS" digest at 08:00 SV from the same billing timeline the board
 * shows (billing.ts).
 *
 * The webhook endpoint receives these event types for the WHOLE Stripe account
 * (shared with Rewired's own checkouts), so only the monthly-plan funnel's
 * events are acted on: the Payment Link and its subscriptions carry
 * metadata.program = "web_gratis"; a checkout tagged with any other program is
 * ignored silently, whatever its amount or reference.
 *
 * A request that pays before its site is delivered keeps its build status (it
 * stays in the team's build queue, marked as paid) and becomes 'activa' when
 * the team delivers it — see the board PATCH.
 *
 * PayPal / cash stay manual: the ops board's "→ Activa" button records paid_via
 * 'paypal' or 'manual' and the month it covers (paid_through).
 */
import { z } from "zod";
import { billingSummary, billingTimeline, type BillingTimeline } from "./billing";
import { verifySignedBody, type SignatureCheck } from "./bridge-auth";
import { DEFAULT_PAYPAL_LINK, MONTHLY_PRICE_USD } from "./config";
import { amountLabel, cobrosDigestMessages, cobrosHasNews, paymentReceivedText, type CobrosDigestPart, type DigestPayment } from "./notify";
import { enqueueBillingDigest, enqueueSystem, outboxHasKey } from "./outbox";
import type { RewiredSendRequest, SendOutcome } from "./rewired";
import { getDb, loadSettings, SIGNUPS_TABLE, type SignupStatus, type WebGratisSettings, type WebGratisSignup } from "./server";
import { addDays, hasPaymentMethod, PAYMENT_TEMPLATES, svClock, svDay, svDayStart } from "./templates";
import { isTestSignupName, MESSAGES_TABLE, type MessageRow } from "./whatsapp";

export const STRIPE_EVENTS_TABLE = "web_gratis_stripe_events";
export const CREDITS_TABLE = "web_gratis_referral_credits";
/** One row per payment received (migration 20260929). */
export const PAYMENTS_TABLE = "web_gratis_payments";

/** metadata.program on the web-gratis Payment Link, its sessions and subscriptions. */
export const STRIPE_PROGRAM = "web_gratis";
/**
 * The plan's price in cents (1900 = $19.00, Phil 2026-09-24: $20 → $19). Only the
 * fallback for a checkout with no program metadata uses it, as a floor: a legacy
 * $20 subscription still clears, anything under the plan price does not.
 */
export const PLAN_CENTS = MONTHLY_PRICE_USD * 100;

export const THANK_YOU_TEXT =
  "¡Listo! Su web queda activa 💛 ¿Le muestro cómo su WhatsApp puede agendar citas solo? Es el siguiente paso.";
/** Paid before the site was delivered: nothing is "active" yet. */
export const THANK_YOU_BUILDING_TEXT =
  "¡Pago recibido, muchas gracias! 💛 Estamos terminando su web y le avisamos por aquí apenas esté lista.";

export interface PaymentDeps {
  now: () => Date;
  send: (req: RewiredSendRequest) => Promise<SendOutcome>;
  alert: (key: string, text: string) => Promise<boolean>;
}

// ─── Signature ──────────────────────────────────────────────────────────────

export function stripeWebhookSecret(): string | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET_WEBGRATIS?.trim();
  return secret && secret.startsWith("whsec_") ? secret : null;
}

/** Stripe-Signature: `t=…,v1=…` — HMAC-SHA256(secret, `${t}.${rawBody}`), 5-minute tolerance. */
export function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string | null,
  nowSec = Math.floor(Date.now() / 1000),
): SignatureCheck {
  return verifySignedBody(header, rawBody, secret, nowSec, 300);
}

export const stripeEventSchema = z.object({
  id: z.string().regex(/^evt_[A-Za-z0-9_]{1,200}$/),
  type: z.string().min(1).max(100),
  livemode: z.boolean().optional(),
  data: z.object({ object: z.record(z.string(), z.unknown()) }),
});

export type StripeEvent = z.infer<typeof stripeEventSchema>;

const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
/** Stripe ids may arrive expanded as objects. */
const idOf = (v: unknown): string | null =>
  str(v) ?? (v && typeof v === "object" && "id" in v ? str((v as { id: unknown }).id) : null);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function money(cents: number | null, currency: string | null): string {
  if (cents === null) return "";
  return `$${(cents / 100).toFixed(2)} ${(currency ?? "usd").toUpperCase()}`;
}

/**
 * A Checkout Session of the monthly-plan funnel: created by the web-gratis
 * Payment Link (metadata copied from the link), or — only if it carries no
 * program metadata at all — a USD charge of at least the plan price that names
 * one of our signups. Another product's checkout (metadata.program set to
 * anything else) is never ours, even with a UUID reference.
 */
export function isFunnelCheckout(o: Record<string, unknown>): boolean {
  const program = obj(o.metadata).program;
  if (program === STRIPE_PROGRAM) return true;
  if (program !== undefined && program !== null && program !== "") return false;
  const ref = str(o.client_reference_id);
  return !!ref && UUID_RE.test(ref) && str(o.currency) === "usd" && (num(o.amount_total) ?? 0) >= PLAN_CENTS;
}

/** "2026-09-25" + 1 month → "2026-10-25" (clamped: Jan 31 → Feb 28), like Stripe's monthly anchor. */
export function addMonths(date: string, months = 1): string {
  const [y, m, d] = date.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d, last));
  return first.toISOString().slice(0, 10);
}

/** The invoice fields invoice.paid acts on (Stripe sends many more; they pass through untouched). */
const paidInvoiceSchema = z
  .object({
    id: z.string().min(1).max(200).optional(),
    billing_reason: z.string().max(60).nullable().optional(),
    amount_paid: z.number().int().nonnegative().optional(),
    currency: z.string().regex(/^[A-Za-z]{3}$/).optional(),
    lines: z
      .object({
        data: z.array(z.object({ period: z.object({ end: z.number().int().positive().optional() }).passthrough().optional() }).passthrough()).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

/** End of the service period an invoice pays for (latest line period end), as an SV date. */
function invoicePeriodEnd(invoice: z.infer<typeof paidInvoiceSchema>): string | null {
  let end: number | null = null;
  for (const line of invoice.lines?.data ?? []) {
    const e = line.period?.end ?? null;
    if (e !== null && (end === null || e > end)) end = e;
  }
  return end !== null ? svDay(new Date(end * 1000)) : null;
}

/** Subscription id + program metadata of an invoice (old and new Stripe API shapes). */
function invoiceSubscription(o: Record<string, unknown>): { subscriptionId: string | null; program: unknown } {
  const details = obj(obj(o.parent).subscription_details);
  const legacy = obj(o.subscription_details);
  return {
    subscriptionId: idOf(o.subscription) ?? idOf(details.subscription),
    program: obj(details.metadata).program ?? obj(legacy.metadata).program,
  };
}

const hasProgram = (program: unknown): boolean => program !== undefined && program !== null && program !== "";

/**
 * Whether a failed charge / a cancellation is about THIS signup's monthly-plan
 * subscription. The Stripe account is shared (Rewired's own products) and a
 * signup is also found by its customer id, so another subscription or a one-off
 * invoice of the same customer must never mark the plan as failed / cancelled.
 * A signup whose current subscription id is known only reacts to that one (an
 * older web-gratis subscription ending after a re-subscription is not news).
 */
function isCurrentPlanSubscription(s: WebGratisSignup, subscriptionId: string | null, program: unknown): boolean {
  if (hasProgram(program) && program !== STRIPE_PROGRAM) return false;
  if (!subscriptionId) return false;
  return !s.stripe_subscription_id || s.stripe_subscription_id === subscriptionId;
}

// ─── Activation + referral credit (shared with the ops board) ───────────────

export interface ActivationResult {
  signup: WebGratisSignup;
  previousStatus: SignupStatus;
  /** activated_at was empty before this payment. */
  newlyActive: boolean;
  /** Status kept (paid before delivery, or an unfinished form): the team still has to deliver. */
  keptStatus: boolean;
  formIncomplete: boolean;
}

/** Statuses that keep their place in the build flow when they pay early. */
const KEEP_STATUS_ON_PAYMENT: readonly SignupStatus[] = ["borrador", "nuevo", "en_construccion"];

export async function activateSignup(
  signupId: string,
  paidVia: "stripe" | "paypal" | "manual",
  extras: { stripeCustomerId?: string | null; stripeSubscriptionId?: string | null; paidThrough?: string | null },
  now: Date,
): Promise<ActivationResult | null> {
  const db = getDb();
  const { data: current, error: readError } = await db.from(SIGNUPS_TABLE).select("*").eq("id", signupId).maybeSingle();
  if (readError) throw readError;
  if (!current) return null;
  const before = current as WebGratisSignup;
  const nowIso = now.toISOString();
  const keep = KEEP_STATUS_ON_PAYMENT.includes(before.status);

  const update: Record<string, unknown> = {
    paid_via: paidVia,
    activated_at: before.activated_at ?? nowIso,
    recontact_after: null,
    paused_at: null,
    last_touch_at: nowIso,
    last_touch_kind: `pago_${paidVia}`,
    last_payment_at: nowIso,
    billing_issue: null,
    billing_issue_at: null,
  };
  if (extras.paidThrough && (!before.paid_through || extras.paidThrough > before.paid_through)) update.paid_through = extras.paidThrough;
  if (extras.stripeCustomerId) update.stripe_customer_id = extras.stripeCustomerId;
  if (extras.stripeSubscriptionId) update.stripe_subscription_id = extras.stripeSubscriptionId;
  if (!keep) update.status = "activa";

  const { data, error } = await db.from(SIGNUPS_TABLE).update(update).eq("id", signupId).select("*").single();
  if (error) throw error;
  return {
    signup: data as WebGratisSignup,
    previousStatus: before.status,
    newlyActive: !before.activated_at,
    keptStatus: keep,
    formIncomplete: before.status === "borrador",
  };
}

/**
 * D4 — a referred business paid: its referrer earns one free month (once per
 * referred business: referred_id is UNIQUE, so calling this again is a no-op).
 * Returns true when a new credit was created (and the team alerted).
 */
export async function grantReferralCredit(
  signup: Pick<WebGratisSignup, "id" | "business_name" | "referred_by_id">,
  alert: (key: string, text: string) => Promise<boolean>,
): Promise<boolean> {
  if (!signup.referred_by_id || signup.referred_by_id === signup.id) return false;
  const db = getDb();
  const { data: referrer, error: refError } = await db
    .from(SIGNUPS_TABLE)
    .select("id, business_name, whatsapp, referral_code, paid_via")
    .eq("id", signup.referred_by_id)
    .maybeSingle();
  if (refError) throw refError;
  if (!referrer) return false;
  const { error } = await db.from(CREDITS_TABLE).insert({ referrer_id: referrer.id, referred_id: signup.id, months: 1 });
  if (error) {
    if (error.code === "23505") return false;
    throw error;
  }
  const how =
    referrer.paid_via === "stripe"
      ? "Aplíquelo en Stripe (cupón 100% por 1 mes en su suscripción) y márquelo aplicado en el tablero."
      : "Márquelo aplicado en el tablero: si paga por PayPal/a mano, suma un mes a su «pagado hasta».";
  await alert(
    `referral-credit:${signup.id}`,
    `🤝 REFERIDO ACTIVÓ: ${referrer.business_name as string} (${referrer.whatsapp as string}, código ${referrer.referral_code as string}) gana 1 mes gratis — refirió a ${signup.business_name}. ${how}`,
  );
  return true;
}

/** Only activations from here on earn credits automatically (the table started empty on this date). */
const CREDITS_SINCE = "2026-09-24T00:00:00Z";

/**
 * Safety net for D4: grant any credit that a failed write left behind (Stripe
 * retries find the signup already active; the board grants in the background).
 * Idempotent — runs every cron minute over recent activations.
 */
export async function reconcileReferralCredits(alert: (key: string, text: string) => Promise<boolean>, now = new Date()): Promise<number> {
  const db = getDb();
  const windowStart = new Date(now.getTime() - 45 * 24 * 3_600_000).toISOString();
  const since = windowStart > CREDITS_SINCE ? windowStart : CREDITS_SINCE;
  const { data, error } = await db
    .from(SIGNUPS_TABLE)
    .select("id, business_name, referred_by_id")
    .not("referred_by_id", "is", null)
    .not("activated_at", "is", null)
    .gte("activated_at", since)
    .order("activated_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  const paid = (data ?? []) as Pick<WebGratisSignup, "id" | "business_name" | "referred_by_id">[];
  if (paid.length === 0) return 0;
  const { data: credits, error: creditError } = await db.from(CREDITS_TABLE).select("referred_id").in("referred_id", paid.map((p) => p.id));
  if (creditError) throw creditError;
  const done = new Set(((credits ?? []) as { referred_id: string }[]).map((c) => c.referred_id));
  let granted = 0;
  for (const p of paid) {
    if (done.has(p.id)) continue;
    try {
      if (await grantReferralCredit(p, alert)) granted++;
    } catch (grantError) {
      console.error("[WebGratis:credits] reconcile grant failed", p.id, grantError);
    }
  }
  return granted;
}

// ─── Payments ledger ────────────────────────────────────────────────────────

export interface PaymentRow {
  id: number;
  signup_id: string;
  paid_at: string;
  via: "stripe" | "paypal" | "manual";
  kind: "first" | "reactivation" | "renewal";
  amount_cents: number | null;
  currency: string | null;
  paid_through: string | null;
  source: "stripe_checkout" | "stripe_invoice" | "board";
  external_id: string | null;
  alerted_at: string | null;
  created_at: string;
}

/**
 * Record a Stripe payment (idempotent on the Stripe id). The webhook alerts it
 * itself, so the row is born alerted. False when it was already recorded. A
 * ledger failure never fails the webhook: the payment is on the signup either way.
 */
async function recordStripePayment(p: {
  signupId: string;
  kind: PaymentRow["kind"];
  amountCents: number | null;
  currency: string | null;
  paidThrough: string | null;
  source: "stripe_checkout" | "stripe_invoice";
  externalId: string;
  now: Date;
}): Promise<boolean> {
  const { error } = await getDb()
    .from(PAYMENTS_TABLE)
    .insert({
      signup_id: p.signupId,
      paid_at: p.now.toISOString(),
      via: "stripe",
      kind: p.kind,
      amount_cents: p.amountCents,
      currency: p.currency?.toLowerCase() ?? null,
      paid_through: p.paidThrough,
      source: p.source,
      external_id: p.externalId.slice(0, 200),
      alerted_at: p.now.toISOString(),
    });
  if (!error) return true;
  if (error.code !== "23505") console.error("[WebGratis:payments] ledger insert failed", p.signupId, p.externalId, error);
  return false;
}

// ─── Event claim (idempotency) ──────────────────────────────────────────────

async function claimEvent(event: StripeEvent): Promise<boolean> {
  const db = getDb();
  const { error } = await db.from(STRIPE_EVENTS_TABLE).insert({ id: event.id, type: event.type, status: "processing" });
  if (!error) return true;
  if (error.code !== "23505") throw error;
  // Seen before: only a failed or abandoned (crashed > 5 min ago) attempt may be retried.
  const staleBefore = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data, error: reclaimError } = await db
    .from(STRIPE_EVENTS_TABLE)
    .update({ status: "processing", last_error: null })
    .eq("id", event.id)
    .or(`status.eq.failed,and(status.eq.processing,updated_at.lt.${staleBefore})`)
    .select("id")
    .maybeSingle();
  if (reclaimError) throw reclaimError;
  return !!data;
}

async function finishEvent(id: string, status: "processed" | "ignored" | "failed", signupId: string | null, lastError?: string) {
  const record = (withSignup: string | null) =>
    getDb()
      .from(STRIPE_EVENTS_TABLE)
      .update({ status, signup_id: withSignup, last_error: lastError?.slice(0, 1000) ?? null })
      .eq("id", id);
  let { error } = await record(signupId);
  // 23503: the referenced signup doesn't exist — record the outcome without the link.
  if (error?.code === "23503") ({ error } = await record(null));
  if (error) console.error("[WebGratis:stripe] could not record event outcome", id, status, error);
}

async function signupByStripe(subscriptionId: string | null, customerId: string | null): Promise<WebGratisSignup | null> {
  const db = getDb();
  for (const [column, value] of [
    ["stripe_subscription_id", subscriptionId],
    ["stripe_customer_id", customerId],
  ] as const) {
    if (!value) continue;
    const { data, error } = await db.from(SIGNUPS_TABLE).select("*").eq(column, value).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (data) return data as WebGratisSignup;
  }
  return null;
}

// ─── Thank-you message (only inside the 24 h window) ────────────────────────

type ThankYou = { status: "sent" | "skipped" | "failed"; note: string };

async function sendThankYou(signup: WebGratisSignup, eventId: string, text: string, deps: PaymentDeps): Promise<ThankYou> {
  const now = deps.now();
  if (signup.opted_out_at) return { status: "skipped", note: "se dio de baja de WhatsApp" };
  if (signup.no_whatsapp_at) return { status: "skipped", note: "su número no tiene WhatsApp" };
  const hoursSince = signup.last_inbound_at ? (now.getTime() - Date.parse(signup.last_inbound_at)) / 3_600_000 : null;
  if (hoursSince === null || !(hoursSince >= 0 && hoursSince < 23)) {
    return { status: "skipped", note: "no nos ha escrito en las últimas 24 h, así que WhatsApp no deja escribirle primero" };
  }
  // A Stripe redelivery of the same event must not thank twice.
  const db = getDb();
  const { data: already, error: readError } = await db
    .from(MESSAGES_TABLE)
    .select("id, status")
    .eq("signup_id", signup.id)
    .eq("source", "stripe")
    .eq("meta->>event_id", eventId)
    .limit(1)
    .maybeSingle();
  if (readError) console.error("[WebGratis:stripe] thank-you ledger read failed", signup.id, readError);
  if (already && already.status === "sent") return { status: "sent", note: "ya se le había confirmado" };

  const outcome = await deps.send({
    to: signup.whatsapp,
    mode: "freeform",
    text,
    idempotencyKey: `wg-thanks-${eventId}`,
  });
  const { error } = await db.from(MESSAGES_TABLE).insert({
    signup_id: signup.id,
    phone: signup.whatsapp,
    direction: "outbound",
    source: "stripe",
    msg_type: "text",
    body: text,
    wa_message_id: outcome.ok ? outcome.wamid : null,
    status: outcome.ok ? "sent" : "failed",
    sent_at: outcome.ok ? now.toISOString() : null,
    failed_at: outcome.ok ? null : now.toISOString(),
    last_error_code: outcome.ok ? null : outcome.code.slice(0, 60),
    last_error: outcome.ok ? null : outcome.message.slice(0, 1000),
    meta: { event_id: eventId },
  });
  if (error) console.error("[WebGratis:stripe] thank-you ledger insert failed", signup.id, error);
  return outcome.ok ? { status: "sent", note: "" } : { status: "failed", note: `el envío falló (${outcome.code})` };
}

// ─── Event handling ─────────────────────────────────────────────────────────

export interface StripeHandleResult {
  duplicate: boolean;
  handled: string;
  signupId: string | null;
  thankYou?: "sent" | "skipped" | "failed";
}

const IGNORED: StripeHandleResult = { duplicate: false, handled: "ignored", signupId: null };

const STATUS_WORD: Record<SignupStatus, string> = {
  borrador: "Sin terminar",
  nuevo: "Nuevas",
  en_construccion: "En construcción",
  entregada: "Entregada",
  compartida: "Compartida",
  activa: "Activa",
  pausada: "Pausada",
  cancelada: "Cancelada",
  descartada: "Descartada",
};

async function onPaid(event: StripeEvent, deps: PaymentDeps): Promise<StripeHandleResult> {
  const o = event.data.object;
  if (!isFunnelCheckout(o)) return IGNORED; // another product on the shared Stripe account
  const ref = str(o.client_reference_id);
  const customerId = idOf(o.customer);
  const subscriptionId = idOf(o.subscription);
  const amount = money(num(o.amount_total), str(o.currency));
  const details = obj(o.customer_details);
  const payer = [str(details.name), str(details.email), str(details.phone)].filter(Boolean).join(" · ");

  if (!ref || !UUID_RE.test(ref)) {
    await deps.alert(
      `paid-orphan:${event.id}`,
      `💰 PAGÓ por Stripe ${amount} el plan web gratis pero sin código de cliente (${payer || "sin datos"}). Búsquelo por nombre/teléfono y márquelo "Activa" en el tablero.`,
    );
    return { duplicate: false, handled: "orphan_payment", signupId: null };
  }

  // Read before activating: was it already paid (another subscription = possible double charge)?
  const { data: prior } = await getDb().from(SIGNUPS_TABLE).select("activated_at, paid_via, stripe_subscription_id").eq("id", ref).maybeSingle();
  const now = deps.now();
  // Stripe bills monthly from today; invoice.paid corrects it to the exact period end.
  const paidThrough = addMonths(svDay(now));
  const result = await activateSignup(ref, "stripe", { stripeCustomerId: customerId, stripeSubscriptionId: subscriptionId, paidThrough }, now);
  if (!result) {
    await deps.alert(
      `paid-orphan:${event.id}`,
      `💰 PAGÓ por Stripe ${amount} con un código de cliente que no existe (${ref}; ${payer || "sin datos"}). Revise en Stripe.`,
    );
    return { duplicate: false, handled: "unknown_signup", signupId: null };
  }
  const s = result.signup;
  await recordStripePayment({
    signupId: s.id,
    kind: result.newlyActive ? "first" : result.previousStatus === "pausada" || result.previousStatus === "cancelada" || result.previousStatus === "descartada" ? "reactivation" : "renewal",
    amountCents: num(o.amount_total),
    currency: str(o.currency),
    paidThrough: s.paid_through,
    source: "stripe_checkout",
    externalId: event.id,
    now,
  });

  // D4 — idempotent, so a Stripe retry that finds the signup already active still grants it.
  let creditNote = "";
  if (s.activated_at) {
    try {
      await grantReferralCredit(s, deps.alert);
    } catch (creditError) {
      console.error("[WebGratis:stripe] referral credit failed (the cron retries it)", s.id, creditError);
      creditNote = " (crédito de referido pendiente: el sistema lo reintenta solo)";
    }
  }

  const thanks = await sendThankYou(s, event.id, result.keptStatus ? THANK_YOU_BUILDING_TEXT : THANK_YOU_TEXT, deps).catch((error: unknown): ThankYou => {
    console.error("[WebGratis:stripe] thank-you failed", s.id, error);
    return { status: "failed", note: "el envío falló" };
  });

  const notes: string[] = [];
  if (result.formIncomplete) notes.push("⚠️ Su formulario está incompleto: complételo en el tablero.");
  else if (result.keptStatus) {
    notes.push(`⚠️ Su web AÚN NO está entregada: sigue en «${STATUS_WORD[result.previousStatus]}» marcada como pagada. Constrúyala; al pasarla a «Entregada» queda Activa y le sale «Web lista».`);
  } else if (result.previousStatus === "pausada") {
    notes.push("⚠️ Estaba PAUSADA: restaure su web (sáquela del archivo) hoy.");
  } else if (result.previousStatus === "cancelada" || result.previousStatus === "descartada") {
    notes.push(`⚠️ Estaba ${STATUS_WORD[result.previousStatus].toUpperCase()}: revise su web y el cobro.`);
  }
  const priorSub = (prior?.stripe_subscription_id as string | null | undefined) ?? null;
  if (prior?.activated_at && (prior.paid_via !== "stripe" || (priorSub && subscriptionId && priorSub !== subscriptionId))) {
    notes.push("Ya estaba activa: revise si es un cobro doble.");
  }
  if (!s.referred_by_id && s.referred_by_text) {
    notes.push(`Dijo que lo recomendó «${s.referred_by_text.slice(0, 80)}»: asigne el referido en su tarjeta para darle el mes gratis.`);
  }
  notes.push(
    thanks.status === "sent"
      ? "✅ Se le confirmó por WhatsApp."
      : `📵 NO se le pudo confirmar por WhatsApp (${thanks.note}): confírmele a mano.`,
  );
  await deps.alert(
    `paid:${event.id}`,
    `${paymentReceivedText({ business: s.business_name, amount: amount || amountLabel(null, null), via: "stripe", paidThrough: s.paid_through })} (se renueva sola)\n${s.whatsapp} activó su web.${creditNote} ${notes.join(" ")}`,
  );
  return { duplicate: false, handled: "activated", signupId: s.id, thankYou: thanks.status };
}

/** Stripe subscription trouble shown on the board / billing timeline until a payment clears it. */
async function setBillingIssue(signupId: string, issue: "payment_failed" | "subscription_canceled", now: Date): Promise<void> {
  const { error } = await getDb()
    .from(SIGNUPS_TABLE)
    .update({ billing_issue: issue, billing_issue_at: now.toISOString() })
    .eq("id", signupId);
  if (error) console.error("[WebGratis:stripe] billing_issue not recorded", signupId, issue, error);
}

/**
 * A subscription invoice was paid. The first one (billing_reason
 * subscription_create) belongs to the checkout that activated the site — it
 * only corrects paid_through to the exact period end. Every later one is a
 * monthly renewal: paid_through moves to the new period's end, any billing
 * issue clears, the ledger records it and the team gets "💰 PAGO RECIBIDO". A $0
 * invoice (a referral-credit coupon month) moves the date without an alert.
 */
async function onInvoicePaid(event: StripeEvent, deps: PaymentDeps): Promise<StripeHandleResult> {
  const o = event.data.object;
  const { subscriptionId, program } = invoiceSubscription(o);
  // The Stripe account is shared: another product's invoice (tagged with its own program, or for a
  // different subscription of the same customer) is never a web-gratis payment.
  if (hasProgram(program) && program !== STRIPE_PROGRAM) return IGNORED;
  const s = await signupByStripe(subscriptionId, idOf(o.customer));
  if (s && subscriptionId && s.stripe_subscription_id && s.stripe_subscription_id !== subscriptionId && program !== STRIPE_PROGRAM) return IGNORED;
  // A one-off invoice of the same customer (no subscription, not tagged) is another product's sale.
  if (s && !subscriptionId && program !== STRIPE_PROGRAM) return IGNORED;
  const parsed = paidInvoiceSchema.safeParse(o);
  if (!parsed.success) {
    if (!s && program !== STRIPE_PROGRAM) return IGNORED;
    console.error("[WebGratis:stripe] invoice.paid with an unexpected shape", event.id, parsed.error.issues.slice(0, 3));
    await deps.alert(
      `paid-shape:${event.id}`,
      `⚠️ Stripe avisó un cobro mensual${s ? ` de ${s.business_name} (${s.whatsapp})` : ""} con un formato que no reconocemos (${event.id}). Revíselo en Stripe y registre el mes a mano en el tablero.`,
    );
    return { duplicate: false, handled: "invoice_unreadable", signupId: s?.id ?? null };
  }
  const invoice = parsed.data;
  const reason = invoice.billing_reason ?? null;
  if (!s) {
    if (program !== STRIPE_PROGRAM || reason === "subscription_create") return IGNORED; // the checkout handles the first one
    await deps.alert(
      `paid-orphan:${event.id}`,
      `💰 Cobro mensual por Stripe (${money(invoice.amount_paid ?? null, invoice.currency ?? null)}) de un cliente que no encontramos (cliente Stripe ${idOf(o.customer) ?? "?"}). Revise en Stripe y asígnelo en el tablero.`,
    );
    return { duplicate: false, handled: "orphan_payment", signupId: null };
  }
  const now = deps.now();
  const periodEnd = invoicePeriodEnd(invoice) ?? addMonths(svDay(now));
  const cents = invoice.amount_paid ?? null;

  if (reason === "subscription_create" || cents === 0) {
    const update: Record<string, unknown> = { billing_issue: null, billing_issue_at: null };
    if (!s.paid_through || periodEnd > s.paid_through) update.paid_through = periodEnd;
    const { error } = await getDb().from(SIGNUPS_TABLE).update(update).eq("id", s.id);
    if (error) throw error;
    return { duplicate: false, handled: cents === 0 && reason !== "subscription_create" ? "invoice_free_month" : "invoice_first", signupId: s.id };
  }

  const wasPaused = s.status === "pausada" || s.status === "cancelada" || s.status === "descartada";
  let current: WebGratisSignup = s;
  if (wasPaused) {
    const result = await activateSignup(s.id, "stripe", { paidThrough: periodEnd }, now);
    if (result) current = result.signup;
  } else {
    const { data, error } = await getDb()
      .from(SIGNUPS_TABLE)
      .update({
        paid_through: !s.paid_through || periodEnd > s.paid_through ? periodEnd : s.paid_through,
        last_payment_at: now.toISOString(),
        billing_issue: null,
        billing_issue_at: null,
        last_touch_at: now.toISOString(),
        last_touch_kind: "pago_stripe_mes",
      })
      .eq("id", s.id)
      .select("*")
      .single();
    if (error) throw error;
    current = data as WebGratisSignup;
  }
  const invoiceId = invoice.id ?? event.id;
  const fresh = await recordStripePayment({
    signupId: s.id,
    kind: wasPaused ? "reactivation" : "renewal",
    amountCents: cents,
    currency: invoice.currency ?? null,
    paidThrough: current.paid_through,
    source: "stripe_invoice",
    externalId: invoiceId,
    now,
  });
  if (fresh || wasPaused) {
    const notes = wasPaused ? " ⚠️ Estaba PAUSADA: restaure su web (sáquela del archivo) hoy." : "";
    await deps.alert(
      `paid-invoice:${invoiceId}`,
      `${paymentReceivedText({ business: current.business_name, amount: money(cents, invoice.currency ?? null), via: "stripe", paidThrough: current.paid_through })}\nCobro mensual automático · ${current.whatsapp}.${notes}`,
    );
  }
  return { duplicate: false, handled: "invoice_paid", signupId: s.id };
}

async function processEvent(event: StripeEvent, deps: PaymentDeps): Promise<StripeHandleResult> {
  const o = event.data.object;
  switch (event.type) {
    case "checkout.session.completed": {
      if (!isFunnelCheckout(o)) return IGNORED;
      const paymentStatus = str(o.payment_status);
      if (paymentStatus === "paid") return onPaid(event, deps);
      const pendingRef = str(o.client_reference_id);
      const signupId = pendingRef && UUID_RE.test(pendingRef) ? pendingRef : null;
      if (paymentStatus === "no_payment_required") {
        // A trial or 100% coupon: nothing was charged, so nothing is activated automatically.
        await deps.alert(
          `paid-free:${event.id}`,
          `⚠️ Checkout del plan web gratis SIN cobro (no_payment_required: cupón o prueba) para ${signupId ?? "sin código"}. No se activó: revise en Stripe y actívelo a mano si corresponde.`,
        );
        return { duplicate: false, handled: "no_charge", signupId };
      }
      await deps.alert(
        `paid-pending:${event.id}`,
        `⏳ Pago iniciado por Stripe (${money(num(o.amount_total), str(o.currency))}) pero aún no confirmado (${paymentStatus ?? "?"}). Se activa solo si se confirma.`,
      );
      return { duplicate: false, handled: "payment_pending", signupId };
    }
    case "checkout.session.async_payment_succeeded":
      return onPaid(event, deps);
    case "checkout.session.async_payment_failed": {
      if (!isFunnelCheckout(o)) return IGNORED;
      await deps.alert(`paid-failed:${event.id}`, `⚠️ Un pago iniciado por Stripe falló (${str(o.client_reference_id) ?? "sin código"}). Nada cambió.`);
      return { duplicate: false, handled: "async_failed", signupId: null };
    }
    case "invoice.paid":
      return onInvoicePaid(event, deps);
    case "invoice.payment_failed": {
      const { subscriptionId, program } = invoiceSubscription(o);
      if (hasProgram(program) && program !== STRIPE_PROGRAM) return IGNORED;
      const found = await signupByStripe(subscriptionId, idOf(o.customer));
      // Found by customer id but it's another subscription / a one-off invoice of that customer: not the plan.
      if (found && !isCurrentPlanSubscription(found, subscriptionId, program)) return IGNORED;
      const s = found;
      if (!s && program !== STRIPE_PROGRAM) return IGNORED;
      // The subscription's very first charge failing = a card declined while subscribing: nothing was
      // activated and nothing is overdue, so the signup's billing state is left alone.
      const atSignup = str(o.billing_reason) === "subscription_create";
      if (s && !atSignup) await setBillingIssue(s.id, "payment_failed", deps.now());
      const who = s ? `${s.business_name} (${s.whatsapp})` : `cliente Stripe ${idOf(o.customer) ?? "?"}`;
      await deps.alert(
        `payfail:${event.id}`,
        atSignup
          ? `⚠️ El primer cobro por Stripe de ${who} no pasó (${money(num(o.amount_due), str(o.currency))}): no se activó nada. Si le interesa, escríbale para que pruebe otra tarjeta o PayPal.`
          : `⚠️ Falló el cobro mensual de ${who}: ${money(num(o.amount_due), str(o.currency))}, intento ${num(o.attempt_count) ?? "?"}. Stripe reintenta solo; decidan si escribirle o pausar. En «Cobros» aparece como vencido hasta que pague.`,
      );
      return { duplicate: false, handled: "payment_failed_alert", signupId: s?.id ?? null };
    }
    case "customer.subscription.deleted": {
      const program = obj(o.metadata).program;
      if (hasProgram(program) && program !== STRIPE_PROGRAM) return IGNORED;
      const subscriptionId = idOf(o.id);
      const found = await signupByStripe(subscriptionId, idOf(o.customer));
      // Another subscription of the same customer (or an older one already replaced) ending is not the plan.
      if (found && !isCurrentPlanSubscription(found, subscriptionId, program)) return IGNORED;
      const s = found;
      if (!s && program !== STRIPE_PROGRAM) return IGNORED;
      if (s) await setBillingIssue(s.id, "subscription_canceled", deps.now());
      const who = s ? `${s.business_name} (${s.whatsapp})` : `cliente Stripe ${idOf(o.customer) ?? "?"}`;
      await deps.alert(
        `subdel:${event.id}`,
        `⚠️ ${who} canceló su suscripción de $${MONTHLY_PRICE_USD}/mes en Stripe. Su web sigue "activa" en el tablero (en «Cobros»: cancelada): decidan si pausarla o contactarlo.`,
      );
      return { duplicate: false, handled: "subscription_deleted_alert", signupId: s?.id ?? null };
    }
    default:
      return IGNORED;
  }
}

export async function handleStripeEvent(event: StripeEvent, deps: PaymentDeps): Promise<StripeHandleResult> {
  if (!(await claimEvent(event))) return { duplicate: true, handled: "duplicate", signupId: null };
  try {
    const result = await processEvent(event, deps);
    await finishEvent(event.id, result.handled === "ignored" ? "ignored" : "processed", result.signupId);
    return result;
  } catch (error) {
    await finishEvent(event.id, "failed", null, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// ─── "💰 PAGO RECIBIDO" for board payments (ledger rows not alerted yet) ────

export interface BillingRunDeps {
  now: () => Date;
  /** Plain team alert (outbox system alert). */
  alert: (key: string, text: string) => Promise<boolean>;
  /** One part of the daily digest (Telegram HTML + e-mail), under an exact outbox key. */
  digest: (key: string, part: CobrosDigestPart) => Promise<boolean>;
  /** An outbox row with this key already exists (the digest went out today). */
  alreadyQueued: (key: string) => Promise<boolean>;
  settings: () => Promise<Pick<WebGratisSettings, "pay_link" | "paypal_link">>;
}

export function defaultBillingDeps(): BillingRunDeps {
  return {
    now: () => new Date(),
    alert: (key, text) => enqueueSystem(key, text),
    digest: (key, part) => enqueueBillingDigest(key, part),
    alreadyQueued: (key) => outboxHasKey(key),
    settings: () => loadSettings(),
  };
}

type LedgerRowWithSignup = PaymentRow & {
  signup: { business_name: string; whatsapp: string; referral_code: string } | null;
};

const KIND_NOTE: Record<PaymentRow["kind"], string> = {
  first: "Primer pago",
  reactivation: "Reactivó su web (estaba pausada: restáurela hoy)",
  renewal: "Pagó otro mes",
};

/**
 * "💰 PAGO RECIBIDO" for every ledger row nobody was told about yet (board
 * payments: → Activa, «Pagó otro mes»). Idempotent: the outbox key is the ledger
 * id and the row is marked alerted. A general sweep never alerts test rows.
 */
export async function alertNewPayments(
  deps: Pick<BillingRunDeps, "alert">,
  options: { onlySignupIds?: string[] } = {},
): Promise<{ alerted: number; errors: string[] }> {
  const db = getDb();
  const out = { alerted: 0, errors: [] as string[] };
  let q = db
    .from(PAYMENTS_TABLE)
    .select("*, signup:web_gratis_signups!inner(business_name, whatsapp, referral_code)")
    .is("alerted_at", null)
    .order("id", { ascending: true })
    .limit(50);
  if (options.onlySignupIds) q = q.in("signup_id", options.onlySignupIds.length ? options.onlySignupIds : ["00000000-0000-0000-0000-000000000000"]);
  else q = q.not("signup.business_name", "like", "ZZ %"); // test rows never crowd real payments out of the batch
  const { data, error } = await q;
  if (error) throw error;
  for (const row of (data ?? []) as unknown as LedgerRowWithSignup[]) {
    const business = row.signup?.business_name ?? "cliente";
    if (!options.onlySignupIds && isTestSignupName(business)) continue;
    try {
      const text = `${paymentReceivedText({ business, amount: amountLabel(row.amount_cents, row.currency), via: row.via, paidThrough: row.paid_through })}\n${KIND_NOTE[row.kind]} · ${row.signup?.whatsapp ?? ""}. Los recordatorios de pago de este mes se detienen solos.`;
      if (!(await deps.alert(`payment:${row.id}`, text))) {
        out.errors.push(`payment ${row.id}: alert not queued`);
        continue;
      }
      const { error: markError } = await db.from(PAYMENTS_TABLE).update({ alerted_at: new Date().toISOString() }).eq("id", row.id).is("alerted_at", null);
      if (markError) throw markError;
      out.alerted++;
    } catch (alertError) {
      out.errors.push(`payment ${row.id}: ${alertError instanceof Error ? alertError.message : String(alertError)}`);
      console.error("[WebGratis:payments] payment alert failed", row.id, alertError);
    }
  }
  return out;
}

// ─── Daily "💳 COBROS" digest (08:00 SV) ────────────────────────────────────

/** Hour (SV) of the daily digest; the first cron run of that hour sends it. */
export const COBROS_DIGEST_HOUR_SV = 8;
/**
 * Clients who can have something to collect — the same set as the board's «Cobros» view
 * (admin/billing route): delivered / paying / paused sites, plus requests that paid before
 * delivery, so the digest's "pagando N · MRR $X" is the board's number.
 */
const DIGEST_ROWS_FILTER =
  "status.in.(entregada,compartida,activa,pausada),and(status.in.(nuevo,en_construccion),activated_at.not.is.null)";
const PAGE = 1000;
/** Signup ids per messages query (keeps the PostgREST URL short). */
const ID_CHUNK = 100;
/** Safety stop for one chunk's message pages. */
const MAX_MESSAGE_ROWS = 100_000;

export interface DigestReport {
  ran: boolean;
  reason: "sent" | "not_digest_hour" | "already_sent" | "nothing_to_report";
  key: string;
  /** Clients whose timeline was computed. */
  considered: number;
  /** Test rows ("ZZ …") left out of a general sweep. */
  testRowsExcluded: number;
  parts: number;
}

async function loadDigestSignups(only: string[] | undefined): Promise<WebGratisSignup[]> {
  const db = getDb();
  if (only) {
    const { data, error } = await db.from(SIGNUPS_TABLE).select("*").in("id", only.length ? only : ["00000000-0000-0000-0000-000000000000"]).or(DIGEST_ROWS_FILTER);
    if (error) throw error;
    return (data ?? []) as WebGratisSignup[];
  }
  const all: WebGratisSignup[] = [];
  for (let from = 0; from < 50_000; from += PAGE) {
    const { data, error } = await db
      .from(SIGNUPS_TABLE)
      .select("*")
      .or(DIGEST_ROWS_FILTER)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const page = (data ?? []) as WebGratisSignup[];
    all.push(...page);
    if (page.length < PAGE) break;
  }
  return all;
}

/**
 * The payment asks of these signups, grouped by signup. Paged like the board's: PostgREST caps a
 * response at 1000 rows, and a cut (months of renewals × 100 signups) would drop the NEWEST rows —
 * the current cycle's — and the digest would call reminders that already went out "próximos".
 */
async function loadPaymentSends(ids: string[]): Promise<Map<string, MessageRow[]>> {
  const out = new Map<string, MessageRow[]>();
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const group = ids.slice(i, i + ID_CHUNK);
    for (let from = 0; from < MAX_MESSAGE_ROWS; from += PAGE) {
      const { data, error } = await getDb()
        .from(MESSAGES_TABLE)
        .select("*")
        .in("signup_id", group)
        .in("template", [...PAYMENT_TEMPLATES])
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const page = (data ?? []) as MessageRow[];
      for (const m of page) {
        if (!m.signup_id) continue;
        const list = out.get(m.signup_id) ?? [];
        list.push(m);
        out.set(m.signup_id, list);
      }
      if (page.length < PAGE) break;
    }
  }
  return out;
}

const byDueThenName = (a: BillingTimeline, b: BillingTimeline) =>
  (a.dueDate ?? "9999") === (b.dueDate ?? "9999") ? a.business.localeCompare(b.business, "es") : (a.dueDate ?? "9999") < (b.dueDate ?? "9999") ? -1 : 1;

/**
 * "💳 COBROS — <día>" once a day at 08:00 SV (outbox key cobros:<SV date>),
 * only when there's something to report: due today, due in 1–3 days (day N of
 * the free month), overdue, PayPal renewals coming up, paused in the last 24 h,
 * payments received yesterday — and the one-line total. Built from billing.ts,
 * the same timeline the board shows. A general sweep never includes test rows.
 */
export async function runCobrosDigest(deps: BillingRunDeps, options: { onlySignupIds?: string[]; force?: boolean } = {}): Promise<DigestReport> {
  const now = deps.now();
  const day = svDay(now);
  const key = `cobros:${day}`;
  const report: DigestReport = { ran: false, reason: "not_digest_hour", key, considered: 0, testRowsExcluded: 0, parts: 0 };
  if (!options.force && svClock(now).hour !== COBROS_DIGEST_HOUR_SV) return report;
  if (await deps.alreadyQueued(key)) return { ...report, reason: "already_sent" };

  let settings: Pick<WebGratisSettings, "pay_link" | "paypal_link"> | null = null;
  try {
    settings = await deps.settings();
  } catch (settingsError) {
    console.error("[WebGratis:cobros] settings unavailable", settingsError);
  }
  const paypalLink = settings?.paypal_link?.trim() || DEFAULT_PAYPAL_LINK;
  const payable = hasPaymentMethod(settings);

  const only = options.onlySignupIds;
  const loaded = await loadDigestSignups(only);
  const signups = only ? loaded : loaded.filter((s) => !isTestSignupName(s.business_name));
  report.testRowsExcluded = loaded.length - signups.length;
  const sends = await loadPaymentSends(signups.map((s) => s.id));

  const timelines: BillingTimeline[] = [];
  const pausedAt = new Map<string, string>();
  for (const s of signups) {
    try {
      timelines.push(billingTimeline(s, sends.get(s.id) ?? [], now, { hasPaymentMethod: payable }));
      if (s.paused_at) pausedAt.set(s.id, s.paused_at);
    } catch (rowError) {
      console.error("[WebGratis:cobros] timeline", s.id, rowError);
    }
  }
  report.considered = timelines.length;
  const summary = billingSummary(timelines, now);
  const since = now.getTime() - 24 * 3_600_000;

  // Payments received yesterday (SV calendar day).
  const yesterday = addDays(day, -1);
  let pq = getDb()
    .from(PAYMENTS_TABLE)
    .select("*, signup:web_gratis_signups!inner(business_name, whatsapp, referral_code)")
    .gte("paid_at", svDayStart(yesterday).toISOString())
    .lt("paid_at", svDayStart(day).toISOString())
    .order("paid_at", { ascending: true });
  if (only) pq = pq.in("signup_id", only.length ? only : ["00000000-0000-0000-0000-000000000000"]);
  else pq = pq.not("signup.business_name", "like", "ZZ %");
  const { data: paid, error: paidError } = await pq;
  if (paidError) throw paidError;
  const paymentsYesterday: DigestPayment[] = ((paid ?? []) as unknown as LedgerRowWithSignup[])
    .filter((p) => only || !isTestSignupName(p.signup?.business_name))
    .map((p) => ({ business: p.signup?.business_name ?? "cliente", amount: amountLabel(p.amount_cents, p.currency), via: p.via, paidThrough: p.paid_through }));

  const sorted = [...timelines].sort(byDueThenName);
  const input = {
    day,
    dueToday: sorted.filter((t) => t.dueDate === day && (t.state === "due_today" || t.state === "renewal_due")),
    dueSoon: sorted.filter((t) => t.state === "due_soon" && !t.paidVia),
    overdue: sorted.filter((t) => t.state === "overdue" || (t.state === "renewal_due" && (t.daysLeft ?? 0) < 0)),
    renewals: sorted.filter((t) => t.state === "due_soon" && !!t.paidVia && t.paidVia !== "stripe"),
    paused: sorted
      .filter((t) => t.state === "paused" && Date.parse(pausedAt.get(t.signupId) ?? "") >= since)
      .map((t) => ({ t, pausedAt: svDay(new Date(pausedAt.get(t.signupId) as string)) })),
    paymentsYesterday,
    totals: { paying: summary.paying, mrr: summary.mrr, dueThisWeek: summary.dueThisWeek },
    paypalLink,
  };
  if (!cobrosHasNews(input)) return { ...report, reason: "nothing_to_report" };

  const parts = cobrosDigestMessages(input);
  let queued = 0;
  for (let k = 0; k < parts.length; k++) {
    const partKey = k === 0 ? key : `${key}:${k + 1}`;
    if (await deps.digest(partKey, parts[k])) queued++;
    else console.error("[WebGratis:cobros] digest part not queued", partKey);
  }
  // Part 1 carries the once-a-day key: if it didn't make it, the next minute builds the digest again
  // (parts already queued are deduplicated by their own keys).
  if (queued === 0) throw new Error(`cobros digest ${key}: no part could be queued`);
  return { ...report, ran: true, reason: "sent", parts: queued };
}
