# SimmerDown — October payment and fixed November renewal

**Offline billing planner only. The separate October cash-collection link is owned by the
UI task; this worker has not rechecked its payment state or contacted the customer.**
No product, price, customer, Checkout Session, subscription or charge was created by
this task. No Stripe API, account setting, credential or permission was accessed.

The separate planner `src/lib/billing/simmerdown-october.ts` never imports the new-client
30-day website lifecycle. It reserves a request in a fixture state; it cannot execute it.

## Intended customer amounts

- USD 300.00 **today for October 2026 maintenance**, tax included, exactly once.
- Next full USD 300.00 on **November 1**, then USD 300.00 on every month's first.
- No prorated amount and no USD600 first bill. October is paid service.
- Proposed business timezone: **America/El_Salvador**. November 1, 2026 at midnight
  there is epoch **1793512800** (06:00 UTC). This is a parent-proposed assumption,
  not client-confirmed. Confirm timezone and billing instant before live activation.

## Supported Checkout candidate

The provider docs support subscription-mode Checkout containing a recurring Price plus
one-time Prices on the initial invoice. A fixed `subscription_data.trial_end` postpones
only the recurring component; a one-time item is still invoiced upfront. The exact
combined hosted flow remains to be tested in Stripe's sandbox.

Use:

- `mode: subscription`, verified existing SimmerDown customer and owner binding;
- line item quantity 1: existing USD300/month inclusive price
  **price_1UMaFfIS8EYk0ASLS0Tn1GfG**, product **prod_VNKvEtP59oLKBH**;
- when October is unpaid and the competing link is verified inactive, line item quantity1:
  verified one-time inclusive Price **price_1UMb2VIS8EYk0ASLlYJZGmsJ**, product
  **prod_VNLj77Hpcpw7F0**. The UI worker supplied these IDs; this task did not create them;
- `subscription_data.trial_end` = confirmed fixed November 1 instant;
- `payment_method_collection: always`, card required and missing-method end behavior cancel;
- explicit disclosure of the USD300 October charge plus the full USD300 future recurrence;
- no promotion codes, adaptive pricing, extra tax, add-ons or fees changing either total.

**Omit** `billing_cycle_anchor`, `proration_behavior` and `trial_period_days`. Checkout
forbids trial plus anchor, and forbids one-time items with `proration_behavior=none`.
The recurring component starts at the fixed trial end; it does not use prorated October
recurring charges. The technical `trialing` status does not mean October service is free.

Proposed Spanish disclosure:

> USD 300.00 hoy por mantenimiento de octubre de 2026, impuestos incluidos. Próximo
> cobro completo: USD 300.00 el 1 de noviembre de 2026; luego USD 300.00 cada día 1.
> Octubre no es gratis. No hay prorrateo ni otro cobro de octubre.

Obtain real customer consent to this exact amount/schedule independently of Phil's
setup approval. The price's inclusive tax behavior must be verified on **both** prices.
No new legal agreement or paid plan change is made by this document.

## Expiry, duplicate protection and receipts

Checkout sessions expire in one hour. First creation/retry submission is limited to the
first 15 minutes, leaving 45 minutes at submission. The future adapter must call
`assertSimmerSubmissionAllowed` immediately before its bounded provider request; late
uncertain attempts reconcile without changing the frozen body or billing date. Both the date and exact request
JSON are frozen under one account/customer/October-period reservation before provider
submission. Retries reuse the same idempotency key/body. Persist a unique lifecycle and
payment ledger across all workers; in-memory tests alone cannot ensure exactly once.

Use a conservative cutoff that expires the session before the fixed end is less than
48 hours away. Late October and stale November clicks hold for human review; never roll
the target forward, extend a relative trial, charge a surprise catch-up fee, or emit a
new session without reconciling an existing session's real provider status. This offline
candidate intentionally has no automatic replacement after an expired reservation.

Verify raw webhook signature/account/test-live mode, then fetch fresh authoritative
session/subscription/invoice data. Only call the offline receipt validator after verifying
all ownership and metadata. Initial invoice must have a paid total of 30000 USD cents,
the correct one-time October line at 30000, recurring component at 0, and the exact fixed
November trial end. Zero, unpaid, partial, USD600, wrong-owner, wrong-mode and changed-date
receipts must be held for review. Deduplicate by invoice ID and event ID. The October
paid receipt blocks every further October charge; a separately consented recurring-only
November enrollment remains possible.

