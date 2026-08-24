import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { withRuntimeEnv } from "void/_env";
import cronHandler, { cron, isWithinActiveWindow } from "../crons/sync-schedule.ts";

interface FakeD1BoundStatement {
  raw(): unknown[][];
  all(): { results: unknown[] };
  run(): { success: boolean; meta: { changes: number; last_row_id: number } };
}

interface FakeD1Binding {
  raw: DatabaseSync;
  prepare(sqlText: string): { bind(...params: unknown[]): FakeD1BoundStatement };
}

function createFakeD1(): FakeD1Binding {
  const sqliteDb = new DatabaseSync(":memory:");
  sqliteDb.exec(`
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
    CREATE TABLE event_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL,
      event_title TEXT NOT NULL,
      change_type TEXT NOT NULL,
      diff_details TEXT,
      detected_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE ingestion_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      finished_at TEXT NOT NULL,
      mode TEXT NOT NULL,
      total_scraped INTEGER NOT NULL,
      created_count INTEGER NOT NULL,
      updated_count INTEGER NOT NULL,
      deleted_count INTEGER NOT NULL,
      error_count INTEGER NOT NULL,
      diff_summary TEXT NOT NULL,
      log_text TEXT NOT NULL,
      success INTEGER NOT NULL
    );
  `);

  return {
    raw: sqliteDb,
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

test("cron configuration exports expected schedules", () => {
  assert.ok(Array.isArray(cron), "cron should be an array of expressions");
  assert.strictEqual(cron.length, 3);
  assert.deepStrictEqual(cron, [
    "0 */4 * 8 *",
    "0 */4 1-2 9 *",
    "*/30 * 3-7 9 *",
  ]);
});

test("isWithinActiveWindow correctly evaluates 2026 active dates", () => {
  // Before active window in August 2026
  assert.strictEqual(isWithinActiveWindow(new Date("2026-08-23T23:59:59Z")), false);

  // Active August window (Aug 24-31)
  assert.strictEqual(isWithinActiveWindow(new Date("2026-08-24T00:00:00Z")), true);
  assert.strictEqual(isWithinActiveWindow(new Date("2026-08-31T23:59:59Z")), true);

  // Active September pre-con & con window (Sep 1-7)
  assert.strictEqual(isWithinActiveWindow(new Date("2026-09-01T00:00:00Z")), true);
  assert.strictEqual(isWithinActiveWindow(new Date("2026-09-05T12:30:00Z")), true);
  assert.strictEqual(isWithinActiveWindow(new Date("2026-09-07T23:59:59Z")), true);

  // After con (Sep 8+)
  assert.strictEqual(isWithinActiveWindow(new Date("2026-09-08T00:00:00Z")), false);
  assert.strictEqual(isWithinActiveWindow(new Date("2026-09-30T12:00:00Z")), false);

  // Other years should never be active
  assert.strictEqual(isWithinActiveWindow(new Date("2025-08-25T12:00:00Z")), false);
  assert.strictEqual(isWithinActiveWindow(new Date("2027-09-04T12:00:00Z")), false);
});

test("cron handler skips execution outside active window", async () => {
  let logOutput = "";
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    logOutput += args.map(String).join(" ");
  };

  try {
    const fakeController = {
      cron: "0 */4 * 8 *",
      scheduledTime: new Date("2026-08-20T00:00:00Z").getTime(),
      noRetry() {},
    } as unknown as Parameters<typeof cronHandler>[0];

    const fakeEnv = {} as unknown as Parameters<typeof cronHandler>[1];
    const fakeCtx = {
      waitUntil() {},
      passThroughOnException() {},
    } as unknown as Parameters<typeof cronHandler>[2];

    await cronHandler(fakeController, fakeEnv, fakeCtx);
    assert.ok(logOutput.includes("Skipping execution outside active 2026 con window"));
  } finally {
    console.log = originalLog;
  }
});

test("cron handler executes runIngestion when within active window", async () => {
  const originalFetch = globalThis.fetch;
  let logOutput = "";
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    logOutput += args.map(String).join(" ");
  };

  try {
    // Mock upstream Dragon Con HTML responses for 1 day
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("Sep++3")) {
        return new Response(
          `<html><body>
            <div class="section_header alt">Thursday, Sep 3</div>
            <div class="redux_list_item">
              <a class="object_link" href="/dragoncon26/event/101ab">
                <span class="line one">Cron Job Workshop</span>
                <span class="line two">10:00 AM</span>
              </a>
            </div>
          </body></html>`,
          { status: 200, headers: { "Content-Type": "text/html" } },
        );
      }
      if (url.includes("/event/101ab")) {
        return new Response(
          `<html><body>
            <table>
              <tr><td>Location</td><td>Hyatt Regency</td></tr>
              <tr><td>Date</td><td>Thursday, Sep 3 10:00 AM</td></tr>
              <tr><td>Duration</td><td>1 Hour</td></tr>
            </table>
            <div class="section-about"><p>Learn Cloudflare cron triggers in Void.</p></div>
            <div class="section_heading">Tracks</div><a>Workshops</a>
            <div class="speakers-wrap">
              <div class="section_heading">Speakers</div>
              <a>Host 1</a>
            </div>
          </body></html>`,
          { status: 200, headers: { "Content-Type": "text/html" } },
        );
      }
      return new Response(
        `<html><body><div class="section_header alt">Empty Day</div></body></html>`,
        { status: 200, headers: { "Content-Type": "text/html" } },
      );
    };

    const fakeController = {
      cron: "*/30 * 3-7 9 *",
      scheduledTime: new Date("2026-09-03T14:00:00Z").getTime(),
      noRetry() {},
    } as unknown as Parameters<typeof cronHandler>[0];

    const fakeEnv = { DB: sharedFakeD1 } as unknown as Parameters<typeof cronHandler>[1];
    const fakeCtx = {
      waitUntil() {},
      passThroughOnException() {},
    } as unknown as Parameters<typeof cronHandler>[2];
    await withRuntimeEnv({ DB: sharedFakeD1 }, async () => {
      await cronHandler(fakeController, fakeEnv, fakeCtx);
    });

    assert.ok(logOutput.includes("Starting scheduled sync at 2026-09-03T14:00:00.000Z"));
    assert.ok(logOutput.includes("Ingestion finished in"));
    assert.ok(logOutput.includes("Created: 1"));

    // Verify DB contains ingested event
    const eventRow = sharedFakeD1
      .prepare("SELECT * FROM events WHERE id = ?")
      .bind("101ab")
      .all().results[0] as Record<string, unknown> | undefined;
    assert.ok(eventRow, "Event should have been inserted into D1 by cron sync");
    assert.strictEqual(eventRow?.title, "Cron Job Workshop");
    assert.strictEqual(eventRow?.location, "Hyatt Regency");
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
  }
});
