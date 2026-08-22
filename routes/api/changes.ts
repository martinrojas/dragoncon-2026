import type { Context } from "hono";
import { db, desc } from "void/db";
import { eventChanges } from "../../db/schema";

export async function GET(c: Context) {
  const limitParam = c.req.query("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 50;

  const changes = await db
    .select()
    .from(eventChanges)
    .orderBy(desc(eventChanges.id))
    .limit(limit);

  return c.json({
    success: true,
    count: changes.length,
    changes,
  });
}
