import * as cheerio from "cheerio";
import type { InferInsertModel } from "drizzle-orm";
import { and, db, eq, inArray } from "void/db";
import { eventChanges, events, ingestionRuns } from "../db/schema.ts";



// Rows buffered per multi-row D1 statement while flushing a parsed day.
// Keeps a full con-scale day (~hundreds of new events) well inside the
// Workers subrequest ceiling instead of 1-3 statements per event.
const WRITE_CHUNK = 50;

const BASE_URL = "https://app.core-apps.com/dragoncon26";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Total event-detail fetches allowed across a whole `runIngestion` call
// when the caller doesn't pass `maxDetailFetches`. Cloudflare enforces one
// subrequest ceiling per Worker invocation (`limits.subrequests` in
// wrangler.jsonc) shared by every fetch() and D1 call below; this default
// keeps a full multi-day sync comfortably under the Workers Paid plan's
// configured budget. Pass a larger `maxDetailFetches` explicitly (and raise
// `limits.subrequests` to match) for a bigger one-shot run.
export const DEFAULT_DETAIL_FETCH_BUDGET = 400;

export interface IngestOptions {
  days?: string[];
  /** Total detail-page fetches for the whole invocation (shared across every `days` entry, not per-day). Omit to use `DEFAULT_DETAIL_FETCH_BUDGET`. */
  maxDetailFetches?: number;
  mode?: "sync" | "dry-run" | "hard-resync";
  onProgress?: (msg: string) => void;
  /** Injectable clock for the past-day filter; defaults to the real time. */
  now?: Date;
}

export interface IngestDiffSummary {
  createdEvents: Array<{ id: string; title: string; location: string | null; timeString: string | null }>;
  updatedEvents: Array<{ id: string; title: string; changes: string }>;
  deletedEvents: Array<{ id: string; title: string }>;
}

export interface IngestResult {
  mode: "sync" | "dry-run" | "hard-resync";
  totalScraped: number;
  created: number;
  updated: number;
  deleted: number;
  errors: number;
  diffSummary: IngestDiffSummary;
  log: string[];
}

function parseDateTime(dateStr: string, durationStr: string) {
  if (!dateStr) return { startsAt: null, endsAt: null, durationMinutes: 60 };
  const clean = dateStr.replace(/\s+/g, " ");
  const match = clean.match(
    /^[A-Za-z]+,\s+([A-Za-z]+)\s+(\d+)\s+(\d+):(\d+)\s+(AM|PM)$/i,
  );
  if (!match) return { startsAt: null, endsAt: null, durationMinutes: 60 };
  const [_, monthStr, dayStr, hourStr, minStr, ampm] = match;
  const monthMap: Record<string, number> = {
    Jan: 0,
    Feb: 1,
    Mar: 2,
    Apr: 3,
    May: 4,
    Jun: 5,
    Jul: 6,
    Aug: 7,
    Sep: 8,
    Oct: 9,
    Nov: 10,
    Dec: 11,
  };
  let hour = parseInt(hourStr, 10);
  if (ampm.toUpperCase() === "PM" && hour < 12) hour += 12;
  if (ampm.toUpperCase() === "AM" && hour === 12) hour = 0;

  const month = monthMap[monthStr] ?? 8;
  const day = parseInt(dayStr, 10);
  const min = parseInt(minStr, 10);

  // Atlanta is EDT (UTC-4)
  const startDate = new Date(Date.UTC(2026, month, day, hour + 4, min));

  let durationMinutes = 60;
  if (durationStr) {
    const durMatch = durationStr.match(/(\d+)\s*(hour|hr|minute|min)/i);
    if (durMatch) {
      const val = parseInt(durMatch[1], 10);
      if (
        durMatch[2].toLowerCase().startsWith("hour") ||
        durMatch[2].toLowerCase().startsWith("hr")
      ) {
        durationMinutes = val * 60;
      } else {
        durationMinutes = val;
      }
    }
  }

  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
  return {
    startsAt: startDate.toISOString(),
    endsAt: endDate.toISOString(),
    durationMinutes,
  };
}

