# Billing activation contract — source proposal, not applied configuration

This document replaces the earlier broad “approved storage/auth integration” gate with
specific work and prerequisites. The SQL, transaction/provider adapters, authenticated
handler factories, recovery and signed projection are implemented in source. No SQL, grants,
keys, deployed routes, scheduler or sender are installed. All runtime wiring is inactive.
See [runtime integration](billing-runtime-integration.md) for exact callable entry points.

## Chosen storage design

Use a private `billing_private` PostgreSQL schema in the **authoring** database. Authoring
is the canonical writer; Sophia consumes a signed, minimal read-only projection. Do not
add billing timestamps to the existing signup/site tables or backfill their publication
history. Do not modify existing `free_until`, acceptance, legacy event tables or policies.

The current `Repository.transaction(identity, callback)` requires a real PostgreSQL
connection and row transaction. A series of Supabase REST `select`/`update` calls or an
in-process mutex does not satisfy it. Implemented adapter: an explicitly injected `pg` Pool
client with `BEGIN ISOLATION LEVEL SERIALIZABLE`, full-identity `SELECT ... FOR UPDATE`,
rollback on every callback error, and all projections committed together. This is an
engineering selection; Phil does not need to choose table names. A different CAS/RPC design
would require changing and re-reviewing the service contract, not silently swapping adapters.

The following is the exact proposed first migration. Types are PostgreSQL. `NN` means
NOT NULL. No public PostgREST exposure or browser RLS policy is added. Use application-
allocated deterministic IDs; do not provision UUID extensions or create database roles.

| Table | Columns and constraints |
|---|---|
| `billing_private.records` | `record_key text PK`; `program text NN CHECK IN ('web_gratis_fixed_v1','simmerdown_october2026_v1')`; `account_id text NN CHECK = 'acct_1QvaObIS8EYk0ASL'`; `livemode boolean NN`; `owner_id text NN`; `tenant_id text NN`; `signup_id uuid NULL REFERENCES public.web_gratis_signups(id) ON DELETE RESTRICT`; `site_id uuid NULL REFERENCES public.web_gratis_sites(id) ON DELETE RESTRICT`; `client_id text NULL`; `billing_period text NULL`; `revision bigint NN DEFAULT 0 CHECK >=0`; `state jsonb NN CHECK jsonb_typeof(state)='object'`; `created_at timestamptz NN`; `updated_at timestamptz NN`. Website requires signup/site and NULL period; SimmerDown requires client and period='2026-10', NULL signup/site. Unique partial indexes `(account_id,livemode,site_id)` for website and `(account_id,livemode,client_id,billing_period)` for SimmerDown. |
| `billing_private.identity_bindings` | `record_key text NN FK records ON DELETE RESTRICT`; `role text NN CHECK IN ('client','operator')`; `issuer text NN`; `subject text NN`; `verified_at timestamptz NN`; `verified_by text NN`; `evidence_ref text NN`; `revoked_at timestamptz NULL`; PK `(record_key,role,issuer,subject)`. Lookup only by server-verified issuer/subject, never browser owner/tenant fields. |
| `billing_private.customer_bindings` | `account_id text NN`; `livemode boolean NN`; `customer_id text NN`; `owner_id text NN`; `tenant_id text NN`; `client_id text NN`; `verified_at timestamptz NN`; `evidence_ref text NN`; PK `(account_id,livemode,customer_id)`. This permits reuse by the same verified owner/client, never cross-tenant reassignment. |
| `billing_private.attempts` | `record_key text NN FK records`; `attempt_id text PK`; `generation integer NULL`; `kind text NN CHECK IN ('trial','charge_now','combined','recurring_only')`; `request_json text NN`; `request_sha256 char(64) NN`; `created_at_epoch bigint NN`; `expires_at_epoch bigint NN`; `submit_before_epoch bigint NN`; `status text NN CHECK IN ('creating','open','complete','expired')`; `session_id text NULL`; `url text NULL`. Unique `(record_key,generation)` where generation IS NOT NULL. Unique partial index on `record_key` where status IN ('creating','open','complete'). Freeze request JSON/digest, ID, generation, kind and times after insert. Website maps `Lifecycle.attempts`; SimmerDown maps `SimmerState.request`. |
| `billing_private.provider_objects` | `account_id text NN`; `livemode boolean NN`; `object_kind text NN CHECK IN ('session','subscription','invoice','payment_intent')`; `object_id text NN`; `record_key text NN FK records`; `attempt_id text NULL FK attempts`; `evidence_digest char(64) NN`; PK `(account_id,livemode,object_kind,object_id)`. Ownership immutable; globally claim objects in the same transaction as receipts. Customer ownership is in customer_bindings, not this per-record registry. |
| `billing_private.webhook_events` | `account_id text NN`; `livemode boolean NN`; `event_id text NN`; `body_sha256 char(64) NN`; `record_key text NN FK records`; `event_type text NN`; `provider_created_epoch bigint NN`; `applied_at timestamptz NN`; PK `(account_id,livemode,event_id)`. Insert only with successful state/ledger writes. Same ID plus changed digest is a conflict, not a duplicate success. No raw webhook/contact data retained. |
| `billing_private.payments` | `account_id text NN`; `livemode boolean NN`; `payment_key text NN`; `record_key text NN FK records`; `invoice_id text NULL`; `payment_intent_id text NULL`; `session_id text NN`; `source text NN CHECK IN ('subscription_invoice','one_time_link')`; `billing_period text NULL`; `cents integer NN CHECK >0`; `currency text NN CHECK = 'usd'`; `paid_at_epoch bigint NN`; `service_period_end_epoch bigint NULL`; `receipt_digest char(64) NN`; PK `(account_id,livemode,payment_key)`; require invoice_id OR payment_intent_id. Unique partial indexes on `(account_id,livemode,invoice_id)` and `(account_id,livemode,payment_intent_id)` when present; unique `(record_key,billing_period)` when billing_period='2026-10'. Payments/invoices cannot be counted twice under different event IDs. |
| `billing_private.audit` | `record_key text NN FK records`; `sequence bigint NN`; `at_epoch bigint NN`; `kind text NN`; `actor_subject text NN`; `evidence_ref text NN`; `correlation_id text NN`; PK `(record_key,sequence)`. Append-only. Evidence references contain no signing keys, bearer URL/token, card details or contact payload. |
| `billing_private.reminder_outbox` | `record_key text NN FK records`; `go_live_epoch bigint NN`; `day smallint NN CHECK IN (15,20)`; `due_epoch bigint NN`; `window_end_epoch bigint NN`; `status text NN CHECK IN ('drafted','held','dispatching','sent','failed','suppressed')`; `template_revision text NN`; `link_generation integer NN`; `provider_message_id text NULL`; `updated_at timestamptz NN`; PK `(record_key,go_live_epoch,day)`. CHECK due=go_live+day*86400 and window_end=due+86400. Store template fields and generation, never the raw signed URL. No sender or schedule is enabled. |

