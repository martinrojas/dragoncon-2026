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
    resource: lib/ingest.ts:8-43
    title: ID_CHUNK/ROW_CHUNK parameter sizing, DEFAULT_DETAIL_FETCH_BUDGET, and the four per-invocation ceilings
  - id: ingest-filter
    resource: lib/ingest.ts:207-242
    title: Weekday→Sep++N alias map and calendar-aware isFutureConDayParam past-day filter
  - id: ingest-tests
    resource: tests/ingest-modes.test.ts:972-1045
    title: Budget bounds/wiring and the D1 100-bound-parameter regression test
  - id: ingest-concurrency
    resource: lib/ingest.ts:22-26
    title: "DETAIL_CONCURRENCY = 6 and the wave loop (fetchAndParse, cursor advance, listing-order append)"
  - id: prod-measurement
    resource: session:2026-08-27
    title: "Workers Logs, admin sync of Sep++6: 7,300 ms CPU / 258 s wall for 400 detail fetches of 637 listed events"
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

- Four separate per-invocation ceilings apply, and the fetch budget is **not** the tightest. In order of how close a full con day comes to each:

  | Ceiling | Value | Cost of a 691-event day |
  |---|---|---|
  | **CPU** (`limits.cpu_ms`) | 10,000 ms (pinned; cron handlers are allowed 15 min) | ~2.9 s sliced — but **~12.6 s unsliced**, which kills the invocation |
  | **D1 queries** | 1,000 (D1-side cap, independent of subrequests) | ~235 batched — but **~1,382 per-row** |
  | **Subrequests** | 2,000 (pinned; Paid default is 10,000) | ~930 (fetches + D1) |
  | **Detail fetches** | `DEFAULT_DETAIL_FETCH_BUDGET = 1800` | 691 |

- `DEFAULT_DETAIL_FETCH_BUDGET = 1800` is shared across the **whole invocation**, not per day [^ingest-module]. Cron passes no override; admin's throttle dropdown supplies its own, and its "full" option resolves to *this default* (it previously resolved to 400, the smallest value in the list). A test asserts the constant stays inside `[700, 1900]` [^ingest-tests].
- **Raising the fetch budget alone cannot complete a weekend day.** Production measurement puts a full-document parse at **~18 ms CPU per event** [^prod-measurement], so the CPU pin caps an invocation near **548 events** — below Sunday (637), Saturday (660) and Friday (691). `sliceDetailRegion` cuts this ~4.4× to ~4 ms/event (~2.7 s for Sunday), validated against 12 live detail pages with byte-identical field extraction, and is what actually makes a full day completable [^ingest-module].
- Under-sizing any ceiling is not merely slow, it is **lossy**: a truncated or killed day skips its deletion sweep, so cancellations stop being detected. Production has never run the sweep on Fri/Sat/Sun.
- Day listings are walked to exhaustion, never blind-sliced. A day that runs out of budget mid-listing sets `truncated`, and **`truncated` suppresses the deletion sweep** for that day: an incomplete scrape cannot distinguish "removed upstream" from "not attempted" [^session-log].
- **Rejected: skipping detail fetches for unchanged listing rows.** Comparing a listing entry's title/time against the stored row would cut ~90% of fetches at a tight cadence, but track, speakers, room and description exist *only* on the detail page — an event moved to another room, or a swapped panelist, would go undetected until a hard-resync. Two existing tests encode that contract (`track/speakers-only changes`, `migrated content hash`) and both fail under the skip; it was implemented, proven wrong by those tests, and reverted [^session-log]. If per-tick cost ever needs cutting, rotate detail refreshes across ticks (bounded staleness) rather than skipping them on a field compare.

## Ordering rule

- Days process **smallest-first** (ascending listing size, listings fetched once up front). Fixed upstream order starved late days: Wed(4)+Thu(129) left 267 of the old 400 budget, Friday alone exhausted it, and Sat/Sun got zero attempts [^session-log]. Ascending order guarantees small days *complete* — deletion scans included — and concentrates any shortfall explicitly on the largest day, announced mid-run with exact progress counts.

## Fetch concurrency rule

- Detail pages are fetched in waves of `DETAIL_CONCURRENCY = 6` [^ingest-concurrency], the documented Workers ceiling on simultaneous connections awaiting response headers; beyond six, fetches merely queue [^wrangler-limits]. Measured against live upstream: **625 → 152 ms per event (4.1×)**, taking Sunday's 637 events from **~6.6 min to ~1.6 min** of wall time. CPU is unaffected — parsing is still single-threaded — so this buys only latency, which is what a 10-minute cadence needs given Cloudflare does not prevent overlapping cron runs [^cron-rotation].
- **The cursor advances by the wave's actual length, never by the stride.** A wave trimmed by the remaining budget must leave the cursor on the first unfetched event, so the next pass observes an exhausted budget and marks the day `truncated`. Advancing by the full stride skipped that check whenever a trimmed wave ran off the end of the listing, which let the deletion sweep run against a partial scrape — a real regression, caught by the existing truncation tests [^ingest-tests].
- Results are appended in **listing order, not completion order**, so `parsedItems`, the diff summary and logs stay deterministic regardless of which page returns first. A test forces reversed completion inside a wave via microtask yields (no wall-clock delays) and fails if results are appended as they resolve [^ingest-tests].
- A failure inside a wave costs exactly itself: `fetchAndParse` returns `null` on a bad status or a throw, logging and counting exactly as the sequential path did, and its siblings still persist [^ingest-tests].

