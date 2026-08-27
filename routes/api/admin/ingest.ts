import type { Context } from "hono";
import { defineHandler } from "void";
import { adminGuard } from "../../../lib/auth.ts";
import { runIngestionWithRunLog } from "../../../lib/ingest.ts";

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

  try {
    const { runId, ...result } = await runIngestionWithRunLog({
      mode: body.mode,
      days: body.days,
      maxDetailFetches: body.maxDetailFetches,
      userId: guard.user.id,
    });

    return c.json({ success: true, runId, result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ success: false, error: message }, 500);
  }
});
