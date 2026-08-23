import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import type { Context } from "hono";
import { withRuntimeEnv } from "void/_env";
import { parseToken, verifyUserRole, getUserFromContext, adminGuard, type SessionUser } from "../lib/auth.ts";

/**
 * `getUserFromContext`/`adminGuard` read the D1 binding via `void/db`'s
 * runtime env proxy. Outside a Cloudflare Worker / Vite dev server there is
 * no ambient binding, so tests that exercise the database path wire up a
 * minimal in-memory SQLite-backed fake D1 binding through `withRuntimeEnv`
 * (mirrors tests/make-admin.test.ts).
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

// `void/db`'s default `db` export caches its drizzle instance on first
// property access, so all tests that exercise the database path must share
// one fake D1 binding (see tests/make-admin.test.ts for the same note).
const sharedFakeD1 = createFakeD1();

function makeToken(payload: Record<string, unknown>): string {
  return btoa(JSON.stringify(payload));
}

function createContext(opts: { authHeader?: string; cookieHeader?: string }): Context {
  const headers: Record<string, string> = {};
  if (opts.authHeader) headers.authorization = opts.authHeader;
  if (opts.cookieHeader) headers.cookie = opts.cookieHeader;

  return {
    req: {
      header: (name: string) => headers[name.toLowerCase()],
    },
    json: (body: unknown, status?: number) => new Response(JSON.stringify(body), { status: status ?? 200 }),
  } as unknown as Context;
}

// --- parseToken ---

test("parseToken decodes a valid admin token", () => {
  const token = makeToken({ id: "usr_1", username: "alice", name: "Alice", role: "admin" });
  const user = parseToken(token);
  assert.deepStrictEqual(user, { id: "usr_1", username: "alice", name: "Alice", role: "admin" });
});

test("parseToken normalizes any non-admin role to user", () => {
  const token = makeToken({ id: "usr_1", username: "alice", name: "Alice", role: "superadmin" });
  const user = parseToken(token);
  assert.strictEqual(user?.role, "user");
});

test("parseToken defaults role to user when missing", () => {
  const token = makeToken({ id: "usr_1", username: "alice", name: "Alice" });
  const user = parseToken(token);
  assert.strictEqual(user?.role, "user");
});

test("parseToken returns null when id is missing", () => {
  const token = makeToken({ username: "alice", name: "Alice" });
  assert.strictEqual(parseToken(token), null);
});

test("parseToken returns null when username is missing", () => {
  const token = makeToken({ id: "usr_1", name: "Alice" });
  assert.strictEqual(parseToken(token), null);
});

test("parseToken returns null for invalid base64", () => {
  assert.strictEqual(parseToken("not-valid-base64!!!"), null);
});

test("parseToken returns null for base64 that is not JSON", () => {
  assert.strictEqual(parseToken(btoa("just a plain string")), null);
});

test("parseToken returns null for empty string", () => {
  assert.strictEqual(parseToken(""), null);
});

// --- verifyUserRole ---

test("verifyUserRole returns false for null user", () => {
  assert.strictEqual(verifyUserRole(null), false);
});

test("verifyUserRole defaults requiredRole to admin", () => {
  const admin: SessionUser = { id: "1", username: "a", name: "A", role: "admin" };
  const regular: SessionUser = { id: "2", username: "b", name: "B", role: "user" };
  assert.strictEqual(verifyUserRole(admin), true);
  assert.strictEqual(verifyUserRole(regular), false);
});

test("verifyUserRole returns true for any authenticated user when requiredRole is user", () => {
  const admin: SessionUser = { id: "1", username: "a", name: "A", role: "admin" };
  const regular: SessionUser = { id: "2", username: "b", name: "B", role: "user" };
  assert.strictEqual(verifyUserRole(admin, "user"), true);
  assert.strictEqual(verifyUserRole(regular, "user"), true);
});

// --- getUserFromContext ---

test("getUserFromContext returns null when no token is present", async () => {
  const c = createContext({});
  const user = await getUserFromContext(c);
  assert.strictEqual(user, null);
});

test("getUserFromContext returns null for a malformed token", async () => {
  const c = createContext({ authHeader: "Bearer not-valid-base64!!!" });
  const user = await getUserFromContext(c);
  assert.strictEqual(user, null);
});

test("getUserFromContext returns null when the user no longer exists in the db", async () => {
  await withRuntimeEnv({ DB: sharedFakeD1 }, async () => {
    const token = makeToken({ id: "ghost", username: "ghost", name: "Ghost", role: "admin" });
    const c = createContext({ authHeader: `Bearer ${token}` });
    const user = await getUserFromContext(c);
    assert.strictEqual(user, null);
  });
});

test("getUserFromContext reads the token from the Authorization header and refreshes role from the db", async () => {
  sharedFakeD1
    .prepare("INSERT INTO users (id, username, name, password_hash, role) VALUES (?, ?, ?, ?, ?)")
    .bind("usr_admin", "boss", "Boss", "hash", "admin")
    .run();

  await withRuntimeEnv({ DB: sharedFakeD1 }, async () => {
    // Token claims "user" but the db says "admin" — db must win.
    const token = makeToken({ id: "usr_admin", username: "boss", name: "Boss", role: "user" });
    const c = createContext({ authHeader: `Bearer ${token}` });
    const user = await getUserFromContext(c);
    assert.deepStrictEqual(user, { id: "usr_admin", username: "boss", name: "Boss", role: "admin" });
  });
});

test("getUserFromContext reads the token from the Cookie header", async () => {
  sharedFakeD1
    .prepare("INSERT INTO users (id, username, name, password_hash, role) VALUES (?, ?, ?, ?, ?)")
    .bind("usr_cookie", "cookiefan", "Cookie Fan", "hash", "user")
    .run();

  await withRuntimeEnv({ DB: sharedFakeD1 }, async () => {
    const token = makeToken({ id: "usr_cookie", username: "cookiefan", name: "Cookie Fan", role: "user" });
    const c = createContext({ cookieHeader: `session=${token}` });
    const user = await getUserFromContext(c);
    assert.deepStrictEqual(user, { id: "usr_cookie", username: "cookiefan", name: "Cookie Fan", role: "user" });
  });
});

test("getUserFromContext returns null for a malformed cookie (invalid URI encoding)", async () => {
  await withRuntimeEnv({ DB: sharedFakeD1 }, async () => {
    const c = createContext({ cookieHeader: "session=abc%" });
    const user = await getUserFromContext(c);
    assert.strictEqual(user, null);
  });
});

// --- adminGuard ---

test("adminGuard returns 401 when unauthenticated", async () => {
  await withRuntimeEnv({ DB: sharedFakeD1 }, async () => {
    const c = createContext({});
    const result = await adminGuard(c);
    assert.ok("errorResponse" in result);
    if ("errorResponse" in result) {
      assert.strictEqual(result.errorResponse.status, 401);
      const body = await result.errorResponse.json();
      assert.deepStrictEqual(body, { success: false, error: "Authentication required" });
    }
  });
});

test("adminGuard returns 403 for an authenticated non-admin user", async () => {
  sharedFakeD1
    .prepare("INSERT INTO users (id, username, name, password_hash, role) VALUES (?, ?, ?, ?, ?)")
    .bind("usr_regular", "regular", "Regular User", "hash", "user")
    .run();

  await withRuntimeEnv({ DB: sharedFakeD1 }, async () => {
    const token = makeToken({ id: "usr_regular", username: "regular", name: "Regular User", role: "user" });
    const c = createContext({ authHeader: `Bearer ${token}` });
    const result = await adminGuard(c);
    assert.ok("errorResponse" in result);
    if ("errorResponse" in result) {
      assert.strictEqual(result.errorResponse.status, 403);
      const body = await result.errorResponse.json();
      assert.deepStrictEqual(body, { success: false, error: "Admin access required" });
    }
  });
});

test("adminGuard returns the user for an authenticated admin", async () => {
  sharedFakeD1
    .prepare("INSERT INTO users (id, username, name, password_hash, role) VALUES (?, ?, ?, ?, ?)")
    .bind("usr_admin2", "chief", "Chief Admin", "hash", "admin")
    .run();

  await withRuntimeEnv({ DB: sharedFakeD1 }, async () => {
    const token = makeToken({ id: "usr_admin2", username: "chief", name: "Chief Admin", role: "admin" });
    const c = createContext({ authHeader: `Bearer ${token}` });
    const result = await adminGuard(c);
    assert.ok("user" in result);
    if ("user" in result) {
      assert.deepStrictEqual(result.user, { id: "usr_admin2", username: "chief", name: "Chief Admin", role: "admin" });
    }
  });
});
