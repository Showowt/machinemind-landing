"use client";

import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import Link from "next/link";
import styles from "./web.module.css";
import { COPY, type Copy, type Lang } from "./copy";
import {
  ALLOWED_UPLOAD_TYPES,
  COUNTRY_CODES,
  EMAIL_RE,
  MARKET_INFO,
  MARKETS,
  MAX_DOCUMENTS,
  MAX_PHOTOS,
  MAX_UPLOAD_BYTES,
  MM_WHATSAPP,
  parseMarket,
  REFERRAL_CODE_RE,
  referralLink,
  splitServices,
  toE164,
  UPLOAD_ACCEPT,
  UPLOAD_EXTENSION_TYPES,
  UPLOAD_KINDS,
  UPLOAD_TYPES_BY_KIND,
  type Market,
  type UploadKind,
} from "@/lib/web-gratis/config";
import type { WebGratisErrorCode } from "@/lib/web-gratis/schema";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3;
type SiteGoal = "" | "whatsapp" | "citas" | "mostrar";
type UploadProblem = "tooLarge" | "unsupported" | "tooMany" | "failed";
type ApiError = WebGratisErrorCode | "network";

interface Fields {
  businessName: string;
  businessType: string;
  city: string;
  country: Market;
  countryCode: string;
  whatsappLocal: string;
  services: string;
  differentiator: string;
  hours: string;
  address: string;
  instagram: string;
  facebook: string;
  existingWebsite: string;
  contactEmail: string;
  style: string;
  siteGoal: SiteGoal;
  referredBy: string;
  extraNotes: string;
}

type FieldKey = keyof Fields;
/** Every field typed by the person (the market has its own picker). */
type TextKey = Exclude<FieldKey, "country">;
type ErrorKey = FieldKey | "acceptTerms" | "acceptShare";
type ValidationKey = keyof Copy["validation"] | "invalidWhatsappGeneric";

interface Upload {
  id: string;
  kind: UploadKind;
  name: string;
  size: number;
  status: "uploading" | "done" | "error";
  progress: number;
  path: string | null;
  preview: string | null;
  problem: UploadProblem | null;
}

interface Attribution {
  ref?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  landing_url?: string;
}

interface Submitted {
  referralCode: string;
  businessName: string;
}

interface Persisted {
  v: 1;
  draftId: string;
  step: Step;
  fields: Partial<Fields>;
  uploads: { id: string; kind: UploadKind; name: string; path: string; size?: number }[];
  lang: Lang;
  attribution: Attribution;
  submitted: Submitted | null;
  leadTracked: boolean;
  savedAt: number;
}

interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error: ApiError | null;
}

interface Prepared {
  blob: Blob;
  name: string;
  type: string;
}

export interface WebGratisClientProps {
  /** From ?pais= / ?country= on the server (null when absent). */
  initialMarket: Market | null;
  /** Server-side guess (visitor's IP country) used only when nothing better is known. */
  marketHint: Market | null;
}

// ─── Constants + pure helpers ───────────────────────────────────────────────

const STORAGE_KEY = "mm-web-gratis-v1";
const REF_KEY = "mm-web-ref";
const DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const REF_TTL_MS = 60 * 24 * 60 * 60 * 1000;
const ERROR_ORDER: ErrorKey[] = [
  "businessName",
  "businessType",
  "city",
  "whatsappLocal",
  "services",
  "contactEmail",
  "acceptTerms",
  "acceptShare",
];
const MARKET_DIALS = new Set<string>(MARKETS.map((m) => MARKET_INFO[m].dial));

function emptyFields(market: Market): Fields {
  return {
    businessName: "",
    businessType: "",
    city: "",
    country: market,
    countryCode: MARKET_INFO[market].dial,
    whatsappLocal: "",
    services: "",
    differentiator: "",
    hours: "",
    address: "",
    instagram: "",
    facebook: "",
    existingWebsite: "",
    contactEmail: "",
    style: "",
    siteGoal: "",
    referredBy: "",
    extraNotes: "",
  };
}

/** Browsers/OSes that report non-standard MIME names for common files. */
const TYPE_ALIASES: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/x-png": "image/png",
  "application/x-pdf": "application/pdf",
  "text/comma-separated-values": "text/csv",
  "application/csv": "text/csv",
  "image/photoshop": "image/vnd.adobe.photoshop",
  "image/x-photoshop": "image/vnd.adobe.photoshop",
  "application/photoshop": "image/vnd.adobe.photoshop",
  "application/x-photoshop": "image/vnd.adobe.photoshop",
};

const COMPRESSIBLE = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function readJSON<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode / storage full — the form still works, it just won't resume.
  }
}

async function postJson<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 25_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = (await res.json().catch(() => null)) as { data?: T; error?: ApiError } | null;
    return {
      ok: res.ok && !json?.error,
      status: res.status,
      data: json?.data ?? null,
      error: res.ok ? (json?.error ?? null) : (json?.error ?? "server_error"),
    };
  } catch (error) {
    console.error("[WebGratis] request failed", url, error);
    return { ok: false, status: 0, data: null, error: "network" };
  } finally {
    window.clearTimeout(timer);
  }
}

/** Retries network errors and 5xx (flaky mobile data), never 4xx; tells the server which try this is. */
async function postWithRetry<T>(url: string, body: Record<string, unknown>, tries = 3): Promise<ApiResult<T>> {
  let last: ApiResult<T> = { ok: false, status: 0, data: null, error: "network" };
  for (let attempt = 0; attempt < tries; attempt++) {
    last = await postJson<T>(url, { ...body, attempt });
    if (last.ok || (last.status >= 400 && last.status < 500)) return last;
    if (attempt < tries - 1) await new Promise((r) => window.setTimeout(r, attempt === 0 ? 800 : 2000));
  }
  return last;
}

function track(event: string, params: Record<string, unknown>, eventID?: string): void {
  try {
    if (typeof window.fbq === "function") window.fbq("track", event, params, eventID ? { eventID } : undefined);
  } catch (error) {
    console.error("[WebGratis] pixel", error);
  }
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/**
 * MIME type this kind accepts for the file, or null. The extension wins when it
 * maps to an accepted type (pickers often report "" or a generic type for .ai,
 * .psd, .csv, Office files); otherwise the reported type is used.
 */
function inferType(file: File, kind: UploadKind): string | null {
  const allowed = UPLOAD_TYPES_BY_KIND[kind];
  const byExt = UPLOAD_EXTENSION_TYPES[extensionOf(file.name)];
  if (byExt && allowed[byExt]) return byExt;
  const reported = file.type.toLowerCase().split(";")[0].trim();
  const byType = TYPE_ALIASES[reported] ?? reported;
  return allowed[byType] ? byType : null;
}

function safeName(name: string, type: string): string {
  const base = (name || "archivo").replace(/[^\w.\- ]+/g, "").slice(0, 80) || "archivo";
  return base.includes(".") ? base : `${base}.${ALLOWED_UPLOAD_TYPES[type] ?? "bin"}`;
}

function formatSize(bytes: number, lang: Lang): string {
  if (!bytes) return "";
  const nf = new Intl.NumberFormat(lang === "es" ? "es" : "en", { maximumFractionDigits: 1 });
  return bytes >= 1024 * 1024 ? `${nf.format(bytes / (1024 * 1024))} MB` : `${nf.format(Math.max(1, bytes / 1024))} KB`;
}

async function decodeImage(
  file: Blob,
): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() };
    } catch {
      // Fall through to <img> decoding.
    }
  }
  const url = URL.createObjectURL(file);
  const el = new Image();
  el.decoding = "async";
  el.src = url;
  try {
    await el.decode();
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
  return { source: el, width: el.naturalWidth, height: el.naturalHeight, release: () => URL.revokeObjectURL(url) };
}

/**
 * Photos (often 4–8 MB from a phone) are downscaled to ≤1920px JPEG before
 * upload. Logos and documents are ALWAYS uploaded exactly as picked.
 */
