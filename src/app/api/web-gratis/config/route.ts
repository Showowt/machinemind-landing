/**
 * GET /api/web-gratis/config — public, cached: the delivery promise, the
 * high-demand notice, and whether the conversion specialist is on shift
 * (drives the "la llamamos ya" vs "la llamamos mañana a las 9" copy on /web).
 * Never exposes the payment link.
 */
import { agentNextStart, agentOnDuty } from "@/lib/web-gratis/config";
import { fail, ok } from "@/lib/web-gratis/http";
import { agentScheduleOf, loadSettings } from "@/lib/web-gratis/server";

export async function GET() {
  try {
    const settings = await loadSettings();
    const schedule = agentScheduleOf(settings);
    return ok(
      {
        deliveryDays: settings.delivery_days,
        highDemand: settings.high_demand,
        onDuty: agentOnDuty(schedule),
        nextStart: agentNextStart(schedule),
      },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  } catch (error) {
    console.error("[WebGratis:config]", error);
    return fail(500, "server_error");
  }
}
