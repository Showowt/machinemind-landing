/**
 * POST /api/web-gratis/admin/whatsapp — "Enviar / Reintentar" one template to
 * one client from the ops board. Bearer WEB_GRATIS_ADMIN_TOKEN.
 *
 * Same send path as the scheduler (Rewired bridge, ledger row per template), so
 * it can never double-send a template that already went out, it respects
 * opt-outs / "no" / the pay link, and it only sends inside the template's
 * window. A row whose last outcome is unknown needs `force: true` (the person
 * checked the chat and it didn't arrive).
 */
import { z } from "zod";
import { requireAdmin } from "@/lib/web-gratis/admin";
import { fail, ok } from "@/lib/web-gratis/http";
import { TEMPLATE_NAMES } from "@/lib/web-gratis/templates";
import { defaultWaDeps, sendTemplateManually } from "@/lib/web-gratis/whatsapp";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const bodySchema = z.object({
  signupId: z.uuid(),
  template: z.enum(TEMPLATE_NAMES),
  force: z.boolean().optional(),
});

const STATUS_FOR: Record<string, number> = {
  not_found: 404,
  not_eligible: 409,
  already_sent: 409,
  window_closed: 409,
  send_failed: 502,
  needs_confirm: 409,
};

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid");
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return fail(400, "invalid", parsed.error.issues[0]?.message);

  try {
    const result = await sendTemplateManually(parsed.data.signupId, parsed.data.template, defaultWaDeps(), {
      force: parsed.data.force === true,
    });
    if (!result.ok) return fail(STATUS_FOR[result.error] ?? 409, result.error, result.message);
    return ok({ status: result.status, message: result.message });
  } catch (error) {
    console.error("[WebGratis:admin:whatsapp]", parsed.data, error);
    return fail(500, "server_error", "No se pudo enviar. Intente de nuevo.");
  }
}
