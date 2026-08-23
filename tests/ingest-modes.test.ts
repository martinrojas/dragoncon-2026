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
  track?: string | null;
  speakers?: string | null;
  contentHash: string;
  isDeleted?: number;
}) {
  sharedFakeD1
    .prepare(
      `INSERT INTO events (id, title, description, location, track, day, time_string, speakers, content_hash, is_deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      overrides.id,
      overrides.title,
      overrides.description ?? null,
      overrides.location ?? null,
      overrides.track ?? null,
      overrides.day,
      overrides.timeString ?? null,
      overrides.speakers ?? null,
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

// ---------------------------------------------------------------------------
// Fix Round 1: truncation-aware deletion scan, hard-resync safety, folded
// diff detection, and filtered deletion counters
// ---------------------------------------------------------------------------

test("sync mode skips the missing-event deletion scan when maxDetailFetches truncates the day", async () => {
  const day = "TruncScanDay";
  const dayParam = "truncscanday";

  const staleHash = await computeContentHash("Untouched Panel", "Room 1", "Old Time", "");
  insertEvent({
    id: "aaaa5999",
    title: "Untouched Panel",
    day,
    location: "Room 1",
    timeString: "Old Time",
    description: "",
    contentHash: staleHash,
  });

  const routes = new Map<string, string>();
  routes.set(
    `${BASE_URL}/events/view_by_day?day=${dayParam}`,
    dayListingHtml(day, [
      { id: "aaaa5001", title: "Fetched Event", timeStr: "New Time" },
      { id: "aaaa5002", title: "Unfetched Event", timeStr: "New Time 2" },
    ]),
  );
  routes.set(`${BASE_URL}/event/aaaa5001`, detailHtml({ location: "Loc 1", description: "Desc 1" }));

  const result = await withRuntimeEnv({ DB: sharedFakeD1 }, () =>
    withMockedFetch(routes, () => runIngestion({ mode: "sync", days: [dayParam], maxDetailFetches: 1 })),
  );

  assert.strictEqual(result.totalScraped, 1);
  assert.strictEqual(result.created, 1);
  // The day listing had 2 events but only 1 was targeted, so the
  // missing-event deletion scan must not run at all.
  assert.strictEqual(result.deleted, 0);
  assert.deepStrictEqual(result.diffSummary.deletedEvents, []);

  const untouched = getEvent("aaaa5999");
  assert.strictEqual(untouched?.is_deleted, 0);
  assert.strictEqual(countEventChanges("aaaa5999"), 0);
});

test("hard-resync with maxDetailFetches preserves untargeted events of the day", async () => {
  const day = "HardTruncDay";
  const dayParam = "hardtruncday";

  insertEvent({
    id: "aaaa6001",
    title: "Stale Targeted",
    day,
    location: "Stale Loc",
    timeString: "Stale Time",
    description: "Stale Desc",
    contentHash: "stale-hash-htr1",
  });
  insertEvent({
    id: "aaaa6002",
    title: "Untargeted Existing",
    day,
    location: "Untouched Loc",
    timeString: "Untouched Time",
    description: "Untouched Desc",
    contentHash: "stale-hash-htr2",
  });

  const routes = new Map<string, string>();
  routes.set(
    `${BASE_URL}/events/view_by_day?day=${dayParam}`,
    dayListingHtml(day, [
      { id: "aaaa6001", title: "Fresh Targeted", timeStr: "Fresh Time 1" },
      { id: "aaaa6003", title: "Untargeted New", timeStr: "Fresh Time 2" },
    ]),
  );
  routes.set(`${BASE_URL}/event/aaaa6001`, detailHtml({ location: "Fresh Loc 1", description: "Fresh Desc 1" }));

  const result = await withRuntimeEnv({ DB: sharedFakeD1 }, () =>
    withMockedFetch(routes, () => runIngestion({ mode: "hard-resync", days: [dayParam], maxDetailFetches: 1 })),
  );

  assert.strictEqual(result.totalScraped, 1);
  assert.strictEqual(result.created, 1);
  // Only the targeted stale row was wiped; the untargeted existing row and
  // the untargeted new upstream event were left alone entirely.
  assert.strictEqual(result.deleted, 1);
  assert.deepStrictEqual(
    result.diffSummary.deletedEvents.map((e) => e.id),
    ["aaaa6001"],
  );

  const refreshed = getEvent("aaaa6001");
  assert.strictEqual(refreshed?.title, "Fresh Targeted");
  assert.strictEqual(refreshed?.location, "Fresh Loc 1");

  const preserved = getEvent("aaaa6002");
  assert.strictEqual(preserved?.title, "Untargeted Existing");
  assert.strictEqual(preserved?.location, "Untouched Loc");
  assert.strictEqual(preserved?.content_hash, "stale-hash-htr2");

  assert.strictEqual(getEvent("aaaa6003"), undefined);
});

test("sync mode detects track/speakers-only changes even when the content hash is unchanged", async () => {
  const day = "TrackDiffDay";
  const dayParam = "trackdiffday";

  const unchangedHash = await computeContentHash("Panel Q", "Room 7", "Time X", "Same Desc");
  insertEvent({
    id: "aaaa7001",
    title: "Panel Q",
    day,
    location: "Room 7",
    timeString: "Time X",
    description: "Same Desc",
    contentHash: unchangedHash,
  });
  // insertEvent never sets track/speakers, so both start out NULL.
  assert.strictEqual(getEvent("aaaa7001")?.track, null);
  assert.strictEqual(getEvent("aaaa7001")?.speakers, null);

  const routes = new Map<string, string>();
  routes.set(
    `${BASE_URL}/events/view_by_day?day=${dayParam}`,
    dayListingHtml(day, [{ id: "aaaa7001", title: "Panel Q", timeStr: "Time X" }]),
  );
  routes.set(
    `${BASE_URL}/event/aaaa7001`,
    detailHtml({ location: "Room 7", description: "Same Desc", track: "Track Q", speakers: ["Speaker Z"] }),
  );

  const result = await withRuntimeEnv({ DB: sharedFakeD1 }, () =>
    withMockedFetch(routes, () => runIngestion({ mode: "sync", days: [dayParam] })),
  );

  assert.strictEqual(result.created, 0);
  assert.strictEqual(result.updated, 1);
  assert.deepStrictEqual(
    result.diffSummary.updatedEvents.map((e) => e.id),
    ["aaaa7001"],
  );
  assert.match(result.diffSummary.updatedEvents[0].changes, /track/);
  assert.match(result.diffSummary.updatedEvents[0].changes, /speakers/);

  const updated = getEvent("aaaa7001");
  assert.strictEqual(updated?.track, "Track Q");
  assert.strictEqual(updated?.speakers, JSON.stringify(["Speaker Z"]));
  assert.strictEqual(countEventChanges("aaaa7001"), 1);
});

test("sync mode skips an empty update change record when an uncancelled event's content is unchanged", async () => {
  const day = "UncancelDay";
  const dayParam = "uncancelday";

  const sameHash = await computeContentHash("Reappearing Panel", "Room 3", "Time Y", "Same Desc");
  insertEvent({
    id: "aaaa8001",
    title: "Reappearing Panel",
    day,
    location: "Room 3",
    timeString: "Time Y",
    description: "Same Desc",
    track: "",
    speakers: JSON.stringify([]),
    contentHash: sameHash,
    isDeleted: 1,
  });

  const routes = new Map<string, string>();
  routes.set(
    `${BASE_URL}/events/view_by_day?day=${dayParam}`,
    dayListingHtml(day, [{ id: "aaaa8001", title: "Reappearing Panel", timeStr: "Time Y" }]),
  );
  routes.set(`${BASE_URL}/event/aaaa8001`, detailHtml({ location: "Room 3", description: "Same Desc" }));

  const result = await withRuntimeEnv({ DB: sharedFakeD1 }, () =>
    withMockedFetch(routes, () => runIngestion({ mode: "sync", days: [dayParam] })),
  );

  // The row un-deletes, but since no field actually changed, no update
  // change record is logged and it is not reported as an "update".
  assert.strictEqual(result.updated, 0);
  assert.deepStrictEqual(result.diffSummary.updatedEvents, []);
  assert.strictEqual(countEventChanges("aaaa8001"), 0);

  const revived = getEvent("aaaa8001");
  assert.strictEqual(revived?.is_deleted, 0);
});

test("hard-resync deletion counter excludes rows that were already soft-deleted", async () => {
  const day = "DoubleCountDay";
  const dayParam = "doublecountday";

  insertEvent({
    id: "aaaa9001",
    title: "Active Stale Event",
    day,
    location: "Loc A",
    timeString: "Time A",
    description: "Desc A",
    contentHash: "dbl-hash-1",
    isDeleted: 0,
  });
  insertEvent({
    id: "aaaa9002",
    title: "Already Deleted Event",
    day,
    location: "Loc B",
    timeString: "Time B",
    description: "Desc B",
    contentHash: "dbl-hash-2",
    isDeleted: 1,
  });

  const routes = new Map<string, string>();
  routes.set(`${BASE_URL}/events/view_by_day?day=${dayParam}`, dayListingHtml(day, []));

  const result = await withRuntimeEnv({ DB: sharedFakeD1 }, () =>
    withMockedFetch(routes, () => runIngestion({ mode: "hard-resync", days: [dayParam] })),
  );

  // Both rows are physically wiped (nothing was re-scraped), but only the
  // still-active row counts as a fresh deletion -- the already-deleted row
  // was counted once already when it was originally soft-deleted.
  assert.strictEqual(result.deleted, 1);
  assert.deepStrictEqual(
    result.diffSummary.deletedEvents.map((e) => e.id),
    ["aaaa9001"],
  );
  assert.strictEqual(getEvent("aaaa9001"), undefined);
  assert.strictEqual(getEvent("aaaa9002"), undefined);
  assert.strictEqual(countEventChanges("aaaa9001"), 1);
  assert.strictEqual(countEventChanges("aaaa9002"), 0);
});
