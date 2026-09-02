---
type: API Contracts
title: CyberDragon Hono API Contracts
description: Request and response schemas for all file-based Hono endpoints on Cloudflare Workers.
tags: [api-contracts, interfaces, hono, endpoints]
generated: { by: docsmith/1.3.0, at: 2026-08-29T07:04:03Z }
verified: [{ by: docsmith/1.3.0, at: 2026-08-26 }, { by: docsmith/1.3.0, at: 2026-08-29T07:04:03Z }]
status: stable
maintainer: CyberDragon Engineering
sources:
  - id: events-route
    resource: routes/api/events.ts:1-104
    title: Event search, filter, and facet handler
  - id: changes-route
    resource: routes/api/changes.ts:1-21
    title: Recent schedule changes handler
  - id: schedule-route
    resource: routes/api/schedule.ts:1-120
    title: User schedule and conflict detection handler
  - id: friends-route
    resource: routes/api/friends.ts:1-147
    title: Squad friendship, schedule privacy, and full agenda handler
  - id: privacy-route
    resource: routes/api/user/privacy.ts:1-31
    title: User squad schedule privacy settings handler
  - id: auth-route
    resource: routes/api/auth.ts:1-82
    title: Password authentication handler
  - id: passkey-route
    resource: routes/api/auth/passkey.ts:1-237
    title: WebAuthn passkey registration and login ceremony handler
  - id: ics-route
    resource: routes/api/export-ics.ts:1-75
    title: RFC 5545 iCalendar export handler
  - id: ingest-route
    resource: routes/api/ingest.ts:1-29
    title: Schedule scraping ingestion handler
  - id: admin-ingest-route
    resource: routes/api/admin/ingest.ts:1-31
    title: Admin schedule ingestion execution handler
  - id: legacy-ingest-route
    resource: routes/api/ingest.ts:1-29
    title: Legacy admin ingestion trigger (same engine, response without runId echo)
  - id: hello-route
    resource: routes/api/hello.ts:1-9
    title: Void scaffold health check endpoint
  - id: admin-stats-route
    resource: routes/api/admin/stats.ts:1-178
    title: Admin database stats handler
  - id: admin-runs-route
    resource: routes/api/admin/runs.ts:1-16
    title: Admin historical ingestion runs query handler
  - id: admin-run-detail-route
    resource: routes/api/admin/runs/[id].ts:1-27
    title: Single admin ingestion run and captured log handler
  - id: feedback-route
    resource: routes/api/feedback.ts:1-69
    title: Attendee feedback submission and admin retrieval endpoint
  - id: feedback-status-route
    resource: routes/api/feedback/[id].ts:1-40
    title: Admin feedback triage status transition handler
  - id: cron-sync-handler
    resource: crons/sync-schedule.ts:1-112
    title: Scheduled cron rotation and ingestion handler
---

# CyberDragon Hono API Contracts

> Complete interface contracts for all backend HTTP endpoints running on Cloudflare Workers via Hono routing.

---

## 1. Events API (`/api/events`)

Query and filter convention schedule events [^events-route].

- **Ordering:** Results are ordered chronologically by `startsAt ASC, title ASC`.
- **Method:** `GET`
- **Query Parameters:**
  - `id` (optional, string): Fetch single event by UUID.
  - `search` (optional, string): Case-insensitive match against title, description, location, or track.
  - `day` (optional, string): Filter by day string (e.g. `"Thursday, Sep 3"`).
  - `track` (optional, string): Filter by exact fan track name.
  - `location` (optional, string): Substring match on venue location.
  - `excludeTracks` (optional, repeatable string): Hide events on the named fan tracks and return everything else (`?excludeTracks=Anime&excludeTracks=Horror`). Repeated params rather than a comma-joined list so track names containing commas survive. Applied after facet computation, so excluded tracks remain listed in `facets.tracks` and the client filter sheet can offer them for un-excluding.
  - `onlyChanged` (optional, `"true"` | `"false"`): Return only events with logged changes in `event_changes`.
