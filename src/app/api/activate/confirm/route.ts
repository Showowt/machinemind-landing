/**
 * Payment Confirmation API
 *
 * Receives confirmation number and/or screenshot proof.
 * Updates payment_links record and sends Telegram notification with photo.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const OUTREACH_URL =
  process.env.OUTREACH_SUPABASE_URL ||
  "https://uvtfipynpwndximtntto.supabase.co";
const OUTREACH_KEY =
  process.env.OUTREACH_SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

function getDb() {
  if (!OUTREACH_KEY) throw new Error("[Confirm] Missing outreach service key");
  return createClient(OUTREACH_URL, OUTREACH_KEY);
}

async function sendTelegramText(text: string) {
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
      console.error("[Confirm] Telegram text error:", err);
    }
  }
}

async function sendTelegramPhoto(photoBytes: ArrayBuffer, caption: string, filename: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = (process.env.TELEGRAM_CHAT_IDS || process.env.TELEGRAM_CHAT_ID || "").split(",").filter(Boolean);
  if (!token || chatIds.length === 0) return;

  for (const chatId of chatIds) {
    try {
      const formData = new FormData();
      formData.append("chat_id", chatId.trim());
      formData.append("caption", caption);
      formData.append("parse_mode", "HTML");
      formData.append("photo", new Blob([new Uint8Array(photoBytes)]), filename);

      await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: "POST",
        body: formData,
      });
    } catch (err) {
      console.error("[Confirm] Telegram photo error:", err);
    }
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const code = formData.get("code") as string | null;
    const reference = formData.get("reference") as string | null;
    const screenshot = formData.get("screenshot") as File | null;

    if (!code) {
      return NextResponse.json({ error: "Payment code required" }, { status: 400 });
    }

    if (!reference && !screenshot) {
      return NextResponse.json(
        { error: "Confirmation number or screenshot required" },
        { status: 400 },
      );
    }

    const db = getDb();

    // Look up the payment link
    const { data: link, error: fetchError } = await db
      .from("payment_links")
      .select("*")
      .eq("code", code)
      .maybeSingle();

    if (fetchError || !link) {
      return NextResponse.json({ error: "Payment record not found" }, { status: 404 });
    }

    // Update to claimed_paid
    const updateData: Record<string, unknown> = {
      status: "claimed_paid",
      claimed_paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const existingNotes = (link.notes as string) || "";
    const parts: string[] = [];
    if (reference) parts.push(`Client ref: ${reference}`);
    if (screenshot) parts.push(`Screenshot uploaded`);
    parts.push(new Date().toISOString());
    updateData.notes = existingNotes + ` | ` + parts.join(" | ");

    const { error: updateError } = await db
      .from("payment_links")
      .update(updateData)
      .eq("code", code);

    if (updateError) {
      console.error("[Confirm] DB update error:", updateError);
      return NextResponse.json({ error: "Failed to update payment record" }, { status: 500 });
    }

    // Build Telegram notification
    const phoneDigits = ((link.phone as string) || "").replace(/[^\d]/g, "");
    const methodLabel =
      link.payment_method === "zelle" ? "Zelle" :
      link.payment_method === "paypal" ? "PayPal" :
      link.payment_method === "bank_transfer" ? "Wire Transfer" : "Other";

    const caption =
      `<b>PAYMENT CONFIRMED — VERIFY NOW</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `<b>${link.business_name}</b>\n` +
      `${link.phone}\n` +
      `$${link.amount_usd} USD via ${methodLabel}\n` +
      `${reference ? `Ref: ${reference}\n` : ""}` +
      `Code: ${link.payment_reference}\n\n` +
      `wa.me/${phoneDigits}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `${screenshot ? "Screenshot attached." : "No screenshot."} Check and verify.`;

    // Send screenshot as photo if provided, otherwise text
    if (screenshot && screenshot.size > 0) {
      const bytes = await screenshot.arrayBuffer();
      await sendTelegramPhoto(bytes, caption, screenshot.name || "payment-proof.jpg");
    } else {
      await sendTelegramText(caption);
    }

    return NextResponse.json({
      data: { success: true },
    });
  } catch (error) {
    console.error("[Confirm] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
