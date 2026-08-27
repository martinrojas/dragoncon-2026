import { defineScheduled } from "void";
import { runIngestionWithRunLog } from "../lib/ingest.ts";

export const cron = [
  "0 */4 * 8 *", // Aug 24-31: every 4 hours
  "0 */4 1-2 9 *", // Sep 1-2: every 4 hours
  "*/30 * 3-7 9 *", // Sep 3-7 (Dragon Con): every 30 minutes
];

// One con day per tick: each invocation gets the Worker's whole subrequest
// budget instead of sharing it across all seven days (which starved
// Saturday/Sunday whenever earlier days consumed it).
export const SYNC_DAYS = ["Sep++2", "Sep++3", "Sep++4", "Sep++5", "Sep++6", "Sep++7", "Sep++8"] as const;

const CYCLE_MS = 4 * 60 * 60 * 1000;

/** Deterministic round-robin over SYNC_DAYS derived from the tick time. */
export function nextSyncDays(now: Date): string[] {
  const idx = Math.floor(now.getTime() / CYCLE_MS) % SYNC_DAYS.length;
  return [SYNC_DAYS[idx]];
}

export function isWithinActiveWindow(date: Date = new Date()): boolean {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth(); // 0-indexed: 7 = August, 8 = September
  const day = date.getUTCDate();

  if (year !== 2026) return false;
  if (month === 7) return day >= 24; // Aug 24-31
  if (month === 8) return day <= 7; // Sep 1-7
  return false;
}

export default defineScheduled(async (controller, _env, _ctx) => {
  const now = new Date(controller?.scheduledTime ? Number(controller.scheduledTime) : Date.now());

  if (!isWithinActiveWindow(now)) {
    console.log(
      `[Cron:sync-schedule] Skipping execution outside active 2026 con window (${now.toISOString()})`,
    );
    return;
  }

  const days = nextSyncDays(now);
  const startTime = Date.now();
  console.log(
    `[Cron:sync-schedule] Starting scheduled sync at ${now.toISOString()} (cron: ${controller.cron}, day: ${days.join(", ")})`,
  );

  try {
    const result = await runIngestionWithRunLog({ mode: "sync", days });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[Cron:sync-schedule] Run #${result.runId} finished in ${duration}s. Scraped: ${result.totalScraped}, Created: ${result.created}, Updated: ${result.updated}, Deleted: ${result.deleted}, Errors: ${result.errors}`,
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Cron:sync-schedule] Error running scheduled ingestion: ${message}`, error);
  }
});
