/**
 * Rewired OS → site bridge: everything that happens on the funnel WhatsApp line
 * is reported here (POST /api/web-gratis/bridge, HMAC-signed, `type`
 * discriminator) and the site keeps the ledger.
 *
 *   inbound           claim a message (wamid UNIQUE → duplicates stop here),
 *                     return who the client is + recent history for the responder
 *   status            delivery receipts — progress only, never downgrade
 *   outbound          log a free-form reply the responder sent
 *   opt_out           STOP/BAJA → never message this phone again
 *   event             responder-detected intent (hot lead, wants changes, …)
 *   media_upload_url  signed upload for a photo / logo / document sent on WhatsApp
 *   media_attached    attach that upload to the client's request
 *
 * Handlers are transport-free (return status + envelope) with injectable time
 * and alerts, so they can be exercised without the HTTP layer.
 */
import { randomBytes } from "crypto";
import { z } from "zod";
import { documentPathsOf, signupCountry, type BoardCountry, type OpsSignup } from "./admin";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, payUrl, referralLink, SITE_ORIGIN, UPLOAD_TYPES_BY_KIND, WEB_GRATIS_PATH } from "./config";
import { enqueueSystem } from "./outbox";
import { getDb, listDraftFiles, loadSettings, SIGNUPS_TABLE, storage, type SignupStatus, type WebGratisSignup } from "./server";
import { TEMPLATE_LABEL, type TemplateName } from "./templates";
import { backoffSeconds, freshKey, MAX_ATTEMPTS, MESSAGES_TABLE, type MessageRow } from "./whatsapp";

// ─── Request schemas ────────────────────────────────────────────────────────

const e164 = z.string().regex(/^\+[1-9]\d{7,14}$/);
const wamid = z.string().trim().min(1).max(200);
const when = z.union([z.string().max(40), z.number()]).optional().nullable();

export const BRIDGE_EVENTS = [
  "handoff_hot",
  "handoff_help",
  "rung2_interest",
  "share_confirmed",
  "wants_changes",
  "decline",
  "call_request",
] as const;
export type BridgeEvent = (typeof BRIDGE_EVENTS)[number];

export const bridgeRequestSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("inbound"),
    phone: e164,
    wamid,
    msgType: z.enum(["text", "button", "interactive", "image", "document", "audio", "other"]),
    text: z.string().max(20_000).optional().nullable(),
    mediaPath: z.string().max(300).optional().nullable(),
    profileName: z.string().max(200).optional().nullable(),
    receivedAt: when,
  }),
  z.object({
    type: z.literal("status"),
    wamid,
    status: z.enum(["sent", "delivered", "read", "failed"]),
    errorCode: z.union([z.string().max(40), z.number()]).optional().nullable(),
    errorTitle: z.string().max(500).optional().nullable(),
    timestamp: when,
  }),
  z.object({
    type: z.literal("outbound"),
    phone: e164,
    wamid,
    text: z.string().max(20_000),
  }),
  z.object({
    type: z.literal("opt_out"),
    phone: e164,
    reason: z.string().max(500).optional().nullable(),
  }),
  z.object({
    type: z.literal("event"),
    phone: e164,
    event: z.enum(BRIDGE_EVENTS),
    note: z.string().max(2000).optional().nullable(),
  }),
  z.object({
    type: z.literal("media_upload_url"),
    phone: e164,
    contentType: z.string().max(100),
    kind: z.enum(["photo", "logo", "document"]),
    /** Bytes, when Rewired knows it (Meta's file_size); over MAX_UPLOAD_BYTES (25 MB) is refused before uploading. */
    size: z.number().int().positive().optional().nullable(),
  }),
  z.object({
    type: z.literal("media_attached"),
    phone: e164,
    path: z.string().max(300),
    kind: z.enum(["photo", "logo", "document"]),
    wamid: wamid.optional().nullable(),
  }),
]);

export type BridgeRequest = z.infer<typeof bridgeRequestSchema>;

