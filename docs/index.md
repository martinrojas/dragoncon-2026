---
okf_version: "0.2"
title: Documentation Map — CyberDragon Companion App
description: Canonical knowledge index and source registration for Dragon Con 2026 Companion App.
last_verified: 2026-08-26
---

# Knowledge Index

> Canonical entry point for CyberDragon documentation. Maintained by `docsmith`.

---

## Knowledge

| Document | Type | Description |
| :--- | :--- | :--- |
| [`SYSTEM_DESIGN.md`](/docs/SYSTEM_DESIGN.md) | `System Design` | Architecture, subsystems, data model, APIs, and Cloudflare deployment for the Dragon Con 2026 Companion PWA. |
| [`rules/walktime-and-venues.md`](/docs/rules/walktime-and-venues.md) | `Domain Rules` | Calculation matrix for pedestrian and skybridge walk times between Atlanta host hotels and room line capacity heuristics. |
| [`interfaces/api-contracts.md`](/docs/interfaces/api-contracts.md) | `API Contracts` | Request and response schemas for all file-based Hono endpoints on Cloudflare Workers. |
| [`decisions/0001-cloudflare-d1-self-host.md`](/docs/decisions/0001-cloudflare-d1-self-host.md) | `Decision` | Architectural decision to deploy directly to Cloudflare Workers and D1 SQLite using Void's self-host backend. |
| [`guides/deployment-runbook.md`](/docs/guides/deployment-runbook.md) | `Guide` | Step-by-step runbook for provisioning, migrating, and deploying the CyberDragon app on Cloudflare Workers and D1. |
| [`rules/ingestion-budget.md`](/docs/rules/ingestion-budget.md) | `Domain Rules` | Invariants for the shared ingestion detail budget, smallest-first day ordering, ET past-day skipping, and batched D1 writes. |
| [`interfaces/upstream-schedule-api.md`](/docs/interfaces/upstream-schedule-api.md) | `API Contracts` | Param contract and observed behavior of the upstream `app.core-apps.com/dragoncon26` schedule source. |
| [`rules/cloudflare-platform-limits.md`](/docs/rules/cloudflare-platform-limits.md) | `Domain Rules` | Documented Workers/D1/Cron limits, which platform features do and do not fit the ingestion workload, and the production CPU measurement practice. |

---

## Sources

| Document | Type | Harvest Status |
| :--- | :--- | :--- |
| [`superpowers/specs/2026-08-29-index-page-refactor-spec.md`](/docs/superpowers/specs/2026-08-29-index-page-refactor-spec.md) | `Design Spec` | active |
| [`superpowers/plans/2026-08-29-index-page-refactor.md`](/docs/superpowers/plans/2026-08-29-index-page-refactor.md) | `Implementation Plan` | active |
| [`superpowers/specs/2026-08-28-squad-share-deep-linking-design.md`](/docs/superpowers/specs/2026-08-28-squad-share-deep-linking-design.md) | `Design Spec` | ✓ harvested (safe to delete) |
| [`superpowers/plans/2026-08-28-squad-share-deep-linking.md`](/docs/superpowers/plans/2026-08-28-squad-share-deep-linking.md) | `Implementation Plan` | ✓ harvested (safe to delete) |
---

## Registered

| Resource | Scope | Owner |
| :--- | :--- | :--- |
| [`README.md`](/README.md) | Root Project Overview | CyberDragon Engineering |
| [`AGENTS.md`](/AGENTS.md) | Agent Instructions & Working Agreements | CyberDragon Engineering |
| [`package.json`](/package.json) | Package Manifest & Scripts | CyberDragon Engineering |
| [`wrangler.jsonc`](/wrangler.jsonc) | Cloudflare Worker Configuration | CyberDragon Engineering |
| [`tests/walktime.test.ts`](/tests/walktime.test.ts) | Unit Test Suite (Walk Time & Heuristics) | CyberDragon Engineering |
| [`tests/feedback.test.ts`](/tests/feedback.test.ts) | Unit Test Suite (Feedback API) | CyberDragon Engineering |
| [`tests/error-reporting.test.ts`](/tests/error-reporting.test.ts) | Unit Test Suite (Error Catching & Sanitization) | CyberDragon Engineering |
| [`tests/error-boundary.test.ts`](/tests/error-boundary.test.ts) | Unit Test Suite (ErrorBoundary State & Lifecycle) | CyberDragon Engineering |
| [`tests/maps.test.ts`](/tests/maps.test.ts) | Unit Test Suite (Venue Floor Plans & Booth Polygons) | CyberDragon Engineering |
| [`tests/schema.test.ts`](/tests/schema.test.ts) | Unit Test Suite (D1 Schema & Migration Invariants) | CyberDragon Engineering |
| [`tests/auth-guard.test.ts`](/tests/auth-guard.test.ts) | Unit Test Suite (Session Tokens & RBAC Guard) | CyberDragon Engineering |
| [`tests/make-admin.test.ts`](/tests/make-admin.test.ts) | Unit Test Suite (Admin Promotion CLI) | CyberDragon Engineering |
| [`tests/ingest-modes.test.ts`](/tests/ingest-modes.test.ts) | Unit Test Suite (Sync, Dry-Run & Hard-Resync) | CyberDragon Engineering |
| [`tests/admin-api.test.ts`](/tests/admin-api.test.ts) | Unit Test Suite (Admin Ingestion & Stats Routes) | CyberDragon Engineering |
| [`tests/admin-ui.test.ts`](/tests/admin-ui.test.ts) | Unit Test Suite (Admin Dashboard SSR & Head Loader) | CyberDragon Engineering |
| [`tests/crons.test.ts`](/tests/crons.test.ts) | Unit Test Suite (Automated Cron Job & Schedule Ingestion) | CyberDragon Engineering |
| [`tests/event-ordering.test.ts`](/tests/event-ordering.test.ts) | Unit Test Suite (Chronological Event & Time Rail Slot Ordering) | CyberDragon Engineering |
| [`tests/share.test.ts`](/tests/share.test.ts) | Unit Test Suite (Web Share & Clipboard Fallback) | CyberDragon Engineering |
| [`tests/user-privacy.test.ts`](/tests/user-privacy.test.ts) | Unit Test Suite (Squad Schedule Privacy PATCH API) | CyberDragon Engineering |
| [`tests/friends-privacy.test.ts`](/tests/friends-privacy.test.ts) | Unit Test Suite (Friends Full Agenda & Schedule Privacy Authorization) | CyberDragon Engineering |
| [`tests/schedule-logic.test.ts`](/tests/schedule-logic.test.ts) | Unit Test Suite (Schedule Domain Logic & Conflicts) | CyberDragon Engineering |
| [`tests/squad-logic.test.ts`](/tests/squad-logic.test.ts) | Unit Test Suite (Squad Domain Logic & Overlap) | CyberDragon Engineering |
