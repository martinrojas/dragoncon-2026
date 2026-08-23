import type { Context } from "hono";
import { defineHandler } from "void";
import { db, desc } from "void/db";
import { adminGuard } from "../../../lib/auth.ts";
import { events, ingestionRuns, users } from "../../../db/schema.ts";

export const GET = defineHandler(async (c: Context) => {
  const guard = await adminGuard(c);
  if ("errorResponse" in guard) {
    return guard.errorResponse;
  }

  const eventRows = await db.select({ isDeleted: events.isDeleted, day: events.day }).from(events);

  let totalActiveEvents = 0;
  let totalDeletedEvents = 0;
  const eventsByDay: Record<string, number> = {};

  for (const ev of eventRows) {
    if (ev.isDeleted === 0) {
      totalActiveEvents++;
      if (ev.day) {
        eventsByDay[ev.day] = (eventsByDay[ev.day] ?? 0) + 1;
      }
    } else {
      totalDeletedEvents++;
    }
  }

  const userRows = await db.select({ id: users.id }).from(users);
  const totalUsers = userRows.length;

  const [latestRun] = await db.select().from(ingestionRuns).orderBy(desc(ingestionRuns.id)).limit(1);

  let lastRun: (Omit<typeof ingestionRuns.$inferSelect, "stats"> & { stats: unknown }) | null = null;
  if (latestRun) {
    let parsedStats: unknown = null;
    if (latestRun.stats) {
      try {
        parsedStats = JSON.parse(latestRun.stats);
      } catch {
        parsedStats = null;
      }
    }
    lastRun = { ...latestRun, stats: parsedStats };
  }

  return c.json({
    success: true,
    stats: { totalActiveEvents, totalDeletedEvents, eventsByDay, totalUsers, lastRun },
  });
});