export interface ClientContext {
  signupId: string;
  code: string;
  businessName: string;
  businessType: string;
  city: string;
  /** Market of the business (SV | CO | OTHER): the responder answers in its terms (e.g. "¿es del gobierno?"). */
  country: BoardCountry;
  status: SignupStatus;
  siteUrl: string | null;
  freeUntil: string | null;
  activated: boolean;
  optedOut: boolean;
  lang: "es" | "en";
  step: number;
  payUrl: string;
  referralLink: string;
  onboardingUrl: string;
  deliveryDays: number | null;
  lastTemplate: TemplateName | null;
}

export interface HistoryItem {
  direction: "inbound" | "outbound";
  body: string;
  created_at: string;
}

export interface BridgeDeps {
  now: () => Date;
  alert: (key: string, text: string) => Promise<boolean>;
}

export function defaultBridgeDeps(): BridgeDeps {
  return { now: () => new Date(), alert: (key, text) => enqueueSystem(key, text) };
}

export interface BridgeResult {
  status: number;
  body: { data: unknown; error: string | null; message: string | null };
}

const okResult = (data: unknown): BridgeResult => ({ status: 200, body: { data, error: null, message: null } });
const errResult = (status: number, error: string, message?: string): BridgeResult => ({
  status,
  body: { data: null, error, message: message ?? null },
});

// ─── Helpers ────────────────────────────────────────────────────────────────

const STATUS_RANK: Record<SignupStatus, number> = {
  activa: 0,
  compartida: 1,
  entregada: 2,
  en_construccion: 3,
  nuevo: 4,
  pausada: 5,
  borrador: 6,
  cancelada: 7,
  descartada: 8,
};

/** The one request a phone "is" when it has several (most advanced, then most recent). */
export function pickPrimary<T extends Pick<WebGratisSignup, "status" | "updated_at">>(rows: T[]): T | null {
  if (rows.length === 0) return null;
  return [...rows].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || Date.parse(b.updated_at) - Date.parse(a.updated_at))[0];
}

async function signupsFor(phone: string): Promise<OpsSignup[]> {
  const { data, error } = await getDb().from(SIGNUPS_TABLE).select("*").eq("whatsapp", phone).limit(20);
  if (error) throw error;
  return (data ?? []) as OpsSignup[];
}

/** Meta timestamps are unix seconds (as string or number); tolerate ISO too. */
export function parseWhen(value: string | number | null | undefined, fallback: Date): Date {
  if (value === null || value === undefined || value === "") return fallback;
  const n = typeof value === "number" ? value : /^\d{9,13}$/.test(value) ? Number(value) : NaN;
  const d = Number.isFinite(n) ? new Date(n < 1e12 ? n * 1000 : n) : new Date(String(value));
  return Number.isNaN(d.getTime()) ? fallback : d;
}

const MEDIA_LABEL: Record<string, string> = {
  image: "[imagen]",
  document: "[documento]",
  audio: "[audio]",
  interactive: "[respuesta]",
  button: "[botón]",
  other: "[mensaje]",
};

