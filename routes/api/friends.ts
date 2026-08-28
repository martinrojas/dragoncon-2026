import type { Context } from "hono";
import { defineHandler } from "void";
import { and, db, eq, inArray } from "void/db";
import { events, friendships, userEvents, users } from "../../db/schema.ts";

export const GET = defineHandler(async (c: Context) => {
  const userId = c.req.query("userId");
  const friendId = c.req.query("friendId");

  if (!userId) {
    return c.json({ success: false, error: "userId parameter required" }, 400);
  }

  if (friendId) {
    const [existingFriendship] = await db
      .select()
      .from(friendships)
      .where(and(eq(friendships.userId, userId), eq(friendships.friendId, friendId)));

    if (!existingFriendship) {
      return c.json({ success: false, error: "Must be squad members to view schedule" }, 403);
    }

    const [targetFriend] = await db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        avatarUrl: users.avatarUrl,
        shareSchedule: users.shareSchedule,
      })
      .from(users)
      .where(eq(users.id, friendId));

    if (!targetFriend) {
      return c.json({ success: false, error: "Friend user not found" }, 404);
    }

    const userSaved = await db.select().from(userEvents).where(eq(userEvents.userId, userId));
    const friendSaved = await db.select().from(userEvents).where(eq(userEvents.userId, friendId));

    const userEventIds = new Set(userSaved.map((s) => s.eventId));
    const friendEventIds = friendSaved.map((s) => s.eventId);
    const sharedEventIds = friendSaved.filter((s) => userEventIds.has(s.eventId)).map((s) => s.eventId);

    const isPublic = targetFriend.shareSchedule === 1;

    let friendEventsList: (typeof events.$inferSelect)[] = [];
    let sharedEventsList: (typeof events.$inferSelect)[] = [];

    if (isPublic && friendEventIds.length > 0) {
      friendEventsList = await db
        .select()
        .from(events)
        .where(inArray(events.id, friendEventIds))
        .orderBy(events.startsAt);
    }

    if (sharedEventIds.length > 0) {
      sharedEventsList = await db.select().from(events).where(inArray(events.id, sharedEventIds));
    }

    return c.json({
      success: true,
      scheduleHidden: !isPublic,
      friend: {
        id: targetFriend.id,
        username: targetFriend.username,
        name: targetFriend.name,
        avatarUrl: targetFriend.avatarUrl,
      },
      friendEvents: friendEventsList,
      sharedEvents: sharedEventsList,
      sharedEventIds,
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
      shareSchedule: users.shareSchedule,
    })
    .from(users)
    .where(inArray(users.id, friendIds));

  return c.json({ success: true, friends: friendUsers });
});

export const POST = defineHandler(async (c: Context) => {
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
});
