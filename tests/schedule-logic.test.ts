import { test } from "node:test";
import assert from "node:assert/strict";

const expect = (val: unknown) => ({
  toBe: (expected: unknown) => assert.strictEqual(val, expected),
  toEqual: (expected: unknown) => assert.deepStrictEqual(val, expected),
});

import {
  parseVenueRoom,
  getDayEyebrow,
  getPrecedingVenue,
  checkEventConflict,
  calculateDailyWalkMinutes,
  parseSpeakers,
  type EventItem,
  type Conflict,
} from "../lib/scheduleUtils.ts";

test("parseVenueRoom parses hotel and room correctly", () => {
  expect(parseVenueRoom("Hyatt Regency - Centennial I")).toEqual({
    venue: "Hyatt Regency",
    room: "Centennial I",
  });
  expect(parseVenueRoom("Marriott Marquis: Atrium Ballroom")).toEqual({
    venue: "Marriott Marquis",
    room: "Atrium Ballroom",
  });
  expect(parseVenueRoom(null)).toEqual({ venue: "VENUE TBD" });
});

test("getDayEyebrow returns correct day subtitle", () => {
  expect(getDayEyebrow("Friday, Sep 4")).toBe("FRIDAY · DAY 2");
  expect(getDayEyebrow("Saturday, Sep 5")).toBe("SATURDAY · DAY 3");
  expect(getDayEyebrow("")).toBe("DRAGON CON '26 · ATLANTA GA");
});

test("getPrecedingVenue finds the last saved event earlier on the same day", () => {
  const current: EventItem = { id: "2", day: "Fri", startsAt: "2026-09-04T15:00:00Z", location: "Hilton" };
  const saved: EventItem[] = [
    { id: "1", day: "Fri", startsAt: "2026-09-04T13:00:00Z", location: "Hyatt" },
    { id: "3", day: "Sat", startsAt: "2026-09-05T10:00:00Z", location: "Marriott" },
  ];
  expect(getPrecedingVenue(current, saved)).toBe("Hyatt");
});

test("getPrecedingVenue finds preceding venue when event is already saved at index > 0", () => {
  const current: EventItem = { id: "2", day: "Fri", startsAt: "2026-09-04T15:00:00Z", location: "Hilton" };
  const saved: EventItem[] = [
    { id: "1", day: "Fri", startsAt: "2026-09-04T13:00:00Z", location: "Hyatt" },
    { id: "2", day: "Fri", startsAt: "2026-09-04T15:00:00Z", location: "Hilton" },
    { id: "3", day: "Sat", startsAt: "2026-09-05T10:00:00Z", location: "Marriott" },
  ];
  expect(getPrecedingVenue(current, saved)).toBe("Hyatt");
});

test("getPrecedingVenue returns null when there is no earlier saved event on the same day", () => {
  const current: EventItem = { id: "1", day: "Fri", startsAt: "2026-09-04T13:00:00Z", location: "Hyatt" };
  const saved: EventItem[] = [
    { id: "1", day: "Fri", startsAt: "2026-09-04T13:00:00Z", location: "Hyatt" },
    { id: "3", day: "Sat", startsAt: "2026-09-05T10:00:00Z", location: "Marriott" },
  ];
  expect(getPrecedingVenue(current, saved)).toBe(null);
});

test("checkEventConflict returns true when event ID matches conflict record", () => {
  const conflicts: Conflict[] = [{ event1Id: "ev-1", event2Id: "ev-2" }];
  expect(checkEventConflict("ev-1", conflicts)).toBe(true);
  expect(checkEventConflict("ev-2", conflicts)).toBe(true);
  expect(checkEventConflict("ev-3", conflicts)).toBe(false);
});

test("calculateDailyWalkMinutes sums consecutive venue walk times", () => {
  const events: EventItem[] = [
    { id: "1", location: "Hyatt Regency" },
    { id: "2", location: "Marriott Marquis" },
    { id: "3", location: "Hilton Atlanta" },
  ];
  expect(calculateDailyWalkMinutes(events)).toBe(9); // Hyatt->Marriott (4) + Marriott->Hilton (5)
});

test("parseSpeakers parses JSON array strings, comma strings, and strips legacy role prefixes and newlines", () => {
  // Raw ingested format from live Core-Apps upstream with newlines and role prefix
  const rawJsonWithRole = JSON.stringify([
    "Speaker\n                          The Blibbering Humdingers",
    "Speaker\n                          Brobdingnagian Bards",
    "Speaker\n                          Clearly Guilty",
  ]);
  expect(parseSpeakers(rawJsonWithRole)).toEqual([
    "The Blibbering Humdingers",
    "Brobdingnagian Bards",
    "Clearly Guilty",
  ]);

  // Moderator and DJ role prefixes
  expect(parseSpeakers('["Moderator\\n                          Jody Lynn Nye"]')).toEqual(["Jody Lynn Nye"]);
  expect(parseSpeakers('["DJ\\n                          Brendon Lee"]')).toEqual(["Brendon Lee"]);

  // Clean JSON array format
  expect(parseSpeakers(JSON.stringify(["Tim Griffin", "Emily Henry"]))).toEqual(["Tim Griffin", "Emily Henry"]);

  // Comma-separated strings (seed data)
  expect(parseSpeakers("Dr. Coral Vance, Maya Lindqvist")).toEqual(["Dr. Coral Vance", "Maya Lindqvist"]);

  // Null, empty, or empty JSON array
  expect(parseSpeakers(null)).toEqual([]);
  expect(parseSpeakers("")).toEqual([]);
  expect(parseSpeakers("[]")).toEqual([]);
});