- **Response Shape:**
  ```json
  {
    "success": true,
    "count": 100,
    "events": [
      {
        "id": "string",
        "title": "string",
        "description": "string",
        "location": "string",
        "track": "string",
        "startsAt": "ISO8601 string",
        "endsAt": "ISO8601 string",
        "durationMinutes": 60,
        "day": "string",
        "timeString": "string",
        "speakers": "JSON string",
        "contentHash": "string",
        "firstSeenAt": "string",
        "lastSeenAt": "string",
        "isDeleted": 0
      }
    ],
    "facets": {
      "tracks": ["string"],
      "days": ["string"],
      "locations": ["string"]
    }
  }
  ```

---

## 2. Schedule & Conflicts API (`/api/schedule`)

Manage user agenda and detect active overlapping panel conflicts [^schedule-route].

- **Methods:** `GET`, `POST`
- **GET Parameters:** `?userId=<string>`
- **GET Response:**
  ```json
  {
    "success": true,
    "count": 5,
    "items": [
      {
        "id": "userId:eventId",
        "userId": "string",
        "eventId": "string",
        "status": "going | interested",
        "notes": "string | null",
        "addedAt": "string",
        "event": { ... }
      }
    ],
    "conflicts": [
      {
        "event1Id": "string",
        "event2Id": "string",
        "title1": "string",
        "title2": "string"
      }
    ]
  }
  ```
- **POST Request Body:**
  ```json
  {
    "userId": "string",
    "eventId": "string",
    "action": "add | remove | update",
    "status": "going | interested",
    "notes": "string"
  }
  ```

---

## 3. Passkey Authentication API (`/api/auth/passkey`)

Implements FIDO2 WebAuthn authentication ceremonies backed by D1 [^passkey-route].

- **Method:** `POST`
- **Query Parameter:** `?action=`
- **Actions:**
  - `generate-register-options`: Returns `PublicKeyCredentialCreationOptionsJSON` for `@simplewebauthn/browser`.
  - `verify-register`: Validates client attestation response and stores credential in `authenticators` table.
  - `generate-login-options`: Returns `PublicKeyCredentialRequestOptionsJSON`.
  - `verify-login`: Verifies assertion signature, updates counter, and returns user session token.

---

## 4. Schedule ICS Export (`/api/export-ics`)

Generates an RFC 5545 iCalendar feed from a user's saved schedule [^ics-route].

- **Method:** `GET`
- **Query Parameter:** `?userId=<string>`
- **Response:**
  - `Content-Type`: `text/calendar; charset=utf-8`
  - `Content-Disposition`: `attachment; filename="dragoncon-schedule.ics"`
  - Body: Valid VCALENDAR format with VEVENT entries.

---

## 5. Admin Ingestion API (`/api/admin/ingest`)

Trigger manual schedule data synchronization from core-apps [^admin-ingest-route].

- **Auth:** Requires Bearer token with `role: "admin"`. Returns `401 Unauthorized` if unauthenticated, `403 Forbidden` if non-admin.
- **Method:** `POST`
- **Request Body:**
  ```json
  {
    "mode": "sync | dry-run | hard-resync",
    "days": ["Friday, Sep  4", "Saturday, Sep  5"],
    "maxDetailFetches": 50
  }
  ```
- **Subrequest Safety:** `maxDetailFetches` bounds total event-detail fetches for the *whole* run, shared across every `days` entry rather than reset per day. Omit it to use `DEFAULT_DETAIL_FETCH_BUDGET = 1800` from `lib/ingest.ts`, sized below the Worker's configured `limits.subrequests` in `wrangler.jsonc`.
- **Response Shape:**
  ```json
  {
    "success": true,
    "runId": 1,
    "result": {
      "mode": "sync",
      "totalScraped": 28,
      "created": 28,
      "updated": 0,
      "deleted": 0,
      "errors": 0,
      "diffSummary": {
        "createdEvents": [],
        "updatedEvents": [],
        "deletedEvents": []
      },
      "log": ["string"]
    }
  }
  ```