Use a **separate empty test database/schema deployment**, not test rows in production.
The livemode dimension is defense in depth. All epoch fields use integer seconds; all
wall timestamps use timestamptz. Calendar formatting never changes trial deadlines.

Implemented migration functions/triggers (unapplied SQL in `sql/001-billing-private.sql`):

1. `billing_private.enforce_record_binding()` verifies website site.signup_id equals the
   record.signup_id on insert, and forbids any identity/program/account/mode change.
   Once state.goLiveAt is non-null, freeze plan, acceptance, approval, goLiveAt, trialEnd,
   publicationEvidence. CHECK fixed `trialEnd = goLiveAt + 2592000`; acceptance/approval
   both exist and their times are <= goLiveAt. Forbid go-live without both and preserve
   the initial all-null state. Strict Zod state validation runs before persisted
   state is used and before every aggregate write; malformed payloads fail closed.
2. `billing_private.enforce_attempt_immutability()` rejects frozen-request updates; only
   status/session/url may change after insert. An unknown timed-out create is not marked
   expired merely by the clock. A fresh authoritative provider reconciliation must prove
   it expired without an owned active subscription before allowing another attempt.
3. `billing_private.reject_ledger_mutation()` rejects UPDATE/DELETE on payment/event/audit
   receipts and provider ownership. Corrections append audit/quarantine evidence rather
   than rewrite accepted events. Unique violation must not be treated as success until
   ownership and digest match. No blanket ON CONFLICT DO NOTHING.

