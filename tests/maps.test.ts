import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveVenueMap,
  getOfficialEventUrl,
  getPolygonPointsString,
  getBoothCentroidAndBounds,
  VENUE_MAPS,
} from "../lib/maps.ts";
const expect = (val: unknown) => ({
  toBe: (expected: unknown) => assert.strictEqual(val, expected),
  toEqual: (expected: unknown) => assert.deepStrictEqual(val, expected),
  toBeNull: () => assert.strictEqual(val, null),
  toBeDefined: () => assert.ok(val !== undefined && val !== null),
  toBeGreaterThan: (expected: number) => assert.ok(typeof val === "number" && val > expected),
});

test("VENUE_MAPS contains all 11 Dragon Con 2026 places with local cached images", () => {
  expect(VENUE_MAPS.length).toBe(11);
  const slugs = VENUE_MAPS.map((m) => m.slug);
  assert.ok(slugs.includes("marriott"));
  assert.ok(slugs.includes("hyatt"));
  assert.ok(slugs.includes("hilton"));
  assert.ok(slugs.includes("westin"));
  assert.ok(slugs.includes("courtland-grand"));
  assert.ok(slugs.includes("americasmart-b2"));
  assert.ok(slugs.includes("americasmart-b3"));
  assert.ok(slugs.includes("convention-footprint"));

  // Check each venue has localPath and officialUrl
  for (const v of VENUE_MAPS) {
    expect(v.localPath).toBeDefined();
    assert.ok(v.officialUrl.startsWith("https://app.core-apps.com/dragoncon26/places/"));
  }
});

test("resolveVenueMap matches exact booths and returns coordinates", () => {
  const marriottAtrium = resolveVenueMap("Marriott Atrium Ballroom");
  expect(marriottAtrium.map.slug).toBe("marriott");
  expect(marriottAtrium.booth?.name).toBe("Marriott Atrium Ballroom");
  expect(marriottAtrium.hasCoordinates).toBe(true);
  assert.ok((marriottAtrium.booth?.coordinates?.length ?? 0) > 0);

  const hilton301 = resolveVenueMap("Hilton 301");
  expect(hilton301.map.slug).toBe("hilton");
  expect(hilton301.booth?.name).toBe("Hilton 301");
  expect(hilton301.hasCoordinates).toBe(true);

  const hyattCentennial = resolveVenueMap("Hyatt Centennial I");
  expect(hyattCentennial.map.slug).toBe("hyatt");
  expect(hyattCentennial.booth?.name).toBe("Hyatt Centennial I");
  expect(hyattCentennial.hasCoordinates).toBe(true);
});

test("resolveVenueMap handles hotel venues without specific booth polygon", () => {
  const westin = resolveVenueMap("Westin Chastain");
  expect(westin.map.slug).toBe("westin");
  expect(westin.booth).toBeNull();
  expect(westin.hasCoordinates).toBe(false);

  const courtland = resolveVenueMap("Courtland Pool");
  expect(courtland.map.slug).toBe("courtland-grand");

  const sheraton = resolveVenueMap("Sheraton Grand Ballroom");
  expect(sheraton.map.slug).toBe("courtland-grand");

  const am2 = resolveVenueMap("AmericasMart Building 2");
  expect(am2.map.slug).toBe("americasmart-b2");
});

test("resolveVenueMap falls back to convention footprint on unknown or null location", () => {
  const nullLoc = resolveVenueMap(null);
  expect(nullLoc.map.slug).toBe("convention-footprint");
  expect(nullLoc.booth).toBeNull();

  const unknownLoc = resolveVenueMap("Somewhere In Atlanta");
  expect(unknownLoc.map.slug).toBe("convention-footprint");
});

test("getOfficialEventUrl formats Core-Apps event rating deep link", () => {
  expect(getOfficialEventUrl("414d04e4a5802c1326c86f81bdc59e0c")).toBe(
    "https://app.core-apps.com/dragoncon26/event/414d04e4a5802c1326c86f81bdc59e0c"
  );
  expect(getOfficialEventUrl(null)).toBeNull();
  expect(getOfficialEventUrl("")).toBeNull();
});

test("getPolygonPointsString formats SVG coordinate points", () => {
  const coords = [
    { x: 10, y: 20 },
    { x: 30, y: 40 },
    { x: 50, y: 60 },
  ];
  expect(getPolygonPointsString(coords)).toBe("10,20 30,40 50,60");
  expect(getPolygonPointsString([])).toBe("");
  expect(getPolygonPointsString(null)).toBe("");
});

test("getBoothCentroidAndBounds computes correct centroid and bounding box", () => {
  const coords = [
    { x: 100, y: 100 },
    { x: 200, y: 100 },
    { x: 200, y: 200 },
    { x: 100, y: 200 },
  ];
  const result = getBoothCentroidAndBounds(coords);
  assert.ok(result !== null);
  expect(result.cx).toBe(150);
  expect(result.cy).toBe(150);
  expect(result.minX).toBe(100);
  expect(result.minY).toBe(100);
  expect(result.maxX).toBe(200);
  expect(result.maxY).toBe(200);
  expect(result.width).toBe(100);
  expect(result.height).toBe(100);
});
