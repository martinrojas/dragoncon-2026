import type { Context } from "hono";
import { defineHandler } from "void";
import { db, eq, inArray } from "void/db";
import { events, userEvents } from "../../db/schema";

export const GET = defineHandler(async (c: Context) => {
  const userId = c.req.query("userId");

  if (!userId) {
    return c.json({ success: false, error: "userId parameter required" }, 400);
  }

  const saved = await db
    .select()
    .from(userEvents)
    .where(eq(userEvents.userId, userId));

  if (saved.length === 0) {
    return c.json({ success: true, count: 0, items: [], conflicts: [] });
  }

  const eventIds = saved.map((s) => s.eventId);
  const matchedEvents = await db
    .select()
    .from(events)
    .where(inArray(events.id, eventIds));

  const eventMap = new Map(matchedEvents.map((e) => [e.id, e]));

  const items = saved.map((s) => ({
    ...s,
    event: eventMap.get(s.eventId) || null,
  }));

  const goingEvents = items
    .filter((i) => i.status === "going" && i.event && i.event.startsAt && i.event.endsAt)
    .map((i) => ({
      eventId: i.eventId,
      title: i.event!.title,
      start: new Date(i.event!.startsAt!).getTime(),
      end: new Date(i.event!.endsAt!).getTime(),
    }));

  const conflicts: { event1Id: string; event2Id: string; title1: string; title2: string }[] = [];

  for (let i = 0; i < goingEvents.length; i++) {
    for (let j = i + 1; j < goingEvents.length; j++) {
      const e1 = goingEvents[i];
      const e2 = goingEvents[j];

      if (e1.start < e2.end && e2.start < e1.end) {
        conflicts.push({
          event1Id: e1.eventId,
          event2Id: e2.eventId,
          title1: e1.title,
          title2: e2.title,
        });
      }
    }
  }

  return c.json({
    success: true,
    count: items.length,
    items,
    conflicts,
  });
});

export const POST = defineHandler(async (c: Context) => {
  try {
    const body = (await c.req.json().catch(() => ({}))) as {
      userId?: string;
      eventId?: string;
      action?: "add" | "remove" | "update";
      status?: "going" | "interested";
      notes?: string;
    };

    const { userId, eventId, action = "add", status = "going", notes } = body;

    if (!userId || !eventId) {
      return c.json({ success: false, error: "userId and eventId required" }, 400);
    }

    const itemKey = `${userId}:${eventId}`;

    if (action === "remove") {
      await db.delete(userEvents).where(eq(userEvents.id, itemKey));
      return c.json({ success: true, message: "Removed from schedule" });
    }

    const [existing] = await db.select().from(userEvents).where(eq(userEvents.id, itemKey));
    const now = new Date().toISOString();

    if (existing) {
      await db
        .update(userEvents)
        .set({
          status,
          notes: notes !== undefined ? notes : existing.notes,
        })
        .where(eq(userEvents.id, itemKey));
    } else {
      await db.insert(userEvents).values({
        id: itemKey,
        userId,
        eventId,
        status,
        notes: notes || null,
        addedAt: now,
      });
    }

    return c.json({ success: true, message: "Schedule updated" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ success: false, error: message }, 500);
  }
});
