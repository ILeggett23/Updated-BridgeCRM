# ChatGPT Sites to standalone migration

## Provenance

The standalone tree was copied from the active BridgeCRM Human Network source
at commit `9f1eff12685ea6f0a08d12c8b8e0b3bcad20df2a` (release `1.3.2`). The original
ChatGPT Site and its source checkout were not modified.

## Dependency inventory

| Area | Current implementation | Sites dependency | Standalone status |
| --- | --- | --- | --- |
| UI, routes, styles, logic, tests | Static HTML/CSS/JavaScript in `src/` | None | Fully materialized |
| Anonymous persistence | localStorage and IndexedDB on each browser | None | Fully portable; data remains device-local |
| PWA and foreground reminders | Manifest and service worker in `src/` | None | Fully portable on HTTPS/localhost |
| Accounts and sessions | Bridge email/password API in the Cloudflare Worker | None; it is not Sign in with ChatGPT | Portable Worker code included |
| Signed-in sync | Cloudflare Worker + D1 | Not a Sites runtime API | Code/schema included; production data remains hosted |
| Account backups | Private `USER_BACKUPS` R2 bucket | Not Sites-managed in the active config | Code included; objects remain hosted |
| Secure scorecards | Cloudflare Worker + D1 | Active clients use the configured Worker API | Portable code included; rows remain hosted |
| Hosted Web Push | Worker, D1, VAPID secrets, cron | Active clients use the configured Worker API | Portable code included; subscriptions remain hosted |
| Email verification/reset | Cloudflare Email binding | None | Portable code included; provider binding remains hosted |
| Abuse protection | Cloudflare Turnstile | None | Portable code included; widget/secret remain hosted |
| ChatGPT Sites metadata | `.openai/hosting.json` with project `appgprj_6a793402c17081919585875d5aaf5beb` and a `DB` binding | Yes | Removed from standalone build and repository |

The active frontend config points API traffic to
`https://bridge-crm-api.bridgecrm-zayway.workers.dev`. Its HTML marks
`bridge-cloud-state` as disabled, so the normal application does not use the
legacy same-origin `/api/state` store. Nevertheless, the Sites-bound D1 database
must be treated as potentially containing historical push, scorecard, or state
rows until it is inspected and backed up.

## Production data locations

1. **Browser storage**: anonymous contacts, conversations, follow-ups, places,
   settings, analytics history, achievements, and reminder data exist on each
   browser/PWA installation. A repository migration cannot copy this data.
2. **Cloudflare D1 `bridge-crm-production`**: accounts, password/session hashes,
   sync records and revisions, migrations, push subscriptions/deliveries,
   scorecards, rate limits, and backup metadata.
3. **Cloudflare R2 `bridge-crm-user-backups`**: logical user backup objects.
4. **Potential Sites D1 binding `DB`**: inspect and export before retirement even
   though release 1.3.2 routes active cloud features to the external Worker.
5. **Provider configuration**: Worker variables/secrets, Email binding,
   Turnstile widget, VAPID keys, cron, D1 binding, and R2 binding are not stored
   in Git.

No production secrets or data were copied into the standalone project.

## Safe migration plan

### Phase A — portable development (complete)

- Keep the current Site online.
- Use this GitHub repository as the code source of truth.
- Develop locally with `npm run dev` or local Worker/D1 with
  `npm run cloudflare:dev`.
- Continue using the existing Worker API for the current production Site.

### Phase B — inventory and backups (required before cutover)

1. Record the deployed Worker version and all non-secret bindings.
2. Create and verify a D1 backup/export of `bridge-crm-production`.
3. List the R2 objects and copy them to an owner-controlled recovery location.
4. Inspect/export the Sites-managed `DB` binding separately.
5. Export a signed-in account and at least one anonymous device snapshot through
   BridgeCRM's existing export UI.
6. Confirm record counts for contacts, places, conversations, follow-ups,
   pipeline history, analytics, scorecards, push subscriptions, and backups.

### Phase C — new frontend origin

1. Deploy the static `dist/` output to the new HTTPS origin.
2. Add the exact origin to the Worker `ALLOWED_ORIGINS` value.
3. update `PUBLIC_APP_URL`, Turnstile hostnames, and email links;
4. verify account login, sync in both directions, scorecard create/read/revoke,
   push subscribe/schedule/click navigation, and PWA update/install behavior;
5. compare real record counts and pipeline stage values before and after reload.

### Phase D — optional infrastructure move

If D1/R2 will move to another Cloudflare account or provider, restore a copy in
staging first. Preserve identifiers, revisions, tombstones, token hashes,
ownership, timestamps, and object keys. Run all migrations, validate checksums
and counts, then schedule a controlled write freeze and final delta transfer.
Do not run two writable production databases without an explicit replication or
cutover protocol.

### Phase E — retire Sites only after acceptance

Retire the ChatGPT Site only after the new origin passes mobile/PWA, account,
sync, notification, scorecard, and data-count acceptance checks and the backups
have been restored successfully in a test environment. Keep a rollback URL and
the last known-good Worker deployment during the acceptance window.

## Remaining hosted dependencies

The repository is independent of ChatGPT Sites for development. Full production
operation still requires the configured Worker platform services (D1, R2,
Email, Turnstile, cron, and Web Push secrets). Those can remain on Cloudflare or
be migrated separately; moving them is a data/infrastructure cutover, not a
source-code copy.
