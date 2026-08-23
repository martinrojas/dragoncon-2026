import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { withRuntimeEnv } from "void/_env";
import { computeContentHash, runIngestion } from "../lib/ingest.ts";

const BASE_URL = "https://app.core-apps.com/dragoncon26";

/**
 * `runIngestion` reads/writes the D1 binding via `void/db`'s runtime env
 * proxy, whose default `db` export caches its drizzle instance on first
 * property access and ignores whichever `DB` binding a later
 * `withRuntimeEnv` call supplies (see tests/make-admin.test.ts). All tests
 * that exercise the database path therefore share one fake D1 binding, and
 * use disjoint event ids / day names per scenario to avoid collisions.
 */
function createFakeD1() {
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
  `);

  return {
    raw: sqliteDb,
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

const sharedFakeD1 = createFakeD1();

function insertEvent(overrides: {
  id: string;
  title: string;
  day: string;
  location?: string | null;
  timeString?: string | null;
  description?: string | null;
  contentHash: string;
  isDeleted?: number;
}) {
  sharedFakeD1
    .prepare(
      `INSERT INTO events (id, title, description, location, day, time_string, content_hash, is_deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      overrides.id,
      overrides.title,
      overrides.description ?? null,
      overrides.location ?? null,
      overrides.day,
      overrides.timeString ?? null,
      overrides.contentHash,
      overrides.isDeleted ?? 0,
    )
    .run();
}

function getEvent(id: string): Record<string, unknown> | undefined {
  return sharedFakeD1.prepare("SELECT * FROM events WHERE id = ?").bind(id).all().results[0] as
    | Record<string, unknown>
    | undefined;
}

function countEventChanges(eventId: string): number {
  const rows = sharedFakeD1.prepare("SELECT * FROM event_changes WHERE event_id = ?").bind(eventId).all()
    .results as unknown[];
  return rows.length;
}

interface ListingItem {
  id: string;
  title: string;
  timeStr: string;
}

function dayListingHtml(dayHeaderText: string, items: ListingItem[]): string {
  const rows = items
    .map(
      (it) => `
      <div class="redux_list_item">
        <a class="object_link" href="/dragoncon26/event/${it.id}">
          <span class="line one">${it.title}</span>
          <span class="line two">${it.timeStr}</span>
        </a>
      </div>`,
    )
    .join("\n");
  return `<html><body>
    <div class="section_header alt">${dayHeaderText}</div>
    ${rows}
  </body></html>`;
}

interface DetailFixture {
  location: string;
  dateStr?: string;
  durationStr?: string;
  description: string;
  track?: string;
  speakers?: string[];
}

function detailHtml(fixture: DetailFixture): string {
  const speakers = fixture.speakers ?? [];
  return `<html><body>
    <table>
      <tr><td>Location</td><td>${fixture.location}</td></tr>
      <tr><td>Date</td><td>${fixture.dateStr ?? ""}</td></tr>
      <tr><td>Duration</td><td>${fixture.durationStr ?? ""}</td></tr>
    </table>
    <div class="section-about"><p>${fixture.description}</p></div>
    <div class="section_heading">Tracks</div><a>${fixture.track ?? ""}</a>
    <div class="speakers-wrap">
      <div class="section_heading">Speakers</div>
      ${speakers.map((s) => `<a>${s}</a>`).join("\n")}
    </div>
  </body></html>`;
}

/** Installs a fetch mock keyed by exact URL for the duration of one test. */
function withMockedFetch<T>(routes: Map<string, string>, fn: () => Promise<T>): Promise<T> {
  const original = global.fetch;
  global.fetch = (async (url: string | URL) => {
    const key = typeof url === "string" ? url : url.toString();
    const body = routes.get(key);
    if (body === undefined) {
      return new Response("", { status: 404 });
    }
    return new Response(body, { status: 200 });
  }) as typeof fetch;

  return fn().finally(() => {
    global.fetch = original;
  });
}

