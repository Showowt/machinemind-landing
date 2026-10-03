/** Synthetic SQL and HTTP doubles only. Never import a real pool/transport or process.env. */
import assert from 'node:assert/strict';
import type { SqlPool, SqlClient } from '../../../src/lib/web-gratis/lifecycle/runtime/postgres';
import { STRIPE_ACCOUNT } from '../../../src/lib/web-gratis/lifecycle/core';
import { STRIPE_API_VERSION } from '../../../src/lib/web-gratis/lifecycle/runtime/stripe';
type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;
export class FixturePool implements SqlPool {
    tables: Tables = { records: [], sites: [], signups: [], attempts: [], identity_bindings: [], customer_bindings: [], provider_objects: [], webhook_events: [], payments: [], audit: [], reminder_outbox: [] };
    sql: string[] = [];
    statements: { sql: string; values: unknown[] }[] = [];
    failOnce: string | null = null;
    beforeQuery: ((sql: string) => void) | null = null;
    private tail = Promise.resolve();
    async connect(): Promise<SqlClient> {
        let tx: Tables | null = null, release: (() => void) | null = null;
        return { release() { assert.equal(tx, null, 'connection released with unclosed transaction'); }, query: async (sql: string, v: unknown[] = []) => {
                this.sql.push(sql);
                this.statements.push({ sql, values: structuredClone(v) });
                this.beforeQuery?.(sql);
                if (sql.startsWith('BEGIN')) {
                    const old = this.tail;
                    this.tail = new Promise(r => { release = r; });
                    await old;
                    tx = structuredClone(this.tables);
                    return { rows: [], rowCount: null };
                }
                if (sql === 'COMMIT') {
                    assert.ok(tx);
                    this.tables = tx;
                    tx = null;
                    release!();
                    return { rows: [], rowCount: null };
                }
                if (sql === 'ROLLBACK') {
                    tx = null;
                    release!();
                    return { rows: [], rowCount: null };
                }
                if (sql.startsWith('SET LOCAL'))
                    return { rows: [], rowCount: null };
                if (this.failOnce && sql.includes(this.failOnce)) {
                    this.failOnce = null;
                    throw Error('synthetic_database_failure');
                }
                const tables = tx ?? this.tables, ret = (rows: Row[]) => ({ rows: structuredClone(rows), rowCount: rows.length });
                if (sql.startsWith('INSERT INTO billing_private.')) {
                    const match = sql.match(/^INSERT INTO billing_private\.(\w+)\(([^)]+)\) VALUES\((.*?)\)(?: |$)/)!;
                    assert.ok(match, sql);
                    const [, table, columns, values] = match, row: Row = {};
                    columns.split(',').forEach((c, n) => { const exp = values.split(',')[n].trim(); row[c] = exp.startsWith('$') ? v[Number(exp.match(/^\$(\d+)/)![1]) - 1] : exp.startsWith("'") ? exp.slice(1, -1) : Number(exp); });
                    const keys: Record<string, string[]> = { records: ['record_key'], attempts: ['attempt_id'], identity_bindings: ['record_key', 'role', 'issuer', 'subject'], customer_bindings: ['account_id', 'livemode', 'customer_id'], provider_objects: ['account_id', 'livemode', 'object_kind', 'object_id'], webhook_events: ['account_id', 'livemode', 'event_id'], payments: ['account_id', 'livemode', 'payment_key'], audit: ['record_key', 'sequence'], reminder_outbox: ['record_key', 'go_live_epoch', 'day'] };
                    if (table === 'records') {
                        row.state = JSON.parse(String(row.state));
                        row.revision = 0;
                    }
                    let old = tables[table].find(r => keys[table].every(k => r[k] === row[k]));
                    if (table === 'records')
                        old ??= tables.records.find(r => r.account_id === row.account_id && r.livemode === row.livemode && ((row.site_id && r.site_id === row.site_id) || (row.client_id && r.client_id === row.client_id && r.billing_period === row.billing_period)));
                    if (table === 'payments')
                        old ??= tables.payments.find(r => r.account_id === row.account_id && r.livemode === row.livemode && ((row.invoice_id && r.invoice_id === row.invoice_id) || (row.payment_intent_id && r.payment_intent_id === row.payment_intent_id) || (row.billing_period === '2026-10' && r.record_key === row.record_key && r.billing_period === '2026-10')));
                    if (old) {
                        if (table === 'attempts' && sql.includes('DO UPDATE')) {
                            if (old.record_key !== row.record_key || old.request_sha256 !== row.request_sha256)
                                return ret([]);
                            Object.assign(old, { status: row.status, session_id: row.session_id, url: row.url });
                            return ret([old]);
                        }
                        if (sql.includes('DO NOTHING'))
                            return ret([]);
                        throw Error('synthetic_unique_violation');
                    }
                    if (table === 'attempts' && row.status !== 'expired')
                        assert.ok(!tables.attempts.some(r => r.record_key === row.record_key && r.status !== 'expired'), 'one active attempt');
                    tables[table].push(row);
                    return ret([row]);
                }
                if (sql.startsWith('UPDATE billing_private.records')) {
                    const r = tables.records.find(r => r.record_key === v[0] && r.revision === v[2]);
                    if (!r)
                        return ret([]);
                    r.state = JSON.parse(String(v[1]));
                    r.revision = Number(r.revision) + 1;
                    return ret([r]);
                }
                if (sql.includes('FROM public.web_gratis_sites') && sql.includes('JOIN public.web_gratis_signups'))
                    return ret(tables.sites.filter(r => r.id === v[0] && r.signup_id === v[1]).flatMap(r => tables.signups.filter(g => g.id === r.signup_id).map(g => ({ ...r, signup_status: g.status }))));
                if (sql.includes('FROM public.web_gratis_sites'))
                    return ret(tables.sites.filter(r => r.id === v[0] && r.signup_id === v[1]));
                if (sql.includes('FROM billing_private.identity_bindings'))
                    return ret(tables.identity_bindings.filter(r => r.record_key === v[0] && r.issuer === v[1] && r.subject === v[2] && r.role === v[3] && !r.revoked_at));
                if (sql.includes('FROM billing_private.customer_bindings'))
                    return ret(tables.customer_bindings.filter(r => r.account_id === v[0] && r.livemode === v[1] && r.customer_id === v[2]));
                if (sql.includes('FROM billing_private.provider_objects'))
                    return ret(tables.provider_objects.filter(r => r.account_id === v[0] && r.livemode === v[1] && r.object_kind === v[2] && r.object_id === v[3]));
                if (sql.includes('JOIN billing_private.identity_bindings')) {
                    return ret(tables.records.flatMap(r => tables.identity_bindings.filter(b => b.record_key === r.record_key && !b.revoked_at && b.issuer === v[4] && b.subject === v[5] && r.record_key === v[0] && r.program === v[1] && r.account_id === v[2] && r.livemode === v[3]).map(b => ({ state: r.state, role: b.role }))));
                }
                if (sql.includes('JOIN billing_private.attempts')) {
                    return ret(tables.records.flatMap(r => tables.attempts.filter(a => a.record_key === r.record_key).flatMap(a => {
                        const matches = sql.includes('LEFT JOIN') ? r.program === v[0] && r.account_id === v[1] && r.livemode === v[2] && (a.attempt_id === v[3] || tables.provider_objects.some(p => p.record_key === r.record_key && p.attempt_id === a.attempt_id && p.object_id === v[4] && p.account_id === v[1] && p.livemode === v[2])) : a.attempt_id === v[0] && r.account_id === v[1] && r.livemode === v[2] && r.program === v[3];
                        return matches ? [{ state: r.state, attempt_id: a.attempt_id }] : [];
                    })));
                }
                if (sql.includes('FROM billing_private.records WHERE record_key=$1'))
                    return ret(tables.records.filter(r => r.record_key === v[0]));
                if (sql.includes('FROM billing_private.records WHERE account_id=$1'))
                    return ret(tables.records.filter(r => r.account_id === v[0] && r.livemode === v[1] && r.site_id === v[2]));
                throw Error(`Unimplemented synthetic SQL: ${sql}`);
            } };
    }
}
export function fixturePrice(id: string, cents: number, type: 'recurring' | 'one_time' = 'recurring', product = 'prod_test') {
    return { id, object: 'price', livemode: false, active: true, product, unit_amount: cents, currency: 'usd', type, tax_behavior: 'inclusive', recurring: type === 'recurring' ? { interval: 'month', interval_count: 1, usage_type: 'licensed' } : null, billing_scheme: 'per_unit', transform_quantity: null };
}
export class FixtureStripe {
    prices: Record<string, ReturnType<typeof fixturePrice>> = { price_test20: fixturePrice('price_test20', 2000), price_test19: fixturePrice('price_test19', 1900) };
    sessions: Record<string, Row> = {};
    subs: Record<string, Row> = {};
    invoices: Record<string, Row> = {};
    invoiceLines: Record<string, Row[]> = {};
    intents: Record<string, Row> = {};
    charges: Record<string, Row> = {};
    customers: Record<string, Row> = {};
    links: Record<string, Row> = {};
    requests: {
        method: string;
        path: string;
        params: URLSearchParams;
        key: string | null;
    }[] = [];
    beforeCreate: (() => void) | null = null;
    mutateCreated: ((row: Row) => void) | null = null;
    timeoutAfterCreate = false;
    failPath: string | null = null;
    account = STRIPE_ACCOUNT;
    idempotency = new Map<string, {
        body: string;
        id: string;
    }>();
    constructor(readonly clock: () => number) { }
    transport: typeof fetch = async (input, init) => {
        const url = new URL(String(input)), method = init?.method ?? 'GET', headers = new Headers(init?.headers);
        assert.equal(url.origin, 'https://api.stripe.com');
        assert.equal(headers.get('Stripe-Version'), STRIPE_API_VERSION);
        assert.equal(headers.get('Authorization'), 'Bearer sk_test_fixture_only');
        assert.equal(init?.redirect, 'error');
        const params = method === 'GET' ? url.searchParams : new URLSearchParams(String(init?.body ?? '')), key = headers.get('Idempotency-Key');
        this.requests.push({ method, path: url.pathname, params, key });
        const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } }), list = (data: unknown[]) => response({ object: 'list', data, has_more: false });
        if (this.failPath === url.pathname)
            return response({ error: { message: 'fixture down' } }, 503);
        if (url.pathname === '/v1/account')
            return response({ id: this.account });
        const [, resource, object, child] = url.pathname.split('/').slice(1);
        if (resource === 'prices')
            return response(this.prices[object]);
        if (resource === 'products')
            return response({ id: object, active: true, livemode: false });
        if (resource === 'payment_links')
            return response(this.links[object]);
        if (resource === 'payment_intents')
            return response(this.intents[object]);
        if (resource === 'charges')
            return response(this.charges[object]);
        if (resource === 'customers')
            return response(this.customers[object] ?? { id: object, livemode: false, balance: 0 });
        if (resource === 'invoiceitems')
            return list([]);
        if (resource === 'subscriptions' && !object)
            return list(Object.values(this.subs).filter(s => s.customer === params.get('customer')));
        if (resource === 'subscriptions' && object) {
            const sub = this.subs[object];
            assert.ok(sub);
            if (method === 'DELETE') {
                assert.equal(params.get('invoice_now'), 'false');
                assert.equal(params.get('prorate'), 'false');
                sub.status = 'canceled';
            }
            return response(sub);
        }
        if (resource === 'invoices' && object) {
            return child === 'lines' ? list(this.invoiceLines[object] ?? []) : response(this.invoices[object]);
        }
        if (resource === 'invoices')
            return list(Object.values(this.invoices).filter(i => (i.parent as {
                subscription_details: {
                    subscription: string;
                };
            } | null)?.subscription_details.subscription === params.get('subscription')));
        if (resource === 'checkout' && object === 'sessions') {
            const sid = child, last = url.pathname.split('/')[5];
            if (sid) {
                const s = this.sessions[sid];
                assert.ok(s, `unknown fixture session ${sid}`);
                if (last === 'line_items')
                    return list(s.lines as unknown[]);
                if (last === 'expire') {
                    assert.equal(s.status, 'open');
                    s.status = 'expired';
                }
                return response(s);
            }
            if (method === 'GET')
                return list(Object.values(this.sessions).filter(s => (!params.get('customer') || s.customer === params.get('customer')) && (!params.get('payment_link') || s.payment_link === params.get('payment_link')) && (!params.get('created[gte]') || Number(s.created) >= Number(params.get('created[gte]'))) && (!params.get('created[lte]') || Number(s.created) <= Number(params.get('created[lte]')))));
            assert.equal(method, 'POST');
            assert.ok(key);
            const body = params.toString(), prior = this.idempotency.get(key);
            if (prior) {
                assert.equal(prior.body, body);
                return response(this.sessions[prior.id]);
            }
            this.beforeCreate?.();
            assert.ok(Number(params.get('expires_at')) - this.clock() >= 1800, 'provider expiry minimum');
            const id = `cs_test_${Object.keys(this.sessions).length + 1}`, metadata: Record<string, string> = {}, subMetadata: Record<string, string> = {};
            for (const [k, v] of params) {
                const m = k.match(/^metadata\[(.+)\]$/), sm = k.match(/^subscription_data\[metadata\]\[(.+)\]$/);
                if (m)
                    metadata[m[1]] = v;
                if (sm)
                    subMetadata[sm[1]] = v;
            }
            const trialEnd = params.get('subscription_data[trial_end]') ? Number(params.get('subscription_data[trial_end]')) : null;
            const lines = [];
            for (let n = 0; params.has(`line_items[${n}][price]`); n++) {
                const price = this.prices[params.get(`line_items[${n}][price]`)!];
                assert.ok(price);
                lines.push({ id: `li_${id}_${n}`, quantity: 1, price, amount_total: trialEnd && price.type === 'recurring' ? 0 : price.unit_amount, currency: 'usd' });
            }
            const s = { id, livemode: false, status: 'open', mode: 'subscription', customer: params.get('customer') ?? 'cus_fixture', subscription: null, payment_intent: null, invoice: null, payment_link: null, client_reference_id: params.get('client_reference_id'), metadata, amount_total: lines.reduce((n, l) => n + l.amount_total, 0), currency: 'usd', expires_at: Number(params.get('expires_at')), created: this.clock(), url: `https://checkout.stripe.com/c/${id}`, payment_status: 'unpaid', total_details: { amount_discount: 0, amount_shipping: 0, amount_tax: 0 }, lines, subMetadata, trialEnd };
            this.sessions[id] = s;
            this.mutateCreated?.(s);
            this.idempotency.set(key, { body, id });
            if (this.timeoutAfterCreate) {
                this.timeoutAfterCreate = false;
                throw Error('fixture_unknown_provider_timeout');
            }
            return response(s);
        }
        throw Error(`Unexpected fixture Stripe call: ${method} ${url.pathname}`);
    };
    complete(id: string) {
        const s = this.sessions[id], lines = s.lines as {
            price: ReturnType<typeof fixturePrice>;
        }[];
        const recurring = lines.find(l => l.price.type === 'recurring')!;
        const subId = `sub_${id}`;
        Object.assign(s, { status: 'complete', payment_status: Number(s.amount_total) > 0 ? 'paid' : 'no_payment_required', subscription: subId });
        this.subs[subId] = { id: subId, livemode: false, customer: s.customer, status: s.trialEnd ? 'trialing' : 'active', trial_end: s.trialEnd, cancel_at_period_end: false, default_payment_method: 'pm_fixture', metadata: s.subMetadata, items: { has_more: false, data: [{ id: `si_${subId}`, quantity: 1, price: recurring.price, current_period_start: this.clock(), current_period_end: s.trialEnd ?? this.clock() + 30 * 86400 }] } };
        return subId;
    }
    invoice(subId: string, priceId: string, start: number, end: number) {
        const sub = this.subs[subId], price = this.prices[priceId], id = `in_test_${Object.keys(this.invoices).length + 1}`;
        const invoice = { id, livemode: false, customer: sub.customer, status: 'paid', amount_paid: price.unit_amount, total: price.unit_amount, amount_due: price.unit_amount, currency: 'usd', starting_balance: 0, ending_balance: 0, status_transitions: { paid_at: this.clock() }, metadata: {}, parent: { subscription_details: { subscription: subId, metadata: sub.metadata } } };
        this.invoices[id] = invoice;
        this.invoiceLines[id] = [{ id: `il_${id}`, livemode: false, amount: price.unit_amount, currency: 'usd', quantity: 1, period: { start, end }, pricing: { price_details: { price: priceId } }, parent: { subscription_item_details: { subscription: subId, proration: false } }, discount_amounts: [], pretax_credit_amounts: [] }];
        return invoice;
    }
}
