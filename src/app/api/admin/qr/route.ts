import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generateSlug } from "@/lib/qr/generator";

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
  const supabase = createServiceClient();
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");

  if (slug) {
    const { data, error } = await supabase
      .from("qr_codes")
      .select("*, qr_scans(count)")
      .eq("slug", slug)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  const { data, error } = await supabase
    .from("qr_codes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  try {
    assertAdmin(req);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const supabase = createServiceClient();

  const slug = (body.slug as string) || generateSlug();
  const payload = {
    slug: slug.toLowerCase().replace(/[^a-z0-9\-_]/g, "").slice(0, 32),
    name: String(body.name || slug),
    destination: String(body.destination || "https://machinemindconsulting.com"),
    campaign: body.campaign ?? null,
    style: body.style || "luxury",
    colors: body.colors || {
      dark: "#000000",
      light: "#FFFFFF",
      accent: "#c9a96e",
    },
    logo_key: body.logo_key ?? null,
    gift_config: body.gift_config ?? null,
    discount_config: body.discount_config ?? null,
    max_redemptions: body.max_redemptions ?? null,
    expires_at: body.expires_at ?? null,
    active: body.active ?? true,
  };

  const { data, error } = await supabase
    .from("qr_codes")
    .insert(payload)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest) {
  try {
    assertAdmin(req);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const { slug, ...updates } = body;
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("qr_codes")
    .update(updates)
    .eq("slug", slug)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest) {
  try {
    assertAdmin(req);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }
  const supabase = createServiceClient();
  const { error } = await supabase.from("qr_codes").delete().eq("slug", slug);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
