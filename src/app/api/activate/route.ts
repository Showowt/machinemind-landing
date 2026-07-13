/**
 * Universal Activate API — machinemindconsulting.com/activate
 *
 * Single endpoint: creates payment_links record, sends Telegram with screenshot.
 * Called once on final confirmation — not during method selection.
 *
 * Accepts multipart form data:
 *   - businessName, phone, method (required)
 *   - reference (optional confirmation number)
 *   - screenshot (optional file)
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

const OUTREACH_URL =
  process.env.OUTREACH_SUPABASE_URL ||
  "https://uvtfipynpwndximtntto.supabase.co";
const OUTREACH_KEY =
  process.env.OUTREACH_SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const VALID_METHODS = ["zelle", "bank_transfer", "paypal", "venmo", "cashapp", "other"];

function generateCode(length: number = 12): string {
  return randomBytes(Math.ceil(length * 0.75))
    .toString("base64url")
    .slice(0, length);
}

function getDb() {
  if (!OUTREACH_KEY) throw new Error("[Activate] Missing outreach service key");
  return createClient(OUTREACH_URL, OUTREACH_KEY);
}

function getTelegramTargets() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = (process.env.TELEGRAM_CHAT_IDS || process.env.TELEGRAM_CHAT_ID || "")
    .split(",")
    .filter(Boolean);
  return { token, chatIds };
}

async function sendTelegramText(text: string) {
  const { token, chatIds } = getTelegramTargets();
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
      console.error("[Activate] Telegram text error:", err);
    }
  }
}

async function sendTelegramPhoto(photoBytes: ArrayBuffer, caption: string, filename: string) {
  const { token, chatIds } = getTelegramTargets();
  if (!token || chatIds.length === 0) return;

  for (const chatId of chatIds) {
    try {
      const form = new FormData();
      form.append("chat_id", chatId.trim());
      form.append("caption", caption);
      form.append("parse_mode", "HTML");
      form.append("photo", new Blob([new Uint8Array(photoBytes)]), filename);

      await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: "POST",
        body: form,
      });
    } catch (err) {
      console.error("[Activate] Telegram photo error:", err);
    }
  }
}

const METHOD_LABELS: Record<string, string> = {
  zelle: "Zelle",
  paypal: "PayPal",
  bank_transfer: "Wire Transfer",
  venmo: "Venmo",
  cashapp: "CashApp",
  other: "Other",
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const businessName = (formData.get("businessName") as string | null)?.trim();
    const phone = (formData.get("phone") as string | null)?.trim();
    const method = formData.get("method") as string | null;
    const reference = (formData.get("reference") as string | null)?.trim() || null;
    const screenshot = formData.get("screenshot") as File | null;

    // Validate
    if (!businessName || businessName.length < 2) {
      return NextResponse.json({ error: "Business name required" }, { status: 400 });
    }
    if (!phone || phone.length < 6) {
      return NextResponse.json({ error: "Phone number required" }, { status: 400 });
    }
    if (!method || !VALID_METHODS.includes(method)) {
      return NextResponse.json({ error: "Valid payment method required" }, { status: 400 });
    }
    if (!reference && (!screenshot || screenshot.size === 0)) {
      return NextResponse.json(
        { error: "Confirmation number or screenshot required" },
        { status: 400 },
      );
    }

    const db = getDb();
    const code = generateCode(12);
    const paymentReference = `MM-${code.slice(0, 6).toUpperCase()}`;
    const cleanPhone = phone.replace(/[^\d+]/g, "");

    // Build notes
    const noteParts = [
      `Universal activate (machinemindconsulting.com)`,
      `$150/mo x2 then $179/mo`,
    ];
    if (reference) noteParts.push(`Client ref: ${reference}`);
    if (screenshot && screenshot.size > 0) noteParts.push(`Screenshot uploaded`);

    // Create payment record — already claimed_paid since they have proof
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
        status: "claimed_paid",
        payment_method: method,
        payment_reference: paymentReference,
        claimed_paid_at: new Date().toISOString(),
        notes: noteParts.join(" | "),
      });

    if (insertError) {
      console.error("[Activate] DB insert error:", insertError);
      return NextResponse.json({ error: "Failed to create payment record" }, { status: 500 });
    }

    // Telegram notification
    const phoneDigits = cleanPhone.replace(/[^\d]/g, "");
    const methodLabel = METHOD_LABELS[method] || method;

    const caption =
      `<b>PAYMENT RECEIVED — VERIFY NOW</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `<b>${businessName}</b>\n` +
      `${phone}\n` +
      `$150 USD via ${methodLabel}\n` +
      `${reference ? `Ref: ${reference}\n` : ""}` +
      `Code: ${paymentReference}\n\n` +
      `wa.me/${phoneDigits}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `${screenshot && screenshot.size > 0 ? "Screenshot attached." : "No screenshot — ref number only."} Verify payment.`;

    if (screenshot && screenshot.size > 0) {
      const bytes = await screenshot.arrayBuffer();
      await sendTelegramPhoto(bytes, caption, screenshot.name || "payment-proof.jpg");
    } else {
      await sendTelegramText(caption);
    }

    return NextResponse.json({
      data: { success: true, paymentReference },
    });
  } catch (error) {
    console.error("[Activate] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
