import { createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import { sophiaSnapshot, requireThat, type Lifecycle, type Principal } from '../core';
import { PostgresWebsiteRepository, type SqlPool } from './postgres';
/** No env reads; constructing pg.Pool is lazy. Not called by production routes or tests
 * without a synthetic driver. Host must explicitly supply an approved URL/TLS trust. */
export function createBillingPool(connectionString: string, ca: string | undefined, driver?: {
    Pool: new (config: Record<string, unknown>) => SqlPool;
}): SqlPool {
    const url = new URL(connectionString);
    requireThat(['postgres:', 'postgresql:'].includes(url.protocol) && !!url.hostname && !!url.username && !!url.password && url.pathname.length > 1 && !url.searchParams.has('sslmode') && !url.searchParams.has('sslcert') && !url.searchParams.has('sslkey') && !url.searchParams.has('sslrootcert'), 'approved_database_configuration_required');
    const pg = driver ?? createRequire(import.meta.url)('pg') as {
        Pool: new (config: Record<string, unknown>) => SqlPool;
    };
    return new pg.Pool({ connectionString, ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) }, max: 5, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000, application_name: 'machinemind_billing' });
}
/** Guard for the release owner to call BEFORE legacy delivery/payment/sender effects.
 * A failed read throws, never falls through. Enrollment also requires the release owner
 * to drain legacy work or share site-level exclusion with initialization; this check alone
 * does not serialize that migration. No existing publisher or sender is changed. */
export async function runLegacyUnlessFixed<T>(repository: PostgresWebsiteRepository, siteId: string, legacy: () => Promise<T>) {
    if (await repository.hasLifecycle(siteId))
        return { kind: 'skipped_fixed_lifecycle' as const };
    return { kind: 'legacy' as const, value: await legacy() };
}
/** Read-only projection signed with the already-authorized bridge key supplied by host.
 * No dispatch or registry discovery. Raw body must be preserved at the receiver. */
export function signedSophiaProjection(state: Lifecycle, principal: Principal, now: number, bridgeSecret: string) {
    requireThat(bridgeSecret.length >= 32, 'bridge_signer_unavailable');
    const body = JSON.stringify(sophiaSnapshot(state, principal, now));
    return { body, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'x-wg-signature': `t=${now},v1=${createHmac('sha256', bridgeSecret).update(`${now}.${body}`).digest('hex')}` } };
}
