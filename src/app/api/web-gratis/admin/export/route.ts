/**
 * GET /api/web-gratis/admin/export?view=todas&country=CO — CSV of signups
 * (UTF-8 with BOM so Excel/Sheets keep accents), optionally one country
 * (SV | CO | OTHER). Includes the country, the business details added on
 * 2026-09-24 (current website, address, e-mail, "algo más"), the documents
 * they sent (count + storage paths) and, from billing.ts (the same timeline as
 * the board's "Cobros"), each client's billing state, day N of the free month,
 * due date and next automatic reminder.
 *
 * view=cobros exports exactly the Cobros set — delivered / paying / paused
 * sites and requests that paid before delivery, never test rows ("ZZ …") —
 * soonest due first. Bearer token.
 */
import {
  BOARD_VIEWS,
  countryOrFilter,
  documentPathsOf,
  parseBoardCountry,
  requireAdmin,
  signupCountry,
  statusesFor,
  type BoardView,
  type OpsSignup,
} from "@/lib/web-gratis/admin";
import { billingTimeline, type BillingTimeline } from "@/lib/web-gratis/billing";
import { referralLink } from "@/lib/web-gratis/config";
import { fail } from "@/lib/web-gratis/http";
import { getDb, SETTINGS_TABLE, SIGNUPS_TABLE, svDate, type WebGratisSettings } from "@/lib/web-gratis/server";
import { hasPaymentMethod, PAYMENT_TEMPLATES } from "@/lib/web-gratis/templates";
import { isTestSignupName, MESSAGES_TABLE, type MessageRow } from "@/lib/web-gratis/whatsapp";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const COUNTRY_NAME: Record<"SV" | "CO" | "OTHER", string> = { SV: "El Salvador", CO: "Colombia", OTHER: "Otro" };

/** The board's Cobros tab (not a signup status). */
const COBROS_VIEW = "cobros";
/** Same client set as GET /api/web-gratis/admin/billing. */
const BILLING_ROWS_FILTER =
  "status.in.(entregada,compartida,activa,pausada),and(status.in.(nuevo,en_construccion),activated_at.not.is.null)";
/** Signup ids per messages query (short PostgREST URLs), and queries in flight at once. */
const ID_CHUNK = 100;
const PARALLEL = 4;
const MESSAGE_PAGE = 1000;
/** Safety stop for one chunk's message pages. */
const MAX_MESSAGE_ROWS = 100_000;

type Column = [string, (r: OpsSignup, t: BillingTimeline | undefined) => unknown];

const COLUMNS: Column[] = [
  ["estado", (r) => r.status],
  ["pais", (r) => COUNTRY_NAME[signupCountry(r)]],
  ["negocio", (r) => r.business_name],
  ["rubro", (r) => r.business_type],
  ["ciudad", (r) => r.city],
  ["whatsapp", (r) => r.whatsapp],
  ["servicios", (r) => r.services.join("; ")],
  ["diferencia", (r) => r.differentiator],
  ["horario", (r) => r.hours],
  ["instagram", (r) => r.instagram],
  ["facebook", (r) => r.facebook],
  ["web_actual", (r) => r.existing_website],
  ["direccion", (r) => r.address],
  ["correo", (r) => r.contact_email],
  ["estilo", (r) => r.style],
  ["quiere", (r) => r.site_goal],
  ["algo_mas", (r) => r.extra_notes],
  ["fotos", (r) => r.photo_paths.length],
  ["logo", (r) => (r.logo_paths.length ? "sí" : "no")],
  ["documentos", (r) => documentPathsOf(r).length],
  ["archivos_documentos", (r) => documentPathsOf(r).join("; ")],
  ["codigo_referido", (r) => r.referral_code],
  ["enlace_referido", (r) => referralLink(r.referral_code)],
  ["referido_por_id", (r) => r.referred_by_id],
  ["quien_lo_recomendo", (r) => r.referred_by_text],
  ["utm_source", (r) => r.utm_source],
  ["utm_campaign", (r) => r.utm_campaign],
  ["creado", (r) => r.created_at],
  ["enviado", (r) => r.submitted_at],
  ["confirmado", (r) => r.confirmed_at],
  ["entregado", (r) => r.delivered_at],
  ["gratis_hasta", (r) => r.free_until],
  ["web", (r) => r.site_url],
  ["compartida", (r) => r.shared_at],
  ["activada", (r) => r.activated_at],
  ["pago_por", (r) => r.paid_via],
  ["pagado_hasta", (r) => r.paid_through],
  // Billing timeline (billing.ts): what the scheduler will do next for this client.
  ["estado_cobro", (_r, t) => t?.state],
  ["dia_mes_gratis", (_r, t) => (t && t.day !== null ? `${t.day}/${t.freeDays}` : null)],
  ["vence", (_r, t) => t?.dueDate],
  ["dias_para_vencer", (_r, t) => t?.daysLeft],
  ["proximo_recordatorio", (_r, t) => t?.next?.label],
  ["proximo_recordatorio_fecha", (_r, t) => t?.next?.date],
  ["proximo_recordatorio_estado", (_r, t) => t?.next?.status],
  ["enlace_pago", (_r, t) => t?.payUrl],
  ["pausada", (r) => r.paused_at],
  ["recontactar_desde", (r) => r.recontact_after],
  ["dijo_que_no", (r) => r.declined_at],
  ["baja_whatsapp", (r) => r.opted_out_at],
  ["sin_whatsapp", (r) => r.no_whatsapp_at],
  ["consentimiento_whatsapp", (r) => r.whatsapp_consent_at],
  ["notas", (r) => r.notes],
];

