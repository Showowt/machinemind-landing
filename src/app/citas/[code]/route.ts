/**
 * GET /citas/<code> — the rescue template's "le muestro cómo se vería" link.
 * Goes to the booking demo configured on the ops board (settings.demo_link)
 * when there is one; otherwise opens the funnel WhatsApp chat with the request
 * already written, and the responder takes it from there.
 */
import { NextResponse } from "next/server";
import { MM_WHATSAPP } from "@/lib/web-gratis/config";
import { findSignupByCode, loadSettings } from "@/lib/web-gratis/server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const noStore = { "Cache-Control": "no-store" };
  let business: string | null = null;
  let demo: string | null = null;
  try {
    const [signup, settings] = await Promise.all([findSignupByCode(code), loadSettings()]);
    business = signup && !["descartada", "cancelada"].includes(signup.status) ? signup.business_name : null;
    demo = settings.demo_link && /^https:\/\//.test(settings.demo_link) ? settings.demo_link : null;
  } catch (error) {
    console.error("[WebGratis:citas]", code, error);
  }
  if (demo) return NextResponse.redirect(demo, { status: 302, headers: noStore });
  const text = business ? `Quiero ver la demo de citas para ${business}` : "Quiero ver la demo de citas";
  return NextResponse.redirect(`https://wa.me/${MM_WHATSAPP}?text=${encodeURIComponent(text)}`, {
    status: 302,
    headers: noStore,
  });
}
