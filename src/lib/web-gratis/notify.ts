/**
 * Free-website funnel — team notifications.
 * Telegram goes to every chat in TELEGRAM_CHAT_IDS (Phil + Sergio); the full
 * request is also emailed to machinemindconsulting@gmail.com via Resend.
 * Every sender is best-effort and logs its own failure — a notification problem
 * never fails the user's submission (the row in Supabase is the source of truth).
 */
import { Resend } from "resend";
import { FREE_DAYS, MM_INSTAGRAM, MONTHLY_PRICE_USD, referralLink, SITE_ORIGIN, WEB_GRATIS_PATH } from "./config";
import type { Referrer, WebGratisSignup } from "./server";

const TEAM_EMAIL = "machinemindconsulting@gmail.com";
const FROM_EMAIL = "MachineMind Web Gratis <leads@machinemindconsulting.com>";

const GOAL_LABELS: Record<string, string> = {
  whatsapp: "Que le escriban por WhatsApp",
  citas: "Agendar citas/reservas (upsell)",
  mostrar: "Solo mostrar el negocio",
};

function esc(text: string | null | undefined): string {
  return (text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clip(text: string | null | undefined, max: number): string {
  const t = (text ?? "").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function digits(e164: string): string {
  return e164.replace(/\D/g, "");
}

function svTime(): string {
  return new Date().toLocaleString("es-SV", {
    timeZone: "America/El_Salvador",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function source(row: WebGratisSignup): string {
  if (!row.utm_source && !row.utm_campaign) return row.fbclid ? "Meta (fbclid)" : "Directo / DM";
  return [row.utm_source, row.utm_medium, row.utm_campaign].filter(Boolean).join(" / ");
}

/** wa.me link that opens a chat with the business, prefilled with our next message. */
function waTo(row: WebGratisSignup, message: string): string {
  return `https://wa.me/${digits(row.whatsapp)}?text=${encodeURIComponent(message)}`;
}

function confirmMessage(row: WebGratisSignup): string {
  return `¡Recibido, ${row.business_name}! 🎉 Le saluda MachineMind. Ya empezamos a armar su web. Le confirmo por acá cuando esté lista (pocos días).`;
}

function nudgeMessage(row: WebGratisSignup): string {
  return `¡Hola! Le saluda MachineMind 🇸🇻 Vi que empezó el formulario para la web gratis de ${row.business_name}. ¿Le ayudo a terminarlo? Puede seguir aquí: ${SITE_ORIGIN}${WEB_GRATIS_PATH}`;
}

// ─── Telegram ───────────────────────────────────────────────────────────────

function telegramTargets(): { token: string | undefined; chatIds: string[] } {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatIds = (process.env.TELEGRAM_CHAT_IDS || process.env.TELEGRAM_CHAT_ID || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return { token, chatIds };
}

async function telegramText(html: string): Promise<void> {
  const { token, chatIds } = telegramTargets();
  if (!token || chatIds.length === 0) {
    console.error("[WebGratis] Telegram not configured — notification skipped");
    return;
  }
  await Promise.all(
    chatIds.map(async (chatId) => {
      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: html.slice(0, 4000),
            parse_mode: "HTML",
            disable_web_page_preview: true,
          }),
        });
        if (!res.ok) console.error("[WebGratis] Telegram send failed", chatId, res.status, await res.text());
      } catch (error) {
        console.error("[WebGratis] Telegram send error", chatId, error);
      }
    }),
  );
}

async function telegramPhotos(urls: string[], caption: string): Promise<void> {
  const { token, chatIds } = telegramTargets();
  if (!token || chatIds.length === 0 || urls.length === 0) return;
  const media = urls.slice(0, 10).map((url, i) => ({
    type: "photo",
    media: url,
    ...(i === 0 ? { caption: caption.slice(0, 1000), parse_mode: "HTML" } : {}),
  }));
  await Promise.all(
    chatIds.map(async (chatId) => {
      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMediaGroup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, media }),
        });
        if (!res.ok) console.error("[WebGratis] Telegram media failed", chatId, res.status, await res.text());
      } catch (error) {
        console.error("[WebGratis] Telegram media error", chatId, error);
      }
    }),
  );
}

// ─── Messages ───────────────────────────────────────────────────────────────

