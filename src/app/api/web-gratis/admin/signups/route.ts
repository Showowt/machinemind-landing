/**
 * GET /api/web-gratis/admin/signups?view=nuevo&q=&page=0 — ops board list.
 * Returns one page of rows for a tab, board stats, settings, 1-hour signed
 * thumbnail links, referrer names, each client's WhatsApp log (newest 25) and
 * referral credits. Bearer WEB_GRATIS_ADMIN_TOKEN.
 */
import { BOARD_VIEWS, requireAdmin, statusesFor, type BoardView } from "@/lib/web-gratis/admin";
import { fail, ok } from "@/lib/web-gratis/http";
import { boardStats } from "@/lib/web-gratis/outbox";
import { CREDITS_TABLE } from "@/lib/web-gratis/payments";
import { getDb, SETTINGS_TABLE, SIGNUPS_TABLE, storage, type WebGratisSignup } from "@/lib/web-gratis/server";
import { MESSAGES_TABLE } from "@/lib/web-gratis/whatsapp";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 40;
const LOG_PER_CLIENT = 25;

interface LogRow {
  id: number;
  signup_id: string;
  direction: "inbound" | "outbound";
  template: string | null;
  source: string;
  msg_type: string | null;
  body: string | null;
  status: string;
  attempts: number;
  next_attempt_at: string | null;
  last_error_code: string | null;
  last_error: string | null;
  received_at: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
}

interface CreditRow {
  id: number;
  referrer_id: string;
  referred_id: string;
  months: number;
  applied_at: string | null;
  created_at: string;
}

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const params = new URL(request.url).searchParams;
  const viewParam = params.get("view") ?? "nuevo";
  const view: BoardView = (BOARD_VIEWS as readonly string[]).includes(viewParam) ? (viewParam as BoardView) : "nuevo";
  const page = Math.max(0, Math.min(500, Number.parseInt(params.get("page") ?? "0", 10) || 0));
  // PostgREST `or` syntax breaks on commas/parens — keep search to safe characters.
  const q = (params.get("q") ?? "").replace(/[^\p{L}\p{N} +@_-]/gu, "").trim().slice(0, 60);

  try {
    const db = getDb();
    let query = db.from(SIGNUPS_TABLE).select("*", { count: "exact" });
    const statuses = statusesFor(view);
    if (statuses) query = query.in("status", statuses);
    if (q) {
      const like = `%${q}%`;
      query = query.or(
        `business_name.ilike.${like},whatsapp.ilike.${like},city.ilike.${like},business_type.ilike.${like},referral_code.ilike.${like}`,
      );
    }
    // New requests oldest-first (work the queue in order); everything else most-recent-first.
    query =
      view === "nuevo"
        ? query.order("submitted_at", { ascending: true, nullsFirst: false })
        : query.order("updated_at", { ascending: false });
    const { data, error, count } = await query.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data ?? []) as WebGratisSignup[];

    const ids = rows.map((r) => r.id);
    const [stats, settingsRes, logRes, creditRes] = await Promise.all([
      boardStats(),
      db.from(SETTINGS_TABLE).select("delivery_days, high_demand, pay_link, demo_link, paypal_link").eq("id", 1).single(),
      ids.length
        ? db
            .from(MESSAGES_TABLE)
            .select("id, signup_id, direction, template, source, msg_type, body, status, attempts, next_attempt_at, last_error_code, last_error, received_at, sent_at, delivered_at, read_at, created_at")
            .in("signup_id", ids)
            .order("created_at", { ascending: false })
            .limit(ids.length * LOG_PER_CLIENT)
        : Promise.resolve({ data: [] as LogRow[], error: null }),
      ids.length
        ? db
            .from(CREDITS_TABLE)
            .select("id, referrer_id, referred_id, months, applied_at, created_at")
            .or(`referrer_id.in.(${ids.join(",")}),referred_id.in.(${ids.join(",")})`)
        : Promise.resolve({ data: [] as CreditRow[], error: null }),
    ]);
    if (logRes.error) console.error("[WebGratis:admin:list] whatsapp log", logRes.error);
    if (creditRes.error) console.error("[WebGratis:admin:list] credits", creditRes.error);

    const messages: Record<string, LogRow[]> = {};
    for (const m of (logRes.data ?? []) as LogRow[]) {
      const list = (messages[m.signup_id] ??= []);
      if (list.length < LOG_PER_CLIENT) list.push(m);
    }
    const creditRows = (creditRes.data ?? []) as CreditRow[];
    const creditIds = [...new Set(creditRows.flatMap((c) => [c.referrer_id, c.referred_id]))];
    const names: Record<string, string> = {};
    if (creditIds.length) {
      const { data: named } = await db.from(SIGNUPS_TABLE).select("id, business_name").in("id", creditIds);
      for (const n of (named ?? []) as { id: string; business_name: string }[]) names[n.id] = n.business_name;
    }
    const credits = creditRows.map((c) => ({
      ...c,
      referrer_name: names[c.referrer_id] ?? "—",
      referred_name: names[c.referred_id] ?? "—",
    }));

    const paths = rows.flatMap((r) => [...r.logo_paths, ...r.photo_paths]);
    const links: Record<string, string> = {};
    if (paths.length) {
      const { data: signed } = await storage().createSignedUrls(paths, 60 * 60);
      for (const s of signed ?? []) if (s.path && s.signedUrl) links[s.path] = s.signedUrl;
    }

    const refIds = [...new Set(rows.map((r) => r.referred_by_id).filter((id): id is string => !!id))];
    const referrers: Record<string, { name: string; code: string }> = {};
    if (refIds.length) {
      const { data: refs } = await db.from(SIGNUPS_TABLE).select("id, business_name, referral_code").in("id", refIds);
      for (const r of (refs ?? []) as { id: string; business_name: string; referral_code: string }[]) {
        referrers[r.id] = { name: r.business_name, code: r.referral_code };
      }
    }

    return ok({
      view,
      page,
      pageSize: PAGE_SIZE,
      total: count ?? rows.length,
      rows,
      stats,
      settings: settingsRes.data ?? { delivery_days: null, high_demand: false, pay_link: null, demo_link: null, paypal_link: null },
      links,
      referrers,
      messages,
      credits,
    });
  } catch (error) {
    console.error("[WebGratis:admin:list]", error);
    return fail(500, "server_error");
  }
}
