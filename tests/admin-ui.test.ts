import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { withRuntimeEnv } from "void/_env";
import { loader, head } from "../pages/admin.server.ts";

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
    db: sqliteDb,
    d1: {
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
    },
  };
}

const fake = createFakeD1();

test("admin.server head defines correct page title", () => {
  const headData = head();
  assert.strictEqual(headData.title, "Admin Control Center | CyberDragon 2026");
});

test("admin.server loader returns initial DB stats and recent ingestion runs", async () => {
  // Seed fake data
  fake.db.exec(`
    INSERT INTO users (id, username, name, password_hash, role) VALUES
      ('u1', 'admin1', 'Admin One', 'hash', 'admin'),
      ('u2', 'user1', 'User One', 'hash', 'user');

    INSERT INTO events (id, title, day, is_deleted, content_hash) VALUES
      ('e1', 'Friday Panel 1', 'Friday', 0, 'hash1'),
      ('e2', 'Friday Panel 2', 'Friday', 0, 'hash2'),
      ('e3', 'Saturday Workshop', 'Saturday', 0, 'hash3'),
      ('e4', 'Old Cancelled Event', 'Friday', 1, 'hash4');

    INSERT INTO ingestion_runs (id, user_id, mode, status, stats) VALUES
      (101, 'u1', 'sync', 'completed', '{"created":2,"updated":1}'),
      (102, 'u1', 'dry-run', 'completed', '{"created":0,"updated":0}');
  `);

  await withRuntimeEnv({ DB: fake.d1 }, async () => {
    const data = await loader();
    assert.strictEqual(data.totalUsers, 2);
    assert.strictEqual(data.totalEvents, 3); // active events
    assert.strictEqual(data.totalActiveEvents, 3);
    assert.strictEqual(data.totalDeletedEvents, 1);
    assert.deepStrictEqual(data.eventsByDay, { Friday: 2, Saturday: 1 });
    assert.strictEqual(data.initialRuns.length, 2);
    assert.strictEqual(data.initialRuns[0].id, 102); // sorted newest first
    assert.strictEqual(data.initialRuns[1].id, 101);
  });
});

test("admin user role evaluation enables admin link rendering and access", () => {
  const adminUser = { id: "u1", username: "admin1", name: "Admin", role: "admin" };
  const regularUser = { id: "u2", username: "user1", name: "User", role: "user" };

  const shouldShowAdminLink = (user?: { role?: string } | null) => user?.role === "admin";

  assert.strictEqual(shouldShowAdminLink(adminUser), true);
  assert.strictEqual(shouldShowAdminLink(regularUser), false);
  assert.strictEqual(shouldShowAdminLink(null), false);
  assert.strictEqual(shouldShowAdminLink(undefined), false);
});
