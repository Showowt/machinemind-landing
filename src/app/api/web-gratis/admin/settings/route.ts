/**
 * PUT /api/web-gratis/admin/settings — capacity promise + day-30 payment link.
 * deliveryDays null = the page says "pocos días"; highDemand shows a queue
 * notice on /web (capture never stops). Bearer token.
 */
import { z } from "zod";
import { requireAdmin } from "@/lib/web-gratis/admin";
import { fail, ok } from "@/lib/web-gratis/http";
import { getDb } from "@/lib/web-gratis/server";

const settingsSchema = z.object({
  deliveryDays: z.union([z.number().int().min(1).max(60), z.null()]),
  highDemand: z.boolean(),
  payLink: z.union([z.url({ protocol: /^https$/ }).max(500), z.literal(""), z.null()]),
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
      })
      .eq("id", 1)
      .select("delivery_days, high_demand, pay_link")
      .single();
    if (error) throw error;
    return ok(data);
  } catch (error) {
    console.error("[WebGratis:admin:settings]", error);
    return fail(500, "server_error");
  }
}
