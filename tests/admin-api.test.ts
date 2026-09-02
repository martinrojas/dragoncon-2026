import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import type { Context } from "hono";
import { withRuntimeEnv } from "void/_env";
import { POST as adminIngestPOST } from "../routes/api/admin/ingest.ts";
import {
  GET as adminStatsGET,
  tallyUsageStats,
  type UsageRow,
} from "../routes/api/admin/stats.ts";
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
    CREATE TABLE user_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'going',
      notes TEXT,
      added_at TEXT NOT NULL DEFAULT (datetime('now'))
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

    // Saved schedules exercise the usage join through the real GET handler.
    const insertSave = (id: string, userId: string, eventId: string, status: string) => {
      sharedFakeD1
        .prepare("INSERT INTO user_events (id, user_id, event_id, status) VALUES (?, ?, ?, ?)")
        .bind(id, userId, eventId, status)
        .run();
    };
    insertSave("sv-1", "usr_stats1", "ev-fri-1", "going");
    insertSave("sv-2", "usr_stats1", "ev-sat-1", "interested");
    // Orphaned save: the event was hard-deleted, so the leftJoin yields
    // NULL track/location/day for it.
    insertSave("sv-3", "usr_stats2", "ev-hard-deleted", "going");

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
    assert.strictEqual(body.stats.usage.totalSaves, 3);
    assert.strictEqual(body.stats.usage.usersWithSaves, 2);
    assert.strictEqual(body.stats.usage.goingCount, 2);
    assert.strictEqual(body.stats.usage.interestedCount, 1);
    // The orphaned save lands in "Unspecified" buckets instead of being dropped.
    assert.deepStrictEqual(body.stats.usage.savesByConDay, [
      { name: "Friday", count: 1 },
      { name: "Saturday", count: 1 },
      { name: "Unspecified", count: 1 },
    ]);
    assert.deepStrictEqual(body.stats.usage.peakHours, []);

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

// --- tallyUsageStats: pure aggregation (no D1) ---

test("tallyUsageStats aggregates saves, buckets, and ET dates without identifying users", () => {
  const rows: UsageRow[] = [
    {
      userId: "uA",
      status: "going",
      addedAt: "2026-09-04 15:00:00",
      day: "Friday",
      track: null,
      location: "Marriott A601 - International Ballroom",
      startsAt: "2026-09-04T14:00:00.000Z",
    },
    {
      // 01:30 UTC Sep 5 -> 21:30 ET Sep 4: evening-ET save on the prior calendar day.
      userId: "uA",
      status: "going",
      addedAt: "2026-09-05 01:30:00",
      day: "Friday",
      track: "Anime",
      location: null,
      startsAt: null,
    },
    {
      userId: "uA",
      status: "interested",
      addedAt: "2026-09-05 03:00:00",
      day: "Friday",
      track: "Anime",
      location: "Westin",
      startsAt: "2026-09-05T02:00:00.000Z",
    },
    {
      userId: "uA",
      status: "going",
      addedAt: "2026-09-05 15:00:00",
      day: "Saturday",
      track: "Gaming",
      location: "Westin",
      startsAt: "2026-09-05T18:30:00.000Z",
    },
    {
      userId: "uB",
      status: "interested",
      addedAt: "2026-09-05 16:00:00",
      day: "Saturday",
      track: "Gaming",
      location: "Marriott Marquis - Atrium",
      startsAt: "2026-09-05T20:00:00.000Z",
    },
    {
      userId: "uB",
      status: "going",
      addedAt: "2026-09-06 12:00:00",
      day: "Sunday",
      track: "Anime",
      location: "Westin",
      startsAt: "2026-09-06T12:00:00.000Z",
    },
  ];

  const result = tallyUsageStats(rows, 3);

  assert.strictEqual(result.totalSaves, 6);
  assert.strictEqual(result.usersWithSaves, 2);
  assert.strictEqual(result.goingCount, 4);
  assert.strictEqual(result.interestedCount, 2);
  // Per-user counts [4, 2] -> median 3.
  assert.strictEqual(result.medianSavesPerActiveUser, 3);
  assert.deepStrictEqual(result.scheduleSizeBuckets, [
    { label: "0", users: 1 },
    { label: "1-5", users: 2 },
    { label: "6-20", users: 0 },
    { label: "21+", users: 0 },
  ]);
  // 3 saves on Sep 4 ET (two from after-midnight UTC timestamps), 2 on Sep 5, 1 on Sep 6.
  assert.deepStrictEqual(result.savesByDate, [
    { date: "2026-09-04", count: 3 },
    { date: "2026-09-05", count: 2 },
    { date: "2026-09-06", count: 1 },
  ]);
  // Count desc, then name asc.
  assert.deepStrictEqual(result.topTracks, [
    { name: "Anime", count: 3 },
    { name: "Gaming", count: 2 },
    { name: "Unspecified", count: 1 },
  ]);
  assert.deepStrictEqual(result.topLocations, [
    { name: "Westin", count: 3 },
    { name: "Marriott A601 - International Ballroom", count: 1 },
    { name: "Marriott Marquis - Atrium", count: 1 },
    { name: "Unspecified", count: 1 },
  ]);
  assert.deepStrictEqual(result.savesByConDay, [
    { name: "Friday", count: 3 },
    { name: "Saturday", count: 2 },
    { name: "Sunday", count: 1 },
  ]);
  assert.deepStrictEqual(result.peakHours, [
    { day: "Friday", hour: 10, count: 1 },
    { day: "Friday", hour: 22, count: 1 },
    { day: "Saturday", hour: 14, count: 1 },
    { day: "Saturday", hour: 16, count: 1 },
    { day: "Sunday", hour: 8, count: 1 },
  ]);
});

test("tallyUsageStats with no rows yields zeroed stats and a full bucket list", () => {
  const result = tallyUsageStats([], 5);
  assert.strictEqual(result.totalSaves, 0);
  assert.strictEqual(result.usersWithSaves, 0);
  assert.strictEqual(result.medianSavesPerActiveUser, 0);
  assert.deepStrictEqual(result.scheduleSizeBuckets, [
    { label: "0", users: 5 },
    { label: "1-5", users: 0 },
    { label: "6-20", users: 0 },
    { label: "21+", users: 0 },
  ]);
  assert.deepStrictEqual(result.savesByDate, []);
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
