import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import type { Context } from "hono";
import { withRuntimeEnv } from "void/_env";
import { POST as adminIngestPOST } from "../routes/api/admin/ingest.ts";
import { GET as adminStatsGET } from "../routes/api/admin/stats.ts";
import { GET as adminRunsGET } from "../routes/api/admin/runs.ts";
import { GET as adminRunByIdGET } from "../routes/api/admin/runs/[id].ts";
import { POST as legacyIngestPOST } from "../routes/api/ingest.ts";

/**
 * These admin route handlers read the D1 binding via `void/db`'s runtime env
 * proxy. Outside a Cloudflare Worker / Vite dev server there is no ambient
 * binding, so tests wire up a minimal in-memory SQLite-backed fake D1
 * binding through `withRuntimeEnv` (mirrors tests/auth-guard.test.ts and
 * tests/ingest-modes.test.ts).
 */
function createFakeD1() {
  const sqliteDb = new DatabaseSync(":memory:");
  sqliteDb.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      avatar_url TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      share_schedule INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      location TEXT,
      track TEXT,
      starts_at TEXT,
      ends_at TEXT,
      duration_minutes INTEGER,
      day TEXT,
      time_string TEXT,
      speakers TEXT,
      content_hash TEXT NOT NULL,
      first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_deleted INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE ingestion_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      days TEXT,
      stats TEXT,
      log TEXT,
      error_message TEXT,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    );
  `);

  return {
    prepare(sqlText: string) {
      const stmt = sqliteDb.prepare(sqlText);
      return {
        bind(...params: unknown[]) {
          return {
            raw() {
              return stmt.all(...(params as never[])).map((row) => Object.values(row as object));
            },
            all() {
              return { results: stmt.all(...(params as never[])) };
            },
            run() {
              const info = stmt.run(...(params as never[]));
              return { success: true, meta: { changes: info.changes, last_row_id: Number(info.lastInsertRowid) } };
            },
          };
        },
      };
    },
  };
}

// `void/db`'s default `db` export caches its drizzle instance on first
// property access, so all tests that exercise the database path must share
// one fake D1 binding (see tests/make-admin.test.ts for the same note).
const sharedFakeD1 = createFakeD1();

function makeToken(payload: Record<string, unknown>): string {
  return btoa(JSON.stringify(payload));
}

function createContext(opts: {
  authHeader?: string;
  body?: unknown;
  params?: Record<string, string>;
} = {}): Context {
  return {
    req: {
      header: (name: string) => (name.toLowerCase() === "authorization" ? opts.authHeader : undefined),
      json: async () => opts.body ?? {},
      param: (name: string) => opts.params?.[name],
    },
    json: (body: unknown, status?: number) => new Response(JSON.stringify(body), { status: status ?? 200 }),
  } as unknown as Context;
}

// Seed one admin and one regular user, shared by every guard-enforcement
// check below. Only the "stats calculation" test adds further users, so
// `totalUsers` can be asserted against a known running total.
const adminUserId = "usr_admin1";
const regularUserId = "usr_reg1";
let seededUserCount = 0;

function insertUser(id: string, username: string, role: "admin" | "user") {
  sharedFakeD1
    .prepare("INSERT INTO users (id, username, name, password_hash, role) VALUES (?, ?, ?, ?, ?)")
    .bind(id, username, username, "hash", role)
    .run();
  seededUserCount++;
}

insertUser(adminUserId, "admin1", "admin");
insertUser(regularUserId, "reg1", "user");

const adminToken = makeToken({ id: adminUserId, username: "admin1", name: "admin1", role: "admin" });
const userToken = makeToken({ id: regularUserId, username: "reg1", name: "reg1", role: "user" });

function insertRun(overrides: {
  userId: string;
  mode: string;
  status: string;
  stats?: string | null;
  errorMessage?: string | null;
}): number {
  const info = sharedFakeD1
    .prepare(
      "INSERT INTO ingestion_runs (user_id, mode, status, stats, error_message) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(overrides.userId, overrides.mode, overrides.status, overrides.stats ?? null, overrides.errorMessage ?? null)
    .run();
  return info.meta.last_row_id;
}

function insertEvent(overrides: { id: string; day: string | null; isDeleted: number }) {
  sharedFakeD1
    .prepare("INSERT INTO events (id, title, day, content_hash, is_deleted) VALUES (?, ?, ?, ?, ?)")
    .bind(overrides.id, `Event ${overrides.id}`, overrides.day, `hash-${overrides.id}`, overrides.isDeleted)
    .run();
}

// --- POST /api/admin/ingest: adminGuard enforcement ---

test("POST /api/admin/ingest returns 401 when unauthenticated", async () => {
  await withRuntimeEnv({ DB: sharedFakeD1 }, async () => {
    const res = (await adminIngestPOST(createContext())) as Response;
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.success, false);
  });
});

test("POST /api/admin/ingest returns 403 for an authenticated non-admin user", async () => {
  await withRuntimeEnv({ DB: sharedFakeD1 }, async () => {
    const res = (await adminIngestPOST(createContext({ authHeader: `Bearer ${userToken}` }))) as Response;
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.success, false);
  });
});

// --- GET /api/admin/stats: adminGuard enforcement ---

test("GET /api/admin/stats returns 401 when unauthenticated", async () => {
  await withRuntimeEnv({ DB: sharedFakeD1 }, async () => {
    const res = (await adminStatsGET(createContext())) as Response;
    assert.strictEqual(res.status, 401);
  });
});

test("GET /api/admin/stats returns 403 for an authenticated non-admin user", async () => {
  await withRuntimeEnv({ DB: sharedFakeD1 }, async () => {
    const res = (await adminStatsGET(createContext({ authHeader: `Bearer ${userToken}` }))) as Response;
    assert.strictEqual(res.status, 403);
  });
});

// --- GET /api/admin/runs: adminGuard enforcement + ordering/limit ---

test("GET /api/admin/runs returns 401 when unauthenticated", async () => {
  await withRuntimeEnv({ DB: sharedFakeD1 }, async () => {
    const res = (await adminRunsGET(createContext())) as Response;
    assert.strictEqual(res.status, 401);
  });
});

test("GET /api/admin/runs returns 403 for an authenticated non-admin user", async () => {
  await withRuntimeEnv({ DB: sharedFakeD1 }, async () => {
    const res = (await adminRunsGET(createContext({ authHeader: `Bearer ${userToken}` }))) as Response;
    assert.strictEqual(res.status, 403);
  });
});

test("GET /api/admin/runs returns the 50 most recent runs, newest first", async () => {
  await withRuntimeEnv({ DB: sharedFakeD1 }, async () => {
    const insertedIds: number[] = [];
    for (let i = 1; i <= 52; i++) {
      insertedIds.push(insertRun({ userId: adminUserId, mode: `run-marker-${i}`, status: "completed" }));
    }

    const res = (await adminRunsGET(createContext({ authHeader: `Bearer ${adminToken}` }))) as Response;
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.runs.length, 50);

    // Newest first: the last-inserted row (marker 52) leads.
    assert.strictEqual(body.runs[0].id, insertedIds[51]);
    assert.strictEqual(body.runs[0].mode, "run-marker-52");

    // Only the 50 most recent survive the limit; markers 1 and 2 are excluded.
    const modes = body.runs.map((r: { mode: string }) => r.mode);
    assert.ok(!modes.includes("run-marker-1"));
    assert.ok(!modes.includes("run-marker-2"));
    assert.ok(modes.includes("run-marker-3"));
    assert.ok(modes.includes("run-marker-52"));

    // Strictly descending by id.
    for (let i = 1; i < body.runs.length; i++) {
      assert.ok(body.runs[i - 1].id > body.runs[i].id);
    }
  });
});

// --- GET /api/admin/runs/:id: adminGuard enforcement + lookup ---

test("GET /api/admin/runs/:id returns 401 when unauthenticated", async () => {
  await withRuntimeEnv({ DB: sharedFakeD1 }, async () => {
    const res = (await adminRunByIdGET(createContext({ params: { id: "1" } }))) as Response;
    assert.strictEqual(res.status, 401);
  });
});

test("GET /api/admin/runs/:id returns 403 for an authenticated non-admin user", async () => {
  await withRuntimeEnv({ DB: sharedFakeD1 }, async () => {
    const res = (await adminRunByIdGET(
      createContext({ authHeader: `Bearer ${userToken}`, params: { id: "1" } }),
    )) as Response;
    assert.strictEqual(res.status, 403);
  });
});

test("GET /api/admin/runs/:id returns 404 for a run that does not exist", async () => {
  await withRuntimeEnv({ DB: sharedFakeD1 }, async () => {
    const res = (await adminRunByIdGET(
      createContext({ authHeader: `Bearer ${adminToken}`, params: { id: "999999" } }),
    )) as Response;
    assert.strictEqual(res.status, 404);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.error, /not found/i);
  });
});

test("GET /api/admin/runs/:id returns the run for an authenticated admin", async () => {
  await withRuntimeEnv({ DB: sharedFakeD1 }, async () => {
    const runId = insertRun({
      userId: adminUserId,
      mode: "dry-run",
      status: "completed",
      stats: JSON.stringify({ totalScraped: 10, created: 2, updated: 1, deleted: 0, errors: 0 }),
    });

    const res = (await adminRunByIdGET(
      createContext({ authHeader: `Bearer ${adminToken}`, params: { id: String(runId) } }),
    )) as Response;
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.run.id, runId);
    assert.strictEqual(body.run.mode, "dry-run");
    assert.strictEqual(body.run.status, "completed");
  });
});

// --- GET /api/admin/stats: calculation ---

test("GET /api/admin/stats computes active/deleted event counts, day breakdown, user count, and last run", async () => {
  await withRuntimeEnv({ DB: sharedFakeD1 }, async () => {
    insertEvent({ id: "ev-fri-1", day: "Friday", isDeleted: 0 });
    insertEvent({ id: "ev-fri-2", day: "Friday", isDeleted: 0 });
    insertEvent({ id: "ev-sat-1", day: "Saturday", isDeleted: 0 });
    insertEvent({ id: "ev-sat-2", day: "Saturday", isDeleted: 0 });
    insertEvent({ id: "ev-sat-3", day: "Saturday", isDeleted: 0 });
    insertEvent({ id: "ev-noday", day: null, isDeleted: 0 });
    insertEvent({ id: "ev-del-1", day: "Friday", isDeleted: 1 });
    insertEvent({ id: "ev-del-2", day: "Saturday", isDeleted: 1 });

    insertUser("usr_stats1", "statsuser1", "user");
    insertUser("usr_stats2", "statsuser2", "user");
    insertUser("usr_stats3", "statsuser3", "user");

    const lastRunId = insertRun({
      userId: adminUserId,
      mode: "sync",
      status: "completed",
      stats: JSON.stringify({ totalScraped: 6, created: 6, updated: 0, deleted: 0, errors: 0 }),
    });

    const res = (await adminStatsGET(createContext({ authHeader: `Bearer ${adminToken}` }))) as Response;
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);

    assert.strictEqual(body.stats.totalActiveEvents, 6);
    assert.strictEqual(body.stats.totalDeletedEvents, 2);
    assert.deepStrictEqual(body.stats.eventsByDay, { Friday: 2, Saturday: 3 });
    assert.strictEqual(body.stats.totalUsers, seededUserCount);

    assert.strictEqual(body.stats.lastRun.id, lastRunId);
    assert.strictEqual(body.stats.lastRun.mode, "sync");
    assert.deepStrictEqual(body.stats.lastRun.stats, {
      totalScraped: 6,
      created: 6,
      updated: 0,
      deleted: 0,
      errors: 0,
    });
  });
});

// --- Legacy POST /api/ingest: now guarded by adminGuard ---

test("legacy POST /api/ingest returns 401 when unauthenticated", async () => {
  await withRuntimeEnv({ DB: sharedFakeD1 }, async () => {
    const res = (await legacyIngestPOST(createContext())) as Response;
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.success, false);
  });
});

test("legacy POST /api/ingest returns 403 for an authenticated non-admin user", async () => {
  await withRuntimeEnv({ DB: sharedFakeD1 }, async () => {
    const res = (await legacyIngestPOST(createContext({ authHeader: `Bearer ${userToken}` }))) as Response;
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.success, false);
  });
});
