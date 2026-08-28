import { test } from "node:test";
import assert from "node:assert/strict";
import { shareLink } from "../lib/share.ts";

function setNavigator(value: unknown) {
  Object.defineProperty(globalThis, "navigator", {
    value,
    configurable: true,
    writable: true,
  });
}

test("shareLink uses navigator.share when available", async () => {
  let sharedPayload: unknown = null;
  setNavigator({
    share: async (data: unknown) => {
      sharedPayload = data;
    },
  });

  const res = await shareLink({ title: "Panel", url: "https://con.app/?event=1" });
  assert.deepStrictEqual(res, { shared: true, copied: false });
  assert.deepStrictEqual(sharedPayload, { title: "Panel", url: "https://con.app/?event=1" });
});

test("shareLink falls back to clipboard when navigator.share is unavailable", async () => {
  let copiedText = "";
  setNavigator({
    share: undefined,
    clipboard: {
      writeText: async (text: string) => {
        copiedText = text;
      },
    },
  });

  const res = await shareLink({ title: "Panel", url: "https://con.app/?event=2" });
  assert.deepStrictEqual(res, { shared: false, copied: true });
  assert.strictEqual(copiedText, "https://con.app/?event=2");
});

test("shareLink returns { shared: false, copied: false } on user abort", async () => {
  setNavigator({
    share: async () => {
      const err = new Error("Abort");
      err.name = "AbortError";
      throw err;
    },
  });

  const res = await shareLink({ title: "Panel", url: "https://con.app/?event=3" });
  assert.deepStrictEqual(res, { shared: false, copied: false });
});
