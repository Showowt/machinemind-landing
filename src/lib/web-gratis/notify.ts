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
import { countryFromE164, FREE_DAYS, MM_INSTAGRAM, MONTHLY_PRICE_USD, referralLink, SITE_ORIGIN, type SignupCountry } from "./config";
import { scripts, waLink } from "./scripts";
import { signedLinks, type Referrer, type WebGratisSignup } from "./server";

export const BOARD_URL = `${SITE_ORIGIN}/admin/web-gratis`;

/**
 * The confirmation goes out automatically from the funnel line; a manual wa.me
 * link here would make the client get the same "¡Recibido!" twice, from two numbers.
 */
const AUTO_CONFIRM_TEXT =
  "La confirmación por WhatsApp sale sola desde la línea del embudo (+1 786-257-0284) ~15 min después de enviar el formulario (7:00–20:59). No hace falta escribirle a mano.";
const AUTO_CONFIRM_NOTE = `🤖 ${AUTO_CONFIRM_TEXT}`;
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

const COUNTRY_LABELS: Record<SignupCountry, { flag: string; name: string }> = {
  SV: { flag: "🇸🇻", name: "El Salvador" },
  CO: { flag: "🇨🇴", name: "Colombia" },
  OTHER: { flag: "🌎", name: "Otro país" },
};

/** The row's market; rows older than the country column fall back to the number's prefix. */
export function rowCountry(row: Pick<WebGratisSignup, "country" | "whatsapp">): SignupCountry {
  return row.country ?? countryFromE164(row.whatsapp ?? "");
}

/** "🇨🇴 Colombia" — for Telegram/email alerts. */
export function countryLabel(row: Pick<WebGratisSignup, "country" | "whatsapp">): string {
  const c = COUNTRY_LABELS[rowCountry(row)];
  return `${c.flag} ${c.name}`;
}

/** Documents are a newer column; tolerate rows loaded before it existed. */
function docsOf(row: Pick<WebGratisSignup, "document_paths">): string[] {
  return Array.isArray(row.document_paths) ? row.document_paths : [];
}

function extOf(path: string): string {
  return (path.split(".").pop() ?? "archivo").toUpperCase();
}

