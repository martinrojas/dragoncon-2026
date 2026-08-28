import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { withRuntimeEnv } from "void/_env";
import { GET } from "../routes/api/friends.ts";

function createFakeFriendsD1() {
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
    CREATE TABLE user_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'going',
      notes TEXT,
      added_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE friendships (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      friend_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'accepted',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT INTO users (id, username, name, password_hash, share_schedule) VALUES
      ('u_alice', 'alice', 'Alice', 'hash', 1),
      ('u_bob_pub', 'bob', 'Bob', 'hash', 1),
      ('u_charlie_priv', 'charlie', 'Charlie', 'hash', 0);

    INSERT INTO events (id, title, day, time_string, location, content_hash) VALUES
      ('ev_1', 'Intro to Cyberpunk', 'Friday', '10:00 AM', 'Hyatt', 'hash1'),
      ('ev_2', 'Cosplay Armor 101', 'Friday', '1:00 PM', 'Marriott', 'hash2');

    INSERT INTO user_events (id, user_id, event_id) VALUES
      ('ue_1', 'u_alice', 'ev_1'),
      ('ue_2', 'u_bob_pub', 'ev_1'),
      ('ue_3', 'u_bob_pub', 'ev_2'),
      ('ue_4', 'u_charlie_priv', 'ev_1'),
      ('ue_5', 'u_charlie_priv', 'ev_2');
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

test("GET /api/friends returns full friendEvents when friend share_schedule is 1", async () => {
  const fakeD1 = createFakeFriendsD1();
  await withRuntimeEnv({ DB: fakeD1 as never }, async () => {
    const req = {
      query: (k: string) => (k === "userId" ? "u_alice" : k === "friendId" ? "u_bob_pub" : null),
    };
    const res = await GET({ req, json: (d: unknown, s = 200) => ({ status: s, json: async () => d }) } as never);
    const body = (await res.json()) as { success: boolean; scheduleHidden: boolean; friendEvents: unknown[]; sharedEventIds: string[] };

    assert.strictEqual(body.success, true);
    assert.strictEqual(body.scheduleHidden, false);
    assert.strictEqual(body.friendEvents.length, 2);
    assert.deepStrictEqual(body.sharedEventIds, ["ev_1"]);
  });
});

test("GET /api/friends hides friendEvents when friend share_schedule is 0", async () => {
  const fakeD1 = createFakeFriendsD1();
  await withRuntimeEnv({ DB: fakeD1 as never }, async () => {
    const req = {
      query: (k: string) => (k === "userId" ? "u_alice" : k === "friendId" ? "u_charlie_priv" : null),
    };
    const res = await GET({ req, json: (d: unknown, s = 200) => ({ status: s, json: async () => d }) } as never);
    const body = (await res.json()) as { success: boolean; scheduleHidden: boolean; friendEvents: unknown[]; sharedEvents: unknown[]; sharedEventIds: string[] };

    assert.strictEqual(body.success, true);
    assert.strictEqual(body.scheduleHidden, true);
    assert.strictEqual(body.friendEvents.length, 0);
    assert.strictEqual(body.sharedEvents.length, 1);
    assert.deepStrictEqual(body.sharedEventIds, ["ev_1"]);
  });
});
