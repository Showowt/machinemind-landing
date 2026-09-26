/**
 * Shared harness plumbing: env loading, a mock of Rewired's POST /api/web-gratis/send
 * (verifies the HMAC exactly like Rewired must), assertions, ZZ seed + cleanup.
 * Never talks to Meta or to the real Rewired: the site client is pointed at the mock.
 */
import http from "node:http";
import { createRequire } from "node:module";
import { randomInt } from "node:crypto";
import { fileURLToPath } from "node:url";

/** The machinemind-landing checkout this harness lives in (scripts/web-gratis-d5 → repo root). */
export const REPO = fileURLToPath(new URL("../../", import.meta.url)).replace(/\/$/, "");
const require = createRequire(`${REPO}/package.json`);
require("@next/env").loadEnvConfig(REPO, false);

export const BRIDGE_SECRET = "zz-test-bridge-secret-0123456789abcdef";
export const STRIPE_SECRET = "whsec_zzTestSecret0123456789abcdef";
export const ADMIN_TOKEN = "zz-test-admin-token-0123456789abcdef";

// Import site modules only after env is loaded.
export const site = {
  server: await import(`${REPO}/src/lib/web-gratis/server.ts`),
  bridgeAuth: await import(`${REPO}/src/lib/web-gratis/bridge-auth.ts`),
  rewired: await import(`${REPO}/src/lib/web-gratis/rewired.ts`),
  wa: await import(`${REPO}/src/lib/web-gratis/whatsapp.ts`),
  bridge: await import(`${REPO}/src/lib/web-gratis/bridge.ts`),
  payments: await import(`${REPO}/src/lib/web-gratis/payments.ts`),
  templates: await import(`${REPO}/src/lib/web-gratis/templates.ts`),
  config: await import(`${REPO}/src/lib/web-gratis/config.ts`),
  billing: await import(`${REPO}/src/lib/web-gratis/billing.ts`),
  notify: await import(`${REPO}/src/lib/web-gratis/notify.ts`),
  outbox: await import(`${REPO}/src/lib/web-gratis/outbox.ts`),
};

export const db = site.server.getDb();

// ─── Assertions ─────────────────────────────────────────────────────────────

export const results = { pass: 0, fail: 0, failures: [] as string[] };
export function check(name: string, cond: unknown, extra: unknown = ""): void {
  if (cond) {
    results.pass++;
    console.log(`  PASS  ${name}`);
  } else {
    results.fail++;
    const detail = typeof extra === "string" ? extra : JSON.stringify(extra);
    results.failures.push(`${name} ${detail}`);
    console.log(`  FAIL  ${name} ${detail}`);
  }
}
export function section(title: string): void {
  console.log(`\n── ${title}`);
}

// ─── Mock Rewired send endpoint ─────────────────────────────────────────────

export interface MockCall {
  to: string;
  mode: "template" | "freeform";
  template?: { name: string; bodyParams: string[]; buttonParam?: string };
  text?: string;
  idempotencyKey: string;
}
export type MockReply = { status: number; json?: unknown } | { destroy: true };

export interface MockRewired {
  url: string;
  calls: MockCall[];
  rejectedSignatures: number;
  plan: (call: MockCall) => MockReply;
  close: () => Promise<void>;
}

let wamidSeq = 0;
export const okReply = (): MockReply => ({ status: 200, json: { data: { wamid: `wamid.ZZMOCK${Date.now()}${++wamidSeq}` }, error: null, message: null } });
export const errReply = (code: string, transient: boolean, status = 200, extra: Record<string, unknown> = {}): MockReply => ({
  status,
  json: { data: null, error: { code, transient, ...extra }, message: code },
});

export async function startMockRewired(secret: string): Promise<MockRewired> {
  const mock: MockRewired = {
    url: "",
    calls: [],
    rejectedSignatures: 0,
    plan: okReply,
    close: async () => undefined,
  };
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c: Buffer) => (raw += c.toString("utf8")));
    req.on("end", () => {
      const send = (status: number, body: unknown) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(body));
      };
      if (req.method !== "POST" || req.url !== "/api/web-gratis/send") return send(404, { data: null, error: "not_found" });
      const check = site.bridgeAuth.verifySignedBody(req.headers["x-wg-signature"] as string | undefined ?? null, raw, secret);
      if (!check.ok) {
        mock.rejectedSignatures++;
        return send(401, { data: null, error: "unauthorized", message: check.reason });
      }
      const call = JSON.parse(raw) as MockCall;
      mock.calls.push(call);
      const reply = mock.plan(call);
      if ("destroy" in reply) {
        req.socket.destroy();
        return;
      }
      send(reply.status, reply.json ?? {});
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address() as { port: number };
  mock.url = `http://127.0.0.1:${addr.port}`;
  mock.close = () => new Promise((resolve) => server.close(() => resolve()));
  return mock;
}

// ─── Seeds ──────────────────────────────────────────────────────────────────

export const RUN = Math.random().toString(36).slice(2, 6).toUpperCase();
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const usedPhones = new Set<string>();

export function fakePhone(): string {
  for (;;) {
    const p = `+5037${String(randomInt(0, 10_000_000)).padStart(7, "0")}`;
    if (!usedPhones.has(p)) {
      usedPhones.add(p);
      return p;
    }
  }
}

