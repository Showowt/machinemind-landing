import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./pay.module.css";
import type { PayCopy } from "./copy";

interface PayShellProps {
  t: PayCopy;
  /** Same page in the other language (omit to hide the toggle). */
  toggleHref?: string;
  lang: "es" | "en";
  children: ReactNode;
}

/** Frame shared by /pagar, /pagar/gracias and /s/<code>/pronto (server component). */
export default function PayShell({ t, toggleHref, lang, children }: PayShellProps) {
  return (
    <main className={styles.page} lang={lang === "es" ? "es-SV" : "en"}>
      <div className={styles.aurora} aria-hidden="true" />
      <div className={styles.grain} aria-hidden="true" />
      <div className={styles.shell}>
        <header className={styles.top}>
          <Link href="/web" className={styles.brand}>
            <span className={styles.flag} aria-hidden="true" />
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