async function computeHash(data: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Computes a stable content hash for an event from its user-facing fields.
 * Two events with identical title/location/timeString/description hash the
 * same, regardless of internal metadata (track, parsed timestamps, etc.).
 */
export async function computeContentHash(
  title: string,
  location?: string | null,
  timeString?: string | null,
  description?: string | null,
): Promise<string> {
  return computeHash(`${title}|${location ?? ""}|${timeString ?? ""}|${description ?? ""}`);
}

export async function runIngestion(options: IngestOptions = {}): Promise<IngestResult> {
  const mode = options.mode ?? "sync";
  const isDryRun = mode === "dry-run";
  const isHardResync = mode === "hard-resync";

  const logs: string[] = [];
  const log = (msg: string) => {
    logs.push(msg);
    if (options.onProgress) options.onProgress(msg);
  };


  let createdCount = 0;
  let updatedCount = 0;
  let deletedCount = 0;
  let errorCount = 0;

  const diffSummary: IngestDiffSummary = {
    createdEvents: [],
    updatedEvents: [],
    deletedEvents: [],
  };

  // Upstream's view_by_day endpoint only accepts date params of the form
  // `Sep++N` (double space, URL-encoded). Map human weekday labels — e.g.
  // the admin dashboard's filter chips — onto that contract; canonical
  // params and synthetic test days pass through untouched.
  const WEEKDAY_TO_DAY_PARAM: Record<string, string> = {
    Wednesday: "Sep++2",
    Thursday: "Sep++3",
    Friday: "Sep++4",
    Saturday: "Sep++5",
    Sunday: "Sep++6",
    Monday: "Sep++7",
    Tuesday: "Sep++8",
  };

  // Upstream days live in the September 2026 con window. Filter *default*
  // expansions down to today-or-later ET so passed days stop costing
  // budget. Explicit `days:` lists always win -- operators may deliberately
  // re-pull a past day (e.g. hard-resync archaeology).
  function conDateInET(now: Date): { month: number; day: number } {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        month: "numeric",
        day: "numeric",
      }).formatToParts(now);
      const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? NaN);
      return { month: pick("month"), day: pick("day") };
    } catch {
      return { month: now.getUTCMonth() + 1, day: now.getUTCDate() };
    }
  }

  function isFutureConDayParam(dayParam: string, now: Date): boolean {
    const match = /^Sep\+\+(\d)$/.exec(dayParam);
    if (!match) return true; // unknown/synthetic params are never auto-skipped
    const { month, day } = conDateInET(now);
    if (month < 9) return true; // before September: entire con still ahead
    if (month > 9) return false; // after September: con finished
    return Number(match[1]) >= day; // today itself stays live until midnight ET
  }

  const hasExplicitDays = Boolean(options.days && options.days.length > 0);
  const clock = options.now ?? new Date();
  if (!hasExplicitDays && mode !== "hard-resync") {
    const skippedPastDays = ["Sep++2", "Sep++3", "Sep++4", "Sep++5", "Sep++6", "Sep++7", "Sep++8"].filter(
      (d) => !isFutureConDayParam(d, clock),
    );
    if (skippedPastDays.length > 0) {
      log(`Skipping already-passed con day(s): ${skippedPastDays.join(", ")}`);
    }
  }
  const allConDayParams = ["Sep++2", "Sep++3", "Sep++4", "Sep++5", "Sep++6", "Sep++7", "Sep++8"];
  const resolvedDefaults =
    mode === "hard-resync"
      ? allConDayParams // hard-resync means exactly that -- re-pull everything
      : allConDayParams.filter((d) => isFutureConDayParam(d, clock));
  const daysToFetch = (options.days && options.days.length > 0
    ? options.days
    : resolvedDefaults
  ).map((day) => WEEKDAY_TO_DAY_PARAM[day] ?? day);

  // Shared across every day below (not reset per day) so a multi-day sync
  // can never exceed the invocation's subrequest budget.
  let detailFetchBudget = options.maxDetailFetches ?? DEFAULT_DETAIL_FETCH_BUDGET;

  log(
    `Starting Dragon Con 2026 schedule ingestion (mode: ${mode}, days: ${daysToFetch.join(", ")}, detail budget: ${detailFetchBudget})...`,
  );

  const scrapedEventIds = new Set<string>();


  // Phase 1 — fetch and parse every requested day listing up front so the
  // run can process days smallest-first. A fixed order let early days
  // consume the shared detail budget and starve whichever days came later
  // (this is how Saturday/Sunday ended up with 6 events while Friday had
  // 271); ordering ascending guarantees every smaller day *completes* and
  // any shortfall lands entirely on the largest, explicitly-truncated day.
  interface DayListing {
    dayParam: string;
    dayHeader: string;
    eventLinks: { id: string; title: string; timeStr: string; href: string }[];
  }
  const fetchedListings: DayListing[] = [];
  for (const dayParam of daysToFetch) {
    const dayUrl = `${BASE_URL}/events/view_by_day?day=${dayParam}`;
    log(`Fetching day listing: ${dayParam}...`);

    let html = "";
    try {
      const res = await fetch(dayUrl, {
        headers: { "User-Agent": USER_AGENT },
      });
      if (!res.ok) {
        log(`Failed to fetch ${dayUrl}: status ${res.status}`);
        errorCount++;
        continue;
      }
      html = await res.text();
    } catch (e: unknown) {
      log(`Error fetching ${dayUrl}: ${e instanceof Error ? e.message : String(e)}`);
      errorCount++;
      continue;
    }

    const $ = cheerio.load(html);
    const dayHeader =
      $(".section_header.alt").first().text().trim() || dayParam.replace(/\+/g, " ");

    const eventLinks: { id: string; title: string; timeStr: string; href: string }[] = [];
    $(".redux_list_item").each((_, el) => {
      const link = $(el).find("a.object_link");
      const href = link.attr("href");
      if (!href) return;
      const match = href.match(/\/event\/([a-f0-9]+)$/i);
      if (!match) return;

      const id = match[1];
      const title = $(el).find(".line.one").text().trim();
      const timeStr = $(el).find(".line.two").text().trim();

      if (id && title) {
        eventLinks.push({ id, title, timeStr, href });
      }
    });

    fetchedListings.push({ dayParam, dayHeader, eventLinks });
  }

  // Phase 2 — smallest listing first, ties in request order (stable sort).
  const orderedListings = [...fetchedListings].sort(
    (a, b) => a.eventLinks.length - b.eventLinks.length,
  );
  if (orderedListings.length > 1) {
    log(
      `Processing order (smallest-first): ${orderedListings
        .map((d) => `${d.dayHeader}(${d.eventLinks.length})`)
        .join(", ")}`,
    );
  }

  for (const { dayParam, dayHeader, eventLinks } of orderedListings) {
    log(`Found ${eventLinks.length} events for day ${dayHeader}`);

    const scrapedIdsForDay = new Set<string>();
    const dayStartScraped = scrapedEventIds.size;
    const dayStartCreated = createdCount;
    const dayStartUpdated = updatedCount;
    const dayStartDeleted = deletedCount;

    // The budget bounds *detail fetches only* and may run out mid-listing;
    // walking past the cap marks the day truncated (which safely skips the
    // deletion scan) instead of silently starving whichever days come later.
    let truncated = false;

    // Scrape and parse every targeted event's detail page into memory
    // first. The hard-resync day reset below only runs after this loop
    // completes, so a handful of failed detail fetches (or a crash
    // mid-scrape) can never wipe rows we have no replacement data for.
    const parsedItems: Array<{
      item: (typeof eventLinks)[number];
      location: string;
      description: string;
      track: string;
      speakers: string[];
      speakersJson: string;
      startsAt: string | null;
      endsAt: string | null;
      durationMinutes: number;
      contentHash: string;
    }> = [];

    for (const item of eventLinks) {
      if (detailFetchBudget <= 0) {
        truncated = true;
        log(
          `Detail-fetch budget exhausted inside ${dayHeader}: ${scrapedIdsForDay.size}/${eventLinks.length} events fetched; marking day truncated (deletion scan skipped).`,
        );
        break;
      }
      detailFetchBudget--;
      scrapedEventIds.add(item.id);
      scrapedIdsForDay.add(item.id);
      const detailUrl = `${BASE_URL}/event/${item.id}`;

      try {
        const detailRes = await fetch(detailUrl, {
          headers: { "User-Agent": USER_AGENT },
        });
        if (!detailRes.ok) {
          log(`Skipping event ${item.id} (${item.title}): detail fetch status ${detailRes.status}`);
          continue;
        }
        const detailHtml = await detailRes.text();
        const $d = cheerio.load(detailHtml);

        let location = "";
        let dateStr = "";
        let durationStr = "";

        $d("tr").each((_, tr) => {
          const label = $d(tr).find("td").eq(0).text().trim();
          const val = $d(tr).find("td").eq(1).text().trim();
          if (label === "Location") location = val;
          if (label === "Date") dateStr = val;
          if (label === "Duration") durationStr = val;
        });

        const description = $d(".section-about p").text().trim();

        let track = "";
        $d(".section_heading").each((_, heading) => {
          if ($d(heading).text().trim() === "Tracks") {
            track = $d(heading).next("a").text().trim();
          }
        });

        const speakers: string[] = [];
        $d(".section_heading").each((_, heading) => {
          if ($d(heading).text().trim() === "Speakers") {
            $d(heading).parent().find("a").each((_, spk) => {
              const name = $d(spk).text().trim();
              if (name && name !== "Speakers") speakers.push(name);
            });
          }
        });

        const { startsAt, endsAt, durationMinutes } = parseDateTime(dateStr, durationStr);

        const contentHash = await computeContentHash(item.title, location, item.timeStr, description);

        parsedItems.push({
          item,
          location,
          description,
          track,
          speakers,
          speakersJson: JSON.stringify(speakers),
          startsAt,
          endsAt,
          durationMinutes,
          contentHash,
        });
      } catch (e: unknown) {
        log(`Error processing event ${item.id}: ${e instanceof Error ? e.message : String(e)}`);
        errorCount++;
      }
    }

    // hard-resync: reset the day only now that this run's scrape/parse pass
    // has finished, and only for events this run actually parsed -- a
    // failed detail fetch (or an empty listing) must never wipe rows we
    // have no replacement data for.
    if (isHardResync) {
      if (parsedItems.length === 0) {
        log(`Hard-resync: skipping wipe for ${dayHeader} -- no events were successfully parsed this run`);
      } else {
        const parsedIds = new Set(parsedItems.map((p) => p.item.id));
        const existingForDay = await db.select().from(events).where(eq(events.day, dayHeader));
        const toWipe = existingForDay.filter((ev) => parsedIds.has(ev.id));

        if (toWipe.length > 0) {
          // Already-deleted rows still need removing to avoid a primary-key
          // conflict on re-insert, but only still-active rows count as a
          // fresh deletion here -- an already-deleted row was counted when it
          // was originally soft-deleted, so counting it again would double-count.
          const activeWiped = toWipe.filter((ev) => ev.isDeleted === 0);
          for (const ev of activeWiped) {
            diffSummary.deletedEvents.push({ id: ev.id, title: ev.title });
            deletedCount++;
            await db.insert(eventChanges).values({
              eventId: ev.id,
              eventTitle: ev.title,
              changeType: "deleted",
              diffDetails: JSON.stringify({ reason: "hard-resync wipe" }),
              detectedAt: new Date().toISOString(),
            });
          }
          for (const ev of toWipe) {
            await db.delete(events).where(eq(events.id, ev.id));
          }
          log(`Hard-resync: wiped ${toWipe.length} existing event(s) for ${dayHeader}`);
        }
      }
    }

    // Pre-read every existing row for this day's parsed batch in a handful
    // of chunked IN() statements instead of one SELECT per event.
    const existingById = new Map<string, typeof events.$inferSelect>();
    if (!isHardResync) {
      for (let i = 0; i < parsedItems.length; i += WRITE_CHUNK) {
        const ids = parsedItems.slice(i, i + WRITE_CHUNK).map((p) => p.item.id);
        const rows = await db.select().from(events).where(inArray(events.id, ids));
        for (const row of rows) existingById.set(row.id, row);
      }
    }

    type NewEventRow = InferInsertModel<typeof events>;
    type NewChangeRow = InferInsertModel<typeof eventChanges>;
    const pendingCreates: Array<{ event: NewEventRow; change: NewChangeRow }> = [];
    const rehashRows: Array<{ id: string; contentHash: string }> = [];
    const touchIds: string[] = [];

    for (const parsed of parsedItems) {
      try {
        const { item, location, description, track, speakersJson, startsAt, endsAt, durationMinutes, contentHash } =
          parsed;

        // hard-resync already wiped this day's parsed rows above, so
        // `existing` naturally stays missing and every item takes the
        // create path.
        const existing = existingById.get(item.id);

        const now = new Date().toISOString();

        if (!existing) {
          diffSummary.createdEvents.push({
            id: item.id,
            title: item.title,
            location: location || null,
            timeString: item.timeStr || null,
          });
          createdCount++;
          log(`[CREATE] ${item.title}`);

          if (!isDryRun) {
            pendingCreates.push({
              event: {
                id: item.id,
                title: item.title,
                description,
                location,
                track,
                startsAt,
                endsAt,
                durationMinutes,
                day: dayHeader,
                timeString: item.timeStr,
                speakers: speakersJson,
                contentHash,
                firstSeenAt: now,
                lastSeenAt: now,
                isDeleted: 0,
              },
              change: {
                eventId: item.id,
                eventTitle: item.title,
                changeType: isHardResync ? "hard-resync" : "created",
                diffDetails: JSON.stringify({ location, track, startsAt, endsAt }),
                detectedAt: now,
              },
            });
          }
        } else {
          const trackChanged = existing.track !== track;
          const speakersChanged = existing.speakers !== speakersJson;
          const isUncancel = existing.isDeleted === 1;

          if (existing.contentHash !== contentHash || trackChanged || speakersChanged || isUncancel) {
            const diffs: Record<string, { old: unknown; new: unknown }> = {};
            if (existing.title !== item.title) diffs.title = { old: existing.title, new: item.title };
            if (existing.location !== location) diffs.location = { old: existing.location, new: location };
            if (existing.timeString !== item.timeStr) diffs.timeString = { old: existing.timeString, new: item.timeStr };
            if (trackChanged) diffs.track = { old: existing.track, new: track };
            if (existing.startsAt !== startsAt) diffs.startsAt = { old: existing.startsAt, new: startsAt };
            if (existing.endsAt !== endsAt) diffs.endsAt = { old: existing.endsAt, new: endsAt };
            if (existing.description !== description) diffs.description = { old: existing.description, new: description };
            if (speakersChanged) diffs.speakers = { old: existing.speakers, new: speakersJson };

            const hasFieldChanges = Object.keys(diffs).length > 0;

            if (!hasFieldChanges) {
              // No field actually differs (including a pure re-appearance of a
              // previously deleted event with unchanged content) -- just
              // refresh lastSeenAt and persist the freshly computed content
              // hash (it may have migrated even though visible fields didn't).
              if (!isDryRun) {
                rehashRows.push({ id: item.id, contentHash });
              }
            } else {
              const changeType = isUncancel ? "uncancelled" : "updated";
              diffSummary.updatedEvents.push({
                id: item.id,
                title: item.title,
                changes: Object.keys(diffs).join(", ") || "content",
              });
              updatedCount++;
              log(`[UPDATE] ${item.title}: ${Object.keys(diffs).join(", ") || "content"}`);

              if (!isDryRun) {
                await db
                  .update(events)
                  .set({
                    title: item.title,
                    description,
                    location,
                    track,
                    startsAt,
                    endsAt,
                    durationMinutes,
                    day: dayHeader,
                    timeString: item.timeStr,
                    speakers: speakersJson,
                    contentHash,
                    lastSeenAt: now,
                    isDeleted: 0,
                  })
                  .where(eq(events.id, item.id));

                await db.insert(eventChanges).values({
                  eventId: item.id,
                  eventTitle: item.title,
                  changeType,
                  diffDetails: JSON.stringify(diffs),
                  detectedAt: now,
                });
              }
            }
          } else if (!isDryRun) {
            touchIds.push(item.id);
          }
        }
      } catch (e: unknown) {
        log(`Error writing event ${parsed.item.id} (${parsed.item.title}): ${e instanceof Error ? e.message : String(e)}`);
        errorCount++;
      }
    }

    // Flush buffered writes. Multi-row statements keep a full con-scale day
    // inside the Workers subrequest ceiling; a failed chunk degrades to the
    // legacy one-row-at-a-time path so per-event write isolation, error
    // counts, and logs stay identical.
    const flushedAt = new Date().toISOString();
    for (let i = 0; i < pendingCreates.length; i += WRITE_CHUNK) {
      const chunk = pendingCreates.slice(i, i + WRITE_CHUNK);
      try {
        await db.insert(events).values(chunk.map((c) => c.event));
        await db.insert(eventChanges).values(chunk.map((c) => c.change));
      } catch {
        for (const c of chunk) {
          try {
            await db.insert(events).values(c.event);
            await db.insert(eventChanges).values(c.change);
          } catch (e: unknown) {
            log(
              `Error writing event ${String(c.event.id)} (${String(c.event.title)}): ${e instanceof Error ? e.message : String(e)}`,
            );
            errorCount++;
          }
        }
      }
    }
    for (const row of rehashRows) {
      await db.update(events).set({ contentHash: row.contentHash, lastSeenAt: flushedAt, isDeleted: 0 }).where(eq(events.id, row.id));
    }
    for (let i = 0; i < touchIds.length; i += WRITE_CHUNK) {
      await db
        .update(events)
        .set({ lastSeenAt: flushedAt, isDeleted: 0 })
        .where(inArray(events.id, touchIds.slice(i, i + WRITE_CHUNK)));
    }

    // sync/dry-run: anything previously tracked for this day that was not
    // re-scraped is treated as removed from the schedule. Skipped when this
    // run's target list was truncated by maxDetailFetches -- an incomplete
    // scrape can't distinguish "removed upstream" from "not attempted".
    if ((mode === "sync" || isDryRun) && !truncated) {
      const missing = await db
        .select()
        .from(events)
        .where(and(eq(events.day, dayHeader), eq(events.isDeleted, 0)));

      for (const ev of missing) {
        if (scrapedIdsForDay.has(ev.id)) continue;

        diffSummary.deletedEvents.push({ id: ev.id, title: ev.title });
        deletedCount++;
        log(`[DELETE] ${ev.title} no longer found in ${dayHeader} listing`);

        if (!isDryRun) {
          const now = new Date().toISOString();
          await db.update(events).set({ isDeleted: 1, lastSeenAt: now }).where(eq(events.id, ev.id));
          await db.insert(eventChanges).values({
            eventId: ev.id,
            eventTitle: ev.title,
            changeType: "deleted",
            diffDetails: JSON.stringify({ reason: `missing from ${dayHeader} listing` }),
            detectedAt: now,
          });
        }
      }
    }

    log(
      `[DAY SUMMARY] ${dayHeader} (${dayParam}): ${scrapedEventIds.size - dayStartScraped} detail fetches, ` +
        `${createdCount - dayStartCreated} created, ${updatedCount - dayStartUpdated} updated, ` +
        `${deletedCount - dayStartDeleted} deleted, budget left: ${Math.max(detailFetchBudget, 0)}` +
        (truncated ? ", TRUNCATED" : ", complete"),
    );
  }

  log(
    `Ingestion complete: ${scrapedEventIds.size} total scraped, ${createdCount} created, ${updatedCount} updated, ${deletedCount} deleted/cancelled, ${errorCount} errors.`,
  );

  return {
    mode,
    totalScraped: scrapedEventIds.size,
    created: createdCount,
    updated: updatedCount,
    deleted: deletedCount,
    errors: errorCount,
    diffSummary,
    log: logs,
  };
}

export interface RunLoggedIngestResult extends IngestResult {
  runId: number;
}

/**
 * Runs an ingestion and records its lifecycle in the `ingestion_runs` history
 * (running -> completed | failed). Every entry point (admin route, legacy
 * route, cron) must call this instead of `runIngestion` so scheduled and
 * legacy executions appear in the admin run history. `userId` attributes the
 * run; scheduled cron runs use the `"cron"` sentinel.
 */
export async function runIngestionWithRunLog(
  options: IngestOptions & { userId?: string | null } = {},
): Promise<RunLoggedIngestResult> {
  const [run] = await db
    .insert(ingestionRuns)
    .values({
      userId: options.userId ?? "cron",
      mode: options.mode ?? "sync",
      status: "running",
      days: options.days ? JSON.stringify(options.days) : null,
    })
    .returning();

  try {
    const result = await runIngestion(options);
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
      .where(eq(ingestionRuns.id, run.id));
    return { ...result, runId: run.id };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      await db
        .update(ingestionRuns)
        .set({ status: "failed", errorMessage: message, completedAt: new Date().toISOString() })
        .where(eq(ingestionRuns.id, run.id));
    } catch {
      // Swallow so the original ingestion error propagates below.
    }
    throw error;
  }
}
