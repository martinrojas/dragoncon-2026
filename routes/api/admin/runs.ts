import type { Context } from "hono";
import { defineHandler } from "void";
import { db, desc } from "void/db";
import { adminGuard } from "../../../lib/auth.ts";
import { ingestionRuns } from "../../../db/schema.ts";

export const GET = defineHandler(async (c: Context) => {
  const guard = await adminGuard(c);
  if ("errorResponse" in guard) {
    return guard.errorResponse;
  }

  const runs = await db.select().from(ingestionRuns).orderBy(desc(ingestionRuns.id)).limit(50);

  return c.json({ success: true, runs });
});
