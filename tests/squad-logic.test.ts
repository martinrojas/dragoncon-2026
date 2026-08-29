import { test } from "node:test";
import assert from "node:assert/strict";

const expect = (val: unknown) => ({
  toBe: (expected: unknown) => assert.strictEqual(val, expected),
});

import { calculateMutualOverlap, isSelfInvite, cleanUrlParam } from "../lib/squadUtils.ts";
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

function setWindow(value: unknown) {
  Object.defineProperty(globalThis, "window", {
    value,
    configurable: true,
    writable: true,
  });
}

test("cleanUrlParam strips the target param and preserves the rest of the URL when window is defined", () => {
  let replacedUrl: string | null = null;
  setWindow({
    location: { href: "https://con.app/schedule?invite=abc123&day=Friday#panel" },
    history: {
      replaceState: (_state: unknown, _title: string, url: string) => {
        replacedUrl = url;
      },
    },
  });

  cleanUrlParam("invite");

  expect(replacedUrl).toBe("/schedule?day=Friday#panel");

  Reflect.deleteProperty(globalThis, "window");
});

test("cleanUrlParam is a no-op when window is undefined (SSR)", () => {
  Reflect.deleteProperty(globalThis, "window");
  assert.doesNotThrow(() => cleanUrlParam("invite"));
});
