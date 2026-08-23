import type { Context } from "hono";
import { defineHandler } from "void";
import { db, eq, like, or, sql } from "void/db";
import { eventChanges, events } from "../../db/schema";

export const GET = defineHandler(async (c: Context) => {
  const id = c.req.query("id");
  const search = c.req.query("search")?.trim();
  const day = c.req.query("day");
  const track = c.req.query("track");
  const location = c.req.query("location");
  const onlyChanged = c.req.query("onlyChanged") === "true";

  if (id) {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    if (!event) {
      return c.json({ success: false, error: "Event not found" }, 404);
    }
    const changes = await db
      .select()
      .from(eventChanges)
      .where(eq(eventChanges.eventId, id));
    return c.json({ success: true, event, changes });
  }

  const query = db.select().from(events);
  const conditions = [eq(events.isDeleted, 0)];

  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        like(events.title, pattern),
        like(events.description, pattern),
        like(events.location, pattern),
        like(events.track, pattern),
      )!,
    );
  }

  if (day) {
    const tokens = day.replace(/,/g, " ").replace(/\s+/g, " ").trim().split(" ");
    for (const token of tokens) {
      if (token.length > 0) {
        conditions.push(like(events.day, `%${token}%`));
      }
    }
  }

  if (track) {
    conditions.push(eq(events.track, track));
  }

  if (location) {
    conditions.push(like(events.location, `%${location}%`));
  }

  let allEvents = await query.where(sql.join(conditions, sql` AND `));

  if (onlyChanged) {
    const changesList = await db.select({ eventId: eventChanges.eventId }).from(eventChanges);
    const changedIds = new Set(changesList.map((ch) => ch.eventId));
    allEvents = allEvents.filter((ev) => changedIds.has(ev.id));
  }

  const tracksSet = new Set<string>();
  const daysSet = new Set<string>();
  const locationsSet = new Set<string>();

  for (const ev of allEvents) {
    if (ev.track) tracksSet.add(ev.track);
    if (ev.day) daysSet.add(ev.day);
    if (ev.location) locationsSet.add(ev.location);
  }

  return c.json({
    success: true,
    count: allEvents.length,
    events: allEvents,
    facets: {
      tracks: Array.from(tracksSet).sort(),
      days: Array.from(daysSet).sort((a, b) => {
        const matchA = a.match(/\d+/);
        const matchB = b.match(/\d+/);
        const numA = matchA ? parseInt(matchA[0], 10) : 99;
        const numB = matchB ? parseInt(matchB[0], 10) : 99;
        return numA - numB;
      }),
      locations: Array.from(locationsSet).sort(),
    },
  });
});
