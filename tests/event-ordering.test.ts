import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTimeDisplay } from "../lib/walktime.ts";

const expect = (val: unknown) => ({
  toBe: (expected: unknown) => assert.strictEqual(val, expected),
  toEqual: (expected: unknown) => assert.deepStrictEqual(val, expected),
});

test("parseTimeDisplay formats 12h start/end and slotLabel correctly", () => {
  expect(parseTimeDisplay("12:00 AM —  3:00 AM")).toEqual({
    start: "12:00",
    end: "3:00",
    slotLabel: "12 AM",
  });

  expect(parseTimeDisplay("1:00 AM —  2:45 AM")).toEqual({
    start: "1:00",
    end: "2:45",
    slotLabel: "1 AM",
  });

  expect(parseTimeDisplay("10:00 AM — 11:00 AM")).toEqual({
    start: "10:00",
    end: "11:00",
    slotLabel: "10 AM",
  });

  expect(parseTimeDisplay("12:00 PM —  1:00 PM")).toEqual({
    start: "12:00",
    end: "1:00",
    slotLabel: "12 PM",
  });

  expect(parseTimeDisplay("4:00 PM —  5:00 PM")).toEqual({
    start: "4:00",
    end: "5:00",
    slotLabel: "4 PM",
  });

  expect(parseTimeDisplay("11:30 PM — 12:30 AM")).toEqual({
    start: "11:30",
    end: "12:30",
    slotLabel: "11 PM",
  });
});

test("events sorted by startsAt group into chronological time rail slots", () => {
  // Simulate out-of-order Friday events ingested from scraper
  const rawFridayEvents = [
    { title: "Marvel vs DC", timeString: "4:00 PM —  5:00 PM", startsAt: "2026-09-04T20:00:00.000Z" },
    { title: "Community", timeString: "8:00 PM —  8:30 PM", startsAt: "2026-09-05T00:00:00.000Z" },
    { title: "Drum Circle", timeString: "12:00 AM —  3:00 AM", startsAt: "2026-09-04T04:00:00.000Z" },
    { title: "The Goonies", timeString: "8:00 AM — 10:00 AM", startsAt: "2026-09-04T12:00:00.000Z" },
    { title: "Open Filk", timeString: "11:30 PM —  2:00 AM", startsAt: "2026-09-05T03:30:00.000Z" },
    { title: "Baldur's Gate", timeString: "11:00 AM — 12:00 PM", startsAt: "2026-09-04T15:00:00.000Z" },
    { title: "Finn Friday", timeString: "12:00 PM —  1:00 PM", startsAt: "2026-09-04T16:00:00.000Z" },
  ];

  // Apply the same sort as filteredEvents
  const sorted = [...rawFridayEvents].sort((a, b) => {
    if (a.startsAt && b.startsAt) {
      const diff = a.startsAt.localeCompare(b.startsAt);
      if (diff !== 0) return diff;
    } else if (a.startsAt) {
      return -1;
    } else if (b.startsAt) {
      return 1;
    }
    return (a.title || "").localeCompare(b.title || "");
  });

  // Group into time rails
  const slotOrder: string[] = [];
  for (const item of sorted) {
    const { slotLabel } = parseTimeDisplay(item.timeString);
    if (!slotOrder.includes(slotLabel)) {
      slotOrder.push(slotLabel);
    }
  }

  expect(slotOrder).toEqual(["12 AM", "8 AM", "11 AM", "12 PM", "4 PM", "8 PM", "11 PM"]);
  expect(sorted[0].title).toBe("Drum Circle");
  expect(sorted[sorted.length - 1].title).toBe("Open Filk");
});