/** "logo sí · 3 fotos · 2 documentos" */
export function filesSummary(row: Pick<WebGratisSignup, "logo_paths" | "photo_paths" | "document_paths">): string {
  const docs = docsOf(row).length;
  return `logo ${row.logo_paths.length ? "sí" : "no"} · ${row.photo_paths.length} foto${row.photo_paths.length === 1 ? "" : "s"} · ${docs} documento${docs === 1 ? "" : "s"}`;
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
  const docs = docsOf(row);
  const docLinks = docs.filter((p) => ctx.links[p]).slice(0, 6);
  const lines = [
    `🟢 <b>WEB GRATIS — SOLICITUD COMPLETA</b> · ${esc(countryLabel(row))}`,
    ``,
    `<b>${esc(row.business_name)}</b>`,
    esc(clip(row.business_type, 200)),
    `📍 ${esc(row.city)}   📱 ${esc(row.whatsapp)}`,
    row.address ? `🏠 ${esc(clip(row.address, 200))}` : null,
    ``,
    `<b>Servicios:</b> ${esc(clip(row.services.join(", "), 400))}`,
    row.differentiator ? `<b>Diferencia:</b> ${esc(clip(row.differentiator, 400))}` : null,
    row.hours ? `<b>Horario:</b> ${esc(clip(row.hours, 200))}` : null,
    row.instagram ? `<b>IG:</b> ${esc(row.instagram)}` : null,
    row.facebook ? `<b>FB:</b> ${esc(row.facebook)}` : null,
    row.style ? `<b>Estilo:</b> ${esc(clip(row.style, 200))}` : null,
    row.existing_website ? `<b>Ya tiene web:</b> ${esc(clip(row.existing_website, 200))} (actualizarla gratis u ofrecer una nueva)` : null,
    row.contact_email ? `<b>Email:</b> ${esc(row.contact_email)}` : null,
    row.extra_notes ? `<b>Notas:</b> ${esc(clip(row.extra_notes, 500))}` : null,
    `<b>Quiere:</b> ${esc(GOAL_LABELS[row.site_goal ?? ""] ?? "—")}${row.site_goal === "citas" ? " 🔥" : ""}`,
    `<b>Logo:</b> ${row.logo_paths.length ? (logoUrl ? `<a href="${esc(logoUrl)}">ver</a>` : "sí") : "no (diseñarlo)"}   <b>Fotos:</b> ${row.photo_paths.length}${photoUrls.length ? " " + photoUrls.slice(0, 4).map((u, i) => `<a href="${esc(u)}">${i + 1}</a>`).join(" ") : ""}${photoUrls.length > 4 ? " (resto en el tablero)" : ""}`,
    `<b>Documentos:</b> ${docs.length}${docLinks.length ? " " + docLinks.map((p) => `<a href="${esc(ctx.links[p])}">${esc(extOf(p))}</a>`).join(" ") : ""}${docs.length > docLinks.length ? (docLinks.length ? " (resto en el tablero)" : " (en el tablero)") : ""}`,
    ``,
    ctx.referrer
      ? `🤝 Referido por <b>${esc(ctx.referrer.business_name)}</b> (${esc(ctx.referrer.referral_code)}) — 1 mes gratis al activar`
      : null,
    row.referred_by_text
      ? `🤝 Dice que lo recomendó: «${esc(clip(row.referred_by_text, 120))}»${ctx.referrer ? "" : " — asigne el código en su tarjeta del tablero para darle el mes gratis"}`
      : null,
    `🔗 Su código: <b>${esc(row.referral_code)}</b>`,
    ctx.otherRequestsSameWhatsapp > 0 ? `⚠️ Este WhatsApp ya tiene ${ctx.otherRequestsSameWhatsapp} otra(s) solicitud(es).` : null,
    `📊 ${esc(sourceLabel(row))}`,
    ``,
    AUTO_CONFIRM_NOTE,
    `📋 <a href="${BOARD_URL}">Tablero</a>   🕐 ${esc(svTime(new Date(row.submitted_at ?? row.created_at)))}`,
  ].filter((l): l is string => l !== null);
  const html = lines.join("\n");
  // Very long free-text answers: fall back to the compact line so nothing is cut.
  return html.length <= TELEGRAM_MAX ? html : [`🟢 <b>WEB GRATIS — SOLICITUD COMPLETA</b> · ${esc(countryLabel(row))}`, ``, submittedLine(row, ctx.referrer ?? undefined), ``, `📋 <a href="${BOARD_URL}">Detalle completo en el tablero</a>`].join("\n");
}

/** Compact one-lead line for digests. */
export function submittedLine(row: WebGratisSignup, ref: Referrer | undefined): string {
  return [
    `• ${COUNTRY_LABELS[rowCountry(row)].flag} <b>${esc(clip(row.business_name, 60))}</b> — ${esc(clip(row.business_type, 60))} · ${esc(clip(row.city, 40))}`,
    `   📱 ${esc(row.whatsapp)} · ${esc(filesSummary(row))}${row.existing_website ? " · ya tiene web" : ""}${row.site_goal === "citas" ? " · 🔥citas" : ""}${ref ? ` · 🤝 ${esc(clip(ref.business_name, 30))}` : row.referred_by_text ? ` · 🤝 «${esc(clip(row.referred_by_text, 30))}»` : ""}`,
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
    `${AUTO_CONFIRM_NOTE}\n📋 <a href="${BOARD_URL}">Abrir tablero</a>`,
  );
}

