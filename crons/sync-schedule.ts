import { defineScheduled } from "void";
import { runIngestionWithRunLog } from "../lib/ingest.ts";

export const cron = [
  "0 */4 * 8 *", // Aug 24-31: every 4 hours
  "0 */2 1-2 9 *", // Sep 1-2: every 2 hours
  "*/10 * 3-7 9 *", // Sep 3-7 (Dragon Con): every 10 minutes
];

// One con day per tick: each invocation gets the Worker's whole subrequest
// budget instead of sharing it across all seven days (which starved
// Saturday/Sunday whenever earlier days consumed it).
export const SYNC_DAYS = ["Sep++2", "Sep++3", "Sep++4", "Sep++5", "Sep++6", "Sep++7", "Sep++8"] as const;

/** Tick interval for each declared cron pattern. Rotation advances exactly one
 * con day per invocation, so a tighter cadence sweeps the whole schedule more
 * often instead of re-syncing a single day repeatedly. Unknown patterns fall
 * back to the tightest cadence, which still advances on every tick. */
export const CADENCE_MS: Record<string, number> = {
  "0 */4 * 8 *": 4 * 60 * 60 * 1000,
  "0 */2 1-2 9 *": 2 * 60 * 60 * 1000,
  "*/10 * 3-7 9 *": 10 * 60 * 1000,
};
const DEFAULT_CADENCE_MS = 10 * 60 * 1000;

/** Deterministic round-robin over SYNC_DAYS. The slot index is the clock
 * divided by the active tick interval, so consecutive invocations pick
 * consecutive days with no persisted cursor. Con dates already past (ET) are
 * skipped, so the live window shrinks — and gets swept faster — as the con
 * progresses. Returns [] once every day is behind us. */
export function nextSyncDays(now: Date, cadenceMs: number = DEFAULT_CADENCE_MS): string[] {
  let etMonth = now.getUTCMonth() + 1;
  let etDay = now.getUTCDate();
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      month: "numeric",
      day: "numeric",
    }).formatToParts(now);
    const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? NaN);
    etMonth = pick("month");
    etDay = pick("day");
  } catch {
    // fall back to UTC components
  }

  const isFuture = (param: string) => {
    const n = Number(param.slice(-1));
    if (etMonth < 9) return true;
    if (etMonth > 9) return false;
    return n >= etDay;
  };

  const startIdx = Math.floor(now.getTime() / cadenceMs) % SYNC_DAYS.length;
  for (let off = 0; off < SYNC_DAYS.length; off++) {
    const candidate = SYNC_DAYS[(startIdx + off) % SYNC_DAYS.length];
    if (isFuture(candidate)) return [candidate];
  }
  return [];
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

  const days = nextSyncDays(now, CADENCE_MS[controller?.cron ?? ""] ?? DEFAULT_CADENCE_MS);
  if (days.length === 0) {
    console.log(
      `[Cron:sync-schedule] All con days have passed; nothing left to sync (${now.toISOString()})`,
    );
    return;
  }
  const startTime = Date.now();
  console.log(
    `[Cron:sync-schedule] Starting scheduled sync at ${now.toISOString()} (cron: ${controller.cron}, day: ${days.join(", ")})`,
  );

  try {
    const result = await runIngestionWithRunLog({
      mode: "sync",
      days,
      // Dedicated invocation for one con day (largest seen: ~650 events), so
      // raise its cap under the wrangler.jsonc subrequests=2000 ceiling
      // instead of inheriting the conservative cross-day default of 400.
      maxDetailFetches: 1900,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[Cron:sync-schedule] Run #${result.runId} finished in ${duration}s. Scraped: ${result.totalScraped}, Created: ${result.created}, Updated: ${result.updated}, Deleted: ${result.deleted}, Errors: ${result.errors}`,
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Cron:sync-schedule] Error running scheduled ingestion: ${message}`, error);
  }
});
