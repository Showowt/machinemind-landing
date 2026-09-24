/**
 * PATCH /api/web-gratis/admin/signups/:id — move a signup through the pipeline.
 *
 * Status changes stamp their lifecycle column once (delivered_at + free_until,
 * shared_at, activated_at). `touch` records that a scripted WhatsApp message was
 * opened; `confirmed` marks the "¡Recibido!" confirmation as sent. Bearer token.
 */
import { z } from "zod";
import { requireAdmin } from "@/lib/web-gratis/admin";
import { FREE_DAYS } from "@/lib/web-gratis/config";
import { fail, ok } from "@/lib/web-gratis/http";
import { getDb, SIGNUPS_TABLE } from "@/lib/web-gratis/server";

const STATUSES = [
  "nuevo",
  "en_construccion",
  "entregada",
  "compartida",
  "activa",
  "pausada",
  "cancelada",
  "descartada",
] as const;

const patchSchema = z.object({
  status: z.enum(STATUSES).optional(),
  siteUrl: z.union([z.url({ protocol: /^https?$/ }).max(300), z.literal(""), z.null()]).optional(),
  notes: z.union([z.string().max(2000), z.null()]).optional(),
  touch: z.string().regex(/^[a-z0-9_]{2,40}$/).optional(),
  confirmed: z.literal(true).optional(),
});

function svDatePlus(days: number): string {
  const sv = new Date(Date.now() - 6 * 60 * 60 * 1000); // El Salvador is UTC-6, no DST
  sv.setUTCDate(sv.getUTCDate() + days);
  return sv.toISOString().slice(0, 10);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return fail(400, "invalid");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid");
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return fail(400, "invalid", parsed.error.issues[0]?.message);
  const patch = parsed.data;

  try {
    const db = getDb();
    const { data: current, error: readError } = await db
      .from(SIGNUPS_TABLE)
      .select("id, status, delivered_at, free_until, shared_at, activated_at, confirmed_at")
      .eq("id", id)
      .maybeSingle();
    if (readError) throw readError;
    if (!current) return fail(404, "draft_not_found");

    const now = new Date().toISOString();
    const update: Record<string, unknown> = {};
    if (patch.status) {
      update.status = patch.status;
      if (patch.status === "entregada" && !current.delivered_at) {
        update.delivered_at = now;
        if (!current.free_until) update.free_until = svDatePlus(FREE_DAYS);
      }
      if (patch.status === "compartida" && !current.shared_at) update.shared_at = now;
      if (patch.status === "activa" && !current.activated_at) update.activated_at = now;
    }
    if (patch.siteUrl !== undefined) update.site_url = patch.siteUrl || null;
    if (patch.notes !== undefined) update.notes = patch.notes?.trim() || null;
    if (patch.touch) {
      update.last_touch_at = now;
      update.last_touch_kind = patch.touch;
    }
    if (patch.confirmed && !current.confirmed_at) update.confirmed_at = now;
    if (Object.keys(update).length === 0) return ok({ id, unchanged: true });

    const { data, error } = await db.from(SIGNUPS_TABLE).update(update).eq("id", id).select("*").single();
    if (error) {
      // 23514 = a DB guardrail (e.g. an unfinished draft can't be marked submitted).
      if (error.code === "23514") return fail(409, "invalid", "Ese cambio no es válido para esta solicitud (le faltan datos del formulario).");
      if (error.code === "23505") return fail(409, "duplicate", "Ya hay otra solicitud activa para este negocio y WhatsApp.");
      throw error;
    }
    return ok(data);
  } catch (error) {
    console.error("[WebGratis:admin:patch]", error);
    return fail(500, "server_error");
  }
}