async function prepareFile(file: File, kind: UploadKind, type: string): Promise<Prepared> {
  const name = safeName(file.name, type);
  const original: Prepared = { blob: file.type === type ? file : new Blob([file], { type }), name, type };
  const isHeic = type === "image/heic" || type === "image/heif";
  if (kind !== "photo" || !COMPRESSIBLE.has(type) || (file.size < 450_000 && !isHeic)) return original;
  try {
    const img = await decodeImage(file);
    const scale = Math.min(1, 1920 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      img.release();
      return original;
    }
    ctx.drawImage(img.source, 0, 0, canvas.width, canvas.height);
    img.release();
    const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (out && (out.size < file.size || isHeic)) {
      return { blob: out, name: `${name.replace(/\.[^.]+$/, "")}.jpg`, type: "image/jpeg" };
    }
  } catch {
    // This browser can't decode the format (e.g. HEIC on Android) — upload as-is.
  }
  return original;
}

/**
 * At most this many files travel at once: ten 25 MB documents sharing one
 * mobile uplink would otherwise all crawl, and queued requests would look stalled.
 */
const MAX_PARALLEL_UPLOADS = 3;
/** A visible page whose upload made no progress for this long gets "Reintentar". */
const UPLOAD_STALL_MS = 60_000;
/** Hard ceiling for one file, however slow but steady the connection is. */
const UPLOAD_MAX_MS = 45 * 60_000;

let activeUploads = 0;
const uploadWaiters: (() => void)[] = [];

function acquireUploadSlot(): Promise<void> {
  if (activeUploads < MAX_PARALLEL_UPLOADS) {
    activeUploads += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => uploadWaiters.push(resolve));
}

/** Hand the slot straight to the next waiting upload (or free it). */
function releaseUploadSlot(): void {
  const next = uploadWaiters.shift();
  if (next) next();
  else activeUploads = Math.max(0, activeUploads - 1);
}

/**
 * PUT straight to the signed Supabase Storage URL, with progress. Fails when no
 * byte moved for UPLOAD_STALL_MS while the page was visible (a slow but moving
 * upload is never cut), or when `signal` aborts (the file was removed).
 */
function putFile(url: string, file: Prepared, onProgress: (p: number) => void, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error("upload cancelled"));
      return;
    }
    const xhr = new XMLHttpRequest();
    let lastActivity = Date.now();
    const onVisibility = () => {
      // Time spent in another app doesn't count as a stall.
      if (document.visibilityState === "visible") lastActivity = Date.now();
    };
    const onAbortSignal = () => xhr.abort();
    const watchdog = window.setInterval(() => {
      if (document.visibilityState === "visible" && Date.now() - lastActivity > UPLOAD_STALL_MS) xhr.abort();
    }, 5_000);
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearInterval(watchdog);
      document.removeEventListener("visibilitychange", onVisibility);
      signal.removeEventListener("abort", onAbortSignal);
      if (error) reject(error);
      else resolve();
    };
    document.addEventListener("visibilitychange", onVisibility);
    signal.addEventListener("abort", onAbortSignal);

    xhr.open("PUT", url);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.timeout = UPLOAD_MAX_MS;
    xhr.upload.onprogress = (e) => {
      lastActivity = Date.now();
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    // Body fully sent: give the storage server extra time to answer.
    xhr.upload.onload = () => {
      lastActivity = Date.now() + UPLOAD_STALL_MS;
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? finish()
        : finish(new Error(`upload ${xhr.status}: ${xhr.responseText.slice(0, 200)}`));
    xhr.onerror = () => finish(new Error("upload network error"));
    xhr.ontimeout = () => finish(new Error("upload timeout"));
    xhr.onabort = () => finish(new Error(signal.aborted ? "upload cancelled" : "upload stalled"));
    const form = new FormData();
    form.append("cacheControl", "3600");
    form.append("", file.blob, file.name);
    xhr.send(form);
  });
}

function legacyCopy(text: string): void {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } catch (error) {
    console.error("[WebGratis] copy failed", error);
  }
  document.body.removeChild(ta);
}

function whatsappKey(countryCode: string): ValidationKey {
  if (countryCode === MARKET_INFO.SV.dial) return "whatsappSV";
  if (countryCode === MARKET_INFO.CO.dial) return "whatsappCO";
  return "invalidWhatsappGeneric";
}

function validate(
  step: Step,
  f: Fields,
  acceptTerms: boolean,
  acceptShare: boolean,
): Partial<Record<ErrorKey, ValidationKey>> {
  const e: Partial<Record<ErrorKey, ValidationKey>> = {};
  if (step === 1) {
    if (f.businessName.trim().length < 2) e.businessName = "required";
    if (f.businessType.trim().length < 2) e.businessType = "required";
    if (f.city.trim().length < 2) e.city = "required";
    if (!toE164(f.countryCode, f.whatsappLocal)) e.whatsappLocal = whatsappKey(f.countryCode);
  }
  if (step === 2) {
    if (splitServices(f.services).length === 0) e.services = "services";
    const email = f.contactEmail.trim();
    if (email && !EMAIL_RE.test(email)) e.contactEmail = "email";
  }
  if (step === 3) {
    if (!acceptTerms) e.acceptTerms = "acceptTerms";
    if (!acceptShare) e.acceptShare = "acceptShare";
  }
  return e;
}

function validationText(t: Copy, key: ValidationKey | undefined): string | undefined {
  if (!key) return undefined;
  return key === "invalidWhatsappGeneric" ? t.errors.invalid_whatsapp : t.validation[key];
}

/** When saving fails, the WhatsApp fallback carries everything they typed — the lead survives. */
function whatsappHelpHref(t: Copy, f: Fields): string {
  const text = t.fallbackText({
    business: f.businessName.trim(),
    type: f.businessType.trim(),
    city: f.city.trim(),
    country: MARKET_INFO[f.country].name,
    whatsapp: toE164(f.countryCode, f.whatsappLocal) ?? f.whatsappLocal.trim(),
    services: f.services.trim().slice(0, 300),
  });
  return `https://wa.me/${MM_WHATSAPP}?text=${encodeURIComponent(text)}`;
}

function flagClass(market: Market): string {
  return market === "CO" ? styles.flagCO : styles.flagSV;
}

// ─── Presentational pieces (module scope so inputs never remount) ───────────

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  optionalLabel?: string;
  error?: string;
  children: ReactNode;
}

