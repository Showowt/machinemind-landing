"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import styles from "./board.module.css";
import { footerSnippet, payUrl, referralLink } from "@/lib/web-gratis/config";
import { scripts, waLink } from "@/lib/web-gratis/scripts";
import type { WebGratisSignup } from "@/lib/web-gratis/server";
import { manualBlock, TEMPLATE_LABEL, UNKNOWN_OUTCOME_CODE, type TemplateName } from "@/lib/web-gratis/templates";

// ─── Types ──────────────────────────────────────────────────────────────────

type View = "nuevo" | "en_construccion" | "entregada" | "compartida" | "activa" | "cerradas" | "borrador" | "todas";
type Status = WebGratisSignup["status"];

type Row = WebGratisSignup;

/** One WhatsApp message in a client's log (web_gratis_messages). */
interface LogItem {
  id: number;
  signup_id: string;
  direction: "inbound" | "outbound";
  template: TemplateName | null;
  source: string;
  msg_type: string | null;
  body: string | null;
  status: string;
  attempts: number;
  next_attempt_at: string | null;
  last_error_code: string | null;
  last_error: string | null;
  received_at: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
}

interface Credit {
  id: number;
  referrer_id: string;
  referred_id: string;
  months: number;
  applied_at: string | null;
  created_at: string;
  referrer_name: string;
  referred_name: string;
}

interface Stats {
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
  wa_queued?: number;
  wa_sent_today?: number;
  wa_failed_24h?: number;
  wa_inbound_today?: number;
  opted_out?: number;
  no_whatsapp?: number;
  credits_pending?: number;
  renewals_due?: number;
  recontact_due?: number;
  paid_unbuilt?: number;
}

interface Settings {
  delivery_days: number | null;
  high_demand: boolean;
  pay_link: string | null;
  demo_link: string | null;
  paypal_link: string | null;
}

interface ListResponse {
  view: View;
  page: number;
  pageSize: number;
  total: number;
  rows: Row[];
  stats: Stats;
  settings: Settings;
  links: Record<string, string>;
  referrers: Record<string, { name: string; code: string }>;
  messages: Record<string, LogItem[]>;
  credits: Credit[];
}

interface SettingsDraft {
  days: string;
  highDemand: boolean;
  payLink: string;
  demoLink: string;
  paypalLink: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const TOKEN_KEY = "mm-wg-admin-token";

const TABS: { view: View; label: string; statuses: Status[] | null }[] = [
  { view: "nuevo", label: "Nuevas", statuses: ["nuevo"] },
  { view: "en_construccion", label: "En construcción", statuses: ["en_construccion"] },
  { view: "entregada", label: "Entregadas", statuses: ["entregada"] },
  { view: "compartida", label: "Compartidas", statuses: ["compartida"] },
  { view: "activa", label: "Activas ($)", statuses: ["activa"] },
  { view: "cerradas", label: "Cerradas", statuses: ["pausada", "cancelada", "descartada"] },
  { view: "borrador", label: "Sin terminar", statuses: ["borrador"] },
  { view: "todas", label: "Todas", statuses: null },
];

const STATUS_LABEL: Record<Status, string> = {
  borrador: "Sin terminar",
  nuevo: "Nueva",
  en_construccion: "En construcción",
  entregada: "Entregada",
  compartida: "Compartida",
  activa: "Activa",
  pausada: "Pausada",
  cancelada: "Cancelada",
  descartada: "Descartada",
};

const GOAL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  citas: "Citas 🔥",
  mostrar: "Solo mostrar",
};

/** Automatic templates that make sense to send/retry by hand at each stage. */
function templatesFor(row: Row, log: LogItem[]): TemplateName[] {
  const status = row.status;
  if (status === "nuevo" || status === "en_construccion") return ["cqv_web_confirm"];
  if (status === "entregada" || status === "compartida") {
    return ["cqv_web_ready", "cqv_web_day28", "cqv_web_day30", "cqv_web_pause_notice", "cqv_web_rescue"];
  }
  if (status === "pausada") return ["cqv_web_rescue"];
  // Paid before delivery: "Web lista" is queued when it's delivered — show it so it can be followed / retried.
  if (status === "activa" && log.some((l) => l.template === "cqv_web_ready")) return ["cqv_web_ready"];
  return [];
}

const MSG_STATUS_LABEL: Record<string, string> = {
  queued: "en cola",
  sent: "enviado",
  delivered: "entregado",
  read: "leído",
  failed: "falló",
  skipped: "omitido",
  received: "recibido",
};

const REACHED = ["sent", "delivered", "read"];
const PAID_VIA_LABEL: Record<string, string> = { stripe: "Stripe", paypal: "PayPal", manual: "a mano" };

// ─── Helpers ────────────────────────────────────────────────────────────────

