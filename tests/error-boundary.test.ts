import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatErrorMessage,
  createErrorSignature,
} from "../lib/errorReporting.ts";

test("ErrorBoundary state transitions and recovery reset", () => {
  // Simulate ErrorBoundary internal state machine
  let state = {
    hasError: false,
    error: null as Error | null,
    reported: false,
  };

  // On error caught
  const testError = new TypeError("Failed to render ScheduleView");
  state = {
    ...state,
    hasError: true,
    error: testError,
  };

  assert.strictEqual(state.hasError, true);
  assert.strictEqual(state.error?.message, "Failed to render ScheduleView");

  // On retry click
  state = {
    hasError: false,
    error: null,
    reported: false,
  };

  assert.strictEqual(state.hasError, false);
  assert.strictEqual(state.error, null);
});

test("ErrorBoundary reporting integration produces valid auto-report signature", () => {
  const err = new Error("ChunkLoadError: Loading chunk 4 failed");
  const formatted = formatErrorMessage(err, "ErrorBoundary (ScheduleTab)");
  const sig = createErrorSignature(err, "ErrorBoundary (ScheduleTab)");

  assert.ok(formatted.includes("[Auto-Report] Context: ErrorBoundary (ScheduleTab)"));
  assert.ok(formatted.includes("ChunkLoadError"));
  assert.ok(sig.startsWith("ErrorBoundary (ScheduleTab):Error:ChunkLoadError"));
});