export interface SeedRow {
  id: string;
  business_name: string;
  whatsapp: string;
  referral_code: string;
  [key: string]: unknown;
}

export const createdIds = new Set<string>();

export async function seed(label: string, fields: Record<string, unknown> = {}): Promise<SeedRow> {
  for (let attempt = 0; attempt < 5; attempt++) {
    let code = "";
    for (let i = 0; i < 6; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    const now = new Date().toISOString();
    const row = {
      id: crypto.randomUUID(),
      status: "nuevo",
      step: 3,
      business_name: `ZZ ${RUN} ${label}`,
      business_type: "Prueba WhatsApp",
      city: "San Salvador",
      whatsapp: fakePhone(),
      services: ["corte", "barba"],
      referral_code: code,
      submitted_at: now,
      terms_accepted_at: now,
      share_commitment_at: now,
      whatsapp_consent_at: now,
      ...fields,
    };
    const { data, error } = await db.from("web_gratis_signups").insert(row).select("*").single();
    if (error && error.code === "23505" && /referral_code/.test(error.message)) continue;
    if (error) throw new Error(`seed ${label}: ${error.message}`);
    createdIds.add(row.id);
    return data as SeedRow;
  }
  throw new Error("seed: code collisions");
}

export async function signup(id: string): Promise<Record<string, unknown>> {
  const { data, error } = await db.from("web_gratis_signups").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Record<string, unknown>;
}

export async function messagesOf(id: string): Promise<Record<string, unknown>[]> {
  const { data, error } = await db.from("web_gratis_messages").select("*").eq("signup_id", id).order("id");
  if (error) throw error;
  return (data ?? []) as Record<string, unknown>[];
}

/** The row of a template outside any renewal cycle (or of one cycle when `cycle` is given). */
export async function templateRow(id: string, template: string, cycle: string | null = null): Promise<Record<string, unknown> | null> {
  let q = db.from("web_gratis_messages").select("*").eq("signup_id", id).eq("template", template);
  q = cycle ? q.eq("cycle", cycle) : q.is("cycle", null);
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return (data as Record<string, unknown> | null) ?? null;
}

// ─── Cleanup ────────────────────────────────────────────────────────────────

export async function cleanup(): Promise<string> {
  const { data: rows, error } = await db.from("web_gratis_signups").select("id").like("business_name", "ZZ %").limit(5000);
  if (error) throw error;
  const ids = (rows ?? []).map((r: { id: string }) => r.id);
  let files = 0;
  // Website images published for ZZ sites (web-gratis-public/<slug>/…); the site rows cascade with the signups.
  let publicFiles = 0;
  for (let i = 0; i < ids.length; i += 200) {
    const { data: sites } = await db.from("web_gratis_sites").select("slug").in("signup_id", ids.slice(i, i + 200));
    for (const s of (sites ?? []) as { slug: string }[]) {
      const { data: objs } = await db.storage.from("web-gratis-public").list(s.slug, { limit: 100 });
      if (objs?.length) {
        await db.storage.from("web-gratis-public").remove(objs.map((o: { name: string }) => `${s.slug}/${o.name}`));
        publicFiles += objs.length;
      }
    }
  }
  for (const id of ids) {
    const { data: objs } = await db.storage.from("web-gratis").list(id, { limit: 100 });
    if (objs?.length) {
      await db.storage.from("web-gratis").remove(objs.map((o: { name: string }) => `${id}/${o.name}`));
      files += objs.length;
    }
  }
  const phones = [...usedPhones];
  if (phones.length) await db.from("web_gratis_messages").delete().in("phone", phones);
  await db.from("web_gratis_stripe_events").delete().like("id", "evt_ZZ%");
  for (let i = 0; i < ids.length; i += 200) {
    await db.from("web_gratis_signups").update({ referred_by_id: null }).in("id", ids.slice(i, i + 200));
  }
  for (let i = 0; i < ids.length; i += 200) {
    const { error: delError } = await db.from("web_gratis_signups").delete().in("id", ids.slice(i, i + 200));
    if (delError) throw delError;
  }
  const { count: left } = await db.from("web_gratis_signups").select("id", { count: "exact", head: true }).like("business_name", "ZZ %");
  const { count: msgs } = phones.length
    ? await db.from("web_gratis_messages").select("id", { count: "exact", head: true }).in("phone", phones)
    : { count: 0 };
  const { count: evts } = await db.from("web_gratis_stripe_events").select("id", { count: "exact", head: true }).like("id", "evt_ZZ%");
  const { count: credits } = await db.from("web_gratis_referral_credits").select("id", { count: "exact", head: true });
  const { count: ledgerLeft } = ids.length
    ? await db.from("web_gratis_payments").select("id", { count: "exact", head: true }).in("signup_id", ids.slice(0, 200))
    : { count: 0 };
  const { count: sitesLeft } = ids.length
    ? await db.from("web_gratis_sites").select("id", { count: "exact", head: true }).in("signup_id", ids.slice(0, 200))
    : { count: 0 };
  return `cleanup: signups deleted=${ids.length} files=${files} public site files=${publicFiles} | left: ZZ signups=${left} ZZ sites=${sitesLeft} ZZ-phone messages=${msgs} ZZ stripe events=${evts} ZZ payments=${ledgerLeft} referral credits(total)=${credits}`;
}