function ago(iso: string | null): string {
  if (!iso) return "—";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} d`;
}

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  // Whole days left until the end of that El Salvador day (0 = today is the last day).
  const end = new Date(`${date}T23:59:59-06:00`).getTime();
  return Math.floor((end - Date.now()) / 86_400_000);
}

/** Today in El Salvador (UTC-6, no DST), YYYY-MM-DD, shifted by `days`. */
function svToday(days = 0): string {
  const d = new Date(Date.now() - 6 * 3_600_000);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function sinceDelivered(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function withinHours(iso: string | null, hours: number): boolean {
  return !!iso && Date.now() - new Date(iso).getTime() < hours * 3_600_000;
}

function leftLabel(days: number): string {
  return days >= 0 ? `faltan ${days} d` : `venció hace ${-days} d`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let done = false;
    try {
      done = document.execCommand("copy");
    } catch (error) {
      console.error("[WebGratis:board] copy failed", error);
    }
    document.body.removeChild(ta);
    return done;
  }
}

interface Badge {
  label: string;
  tone: "badgeRed" | "badgeAmber" | "badgeGreen" | "badgeDim";
}

function badgesFor(row: Row): Badge[] {
  const out: Badge[] = [];
  if (row.opted_out_at) out.push({ label: "Baja WhatsApp", tone: "badgeRed" });
  if (row.no_whatsapp_at) out.push({ label: "Sin WhatsApp", tone: "badgeRed" });
  if (row.activated_at && (row.status === "nuevo" || row.status === "en_construccion")) {
    out.push({ label: "Pagó — construir y entregar", tone: "badgeAmber" });
  }
  if (row.status === "activa" && row.paid_via !== "stripe" && row.paid_through) {
    const left = daysUntil(row.paid_through);
    if (left !== null && left < 0) out.push({ label: "Pago del mes vencido", tone: "badgeRed" });
    else if (left !== null && left <= 3) out.push({ label: "Cobrar el mes pronto", tone: "badgeAmber" });
  }
  if (row.status === "pausada" && row.recontact_after && row.recontact_after <= svToday()) {
    out.push({ label: "Recontactar", tone: "badgeAmber" });
  }
  if (row.handoff_kind && withinHours(row.handoff_at, 72)) {
    out.push({ label: row.handoff_kind === "call_request" ? "Pide llamada" : "Pidió una persona", tone: "badgeAmber" });
  }
  if (row.wants_changes_at && withinHours(row.wants_changes_at, 24 * 7)) out.push({ label: "Quiere cambios", tone: "badgeAmber" });
  if (row.rung2_interest_at) out.push({ label: "Quiere citas ($49)", tone: "badgeGreen" });
  if (row.paid_via && row.status === "activa") out.push({ label: `Pagó (${PAID_VIA_LABEL[row.paid_via] ?? row.paid_via})`, tone: "badgeGreen" });
  if (row.referred_by_text && !row.referred_by_id) out.push({ label: "Referido sin asignar", tone: "badgeAmber" });
  if (row.declined_at) out.push({ label: "Dijo que no", tone: "badgeDim" });
  return out;
}

function slaClass(row: Row): string {
  if (row.status !== "nuevo") return "";
  const hours = (Date.now() - new Date(row.submitted_at ?? row.created_at).getTime()) / 3_600_000;
  if (hours > 24) return styles.slaRed;
  if (!row.confirmed_at && hours > 2) return styles.slaAmber;
  return "";
}

// ─── WhatsApp script link (module scope: never remounts) ────────────────────

interface WaActionProps {
  href: string;
  className: string;
  label: string;
  /** Reason it must not be sent — rendered as a disabled chip. */
  blocked: string | null;
  /** Ask before opening (e.g. the automatic template already went out). */
  confirmText: string | null;
  onOpen: () => void;
}

function WaAction({ href, className, label, blocked, confirmText, onOpen }: WaActionProps) {
  if (blocked) {
    return (
      <span className={styles.waOff} title={blocked} aria-disabled="true">
        {label}
      </span>
    );
  }
  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (confirmText && !window.confirm(confirmText)) {
      event.preventDefault();
      return;
    }
    onOpen();
  }
  return (
    <a className={className} href={href} target="_blank" rel="noopener noreferrer" onClick={onClick}>
      {label}
    </a>
  );
}

// ─── Card (module scope: inputs never remount while typing) ─────────────────

interface CardProps {
  row: Row;
  links: Record<string, string>;
  referrer: { name: string; code: string } | undefined;
  settings: Settings | null;
  log: LogItem[];
  credits: Credit[];
  onPatch: (id: string, body: Record<string, unknown>) => Promise<boolean>;
  onSend: (id: string, template: TemplateName, force: boolean) => Promise<string>;
  onApplyCredit: (creditId: number) => Promise<string>;
}

function Card({ row, links, referrer, settings, log, credits, onPatch, onSend, onApplyCredit }: CardProps) {
  const [siteUrl, setSiteUrl] = useState(row.site_url ?? "");
  const [notes, setNotes] = useState(row.notes ?? "");
  const [phone, setPhone] = useState(row.whatsapp);
  const [refCode, setRefCode] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const payLink = settings?.pay_link ?? null;
  const files = [...row.logo_paths, ...row.photo_paths];
  const freeLeft = daysUntil(row.free_until);
  const paidLeft = daysUntil(row.paid_through);
  const dayN = sinceDelivered(row.delivered_at);
  const badges = badgesFor(row);
  const earned = credits.filter((c) => c.referrer_id === row.id);
  const earnedPending = earned.filter((c) => !c.applied_at).reduce((n, c) => n + c.months, 0);
  const earnedMonths = earned.reduce((n, c) => n + c.months, 0);
  const creditedBy = credits.find((c) => c.referred_id === row.id);
  const templates = templatesFor(row, log);
  const manualPayer = row.status === "activa" && row.paid_via !== "stripe";

  // Manual WhatsApp guards: never write to someone who opted out / has no WhatsApp; never insist after a "no".
  const blockedAll = row.opted_out_at
    ? "Se dio de baja de WhatsApp: no se le escribe."
    : row.no_whatsapp_at
      ? "Su número no tiene WhatsApp: corríjalo en «Más detalle»."
      : null;
  const blockedPush = blockedAll ?? (row.declined_at ? "Dijo que no: no se le insiste." : null);
  const autoSent = (tpl: TemplateName) => log.find((l) => l.template === tpl && (l.status === "queued" || REACHED.includes(l.status)));

  async function patch(body: Record<string, unknown>, okText?: string) {
    setBusy(true);
    const ok = await onPatch(row.id, body);
    setBusy(false);
    if (ok && okText) {
      setFlash(okText);
      window.setTimeout(() => setFlash(null), 1800);
    }
    return ok;
  }

  function say(text: string, ms = 3500) {
    setFlash(text);
    window.setTimeout(() => setFlash(null), ms);
  }

  /** A scripted wa.me message from the operator's own WhatsApp. */
  function wa(kind: string, text: string, label: string, opts: { className: string; blocked: string | null; auto?: TemplateName; extra?: Record<string, unknown> }) {
    const sent = opts.auto ? autoSent(opts.auto) : undefined;
    return (
      <WaAction
        href={waLink(row.whatsapp, text)}
        className={sent ? styles.waGhost : opts.className}
        label={sent ? `${label} (✓ auto)` : label}
        blocked={opts.blocked}
        confirmText={
          sent
            ? `«${TEMPLATE_LABEL[opts.auto as TemplateName]}» ya ${sent.status === "queued" ? "está en cola para salir" : "salió"} automática por la línea del embudo. ¿Escribirle esto además desde su WhatsApp?`
            : null
        }
        onOpen={() => void onPatch(row.id, { touch: kind, ...(opts.extra ?? {}) })}
      />
    );
  }

  async function move(status: Status, extra: Record<string, unknown> = {}) {
    if (status === "entregada" && !siteUrl.trim()) {
      say("Pegue primero el link de la web", 2200);
      return;
    }
    await patch(status === "entregada" ? { status, siteUrl: siteUrl.trim(), ...extra } : { status, ...extra }, `→ ${STATUS_LABEL[status]}`);
  }

  async function reopen() {
    const target: Status = row.activated_at ? "activa" : row.delivered_at ? "entregada" : "nuevo";
    if (target === "entregada") {
      const until = row.free_until && row.free_until > svToday(7) ? row.free_until : svToday(7);
      const ok = window.confirm(
        `Se reabre gratis hasta ${until}. Si no paga, se vuelve a pausar sola unos 3 días después (los recordatorios automáticos ya se le enviaron antes: avísele usted). ¿Reabrir?`,
      );
      if (!ok) return;
    }
    await move(target);
  }

  async function sendTemplate(template: TemplateName) {
    const m = log.find((l) => l.template === template);
    const unknown = m?.status === "failed" && m.last_error_code === UNKNOWN_OUTCOME_CODE;
    const question = unknown
      ? `No sabemos si «${TEMPLATE_LABEL[template]}» le llegó a ${row.business_name}. Revise el chat de la línea +1 786-257-0284 antes. ¿Confirma que NO le llegó y quiere reenviarlo?`
      : `¿Enviar «${TEMPLATE_LABEL[template]}» a ${row.business_name} por WhatsApp ahora?`;
    if (!window.confirm(question)) return;
    setBusy(true);
    const message = await onSend(row.id, template, unknown);
    setBusy(false);
    say(message, 5000);
  }

  async function copyFooter() {
    say((await copyText(footerSnippet(row.referral_code))) ? "Pie de página copiado" : "No se pudo copiar — selecciónelo a mano");
  }

  async function savePhone() {
    const value = phone.trim();
    if (!value || value === row.whatsapp) return;
    if (!window.confirm(`¿Cambiar el WhatsApp de ${row.business_name} a ${value}?`)) return;
    await patch({ whatsapp: value }, "WhatsApp corregido");
  }

  async function assignReferrer() {
    const code = refCode.trim().toUpperCase();
    if (!code) return;
    if (await patch({ referredByCode: code }, "Referido asignado")) setRefCode("");
  }

  async function applyCredit(credit: Credit) {
    const how =
      "Si el referidor paga por PayPal/a mano, esto le suma 1 mes a su «pagado hasta». Si paga por Stripe, aplique antes un cupón de 100% por 1 mes a su suscripción en Stripe.";
    if (!window.confirm(`¿Marcar aplicado el mes gratis por ${credit.referred_name}?\n\n${how}`)) return;
    setBusy(true);
    const message = await onApplyCredit(credit.id);
    setBusy(false);
    say(message, 5000);
  }

  function tplBlock(tpl: TemplateName): string | null {
    return manualBlock(tpl, row, settings);
  }

  return (
    <article className={`${styles.card} ${slaClass(row)}`}>
      <header className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <h3>{row.business_name}</h3>
          <p>
            {row.business_type} · {row.city}
          </p>
        </div>
        <span className={`${styles.pill} ${styles[`pill_${row.status}`] ?? ""}`}>{STATUS_LABEL[row.status]}</span>
      </header>

      {badges.length ? (
        <div className={styles.badges}>
          {badges.map((b) => (
            <span key={b.label} className={`${styles.badge} ${styles[b.tone]}`}>
              {b.label}
            </span>
          ))}
        </div>
      ) : null}

      <dl className={styles.meta}>
        <div>
          <dt>WhatsApp</dt>
          <dd>
            {blockedAll ? (
              <span title={blockedAll}>{row.whatsapp}</span>
            ) : (
              <a href={`https://wa.me/${row.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                {row.whatsapp}
              </a>
            )}
          </dd>
        </div>
        <div>
          <dt>{row.status === "borrador" ? "Empezó" : "Envió"}</dt>
          <dd>{ago(row.status === "borrador" ? row.updated_at : (row.submitted_at ?? row.created_at))}</dd>
        </div>
        <div>
          <dt>Quiere</dt>
          <dd>{GOAL_LABEL[row.site_goal ?? ""] ?? "—"}</dd>
        </div>
        <div>
          <dt>Código</dt>
          <dd className={styles.mono}>{row.referral_code}</dd>
        </div>
        {referrer ? (
          <div>
            <dt>Referido por</dt>
            <dd>
              {referrer.name} ({referrer.code}){creditedBy ? " · crédito otorgado" : ""}
            </dd>
          </div>
        ) : null}
        {row.referred_by_text ? (
          <div>
            <dt>Quién lo recomendó</dt>
            <dd>{row.referred_by_text}</dd>
          </div>
        ) : null}
        {earned.length ? (
          <div>
            <dt>Créditos ganados</dt>
            <dd className={earnedPending ? styles.good : ""} title={earned.map((c) => c.referred_name).join(", ")}>
              {earnedMonths} mes{earnedMonths === 1 ? "" : "es"} gratis{earnedPending ? ` (${earnedPending} por aplicar)` : ""}
            </dd>
          </div>
        ) : null}
        {row.last_inbound_at ? (
          <div>
            <dt>Le escribió</dt>
            <dd>{ago(row.last_inbound_at)}</dd>
          </div>
        ) : null}
        {row.status === "nuevo" ? (
          <div>
            <dt>Confirmado</dt>
            <dd>{row.confirmed_at ? ago(row.confirmed_at) : "no"}</dd>
          </div>
        ) : null}
        {freeLeft !== null && ["entregada", "compartida"].includes(row.status) ? (
          <div>
            <dt>Gratis hasta</dt>
            <dd className={freeLeft <= 2 ? styles.warn : ""}>
              {row.free_until} ({leftLabel(freeLeft)})
            </dd>
          </div>
        ) : null}
        {manualPayer && paidLeft !== null ? (
          <div>
            <dt>Pagado hasta</dt>
            <dd className={paidLeft <= 3 ? styles.warn : ""}>
              {row.paid_through} ({leftLabel(paidLeft)})
            </dd>
          </div>
        ) : null}
        {row.status === "pausada" && row.recontact_after ? (
          <div>
            <dt>Recontactar desde</dt>
            <dd className={row.recontact_after <= svToday() ? styles.warn : ""}>{row.recontact_after}</dd>
          </div>
        ) : null}
        {row.last_touch_kind ? (
          <div>
            <dt>Último mensaje</dt>
            <dd>
              {row.last_touch_kind} · {ago(row.last_touch_at)}
            </dd>
          </div>
        ) : null}
      </dl>

      {row.services.length ? <p className={styles.services}>{row.services.join(" · ")}</p> : null}

      {files.length ? (
        <div className={styles.thumbs}>
          {files.map((p) =>
            links[p] ? (
              <a key={p} href={links[p]} target="_blank" rel="noopener noreferrer" className={styles.thumb}>
                {/\.(jpe?g|png|webp|gif)$/i.test(p) ? (
                  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed storage URL
                  <img src={links[p]} alt="" loading="lazy" />
                ) : (
                  <span>{p.split(".").pop()?.toUpperCase()}</span>
                )}
                {p.includes("/logo-") ? <em>logo</em> : null}
              </a>
            ) : null,
          )}
        </div>
      ) : (
        <p className={styles.dim}>Sin fotos ni logo — usar imágenes del rubro y diseñar logo.</p>
      )}

      {expanded || row.no_whatsapp_at ? (
        <div className={styles.inlineForm}>
          <label>
            Corregir WhatsApp {row.no_whatsapp_at ? "(Meta dice que este número no tiene WhatsApp)" : ""}
            <input value={phone} inputMode="tel" autoComplete="off" onChange={(e) => setPhone(e.target.value)} />
          </label>
          <button type="button" disabled={busy || !phone.trim() || phone.trim() === row.whatsapp} onClick={() => void savePhone()}>
            Guardar número
          </button>
        </div>
      ) : null}

      {row.referred_by_text && !row.referred_by_id ? (
        <div className={styles.inlineForm}>
          <label>
            Código de quien lo recomendó (búsquelo arriba por nombre)
            <input
              value={refCode}
              maxLength={6}
              placeholder="K7M2QX"
              autoComplete="off"
              className={styles.mono}
              onChange={(e) => setRefCode(e.target.value.toUpperCase())}
            />
          </label>
          <button type="button" disabled={busy || refCode.trim().length !== 6} onClick={() => void assignReferrer()}>
            Asignar referido
          </button>
        </div>
      ) : null}

      {expanded ? (
        <div className={styles.detail}>
          {row.differentiator ? (
            <p>
              <b>Diferencia:</b> {row.differentiator}
            </p>
          ) : null}
          {row.hours ? (
            <p>
              <b>Horario:</b> {row.hours}
            </p>
          ) : null}
          {row.style ? (
            <p>
              <b>Estilo:</b> {row.style}
            </p>
          ) : null}
          {row.instagram ? (
            <p>
              <b>IG:</b> {row.instagram}
            </p>
          ) : null}
          {row.facebook ? (
            <p>
              <b>FB:</b> {row.facebook}
            </p>
          ) : null}
          <p>
            <b>Fuente:</b> {[row.utm_source, row.utm_campaign].filter(Boolean).join(" / ") || (row.fbclid ? "Meta" : "Directo / DM")}
          </p>
          <p>
            <b>Enlace de referido:</b> <span className={styles.mono}>{referralLink(row.referral_code)}</span>
          </p>
          <p>
            <b>Pie de página de su web:</b> <span className={styles.mono}>{footerSnippet(row.referral_code)}</span>{" "}
            <button type="button" className={styles.linkBtn} onClick={() => void copyFooter()}>
              Copiar
            </button>
          </p>
          {earned.length ? (
            <div className={styles.credits}>
              <b>Refirió y pagaron (1 mes gratis cada uno):</b>
              <ul>
                {earned.map((c) => (
                  <li key={c.id}>
                    {c.referred_name} · {c.applied_at ? `aplicado ${ago(c.applied_at)}` : "por aplicar"}{" "}
                    {c.applied_at ? null : (
                      <button type="button" className={styles.linkBtn} disabled={busy} onClick={() => void applyCredit(c)}>
                        Marcar aplicado
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <p className={styles.dim}>
                Cómo aplicarlo: por PayPal / a mano, «Marcar aplicado» le suma el mes a su «pagado hasta». Por Stripe, primero un cupón de 100% por 1 mes en su suscripción.
              </p>
            </div>
          ) : null}
          {row.whatsapp_consent_at ? (
            <p className={styles.dim}>
              Consentimiento WhatsApp: {new Date(row.whatsapp_consent_at).toLocaleString("es-SV", { timeZone: "America/El_Salvador" })}{" "}
              ({row.whatsapp_consent_version ?? "—"})
            </p>
          ) : null}
          {row.opted_out_at ? (
            <p className={styles.dim}>
              Baja: {ago(row.opted_out_at)} — {row.opt_out_reason ?? "sin motivo"}
            </p>
          ) : null}
          <p className={styles.dim}>ID {row.id}</p>
        </div>
      ) : null}
      <button type="button" className={styles.linkBtn} onClick={() => setExpanded(!expanded)}>
        {expanded ? "Menos detalle" : "Más detalle"}
      </button>

      {row.status !== "borrador" ? (
        <div className={styles.inputs}>
          <label>
            Link de su web
            <input
              value={siteUrl}
              placeholder="https://…"
              onChange={(e) => setSiteUrl(e.target.value)}
              onBlur={() => {
                if ((row.site_url ?? "") !== siteUrl.trim()) void patch({ siteUrl: siteUrl.trim() || null }, "Link guardado");
              }}
            />
          </label>
          <label>
            Notas
            <textarea
              value={notes}
              rows={2}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => {
                if ((row.notes ?? "") !== notes.trim()) void patch({ notes: notes.trim() || null }, "Nota guardada");
              }}
            />
          </label>
        </div>
      ) : null}

      <div className={styles.actions}>
        {row.status === "borrador" ? (
          <>
            {wa("rescue", scripts.rescue(row.business_name), "Rescatar por WhatsApp", { className: styles.waBtn, blocked: blockedAll })}
            <button type="button" disabled={busy} onClick={() => void move("descartada")}>
              Descartar
            </button>
          </>
        ) : null}

        {row.status === "nuevo" ? (
          <>
            {wa(
              "confirm",
              scripts.confirm(row.business_name),
              row.confirmed_at ? "Confirmado ✓ (reenviar)" : "Confirmar por WhatsApp",
              { className: row.confirmed_at ? styles.waBtnDone : styles.waBtn, blocked: blockedAll, auto: "cqv_web_confirm", extra: { confirmed: true } },
            )}
            <button type="button" disabled={busy} onClick={() => void move("en_construccion")}>
              → En construcción
            </button>
          </>
        ) : null}

        {row.status === "en_construccion" ? (
          <>
            <button type="button" className={styles.primary} disabled={busy} onClick={() => void move("entregada")}>
              {row.activated_at ? "→ Entregada (ya pagó → Activa)" : "→ Entregada (con link)"}
            </button>
            <button type="button" disabled={busy} onClick={() => void copyFooter()}>
              Copiar pie de página
            </button>
          </>
        ) : null}

        {row.status === "entregada" || row.status === "compartida" ? (
          <>
            {row.status === "entregada"
              ? wa("delivered", scripts.delivered(row.site_url), "Web lista + pedir compartir", { className: styles.waBtn, blocked: blockedAll, auto: "cqv_web_ready" })
              : wa("shared_thanks", scripts.sharedThanks(row.referral_code), "Gracias + referidos", { className: styles.waBtn, blocked: blockedAll })}
            {wa("seed_upsell", scripts.seedUpsell(), "Sembrar citas", { className: styles.waGhost, blocked: blockedPush })}
            {wa("day7", scripts.day7(), "Día 7", { className: dayN !== null && dayN >= 7 && dayN < 14 ? styles.waDue : styles.waGhost, blocked: blockedPush })}
            {wa("day28", scripts.day28(payLink ? payUrl(row.referral_code) : null), "Día 28", {
              className: freeLeft !== null && freeLeft <= 2 && freeLeft >= 1 ? styles.waDue : styles.waGhost,
              blocked: blockedPush,
              auto: "cqv_web_day28",
            })}
            {wa("day30", scripts.day30(row.business_name, payLink ? payUrl(row.referral_code) : null), "Día 30", {
              className: freeLeft !== null && freeLeft <= 0 ? styles.waDue : styles.waGhost,
              blocked: blockedPush,
              auto: "cqv_web_day30",
            })}
            {wa("last_call", scripts.lastCall(payLink ? payUrl(row.referral_code) : null), "Último aviso", {
              className: styles.waGhost,
              blocked: blockedPush,
              auto: "cqv_web_pause_notice",
            })}
            {row.status === "entregada" ? (
              <button type="button" disabled={busy} onClick={() => void move("compartida")}>
                → Compartida
              </button>
            ) : null}
            <button type="button" className={styles.primary} disabled={busy} onClick={() => void move("activa", { paidVia: "manual" })}>
              → Activa (pagó)
            </button>
            <button type="button" disabled={busy} onClick={() => void move("activa", { paidVia: "paypal" })}>
              → Activa (PayPal)
            </button>
            <button type="button" disabled={busy} onClick={() => void move("pausada")}>
              Pausar
            </button>
          </>
        ) : null}

        {row.status === "activa" ? (
          <>
            {wa("referral_ask", scripts.referralAsk(row.referral_code), "Pedir referidos", { className: styles.waBtn, blocked: blockedPush })}
            {manualPayer ? (
              <button type="button" className={styles.primary} disabled={busy} onClick={() => void patch({ renew: true }, "Mes registrado")}>
                Pagó otro mes
              </button>
            ) : null}
            <button type="button" disabled={busy} onClick={() => void move("pausada")}>
              Pausar
            </button>
            <button type="button" disabled={busy} onClick={() => void move("cancelada")}>
              Cancelada
            </button>
          </>
        ) : null}

        {["pausada", "cancelada", "descartada"].includes(row.status) ? (
          <>
            <button type="button" disabled={busy} onClick={() => void reopen()}>
              Reabrir
            </button>
            {row.delivered_at ? (
              <>
                <button type="button" disabled={busy} onClick={() => void move("activa", { paidVia: "manual" })}>
                  → Activa (pagó)
                </button>
                <button type="button" disabled={busy} onClick={() => void move("activa", { paidVia: "paypal" })}>
                  → Activa (PayPal)
                </button>
              </>
            ) : null}
          </>
        ) : null}
      </div>
      {row.status !== "borrador" || log.length ? (
        <div className={styles.waAuto}>
          <button type="button" className={styles.linkBtn} onClick={() => setShowLog(!showLog)}>
            {showLog ? "Ocultar" : "Ver"} WhatsApp automático ({log.length})
          </button>
          {templates.length ? (
            <div className={styles.tplRow}>
              {templates.map((tpl) => {
                const m = log.find((l) => l.template === tpl);
                const done = !!m && REACHED.includes(m.status);
                const unknown = m?.status === "failed" && m.last_error_code === UNKNOWN_OUTCOME_CODE;
                const reason = done ? null : tplBlock(tpl);
                const label = !m
                  ? `Enviar «${TEMPLATE_LABEL[tpl]}»`
                  : done
                    ? `«${TEMPLATE_LABEL[tpl]}» ${MSG_STATUS_LABEL[m.status]} ✓`
                    : unknown
                      ? `«${TEMPLATE_LABEL[tpl]}» ¿le llegó? · revisar`
                      : m.status === "queued"
                        ? `«${TEMPLATE_LABEL[tpl]}» en cola (${m.attempts}) · reintentar`
                        : `Reintentar «${TEMPLATE_LABEL[tpl]}»`;
                return (
                  <button
                    key={tpl}
                    type="button"
                    disabled={busy || done || !!reason}
                    className={done ? styles.tplDone : m?.status === "failed" ? styles.tplFailed : m ? styles.tplQueued : styles.tplBtn}
                    title={reason ?? m?.last_error ?? undefined}
                    onClick={() => void sendTemplate(tpl)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ) : null}
          {showLog ? (
            log.length ? (
              <ol className={styles.log}>
                {log.map((m) => (
                  <li key={m.id} className={m.direction === "inbound" ? styles.logIn : styles.logOut}>
                    <div className={styles.logHead}>
                      <span>
                        {m.direction === "inbound" ? "← Cliente" : m.template ? `→ ${TEMPLATE_LABEL[m.template]}` : m.source === "stripe" ? "→ Gracias por pagar" : "→ Asistente"}
                      </span>
                      <span className={`${styles.logStatus} ${styles[`msg_${m.status}`] ?? ""}`}>{MSG_STATUS_LABEL[m.status] ?? m.status}</span>
                      <span className={styles.dim}>{ago(m.received_at ?? m.sent_at ?? m.created_at)}</span>
                    </div>
                    {m.body ? <p className={styles.logBody}>{m.body}</p> : <p className={styles.logBody}>[{m.msg_type ?? "mensaje"}]</p>}
                    {m.status === "failed" || (m.status === "queued" && m.last_error) || m.status === "skipped" ? (
                      <p className={styles.logErr}>
                        {m.last_error ?? m.last_error_code}
                        {m.status === "queued" && m.next_attempt_at ? ` · próximo intento ${new Date(m.next_attempt_at).toLocaleString("es-SV", { timeZone: "America/El_Salvador", dateStyle: "short", timeStyle: "short" })}` : ""}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.dim}>Todavía no hay mensajes por el número del embudo.</p>
            )
          ) : null}
        </div>
      ) : null}
      {flash ? <p className={styles.flash}>{flash}</p> : null}
    </article>
  );
}

// ─── Board ──────────────────────────────────────────────────────────────────

export default function BoardClient() {
  const [token, setToken] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("nuevo");
  const [q, setQ] = useState("");
  const [data, setData] = useState<ListResponse | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft | null>(null);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);
  const qRef = useRef(q);
  useEffect(() => {
    qRef.current = q;
  }, [q]);

  // Token lives in localStorage on this device only (restored after hydration).
  useEffect(() => {
    try {
      setToken(window.localStorage.getItem(TOKEN_KEY));
    } catch {
      setToken(null);
    }
    setReady(true);
  }, []);

  const api = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const res = await fetch(path, {
        ...init,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}`, ...(init.headers ?? {}) },
        cache: "no-store",
      });
      if (res.status === 401) {
        try {
          window.localStorage.removeItem(TOKEN_KEY);
        } catch {
          // Storage unavailable — the token just isn't remembered.
        }
        setToken(null);
        setError("Clave incorrecta o vencida.");
      }
      return res;
    },
    [token],
  );

  const load = useCallback(
    async (nextPage = 0, append = false) => {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ view, page: String(nextPage) });
        if (qRef.current.trim()) params.set("q", qRef.current.trim());
        const res = await api(`/api/web-gratis/admin/signups?${params}`);
        const json = (await res.json()) as { data: ListResponse | null; error: string | null; message: string | null };
        if (!res.ok || !json.data) {
          if (res.status !== 401) setError(json.message ?? "No se pudo cargar el tablero.");
          return;
        }
        const payload = json.data;
        setData(payload);
        setRows((prev) => (append ? [...prev, ...payload.rows.filter((r) => !prev.some((p) => p.id === r.id))] : payload.rows));
        setPage(nextPage);
        setSettingsDraft(
          (prev) =>
            prev ?? {
              days: payload.settings.delivery_days ? String(payload.settings.delivery_days) : "",
              highDemand: payload.settings.high_demand,
              payLink: payload.settings.pay_link ?? "",
              demoLink: payload.settings.demo_link ?? "",
              paypalLink: payload.settings.paypal_link ?? "",
            },
        );
      } catch (err) {
        console.error("[WebGratis:board] load", err);
        setError("Sin conexión con el servidor.");
      } finally {
        setLoading(false);
      }
    },
    [api, token, view],
  );

  // Load on tab/token change; refresh every 45s while visible and not typing.
  useEffect(() => {
    if (!token) return;
    void load(0);
    const timer = window.setInterval(() => {
      const typing = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement;
      if (document.visibilityState === "visible" && !typing) void load(0);
    }, 45_000);
    return () => window.clearInterval(timer);
  }, [token, view, load]);

  async function onPatch(id: string, body: Record<string, unknown>): Promise<boolean> {
    try {
      const res = await api(`/api/web-gratis/admin/signups/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      const json = (await res.json()) as { data: Row | null; message: string | null };
      if (!res.ok) {
        setError(json.message ?? "No se pudo guardar el cambio.");
        return false;
      }
      if (json.data && "id" in json.data) {
        const updated = json.data;
        setRows((prev) =>
          prev
            .map((r) => (r.id === id ? { ...r, ...updated } : r))
            .filter((r) => {
              const tab = TABS.find((t) => t.view === view);
              return !tab?.statuses || tab.statuses.includes(r.status);
            }),
        );
      }
      return true;
    } catch (err) {
      console.error("[WebGratis:board] patch", err);
      setError("Sin conexión: el cambio no se guardó.");
      return false;
    }
  }

  async function onSend(id: string, template: TemplateName, force: boolean): Promise<string> {
    try {
      const res = await api("/api/web-gratis/admin/whatsapp", { method: "POST", body: JSON.stringify({ signupId: id, template, ...(force ? { force: true } : {}) }) });
      const json = (await res.json().catch(() => null)) as { data: { status: string; message: string } | null; message: string | null } | null;
      void load(0);
      if (!res.ok) return json?.message ?? "No se pudo enviar.";
      return json?.data?.message ?? "Listo";
    } catch (err) {
      console.error("[WebGratis:board] send", err);
      return "Sin conexión: no se envió.";
    }
  }

  async function onApplyCredit(creditId: number): Promise<string> {
    try {
      const res = await api(`/api/web-gratis/admin/credits/${creditId}`, { method: "PATCH", body: JSON.stringify({ applied: true }) });
      const json = (await res.json().catch(() => null)) as { data: { message: string } | null; message: string | null } | null;
      void load(0);
      if (!res.ok) return json?.message ?? "No se pudo marcar.";
      return json?.data?.message ?? "Listo";
    } catch (err) {
      console.error("[WebGratis:board] credit", err);
      return "Sin conexión: no se marcó.";
    }
  }

  async function saveSettings() {
    if (!settingsDraft) return;
    const days = settingsDraft.days.trim() ? Number.parseInt(settingsDraft.days, 10) : null;
    const res = await api("/api/web-gratis/admin/settings", {
      method: "PUT",
      body: JSON.stringify({
        deliveryDays: days,
        highDemand: settingsDraft.highDemand,
        payLink: settingsDraft.payLink.trim() || null,
        demoLink: settingsDraft.demoLink.trim() || null,
        paypalLink: settingsDraft.paypalLink.trim() || null,
      }),
    });
    const json = (await res.json()) as { message: string | null };
    setSettingsMsg(res.ok ? "Guardado. La página /web lo muestra en ~1 min." : (json.message ?? "No se pudo guardar."));
    window.setTimeout(() => setSettingsMsg(null), 3500);
    if (res.ok) void load(0);
  }

  async function exportCsv() {
    const res = await api(`/api/web-gratis/admin/export?view=${view}`);
    if (!res.ok) {
      setError("No se pudo exportar.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `web-gratis-${view}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function login() {
    const value = tokenInput.trim();
    if (!value) return;
    try {
      window.localStorage.setItem(TOKEN_KEY, value);
    } catch {
      // Not remembered on this device; still works for this session.
    }
    setError(null);
    setToken(value);
  }

  function logout() {
    try {
      window.localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Nothing stored.
    }
    setToken(null);
    setData(null);
    setRows([]);
  }

  if (!ready) return <main className={styles.page} />;

  if (!token) {
    return (
      <main className={styles.page}>
        <form
          className={styles.login}
          onSubmit={(e) => {
            e.preventDefault();
            login();
          }}
        >
          <p className={styles.kicker}>MachineMind · Web gratis</p>
          <h1>Tablero</h1>
          <label>
            Clave del tablero
            <input type="password" autoComplete="current-password" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} />
          </label>
          {error ? <p className={styles.error}>{error}</p> : null}
          <button type="submit" className={styles.primary}>
            Entrar
          </button>
        </form>
      </main>
    );
  }

  const stats = data?.stats;
  const count = (statuses: Status[] | null) =>
    stats ? (statuses ? statuses.reduce((n, s) => n + (stats.by_status[s] ?? 0), 0) : Object.values(stats.by_status).reduce((a, b) => a + b, 0)) : 0;
  const rateToday = stats && stats.started_today ? Math.round((stats.submitted_today / stats.started_today) * 100) : 0;

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <div>
          <p className={styles.kicker}>MachineMind · Web gratis</p>
          <h1>Tablero</h1>
        </div>
        <div className={styles.topActions}>
          <button type="button" onClick={() => void load(0)} disabled={loading}>
            {loading ? "Cargando…" : "Actualizar"}
          </button>
          <button type="button" onClick={() => void exportCsv()}>
            Exportar CSV
          </button>
          <a href="/web" target="_blank" rel="noopener noreferrer">
            Ver /web
          </a>
          <button type="button" onClick={logout}>
            Salir
          </button>
        </div>
      </header>

      {stats ? (
        <section className={styles.kpis}>
          <div>
            <b>{stats.started_today}</b>
            <span>empezaron hoy</span>
          </div>
          <div>
            <b>{stats.submitted_today}</b>
            <span>completaron hoy ({rateToday}%)</span>
          </div>
          <div className={stats.unconfirmed_nuevo ? styles.kpiWarn : ""}>
            <b>{stats.unconfirmed_nuevo}</b>
            <span>nuevas sin confirmar</span>
          </div>
          <div className={stats.stale_nuevo ? styles.kpiRed : ""}>
            <b>{stats.stale_nuevo}</b>
            <span>nuevas &gt; 24 h</span>
          </div>
          <div className={stats.outbox_failed ? styles.kpiRed : ""}>
            <b>
              {stats.outbox_pending}/{stats.outbox_failed}
            </b>
            <span>alertas en cola / fallidas</span>
          </div>
          <div>
            <b>{stats.by_status.activa ?? 0}</b>
            <span>pagando</span>
          </div>
          <div className={stats.paid_unbuilt ? styles.kpiWarn : ""}>
            <b>{stats.paid_unbuilt ?? 0}</b>
            <span>pagaron y falta entregar</span>
          </div>
          <div className={stats.renewals_due ? styles.kpiWarn : ""}>
            <b>{stats.renewals_due ?? 0}</b>
            <span>PayPal / a mano por cobrar el mes</span>
          </div>
          <div className={stats.recontact_due ? styles.kpiWarn : ""}>
            <b>{stats.recontact_due ?? 0}</b>
            <span>pausadas para recontactar</span>
          </div>
          <div className={stats.wa_failed_24h ? styles.kpiRed : ""}>
            <b>
              {stats.wa_sent_today ?? 0}/{stats.wa_queued ?? 0}/{stats.wa_failed_24h ?? 0}
            </b>
            <span>WhatsApp auto: hoy / en cola / fallidos 24 h</span>
          </div>
          <div>
            <b>
              {stats.opted_out ?? 0}/{stats.no_whatsapp ?? 0}
            </b>
            <span>bajas / sin WhatsApp</span>
          </div>
          <div className={stats.credits_pending ? styles.kpiWarn : ""}>
            <b>{stats.credits_pending ?? 0}</b>
            <span>meses gratis por aplicar (referidos)</span>
          </div>
        </section>
      ) : null}

      {settingsDraft ? (
        <details className={styles.settings}>
          <summary>Capacidad, pago y demo</summary>
          <div className={styles.settingsGrid}>
            <label>
              Días de entrega que promete /web (vacío = &quot;pocos días&quot;)
              <input
                inputMode="numeric"
                value={settingsDraft.days}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, days: e.target.value.replace(/\D/g, "").slice(0, 2) })}
              />
            </label>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={settingsDraft.highDemand}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, highDemand: e.target.checked })}
              />
              Alta demanda: /web avisa que hay fila (nunca deja de recibir)
            </label>
            <label>
              Enlace de pago Stripe $20/mes (botón «Pagar con tarjeta» de /pagar; sin él no salen los recordatorios de día 28/30 ni se pausan solas las webs vencidas)
              <input
                value={settingsDraft.payLink}
                placeholder="https://buy.stripe.com/…"
                onChange={(e) => setSettingsDraft({ ...settingsDraft, payLink: e.target.value })}
              />
            </label>
            <label>
              Enlace de PayPal (botón «Pagar con PayPal» de /pagar)
              <input
                value={settingsDraft.paypalLink}
                placeholder="https://paypal.me/MachineMind/20USD"
                onChange={(e) => setSettingsDraft({ ...settingsDraft, paypalLink: e.target.value })}
              />
            </label>
            <label>
              Demo de citas (a dónde lleva /citas/…; vacío = abre el chat de WhatsApp del embudo)
              <input
                value={settingsDraft.demoLink}
                placeholder="https://…"
                onChange={(e) => setSettingsDraft({ ...settingsDraft, demoLink: e.target.value })}
              />
            </label>
            <button type="button" className={styles.primary} onClick={() => void saveSettings()}>
              Guardar
            </button>
            {settingsMsg ? <p className={styles.dim}>{settingsMsg}</p> : null}
          </div>
        </details>
      ) : null}

      <nav className={styles.tabs} aria-label="Estados">
        {TABS.map((tab) => (
          <button
            key={tab.view}
            type="button"
            className={tab.view === view ? styles.tabOn : styles.tab}
            onClick={() => {
              setRows([]);
              setView(tab.view);
            }}
          >
            {tab.label}
            <span>{count(tab.statuses)}</span>
          </button>
        ))}
      </nav>

      <form
        className={styles.search}
        onSubmit={(e) => {
          e.preventDefault();
          void load(0);
        }}
      >
        <input value={q} placeholder="Buscar negocio, WhatsApp, ciudad o código" onChange={(e) => setQ(e.target.value)} />
        <button type="submit">Buscar</button>
      </form>

      {error ? <p className={styles.error}>{error}</p> : null}

      {stats && stats.top_referrers.length && (view === "activa" || view === "todas") ? (
        <p className={styles.dim}>
          Top referidores: {stats.top_referrers.map((r) => `${r.business_name} (${r.n})`).join(" · ")}
        </p>
      ) : null}

      <section className={styles.list}>
        {!data && loading
          ? Array.from({ length: 4 }, (_, i) => <div key={i} className={styles.skeleton} />)
          : rows.map((row) => (
              <Card
                key={row.id}
                row={row}
                links={data?.links ?? {}}
                referrer={row.referred_by_id ? data?.referrers[row.referred_by_id] : undefined}
                settings={data?.settings ?? null}
                log={data?.messages?.[row.id] ?? []}
                credits={data?.credits ?? []}
                onPatch={onPatch}
                onSend={onSend}
                onApplyCredit={onApplyCredit}
              />
            ))}
        {data && rows.length === 0 && !loading ? <p className={styles.empty}>Nada en esta pestaña.</p> : null}
      </section>

      {data && rows.length < data.total ? (
        <button type="button" className={styles.more} disabled={loading} onClick={() => void load(page + 1, true)}>
          Cargar más ({data.total - rows.length} restantes)
        </button>
      ) : null}
    </main>
  );
}