// ---------------------------------------------------------------------------
// computeContentHash
// ---------------------------------------------------------------------------

test("computeContentHash is consistent for identical inputs", async () => {
  const a = await computeContentHash("Opening Ceremony", "Marriott Ballroom", "Thu 8:00 PM", "Kick off the con");
  const b = await computeContentHash("Opening Ceremony", "Marriott Ballroom", "Thu 8:00 PM", "Kick off the con");
  assert.strictEqual(a, b);
  assert.match(a, /^[0-9a-f]{64}$/);
});

test("computeContentHash changes when any input field changes", async () => {
  const base = await computeContentHash("Panel A", "Room 1", "Fri 10:00 AM", "Description");
  const diffTitle = await computeContentHash("Panel B", "Room 1", "Fri 10:00 AM", "Description");
  const diffLocation = await computeContentHash("Panel A", "Room 2", "Fri 10:00 AM", "Description");
  const diffTime = await computeContentHash("Panel A", "Room 1", "Fri 11:00 AM", "Description");
  const diffDescription = await computeContentHash("Panel A", "Room 1", "Fri 10:00 AM", "Other");

  const hashes = [base, diffTitle, diffLocation, diffTime, diffDescription];
  assert.strictEqual(new Set(hashes).size, hashes.length, "every variant should produce a unique hash");
});

test("computeContentHash treats missing optional fields as empty strings", async () => {
  const withNulls = await computeContentHash("Solo Event", null, null, null);
  const withEmpty = await computeContentHash("Solo Event", "", "", "");
  assert.strictEqual(withNulls, withEmpty);
});

// ---------------------------------------------------------------------------
// dry-run mode: zero database mutations
// ---------------------------------------------------------------------------

test("dry-run mode computes a diff summary without mutating the database", async () => {
  const day = "DryRunDay";
  const dayParam = "dryrunday";

  const existingHash = await computeContentHash("Old Title", "Old Loc", "Old Time", "Old Desc");
  insertEvent({
    id: "aaaa1111",
    title: "Old Title",
    day,
    location: "Old Loc",
    timeString: "Old Time",
    description: "Old Desc",
    contentHash: existingHash,
  });

  const missingHash = await computeContentHash("Vanishing Panel", "Room 9", "Old Time", "");
  insertEvent({
    id: "aaaa3333",
    title: "Vanishing Panel",
    day,
    location: "Room 9",
    timeString: "Old Time",
    description: "",
    contentHash: missingHash,
  });

  const routes = new Map<string, string>();
  routes.set(
    `${BASE_URL}/events/view_by_day?day=${dayParam}`,
    dayListingHtml(day, [
      { id: "aaaa1111", title: "New Title", timeStr: "New Time" },
      { id: "aaaa2222", title: "Brand New Event", timeStr: "New Time 2" },
    ]),
  );
  routes.set(
    `${BASE_URL}/event/aaaa1111`,
    detailHtml({ location: "New Loc", description: "New Desc", track: "Track A", speakers: ["Speaker A"] }),
  );
  routes.set(
    `${BASE_URL}/event/aaaa2222`,
    detailHtml({ location: "Brand Loc", description: "Brand Desc", track: "Track B", speakers: [] }),
  );

  const result = await withRuntimeEnv({ DB: sharedFakeD1 }, () =>
    withMockedFetch(routes, () => runIngestion({ mode: "dry-run", days: [dayParam] })),
  );

  assert.strictEqual(result.mode, "dry-run");
  assert.strictEqual(result.totalScraped, 2);
  assert.strictEqual(result.created, 1);
  assert.strictEqual(result.updated, 1);
  assert.strictEqual(result.deleted, 1);
  assert.strictEqual(result.errors, 0);
  assert.ok(result.log.length > 0);

  assert.deepStrictEqual(
    result.diffSummary.createdEvents.map((e) => e.id),
    ["aaaa2222"],
  );
  assert.deepStrictEqual(
    result.diffSummary.updatedEvents.map((e) => e.id),
    ["aaaa1111"],
  );
  assert.deepStrictEqual(
    result.diffSummary.deletedEvents.map((e) => e.id),
    ["aaaa3333"],
  );

  // Zero database mutations: existing row untouched, new row never inserted,
  // missing row never marked deleted, and no change records were written.
  const existingRow = getEvent("aaaa1111");
  assert.strictEqual(existingRow?.title, "Old Title");
  assert.strictEqual(existingRow?.content_hash, existingHash);

  assert.strictEqual(getEvent("aaaa2222"), undefined);

  const missingRow = getEvent("aaaa3333");
  assert.strictEqual(missingRow?.is_deleted, 0);

  assert.strictEqual(countEventChanges("aaaa1111"), 0);
  assert.strictEqual(countEventChanges("aaaa2222"), 0);
  assert.strictEqual(countEventChanges("aaaa3333"), 0);
});