Cancellation/3DS failure cannot be resolved by changing local state alone. Reconcile
provider state before retry or replacement; a failed initial October payment must not
silently leave an active recurring subscription. No handler or cancellation adapter for
this exception is wired live here.

## Exact activation gates / next step

The UI owner supplied the verified one-time Price. Actual customer binding, current paid
state and timezone remain unverified. Obtain explicit authorization for sandbox
validation (test objects/cards/test clock only) before treating the client link as ready.
This task is not authorized to do that provider execution.

Sandbox release criteria:

1. Hosted Checkout clearly shows USD300 due now and USD300 on the confirmed November 1;
   inspect Stripe's automatic “trial” wording so it cannot imply free October service.
2. Paid initial invoice contains exactly one October charge; advancing the test clock
   to November 1 and December 1 produces full USD300 invoices, no repeated October line.
3. Exercise duplicate clicks/events, unknown request outcome, expired/late links, 3DS,
   declined payment, cancellation during completion, and out-of-order events. No second
   October payment or accidental second subscription may be created.
4. Verify the live Price and sandbox Price identities are kept separate. Production
   Price IDs cannot be used as sandbox substitutes. No live card test.
5. Integrate a durable state store, signed customer-specific link, existing authenticated
   client action and exact provider receipt checks, then review before release. The
   generic reusable Payment Link is not validated for the fixed-date requirement.

## Primary sources checked

- [Trials with one-time invoice items](https://docs.stripe.com/billing/subscriptions/trials/free-trials#combining-trials-with-add_invoice_items): one-time amount upfront, recurring after the fixed trial end. This path is currently labeled legacy by Stripe; provider/API-version validation is therefore required before activation.
- [Checkout Session creation](https://docs.stripe.com/api/checkout/sessions/create): recurring and one-time lines in subscription mode; one-time lines only on the initial invoice; expiry range.
- [Billing-cycle anchors](https://docs.stripe.com/billing/subscriptions/billing-cycle): UTC anchoring, trial/anchor and one-time/proration restrictions.

## Independent review corrections

The planner requires `verifiedProductId` from a mode-specific trusted catalog. Live mode
pins both supplied live products and their respective Prices; test mode requires separately
verified test product bindings. The October item is a different product from the recurring item. Fixture IDs are synthetic, not production or
sandbox provisioning. There is no test-product or customer lookup in this patch.
See [billing-activation-contract.md](billing-activation-contract.md) for exact storage,
identity, key names and remaining responsibilities.

## October cash link and recurring-only path

UI task `01a103c9-553b-773b-a53f-d14e1879f0d4` supplied Payment Link
`plink_1UMb2zIS8EYk0ASLSwvGPI1l`. It was reported usage0of1 at creation and delivered to
Phil. **Current paid state was not rechecked.** Automatic Tax was reported enabled,
tax code10104001; the Price is inclusive. The receipt adapter must still verify the
actual total paid is exactly30000USDcents, not assume that from the configured price.
The cash link's Automatic Tax setting is not changed by this source planner.

`recordSimmerOctoberLinkPaid` accepts only a trusted freshly verified complete payment
Session, succeeded PaymentIntent, correct live link/price, exact amount and verified
owner/customer binding. Invoice ID is checked/deduplicated when present; Payment Links
without invoices dedupe by PaymentIntent and Session. A redirect or URL visit is not proof.
This reducer does not grant recurring consent. Actual signature/provider adapters are absent.

With that persisted receipt, `reserveSimmerDownCheckout` emits only the recurring Price,
zero due today, fixed November1, with Spanish disclosure that October is already paid.
Without payment, the combined path requires trusted owner authorization and proof within
five minutes that the competing one-time link is inactive. Missing proof holds the flow.
The adapter must re-check immediately before provider submission and serialize both paths
under the October record lock. A prior uncertain combined reservation remains held for
provider reconciliation; it is never silently replaced. Distinct paid receipts require
human duplicate-charge review. No automatic refund or compensating charge is implemented.

Sandbox-test both paths and their race:300 now/300 Nov1/300 Dec1, or already-paid300/zero
at setup/300 Nov1/300 Dec1. Never release two payable October paths concurrently.

Delayed enrollment reconciliation after November1 needs a separate reviewed adapter
recovery path for active/past_due/canceled snapshots and their owned invoices. The initial
recurring-only reducer deliberately accepts only trialing enrollment; do not ACK an
unapplied error or create a replacement/another October payment after that boundary.
