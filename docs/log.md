# Documentation Log

Entries are listed in reverse chronological order (newest first).

---
## 2026-08-29 — Admin Dashboard Modularization & Component Decomposition

- **Type:** Refactor (code structure & maintainability — decomposed 1,325-line monolith into dedicated subcomponents).
- **Scope & Architecture:**
  - `pages/admin.tsx`: Refactored into a concise coordinator (~360 lines) orchestrating data loading, sync execution, and state transitions while maintaining 100% backwards compatibility for exported types (`User`, `IngestionRun`, `FeedbackItem`, etc.) and `formatRunTimestamp`.
  - `components/admin/adminTypes.ts`: Centralized shared types, constants (`FEEDBACK_ACTIONS`, `DAY_OPTIONS`), and `formatRunTimestamp`.
  - `components/admin/AdminAccessDenied.tsx`: Extracted restricted view and admin login form.
  - `components/admin/AdminMetricsCards.tsx`: Extracted D1 database overview statistics cards.
  - `components/admin/AdminIngestControls.tsx`: Extracted sync mode selector, day filter chips, throttle limiter, execute trigger, and hard resync confirmation modal.
  - `components/admin/AdminDiffSummary.tsx`: Extracted diff summary badges and expandable event change lists.
  - `components/admin/AdminTerminalConsole.tsx`: Extracted live execution terminal with color-coded log lines and filtering.
  - `components/admin/AdminPastRunsTable.tsx`: Extracted ingestion run history table and run log modal.
  - `components/admin/AdminFeedbackList.tsx`: Extracted attendee feedback triage list and lifecycle actions.
  - `public/sw.js`: Bumped `CACHE_NAME` to `dragoncon-pwa-v20` per PWA cache versioning policy.
- **Verification:** 136/136 unit tests pass (`pnpm test`), SSR + client production builds clean (`pnpm build`).

---
## 2026-08-28 — Track Exclusion Filters & Persisted Filter State

- **Type:** Feature (schedule filtering — "show everything except these tracks", filter preferences survive reloads).
- **Capabilities Added:**
  - **Track Exclusion (`/api/events`):** New repeatable `excludeTracks` query param (`?excludeTracks=Anime&excludeTracks=Horror`) hides the named tracks and returns everything else. Repeated params (not a comma-joined list) so track names containing commas round-trip intact. Exclusion is applied in-memory *after* the facet loop, so excluded tracks stay in `facets.tracks` and the filter sheet can still offer them for un-excluding — one query instead of a second unfiltered facets request.
  - **Tap-to-Hide Filter Sheet (`pages/index.tsx`):** Replaced single-select `selectedTrack` with `excludedTracks: string[]`. Track pills toggle into an excluded state (coral accent + strikethrough), the section header shows an `N HIDDEN` badge, and `ALL TRACKS` / `Reset` clear all exclusions. `filteredEvents` also drops excluded tracks client-side so the SSR payload doesn't flash hidden panels before the first fetch returns.
  - **Persisted Filter State:** `dc_excluded_tracks`, `dc_filter_location`, and `dc_filter_options` (`hideEndedPanels`, `hideConflicts`, `walkabilityOnly`) persist to `localStorage` following the `dc_selected_day` pattern — defaults in `useState`, restore in the mount effect, persist effect armed only after restore.
- **Runtime Learnings & Gotchas:**
  - **Restore Gate Must Be State, Not a Ref:** The events fetch effect is gated on a `filtersRestored` *state* flag rather than a ref. A ref would not re-trigger the effect, so a user with no stored filters would never fetch at all. Gating also removes the wasted mount fetch — SSR already supplies `initialEvents`.
  - **Route Imports Under the Test Runner:** `tests/*.test.ts` run through `node --experimental-strip-types`, which does not resolve extensionless relative imports. Every route currently exercised by a test imports `../../db/schema.ts` with the extension; `routes/api/events.ts` used the extensionless form and failed with `ERR_MODULE_NOT_FOUND` on import. Untested routes (`auth.ts`, `changes.ts`, `export-ics.ts`, `schedule.ts`, `auth/passkey.ts`) still use the extensionless form and will need the same fix when tests reach them.
  - **Stale Bundle During Browser Verification:** A browser tab held open across the edit kept serving the pre-change module — the new filter-sheet markup was absent from the DOM even though the source had changed. A full `tab.goto` reload fixed it. Cause not isolated: the app registers `/sw.js` in dev and precaches `/`, so an already-installed service worker is the likelier culprit than Vite HMR (same failure mode as the 2026-08-26 feedback-triage entry, where unregistering the SW revealed the new admin bundle). If a reload alone stops working, unregister the SW and clear caches before suspecting the bundler.
