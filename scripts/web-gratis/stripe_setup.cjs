// One-time, idempotent Stripe setup for the web-gratis $20/mo plan (product, price, Payment Link,
// webhook endpoint). Key: STRIPE_KEY_FILE or ~/Personal/Credentials/stripe-web-gratis.key (a restricted
// key with write access to Products, Prices, Payment Links and Webhook Endpoints). Prints only
// non-secret IDs/URLs; the webhook signing secret goes to a 0600 file next to the key — set it on
// Vercel as STRIPE_WEBHOOK_SECRET_WEBGRATIS with printf, then save PAYMENT_LINK_URL as the board's
// pay link (web_gratis_settings.pay_link).
//   node scripts/web-gratis/stripe_setup.cjs
const fs = require("fs");
const os = require("os");
const path = require("path");
const KEY_FILE = process.env.STRIPE_KEY_FILE || path.join(os.homedir(), "Personal/Credentials/stripe-web-gratis.key");
const WHSEC_FILE = KEY_FILE.replace(/\.key$/, "") + ".whsec";
const KEY = fs.readFileSync(KEY_FILE, "utf8").replace(/^STRIPE_SECRET_KEY=/, "").replace(/^"|"$/g, "").trim();
const mode = KEY.startsWith("sk_live") ? "LIVE" : KEY.startsWith("sk_test") ? "TEST" : KEY.startsWith("rk_") ? "RESTRICTED" : "UNKNOWN";
const H = { authorization: `Bearer ${KEY}`, "content-type": "application/x-www-form-urlencoded" };
const post = async (path, params) => {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, { method: "POST", headers: H, body: new URLSearchParams(params) });
  const j = await r.json();
  if (!r.ok) throw new Error(`${path}: ${j.error?.message}`);
  return j;
};
const get = (path) => fetch(`https://api.stripe.com/v1/${path}`, { headers: H }).then((r) => r.json());
(async () => {
  const acct = await get("account");
  console.log(`key mode ${mode} | account ${acct.id} ${acct.country} ${acct.default_currency} charges_enabled=${acct.charges_enabled} | ${acct.business_profile?.name ?? acct.settings?.dashboard?.display_name ?? ""}`);
  // Idempotent: reuse an existing product tagged program=web_gratis.
  const prods = await get("products/search?query=" + encodeURIComponent("metadata['program']:'web_gratis'"));
  let product = prods.data?.[0];
  if (!product) {
    product = await post("products", {
      name: "Página web MachineMind — mantenimiento mensual",
      description: "Hosting, soporte y actualizaciones de su página web. Sin contrato: cancele cuando quiera.",
      "metadata[program]": "web_gratis",
    });
    console.log("product created", product.id);
  } else console.log("product exists", product.id);
  const prices = await get(`prices?product=${product.id}&active=true&limit=10`);
  let price = (prices.data || []).find((p) => p.unit_amount === 2000 && p.currency === "usd" && p.recurring?.interval === "month");
  if (!price) {
    price = await post("prices", { product: product.id, unit_amount: "2000", currency: "usd", "recurring[interval]": "month", nickname: "Web gratis $20/mes", "metadata[program]": "web_gratis" });
    console.log("price created", price.id);
  } else console.log("price exists", price.id);
  const links = await get("payment_links?limit=100&active=true");
  let link = (links.data || []).find((l) => l.metadata?.program === "web_gratis");
  if (!link) {
    link = await post("payment_links", {
      "line_items[0][price]": price.id,
      "line_items[0][quantity]": "1",
      "after_completion[type]": "redirect",
      "after_completion[redirect][url]": "https://machinemindconsulting.com/pagar/gracias",
      "phone_number_collection[enabled]": "true",
      "custom_text[submit][message]": "Mantener su página web en línea: $20/mes, sin contrato. Cancele cuando quiera.",
      "subscription_data[metadata][program]": "web_gratis",
      "metadata[program]": "web_gratis",
    });
    console.log("payment link created", link.id);
  } else console.log("payment link exists", link.id);
  console.log("PAYMENT_LINK_URL", link.url);
  const hooks = await get("webhook_endpoints?limit=100");
  const url = "https://machinemindconsulting.com/api/web-gratis/stripe-webhook";
  let hook = (hooks.data || []).find((h) => h.url === url);
  if (!hook) {
    hook = await post("webhook_endpoints", {
      url,
      description: "Web gratis funnel (machinemind-landing) — $20/mo activation",
      "enabled_events[0]": "checkout.session.completed",
      "enabled_events[1]": "customer.subscription.deleted",
      "enabled_events[2]": "invoice.payment_failed",
      "enabled_events[3]": "invoice.paid",
      "metadata[program]": "web_gratis",
    });
    fs.writeFileSync(WHSEC_FILE, hook.secret, { mode: 0o600 });
    console.log("webhook endpoint created", hook.id, `| signing secret written to ${WHSEC_FILE} (len`, hook.secret.length, ")");
  } else console.log("webhook endpoint exists", hook.id, "(secret only shown at creation)");
  console.log(JSON.stringify({ mode, account: acct.id, product: product.id, price: price.id, payment_link: link.id, payment_link_url: link.url, webhook: hook.id }, null, 2));
})().catch((e) => { console.error("STRIPE SETUP FAILED:", e.message); process.exit(1); });