/** Step 1 captured: name + WhatsApp are enough to rescue an abandoned form. */
export async function notifyDraftStarted(row: WebGratisSignup, referrer: Referrer | null): Promise<void> {
  const lines = [
    `🟡 <b>WEB GRATIS — empezó el formulario</b>`,
    ``,
    `<b>${esc(row.business_name)}</b> — ${esc(clip(row.business_type, 120))}`,
    `📍 ${esc(row.city)}`,
    `📱 ${esc(row.whatsapp)}`,
    referrer ? `🤝 Referido por <b>${esc(referrer.business_name)}</b> (${esc(referrer.referral_code)})` : null,
    `📊 ${esc(source(row))}`,
    ``,
    `Si en 30 min no llega la solicitud completa, escríbale:`,
    `<a href="${esc(waTo(row, nudgeMessage(row)))}">Abrir WhatsApp con mensaje listo</a>`,
    `🕐 ${esc(svTime())}`,
  ].filter((l): l is string => l !== null);
  await telegramText(lines.join("\n"));
}

interface SubmittedContext {
  referrer: Referrer | null;
  links: Record<string, string>;
  otherRequestsSameWhatsapp: number;
}

/** Full request received: everything needed to start the build. */
export async function notifySubmitted(row: WebGratisSignup, ctx: SubmittedContext): Promise<void> {
  const photoUrls = row.photo_paths.map((p) => ctx.links[p]).filter(Boolean);
  const logoUrl = row.logo_paths.map((p) => ctx.links[p]).find(Boolean);
  const imageUrls = [...row.logo_paths, ...row.photo_paths]
    .filter((p) => /\.(jpe?g|png|webp)$/i.test(p))
    .map((p) => ctx.links[p])
    .filter(Boolean);

  const lines = [
    `🟢 <b>WEB GRATIS — SOLICITUD COMPLETA</b>`,
    ``,
    `<b>${esc(row.business_name)}</b>`,
    `${esc(clip(row.business_type, 200))}`,
    `📍 ${esc(row.city)}   📱 ${esc(row.whatsapp)}`,
    ``,
    `<b>Servicios:</b> ${esc(clip(row.services.join(", "), 400))}`,
    row.differentiator ? `<b>Diferencia:</b> ${esc(clip(row.differentiator, 400))}` : null,
    row.hours ? `<b>Horario:</b> ${esc(clip(row.hours, 200))}` : null,
    row.instagram ? `<b>IG:</b> ${esc(row.instagram)}` : null,
    row.facebook ? `<b>FB:</b> ${esc(row.facebook)}` : null,
    row.style ? `<b>Estilo:</b> ${esc(clip(row.style, 200))}` : null,
    `<b>Quiere:</b> ${esc(GOAL_LABELS[row.site_goal ?? ""] ?? "—")}${row.site_goal === "citas" ? " 🔥" : ""}`,
    `<b>Logo:</b> ${row.logo_paths.length ? (logoUrl ? `<a href="${esc(logoUrl)}">ver</a>` : "sí") : "no (diseñarlo)"}   <b>Fotos:</b> ${row.photo_paths.length}${photoUrls.length ? " " + photoUrls.slice(0, 8).map((u, i) => `<a href="${esc(u)}">${i + 1}</a>`).join(" ") : ""}`,
    ``,
    ctx.referrer ? `🤝 Referido por <b>${esc(ctx.referrer.business_name)}</b> (${esc(ctx.referrer.referral_code)}) — crédito de 1 mes al activar` : null,
    `🔗 Su código: <b>${esc(row.referral_code)}</b>`,
    ctx.otherRequestsSameWhatsapp > 0 ? `⚠️ Este WhatsApp ya tiene ${ctx.otherRequestsSameWhatsapp} otra(s) solicitud(es).` : null,
    `📊 ${esc(source(row))}`,
    ``,
    `👉 <a href="${esc(waTo(row, confirmMessage(row)))}">Confirmarle por WhatsApp (mensaje listo)</a>`,
    `🕐 ${esc(svTime())}`,
  ].filter((l): l is string => l !== null);

  await telegramText(lines.join("\n"));
  if (imageUrls.length > 0) {
    await telegramPhotos(imageUrls, `📸 <b>${esc(row.business_name)}</b> — logo y fotos`);
  }
}

/** The DB write failed — push the raw request to the team so the lead isn't lost. */
export async function notifySaveFailed(summary: Record<string, unknown>, reason: string): Promise<void> {
  const body = Object.entries(summary)
    .map(([k, v]) => `<b>${esc(k)}:</b> ${esc(clip(typeof v === "string" ? v : JSON.stringify(v), 300))}`)
    .join("\n");
  await telegramText(`🔴 <b>WEB GRATIS — NO SE GUARDÓ EN LA BASE</b>\n${esc(reason)}\n\n${body}\n\nEscríbale por WhatsApp a mano.`);
}

