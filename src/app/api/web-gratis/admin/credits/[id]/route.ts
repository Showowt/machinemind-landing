/**
 * PATCH /api/web-gratis/admin/credits/:id — mark a referral credit (1 free month
 * per referred business that paid) as applied. Bearer WEB_GRATIS_ADMIN_TOKEN.
 *
 * How the month is given depends on how the referrer pays:
 *   - PayPal / cash: applied here — their "pagado hasta" moves forward by the
 *     credit's months, so the board won't ask them for that month.
 *   - Stripe: the team applies a 100% coupon for one month to the subscription in
 *     Stripe first, then marks it applied here (nothing to change on our side).
 * Body: { applied: true, note?: string }.
 */
import { z } from "zod";
import { requireAdmin } from "@/lib/web-gratis/admin";
import { fail, ok } from "@/lib/web-gratis/http";
import { CREDITS_TABLE } from "@/lib/web-gratis/payments";
import { getDb, SIGNUPS_TABLE, svDate } from "@/lib/web-gratis/server";
import { svDateOf } from "@/lib/web-gratis/whatsapp";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  applied: z.literal(true),
  note: z.string().trim().max(500).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const { id } = await params;
  if (!/^\d{1,18}$/.test(id)) return fail(400, "invalid");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid");
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return fail(400, "invalid", parsed.error.issues[0]?.message);

  try {
    const db = getDb();
    const now = new Date();
    const { data: credit, error } = await db
      .from(CREDITS_TABLE)
      .update({ applied_at: now.toISOString(), ...(parsed.data.note ? { note: parsed.data.note } : {}) })
      .eq("id", Number(id))
      .is("applied_at", null)
      .select("id, referrer_id, referred_id, months, applied_at")
      .maybeSingle();
    if (error) throw error;
    if (!credit) return fail(409, "invalid", "Ese crédito no existe o ya estaba aplicado.");

    const { data: referrer, error: refError } = await db
      .from(SIGNUPS_TABLE)
      .select("id, status, paid_via, paid_through")
      .eq("id", credit.referrer_id as string)
      .maybeSingle();
    if (refError) throw refError;

    let paidThrough: string | null = (referrer?.paid_through as string | null | undefined) ?? null;
    let message = "Crédito marcado como aplicado.";
    if (referrer && referrer.status === "activa" && referrer.paid_via !== "stripe") {
      const today = svDate(now);
      const base = paidThrough && paidThrough > today ? paidThrough : today;
      paidThrough = svDateOf(base, 30 * (credit.months as number));
      const { error: extendError } = await db.from(SIGNUPS_TABLE).update({ paid_through: paidThrough }).eq("id", referrer.id as string);
      if (extendError) throw extendError;
      message = `Crédito aplicado: pagado hasta ${paidThrough}.`;
    } else if (referrer?.paid_via === "stripe") {
      message = "Crédito marcado como aplicado (recuerde el cupón de 1 mes en su suscripción de Stripe).";
    }
    return ok({ credit, paidThrough, message });
  } catch (error) {
    console.error("[WebGratis:admin:credits]", id, error);
    return fail(500, "server_error");
  }
}
