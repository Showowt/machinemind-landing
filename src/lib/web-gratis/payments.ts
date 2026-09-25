/**
 * Free-website funnel — payments (MONTHLY_PRICE_USD a month, $19) and referral credits.
 *
 * Stripe: the /pagar/<code> button opens the Payment Link with
 * client_reference_id = signup id. The webhook (verified by hand — no Stripe
 * SDK) flips the signup to 'activa', which stops the day-28/30/pause reminders
 * because every trigger requires activated_at IS NULL. Events are claimed by id
 * first, so a Stripe retry never double-activates or double-alerts.
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
import { verifySignedBody, type SignatureCheck } from "./bridge-auth";
import { MONTHLY_PRICE_USD } from "./config";
import type { RewiredSendRequest, SendOutcome } from "./rewired";
import { getDb, SIGNUPS_TABLE, type SignupStatus, type WebGratisSignup } from "./server";
import { MESSAGES_TABLE } from "./whatsapp";

export const STRIPE_EVENTS_TABLE = "web_gratis_stripe_events";
export const CREDITS_TABLE = "web_gratis_referral_credits";

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

/** Subscription id + program metadata of an invoice (old and new Stripe API shapes). */
function invoiceSubscription(o: Record<string, unknown>): { subscriptionId: string | null; program: unknown } {
  const details = obj(obj(o.parent).subscription_details);
  const legacy = obj(o.subscription_details);
  return {
    subscriptionId: idOf(o.subscription) ?? idOf(details.subscription),
    program: obj(details.metadata).program ?? obj(legacy.metadata).program,
  };
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
  extras: { stripeCustomerId?: string | null; stripeSubscriptionId?: string | null },
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
  };
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
  const result = await activateSignup(ref, "stripe", { stripeCustomerId: customerId, stripeSubscriptionId: subscriptionId }, deps.now());
  if (!result) {
    await deps.alert(
      `paid-orphan:${event.id}`,
      `💰 PAGÓ por Stripe ${amount} con un código de cliente que no existe (${ref}; ${payer || "sin datos"}). Revise en Stripe.`,
    );
    return { duplicate: false, handled: "unknown_signup", signupId: null };
  }
  const s = result.signup;

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
    `💰 PAGÓ — ${s.business_name} (${s.whatsapp}) activó su web: ${amount} por Stripe.${creditNote} ${notes.join(" ")}`,
  );
  return { duplicate: false, handled: "activated", signupId: s.id, thankYou: thanks.status };
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
    case "invoice.payment_failed": {
      const { subscriptionId, program } = invoiceSubscription(o);
      const s = await signupByStripe(subscriptionId, idOf(o.customer));
      if (!s && program !== STRIPE_PROGRAM) return IGNORED;
      const who = s ? `${s.business_name} (${s.whatsapp})` : `cliente Stripe ${idOf(o.customer) ?? "?"}`;
      await deps.alert(
        `payfail:${event.id}`,
        `⚠️ Falló el cobro mensual de ${who}: ${money(num(o.amount_due), str(o.currency))}, intento ${num(o.attempt_count) ?? "?"}. Stripe reintenta solo; decidan si escribirle o pausar.`,
      );
      return { duplicate: false, handled: "payment_failed_alert", signupId: s?.id ?? null };
    }
    case "customer.subscription.deleted": {
      const s = await signupByStripe(idOf(o.id), idOf(o.customer));
      if (!s && obj(o.metadata).program !== STRIPE_PROGRAM) return IGNORED;
      const who = s ? `${s.business_name} (${s.whatsapp})` : `cliente Stripe ${idOf(o.customer) ?? "?"}`;
      await deps.alert(
        `subdel:${event.id}`,
        `⚠️ ${who} canceló su suscripción de $${MONTHLY_PRICE_USD}/mes en Stripe. Su web sigue "activa" en el tablero: decidan si pausarla o contactarlo.`,
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