async function buildContext(primary: OpsSignup): Promise<ClientContext> {
  const db = getDb();
  const [settings, last] = await Promise.all([
    loadSettings().catch((error: unknown) => {
      console.error("[WebGratis:bridge] settings", error);
      return null;
    }),
    db
      .from(MESSAGES_TABLE)
      .select("template")
      .eq("signup_id", primary.id)
      .not("template", "is", null)
      .in("status", ["sent", "delivered", "read"])
      .order("sent_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return {
    signupId: primary.id,
    code: primary.referral_code,
    businessName: primary.business_name,
    businessType: primary.business_type,
    city: primary.city,
    country: signupCountry(primary),
    status: primary.status,
    siteUrl: primary.site_url,
    freeUntil: primary.free_until,
    activated: primary.status === "activa" || !!primary.activated_at,
    optedOut: !!primary.opted_out_at,
    lang: primary.lang,
    step: primary.step,
    payUrl: payUrl(primary.referral_code),
    referralLink: referralLink(primary.referral_code),
    onboardingUrl: `${SITE_ORIGIN}${WEB_GRATIS_PATH}`,
    deliveryDays: settings?.delivery_days ?? null,
    lastTemplate: ((last.data as { template: TemplateName } | null)?.template ?? null) as TemplateName | null,
  };
}

async function historyFor(phone: string): Promise<HistoryItem[]> {
  const { data, error } = await getDb()
    .from(MESSAGES_TABLE)
    .select("direction, body, msg_type, created_at, status")
    .eq("phone", phone)
    .not("status", "in", "(queued,skipped,failed)")
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) throw error;
  return ((data ?? []) as { direction: "inbound" | "outbound"; body: string | null; msg_type: string | null; created_at: string }[])
    .reverse()
    .map((m) => ({
      direction: m.direction,
      body: m.body ?? MEDIA_LABEL[m.msg_type ?? "other"] ?? "[mensaje]",
      created_at: m.created_at,
    }));
}

// ─── Handlers ───────────────────────────────────────────────────────────────

async function onInbound(req: Extract<BridgeRequest, { type: "inbound" }>, deps: BridgeDeps): Promise<BridgeResult> {
  const db = getDb();
  const receivedAt = parseWhen(req.receivedAt, deps.now());
  const signups = await signupsFor(req.phone);
  const primary = pickPrimary(signups);

  const { error } = await db.from(MESSAGES_TABLE).insert({
    signup_id: primary?.id ?? null,
    phone: req.phone,
    direction: "inbound",
    source: "inbound",
    msg_type: req.msgType,
    body: req.text ? req.text.slice(0, 4000) : null,
    media_path: req.mediaPath ?? null,
    wa_message_id: req.wamid,
    status: "received",
    received_at: receivedAt.toISOString(),
    meta: req.profileName ? { profileName: req.profileName } : {},
  });
  if (error) {
    if (error.code === "23505") return okResult({ duplicate: true });
    throw error;
  }

  if (signups.length) {
    const at = receivedAt.toISOString();
    const { error: stampError } = await db
      .from(SIGNUPS_TABLE)
      .update({ last_inbound_at: at })
      .eq("whatsapp", req.phone)
      .or(`last_inbound_at.is.null,last_inbound_at.lt.${at}`);
    if (stampError) console.error("[WebGratis:bridge] last_inbound_at stamp failed", req.phone, stampError);
    // They just wrote from this number, so it IS on WhatsApp: undo an earlier 131026 mark.
    if (signups.some((s) => s.no_whatsapp_at)) {
      const { error: waError } = await db
        .from(SIGNUPS_TABLE)
        .update({ no_whatsapp_at: null })
        .eq("whatsapp", req.phone)
        .not("no_whatsapp_at", "is", null);
      if (waError) console.error("[WebGratis:bridge] no_whatsapp_at reset failed", req.phone, waError);
    }
  }

  const [client, history] = await Promise.all([primary ? buildContext(primary) : Promise.resolve(null), historyFor(req.phone)]);
  return okResult({ duplicate: false, client, history });
}

const PROGRESS_FROM: Record<"sent" | "delivered" | "read" | "failed", string[]> = {
  sent: ["queued"],
  delivered: ["queued", "sent"],
  read: ["queued", "sent", "delivered"],
  failed: ["queued", "sent"],
};

/** Delivery failures Meta reports asynchronously that are worth one more try later. */
const RETRYABLE_DELIVERY = new Set(["131049", "130429", "131048", "131056", "131000", "131016"]);

async function onStatus(req: Extract<BridgeRequest, { type: "status" }>, deps: BridgeDeps): Promise<BridgeResult> {
  const db = getDb();
  const at = parseWhen(req.timestamp, deps.now());
  const atIso = at.toISOString();
  const { data: found, error: findError } = await db.from(MESSAGES_TABLE).select("*").eq("wa_message_id", req.wamid).maybeSingle();
  if (findError) throw findError;
  if (!found) return okResult({ updated: false, known: false });
  const row = found as MessageRow;
  const code = req.errorCode === null || req.errorCode === undefined ? null : String(req.errorCode);

  // A template that failed for a temporary reason gets queued again (fresh key, no wamid).
  if (req.status === "failed" && row.template && code && RETRYABLE_DELIVERY.has(code) && row.attempts < MAX_ATTEMPTS && PROGRESS_FROM.failed.includes(row.status)) {
    const wait = backoffSeconds(code, Math.max(1, row.attempts), null);
    const previous = Array.isArray(row.meta?.previous_wamids) ? (row.meta.previous_wamids as string[]) : [];
    const { data: requeued, error } = await db
      .from(MESSAGES_TABLE)
      .update({
        status: "queued",
        wa_message_id: null,
        idempotency_key: freshKey(row.id, `d${row.attempts + 1}`),
        next_attempt_at: new Date(at.getTime() + wait * 1000).toISOString(),
        locked_until: null,
        last_error_code: code,
        last_error: `Meta no lo entregó (${code}${req.errorTitle ? ` ${req.errorTitle}` : ""}); se reintenta.`,
        meta: { ...(row.meta ?? {}), previous_wamids: [...previous, req.wamid].slice(-10) },
      })
      .eq("id", row.id)
      .eq("wa_message_id", req.wamid)
      .in("status", PROGRESS_FROM.failed)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    return okResult({ updated: !!requeued, requeued: !!requeued });
  }

  const update: Record<string, unknown> = { status: req.status };
  if (req.status === "sent") update.sent_at = row.sent_at ?? atIso;
  if (req.status === "delivered") update.delivered_at = atIso;
  if (req.status === "read") {
    update.read_at = atIso;
    if (!row.delivered_at) update.delivered_at = atIso;
  }
  if (req.status === "failed") {
    update.failed_at = atIso;
    update.last_error_code = code;
    update.last_error = (req.errorTitle ?? code ?? "failed").slice(0, 1000);
  }
  const { data: moved, error } = await db
    .from(MESSAGES_TABLE)
    .update(update)
    .eq("id", row.id)
    .in("status", PROGRESS_FROM[req.status])
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!moved) return okResult({ updated: false, known: true });

  if (req.status === "failed") {
    const { data: signup } = row.signup_id
      ? await db.from(SIGNUPS_TABLE).select("id, business_name, whatsapp").eq("id", row.signup_id).maybeSingle()
      : { data: null };
    const who = signup ? `${signup.business_name as string} (${row.phone})` : row.phone;
    const what = row.template ? `«${TEMPLATE_LABEL[row.template]}»` : "la respuesta del asistente";
    if (code === "131026") {
      if (row.signup_id) {
        await db.from(SIGNUPS_TABLE).update({ no_whatsapp_at: atIso }).eq("whatsapp", row.phone).is("no_whatsapp_at", null);
      }
      await deps.alert(
        `wa-nowa:${row.phone}`,
        `📵 ${who} no tiene WhatsApp (o el número está mal): ${what} no se pudo entregar. Llámelo, o corrija el número en su tarjeta del tablero («Corregir WhatsApp»). Si nos escribe desde ese número, se reactiva solo.`,
      );
    } else if (row.template) {
      await deps.alert(
        `wa-dlv:${row.id}`,
        `❌ WhatsApp ${what} no se entregó a ${who}: ${code ?? "?"} ${req.errorTitle ?? ""}. Reintente desde el tablero.`.trim(),
      );
    } else {
      await deps.alert(
        `wa-dlv:${row.phone}:${atIso.slice(0, 13)}`,
        `❌ ${what} a ${who} no se entregó (${code ?? "?"} ${req.errorTitle ?? ""}). Revise el chat en Rewired.`.trim(),
      );
    }
  }
  return okResult({ updated: true, known: true });
}

