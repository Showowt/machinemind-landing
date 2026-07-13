/**
 * Universal Activate API — machinemindconsulting.com/activate
 *
 * Receives client info, creates a payment_links record in the outreach DB,
 * and sends a Telegram alert.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

// Outreach DB — where payment_links table lives
const OUTREACH_URL =
  process.env.OUTREACH_SUPABASE_URL ||
  "https://uvtfipynpwndximtntto.supabase.co";
const OUTREACH_KEY =
  process.env.OUTREACH_SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

function generateCode(length: number = 12): string {
  return randomBytes(Math.ceil(length * 0.75))
    .toString("base64url")
    .slice(0, length);
}

function getDb() {
  if (!OUTREACH_KEY) throw new Error("[Activate] Missing outreach service key");
  return createClient(OUTREACH_URL, OUTREACH_KEY);
}

async function sendTelegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = (process.env.TELEGRAM_CHAT_IDS || process.env.TELEGRAM_CHAT_ID || "").split(",").filter(Boolean);
  if (!token || chatIds.length === 0) return;

  for (const chatId of chatIds) {
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId.trim(),
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      });
    } catch (err) {
      console.error("[Activate] Telegram error:", err);
    }
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessName, phone, method, reference } = body as {
      businessName?: string;
      phone?: string;
      method?: string;
      reference?: string;
    };

    if (!businessName || businessName.length < 2) {
      return NextResponse.json({ error: "Business name required" }, { status: 400 });
    }
    if (!phone || phone.length < 6) {
      return NextResponse.json({ error: "Phone number required" }, { status: 400 });
    }
    if (!method || !["zelle", "bank_transfer", "paypal", "other"].includes(method)) {
      return NextResponse.json({ error: "Valid payment method required" }, { status: 400 });
    }

    const db = getDb();
    const code = generateCode(12);
    const paymentReference = `MM-${code.slice(0, 6).toUpperCase()}`;
    const cleanPhone = phone.replace(/[^\d+]/g, "");

    const { error: insertError } = await db
      .from("payment_links")
      .insert({
        code,
        phone: cleanPhone,
        business_name: businessName,
        plan: "custom",
        amount_usd: 150,
        monthly_amount_usd: 150,
        currency_local: "USD",
        status: "pending",
        payment_method: method,
        payment_reference: paymentReference,
        notes: `Universal activate (machinemindconsulting.com) | $150/mo x2 then $179/mo${reference ? ` | Ref: ${reference}` : ""}`,
      });

    if (insertError) {
      console.error("[Activate] DB insert error:", insertError);
      return NextResponse.json({ error: "Failed to create payment record" }, { status: 500 });
    }

    // Telegram alert
    const phoneDigits = cleanPhone.replace(/[^\d]/g, "");
    const methodLabel =
      method === "zelle" ? "Zelle" :
      method === "paypal" ? "PayPal" :
      method === "bank_transfer" ? "Wire Transfer" : "Other";

    await sendTelegram(
      `<b>NEW ACTIVATION</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `<b>${businessName}</b>\n` +
      `${phone}\n` +
      `$150/mo (intro) then $179/mo\n` +
      `Method: ${methodLabel}\n` +
      `${reference ? `Ref: ${reference}\n` : ""}` +
      `Ref code: ${paymentReference}\n\n` +
      `wa.me/${phoneDigits}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `Check ${methodLabel} and verify.`,
    );

    return NextResponse.json({
      data: { success: true, paymentReference, code },
    });
  } catch (error) {
    console.error("[Activate] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