- **Files Modified:** `routes/api/events.ts`, `pages/index.tsx`, `tests/events-filter.test.ts` (new), `public/sw.js` (bumped to `dragoncon-pwa-v19`), `docs/interfaces/api-contracts.md`.
- **Verification:** 136/136 unit tests pass (`pnpm test`), production build clean (`pnpm build`). Browser-verified on the dev server: hiding "Main Programming" took the day from 4 → 2 panels with `1 HIDDEN` and strikethrough; after a full reload the exclusion persisted (still 2 panels, track still listed and struck); `Reset` returned 4 panels and cleared `dc_excluded_tracks` to `[]`.

---
## 2026-08-28 — Squad Invite Links, Event Deep Linking & Detailed Friend Schedule Browser

- **Type:** Feature (social squad collaboration, deep linking, privacy controls).
- **Capabilities Added:**
  - **Web Share Helper (`lib/share.ts`):** Universal `shareLink()` wrapping `navigator.share` with clipboard fallback.
  - **Event Deep Linking & Sharing:** "📤 SHARE PANEL" button in `PanelDetailModal` generates `/?event=<id>`. On mount, `pages/index.tsx` detects `?event=`, opens the modal for guests and logged-in users, and cleans the URL param on close via `history.replaceState`.
  - **Squad Invite Links:** "🔗 SHARE MY SQUAD INVITE LINK" in Squad tab generates `/?invite=<username>`. Uses display name in text (`Join <Name>'s Dragon Con squad on CyberDragon!`). Displays an in-app confirmation banner (`[✓ ADD TO SQUAD] [✕ DISMISS]`) when logged in and a welcoming invitation banner with login/registration CTA on any view when logged out.
  - **Detailed Squad Schedule Browser:** Selecting a friend in the Squad tab toggles between "ALL SAVED PANELS" and "MUTUAL OVERLAP" with real-time indicators (`✓ Both Going`, `⚠️ Conflict`, and 1-click `+ ADD TO MINE` button).
  - **Schedule Privacy Settings (`users.shareSchedule`):** Added D1 column `share_schedule` (default 1) with Profile toggle switch and `PATCH /api/user/privacy` endpoint. `GET /api/friends?userId=&friendId=` verifies friendship and respects target friend's privacy setting (`scheduleHidden: true` falls back to mutual overlap only).
- **Runtime Learnings & Gotchas:**
  - **Local Miniflare D1 Migration Drift:** `pnpm run db:migrate` (`void db migrate`) executes migrations against the primary CLI target SQLite DB in `.void/v3/d1/`. A long-running local `vp dev` server session may hold a separate Miniflare D1 SQLite file created prior to the migration, causing schema-altering updates to fail with `no such column` until the dev server is restarted or the column is verified in `.void/v3/d1/.../miniflare-D1DatabaseObject/`.
  - **Service Worker Stale-While-Revalidate Fallback:** When external third-party requests (e.g. cloudflare analytics beacons or blocked scripts) fail, `.catch(() => cachedResponse)` returns `undefined` if no cache entry exists, causing a `TypeError: Failed to convert value to 'Response'`. Falling back to `cachedResponse || Response.error()` ensures a valid Response object is always returned to `event.respondWith()`.
- **Files Modified:** `db/schema.ts`, `db/migrations/*`, `lib/share.ts`, `routes/api/friends.ts`, `routes/api/user/privacy.ts`, `routes/api/auth.ts`, `routes/api/auth/passkey.ts`, `components/PanelDetailModal.tsx`, `pages/index.tsx`, `public/sw.js` (bumped to `dragoncon-pwa-v18`), `tests/*.test.ts`.
- **Verification:** 131/131 unit tests pass (`pnpm test`), SSR + client production builds clean (`pnpm build`).

---
## 2026-08-27 — Chronological Event Ordering & Time Rail Slot Sorting

- **Type:** Bugfix (display correctness — schedule panels rendered in random time sequence).
- **Symptom:** Viewing Friday on `https://dragoncon.martinrojas.dev/` rendered panels out of chronological order (e.g. 4 PM, then 8 PM, 10 PM, 12 AM, 8 AM, 1 PM).
- **Root Cause:**
  - `routes/api/events.ts` and `pages/index.server.ts` selected rows from D1 without an `ORDER BY` clause, returning events in arbitrary insertion/scrape order.
  - `filteredEvents` in `pages/index.tsx` filtered without sorting by `startsAt`.
  - `groupedSlots` constructed `TimeRail` buckets in iteration order, scattering time slots chronologically.