async function onOutbound(req: Extract<BridgeRequest, { type: "outbound" }>, deps: BridgeDeps): Promise<BridgeResult> {
  const primary = pickPrimary(await signupsFor(req.phone));
  const { error } = await getDb()
    .from(MESSAGES_TABLE)
    .insert({
      signup_id: primary?.id ?? null,
      phone: req.phone,
      direction: "outbound",
      source: "responder",
      msg_type: "text",
      body: req.text.slice(0, 4000),
      wa_message_id: req.wamid,
      status: "sent",
      sent_at: deps.now().toISOString(),
    });
  if (error) {
    if (error.code === "23505") return okResult({ duplicate: true });
    throw error;
  }
  return okResult({ duplicate: false, signupId: primary?.id ?? null });
}

async function onOptOut(req: Extract<BridgeRequest, { type: "opt_out" }>, deps: BridgeDeps): Promise<BridgeResult> {
  const db = getDb();
  const now = deps.now();
  const reason = (req.reason ?? "pidió no recibir mensajes").slice(0, 200);
  const signups = await signupsFor(req.phone);
  const ids = signups.map((s) => s.id);
  if (ids.length) {
    const { error } = await db
      .from(SIGNUPS_TABLE)
      .update({ opted_out_at: now.toISOString(), opt_out_reason: reason })
      .in("id", ids)
      .is("opted_out_at", null);
    if (error) throw error;
    const { error: skipError } = await db
      .from(MESSAGES_TABLE)
      .update({ status: "skipped", locked_until: null, next_attempt_at: null, last_error_code: "opted_out", last_error: "Se dio de baja" })
      .in("signup_id", ids)
      .eq("status", "queued");
    if (skipError) console.error("[WebGratis:bridge] could not cancel queued sends after opt-out", req.phone, skipError);
  }
  const names = signups.map((s) => s.business_name).join(", ") || "sin solicitud";
  await deps.alert(
    `optout:${req.phone}:${now.toISOString().slice(0, 10)}`,
    `🚫 BAJA WhatsApp: ${names} (${req.phone}) pidió no recibir más mensajes${req.reason ? ` («${req.reason.slice(0, 120)}»)` : ""}. El sistema ya no le escribe.`,
  );
  return okResult({ signups: ids.length });
}

