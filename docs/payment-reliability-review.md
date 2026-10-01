# Payment durability review — 2026-10-01

Base: `143138e84939f87402acb8b450f35b4c41538a07`.

The webhook now rejects ledger, billing-issue, outbox-enqueue and completion
failures so Stripe can retry. Confirmed payments are inserted before changing
signup state, preserving first-payment/reactivation classification on retry.
The ledger remains unalerted until the outbox acknowledges it. The recovery
sweep and webhook share an outbox key, so either can recover an unfinished
notification without queuing a second alert. Replays use the durable payment
coverage, payment timestamp and kind, preserving reactivation warnings. Recovery
alerts retain build/form warnings and prompt staff to check WhatsApp history
when the sweep wins the race with the detailed webhook alert.

Run `node --test tests/payment-reliability.test.cjs`. These are offline tests
of the actual handler with an in-memory PostgREST boundary and captured alerts.
Do not run the existing `scripts/web-gratis-d5` suite against a real database:
it creates test rows and is outside this change's authorization.

## Remaining recovery work

This is retry-based durability, not a cross-table transaction. A process crash
between the ledger and signup writes still needs Stripe redelivery. The existing
event lease also treats a concurrent still-processing delivery as a duplicate;
a later redelivery or reconciliation is needed after a crashed processing
attempt whose failed-state write also fails. An alert
acknowledgment means accepted by the outbox, not delivered to Telegram/email.
Existing processed events with missing ledger rows and historically premarked
alerts are not repaired by this patch. Referral-credit alert recovery is a
separate existing path and is not made transactional here.

Proposed follow-up, not executed: reconcile a sanitized Stripe event/invoice
export with ledger external IDs, event states and outbox dedupe keys. Produce
a dry-run report with unique IDs and proposed actions before replaying events.
Use a separate reviewed migration if moving the ledger/signup/outbox writes
into one transactional database function. Do not infer historical payments
from today's signup state or bulk-reset processed events.

## Cancellation and payment-screen proposal

Source inspection confirms that a failed or cancelled Stripe subscription
sets `billing_issue`, while `/pagar/[code]` can still display the generic active
screen. This is a source defect, not evidence of current failed payments.

The bounded next change should show the recorded billing issue and a recovery
action while preserving service access and sold terms. A failed subscription
should use an authenticated customer-specific billing-portal session to update
its payment method; an arbitrary new subscription can double-charge a customer.
A cancelled subscription should be rechecked with Stripe before presenting a
resubscribe action. The public referral code alone must not disclose a billing
portal session. Customer verification and portal configuration need review.

No grace period, suspension rule, pricing, deployed configuration, or database
policy was changed. Staff decides service access under existing customer terms.

## Build verification

The board's disabled-button selector is scoped to `.page`, fixing webpack's
CSS-module purity error without changing its intended board styling.
The first hosted preview compiled and type-checked, then failed prerendering
`/espanol` because its module eagerly constructed Supabase without a configured
URL. The shared browser client is now lazy and optional. Español keeps its
existing local-storage persistence when cloud configuration is absent; VoxLink
retains its existing connection-error response instead of reporting a saved
waitlist entry. All client call sites obtain the client inside their handlers.

`npm run build -- --webpack` passes with an empty environment and no Supabase
configuration. No live configuration is loaded. Default local Turbopack
validation was blocked by this executor's sandbox.
The payment suite passes 17/17 and the optional-client suite passes 3/3.
The unchanged payment baseline failed 13 of the initial 15 regression tests;
two additional cases cover interleaved newer payments.