The adapter commits aggregate, attempts, provider ownership, paid receipts, event IDs,
audit and outbox changes atomically. Integration must mark the program selection before
any legacy billing action; legacy workers must check authoritative `records` membership
and fail closed when that check fails. An accepted website record must not also execute
legacy generic-link, free_until, day28/day30, pause, referral or revenue side effects.
There is no deletion-based escape from the one-lifecycle/one-October constraints.
The membership helper is a point-in-time check. The release owner must quiesce/drain
legacy work during canonical enrollment or coordinate initialization and legacy effects
with shared site-scoped exclusion; the helper alone does not close that migration race.

## Exact access and configuration prerequisites — names only

No values were read and none of these proposed names were configured/generated.

| Name / permission | Status and purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Existing source names. Existing REST client may read authorized signup/site records, but cannot implement the JS transaction callback. No new use or access is assumed. |
| `WEB_BILLING_DATABASE_URL` | **Proposed**, server-only pooled PostgreSQL connection for an already authorized server principal. Availability/role is unverified. Do not reuse an admin password or create a role automatically. |
| `WEB_BILLING_LINK_SIGNING_KEY` | **Proposed**, independent server-only HMAC key, at least32 bytes of entropy; separate test/live values. Current library only receives an injected string. No creation or rotation authorized here. |
| `STRIPE_SECRET_KEY_WEB_BILLING` | **Proposed**, server-only key for the approved account and environment. Provider adapter needs Account read/identity verification, Products/Prices and Payment Links read, Customers read/create as required, Checkout Sessions read/write/expire, Subscriptions read/write/cancel, Invoices, pending InvoiceItems, PaymentIntents and Charges read. Payment Link deactivation stays with its authorized UI owner; no Payment Links write scope is assumed. No refunds, payouts, balances, transfers, Product/Price writes, card storage, account changes or plan purchases. Restricted-key feasibility must be verified by its authorized owner; do not silently broaden. |
| `STRIPE_WEBHOOK_SECRET_WEB_BILLING` | **Proposed**, separate test/live endpoint signing secret. Raw request body verification; no browser use. Legacy `STRIPE_WEBHOOK_SECRET_WEBGRATIS` remains separate. |
| `WEB_GRATIS_ADMIN_TOKEN` | Existing shared admin bearer. May retain existing admin access; **insufficient to identify Phil** or authenticate client consent. Do not give it to clients or mint “Phil” from possession. |
| `SESSION_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` | Existing Sophia token signing names. Extraction preserves both behavior and fallback byte-for-byte. This task neither reads nor changes either. Sophia venue identity alone is not a website binding. |
| `WEB_GRATIS_BRIDGE_SECRET` | Existing bridge name. Before adding a billing projection, owner must confirm existing authorized scope permits it. Sign exact body + timestamp and enforce replay/freshness/tenant checks. Do not obtain new Sophia registry scope as a workaround. |
| `CRON_SECRET` | Existing name only. No billing job, cron entry, queue dispatcher, channel key or template send is activated. Sending needs a separately reviewed activation decision. |
| `WEB_BILLING_ORIGIN`, `WEB_BILLING_LIVEMODE`, `WEB_BILLING_STRIPE_ACCOUNT`, `WEB_BILLING_MICHOACANA_SIGNUP_ID` | **Proposed nonsecret configuration names**: canonical HTTPS origin, explicit mode, pinned account, verified exception UUID. Missing/unknown means held; never infer exception by display name. |
| `WEB_BILLING_TEST_PRICE_20`, `WEB_BILLING_TEST_PRICE_19`, `SIMMERDOWN_TEST_PRODUCT_ID`, `SIMMERDOWN_TEST_OCTOBER_PRODUCT_ID`, `SIMMERDOWN_TEST_RECURRING_PRICE_ID`, `SIMMERDOWN_TEST_OCTOBER_PRICE_ID`, `SIMMERDOWN_OCTOBER_PRICE_ID` | **Proposed nonsecret catalog references** supplied by authorized owner/UI worker. Every object must be retrieved and verified in the authorized environment before use; no test/live substitution. Live recurring references are pinned in source. |

