import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { withRuntimeEnv } from "void/_env";
import { PATCH } from "../routes/api/user/privacy.ts";

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
    INSERT INTO users (id, username, name, password_hash, share_schedule)
    VALUES ('u_alice', 'alice', 'Alice', 'hash', 1);
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

test("PATCH /api/user/privacy updates share_schedule flag", async () => {
  const fakeD1 = createFakeD1();
  await withRuntimeEnv({ DB: fakeD1 as never }, async () => {
    const req = {
      json: async () => ({ userId: "u_alice", shareSchedule: false }),
    };

    const res = await PATCH({
      req,
      json: (d: unknown, s = 200) => ({ status: s, json: async () => d }),
    } as never);
    const data = (await res.json()) as { success: boolean; shareSchedule: number };

    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.shareSchedule, 0);
  });
});
