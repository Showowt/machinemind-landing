/**
 * /s/<code>/pronto — shown when "Ver mi web" is tapped before the site URL is
 * on file (or for an unknown code): the site is on its way, ask on WhatsApp.
 */
import type { Metadata } from "next";
import styles from "@/app/pagar/pay.module.css";
import PayShell from "@/app/pagar/PayShell";
import { PAY_COPY, payCountry, payLang } from "@/app/pagar/copy";
import { MM_WHATSAPP } from "@/lib/web-gratis/config";
import { findSignupByCode, type WebGratisSignup } from "@/lib/web-gratis/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Su web está en camino — MachineMind",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ lang?: string | string[] }>;
}

export default async function ProntoPage({ params, searchParams }: PageProps) {
  const [{ code }, query] = await Promise.all([params, searchParams]);
  let signup: WebGratisSignup | null = null;
  try {
    signup = await findSignupByCode(code);
  } catch (error) {
    console.error("[WebGratis:s:pronto]", code, error);
  }
  const lang = payLang(query.lang, signup?.lang ?? "es");
  const t = PAY_COPY[lang];
  const live = signup && !["descartada", "cancelada"].includes(signup.status) ? signup : null;
  const business = live ? live.business_name : null;
  const ask = live ? t.waHowIsIt(live.business_name, live.referral_code) : t.waHowIsItAnon;
  return (
    <PayShell
      t={t}
      lang={lang}
      country={payCountry(live)}
      toggleHref={`/s/${encodeURIComponent(code)}/pronto?lang=${lang === "es" ? "en" : "es"}`}
    >
      <section className={styles.card}>
        <svg className={styles.pending} viewBox="0 0 52 52" aria-hidden="true">
          <circle cx="26" cy="26" r="24" opacity="0.25" />
          <circle cx="26" cy="26" r="24" />
        </svg>
        <p className={styles.kicker}>{t.kicker}</p>
        <h1 className={styles.title}>{t.prontoTitle}</h1>
        <p className={styles.lede}>{t.prontoBody(business)}</p>
        <div className={styles.actions}>
          <a className={styles.wa} href={`https://wa.me/${MM_WHATSAPP}?text=${encodeURIComponent(ask)}`} target="_blank" rel="noopener noreferrer">
            {t.prontoCta}
          </a>
        </div>
      </section>
    </PayShell>
  );
}
