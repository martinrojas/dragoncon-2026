import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import type { Context } from "hono";
import { withRuntimeEnv } from "void/_env";
import { GET as eventsGET } from "../routes/api/events.ts";

/**
 * `/api/events` reads its D1 binding through `void/db`'s runtime env proxy, so
 * these tests wire a minimal in-memory SQLite-backed fake binding through
 * `withRuntimeEnv` (same shape as tests/admin-api.test.ts).
 */
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
    change_type TEXT NOT NULL,
    field TEXT,
    old_value TEXT,
    new_value TEXT,
    detected_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const fakeD1 = {
  prepare(sqlText: string) {
    const stmt = sqliteDb.prepare(sqlText);
    return {
      bind(...params: unknown[]) {
        return {
          raw: () => stmt.all(...(params as never[])).map((row) => Object.values(row as object)),
          all: () => ({ results: stmt.all(...(params as never[])) }),
          run: () => {
            const info = stmt.run(...(params as never[]));
            return { success: true, meta: { changes: info.changes, last_row_id: Number(info.lastInsertRowid) } };
          },
        };
      },
    };
  },
};

function insertEvent(id: string, track: string, startsAt: string) {
  sqliteDb
    .prepare(
      "INSERT INTO events (id, title, track, day, starts_at, content_hash) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(id, id, track, "Saturday", startsAt, `hash-${id}`);
}

insertEvent("ev-anime", "Anime", "2026-09-05T14:00:00.000Z");
insertEvent("ev-horror", "Horror", "2026-09-05T15:00:00.000Z");
insertEvent("ev-trek", "Star Trek", "2026-09-05T16:00:00.000Z");
insertEvent("ev-comma", "Sci-Fi, Fantasy", "2026-09-05T17:00:00.000Z");

function createContext(query: Record<string, string | string[]> = {}): Context {
  return {
    req: {
      query: (name: string) => {
        const value = query[name];
        return Array.isArray(value) ? value[0] : value;
      },
      queries: (name: string) => {
        const value = query[name];
        if (value === undefined) return undefined;
        return Array.isArray(value) ? value : [value];
      },
    },
    json: (body: unknown, status?: number) => new Response(JSON.stringify(body), { status: status ?? 200 }),
  } as unknown as Context;
}

async function fetchEvents(query: Record<string, string | string[]> = {}) {
  return await withRuntimeEnv({ DB: fakeD1 }, async () => {
    const res = (await eventsGET(createContext(query))) as Response;
    assert.strictEqual(res.status, 200);
    return (await res.json()) as {
      count: number;
      events: { id: string; track: string | null }[];
      facets: { tracks: string[] };
    };
  });
}

test("no excludeTracks returns every event", async () => {
  const body = await fetchEvents();
  assert.deepStrictEqual(
    body.events.map((ev) => ev.id).sort(),
    ["ev-anime", "ev-comma", "ev-horror", "ev-trek"],
  );
});

test("excludeTracks hides only the named tracks and keeps the rest", async () => {
  const body = await fetchEvents({ excludeTracks: ["Anime", "Horror"] });
  assert.deepStrictEqual(body.events.map((ev) => ev.id), ["ev-trek", "ev-comma"]);
  assert.strictEqual(body.count, 2);
});

test("excluded tracks stay in facets.tracks so they can be un-excluded", async () => {
  const body = await fetchEvents({ excludeTracks: ["Anime"] });
  assert.ok(body.facets.tracks.includes("Anime"));
  assert.ok(!body.events.some((ev) => ev.track === "Anime"));
});

test("track names containing a comma are excluded intact", async () => {
  const body = await fetchEvents({ excludeTracks: ["Sci-Fi, Fantasy"] });
  assert.ok(!body.events.some((ev) => ev.id === "ev-comma"));
  assert.strictEqual(body.count, 3);
});

test("empty excludeTracks values are ignored", async () => {
  const body = await fetchEvents({ excludeTracks: [""] });
  assert.strictEqual(body.count, 4);
});