function cell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  // Quote everything; neutralise spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** One chunk's payment asks, paged (PostgREST caps a response at 1000 rows; a cut would drop the newest). */
async function chunkPaymentMessages(group: string[]): Promise<MessageRow[]> {
  const all: MessageRow[] = [];
  for (let from = 0; from < MAX_MESSAGE_ROWS; from += MESSAGE_PAGE) {
    const { data, error } = await getDb()
      .from(MESSAGES_TABLE)
      .select("*")
      .in("signup_id", group)
      .in("template", [...PAYMENT_TEMPLATES])
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + MESSAGE_PAGE - 1);
    if (error) throw error;
    const page = (data ?? []) as MessageRow[];
    all.push(...page);
    if (page.length < MESSAGE_PAGE) break;
  }
  return all;
}

/**
 * The payment asks (the only templates billing.ts reads) of the signups that have a billing
 * history (delivered or paid), grouped by signup.
 */
async function templateMessages(rows: OpsSignup[]): Promise<Map<string, MessageRow[]>> {
  const ids = rows.filter((r) => r.delivered_at || r.activated_at).map((r) => r.id);
  const groups: string[][] = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK) groups.push(ids.slice(i, i + ID_CHUNK));
  const out = new Map<string, MessageRow[]>();
  for (let i = 0; i < groups.length; i += PARALLEL) {
    const pages = await Promise.all(groups.slice(i, i + PARALLEL).map(chunkPaymentMessages));
    for (const m of pages.flat()) {
      if (!m.signup_id) continue;
      const list = out.get(m.signup_id) ?? [];
      list.push(m);
      out.set(m.signup_id, list);
    }
  }
  return out;
}

/** Same rule as the scheduler: /pagar can take money (Stripe link, or PayPal — always has a default). */
async function paymentMethodSet(): Promise<boolean> {
  const { data, error } = await getDb().from(SETTINGS_TABLE).select("pay_link, paypal_link").eq("id", 1).maybeSingle();
  if (error) console.error("[WebGratis:admin:export] settings", error);
  return hasPaymentMethod((data as Pick<WebGratisSettings, "pay_link" | "paypal_link"> | null) ?? null);
}

/**
 * The Cobros order (same as GET /admin/billing): open accounts first, soonest due first (overdue
 * on top), no due date last; paused sites after them. A "cancelled" timeline in this set is a
 * Stripe subscription that ended on a site still 'activa' — open, someone has to act.
 */
function byDue(a: { t: BillingTimeline | undefined; r: OpsSignup }, b: { t: BillingTimeline | undefined; r: OpsSignup }): number {
  const closed = (x: BillingTimeline | undefined) => Number(x?.state === "paused");
  if (closed(a.t) !== closed(b.t)) return closed(a.t) - closed(b.t);
  const da = a.t?.dueDate ?? null;
  const dbd = b.t?.dueDate ?? null;
  if (da !== dbd) {
    if (!da) return 1;
    if (!dbd) return -1;
    return da < dbd ? -1 : 1;
  }
  return a.r.business_name.localeCompare(b.r.business_name, "es");
}

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const params = new URL(request.url).searchParams;
  const viewParam = params.get("view") ?? "todas";
  const cobros = viewParam === COBROS_VIEW;
  const view: BoardView = (BOARD_VIEWS as readonly string[]).includes(viewParam) ? (viewParam as BoardView) : "todas";
  const country = parseBoardCountry(params.get("country"));
  try {
    const statuses = statusesFor(view);
    const all: OpsSignup[] = [];
    for (let from = 0; from < 50_000; from += 1000) {
      let query = getDb().from(SIGNUPS_TABLE).select("*").order("created_at", { ascending: true });
      if (cobros) query = query.or(BILLING_ROWS_FILTER).not("business_name", "like", "ZZ %");
      else if (statuses) query = query.in("status", statuses);
      if (country) query = query.or(countryOrFilter(country));
      const { data, error } = await query.range(from, from + 999);
      if (error) throw error;
      all.push(...((data ?? []) as OpsSignup[]));
      if (!data || data.length < 1000) break;
    }
    const rows = cobros ? all.filter((r) => !isTestSignupName(r.business_name)) : all;

    // Billing columns: a failure leaves them empty (logged) instead of failing the whole export.
    const now = new Date();
    const timelines = new Map<string, BillingTimeline>();
    try {
      const [sends, payable] = await Promise.all([templateMessages(rows), paymentMethodSet()]);
      for (const r of rows) {
        try {
          timelines.set(r.id, billingTimeline(r, sends.get(r.id) ?? [], now, { hasPaymentMethod: payable }));
        } catch (rowError) {
          console.error("[WebGratis:admin:export] billing timeline", r.id, rowError);
        }
      }
    } catch (billingError) {
      console.error("[WebGratis:admin:export] billing", billingError);
    }

    let ordered = rows.map((r) => ({ r, t: timelines.get(r.id) }));
    if (cobros) ordered = ordered.sort(byDue);

    const lines = [COLUMNS.map(([h]) => cell(h)).join(","), ...ordered.map(({ r, t }) => COLUMNS.map(([, get]) => cell(get(r, t))).join(","))];
    // El Salvador date (the team's day), like every date in the billing columns.
    const stamp = svDate(now);
    const suffix = country ? `-${country.toLowerCase()}` : "";
    const name = cobros ? COBROS_VIEW : view;
    return new Response(`\uFEFF${lines.join("\r\n")}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="web-gratis-${name}${suffix}-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[WebGratis:admin:export]", error);
    return fail(500, "server_error");
  }
}
