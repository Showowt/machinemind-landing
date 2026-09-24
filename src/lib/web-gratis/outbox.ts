/**
 * Free-website funnel — notification outbox.
 *
 * Every team alert is a row in web_gratis_outbox before anything is sent. The
 * drainer claims due rows (FOR UPDATE SKIP LOCKED, so parallel drainers never
 * double-send), sends them per Telegram chat and by email, records per-chat
 * progress, and reschedules whatever hit a rate limit. Under load it switches
 * from one message per lead to digests so Telegram stays under its limits and
 * readable. The database row is the source of truth; alerts are just nudges.
 */
import {
  abandonedDigests,
  sendDigestEmail,
  sendSubmittedEmail,
  sendTelegram,
  sendTelegramPhotos,
  submittedDigests,
  submittedHtml,
  systemHtml,
  telegramChats,
  type LeadContext,
} from "./notify";
import { getDb, signedLinks, SIGNUPS_TABLE, storage, type Referrer, type WebGratisSignup } from "./server";

export const OUTBOX_TABLE = "web_gratis_outbox";

type Kind = "submitted" | "abandoned" | "system";

interface OutboxRow {
  id: number;
  dedupe_key: string;
  kind: Kind;
  signup_id: string | null;
  payload: { tg_done?: string[]; text?: string } | null;
  status: string;
  telegram_done: boolean;
  email_done: boolean;
  attempts: number;
  created_at: string;
}

interface RowState {
  tgDone: Set<string>;
  emailDone: boolean;
  retryAfterSec: number | null;
  touched: boolean;
  errors: string[];
}

export interface DrainReport {
  claimed: number;
  sent: number;
  rescheduled: number;
  failed: number;
  skipped: number;
  telegramMessages: number;
  emails: number;
}

const MAX_ATTEMPTS = 10;
const INDIVIDUAL_MAX = 4; // more new leads than this in one drain → digest mode
const PHOTOS_MAX_LEADS = 2; // only attach photo albums when volume is very low
const EMAIL_DIGEST_SIZE = 25; // leads per burst-mode email

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function backoffSec(attempts: number): number {
  return Math.min(600, 15 * 2 ** Math.max(0, attempts - 1));
}

// ─── Enqueue ────────────────────────────────────────────────────────────────

export async function enqueue(
  kind: Kind,
  dedupeKey: string,
  signupId: string | null,
  payload: Record<string, unknown> = {},
): Promise<boolean> {
  const { error } = await getDb()
    .from(OUTBOX_TABLE)
    .upsert({ dedupe_key: dedupeKey, kind, signup_id: signupId, payload }, { onConflict: "dedupe_key", ignoreDuplicates: true });
  if (error) {
    console.error("[WebGratis:outbox] enqueue failed", dedupeKey, error);
    return false;
  }
  return true;
}

/** System alert, deduplicated by key (use a time bucket in the key to throttle). */
export function enqueueSystem(key: string, text: string): Promise<boolean> {
  return enqueue("system", `system:${key}`, null, { text });
}

// ─── Drain ──────────────────────────────────────────────────────────────────

