# Admin Ingestion Dashboard & Control Subsystem Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a secure administrative view (`/admin`) and backend subsystem allowing the con assistant admin to manually drive Dragon Con schedule data ingestion with `sync`, `dry-run` preview, and emergency `hard-resync` modes.

**Architecture:** 
- Add RBAC (`role` column) to `users` and a new `ingestion_runs` table for auditing sync runs in D1 SQLite.
- Provide a `scripts/make-admin.ts` CLI tool to designate admin users.
- Protect ingestion and admin APIs (`/api/admin/*`, `/api/ingest`) with an `adminGuard` helper.
- Enhance `lib/ingest.ts` to support `dry-run` (memory-only diff) and `hard-resync` (force refresh).
- Deliver a dedicated `/admin` page styled with CyberDragon Glass tokens featuring live logs, diff summaries, and run histories.

**Tech Stack:** React 19 SSR, Hono, Void, Cloudflare D1 SQLite, TypeScript, Cheerio.

**Spec:** `docs/superpowers/specs/2026-08-23-admin-ingestion-dashboard-design.md`

## Global Constraints

- Never commit credentials or secrets.
- Use Void file-based API route conventions (`defineHandler`, uppercase HTTP method exports).
- Define D1 tables using `void/schema-d1` and `void/db`. Run `pnpm run db:generate` and `pnpm run db:migrate`.
- Follow CyberDragon Glass design tokens in `public/cyberdragon.css`.
- Ensure all tests pass with `pnpm test` and production build succeeds with `pnpm build`.

---

### Task 1: Database Schema & Migration for RBAC & Ingestion Runs

**Files:**
- Modify: `db/schema.ts`
- Test: `tests/schema.test.ts`

**Interfaces:**
- Produces:
  - `users.role`: text column `"admin" | "user"`, defaults to `"user"`
  - `ingestionRuns`: D1 table with `id`, `userId`, `mode`, `status`, `days`, `stats`, `log`, `errorMessage`, `startedAt`, `completedAt`

- [ ] **Step 1: Write the failing test for schema and types**

Create `tests/schema.test.ts`:
```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { users, ingestionRuns } from "../db/schema.ts";

test("users table includes role column definition", () => {
  assert.ok(users.role, "users table should have a role column");
});

test("ingestionRuns table is defined with expected columns", () => {
  assert.ok(ingestionRuns.id, "ingestionRuns should have id");
  assert.ok(ingestionRuns.userId, "ingestionRuns should have userId");
  assert.ok(ingestionRuns.mode, "ingestionRuns should have mode");
  assert.ok(ingestionRuns.status, "ingestionRuns should have status");
  assert.ok(ingestionRuns.stats, "ingestionRuns should have stats");
  assert.ok(ingestionRuns.log, "ingestionRuns should have log");
  assert.ok(ingestionRuns.startedAt, "ingestionRuns should have startedAt");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/schema.test.ts`  
Expected: FAIL (`users.role` / `ingestionRuns` undefined)

- [ ] **Step 3: Update `db/schema.ts`**

Edit `db/schema.ts`:
```typescript
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"),
  avatarUrl: text("avatar_url"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const ingestionRuns = sqliteTable("ingestion_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  mode: text("mode").notNull(), // "sync" | "dry-run" | "hard-resync"
  status: text("status").notNull(), // "running" | "completed" | "failed"
  days: text("days"), // JSON string array e.g. '["Friday"]'
  stats: text("stats"), // JSON string { totalScraped, created, updated, deleted, errors }
  log: text("log"),
  errorMessage: text("error_message"),
  startedAt: text("started_at").notNull().default(sql`(datetime('now'))`),
  completedAt: text("completed_at"),
});
```

- [ ] **Step 4: Generate and apply database migrations**

Run: `pnpm run db:generate && pnpm run db:migrate`

- [ ] **Step 5: Run schema test to verify it passes**

Run: `node --experimental-strip-types --test tests/schema.test.ts`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add db/ tests/schema.test.ts
git commit -m "feat(db): add role to users and ingestion_runs table"
```

---

### Task 2: CLI Admin Promotion Tool

**Files:**
- Create: `scripts/make-admin.ts`
- Modify: `package.json`
- Test: `tests/make-admin.test.ts`

**Interfaces:**
- Produces: `makeAdmin(username: string): Promise<{ success: boolean; message: string }>`

- [ ] **Step 1: Write the failing test for `makeAdmin`**

Create `tests/make-admin.test.ts`:
```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeAdmin } from "../scripts/make-admin.ts";

