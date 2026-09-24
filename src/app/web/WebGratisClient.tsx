"use client";

import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import Link from "next/link";
import styles from "./web.module.css";
import { COPY, type Copy, type Lang } from "./copy";
import {
  ALLOWED_UPLOAD_TYPES,
  COUNTRY_CODES,
  MAX_PHOTOS,
  MAX_UPLOAD_BYTES,
  MM_WHATSAPP,
  REFERRAL_CODE_RE,
  referralLink,
  splitServices,
  toE164,
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
type UploadKind = "logo" | "photo";
type UploadProblem = "tooLarge" | "unsupported" | "tooMany" | "failed";
type ApiError = WebGratisErrorCode | "network";

interface Fields {
  businessName: string;
  businessType: string;
  city: string;
  countryCode: string;
  whatsappLocal: string;
  services: string;
  differentiator: string;
  hours: string;
  instagram: string;
  facebook: string;
  style: string;
  siteGoal: SiteGoal;
  referredBy: string;
}

type FieldKey = keyof Fields;
type ErrorKey = FieldKey | "acceptTerms" | "acceptShare";
type ValidationKey = keyof Copy["validation"] | "invalidWhatsappGeneric";

interface Upload {
  id: string;
  kind: UploadKind;
  name: string;
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
  fields: Fields;
  uploads: { id: string; kind: UploadKind; name: string; path: string }[];
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
  "acceptTerms",
  "acceptShare",
];

const EMPTY_FIELDS: Fields = {
  businessName: "",
  businessType: "",
  city: "",
  countryCode: "503",
  whatsappLocal: "",
  services: "",
  differentiator: "",
  hours: "",
  instagram: "",
  facebook: "",
  style: "",
  siteGoal: "",
  referredBy: "",
};

const EXTENSION_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  gif: "image/gif",
  pdf: "application/pdf",
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

function inferType(file: File): string | null {
  const byType = file.type.toLowerCase();
  if (ALLOWED_UPLOAD_TYPES[byType]) return byType;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TYPES[ext] ?? null;
}

function safeName(name: string, type: string): string {
  const base = (name || "archivo").replace(/[^\w.\- ]+/g, "").slice(0, 60) || "archivo";
  return base.includes(".") ? base : `${base}.${ALLOWED_UPLOAD_TYPES[type] ?? "bin"}`;
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

/** Downscale phone photos (often 4–8 MB) to ≤1920px JPEG before upload. */
async function prepareFile(file: File, kind: UploadKind, type: string): Promise<Prepared> {
  const name = safeName(file.name, type);
  const original: Prepared = { blob: file.type === type ? file : new Blob([file], { type }), name, type };
  const isHeic = type === "image/heic" || type === "image/heif";
  if (kind === "logo" || !COMPRESSIBLE.has(type) || (file.size < 450_000 && !isHeic)) return original;
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

/** PUT straight to the signed Supabase Storage URL, with progress. */
function putFile(url: string, file: Prepared, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.timeout = 120_000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`upload ${xhr.status}: ${xhr.responseText.slice(0, 200)}`));
    xhr.onerror = () => reject(new Error("upload network error"));
    xhr.ontimeout = () => reject(new Error("upload timeout"));
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
    if (!toE164(f.countryCode, f.whatsappLocal)) {
      e.whatsappLocal = f.countryCode === "503" ? "whatsapp" : "invalidWhatsappGeneric";
    }
  }
  if (step === 2 && splitServices(f.services).length === 0) e.services = "services";
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
    whatsapp: toE164(f.countryCode, f.whatsappLocal) ?? f.whatsappLocal.trim(),
    services: f.services.trim().slice(0, 300),
  });
  return `https://wa.me/${MM_WHATSAPP}?text=${encodeURIComponent(text)}`;
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
  autoComplete?: string;
  inputMode?: "text" | "tel" | "url";
  enterKeyHint?: "next" | "done" | "go";
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
          type="text"
          autoComplete={props.autoComplete}
          inputMode={props.inputMode}
          enterKeyHint={props.enterKeyHint}
          onChange={(e) => props.onChange(e.target.value)}
        />
      )}
    </Field>
  );
}

interface UploadTileProps {
  upload: Upload;
  t: Copy;
  onRemove: () => void;
  onRetry: () => void;
}

