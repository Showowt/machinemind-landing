/**
 * Free-website funnel — team notification transport + message builders.
 *
 * Nothing here decides WHEN to send; the outbox drainer (outbox.ts) does. Every
 * sender returns a SendResult so the drainer can honour Telegram / Resend rate
 * limits (retry_after) instead of dropping messages. The one exception is
 * notifySaveFailed(), which sends directly because it fires when the database
 * (and therefore the outbox) is unreachable.
 */
import { Resend } from "resend";
import { FREE_DAYS, MM_INSTAGRAM, MONTHLY_PRICE_USD, referralLink, SITE_ORIGIN } from "./config";
import { scripts, waLink } from "./scripts";
import type { Referrer, WebGratisSignup } from "./server";

export const BOARD_URL = `${SITE_ORIGIN}/admin/web-gratis`;
const TEAM_EMAIL = "machinemindconsulting@gmail.com";
const FROM_EMAIL = "MachineMind Web Gratis <leads@machinemindconsulting.com>";

export type SendResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number; error: string }
  | { ok: false; permanent: true; error: string };

const GOAL_LABELS: Record<string, string> = {
  whatsapp: "Que le escriban por WhatsApp",
  citas: "Agendar citas/reservas (upsell)",
  mostrar: "Solo mostrar el negocio",
};

