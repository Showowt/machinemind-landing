# Runtime integration: implemented source, inactive wiring

The incremental runtime patch follows authoring head `ab79b75`. Its handler factories are
not mounted under `src/app`; importing a module performs no DB/provider operation. No
credentials are read by these new modules. Every pool, provider transport, key, clock,
identity verifier and binding is explicitly supplied by the host. No migration is in an
automatic migration directory; `sql/001-billing-private.sql` is review-only and unapplied.

## Exact entry points

| File under `src/lib/web-gratis/lifecycle/runtime` | Contract |
|---|---|
| `integration.ts` | `createBillingPool(explicitURL, ca, optionalDriver)` constructs a lazy TLS-verified `pg` pool; no environment or credential fallback. `runLegacyUnlessFixed(repo, siteId, callback)` must precede legacy effects and fails closed on lookup failure. `signedSophiaProjection` signs exact body/timestamp with an injected authorized bridge key. |
| `postgres.ts` | `PostgresStore` uses serializable row locks and rollback; no callback replay around external effects. `PostgresWebsiteRepository.initialize(identity, verifiedMichoacanaSignupId)` checks existing site/signup association but does not infer owner, consent or auth. `forActor` rechecks the verified binding inside each transaction. |
| `state.ts` | Strict persisted-state parsing and immutable ownership, plan, consent, go-live, deadline, receipt and audit validation. |
| `stripe.ts` | `StripeClient({secretKey, livemode, transport, now})` pins account/API, retrieves exact catalogs and validates real Stripe response shapes. `stripeWebsiteProvider` supplies creation, fresh snapshot and cancellation operations. API version `2026-04-22.dahlia`; no generic Payment Link trial. |
| `http.ts` | `billingHttp(options)` returns a Fetch handler. Requires approved `authenticate(Request) -> {issuer,subject} | null`, unchanged agreement `{revision,summary}`, explicit origin/timezone, repository, provider, signing/webhook keys and serving verifier. Authentication is an injected trust boundary, not a newly invented login system. |
| `recovery.ts` | `recoverWebsite` reconciles the exact owned Session/subscription under a verified operator. Unknown provider outcomes retain frozen parameters; wall time alone never expires a reservation. |
| `simmerdown.ts` | `SimmerRuntime` uses the same transaction/ledger schema, separately configured verified customer/client/timezone, separate recurring consent, owned October receipts and two-path safeguards. |
| `simmerdown-http.ts` | `simmerdownHttp` authenticates exact bindings and exposes the separate schedule/checkout/recovery workflow. It never grants recurring consent from the one-time payment. |

Website handler paths, all unmounted:

- GET `/web/billing?record=<key>&token=<binding>`, `/web/billing/receipt?session_id=<id>`,
  `/admin/web-gratis/billing?record=<key>`, `/api/admin/web-gratis/billing-calendar?record=<key>`,
  `/api/web-gratis/billing/snapshot?record=<key>`.
- POST `/api/web-gratis/billing/{accept,approve,go-live,checkout,withdraw,issue-link,draft-reminder,reconcile}`
  with the record locator. `/webhook` instead verifies the raw Stripe body before any storage lookup.
- GET requests do not accept terms/create Sessions. HTML forms are Spanish, unchecked
  consent controls; POSTs require matching Origin and verified identity. Operator access
  cannot accept for the client. Calendar currently displays the one authorized record;
  the owner can compose multiple authorized records using the existing calendar component.
- Checkout return/cancel identity is resolved through owned Session/site bindings, not
  redirect claims. A success redirect is never payment evidence.

SimmerDown paths: GET `/billing/simmerdown`, `/billing/simmerdown/receipt`; POST
`/api/billing/simmerdown/{accept,checkout,approve-combined,reconcile,withdraw,webhook}`.
Only the configured verified record is accessible; there is no arbitrary customer parameter.

## Fixed pricing and timing

Account `acct_1QvaObIS8EYk0ASL`. Live standard monthly price
`price_1UMZzZIS8EYk0ASLplu88gxR` = USD20; verified Michoacana/Toxica exception
`price_1UMa6VIS8EYk0ASLWXwh8qDK` = USD19. The immutable exception signup UUID is still
unverified. Do not infer it from names or slugs. Existing technical `site_only` publications
and the three unaccepted concepts receive no backfilled consent or trial start.

