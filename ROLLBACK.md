# BridgeCRM Authentication Migration Rollback

Rollbacks must preserve browser storage, D1 rows, R2 objects, password hashes,
sessions, push subscriptions, and scorecards. Never drop account tables or
rewrite repository history during an incident.

## GitHub Pages

- Repository: `ILeggett23/Updated-BridgeCRM`
- Pre-migration main commit: `4f9b6754304e3b93dcb0454b913e28009fb2c620`

To restore GitHub Pages without rewriting history:

1. Create a normal rollback commit on `main` whose frontend tree matches the
   pre-migration commit.
2. Push that new commit through the existing GitHub Pages workflow.
3. Verify the live site serves the intended asset version and can still open
   local browser data.

Do not force-push `main`.

## Cloudflare Worker

- Worker: `bridge-crm-api`
- Pre-migration production version: `2378bc53-824a-478b-aacf-e93060d603cf`
- D1: `bridge-crm-production` (`bd66b909-f134-40ba-a847-960c7f04249d`)
- Pre-migration Time Travel bookmark:
  `00000088-00000000-000050d2-4003526a1b833d1c9d56e5d2799530b9`

Roll back the Worker with `wrangler rollback 2378bc53-824a-478b-aacf-e93060d603cf`
or deploy that version through the versions workflow. Disable `AUTH_ENABLED`
first only if the account gate itself is preventing access.

Do not restore D1 merely because application code was rolled back. If a data
restore is independently required, validate the bookmark/export and expected
row counts before using D1 Time Travel.

## Data Safety

- Keep migration `0005` recorded if it has been applied; the older Worker can
  ignore the additional `analytics` record type.
- Keep `bridge-crm-user-backups` private and do not delete objects during a
  code rollback.
- Compare account, session, token, sync, backup, push, and scorecard row counts
  with the pre-migration inventory before any data recovery.
- Test rollback behavior with a disposable account before reopening signup.

Neither ordinary rollback path requires a data migration. Keep the existing
localStorage, IndexedDB, D1, notification subscription, and backup formats
intact.
