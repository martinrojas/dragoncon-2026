import { defineHandler, type InferProps } from "void";
import { db, desc, eq } from "void/db";
import { eventChanges, events } from "../db/schema";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async () => {
  const allEvents = await db
    .select()
    .from(events)
    .where(eq(events.isDeleted, 0));

  const recentChanges = await db
    .select()
    .from(eventChanges)
    .orderBy(desc(eventChanges.id))
    .limit(20);

  const tracksSet = new Set<string>();
  const daysSet = new Set<string>();
  const locationsSet = new Set<string>();

  for (const ev of allEvents) {
    if (ev.track) tracksSet.add(ev.track);
    if (ev.day) daysSet.add(ev.day);
    if (ev.location) locationsSet.add(ev.location);
  }
  const parseDayWeight = (d: string) => {
    const match = d.match(/\d+/);
    return match ? parseInt(match[0], 10) : 99;
  };

  const sortedDays = Array.from(daysSet).sort((a, b) => parseDayWeight(a) - parseDayWeight(b));

  return {
    totalEvents: allEvents.length,
    initialEvents: allEvents.slice(0, 100),
    tracks: Array.from(tracksSet).sort(),
    days: sortedDays,
    locations: Array.from(locationsSet).sort(),
    recentChanges,
  };
});
