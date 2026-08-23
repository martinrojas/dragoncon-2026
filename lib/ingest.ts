import * as cheerio from "cheerio";
import { and, db, eq } from "void/db";
import { eventChanges, events } from "../db/schema.ts";

const BASE_URL = "https://app.core-apps.com/dragoncon26";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface IngestOptions {
  days?: string[];
  maxDetailFetches?: number;
  mode?: "sync" | "dry-run" | "hard-resync";
  onProgress?: (msg: string) => void;
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

  log(`Starting Dragon Con 2026 schedule ingestion (mode: ${mode})...`);

  let createdCount = 0;
  let updatedCount = 0;
  let deletedCount = 0;
  let errorCount = 0;

  const diffSummary: IngestDiffSummary = {
    createdEvents: [],
    updatedEvents: [],
    deletedEvents: [],
  };

  const daysToFetch =
    options.days && options.days.length > 0
      ? options.days
      : ["Sep++2", "Sep++3", "Sep++4", "Sep++5", "Sep++6", "Sep++7", "Sep++8"];

  const scrapedEventIds = new Set<string>();

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

    log(`Found ${eventLinks.length} events for day ${dayHeader}`);

    const scrapedIdsForDay = new Set<string>();

    const limit = options.maxDetailFetches ?? eventLinks.length;
    const targets = eventLinks.slice(0, limit);
    const truncated = targets.length !== eventLinks.length;

    // Scrape and parse every targeted event's detail page into memory
    // first. The hard-resync day reset below only runs after this loop
    // completes, so a handful of failed detail fetches (or a crash
    // mid-scrape) can never wipe rows we have no replacement data for.
    const parsedItems: Array<{
      item: (typeof targets)[number];
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

    for (const item of targets) {
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

    for (const parsed of parsedItems) {
      try {
        const { item, location, description, track, speakersJson, startsAt, endsAt, durationMinutes, contentHash } =
          parsed;

        // hard-resync already wiped this day's parsed rows above, so
        // `existing` naturally comes back empty and every item takes the
        // create path.
        const existing = isHardResync
          ? undefined
          : (await db.select().from(events).where(eq(events.id, item.id)))[0];

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
            await db.insert(events).values({
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
            });

            await db.insert(eventChanges).values({
              eventId: item.id,
              eventTitle: item.title,
              changeType: isHardResync ? "hard-resync" : "created",
              diffDetails: JSON.stringify({ location, track, startsAt, endsAt }),
              detectedAt: now,
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
                await db
                  .update(events)
                  .set({ contentHash, lastSeenAt: now, isDeleted: 0 })
                  .where(eq(events.id, item.id));
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
            await db
              .update(events)
              .set({ lastSeenAt: now, isDeleted: 0 })
              .where(eq(events.id, item.id));
          }
        }
      } catch (e: unknown) {
        log(`Error writing event ${parsed.item.id} (${parsed.item.title}): ${e instanceof Error ? e.message : String(e)}`);
        errorCount++;
      }
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