export function abandonedDigests<T>(items: { ref: T; row: WebGratisSignup }[]) {
  return packMessages(
    items.map(({ ref, row }) => ({
      ref,
      line: `• ${COUNTRY_LABELS[rowCountry(row)].flag} <b>${esc(clip(row.business_name, 60))}</b> — ${esc(clip(row.business_type, 50))} · ${esc(clip(row.city, 40))} · paso ${row.step}/3 · <a href="${esc(waLink(row.whatsapp, scripts.rescue(row.business_name)))}">escribirle</a>`,
    })),
    (n) => `🟡 <b>WEB GRATIS — ${n} sin terminar el formulario</b>\nDieron nombre y WhatsApp pero no enviaron. Un mensaje los recupera:`,
    `📋 <a href="${BOARD_URL}">Tablero → Sin terminar</a>`,
  );
}

export function systemHtml(text: string): string {
  return `⚠️ <b>WEB GRATIS — sistema</b>\n${esc(text)}`;
}

// ─── Client-website alerts (sent by the outbox as Telegram + email) ─────────

export interface SiteAlertInfo {
  business: string;
  city: string;
  whatsapp: string;
  country: string;
  slug: string;
  version: number;
  previewUrl: string | null;
  publicUrl: string;
  /** The generator's note for the team. */
  notes?: string | null;
  /** Client files the generator couldn't read. */
  unread?: string[];
  /** Guards that fired (prices / claims removed, contrast fixes). */
  guards?: string[];
  error?: string | null;
  attempts?: number;
  /** Publish: DNS / delivery warnings. */
  warnings?: string[];
}

export interface SiteAlertMessage {
  html: string;
  text: string;
  subject: string;
  emailHtml: string;
}

function siteAlertEmail(title: string, rows: [string, string | null][], cta: { href: string; label: string } | null): string {
  const body = rows
    .filter(([, v]) => v)
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px;color:#1e9bf0;font-weight:600;vertical-align:top;width:130px">${esc(label)}</td><td style="padding:8px 12px;color:#f0f0f3;white-space:pre-wrap">${esc(value)}</td></tr>`,
    )
    .join("");
  return `
  <div style="font-family:system-ui,-apple-system,sans-serif;max-width:640px;margin:0 auto;background:#06060a;color:#f0f0f3;padding:28px;border-top:3px solid #1e9bf0">
    <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.2em;color:#1e9bf0;text-transform:uppercase">Web gratis · sitio del cliente</p>
    <h1 style="margin:0 0 16px;font-size:21px">${esc(title)}</h1>
    <table style="width:100%;border-collapse:collapse;font-size:14px;background:rgba(255,255,255,0.03)">${body}</table>
    ${cta ? `<p style="margin:20px 0 0"><a href="${esc(cta.href)}" style="display:inline-block;padding:13px 24px;border:1px solid #1e9bf0;color:#f0f0f3;text-decoration:none">${esc(cta.label)}</a></p>` : ""}
    <p style="margin:14px 0 0"><a href="${BOARD_URL}" style="color:#1e9bf0">Abrir tablero</a></p>
  </div>`;
}

