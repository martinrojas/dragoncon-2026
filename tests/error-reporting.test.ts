import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  formatErrorMessage,
  createErrorSignature,
  reportError,
  resetErrorReportingLimits,
  type ReportErrorOptions,
} from "../lib/errorReporting.ts";

const expect = (val: any) => ({
  toBe: (expected: any) => assert.strictEqual(val, expected),
  toEqual: (expected: any) => assert.deepStrictEqual(val, expected),
  toContain: (substring: string) => assert.ok(typeof val === "string" && val.includes(substring), `Expected "${val}" to contain "${substring}"`),
  toBeLessThanOrEqual: (expected: number) => assert.ok(val <= expected),
});

beforeEach(() => {
  resetErrorReportingLimits();
});

test("formatErrorMessage formats standard Error with stack and context", () => {
  const err = new Error("Cannot read property 'foo' of undefined");
  const formatted = formatErrorMessage(err, "React ErrorBoundary (PanelCard)");
  
  expect(formatted).toContain("[Auto-Report] Context: React ErrorBoundary (PanelCard)");
  expect(formatted).toContain("Error: Cannot read property 'foo' of undefined");
  expect(formatted.length).toBeLessThanOrEqual(2000);
});

test("formatErrorMessage formats strings, objects, and null values", () => {
  expect(formatErrorMessage("Raw string crash")).toContain("Error: Raw string crash");
  expect(formatErrorMessage({ custom: "fail" })).toContain('{"custom":"fail"}');
  expect(formatErrorMessage(null)).toContain("Error: null");
  expect(formatErrorMessage(undefined)).toContain("Error: undefined");
});

test("formatErrorMessage redacts bearer tokens, jwt tokens, and sensitive keys", () => {
  const secretError = new Error("Failed auth with token: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeak and password=supersecret123");
  const formatted = formatErrorMessage(secretError);
  
  assert.ok(!formatted.includes("Bearer eyJ"), "Should redact Bearer JWT");
  assert.ok(!formatted.includes("supersecret123"), "Should redact password values");
  expect(formatted).toContain("[REDACTED]");
});

test("formatErrorMessage truncates long stack traces to fit within 2000 characters", () => {
  const hugeStack = new Error("Huge error: " + "a".repeat(3000));
  const formatted = formatErrorMessage(hugeStack);

  assert.ok(formatted.length <= 2000, `Length ${formatted.length} exceeded 2000`);
  expect(formatted).toContain("...[truncated]");
});

test("createErrorSignature creates consistent hash for same error and different for distinct errors", () => {
  const err1 = new TypeError("Failed to fetch");
  const err2 = new TypeError("Failed to fetch");
  const err3 = new RangeError("Maximum call stack size exceeded");

  const sig1 = createErrorSignature(err1, "ScheduleTab");
  const sig2 = createErrorSignature(err2, "ScheduleTab");
  const sig3 = createErrorSignature(err3, "ScheduleTab");

  expect(sig1).toBe(sig2);
  assert.notStrictEqual(sig1, sig3);
});

test("reportError successfully posts bug report to /api/feedback and respects deduplication", async () => {
  const calls: Array<{ url: string; body: Record<string, any> }> = [];

  const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(url),
      body: JSON.parse(String(init?.body || "{}")),
    });
    return {
      ok: true,
      json: async () => ({ success: true }),
    } as Response;
  }) as typeof fetch;

  const options: ReportErrorOptions = {
    context: "Render Schedule",
    appVersion: "1.0.0",
    pageUrl: "https://cyberdragon.app/",
    user: { id: "usr_123", username: "dragon_fan" },
    fetcher: fakeFetch,
  };

  const err = new Error("Schedule render failed");

  // First call should report
  const firstResult = await reportError(err, options);
  expect(firstResult).toBe(true);
  expect(calls.length).toBe(1);
  expect(calls[0].url).toBe("/api/feedback");
  expect(calls[0].body.kind).toBe("bug");
  expect(calls[0].body.userId).toBe("usr_123");
  expect(calls[0].body.username).toBe("dragon_fan");
  expect(calls[0].body.appVersion).toBe("1.0.0");
  expect(calls[0].body.contact).toBe("Automated Error Report");
  expect(calls[0].body.message).toContain("Schedule render failed");

  // Immediate duplicate call should be skipped by deduplication
  const duplicateResult = await reportError(err, options);
  expect(duplicateResult).toBe(false);
  expect(calls.length).toBe(1);
});

test("reportError rate limits total error reports per session to MAX_ERRORS_PER_SESSION (3)", async () => {
  let callCount = 0;
  const fakeFetch = (async () => {
    callCount++;
    return {
      ok: true,
      json: async () => ({ success: true }),
    } as Response;
  }) as typeof fetch;

  const opts: ReportErrorOptions = { fetcher: fakeFetch };

  const res1 = await reportError(new Error("Err 1"), opts);
  const res2 = await reportError(new Error("Err 2"), opts);
  const res3 = await reportError(new Error("Err 3"), opts);
  const res4 = await reportError(new Error("Err 4"), opts); // Should be rate limited

  expect(res1).toBe(true);
  expect(res2).toBe(true);
  expect(res3).toBe(true);
  expect(res4).toBe(false);
  expect(callCount).toBe(3);

  // Force flag bypasses rate limit
  const resForce = await reportError(new Error("Err 4"), { ...opts, force: true });
  expect(resForce).toBe(true);
  expect(callCount).toBe(4);
});

test("reportError handles network failure gracefully without throwing", async () => {
  const failingFetch = (async () => {
    throw new Error("Network offline");
  }) as typeof fetch;

  const result = await reportError(new Error("App crashed"), { fetcher: failingFetch });
  expect(result).toBe(false);
});
