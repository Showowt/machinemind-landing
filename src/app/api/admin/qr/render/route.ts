import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generateQRSVG, generateQRPNG } from "@/lib/qr/generator";

export const runtime = "nodejs";

function assertAdmin(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace("Bearer ", "").trim();
  const expected = process.env.ADMIN_TOKEN || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!expected || token !== expected) {
    throw new Error("unauthorized");
  }
}

export async function GET(req: NextRequest) {
  try {
    assertAdmin(req);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const format = (searchParams.get("format") || "svg").toLowerCase();
  const styleOverride = searchParams.get("style") || undefined;
  const sizeParam = Number(searchParams.get("size") || 0) || undefined;

  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: qr, error } = await supabase
    .from("qr_codes")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !qr) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const base = new URL(req.url).origin;
  const style = (styleOverride || qr.style || "luxury") as
    | "classic"
    | "luxury"
    | "framed"
    | "minimal";

  if (format === "png") {
    const buf = await generateQRPNG({
      slug: qr.slug,
      baseUrl: base,
      colors: qr.colors,
      size: sizeParam ?? 1200,
    });
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="MM_QR_${qr.slug}.png"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const svg = await generateQRSVG({
    slug: qr.slug,
    baseUrl: base,
    style,
    colors: qr.colors,
    size: sizeParam ?? 1200,
    centerText: "MM",
    cta: "SCAN FOR",
    subtitle: "MACHINEMIND",
  });

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="MM_QR_${qr.slug}_${style}.svg"`,
      "Cache-Control": "no-store",
    },
  });
}
