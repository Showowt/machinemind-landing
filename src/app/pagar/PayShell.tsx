import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./pay.module.css";
import { payLocale, type PayCopy, type PayCountry } from "./copy";

interface PayShellProps {
  t: PayCopy;
  /** Same page in the other language (omit to hide the toggle). */
  toggleHref?: string;
  lang: "es" | "en";
  /** The business's market: shows its flag next to the brand (geography only). Null/omitted = neutral. */
  country?: PayCountry | null;
  children: ReactNode;
}

/** Frame shared by /pagar, /pagar/gracias and /s/<code>/pronto (server component). */
export default function PayShell({ t, toggleHref, lang, country = null, children }: PayShellProps) {
  const flag = country === "SV" ? styles.flagSV : country === "CO" ? styles.flagCO : null;
  // The brand goes back to /web framed for the same market (SV / CO copy, phone code, cities).
  const home = country === "CO" ? "/web?pais=co" : country === "SV" ? "/web?pais=sv" : "/web";
  return (
    <main className={styles.page} lang={payLocale(lang, country)}>
      <div className={styles.aurora} aria-hidden="true" />
      <div className={styles.grain} aria-hidden="true" />
      <div className={styles.shell}>
        <header className={styles.top}>
          <Link href={home} className={styles.brand}>
            {flag ? <span className={`${styles.flag} ${flag}`} aria-hidden="true" /> : <span className={styles.dot} aria-hidden="true" />}
            MachineMind
          </Link>
          {toggleHref ? (
            <Link href={toggleHref} className={styles.lang} hrefLang={lang === "es" ? "en" : "es"} prefetch={false}>
              {t.toggle}
            </Link>
          ) : null}
        </header>
        {children}
        <footer className={styles.footer}>
          <p>{t.disclaimer}</p>
          <p>
            <Link href="/verificar">{t.verify}</Link>
          </p>
        </footer>
      </div>
    </main>
  );
}
