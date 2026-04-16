import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generateGiftCode } from "@/lib/qr/generator";

const FALLBACK_URL = "https://machinemindconsulting.com";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseUserAgent(ua: string | null) {
  if (!ua) return { device_type: null, browser: null, os: null };
  const lower = ua.toLowerCase();
  const device_type = /mobile|iphone|ipod|android.*mobile/.test(lower)
    ? "mobile"
    : /ipad|tablet/.test(lower)
      ? "tablet"
      : "desktop";
  const os = /iphone|ipad|ipod/.test(lower)
    ? "iOS"
    : /android/.test(lower)
      ? "Android"
      : /mac os/.test(lower)
        ? "macOS"
        : /windows/.test(lower)
          ? "Windows"
          : /linux/.test(lower)
            ? "Linux"
            : "Unknown";
  const browser = /edg\//.test(lower)
    ? "Edge"
    : /chrome/.test(lower)
      ? "Chrome"
      : /safari/.test(lower)
        ? "Safari"
        : /firefox/.test(lower)
          ? "Firefox"
          : "Unknown";
  return { device_type, browser, os };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const safeSlug = slug.toLowerCase().replace(/[^a-z0-9\-_]/g, "").slice(0, 32);

  if (!safeSlug) {
    return NextResponse.redirect(FALLBACK_URL, 302);
  }

  const supabase = createServiceClient();

  const { data: qr, error } = await supabase
    .from("qr_codes")
    .select("*")
    .eq("slug", safeSlug)
    .maybeSingle();

  if (error || !qr || !qr.active) {
    return NextResponse.redirect(FALLBACK_URL, 302);
  }

  if (qr.expires_at && new Date(qr.expires_at) < new Date()) {
    return NextResponse.redirect(FALLBACK_URL, 302);
  }

  if (
    qr.max_redemptions != null &&
    qr.redemption_count >= qr.max_redemptions
  ) {
    return NextResponse.redirect(qr.destination || FALLBACK_URL, 302);
  }

  const ua = request.headers.get("user-agent");
  const { device_type, browser, os } = parseUserAgent(ua);
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    null;
  const ip_country = request.headers.get("x-vercel-ip-country") || null;
  const ip_city = request.headers.get("x-vercel-ip-city") || null;
  const referer = request.headers.get("referer");

  let destination = qr.destination || FALLBACK_URL;
  let giftCode: string | null = null;
  let giftAwarded = false;

  if (qr.gift_config || qr.discount_config) {
    const config = qr.gift_config || qr.discount_config;
    giftCode = generateGiftCode((config?.prefix as string) || "MM");

    const expiresAt = config?.expires_in_days
      ? new Date(
          Date.now() + Number(config.expires_in_days) * 864e5,
        ).toISOString()
      : null;

    await supabase.from("qr_gifts").insert({
      qr_id: qr.id,
      gift_code: giftCode,
      gift_type: qr.gift_config ? "gift" : "discount",
      gift_value: String(config?.value ?? config?.label ?? "gift"),
      metadata: config,
      expires_at: expiresAt,
    });

    giftAwarded = true;
    const sep = destination.includes("?") ? "&" : "?";
    destination = `${destination}${sep}gift=${encodeURIComponent(giftCode)}&src=qr&slug=${encodeURIComponent(safeSlug)}`;
  }

  const { data: scan } = await supabase
    .from("qr_scans")
    .insert({
      qr_id: qr.id,
      slug: safeSlug,
      user_agent: ua,
      ip_address: ip,
      ip_country,
      ip_city,
      referer,
      device_type,
      browser,
      os,
      destination_served: destination,
      gift_awarded: giftAwarded,
      gift_code: giftCode,
    })
    .select("id")
    .single();

  if (giftAwarded && giftCode && scan?.id) {
    await supabase
      .from("qr_gifts")
      .update({ scan_id: scan.id })
      .eq("gift_code", giftCode);
  }

  await supabase
    .from("qr_codes")
    .update({ redemption_count: (qr.redemption_count ?? 0) + 1 })
    .eq("id", qr.id);

  const response = NextResponse.redirect(destination, 302);
  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, max-age=0",
  );
  return response;
}
