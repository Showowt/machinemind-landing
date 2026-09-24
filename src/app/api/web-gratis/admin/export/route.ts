/**
 * GET /api/web-gratis/admin/export?view=todas — CSV of signups (UTF-8 with BOM
 * so Excel/Sheets keep accents). Bearer token.
 */
import { BOARD_VIEWS, requireAdmin, statusesFor, type BoardView } from "@/lib/web-gratis/admin";
import { referralLink } from "@/lib/web-gratis/config";
import { fail } from "@/lib/web-gratis/http";
import { getDb, SIGNUPS_TABLE, type WebGratisSignup } from "@/lib/web-gratis/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const COLUMNS: [string, (r: WebGratisSignup & Record<string, unknown>) => unknown][] = [
  ["estado", (r) => r.status],
  ["negocio", (r) => r.business_name],
  ["rubro", (r) => r.business_type],
  ["ciudad", (r) => r.city],
  ["whatsapp", (r) => r.whatsapp],
  ["servicios", (r) => r.services.join("; ")],
  ["diferencia", (r) => r.differentiator],
  ["horario", (r) => r.hours],
  ["instagram", (r) => r.instagram],
  ["facebook", (r) => r.facebook],
  ["estilo", (r) => r.style],
  ["quiere", (r) => r.site_goal],
  ["fotos", (r) => r.photo_paths.length],
  ["logo", (r) => (r.logo_paths.length ? "sí" : "no")],
  ["codigo_referido", (r) => r.referral_code],
  ["enlace_referido", (r) => referralLink(r.referral_code)],
  ["referido_por_id", (r) => r.referred_by_id],
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
  ["notas", (r) => r.notes],
];

function cell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  // Quote everything; neutralise spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const viewParam = new URL(request.url).searchParams.get("view") ?? "todas";
  const view: BoardView = (BOARD_VIEWS as readonly string[]).includes(viewParam) ? (viewParam as BoardView) : "todas";
  try {
    const statuses = statusesFor(view);
    const all: WebGratisSignup[] = [];
    for (let from = 0; from < 50_000; from += 1000) {
      let query = getDb().from(SIGNUPS_TABLE).select("*").order("created_at", { ascending: true });
      if (statuses) query = query.in("status", statuses);
      const { data, error } = await query.range(from, from + 999);
      if (error) throw error;
      all.push(...((data ?? []) as WebGratisSignup[]));
      if (!data || data.length < 1000) break;
    }
    const lines = [
      COLUMNS.map(([h]) => cell(h)).join(","),
      ...all.map((r) => COLUMNS.map(([, get]) => cell(get(r as WebGratisSignup & Record<string, unknown>))).join(",")),
    ];
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(`﻿${lines.join("\r\n")}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="web-gratis-${view}-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[WebGratis:admin:export]", error);
    return fail(500, "server_error");
  }
}
