import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { withRuntimeEnv } from "void/_env";
import { computeContentHash, runIngestionWithRunLog } from "../lib/ingest.ts";
import cronHandler, { cron, isWithinActiveWindow, nextSyncDays, SYNC_DAYS } from "../crons/sync-schedule.ts";

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
  let errorOutput = "";
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args: unknown[]) => {
    logOutput += args.map(String).join(" ");
  };
  console.error = (...args: unknown[]) => {
    errorOutput += args.map(String).join(" ");
  };

  try {
    // Mock upstream Dragon Con HTML responses for whichever con day this
    // deterministic tick rotates to.
    const tickNow = new Date("2026-09-03T14:00:00Z");
    const [rotDay] = nextSyncDays(tickNow);
    const rotDayHeader = `${rotDay.replace(/\+\+/g, "  ")} (rotation fixture)`;
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes(rotDay)) {
        return new Response(
          `<html><body>
            <div class="section_header alt">${rotDayHeader}</div>
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
    assert.ok(logOutput.includes("Run #1 finished in"));
    assert.ok(logOutput.includes("Created: 1"));
    // Verify DB contains ingested event
    const eventRow = sharedFakeD1
      .prepare("SELECT * FROM events WHERE id = ?")
      .bind("101ab")
      .all().results[0] as Record<string, unknown> | undefined;
    assert.strictEqual(errorOutput.includes("[Cron:sync-schedule] Error"), false, "Expected no cron sync errors");
    assert.ok(eventRow, "Event should have been inserted into D1 by cron sync");
    assert.strictEqual(eventRow?.title, "Cron Job Workshop");
    assert.strictEqual(eventRow?.location, "Hyatt Regency");
    assert.strictEqual(eventRow?.time_string, "10:00 AM");
    assert.strictEqual(eventRow?.starts_at, "2026-09-03T14:00:00.000Z");
    assert.strictEqual(eventRow?.ends_at, "2026-09-03T15:00:00.000Z");
    const expectedHash = await computeContentHash(
      "Cron Job Workshop",
      "Hyatt Regency",
      "10:00 AM",
      "Learn Cloudflare cron triggers in Void.",
    );
    assert.strictEqual(eventRow?.content_hash, expectedHash);

    // Regression: cron executions must be recorded in run history (bug: only
    // the admin HTTP route created ingestion_runs rows, cron ran silently).
    const runRows = sharedFakeD1
      .prepare("SELECT user_id, mode, status, stats FROM ingestion_runs")
      .bind().all().results as Array<Record<string, unknown>>;
    assert.strictEqual(runRows.length, 1, "Cron execution should be recorded in ingestion_runs history");
    assert.strictEqual(runRows[0].user_id, "cron");
    assert.strictEqual(runRows[0].mode, "sync");
    assert.strictEqual(runRows[0].status, "completed");
    assert.ok(String(runRows[0].stats).includes('"created":1'));
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
    console.error = originalError;
  }
});

test("runIngestionWithRunLog marks the run failed when ingestion throws", async () => {
  await withRuntimeEnv({ DB: sharedFakeD1 }, async () => {
    await assert.rejects(
      runIngestionWithRunLog({
        onProgress: () => {
          throw new Error("boom");
        },
      }),
      /boom/,
    );

    const failedRows = sharedFakeD1
      .prepare("SELECT status, error_message FROM ingestion_runs WHERE status = 'failed'")
      .bind().all().results as Array<Record<string, unknown>>;
    assert.strictEqual(failedRows.length, 1, "Failed ingestion should be recorded exactly once");
    assert.strictEqual(failedRows[0].error_message, "boom");
  });
});

// ---------------------------------------------------------------------------
// Fix Round: one con day per tick (per-invocation subrequest budgets)
// ---------------------------------------------------------------------------

test("nextSyncDays rotates through every con day deterministically", () => {
  const start = new Date("2026-08-24T00:00:00Z").getTime();
  const picks = Array.from({ length: SYNC_DAYS.length * 2 }, (_, i) => nextSyncDays(new Date(start + i * 4 * 60 * 60 * 1000))[0]);

  assert.strictEqual(picks.length, SYNC_DAYS.length * 2);
  for (let i = 0; i < SYNC_DAYS.length; i++) {
    assert.strictEqual(picks[i], picks[i + SYNC_DAYS.length], "cycle must repeat with period SYNC_DAYS");
  }
  for (const day of SYNC_DAYS) {
    assert.ok(picks.includes(day), `${day} should be covered each cycle`);
  }
});

test("nextSyncDays never returns a con day that has already passed", () => {
  // Sep 6, 2026 18:00Z == 2pm ET Sunday: Wed(2)-Sat(5) are behind ET.
  const PAST_BY_SUNDAY: Record<string, true> = { "Sep++2": true, "Sep++3": true, "Sep++4": true, "Sep++5": true };
  for (let hour = 0; hour < 24; hour += 4) {
    const pick = nextSyncDays(new Date(Date.UTC(2026, 8, 6, hour)))[0];
    assert.ok(pick && !(pick in PAST_BY_SUNDAY), `tick ${hour}Z returned stale day ${pick}`);
  }
});

test("nextSyncDays returns empty once the con window has fully passed", () => {
  assert.deepStrictEqual(nextSyncDays(new Date("2026-09-20T18:00:00Z")), []);
});
