import { defineHandler, defineHead, type InferProps } from "void";
import { db, desc } from "void/db";
import { events, ingestionRuns, users } from "../db/schema.ts";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async () => {
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

  const initialRuns = await db.select().from(ingestionRuns).orderBy(desc(ingestionRuns.id)).limit(20);

  return {
    totalEvents: totalActiveEvents,
    totalActiveEvents,
    totalDeletedEvents,
    eventsByDay,
    totalUsers,
    initialRuns,
  };
});

export const head = defineHead<Props>(() => {
  return {
    title: "Admin Control Center | CyberDragon 2026",
    meta: [
      { name: "description", content: "CyberDragon 2026 Administrative Ingestion Control Dashboard" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  };
});
