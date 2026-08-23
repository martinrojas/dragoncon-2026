import type { Context } from "hono";
import { defineHandler } from "void";
import { db, desc } from "void/db";
import { adminGuard } from "../../lib/auth.ts";
import { feedback } from "../../db/schema.ts";

export const POST = defineHandler(async (c: Context) => {
  try {
    const body = (await c.req.json().catch(() => ({}))) as {
      kind?: string;
      message?: string;
      contact?: string;
      userId?: string;
      username?: string;
      appVersion?: string;
      pageUrl?: string;
    };

    const { kind, message, contact, userId, username, appVersion, pageUrl } = body;

    if (kind !== "bug" && kind !== "idea") {
      return c.json({ success: false, error: "kind must be bug or idea" }, 400);
    }

    if (!message || message.trim().length === 0) {
      return c.json({ success: false, error: "message is required" }, 400);
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length > 2000) {
      return c.json({ success: false, error: "message must be 2000 characters or fewer" }, 400);
    }

    const cleanContact = contact && contact.trim().length > 0 ? contact.trim().slice(0, 200) : null;
    const userAgent = c.req.header("user-agent") ?? null;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.insert(feedback).values({
      id,
      userId: userId ?? null,
      username: username ?? null,
      kind,
      message: trimmedMessage,
      contact: cleanContact,
      appVersion: appVersion ?? null,
      userAgent,
      pageUrl: pageUrl ?? null,
      status: "new",
      createdAt: now,
    });

    return c.json({ success: true, message: "Thanks — your note is in." });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return c.json({ success: false, error: errorMessage }, 500);
  }
});

export const GET = defineHandler(async (c: Context) => {
  const guard = await adminGuard(c);
  if ("errorResponse" in guard) {
    return guard.errorResponse;
  }

  const rows = await db.select().from(feedback).orderBy(desc(feedback.createdAt)).limit(100);

  return c.json({ success: true, feedback: rows });
});
