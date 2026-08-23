# Documentation Log

Entries are listed in reverse chronological order (newest first).

---
## 2026-08-23 — Knowledge Bundle Maintained & Sources Harvested

- **Type:** `maintain` pass by `docsmith/1.3.0`.
- **Audited & Maintained:**
  - `docs/SYSTEM_DESIGN.md`: Updated Section 4, 5, 6, 9, 10 with feedback and error boundary modules, database entities (`feedback`), API routes (`/api/feedback`), and 91-test coverage across 11 test suites. Re-verified against live code.
  - `docs/interfaces/api-contracts.md`: Documented `/api/feedback` endpoint schemas and automated error dispatch mechanism.
  - `docs/guides/deployment-runbook.md`: Synchronized workflow citations and source line ranges.
  - `docs/index.md`: Certified and removed all historical design specs and implementation plans; registered all 11 test suites.
- **Harvest & Deletion:**
  - Certified `docs/superpowers/specs/2026-08-22-cyberdragon-companion-app-design.md` as `✓ harvested (safe to delete)` and removed.
  - Certified `docs/superpowers/plans/2026-08-22-cyberdragon-companion-app.md` as `✓ harvested (safe to delete)` and removed.
  - Certified `docs/superpowers/specs/2026-08-23-admin-ingestion-dashboard-design.md` as `✓ harvested (safe to delete)` and removed.
  - Certified `docs/superpowers/plans/2026-08-23-admin-ingestion-dashboard.md` as `✓ harvested (safe to delete)` and removed.
- **Live Verifications:**
  - Unit tests: `pnpm test` executed and verified (91/91 tests pass across 11 test suites).
  - Production build: `pnpm build` verified (SSR Worker and static PWA client bundles compile clean).

---
## 2026-08-23 — Automated Bug Reporting & Global Error Boundary Recovery

- **Type:** Feature / Reliability & Observability.
- **Changes:**
  - `lib/errorReporting.ts`: Implemented automated error dispatching to `/api/feedback`, stack trace sanitization & truncation (<=2000 chars, sensitive token & password redaction), deduplication by signature, session rate limiting (max 3/session), and `setupGlobalErrorCatchers` for `window.onerror` and `window.onunhandledrejection`.
  - `components/ErrorBoundary.tsx`: Built CyberDragon glass fallback UI displaying diagnostic information, automated dispatch confirmation, and user recovery options ("Reload Application", "Try Again", "Clear Cached Data & Reload").
  - `pages/index.tsx` & `pages/admin.tsx`: Wrapped main app and admin trees in `<ErrorBoundary>` and registered global error catchers on mount.
  - `pages/admin.tsx`: Added `AUTO-REPORT` badge indicator on feedback items originating from automated reports.
  - `tests/error-reporting.test.ts` & `tests/error-boundary.test.ts`: Added 10 unit tests verifying error formatting, token redaction, deduplication, rate limits, error boundary state machine, and silent failure resilience (91/91 tests pass).
---
## 2026-08-23 — PWA Management & Attendee Feedback Subsystem

- **Type:** Feature / UX Enhancement.
- **Changes:**
  - `lib/version.ts`: Added canonical `APP_VERSION = "1.0.0"` exported constant, synchronizing footer display and feedback payloads.
  - `db/schema.ts` & `db/migrations/20260823193024_tough_catseye.sql`: Added `feedback` D1 table with support for bug reports and suggestions.
  - `routes/api/feedback.ts`: Implemented `POST /api/feedback` (public submission, length & kind validation, User-Agent header capture) and `GET /api/feedback` (adminGuard protected).
  - `components/AppStoragePanel.tsx`: Created plain-English PWA storage management panel with Add to Home Screen (beforeinstallprompt + iOS fallback), Save For Offline (warming caches with shell & all 11 map PNGs), Free Up Space (cache-only wipe preserving auth/settings), Check For Updates, and status readout.
  - `components/FeedbackPanel.tsx`: Built in-app feedback submission form with bug/idea segmented picker, 2000-char live counter, and instant visual confirmation.
  - `pages/index.tsx`: Integrated both panels into signed-in Profile view; captured `beforeinstallprompt` and standalone mode in top-level mount effect; removed obsolete `OFFLINE CACHE` panel.
  - `pages/admin.tsx`: Added `💬 ATTENDEE FEEDBACK` panel for administrative review of submissions.
  - `tests/feedback.test.ts`: Added 8 test cases verifying validation, contact normalisation, 401/403 access control, and database persistence (81/81 tests pass).
  - `docs/interfaces/api-contracts.md`: Documented `/api/feedback` endpoints.

---
## 2026-08-23 — Offline Venue Floor Plans & Core-Apps Integration

- **Type:** Feature / UX Enhancement.
- **Changes:**
  - `public/maps/`: Scraped and bundled high-res offline floor plan images for all 11 host venues and shuttle routes (Marriott, Hyatt, Hilton, Westin, Courtland Grand, AmericasMart B2/B3, Convention Footprint, and shuttles).
  - `lib/maps-data.ts` & `lib/maps.ts`: Implemented venue-to-map matching, exact booth polygon coordinate lookups, SVG polygon point formatters, and official Core-Apps deep link generators.
  - `components/VenueMapModal.tsx`: Created interactive offline floor plan modal with zoom (+, -, reset), pan/drag, glowing SVG room polygon highlight overlays, and centroid pin markers.
  - `components/PanelDetailModal.tsx`: Replaced misleading estimated capacity metric with clickable "VENUE FLOOR MAP" card trigger and added "⭐ RATE SESSION ↗" button linking directly to the official Core-Apps event page.
  - `tests/maps.test.ts`: Added unit tests covering venue matching, exact booth lookups, fallback handling, URL generation, and polygon centroid calculations (73/73 tests pass).

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

Docs-freshness: head=de18a14bc183dd6623ef5341d2eb5e4fbba1310c date=2026-08-23 pass=maintain
