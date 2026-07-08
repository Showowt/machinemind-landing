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

interface LeadData {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message?: string;
  language?: string;
  interest?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  landing_page?: string;
  device?: string;
  referrer?: string;
}

async function sendTelegramNotification(lead: LeadData) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return;

  const source = lead.utm_source
    ? `${lead.utm_source}${lead.utm_campaign ? ` / ${lead.utm_campaign}` : ""}`
    : "Direct";

  const message = `🔔 *NEW LEAD — MachineMind*

*Name:* ${lead.name}
*Email:* ${lead.email}
${lead.phone ? `*Phone:* ${lead.phone}` : ""}
${lead.company ? `*Company:* ${lead.company}` : ""}
${lead.interest ? `*Interest:* ${lead.interest}` : ""}
${lead.message ? `*Message:* ${lead.message.slice(0, 200)}` : ""}

📊 *Attribution*
*Source:* ${source}
*Device:* ${lead.device || "unknown"}
*Landing:* ${lead.landing_page || "/"}

⏰ ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })} ET`;

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "Markdown" }),
    });
  } catch (error) {
    console.error("[Leads] Telegram notification failed:", error);
  }
}

export async function POST(request: Request) {
  try {
    const body: LeadData = await request.json();

    if (!body.name || !body.email) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }
    if (!body.email.includes("@")) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    const client = getSupabaseClient();
    if (client) {
      const { error } = await client.from("leads").insert({
        name: body.name,
        email: body.email,
        phone: body.phone || null,
        company: body.company || null,
        message: body.message || null,
        source: body.utm_source || "portfolio",
        language: body.language || "es",
        interest: body.interest || null,
        utm_source: body.utm_source || null,
        utm_medium: body.utm_medium || null,
        utm_campaign: body.utm_campaign || null,
        utm_content: body.utm_content || null,
        utm_term: body.utm_term || null,
        landing_page: body.landing_page || null,
        device: body.device || null,
        referrer: body.referrer || null,
        created_at: new Date().toISOString(),
      });

      if (error) {
        if (error.code === "23505") {
          return NextResponse.json({ error: "Email already registered" }, { status: 409 });
        }
        console.error("[Leads] Supabase error:", error);
        return NextResponse.json({ error: "Failed to save lead" }, { status: 500 });
      }
    }

    sendTelegramNotification(body).catch((err) =>
      console.error("[Leads] Notification error:", err),
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Leads] Submission error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
