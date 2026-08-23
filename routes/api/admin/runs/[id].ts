import type { Context } from "hono";
import { defineHandler } from "void";
import { db, eq } from "void/db";
import { adminGuard } from "../../../../lib/auth.ts";
import { ingestionRuns } from "../../../../db/schema.ts";

export const GET = defineHandler(async (c: Context) => {
  const guard = await adminGuard(c);
  if ("errorResponse" in guard) {
    return guard.errorResponse;
  }

  const idParam = c.req.param("id");
  const id = Number(idParam);

  if (!idParam || Number.isNaN(id)) {
    return c.json({ success: false, error: "Run not found" }, 404);
  }

  const [run] = await db.select().from(ingestionRuns).where(eq(ingestionRuns.id, id));

  if (!run) {
    return c.json({ success: false, error: "Run not found" }, 404);
  }

  return c.json({ success: true, run });
});
