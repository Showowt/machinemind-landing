/**
 * /pagar/<code> — keep the free website online for MONTHLY_PRICE_USD a month.
 *
 * The day-28 / day-30 / pause-notice WhatsApp templates link here. "Pagar con
 * tarjeta" opens the Stripe Payment Link from the ops board with
 * client_reference_id = the signup id, so the webhook activates the right site.
 * PayPal stays manual: pay, then send the receipt on the funnel WhatsApp line.
 * Only a delivered site (live or paused) can be paid for: a request still being
 * built is told there's nothing to pay yet ("nunca pedimos dinero por adelantado").
 * Country-aware (El Salvador / Colombia): the flag by the brand and, under the
 * price, the initiative tag + alignment line; the footer carries the disclaimer.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "../pay.module.css";
import PayShell from "../PayShell";
import { PAY_COPY, payCountry, payLang, type PayCountry } from "../copy";
import { DEFAULT_PAYPAL_LINK, MM_WHATSAPP, MONTHLY_PRICE_USD } from "@/lib/web-gratis/config";
import { findSignupByCode, loadSettings, type WebGratisSettings, type WebGratisSignup } from "@/lib/web-gratis/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mantenga su web en línea — MachineMind",
  description: `Su página web en línea por $${MONTHLY_PRICE_USD} USD al mes, sin contrato.`,
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ lang?: string | string[] }>;
}

function stripeHref(payLink: string | null, signupId: string, lang: "es" | "en"): string | null {
  if (!payLink) return null;
  try {
    const url = new URL(payLink);
    if (url.protocol !== "https:") return null;
    url.searchParams.set("client_reference_id", signupId);
    url.searchParams.set("locale", lang);
    return url.toString();
  } catch {
    return null;
  }
}

function waHref(text: string): string {
  return `https://wa.me/${MM_WHATSAPP}?text=${encodeURIComponent(text)}`;
}

export default async function PayPage({ params, searchParams }: PageProps) {
  const [{ code }, query] = await Promise.all([params, searchParams]);

  let signup: WebGratisSignup | null = null;
  let settings: WebGratisSettings | null = null;
  let failed = false;
  try {
    [signup, settings] = await Promise.all([findSignupByCode(code), loadSettings()]);
  } catch (error) {
    console.error("[WebGratis:pagar]", code, error);
    failed = true;
  }

  const lang = payLang(query.lang, signup?.lang ?? "es");
  const t = PAY_COPY[lang];
  const country: PayCountry | null = payCountry(signup);
  const toggleHref = `/pagar/${encodeURIComponent(code)}?lang=${lang === "es" ? "en" : "es"}`;

  if (failed) {
    return (
      <PayShell t={t} lang={lang} toggleHref={toggleHref}>
        <section className={styles.card}>
          <p className={styles.kicker}>{t.kicker}</p>
          <h1 className={styles.title}>{t.errorTitle}</h1>
          <p className={styles.lede}>{t.errorBody}</p>
          <div className={styles.actions}>
            <a className={styles.wa} href={waHref(t.waActivate(code))} target="_blank" rel="noopener noreferrer">
              {t.help}
            </a>
          </div>
        </section>
      </PayShell>
    );
  }

  if (!signup || signup.status === "descartada" || signup.status === "cancelada") notFound();

  if (signup.status === "borrador") {
    return (
      <PayShell t={t} lang={lang} toggleHref={toggleHref} country={country}>
        <section className={styles.card}>
          <p className={styles.kicker}>{t.kicker}</p>
          <h1 className={styles.title}>{t.draftTitle}</h1>
          <p className={styles.lede}>{t.draftBody}</p>
          <div className={styles.actions}>
            <Link className={styles.primary} href={country === "CO" ? "/web?pais=co" : country === "SV" ? "/web?pais=sv" : "/web"}>
              {t.draftCta}
            </Link>
          </div>
        </section>
      </PayShell>
    );
  }

  if (signup.status === "activa") {
    return (
      <PayShell t={t} lang={lang} toggleHref={toggleHref} country={country}>
        <section className={styles.card}>
          <svg className={styles.mark} viewBox="0 0 52 52" aria-hidden="true">
            <circle cx="26" cy="26" r="24" />
            <path d="M15 27 l7 7 l15 -16" />
          </svg>
          <p className={styles.kicker}>{t.kicker}</p>
          <h1 className={styles.title}>{t.activeTitle}</h1>
          <p className={styles.lede}>{t.activeBody(signup.business_name)}</p>
          <div className={styles.actions}>
            <a className={styles.wa} href={waHref(t.waHello(signup.business_name, signup.referral_code))} target="_blank" rel="noopener noreferrer">
              {t.activeHelp}
            </a>
          </div>
        </section>
      </PayShell>
    );
  }

  if (signup.status === "nuevo" || signup.status === "en_construccion") {
    const paid = !!signup.activated_at;
    return (
      <PayShell t={t} lang={lang} toggleHref={toggleHref} country={country}>
        <section className={styles.card}>
          {paid ? (
            <svg className={styles.mark} viewBox="0 0 52 52" aria-hidden="true">
              <circle cx="26" cy="26" r="24" />
              <path d="M15 27 l7 7 l15 -16" />
            </svg>
          ) : null}
          <p className={styles.kicker}>{t.kicker}</p>
          <h1 className={styles.title}>{paid ? t.paidBuildingTitle : t.buildingTitle}</h1>
          <p className={styles.lede}>{paid ? t.paidBuildingBody(signup.business_name) : t.buildingBody(signup.business_name)}</p>
          <div className={styles.actions}>
            <a className={styles.wa} href={waHref(t.waHowIsIt(signup.business_name, signup.referral_code))} target="_blank" rel="noopener noreferrer">
              {t.buildingHelp}
            </a>
          </div>
        </section>
      </PayShell>
    );
  }

  const paused = signup.status === "pausada";
  const card = stripeHref(settings?.pay_link ?? null, signup.id, lang);
  const paypal = settings?.paypal_link || DEFAULT_PAYPAL_LINK;
  const steps = paused ? [...t.paypalSteps.slice(0, -1), t.pausedLastStep] : t.paypalSteps;
  const market = country === "SV" || country === "CO" ? country : null;

  return (
    <PayShell t={t} lang={lang} toggleHref={toggleHref} country={country}>
      <section className={styles.card}>
        <p className={styles.kicker}>{t.kicker}</p>
        <h1 className={styles.title}>
          {paused ? t.pausedTitleLead : t.titleLead} <span className={styles.accent}>{paused ? t.pausedTitleAccent : t.titleAccent}</span>
        </h1>
        <p className={styles.lede}>{paused ? t.pausedLede(signup.business_name) : t.lede(signup.business_name)}</p>
        <p className={styles.price}>
          <span className={styles.amount}>${MONTHLY_PRICE_USD}</span>
          <span className={styles.per}>USD {t.per}</span>
        </p>
        <ul className={styles.chips}>
          {t.chips.map((chip) => (
            <li key={chip}>{chip}</li>
          ))}
        </ul>
        {market ? (
          <p className={styles.align}>
            <span className={styles.alignTag}>{t.initiative[market]}</span>
            {t.alignment[market]}
          </p>
        ) : null}

        <div className={styles.actions}>
          {card ? (
            <a className={styles.primary} href={card} rel="noopener noreferrer">
              {t.payCard}
            </a>
          ) : null}
          <a className={styles.secondary} href={paypal} target="_blank" rel="noopener noreferrer">
            {t.payPaypal}
          </a>
        </div>
        {card ? null : <p className={styles.note}>{t.cardSoon}</p>}

        <p className={styles.kicker} style={{ marginTop: 26 }}>
          {t.paypalTitle}
        </p>
        <ol className={styles.steps}>
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <div className={styles.actions} style={{ marginTop: 12 }}>
          <a className={styles.wa} href={waHref(t.receiptText(signup.referral_code))} target="_blank" rel="noopener noreferrer">
            {t.sendReceipt}
          </a>
        </div>
        {card ? <p className={styles.fine}>{t.secure}</p> : null}
      </section>
    </PayShell>
  );
}
