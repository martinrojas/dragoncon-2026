# Documentation Log

Entries are listed in reverse chronological order (newest first).

---

## 2026-08-22 — GitHub Actions CI & CD Setup

- **Type:** Infrastructure / DevOps.
- **Configured Workflows:**
  - `.github/workflows/ci.yml`: Automated CI workflow for pull requests and main branch pushes. Installs dependencies (`pnpm install --frozen-lockfile`), runs walk-time and capacity heuristic unit tests (`pnpm test`), and verifies production builds (`pnpm build`).
  - `.github/workflows/deploy.yml`: Updated action pins (`actions/checkout@v6`, `pnpm/action-setup@v5`, `actions/setup-node@v6`), added pre-deploy test/build verification, and enabled `workflow_dispatch`.
- **Documentation:** Updated `docs/guides/deployment-runbook.md` with CI workflow details.

---

## 2026-08-22 — Knowledge Bundle Established

- **Type:** `establish` pass by `docsmith/1.3.0`.
- **Created Documentation Bundle:**
  - `AGENTS.md`: Scaffolding tool-agnostic working agreements, commands, conventions, and routing pointers.
  - `CLAUDE.md`: Normalized to `@AGENTS.md` reference line.
  - `docs/SYSTEM_DESIGN.md`: Evergreen 13-section system architecture with live-verified Mermaid diagrams.
  - `docs/rules/walktime-and-venues.md`: Atlanta con-floor walk time matrix, skybridge routes, and line heuristics.
  - `docs/interfaces/api-contracts.md`: Hono API route request/response contracts and passkey WebAuthn flow.
  - `docs/decisions/0001-cloudflare-d1-self-host.md`: Architecture Decision Record for Cloudflare Workers + D1 self-host deployment.
  - `docs/guides/deployment-runbook.md`: Operations and deployment runbook for Cloudflare Workers and D1 database.
  - `docs/index.md`: OKF v0.2 canonical knowledge map and source registry.
- **Harvest & Certification:**
  - Harvested and certified `docs/superpowers/specs/2026-08-22-cyberdragon-companion-app-design.md` as `✓ harvested (safe to delete)`.
  - Certified `docs/superpowers/plans/2026-08-22-cyberdragon-companion-app.md` as `✓ harvested (safe to delete)`.
- **Live Verifications:**
  - Unit tests: `pnpm test` executed and verified (8/8 tests pass).
  - Production build: `pnpm build` verified (SSR Worker and static PWA assets bundle clean).
  - Cloudflare deployment: Verified live on `https://dragoncon-2026.martin-d28.workers.dev` with live D1 database `dragoncon-2026-db`.

Docs-freshness: head=8a4e77b718b420e81fda3247252a5f7dda3c5b70 date=2026-08-22 pass=establish