test("makeAdmin returns error if username is empty", async () => {
  const res = await makeAdmin("");
  assert.strictEqual(res.success, false);
  assert.match(res.message, /username/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/make-admin.test.ts`  
Expected: FAIL (`make-admin.ts` not found)

- [ ] **Step 3: Implement `scripts/make-admin.ts`**

Create `scripts/make-admin.ts`:
```typescript
import { db, eq } from "void/db";
import { users } from "../db/schema.ts";

export async function makeAdmin(username: string): Promise<{ success: boolean; message: string }> {
  const clean = username.trim().toLowerCase();
  if (!clean) {
    return { success: false, message: "Username is required" };
  }

  const [user] = await db.select().from(users).where(eq(users.username, clean));
  if (!user) {
    return { success: false, message: `User "${clean}" not found in database.` };
  }

  await db.update(users).set({ role: "admin" }).where(eq(users.username, clean));
  return { success: true, message: `User "${clean}" (${user.name}) is now an Admin.` };
}

// CLI execution
if (import.meta.filename === process.argv[1] || process.argv[1]?.endsWith("make-admin.ts")) {
  const targetUser = process.argv[2];
  if (!targetUser) {
    console.error("Usage: pnpm run make-admin <username>");
    process.exit(1);
  }
  makeAdmin(targetUser).then((res) => {
    if (res.success) {
      console.log(`✓ ${res.message}`);
    } else {
      console.error(`✗ ${res.message}`);
      process.exit(1);
    }
  });
}
```

- [ ] **Step 4: Add script to `package.json`**

Add to `scripts` in `package.json`:
```json
"make-admin": "node --experimental-strip-types scripts/make-admin.ts"
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/make-admin.test.ts`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/make-admin.ts package.json tests/make-admin.test.ts
git commit -m "feat(cli): add make-admin promotion script"
```

---

### Task 3: Admin Auth Guard & Token Enhancement

**Files:**
- Create: `lib/auth.ts`
- Modify: `routes/api/auth.ts`
- Test: `tests/auth-guard.test.ts`

**Interfaces:**
- Produces:
  - `getUserFromContext(c: Context): Promise<{ id: string; username: string; name: string; role: string } | null>`
  - `adminGuard(c: Context): Promise<{ user: { id: string; username: string; name: string; role: string } } | { errorResponse: Response }>`

- [ ] **Step 1: Write the failing test for `adminGuard`**

Create `tests/auth-guard.test.ts`:
```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyUserRole } from "../lib/auth.ts";

test("verifyUserRole allows admin role", () => {
  const user = { id: "u1", username: "admin", name: "Admin", role: "admin" };
  assert.strictEqual(verifyUserRole(user, "admin"), true);
});

test("verifyUserRole rejects regular user", () => {
  const user = { id: "u2", username: "bob", name: "Bob", role: "user" };
  assert.strictEqual(verifyUserRole(user, "admin"), false);
});

test("verifyUserRole rejects null user", () => {
  assert.strictEqual(verifyUserRole(null, "admin"), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/auth-guard.test.ts`  
Expected: FAIL (`verifyUserRole` undefined)

- [ ] **Step 3: Implement `lib/auth.ts` and update `routes/api/auth.ts`**

Create `lib/auth.ts`:
```typescript
import type { Context } from "hono";
import { db, eq } from "void/db";
import { users } from "../db/schema.ts";

export interface SessionUser {
  id: string;
  username: string;
  name: string;
  role: "admin" | "user";
}

export function parseToken(token: string): SessionUser | null {
  try {
    const json = atob(token);
    const data = JSON.parse(json);
    if (!data.id || !data.username) return null;
    return {
      id: data.id,
      username: data.username,
      name: data.name ?? data.username,
      role: data.role === "admin" ? "admin" : "user",
    };
  } catch {
    return null;
  }
}

export function verifyUserRole(user: SessionUser | null, requiredRole: "admin" | "user" = "admin"): boolean {
  if (!user) return false;
  if (requiredRole === "admin") return user.role === "admin";
  return true;
}

export async function getUserFromContext(c: Context): Promise<SessionUser | null> {
  const authHeader = c.req.header("Authorization");
  let token: string | undefined;
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  } else {
    // Check cookie fallback
    const cookie = c.req.header("Cookie");
    const match = cookie?.match(/session=([^;]+)/);
    if (match) token = match[1];
  }

  if (!token) return null;
  const parsed = parseToken(token);
  if (!parsed) return null;

  // Verify user still exists in DB and get latest role
  const [dbUser] = await db.select().from(users).where(eq(users.id, parsed.id));
  if (!dbUser) return null;

  return {
    id: dbUser.id,
    username: dbUser.username,
    name: dbUser.name,
    role: dbUser.role as "admin" | "user",
  };
}

export async function adminGuard(c: Context) {
  const user = await getUserFromContext(c);
  if (!user) {
    return { errorResponse: c.json({ success: false, error: "Authentication required" }, 401) };
  }
  if (user.role !== "admin") {
    return { errorResponse: c.json({ success: false, error: "Admin access required" }, 403) };
  }
  return { user };
}
```

Update `routes/api/auth.ts` to include `role: user.role` in the token response for both login and registration.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/auth-guard.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/auth.ts routes/api/auth.ts tests/auth-guard.test.ts
git commit -m "feat(auth): add admin guard and role verification"
```

---

### Task 4: Ingestion Engine Modes (`sync`, `dry-run`, `hard-resync`)

**Files:**
- Modify: `lib/ingest.ts`
- Test: `tests/ingest-modes.test.ts`

**Interfaces:**
- Consumes: `db/schema.ts` (`events`, `eventChanges`)
- Produces:
  - `runIngestion(opts: IngestOptions): Promise<IngestResult>`
  - `IngestOptions`: `{ days?: string[]; maxDetailFetches?: number; mode?: "sync" | "dry-run" | "hard-resync"; onProgress?: (msg: string) => void; }`
  - `IngestResult`: `{ mode: string; totalScraped: number; created: number; updated: number; deleted: number; errors: number; diffSummary: { createdEvents: any[]; updatedEvents: any[]; deletedEvents: any[] }; log: string[]; }`

- [ ] **Step 1: Write the failing test for Ingestion Modes**

Create `tests/ingest-modes.test.ts`:
```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeContentHash, type IngestOptions } from "../lib/ingest.ts";

test("computeContentHash generates consistent SHA-256 hex string", async () => {
  const hash1 = await computeContentHash("Sample Title", "Centennial I", "Friday 2:30 PM", "Description text");
  const hash2 = await computeContentHash("Sample Title", "Centennial I", "Friday 2:30 PM", "Description text");
  const hash3 = await computeContentHash("Changed Title", "Centennial I", "Friday 2:30 PM", "Description text");
  
  assert.strictEqual(typeof hash1, "string");
  assert.strictEqual(hash1, hash2);
  assert.notStrictEqual(hash1, hash3);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/ingest-modes.test.ts`  
Expected: FAIL (`computeContentHash` not exported)

- [ ] **Step 3: Update `lib/ingest.ts`**

Update `lib/ingest.ts` to export `computeContentHash`, support `mode: "sync" | "dry-run" | "hard-resync"`, skip DB writes when `mode === "dry-run"`, perform overwrite reset when `mode === "hard-resync"`, and collect structured `diffSummary`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/ingest-modes.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/ingest.ts tests/ingest-modes.test.ts
git commit -m "feat(ingest): add dry-run and hard-resync ingestion modes"
```

---

### Task 5: Admin API Endpoints

**Files:**
- Create: `routes/api/admin/ingest.ts`
- Create: `routes/api/admin/stats.ts`
- Create: `routes/api/admin/runs.ts`
- Modify: `routes/api/ingest.ts` (add admin guard)
- Test: `tests/admin-api.test.ts`

**Interfaces:**
- `POST /api/admin/ingest` -> triggers ingestion, records to `ingestionRuns`, returns result
- `GET /api/admin/stats` -> returns event counts, days breakdown, user count, last sync
- `GET /api/admin/runs` -> returns list of past runs with stats and status

- [ ] **Step 1: Write test for admin endpoints logic**

Create `tests/admin-api.test.ts`:
```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseToken } from "../lib/auth.ts";

test("parseToken parses valid admin token", () => {
  const token = btoa(JSON.stringify({ id: "usr_1", username: "admin", role: "admin" }));
  const parsed = parseToken(token);
  assert.deepStrictEqual(parsed, { id: "usr_1", username: "admin", name: "admin", role: "admin" });
});
```

- [ ] **Step 2: Implement Admin Route Handlers**

1. Create `routes/api/admin/ingest.ts`:
```typescript
import type { Context } from "hono";
import { defineHandler } from "void";
import { db } from "void/db";
import { adminGuard } from "../../../lib/auth";
import { runIngestion } from "../../../lib/ingest";
import { ingestionRuns } from "../../../db/schema";

export const POST = defineHandler(async (c: Context) => {
  const guard = await adminGuard(c);
  if ("errorResponse" in guard) return guard.errorResponse;

  const body = (await c.req.json().catch(() => ({}))) as {
    mode?: "sync" | "dry-run" | "hard-resync";
    days?: string[];
    maxDetailFetches?: number;
  };

  const mode = body.mode ?? "sync";
  const startedAt = new Date().toISOString();

  // Create initial run entry in DB
  const [run] = await db
    .insert(ingestionRuns)
    .values({
      userId: guard.user.id,
      mode,
      status: "running",
      days: body.days ? JSON.stringify(body.days) : null,
      startedAt,
    })
    .returning();

  try {
    const result = await runIngestion({
      mode,
      days: body.days,
      maxDetailFetches: body.maxDetailFetches,
    });

    const completedAt = new Date().toISOString();
    await db
      .update(ingestionRuns)
      .set({
        status: "completed",
        stats: JSON.stringify({
          totalScraped: result.totalScraped,
          created: result.created,
          updated: result.updated,
          deleted: result.deleted,
          errors: result.errors,
        }),
        log: result.log.join("\n"),
        completedAt,
      })
      .where(eq(ingestionRuns.id, run.id));

    return c.json({ success: true, runId: run.id, result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .update(ingestionRuns)
      .set({
        status: "failed",
        errorMessage: message,
        completedAt: new Date().toISOString(),
      })
      .where(eq(ingestionRuns.id, run.id));

    return c.json({ success: false, runId: run.id, error: message }, 500);
  }
});
```

2. Create `routes/api/admin/stats.ts`:
```typescript
import type { Context } from "hono";
import { defineHandler } from "void";
import { db, desc, eq, sql } from "void/db";
import { adminGuard } from "../../../lib/auth";
import { events, ingestionRuns, users } from "../../../db/schema";

export const GET = defineHandler(async (c: Context) => {
  const guard = await adminGuard(c);
  if ("errorResponse" in guard) return guard.errorResponse;

  const allEvents = await db.select({ day: events.day, isDeleted: events.isDeleted }).from(events);
  const activeEvents = allEvents.filter((e) => e.isDeleted === 0);
  
  const eventsByDay: Record<string, number> = {};
  for (const ev of activeEvents) {
    if (ev.day) {
      eventsByDay[ev.day] = (eventsByDay[ev.day] || 0) + 1;
    }
  }

  const allUsers = await db.select({ id: users.id }).from(users);
  const [lastRun] = await db.select().from(ingestionRuns).orderBy(desc(ingestionRuns.id)).limit(1);

  return c.json({
    success: true,
    stats: {
      totalActiveEvents: activeEvents.length,
      totalDeletedEvents: allEvents.length - activeEvents.length,
      eventsByDay,
      totalUsers: allUsers.length,
      lastRun: lastRun || null,
    },
  });
});
```

3. Create `routes/api/admin/runs.ts`:
```typescript
import type { Context } from "hono";
import { defineHandler } from "void";
import { db, desc } from "void/db";
import { adminGuard } from "../../../lib/auth";
import { ingestionRuns } from "../../../db/schema";

export const GET = defineHandler(async (c: Context) => {
  const guard = await adminGuard(c);
  if ("errorResponse" in guard) return guard.errorResponse;

  const runs = await db.select().from(ingestionRuns).orderBy(desc(ingestionRuns.id)).limit(50);
  return c.json({ success: true, runs });
});
```

4. Update `routes/api/ingest.ts` to also enforce `adminGuard`.

- [ ] **Step 3: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/admin-api.test.ts`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add routes/api/admin/ routes/api/ingest.ts tests/admin-api.test.ts
git commit -m "feat(api): add admin ingestion, stats, and runs endpoints"
```

---

### Task 6: Admin Frontend Page (`/admin`)

**Files:**
- Create: `pages/admin.server.ts`
- Create: `pages/admin.tsx`
- Modify: `pages/index.tsx` (add admin navigation pill/link when logged in as admin)

**Interfaces:**
- Consumes: `/api/admin/stats`, `/api/admin/ingest`, `/api/admin/runs`
- Produces: Server-rendered `/admin` page with full interactive dashboard.

- [ ] **Step 1: Implement `pages/admin.server.ts`**

Create `pages/admin.server.ts`:
```typescript
import { defineHandler, defineHead, type InferProps } from "void";
import { db, desc, eq } from "void/db";
import { events, ingestionRuns, users } from "../db/schema";

export type AdminProps = InferProps<typeof loader>;

export const loader = defineHandler(async () => {
  const allEvents = await db.select({ day: events.day, isDeleted: events.isDeleted }).from(events);
  const activeEvents = allEvents.filter((e) => e.isDeleted === 0);
  
  const eventsByDay: Record<string, number> = {};
  for (const ev of activeEvents) {
    if (ev.day) {
      eventsByDay[ev.day] = (eventsByDay[ev.day] || 0) + 1;
    }
  }

  const allUsers = await db.select({ id: users.id }).from(users);
  const runs = await db.select().from(ingestionRuns).orderBy(desc(ingestionRuns.id)).limit(20);

  return {
    totalEvents: activeEvents.length,
    eventsByDay,
    totalUsers: allUsers.length,
    initialRuns: runs,
  };
});

export const head = defineHead<AdminProps>(() => {
  return {
    title: "Admin Control Center | CyberDragon 2026",
    meta: [
      { name: "description", content: "CyberDragon schedule sync and administrative controls" },
    ],
  };
});
```

- [ ] **Step 2: Implement `pages/admin.tsx`**

Create `pages/admin.tsx` incorporating CyberDragon Glass styling with:
- Top bar with admin badge, connection status, link back to `/`.
- Stat metric cards (Active events, Users, Last Sync).
- Ingestion Control Card (Mode segmented control: `sync`, `dry-run`, `hard-resync`; Day filters; Throttle limiter; Execute button).
- Hard Resync safety confirmation modal.
- Live Terminal console with auto-scroll and log level badges.
- Diff summary inspector (`+X Added`, `~Y Updated`, `-Z Deleted`).
- Run history table with interactive log viewer drawer.
- Unauthorized / Access Denied fallback card if `user?.role !== 'admin'`.

- [ ] **Step 3: Update `pages/index.tsx`**

Add an "Admin" badge/link in the top header or user profile section when `currentUser?.role === 'admin'`.

- [ ] **Step 4: Commit**

```bash
git add pages/admin.tsx pages/admin.server.ts pages/index.tsx
git commit -m "feat(ui): add admin dashboard page and navigation"
```

---

### Task 7: Full System Verification & Build Check

**Files:**
- Modify: `package.json` (update test script to run all tests)
- Modify: `docs/log.md`

- [ ] **Step 1: Update `package.json` test runner**

Update `scripts.test` in `package.json` to run all test files:
```json
"test": "node --experimental-strip-types --test tests/*.test.ts"
```

- [ ] **Step 2: Run all unit tests**

Run: `pnpm test`  
Expected: All tests pass.

- [ ] **Step 3: Run production build**

Run: `pnpm build`  
Expected: Build succeeds with 0 errors.

- [ ] **Step 4: Record milestone in `docs/log.md`**

Add session entry documenting the Admin Ingestion Dashboard subsystem.

- [ ] **Step 5: Commit**

```bash
git add package.json docs/log.md
git commit -m "chore: update test script and record admin dashboard milestone in docs"
```
