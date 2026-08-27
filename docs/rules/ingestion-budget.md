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
    resource: lib/ingest.ts:11-27
    title: WRITE_CHUNK batching and DEFAULT_DETAIL_FETCH_BUDGET (1800, shared per invocation)
  - id: ingest-filter
    resource: lib/ingest.ts:158-213
    title: Weekday→Sep++N alias map and calendar-aware isFutureConDayParam past-day filter
  - id: ingest-tests
    resource: tests/ingest-modes.test.ts:913-1121
    title: Budget bounds/wiring, op-ceiling, write-isolation, ordering, and past-day regression tests
  - id: cron-rotation
    resource: crons/sync-schedule.ts:13-60
    title: CADENCE_MS tick-interval map and per-tick nextSyncDays round-robin with past-day skipping
  - id: wrangler-limits
    resource: wrangler.jsonc:9-14
    title: Workers subrequests ceiling (2000) that caps per-invocation detail budgets
  - id: session-log
    resource: docs/log.md
    title: 2026-08-26 starvation postmortem (root cause, rejected approaches)
---

# Schedule Ingestion Budget & Ordering Rules

## Budget invariants

- `DEFAULT_DETAIL_FETCH_BUDGET = 1800` detail fetches are shared across the **whole invocation**, not per day [^ingest-module]. It is sized so the largest single con day always completes: Friday is **~691 events** (operator-confirmed), and cron rotation hands each invocation exactly one day. The cron passes no override; admin's throttle dropdown supplies its own, and its "full" option means *this default*.
- Under-sizing the budget is not merely slow, it is **lossy**: a truncated day skips its deletion sweep, so cancellations stop being detected. The earlier `400` default could not finish any weekend day.
- Upper bound is the Workers per-invocation subrequest ceiling (`limits.subrequests = 2000`) [^wrangler-limits], shared by every `fetch()` **and** D1 call; batched writes cost ≈1.04 subrequests per event, so 1800 events ≈ 1880 subrequests. A test asserts the constant stays inside `[700, 1900]` [^ingest-tests].
- Day listings are walked to exhaustion, never blind-sliced. A day that runs out of budget mid-listing sets `truncated`, and **`truncated` suppresses the deletion sweep** for that day: an incomplete scrape cannot distinguish "removed upstream" from "not attempted" [^session-log].
- **Rejected: skipping detail fetches for unchanged listing rows.** Comparing a listing entry's title/time against the stored row would cut ~90% of fetches at a tight cadence, but track, speakers, room and description exist *only* on the detail page — an event moved to another room, or a swapped panelist, would go undetected until a hard-resync. Two existing tests encode that contract (`track/speakers-only changes`, `migrated content hash`) and both fail under the skip; it was implemented, proven wrong by those tests, and reverted [^session-log]. If per-tick cost ever needs cutting, rotate detail refreshes across ticks (bounded staleness) rather than skipping them on a field compare.

## Ordering rule

- Days process **smallest-first** (ascending listing size, listings fetched once up front). Fixed upstream order starved late days: Wed(4)+Thu(129) left 267 of the old 400 budget, Friday alone exhausted it, and Sat/Sun got zero attempts [^session-log]. Ascending order guarantees small days *complete* — deletion scans included — and concentrates any shortfall explicitly on the largest day, announced mid-run with exact progress counts.

## Past-day rule

- Default day expansion (cron rotation, admin "All") skips con dates earlier than **today in `America/New_York`**. The predicate is calendar-aware, not a bare day-number compare — before September everything is future, after September everything is past, and today stays live until midnight ET [^ingest-filter]. A naive `Sep++N day >= today` check would have dropped the entire schedule while run in August.
- Explicit `days:` requests bypass the filter (operator intent wins); `hard-resync` always re-pulls the full window; params that do not match `Sep++N` (synthetic test days, future formats) are exempt from auto-dropping; `options.now` keeps the clock injectable for tests.

## Cron rotation

- One con day per tick via deterministic `nextSyncDays()` round-robin; each tick gets the Worker's whole budget instead of sharing it seven ways [^cron-rotation].
- The rotation slot is `floor(now / cadenceMs) % 7`, where `cadenceMs` comes from `CADENCE_MS[controller.cron]` — the tick interval of the pattern that fired. Keying the slot to the **cadence** (not a fixed constant) is what makes each invocation advance exactly one day: a fixed 4h slot left the 10-minute con-week cadence re-syncing one day for 24 consecutive ticks. Adding a cron pattern requires a `CADENCE_MS` entry; a test asserts the two stay in sync [^cron-rotation].
- Slots pointing at passed days collapse forward to the first live day, so the current day absorbs the freed ticks — coverage tightens as the con progresses (Sep 5: every live day within 70 min, today ~4× per cycle; Sep 7: today ~6 of 7 ticks). Returns empty (handler no-ops) once the con is over [^cron-rotation].
- Rejected alternative: literal parallel invocations / self-fanout (one HTTP call per day). Each call would get a fresh subrequest budget, but the design adds internal auth wiring between cron and the signed route, and N-way upstream concurrency risks tripping rate limits — recorded here so it is not re-litigated [^session-log].

## Write batching

- Existing rows pre-read in chunked `IN()` statements; creates flush as multi-row inserts with **per-row replay fallback** — a single poisoned row fails alone with `errors+=1` and its siblings persist byte-for-byte; lastSeen refreshes batch into one bulk UPDATE. A 120-event day drops from 361 D1 statements to double digits [^ingest-tests].

[^ingest-module]: `lib/ingest.ts:11-27`
[^ingest-filter]: `lib/ingest.ts:158-213`
[^ingest-tests]: `tests/ingest-modes.test.ts:913-1121`
[^cron-rotation]: `crons/sync-schedule.ts:13-60`
[^wrangler-limits]: `wrangler.jsonc:9-14`
[^session-log]: `docs/log.md`, entry 2026-08-26
