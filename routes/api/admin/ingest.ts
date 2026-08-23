import type { Context } from "hono";
import { defineHandler } from "void";
import { db, eq } from "void/db";
import { adminGuard } from "../../../lib/auth.ts";
import { runIngestion } from "../../../lib/ingest.ts";
import { ingestionRuns } from "../../../db/schema.ts";

export const POST = defineHandler(async (c: Context) => {
  const guard = await adminGuard(c);
  if ("errorResponse" in guard) {
    return guard.errorResponse;
  }

  const body = (await c.req.json().catch(() => ({}))) as {
    mode?: "sync" | "dry-run" | "hard-resync";
    days?: string[];
    maxDetailFetches?: number;
  };

  const mode = body.mode ?? "sync";

  const [run] = await db
    .insert(ingestionRuns)
    .values({
      userId: guard.user.id,
      mode,
      status: "running",
      days: body.days ? JSON.stringify(body.days) : null,
    })
    .returning();

  const runId = run.id;

  try {
    const result = await runIngestion({
      mode,
      days: body.days,
      maxDetailFetches: body.maxDetailFetches,
    });

    await db
      .update(ingestionRuns)
      .set({
        status: "completed",
        stats: JSON.stringify({
          totalScraped: result.totalScraped,
          created: result.created,
          updated: result.updated,
          deleted: result.deleted,
          errors: result.errors,
        }),
        log: result.log.join("\n"),
        completedAt: new Date().toISOString(),
      })
      .where(eq(ingestionRuns.id, runId));

    return c.json({ success: true, runId, result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    await db
      .update(ingestionRuns)
      .set({
        status: "failed",
        errorMessage: message,
        completedAt: new Date().toISOString(),
      })
      .where(eq(ingestionRuns.id, runId));

    return c.json({ success: false, runId, error: message }, 500);
  }
});