const EVENT_LABEL: Record<BridgeEvent, string> = {
  handoff_hot: "cliente caliente, quiere hablar",
  handoff_help: "necesita ayuda de una persona",
  rung2_interest: "quiere el asistente que agenda citas ($49)",
  share_confirmed: "confirmó que compartió su web",
  wants_changes: "quiere cambios en su web",
  decline: "dijo que no",
  call_request: "pide que lo llamen",
};

const HOT_EVENTS = new Set<BridgeEvent>(["handoff_hot", "rung2_interest", "call_request"]);

async function onEvent(req: Extract<BridgeRequest, { type: "event" }>, deps: BridgeDeps): Promise<BridgeResult> {
  const db = getDb();
  const now = deps.now();
  const nowIso = now.toISOString();
  const primary = pickPrimary(await signupsFor(req.phone));

  if (primary) {
    const update: Record<string, unknown> = { last_touch_at: nowIso, last_touch_kind: `wa_evt_${req.event}` };
    if (req.event === "handoff_hot" || req.event === "handoff_help" || req.event === "call_request") {
      update.handoff_at = nowIso;
      update.handoff_kind = req.event;
    }
    if (req.event === "wants_changes") update.wants_changes_at = nowIso;
    const { error } = await db.from(SIGNUPS_TABLE).update(update).eq("id", primary.id);
    if (error) throw error;

    const once: Partial<Record<BridgeEvent, string>> = {
      rung2_interest: "rung2_interest_at",
      share_confirmed: "share_confirmed_at",
      decline: "declined_at",
    };
    const column = once[req.event];
    if (column) {
      const { error: onceError } = await db.from(SIGNUPS_TABLE).update({ [column]: nowIso }).eq("id", primary.id).is(column, null);
      if (onceError) throw onceError;
    }
    if (req.event === "share_confirmed") {
      // They shared: an 'entregada' site becomes 'compartida' (both are "live, free month").
      const { error: moveError } = await db
        .from(SIGNUPS_TABLE)
        .update({ status: "compartida", shared_at: primary.shared_at ?? nowIso })
        .eq("id", primary.id)
        .eq("status", "entregada");
      if (moveError) throw moveError;
    }
  }

  if (HOT_EVENTS.has(req.event)) {
    const who = primary ? `${primary.business_name} (${req.phone}) [${primary.status}]` : `${req.phone} (sin solicitud)`;
    await deps.alert(
      `event:${req.event}:${primary?.id ?? req.phone}:${nowIso.slice(0, 13)}`,
      `🔥 LLAMAR AHORA — web gratis: ${who} — ${EVENT_LABEL[req.event]}${req.note ? `: «${req.note.slice(0, 300)}»` : ""}`,
    );
  }
  return okResult({ signupId: primary?.id ?? null });
}

