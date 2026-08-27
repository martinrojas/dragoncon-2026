---
type: API Contracts
title: Upstream Dragon Con Schedule API
description: Param contract and observed behavior of app.core-apps.com/dragoncon26, the scrape source for schedule ingestion.
tags: [upstream, ingestion, scraping]
generated: { by: docsmith/1.3.0, at: 2026-08-27 }
status: stable
maintainer: CyberDragon Engineering
sources:
  - id: alias-map
    resource: lib/ingest.ts:158-167
    title: WEEKDAY_TO_DAY_PARAM weekday→Sep++N mapping with double-space encoding note
  - id: alias-test
    resource: tests/ingest-modes.test.ts:980-998
    title: Regression proving weekday labels are normalized before fetch
  - id: upstream-session
    resource: session:2026-08-27
    title: Production run logs (inferred, not verified)
---

# Upstream Dragon Con Schedule API

Scrape source: `https://app.core-apps.com/dragoncon26`.

## Day listing params

- `events/view_by_day` accepts only `day=Sep++N` (N = 2–8). `+` is a URL-encoded space, so `Sep++5` decodes to `Sep  5` — **two** spaces — matching the literal upstream header text [^alias-map].
- Weekday labels (`Saturday`, `Fri`, …) map through `WEEKDAY_TO_DAY_PARAM` before fetch. An unmapped label goes upstream verbatim and fails — the admin Sat chip originally sent `day=Saturday` and got a 500 [^alias-test].

## Observed day sizes (Sep 2026 con)

Wed 4 · Thu 129 · Fri 271 · Sat 601 · Sun 637 · Mon/Tue small (inferred, not verified — from production ingestion logs) [^upstream-session]

[^alias-map]: `lib/ingest.ts:158-167`
[^alias-test]: `tests/ingest-modes.test.ts:980-998`
[^upstream-session]: session 2026-08-27
