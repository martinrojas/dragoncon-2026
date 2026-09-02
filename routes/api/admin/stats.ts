import type { Context } from "hono";
import { defineHandler } from "void";
import { db, desc, eq } from "void/db";
import { adminGuard } from "../../../lib/auth.ts";
import { events, ingestionRuns, userEvents, users } from "../../../db/schema.ts";
import type { AdminUsageStats } from "../../../components/admin/adminTypes.ts";

const ET_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const ET_HOUR = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "2-digit",
  hourCycle: "h23",
});

// `added_at` is suffix-less SQLite UTC wall time; `starts_at` is full ISO with Z.
function toUtcDate(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(/Z$|[+-]\d{2}:?\d{2}$/.test(raw) ? raw : `${raw}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface UsageRow {
  userId: string;
  status: string | null;
  addedAt: string;
  day: string | null;
  track: string | null;
  location: string | null;
  startsAt: string | null;
}

export function tallyUsageStats(rows: UsageRow[], totalUsers: number): AdminUsageStats {
  const perUser = new Map<string, number>();
  const byDate = new Map<string, number>();
  const byTrack = new Map<string, number>();
  const byLocation = new Map<string, number>();
  const byDay = new Map<string, number>();
  const byPeak = new Map<string, number>();
  let goingCount = 0;
  let interestedCount = 0;

  for (const row of rows) {
    perUser.set(row.userId, (perUser.get(row.userId) ?? 0) + 1);
    if (row.status === "going") goingCount++;
    else if (row.status === "interested") interestedCount++;

    const added = toUtcDate(row.addedAt);
    if (added) {
      const key = ET_DATE.format(added);
      byDate.set(key, (byDate.get(key) ?? 0) + 1);
    }

    const track = row.track?.trim() || "Unspecified";
    byTrack.set(track, (byTrack.get(track) ?? 0) + 1);
    const location = row.location?.trim() || "Unspecified";
    byLocation.set(location, (byLocation.get(location) ?? 0) + 1);
    const day = row.day?.trim() || "Unspecified";
    byDay.set(day, (byDay.get(day) ?? 0) + 1);

    const starts = toUtcDate(row.startsAt);
    if (starts) {
      const key = `${day}|${Number(ET_HOUR.format(starts))}`;
      byPeak.set(key, (byPeak.get(key) ?? 0) + 1);
    }
  }

  const counts = [...perUser.values()].sort((a, b) => a - b);
  const usersWithSaves = counts.length;
  const median =
    usersWithSaves === 0
      ? 0
      : usersWithSaves % 2 === 1
        ? counts[(usersWithSaves - 1) / 2]
        : Math.round(((counts[usersWithSaves / 2 - 1] + counts[usersWithSaves / 2]) / 2) * 10) / 10;

  const rankName = (map: Map<string, number>, limit?: number) =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([name, count]) => ({ name, count }));

  return {
    totalSaves: rows.length,
    usersWithSaves,
    goingCount,
    interestedCount,
    medianSavesPerActiveUser: median,
    savesByDate: [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-30)
      .map(([date, count]) => ({ date, count })),
    scheduleSizeBuckets: [
      { label: "0", users: Math.max(0, totalUsers - usersWithSaves) },
      { label: "1-5", users: counts.filter((n) => n <= 5).length },
      { label: "6-20", users: counts.filter((n) => n >= 6 && n <= 20).length },
      { label: "21+", users: counts.filter((n) => n >= 21).length },
    ],
    topTracks: rankName(byTrack, 10),
    topLocations: rankName(byLocation, 10),
    savesByConDay: rankName(byDay),
    peakHours: [...byPeak.entries()]
      .map(([key, count]) => {
        const sep = key.lastIndexOf("|");
        return { day: key.slice(0, sep), hour: Number(key.slice(sep + 1)), count };
      })
      .sort((a, b) => b.count - a.count || a.day.localeCompare(b.day) || a.hour - b.hour)
      .slice(0, 8),
  };
}

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

  // ponytail: full scan of user_events, fine at ~1k rows for a ~35-user con;
  // push into GROUP BY if the table ever passes ~50k rows.
  const savedRows = await db
    .select({
      userId: userEvents.userId,
      status: userEvents.status,
      addedAt: userEvents.addedAt,
      day: events.day,
      track: events.track,
      location: events.location,
      startsAt: events.startsAt,
    })
    .from(userEvents)
    .leftJoin(events, eq(userEvents.eventId, events.id));

  const usage = tallyUsageStats(savedRows, totalUsers);

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
    stats: { totalActiveEvents, totalDeletedEvents, eventsByDay, totalUsers, usage, lastRun },
  });
});