// ─── Media sent on WhatsApp (photos, logos, documents) ─────────────────────

type MediaKind = "photo" | "logo" | "document";

/**
 * Per kind, the MIME types accepted from WhatsApp and the extension stored: the
 * same lists as the /web form (config UPLOAD_TYPES_BY_KIND, all on the bucket's
 * allow-list). A document may also be a picture (a photo of the menu).
 */
const WA_MEDIA_TYPES: Record<MediaKind, Record<string, string>> = UPLOAD_TYPES_BY_KIND;

/** Per-request caps for files sent on WhatsApp (DB checks: photos 12, logos 4; documents 20 here). */
const WA_MAX: Record<MediaKind, number> = { photo: 12, logo: 4, document: 20 };
/** Hard cap on objects in one request's folder (form uploads + everything sent on WhatsApp). */
const MAX_WA_OBJECTS = 64;

const MEDIA_PATH_RE =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/(photo|logo|document)-wa-\d{10,14}-[0-9a-f]{6}\.(jpg|png|webp|heic|heif|gif|svg|psd|eps|ai|pdf|doc|docx|xls|xlsx|ppt|pptx|odt|ods|txt|csv)$/;

/**
 * The kind a file is stored as. A file that can't be what was asked (a PDF or
 * spreadsheet sent as a "photo" by an older responder) is kept as a document
 * instead of being refused. Null when the type isn't accepted at all.
 */
function storedKind(asked: MediaKind, mime: string): { kind: MediaKind; ext: string } | null {
  const own = WA_MEDIA_TYPES[asked][mime];
  if (own) return { kind: asked, ext: own };
  const asDocument = WA_MEDIA_TYPES.document[mime];
  return asDocument ? { kind: "document", ext: asDocument } : null;
}

function currentCount(s: OpsSignup, kind: MediaKind): number {
  if (kind === "photo") return s.photo_paths.length;
  if (kind === "logo") return s.logo_paths.length;
  return documentPathsOf(s).length;
}

/** Postgres text[] literal for an equality filter ({"a","b"}), quoting every element. */
function pgTextArray(items: string[]): string {
  return `{${items.map((p) => `"${p.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",")}}`;
}

/**
 * Append a WhatsApp document to document_paths — same answers as the
 * web_gratis_attach_media RPC does for photos/logos ('attached' | 'duplicate' |
 * 'full' | 'not_found'). Compare-and-swap on the array itself, so two documents
 * arriving at once can't overwrite each other.
 */
async function attachDocument(signupId: string, path: string): Promise<"attached" | "duplicate" | "full" | "not_found"> {
  const db = getDb();
  for (let attempt = 0; attempt < 6; attempt++) {
    const { data, error } = await db.from(SIGNUPS_TABLE).select("document_paths").eq("id", signupId).maybeSingle();
    if (error) throw error;
    if (!data) return "not_found";
    const current = documentPathsOf(data as { document_paths: string[] | null });
    if (current.includes(path)) return "duplicate";
    if (current.length >= WA_MAX.document) return "full";
    const { data: moved, error: updateError } = await db
      .from(SIGNUPS_TABLE)
      .update({ document_paths: [...current, path] })
      .eq("id", signupId)
      .filter("document_paths", "eq", pgTextArray(current))
      .select("id")
      .maybeSingle();
    if (updateError) throw updateError;
    if (moved) return "attached";
  }
  throw new Error(`[WebGratis:bridge] document_paths kept changing for ${signupId}; could not attach ${path}`);
}

