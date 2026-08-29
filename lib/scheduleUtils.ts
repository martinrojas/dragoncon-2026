import { calculateWalkTime } from "./walktime.ts";
import type { EventItem as HomeEventItem, Conflict as HomeConflict } from "../components/home/homeTypes.ts";

// Narrow slices of the canonical home types — these pure functions only
// touch a handful of fields, so callers can pass either the full
// `components/home/homeTypes.ts` shape or a minimal test fixture.
export type EventItem = Pick<HomeEventItem, "id" | "location" | "day" | "startsAt">;
export type Conflict = Pick<HomeConflict, "event1Id" | "event2Id">;

export function parseVenueRoom(locationStr: string | null | undefined): {
  venue: string;
  room?: string;
} {
  if (!locationStr) return { venue: "VENUE TBD" };
  const parts = locationStr.split(/ - | – | — |: /);
  if (parts.length > 1) {
    return {
      venue: parts[0].trim(),
      room: parts.slice(1).join(" ").trim(),
    };
  }
  return { venue: locationStr.trim() };
}

export function getDayEyebrow(dayStr: string): string {
  if (!dayStr) return "DRAGON CON '26 · ATLANTA GA";
  const upper = dayStr.toUpperCase();
  if (upper.includes("THU") || upper.includes("SEP 3")) return "THURSDAY · DAY 1";
  if (upper.includes("FRI") || upper.includes("SEP 4")) return "FRIDAY · DAY 2";
  if (upper.includes("SAT") || upper.includes("SEP 5")) return "SATURDAY · DAY 3";
  if (upper.includes("SUN") || upper.includes("SEP 6")) return "SUNDAY · DAY 4";
  if (upper.includes("MON") || upper.includes("SEP 7")) return "MONDAY · DAY 5";
  return dayStr.toUpperCase();
}

export function getPrecedingVenue(
  currentEvent: EventItem,
  savedEvents: EventItem[],
): string | null {
  const daySaved = savedEvents
    .filter((ev) => ev.day === currentEvent.day)
    .sort((a, b) => (a.startsAt || "").localeCompare(b.startsAt || ""));

  const idx = daySaved.findIndex((ev) => ev.id === currentEvent.id);
  if (idx > 0) {
    return daySaved[idx - 1].location ?? null;
  }
  if (idx === -1 && daySaved.length > 0 && currentEvent.startsAt) {
    const prior = daySaved.filter((ev) => (ev.startsAt || "") < (currentEvent.startsAt || ""));
    if (prior.length > 0) {
      return prior[prior.length - 1].location ?? null;
    }
  }
  return null;
}

export function checkEventConflict(eventId: string, conflicts: Conflict[]): boolean {
  return conflicts.some((c) => c.event1Id === eventId || c.event2Id === eventId);
}

export function calculateDailyWalkMinutes(events: EventItem[]): number {
  let total = 0;
  for (let i = 1; i < events.length; i++) {
    const prev = events[i - 1];
    const curr = events[i];
    const walk = calculateWalkTime(prev.location, curr.location);
    total += walk.minutes;
  }
  return total;
}
