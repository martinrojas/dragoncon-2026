import { db, eq } from "void/db";
import { users } from "../db/schema.ts";

export async function makeAdmin(username: string): Promise<{ success: boolean; message: string }> {
  const clean = username.trim().toLowerCase();
  if (!clean) {
    return { success: false, message: "Username is required" };
  }

  const [user] = await db.select().from(users).where(eq(users.username, clean));
  if (!user) {
    return { success: false, message: `User "${clean}" not found in database.` };
  }

  await db.update(users).set({ role: "admin" }).where(eq(users.username, clean));
  return { success: true, message: `User "${clean}" (${user.name}) is now an Admin.` };
}

// CLI execution
if (import.meta.filename === process.argv[1] || process.argv[1]?.endsWith("make-admin.ts")) {
  const targetUser = process.argv[2];
  if (!targetUser) {
    console.error("Usage: pnpm run make-admin <username>");
    process.exit(1);
  }
  makeAdmin(targetUser).then((res) => {
    if (res.success) {
      console.log(`✓ ${res.message}`);
    } else {
      console.error(`✗ ${res.message}`);
      process.exit(1);
    }
  });
}
