import { defineHandler, defineHead, type InferProps } from "void";
import { asc, db, desc, eq } from "void/db";
import { eventChanges, events } from "../db/schema";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async () => {
  const allEvents = await db
    .select()
    .from(events)
    .where(eq(events.isDeleted, 0))
    .orderBy(asc(events.startsAt), asc(events.title));

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
    if (match) return parseInt(match[0], 10);
    const lower = d.toLowerCase();
    if (lower.includes("wed")) return 2;
    if (lower.includes("thu")) return 3;
    if (lower.includes("fri")) return 4;
    if (lower.includes("sat")) return 5;
    if (lower.includes("sun")) return 6;
    if (lower.includes("mon")) return 7;
    if (lower.includes("tue")) return 8;
    return 99;
  };

  const sortedDays = Array.from(daysSet).sort((a, b) => parseDayWeight(a) - parseDayWeight(b));

  return {
    totalEvents: allEvents.length,
    // ponytail: ships whole table (~94KB gz at 421 rows); move to per-day SSR queries if the con schedule approaches ~3k events
    initialEvents: allEvents,
    tracks: Array.from(tracksSet).sort(),
    days: sortedDays,
    locations: Array.from(locationsSet).sort(),
    recentChanges,
  };
});

export const head = defineHead<Props>(() => {
  return {
    title: "CyberDragon | Dragon Con 2026",
    meta: [
      { name: "description", content: "Offline-first companion app for Dragon Con 2026 — schedule browsing, hotel walk times, friend sync, and live schedule changes. Sep 3–7, 2026 · Atlanta, GA." },
    ],
  };
});