function Field({ id, label, hint, optionalLabel, error, children }: FieldProps) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {optionalLabel ? <span className={styles.opt}>{optionalLabel}</span> : null}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-err`} className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  optionalLabel?: string;
  error?: string;
  multiline?: boolean;
  maxLength: number;
  type?: "text" | "email" | "url";
  autoComplete?: string;
  inputMode?: "text" | "tel" | "url" | "email";
  enterKeyHint?: "next" | "done" | "go";
  /** Rendered under the input (e.g. quick-pick chips). */
  after?: ReactNode;
}

function TextField(props: TextFieldProps) {
  const describedBy =
    [props.hint ? `${props.id}-hint` : null, props.error ? `${props.id}-err` : null].filter(Boolean).join(" ") ||
    undefined;
  const common = {
    id: props.id,
    value: props.value,
    placeholder: props.placeholder,
    maxLength: props.maxLength,
    "aria-invalid": props.error ? true : undefined,
    "aria-describedby": describedBy,
    className: props.error ? `${styles.input} ${styles.inputErr}` : styles.input,
  };
  return (
    <Field
      id={props.id}
      label={props.label}
      hint={props.hint}
      optionalLabel={props.optionalLabel}
      error={props.error}
    >
      {props.multiline ? (
        <textarea {...common} rows={3} onChange={(e) => props.onChange(e.target.value)} />
      ) : (
        <input
          {...common}
          type={props.type ?? "text"}
          autoComplete={props.autoComplete}
          autoCapitalize={props.type === "email" || props.type === "url" ? "none" : undefined}
          spellCheck={props.type === "email" || props.type === "url" ? false : undefined}
          inputMode={props.inputMode}
          enterKeyHint={props.enterKeyHint}
          onChange={(e) => props.onChange(e.target.value)}
        />
      )}
      {props.after}
    </Field>
  );
}

function problemText(t: Copy, problem: UploadProblem | null): string {
  if (problem === "tooLarge") return t.upload.tooLarge;
  if (problem === "unsupported") return t.upload.unsupported;
  if (problem === "tooMany") return t.upload.tooMany;
  return t.upload.failed;
}

interface UploadTileProps {
  upload: Upload;
  t: Copy;
  onRemove: () => void;
  onRetry: () => void;
}

function UploadTile({ upload, t, onRemove, onRetry }: UploadTileProps) {
  const ext = extensionOf(upload.name).toUpperCase();
  return (
    <div className={styles.tile}>
      <span className={styles.tileDoc}>{ext || "IMG"}</span>
      {upload.preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- local blob preview, not an optimizable asset
        <img
          src={upload.preview}
          alt=""
          className={styles.tileImg}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : null}
      {upload.status === "uploading" ? (
        <span className={styles.tileVeil}>
          {/* The number changes every tick: hidden from screen readers, which hear "Subiendo" once. */}
          <span className={styles.mono} aria-hidden="true">
            {Math.round(upload.progress * 100)}%
          </span>
          <span className={styles.sr}>{t.upload.uploading}</span>
        </span>
      ) : null}
      {upload.status === "error" ? (
        <span className={styles.tileErr}>
          <span>{problemText(t, upload.problem)}</span>
          {upload.problem === "failed" ? (
            <button type="button" className={styles.tileRetry} onClick={onRetry}>
              {t.upload.retry}
            </button>
          ) : null}
        </span>
      ) : null}
      {upload.status === "done" ? <span className={styles.tileOk} role="img" aria-label={t.upload.done} /> : null}
      <span className={styles.tileBar} style={{ transform: `scaleX(${upload.progress})` }} />
      <button
        type="button"
        className={styles.tileRemove}
        onClick={onRemove}
        aria-label={`${t.upload.remove} ${upload.name}`}
      >
        ×
      </button>
    </div>
  );
}

interface DocRowProps {
  upload: Upload;
  t: Copy;
  lang: Lang;
  onRemove: () => void;
  onRetry: () => void;
}

/** A document as a file row: type badge, name, extension + size, progress, retry, remove. */
function DocRow({ upload, t, lang, onRemove, onRetry }: DocRowProps) {
  const ext = extensionOf(upload.name).toUpperCase() || "DOC";
  const size = formatSize(upload.size, lang);
  const status =
    upload.status === "uploading" ? (
      <>
        <span aria-hidden="true">{Math.round(upload.progress * 100)}%</span>
        <span className={styles.sr}>{t.upload.uploading}</span>
      </>
    ) : upload.status === "done" ? (
      t.upload.done
    ) : (
      problemText(t, upload.problem)
    );
  return (
    <li className={upload.status === "error" ? `${styles.docRow} ${styles.docRowErr}` : styles.docRow}>
      <span className={styles.docIcon} aria-hidden="true">
        {upload.preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- local blob preview, not an optimizable asset
          <img
            src={upload.preview}
            alt=""
            className={styles.docThumb}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : null}
        <span className={styles.docExt}>{ext.slice(0, 4)}</span>
      </span>
      <span className={styles.docMeta}>
        <span className={styles.docName}>{upload.name}</span>
        <span className={styles.docSub}>
          {[ext, size].filter(Boolean).join(" · ")}
          <span
            className={
              upload.status === "done" ? styles.docOk : upload.status === "error" ? styles.docBad : styles.docBusy
            }
          >
            {status}
          </span>
        </span>
      </span>
      <span className={styles.docActions}>
        {upload.status === "error" && upload.problem === "failed" ? (
          <button type="button" className={styles.docRetry} onClick={onRetry}>
            {t.upload.retry}
          </button>
        ) : null}
        <button
          type="button"
          className={styles.docRemove}
          onClick={onRemove}
          aria-label={`${t.upload.remove} ${upload.name}`}
        >
          ×
        </button>
      </span>
      <span className={styles.docBar} style={{ transform: `scaleX(${upload.progress})` }} />
    </li>
  );
}

function Skeleton() {
  return (
    <div className={styles.card} aria-busy="true">
      <div className={styles.skel} style={{ width: "38%" }} />
      <div className={styles.skelBar} />
      <div className={styles.skel} style={{ width: "52%", marginTop: 28 }} />
      <div className={styles.skelInput} />
      <div className={styles.skel} style={{ width: "44%" }} />
      <div className={styles.skelInput} />
      <div className={styles.skel} style={{ width: "36%" }} />
      <div className={styles.skelInput} />
      <div className={styles.skelButton} />
    </div>
  );
}

interface DoneCardProps {
  t: Copy;
  market: Market;
  submitted: Submitted;
  next: string[];
  highDemand: boolean;
  canShare: boolean;
  copied: boolean;
  onCopy: (link: string) => void;
  onShare: (text: string) => void;
  onAnother: () => void;
}

function DoneCard({
  t,
  market,
  submitted,
  next,
  highDemand,
  canShare,
  copied,
  onCopy,
  onShare,
  onAnother,
}: DoneCardProps) {
  const link = referralLink(submitted.referralCode);
  const shareText = t.market[market].shareText(submitted.businessName, link);
  const confirmHref = `https://wa.me/${MM_WHATSAPP}?text=${encodeURIComponent(
    t.done.confirmText(submitted.businessName, submitted.referralCode),
  )}`;
  const moreHref = `https://wa.me/${MM_WHATSAPP}?text=${encodeURIComponent(t.done.moreText(submitted.businessName))}`;
  return (
    <div className={`${styles.card} ${styles.done}`}>
      <svg className={styles.doneMark} viewBox="0 0 52 52" aria-hidden="true">
        <circle cx="26" cy="26" r="24" />
        <path d="M15 27 l7 7 l15 -16" />
      </svg>
      <h2 className={styles.doneTitle}>{t.done.title(submitted.businessName)}</h2>
      <p className={styles.doneBody}>{t.done.body}</p>
      {highDemand ? <p className={styles.demand}>{t.highDemand}</p> : null}
      <a className={styles.btnWa} href={confirmHref} target="_blank" rel="noopener noreferrer">
        {t.done.confirm}
      </a>

      <div className={styles.moreFiles}>
        <h3 className={styles.moreTitle}>{t.done.moreTitle}</h3>
        <p className={styles.moreBody}>{t.done.moreBody}</p>
        <a className={styles.btnWaOutline} href={moreHref} target="_blank" rel="noopener noreferrer">
          {t.done.moreButton}
        </a>
      </div>

      <h3 className={styles.kickerSmall}>{t.done.nextTitle}</h3>
      <ol className={styles.timeline}>
        {next.map((line, i) => (
          <li key={line}>
            <span className={styles.mono}>{String(i + 1).padStart(2, "0")}</span>
            <span>{line}</span>
          </li>
        ))}
      </ol>

      <div className={styles.refer}>
        <p className={styles.kickerSmall}>{t.done.referKicker}</p>
        <h3 className={styles.referTitle}>{t.done.referTitle}</h3>
        <p className={styles.referBody}>{t.done.referBody}</p>
        <p className={styles.linkLabel}>{t.done.yourLink}</p>
        <div className={styles.linkBox}>
          <span className={styles.linkText}>{link}</span>
          <button type="button" className={styles.copyBtn} onClick={() => onCopy(link)}>
            {copied ? t.done.copied : t.done.copy}
          </button>
        </div>
        <div className={styles.shareGrid}>
          <a
            className={styles.btnWaOutline}
            href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.done.shareWhatsApp}
          </a>
          <a
            className={styles.btnGhost}
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.done.facebook}
          </a>
          {canShare ? (
            <button type="button" className={styles.btnGhost} onClick={() => onShare(shareText)}>
              {t.done.more}
            </button>
          ) : null}
        </div>
        <p className={styles.tip}>{t.done.storyTip}</p>
      </div>

      <button type="button" className={styles.linkBtn} onClick={onAnother}>
        {t.done.another}
      </button>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function WebGratisClient({ initialMarket, marketHint }: WebGratisClientProps) {
  const [ready, setReady] = useState(false);
  const [lang, setLang] = useState<Lang>("es");
  const [step, setStep] = useState<Step>(1);
  const [fields, setFields] = useState<Fields>(() => emptyFields(initialMarket ?? marketHint ?? "SV"));
  const [errors, setErrors] = useState<Partial<Record<ErrorKey, ValidationKey>>>({});
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptShare, setAcceptShare] = useState(false);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [skipped, setSkipped] = useState<Record<UploadKind, number>>({ logo: 0, photo: 0, document: 0 });
  const [draftId, setDraftId] = useState("");
  const [attribution, setAttribution] = useState<Attribution>({});
  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [busy, setBusy] = useState<"saving" | "submitting" | null>(null);
  const [serverError, setServerError] = useState<ApiError | null>(null);
  const [submitted, setSubmitted] = useState<Submitted | null>(null);
  const [leadTracked, setLeadTracked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [config, setConfig] = useState<{ deliveryDays: number | null; highDemand: boolean }>({
    deliveryDays: null,
    highDemand: false,
  });
  const [pinNav, setPinNav] = useState(false);
  const formColRef = useRef<HTMLElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const draftIdRef = useRef("");
  const filesRef = useRef(new Map<string, Prepared>());
  /** In-flight uploads, so removing a file (or starting over) stops its transfer. */
  const abortersRef = useRef(new Map<string, AbortController>());

  const t = COPY[lang];
  const market = fields.country;
  const mc = t.market[market];
  const logo = uploads.find((u) => u.kind === "logo") ?? null;
  const photos = uploads.filter((u) => u.kind === "photo");
  const docs = uploads.filter((u) => u.kind === "document");
  const uploading = uploads.some((u) => u.status === "uploading");

  // Restore a saved draft, resolve the market + capture attribution (client
  // only, after hydration). Reading localStorage during render would make SSR
  // and the first client render disagree, so this one-time restore sets state here.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const now = Date.now();
    const param = (key: string) => params.get(key)?.trim().slice(0, 200) || undefined;

    // Market: ?pais= / ?country= → the person's saved choice → browser time zone → server hint → SV.
    const fromParam = parseMarket(params.get("pais") ?? params.get("country"));
    let timeZone = "";
    try {
      timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    } catch (error) {
      console.error("[WebGratis] time zone", error);
    }
    const fromZone: Market | null =
      timeZone === MARKET_INFO.CO.timezone ? "CO" : timeZone === MARKET_INFO.SV.timezone ? "SV" : null;

    const incoming = (params.get("ref") ?? "").trim().toUpperCase();
    const storedRef = readJSON<{ code: string; at: number }>(REF_KEY);
    let ref = storedRef && now - storedRef.at < REF_TTL_MS ? storedRef.code : undefined;
    if (!ref && REFERRAL_CODE_RE.test(incoming)) {
      ref = incoming;
      writeJSON(REF_KEY, { code: incoming, at: now });
    }
    const fresh: Attribution = {
      ref,
      utm_source: param("utm_source"),
      utm_medium: param("utm_medium"),
      utm_campaign: param("utm_campaign"),
      utm_content: param("utm_content"),
      utm_term: param("utm_term"),
      fbclid: params.get("fbclid")?.slice(0, 500) || undefined,
      landing_url: window.location.href.slice(0, 1000),
    };

    const saved = readJSON<Persisted>(STORAGE_KEY);
    if (saved && saved.v === 1 && saved.draftId && now - saved.savedAt < DRAFT_TTL_MS) {
      const savedMarket = parseMarket(saved.fields?.country);
      const chosen = fromParam ?? savedMarket ?? fromZone ?? marketHint ?? "SV";
      const restored: Fields = { ...emptyFields(chosen), ...saved.fields, country: chosen };
      // A number already typed keeps its code; an empty one follows the market.
      if (!restored.whatsappLocal.trim()) restored.countryCode = MARKET_INFO[chosen].dial;
      draftIdRef.current = saved.draftId;
      setDraftId(saved.draftId);
      setStep(saved.step);
      setFields(restored);
      setUploads(
        (saved.uploads ?? [])
          .filter((u) => (UPLOAD_KINDS as readonly string[]).includes(u.kind) && typeof u.path === "string")
          .map((u) => ({
            id: u.id,
            kind: u.kind,
            name: u.name,
            path: u.path,
            size: typeof u.size === "number" ? u.size : 0,
            status: "done",
            progress: 1,
            preview: null,
            problem: null,
          })),
      );
      setLang(saved.lang === "en" ? "en" : "es");
      setAttribution({ ...fresh, ...saved.attribution, ref: saved.attribution?.ref ?? fresh.ref });
      setSubmitted(saved.submitted ?? null);
      setLeadTracked(!!saved.leadTracked);
    } else {
      const id = newId();
      draftIdRef.current = id;
      setDraftId(id);
      setFields(emptyFields(fromParam ?? fromZone ?? marketHint ?? "SV"));
      setAttribution(fresh);
    }
    setCanShare(typeof navigator.share === "function");
    setReady(true);
    track("ViewContent", { content_name: "web_gratis" });
  }, [marketHint]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Persist progress so an in-app-browser reload lands the user back in place.
  useEffect(() => {
    if (!ready || !draftId) return;
    const data: Persisted = {
      v: 1,
      draftId,
      step,
      fields,
      uploads: uploads
        .filter((u) => u.status === "done" && u.path)
        .map((u) => ({ id: u.id, kind: u.kind, name: u.name, path: u.path as string, size: u.size })),
      lang,
      attribution,
      submitted,
      leadTracked,
      savedAt: Date.now(),
    };
    writeJSON(STORAGE_KEY, data);
  }, [ready, draftId, step, fields, uploads, lang, attribution, submitted, leadTracked]);

  useEffect(() => {
    document.documentElement.lang = lang === "es" ? (market === "CO" ? "es-CO" : "es-SV") : "en";
  }, [lang, market]);

  // Pin the action bar to the bottom of the screen once the form is really in
  // view; before that (phone, top of the page) the hero CTA is the one action.
  useEffect(() => {
    if (!ready || submitted) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const el = formRef.current;
      if (el) setPinNav(el.getBoundingClientRect().top < window.innerHeight * 0.55);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [ready, submitted, step]);

  // Capacity settings from the ops board ("lista en X días", high-demand notice).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/web-gratis/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { data?: { deliveryDays: number | null; highDemand: boolean } | null } | null) => {
        if (!cancelled && json?.data) setConfig(json.data);
      })
      .catch((error: unknown) => console.error("[WebGratis] config", error));
    return () => {
      cancelled = true;
    };
  }, []);

  // "{Negocio} le recomendó esta iniciativa."
  useEffect(() => {
    const code = attribution.ref;
    if (!code) return;
    let cancelled = false;
    fetch(`/api/web-gratis/ref?code=${encodeURIComponent(code)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { data?: { name?: string } | null } | null) => {
        if (!cancelled && json?.data?.name) setReferrerName(json.data.name);
      })
      .catch((error: unknown) => console.error("[WebGratis] referrer lookup", error));
    return () => {
      cancelled = true;
    };
  }, [attribution.ref]);

  function setField(key: TextKey, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setServerError(null);
  }

  /** Pick El Salvador / Colombia: the phone code follows unless they chose another country's code. */
  function chooseMarket(next: Market) {
    setFields((prev) => ({
      ...prev,
      country: next,
      countryCode: MARKET_DIALS.has(prev.countryCode) ? MARKET_INFO[next].dial : prev.countryCode,
    }));
    setErrors((prev) => {
      if (!prev.whatsappLocal) return prev;
      const rest = { ...prev };
      delete rest.whatsappLocal;
      return rest;
    });
    // Keep the choice in the URL so a reload (param wins) lands on the same country.
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("pais", next.toLowerCase());
      url.searchParams.delete("country");
      window.history.replaceState(window.history.state, "", url.toString());
    } catch (error) {
      console.error("[WebGratis] url update", error);
    }
  }

  function apiFields() {
    return {
      businessName: fields.businessName.trim(),
      businessType: fields.businessType.trim(),
      city: fields.city.trim(),
      country: fields.country,
      countryCode: fields.countryCode,
      whatsappLocal: fields.whatsappLocal,
      services: fields.services,
      differentiator: fields.differentiator,
      hours: fields.hours,
      address: fields.address,
      instagram: fields.instagram,
      facebook: fields.facebook,
      existingWebsite: fields.existingWebsite,
      contactEmail: fields.contactEmail.trim(),
      style: fields.style,
      siteGoal: fields.siteGoal || null,
      referredBy: fields.referredBy,
      extraNotes: fields.extraNotes,
    };
  }

  function saveDraft(target: Step) {
    const all = apiFields();
    // The server only writes step-2 columns from step 2 on, so a step-1 save
    // sends step-1 fields only — an unfinished step-2 answer (e.g. a half-typed
    // email after "Atrás") can never block Continue on step 1.
    const fieldsForStep =
      target === 1
        ? {
            businessName: all.businessName,
            businessType: all.businessType,
            city: all.city,
            country: all.country,
            countryCode: all.countryCode,
            whatsappLocal: all.whatsappLocal,
          }
        : all;
    return postWithRetry<{ referralCode: string; status: string }>("/api/web-gratis/draft", {
      draftId: draftIdRef.current,
      step: target,
      lang,
      website: honeypot,
      fields: fieldsForStep,
      attribution,
    });
  }

  /** Show a server-side field error on the step that owns the field. */
  function showFieldError(target: Step, key: ErrorKey, value: ValidationKey) {
    if (step !== target) goTo(target);
    setErrors({ [key]: value });
    window.setTimeout(() => document.getElementById(`wg-${key}`)?.focus(), 80);
  }

  function scrollToForm() {
    window.requestAnimationFrame(() => formColRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  /** Hero / "how it works" CTA: bring the form into view and put the cursor in the first empty field. */
  function startFromCta() {
    scrollToForm();
    if (submitted || step !== 1) return;
    window.setTimeout(() => document.getElementById("wg-businessName")?.focus({ preventScroll: true }), 450);
  }

  function goTo(next: Step) {
    setStep(next);
    setServerError(null);
    scrollToForm();
  }

  function focusFirstError(errs: Partial<Record<ErrorKey, ValidationKey>>) {
    const first = ERROR_ORDER.find((k) => errs[k]);
    if (first) window.requestAnimationFrame(() => document.getElementById(`wg-${first}`)?.focus());
  }

  async function handleContinue() {
    if (busy) return;
    const errs = validate(step, fields, acceptTerms, acceptShare);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      focusFirstError(errs);
      return;
    }
    setServerError(null);
    setBusy("saving");
    const res = await saveDraft(step);
    setBusy(null);

    if (step === 1) {
      if (!res.ok || !res.data) {
        if (res.error === "invalid_whatsapp") {
          const key = whatsappKey(fields.countryCode);
          setErrors({ whatsappLocal: key });
          focusFirstError({ whatsappLocal: key });
        }
        setServerError(res.error ?? "save_failed");
        return;
      }
      if (res.data.status !== "borrador") {
        setSubmitted({ referralCode: res.data.referralCode, businessName: fields.businessName.trim() });
        scrollToForm();
        return;
      }
      if (!leadTracked) {
        track("Lead", { content_name: "web_gratis" }, `${draftIdRef.current}-lead`);
        setLeadTracked(true);
      }
      goTo(2);
      return;
    }

    if (res.error === "invalid_email") {
      setErrors({ contactEmail: "email" });
      focusFirstError({ contactEmail: "email" });
      return;
    }
    // Step 2 save is otherwise best-effort: everything is sent again on submit.
    if (!res.ok) console.error("[WebGratis] step 2 save failed", res.error);
    goTo(3);
  }

  async function handleSubmit() {
    if (busy || uploading) return;
    const errs = validate(3, fields, acceptTerms, acceptShare);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      focusFirstError(errs);
      return;
    }
    setBusy("submitting");
    setServerError(null);
    const res = await postWithRetry<{ referralCode: string; businessName: string }>("/api/web-gratis/submit", {
      draftId: draftIdRef.current,
      lang,
      website: honeypot,
      fields: apiFields(),
      acceptTerms: true,
      acceptShare: true,
      uploadPaths: uploads.filter((u) => u.status === "done" && u.path).map((u) => u.path),
      attribution,
    });
    setBusy(null);
    if (!res.ok || !res.data) {
      if (res.error === "invalid_whatsapp") {
        showFieldError(1, "whatsappLocal", whatsappKey(fields.countryCode));
      } else if (res.error === "invalid_email") {
        showFieldError(2, "contactEmail", "email");
      }
      setServerError(res.error ?? "server_error");
      return;
    }
    track("CompleteRegistration", { content_name: "web_gratis" }, `${draftIdRef.current}-complete`);
    setSubmitted({ referralCode: res.data.referralCode, businessName: res.data.businessName });
    scrollToForm();
  }

  function patchUpload(id: string, patch: Partial<Upload>) {
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }

  async function runUpload(id: string, kind: UploadKind, file: Prepared, allowRecover: boolean): Promise<void> {
    patchUpload(id, { status: "uploading", progress: 0.02, problem: null });
    const sign = await postWithRetry<{ path: string; signedUrl: string }>("/api/web-gratis/upload-url", {
      draftId: draftIdRef.current,
      kind,
      contentType: file.type,
      size: file.blob.size,
    });
    if (!sign.ok || !sign.data) {
      if (sign.error === "draft_not_found" && allowRecover) {
        // The server lost this draft (e.g. restored from an old session) — recreate it, retry once.
        const saved = await saveDraft(3);
        if (saved.ok) return runUpload(id, kind, file, false);
      }
      const problem: UploadProblem =
        sign.error === "too_large"
          ? "tooLarge"
          : sign.error === "unsupported_type"
            ? "unsupported"
            : sign.error === "too_many_files"
              ? "tooMany"
              : "failed";
      patchUpload(id, { status: "error", problem });
      return;
    }
    const { path, signedUrl } = sign.data;
    abortersRef.current.get(id)?.abort();
    const controller = new AbortController();
    abortersRef.current.set(id, controller);
    await acquireUploadSlot();
    // No try/finally here: the React Compiler skips components that use `finally`.
    let failure: unknown = null;
    if (!controller.signal.aborted) {
      try {
        await putFile(signedUrl, file, (p) => patchUpload(id, { progress: Math.max(0.02, p) }), controller.signal);
      } catch (error) {
        failure = error;
      }
    }
    releaseUploadSlot();
    if (abortersRef.current.get(id) === controller) abortersRef.current.delete(id);
    if (controller.signal.aborted) return; // removed by the person — nothing to report
    if (failure) {
      console.error("[WebGratis] upload failed", failure);
      patchUpload(id, { status: "error", problem: "failed" });
      return;
    }
    patchUpload(id, { status: "done", progress: 1, path });
    filesRef.current.delete(id);
  }

  async function onPick(kind: UploadKind, e: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (picked.length === 0) return;

    let accepted: File[];
    let left = 0;
    if (kind === "logo") {
      uploads.filter((u) => u.kind === "logo").forEach((u) => removeUpload(u.id));
      accepted = picked.slice(0, 1);
    } else {
      const max = kind === "photo" ? MAX_PHOTOS : MAX_DOCUMENTS;
      const room = Math.max(0, max - uploads.filter((u) => u.kind === kind).length);
      accepted = picked.slice(0, room);
      left = picked.length - accepted.length;
    }
    setSkipped((prev) => ({ ...prev, [kind]: left }));

    for (const file of accepted) {
      const id = newId();
      const type = inferType(file, kind);
      const tile: Upload = {
        id,
        kind,
        name: file.name || (kind === "logo" ? "logo" : kind === "photo" ? "foto" : "documento"),
        size: file.size,
        status: "uploading",
        progress: 0.02,
        path: null,
        preview: null,
        problem: null,
      };
      if (!type) {
        setUploads((prev) => [...prev, { ...tile, status: "error", problem: "unsupported" }]);
        continue;
      }
      if (kind !== "photo" && file.size > MAX_UPLOAD_BYTES) {
        // Logos and documents are never re-encoded, so their size is final.
        setUploads((prev) => [...prev, { ...tile, status: "error", problem: "tooLarge" }]);
        continue;
      }
      setUploads((prev) => [...prev, tile]);
      const prepared = await prepareFile(file, kind, type);
      if (prepared.blob.size > MAX_UPLOAD_BYTES) {
        patchUpload(id, { status: "error", problem: "tooLarge", size: prepared.blob.size });
        continue;
      }
      const preview = prepared.type.startsWith("image/") ? URL.createObjectURL(prepared.blob) : null;
      patchUpload(id, { preview, size: prepared.blob.size });
      filesRef.current.set(id, prepared);
      void runUpload(id, kind, prepared, true);
    }
  }

  function removeUpload(id: string) {
    setUploads((prev) => {
      const target = prev.find((u) => u.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return prev.filter((u) => u.id !== id);
    });
    filesRef.current.delete(id);
    abortersRef.current.get(id)?.abort();
    abortersRef.current.delete(id);
  }

  function retryUpload(upload: Upload) {
    const file = filesRef.current.get(upload.id);
    if (file) void runUpload(upload.id, upload.kind, file, true);
    else removeUpload(upload.id);
  }

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      legacyCopy(link);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }

  async function nativeShare(text: string) {
    try {
      await navigator.share({ text });
    } catch {
      // Share sheet dismissed.
    }
  }

  function startOver() {
    const id = newId();
    draftIdRef.current = id;
    uploads.forEach((u) => u.preview && URL.revokeObjectURL(u.preview));
    filesRef.current.clear();
    abortersRef.current.forEach((c) => c.abort());
    abortersRef.current.clear();
    setDraftId(id);
    setFields(emptyFields(market));
    setUploads([]);
    setSkipped({ logo: 0, photo: 0, document: 0 });
    setStep(1);
    setSubmitted(null);
    setAcceptTerms(false);
    setAcceptShare(false);
    setErrors({});
    setServerError(null);
    setLeadTracked(false);
    scrollToForm();
  }

  const err = (key: ErrorKey) => validationText(t, errors[key]);
  const chips = config.deliveryDays ? t.chips.map((c, i) => (i === 1 ? t.chipDays(config.deliveryDays as number) : c)) : t.chips;
  const doneNext = config.deliveryDays
    ? t.done.next.map((line, i) => (i === 1 ? t.nextDays(config.deliveryDays as number) : line))
    : t.done.next;
  const serverMessage = serverError ? t.errors[serverError] : null;
  const whatsappDescribedBy = errors.whatsappLocal ? "wg-whatsappLocal-hint wg-whatsappLocal-err" : "wg-whatsappLocal-hint";

  return (
    <main className={styles.page}>
      <div className={styles.aurora} aria-hidden="true" />
      <div className={styles.grain} aria-hidden="true" />
      <div className={styles.vignette} aria-hidden="true" />

      <div className={styles.shell}>
        <header className={styles.top}>
          <Link href="/" className={styles.brand}>
            <span className={`${styles.flagMini} ${flagClass(market)}`} aria-hidden="true" />
            MachineMind
          </Link>
          <button
            type="button"
            className={styles.langBtn}
            onClick={() => setLang(lang === "es" ? "en" : "es")}
            lang={lang === "es" ? "en" : "es"}
          >
            {t.langToggle}
          </button>
        </header>

        <div className={styles.layout}>
          <section className={styles.hero}>
            <p className={`${styles.badge} ${styles.rise}`}>
              <span className={`${styles.flagStripe} ${flagClass(market)}`} aria-hidden="true" />
              <span>
                {t.badge}
                <span className={styles.badgeCountry}> · {mc.name}</span>
              </span>
            </p>
            <h1 className={`${styles.title} ${styles.rise} ${styles.d1}`}>
              {t.titleA}
              <span className={styles.titleB}>{t.titleB}</span>
            </h1>
            <p className={`${styles.align} ${styles.rise} ${styles.d1}`}>{mc.align}</p>
            <p className={`${styles.lede} ${styles.rise} ${styles.d2}`}>{t.lede}</p>
            {referrerName ? <p className={styles.referred}>{t.referredBy(referrerName)}</p> : null}
            {config.highDemand ? <p className={styles.demand}>{t.highDemand}</p> : null}
            <ul className={`${styles.chips} ${styles.rise} ${styles.d3}`}>
              {chips.map((chip) => (
                <li key={chip}>{chip}</li>
              ))}
            </ul>
            {submitted ? null : (
              <a
                href="#formulario"
                className={`${styles.heroCta} ${styles.rise} ${styles.d3}`}
                onClick={(e) => {
                  e.preventDefault();
                  startFromCta();
                }}
              >
                <span>{t.heroCta}</span>
              </a>
            )}
          </section>

          <section id="formulario" className={styles.formCol} ref={formColRef} aria-live="polite">
            <noscript>
              <div className={styles.alert}>
                <p>{COPY.es.noscript}</p>
                <a className={styles.alertLink} href={`https://wa.me/${MM_WHATSAPP}`}>
                  {COPY.es.whatsappHelp}
                </a>
              </div>
            </noscript>

            {!ready ? (
              <Skeleton />
            ) : submitted ? (
              <DoneCard
                t={t}
                market={market}
                submitted={submitted}
                next={doneNext}
                highDemand={config.highDemand}
                canShare={canShare}
                copied={copied}
                onCopy={(link) => void copyLink(link)}
                onShare={(text) => void nativeShare(text)}
                onAnother={startOver}
              />
            ) : (
              <form
                ref={formRef}
                className={`${styles.card} ${styles.rise} ${styles.d2}`}
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  if (step === 3) void handleSubmit();
                  else void handleContinue();
                }}
              >
                <div className={styles.progressHead}>
                  <span className={styles.mono}>{t.stepLabel(step)}</span>
                  <span className={styles.stepName}>{t.stepNames[step - 1]}</span>
                </div>
                <ol className={styles.stepper} aria-label={t.stepLabel(step)}>
                  {t.stepShort.map((name, i) => {
                    const n = i + 1;
                    const cls = n < step ? styles.stepDone : n === step ? styles.stepOn : styles.stepLater;
                    return (
                      <li key={name} className={cls} aria-current={n === step ? "step" : undefined}>
                        <span className={styles.stepNum}>{String(n).padStart(2, "0")}</span>
                        <span className={styles.stepText}>{name}</span>
                      </li>
                    );
                  })}
                </ol>

                <div className={styles.hp} aria-hidden="true">
                  <label>
                    Website
                    <input
                      tabIndex={-1}
                      autoComplete="off"
                      name="mm_hp_field"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                    />
                  </label>
                </div>

                <div key={step} className={styles.stepBody}>
                  {step === 1 ? (
                    <>
                      <fieldset className={styles.fieldset}>
                        <legend className={styles.label}>{t.countryPicker.label}</legend>
                        <p className={styles.hint}>{t.countryPicker.hint}</p>
                        <div className={styles.marketRow}>
                          {MARKETS.map((m) => (
                            <label key={m} className={market === m ? styles.marketOn : styles.market}>
                              <input
                                type="radio"
                                name="market"
                                value={m}
                                checked={market === m}
                                onChange={() => chooseMarket(m)}
                                className={styles.sr}
                              />
                              <span className={`${styles.flagStripe} ${flagClass(m)}`} aria-hidden="true" />
                              <span>{t.market[m].name}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <TextField
                        id="wg-businessName"
                        label={t.fields.businessName.label}
                        placeholder={t.fields.businessName.placeholder}
                        value={fields.businessName}
                        onChange={(v) => setField("businessName", v)}
                        error={err("businessName")}
                        maxLength={120}
                        autoComplete="organization"
                        enterKeyHint="next"
                      />
                      <TextField
                        id="wg-businessType"
                        label={t.fields.businessType.label}
                        hint={t.fields.businessType.hint}
                        placeholder={t.fields.businessType.placeholder}
                        value={fields.businessType}
                        onChange={(v) => setField("businessType", v)}
                        error={err("businessType")}
                        maxLength={200}
                        enterKeyHint="next"
                      />
                      <TextField
                        id="wg-city"
                        label={t.fields.city.label}
                        placeholder={mc.cityPlaceholder}
                        value={fields.city}
                        onChange={(v) => setField("city", v)}
                        error={err("city")}
                        maxLength={100}
                        autoComplete="address-level2"
                        enterKeyHint="next"
                        after={
                          <div className={styles.quick} role="group" aria-label={t.fields.city.quickLabel}>
                            {MARKET_INFO[market].cities.map((c) => (
                              <button
                                key={c}
                                type="button"
                                className={fields.city === c ? styles.quickOn : styles.quickBtn}
                                aria-pressed={fields.city === c}
                                onClick={() => setField("city", c)}
                              >
                                {c}
                              </button>
                            ))}
                          </div>
                        }
                      />
                      <Field
                        id="wg-whatsappLocal"
                        label={t.fields.whatsapp.label}
                        hint={t.fields.whatsapp.hint}
                        error={err("whatsappLocal")}
                      >
                        <div className={styles.phoneRow}>
                          <select
                            aria-label={t.fields.whatsapp.country}
                            className={styles.select}
                            value={fields.countryCode}
                            onChange={(e) => setField("countryCode", e.target.value)}
                          >
                            {COUNTRY_CODES.map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                          <input
                            id="wg-whatsappLocal"
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel-national"
                            enterKeyHint="go"
                            maxLength={24}
                            placeholder={
                              fields.countryCode === MARKET_INFO.CO.dial
                                ? t.market.CO.phonePlaceholder
                                : fields.countryCode === MARKET_INFO.SV.dial
                                  ? t.market.SV.phonePlaceholder
                                  : mc.phonePlaceholder
                            }
                            value={fields.whatsappLocal}
                            onChange={(e) => setField("whatsappLocal", e.target.value)}
                            aria-invalid={errors.whatsappLocal ? true : undefined}
                            aria-describedby={whatsappDescribedBy}
                            className={errors.whatsappLocal ? `${styles.input} ${styles.inputErr}` : styles.input}
                          />
                        </div>
                        <p className={styles.consent}>{t.fields.whatsapp.consent}</p>
                      </Field>
                    </>
                  ) : null}

                  {step === 2 ? (
                    <>
                      <TextField
                        id="wg-services"
                        label={t.fields.services.label}
                        hint={t.fields.services.hint}
                        placeholder={t.fields.services.placeholder}
                        value={fields.services}
                        onChange={(v) => setField("services", v)}
                        error={err("services")}
                        maxLength={1500}
                        multiline
                      />
                      <TextField
                        id="wg-differentiator"
                        label={t.fields.differentiator.label}
                        hint={t.fields.differentiator.hint}
                        placeholder={t.fields.differentiator.placeholder}
                        optionalLabel={t.optional}
                        value={fields.differentiator}
                        onChange={(v) => setField("differentiator", v)}
                        maxLength={1000}
                        multiline
                      />
                      <TextField
                        id="wg-hours"
                        label={t.fields.hours.label}
                        placeholder={t.fields.hours.placeholder}
                        optionalLabel={t.optional}
                        value={fields.hours}
                        onChange={(v) => setField("hours", v)}
                        maxLength={300}
                        enterKeyHint="next"
                      />
                      <TextField
                        id="wg-address"
                        label={t.fields.address.label}
                        hint={t.fields.address.hint}
                        placeholder={t.fields.address.placeholder}
                        optionalLabel={t.optional}
                        value={fields.address}
                        onChange={(v) => setField("address", v)}
                        maxLength={300}
                        autoComplete="street-address"
                        enterKeyHint="next"
                      />
                      <div className={styles.twoCol}>
                        <TextField
                          id="wg-instagram"
                          label={t.fields.instagram.label}
                          placeholder={t.fields.instagram.placeholder}
                          optionalLabel={t.optional}
                          value={fields.instagram}
                          onChange={(v) => setField("instagram", v)}
                          maxLength={200}
                          enterKeyHint="next"
                        />
                        <TextField
                          id="wg-facebook"
                          label={t.fields.facebook.label}
                          placeholder={t.fields.facebook.placeholder}
                          optionalLabel={t.optional}
                          value={fields.facebook}
                          onChange={(v) => setField("facebook", v)}
                          maxLength={300}
                          inputMode="url"
                          enterKeyHint="next"
                        />
                      </div>
                      <TextField
                        id="wg-existingWebsite"
                        label={t.fields.existingWebsite.label}
                        hint={t.fields.existingWebsite.hint}
                        placeholder={t.fields.existingWebsite.placeholder}
                        optionalLabel={t.optional}
                        value={fields.existingWebsite}
                        onChange={(v) => setField("existingWebsite", v)}
                        maxLength={300}
                        type="url"
                        inputMode="url"
                        autoComplete="url"
                        enterKeyHint="next"
                      />
                      <TextField
                        id="wg-contactEmail"
                        label={t.fields.contactEmail.label}
                        hint={t.fields.contactEmail.hint}
                        placeholder={t.fields.contactEmail.placeholder}
                        optionalLabel={t.optional}
                        value={fields.contactEmail}
                        onChange={(v) => setField("contactEmail", v)}
                        error={err("contactEmail")}
                        maxLength={200}
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        enterKeyHint="next"
                      />
                      <fieldset className={styles.fieldset}>
                        <legend className={styles.label}>
                          {t.fields.siteGoal.label}
                          <span className={styles.opt}>{t.optional}</span>
                        </legend>
                        {t.fields.siteGoal.options.map((o) => (
                          <label key={o.value} className={fields.siteGoal === o.value ? styles.choiceOn : styles.choice}>
                            <input
                              type="radio"
                              name="siteGoal"
                              value={o.value}
                              checked={fields.siteGoal === o.value}
                              onChange={() => setField("siteGoal", o.value)}
                              className={styles.sr}
                            />
                            <span className={styles.radio} aria-hidden="true" />
                            <span>{o.label}</span>
                          </label>
                        ))}
                      </fieldset>
                      <TextField
                        id="wg-style"
                        label={t.fields.style.label}
                        hint={t.fields.style.hint}
                        placeholder={t.fields.style.placeholder}
                        optionalLabel={t.optional}
                        value={fields.style}
                        onChange={(v) => setField("style", v)}
                        maxLength={500}
                        enterKeyHint={referrerName ? "go" : "next"}
                      />
                      {referrerName ? null : (
                        <TextField
                          id="wg-referredBy"
                          label={t.fields.referredBy.label}
                          hint={t.fields.referredBy.hint}
                          placeholder={t.fields.referredBy.placeholder}
                          optionalLabel={t.optional}
                          value={fields.referredBy}
                          onChange={(v) => setField("referredBy", v)}
                          maxLength={120}
                          enterKeyHint="go"
                        />
                      )}
                    </>
                  ) : null}

                  {step === 3 ? (
                    <>
                      <div className={styles.field}>
                        <p className={styles.label}>
                          {t.fields.logo.label}
                          <span className={styles.opt}>{t.optional}</span>
                        </p>
                        <p className={styles.hint}>{t.fields.logo.hint}</p>
                        <div className={styles.logoRow}>
                          {logo ? (
                            <div className={styles.logoTile}>
                              <UploadTile
                                upload={logo}
                                t={t}
                                onRemove={() => removeUpload(logo.id)}
                                onRetry={() => retryUpload(logo)}
                              />
                            </div>
                          ) : null}
                          <label className={styles.pickBtn}>
                            <input
                              type="file"
                              accept={UPLOAD_ACCEPT.logo}
                              className={styles.sr}
                              onChange={(e) => void onPick("logo", e)}
                            />
                            {logo ? t.fields.logo.replace : t.fields.logo.button}
                          </label>
                        </div>
                      </div>

                      <div className={styles.field}>
                        <p className={styles.label}>
                          {t.fields.photos.label}
                          <span className={styles.opt}>{t.optional}</span>
                          <span className={styles.count}>{t.fields.photos.count(photos.length, MAX_PHOTOS)}</span>
                        </p>
                        <p className={styles.hint}>{t.fields.photos.hint}</p>
                        <div className={styles.uploadGrid}>
                          {photos.map((u) => (
                            <UploadTile
                              key={u.id}
                              upload={u}
                              t={t}
                              onRemove={() => removeUpload(u.id)}
                              onRetry={() => retryUpload(u)}
                            />
                          ))}
                          {photos.length < MAX_PHOTOS ? (
                            <label className={styles.addTile}>
                              <input
                                type="file"
                                accept={UPLOAD_ACCEPT.photo}
                                multiple
                                className={styles.sr}
                                onChange={(e) => void onPick("photo", e)}
                              />
                              <span className={styles.plus} aria-hidden="true">
                                +
                              </span>
                              <span>{t.fields.photos.button}</span>
                            </label>
                          ) : null}
                        </div>
                        {skipped.photo > 0 ? <p className={styles.notice}>{t.upload.skipped(skipped.photo, MAX_PHOTOS)}</p> : null}
                      </div>

                      <div className={styles.field}>
                        <p className={styles.label}>
                          {t.fields.documents.label}
                          <span className={styles.opt}>{t.optional}</span>
                          <span className={styles.count}>{t.fields.documents.count(docs.length, MAX_DOCUMENTS)}</span>
                        </p>
                        <p className={styles.hint}>{t.fields.documents.hint}</p>
                        {docs.length > 0 ? (
                          <ul className={styles.docList}>
                            {docs.map((u) => (
                              <DocRow
                                key={u.id}
                                upload={u}
                                t={t}
                                lang={lang}
                                onRemove={() => removeUpload(u.id)}
                                onRetry={() => retryUpload(u)}
                              />
                            ))}
                          </ul>
                        ) : null}
                        {docs.length < MAX_DOCUMENTS ? (
                          <label className={styles.pickBtn}>
                            <input
                              type="file"
                              accept={UPLOAD_ACCEPT.document}
                              multiple
                              className={styles.sr}
                              onChange={(e) => void onPick("document", e)}
                            />
                            <span className={styles.plusInline} aria-hidden="true">
                              +
                            </span>
                            {t.fields.documents.button}
                          </label>
                        ) : null}
                        {skipped.document > 0 ? (
                          <p className={styles.notice}>{t.upload.skipped(skipped.document, MAX_DOCUMENTS)}</p>
                        ) : null}
                      </div>

                      <TextField
                        id="wg-extraNotes"
                        label={t.fields.extraNotes.label}
                        hint={t.fields.extraNotes.hint}
                        placeholder={t.fields.extraNotes.placeholder}
                        optionalLabel={t.optional}
                        value={fields.extraNotes}
                        onChange={(v) => setField("extraNotes", v)}
                        maxLength={1500}
                        multiline
                      />

                      <div className={styles.terms}>
                        <p className={styles.kickerSmall}>{t.terms.title}</p>
                        <ol className={styles.termsList}>
                          {t.terms.lines.map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ol>
                        <label className={acceptTerms ? styles.checkOn : styles.check}>
                          <input
                            id="wg-acceptTerms"
                            type="checkbox"
                            className={styles.sr}
                            checked={acceptTerms}
                            onChange={(e) => {
                              setAcceptTerms(e.target.checked);
                              setErrors((prev) => ({ ...prev, acceptTerms: undefined }));
                            }}
                          />
                          <span className={styles.box} aria-hidden="true" />
                          <span>{t.terms.acceptTerms}</span>
                        </label>
                        {err("acceptTerms") ? (
                          <p className={styles.error} role="alert">
                            {err("acceptTerms")}
                          </p>
                        ) : null}
                        <label className={acceptShare ? styles.checkOn : styles.check}>
                          <input
                            id="wg-acceptShare"
                            type="checkbox"
                            className={styles.sr}
                            checked={acceptShare}
                            onChange={(e) => {
                              setAcceptShare(e.target.checked);
                              setErrors((prev) => ({ ...prev, acceptShare: undefined }));
                            }}
                          />
                          <span className={styles.box} aria-hidden="true" />
                          <span>{t.terms.acceptShare}</span>
                        </label>
                        {err("acceptShare") ? (
                          <p className={styles.error} role="alert">
                            {err("acceptShare")}
                          </p>
                        ) : null}
                        <p className={styles.disclaimer}>{t.disclaimer}</p>
                      </div>
                    </>
                  ) : null}
                </div>

                {serverMessage ? (
                  <div className={styles.alert} role="alert">
                    <p>{serverMessage}</p>
                    <a
                      className={styles.alertLink}
                      href={whatsappHelpHref(t, fields)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t.whatsappHelp}
                    </a>
                  </div>
                ) : null}

                {step === 3 && uploading ? <p className={styles.waiting}>{t.waitingUploads}</p> : null}

                <div className={pinNav ? `${styles.navBar} ${styles.navPinned}` : styles.navBar}>
                  {step === 3 ? <p className={styles.priceLine}>{t.priceLine}</p> : null}
                  <div className={step === 1 ? styles.navSingle : styles.navRow}>
                    {step > 1 ? (
                      <button
                        type="button"
                        className={styles.btnGhost}
                        onClick={() => goTo((step - 1) as Step)}
                        disabled={busy !== null}
                      >
                        {t.back}
                      </button>
                    ) : null}
                    <button
                      type="submit"
                      className={styles.btnPrimary}
                      disabled={busy !== null || (step === 3 && uploading)}
                    >
                      <span>
                        {busy === "saving"
                          ? t.saving
                          : busy === "submitting"
                            ? t.submitting
                            : step === 3
                              ? t.submit
                              : t.continue}
                      </span>
                    </button>
                  </div>
                </div>
                {step === 1 ? <p className={styles.takes}>{t.takes}</p> : null}
                {step === 3 ? <p className={styles.fine}>{t.fine}</p> : null}
              </form>
            )}
          </section>

          <section className={styles.how} aria-labelledby="wg-how">
            <div className={styles.initiative}>
              <p className={styles.kickerSmall}>{t.initiativeTitle}</p>
              <p className={styles.initiativeBody}>{mc.mission}</p>
            </div>
            <h2 id="wg-how" className={styles.kickerSmall}>
              {t.howTitle}
            </h2>
            <ol className={styles.howList}>
              {t.how.map((item, i) => (
                <li key={item.title} className={styles.howItem}>
                  <span className={styles.howNum}>{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            {submitted ? null : (
              <a
                href="#formulario"
                className={styles.howCta}
                onClick={(e) => {
                  e.preventDefault();
                  startFromCta();
                }}
              >
                {t.howCta}
              </a>
            )}
          </section>
        </div>

        <footer className={styles.footer}>
          <p className={styles.footerDisclaimer}>{t.disclaimer}</p>
          <p>
            {t.footer.privacy}{" "}
            <Link href="/verificar" className={styles.footerLink}>
              {t.footer.verify}
            </Link>
          </p>
          <p className={styles.mono}>© MachineMind</p>
        </footer>
      </div>
    </main>
  );
}
