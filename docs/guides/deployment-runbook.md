---
type: Guide
title: Cloudflare Deployment & D1 Operations Runbook
description: Step-by-step runbook for provisioning, migrating, and deploying the CyberDragon app on Cloudflare Workers and D1.
tags: [guide, runbook, cloudflare, deployment, d1, ci]
generated: { by: docsmith/1.3.0, at: 2026-08-23T20:05:00Z }
verified: [{ by: docsmith/1.3.0, at: 2026-08-23T20:05:00Z }]
status: stable
maintainer: CyberDragon Engineering
sources:
  - id: wrangler-config
    resource: wrangler.jsonc:1-47
    title: Cloudflare Workers, custom domain, D1 database binding, and resource-limit configuration
  - id: ci-workflow
    resource: .github/workflows/ci.yml:1-44
    title: Pull request and push test/build CI workflow
  - id: deploy-workflow
    resource: .github/workflows/deploy.yml:1-48
    title: Cloudflare deployment CI/CD workflow
  - id: package-scripts
    resource: package.json:8-16
    title: Deployment and database migration npm scripts
  - id: make-admin-script
    resource: scripts/make-admin.ts:1-169
    title: Admin promotion CLI script
---

# Cloudflare Deployment & D1 Operations Runbook

> Operational procedures for building, provisioning, migrating, and deploying the CyberDragon Companion App on Cloudflare Workers.

---

## 1. Prerequisites

- Node.js 20+ and pnpm 10+
- A Cloudflare account with Workers and D1 enabled
- Wrangler authenticated locally (`npx wrangler login`) or a Cloudflare API Token with *Workers Scripts: Edit* and *D1: Edit* permissions.

---

## 2. Initial Setup & Resource Provisioning

1. **Authenticate Wrangler:**
   ```bash
   npx wrangler login
   ```
2. **Create Remote D1 Database:**
   ```bash
   pnpm exec wrangler d1 create dragoncon-2026-db
   ```
3. **Configure `wrangler.jsonc`:**
   Ensure `wrangler.jsonc` specifies the generated `database_id`, binding `"DB"`, and `"migrations_dir": "./db/migrations"` [^wrangler-config].
4. **Generate Initial Migrations:**
   ```bash
   pnpm run db:generate
   ```
5. **Execute First Deploy:**
   ```bash
   pnpm run deploy
   ```

---

## 3. Routine Deployment

To deploy local changes to production:

```bash
# 1. Verify tests pass
pnpm test

# 2. If app code or assets changed, bump CACHE_NAME in public/sw.js
#    (see AGENTS.md "PWA Cache Versioning") so installed clients refetch

# 3. Build and deploy
pnpm run deploy
```

---

## 4. Database Schema Changes & Migrations

When altering tables in `db/schema.ts`:

1. **Generate Migration SQL:**
   ```bash
   pnpm run db:generate
   ```
2. **Apply Migrations Locally (for dev testing):**
   ```bash
   pnpm run db:migrate
   ```
3. **Commit the Migration:**
   Commit the newly generated SQL file in `db/migrations/` to git.
4. **Deploy to Production:**
   Running `pnpm run deploy` automatically detects and applies pending D1 migrations to the remote database before activating the new Worker version [^package-scripts].

---

## 5. GitHub Actions Continuous Integration & Deployment

The repository includes two automated workflows:
1. **CI (`.github/workflows/ci.yml`)**: Runs on pull requests and pushes to `main`. Automatically installs dependencies, executes unit tests (`pnpm test`), and runs the production build (`pnpm build`).
2. **Deploy (`.github/workflows/deploy.yml`)**: Runs on push to `main` (and manual dispatch). Validates tests and builds before deploying the Worker and applying remote D1 migrations via `pnpm run deploy`.

### Required Secrets & Variables
In GitHub Settings $\to$ Secrets and variables $\to$ Actions:
- `CLOUDFLARE_API_TOKEN` (Secret): Cloudflare API token with *Workers Scripts: Edit* and *D1: Edit* permissions.
- `CLOUDFLARE_ACCOUNT_ID` (Secret/Variable): Cloudflare account ID.
- `CF_BEACON_TOKEN` (Optional Secret/Variable): Cloudflare Web Analytics site token (injected into client build as `VITE_CF_BEACON_TOKEN`).
Pushing to `main` executes the deployment workflow automatically.

---

## 6. Cloudflare Web Analytics Setup

1. **Create Web Analytics Site in Cloudflare:**
   - Navigate to **Analytics & Logs $\to$ Web Analytics** in the Cloudflare Dashboard.
   - Click **Add a site** and enter your hostname (e.g. `dragoncon-2026.martin-d28.workers.dev`).
   - Copy the generated 32-character token from the beacon tag (`data-cf-beacon='{"token": "..."}'`).

2. **Configure Token:**
   - In `.env` (or CI environment variables): set `VITE_CF_BEACON_TOKEN=<your-token>`.
   - The application automatically injects the Cloudflare Web Analytics beacon script on client mount with `"spa": true` for client-side navigation tracking.

---

## 7. Administrator Role Provisioning

To promote any registered user account to Administrator for access to `/admin` and ingestion controls [^make-admin-script]:

```bash
pnpm run make-admin <username>
```

- **Local Dev Execution:** The tool automatically identifies the active SQLite database in `.void/v3/d1/miniflare-D1DatabaseObject/` matching the latest WAL/SHM mtime and migrated `role` column.
- **Manual Database Override:** Set `D1_SQLITE_PATH=/path/to/db.sqlite` if targeting a specific database file.
- **Remote Production:** In production D1, update the user row directly via Wrangler:
  ```bash
  pnpm exec wrangler d1 execute dragoncon-2026-db --remote --command "UPDATE users SET role = 'admin' WHERE username = '<username>';"
  ```

---

## 8. Workers Paid Plan & Resource Limits

The Free plan's 50-subrequest-per-invocation ceiling is too low for a full schedule sync (~900 events across 7 con days, each needing its own detail-page fetch). The Worker runs on the **Workers Paid plan** ($5/mo base) for Dragon Con 2026 con-week traffic, with explicit resource ceilings in `wrangler.jsonc` [^wrangler-config] so a bug or an oversized manual run can't run away:

```jsonc
"limits": {
  "cpu_ms": 10000,     // 10s ceiling per invocation (Paid default is 30s)
  "subrequests": 2000  // covers a multi-day sync; Paid default is 10,000
}
```

1. **Upgrade the account:** Cloudflare dashboard (dash.cloudflare.com) → **Workers & Pages** → **Plans** (self-serve "Activate"/"Upgrade" prompt on the Free plan) → subscribe to **Workers Paid** with a payment method on file. This is an account-level, self-serve change; it cannot be done via Wrangler or the API.
2. **Set a budget alert (informational only):** **Billing** → **Billable Usage** → **Create budget alert**. Cloudflare has no hard spend cap on Workers usage — a budget alert only emails a warning past a chosen threshold, it does not pause or block the Worker.
3. **Downgrade after the con:** Switch back to the Workers Free plan once Dragon Con 2026 con-week traffic ends (after Sep 7) to stop the recurring $5/mo charge. `runIngestion()` (`lib/ingest.ts`) already self-throttles to `DEFAULT_DETAIL_FETCH_BUDGET` event-detail fetches per invocation regardless of plan, so downgrading needs no code change.
