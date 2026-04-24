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

// ── TELEGRAM NOTIFICATION ──
async function notifyTelegram(data: ContactData) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const text = [
    `🔔 *New Project Inquiry*`,
    ``,
    `*Name:* ${data.name}`,
    `*Email:* ${data.email}`,
    `*Project:* ${data.project_type}`,
    data.message ? `*Message:* ${data.message}` : '',
    ``,
    `_via machinemindconsulting.com_`,
  ].filter(Boolean).join('\n');

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      }),
    });
  } catch (err) {
    console.error('[Contact] Telegram error:', err);
  }
}

// ── WHATSAPP NOTIFICATION (via Twilio) ──
async function notifyWhatsApp(data: ContactData) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  const to = process.env.TWILIO_WHATSAPP_NOTIFY;
  if (!sid || !token || !from || !to) return;

  const msg = [
    `New Project Inquiry`,
    `Name: ${data.name}`,
    `Email: ${data.email}`,
    `Project: ${data.project_type}`,
    data.message ? `Message: ${data.message}` : '',
    `— machinemindconsulting.com`,
  ].filter(Boolean).join('\n');

  try {
    const params = new URLSearchParams();
    params.append('From', from);
    params.append('To', to);
    params.append('Body', msg);

    await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      }
    );
  } catch (err) {
    console.error('[Contact] WhatsApp error:', err);
  }
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

    // ── Store in Supabase ──
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

      if (error && error.code !== "23505") {
        console.error("[Contact] Supabase error:", error);
      }
    } else {
      console.log("[Contact] New inquiry (no DB):", body);
    }

    // ── Send notifications (fire and forget — don't block response) ──
    await Promise.allSettled([
      notifyTelegram(body),
      notifyWhatsApp(body),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Contact] Submission error:", error);
    return NextResponse.json(
      { error: "Failed to submit inquiry" },
      { status: 500 },
    );
  }
}
