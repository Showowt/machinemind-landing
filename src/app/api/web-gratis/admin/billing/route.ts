/**
 * GET /api/web-gratis/admin/billing — the ops board's "Cobros" view.
 *
 * Every client with a delivered site (free month, paying, paused) plus the ones
 * who paid before delivery, each with its payment timeline from billing.ts —
 * the same pure functions the scheduler's date rules come from, so the board
 * shows what the cron will actually do: day N of the free month, the due date,
 * the next automatic reminder and the reminders already sent / delivered / read.
 *
 * Returns { summary, timelines } (open accounts soonest-due first, so overdue
 * ones are on top; paused sites after them)
 * plus, per client, the flags the board needs to guard a manual WhatsApp
 * (opted out, no WhatsApp, said no) and billingSummary() of that client alone,
 * so the board's filter chips always match the totals. Test rows (business
 * name "ZZ …", the D5 harness) are never included.
 * Bearer WEB_GRATIS_ADMIN_TOKEN.
 */
import { requireAdmin, signupCountry, type BoardCountry, type OpsSignup } from "@/lib/web-gratis/admin";
import { billingSummary, billingTimeline, type BillingTimeline } from "@/lib/web-gratis/billing";
import { DEFAULT_PAYPAL_LINK, FREE_DAYS, MONTHLY_PRICE_USD } from "@/lib/web-gratis/config";
import { fail, ok } from "@/lib/web-gratis/http";
import { hasPaymentMethod, PAYMENT_TEMPLATES } from "@/lib/web-gratis/templates";
import { getDb, SETTINGS_TABLE, SIGNUPS_TABLE, svDate, type SignupStatus, type WebGratisSettings } from "@/lib/web-gratis/server";
import { isTestSignupName, MESSAGES_TABLE, type MessageRow } from "@/lib/web-gratis/whatsapp";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** billingSummary() totals (also sent per client, for the board's filter chips). */
export type BillingCounts = ReturnType<typeof billingSummary>;

/** What the board needs about a client besides its timeline. */
export interface BillingClientInfo {
  status: SignupStatus;
  country: BoardCountry;
  optedOut: boolean;
  noWhatsapp: boolean;
  declined: boolean;
  /** billingSummary([this client]) — which chips it counts in, and its share of the MRR. */
  counts: BillingCounts;
}

export interface BillingPayload {
  generatedAt: string;
  /** Today in El Salvador (YYYY-MM-DD). */
  today: string;
  monthly: number;
  freeDays: number;
  /** A Stripe Payment Link is set (card + automatic monthly charge on /pagar). */
  stripe: boolean;
  /** The PayPal link /pagar shows (settings, else the default). */
  paypalLink: string;
  /** Payment reminders can go out (Stripe or PayPal available). */
  hasPaymentMethod: boolean;
  summary: BillingCounts;
  timelines: BillingTimeline[];
  clients: Record<string, BillingClientInfo>;
}

/** Delivered / paying / paused sites, and requests that paid before delivery. */
const BILLING_ROWS_FILTER =
  "status.in.(entregada,compartida,activa,pausada),and(status.in.(nuevo,en_construccion),activated_at.not.is.null)";
const PAGE = 1000;
const MAX_ROWS = 20_000;
/** Signup ids per messages query (keeps the PostgREST URL short). */
const ID_CHUNK = 100;
/** Safety stop for one chunk's message pages (100 signups × years of monthly renewals fit easily). */
const MAX_MESSAGE_ROWS = 100_000;

async function loadClients(): Promise<OpsSignup[]> {
  const db = getDb();
  const all: OpsSignup[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await db
      .from(SIGNUPS_TABLE)
      .select("*")
      .or(BILLING_ROWS_FILTER)
      .not("business_name", "like", "ZZ %")
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const page = (data ?? []) as OpsSignup[];
    all.push(...page);
    if (page.length < PAGE) break;
  }
  // Belt and braces: the harness prefix check the scheduler itself uses.
  return all.filter((s) => !isTestSignupName(s.business_name));
}

/**
 * The payment asks (day 28 / day 30 / pause notice / renewal — the only templates billing.ts
 * reads) of these signups, grouped by signup. Paged: PostgREST caps a response at 1000 rows,
 * and a cut would drop the NEWEST rows (the current cycle's), showing reminders that already
 * went out as still "programado".
 */
async function loadPaymentMessages(ids: string[]): Promise<Map<string, MessageRow[]>> {
  const db = getDb();
  const out = new Map<string, MessageRow[]>();
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const group = ids.slice(i, i + ID_CHUNK);
    for (let from = 0; from < MAX_MESSAGE_ROWS; from += PAGE) {
      const { data, error } = await db
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

async function loadPaySettings(): Promise<Pick<WebGratisSettings, "pay_link" | "paypal_link"> | null> {
  const { data, error } = await getDb().from(SETTINGS_TABLE).select("pay_link, paypal_link").eq("id", 1).maybeSingle();
  if (error) {
    console.error("[WebGratis:admin:billing] settings", error);
    return null;
  }
  return (data as Pick<WebGratisSettings, "pay_link" | "paypal_link"> | null) ?? null;
}

/**
 * Paused sites: nothing to chase today, so they go after the open accounts. ("cancelled" is NOT
 * closed here: in this set it can only be a Stripe subscription that ended while the site is
 * still 'activa' — online and unpaid, someone has to act.)
 */
const isClosed = (t: BillingTimeline): number => Number(t.state === "paused");

/** Open accounts first, soonest due first (overdue on top), no due date last; then by name. */
function byDue(a: BillingTimeline, b: BillingTimeline): number {
  const closed = isClosed(a) - isClosed(b);
  if (closed !== 0) return closed;
  if (a.dueDate !== b.dueDate) {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate < b.dueDate ? -1 : 1;
  }
  return a.business.localeCompare(b.business, "es");
}

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const now = new Date();
    const [clients, settings] = await Promise.all([loadClients(), loadPaySettings()]);
    const messages = await loadPaymentMessages(clients.map((c) => c.id));

    const stripe = !!settings?.pay_link?.trim();
    const paypalLink = settings?.paypal_link?.trim() || DEFAULT_PAYPAL_LINK;
    // The scheduler's own rule (Stripe or PayPal on /pagar): payment reminders are held without it.
    const payable = hasPaymentMethod(settings);

    const timelines: BillingTimeline[] = [];
    const info: Record<string, BillingClientInfo> = {};
    for (const s of clients) {
      try {
        const t = billingTimeline(s, messages.get(s.id) ?? [], now, { hasPaymentMethod: payable });
        timelines.push(t);
        info[s.id] = {
          status: s.status,
          country: signupCountry(s),
          optedOut: !!s.opted_out_at,
          noWhatsapp: !!s.no_whatsapp_at,
          declined: !!s.declined_at,
          counts: billingSummary([t], now),
        };
      } catch (rowError) {
        // One bad row must not blank the whole view: log it and keep the rest.
        console.error("[WebGratis:admin:billing] timeline", s.id, rowError);
      }
    }
    timelines.sort(byDue);

    const payload: BillingPayload = {
      generatedAt: now.toISOString(),
      today: svDate(now),
      monthly: MONTHLY_PRICE_USD,
      freeDays: FREE_DAYS,
      stripe,
      paypalLink,
      hasPaymentMethod: payable,
      summary: billingSummary(timelines, now),
      timelines,
      clients: info,
    };
    return ok(payload);
  } catch (error) {
    console.error("[WebGratis:admin:billing]", error);
    return fail(500, "server_error");
  }
}
