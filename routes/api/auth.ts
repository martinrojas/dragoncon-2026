import type { Context } from "hono";
import { defineHandler } from "void";
import { db, eq } from "void/db";
import { users } from "../../db/schema";

async function hashPassword(password: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(`dragoncon_salt_${password}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const POST = defineHandler(async (c: Context) => {
  try {
    const body = (await c.req.json().catch(() => ({}))) as {
      action: "register" | "login";
      username?: string;
      password?: string;
      name?: string;
    };

    const { action, username, password, name } = body;

    if (!username || !password) {
      return c.json({ success: false, error: "Username and password required" }, 400);
    }

    const cleanUsername = username.trim().toLowerCase();
    const pwdHash = await hashPassword(password);

    if (action === "register") {
      if (!name) {
        return c.json({ success: false, error: "Name is required" }, 400);
      }

      const [existing] = await db.select().from(users).where(eq(users.username, cleanUsername));
      if (existing) {
        return c.json({ success: false, error: "Username already taken" }, 400);
      }

      const userId = `usr_${crypto.randomUUID().slice(0, 8)}`;
      const now = new Date().toISOString();

      await db.insert(users).values({
        id: userId,
        username: cleanUsername,
        name: name.trim(),
        passwordHash: pwdHash,
        createdAt: now,
      });

      const token = btoa(JSON.stringify({ id: userId, username: cleanUsername, name: name.trim() }));
      return c.json({
        success: true,
        user: { id: userId, username: cleanUsername, name: name.trim() },
        token,
      });
    }

    if (action === "login") {
      const [user] = await db.select().from(users).where(eq(users.username, cleanUsername));
      if (!user || user.passwordHash !== pwdHash) {
        return c.json({ success: false, error: "Invalid username or password" }, 401);
      }

      const token = btoa(JSON.stringify({ id: user.id, username: user.username, name: user.name }));
      return c.json({
        success: true,
        user: { id: user.id, username: user.username, name: user.name },
        token,
      });
    }

    return c.json({ success: false, error: "Invalid action" }, 400);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ success: false, error: message }, 500);
  }
});