- **Changes:**
  - `routes/api/events.ts` & `pages/index.server.ts`: Added `.orderBy(asc(events.startsAt), asc(events.title))`.
  - `pages/index.tsx`: Added ascending `startsAt` sort (with `title` tiebreaker) to `filteredEvents`.
  - `lib/walktime.ts`: Exported `parseTimeDisplay` for reusable testing and SSR import.
  - `public/sw.js`: Bumped `CACHE_NAME` to `dragoncon-pwa-v12` per PWA cache versioning policy.
  - `tests/event-ordering.test.ts`: Added unit tests verifying 12 AM → 11:30 PM ordering across full 24h days and time rail slot generation.

---
## 2026-08-27 — ET Timestamps, Past-Day Skip Polish, PR #6

- **Type:** Bug fix + capture pass.
- Admin run history and feedback timestamps now render in `America/New_York` via `formatRunTimestamp` (`pages/admin.tsx`). Root cause: SQLite `datetime('now')` stores suffix-less UTC and bare `new Date(...).toLocaleString()` re-parsed it as the viewer's local time. Full diff: PR #6 (also carries `CACHE_NAME` v7 per repo PWA policy).
- Cron cadence fixture aligned to manual commit `1b1472c` (Sep 1–2 every 2h, con days every 10 min) — schedule behavior itself is that commit's, not this pass's.
- **Cron rotation advanced per 4h wall-clock bucket, not per tick.** `CYCLE_MS` was a fixed 4 hours, so the 10-minute con-week cadence re-synced the *same* con day for 24 consecutive invocations. Replaced with `CADENCE_MS[controller.cron]` (tick interval of the pattern that fired) → the slot advances exactly one day per invocation at every cadence. Regression tests: per-tick step assertion + a guard that each declared `cron` pattern has a cadence entry.
- **`DEFAULT_DETAIL_FETCH_BUDGET` 400 → 1800.** Friday is ~691 events (operator-confirmed; the docs' earlier 271 was wrong), so no weekend day could finish on 400 — and a truncated day skips its deletion sweep, so cancellations silently stopped being detected. **Correction, same day:** the claim that 1800 "clears the largest day" was wrong, and so was the "~1.04 subrequests/event" arithmetic. The budget was sized against the subrequest ceiling only; CPU was never checked, and CPU is the binding constraint (see below).
- **CPU, not fetches, was the real ceiling.** A production admin run of `Sep++6` (637 listed events) reported `cpuTimeMs: 7300` for 400 detail fetches — **~18 ms CPU/event** for a full-document parse, so the pinned `cpu_ms: 10000` caps an invocation near **548 events**, under every weekend day. Raising the fetch budget alone could not have worked. Root cause: upstream detail pages are ~215 KB of page chrome around ~24 KB of event content. `sliceDetailRegion` narrows the HTML to the parsed region before `cheerio.load`, measured **4.4× cheaper** (18.9 → 4.3 ms/event locally; ~2.7 s projected for Sunday), validated against 12 live detail pages with byte-identical extraction of location/date/duration/description/track/speakers. Falls back to the full document when its markers are absent.
- **Live defect: multi-row INSERTs exceeded D1's bound-parameter cap.** `WRITE_CHUNK = 50` × 15 `events` columns bound **750 parameters** against a documented cap of **100**, so D1 rejected every flush; a bare `catch {}` hid it and replayed row-by-row at ~3 D1 queries/event. That fit under D1's separate 1,000-queries-per-invocation cap at 400 events (~667) but not above ~490, which is structurally why weekend days never completed. Split into `ROW_CHUNK = 6` (parameters scale per column) and `ID_CHUNK = 50` (per row), and the flush now logs the degrade instead of swallowing it. New test asserts no statement binds >100 parameters — verified to fail at 50 and pass at 6.
- **Detail fetches now run in waves of 6** (`DETAIL_CONCURRENCY`), the documented Workers cap on simultaneous connections per invocation. ~97% of a run's wall time was upstream I/O wait (7.3 s CPU inside 258 s wall), so waves cut measured live-upstream latency **625 → 152 ms/event (4.1×)** and Sunday's 637 events from **~6.6 min to ~1.6 min**. CPU is unchanged (parsing is single-threaded); this exists so a run finishes well inside the 10-minute con-week cadence, which Cloudflare does not protect against overlapping. Introduced and fixed a regression in the same pass: advancing the cursor by the wave stride rather than the wave's actual length skipped the budget-exhausted check when a trimmed wave ran off the end of a listing, letting the deletion sweep run on a partial scrape — the existing truncation tests caught it. New tests cover listing-order determinism under reversed completion (microtask yields, no wall-clock delays), both budget-trim shapes, and sibling survival when one page in a wave fails; each verified to fail when its bug is reintroduced.
- **Shipped as PR #7** (`feature/sync-updates` → `main`): the four fixes above, with a post-deploy verification checklist in the PR body — `TRUNCATED` gone from big-day summaries, non-zero deletion-sweep counts returning, Workers Logs `cpuTimeMs` ≈ 3 s per big day (was 7.3 s for only 400 of 637 events), zero silent write degrades.
- **Platform research outcome (Cloudflare):** documented limits put four ceilings on each ingestion invocation — CPU (`cpu_ms`, binding one post-fix), D1 queries (1,000), subrequests (our pin: 2,000 vs Paid default 10,000 — our own spend guard is the reason for the one-day-per-tick rotation), and the fetch budget. Feature verdicts recorded durably in `rules/cloudflare-platform-limits.md`: Workflows does **not** lift the subrequest ceiling (counted per instance, not per step); Queues and Durable Object alarms are correct future levers; Analytics Engine fits per-run metrics. One open operational gap: Cloudflare has no native alerting for failed/stopped cron runs — closing it needs a dead-man's-switch ping or a Tail Worker webhook.
- Method note worth keeping: local Node timings mis-estimated workerd CPU by ~2.4×. Production invocation logs (`cpuTimeMs`) are the authoritative measurement; they are already enabled (`observability.logs.invocation_logs`).
- **Rejected (implemented, then reverted): skipping detail fetches for unchanged listing rows.** Would have cut ~90% of fetches at the 10-minute cadence, but track/speakers/room/description exist only on the detail page. Two existing tests failed immediately (`track/speakers-only changes`, `migrated content hash`) — proof that the skip silently drops exactly the same-day changes the tight cadence exists to catch. If per-tick cost matters later, rotate detail refreshes across ticks instead.
- Replaced the default-budget test's 1,825-event fixture with bounds + wiring assertions (suite 19.7s → 11.8s); truncation-at-budget stays covered by the explicit `maxDetailFetches` tests.
- Durable knowledge harvested into new concepts: `docs/rules/ingestion-budget.md` (budget/ordering/past-day invariants) and `docs/interfaces/upstream-schedule-api.md` (`Sep++N` upstream param contract).

---
## 2026-08-26 — Fix Weekend Schedule Starvation (Per-Day Cron Rotation + Batched Writes)

- **Type:** Bug fix (data completeness — upstream events never ingested).
- **Symptom:** Production D1 held only 6 Saturday / 6 Sunday events while upstream (`app.core-apps.com/dragoncon26`) lists hundreds each; Friday 271 / Thursday 129 looked healthy.
- **Root cause:** `runIngestion()` spent its shared `DEFAULT_DETAIL_FETCH_BUDGET` (400) sequentially in fixed day order Wed→Tue, charging full price even for unchanged events (1 detail fetch + 1 SELECT + 2 writes *every run*). Wednesday(4)+Thursday(129) left 267; Friday alone wanted 271 — the budget died mid-Friday and `eventLinks.slice(0, 0)` handed Saturday/Sunday/Monday/Tuesday zero attempts every tick. Their stray rows date from the first runs (Aug 23) before Thu/Fri were published upstream.
- **Changes:**
  - `crons/sync-schedule.ts`: cron now ingests **one con day per invocation** via deterministic `nextSyncDays()` round-robin over `SYNC_DAYS` — each tick gets the Worker's entire subrequest budget instead of splitting it seven ways. Rotation skips already-passed days and returns empty once the con is over. Active-window guard and `ingestion_runs` history unchanged. Admin `POST /api/ingest` still accepts explicit `days` for immediate manual bursts.
  - `lib/ingest.ts`: day listings are walked to exhaustion instead of blind-sliced (budget caps detail fetches, `truncated` still suppresses the deletion scan); existing rows pre-read in chunked `IN()` statements; creates flush as multi-row inserts with **per-row replay fallback** so the write-isolation guarantee survives a poisoned row byte-for-byte; lastSeen refreshes batch into one bulk UPDATE. A 120-event day drops from 361 D1 statements to double digits.
  - Past-day budget saver: default day expansion (cron rotation and admin "All") excludes con dates earlier than today in `America/New_York` — passed days stop costing fetches entirely. Explicit `days:` requests bypass the filter (operator intent wins), hard-resync re-pulls the full window, and an injectable `now` option keeps the clock testable.
  - Observability: run header now reports resolved days + detail budget, processing order is logged smallest-first, truncation announces itself mid-day with exact progress counts, and every day closes with a `[DAY SUMMARY]` line (fetches/created/updated/deleted/budget left).
  - `tests/`: op-ceiling regression (<200 statements for 120 fresh events), rotation cycle/past-day tests, cron-window fixtures derived from `nextSyncDays`, ordering test proving small days complete under shared budgets, alias normalization for admin weekday chips.
- **Verification:** 110/110 tests green, production build clean. Con-scale arithmetic: worst-day backfill ≈ details + ~15 D1 statements, far inside the configured 2000-subrequest ceiling; manual rescue of specific days available immediately post-deploy via admin ingest with `{"days":["Sep++5"]}`.

---
## 2026-08-26 — Fix First-Load Stale Schedule (SW Network-First + Full SSR Payload)

- **Type:** Bug fix (correctness — stale data shown as fresh).
- **Symptom:** Production first load showed only 4–5 Saturday/Sunday events; clicking "sync" revealed a much larger list.
- **Root cause:** `public/sw.js` applied stale-while-revalidate (`return cachedResponse || networkFetch`) to *every* GET, including `/api/*` responses and navigations. Any cached API URL was served stale instantly while the network refresh only updated the cache in the background, so day views flipped between per-URL cache snapshots of older ingests. Secondary: `pages/index.server.ts` shipped an arbitrary `allEvents.slice(0, 100)` as initial payload, so restored-day first paint could render a junk subset before hydration refetch.
- **Changes:**
  - `public/sw.js`: split strategies — `/api/*` and navigations are now network-first with cache strictly as offline fallback; stale-while-revalidate kept only for static assets. Install/activate lifecycle unchanged (`skipWaiting`, old-cache purge, `clients.claim`). `CACHE_NAME` → `dragoncon-pwa-v6`.
  - `pages/index.server.ts`: dropped `.slice(0, 100)` — full table ships embedded (~94 KB gz at 421 rows); ponytail-ceiling comment names the per-day SSR query upgrade path if the schedule approaches ~3k events.
  - `pages/index.tsx`: `filteredEvents` memo gained a `selectedDay` guard — "sync" fetches all events unfiltered and previously leaked every other day's panels into the current day view (this, not ingest growth, was why sync appeared to add events).
  - `pages/index.tsx` (companion feature from same-day commit `a869602`): selected-day persistence via `dc_selected_day`, guarded against pre-restore writes.
- **Verification:** headless browser with SW v6 active — planted a poisoned 1-event response at the exact app request URL in CacheStorage; subsequent fetch through the SW returned the 6 live events (old SW would have served `count:1`), reload rendered no poison and revalidation overwrote the entry (45 keys cached, offline fallback intact). SSR `__VOID_PAGE_DATA__` embeds all events (`initialEvents == totalEvents`). Selected-day persistence regression passed (Friday/Monday roundtrips).
  - Sync-leak differential: Saturday selected (6 panels) → real "Updates" sync pulled all 31 local events into state → panel count stayed 6 (pre-fix it became 31). Production re-probed twice: 421 events, Fri 271 / Thu 129 / Sat 6 / Sun 6 — the thin weekend is server-side ingest state, not client filtering.

---
## 2026-08-26 — SEO Fixes: Canonical, H1, Favicons, JSON-LD

- **Type:** Feature (SEO/meta hardening from a 66/100 OG audit).
- **Changes:**
  - `void.json`: canonical link; `og:locale en_US`; `/favicon.ico` (48px PNG-in-ICO, Google-crawlable) + `/favicon-32x32.png` links ahead of the SVG icon; JSON-LD `@graph` with `WebSite` + `Event` (Dragon Con 2026, Sep 3–7, Atlanta, scheduled) via void head `script` support.
  - `pages/index.tsx`: screen-reader-only `<h1>` in the app shell (the shell is chrome-heavy; no visible H1 exists by design).
  - `pages/admin.server.ts`: `robots: noindex, nofollow` — the ingestion dashboard shouldn't rank.
  - `public/`: `favicon.ico`, `favicon-32x32.png` generated from the icon set.
  - `public/sw.js`: cache → `dragoncon-pwa-v4` (asset-change policy).
- **Measured, not guessed:** the auditor's "HTML 438 KB" is the identity-encoded body; actual transfer over Cloudflare brotli/gzip is 30,670 bytes (measured via `curl -H 'Accept-Encoding: br, gzip' -w '%{size_download}'`). Compression is already on; no payload diet required. `twitter:site` → `@martinrojas` (handle provided after the initial pass).
- **Verification:** dev-server smoke — canonical ×1, h1 ×1, single `og:locale` meta, JSON-LD parses (`WebSite`, `Event`), favicon.ico + 32px PNG serve 200 with correct types, admin serves noindex.

---
## 2026-08-26 — Social Metadata & Brand Asset Generation

- **Type:** Feature (page metadata + generated brand assets).
- **Summary:** Full Open Graph / Twitter card set, fixed the manifest's missing icons, favicon, and apple-touch icon. Artwork is generated (not AI): an angular dragon-glyph mark composed in SVG from the CyberDragon Glass tokens (`#0C0E11` canvas, purple-600/400, gold-500/400), rasterized via the browser device and committed alongside its reproducible generator.
- **Changes:**
  - `scripts/og-art.html` (new): single-page generator for `og-image` (1200×630), `icon-512`, `icon-192`, `apple-touch-icon` (180) — element-screenshot each node after `document.fonts.ready`, then `sips` to exact pixel sizes (device pixel ratio 1.25 otherwise inflates captures).
  - `public/`: `og-image.png`, `icon-512.png`, `icon-192.png`, `apple-touch-icon.png` (generated), `favicon.svg` (hand-written vector).
  - `void.json`: OG block switched to canonical `property="og:*"` form (void schema supports `property`; requires a dev-server restart to reload), Twitter `name=` block, richer description with "Sep 3–7, 2026 · Atlanta, GA", favicon + apple-touch-icon links.
  - `pages/index.server.ts`: page-level description override updated to the new copy (it was masking the global head description).
  - `public/manifest.webmanifest`: `theme_color` aligned to canvas `#0C0E11` (was `#6b21a8`, clashing with head theme-color); icon entries now resolve to real files.
  - `public/sw.js`: `CACHE_NAME` → `dragoncon-pwa-v3` (asset-change policy) + icons/manifest precached for offline install.
- **Verification:** dev-server smoke — served HTML carries all OG `property` tags + Twitter tags + new description; all five assets return 200 with correct content types; `void.json`/`manifest.webmanifest` parse. Glyph iterated twice against rendered screenshots (overflow fix, horn/skull seam fix).

---
## 2026-08-26 — Bundle Maintain Pass (Triage API, Run Logging, Cache Policy)

- **Type:** Maintain (approved audit actions A1-A5).
- **Gate:** Anchor `89144bd` (2026-08-24) resolved with 7 code commits outside `docs/` since it; worktree clean at `a733a56`.
- **Scores:** `AGENTS.md` 105/110 (A) · `SYSTEM_DESIGN.md` 84/100 (B, currency drift fixed this pass) · `api-contracts.md` 55/60 (A). `walktime-and-venues.md`, `decisions/0001`, `deployment-runbook.md` not re-scored (unchanged since anchor; runbook got one action).
- **Legacy OKF scan:** 0 of 5 concepts on v0.1; no `stale_after` keys; unverified concepts: 0.
- **Changes:**
  - `SYSTEM_DESIGN.md`: §6 gained `PATCH /api/feedback/:id` + `runId` note on `/api/ingest`; §4 module rows updated (Ingestion Engine exports `runIngestionWithRunLog()`, Feedback row includes `[id].ts`); §9 test result 95→102 tests / 12 test files (quoted from `pnpm test` 2026-08-26); Vite+ now cited as `vite-plus ^0.1.21` (manifest form; runtime banner resolves 0.1.24); four out-of-bounds `sources` ranges corrected (`lib/auth.ts` 101, `pages/admin.tsx` 1307, `lib/errorReporting.ts` 195, `crons/sync-schedule.ts` 45) and `feedback-status-code` source added; `verified` re-stamped for 2026-08-26.
  - `api-contracts.md`: all 16 `sources` ranges re-verified against `wc -l` (4 corrected: `auth.ts` 1-76, `passkey.ts` 1-222, `ingest.ts` 1-29, `cron-sync-handler` 1-45); `generated` → `human:martinrojas` 2026-08-26 (session body edits) with `verified` event from this pass; new §8 "Legacy & Misc Endpoints" pointer table (password auth, changes, friends, legacy ingest, hello) closing the §7→§10 numbering gap; §9 cron behavior line now names `runIngestionWithRunLog()` + `user_id: "cron"` attribution; label↔id join checked (4 new inline labels, all resolve).
  - `index.md`: `last_verified` → 2026-08-26.
  - `deployment-runbook.md`: §3 routine-deploy steps gained the `CACHE_NAME` bump check (per AGENTS.md "PWA Cache Versioning" policy).
- **Flagged, not fixed:** section numbering in `api-contracts.md` now runs 1-9 after closing the gap; pre-anchor numbering skipped 8-9. Root `README.md` untouched (not re-scored).

Docs-freshness: head=a733a566cee3f8d544835938576ac5149eab533b date=2026-08-26 pass=maintain

---
## 2026-08-26 — Cron & Legacy Ingestions Now Logged in Run History

- **Type:** Bugfix (missing run-history records).
- **Root Cause:** Run rows were written only by `POST /api/admin/ingest` — the insert/update lifecycle lived in the route handler, while `lib/ingest.ts#runIngestion()` never touched `ingestion_runs`. Scheduled cron executions (`crons/sync-schedule.ts`) and legacy `POST /api/ingest` called `runIngestion()` directly, so they synced events (production events were up to date) but never appeared in the admin run history. The cron test fixture's `ingestion_runs` table also still had a pre-route-era shape (`success`, `total_scraped`) that nothing wrote.
- **Changes:**
  - `lib/ingest.ts`: new `runIngestionWithRunLog()` — inserts a `running` row, delegates to `runIngestion()`, then updates `completed` (stats/log/completedAt) or `failed` (errorMessage) and returns `IngestResult & { runId }`. Single writer of `ingestion_runs`; `userId` is the calling admin or the `"cron"` sentinel (column is NOT NULL — no migration).
  - `routes/api/admin/ingest.ts`: replaced its inline insert/update lifecycle with the wrapper (route shrank 72 → 31 lines); response contract unchanged on success, failure no longer echoes `runId`.
  - `routes/api/ingest.ts`, `crons/sync-schedule.ts`: switched to the wrapper — both now log runs; cron console line gains `Run #id` for correlation with history.
  - `tests/crons.test.ts`: fixture table replaced with the real schema; added regression assertions that a cron execution records exactly one `completed` run attributed to `cron` with stats, plus a wrapper test proving failed runs are recorded with the error message.
  - `docs/interfaces/api-contracts.md`: documented the failure shape, the single-writer rule, and that run history now includes cron + legacy runs.
- **Verification:** `pnpm test` 102/102 (new regression test failed before the fix, passes after); `pnpm build` clean. Note: past cron runs ran silently — their history rows are unrecoverable; only executions after the next production deploy will appear.

---
## 2026-08-26 — Feedback Triage: Complete & Archive Workflow

- **Type:** Feature (admin feedback triage).
- **Summary:** Admins can now move attendee feedback through `new → in_progress → done | archived` (reopen to `new` allowed from any state), built on the existing `feedback.status` column — no schema migration.
- **Changes:**
  - `routes/api/feedback/[id].ts` (new): `PATCH /api/feedback/:id` behind `adminGuard`; validates `status` against the four-value allow-list (400 otherwise), 404 on unknown id, returns the updated row via drizzle `.returning()`.
  - `pages/admin.tsx`: `New Only ↔ Show All` segmented toggle in the feedback panel header (default New Only); status badges (`IN PROGRESS` purple, `DONE` green, `ARCHIVED` gray) next to BUG/IDEA badges; per-state action buttons (`new`: Start/Complete/Archive · `in_progress`: Complete/Archive · `done`: Reopen/Archive · `archived`: Reopen) with handled cards dimmed to 0.55 opacity; `updateFeedbackStatus()` PATCHes and rewrites the item in local state without a full refresh; last-write-wins between concurrent admins.
  - `tests/feedback.test.ts`: 7 new handler tests (401/403 auth, invalid & missing status 400, unknown id 404, new→done transition reflected in GET, full lifecycle incl. reopen).
  - `docs/interfaces/api-contracts.md`: documented `PATCH /api/feedback/:id` contract + corrected the status enum in the GET response shape.
- **Verification:**
  - `pnpm test` 101/101 pass (was 94; +7 feedback triage tests).
  - `pnpm build` clean (SSR Worker + client PWA bundles).
  - Browser smoke test against local `vp dev` (admin `@martin-test-2`): Complete → card left New Only view; Show All → DONE badge, dimmed card, Reopen/Archive; Archive → ARCHIVED badge + Reopen-only; GET `/api/feedback` confirmed `done`/`archived`/`new` persisted server-side. Note: the PWA service worker (`dragoncon-pwa-v1`) served a stale admin bundle during first load — unregistering SW + clearing caches revealed the new UI; consider a cache-version bump when this ships.

---
## 2026-08-26 — Filter Injected In-App-Browser Bridge Errors from Auto-Reports

- **Type:** Bugfix (error-reporting noise).
- **Root Cause:** An auto-reported "Error invoking postMessage: Java object is gone" originates entirely inside `iabjs://navigation_performance_logger_android` — a performance logger that Android in-app-browser hosts (e.g. Meta/Facebook IAB, Google WebView) inject into every page. The host's native Java bridge peer is destroyed during WebView teardown but its beforeunload telemetry still fires, throwing into our `window` context where `lib/errorReporting.ts`'s global `window.onerror` catcher reported it. No CyberDragon code in the stack; nothing fixable client-side.
- **Changes:**
  - `lib/errorReporting.ts`: Extended the `onErrorHandler` ignore-list to also skip any error whose `event.filename` starts with `iabjs://` (foreign injected-script origin), alongside the existing ResizeObserver / cross-origin "Script error." filters.
- **Verification:** `pnpm test` 94/94 pass.

---
## 2026-08-24 — Subrequest Limit Fix & Workers Paid Plan Upgrade

- **Type:** Bugfix / Infrastructure.
- **Root Cause:** `runIngestion()` (`lib/ingest.ts`) capped event-detail fetches per *day* via `maxDetailFetches`, defaulting to unlimited (`eventLinks.length`) when the caller omitted it. A full multi-day admin "Full Run" sync (and the bare cron / `/api/ingest` calls, which both omit `maxDetailFetches`) issued one uncapped `fetch()` per event across all 7 con days within a single Worker invocation, tripping Cloudflare's per-invocation subrequest ceiling partway through the second day (131 events) and failing every subsequent event fetch with `Too many subrequests by single Worker invocation`.
- **Changes:**
  - `lib/ingest.ts`: Replaced the per-day `maxDetailFetches ?? eventLinks.length` cap with a `detailFetchBudget` shared across every day in the run (decremented as events are targeted, never reset per day), defaulting to a new exported `DEFAULT_DETAIL_FETCH_BUDGET = 400` constant when the caller omits `maxDetailFetches`.
  - `wrangler.jsonc`: Added an explicit `limits: { cpu_ms: 10000, subrequests: 2000 }` block as a deliberate platform-level ceiling on the newly upgraded Workers Paid plan.
  - `pages/admin.tsx`: Corrected the now-inaccurate "Full Run (No Detail Throttle Limit)" dropdown label to "Full Run (Capped for Safety)".
  - `docs/interfaces/api-contracts.md`, `docs/guides/deployment-runbook.md`, `docs/SYSTEM_DESIGN.md`: Documented the whole-run budget semantics, the Workers Paid plan upgrade, configured resource limits, and the manual dashboard steps to downgrade back to Free after the con.
  - `tests/ingest-modes.test.ts`: Added coverage proving the budget is shared across days (not reset per day) and that the safe default applies when `maxDetailFetches` is omitted.
- **Operational Note:** Cloudflare has no hard account-wide spend cap; a Billable Usage budget alert is informational only (email past a threshold, does not pause the Worker). Downgrade the account back to the Workers Free plan after Dragon Con 2026 con-week (Sep 7) ends to stop the recurring $5/mo charge.
- **Live Verifications:**
  - Unit tests: `pnpm test` executed and verified (94/94 tests pass across 12 test suites).
  - Production build: `pnpm build` verified (SSR Worker and static PWA client bundles compile clean).

---
## 2026-08-24 — Automated Schedule Sync Worker Cron Trigger

- **Type:** Feature / Background Automation.
- **Changes:**
  - `crons/sync-schedule.ts`: Configured multi-schedule Void cron job (`export const cron = [...]`):
    - `"0 */4 * 8 *"`: Every 4 hours in late August.
    - `"0 */4 1-2 9 *"`: Every 4 hours pre-con (Sept 1–2).
    - `"*/30 * 3-7 9 *"`: Every 30 minutes during Dragon Con (Sept 3–7).
    - Added `isWithinActiveWindow()` guard; handler early-returns outside the 2026 active window (Aug 24 – Sep 7).
    - Invokes `runIngestion({ mode: "sync" })` directly with structured timing & count metrics.
  - `tests/crons.test.ts`: Added unit and integration test suite verifying schedule arrays, active date boundary calculations, out-of-window early skips, in-window mock D1 insertions, exact timestamps, and `computeContentHash` content verification.
- **Live Verifications:**
  - Unit tests: `pnpm test` executed and verified (95/95 tests pass across 12 test suites).
  - Production build: `pnpm build` verified (SSR Worker bundles `sync-schedule` chunk cleanly into `dist/ssr/`).

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

Docs-freshness: head=89144bd909ac49eacd1c469679bad4fec22b7d9d date=2026-08-24 pass=maintain
