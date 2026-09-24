/**
 * GET /api/web-gratis/config — public, cached: the delivery promise and the
 * high-demand notice the /web page shows. Never exposes the payment link.
 */
import { fail, ok } from "@/lib/web-gratis/http";
import { getDb } from "@/lib/web-gratis/server";

export async function GET() {
  try {
    const { data, error } = await getDb()
      .from("web_gratis_settings")
      .select("delivery_days, high_demand")
      .eq("id", 1)
      .single();
    if (error) throw error;
    return ok(
      { deliveryDays: (data?.delivery_days as number | null) ?? null, highDemand: !!data?.high_demand },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  } catch (error) {
    console.error("[WebGratis:config]", error);
    return fail(500, "server_error");
  }
}
