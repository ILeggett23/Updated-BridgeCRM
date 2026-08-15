# BridgeCRM

BridgeCRM is a local-first, offline relationship CRM and installable PWA. This
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
- A Cloudflare account only when deliberately developing or deploying the optional hosted API

## Quick start

```bash
git clone <your-private-repository-url> BridgeCRM
cd BridgeCRM
npm install
npm run dev
```

Open <http://localhost:4173>. Bridge opens directly without a sign-in screen.
The ordinary development server stores data in browser localStorage and
IndexedDB; it does not write to production D1 or R2.

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

The optional Cloudflare Worker provides legacy accounts, sync, hosted
scorecards, push notifications, and backups. It is not required to run the
GitHub Pages or local web app:

```bash
cp .dev.vars.example .dev.vars
npm run cloudflare:migrate:local
npm run cloudflare:dev
```

Open <http://localhost:8787> to work on the optional API. The standalone app
does not load its account client, so it remains local-first even when that
Worker is available.

## Architecture

- `src/index.html`, `src/styles.css`, `src/app.js`: production presentation and
  application shell
- `src/*-logic.js`: contacts, engagement, communications, analytics,
  relationship health, network, scorecard, and release logic
- `src/account-client.js` and `src/server/account-runtime.js`: retained optional
  hosted-account implementation; neither is loaded by the standalone app
- `src/sw.js`, `src/manifest.webmanifest`: PWA cache, notifications, navigation,
  and install behavior
- `drizzle/`: ordered D1 schema migrations
- `db/schema.ts`: schema reference
- `build.mjs`: produces `dist/` and the Cloudflare Worker bundle
- `dev.mjs`: dependency-free local development server
- `tests/`: Node test suite

The CRM opens without an account and persists data in browser localStorage and
IndexedDB. Pipeline stage definitions and analytics remain in the production
application logic; this migration does not change them. Use Bridge's JSON
backup/export tools to move local data between browsers or devices.

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
Git or `wrangler.jsonc`. They are unnecessary for the standalone web app.

## Build output

`npm run build` creates:

- `dist/index.html` and static PWA assets, suitable for any static host
- `dist/server/index.js`, suitable for Cloudflare Workers

The build intentionally does not emit `.openai/hosting.json` or any ChatGPT
Sites project metadata.

## Deployment

The frontend can be hosted on GitHub Pages, Cloudflare Pages, Netlify, Vercel,
or any static HTTPS host. GitHub Pages needs no account, database, secret, or
Cloudflare service to open and use the CRM.

Pushes to `main` automatically build and publish the standalone frontend with
the GitHub Pages workflow. The public site is available at
<https://ileggett23.github.io/Updated-BridgeCRM/> after the deployment finishes.

Before publishing a new frontend origin:

1. deploy the static `src/` files;
2. verify the PWA installation and browser-local persistence;
3. keep an exported JSON backup of important local data.

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
- Local browser records stay on the device unless explicitly exported.
- Export a JSON backup before clearing browser data or moving to another device.
- The legacy hosted deployment stays available independently of this standalone
  GitHub Pages application.

## GitHub

Use `main` as the default branch. GitHub Actions runs the same npm build and test
suite on pushes and pull requests.
