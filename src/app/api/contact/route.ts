import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
  if (supabase) return supabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  supabase = createClient(url, key);
  return supabase;
}

interface ContactData {
  name: string;
  email: string;
  project_type: string;
  message?: string;
}

export async function POST(request: Request) {
  try {
    const body: ContactData = await request.json();

    if (!body.name || !body.email || !body.project_type) {
      return NextResponse.json(
        { error: "Name, email, and project type are required" },
        { status: 400 },
      );
    }

    if (!body.email.includes("@")) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 },
      );
    }

    const client = getSupabaseClient();
    if (client) {
      const { error } = await client.from("leads").insert({
        name: body.name,
        email: body.email,
        company: body.project_type,
        message: body.message || null,
        source: "contact_form",
        language: "en",
        created_at: new Date().toISOString(),
      });

      if (error) {
        if (error.code === "23505") {
          return NextResponse.json({ success: true });
        }
        console.error("[Contact] Supabase error:", error);
      }
    } else {
      console.log("[Contact] New inquiry (Supabase not configured):", body);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Contact] Submission error:", error);
    return NextResponse.json(
      { error: "Failed to submit inquiry" },
      { status: 500 },
    );
  }
}