The actual version-specific go-live proof requires response headers `x-mm-site-id` and
`x-mm-site-version` from the shared renderer plus fresh published DB state and HTML digest.
The main builder must add those proof headers. This branch does not change that renderer.
`trial_end = accepted_actual_go_live + 30*86400` is fixed; day15/day20 clicks retain it.
Sessions have a one-hour lifetime and 15-minute submission window. The final 48 hours plus
one-hour safety buffer require waiting for explicit late exact-charge confirmation.
An expired trial requires the client to confirm USD19/20 now and monthly, with no backbilling.

SimmerDown uses UI-created October price `price_1UMb2VIS8EYk0ASLlYJZGmsJ`, dedicated link
`plink_1UMb2zIS8EYk0ASLSwvGPI1l` and recurring price `price_1UMaFfIS8EYk0ASLS0Tn1GfG`.
Current paid state/customer/timezone remain unverified. The proposed November1 epoch
`1793512800` uses unverified America/El_Salvador. No default in runtime invents those facts.
All Sessions on the dedicated cash link are inspected; a guest/unmapped non-expired Session
holds the combined path. An owned paid receipt requires succeeded USD300 PaymentIntent and
captured, nonrefunded Charge, plus exact invoice when present. Paid October yields zero-now
recurring-only setup. Unpaid combined requires explicit operator approval and verified
inactive competing link/no outstanding attempt. Failed initial combined invoice cancels
the exact deferred subscription, without a new invoice/proration; retries remain terminal.

## Webhooks, recovery and sends

Configure only after authorized test validation: `checkout.session.completed`, `.expired`,
`.async_payment_succeeded`, `.async_payment_failed`; `customer.subscription.created`,
`.updated`, `.deleted`; `invoice.paid`, `.payment_failed`, `.payment_action_required`.
The raw body signature is required. Fresh provider objects, account/mode, metadata,
customer, exact amount/line, product/price and ownership are checked before ledger writes.
Duplicate IDs require the same digest; out-of-order events use current snapshots. SQL
failures roll back state, global object ownership, event receipts, invoices and audit together.
Canceled subscriptions cannot reactivate from stale events; failed invoices never mark paid.

On uncertain Session creation, do not delete/reset attempts or change the idempotency key.
An operator calls reconcile to retrieve the actual owned Session; only provider-confirmed
expiry without a subscription permits another attempt. Pagination is bounded and incomplete
results hold. Each provider request has a ten-second deadline; the release host must budget
transaction/request duration for bounded reconciliation, not auto-replay provider callbacks.
No background recovery cron is installed. Large histories require explicit operator review.

Reminder drafts only enter the private outbox; no delivery transport or scheduler exists.
Day15/day20 eligibility and enrollment suppression are rechecked when drafting. A future
sender requires a separately reviewed execution-time consent/enrollment/idempotency check.
Sophia receives only signed minimal read-only context, never payment tokens or acceptance power.

## Configuration and activation gates

Exact proposed env names and privileges are in [activation contract](billing-activation-contract.md).
Names are documentation only; the runtime factories do not read them. `pg` was already
locked at8.20.0; this patch moves it from development to runtime dependencies without installation.
Nine private tables, three trigger functions and all SQL remain unexecuted. Mock SQL tests
prove adapter orchestration, not PostgreSQL grammar, constraints or real concurrency.

Remaining owner facts: immutable client/Michoacana mappings and approved issuer/session
verifier; attributable Phil subject; unchanged approved agreement revision/text; real client
consent; SimmerDown customer/timezone/current receipt. No new login/security decision is assumed.
Remaining execution authorization: isolated DB/schema and required existing-role grants;
approved test-mode Stripe key/fixtures/webhook of the pinned account; sandbox/test-clock and
browser evidence; live account readiness and eventual release. No new credentials/grants,
provider objects, cron, sends or deployments are authorized by this source handoff.

Release engineering owned by main builder/Sophia owner: reconcile current main/production,
mount these handlers with the approved verifier, emit serving-proof headers, wire legacy
exclusion before all old effects, and integrate the signed read model without touching the
held `e6bb1a8` change blindly. Prior Sophia registry denial remains in force.

The inactive page CSP permits form navigation only to its own origin and the verified
`https://checkout.stripe.com` host, including the successful303 redirect. This avoids
blocking Checkout in browsers that apply form-action to form redirects; implementations
differ ([MDN form-action](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/form-action)).
The server still validates the returned Checkout host and requires same-origin POSTs.

Canonical initialization must be coordinated with already-running legacy effects.
`runLegacyUnlessFixed` is an authoritative membership check, not a lock shared with legacy
workers: the release owner must quiesce/drain those workers during enrollment, or implement
shared site-scoped exclusion around both initialization and the complete legacy effect.
Do not claim the helper alone closes the absence-check/enrollment race.
