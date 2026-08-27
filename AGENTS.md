# CyberDragon Companion App

> Mobile companion PWA for Dragon Con 2026 in Atlanta, GA. Built with React 19 SSR, Hono, Void, and Cloudflare Workers with D1 SQLite.

Last updated: 2026-08-26

## Project Overview

CyberDragon is an offline-capable schedule browser and personal con assistant. Key capabilities include con-floor pedestrian and skybridge walk-time calculations between host venues, room line capacity heuristics, daily stamina load meters, schedule conflict alerts, WebAuthn passkey authentication, and ICS export.

## Quick Start

```bash
# Install dependencies
pnpm install

# Start local development server (with hot reload & local D1 SQLite)
pnpm dev

# Run unit tests
pnpm test

# Build production bundles (SSR Worker + client PWA assets)
pnpm build

# Deploy to Cloudflare Workers + D1
pnpm run deploy
```

- **Safe read-only test path:** `pnpm test` runs isolated walk-time and capacity heuristic unit tests without touching the database.
- **Database operations:** `pnpm run db:generate` generates migration SQL; `pnpm run db:migrate` applies migrations locally.

## Architecture (Summary)

The app compiles into a Cloudflare Worker (`dist/ssr/index.js`) serving server-rendered React pages (`pages/index.tsx`, `pages/index.server.ts`) and Hono file-based API endpoints (`routes/api/`), backed by a Cloudflare D1 SQLite database (`dragoncon-2026-db`) and static PWA assets (`dist/client`).

For full architecture details: `docs/SYSTEM_DESIGN.md`.

## Conventions

- **Route Handlers:** Every endpoint in `routes/api/**/*.ts` must wrap its handler in `defineHandler` from `void` and export uppercase HTTP constants (`export const GET = defineHandler(...)`, `export const POST = defineHandler(...)`).
- **Database:** Define tables in `db/schema.ts` using `void/schema-d1` and `void/db`. Never write raw migration SQL by hand; use `pnpm run db:generate`.
- **Styling:** Use CyberDragon Glass design tokens in `public/cyberdragon.css` (Space Grotesk `var(--font-core)`, JetBrains Mono `var(--font-mono)`, `--canvas`, `--surface-glass-strong`, `--purple-600`, `--gold-500`, `--coral-500`).
- **Commits:** Follow conventional commit messages (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).

## Communication style

- Concise, technical, task-focused, and lead with the action.
- Verify changes against real execution and ground truth before asserting success.

## Docs

Start here: `docs/SYSTEM_DESIGN.md`. Full map: `docs/index.md`.

| When working on... | Read first |
|---|---|
| Venue walk times & capacity formulas | `docs/rules/walktime-and-venues.md` |
| API endpoints, admin ingestion & WebAuthn passkeys | `docs/interfaces/api-contracts.md` |
| Cloudflare Workers & D1 deployment | `docs/guides/deployment-runbook.md` |
| Architecture decisions & rationale | `docs/decisions/0001-cloudflare-d1-self-host.md` |

## Project Policies

### Code Quality & Testing
- New domain logic or calculation algorithms must include unit tests in `tests/`.
- All pull requests must pass `pnpm test` and `pnpm build` before merging.

### PWA Cache Versioning
- Any commit or PR targeting `main` that changes app code or assets must bump `CACHE_NAME` in `public/sw.js` (e.g. `dragoncon-pwa-v1` → `v2`), otherwise installed clients keep serving the stale cached bundle.

### Security & Data Sensitivity
- Never commit credentials, tokens, or private keys to the repository.
- Use GitHub repository secrets (`CLAUDE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) for CI deployment.
- Passwords are never stored in plaintext (salted SHA-256); WebAuthn credentials use public key cryptography.

### Documentation Maintenance
1. When altering architecture, interfaces, or domain rules, update the matching doc in `docs/`.
2. Keep `docs/index.md` synchronized whenever creating, moving, or deleting documentation.
3. Rewrite documentation to reflect current state; do not append historical change logs to evergreen design docs.
4. Record session milestones and updates in `docs/log.md`.
