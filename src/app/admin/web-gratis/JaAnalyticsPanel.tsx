"use client";

import { useEffect, useState } from "react";
import { isJaAnalyticsBinding, isJaQaRunId, SITE_EVENT_KINDS, type JaQaRunStats, type SiteEventKind } from "@/lib/web-gratis/sites/analytics-shared";
import type { SiteSummary } from "@/lib/web-gratis/sites/shared";
import styles from "./board.module.css";

type SiteApi = (path: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; data: unknown; message: string | null }>;
const KIND_LABELS: Record<SiteEventKind, string> = {
  view: "cargas de página", whatsapp_click: "clics a WhatsApp", call_click: "clics para llamar",
  map_click: "clics al mapa", social_click: "clics a redes", email_click: "clics al correo",
};

/** Also rendered offline in tests; the payload contains only aggregate metrics. */
export function JaQaReadout({ qa, error }: { qa: JaQaRunStats | null; error: string | null }) {
  if (error) return <p className={styles.siteErr} role="status">{error} No se muestran ceros ni resultados anteriores como confirmación.</p>;
  if (!qa) return <p className={styles.dim}>Introduzca el ID de una prueba para consultar su recepción. Una respuesta del beacon por sí sola no confirma el registro.</p>;
  return <div aria-live="polite">
    <p className={styles.siteNote}>Prueba sintética <b>{qa.runId}</b> · excluida de los totales del negocio.</p>
    <ul>{SITE_EVENT_KINDS.map((kind) => <li key={kind}><b>{qa.counts[kind]}</b> {KIND_LABELS[kind]}</li>)}</ul>
    <p className={styles.dim}>Ventana UTC: <time>{qa.windowStart}</time> a <time>{qa.windowEnd}</time> (7 días). Consulta: <time>{qa.observedAt}</time>.</p>
    <p className={styles.dim}>Último evento: {qa.latestAt ? <time>{qa.latestAt}</time> : "ninguno observado en esta ventana"}. Son eventos, no personas únicas, mensajes enviados ni ventas.</p>
  </div>;
}

export default function JaAnalyticsPanel({ site, signupId, siteApi }: { site: SiteSummary; signupId: string; siteApi: SiteApi }) {
  const [draft, setDraft] = useState("");
  const [runId, setRunId] = useState("");
  const [requestNumber, setRequestNumber] = useState(0);
  const [qa, setQa] = useState<JaQaRunStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const bound = isJaAnalyticsBinding(site.id, signupId) && site.signupId === signupId;

  useEffect(() => {
    if (!bound || !runId) return;
    let active = true;
    // A refreshed board supplies a new summary object and re-reads the selected
    // run. Authentication remains in the existing siteApi, never in a URL.
    void siteApi(`/api/web-gratis/admin/sites/${site.id}/analytics-qa?runId=${encodeURIComponent(runId)}`, { cache: "no-store" }).then((res) => {
      if (!active) return;
      const result = (res.data as { qa?: JaQaRunStats } | null)?.qa;
      const valid = res.ok && result?.siteId === site.id && result.runId === runId && result.synthetic === true && result.excludedFromBusinessTotals === true &&
        SITE_EVENT_KINDS.every((kind) => Number.isSafeInteger(result.counts?.[kind]) && result.counts[kind] >= 0);
      setQa(valid ? result : null);
      setError(valid ? null : "No se pudo verificar esta consulta de prueba.");
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      setQa(null);
      setError("No se pudo verificar esta consulta de prueba.");
      setLoading(false);
    });
    return () => { active = false; };
  }, [bound, site, runId, requestNumber, siteApi]);

  if (!bound) return null;
  return <details className={styles.siteDetails}>
    <summary>Analítica: prueba sintética separada</summary>
    <p>Solo QA de JAhandmade. Este filtro consulta agregados de los últimos 7 días; no envía eventos.</p>
    <div className={styles.siteActions}>
      <label>ID de prueba <input aria-label="ID de prueba de analítica" value={draft} maxLength={40} placeholder="ja-20261020-qa1" onChange={(event) => setDraft(event.target.value)} /></label>
      <button type="button" disabled={!isJaQaRunId(draft) || loading} onClick={() => {
        setRunId(draft); setRequestNumber((n) => n + 1); setLoading(true); setQa(null); setError(null);
      }}>Consultar prueba</button>
    </div>
    {loading ? <p role="status">Consultando…</p> : <JaQaReadout qa={qa} error={error} />}
    <p className={styles.dim}>«Actualizar» vuelve a consultar el ID seleccionado. Las cargas de página y los clics normales siguen en el contador del negocio.</p>
  </details>;
}
