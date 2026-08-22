import { test, expect } from "bun:test";
import { calculateWalkTime, getVenueCapacityStatus, normalizeVenue, CORE_VENUES } from "../lib/walktime";

test("calculateWalkTime between Hyatt and Marriott", () => {
  const result = calculateWalkTime("Hyatt Regency Atlanta - Centennial I", "Marriott Marquis - Atrium Ballroom");
  expect(result.minutes).toBe(4);
  expect(result.path).toBe("Hyatt → Marriott");
});

test("calculateWalkTime same venue returns 0", () => {
  const result = calculateWalkTime("Hyatt Regency - Imperial", "Hyatt Regency - Centennial II");
  expect(result.minutes).toBe(0);
  expect(result.path).toBe("Same venue");
});

test("calculateWalkTime unknown venue defaults to 8", () => {
  const result = calculateWalkTime("Unknown Hotel", "Westin");
  expect(result.minutes).toBe(8);
  expect(result.path).toBe("Con Floor Walk");
});

test("calculateWalkTime null or undefined venue defaults to 8", () => {
  const result1 = calculateWalkTime(null, "Westin");
  expect(result1.minutes).toBe(8);
  expect(result1.path).toBe("Con Floor Walk");

  const result2 = calculateWalkTime("Hyatt", undefined);
  expect(result2.minutes).toBe(8);
  expect(result2.path).toBe("Con Floor Walk");
});

test("normalizeVenue handles core host venues and aliases", () => {
  expect(normalizeVenue("Hyatt Regency Atlanta")).toBe("HYATT");
  expect(normalizeVenue("Marriott Marquis - Atrium")).toBe("MARRIOTT");
  expect(normalizeVenue("Hilton Atlanta - Grand Salon")).toBe("HILTON");
  expect(normalizeVenue("Sheraton Atlanta")).toBe("SHERATON");
  expect(normalizeVenue("Courtland Grand - Grand Ballroom")).toBe("SHERATON");
  expect(normalizeVenue("Westin Peachtree Plaza")).toBe("WESTIN");
  expect(normalizeVenue("AmericasMart Building 1")).toBe("AMERICASMART");
  expect(normalizeVenue("Building 2 - Mart")).toBe("AMERICASMART");
  expect(normalizeVenue("Random Location")).toBeNull();
  expect(normalizeVenue(null)).toBeNull();
  expect(normalizeVenue(undefined)).toBeNull();
});

test("CORE_VENUES contains all 6 core host venues", () => {
  expect(CORE_VENUES).toEqual(["HYATT", "MARRIOTT", "HILTON", "SHERATON", "WESTIN", "AMERICASMART"]);
});

test("getVenueCapacityStatus returns heuristic capacity within 45-94% and correct status", () => {
  const res = getVenueCapacityStatus("02:30 PM", "Marriott Marquis");
  expect(res.pct).toBeGreaterThanOrEqual(45);
  expect(res.pct).toBeLessThanOrEqual(94);
  expect(typeof res.status).toBe("string");
  expect(typeof res.accent).toBe("string");

  if (res.pct > 85) {
    expect(res.status).toBe("Line forming at door");
    expect(res.accent).toBe("var(--coral-500)");
  } else if (res.pct > 70) {
    expect(res.status).toBe("Filling up");
    expect(res.accent).toBe("var(--gold-500)");
  } else {
    expect(res.status).toBe("Seating available");
    expect(res.accent).toBe("var(--jade-500)");
  }
});

test("getVenueCapacityStatus handles null timeString and venue gracefully", () => {
  const res = getVenueCapacityStatus(null, null);
  expect(res.pct).toBeGreaterThanOrEqual(45);
  expect(res.pct).toBeLessThanOrEqual(94);
  expect(typeof res.status).toBe("string");
  expect(typeof res.accent).toBe("string");
});