Exact future DB grants: migration executor needs CREATE on the database (only if the
private schema does not exist), schema ownership/CREATE for tables/functions/triggers,
and REFERENCES/SELECT on `public.web_gratis_signups` and `public.web_gratis_sites`.
Runtime principal needs CONNECT, USAGE on billing_private, SELECT/INSERT/UPDATE on
records/identity_bindings/customer_bindings/attempts/reminder_outbox, SELECT/INSERT only
on provider_objects/webhook_events/payments/audit, and SELECT on the referenced public
signup/site columns. No runtime DELETE/TRUNCATE/CREATE/ALTER, no sequence grants (IDs
are assigned), no anon/authenticated/browser grants, no new Sophia table privileges.
The authorized DB owner must resolve the **existing** principal name and which grants
already exist. Grant changes are a future security action and remain outside this task;
the source proposal is not approval to apply them. No role name or existing grant is guessed.

## Identity and human decisions

The route adapter must independently establish `(issuer,subject,role)` and join a verified
`identity_bindings` record to derive owner/tenant/signup/site. Signed billing links prove
integrity, not identity. Query params, submitted IDs, WhatsApp phone and editable business
names cannot grant authority. GET never accepts terms or creates a paid subscription;
mutation pages require explicit POST, CSRF/origin protection and uncached private responses.

Implemented, unmounted route contract: GET `/web/billing` authenticates and
shows the canonical agreement/quote or late exact-charge confirmation; POST
`/api/web-gratis/billing/accept`, `/checkout`, and `/withdraw` apply explicit client commands.
POST `/api/web-gratis/billing/approve` requires the attributable Phil operator. The main
builder owns the accepted-go-live publication callback; do not modify site_only.
POST `/api/web-gratis/billing/webhook` receives only raw signed Stripe events. GET
`/api/admin/web-gratis/billing-calendar` filters by verified operator binding before
returning records. Paths are proposals, not deployed endpoints; reuse of any existing
path must first be checked for conflicts and legacy middleware/caching behavior.

Required facts from the existing authorized owner workflow:

- Verified immutable Michoacana signup UUID; site/signup/tenant/owner mapping for every
  enrolled client. The three published concepts stay unaccepted with null clocks.
- A verified **client** authentication subject and authority to accept for that business;
  a separately attributable **Phil** operator subject. Existing shared admin bearer and
  venue login do not complete these mappings. If no approved individual identity path
  exists, selecting/provisioning one is an explicit user/security decision, not an
  engineer's permission workaround. Do not infer consent from publication or operator approval.
- Real approval/consent evidence from each client, approved unchanged agreement revision,
  exact quote and reminder consent; Phil's source-work authorization is not this evidence.
- For SimmerDown, actual Stripe customer and billing timezone/time. **Unverified assumption:**
  America/El_Salvador, November1 midnight = `1793512800`. October payment proves payment,
  not acceptance of recurring billing. Verify the actual one-time Price supplied by UI task
  `01a103c9-553b-773b-a53f-d14e1879f0d4`; do not create a duplicate object. The link was delivered to Phil by that task; usage0of1 was observed only at creation.
  Current paid state is unverified here.

Sophia registry denial remains a hard boundary. Resolve it only through the original
owner/access path; this proposal needs no registry read to be finished offline.

## SimmerDown two-path safeguard

Before offering a combined Checkout, the implemented adapter reconciles all owned October
one-time-link, invoice and subscription payments for the verified customer into the
unique October ledger. A Payment Link can have no invoice: use verified Checkout Session
+ succeeded PaymentIntent and invoice when present, never just a redirect or screenshot.

- October unpaid, no outstanding payment attempt: one USD300 inclusive October line plus
  the recurring USD300 line deferred to fixed November1.
- October already paid: preserve immutable receipt; **recurring-only** USD300 line with
  fixed November1, `amount_total=0` at setup, no October add-on. Require independent explicit
  monthly-schedule consent. Receipt duplicates are no-ops only when the exact identity and
  digest match. A distinct second October receipt goes to human duplicate-charge review.
- An unresolved earlier combined session must be reconciled/expired first. Do not clear
  the reservation locally and create another session. Never expose two payable October
  paths concurrently; once the UI cash link is released, hold the combined path until
  reconciliation proves it cannot also collect. No automatic refund or compensation.

## Test environment requirements and exact acceptance evidence

Only a separately authorized **test-mode** environment of account
`acct_1QvaObIS8EYk0ASL` matches current account pins. A separate Stripe Sandbox with a
different account ID requires explicit owner approval and a reviewed account-binding
change; it must not be swapped silently. Test credentials/objects cannot be provisioned
under the current no-provider authorization. The UI/backend owner supplies them later.

