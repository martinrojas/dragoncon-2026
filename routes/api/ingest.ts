import type { Context } from "hono";
import { defineHandler } from "void";
import { adminGuard } from "../../lib/auth.ts";
import { runIngestionWithRunLog } from "../../lib/ingest.ts";

export const POST = defineHandler(async (c: Context) => {
  const guard = await adminGuard(c);
  if ("errorResponse" in guard) {
    return guard.errorResponse;
  }

  try {
    const body = (await c.req.json().catch(() => ({}))) as {
      days?: string[];
      maxDetailFetches?: number;
    };

    const result = await runIngestionWithRunLog({
      days: body.days,
      maxDetailFetches: body.maxDetailFetches,
      userId: guard.user.id,
    });

    return c.json({ success: true, result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ success: false, error: message }, 500);
  }
});
