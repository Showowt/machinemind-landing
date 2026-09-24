/**
 * PUT /api/web-gratis/admin/settings — capacity promise + payment/demo links.
 * deliveryDays null = the page says "pocos días"; highDemand shows a queue
 * notice on /web (capture never stops). payLink = Stripe Payment Link behind
 * /pagar/<code> (the day-28/30 reminders don't send without it); paypalLink =
 * the PayPal button there; demoLink = where /citas/<code> sends people (empty =
 * open the funnel WhatsApp chat). Bearer token.
 */
import { z } from "zod";
import { requireAdmin } from "@/lib/web-gratis/admin";
import { fail, ok } from "@/lib/web-gratis/http";
import { getDb } from "@/lib/web-gratis/server";

const httpsLink = z.union([z.url({ protocol: /^https$/ }).max(500), z.literal(""), z.null()]);

const settingsSchema = z.object({
  deliveryDays: z.union([z.number().int().min(1).max(60), z.null()]),
  highDemand: z.boolean(),
  payLink: httpsLink,
  demoLink: httpsLink.optional(),
  paypalLink: httpsLink.optional(),
});

export async function PUT(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid");
  }
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) return fail(400, "invalid", parsed.error.issues[0]?.message);
  try {
    const { data, error } = await getDb()
      .from("web_gratis_settings")
      .update({
        delivery_days: parsed.data.deliveryDays,
        high_demand: parsed.data.highDemand,
        pay_link: parsed.data.payLink || null,
        ...(parsed.data.demoLink !== undefined ? { demo_link: parsed.data.demoLink || null } : {}),
        ...(parsed.data.paypalLink !== undefined ? { paypal_link: parsed.data.paypalLink || null } : {}),
      })
      .eq("id", 1)
      .select("delivery_days, high_demand, pay_link, demo_link, paypal_link")
      .single();
    if (error) throw error;
    return ok(data);
  } catch (error) {
    console.error("[WebGratis:admin:settings]", error);
    return fail(500, "server_error");
  }
}
