# Documentation Log

Entries are listed in reverse chronological order (newest first).

---
## 2026-08-23 — Knowledge Bundle Maintained

- **Type:** `maintain` pass by `docsmith/1.3.0`.
- **Audited & Maintained:**
  - `docs/SYSTEM_DESIGN.md`: Updated Section 2 (admin-driven ingestion control, RBAC requirements), Section 4 (`lib/auth.ts`, `pages/admin.tsx`, `routes/api/admin/*.ts`, `scripts/make-admin.ts` modules), Section 5 (`users.role` attribute and `INGESTION_RUNS` entity in ER diagram), Section 6 (four `/api/admin/*` endpoints), Section 7 (RBAC authorization model), and Section 9 (66-test suite coverage). Re-verified against live code.
  - `docs/interfaces/api-contracts.md`: Added admin ingestion, stats, and run history endpoint contracts.
  - `docs/guides/deployment-runbook.md`: Added Section 7 administrator role provisioning procedures.
  - `docs/index.md`: Registered the admin ingestion dashboard spec and implementation plan as implemented sources.
- **Live Verifications:**
  - Unit tests: `pnpm test` executed and verified (66/66 tests pass across 7 test suites).
  - Production build: `pnpm build` verified (SSR Worker and static PWA client bundles compile clean).
  - Browser verification: `/admin` access control, live `dry-run` ingestion execution, and DayStrip rendering verified in headless browser against the local dev server.

---
## 2026-08-23 — Admin Ingestion Dashboard Subsystem

- **Type:** Feature / Admin Control Subsystem.
- **Changes:**
  - `db/schema.ts` & migrations: Added `role` (`"admin" | "user"`) to `users` and created `ingestion_runs` table for auditing sync runs.
  - `scripts/make-admin.ts`: CLI utility (`pnpm run make-admin <username>`) for promoting users to admin with local D1 SQLite resolution.
  - `lib/auth.ts`: Implemented `adminGuard` for route authorization and updated auth responses to include user roles.
  - `lib/ingest.ts`: Enhanced ingestion engine with `sync`, `dry-run` (memory diff), and `hard-resync` (emergency overwrite) modes.
  - `routes/api/admin/`: Created `/api/admin/ingest`, `/api/admin/stats`, `/api/admin/runs`, and `/api/admin/runs/:id` endpoints; guarded legacy `/api/ingest`.
  - `pages/admin.tsx` & `pages/admin.server.ts`: Built interactive admin control center with live logs, diff summaries, and run history.
  - `pages/index.tsx`: Added Admin navigation affordance for authenticated administrators.
- **Live Verifications:**
  - Unit tests: `pnpm test` executed and verified (66/66 tests pass across 7 test suites).
  - Production build: `pnpm build` verified (SSR Worker and static PWA client bundles compile clean).
  - Browser verification: Tested `/admin` access control and live `dry-run` ingestion execution in headless browser against local server.

---
## 2026-08-22 — Knowledge Bundle Maintained

- **Type:** `maintain` pass by `docsmith/1.3.0`.
- **Audited & Maintained:**
  - `docs/SYSTEM_DESIGN.md`: Updated Section 3 (Void head management, viewport scaling, safe-area CSS tokens) and Section 8 (custom domain `dragoncon.martinrojas.dev`, observability). Re-verified against live code.
  - `docs/guides/deployment-runbook.md`: Updated sources citation (`wrangler.jsonc:1-41`).
  - `docs/index.md`: Verified all 5 concepts and 2 harvested sources; confirmed OKF v0.2 compliance.
- **Live Verifications:**
  - Unit tests: `pnpm test` executed and verified (8/8 tests pass).
  - Production build: `pnpm build` verified (SSR Worker and static PWA assets bundle clean).
  - Mobile viewport test: Verified against local dev server on Pixel mobile dimensions ($412\times 924$, scale $2.625$).

---

## 2026-08-22 — Mobile Viewport Scaling & Responsive Bottom Bar

- **Type:** Bugfix / Responsive Design.
- **Root Cause:** In Void Pages mode, missing `<meta name="viewport">` caused mobile browsers (Pixel / Android Chrome) to fall back to a 980px desktop emulation viewport. This scaled all text down to ~40% and prevented `@media (max-width: 768px)` from triggering, rendering the bottom navigation bar (`.cd-tabbar`) invisible.
- **Changes:**
  - `void.json`: Configured site-wide `head.meta` with `width=device-width, initial-scale=1, viewport-fit=cover`, `theme-color`, and PWA meta tags; configured site-wide `head.link` for stylesheet and webmanifest.
  - `pages/index.server.ts`: Exported `defineHead` for page metadata, avoiding duplicate `<link>` tag concatenation.
  - `public/cyberdragon.css`: Added `-webkit-text-size-adjust: 100%`, `min-height: 100dvh`, gesture navigation safe-area bottom insets (`env(safe-area-inset-bottom)`), touch action optimizations, and desktop header navigation (`.cd-nav-desktop`).
  - `components/CyberDragonUi.tsx`: Added top safe-area padding to `AppBar` and supported desktop navigation items.
  - `pages/index.tsx`: Cleaned up stray inline `<link>` tags, added desktop nav tabs, and set dynamic safe-area bottom padding.
  - `db/seed.ts`: Updated sample seed script with Dragon Con 2026 events.

---


## 2026-08-22 — Cloudflare Observability & Web Analytics

- **Type:** Feature / Telemetry.
- **Changes:**
  - `wrangler.jsonc`: Added complete `observability` configuration (logs enabled, invocation logs, trace settings, and head sampling).
  - `pages/index.tsx`: Integrated dynamic Cloudflare Web Analytics beacon script loader supporting SPA route tracking via `VITE_CF_BEACON_TOKEN` or `window.__CF_BEACON_TOKEN`.
  - `.env.example`: Documented `VITE_CF_BEACON_TOKEN`.
  - `docs/guides/deployment-runbook.md`: Added Section 6 on Cloudflare Web Analytics setup.

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

Docs-freshness: head=d427349910e602fadbd8221966fa4328b7887d88 date=2026-08-23 pass=maintain
