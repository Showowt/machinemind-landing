import Link from "next/link";
import styles from "../pay.module.css";
import PayShell from "../PayShell";
import { PAY_COPY } from "../copy";
import { MM_WHATSAPP } from "@/lib/web-gratis/config";

/** Unknown or closed code on /pagar/<code> — friendly, with a way forward. */
export default function PayNotFound() {
  const t = PAY_COPY.es;
  return (
    <PayShell t={t} lang="es">
      <section className={styles.card}>
        <p className={styles.kicker}>{t.kicker}</p>
        <h1 className={styles.title}>{t.notFoundTitle}</h1>
        <p className={styles.lede}>{t.notFoundBody}</p>
        <p className={styles.lede} lang="en">
          {PAY_COPY.en.notFoundBody}
        </p>
        <div className={styles.actions}>
          <Link className={styles.primary} href="/web">
            {t.notFoundCta}
          </Link>
          <a className={styles.wa} href={`https://wa.me/${MM_WHATSAPP}`} target="_blank" rel="noopener noreferrer">
            {t.help}
          </a>
        </div>
      </section>
    </PayShell>
  );
}
