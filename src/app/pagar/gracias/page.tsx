/**
 * /pagar/gracias — Stripe's success URL for the monthly-plan Payment Link
 * (MONTHLY_PRICE_USD). The payer's country isn't known here, so the frame is
 * neutral (no flag).
 * Activation itself happens in the webhook; this page only thanks and points
 * to the funnel WhatsApp chat (where the next rung is offered).
 */
import type { Metadata } from "next";
import styles from "../pay.module.css";
import PayShell from "../PayShell";
import { PAY_COPY, payLang } from "../copy";
import { MM_WHATSAPP } from "@/lib/web-gratis/config";

export const metadata: Metadata = {
  title: "¡Gracias! — MachineMind",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ lang?: string | string[] }>;
}

export default async function ThanksPage({ searchParams }: PageProps) {
  const lang = payLang((await searchParams).lang);
  const t = PAY_COPY[lang];
  const chat = `https://wa.me/${MM_WHATSAPP}?text=${encodeURIComponent(t.waPaid)}`;
  return (
    <PayShell t={t} lang={lang} toggleHref={`/pagar/gracias?lang=${lang === "es" ? "en" : "es"}`}>
      <section className={styles.card}>
        <svg className={styles.mark} viewBox="0 0 52 52" aria-hidden="true">
          <circle cx="26" cy="26" r="24" />
          <path d="M15 27 l7 7 l15 -16" />
        </svg>
        <p className={styles.kicker}>{t.kicker}</p>
        <h1 className={styles.title}>{t.thanksTitle}</h1>
        <p className={styles.lede}>{t.thanksBody}</p>
        <p className={styles.note}>{t.thanksNext}</p>
        <div className={styles.actions} style={{ marginTop: 18 }}>
          <a className={styles.wa} href={chat} target="_blank" rel="noopener noreferrer">
            {t.thanksCta}
          </a>
        </div>
      </section>
    </PayShell>
  );
}
