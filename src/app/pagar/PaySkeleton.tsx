import styles from "./pay.module.css";
import PayShell from "./PayShell";
import { PAY_COPY } from "./copy";

/** Blue skeleton for the funnel pages while the server looks up the client. */
export default function PaySkeleton() {
  return (
    <PayShell t={PAY_COPY.es} lang="es">
      <section className={styles.card} aria-busy="true" aria-label="Cargando / Loading">
        <div className={styles.skel} style={{ width: "36%" }} />
        <div className={`${styles.skel} ${styles.skelTitle}`} />
        <div className={styles.skel} style={{ width: "92%" }} />
        <div className={styles.skel} style={{ width: "70%" }} />
        <div className={`${styles.skel} ${styles.skelButton}`} />
        <div className={`${styles.skel} ${styles.skelButton}`} />
      </section>
    </PayShell>
  );
}
