import { calendar, nextAction, type Lifecycle, type Principal, assertOwner } from '@/lib/web-gratis/lifecycle/core';
/** Synchronous, read-only admin view. Parent must supply authorized records; no data fetches or effects.
 * Intentionally not mounted on the production board until the storage/auth activation gates pass.
 */
export default function BillingLifecycleCalendar({ records, principal, now, timezone }: {
    records: {
        name: string;
        state: Lifecycle;
    }[];
    principal: Principal;
    now: number;
    timezone: string;
}) {
    const fmt = new Intl.DateTimeFormat('es-SV', { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone });
    const date = (at: number | null) => at ? fmt.format(new Date(at * 1000)) : 'Pendiente';
    return <section aria-label="Calendario de facturación">
    <h2>Calendario de facturación</h2>
    <p>30 días desde la publicación aceptada. Zona horaria: {timezone}. Vista de revisión; no envía mensajes ni cobra.</p>
    {records.map(({ name, state }) => {
            assertOwner(state, principal, 'operator');
            return <article key={state.siteId}>
        <h3>{name} · USD {(state.plan.cents / 100).toFixed(2)}/mes</h3>
        <dl>
          <dt>Aceptación del cliente</dt><dd>{date(state.acceptance?.at ?? null)}</dd>
          <dt>Aprobación de Phil</dt><dd>{date(state.approval?.at ?? null)}</dd>
          <dt>Publicación aceptada</dt><dd>{date(state.goLiveAt)}</dd>
          <dt>Fin fijo de prueba</dt><dd>{date(state.trialEnd)}</dd>
          <dt>Estado de suscripción</dt><dd>{state.enrollment}</dd>
          <dt>Siguiente acción</dt><dd>{nextAction(state, now)}</dd>
        </dl>
        <table><caption>Fechas y estado</caption><thead><tr><th>Acción</th><th>Fecha</th><th>Estado</th></tr></thead>
          <tbody>{calendar(state, now).map(item => <tr key={item.kind}><td>{item.label}</td><td>{date(item.at)}</td><td>{item.status}</td></tr>)}</tbody></table>
        <details><summary>Historial de revisión ({state.audit.length})</summary><ol>{state.audit.map((entry, i) => <li key={i}>{date(entry.at)} · {entry.kind} · {entry.actor} · {entry.evidence}</li>)}</ol></details>
      </article>;
        })}
  </section>;
}
