import type { Context } from "hono";
import { runIngestion } from "../../lib/ingest";

export async function POST(c: Context) {
  try {
    const body = (await c.req.json().catch(() => ({}))) as {
      days?: string[];
      maxDetailFetches?: number;
    };

    const result = await runIngestion({
      days: body.days,
      maxDetailFetches: body.maxDetailFetches,
    });

    return c.json({ success: true, result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ success: false, error: message }, 500);
  }
}
