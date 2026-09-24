/**
 * HTTP tests against the built site (`next start`) with test secrets. Notification
 * credentials are blanked in the child env, REWIRED_BASE_URL points at the mock,
 * and only non-alerting paths are exercised over HTTP (alerting paths are covered
 * in-process with captured alerts), so nothing reaches the real outbox / Telegram.
 */
import { spawn, type ChildProcess } from "node:child_process";
import {
  ADMIN_TOKEN,
  BRIDGE_SECRET,
  REPO,
  RUN,
  STRIPE_SECRET,
  check,
  db,
  fakePhone,
  okReply,
  section,
  seed,
  signup,
  site,
  startMockRewired,
} from "./lib.mts";

const PORT = 3127;
const BASE = `http://127.0.0.1:${PORT}`;

async function waitUp(child: ChildProcess): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`next start exited ${child.exitCode}`);
    try {
      const r = await fetch(`${BASE}/api/web-gratis/config`, { signal: AbortSignal.timeout(2000) });
      if (r.status > 0) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("next start did not come up");
}

const signed = (raw: string, secret = BRIDGE_SECRET, t?: number) => site.bridgeAuth.signBridgeBody(secret, raw, t);
async function bridge(raw: string, header: string | null): Promise<{ status: number; json: Record<string, unknown> | null }> {
  const res = await fetch(`${BASE}/api/web-gratis/bridge`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(header ? { "x-wg-signature": header } : {}) },
    body: raw,
  });
  return { status: res.status, json: (await res.json().catch(() => null)) as Record<string, unknown> | null };
}
async function stripe(raw: string, header: string | null): Promise<{ status: number; json: Record<string, unknown> | null }> {
  const res = await fetch(`${BASE}/api/web-gratis/stripe-webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(header ? { "stripe-signature": header } : {}) },
    body: raw,
  });
  return { status: res.status, json: (await res.json().catch(() => null)) as Record<string, unknown> | null };
}
const stripeSig = (raw: string, secret = STRIPE_SECRET, t = Math.floor(Date.now() / 1000)) =>
  `t=${t},v1=${site.bridgeAuth.hmacHex(secret, `${t}.${raw}`)}`;
const get = (path: string) => fetch(`${BASE}${path}`, { redirect: "manual" });

export async function runHttp(): Promise<void> {
  const mock = await startMockRewired(BRIDGE_SECRET);
  mock.plan = okReply;
  const child = spawn(`${REPO}/node_modules/.bin/next`, ["start", "-p", String(PORT), "-H", "127.0.0.1"], {
    cwd: REPO,
    env: {
      ...process.env,
      NODE_ENV: "production",
      WEB_GRATIS_BRIDGE_SECRET: BRIDGE_SECRET,
      STRIPE_WEBHOOK_SECRET_WEBGRATIS: STRIPE_SECRET,
      REWIRED_BASE_URL: mock.url,
      WEB_GRATIS_ADMIN_TOKEN: ADMIN_TOKEN,
      CRON_SECRET: "",
      TELEGRAM_BOT_TOKEN: "",
      TELEGRAM_CHAT_IDS: "",
      TELEGRAM_CHAT_ID: "",
      RESEND_API_KEY: "",
      META_CAPI_TOKEN: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverLog = "";
  child.stdout?.on("data", (c: Buffer) => (serverLog += c.toString()));
  child.stderr?.on("data", (c: Buffer) => (serverLog += c.toString()));

  try {
    await waitUp(child);

    const p1 = await seed("H pagar", { status: "entregada", delivered_at: new Date(Date.now() - 20 * 86_400_000).toISOString(), site_url: "https://zz-site.example.com", free_until: site.server.svDate(new Date(), 5) });
    const p2 = await seed("H sin web", { status: "en_construccion" });
    const p3 = await seed("H activa", { status: "activa", activated_at: new Date().toISOString(), paid_via: "stripe" });
    const p4 = await seed("H borrador", { status: "borrador", submitted_at: null, terms_accepted_at: null, share_commitment_at: null, step: 1 });
    const p5 = await seed("H pausar", { status: "entregada", delivered_at: new Date(Date.now() - 34 * 86_400_000).toISOString(), free_until: site.server.svDate(new Date(), -4) });
    const p6 = await seed("H pausada", { status: "pausada", delivered_at: new Date(Date.now() - 40 * 86_400_000).toISOString(), free_until: site.server.svDate(new Date(), -8), paused_at: new Date(Date.now() - 5 * 86_400_000).toISOString() });
    const p7 = await seed("H sin wa", { status: "nuevo", no_whatsapp_at: new Date().toISOString() });
    const p8 = await seed("H paypal", { status: "activa", activated_at: new Date(Date.now() - 28 * 86_400_000).toISOString(), paid_via: "paypal", delivered_at: new Date(Date.now() - 60 * 86_400_000).toISOString(), paid_through: site.server.svDate(new Date(), 2) });
    const p9 = await seed("H pagó en construcción", { status: "en_construccion", activated_at: new Date().toISOString(), paid_via: "stripe" });

    // ──────────────────────────────────────────────────────────────────
    section("HTTP bridge: signature gate + claim");
    {
      const inbound = JSON.stringify({ type: "inbound", phone: p1.whatsapp, wamid: `wamid.ZZHTTP${Date.now()}`, msgType: "text", text: "Hola desde HTTP", receivedAt: String(Math.floor(Date.now() / 1000)) });
      let r = await bridge(inbound, null);
      check("no signature → 401 unauthorized", r.status === 401 && r.json?.error === "unauthorized", r);
      r = await bridge(inbound, signed(inbound, "some-other-secret-some-other-secret"));
      check("wrong secret → 401 mismatch", r.status === 401 && r.json?.message === "mismatch", r);
      r = await bridge(inbound, signed(inbound, BRIDGE_SECRET, Math.floor(Date.now() / 1000) - 400));
      check("timestamp 400 s old → 401 stale", r.status === 401 && r.json?.message === "stale", r);
      r = await bridge(inbound + " ", signed(inbound));
      check("body altered after signing → 401", r.status === 401, r);
      r = await bridge("{not json", signed("{not json"));
      check("signed but malformed JSON → 400", r.status === 400 && r.json?.error === "invalid", r);
      const weird = JSON.stringify({ type: "teleport", phone: p1.whatsapp });
      r = await bridge(weird, signed(weird));
      check("signed but unknown type → 400", r.status === 400, r);
      const badPhone = JSON.stringify({ type: "opt_out", phone: "50370000000" });
      r = await bridge(badPhone, signed(badPhone));
      check("non-E.164 phone → 400 (zod)", r.status === 400, r);
      r = await bridge(inbound, signed(inbound));
      const data = r.json?.data as { duplicate: boolean; client: { signupId: string; code: string } | null } | undefined;
      check("valid inbound → 200 {data:{duplicate:false, client}}", r.status === 200 && data?.duplicate === false && data?.client?.signupId === p1.id && r.json?.error === null, r);
      r = await bridge(inbound, signed(inbound));
      check("same wamid, fresh signature → duplicate:true", r.status === 200 && (r.json?.data as { duplicate: boolean }).duplicate === true, r);
      const outId = `wamid.ZZHTTPOUT${Date.now()}`;
      const outbound = JSON.stringify({ type: "outbound", phone: p1.whatsapp, wamid: outId, text: "Con gusto 🙌" });
      r = await bridge(outbound, signed(outbound));
      check("outbound logged → 200", r.status === 200, r);
      const status = JSON.stringify({ type: "status", wamid: outId, status: "read", timestamp: String(Math.floor(Date.now() / 1000)) });
      r = await bridge(status, signed(status));
      check("status read → updated", r.status === 200 && (r.json?.data as { updated: boolean }).updated === true, r);
      const share = JSON.stringify({ type: "event", phone: p1.whatsapp, event: "share_confirmed" });
      r = await bridge(share, signed(share));
      check("event share_confirmed over HTTP → compartida", r.status === 200 && (await signup(p1.id)).status === "compartida", r);
      const big = JSON.stringify({ type: "outbound", phone: p1.whatsapp, wamid: "wamid.big", text: "x".repeat(70_000) });
      r = await bridge(big, signed(big));
      check("> 64 KB body → 413", r.status === 413, r.status);
    }

    // ──────────────────────────────────────────────────────────────────
    section("HTTP Stripe webhook: manual signature verification + idempotency");
    {
      const ev = JSON.stringify({ id: `evt_ZZ${Date.now()}http`, type: "customer.created", data: { object: { id: "cus_ZZhttp" } } });
      let r = await stripe(ev, null);
      check("no Stripe-Signature → 400", r.status === 400 && r.json?.error === "unauthorized", r);
      r = await stripe(ev, stripeSig(ev, "whsec_wrongwrongwrong"));
      check("wrong secret → 400", r.status === 400, r);
      r = await stripe(ev, stripeSig(ev, STRIPE_SECRET, Math.floor(Date.now() / 1000) - 600));
      check("10-minute-old signature → 400 stale", r.status === 400 && r.json?.message === "stale", r);
      r = await stripe(ev, stripeSig(ev));
      check("valid → 200 ignored (unhandled type)", r.status === 200 && (r.json?.data as { handled: string }).handled === "ignored", r);
      r = await stripe(ev, stripeSig(ev));
      check("redelivery → 200 duplicate", r.status === 200 && (r.json?.data as { duplicate: boolean }).duplicate === true, r);
      r = await stripe("{bad", stripeSig("{bad"));
      check("signed garbage → 400", r.status === 400, r);
    }

    // ──────────────────────────────────────────────────────────────────
    section("HTTP pages: /pagar, /pagar/gracias, /s, /citas, /web");
    {
      let res = await get(`/pagar/${p1.referral_code}`);
      let html = await res.text();
      check("/pagar/<code> 200 with business name", res.status === 200 && html.includes(p1.business_name), res.status);
      check("/pagar shows $20/mes + sin contrato", html.includes("20") && html.includes("Sin contrato") && html.includes("al mes"));
      const settings = await site.server.loadSettings();
      if (settings.pay_link) {
        check("pay link set → card button carries client_reference_id", html.includes(`client_reference_id=${p1.id}`));
      } else {
        check("pay link not set yet → no card button, 'muy pronto' note", !html.includes("client_reference_id") && html.includes("muy pronto"));
      }
      check("PayPal button → settings PayPal link", html.includes(settings.paypal_link ?? "paypal.me/MachineMind/20USD"));
      check("receipt button opens the funnel line wa.me/17862570284 with the code", html.includes("wa.me/17862570284?text=") && html.includes(encodeURIComponent(`código ${p1.referral_code}`)));
      check("noindex", html.includes("noindex"));
      res = await get(`/pagar/${p1.referral_code}?lang=en`);
      html = await res.text();
      check("/pagar ?lang=en → English", res.status === 200 && html.includes("Pay with PayPal") && html.includes("Keep your website"));
      res = await get(`/pagar/${p1.referral_code.toLowerCase()}`);
      check("lowercase code still resolves", res.status === 200 && (await res.text()).includes(p1.business_name));
      res = await get(`/pagar/${p3.referral_code}`);
      check("activa → 'Su web ya está activa ✓'", res.status === 200 && (await res.text()).includes("Su web ya está activa"));
      res = await get(`/pagar/${p4.referral_code}`);
      check("borrador → finish-your-request page", res.status === 200 && (await res.text()).includes("Primero terminemos su solicitud"));
      res = await get(`/pagar/${p2.referral_code}`);
      html = await res.text();
      check("still being built → 'no tiene que pagar nada todavía', NO pay buttons", res.status === 200 && html.includes("aún está en construcción") && html.includes("No tiene que pagar nada todavía") && !html.includes("Pagar con PayPal") && !html.includes("client_reference_id"));
      res = await get(`/pagar/${p9.referral_code}`);
      html = await res.text();
      check("paid while being built → 'Pago recibido ✓', no pay buttons", res.status === 200 && html.includes("Pago recibido") && !html.includes("Pagar con PayPal"));
      res = await get(`/pagar/${p6.referral_code}`);
      html = await res.text();
      check("paused → 'Reactive su web' copy with the pay buttons", res.status === 200 && html.includes("Reactive su web") && html.includes("está en pausa") && html.includes("Pagar con PayPal"));
      res = await get(`/pagar/QQQQQQ`);
      html = await res.text();
      check(
        `unknown code → friendly not-found page (noindex; HTTP ${res.status} — root loading.tsx streams, so notFound() can't set 404)`,
        html.includes("No encontramos ese enlace") && html.includes("noindex") && !html.includes("Pagar con PayPal"),
        res.status,
      );
      res = await get(`/pagar/gracias`);
      html = await res.text();
      check("/pagar/gracias 200, promises nothing that isn't automatic", res.status === 200 && html.includes("Gracias") && !html.includes("En unos minutos le confirmamos"));

      res = await get(`/s/${p1.referral_code}`);
      check("/s/<code> with site → 302 to the site", res.status === 302 && res.headers.get("location") === "https://zz-site.example.com/", `${res.status} ${res.headers.get("location")}`);
      res = await get(`/s/${p2.referral_code}`);
      check("/s/<code> without site → 302 to /pronto", res.status === 302 && (res.headers.get("location") ?? "").endsWith(`/s/${p2.referral_code}/pronto`), res.headers.get("location"));
      res = await get(`/s/${p2.referral_code}/pronto`);
      html = await res.text();
      check("/pronto page 200 names the business", res.status === 200 && html.includes("Su web está en camino") && html.includes(p2.business_name));
      res = await get(`/citas/${p1.referral_code}`);
      const loc = res.headers.get("location") ?? "";
      const demoLink = settings.demo_link;
      if (demoLink) check("/citas → 302 to configured demo link", res.status === 302 && loc === demoLink, loc);
      else
        check(
          "/citas/<code> → 302 wa.me/17862570284 'Quiero ver la demo de citas para <negocio>'",
          res.status === 302 && loc.startsWith("https://wa.me/17862570284?text=") && decodeURIComponent(loc.split("text=")[1] ?? "") === `Quiero ver la demo de citas para ${p1.business_name}`,
          loc,
        );
      res = await get(`/citas/QQQQQQ`);
      check("/citas unknown → 302 generic demo request", res.status === 302 && decodeURIComponent((res.headers.get("location") ?? "").split("text=")[1] ?? "") === "Quiero ver la demo de citas");

      res = await get(`/web`);
      html = await res.text();
      check("/web SSR links to the funnel line (17862570284), not Phil's personal number", res.status === 200 && html.includes("wa.me/17862570284") && !html.includes("19544451638"));
    }

    // ──────────────────────────────────────────────────────────────────
    section("HTTP draft: step-1 consent + referral text");
    {
      const draftId = crypto.randomUUID();
      const phone = fakePhone();
      const fields = { businessName: `ZZ ${RUN} Consentimiento`, businessType: "Prueba consentimiento", city: "San Salvador", countryCode: "503", whatsappLocal: phone.slice(4) };
      let res = await fetch(`${BASE}/api/web-gratis/draft`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ draftId, step: 1, lang: "es", fields }) });
      check("draft step 1 → 200", res.status === 200, res.status);
      let row = await signup(draftId);
      check("first step-1 insert records whatsapp_consent_at + version v1-step1-2026-09-24", !!row.whatsapp_consent_at && row.whatsapp_consent_version === "v1-step1-2026-09-24", { at: row.whatsapp_consent_at, v: row.whatsapp_consent_version });
      const firstConsent = row.whatsapp_consent_at;
      res = await fetch(`${BASE}/api/web-gratis/draft`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ draftId, step: 2, lang: "es", fields: { ...fields, services: "corte, barba", referredBy: "Barbería Amiga (código K7M2QX)" } }),
      });
      row = await signup(draftId);
      check("step 2 stores '¿Quién le recomendó?' text", res.status === 200 && row.referred_by_text === "Barbería Amiga (código K7M2QX)", row.referred_by_text);
      check("consent timestamp not overwritten by later saves", row.whatsapp_consent_at === firstConsent);
      const long = await fetch(`${BASE}/api/web-gratis/draft`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ draftId, step: 2, lang: "es", fields: { ...fields, services: "corte", referredBy: "x".repeat(121) } }),
      });
      check("referredBy > 120 chars → 400", long.status === 400, long.status);
      await db.from("web_gratis_signups").delete().eq("id", draftId);
    }

    // ──────────────────────────────────────────────────────────────────
    section("HTTP admin: token gate, manual send, list, settings, pause, cron");
    {
      let res = await fetch(`${BASE}/api/web-gratis/admin/whatsapp`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ signupId: p1.id, template: "cqv_web_ready" }) });
      check("manual send without token → 401", res.status === 401, res.status);
      const auth = { "content-type": "application/json", authorization: `Bearer ${ADMIN_TOKEN}` };
      const callsBefore = mock.calls.length;
      res = await fetch(`${BASE}/api/web-gratis/admin/whatsapp`, { method: "POST", headers: auth, body: JSON.stringify({ signupId: p1.id, template: "cqv_web_ready" }) });
      let json = (await res.json()) as { data: { status: string } | null; error: string | null };
      const hour = site.templates.svClock(new Date()).hour;
      if (hour >= 7 && hour <= 20) {
        check("manual send in window → 200 sent through the (mock) Rewired bridge", res.status === 200 && json.data?.status === "sent" && mock.calls.length === callsBefore + 1 && mock.calls.at(-1)?.template?.name === "cqv_web_ready", json);
      } else {
        check(`manual send at ${hour}:00 SV → 409 window_closed, nothing sent`, res.status === 409 && json.error === "window_closed" && mock.calls.length === callsBefore, json);
      }
      res = await fetch(`${BASE}/api/web-gratis/admin/whatsapp`, { method: "POST", headers: auth, body: JSON.stringify({ signupId: p1.id, template: "cqv_web_bogus" }) });
      check("unknown template → 400", res.status === 400, res.status);

      res = await fetch(`${BASE}/api/web-gratis/admin/signups?view=todas&q=${encodeURIComponent(`ZZ ${RUN} H`)}`, { headers: auth });
      const list = (await res.json()) as { data: { rows: { id: string }[]; messages: Record<string, { direction: string }[]>; credits: unknown[]; settings: Record<string, unknown>; stats: Record<string, unknown> } | null };
      check("board list 200 with messages/credits/new settings/stats", res.status === 200 && !!list.data && Array.isArray(list.data.credits) && "paypal_link" in list.data.settings && "demo_link" in list.data.settings && "wa_queued" in list.data.stats, list.data && Object.keys(list.data));
      check("board list carries p1's WhatsApp log (inbound + outbound)", (list.data?.messages[p1.id] ?? []).some((m) => m.direction === "inbound") && (list.data?.messages[p1.id] ?? []).some((m) => m.direction === "outbound"), list.data?.messages[p1.id]?.length);

      const current = await site.server.loadSettings();
      res = await fetch(`${BASE}/api/web-gratis/admin/settings`, {
        method: "PUT",
        headers: auth,
        body: JSON.stringify({ deliveryDays: current.delivery_days, highDemand: current.high_demand, payLink: current.pay_link, demoLink: current.demo_link, paypalLink: current.paypal_link }),
      });
      json = (await res.json()) as { data: Record<string, unknown> | null; error: string | null } as never;
      const after = await site.server.loadSettings();
      check("settings PUT (same values) accepts demoLink/paypalLink and changes nothing", res.status === 200 && JSON.stringify(after) === JSON.stringify(current), { status: res.status, after });
      res = await fetch(`${BASE}/api/web-gratis/admin/settings`, { method: "PUT", headers: auth, body: JSON.stringify({ deliveryDays: null, highDemand: false, payLink: null, demoLink: "http://insecure.example" }) });
      check("non-https demo link rejected (400) before touching the DB", res.status === 400 && JSON.stringify(await site.server.loadSettings()) === JSON.stringify(current));

      res = await fetch(`${BASE}/api/web-gratis/admin/signups/${p5.id}`, { method: "PATCH", headers: auth, body: JSON.stringify({ status: "pausada" }) });
      const s5 = await signup(p5.id);
      check("board 'Pausar' stamps paused_at + recontact_after (+60 d)", res.status === 200 && s5.status === "pausada" && !!s5.paused_at && s5.recontact_after === site.server.svDate(new Date(), 60), { st: res.status, s5: [s5.status, s5.paused_at, s5.recontact_after] });

      res = await fetch(`${BASE}/api/web-gratis/admin/signups/${p5.id}`, { method: "PATCH", headers: auth, body: JSON.stringify({ status: "entregada" }) });
      const s5b = await signup(p5.id);
      check("'Reabrir' a paused unpaid site → live again, paused_at cleared, 7 more free days", res.status === 200 && s5b.status === "entregada" && s5b.paused_at === null && s5b.free_until === site.server.svDate(new Date(), 7), [s5b.status, s5b.paused_at, s5b.free_until]);

      const corrected = fakePhone();
      const local = corrected.slice(4);
      res = await fetch(`${BASE}/api/web-gratis/admin/signups/${p7.id}`, { method: "PATCH", headers: auth, body: JSON.stringify({ whatsapp: `${local.slice(0, 4)}-${local.slice(4)}` }) });
      let s7 = await signup(p7.id);
      check("'Corregir WhatsApp' with a local SV number → +503…, 'no WhatsApp' mark cleared", res.status === 200 && s7.whatsapp === corrected && s7.no_whatsapp_at === null, [res.status, s7.whatsapp, s7.no_whatsapp_at]);
      res = await fetch(`${BASE}/api/web-gratis/admin/signups/${p7.id}`, { method: "PATCH", headers: auth, body: JSON.stringify({ whatsapp: "12345" }) });
      check("invalid number → 400 invalid_whatsapp", res.status === 400 && ((await res.json()) as { error: string }).error === "invalid_whatsapp");

      res = await fetch(`${BASE}/api/web-gratis/admin/signups/${p7.id}`, { method: "PATCH", headers: auth, body: JSON.stringify({ referredByCode: p1.referral_code.toLowerCase() }) });
      s7 = await signup(p7.id);
      check("free-text referral resolved by code → referred_by_id set", res.status === 200 && s7.referred_by_id === p1.id, [res.status, s7.referred_by_id]);
      res = await fetch(`${BASE}/api/web-gratis/admin/signups/${p7.id}`, { method: "PATCH", headers: auth, body: JSON.stringify({ referredByCode: "QQQQQQ" }) });
      check("unknown referral code → 404", res.status === 404);
      res = await fetch(`${BASE}/api/web-gratis/admin/signups/${p7.id}`, { method: "PATCH", headers: auth, body: JSON.stringify({ referredByCode: p7.referral_code }) });
      check("own code → 409", res.status === 409);

      res = await fetch(`${BASE}/api/web-gratis/admin/signups/${p8.id}`, { method: "PATCH", headers: auth, body: JSON.stringify({ renew: true }) });
      const s8 = await signup(p8.id);
      check("PayPal payer 'Pagó otro mes' → paid_through +30 days", res.status === 200 && s8.paid_through === site.wa.svDateOf(site.server.svDate(new Date(), 2), 30), [res.status, s8.paid_through]);
      res = await fetch(`${BASE}/api/web-gratis/admin/signups/${p1.id}`, { method: "PATCH", headers: auth, body: JSON.stringify({ renew: true }) });
      check("'Pagó otro mes' on a client that isn't active → 409", res.status === 409);

      const { data: credit } = await db.from("web_gratis_referral_credits").insert({ referrer_id: p8.id, referred_id: p3.id, months: 1 }).select("id").single();
      res = await fetch(`${BASE}/api/web-gratis/admin/credits/${credit?.id}`, { method: "PATCH", headers: auth, body: JSON.stringify({ applied: true }) });
      const applied = (await res.json()) as { data: { paidThrough: string | null } | null };
      const { data: creditRow } = await db.from("web_gratis_referral_credits").select("applied_at").eq("id", credit?.id).single();
      check("'Marcar aplicado' → applied_at set and the PayPal referrer's month is added", res.status === 200 && !!creditRow?.applied_at && applied.data?.paidThrough === site.wa.svDateOf(s8.paid_through as string, 30), { st: res.status, applied: applied.data });
      res = await fetch(`${BASE}/api/web-gratis/admin/credits/${credit?.id}`, { method: "PATCH", headers: auth, body: JSON.stringify({ applied: true }) });
      check("…twice → 409 (never applied twice)", res.status === 409);
      res = await fetch(`${BASE}/api/web-gratis/admin/credits/${credit?.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ applied: true }) });
      check("credits route without token → 401", res.status === 401);

      res = await fetch(`${BASE}/api/web-gratis/cron`);
      check("cron without CRON_SECRET → 401 (fail closed)", res.status === 401, res.status);
    }
  } finally {
    child.kill("SIGTERM");
    await mock.close();
    const errs = serverLog.split("\n").filter((l) => /\[WebGratis/.test(l));
    if (errs.length) console.log(`\nserver log lines tagged [WebGratis] (expected ones only):\n  ${errs.slice(0, 15).join("\n  ")}`);
  }
}
