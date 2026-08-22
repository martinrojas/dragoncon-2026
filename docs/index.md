---
okf_version: "0.2"
title: Documentation Map — CyberDragon Companion App
description: Canonical knowledge index and source registration for Dragon Con 2026 Companion App.
last_verified: 2026-08-22
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

| Source | Status | Notes |
| :--- | :--- | :--- |
| [`superpowers/specs/2026-08-22-cyberdragon-companion-app-design.md`](/docs/superpowers/specs/2026-08-22-cyberdragon-companion-app-design.md) | ✓ harvested (safe to delete) | Full design specification for UI components, walk-time matrix, and passkeys; harvested into concepts and verified. |
| [`superpowers/plans/2026-08-22-cyberdragon-companion-app.md`](/docs/superpowers/plans/2026-08-22-cyberdragon-companion-app.md) | ✓ harvested (safe to delete) | Implementation plan; all 4 subsystem tasks completed and passing tests. |

---

## Registered

| Resource | Scope | Owner |
| :--- | :--- | :--- |
| [`README.md`](/README.md) | Root Project Overview | CyberDragon Engineering |
| [`AGENTS.md`](/AGENTS.md) | Agent Instructions & Working Agreements | CyberDragon Engineering |
| [`package.json`](/package.json) | Package Manifest & Scripts | CyberDragon Engineering |
| [`wrangler.jsonc`](/wrangler.jsonc) | Cloudflare Worker Configuration | CyberDragon Engineering |
| [`tests/walktime.test.ts`](/tests/walktime.test.ts) | Unit Test Suite | CyberDragon Engineering |
