---
type: Domain Rules
title: Schedule Ingestion Budget & Ordering Rules
description: Invariants governing the shared detail-fetch budget, smallest-first day ordering, past-day skipping, and batched writes in runIngestion.
tags: [ingestion, cron, budget, d1]
generated: { by: docsmith/1.3.0, at: 2026-08-27 }
status: stable
maintainer: CyberDragon Engineering
sources:
  - id: ingest-module
    resource: lib/ingest.ts:11-24
    title: WRITE_CHUNK batching and DEFAULT_DETAIL_FETCH_BUDGET (400, shared per invocation)
  - id: ingest-filter
    resource: lib/ingest.ts:158-213
    title: Weekday→Sep++N alias map and calendar-aware isFutureConDayParam past-day filter
  - id: ingest-tests
    resource: tests/ingest-modes.test.ts:933-1107
    title: Op-ceiling, write-isolation poisoning, ordering, and past-day skip regression tests
  - id: cron-rotation
    resource: crons/sync-schedule.ts:10-48
    title: One con day per tick round-robin with past-day skipping
  - id: wrangler-limits
    resource: wrangler.jsonc:9-14
    title: Workers subrequests ceiling (2000) that caps per-invocation detail budgets
  - id: session-log
    resource: docs/log.md
    title: 2026-08-26 starvation postmortem (root cause, rejected approaches)
---

# Schedule Ingestion Budget & Ordering Rules

## Budget invariants

- `DEFAULT_DETAIL_FETCH_BUDGET = 400` detail fetches are shared across the **whole invocation**, not per day [^ingest-module]. Callers pass `maxDetailFetches` explicitly; the cron and admin default to **1900**, sized under the Worker's 2000-subrequest ceiling [^wrangler-limits] (D1 operations also count against it).
- Day listings are walked to exhaustion, never blind-sliced. A day that runs out of budget mid-listing sets `truncated`, and **`truncated` suppresses the deletion sweep** for that day: an incomplete scrape cannot distinguish "removed upstream" from "not attempted" [^session-log].

## Ordering rule

- Days process **smallest-first** (ascending listing size, listings fetched once up front). Fixed upstream order starved late days: Wed(4)+Thu(129) left 267 of 400 and Friday alone (271) killed the run, giving Sat/Sun zero attempts [^session-log]. Ascending order guarantees small days *complete* — deletion scans included — and concentrates any shortfall explicitly on the largest day, announced mid-run with exact progress counts.

## Past-day rule

- Default day expansion (cron rotation, admin "All") skips con dates earlier than **today in `America/New_York`**. The predicate is calendar-aware, not a bare day-number compare — before September everything is future, after September everything is past, and today stays live until midnight ET [^ingest-filter]. A naive `Sep++N day >= today` check would have dropped the entire schedule while run in August.
- Explicit `days:` requests bypass the filter (operator intent wins); `hard-resync` always re-pulls the full window; params that do not match `Sep++N` (synthetic test days, future formats) are exempt from auto-dropping; `options.now` keeps the clock injectable for tests.

## Cron rotation

- One con day per tick via deterministic `nextSyncDays()` round-robin; each tick gets the Worker's whole budget instead of sharing it seven ways. Rotation starts from the current day, skips passed days, and returns empty (handler no-ops) once the con is over [^cron-rotation].
- Rejected alternative: literal parallel invocations / self-fanout (one HTTP call per day). Each call would get a fresh subrequest budget, but the design adds internal auth wiring between cron and the signed route, and N-way upstream concurrency risks tripping rate limits — recorded here so it is not re-litigated [^session-log].

## Write batching

- Existing rows pre-read in chunked `IN()` statements; creates flush as multi-row inserts with **per-row replay fallback** — a single poisoned row fails alone with `errors+=1` and its siblings persist byte-for-byte; lastSeen refreshes batch into one bulk UPDATE. A 120-event day drops from 361 D1 statements to double digits [^ingest-tests].

[^ingest-module]: `lib/ingest.ts:11-24`
[^ingest-filter]: `lib/ingest.ts:158-213`
[^ingest-tests]: `tests/ingest-modes.test.ts:933-1107`
[^cron-rotation]: `crons/sync-schedule.ts:10-48`
[^wrangler-limits]: `wrangler.jsonc:9-14`
[^session-log]: `docs/log.md`, entry 2026-08-26
