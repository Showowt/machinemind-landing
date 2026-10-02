"use client";

import { useEffect, useState } from "react";
import type { SiteContentV1 } from "@/lib/web-gratis/site-content";
import type { SiteSummary } from "@/lib/web-gratis/sites/shared";
import styles from "./board.module.css";

interface Result { ok: boolean; status: number; data: unknown; message: string | null }
type Api = (path: string, init?: RequestInit) => Promise<Result>;
interface Asset { src: string; width: number | null; height: number | null }

/** Handcrafted public content uses the same authenticated, tenant-scoped board session. */
export default function ReviewedSiteEditor({ site, businessName, siteApi, onSaved, onStatusChange }: {
  site: SiteSummary; businessName: string; siteApi: Api; onSaved: (site: SiteSummary) => void;
  onStatusChange: (state: { busy: boolean; dirty: boolean }) => void;
}) {
  const [version, setVersion] = useState(site.version);
  const [draft, setDraft] = useState("");
  const [savedDraft, setSavedDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [asset, setAsset] = useState<Asset | null>(null);
  const stale = version !== site.version;
  const dirty = draft !== savedDraft;
  useEffect(() => { onStatusChange({ busy, dirty }); }, [busy, dirty, onStatusChange]);
  useEffect(() => () => onStatusChange({ busy: false, dirty: false }), [onStatusChange]);
  const base = `/api/web-gratis/admin/sites/${site.id}`;

  async function load() {
    setBusy(true);
    const result = await siteApi(base);
    setBusy(false);
    const data = result.data as { site: SiteSummary; content: SiteContentV1 | null } | null;
    if (!result.ok || !data?.content) { setMessage(result.message ?? "No hay contenido para revisar."); return; }
    setDraft(JSON.stringify(data.content, null, 2));
    setSavedDraft(JSON.stringify(data.content, null, 2));
    setVersion(data.site.version);
    onSaved(data.site);
    setMessage(`Contenido público cargado (v${data.site.version}).`);
  }

  async function readFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 250_000) { setMessage("El archivo de contenido debe pesar menos de 250 KB."); return; }
    try { setDraft(await file.text()); setVersion(site.version); setMessage("Revise el contenido antes de guardar."); }
    catch { setMessage("No se pudo leer el archivo."); }
  }

  async function save() {
    if (busy || stale || !draft.trim()) return;
    let content: unknown;
    try { content = JSON.parse(draft); } catch { setMessage("El archivo no contiene JSON válido."); return; }
    const effect = site.status === "published" ? "Los cambios aparecerán en la web publicada." : "Se actualizará la vista previa; el sitio seguirá en su estado actual.";
    if (!window.confirm(`¿Guardar el contenido público revisado de ${businessName} (v${version})?\n\n${effect}\nNo se enviarán mensajes ni se cambiará la entrega o facturación.`)) return;
    setBusy(true);
    const result = await siteApi(`${base}/content`, { method: "PUT", body: JSON.stringify({ content, expectedVersion: version }) });
    setBusy(false);
    const data = result.data as { site: SiteSummary; content: SiteContentV1 } | null;
    setMessage(result.message ?? (result.ok ? "Contenido guardado." : "No se pudo guardar."));
    if (result.ok && data) {
      setVersion(data.site.version); setDraft(JSON.stringify(data.content, null, 2)); setSavedDraft(JSON.stringify(data.content, null, 2)); onSaved(data.site);
    }
  }

  async function upload(file: File | undefined) {
    if (!file || busy || stale) return;
    if (file.size > 4 * 1024 * 1024) { setMessage("La imagen debe pesar como máximo 4 MB."); return; }
    if (!window.confirm(`¿Guardar esta imagen como archivo público de ${businessName}?\n\nSuba únicamente la imagen aprobada para su web. El contenido de la página todavía no se cambiará.`)) return;
    const form = new FormData(); form.set("file", file); form.set("expectedVersion", String(version));
    setBusy(true);
    const result = await siteApi(`${base}/assets`, { method: "POST", body: form });
    setBusy(false);
    const data = result.data as { asset: Asset } | null;
    if (result.ok && data?.asset) setAsset(data.asset);
    setMessage(result.message ?? (result.ok ? "Imagen guardada. Use esta dirección en el contenido revisado." : "No se pudo guardar la imagen."));
  }

  return <div className={styles.siteEditor}>
    <h5>Contenido e imágenes revisados</h5>
    <p className={styles.dim}>Cliente: <b>{businessName}</b> · {site.slug} · v{version}. Incluya solamente información e imágenes aprobadas para la web pública.</p>
    {stale ? <p className={styles.siteWarn}>Existe otra versión (v{site.version}). Cargue y revise el contenido actual antes de continuar.</p> : null}
    <div className={styles.siteActions}>
      <button type="button" disabled={busy} onClick={() => void load()}>Cargar contenido público actual</button>
      <label>Archivo de contenido (JSON)<input type="file" accept="application/json,.json" disabled={busy} onChange={(e) => void readFile(e.currentTarget.files?.[0])} /></label>
    </div>
    <label>Contenido público completo
      <textarea rows={12} maxLength={250_000} value={draft} disabled={busy} spellCheck={false} onChange={(e) => setDraft(e.target.value)} placeholder="Cargue el contenido actual o un archivo revisado." />
    </label>
    <div className={styles.siteActions}>
      <button type="button" className={styles.primary} disabled={busy || stale || !draft.trim()} onClick={() => void save()}>Guardar contenido revisado</button>
    </div>
    <hr />
    <label>Subir imagen pública de este cliente (JPG, PNG o WebP; máximo 4 MB)
      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || stale} onChange={(e) => void upload(e.currentTarget.files?.[0])} />
    </label>
    {asset ? <div>
      <p className={styles.dim}>Imagen guardada{asset.width && asset.height ? ` · ${asset.width} × ${asset.height}` : ""}. Use su dirección en el campo de imagen del contenido.</p>
      <a href={asset.src} target="_blank" rel="noopener noreferrer">Ver imagen pública</a>
      <textarea rows={3} readOnly value={asset.src} aria-label="Dirección pública de la imagen" />
    </div> : null}
    {busy ? <p aria-live="polite">Procesando…</p> : null}
    {message ? <p className={styles.flash} role="status">{message}</p> : null}
  </div>;
}