// ---------------------------------------------------------------------------
// sync mode: normal diffing with real mutations
// ---------------------------------------------------------------------------

test("sync mode inserts, updates, and soft-deletes against D1", async () => {
  const day = "SyncDay";
  const dayParam = "syncday";

  const existingHash = await computeContentHash("Old Sync Title", "Old Sync Loc", "Old Time", "Old Sync Desc");
  insertEvent({
    id: "bbbb1111",
    title: "Old Sync Title",
    day,
    location: "Old Sync Loc",
    timeString: "Old Time",
    description: "Old Sync Desc",
    contentHash: existingHash,
  });

  const missingHash = await computeContentHash("Cancelled Panel", "Room 5", "Old Time", "");
  insertEvent({
    id: "bbbb3333",
    title: "Cancelled Panel",
    day,
    location: "Room 5",
    timeString: "Old Time",
    description: "",
    contentHash: missingHash,
  });

  const routes = new Map<string, string>();
  routes.set(
    `${BASE_URL}/events/view_by_day?day=${dayParam}`,
    dayListingHtml(day, [
      { id: "bbbb1111", title: "Updated Sync Title", timeStr: "New Time" },
      { id: "bbbb2222", title: "Sync New Event", timeStr: "New Time 2" },
    ]),
  );
  routes.set(
    `${BASE_URL}/event/bbbb1111`,
    detailHtml({ location: "New Sync Loc", description: "New Sync Desc", track: "Track A" }),
  );
  routes.set(`${BASE_URL}/event/bbbb2222`, detailHtml({ location: "Sync New Loc", description: "Sync New Desc" }));

  const result = await withRuntimeEnv({ DB: sharedFakeD1 }, () =>
    withMockedFetch(routes, () => runIngestion({ mode: "sync", days: [dayParam] })),
  );

  assert.strictEqual(result.mode, "sync");
  assert.strictEqual(result.totalScraped, 2);
  assert.strictEqual(result.created, 1);
  assert.strictEqual(result.updated, 1);
  assert.strictEqual(result.deleted, 1);

  const updatedRow = getEvent("bbbb1111");
  assert.strictEqual(updatedRow?.title, "Updated Sync Title");
  assert.strictEqual(updatedRow?.location, "New Sync Loc");
  assert.notStrictEqual(updatedRow?.content_hash, existingHash);

  const newRow = getEvent("bbbb2222");
  assert.strictEqual(newRow?.title, "Sync New Event");

  const missingRow = getEvent("bbbb3333");
  assert.strictEqual(missingRow?.is_deleted, 1);

  assert.strictEqual(countEventChanges("bbbb1111"), 1);
  assert.strictEqual(countEventChanges("bbbb2222"), 1);
  assert.strictEqual(countEventChanges("bbbb3333"), 1);
});

