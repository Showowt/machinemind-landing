/**
 * GET /api/web-gratis/ref?code=XXXXXX — name of the business behind a referral
 * link, so the page can say "{Negocio} le recomendó". Returns only the public
 * business name; drafts and cancelled rows resolve to null.
 */
import { REFERRAL_CODE_RE } from "@/lib/web-gratis/config";
import { fail, ok } from "@/lib/web-gratis/http";
import { findReferrer } from "@/lib/web-gratis/server";

export async function GET(request: Request) {
  const code = (new URL(request.url).searchParams.get("code") ?? "").trim().toUpperCase();
  if (!REFERRAL_CODE_RE.test(code)) return fail(400, "invalid");
  try {
    const referrer = await findReferrer(code);
    return ok(referrer ? { name: referrer.business_name } : null, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    console.error("[WebGratis:ref]", error);
    return fail(500, "server_error");
  }
}
