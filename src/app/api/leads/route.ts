import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";

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

const INTEREST_LABELS: Record<string, string> = {
  sofia_ai: "Sofia AI — WhatsApp Automation",
  cinema_engine: "Cinema Engine — Website",
  full_automation: "Full Automation Suite",
  custom: "Custom AI Project",
  exit_intent: "Exit Intent Capture",
  general: "General Interest",
};

async function sendEmailNotification(lead: LeadData) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[Leads] RESEND_API_KEY not configured");
    return;
  }

  const resend = new Resend(apiKey);
  const source = lead.utm_source
    ? `${lead.utm_source}${lead.utm_campaign ? ` / ${lead.utm_campaign}` : ""}`
    : "Direct";
  const interestLabel = lead.interest ? (INTEREST_LABELS[lead.interest] || lead.interest) : "Not specified";
  const time = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });

  try {
    const { error } = await resend.emails.send({
      from: "MachineMind Leads <leads@machinemindconsulting.com>",
      to: "machinemindconsulting@gmail.com",
      replyTo: lead.email,
      subject: `🔔 New Lead: ${lead.name}${lead.interest ? ` — ${interestLabel}` : ""}`,
      headers: {
        "X-Priority": "1",
        "X-MSMail-Priority": "High",
        "Importance": "high",
      },
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;background:#0a0a0f;color:#f0f0f3;padding:40px;border:1px solid rgba(255,255,255,0.08)">
          <div style="border-bottom:2px solid #c9a96e;padding-bottom:20px;margin-bottom:24px">
            <h1 style="margin:0;font-size:20px;color:#c9a96e;letter-spacing:0.1em">🔔 NEW LEAD — RESPOND NOW</h1>
            <p style="margin:8px 0 0;font-size:12px;color:rgba(240,240,243,0.5)">This person just filled out your form. Speed to response = close rate.</p>
          </div>

          <table style="width:100%;border-collapse:collapse;font-size:15px">
            <tr style="background:rgba(201,169,110,0.08)"><td style="padding:12px;color:#c9a96e;width:110px;vertical-align:top;font-weight:600">Name</td><td style="padding:12px;color:#f0f0f3;font-size:18px"><strong>${lead.name}</strong></td></tr>
            <tr><td style="padding:12px;color:#c9a96e;vertical-align:top;font-weight:600">Email</td><td style="padding:12px"><a href="mailto:${lead.email}" style="color:#00e5ff;text-decoration:none;font-size:16px">${lead.email}</a></td></tr>
            ${lead.phone ? `<tr style="background:rgba(201,169,110,0.08)"><td style="padding:12px;color:#c9a96e;vertical-align:top;font-weight:600">Phone</td><td style="padding:12px;color:#f0f0f3"><a href="tel:${lead.phone}" style="color:#00e5ff;text-decoration:none;font-size:16px">${lead.phone}</a></td></tr>` : ""}
            ${lead.company ? `<tr><td style="padding:12px;color:#c9a96e;vertical-align:top;font-weight:600">Company</td><td style="padding:12px;color:#f0f0f3;font-size:16px">${lead.company}</td></tr>` : ""}
            <tr style="background:rgba(201,169,110,0.08)"><td style="padding:12px;color:#c9a96e;vertical-align:top;font-weight:600">Interest</td><td style="padding:12px;color:#f0f0f3;font-size:16px"><strong>${interestLabel}</strong></td></tr>
            ${lead.message ? `<tr><td style="padding:12px;color:#c9a96e;vertical-align:top;font-weight:600">Message</td><td style="padding:12px;color:#f0f0f3">${lead.message}</td></tr>` : ""}
            <tr style="background:rgba(201,169,110,0.08)"><td style="padding:12px;color:#c9a96e;vertical-align:top;font-weight:600">Language</td><td style="padding:12px;color:#f0f0f3">${lead.language === "es" ? "Spanish" : "English"}</td></tr>
          </table>

          <div style="margin-top:28px;display:flex;gap:12px">
            <a href="mailto:${lead.email}" style="display:inline-block;padding:14px 32px;background:#c9a96e;color:#0a0a0f;font-weight:700;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none">Reply to Lead</a>
            ${lead.phone ? `<a href="https://wa.me/${lead.phone.replace(/[^0-9]/g, "")}" style="display:inline-block;padding:14px 32px;background:#25D366;color:#fff;font-weight:700;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none">WhatsApp</a>` : ""}
          </div>

          <div style="margin-top:28px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.08);font-size:12px;color:rgba(240,240,243,0.35)">
            <strong style="color:#c9a96e">Source:</strong> ${source}<br/>
            <strong style="color:#c9a96e">Device:</strong> ${lead.device || "unknown"} &middot; <strong style="color:#c9a96e">Page:</strong> ${lead.landing_page || "/"}<br/>
            ${lead.referrer ? `<strong style="color:#c9a96e">Referrer:</strong> ${lead.referrer}<br/>` : ""}
            <strong style="color:#c9a96e">Time:</strong> ${time} ET
          </div>
        </div>
      `,
    });

    if (error) {
      console.error("[Leads] Resend API error:", error);
    }
  } catch (error) {
    console.error("[Leads] Email notification failed:", error);
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

    // Send notifications — email is critical, telegram is best-effort
    await sendEmailNotification(body);
    sendTelegramNotification(body).catch((err) =>
      console.error("[Leads] Telegram error:", err),
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Leads] Submission error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