- **Failure (`500`):** `{ "success": false, "error": "message" }`. The run row is always recorded (status `failed` with the error message) by `runIngestionWithRunLog()` in `lib/ingest.ts` — the single writer of `ingestion_runs` used by this route, legacy `POST /api/ingest`, and the scheduled cron.

---

## 6. Admin Stats & Run History (`/api/admin/stats`, `/api/admin/runs`)

Administrative health checks, metrics, and audit history [^admin-stats-route] [^admin-runs-route].

- **`GET /api/admin/stats`**: Returns active event counts, deleted event counts, per-day breakdowns, total users, latest ingestion run summary, and `usage` — an aggregate, non-identifiable read of saved schedules (total saves, going/interested split, median saves per active user, schedule-size buckets, saves per ET day, top tracks/locations, saves by con day, peak ET hours). Aggregation happens in the Worker; no per-user data leaves it.
- **`GET /api/admin/runs`**: Returns 50 most recent ingestion executions — manual admin runs, legacy `POST /api/ingest` calls, and scheduled cron runs (attributed to `user_id: "cron"`) — with mode, status, stats summary, and completed timestamps.
- **`GET /api/admin/runs/:id`**: Returns a single ingestion execution record including full captured console logs [^admin-run-detail-route].

---

## 7. Attendee Feedback API (`/api/feedback`)

Allows attendees to submit bug reports or suggestions from the companion app, and serves as the destination for automated crash reports dispatched by the client-side Error Boundary and global error listeners [^feedback-route].

- **Automated Crash Reporting:** Dispatches runtime exceptions with `kind: "bug"`, `contact: "Automated Error Report"`, and sanitized error message + stack trace (Bearer tokens and passwords redacted, capped at 2000 characters).
### `POST /api/feedback`

- **Auth:** Public (unauthenticated attendees or signed-in users can submit).
- **Request Body:**
  ```json
  {
    "kind": "bug | idea",
    "message": "string (1-2000 chars)",
    "contact": "string (optional, max 200 chars)",
    "userId": "string (optional)",
    "username": "string (optional)",
    "appVersion": "string (optional)",
    "pageUrl": "string (optional)"
  }
  ```
- **Validation Rules:**
  - `kind` must be exactly `"bug"` or `"idea"`.
  - `message` is required, non-empty, and capped at 2000 characters.
  - `contact` is optional, trimmed, and capped at 200 characters (stored as `null` if blank).
  - `userAgent` is captured server-side from the `User-Agent` request header.
- **Response Shape:**
  - Success (`200 OK`):
    ```json
    {
      "success": true,
      "message": "Thanks — your note is in."
    }
    ```
  - Client Error (`400 Bad Request`):
    ```json
    {
      "success": false,
      "error": "kind must be bug or idea"
    }
    ```

### `GET /api/feedback`

- **Auth:** Requires Bearer token or session cookie with `role: "admin"`. Returns `401 Unauthorized` if unauthenticated, `403 Forbidden` if non-admin.
- **Response Shape (`200 OK`):**
  ```json
  {
    "success": true,
    "feedback": [
      {
        "id": "uuid string",
        "userId": "string | null",
        "username": "string | null",
        "kind": "bug | idea",
        "message": "string",
        "contact": "string | null",
        "appVersion": "string | null",
        "userAgent": "string | null",
        "pageUrl": "string | null",
        "status": "new | in_progress | done | archived",
        "createdAt": "ISO8601 timestamp"
      }
    ]
  }
  ```

### `PATCH /api/feedback/:id`

- **Auth:** Same admin guard as `GET` (`401` unauthenticated, `403` non-admin).
- **Request Body:** `{ "status": "new" | "in_progress" | "done" | "archived" }` — any other value returns `400 Bad Request`; unknown `:id` returns `404 Not Found`.
- **Lifecycle:** `new → in_progress → done | archived`, with reopen to `new` permitted from any state (last write wins).
- **Response Shape (`200 OK`):**
  ```json
  {
    "success": true,
    "feedback": { "id": "uuid string", "status": "done", "...": "full feedback row" }
  }
  ```