export async function drainOutbox({ budgetMs, limit = 60 }: { budgetMs: number; limit?: number }): Promise<DrainReport> {
  const report: DrainReport = { claimed: 0, sent: 0, rescheduled: 0, failed: 0, skipped: 0, telegramMessages: 0, emails: 0 };
  const deadline = Date.now() + budgetMs;
  const db = getDb();

  const { data, error } = await db.rpc("web_gratis_claim_outbox", { p_limit: limit });
  if (error) throw error;
  const rows = (data ?? []) as OutboxRow[];
  report.claimed = rows.length;
  if (rows.length === 0) return report;

  // Load the signups these alerts are about.
  const signupIds = [...new Set(rows.map((r) => r.signup_id).filter((id): id is string => !!id))];
  const signups = new Map<string, WebGratisSignup>();
  if (signupIds.length) {
    const { data: found, error: loadError } = await db.from(SIGNUPS_TABLE).select("*").in("id", signupIds);
    if (loadError) throw loadError;
    for (const s of (found ?? []) as WebGratisSignup[]) signups.set(s.id, s);
  }

  const state = new Map<number, RowState>();
  for (const r of rows) {
    state.set(r.id, {
      tgDone: new Set(r.payload?.tg_done ?? []),
      emailDone: r.email_done || r.kind !== "submitted",
      retryAfterSec: null,
      touched: false,
      errors: [],
    });
  }

  // Alerts that no longer apply: form finished after the "abandoned" sweep, or row deleted.
  const skip = new Set<number>();
  for (const r of rows) {
    const s = r.signup_id ? signups.get(r.signup_id) : undefined;
    if (r.kind === "abandoned" && (!s || s.status !== "borrador")) skip.add(r.id);
    if (r.kind === "submitted" && !s) skip.add(r.id);
    if (r.kind === "system" && !r.payload?.text) skip.add(r.id);
  }
  const live = rows.filter((r) => !skip.has(r.id));
  const leadOf = (r: OutboxRow) => signups.get(r.signup_id as string) as WebGratisSignup;

  // Context for submitted leads: referrers, duplicate WhatsApps, signed file links.
  const submittedLeads = live.filter((r) => r.kind === "submitted").map(leadOf);
  const referrers = new Map<string, Referrer>();
  const refIds = [...new Set(submittedLeads.map((s) => s.referred_by_id).filter((id): id is string => !!id))];
  if (refIds.length) {
    const { data: refs } = await db.from(SIGNUPS_TABLE).select("id, business_name, whatsapp, referral_code").in("id", refIds);
    for (const ref of (refs ?? []) as Referrer[]) referrers.set(ref.id, ref);
  }
  const dupCounts = new Map<string, number>();
  const phones = [...new Set(submittedLeads.map((s) => s.whatsapp))];
  if (phones.length) {
    const { data: same } = await db.from(SIGNUPS_TABLE).select("id, whatsapp").in("whatsapp", phones).neq("status", "borrador");
    for (const s of (same ?? []) as { id: string; whatsapp: string }[]) dupCounts.set(s.whatsapp, (dupCounts.get(s.whatsapp) ?? 0) + 1);
  }
  const links = await signedLinks(submittedLeads.flatMap((s) => [...s.logo_paths, ...s.photo_paths]));
  const ctxFor = (s: WebGratisSignup): LeadContext => ({
    referrer: s.referred_by_id ? (referrers.get(s.referred_by_id) ?? null) : null,
    links,
    otherRequestsSameWhatsapp: Math.max(0, (dupCounts.get(s.whatsapp) ?? 1) - 1),
  });

  // ── Telegram, per chat ──
  const chats = telegramChats();
  if (chats.length === 0) console.error("[WebGratis:outbox] Telegram not configured — alerts go to email + board only");

  for (const chat of chats) {
    const pending = live.filter((r) => !state.get(r.id)!.tgDone.has(chat));
    const system = pending.filter((r) => r.kind === "system");
    const submitted = pending.filter((r) => r.kind === "submitted");
    const abandoned = pending.filter((r) => r.kind === "abandoned");

    const plan: { rows: OutboxRow[]; html: string; photos?: string[] }[] = [];
    for (const r of system) plan.push({ rows: [r], html: systemHtml(String(r.payload?.text ?? "")) });
    if (submitted.length <= INDIVIDUAL_MAX) {
      for (const r of submitted) {
        const lead = leadOf(r);
        const photos =
          submitted.length <= PHOTOS_MAX_LEADS
            ? [...lead.logo_paths, ...lead.photo_paths].filter((p) => /\.(jpe?g|png|webp)$/i.test(p)).map((p) => links[p]).filter(Boolean)
            : [];
        plan.push({ rows: [r], html: submittedHtml(lead, ctxFor(lead)), photos });
      }
    } else {
      // Packed by size, never truncated: every lead lands in some message.
      for (const msg of submittedDigests(submitted.map((r) => ({ ref: r, row: leadOf(r) })), referrers)) {
        plan.push({ rows: msg.refs, html: msg.html });
      }
    }
    for (const msg of abandonedDigests(abandoned.map((r) => ({ ref: r, row: leadOf(r) })))) {
      plan.push({ rows: msg.refs, html: msg.html });
    }

    const paceMs = plan.length > 3 ? 1100 : 300;
    for (let i = 0; i < plan.length; i++) {
      const msg = plan[i];
      if (Date.now() > deadline - 1500) break; // untouched rows go back to the queue, due now
      msg.rows.forEach((r) => (state.get(r.id)!.touched = true));
      const res = await sendTelegram(chat, msg.html);
      if (res.ok) {
        report.telegramMessages++;
        msg.rows.forEach((r) => state.get(r.id)!.tgDone.add(chat));
        if (msg.photos && msg.photos.length > 0) {
          const album = await sendTelegramPhotos(chat, msg.photos, "📸 Logo y fotos");
          if (!album.ok) console.error("[WebGratis:outbox] photo album not sent (link is in the alert)", album.error);
        }
      } else if ("retryAfterSec" in res) {
        // Rate-limited or transient: this and every later message for this chat wait.
        for (const later of plan.slice(i)) {
          for (const r of later.rows) {
            const st = state.get(r.id)!;
            st.touched = true;
            st.retryAfterSec = Math.max(st.retryAfterSec ?? 0, res.retryAfterSec);
            st.errors.push(res.error);
          }
        }
        break;
      } else {
        // Permanent for this chat (bot removed, bad chat id): stop retrying it, tell the other chats.
        msg.rows.forEach((r) => {
          const st = state.get(r.id)!;
          st.tgDone.add(chat);
          st.errors.push(res.error);
        });
        const hour = new Date().toISOString().slice(0, 13);
        if (chats.length > 1) await enqueueSystem(`chat-broken:${chat}:${hour}`, `No se pudo enviar al chat ${chat}: ${res.error}`);
      }
      if (i < plan.length - 1) await sleep(paceMs);
    }
  }

  // ── Email: one per lead when quiet, digest emails in a burst ──
  const emailRows = live.filter((row) => row.kind === "submitted" && !state.get(row.id)!.emailDone);
  const emailGroups = emailRows.length <= INDIVIDUAL_MAX ? emailRows.map((r) => [r]) : chunk(emailRows, EMAIL_DIGEST_SIZE);
  for (const group of emailGroups) {
    if (Date.now() > deadline - 1500) break;
    group.forEach((r) => (state.get(r.id)!.touched = true));
    const res =
      group.length === 1
        ? await sendSubmittedEmail(leadOf(group[0]), ctxFor(leadOf(group[0])))
        : await sendDigestEmail(group.map(leadOf), referrers, links);
    for (const r of group) {
      const st = state.get(r.id)!;
      if (res.ok) {
        st.emailDone = true;
      } else if ("retryAfterSec" in res) {
        st.retryAfterSec = Math.max(st.retryAfterSec ?? 0, res.retryAfterSec);
        st.errors.push(res.error);
      } else {
        st.emailDone = true; // permanent (quota, bad key): Telegram + board still carry the lead
        st.errors.push(res.error);
      }
    }
    if (res.ok) report.emails++;
    await sleep(550); // Resend allows ~2 requests/second
  }

  // ── Persist outcomes ──
  const now = new Date();
  await Promise.all(
    rows.map(async (r) => {
      const st = state.get(r.id)!;
      let update: Record<string, unknown>;
      if (skip.has(r.id)) {
        report.skipped++;
        update = { status: "sent", sent_at: now.toISOString(), last_error: "skipped: no longer applies" };
      } else {
        const telegramDone = chats.length === 0 || chats.every((c) => st.tgDone.has(c));
        const payload = { ...(r.payload ?? {}), tg_done: [...st.tgDone] };
        const lastError = st.errors.length ? st.errors.slice(-3).join(" | ").slice(0, 2000) : null;
        if (telegramDone && st.emailDone) {
          report.sent++;
          update = { status: "sent", sent_at: now.toISOString(), telegram_done: true, email_done: true, payload, last_error: lastError };
        } else if (!st.touched) {
          // Ran out of time before trying — no attempt consumed, due immediately.
          report.rescheduled++;
          update = { status: "pending", attempts: Math.max(0, r.attempts - 1), next_attempt_at: now.toISOString(), payload };
        } else if (r.attempts >= MAX_ATTEMPTS) {
          report.failed++;
          update = { status: "failed", telegram_done: telegramDone, email_done: st.emailDone, payload, last_error: lastError };
        } else {
          report.rescheduled++;
          const wait = st.retryAfterSec ?? backoffSec(r.attempts);
          update = {
            status: "pending",
            next_attempt_at: new Date(now.getTime() + wait * 1000).toISOString(),
            telegram_done: telegramDone,
            email_done: st.emailDone,
            payload,
            last_error: lastError,
          };
        }
      }
      const { error: saveError } = await db.from(OUTBOX_TABLE).update(update).eq("id", r.id);
      if (saveError) console.error("[WebGratis:outbox] could not record outcome", r.id, saveError);
    }),
  );

  return report;
}