// ---------------------------------------------------------------------------
// hard-resync mode: wipe targeted days then insert everything fresh
// ---------------------------------------------------------------------------

test("hard-resync mode wipes existing day records and re-inserts scraped events fresh", async () => {
  const day = "HardDay";
  const dayParam = "hardday";

  insertEvent({
    id: "cccc1111",
    title: "Stale Title 1",
    day,
    location: "Stale Loc",
    timeString: "Stale Time",
    description: "Stale Desc",
    contentHash: "stale-hash-1",
  });
  insertEvent({
    id: "cccc2222",
    title: "Stale Title 2",
    day,
    location: "Stale Loc 2",
    timeString: "Stale Time 2",
    description: "Stale Desc 2",
    contentHash: "stale-hash-2",
  });

  const routes = new Map<string, string>();
  routes.set(
    `${BASE_URL}/events/view_by_day?day=${dayParam}`,
    dayListingHtml(day, [
      { id: "cccc1111", title: "Fresh Title 1", timeStr: "Fresh Time 1" },
      { id: "cccc3333", title: "Fresh New Event", timeStr: "Fresh Time 2" },
    ]),
  );
  routes.set(`${BASE_URL}/event/cccc1111`, detailHtml({ location: "Fresh Loc 1", description: "Fresh Desc 1" }));
  routes.set(`${BASE_URL}/event/cccc3333`, detailHtml({ location: "Fresh Loc 2", description: "Fresh Desc 2" }));

  const result = await withRuntimeEnv({ DB: sharedFakeD1 }, () =>
    withMockedFetch(routes, () => runIngestion({ mode: "hard-resync", days: [dayParam] })),
  );

  assert.strictEqual(result.mode, "hard-resync");
  assert.strictEqual(result.totalScraped, 2);
  // Both old rows were wiped; both scraped items land as fresh creates
  // (including cccc1111, which reappeared in the upstream listing).
  assert.strictEqual(result.deleted, 2);
  assert.strictEqual(result.created, 2);
  assert.strictEqual(result.updated, 0);

  assert.deepStrictEqual(
    new Set(result.diffSummary.deletedEvents.map((e) => e.id)),
    new Set(["cccc1111", "cccc2222"]),
  );
  assert.deepStrictEqual(new Set(result.diffSummary.createdEvents.map((e) => e.id)), new Set(["cccc1111", "cccc3333"]));

  // cccc2222 never reappeared upstream, so it is gone entirely.
  assert.strictEqual(getEvent("cccc2222"), undefined);

  // cccc1111 was wiped and freshly re-inserted with the new scraped content.
  const refreshedRow = getEvent("cccc1111");
  assert.strictEqual(refreshedRow?.title, "Fresh Title 1");
  assert.strictEqual(refreshedRow?.location, "Fresh Loc 1");
  assert.notStrictEqual(refreshedRow?.content_hash, "stale-hash-1");

  const newRow = getEvent("cccc3333");
  assert.strictEqual(newRow?.title, "Fresh New Event");
});

// ---------------------------------------------------------------------------
// default mode
// ---------------------------------------------------------------------------

test("runIngestion defaults to sync mode when none is specified", async () => {
  const day = "DefaultModeDay";
  const dayParam = "defaultmodeday";

  const routes = new Map<string, string>();
  routes.set(
    `${BASE_URL}/events/view_by_day?day=${dayParam}`,
    dayListingHtml(day, [{ id: "dddd1111", title: "Default Mode Event", timeStr: "Time" }]),
  );
  routes.set(`${BASE_URL}/event/dddd1111`, detailHtml({ location: "Loc", description: "Desc" }));

  const result = await withRuntimeEnv({ DB: sharedFakeD1 }, () =>
    withMockedFetch(routes, () => runIngestion({ days: [dayParam] })),
  );

  assert.strictEqual(result.mode, "sync");
  assert.strictEqual(result.created, 1);
  assert.ok(getEvent("dddd1111"));
});
