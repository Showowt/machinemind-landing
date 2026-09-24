/**
 * GET /api/web-gratis/admin/signups?view=nuevo&q=&page=0 — ops board list.
 * Returns one page of rows for a tab, board stats, settings, 1-hour signed
 * thumbnail links and referrer names. Bearer WEB_GRATIS_ADMIN_TOKEN.
 */
import { BOARD_VIEWS, requireAdmin, statusesFor, type BoardView } from "@/lib/web-gratis/admin";
import { fail, ok } from "@/lib/web-gratis/http";
import { boardStats } from "@/lib/web-gratis/outbox";
import { getDb, SIGNUPS_TABLE, storage, type WebGratisSignup } from "@/lib/web-gratis/server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 40;

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

    const [stats, settingsRes] = await Promise.all([
      boardStats(),
      db.from("web_gratis_settings").select("delivery_days, high_demand, pay_link").eq("id", 1).single(),
    ]);

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
      settings: settingsRes.data ?? { delivery_days: null, high_demand: false, pay_link: null },
      links,
      referrers,
    });
  } catch (error) {
    console.error("[WebGratis:admin:list]", error);
    return fail(500, "server_error");
  }
}
