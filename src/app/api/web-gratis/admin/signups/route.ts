/**
 * GET /api/web-gratis/admin/signups?view=nuevo&q=&country=SV&page=0 — ops board list.
 * Returns one page of rows for a tab (optionally one country: SV | CO | OTHER),
 * per-country counts for the tab, board stats, settings, 1-hour signed links for
 * logos / photos / documents, file sizes for documents, referrer names, each
 * client's WhatsApp log (newest 25) and referral credits.
 * Bearer WEB_GRATIS_ADMIN_TOKEN.
 */
import {
  BOARD_COUNTRIES,
  BOARD_VIEWS,
  countryOrFilter,
  documentPathsOf,
  normalizeOpsRow,
  parseBoardCountry,
  requireAdmin,
  statusesFor,
  type BoardCountry,
  type BoardView,
  type OpsSignup,
} from "@/lib/web-gratis/admin";
import { fail, ok } from "@/lib/web-gratis/http";
import { boardStats } from "@/lib/web-gratis/outbox";
import { CREDITS_TABLE } from "@/lib/web-gratis/payments";
import { getDb, SETTINGS_TABLE, SIGNUPS_TABLE, storage } from "@/lib/web-gratis/server";
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

/** Size / type of a stored file (from the storage listing). */
interface FileInfo {
  size: number | null;
  mime: string | null;
}

/** PostgREST `or` filter for the search box (input already restricted to safe characters). */
function searchFilter(q: string): string {
  const like = `%${q}%`;
  return `business_name.ilike.${like},whatsapp.ilike.${like},city.ilike.${like},business_type.ilike.${like},referral_code.ilike.${like},contact_email.ilike.${like}`;
}

/** Sizes of the files in the folders of signups that sent documents (one listing per folder). */
async function documentFileInfo(rows: OpsSignup[]): Promise<Record<string, FileInfo>> {
  const out: Record<string, FileInfo> = {};
  const withDocs = rows.filter((r) => documentPathsOf(r).length > 0);
  await Promise.all(
    withDocs.map(async (r) => {
      try {
        const wanted = new Set(documentPathsOf(r));
        const { data, error } = await storage().list(r.id, { limit: 100 });
        if (error) throw error;
        for (const f of data ?? []) {
          const path = `${r.id}/${f.name}`;
          if (!wanted.has(path)) continue;
          const meta: Record<string, unknown> = f.metadata ?? {};
          out[path] = {
            size: typeof meta.size === "number" ? meta.size : null,
            mime: typeof meta.mimetype === "string" ? meta.mimetype : null,
          };
        }
      } catch (error) {
        console.error("[WebGratis:admin:list] document sizes", r.id, error);
      }
    }),
  );
  return out;
}

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const params = new URL(request.url).searchParams;
  const viewParam = params.get("view") ?? "nuevo";
  const view: BoardView = (BOARD_VIEWS as readonly string[]).includes(viewParam) ? (viewParam as BoardView) : "nuevo";
  const page = Math.max(0, Math.min(500, Number.parseInt(params.get("page") ?? "0", 10) || 0));
  const country = parseBoardCountry(params.get("country"));
  // PostgREST `or` syntax breaks on commas/parens/quotes — keep search to safe characters
  // (dots stay: an e-mail search like "tita@gmail.com" must still match contact_email).
  const q = (params.get("q") ?? "").replace(/[^\p{L}\p{N} +@._-]/gu, "").trim().slice(0, 60);

  try {
    const db = getDb();
    const statuses = statusesFor(view);
    let query = db.from(SIGNUPS_TABLE).select("*", { count: "exact" });
    if (statuses) query = query.in("status", statuses);
    if (q) query = query.or(searchFilter(q));
    if (country) query = query.or(countryOrFilter(country));
    // New requests oldest-first (work the queue in order); everything else most-recent-first.
    query =
      view === "nuevo"
        ? query.order("submitted_at", { ascending: true, nullsFirst: false })
        : query.order("updated_at", { ascending: false });
    const { data, error, count } = await query.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = ((data ?? []) as OpsSignup[]).map(normalizeOpsRow);

    /** Rows of this tab (and search) in one country — for the country filter's counts. */
    const countFor = async (c: BoardCountry): Promise<number> => {
      let cq = db.from(SIGNUPS_TABLE).select("id", { count: "exact", head: true }).or(countryOrFilter(c));
      if (statuses) cq = cq.in("status", statuses);
      if (q) cq = cq.or(searchFilter(q));
      const { count: n, error: countError } = await cq;
      if (countError) throw countError;
      return n ?? 0;
    };

    const ids = rows.map((r) => r.id);
    const [stats, settingsRes, logRes, creditRes, countryCountList, fileInfo] = await Promise.all([
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
      Promise.all(BOARD_COUNTRIES.map((c) => countFor(c))).catch((countError: unknown) => {
        console.error("[WebGratis:admin:list] country counts", countError);
        return null;
      }),
      documentFileInfo(rows),
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
      const { data: named, error: namedError } = await db.from(SIGNUPS_TABLE).select("id, business_name").in("id", creditIds);
      if (namedError) console.error("[WebGratis:admin:list] credit names", namedError);
      for (const n of (named ?? []) as { id: string; business_name: string }[]) names[n.id] = n.business_name;
    }
    const credits = creditRows.map((c) => ({
      ...c,
      referrer_name: names[c.referrer_id] ?? "—",
      referred_name: names[c.referred_id] ?? "—",
    }));

    // One batch of 1-hour signed links for every logo, photo and document on the page.
    const paths = rows.flatMap((r) => [...r.logo_paths, ...r.photo_paths, ...r.document_paths]);
    const links: Record<string, string> = {};
    if (paths.length) {
      const { data: signed, error: signError } = await storage().createSignedUrls(paths, 60 * 60);
      if (signError) console.error("[WebGratis:admin:list] signed links", signError);
      for (const s of signed ?? []) if (s.path && s.signedUrl) links[s.path] = s.signedUrl;
    }

    const refIds = [...new Set(rows.map((r) => r.referred_by_id).filter((id): id is string => !!id))];
    const referrers: Record<string, { name: string; code: string }> = {};
    if (refIds.length) {
      const { data: refs, error: refError } = await db.from(SIGNUPS_TABLE).select("id, business_name, referral_code").in("id", refIds);
      if (refError) console.error("[WebGratis:admin:list] referrers", refError);
      for (const r of (refs ?? []) as { id: string; business_name: string; referral_code: string }[]) {
        referrers[r.id] = { name: r.business_name, code: r.referral_code };
      }
    }

    const countryCounts: Record<BoardCountry, number> | null = countryCountList
      ? { SV: countryCountList[0], CO: countryCountList[1], OTHER: countryCountList[2] }
      : null;

    return ok({
      view,
      page,
      pageSize: PAGE_SIZE,
      total: count ?? rows.length,
      country,
      countryCounts,
      rows,
      stats,
      settings: settingsRes.data ?? { delivery_days: null, high_demand: false, pay_link: null, demo_link: null, paypal_link: null },
      links,
      fileInfo,
      referrers,
      messages,
      credits,
    });
  } catch (error) {
    console.error("[WebGratis:admin:list]", error);
    return fail(500, "server_error");
  }
}
