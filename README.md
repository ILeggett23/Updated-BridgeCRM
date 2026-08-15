# BridgeCRM

BridgeCRM is a private, offline-first relationship CRM and installable PWA. This
repository is the standalone source tree copied from the deployed BridgeCRM
Human Network application at release `1.3.2` (source commit
`9f1eff12685ea6f0a08d12c8b8e0b3bcad20df2a`). It does not require ChatGPT Sites
to build, test, or run locally.

The existing ChatGPT Site remains online during migration. Do not remove it
until the production data checks in
[docs/chatgpt-sites-migration.md](docs/chatgpt-sites-migration.md) are complete.

## Requirements

- Node.js 22 or newer
- npm 10 or newer
- A modern browser for the PWA
- A Cloudflare account only when developing or deploying the hosted API

## Quick start

```bash
git clone <your-private-repository-url> BridgeCRM
cd BridgeCRM
npm install
npm run dev
```

Open <http://localhost:4173>. The ordinary development server uses browser
storage and a small local state endpoint; it does not write to production D1 or
R2.

Available commands:

```bash
npm run dev                 # local PWA development server
npm run build               # static frontend + Cloudflare Worker bundle
npm test                    # complete automated suite
npm run check               # build and complete automated suite
npm run cloudflare:dev      # local Worker, D1, API, and PWA
npm run cloudflare:deploy:dry
```

## Local full-stack development

The Cloudflare Worker provides accounts, sync, secure scorecards, hosted push
notifications, and backups. To run it locally without touching production:

```bash
cp .dev.vars.example .dev.vars
npm run cloudflare:migrate:local
npm run cloudflare:dev
```

Open <http://localhost:8787>. On that origin the frontend automatically uses the
local Worker API. Keep `AUTH_ENABLED=false` for normal local CRM work. Enabling
accounts requires the development secrets and services described in
[CLOUD_ACCOUNTS.md](CLOUD_ACCOUNTS.md).

## Architecture

- `src/index.html`, `src/styles.css`, `src/app.js`: production presentation and
  application shell
- `src/*-logic.js`: contacts, engagement, communications, analytics,
  relationship health, network, scorecard, and release logic
- `src/account-client.js`: IndexedDB-backed account session and offline sync
  queue
- `src/server/account-runtime.js`: authentication, accounts, sync, backup, and
  account-management API runtime
- `src/sw.js`, `src/manifest.webmanifest`: PWA cache, notifications, navigation,
  and install behavior
- `drizzle/`: ordered D1 schema migrations
- `db/schema.ts`: schema reference
- `build.mjs`: produces `dist/` and the Cloudflare Worker bundle
- `dev.mjs`: dependency-free local development server
- `tests/`: Node test suite

The CRM remains usable without an account. Anonymous data is persisted in
browser localStorage and IndexedDB. Signed-in data is cached locally and synced
through the Worker to D1. R2 stores logical user backup objects. Pipeline stage
definitions and analytics remain in the production application logic; this
migration does not change them.

## Configuration

`.env.example` documents the complete environment contract. Copy it to `.env`
when overriding the development port or frontend API base. Wrangler reads local
Worker values from `.dev.vars`; copy `.dev.vars.example` and never commit either
resulting file.

Important variables:

| Variable | Purpose |
| --- | --- |
| `PUBLIC_APP_URL` | Absolute frontend URL used in links and notifications |
| `ALLOWED_ORIGINS` | Comma-separated frontend origins allowed by the API |
| `AUTH_ENABLED` | Enables the account UI/API gate |
| `AUTH_HASH_PEPPER` | Secret used by password hashing |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Signup/reset abuse protection |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Hosted Web Push credentials |
| `AUTH_EMAIL_FROM` / `AUTH_EMAIL_NAME` | Verification and reset sender |
| `BRIDGE_API_BASE` | Optional frontend API override for a custom host |

Production secrets belong in the deployment provider's secret manager, not in
Git or `wrangler.jsonc`.

## Build output

`npm run build` creates:

- `dist/index.html` and static PWA assets, suitable for any static host
- `dist/server/index.js`, suitable for Cloudflare Workers

The build intentionally does not emit `.openai/hosting.json` or any ChatGPT
Sites project metadata.

## Deployment

The frontend can be hosted on GitHub Pages, Cloudflare Pages, Netlify, Vercel,
or any static HTTPS host. The existing Cloudflare Worker can remain the API
during the staged migration.

Before publishing a new frontend origin:

1. add that exact origin to `ALLOWED_ORIGINS`;
2. set `PUBLIC_APP_URL` to the new HTTPS URL;
3. add the hostname to the Turnstile widget;
4. verify account email links, scorecards, Web Push, sync, and PWA installation;
5. keep the ChatGPT Site online until D1/R2 and browser-data checks pass.

For a new Cloudflare account, create a D1 database and private R2 bucket, update
the non-secret binding identifiers in `wrangler.jsonc`, store secrets with
Wrangler, apply every migration in `drizzle/`, and run the dry deployment before
publishing. Never point a new deployment at production storage until a verified
backup and explicit cutover plan exist.

See [CLOUD_ACCOUNTS.md](CLOUD_ACCOUNTS.md) for security and operations and
[docs/chatgpt-sites-migration.md](docs/chatgpt-sites-migration.md) for the
source-to-standalone dependency and data inventory.

## Data safety

- No production data is stored in this Git repository.
- Local browser records stay on the device unless explicitly exported or
  migrated through the signed-in sync flow.
- D1 and R2 must be backed up before changing bindings or retiring the Site.
- The old Site deployment must remain available until the standalone frontend
  has been verified with real accounts and data.

## GitHub

Use `main` as the default branch. GitHub Actions runs the same npm build and test
suite on pushes and pull requests. Keep the repository private while it contains
deployment topology and operational documentation.
