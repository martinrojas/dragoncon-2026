---
type: API Contracts
title: Upstream Dragon Con Schedule API
description: Param contract and observed behavior of app.core-apps.com/dragoncon26, the scrape source for schedule ingestion.
tags: [upstream, ingestion, scraping]
generated: { by: docsmith/1.3.0, at: 2026-08-29T07:04:03Z }
status: stable
maintainer: CyberDragon Engineering
sources:
  - id: alias-map
    resource: lib/ingest.ts:248-260
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

- **Sun `Sep++6`: 637 events** — from a production run log (`Found 637 events for day Sunday, Sep  6`).
- **Sat `Sep++5`: 660 events** — counted from a live listing fetch on 2026-08-27.
- **Fri `Sep++4`: ~691 events** — operator-confirmed.
- Wed 4 · Thu 129 · Mon/Tue small — read off older ingestion logs, not re-verified; treat as order-of-magnitude. An earlier revision of this doc recorded Friday as 271 from those same logs and was wrong by 2.5×, so the unverified figures here likely under-report [^upstream-session].
- Listings grow as programming is added, so sizing decisions must assume headroom above the largest confirmed number rather than matching it; see `docs/rules/ingestion-budget.md`.
- Detail pages are **~215 KB** each, of which only ~24 KB is event content — the reason `sliceDetailRegion` exists.

[^alias-map]: `lib/ingest.ts:248-260`
[^alias-test]: `tests/ingest-modes.test.ts:1092-1110`
[^upstream-session]: session 2026-08-27
