import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Lazy initialization of Supabase client
let supabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
  if (supabase) return supabase;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  supabase = createClient(url, key);
  return supabase;
}

interface LeadData {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message?: string;
  language?: string;
}

export async function POST(request: Request) {
  try {
    const body: LeadData = await request.json();

    // Validate required fields
    if (!body.name || !body.email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 },
      );
    }

    // Basic email validation
    if (!body.email.includes("@")) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 },
      );
    }

    // Insert into Supabase (if configured) or just log
    const client = getSupabaseClient();
    if (client) {
      const { error } = await client.from("leads").insert({
        name: body.name,
        email: body.email,
        phone: body.phone || null,
        company: body.company || null,
        message: body.message || null,
        source: "portfolio",
        language: body.language || "es",
        created_at: new Date().toISOString(),
      });

      if (error) {
        // Check for duplicate email
        if (error.code === "23505") {
          return NextResponse.json(
            { error: "Email already registered" },
            { status: 409 },
          );
        }
        console.error("Supabase error:", error);
        return NextResponse.json(
          { error: "Failed to save lead" },
          { status: 500 },
        );
      }
    } else {
      // Log if Supabase not configured
      console.log("New lead (Supabase not configured):", body);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Lead submission error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
