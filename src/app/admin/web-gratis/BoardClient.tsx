"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./board.module.css";
import { referralLink } from "@/lib/web-gratis/config";
import { scripts, waLink } from "@/lib/web-gratis/scripts";
import type { WebGratisSignup } from "@/lib/web-gratis/server";

// ─── Types ──────────────────────────────────────────────────────────────────

type View = "nuevo" | "en_construccion" | "entregada" | "compartida" | "activa" | "cerradas" | "borrador" | "todas";
type Status = WebGratisSignup["status"];

interface Row extends WebGratisSignup {
  confirmed_at: string | null;
  last_touch_at: string | null;
  last_touch_kind: string | null;
  delivered_at: string | null;
  free_until: string | null;
  site_url: string | null;
  shared_at: string | null;
  activated_at: string | null;
  notes: string | null;
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
}

interface Settings {
  delivery_days: number | null;
  high_demand: boolean;
  pay_link: string | null;
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
  // Whole days left in the free period (0 = last free day, El Salvador time).
  const end = new Date(`${date}T23:59:59-06:00`).getTime();
  return Math.floor((end - Date.now()) / 86_400_000);
}

function sinceDelivered(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function slaClass(row: Row): string {
  if (row.status !== "nuevo") return "";
  const hours = (Date.now() - new Date(row.submitted_at ?? row.created_at).getTime()) / 3_600_000;
  if (hours > 24) return styles.slaRed;
  if (!row.confirmed_at && hours > 2) return styles.slaAmber;
  return "";
}

// ─── Card (module scope: inputs never remount while typing) ─────────────────

interface CardProps {
  row: Row;
  links: Record<string, string>;
  referrer: { name: string; code: string } | undefined;
  payLink: string | null;
  onPatch: (id: string, body: Record<string, unknown>) => Promise<boolean>;
}

function Card({ row, links, referrer, payLink, onPatch }: CardProps) {
  const [siteUrl, setSiteUrl] = useState(row.site_url ?? "");
  const [notes, setNotes] = useState(row.notes ?? "");
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const files = [...row.logo_paths, ...row.photo_paths];
  const freeLeft = daysUntil(row.free_until);
  const dayN = sinceDelivered(row.delivered_at);

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

  function wa(kind: string, text: string, extra: Record<string, unknown> = {}) {
    return {
      href: waLink(row.whatsapp, text),
      target: "_blank",
      rel: "noopener noreferrer",
      onClick: () => void onPatch(row.id, { touch: kind, ...extra }),
    } as const;
  }

  async function move(status: Status) {
    if (status === "entregada" && !siteUrl.trim()) {
      setFlash("Pegue primero el link de la web");
      window.setTimeout(() => setFlash(null), 2200);
      return;
    }
    await patch(status === "entregada" ? { status, siteUrl: siteUrl.trim() } : { status }, `→ ${STATUS_LABEL[status]}`);
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

      <dl className={styles.meta}>
        <div>
          <dt>WhatsApp</dt>
          <dd>
            <a href={`https://wa.me/${row.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
              {row.whatsapp}
            </a>
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
              {referrer.name} ({referrer.code})
            </dd>
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
              {row.free_until} ({freeLeft >= 0 ? `faltan ${freeLeft} d` : `venció hace ${-freeLeft} d`})
            </dd>
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
            <a className={styles.waBtn} {...wa("rescue", scripts.rescue(row.business_name))}>
              Rescatar por WhatsApp
            </a>
            <button type="button" disabled={busy} onClick={() => void move("descartada")}>
              Descartar
            </button>
          </>
        ) : null}

        {row.status === "nuevo" ? (
          <>
            <a
              className={row.confirmed_at ? styles.waBtnDone : styles.waBtn}
              {...wa("confirm", scripts.confirm(row.business_name), { confirmed: true })}
            >
              {row.confirmed_at ? "Confirmado ✓ (reenviar)" : "Confirmar por WhatsApp"}
            </a>
            <button type="button" disabled={busy} onClick={() => void move("en_construccion")}>
              → En construcción
            </button>
          </>
        ) : null}

        {row.status === "en_construccion" ? (
          <button type="button" className={styles.primary} disabled={busy} onClick={() => void move("entregada")}>
            → Entregada (con link)
          </button>
        ) : null}

        {row.status === "entregada" || row.status === "compartida" ? (
          <>
            {row.status === "entregada" ? (
              <a className={styles.waBtn} {...wa("delivered", scripts.delivered(row.site_url))}>
                Web lista + pedir compartir
              </a>
            ) : (
              <a className={styles.waBtn} {...wa("shared_thanks", scripts.sharedThanks(row.referral_code))}>
                Gracias + referidos
              </a>
            )}
            <a className={styles.waGhost} {...wa("seed_upsell", scripts.seedUpsell())}>
              Sembrar citas
            </a>
            <a className={dayN !== null && dayN >= 7 && dayN < 14 ? styles.waDue : styles.waGhost} {...wa("day7", scripts.day7())}>
              Día 7
            </a>
            <a className={freeLeft !== null && freeLeft <= 2 && freeLeft >= 1 ? styles.waDue : styles.waGhost} {...wa("day28", scripts.day28(payLink))}>
              Día 28
            </a>
            <a className={freeLeft !== null && freeLeft <= 0 ? styles.waDue : styles.waGhost} {...wa("day30", scripts.day30(row.business_name, payLink))}>
              Día 30
            </a>
            <a className={styles.waGhost} {...wa("last_call", scripts.lastCall(payLink))}>
              Último aviso
            </a>
            {row.status === "entregada" ? (
              <button type="button" disabled={busy} onClick={() => void move("compartida")}>
                → Compartida
              </button>
            ) : null}
            <button type="button" className={styles.primary} disabled={busy} onClick={() => void move("activa")}>
              → Activa (pagó)
            </button>
            <button type="button" disabled={busy} onClick={() => void move("pausada")}>
              Pausar
            </button>
          </>
        ) : null}

        {row.status === "activa" ? (
          <>
            <a className={styles.waBtn} {...wa("referral_ask", scripts.referralAsk(row.referral_code))}>
              Pedir referidos
            </a>
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
            <button type="button" disabled={busy} onClick={() => void move(row.delivered_at ? "entregada" : "nuevo")}>
              Reabrir
            </button>
            {row.delivered_at ? (
              <button type="button" disabled={busy} onClick={() => void move("activa")}>
                → Activa (pagó)
              </button>
            ) : null}
          </>
        ) : null}
      </div>
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
  const [settingsDraft, setSettingsDraft] = useState<{ days: string; highDemand: boolean; payLink: string } | null>(null);
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

  async function saveSettings() {
    if (!settingsDraft) return;
    const days = settingsDraft.days.trim() ? Number.parseInt(settingsDraft.days, 10) : null;
    const res = await api("/api/web-gratis/admin/settings", {
      method: "PUT",
      body: JSON.stringify({ deliveryDays: days, highDemand: settingsDraft.highDemand, payLink: settingsDraft.payLink.trim() || null }),
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
        </section>
      ) : null}

      {settingsDraft ? (
        <details className={styles.settings}>
          <summary>Capacidad y enlace de pago</summary>
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
              Enlace de pago $20/mes (se usa en los mensajes de día 28/30)
              <input
                value={settingsDraft.payLink}
                placeholder="https://buy.stripe.com/…"
                onChange={(e) => setSettingsDraft({ ...settingsDraft, payLink: e.target.value })}
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
                payLink={data?.settings.pay_link ?? null}
                onPatch={onPatch}
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
