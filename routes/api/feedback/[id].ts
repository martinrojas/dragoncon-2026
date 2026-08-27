import type { Context } from "hono";
import { defineHandler } from "void";
import { db, eq } from "void/db";
import { adminGuard } from "../../../lib/auth.ts";
import { feedback } from "../../../db/schema.ts";

const ALLOWED_STATUSES = ["new", "in_progress", "done", "archived"];

export const PATCH = defineHandler(async (c: Context) => {
  const guard = await adminGuard(c);
  if ("errorResponse" in guard) {
    return guard.errorResponse;
  }

  const id = c.req.param("id");

  if (!id) {
    return c.json({ success: false, error: "Feedback not found" }, 404);
  }
  const body = (await c.req.json().catch(() => ({}))) as { status?: string };

  if (!body.status || !ALLOWED_STATUSES.includes(body.status)) {
    return c.json(
      { success: false, error: "status must be one of new, in_progress, done, archived" },
      400,
    );
  }

  const [updated] = await db
    .update(feedback)
    .set({ status: body.status })
    .where(eq(feedback.id, id))
    .returning();

  if (!updated) {
    return c.json({ success: false, error: "Feedback not found" }, 404);
  }

  return c.json({ success: true, feedback: updated });
});