Require distinct test USD19/20 monthly Prices, distinct SimmerDown test product bindings for
USD300 inclusive recurring and one-time Prices, synthetic test Customers and test payment
methods, test-clock capability, a test webhook endpoint and its signing secret, and an
isolated test DB. No real client details, live card or live IDs used as test objects.
Pin and record Stripe API/SDK version before validating the legacy-compatible absolute
trial_end path; source type checking is not a provider acceptance test.

Engineering acceptance report must show: two concurrent clicks give one Session;
unknown create outcome before/after 15-minute cutoff; immutable day30 at day15/day20;
no unsupported final48h setup; exact confirmed post-day30 charge with no backbilling;
SCA, missing card, failed invoice, cancellation/withdrawal races; duplicate/out-of-order
webhooks and atomic DB rollback/global ownership conflicts; zero trial invoices excluded;
service periods derived from owned subscription lines; credits/tax/discounts cannot alter
exact quoted charges. Verify signed raw-body transport and cross-tenant auth/CSRF.

For SimmerDown test BOTH paths: (1) exactly300 now,300 Nov1,300 Dec1; (2) verified prior
one-time300, zero at recurring setup,300 Nov1,300 Dec1. Replay the one-time payment and
subscription invoices; simulate late link payment racing an existing combined Checkout;
prove no second October attempt is released. Review hosted Spanish wording and receipt
line items. The receipt reducer and runtime also reconcile delayed active/past_due/canceled snapshots
after November1 using fresh owned invoices/current subscription. A verified initial combined
invoice failure cancels the owned deferred subscription without a proration or new invoice;
its terminal retry never records a payment. Pending authentication stays held. Unapplied
errors receive a non-2xx response; no replacement October payment is offered.
Clock timestamps alone do not establish successful payment. Browser inspection
must verify the acceptance/admin pages; local SSR tests are not visual QA.

## Who can finish what

**Completed offline engineering:** nine-table SQL and trigger artifact; strict persisted
state validation; serializable PostgreSQL adapter; concrete pinned Stripe REST adapter;
raw signed webhook mapping; authenticated client/operator handler factories and CSRF
checks; fresh actual serving proof; legacy exclusion helper; unsent outbox; operator
recovery; signed Sophia projection; synthetic HTTP/storage/provider integration tests.
No runtime route imports these factories. Tests use a synthetic SQL engine, not PostgreSQL.

**Remaining release engineering:** main builder mounts the handler factories with the
approved identity verifier and agreement text, emits the two serving-proof headers,
and calls `runLegacyUnlessFixed` before every legacy billing/send effect. Sophia owner
integrates `signedWebsiteBillingContext` at the already-authorized bridge boundary.
Then validate the SQL and concurrency in an isolated PostgreSQL instance and exercise
hosted Checkout/test clocks in the authorized test environment. These integration points
are outside this branch's ownership; they are not missing storage/provider code.

**Owner/user facts or authorization required before execution:** provide verified identity
bindings and attributable Phil/client auth path; obtain actual client agreement; confirm
SimmerDown customer/timezone and UI-created one-time Price; authorize required test account
access/object fixtures/webhook and database grants/key provisioning if not already present;
settle Stripe live account readiness (country/bank-holder still unverified in this handoff);
resolve the original Sophia registry gate; authorize release and, separately, sends/cron.
No new paid plan, changed legal agreement or new security scope is presumed.

**Release owners:** main builder `01a0fe29` reconciles authoring baseline7495f13 against
main/production and owns renderer/Duran/release. Sophia owner integrates the read contract
and separate route-export fix against current main plus held e6bb1a8 after diff review.
No blind cherry-pick, overwrite or deploy. All three billing patches remain gated.

**Minimal next step:** release owner reviews the runtime patch and provides the approved
identity verifier contract plus immutable client/Michoacana mapping. The UI owner supplies
current October payment/customer/timezone evidence. Integrate the explicit hooks in source;
keep routes inactive until isolated DB/Stripe test evidence and release authorization exist.
The one-time Price `price_1UMb2VIS8EYk0ASLlYJZGmsJ`, product `prod_VNLj77Hpcpw7F0` and link
`plink_1UMb2zIS8EYk0ASLSwvGPI1l` are pinned from the UI owner's report. No objects need creation here.