export function esc(text: string | null | undefined): string {
  return (text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function clip(text: string | null | undefined, max: number): string {
  const t = (text ?? "").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export function svTime(date: Date = new Date()): string {
  return date.toLocaleString("es-SV", { timeZone: "America/El_Salvador", dateStyle: "medium", timeStyle: "short" });
}

export function sourceLabel(row: Pick<WebGratisSignup, "utm_source" | "utm_medium" | "utm_campaign" | "fbclid">): string {
  if (!row.utm_source && !row.utm_campaign) return row.fbclid ? "Meta (fbclid)" : "Directo / DM";
  return [row.utm_source, row.utm_medium, row.utm_campaign].filter(Boolean).join(" / ");
}

// ─── Telegram transport ─────────────────────────────────────────────────────

function telegramBase(): string {
  return (process.env.TELEGRAM_API_BASE?.trim() || "https://api.telegram.org").replace(/\/$/, "");
}

export function telegramChats(): string[] {
  if (!process.env.TELEGRAM_BOT_TOKEN?.trim()) return [];
  return (process.env.TELEGRAM_CHAT_IDS || process.env.TELEGRAM_CHAT_ID || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

async function telegramCall(method: string, body: Record<string, unknown>): Promise<SendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return { ok: false, permanent: true, error: "TELEGRAM_BOT_TOKEN missing" };
  try {
    const res = await fetch(`${telegramBase()}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return { ok: true };
    const json = (await res.json().catch(() => null)) as {
      description?: string;
      parameters?: { retry_after?: number };
    } | null;
    const error = `telegram ${method} ${res.status}: ${json?.description ?? "unknown"}`;
    if (res.status === 429) return { ok: false, retryAfterSec: Math.max(1, json?.parameters?.retry_after ?? 5), error };
    if (res.status >= 500) return { ok: false, retryAfterSec: 15, error };
    return { ok: false, permanent: true, error };
  } catch (error) {
    return { ok: false, retryAfterSec: 15, error: `telegram ${method} network: ${String(error)}` };
  }
}

/** Telegram rejects messages over 4096 chars; builders pack below this so nothing is ever cut. */
export const TELEGRAM_MAX = 3800;

/**
 * Pack lines into as few messages as fit under TELEGRAM_MAX. Never truncates a
 * list — a truncated digest silently drops leads (caught in the load test).
 */
export function packMessages<T>(
  items: { ref: T; line: string }[],
  header: (count: number) => string,
  footer: string,
): { refs: T[]; html: string }[] {
  const build = (group: { ref: T; line: string }[]) =>
    [header(group.length), "", ...group.map((g) => g.line), "", footer].join("\n");
  const out: { refs: T[]; html: string }[] = [];
  let group: { ref: T; line: string }[] = [];
  for (const item of items) {
    if (group.length > 0 && build([...group, item]).length > TELEGRAM_MAX) {
      out.push({ refs: group.map((g) => g.ref), html: build(group) });
      group = [];
    }
    group.push(item);
  }
  if (group.length > 0) out.push({ refs: group.map((g) => g.ref), html: build(group) });
  return out;
}

/** Send HTML; if Telegram rejects the markup (400), resend once as plain text. */
export async function sendTelegram(chatId: string, html: string): Promise<SendResult> {
  if (html.length > 4096) console.error("[WebGratis] telegram message over limit — builder bug", html.length);
  const first = await telegramCall("sendMessage", {
    chat_id: chatId,
    text: html.slice(0, 4096),
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
  if (first.ok || !("permanent" in first) || !/ 400:/.test(first.error)) return first;
  const plain = html.replace(/<a href="([^"]+)">([^<]*)<\/a>/g, "$2: $1").replace(/<[^>]+>/g, "");
  return telegramCall("sendMessage", { chat_id: chatId, text: plain.slice(0, 4096), disable_web_page_preview: true });
}

export function sendTelegramPhotos(chatId: string, urls: string[], caption: string): Promise<SendResult> {
  const media = urls.slice(0, 10).map((url, i) => ({
    type: "photo",
    media: url,
    ...(i === 0 ? { caption: caption.slice(0, 1000), parse_mode: "HTML" } : {}),
  }));
  return telegramCall("sendMediaGroup", { chat_id: chatId, media });
}

// ─── Message builders ───────────────────────────────────────────────────────

export interface LeadContext {
  referrer: Referrer | null;
  links: Record<string, string>;
  otherRequestsSameWhatsapp: number;
}

/** One lead, full detail (used when volume is low). */
export function submittedHtml(row: WebGratisSignup, ctx: LeadContext): string {
  const photoUrls = row.photo_paths.map((p) => ctx.links[p]).filter(Boolean);
  const logoUrl = row.logo_paths.map((p) => ctx.links[p]).find(Boolean);
  const lines = [
    `🟢 <b>WEB GRATIS — SOLICITUD COMPLETA</b>`,
    ``,
    `<b>${esc(row.business_name)}</b>`,
    esc(clip(row.business_type, 200)),
    `📍 ${esc(row.city)}   📱 ${esc(row.whatsapp)}`,
    ``,
    `<b>Servicios:</b> ${esc(clip(row.services.join(", "), 400))}`,
    row.differentiator ? `<b>Diferencia:</b> ${esc(clip(row.differentiator, 400))}` : null,
    row.hours ? `<b>Horario:</b> ${esc(clip(row.hours, 200))}` : null,
    row.instagram ? `<b>IG:</b> ${esc(row.instagram)}` : null,
    row.facebook ? `<b>FB:</b> ${esc(row.facebook)}` : null,
    row.style ? `<b>Estilo:</b> ${esc(clip(row.style, 200))}` : null,
    `<b>Quiere:</b> ${esc(GOAL_LABELS[row.site_goal ?? ""] ?? "—")}${row.site_goal === "citas" ? " 🔥" : ""}`,
    `<b>Logo:</b> ${row.logo_paths.length ? (logoUrl ? `<a href="${esc(logoUrl)}">ver</a>` : "sí") : "no (diseñarlo)"}   <b>Fotos:</b> ${row.photo_paths.length}${photoUrls.length ? " " + photoUrls.slice(0, 4).map((u, i) => `<a href="${esc(u)}">${i + 1}</a>`).join(" ") : ""}${photoUrls.length > 4 ? " (resto en el tablero)" : ""}`,
    ``,
    ctx.referrer
      ? `🤝 Referido por <b>${esc(ctx.referrer.business_name)}</b> (${esc(ctx.referrer.referral_code)}) — 1 mes gratis al activar`
      : null,
    `🔗 Su código: <b>${esc(row.referral_code)}</b>`,
    ctx.otherRequestsSameWhatsapp > 0 ? `⚠️ Este WhatsApp ya tiene ${ctx.otherRequestsSameWhatsapp} otra(s) solicitud(es).` : null,
    `📊 ${esc(sourceLabel(row))}`,
    ``,
    `👉 <a href="${esc(waLink(row.whatsapp, scripts.confirm(row.business_name)))}">Confirmarle por WhatsApp (mensaje listo)</a>`,
    `📋 <a href="${BOARD_URL}">Tablero</a>   🕐 ${esc(svTime(new Date(row.submitted_at ?? row.created_at)))}`,
  ].filter((l): l is string => l !== null);
  const html = lines.join("\n");
  // Very long free-text answers: fall back to the compact line so nothing is cut.
  return html.length <= TELEGRAM_MAX ? html : [`🟢 <b>WEB GRATIS — SOLICITUD COMPLETA</b>`, ``, submittedLine(row, ctx.referrer ?? undefined), ``, `📋 <a href="${BOARD_URL}">Detalle completo en el tablero</a>`].join("\n");
}

/** Compact one-lead line for digests. */
export function submittedLine(row: WebGratisSignup, ref: Referrer | undefined): string {
  return [
    `• <b>${esc(clip(row.business_name, 60))}</b> — ${esc(clip(row.business_type, 60))} · ${esc(clip(row.city, 40))}`,
    `   📱 ${esc(row.whatsapp)} · fotos ${row.photo_paths.length}${row.site_goal === "citas" ? " · 🔥citas" : ""}${ref ? ` · 🤝 ${esc(clip(ref.business_name, 30))}` : ""} · <a href="${esc(waLink(row.whatsapp, scripts.confirm(row.business_name)))}">confirmar</a>`,
  ].join("\n");
}

/** Many leads, packed into as many messages as needed (volume spikes). */
export function submittedDigests<T>(items: { ref: T; row: WebGratisSignup }[], referrers: Map<string, Referrer>) {
  return packMessages(
    items.map(({ ref, row }) => ({
      ref,
      line: submittedLine(row, row.referred_by_id ? referrers.get(row.referred_by_id) : undefined),
    })),
    (n) => `🟢 <b>WEB GRATIS — ${n} solicitud${n === 1 ? "" : "es"} nueva${n === 1 ? "" : "s"}</b>`,
    `📋 <a href="${BOARD_URL}">Abrir tablero</a>`,
  );
}

export function abandonedDigests<T>(items: { ref: T; row: WebGratisSignup }[]) {
  return packMessages(
    items.map(({ ref, row }) => ({
      ref,
      line: `• <b>${esc(clip(row.business_name, 60))}</b> — ${esc(clip(row.business_type, 50))} · ${esc(clip(row.city, 40))} · paso ${row.step}/3 · <a href="${esc(waLink(row.whatsapp, scripts.rescue(row.business_name)))}">escribirle</a>`,
    })),
    (n) => `🟡 <b>WEB GRATIS — ${n} sin terminar el formulario</b>\nDieron nombre y WhatsApp pero no enviaron. Un mensaje los recupera:`,
    `📋 <a href="${BOARD_URL}">Tablero → Sin terminar</a>`,
  );
}

export function systemHtml(text: string): string {
  return `⚠️ <b>WEB GRATIS — sistema</b>\n${esc(text)}`;
}

// ─── Email ──────────────────────────────────────────────────────────────────

export async function sendSubmittedEmail(row: WebGratisSignup, ctx: LeadContext): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { ok: false, permanent: true, error: "RESEND_API_KEY missing" };

  const rowHtml = (label: string, value: string | null | undefined) =>
    value
      ? `<tr><td style="padding:10px 12px;color:#1e9bf0;font-weight:600;vertical-align:top;width:130px">${esc(label)}</td><td style="padding:10px 12px;color:#f0f0f3">${esc(value)}</td></tr>`
      : "";

  const tiles = [...row.logo_paths, ...row.photo_paths]
    .filter((p) => ctx.links[p])
    .map((p) => {
      const url = ctx.links[p];
      const label = p.includes("/logo-") ? "Logo" : "Foto";
      return /\.(jpe?g|png|webp|gif)$/i.test(p)
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
      ${rowHtml("Fuente", sourceLabel(row))}
      ${rowHtml("Aceptó", `Gratis ${FREE_DAYS} días en línea, luego $${MONTHLY_PRICE_USD}/mes · compartir y etiquetar @${MM_INSTAGRAM}`)}
    </table>
    ${tiles ? `<h2 style="font-size:14px;margin:24px 0 10px;color:#1e9bf0">Logo y fotos (links válidos 7 días)</h2><div>${tiles}</div>` : `<p style="margin-top:20px;color:rgba(240,240,243,0.6)">Sin logo ni fotos — usar imágenes de su rubro y diseñar logo.</p>`}
    <p style="margin:28px 0 0">
      <a href="${esc(waLink(row.whatsapp, scripts.confirm(row.business_name)))}" style="display:inline-block;padding:14px 26px;background:#25D366;color:#06060a;font-weight:700;text-decoration:none">Confirmarle por WhatsApp</a>
      <a href="${BOARD_URL}" style="display:inline-block;padding:14px 26px;margin-left:8px;border:1px solid #1e9bf0;color:#f0f0f3;text-decoration:none">Abrir tablero</a>
    </p>
    <p style="margin:24px 0 0;font-size:12px;color:rgba(240,240,243,0.4)">${esc(svTime(new Date(row.submitted_at ?? row.created_at)))} (hora SV) · ID ${esc(row.id)}</p>
  </div>`;

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send(
      {
        from: FROM_EMAIL,
        to: TEAM_EMAIL,
        subject: `🟢 Web gratis: ${row.business_name} (${row.city})`,
        html,
      },
      { idempotencyKey: `web-gratis-submitted-${row.id}` },
    );
    if (!error) return { ok: true };
    const name = (error as { name?: string }).name ?? "";
    const message = `resend ${name}: ${error.message}`;
    if (name === "rate_limit_exceeded" || name === "concurrent_idempotent_requests") {
      return { ok: false, retryAfterSec: 2, error: message };
    }
    if (name === "daily_quota_exceeded" || name === "monthly_quota_exceeded") {
      return { ok: false, permanent: true, error: message };
    }
    if (name === "application_error" || name === "internal_server_error") return { ok: false, retryAfterSec: 30, error: message };
    return { ok: false, permanent: true, error: message };
  } catch (error) {
    return { ok: false, retryAfterSec: 30, error: `resend network: ${String(error)}` };
  }
}

/**
 * Burst mode: one email carrying many leads (every field, first photo, confirm
 * link each) instead of dozens of separate emails — keeps Gmail usable and the
 * Resend quota safe.
 */
export async function sendDigestEmail(
  rows: WebGratisSignup[],
  referrers: Map<string, Referrer>,
  links: Record<string, string>,
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { ok: false, permanent: true, error: "RESEND_API_KEY missing" };

  const cards = rows
    .map((row) => {
      const ref = row.referred_by_id ? referrers.get(row.referred_by_id) : undefined;
      const firstPhoto = [...row.photo_paths, ...row.logo_paths].find((p) => /\.(jpe?g|png|webp|gif)$/i.test(p) && links[p]);
      const field = (label: string, value: string | null | undefined) =>
        value ? `<div style="margin:2px 0"><span style="color:#1e9bf0">${esc(label)}:</span> ${esc(value)}</div>` : "";
      return `
      <div style="border:1px solid rgba(255,255,255,0.1);border-left:3px solid #1e9bf0;padding:14px;margin:0 0 12px;overflow:hidden">
        ${firstPhoto ? `<a href="${esc(links[firstPhoto])}"><img src="${esc(links[firstPhoto])}" alt="" width="96" style="float:right;width:96px;height:96px;object-fit:cover;margin:0 0 8px 12px"/></a>` : ""}
        <div style="font-size:17px;font-weight:700">${esc(row.business_name)}</div>
        <div style="color:rgba(240,240,243,0.6);margin-bottom:6px">${esc(row.business_type)} — ${esc(row.city)}</div>
        ${field("WhatsApp", row.whatsapp)}
        ${field("Servicios", row.services.join(", "))}
        ${field("Diferencia", row.differentiator)}
        ${field("Horario", row.hours)}
        ${field("Instagram", row.instagram)}
        ${field("Facebook", row.facebook)}
        ${field("Estilo", row.style)}
        ${field("Quiere", GOAL_LABELS[row.site_goal ?? ""] ?? null)}
        ${field("Archivos", `${row.logo_paths.length ? "logo + " : ""}${row.photo_paths.length} foto(s)`)}
        ${field("Referido por", ref ? `${ref.business_name} (${ref.referral_code})` : null)}
        ${field("Código", row.referral_code)}
        <a href="${esc(waLink(row.whatsapp, scripts.confirm(row.business_name)))}" style="display:inline-block;margin-top:8px;padding:8px 14px;background:#25D366;color:#06060a;font-weight:700;text-decoration:none">Confirmarle por WhatsApp</a>
      </div>`;
    })
    .join("");

  const html = `
  <div style="font-family:system-ui,-apple-system,sans-serif;max-width:680px;margin:0 auto;background:#06060a;color:#f0f0f3;padding:28px;border-top:3px solid #1e9bf0">
    <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.2em;color:#1e9bf0;text-transform:uppercase">Web gratis · El Salvador</p>
    <h1 style="margin:0 0 16px;font-size:22px">${rows.length} solicitudes nuevas</h1>
    ${cards}
    <p style="margin:20px 0 0"><a href="${BOARD_URL}" style="color:#1e9bf0">Abrir tablero</a> · fotos completas y estados ahí</p>
  </div>`;

  const idempotencyKey = `web-gratis-digest-${rows
    .map((r) => r.id.slice(0, 8))
    .sort()
    .join("")
    .slice(0, 200)}`;
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send(
      { from: FROM_EMAIL, to: TEAM_EMAIL, subject: `🟢 Web gratis: ${rows.length} solicitudes nuevas`, html },
      { idempotencyKey },
    );
    if (!error) return { ok: true };
    const name = (error as { name?: string }).name ?? "";
    const message = `resend ${name}: ${error.message}`;
    if (name === "rate_limit_exceeded" || name === "concurrent_idempotent_requests") return { ok: false, retryAfterSec: 2, error: message };
    if (name === "application_error" || name === "internal_server_error") return { ok: false, retryAfterSec: 30, error: message };
    return { ok: false, permanent: true, error: message };
  } catch (error) {
    return { ok: false, retryAfterSec: 30, error: `resend network: ${String(error)}` };
  }
}

// ─── Direct path for database failures ──────────────────────────────────────

/** The DB write failed — push the raw request to the team so the lead isn't lost. */
export async function notifySaveFailed(summary: Record<string, unknown>, reason: string): Promise<void> {
  const body = Object.entries(summary)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `<b>${esc(k)}:</b> ${esc(clip(typeof v === "string" ? v : JSON.stringify(v), 300))}`)
    .join("\n");
  const whatsapp = typeof summary.whatsapp === "string" ? summary.whatsapp : null;
  const negocio = typeof summary.negocio === "string" ? summary.negocio : "su negocio";
  const html =
    `🔴 <b>WEB GRATIS — NO SE GUARDÓ EN LA BASE</b>\n${esc(clip(reason, 300))}\n\n${body}` +
    (whatsapp ? `\n\n👉 <a href="${esc(waLink(whatsapp, scripts.rescue(negocio)))}">Escribirle por WhatsApp</a>` : "\n\nEscríbale por WhatsApp a mano.");
  const chats = telegramChats();
  if (chats.length === 0) {
    console.error("[WebGratis] save failed AND Telegram not configured — lead only in logs", summary, reason);
    return;
  }
  await Promise.all(
    chats.map(async (chatId) => {
      let result = await sendTelegram(chatId, html);
      if (!result.ok && "retryAfterSec" in result && result.retryAfterSec <= 5) {
        const waitMs = result.retryAfterSec * 1000;
        await new Promise((r) => setTimeout(r, waitMs));
        result = await sendTelegram(chatId, html);
      }
      if (!result.ok) console.error("[WebGratis] save-failed alert not delivered", chatId, result.error, summary);
    }),
  );
}