/**
 * Instant alerts when it's quiet; hands off to the 1-minute cron under load.
 * Many parallel drainers would each pace themselves independently and together
 * blow through Telegram's per-chat limit — one cron drainer sends digests instead.
 */
export async function drainIfQuiet(): Promise<void> {
  const { count, error } = await getDb()
    .from(OUTBOX_TABLE)
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "sending"]);
  if (error) throw error;
  if ((count ?? 0) > INDIVIDUAL_MAX + 1) return;
  await drainOutbox({ budgetMs: 8000, limit: 10 });
}

// ─── Maintenance (cron) ─────────────────────────────────────────────────────

interface BoardStats {
  by_status: Record<string, number>;
  started_today: number;
  submitted_today: number;
  started_yesterday: number;
  submitted_yesterday: number;
  stale_nuevo: number;
  unconfirmed_nuevo: number;
  outbox_pending: number;
  outbox_failed: number;
  top_referrers: { business_name: string; referral_code: string; n: number }[];
  // WhatsApp automation (20260925 migration)
  wa_queued?: number;
  wa_sent_today?: number;
  wa_failed_24h?: number;
  wa_inbound_today?: number;
  opted_out?: number;
  no_whatsapp?: number;
  credits_pending?: number;
  // 20260926 migration
  renewals_due?: number;
  recontact_due?: number;
  paid_unbuilt?: number;
}

