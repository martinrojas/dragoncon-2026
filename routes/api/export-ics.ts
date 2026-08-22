import type { Context } from "hono";
import { defineHandler } from "void";
import { db, eq, inArray } from "void/db";
import { events, userEvents } from "../../db/schema";

function formatIcsDate(isoString: string): string {
  const date = new Date(isoString);
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function escapeIcsText(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export const GET = defineHandler(async (c: Context) => {
  const userId = c.req.query("userId");

  if (!userId) {
    return c.json({ success: false, error: "userId required" }, 400);
  }

  const saved = await db.select().from(userEvents).where(eq(userEvents.userId, userId));

  if (saved.length === 0) {
    return c.json({ success: false, error: "No events in schedule" }, 404);
  }

  const eventIds = saved.map((s) => s.eventId);
  const userEventList = await db.select().from(events).where(inArray(events.id, eventIds));

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Dragon Con 2026 Personal App//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:My Dragon Con 2026 Schedule",
  ];

  for (const event of userEventList) {
    if (!event.startsAt || !event.endsAt) continue;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:dragoncon26-${event.id}@app.void`);
    lines.push(`DTSTAMP:${formatIcsDate(new Date().toISOString())}`);
    lines.push(`DTSTART:${formatIcsDate(event.startsAt)}`);
    lines.push(`DTEND:${formatIcsDate(event.endsAt)}`);
    lines.push(`SUMMARY:${escapeIcsText(event.title)}`);

    if (event.location) {
      lines.push(`LOCATION:${escapeIcsText(event.location)}`);
    }

    const descParts: string[] = [];
    if (event.track) descParts.push(`Track: ${event.track}`);
    if (event.description) descParts.push(`\n${event.description}`);
    if (descParts.length > 0) {
      lines.push(`DESCRIPTION:${escapeIcsText(descParts.join("\n"))}`);
    }

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  const icsBody = lines.join("\r\n");

  return c.text(icsBody, 200, {
    "Content-Type": "text/calendar; charset=utf-8",
    "Content-Disposition": 'attachment; filename="dragoncon-schedule.ics"',
  });
});
