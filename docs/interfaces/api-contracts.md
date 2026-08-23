---
type: API Contracts
title: CyberDragon Hono API Contracts
description: Request and response schemas for all file-based Hono endpoints on Cloudflare Workers.
tags: [api-contracts, interfaces, hono, endpoints]
generated: { by: docsmith/1.3.0, at: 2026-08-23T15:40:00Z }
verified: [{ by: docsmith/1.3.0, at: 2026-08-22T06:15:00Z }]
status: stable
maintainer: CyberDragon Engineering
sources:
  - id: events-route
    resource: routes/api/events.ts:1-87
    title: Event search, filter, and facet handler
  - id: changes-route
    resource: routes/api/changes.ts:1-21
    title: Recent schedule changes handler
  - id: schedule-route
    resource: routes/api/schedule.ts:1-120
    title: User schedule and conflict detection handler
  - id: friends-route
    resource: routes/api/friends.ts:1-101
    title: Squad friendship and schedule overlap handler
  - id: auth-route
    resource: routes/api/auth.ts:1-79
    title: Password authentication handler
  - id: passkey-route
    resource: routes/api/auth/passkey.ts:1-225
    title: WebAuthn passkey registration and login ceremony handler
  - id: ics-route
    resource: routes/api/export-ics.ts:1-75
    title: RFC 5545 iCalendar export handler
  - id: ingest-route
    resource: routes/api/ingest.ts:1-22
    title: Schedule scraping ingestion handler
  - id: admin-ingest-route
    resource: routes/api/admin/ingest.ts:1-72
    title: Admin schedule ingestion execution handler
  - id: admin-stats-route
    resource: routes/api/admin/stats.ts:1-52
    title: Admin database stats handler
  - id: admin-runs-route
    resource: routes/api/admin/runs.ts:1-16
    title: Admin historical ingestion runs query handler
---

# CyberDragon Hono API Contracts

> Complete interface contracts for all backend HTTP endpoints running on Cloudflare Workers via Hono routing.

---

## 1. Events API (`/api/events`)

Query and filter convention schedule events [^events-route].

- **Method:** `GET`
- **Query Parameters:**
  - `id` (optional, string): Fetch single event by UUID.
  - `search` (optional, string): Case-insensitive match against title, description, location, or track.
  - `day` (optional, string): Filter by day string (e.g. `"Thursday, Sep 3"`).
  - `track` (optional, string): Filter by exact fan track name.
  - `location` (optional, string): Substring match on venue location.
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

---

## 6. Admin Stats & Run History (`/api/admin/stats`, `/api/admin/runs`)

Administrative health checks, metrics, and audit history [^admin-stats-route] [^admin-runs-route].

- **`GET /api/admin/stats`**: Returns active event counts, deleted event counts, per-day breakdowns, total users, and latest ingestion run summary.
- **`GET /api/admin/runs`**: Returns 50 most recent ingestion executions with mode, status, stats summary, and completed timestamps.
- **`GET /api/admin/runs/:id`**: Returns a single ingestion execution record including full captured console logs.
