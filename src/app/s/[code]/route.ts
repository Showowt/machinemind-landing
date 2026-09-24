/**
 * GET /s/<code> — the "Ver mi web" button of the site-ready template.
 * 302 to the client's live site when it exists; otherwise to a friendly
 * "su web está en camino" page. Never a 404 for a real client.
 */
import { NextResponse } from "next/server";
import { findSignupByCode } from "@/lib/web-gratis/server";

export const dynamic = "force-dynamic";

function liveUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const origin = new URL(request.url).origin;
  const noStore = { "Cache-Control": "no-store" };
  try {
    const signup = await findSignupByCode(code);
    const target = signup && !["descartada", "cancelada"].includes(signup.status) ? liveUrl(signup.site_url) : null;
    if (target) return NextResponse.redirect(target, { status: 302, headers: noStore });
    return NextResponse.redirect(new URL(`/s/${encodeURIComponent(code.toUpperCase())}/pronto`, origin), {
      status: 302,
      headers: noStore,
    });
  } catch (error) {
    console.error("[WebGratis:s]", code, error);
    return NextResponse.redirect(new URL(`/s/${encodeURIComponent(code.toUpperCase())}/pronto`, origin), {
      status: 302,
      headers: noStore,
    });
  }
}
