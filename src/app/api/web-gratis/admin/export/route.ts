/**
 * GET /api/web-gratis/admin/export?view=todas&country=CO — CSV of signups
 * (UTF-8 with BOM so Excel/Sheets keep accents), optionally one country
 * (SV | CO | OTHER). Includes the country, the business details added on
 * 2026-09-24 (current website, address, e-mail, "algo más") and the documents
 * they sent (count + storage paths). Bearer token.
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
import { referralLink } from "@/lib/web-gratis/config";
import { fail } from "@/lib/web-gratis/http";
import { getDb, SIGNUPS_TABLE } from "@/lib/web-gratis/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const COUNTRY_NAME: Record<"SV" | "CO" | "OTHER", string> = { SV: "El Salvador", CO: "Colombia", OTHER: "Otro" };

const COLUMNS: [string, (r: OpsSignup) => unknown][] = [
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

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const params = new URL(request.url).searchParams;
  const viewParam = params.get("view") ?? "todas";
  const view: BoardView = (BOARD_VIEWS as readonly string[]).includes(viewParam) ? (viewParam as BoardView) : "todas";
  const country = parseBoardCountry(params.get("country"));
  try {
    const statuses = statusesFor(view);
    const all: OpsSignup[] = [];
    for (let from = 0; from < 50_000; from += 1000) {
      let query = getDb().from(SIGNUPS_TABLE).select("*").order("created_at", { ascending: true });
      if (statuses) query = query.in("status", statuses);
      if (country) query = query.or(countryOrFilter(country));
      const { data, error } = await query.range(from, from + 999);
      if (error) throw error;
      all.push(...((data ?? []) as OpsSignup[]));
      if (!data || data.length < 1000) break;
    }
    const lines = [COLUMNS.map(([h]) => cell(h)).join(","), ...all.map((r) => COLUMNS.map(([, get]) => cell(get(r))).join(","))];
    const stamp = new Date().toISOString().slice(0, 10);
    const suffix = country ? `-${country.toLowerCase()}` : "";
    return new Response(`﻿${lines.join("\r\n")}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="web-gratis-${view}${suffix}-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[WebGratis:admin:export]", error);
    return fail(500, "server_error");
  }
}
