# Admin Ingestion Dashboard & Control Subsystem Design

**Date:** 2026-08-23  
**Status:** Implemented  
**Author:** CyberDragon Companion Team

---

## 1. Overview & Goals

CyberDragon Companion requires an administrative subsystem that puts schedule data ingestion and troubleshooting controls exclusively into the hands of the con assistant admin.

### Key Goals
1. **Admin-Only Ingestion:** Only authenticated admin accounts can trigger schedule synchronization from the official Dragon Con core-apps source (`app.core-apps.com/dragoncon26`).
2. **Safe & Emergency Ingestion Modes:**
   - **`sync` (Default):** Diff against local D1 SQLite events, inserting new events, updating modified records, and logging diffs to `event_changes`.
   - **`dry-run`:** Full fetch and diff calculation in memory with zero database writes, producing a detailed change preview and logs.
   - **`hard-resync`:** Emergency convention mode to wipe/overwrite local event schedules with fresh upstream source data if desync occurs.
3. **Dedicated Admin Dashboard (`/admin`):** A standalone web interface to configure sync options (day filters, depth limiters), view real-time log output, inspect diffs, and audit past sync runs.
4. **Role-Based Access Control (RBAC):** Gated endpoints and frontend routes using the existing user authentication system with a new `role` designation (`admin` | `user`).

---

## 2. Architecture & Data Model

### 2.1 Database Schema Updates (`db/schema.ts`)

#### `users` Table Enhancement
Add a `role` column defaulting to `"user"`:
```typescript
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"), // "user" | "admin"
  avatarUrl: text("avatar_url"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});
```

#### New Table: `ingestion_runs`
Tracks historical synchronization executions and troubleshooting logs:
```typescript
export const ingestionRuns = sqliteTable("ingestion_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  mode: text("mode").notNull(), // "sync" | "dry-run" | "hard-resync"
  status: text("status").notNull(), // "running" | "completed" | "failed"
  days: text("days"), // JSON array string of targeted days, e.g. '["Friday"]'
  stats: text("stats"), // JSON string: { totalScraped, created, updated, deleted, errors }
  log: text("log"), // Combined text log of the run
  errorMessage: text("error_message"),
  startedAt: text("started_at").notNull().default(sql`(datetime('now'))`),
  completedAt: text("completed_at"),
});
```

---

## 3. Backend & API Design

### 3.1 Admin Authentication Guard (`lib/auth.ts`)
- Extract user identity and role from session token (via Authorization Bearer header or Cookie).
- Validate that the user exists in `users` and `user.role === 'admin'`.
- Return `403 Forbidden` if unauthorized, `401 Unauthorized` if unauthenticated.

### 3.2 Ingestion Engine Refactor (`lib/ingest.ts`)
Refactor `runIngestion` to accept execution mode and return rich diff summaries:
```typescript
export interface IngestOptions {
  days?: string[];
  maxDetailFetches?: number;
  mode?: "sync" | "dry-run" | "hard-resync";
  userId?: string;
  onProgress?: (msg: string) => void;
}

export interface IngestDiffSummary {
  createdEvents: Array<{ id: string; title: string; location: string; time: string }>;
  updatedEvents: Array<{ id: string; title: string; changes: string }>;
  deletedEvents: Array<{ id: string; title: string }>;
}

export interface IngestResult {
  runId?: number;
  mode: "sync" | "dry-run" | "hard-resync";
  totalScraped: number;
  created: number;
  updated: number;
  deleted: number;
  errors: number;
  diffSummary: IngestDiffSummary;
  log: string[];
}
```

- **In `dry-run` mode:** Perform HTTP fetches and parsing, diff against existing D1 records in memory, build `diffSummary` and `log`, but skip all `db.insert`, `db.update`, and `db.delete`.
- **In `hard-resync` mode:** Wipe or soft-reset event records for the targeted days, ingest all freshly scraped records as new, and record an audit log.

### 3.3 Admin API Endpoints

