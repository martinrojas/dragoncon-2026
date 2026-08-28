import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { withRuntimeEnv } from "void/_env";
import { makeAdmin } from "../scripts/make-admin.ts";

/**
 * `makeAdmin` reads the D1 binding via `void/db`'s runtime env proxy. Outside
 * a Cloudflare Worker / Vite dev server there is no ambient binding, so tests
 * that exercise the database path wire up a minimal in-memory SQLite-backed
 * fake D1 binding through `withRuntimeEnv` (the same AsyncLocalStorage hook
 * the generated Worker entry uses).
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

test("makeAdmin returns error if username is empty", async () => {
  const res = await makeAdmin("");
  assert.strictEqual(res.success, false);
  assert.match(res.message, /username/i);
});

test("makeAdmin returns error if username is only whitespace", async () => {
  const res = await makeAdmin("   ");
  assert.strictEqual(res.success, false);
  assert.match(res.message, /username/i);
});

/**
 * `void/db`'s default `db` export caches its drizzle instance on first
 * property access (`_instance ??= drizzle(requireRuntimeBinding("DB"))`) and
 * keeps using that instance for the lifetime of the process, ignoring
 * whichever `DB` binding a later `withRuntimeEnv` call supplies. All tests
 * that exercise the database path must therefore share one fake D1 binding
 * so `makeAdmin`'s queries stay pointed at data these tests actually wrote.
 */
const sharedFakeD1 = createFakeD1();

test("makeAdmin returns not-found for a user that does not exist", async () => {
  await withRuntimeEnv({ DB: sharedFakeD1 }, async () => {
    const res = await makeAdmin("ghost");
    assert.strictEqual(res.success, false);
    assert.match(res.message, /not found/i);
    assert.match(res.message, /ghost/);
  });
});

test("makeAdmin promotes an existing user to admin", async () => {
  sharedFakeD1
    .prepare("INSERT INTO users (id, username, name, password_hash) VALUES (?, ?, ?, ?)")
    .bind("user-1", "alice", "Alice Example", "hash")
    .run();

  await withRuntimeEnv({ DB: sharedFakeD1 }, async () => {
    const res = await makeAdmin("alice");
    assert.strictEqual(res.success, true);
    assert.match(res.message, /alice/i);

    const row = sharedFakeD1.prepare("SELECT role FROM users WHERE username = ?").bind("alice").all().results[0] as {
      role: string;
    };
    assert.strictEqual(row.role, "admin");
  });
});