---

## 8. Legacy & Misc Endpoints

Compact registry for endpoints whose full schemas live in the SYSTEM_DESIGN API table (`docs/SYSTEM_DESIGN.md`, section 6) — added here so every route file has a registered home without duplicating schemas:

| Method | Endpoint | Purpose | Notes |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth` | Password register / login | Returns `{ success, user, token }` including `user.shareSchedule` [^auth-route] |
| `PATCH` | `/api/user/privacy` | Toggle squad schedule visibility | Body `{ userId, shareSchedule }`, returns `{ success, shareSchedule }` [^privacy-route] |
| `GET` | `/api/changes` | Recent schedule diffs | `?limit=` (default 50) [^changes-route] |
| `GET` / `POST` | `/api/friends` | Squad friends & full / shared schedule | `GET ?userId=&friendId=` returns `{ success, scheduleHidden, friend, friendEvents, sharedEvents, sharedEventIds }` (requires existing squad connection); `POST` adds friend by username [^friends-route] |
| `POST` | `/api/ingest` | Legacy admin ingestion trigger | Same engine as `/api/admin/ingest` via `runIngestionWithRunLog()`; run is recorded in history; returns `{ success, result }` where `result` includes `runId` [^legacy-ingest-route] |
| `GET` | `/api/hello` | Void scaffold health check | Static JSON, no auth |
---

## 9. Background Worker Cron Triggers

### `ScheduledController` — `crons/sync-schedule.ts`

In addition to HTTP endpoints, the Cloudflare Worker executes background sync triggers generated by Void:

- **Cron Schedules:**
  - `"0 */4 * 8 *"` (Every 4h in August)
  - `"0 */2 1-2 9 *"` (Every 2h Sept 1–2)
  - `"*/10 * 3-7 9 *"` (Every 10m during Dragon Con Sept 3–7)
- **Payload / Context:** Invoked with `(controller: ScheduledController, env: CloudEnv['Bindings'], ctx: ExecutionContext)`.
- **Behavior:** Checks `isWithinActiveWindow()`. If outside Aug 24 – Sep 7 2026, early-returns. Otherwise executes `runIngestionWithRunLog({ mode: "sync" })` — recording the run in `ingestion_runs` history (attributed `user_id: "cron"`) — without passing through HTTP auth guards.

## Provenance

[^events-route]: Event search, filter, and facet handler — `routes/api/events.ts:1-104`
[^changes-route]: Recent schedule changes handler — `routes/api/changes.ts:1-21`
[^schedule-route]: User schedule and conflict detection handler — `routes/api/schedule.ts:1-120`
[^friends-route]: Squad friendship, schedule privacy, and full agenda handler — `routes/api/friends.ts:1-147`
[^privacy-route]: User squad schedule privacy settings handler — `routes/api/user/privacy.ts:1-31`
[^auth-route]: Password authentication handler — `routes/api/auth.ts:1-82`
[^passkey-route]: WebAuthn passkey registration and login ceremony handler — `routes/api/auth/passkey.ts:1-237`
[^ics-route]: RFC 5545 iCalendar export handler — `routes/api/export-ics.ts:1-75`
[^admin-ingest-route]: Admin schedule ingestion execution handler — `routes/api/admin/ingest.ts:1-31`
[^admin-stats-route]: Admin database stats handler — `routes/api/admin/stats.ts:1-178`
[^admin-runs-route]: Admin historical ingestion runs query handler — `routes/api/admin/runs.ts:1-16`
[^admin-run-detail-route]: Single admin ingestion run and captured log handler — `routes/api/admin/runs/[id].ts:1-27`
[^legacy-ingest-route]: Legacy admin ingestion trigger — `routes/api/ingest.ts:1-29`
[^feedback-route]: Attendee feedback submission and admin retrieval endpoint — `routes/api/feedback.ts:1-69`
