import { test } from "node:test";
import assert from "node:assert/strict";

const expect = (val: unknown) => ({
  toBe: (expected: unknown) => assert.strictEqual(val, expected),
});

import { calculateMutualOverlap, isSelfInvite } from "../lib/squadUtils.ts";
import type { EventItem } from "../lib/scheduleUtils.ts";

test("calculateMutualOverlap filters friend events matching user saved event IDs", () => {
  const userSavedMap: Record<string, "going" | "interested"> = { "ev-1": "going", "ev-2": "interested" };
  const friendEvents: EventItem[] = [
    { id: "ev-1", title: "Cosplay Contest" },
    { id: "ev-3", title: "Anime Screening" },
  ];

  const overlap = calculateMutualOverlap(userSavedMap, friendEvents);
  assert.strictEqual(overlap.length, 1);
  expect(overlap[0].id).toBe("ev-1");
});

test("isSelfInvite identifies when invite username matches current user", () => {
  expect(isSelfInvite("CyberKnight", "cyberknight")).toBe(true);
  expect(isSelfInvite("CyberKnight", "differentUser")).toBe(false);
  expect(isSelfInvite(null, "someUser")).toBe(false);
});
