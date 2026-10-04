# MachineMind integration reconciliation — 2026-10-04

This record describes the reconciled source prepared for the owner's approved release. Billing runtime routes/calendar remain unmounted, and this source work changes no schema, grants, credentials, cron, sends or provider/customer state. Actual release status belongs in the deployment verification record. All previous release checkouts and the original reviewed billing patch bundle remain intact.

## Source lineage

GitHub `Showowt/machinemind-landing` main was observed at `6e8e74531062e083d15a9287c47feb69c80d6bac`. Its two newer message-burst commits share base `99984638d658ad9d4b373af099689435d43f933a` with the previously verified authoring release. Main does not contain that release's reviewed-content editor or `site_only` publication path.

Branch `codex/authoring-reconciled-2026-10-04` preserves current main and applies:

| Original | Reconciled commit | Purpose |
| --- | --- | --- |
| `7495f13ea673b779f3a67bb771adb26740e916ec` | `383dc35440b93bd1c9dd17dff6a8e55547772a91` | Preserve reviewed asset/content import and publication without delivery/trial effects. |
| `29bcfde1a09ac3cfa2fc3379974cfb55dd0dae40` | `0819c189206caff02149bca224ad225e141be9a4` | Preserve the reviewed, inactive billing runtime and fresh signup eligibility guard. |
| `8f8b94b` | `c70bee4dc5eea014545c1da819f9de059978803d` | Fix equivalent client-acceptance retries after a lost response. |

The submit route, bridge and existing media-lock migration from current main remain byte-identical. All 11 prior publication/editor files are retained. The only new behavioral change beyond the earlier billing integration is the acceptance HTTP normalization below. The renderer candidate remains separately pinned at `450fda3b016a98ab6df647e8f5dd416ee54610dc`; its source was not changed in this resumption.

## Acceptance retry correction

Before the fix, identical acceptance POSTs at T and T+1 returned 200 then 409: the HTTP handler hashed the current time, while the core correctly required stable evidence to recognize a duplicate. The durable acceptance was safe, but a client retry after losing the successful response appeared to fail.

The handler now derives a server-owned fingerprint from the record key, verified issuer/subject and exact normalized agreement fields. It excludes request time and caller-supplied evidence. Equivalent JSON/form submissions preserve the first acceptance timestamp and the single audit record, with no publication, trial, reminder, checkout or payment effect. Changes to terms, quote, version, reminder choice or actor still fail. Existing post-go-live and withdrawal locks remain unchanged.

The JSON request schema is unchanged. This correction does not migrate or reinterpret previously stored evidence; any existing record must continue to pass the core's exact comparison. No acceptance was backfilled.

## Local verification

- 162 synthetic billing tests pass, including 10 new acceptance cases.
- 111 existing authoring regressions pass for assets, content import, site-only publication, payments and optional Supabase behavior.
- Full Next.js webpack production build passes with an empty process environment and synthetic localhost configuration.
- Strict TypeScript and scoped changed-file ESLint pass.
- Independent source reviews cleared both reconciliation and the acceptance correction.

Normal flows cover client acceptance plus separate operator approval, served go-live, day-15/day-20 reminder drafts and fixed day-30 billing behavior. Repeated flows cover equivalent form/JSON requests, duplicate go-live and payment events. Interrupted flows cover lost responses and provider timeouts/recovery. Failure flows cover storage rollback, altered consent, revoked/foreign identity, failed/out-of-order payments and suspended signup proof. No live reminder or charge was sent. Synthetic fixtures do not prove hosted database/provider behavior.

## Production and release gates

Fresh production reconciliation subsequently succeeded through the same connector's verified default context. Explicit `teamId` calls returned 403, but default-context project listing, aliases and deployment reads resolve the exact existing account and projects. The authenticated user is `showowt`, whose default team is `team_M6Muze7c2ZvOaH8CcRMsq0HF`. No permission change, new credential or alternate private-data access was needed. Authoring production is `dpl_8z7UETXnnGRurvmhQdz1mtCEv2o9` at `6e8e745`; the renderer remains `dpl_FyhzupKsH7ULLRQWCZ9NV4ugbgvf`, previously source-verified at `35e9cb1`. The newer authoring deployment confirms the need to restore the prior reviewed-content and `site_only` paths while retaining its message-burst fixes.

Before deployment or activation:

1. Project metadata access and source reconciliation are complete. The owner authorized deployment of the verified fixes to the existing authoring and `mm-sites` projects. Keep billing handlers unmounted until the remaining gates below are met; release verification must capture actual deployment/alias results.
2. Approve an attributable individual identity verifier at the billing origin; provide immutable owner/tenant/signup/site mappings, actual client and Phil subjects, and the verified Michoacana exception UUID. Shared board credentials and matching phone/name do not establish these facts.
3. Obtain real agreement/version/quote acceptance and separate approval. `site_only` publication never implies consent or starts the 30-day clock.
4. Wire legacy exclusion before every old billing/send effect and coordinate enrollment with queued and in-flight work. The current helper and fresh signup read do not supply that coordination.
5. Validate the proposed SQL/permissions and concurrency in an authorized isolated database; validate pinned-account provider fixtures and browser acceptance. No schema was applied here.
6. Reconcile Sophia's signed projection and held work through its owner. Verify SimmerDown customer, timezone, paid receipt and recurring schedule consent separately.

See [runtime integration](billing-runtime-integration.md) and [activation contract](billing-activation-contract.md). Activation of billing routes, cron, sends and charging remains held behind these gates; deployment of the independently verified publication/renderer fixes is authorized. No new paid plan or project is required by this source correction.