1. **`POST /api/admin/ingest`**
   - **Auth:** Admin only.
   - **Body:**
     ```json
     {
       "mode": "sync" | "dry-run" | "hard-resync",
       "days": ["Friday", "Saturday"],
       "maxDetailFetches": 50
     }
     ```
   - **Response:**
     ```json
     {
       "success": true,
       "result": {
         "runId": 12,
         "mode": "sync",
         "totalScraped": 340,
         "created": 15,
         "updated": 4,
         "deleted": 0,
         "errors": 0,
         "diffSummary": { ... },
         "log": [ ... ]
       }
     }
     ```

2. **`GET /api/admin/stats`**
   - **Auth:** Admin only.
   - **Response:**
     ```json
     {
       "success": true,
       "stats": {
         "totalEvents": 1420,
         "eventsByDay": { "Thursday": 120, "Friday": 380, "Saturday": 450, "Sunday": 350, "Monday": 120 },
         "totalUsers": 28,
         "lastSync": {
           "id": 12,
           "completedAt": "2026-08-23T14:30:00Z",
           "mode": "sync",
           "created": 15,
           "updated": 4
         }
       }
     }
     ```

3. **`GET /api/admin/runs`**
   - **Auth:** Admin only.
   - **Response:**
     ```json
     {
       "success": true,
       "runs": [
         {
           "id": 12,
           "mode": "sync",
           "status": "completed",
           "startedAt": "2026-08-23T14:28:10Z",
           "completedAt": "2026-08-23T14:30:00Z",
           "stats": { "totalScraped": 340, "created": 15, "updated": 4, "deleted": 0, "errors": 0 }
         }
       ]
     }
     ```

4. **`GET /api/admin/runs/:id`**
   - **Auth:** Admin only.
   - **Response:** Full run details including raw text logs.

---

## 4. Admin Management CLI Script

Create `scripts/make-admin.ts`:
- Promotes a target user account to admin:
  ```bash
  pnpm run make-admin <username>
  ```
- Directly updates `users.role = 'admin'` for the matched username in D1 SQLite.

---

## 5. Frontend Dashboard (`pages/admin.tsx`)

### 5.1 Route & Access Control
- Dedicated route at `/admin` (server-rendered with SSR auth check).
- Redirects or renders a 403 Access Denied panel if the user is unauthenticated or not an admin.

### 5.2 UI Components & Layout
Styled using the CyberDragon Glass design system:
1. **Header & Navigation Bar:**
   - Admin badge + database connection status.
   - Return link to main schedule app (`/`).
2. **Stats Bar:**
   - Metric pills: Total Events, Events by Day, Last Ingest Run Timestamp, Total Users.
3. **Ingestion Controls Card:**
   - **Mode Selection:** Segmented toggle (`Normal Sync`, `Dry Run (Safe Preview)`, `⚠️ Hard Resync`).
   - **Day Filters:** Multi-select chips (`All`, `Thu`, `Fri`, `Sat`, `Sun`, `Mon`).
   - **Detail Limiter:** Dropdown (`Full`, `10 Events`, `50 Events`).
   - **Execute Button:** `[ ⚡ Start Sync ]` with active spinner and confirmation modal for `hard-resync`.
4. **Log Terminal & Live Feed:**
   - Dark JetBrains Mono console container with auto-scroll and filter buttons (All, Created, Updated, Errors).
5. **Diff Inspector Drawer:**
   - Visual breakdown of created, updated, and deleted events from the latest run.
6. **Past Runs History Table:**
   - List of previous ingestion executions with mode, status, stats summary, and expandable log viewer.

---

## 6. Testing & Verification Strategy

1. **Unit & Integration Tests:**
   - Test `runIngestion` in `dry-run` mode verifying no database mutations occur.
   - Test `runIngestion` in `sync` mode verifying diffing, insertions, and updates.
   - Test `runIngestion` in `hard-resync` mode verifying complete refresh.
   - Test `adminGuard` middleware rejecting unauthenticated and regular user requests with `401` / `403`.
   - Test `make-admin` script promoting users.
2. **Browser & UI Verification:**
   - Log in with non-admin user -> verify `/admin` shows Access Denied.
   - Run `make-admin` -> log in with admin user -> verify `/admin` renders dashboard.
   - Trigger a `dry-run` ingestion -> observe terminal log and diff summary without changing DB count.
   - Trigger a targeted single-day `sync` -> verify database updates and sync run logged.
