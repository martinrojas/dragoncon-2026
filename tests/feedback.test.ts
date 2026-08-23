import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import type { Context } from "hono";
import { withRuntimeEnv } from "void/_env";
import { POST as feedbackPOST, GET as feedbackGET } from "../routes/api/feedback.ts";

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
    CREATE TABLE feedback (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      username TEXT,
      kind TEXT NOT NULL,
      message TEXT NOT NULL,
      contact TEXT,
      app_version TEXT,
      user_agent TEXT,
      page_url TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  return {
    rawDb: sqliteDb,
    prepare(sqlText: string) {
      const stmt = sqliteDb.prepare(sqlText);
      return {
        bind(...params: unknown[]) {
          return {
            raw() {
              return stmt.all(...(params as never[])).map((row: unknown) => Object.values(row as object));
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

const sharedFakeD1 = createFakeD1();

function makeToken(payload: Record<string, unknown>): string {
  return btoa(JSON.stringify(payload));
}

function createContext(opts: {
  authHeader?: string;
  userAgent?: string;
  body?: unknown;
  params?: Record<string, string>;
} = {}): Context {
  return {
    req: {
      header: (name: string) => {
        const lower = name.toLowerCase();
        if (lower === "authorization") return opts.authHeader;
        if (lower === "user-agent") return opts.userAgent ?? "TestAgent/1.0";
        return undefined;
      },
      json: async () => opts.body ?? {},
      param: (name: string) => opts.params?.[name],
    },
    json: (body: unknown, status?: number) => new Response(JSON.stringify(body), { status: status ?? 200 }),
  } as unknown as Context;
}

const adminUserId = "usr_admin_fb";
const regularUserId = "usr_reg_fb";

function insertUser(id: string, username: string, role: "admin" | "user") {
  sharedFakeD1
    .prepare("INSERT INTO users (id, username, name, password_hash, role) VALUES (?, ?, ?, ?, ?)")
    .bind(id, username, username, "hash", role)
    .run();
}

insertUser(adminUserId, "admin_fb", "admin");
insertUser(regularUserId, "reg_fb", "user");

const adminToken = makeToken({ id: adminUserId, username: "admin_fb", name: "admin_fb", role: "admin" });
const userToken = makeToken({ id: regularUserId, username: "reg_fb", name: "reg_fb", role: "user" });

test("POST /api/feedback successfully inserts a bug report with user-agent", async () => {
  await withRuntimeEnv({ DB: sharedFakeD1 }, async () => {
    const ctx = createContext({
      userAgent: "CyberDragonApp/1.0",
      body: {
        kind: "bug",
        message: "Map pin off-center in Marriott atrium",
        contact: "dev@example.com",
        userId: regularUserId,
        username: "reg_fb",
        appVersion: "1.0.0",
        pageUrl: "https://dragoncon.martinrojas.dev",
      },
    });

    const res = (await feedbackPOST(ctx)) as Response;
    assert.equal(res.status, 200);
    const data = (await res.json()) as { success: boolean; message: string };
    assert.equal(data.success, true);
    assert.equal(data.message, "Thanks — your note is in.");

    // Query database to verify fields
    const row = sharedFakeD1.rawDb
      .prepare("SELECT kind, message, contact, user_id, username, app_version, user_agent, status FROM feedback WHERE message = ?")
      .get("Map pin off-center in Marriott atrium") as Record<string, unknown>;

    assert.ok(row, "Feedback row should exist in database");
    assert.equal(row.kind, "bug");
    assert.equal(row.contact, "dev@example.com");
    assert.equal(row.user_id, regularUserId);
    assert.equal(row.username, "reg_fb");
    assert.equal(row.app_version, "1.0.0");
    assert.equal(row.user_agent, "CyberDragonApp/1.0");
    assert.equal(row.status, "new");
  });
});

test("POST /api/feedback rejects invalid kind with 400", async () => {
  await withRuntimeEnv({ DB: sharedFakeD1 }, async () => {
    const ctx = createContext({
      body: {
        kind: "praise",
        message: "Great app!",
      },
    });

    const res = (await feedbackPOST(ctx)) as Response;
    assert.equal(res.status, 400);
    const data = (await res.json()) as { success: boolean; error: string };
    assert.equal(data.success, false);
    assert.equal(data.error, "kind must be bug or idea");
  });
});

test("POST /api/feedback rejects empty or whitespace-only message with 400", async () => {
  await withRuntimeEnv({ DB: sharedFakeD1 }, async () => {
    const ctx = createContext({
      body: {
        kind: "idea",
        message: "   ",
      },
    });

    const res = (await feedbackPOST(ctx)) as Response;
    assert.equal(res.status, 400);
    const data = (await res.json()) as { success: boolean; error: string };
    assert.equal(data.success, false);
    assert.equal(data.error, "message is required");
  });
});

test("POST /api/feedback rejects message longer than 2000 characters with 400", async () => {
  await withRuntimeEnv({ DB: sharedFakeD1 }, async () => {
    const longMessage = "a".repeat(2001);
    const ctx = createContext({
      body: {
        kind: "idea",
        message: longMessage,
      },
    });

    const res = (await feedbackPOST(ctx)) as Response;
    assert.equal(res.status, 400);
    const data = (await res.json()) as { success: boolean; error: string };
    assert.equal(data.success, false);
    assert.equal(data.error, "message must be 2000 characters or fewer");
  });
});

test("POST /api/feedback normalizes empty contact string to null", async () => {
  await withRuntimeEnv({ DB: sharedFakeD1 }, async () => {
    const ctx = createContext({
      body: {
        kind: "idea",
        message: "Add shuttle schedule live tracker",
        contact: "   ",
      },
    });

    const res = (await feedbackPOST(ctx)) as Response;
    assert.equal(res.status, 200);

    const row = sharedFakeD1.rawDb
      .prepare("SELECT contact FROM feedback WHERE message = ?")
      .get("Add shuttle schedule live tracker") as { contact: string | null };

    assert.ok(row);
    assert.equal(row.contact, null);
  });
});

test("GET /api/feedback returns 401 when unauthenticated", async () => {
  await withRuntimeEnv({ DB: sharedFakeD1 }, async () => {
    const ctx = createContext();
    const res = (await feedbackGET(ctx)) as Response;
    assert.equal(res.status, 401);
  });
});

test("GET /api/feedback returns 403 for an authenticated non-admin user", async () => {
  await withRuntimeEnv({ DB: sharedFakeD1 }, async () => {
    const ctx = createContext({ authHeader: `Bearer ${userToken}` });
    const res = (await feedbackGET(ctx)) as Response;
    assert.equal(res.status, 403);
  });
});

test("GET /api/feedback returns list of feedback for authenticated admin", async () => {
  await withRuntimeEnv({ DB: sharedFakeD1 }, async () => {
    const ctx = createContext({ authHeader: `Bearer ${adminToken}` });
    const res = (await feedbackGET(ctx)) as Response;
    assert.equal(res.status, 200);
    const data = (await res.json()) as { success: boolean; feedback: Array<{ message: string }> };
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.feedback));
    assert.ok(data.feedback.length >= 2);
  });
});
