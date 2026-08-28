import type { Context } from "hono";
import { defineHandler } from "void";
import { db, eq } from "void/db";
import { users } from "../../../db/schema.ts";

export const PATCH = defineHandler(async (c: Context) => {
  try {
    const body = (await c.req.json().catch(() => ({}))) as {
      userId?: string;
      shareSchedule?: boolean;
    };

    const { userId, shareSchedule } = body;

    if (!userId || typeof shareSchedule !== "boolean") {
      return c.json({ success: false, error: "userId and shareSchedule boolean required" }, 400);
    }

    const value = shareSchedule ? 1 : 0;

    await db
      .update(users)
      .set({ shareSchedule: value })
      .where(eq(users.id, userId));

    return c.json({ success: true, shareSchedule: value });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ success: false, error: message }, 500);
  }
});
