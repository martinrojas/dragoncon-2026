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

---

## Sources

*No active unharvested sources. All historical design specs and implementation plans have been harvested into knowledge concepts and removed.*

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