function UploadTile({ upload, t, onRemove, onRetry }: UploadTileProps) {
  const ext = upload.name.split(".").pop()?.toUpperCase() ?? "";
  const problem =
    upload.problem === "tooLarge"
      ? t.upload.tooLarge
      : upload.problem === "unsupported"
        ? t.upload.unsupported
        : upload.problem === "tooMany"
          ? t.upload.tooMany
          : t.upload.failed;
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
          <span className={styles.mono}>{Math.round(upload.progress * 100)}%</span>
        </span>
      ) : null}
      {upload.status === "error" ? (
        <span className={styles.tileErr}>
          <span>{problem}</span>
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
  submitted: Submitted;
  next: string[];
  highDemand: boolean;
  canShare: boolean;
  copied: boolean;
  onCopy: (link: string) => void;
  onShare: (text: string) => void;
  onAnother: () => void;
}

function DoneCard({ t, submitted, next, highDemand, canShare, copied, onCopy, onShare, onAnother }: DoneCardProps) {
  const link = referralLink(submitted.referralCode);
  const shareText = t.done.shareText(submitted.businessName, link);
  const confirmHref = `https://wa.me/${MM_WHATSAPP}?text=${encodeURIComponent(
    t.done.confirmText(submitted.businessName, submitted.referralCode),
  )}`;
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

export default function WebGratisClient() {
  const [ready, setReady] = useState(false);
  const [lang, setLang] = useState<Lang>("es");
  const [step, setStep] = useState<Step>(1);
  const [fields, setFields] = useState<Fields>(EMPTY_FIELDS);
  const [errors, setErrors] = useState<Partial<Record<ErrorKey, ValidationKey>>>({});
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptShare, setAcceptShare] = useState(false);
  const [uploads, setUploads] = useState<Upload[]>([]);
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
  const formColRef = useRef<HTMLElement>(null);
  const draftIdRef = useRef("");
  const filesRef = useRef(new Map<string, Prepared>());

  const t = COPY[lang];
  const logo = uploads.find((u) => u.kind === "logo") ?? null;
  const photos = uploads.filter((u) => u.kind === "photo");
  const uploading = uploads.some((u) => u.status === "uploading");

  // Restore a saved draft + capture attribution (client only, after hydration).
  // Reading localStorage during render would make SSR and the first client
  // render disagree, so this one-time restore deliberately sets state here.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const now = Date.now();
    const param = (key: string) => params.get(key)?.trim().slice(0, 200) || undefined;

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
      draftIdRef.current = saved.draftId;
      setDraftId(saved.draftId);
      setStep(saved.step);
      setFields({ ...EMPTY_FIELDS, ...saved.fields });
      setUploads(
        saved.uploads.map((u) => ({ ...u, status: "done", progress: 1, preview: null, problem: null })),
      );
      setLang(saved.lang === "en" ? "en" : "es");
      setAttribution({ ...fresh, ...saved.attribution, ref: saved.attribution?.ref ?? fresh.ref });
      setSubmitted(saved.submitted ?? null);
      setLeadTracked(!!saved.leadTracked);
    } else {
      const id = newId();
      draftIdRef.current = id;
      setDraftId(id);
      setAttribution(fresh);
    }
    setCanShare(typeof navigator.share === "function");
    setReady(true);
    track("ViewContent", { content_name: "web_gratis" });
  }, []);
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
        .map((u) => ({ id: u.id, kind: u.kind, name: u.name, path: u.path as string })),
      lang,
      attribution,
      submitted,
      leadTracked,
      savedAt: Date.now(),
    };
    writeJSON(STORAGE_KEY, data);
  }, [ready, draftId, step, fields, uploads, lang, attribution, submitted, leadTracked]);

  useEffect(() => {
    document.documentElement.lang = lang === "es" ? "es-SV" : "en";
  }, [lang]);

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

  // "{Negocio} le recomendó este programa."
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

  function setField(key: FieldKey, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setServerError(null);
  }

  function apiFields() {
    return {
      businessName: fields.businessName.trim(),
      businessType: fields.businessType.trim(),
      city: fields.city.trim(),
      countryCode: fields.countryCode,
      whatsappLocal: fields.whatsappLocal,
      services: fields.services,
      differentiator: fields.differentiator,
      hours: fields.hours,
      instagram: fields.instagram,
      facebook: fields.facebook,
      style: fields.style,
      siteGoal: fields.siteGoal || null,
      referredBy: fields.referredBy,
    };
  }

  function saveDraft(target: Step) {
    return postWithRetry<{ referralCode: string; status: string }>("/api/web-gratis/draft", {
      draftId: draftIdRef.current,
      step: target,
      lang,
      website: honeypot,
      fields: apiFields(),
      attribution,
    });
  }

  function scrollToForm() {
    window.requestAnimationFrame(() => formColRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
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
          setErrors({ whatsappLocal: fields.countryCode === "503" ? "whatsapp" : "invalidWhatsappGeneric" });
          focusFirstError({ whatsappLocal: "whatsapp" });
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

    // Step 2 save is best-effort: everything is sent again on submit.
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
        setStep(1);
        setErrors({ whatsappLocal: "whatsapp" });
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
    try {
      await putFile(sign.data.signedUrl, file, (p) => patchUpload(id, { progress: Math.max(0.02, p) }));
      patchUpload(id, { status: "done", progress: 1, path: sign.data.path });
      filesRef.current.delete(id);
    } catch (error) {
      console.error("[WebGratis] upload failed", error);
      patchUpload(id, { status: "error", problem: "failed" });
    }
  }

  async function onPick(kind: UploadKind, e: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (picked.length === 0) return;

    let accepted: File[];
    if (kind === "logo") {
      uploads.filter((u) => u.kind === "logo").forEach((u) => removeUpload(u.id));
      accepted = picked.slice(0, 1);
    } else {
      const room = Math.max(0, MAX_PHOTOS - uploads.filter((u) => u.kind === "photo").length);
      accepted = picked.slice(0, room);
    }

    for (const file of accepted) {
      const id = newId();
      const type = inferType(file);
      const tile: Upload = {
        id,
        kind,
        name: file.name || (kind === "logo" ? "logo" : "foto"),
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
      setUploads((prev) => [...prev, tile]);
      const prepared = await prepareFile(file, kind, type);
      if (prepared.blob.size > MAX_UPLOAD_BYTES) {
        patchUpload(id, { status: "error", problem: "tooLarge" });
        continue;
      }
      const preview = prepared.type.startsWith("image/") ? URL.createObjectURL(prepared.blob) : null;
      patchUpload(id, { preview });
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
    setDraftId(id);
    setFields(EMPTY_FIELDS);
    setUploads([]);
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
  const chips = config.deliveryDays ? [t.chips[0], t.chipDays(config.deliveryDays), t.chips[2]] : [...t.chips];
  const doneNext = config.deliveryDays
    ? t.done.next.map((line, i) => (i === 1 ? t.nextDays(config.deliveryDays as number) : line))
    : t.done.next;
  const serverMessage = serverError ? t.errors[serverError] : null;

  return (
    <main className={styles.page}>
      <div className={styles.aurora} aria-hidden="true" />
      <div className={styles.grain} aria-hidden="true" />
      <div className={styles.vignette} aria-hidden="true" />

      <div className={styles.shell}>
        <header className={styles.top}>
          <Link href="/" className={styles.brand}>
            <span className={styles.flagMini} aria-hidden="true" />
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
            <p className={`${styles.kicker} ${styles.rise}`}>
              <span className={styles.flagStripe} aria-hidden="true" />
              {t.kicker}
            </p>
            <h1 className={`${styles.title} ${styles.rise} ${styles.d1}`}>
              {t.titleA}
              <span className={styles.titleB}>{t.titleB}</span>
            </h1>
            <p className={`${styles.lede} ${styles.rise} ${styles.d2}`}>{t.lede}</p>
            {referrerName ? <p className={styles.referred}>{t.referredBy(referrerName)}</p> : null}
            {config.highDemand ? <p className={styles.demand}>{t.highDemand}</p> : null}
            <ul className={`${styles.chips} ${styles.rise} ${styles.d3}`}>
              {chips.map((chip) => (
                <li key={chip}>{chip}</li>
              ))}
            </ul>
          </section>

          <section className={styles.formCol} ref={formColRef} aria-live="polite">
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
                <div className={styles.progress} aria-hidden="true">
                  {[1, 2, 3].map((n) => (
                    <span key={n} className={n <= step ? styles.segOn : styles.seg} />
                  ))}
                </div>

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
                        placeholder={t.fields.city.placeholder}
                        value={fields.city}
                        onChange={(v) => setField("city", v)}
                        error={err("city")}
                        maxLength={100}
                        autoComplete="address-level2"
                        enterKeyHint="next"
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
                            placeholder={t.fields.whatsapp.placeholder}
                            value={fields.whatsappLocal}
                            onChange={(e) => setField("whatsappLocal", e.target.value)}
                            aria-invalid={errors.whatsappLocal ? true : undefined}
                            aria-describedby={
                              errors.whatsappLocal ? "wg-whatsappLocal-hint wg-whatsappLocal-err" : "wg-whatsappLocal-hint"
                            }
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
                              accept="image/*,.pdf,application/pdf"
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
                                accept="image/*"
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
                      </div>

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
                {step === 1 ? <p className={styles.takes}>{t.takes}</p> : null}
                {step === 3 ? <p className={styles.fine}>{t.fine}</p> : null}
              </form>
            )}
          </section>

          <section className={styles.how} aria-labelledby="wg-how">
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
          </section>
        </div>

        <footer className={styles.footer}>
          <p>{t.footer.disclaimer}</p>
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
