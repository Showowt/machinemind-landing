# Fixed website billing lifecycle — source review, inactive

## Delivered scope

An additive domain + transactional service, signed tenant binding, Checkout request builder,
raw-signature webhook verifier/reconciler, read-only admin calendar, and Spanish reminder
builder. No production route imports the service. No migration, cron, sender, credentials,
permissions, provider objects, deployment or client contact is activated by this patch.
This is a tested source implementation with integration adapters still required, not a
claim that live subscriptions or automated reminders now work.

Authoring baseline: `7495f13ea673b779f3a67bb771adb26740e916ec` (parent-verified production,
also recorded in the builder's `production-rollout.json`). GitHub main was separately
verified through the repository API as `99984638d658ad9d4b373af099689435d43f933a` on
2026-10-03. The builder owns release reconciliation; do not overwrite its changes.
`sites/publish.ts`, renderer, Duran, signup delivery, payment handler, and existing cron
are unchanged. Existing site_only tests are not replaced by the domain tests here.

## Canonical contract

- Owner/tenant/signup/site identities come from the existing authenticated ownership
  boundary. Never infer identity from a business name, Instagram handle, email, amount
  or the editable client_reference_id alone.
- `acceptance.at` is recorded by a verified **client** action with explicit site/go-live
  and billing agreement, exact monthly amount, existing agreement revision, reviewed
  site version and evidence reference. No model inference, backdating, operator impersonation,
  newly authored legal agreement, or imported `terms_accepted_at` is sufficient.
- `approval.at` is Phil's separately authenticated operator decision. It cannot produce
  client acceptance. The verifier must authorize this operator from the existing owner
  context; it must never accept a client-supplied `role` or `subject`.
- The explicit accepted-go-live command checks both approvals for the same site version,
  then obtains a fresh public-serving receipt for the exact site. Only after that does
  the server clock set `goLiveAt` and `trialEnd = goLiveAt + 30 * 86400` once.
- A `site_only` command always skips billing, even after acceptance. The existing three
  published concepts (Michoacana, clinic, Jazz Hands) remain unaccepted/no clock. For an
  already-public concept, real client acceptance plus explicit fresh serving confirmation
  starts a *new commercial go-live*, never the historical technical `published_at`.
- Day 15/20 mean elapsed 15/20 days after this timestamp, with one 24-hour eligibility
  window each. Day 30 is the fixed first-charge eligibility instant; charge settlement
  timing remains Stripe's and may require customer authentication. No free-trial checkout
  or zero-value trial invoice is reported as payment/revenue.

## Exact prices — references only

Pinned account: `acct_1QvaObIS8EYk0ASL`. UI worker/parent reports both active, zero
subscriptions/no trial started. This task made no Stripe requests.

| Plan | Product | Price | Amount |
|---|---|---|---|
| Standard | `prod_VNKeeGkV4M1LzS` | `price_1UMZzZIS8EYk0ASLplu88gxR` | USD 20/month |
| Toxica / Michoacana | `prod_VNKmUDI2r3jUNX` | `price_1UMa6VIS8EYk0ASLWXwh8qDK` | USD 19/month |

`planFor` requires the verified immutable Michoacana signup ID before initializing any
lifecycle. That UUID is deliberately **not invented or read from production**. The known
slug/referral (`birrieria-y-taqueria-la-michoacana`, `ECHUGD`) are only reconciliation hints,
not billing identity. Every other verified signup receives USD 20. The catalog adapter
must verify account, live/test mode, active exact amount/currency/month interval/count,
and no extra tax or fees before enrollment. No price/product creation is implemented.
Country/bank-holder verification was unresolved at task handoff; account readiness must
be settled by its authorized owner before live activation, not by this source worker.

## Session behavior

`issueLink` and HMAC signing bind owner, tenant, signup, site, actual go-live, acceptance,
agreement revision, amount, generation and expiration. Only the canonical stored state
can generate the binding; altered/replayed/cross-tenant/expired tokens are rejected.
A valid signed link is *not* client authentication or billing consent. The future route
must also establish the existing verified client principal and explicit action.
Never place signing keys, raw bearer tokens, URLs containing them, cards or customer
contact details in logs/audit evidence. No signer provisioning is performed here.

- Day15/day20: `mode=subscription`, exact existing Price, quantity 1, explicit
  `subscription_data.trial_end` equal to canonical day30, cards collected, missing-method
  end behavior cancel. There is no `trial_period_days`, generic Payment Link, coupon,
  add-on, adaptive pricing or automatic tax calculation that changes the quoted total.
- Sessions live one hour. New/uncertain provider submission is allowed only in the
  first 15 minutes, leaving at least 45 minutes before expiry; adapters must use a bounded
  request timeout and re-check immediately before the wire call. Known open sessions may
  be returned until expiry. Late uncertain creation requires reconciliation, with no body
  mutation or replacement attempt. The conservative final 48h + 1h guard holds the workflow for
  assisted review rather than charge early or restart a trial. Near-deadline enrollment
  is intentionally unavailable in this patch; do not promise automatic day30 charging
  for a client who has not completed supported enrollment.
- On/after day30: an expired old token stays expired. A fresh authenticated binding and
  a new unchecked-by-default exact amount/currency/monthly recurring charge-now
  confirmation are required. Fresh Checkout transparently collects USD19/20 now and
  monthly thereafter, no trial and no retroactive charges. This is a later first charge
  after fresh consent, never a backdated day30 charge. Declining creates nothing.
- Before a provider request, persist a single reservation with deterministic idempotency
  key and the **exact request JSON**. Concurrent clicks serialize. Timeout remains
  `creating`; retry uses the identical key and body. Do not expire local reservations
  by wall clock: reconcile the real session before permitting another generation.
- Withdrawal persists suppression first. The provider cancellation adapter must resolve
  ambiguous creates, expire open sessions, and cancel only the exact owned subscription,
  without an extra prorated charge. Until its acknowledgment, show cancellation pending.
  It is not enough to delete a local link. A completed charge during a cancellation race
  requires human reconciliation; this code never invents a refund or reverses a charge.

## Webhooks and durable storage adapter

`billingService.webhook` verifies untouched body HMAC, timestamp tolerance, account scope
and live/test mode **before any storage/provider access**. Account-level events may omit
`event.account`; the endpoint credentials/account context must be pinned to the expected
account. Wrong connected account events are rejected. Metadata program is uniquely
`web_gratis_fixed_v1` so it cannot masquerade as the existing legacy program.

The event is a wake-up. Under a serializable per-lifecycle lock, retrieve its exact owned
session, latest subscription, and associated invoices from the pinned account. Verify
metadata, session/customer/subscription ownership, Price and fixed trial end. For invoice
wake-ups verify the triggering invoice's subscription/customer even when it failed.
Filter out zero-value invoices at the provider adapter; only actually paid, exact-positive
invoices enter this new ledger. Include the triggering paid invoice when applicable.
Do not blindly cast a webhook payload as the authoritative snapshot.

The `Repository` adapter is intentionally unimplemented while production access is
blocked. Its required invariants are:

1. Persist the aggregate and append audit entries atomically; lock/serialize by the full
   owner/tenant/signup/site identity and reject any mismatched state returned by lookup.
2. Unique owner/tenant/site lifecycle; never initialize two lifecycles for one site.
   Freeze plan/acceptance/go-live/trial end after go-live. Historical concepts get no backfill.
3. Unique provider account + session, subscription and invoice ownership across ALL tenants;
   exact attempt metadata lookup only. A customer ID alone cannot locate a lifecycle.
4. Commit event ID + body digest with the state/invoice writes, or roll all back. No
   “claim then mark processed” before effects. Retry a failed provider/DB transaction.
5. Deduplicate positive payments by invoice ID as well as event ID. Preserve paid-through
   monotonically. Canceled/expired subscriptions cannot be reactivated by a delayed event.
6. Persist webhook quarantine/error evidence for operational review without marking it
   processed. Return retryable non-2xx on transient failures; never ACK a failed write.
7. Reconcile events arriving before session-response persistence using the known durable
   attempt and exact signed metadata; never find another tenant by amount/reference alone.
8. Keep global provider uniqueness and per-record compare-and-set/transaction conflict
   coverage in an isolated DB emulator before production integration. In-memory fixture
   tests alone do not prove production transaction guarantees.

## Reminder and admin boundaries

`draftReminder` derives its URL from the configured authoring origin and freshly signed
binding. `prepareReminder` reserves an unsent draft with unique site/go-live/day key.
There is no sender. Future sender must re-check acceptance/reminder agreement, ownership,
opt-out, withdrawal, enrollment, cancel/failure state and the exact day window immediately
before sending. A pending checkout holds a setup reminder; a completed trial enrollment,
active/canceled/past-due/incomplete/paused subscription suppresses it. Recovery messages
are separate, require review, and never create a second subscription. No day28/day30
legacy reminder or pause may run for migrated lifecycles.

`BillingLifecycleCalendar` is a read-only component receiving already-authorized records
for one tenant. It shows client acceptance, Phil approval, commercial publication, fixed
trial end, day15/day20/first charge status, audit trail and next action. It is not mounted
on the live board. Mount only under existing admin authorization with filtered records.
The saved fixture HTML and Spanish drafts contain synthetic clients and placeholder URLs.
No real link or client message was generated or sent.

## Integration/activation gates and exact next step

**Concrete schema, transaction, identity, permissions, key names, sandbox prerequisites and
owner/engineering responsibilities are specified in [billing-activation-contract.md](billing-activation-contract.md).**

**Next:** the builder should review this additive patch on authoring `7495f13`, agree the
durable repository/provider adapter contract with the Sophia owner, and resolve the
verified signup-ID/client-auth binding in the already authorized workflow. Do not deploy
or turn on a flag: runtime adapters/routes are not installed by this patch.

Before any live activation:

- Resolve denied Sophia registry access through its original owner/access path. Do not
  retry via another task, account, API, credential, or privilege. No request was made here.
- Implement and fixture-test storage transactions, global ownership uniqueness, existing
  auth integration, cancellation recovery, and raw request webhook routing; provision
  nothing and change no grants/security under this source-only authorization.
- Route client acceptance and Phil approval separately; wire the accepted-go-live verifier
  to successful publication/public serving. Preserve the builder's site_only early return.
- Explicitly isolate opted-in new lifecycle tenants from legacy generic Payment Links,
  `markDelivered` free_until semantics, day28/day30 sends/pause rules, referral/revenue
  activation and legacy webhook handling. Review existing consumers before wiring.
- Mount the admin view and authenticated acceptance/charge-review pages; ensure affirmative
  exact-charge confirmation cannot be replayed across generations or be prechecked.
- Validate both prices and exact totals in the correct Stripe **test** environment using
  separately authorized test fixtures/test clocks (never live cards). Do not use live
  Price IDs as test prices. Verify the final-two-day behavior, SCA, failed payment,
  duplicate/out-of-order events and cancellation races end-to-end.
- Reconcile origin versus production and the held Sophia chain. Fix Sophia's existing
  route-export compatibility fixes are in a separate source patch; no blind cherry-pick of e6bb1a8.
- Obtain release/activation authorization after evidence review. Cron and sends remain off.

## References consulted

- Stripe [Checkout trials](https://docs.stripe.com/payments/checkout/free-trials?payment-ui=stripe-hosted): absolute trial_end and missing-payment-method behavior.
- Stripe [Checkout Session creation](https://docs.stripe.com/api/checkout/sessions/create): session expiry, customer association and metadata.
- Stripe [webhooks](https://docs.stripe.com/webhooks): signature verification, duplicate events, retries and ordering.

## Offline verification and known limits

69 authoring tests cover consent/approval, actual go-live, site_only no-op, immutable
deadlines, signed ownership/expiry, late exact confirmation, price/account/mode mismatch,
idempotency, concurrent clicks, timeout recovery, verified webhook duplicates/rollback/
out-of-order events, invoice ownership, cancellation, reminders, admin ownership and
snapshot minimization. Sophia adds 14 tests. The cross-repository fixture passes.

Scoped authoring lint and its isolated Next build pass. Builds use an empty environment
and synthetic localhost Supabase settings. No real credentials or environment files were
copied. The React SSR calendar is tested for content, ownership and escaping. A local
Chrome screenshot attempt could not launch in this sandbox, so visual/overflow validation
is not claimed. The generated HTML remains available for review.

Production PostgreSQL transactions, hosted Checkout, test-clock subscriptions, live
webhooks, channel templates, client-auth pages and end-to-end delivery are not validated.
These remain explicit activation gates. No existing database test scripts were run.

Fixture commands with dependencies already installed:

```sh
node --import tsx --test scripts/tests/website-lifecycle.test.ts scripts/tests/billing-calendar.test.tsx
node --import tsx scripts/tests/render-billing-calendar.tsx
```
