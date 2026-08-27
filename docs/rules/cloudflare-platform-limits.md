---
type: Domain Rules
title: Cloudflare Platform Limits & Ingestion Feature Fit
description: Documented Workers/D1/Cron limits this app sizes against, which platform features do and do not help the scraper, and how production CPU was measured.
tags: [cloudflare, workers, d1, cron, limits, ingestion]
generated: { by: docsmith/1.3.0, at: 2026-08-27 }
status: stable
maintainer: CyberDragon Engineering
sources:
  - id: cf-workers-limits
    resource: https://developers.cloudflare.com/workers/platform/limits/
    title: Subrequests (50 Free / 10,000 Paid default, up to 10M), internal-services split, six simultaneous connections; checked 2026-08-27
  - id: cf-d1-limits
    resource: https://developers.cloudflare.com/d1/platform/limits/
    title: 100 bound parameters per query (applies per statement inside batch()), 1000 queries per invocation Paid / 50 Free, batch statement-level caps; page dated Apr 21 2026
  - id: cf-subrequests-changelog
    resource: https://developers.cloudflare.com/changelog/post/2026-02-11-subrequests-limit/
    title: February 2026 change raising the Paid default to 10,000 and making it configurable to 10 million
  - id: cf-wrangler-config
    resource: https://developers.cloudflare.com/workers/wrangler/configuration/#limits
    title: The limits block accepts cpu_ms and subrequests on paid plans; node_modules/.pnpm/wrangler@4.125.0*/wrangler/config-schema.json defines both keys
  - id: cf-scheduled-limits
    resource: https://developers.cloudflare.com/workers/configuration/cron-triggers/
    title: Scheduled invocations have a 15-minute wall-time limit; Cloudflare does not prevent overlapping runs when execution outlives the interval
  - id: cf-do-alarms
    resource: https://developers.cloudflare.com/durable-objects/api/alarms/
    title: Durable Object single-threaded actor model serializes executions; alarms are at-least-once with up to six exponential-backoff retries
  - id: cf-workflows-limits
    resource: https://developers.cloudflare.com/workflows/reference/limits/
    title: Subrequests are counted per Workflow instance, not per step
  - id: cf-queues-limits
    resource: https://developers.cloudflare.com/queues/platform/limits/
    title: Queue consumer concurrency and per-invocation cost accounting
  - id: cf-no-alerting
    resource: https://developers.cloudflare.com/workers/observability/
    title: No built-in notification for individual Worker runtime failures; monitoring requires custom implementation (Tail Workers or external monitors)
  - id: prod-measurement
    resource: session:2026-08-27
    title: "Workers Logs invocation fields: admin sync of Sep++6 reported cpuTimeMs 7300 / wallTimeMs 258164 for 400 detail fetches of 637 listed events"
---

# Cloudflare Platform Limits & Ingestion Feature Fit

## Documented per-invocation limits (Workers Paid, checked 2026-08-27)

| Limit | Value | Source |
|---|---|---|
| Subrequests per invocation | 50 Free · 10,000 Paid default · configurable to 10M | [^cf-workers-limits] [^cf-subrequests-changelog] |
| Simultaneous connections awaiting response headers | **6** — fetches beyond six queue | [^cf-workers-limits] |
| D1 queries per invocation | **1,000** Paid / 50 Free — a D1-side cap, separate from subrequests | [^cf-d1-limits] |
| Bound parameters per query | **100**, applied **per statement**, including statements inside `batch()` | [^cf-d1-limits] |
| `db.batch()` round trips | One atomic round trip regardless of statement count; per-statement caps still apply | [^cf-d1-limits] |
| Cron (scheduled) invocation wall clock | 15 minutes | [^cf-scheduled-limits] |

Every `fetch()` **and** every call to a Cloudflare service (D1/KV/R2) counts toward the subrequest total, so a scraper that switches storage products does not escape the accounting [^cf-workers-limits].

Our own pins live in `wrangler.jsonc` (`subrequests: 2000`, `cpu_ms: 10000`) and are **self-imposed spend ceilings below the plan defaults**; the config keys themselves are documented (`limits.subrequests`, `limits.cpu_ms`) [^cf-wrangler-config]. Sizing decisions that must respect all four ingestion ceilings live in [`rules/ingestion-budget.md`](/docs/rules/ingestion-budget.md).

## Measurement practice

Local Node timings are proxies only: parsing measured at **44 ms/event locally** came out **~18 ms/event in production workerd** (~2.4× faster). Authoritative numbers come free from Workers Logs — `observability.logs.invocation_logs: true` makes each invocation record `cpuTimeMs` and `wallTimeMs`. Calibrate before sizing anything against `cpu_ms` [^prod-measurement].

## Feature fit for the ingestion workload

| Feature | Verdict |
|---|---|
| Raising our own `limits.*` pins | First lever. Cheapest headroom available; raises worst-case spend, nothing else. |
| Higher fetch budgets | Does nothing while CPU binds — see the ceiling table in `rules/ingestion-budget.md`. |
| Reducing parse work (parse region only) | The lever that made full-day completion possible; keep output byte-identical or the data integrity is affected. |
| Concurrent fetch waves (≤6) | Latency only. CPU is single-threaded JavaScript, so waves never reduce CPU cost. |
| **Workflows** | ✗ — subrequests are counted per Workflow *instance*, not per step [^cf-workflows-limits]; does not lift the fetch ceiling. Per-step CPU budgets are its benefit, and cron already grants more. |
| **Queues** | Deferred. Each consumer invocation gets its own standard invocation budgets and `max_concurrency` throttles politeness toward upstream [^cf-queues-limits]. Adopt only past ~10,000 fetches per run or when deliberate rate limiting becomes necessary. |
| **Durable Object alarms** | Deferred. Cron Triggers give no overlap protection [^cf-scheduled-limits]; a DO serializes by construction [^cf-do-alarms]. Worth adopting if runs ever threaten their cadence interval. Also the natural home for rotation cursor state, replacing the clock-derived slot. |
| **Analytics Engine** | Adopt when grep-the-log observability hurts: one `writeDataPoint` per run (mode, day, scraped/created/deleted counts), ~3-month retention, 10M points/month included on Paid. |
| Alerting on silent failure | **No native primitive exists** — no health checks, no cron-failure notifications [^cf-no-alerting]. Close the gap with a dead-man's-switch ping to an external monitor on every successful run, or a Tail Worker posting failures to a webhook. Open follow-up since PR #7. |

[^cf-workers-limits]: <https://developers.cloudflare.com/workers/platform/limits/>
[^cf-subrequests-changelog]: <https://developers.cloudflare.com/changelog/post/2026-02-11-subrequests-limit/>
[^cf-d1-limits]: <https://developers.cloudflare.com/d1/platform/limits/>
[^cf-wrangler-config]: <https://developers.cloudflare.com/workers/wrangler/configuration/#limits> (schema mirrored in `node_modules/.pnpm/wrangler@4.125.0_*/node_modules/wrangler/config-schema.json`)
[^cf-scheduled-limits]: <https://developers.cloudflare.com/workers/configuration/cron-triggers/>
[^cf-do-alarms]: <https://developers.cloudflare.com/durable-objects/api/alarms/>
[^cf-workflows-limits]: <https://developers.cloudflare.com/workflows/reference/limits/>
[^cf-queues-limits]: <https://developers.cloudflare.com/queues/platform/limits/>
[^prod-measurement]: Workers Logs invocation record quoted in `docs/rules/ingestion-budget.md`
[^cf-no-alerting]: <https://developers.cloudflare.com/workers/observability/>