## Write sizing rule

- D1 caps a query at **100 bound parameters**, and the cap applies per statement even inside `batch()`. Multi-row INSERTs bind one parameter per *column* per row, so they are sized by `ROW_CHUNK = 6` against the widest table (`events`, 15 columns → 90 parameters). Statements binding one parameter per row (`WHERE id IN (…)` reads, the bulk lastSeen UPDATE) use `ID_CHUNK = 50` [^ingest-module].
- This was a live defect: `ROW_CHUNK` was 50, binding **750 parameters**, which D1 rejects on every flush. A bare `catch {}` swallowed the rejection and replayed row-by-row, so the failure was invisible and each event silently cost ~3 D1 queries — fine at 400 events (~667 queries), over the 1,000 cap above ~490. The flush now logs the degrade, and a test asserts no statement binds more than 100 parameters (it fails at `ROW_CHUNK = 50`) [^ingest-tests].

## Past-day rule

- Default day expansion (cron rotation, admin "All") skips con dates earlier than **today in `America/New_York`**. The predicate is calendar-aware, not a bare day-number compare — before September everything is future, after September everything is past, and today stays live until midnight ET [^ingest-filter]. A naive `Sep++N day >= today` check would have dropped the entire schedule while run in August.
- Explicit `days:` requests bypass the filter (operator intent wins); `hard-resync` always re-pulls the full window; params that do not match `Sep++N` (synthetic test days, future formats) are exempt from auto-dropping; `options.now` keeps the clock injectable for tests.

## Cron rotation

- One con day per tick via deterministic `nextSyncDays()` round-robin; each tick gets the Worker's whole budget instead of sharing it seven ways [^cron-rotation].
- The rotation slot is `floor(now / cadenceMs) % 7`, where `cadenceMs` comes from `CADENCE_MS[controller.cron]` — the tick interval of the pattern that fired. Keying the slot to the **cadence** (not a fixed constant) is what makes each invocation advance exactly one day: a fixed 4h slot left the 10-minute con-week cadence re-syncing one day for 24 consecutive ticks. Adding a cron pattern requires a `CADENCE_MS` entry; a test asserts the two stay in sync [^cron-rotation].
- Slots pointing at passed days collapse forward to the first live day, so the current day absorbs the freed ticks — coverage tightens as the con progresses (Sep 5: every live day within 70 min, today ~4× per cycle; Sep 7: today ~6 of 7 ticks). Returns empty (handler no-ops) once the con is over [^cron-rotation].
- Rejected alternative: literal parallel invocations / self-fanout (one HTTP call per day). Each call would get a fresh subrequest budget, but the design adds internal auth wiring between cron and the signed route, and N-way upstream concurrency risks tripping rate limits — recorded here so it is not re-litigated [^session-log].

## Write isolation

- Existing rows pre-read in chunked `IN()` statements; creates flush as multi-row inserts with **per-row replay fallback** — a single poisoned row fails alone with `errors+=1` and its siblings persist byte-for-byte; lastSeen refreshes batch into one bulk UPDATE [^ingest-tests]. Sizing of those statements is the *Write sizing rule* above.
- `db.batch()` would collapse a flush into one round trip (drizzle's D1 driver exposes it), but per-statement parameter limits still apply, so it is an optimisation on top of correct `ROW_CHUNK` sizing, not a substitute. Not adopted: the test fake would need a `batch()` shim and ~235 D1 queries is already far inside the 1,000 cap.

[^ingest-module]: `lib/ingest.ts:8-43`, `lib/ingest.ts:143-178`
[^ingest-filter]: `lib/ingest.ts:207-242`
[^ingest-tests]: `tests/ingest-modes.test.ts:15-39`, `tests/ingest-modes.test.ts:972-1045`, `tests/ingest-modes.test.ts:1062-1180`
[^ingest-concurrency]: `lib/ingest.ts:22-26`, `lib/ingest.ts:388-489`
[^prod-measurement]: Workers Logs, admin sync of `Sep++6` (2026-08-27): `cpuTimeMs: 7300`, `wallTimeMs: 258164`, 400 detail fetches of 637 listed events, `TRUNCATED`
[^cron-rotation]: `crons/sync-schedule.ts:13-60`
[^wrangler-limits]: `wrangler.jsonc:8-15`
[^session-log]: `docs/log.md`, entries 2026-08-26 and 2026-08-27