/** "🟢 WEB LISTA PARA REVISAR — <business>" with the preview link. */
export function siteReadyMessage(i: SiteAlertInfo): SiteAlertMessage {
  const unread = i.unread ?? [];
  const guards = i.guards ?? [];
  const html = [
    `🟢 <b>WEB LISTA PARA REVISAR — ${esc(clip(i.business, 80))}</b>`,
    `${esc(i.country)} · ${esc(clip(i.city, 40))} · 📱 ${esc(i.whatsapp)} · v${i.version}`,
    ``,
    i.previewUrl ? `👀 <a href="${esc(i.previewUrl)}">Vista previa</a>` : `👀 Vista previa: falta MM_SITES_URL`,
    `🌐 Al publicar: ${esc(i.publicUrl)}`,
    i.notes ? `📝 ${esc(clip(i.notes, 500))}` : null,
    unread.length ? `📎 Sin leer: ${esc(clip(unread.join(" · "), 400))}` : null,
    guards.length ? `🛡 ${esc(clip(guards.join(" · "), 400))}` : null,
    ``,
    `📋 <a href="${BOARD_URL}">Tablero → Sitio web → Publicar</a>`,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
  const text = `WEB LISTA PARA REVISAR — ${i.business} (${i.city}) v${i.version}. Vista previa: ${i.previewUrl ?? "falta MM_SITES_URL"}`;
  return {
    html,
    text,
    subject: `🟢 Web lista para revisar — ${i.business} (${i.city})`,
    emailHtml: siteAlertEmail(
      `Web lista para revisar — ${i.business}`,
      [
        ["Negocio", `${i.business} — ${i.city} (${i.country})`],
        ["WhatsApp", i.whatsapp],
        ["Versión", `v${i.version}`],
        ["Al publicar", i.publicUrl],
        ["Nota", i.notes ?? null],
        ["Sin leer", unread.length ? unread.join("\n") : null],
        ["Filtros", guards.length ? guards.join("\n") : null],
      ],
      i.previewUrl ? { href: i.previewUrl, label: "Ver vista previa" } : null,
    ),
  };
}

/** "🚨 URGENTE — no se pudo generar la web de <business>". */
export function siteFailedMessage(i: SiteAlertInfo): SiteAlertMessage {
  const html = [
    `🚨 <b>URGENTE — no se pudo generar la web de ${esc(clip(i.business, 80))}</b>`,
    `${esc(i.country)} · ${esc(clip(i.city, 40))} · 📱 ${esc(i.whatsapp)}`,
    ``,
    `${esc(clip(i.error ?? "error desconocido", 700))}${i.attempts ? ` (${i.attempts} intento${i.attempts === 1 ? "" : "s"})` : ""}`,
    ``,
    `📋 <a href="${BOARD_URL}">Tablero → Sitio web → «Generar ahora»</a> para reintentar (puede dar instrucciones), o ármela a mano.`,
  ].join("\n");
  return {
    html,
    text: `URGENTE — no se pudo generar la web de ${i.business}: ${i.error ?? "error"}`,
    subject: `🚨 URGENTE — no se pudo generar la web de ${i.business}`,
    emailHtml: siteAlertEmail(
      `No se pudo generar la web de ${i.business}`,
      [
        ["Negocio", `${i.business} — ${i.city} (${i.country})`],
        ["WhatsApp", i.whatsapp],
        ["Error", i.error ?? "desconocido"],
        ["Intentos", i.attempts ? String(i.attempts) : null],
        ["Qué hacer", "Tablero → Sitio web → «Generar ahora» (con instrucciones si hace falta), o armarla a mano."],
      ],
      null,
    ),
  };
}

/** "✅ WEB PUBLICADA — <business> → <url>". */
export function sitePublishedMessage(i: SiteAlertInfo): SiteAlertMessage {
  const warnings = i.warnings ?? [];
  const html = [
    `✅ <b>WEB PUBLICADA — ${esc(clip(i.business, 80))}</b> → <a href="${esc(i.publicUrl)}">${esc(i.publicUrl)}</a>`,
    `${esc(i.country)} · ${esc(clip(i.city, 40))} · 📱 ${esc(i.whatsapp)} · v${i.version}`,
    `«Web lista» sale sola por WhatsApp ~10 min después (7:00–20:59).`,
    warnings.length ? `⚠️ ${esc(clip(warnings.join(" · "), 500))}` : null,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
  return {
    html,
    text: `WEB PUBLICADA — ${i.business} → ${i.publicUrl}`,
    subject: `✅ Web publicada — ${i.business} → ${i.publicUrl}`,
    emailHtml: siteAlertEmail(
      `Web publicada — ${i.business}`,
      [
        ["Negocio", `${i.business} — ${i.city} (${i.country})`],
        ["WhatsApp", i.whatsapp],
        ["Dirección", i.publicUrl],
        ["Versión", `v${i.version}`],
        ["Avisos", warnings.length ? warnings.join("\n") : null],
      ],
      { href: i.publicUrl, label: "Abrir la web" },
    ),
  };
}

// ─── Email ──────────────────────────────────────────────────────────────────

export async function sendSubmittedEmail(row: WebGratisSignup, ctx: LeadContext): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { ok: false, permanent: true, error: "RESEND_API_KEY missing" };

  const rowHtml = (label: string, value: string | null | undefined) =>
    value
      ? `<tr><td style="padding:10px 12px;color:#1e9bf0;font-weight:600;vertical-align:top;width:130px">${esc(label)}</td><td style="padding:10px 12px;color:#f0f0f3">${esc(value)}</td></tr>`
      : "";

  // Document links may not be signed by the caller yet — sign the missing ones here.
  const docs = docsOf(row);
  const unsigned = docs.filter((p) => !ctx.links[p]);
  const links = unsigned.length > 0 ? { ...(await signedLinks(unsigned)), ...ctx.links } : ctx.links;

  const tiles = [...row.logo_paths, ...row.photo_paths, ...docs]
    .filter((p) => links[p])
    .map((p) => {
      const url = links[p];
      const label = p.includes("/logo-") ? "Logo" : p.includes("/document-") ? "Documento" : "Foto";
      return /\.(jpe?g|png|webp|gif)$/i.test(p)
        ? `<a href="${esc(url)}" style="display:inline-block;margin:0 8px 8px 0"><img src="${esc(url)}" alt="${label}" width="120" style="width:120px;height:120px;object-fit:cover;border:1px solid rgba(255,255,255,0.12)"/></a>`
        : `<a href="${esc(url)}" style="display:inline-block;margin:0 8px 8px 0;color:#1e9bf0">${label} (${esc(p.split(".").pop() ?? "archivo")})</a>`;
    })
    .join("");

  const html = `
  <div style="font-family:system-ui,-apple-system,sans-serif;max-width:640px;margin:0 auto;background:#06060a;color:#f0f0f3;padding:32px;border-top:3px solid #1e9bf0">
    <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.2em;color:#1e9bf0;text-transform:uppercase">Web gratis · ${esc(countryLabel(row))}</p>
    <h1 style="margin:0 0 4px;font-size:24px">${esc(row.business_name)}</h1>
    <p style="margin:0 0 20px;color:rgba(240,240,243,0.6)">${esc(row.business_type)} — ${esc(row.city)}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;background:rgba(255,255,255,0.03)">
      ${rowHtml("País", countryLabel(row))}
      ${rowHtml("WhatsApp", row.whatsapp)}
      ${rowHtml("Dirección", row.address)}
      ${rowHtml("Email", row.contact_email)}
      ${rowHtml("Ya tiene web", row.existing_website ? `${row.existing_website} — actualizarla gratis u ofrecer una nueva` : null)}
      ${rowHtml("Servicios", row.services.join(", "))}
      ${rowHtml("Diferencia", row.differentiator)}
      ${rowHtml("Horario", row.hours)}
      ${rowHtml("Instagram", row.instagram)}
      ${rowHtml("Facebook", row.facebook)}
      ${rowHtml("Estilo", row.style)}
      ${rowHtml("Quiere", GOAL_LABELS[row.site_goal ?? ""] ?? null)}
      ${rowHtml("Notas", row.extra_notes)}
      ${rowHtml("Archivos", filesSummary(row))}
      ${rowHtml("Referido por", ctx.referrer ? `${ctx.referrer.business_name} (${ctx.referrer.referral_code})` : null)}
      ${rowHtml("Dice que lo recomendó", row.referred_by_text ? `${row.referred_by_text}${ctx.referrer ? "" : " — asigne el código en el tablero para darle el mes gratis"}` : null)}
      ${rowHtml("Su código", `${row.referral_code} — ${referralLink(row.referral_code)}`)}
      ${rowHtml("Fuente", sourceLabel(row))}
      ${rowHtml("Aceptó", `Gratis ${FREE_DAYS} días en línea; después elige: alojamiento con nosotros $${MONTHLY_PRICE_USD} USD/mes con soporte completo, o alojarla por su cuenta (se le entregan los archivos, sin asistencia) · compartir y etiquetar @${MM_INSTAGRAM}`)}
    </table>
    ${tiles ? `<h2 style="font-size:14px;margin:24px 0 10px;color:#1e9bf0">Logo, fotos y documentos (links válidos 7 días)</h2><div>${tiles}</div>` : `<p style="margin-top:20px;color:rgba(240,240,243,0.6)">Sin logo, fotos ni documentos — usar imágenes de su rubro y diseñar logo.</p>`}
    <p style="margin:24px 0 0;color:rgba(240,240,243,0.7);font-size:14px">${esc(AUTO_CONFIRM_TEXT)}</p>
    <p style="margin:16px 0 0">
      <a href="${BOARD_URL}" style="display:inline-block;padding:14px 26px;border:1px solid #1e9bf0;color:#f0f0f3;text-decoration:none">Abrir tablero</a>
    </p>
    <p style="margin:24px 0 0;font-size:12px;color:rgba(240,240,243,0.4)">${esc(svTime(new Date(row.submitted_at ?? row.created_at)))} (hora SV) · ID ${esc(row.id)}</p>
  </div>`;

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send(
      {
        from: FROM_EMAIL,
        to: TEAM_EMAIL,
        subject: `🟢 Web gratis ${COUNTRY_LABELS[rowCountry(row)].flag} ${row.business_name} (${row.city})`,
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
        <div style="color:rgba(240,240,243,0.6);margin-bottom:6px">${esc(row.business_type)} — ${esc(row.city)} · ${esc(countryLabel(row))}</div>
        ${field("WhatsApp", row.whatsapp)}
        ${field("Dirección", row.address)}
        ${field("Email", row.contact_email)}
        ${field("Ya tiene web", row.existing_website)}
        ${field("Servicios", row.services.join(", "))}
        ${field("Diferencia", row.differentiator)}
        ${field("Horario", row.hours)}
        ${field("Instagram", row.instagram)}
        ${field("Facebook", row.facebook)}
        ${field("Estilo", row.style)}
        ${field("Quiere", GOAL_LABELS[row.site_goal ?? ""] ?? null)}
        ${field("Notas", row.extra_notes)}
        ${field("Archivos", filesSummary(row))}
        ${field("Referido por", ref ? `${ref.business_name} (${ref.referral_code})` : null)}
        ${field("Dice que lo recomendó", row.referred_by_text)}
        ${field("Código", row.referral_code)}
      </div>`;
    })
    .join("");

  const html = `
  <div style="font-family:system-ui,-apple-system,sans-serif;max-width:680px;margin:0 auto;background:#06060a;color:#f0f0f3;padding:28px;border-top:3px solid #1e9bf0">
    <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.2em;color:#1e9bf0;text-transform:uppercase">Web gratis · El Salvador y Colombia</p>
    <h1 style="margin:0 0 8px;font-size:22px">${rows.length} solicitudes nuevas</h1>
    <p style="margin:0 0 16px;color:rgba(240,240,243,0.7);font-size:14px">${esc(AUTO_CONFIRM_TEXT)}</p>
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

/** One team e-mail for a client-website alert (ready / failed / published). */
export async function sendAlertEmail(subject: string, html: string, idempotencyKey: string): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { ok: false, permanent: true, error: "RESEND_API_KEY missing" };
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send(
      { from: FROM_EMAIL, to: TEAM_EMAIL, subject, html },
      { idempotencyKey: idempotencyKey.slice(0, 256) },
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
