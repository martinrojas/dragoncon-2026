import { test } from "node:test";
import assert from "node:assert/strict";
import { users, ingestionRuns } from "../db/schema.ts";

test("users table has a role column, notNull with default", () => {
  assert.ok(users.role, "users.role column should be defined");
  assert.strictEqual(users.role.name, "role");
  assert.strictEqual(users.role.notNull, true);
  assert.strictEqual(users.role.hasDefault, true);
});

test("ingestionRuns table is defined with the required columns", () => {
  assert.ok(ingestionRuns, "ingestionRuns table should be defined");

  assert.strictEqual(ingestionRuns.id.name, "id");
  assert.strictEqual(ingestionRuns.id.primary, true);
  assert.strictEqual(ingestionRuns.id.autoIncrement, true);

  assert.strictEqual(ingestionRuns.userId.name, "user_id");
  assert.strictEqual(ingestionRuns.userId.notNull, true);

  assert.strictEqual(ingestionRuns.mode.name, "mode");
  assert.strictEqual(ingestionRuns.mode.notNull, true);

  assert.strictEqual(ingestionRuns.status.name, "status");
  assert.strictEqual(ingestionRuns.status.notNull, true);

  assert.strictEqual(ingestionRuns.days.name, "days");
  assert.strictEqual(ingestionRuns.days.notNull, false);

  assert.strictEqual(ingestionRuns.stats.name, "stats");
  assert.strictEqual(ingestionRuns.stats.notNull, false);

  assert.strictEqual(ingestionRuns.log.name, "log");
  assert.strictEqual(ingestionRuns.log.notNull, false);

  assert.strictEqual(ingestionRuns.errorMessage.name, "error_message");
  assert.strictEqual(ingestionRuns.errorMessage.notNull, false);

  assert.strictEqual(ingestionRuns.startedAt.name, "started_at");
  assert.strictEqual(ingestionRuns.startedAt.notNull, true);
  assert.strictEqual(ingestionRuns.startedAt.hasDefault, true);

  assert.strictEqual(ingestionRuns.completedAt.name, "completed_at");
  assert.strictEqual(ingestionRuns.completedAt.notNull, false);
});
