import { test } from "node:test";
import assert from "node:assert/strict";
import { shareLink, copyText } from "../lib/share.ts";

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

test("copyText writes to the clipboard and reports success", async () => {
  let copied = "";
  setNavigator({
    share: async () => {
      throw new Error("copyText must never open a share sheet");
    },
    clipboard: {
      writeText: async (text: string) => {
        copied = text;
      },
    },
  });

  assert.strictEqual(await copyText("[DAY SUMMARY] 769 detail fetches"), true);
  assert.strictEqual(copied, "[DAY SUMMARY] 769 detail fetches");
});

test("copyText returns false when the clipboard API is unavailable", async () => {
  setNavigator({ share: async () => {} });
  assert.strictEqual(await copyText("log"), false);

  setNavigator({ clipboard: {} });
  assert.strictEqual(await copyText("log"), false);
});

test("copyText returns false when the clipboard write is rejected", async () => {
  setNavigator({
    clipboard: {
      writeText: async () => {
        throw new Error("NotAllowedError: insecure context");
      },
    },
  });

  assert.strictEqual(await copyText("log"), false);
});
