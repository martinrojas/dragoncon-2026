import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { withRuntimeEnv } from "void/_env";
import { computeContentHash, DEFAULT_DETAIL_FETCH_BUDGET, runIngestion } from "../lib/ingest.ts";

const BASE_URL = "https://app.core-apps.com/dragoncon26";

/**
 * `runIngestion` reads/writes the D1 binding via `void/db`'s runtime env
 * proxy, whose default `db` export caches its drizzle instance on first
 * property access and ignores whichever `DB` binding a later
 * `withRuntimeEnv` call supplies (see tests/make-admin.test.ts). All tests
 * that exercise the database path therefore share one fake D1 binding, and
 * use disjoint event ids / day names per scenario to avoid collisions.
 */
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

/**
 * Forces the fake D1 binding's `run()` to throw for exactly one write whose
 * bound parameters include `failingParam`, then restores normal behavior.
 */
function withFailingWrite<T>(
  sqlite: FakeD1Binding,
  failingParam: string,
  fn: () => Promise<T>,
): Promise<T> {
  const originalPrepare = sqlite.prepare;
  sqlite.prepare = ((sqlText: string) => {
    const stmt = originalPrepare(sqlText);
    return {
      bind(...params: unknown[]) {
        const bound = stmt.bind(...params);
        if (params.includes(failingParam)) {
          return {
            ...bound,
            run() {
              throw new Error(`simulated write failure for ${failingParam}`);
            },
          };
        }
        return bound;
      },
    };
  }) as typeof sqlite.prepare;

  return fn().finally(() => {
    sqlite.prepare = originalPrepare;
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

test("hard-resync mode wipes only the events it successfully re-parsed and re-inserts them fresh", async () => {
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
  // Only cccc1111 was re-scraped and re-parsed this run, so only it gets
  // wiped and recreated. cccc2222 never appeared in this run's listing at
  // all, so it is left untouched rather than being deleted outright.
  assert.strictEqual(result.deleted, 1);
  assert.strictEqual(result.created, 2);
  assert.strictEqual(result.updated, 0);

  assert.deepStrictEqual(result.diffSummary.deletedEvents.map((e) => e.id), ["cccc1111"]);
  assert.deepStrictEqual(new Set(result.diffSummary.createdEvents.map((e) => e.id)), new Set(["cccc1111", "cccc3333"]));

  // cccc2222 was never re-parsed this run, so it survives unchanged.
  const untouched = getEvent("cccc2222");
  assert.strictEqual(untouched?.title, "Stale Title 2");
  assert.strictEqual(untouched?.content_hash, "stale-hash-2");

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

test("hard-resync skips the wipe entirely when nothing was successfully parsed", async () => {
  const day = "EmptyParseDay";
  const dayParam = "emptyparseday";

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

  // Nothing was scraped/parsed this run, so the wipe must be skipped
  // entirely rather than deleting rows with no replacement data.
  assert.strictEqual(result.deleted, 0);
  assert.deepStrictEqual(result.diffSummary.deletedEvents, []);
  assert.ok(getEvent("aaaa9001"));
  assert.ok(getEvent("aaaa9002"));
  assert.strictEqual(countEventChanges("aaaa9001"), 0);
  assert.strictEqual(countEventChanges("aaaa9002"), 0);
});

test("hard-resync deletion counter excludes rows that were already soft-deleted", async () => {
  const day = "DoubleCountDay";
  const dayParam = "doublecountday";

  insertEvent({
    id: "bbbb9001",
    title: "Active Stale Event",
    day,
    location: "Loc A",
    timeString: "Time A",
    description: "Desc A",
    contentHash: "dbl-hash-1",
    isDeleted: 0,
  });
  insertEvent({
    id: "bbbb9002",
    title: "Already Deleted Event",
    day,
    location: "Loc B",
    timeString: "Time B",
    description: "Desc B",
    contentHash: "dbl-hash-2",
    isDeleted: 1,
  });

  const routes = new Map<string, string>();
  routes.set(
    `${BASE_URL}/events/view_by_day?day=${dayParam}`,
    dayListingHtml(day, [
      { id: "bbbb9001", title: "Active Stale Event", timeStr: "Time A" },
      { id: "bbbb9002", title: "Already Deleted Event", timeStr: "Time B" },
    ]),
  );
  routes.set(`${BASE_URL}/event/bbbb9001`, detailHtml({ location: "Loc A", description: "Desc A" }));
  routes.set(`${BASE_URL}/event/bbbb9002`, detailHtml({ location: "Loc B", description: "Desc B" }));

  const result = await withRuntimeEnv({ DB: sharedFakeD1 }, () =>
    withMockedFetch(routes, () => runIngestion({ mode: "hard-resync", days: [dayParam] })),
  );

  // Both rows are re-parsed and physically wiped+recreated, but only the
  // still-active row counts as a fresh deletion -- the already-deleted row
  // was counted once already when it was originally soft-deleted.
  assert.strictEqual(result.deleted, 1);
  assert.deepStrictEqual(
    result.diffSummary.deletedEvents.map((e) => e.id),
    ["bbbb9001"],
  );
  assert.strictEqual(countEventChanges("bbbb9001"), 2);
  assert.strictEqual(countEventChanges("bbbb9002"), 1);
});

// ---------------------------------------------------------------------------
// Fix Round 2: per-event write isolation, migrated content hash persistence,
// and hard-resync wipe guarded by successfully parsed items
// ---------------------------------------------------------------------------

test("sync mode isolates a per-event write failure so remaining events still get processed", async () => {
  const day = "WriteErrorDay";
  const dayParam = "writeerrorday";

  const routes = new Map<string, string>();
  routes.set(
    `${BASE_URL}/events/view_by_day?day=${dayParam}`,
    dayListingHtml(day, [
      { id: "eeee1001", title: "Failing Event", timeStr: "Time A" },
      { id: "eeee1002", title: "Healthy Event", timeStr: "Time B" },
    ]),
  );
  routes.set(`${BASE_URL}/event/eeee1001`, detailHtml({ location: "Loc 1", description: "Desc 1" }));
  routes.set(`${BASE_URL}/event/eeee1002`, detailHtml({ location: "Loc 2", description: "Desc 2" }));

  const result = await withRuntimeEnv({ DB: sharedFakeD1 }, () =>
    withFailingWrite(sharedFakeD1, "eeee1001", () =>
      withMockedFetch(routes, () => runIngestion({ mode: "sync", days: [dayParam] })),
    ),
  );

  assert.strictEqual(result.errors, 1);
  assert.ok(result.log.some((line) => line.includes("eeee1001")));

  // The failing event's insert threw and was never committed...
  assert.strictEqual(getEvent("eeee1001"), undefined);
  // ...but the event after it in the parsed list was still written.
  const healthy = getEvent("eeee1002");
  assert.strictEqual(healthy?.title, "Healthy Event");
});

test("sync mode persists a migrated content hash even when no visible fields changed", async () => {
  const day = "HashMigrationDay";
  const dayParam = "hashmigrationday";

  insertEvent({
    id: "aaaa9101",
    title: "Migration Panel",
    day,
    location: "Room 9",
    timeString: "Time Z",
    description: "Desc Z",
    track: "",
    speakers: JSON.stringify([]),
    // Stands in for a hash computed under a since-changed hashing scheme --
    // every other field below matches the freshly scraped content exactly.
    contentHash: "legacy-hash-format",
  });

  const routes = new Map<string, string>();
  routes.set(
    `${BASE_URL}/events/view_by_day?day=${dayParam}`,
    dayListingHtml(day, [{ id: "aaaa9101", title: "Migration Panel", timeStr: "Time Z" }]),
  );
  routes.set(`${BASE_URL}/event/aaaa9101`, detailHtml({ location: "Room 9", description: "Desc Z" }));

  const result = await withRuntimeEnv({ DB: sharedFakeD1 }, () =>
    withMockedFetch(routes, () => runIngestion({ mode: "sync", days: [dayParam] })),
  );

  // No visible field differs, so this must not be reported as an update...
  assert.strictEqual(result.updated, 0);
  assert.deepStrictEqual(result.diffSummary.updatedEvents, []);
  assert.strictEqual(countEventChanges("aaaa9101"), 0);

  // ...but the freshly computed content hash must still be persisted so this
  // event stops being flagged as changed on every subsequent sync.
  const expectedHash = await computeContentHash("Migration Panel", "Room 9", "Time Z", "Desc Z");
  const updated = getEvent("aaaa9101");
  assert.strictEqual(updated?.content_hash, expectedHash);
});

// ---------------------------------------------------------------------------
// Fix Round 3: shared per-invocation detail-fetch budget (Cloudflare
// Workers subrequest limit safety)
// ---------------------------------------------------------------------------

test("sync mode shares the detail-fetch budget across days instead of resetting it per day", async () => {
  const dayA = "BudgetDayA";
  const dayAParam = "budgetdaya";
  const dayB = "BudgetDayB";
  const dayBParam = "budgetdayb";

  const routes = new Map<string, string>();
  routes.set(
    `${BASE_URL}/events/view_by_day?day=${dayAParam}`,
    dayListingHtml(dayA, [
      { id: "bbbb1001", title: "Day A Event 1", timeStr: "Time A1" },
      { id: "bbbb1002", title: "Day A Event 2", timeStr: "Time A2" },
    ]),
  );
  routes.set(`${BASE_URL}/event/bbbb1001`, detailHtml({ location: "Loc A1", description: "Desc A1" }));
  routes.set(`${BASE_URL}/event/bbbb1002`, detailHtml({ location: "Loc A2", description: "Desc A2" }));

  routes.set(
    `${BASE_URL}/events/view_by_day?day=${dayBParam}`,
    dayListingHtml(dayB, [
      { id: "bbbb2001", title: "Day B Event 1", timeStr: "Time B1" },
      { id: "bbbb2002", title: "Day B Event 2 (over budget)", timeStr: "Time B2" },
    ]),
  );
  routes.set(`${BASE_URL}/event/bbbb2001`, detailHtml({ location: "Loc B1", description: "Desc B1" }));
  // bbbb2002 has no mapped detail route on purpose: a shared budget of 3
  // (2 spent on day A, 1 left for day B) must never reach it.

  const result = await withRuntimeEnv({ DB: sharedFakeD1 }, () =>
    withMockedFetch(routes, () =>
      runIngestion({ mode: "sync", days: [dayAParam, dayBParam], maxDetailFetches: 3 }),
    ),
  );

  assert.strictEqual(result.totalScraped, 3);
  assert.strictEqual(result.created, 3);
  assert.strictEqual(getEvent("bbbb2002"), undefined);
});

test("sync mode applies a safe default detail-fetch budget when maxDetailFetches is omitted", async () => {
  const day = "DefaultBudgetDay";
  const dayParam = "defaultbudgetday";
  const items = Array.from({ length: DEFAULT_DETAIL_FETCH_BUDGET + 25 }, (_, i) => ({
    id: `cccc${String(i).padStart(8, "0")}`,
    title: `Event ${i}`,
    timeStr: `Time ${i}`,
  }));

  const routes = new Map<string, string>();
  routes.set(`${BASE_URL}/events/view_by_day?day=${dayParam}`, dayListingHtml(day, items));
  // No detail routes mapped for any of them -- every detail fetch 404s and
  // is skipped. This test only cares how many were attempted.

  const result = await withRuntimeEnv({ DB: sharedFakeD1 }, () =>
    withMockedFetch(routes, () => runIngestion({ mode: "dry-run", days: [dayParam] })),
  );

  assert.strictEqual(result.totalScraped, DEFAULT_DETAIL_FETCH_BUDGET);
  assert.strictEqual(result.created, 0);
});
// ---------------------------------------------------------------------------
// Fix Round 2: full-day ingestion must stay far below per-invocation
// subrequest ceilings (D1 statements + HTTP detail fetches), so a single
// big day can complete inside one Worker invocation.
// ---------------------------------------------------------------------------

test("full-day ingestion of 120 fresh events keeps D1 statement count low", async () => {
  const day = "OpBudgetDay";
  const dayParam = "opbudgetday";
  const items = Array.from({ length: 120 }, (_, i) => ({
    id: `dddd${String(i).padStart(8, "0")}`,
    title: `Fresh Event ${i}`,
    timeStr: `Time ${i}`,
  }));

  const routes = new Map<string, string>();
  routes.set(`${BASE_URL}/events/view_by_day?day=${dayParam}`, dayListingHtml(day, items));
  for (const item of items) {
    routes.set(
      `${BASE_URL}/event/${item.id}`,
      detailHtml({ location: `Loc ${item.id}`, description: `Desc ${item.id}` }),
    );
  }

  let dbStatements = 0;
  const originalPrepare = sharedFakeD1.prepare;
  sharedFakeD1.prepare = ((sqlText: string) => {
    dbStatements++;
    return originalPrepare(sqlText);
  }) as typeof sharedFakeD1.prepare;

  try {
    const result = await withRuntimeEnv({ DB: sharedFakeD1 }, () =>
      withMockedFetch(routes, () => runIngestion({ mode: "sync", days: [dayParam] })),
    );

    assert.strictEqual(result.totalScraped, 120);
    assert.strictEqual(result.created, 120);
    // Batched reads/writes: chunked IN lookups + multi-row inserts must keep
    // total D1 statements in the low dozens, not one-to-three per event.
    assert.ok(dbStatements < 200, `expected <200 D1 statements, got ${dbStatements}`);
  } finally {
    sharedFakeD1.prepare = originalPrepare;
  }
});