export async function boardStats(): Promise<BoardStats> {
  const { data, error } = await getDb().rpc("web_gratis_board_stats");
  if (error) throw error;
  return data as BoardStats;
}

export interface MaintenanceReport {
  abandonedQueued: number;
  alerts: string[];
}

export async function runMaintenance(): Promise<MaintenanceReport> {
  const db = getDb();
  const alerts: string[] = [];
  const now = new Date();
  const hourKey = now.toISOString().slice(0, 13);

  const { data: queued, error: sweepError } = await db.rpc("web_gratis_enqueue_abandoned", { p_idle_minutes: 20 });
  if (sweepError) throw sweepError;

  const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  const { count: stuck } = await db
    .from(OUTBOX_TABLE)
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "sending"])
    .neq("kind", "system")
    .lt("created_at", tenMinAgo);
  if ((stuck ?? 0) > 0) {
    const text = `${stuck} alerta(s) llevan más de 10 min en cola (límite de Telegram/Resend o error). Los datos están seguros: revise el tablero.`;
    alerts.push(text);
    await enqueueSystem(`backlog:${hourKey}`, text);
  }

  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const { count: failed } = await db
    .from(OUTBOX_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("status", "failed")
    .gte("updated_at", hourAgo);
  if ((failed ?? 0) > 0) {
    const text = `${failed} alerta(s) fallaron definitivamente en la última hora. Las solicitudes están en el tablero.`;
    alerts.push(text);
    await enqueueSystem(`failed:${hourKey}`, text);
  }

  const { error: storageError } = await storage().list("", { limit: 1 });
  if (storageError) {
    const text = `El almacenamiento de fotos no responde: ${storageError.message}. Las subidas pueden fallar.`;
    alerts.push(text);
    await enqueueSystem(`storage:${hourKey}`, text);
  }

  // Daily summary, first run after 8:00 a.m. El Salvador (UTC-6, no DST).
  if (now.getUTCHours() === 14) {
    const day = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const stats = await boardStats();
    const s = stats.by_status;
    const rate = stats.started_yesterday ? Math.round((stats.submitted_yesterday / stats.started_yesterday) * 100) : 0;
    const top = stats.top_referrers.length
      ? stats.top_referrers.map((t) => `${t.business_name} (${t.n})`).join(", ")
      : "—";
    const text = [
      `Resumen de ayer: ${stats.started_yesterday} empezaron · ${stats.submitted_yesterday} completaron (${rate}%).`,
      `Ahora: nuevas ${s.nuevo ?? 0} · en construcción ${s.en_construccion ?? 0} · entregadas ${s.entregada ?? 0} · compartidas ${s.compartida ?? 0} · activas ${s.activa ?? 0}.`,
      `Nuevas sin confirmar: ${stats.unconfirmed_nuevo} · con más de 24 h: ${stats.stale_nuevo}.`,
      `Top referidores: ${top}.`,
      `WhatsApp automático: en cola ${stats.wa_queued ?? 0} · fallidos 24 h ${stats.wa_failed_24h ?? 0} · bajas ${stats.opted_out ?? 0} · créditos de referido por aplicar ${stats.credits_pending ?? 0}.`,
      `Cobros a mano (PayPal/efectivo) por renovar o vencidos: ${stats.renewals_due ?? 0} · pausadas para recontactar hoy: ${stats.recontact_due ?? 0} · pagaron y aún no se entregan: ${stats.paid_unbuilt ?? 0}.`,
    ].join("\n");
    await enqueueSystem(`daily:${day}`, text);
  }

  return { abandonedQueued: typeof queued === "number" ? queued : 0, alerts };
}