// ─── Email ──────────────────────────────────────────────────────────────────

export async function emailSubmitted(row: WebGratisSignup, ctx: SubmittedContext): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.error("[WebGratis] RESEND_API_KEY missing — email skipped");
    return;
  }

  const rowHtml = (label: string, value: string | null | undefined) =>
    value
      ? `<tr><td style="padding:10px 12px;color:#1e9bf0;font-weight:600;vertical-align:top;width:130px">${esc(label)}</td><td style="padding:10px 12px;color:#f0f0f3">${esc(value)}</td></tr>`
      : "";

  const imageTiles = [...row.logo_paths, ...row.photo_paths]
    .filter((p) => ctx.links[p])
    .map((p) => {
      const url = ctx.links[p];
      const isImage = /\.(jpe?g|png|webp|gif)$/i.test(p);
      const label = p.includes("/logo-") ? "Logo" : "Foto";
      return isImage
        ? `<a href="${esc(url)}" style="display:inline-block;margin:0 8px 8px 0"><img src="${esc(url)}" alt="${label}" width="120" style="width:120px;height:120px;object-fit:cover;border:1px solid rgba(255,255,255,0.12)"/></a>`
        : `<a href="${esc(url)}" style="display:inline-block;margin:0 8px 8px 0;color:#1e9bf0">${label} (${esc(p.split(".").pop() ?? "archivo")})</a>`;
    })
    .join("");

  const html = `
  <div style="font-family:system-ui,-apple-system,sans-serif;max-width:640px;margin:0 auto;background:#06060a;color:#f0f0f3;padding:32px;border-top:3px solid #1e9bf0">
    <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.2em;color:#1e9bf0;text-transform:uppercase">Web gratis · El Salvador</p>
    <h1 style="margin:0 0 4px;font-size:24px">${esc(row.business_name)}</h1>
    <p style="margin:0 0 20px;color:rgba(240,240,243,0.6)">${esc(row.business_type)} — ${esc(row.city)}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;background:rgba(255,255,255,0.03)">
      ${rowHtml("WhatsApp", row.whatsapp)}
      ${rowHtml("Servicios", row.services.join(", "))}
      ${rowHtml("Diferencia", row.differentiator)}
      ${rowHtml("Horario", row.hours)}
      ${rowHtml("Instagram", row.instagram)}
      ${rowHtml("Facebook", row.facebook)}
      ${rowHtml("Estilo", row.style)}
      ${rowHtml("Quiere", GOAL_LABELS[row.site_goal ?? ""] ?? null)}
      ${rowHtml("Referido por", ctx.referrer ? `${ctx.referrer.business_name} (${ctx.referrer.referral_code})` : null)}
      ${rowHtml("Su código", `${row.referral_code} — ${referralLink(row.referral_code)}`)}
      ${rowHtml("Fuente", source(row))}
      ${rowHtml("Aceptó", `Gratis ${FREE_DAYS} días en línea, luego $${MONTHLY_PRICE_USD}/mes · compartir y etiquetar @${MM_INSTAGRAM}`)}
    </table>
    ${imageTiles ? `<h2 style="font-size:14px;margin:24px 0 10px;color:#1e9bf0">Logo y fotos (links válidos 7 días)</h2><div>${imageTiles}</div>` : `<p style="margin-top:20px;color:rgba(240,240,243,0.6)">Sin logo ni fotos — usar imágenes de su rubro y diseñar logo.</p>`}
    <p style="margin:28px 0 0">
      <a href="${esc(waTo(row, confirmMessage(row)))}" style="display:inline-block;padding:14px 26px;background:#25D366;color:#06060a;font-weight:700;text-decoration:none">Confirmarle por WhatsApp</a>
    </p>
    <p style="margin:24px 0 0;font-size:12px;color:rgba(240,240,243,0.4)">${esc(svTime())} (hora SV) · ID ${esc(row.id)}</p>
  </div>`;

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: TEAM_EMAIL,
      subject: `🟢 Web gratis: ${row.business_name} (${row.city})`,
      html,
    });
    if (error) console.error("[WebGratis] Resend error", error);
  } catch (error) {
    console.error("[WebGratis] email send failed", error);
  }
}
