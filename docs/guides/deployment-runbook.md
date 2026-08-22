---
type: Guide
title: Cloudflare Deployment & D1 Operations Runbook
description: Step-by-step runbook for provisioning, migrating, and deploying the CyberDragon app on Cloudflare Workers and D1.
tags: [guide, runbook, cloudflare, deployment, d1, ci]
generated: { by: docsmith/1.3.0, at: 2026-08-22T06:15:00Z }
verified: [{ by: docsmith/1.3.0, at: 2026-08-22T06:15:00Z }]
status: stable
maintainer: CyberDragon Engineering
sources:
  - id: wrangler-config
    resource: wrangler.jsonc:1-19
    title: Cloudflare Workers and D1 database binding configuration
  - id: deploy-workflow
    resource: .github/workflows/deploy.yml:1-28
    title: Cloudflare deployment CI/CD workflow
  - id: package-scripts
    resource: package.json:10-15
    title: Deployment and database migration npm scripts
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

# 2. Build and deploy
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

## 5. GitHub Actions Continuous Deployment

The repository includes `.github/workflows/deploy.yml` [^deploy-workflow].

### Required Secrets
In GitHub Settings $\to$ Secrets and variables $\to$ Actions:
- `CLOUDFLARE_API_TOKEN`: Cloudflare API token.
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account ID.

Pushing to `main` executes the deployment workflow automatically.
