import type { Context } from "hono";
import { db, eq, inArray } from "void/db";
import { events, friendships, userEvents, users } from "../../db/schema";

export async function GET(c: Context) {
  const userId = c.req.query("userId");
  const friendId = c.req.query("friendId");

  if (!userId) {
    return c.json({ success: false, error: "userId parameter required" }, 400);
  }

  if (friendId) {
    const userSaved = await db.select().from(userEvents).where(eq(userEvents.userId, userId));
    const friendSaved = await db.select().from(userEvents).where(eq(userEvents.userId, friendId));

    const userEventIds = new Set(userSaved.map((s) => s.eventId));
    const sharedEventIds = friendSaved.filter((s) => userEventIds.has(s.eventId)).map((s) => s.eventId);

    let sharedEvents: (typeof events.$inferSelect)[] = [];
    if (sharedEventIds.length > 0) {
      sharedEvents = await db.select().from(events).where(inArray(events.id, sharedEventIds));
    }

    return c.json({
      success: true,
      overlapCount: sharedEvents.length,
      sharedEvents,
    });
  }

  const list = await db
    .select()
    .from(friendships)
    .where(eq(friendships.userId, userId));

  if (list.length === 0) {
    return c.json({ success: true, friends: [] });
  }

  const friendIds = list.map((f) => f.friendId);
  const friendUsers = await db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(inArray(users.id, friendIds));

  return c.json({ success: true, friends: friendUsers });
}

export async function POST(c: Context) {
  try {
    const body = (await c.req.json().catch(() => ({}))) as {
      userId?: string;
      friendUsername?: string;
    };

    const { userId, friendUsername } = body;

    if (!userId || !friendUsername) {
      return c.json({ success: false, error: "userId and friendUsername required" }, 400);
    }

    const cleanUsername = friendUsername.trim().toLowerCase();
    const [friendUser] = await db.select().from(users).where(eq(users.username, cleanUsername));

    if (!friendUser) {
      return c.json({ success: false, error: "User not found" }, 404);
    }

    if (friendUser.id === userId) {
      return c.json({ success: false, error: "Cannot add yourself as a friend" }, 400);
    }

    const link1 = `${userId}:${friendUser.id}`;
    const link2 = `${friendUser.id}:${userId}`;
    const now = new Date().toISOString();

    await db
      .insert(friendships)
      .values([
        { id: link1, userId, friendId: friendUser.id, status: "accepted", createdAt: now },
        { id: link2, userId: friendUser.id, friendId: userId, status: "accepted", createdAt: now },
      ])
      .onConflictDoNothing();

    return c.json({
      success: true,
      message: `Added ${friendUser.name} (@${friendUser.username}) as a friend!`,
      friend: { id: friendUser.id, username: friendUser.username, name: friendUser.name },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ success: false, error: message }, 500);
  }
}
