import type { Context } from "hono";
import { db, eq } from "void/db";
import { users } from "../db/schema.ts";

export interface SessionUser {
  id: string;
  username: string;
  name: string;
  role: "admin" | "user";
}

/**
 * Decodes the base64 JSON token minted by `routes/api/auth.ts` into a
 * `SessionUser`. This is a *claim*, not a verified identity — callers that
 * need to trust the role should re-check it against the `users` table via
 * `getUserFromContext`.
 */
export function parseToken(token: string): SessionUser | null {
  try {
    const data = JSON.parse(atob(token)) as Record<string, unknown>;
    if (typeof data.id !== "string" || typeof data.username !== "string") {
      return null;
    }

    return {
      id: data.id,
      username: data.username,
      name: typeof data.name === "string" ? data.name : "",
      role: data.role === "admin" ? "admin" : "user",
    };
  } catch {
    return null;
  }
}

export function verifyUserRole(user: SessionUser | null, requiredRole: "admin" | "user" = "admin"): boolean {
  if (!user) {
    return false;
  }
  if (requiredRole === "admin") {
    return user.role === "admin";
  }
  return true;
}

/**
 * Reads the session token from `Authorization: Bearer <token>` or
 * `Cookie: session=<token>`, verifies the user still exists in `users`, and
 * returns their current role from the database (the token's own claimed
 * role is untrusted since it is client-supplied).
 */
export async function getUserFromContext(c: Context): Promise<SessionUser | null> {
  const authHeader = c.req.header("Authorization");
  const cookieHeader = c.req.header("Cookie");

  let token: string | null = null;
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice("Bearer ".length).trim();
  } else if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)session=([^;]+)/);
    if (match) {
      try {
        token = decodeURIComponent(match[1]);
      } catch {
        token = null;
      }
    }
  }

  if (!token) {
    return null;
  }

  const parsed = parseToken(token);
  if (!parsed) {
    return null;
  }

  const [user] = await db.select().from(users).where(eq(users.id, parsed.id));
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role === "admin" ? "admin" : "user",
  };
}

export async function adminGuard(c: Context): Promise<{ user: SessionUser } | { errorResponse: Response }> {
  const user = await getUserFromContext(c);
  if (!user) {
    return { errorResponse: c.json({ success: false, error: "Authentication required" }, 401) };
  }
  if (user.role !== "admin") {
    return { errorResponse: c.json({ success: false, error: "Admin access required" }, 403) };
  }
  return { user };
}