async function onMediaUploadUrl(req: Extract<BridgeRequest, { type: "media_upload_url" }>): Promise<BridgeResult> {
  const primary = pickPrimary((await signupsFor(req.phone)).filter((s) => !["descartada", "cancelada"].includes(s.status)));
  if (!primary) return errResult(404, "unknown_client");
  const mime = req.contentType.toLowerCase().split(";")[0].trim();
  const stored = storedKind(req.kind, mime);
  if (!stored) return errResult(415, "unsupported_type");
  if (req.size && req.size > MAX_UPLOAD_BYTES) return errResult(413, "too_large", `El archivo pesa más de ${MAX_UPLOAD_MB} MB.`);
  if (currentCount(primary, stored.kind) >= WA_MAX[stored.kind]) return errResult(409, "too_many_files", "Ya tiene el máximo de archivos.");
  if ((await listDraftFiles(primary.id)).length >= MAX_WA_OBJECTS) return errResult(409, "too_many_files");
  const path = `${primary.id}/${stored.kind}-wa-${Date.now()}-${randomBytes(3).toString("hex")}.${stored.ext}`;
  const { data, error } = await storage().createSignedUploadUrl(path);
  if (error || !data) throw error ?? new Error("no signed url");
  return okResult({ path, signedUrl: data.signedUrl, token: data.token, kind: stored.kind });
}

async function onMediaAttached(req: Extract<BridgeRequest, { type: "media_attached" }>, deps: BridgeDeps): Promise<BridgeResult> {
  const db = getDb();
  const match = MEDIA_PATH_RE.exec(req.path);
  // The path (minted by media_upload_url) says what the file is; a photo/logo request may have been stored as a document.
  const pathKind = match?.[2] as MediaKind | undefined;
  if (!match || !pathKind || (pathKind !== req.kind && pathKind !== "document")) return errResult(400, "invalid", "path");
  const signupId = match[1];
  const owner = (await signupsFor(req.phone)).find((s) => s.id === signupId);
  if (!owner) return errResult(404, "unknown_client");

  const name = req.path.slice(signupId.length + 1);
  const { data: objects, error: listError } = await storage().list(signupId, { search: name, limit: 5 });
  if (listError) throw listError;
  if (!(objects ?? []).some((o) => o.name === name)) return errResult(404, "not_found", "El archivo no está en el almacenamiento.");

  let result: string;
  if (pathKind === "document") {
    result = await attachDocument(signupId, req.path);
  } else {
    const { data: attached, error } = await db.rpc("web_gratis_attach_media", { p_signup_id: signupId, p_kind: pathKind, p_path: req.path });
    if (error) throw error;
    result = attached as string;
  }

  // Point the WhatsApp message in the ledger at the stored file (the given
  // wamid, else the newest unlinked photo/document from this phone).
  let find = db
    .from(MESSAGES_TABLE)
    .select("id")
    .eq("phone", req.phone)
    .eq("direction", "inbound")
    .is("media_path", null);
  find = req.wamid
    ? find.eq("wa_message_id", req.wamid)
    : find.in("msg_type", ["image", "document"]).gte("created_at", new Date(deps.now().getTime() - 30 * 60 * 1000).toISOString());
  const { data: target, error: findError } = await find.order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (findError) console.error("[WebGratis:bridge] media ledger lookup failed", req.path, findError);
  if (target) {
    const { error: logError } = await db.from(MESSAGES_TABLE).update({ media_path: req.path }).eq("id", (target as { id: number }).id);
    if (logError) console.error("[WebGratis:bridge] media ledger link failed", req.path, logError);
  }

  return okResult({ attached: result, kind: pathKind });
}

// ─── Entry ──────────────────────────────────────────────────────────────────

export async function handleBridge(req: BridgeRequest, deps: BridgeDeps): Promise<BridgeResult> {
  switch (req.type) {
    case "inbound":
      return onInbound(req, deps);
    case "status":
      return onStatus(req, deps);
    case "outbound":
      return onOutbound(req, deps);
    case "opt_out":
      return onOptOut(req, deps);
    case "event":
      return onEvent(req, deps);
    case "media_upload_url":
      return onMediaUploadUrl(req);
    case "media_attached":
      return onMediaAttached(req, deps);
  }
}
