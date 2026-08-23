import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { getRuntimeBinding, withRuntimeEnv } from "void/_env";
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

/**
 * Miniflare persists each local D1 database as a `<hash>.sqlite` file under
 * `.void/v3/d1/miniflare-D1DatabaseObject/`. Multiple files can accumulate
 * across dev-server restarts/schema resets; the most recently modified one is
 * the database currently backing the dev server.
 */
function findLocalD1SqliteFile(): string | null {
  const dir = path.resolve(import.meta.dirname, "../.void/v3/d1/miniflare-D1DatabaseObject");
  if (!existsSync(dir)) return null;

  const candidates = readdirSync(dir)
    .filter((file) => file.endsWith(".sqlite") && file !== "metadata.sqlite")
    .map((file) => {
      const full = path.join(dir, file);
      return { full, mtimeMs: statSync(full).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  return candidates[0]?.full ?? null;
}

/**
 * Wraps a `node:sqlite` `DatabaseSync` handle in the subset of the D1
 * `prepare(sql).bind(...params)` surface that `drizzle-orm`'s D1 driver calls
 * (`.raw()` for selects, `.all()`/`.run()` for mutations).
 */
function wrapSqliteAsD1(sqliteDb: DatabaseSync) {
  return {
    prepare(sqlText: string) {
      const stmt = sqliteDb.prepare(sqlText);
      return {
        bind(...params: unknown[]) {
          return {
            raw() {
              return stmt.all(...(params as never[])).map((row) => Object.values(row as object));
            },
            all() {
              return { results: stmt.all(...(params as never[])) };
            },
            run() {
              const info = stmt.run(...(params as never[]));
              return { success: true, meta: { changes: info.changes, last_row_id: Number(info.lastInsertRowid) } };
            },
          };
        },
      };
    },
  };
}

/**
 * Runs `makeAdmin` for the CLI. When no runtime `DB` binding is already
 * present (the normal case for `pnpm run make-admin <username>`, which runs
 * as a plain Node process outside any Worker request), this locates the
 * active local D1 SQLite file and supplies it as the `DB` binding via
 * `withRuntimeEnv`, mirroring how the generated Worker entry wires bindings.
 */
async function runCli(targetUser: string): Promise<void> {
  const exec = async () => {
    const res = await makeAdmin(targetUser);
    if (res.success) {
      console.log(`✓ ${res.message}`);
    } else {
      console.error(`✗ ${res.message}`);
      process.exitCode = 1;
    }
  };

  let hasLiveDbBinding = false;
  try {
    hasLiveDbBinding = getRuntimeBinding("DB") != null;
  } catch {
    hasLiveDbBinding = false;
  }

  if (hasLiveDbBinding) {
    await exec();
    return;
  }

  const sqliteFile = findLocalD1SqliteFile();
  if (!sqliteFile) {
    throw new Error(
      "No local D1 SQLite database found under .void/v3/d1/miniflare-D1DatabaseObject. Start the dev server (or run `void db push`) first.",
    );
  }
  await withRuntimeEnv({ DB: wrapSqliteAsD1(new DatabaseSync(sqliteFile)) }, exec);
}

// CLI execution
if (import.meta.filename === process.argv[1] || process.argv[1]?.endsWith("make-admin.ts")) {
  const targetUser = process.argv[2];
  if (!targetUser) {
    console.error("Usage: pnpm run make-admin <username>");
    process.exit(1);
  }
  runCli(targetUser)
    .then(() => {
      if (process.exitCode) process.exit(process.exitCode);
    })
    .catch((err) => {
      console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    });
}
