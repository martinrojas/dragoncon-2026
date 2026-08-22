import * as cheerio from "cheerio";
import { db, eq } from "void/db";
import { eventChanges, events } from "../db/schema";

const BASE_URL = "https://app.core-apps.com/dragoncon26";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface IngestOptions {
  days?: string[];
  maxDetailFetches?: number;
  onProgress?: (msg: string) => void;
}

export interface IngestResult {
  totalScraped: number;
  created: number;
  updated: number;
  deleted: number;
  errors: number;
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

export async function runIngestion(options: IngestOptions = {}): Promise<IngestResult> {
  const logs: string[] = [];
  const log = (msg: string) => {
    logs.push(msg);
    if (options.onProgress) options.onProgress(msg);
  };

  log("Starting Dragon Con 2026 schedule ingestion...");

  let createdCount = 0;
  let updatedCount = 0;
  let deletedCount = 0;
  let errorCount = 0;

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

    const limit = options.maxDetailFetches ?? eventLinks.length;
    const targets = eventLinks.slice(0, limit);

    for (const item of targets) {
      scrapedEventIds.add(item.id);
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

        const contentRaw = `${item.title}|${location}|${track}|${startsAt}|${endsAt}|${description}|${speakers.join(",")}`;
        const contentHash = await computeHash(contentRaw);

        // Check existing record
        const [existing] = await db.select().from(events).where(eq(events.id, item.id));

        const now = new Date().toISOString();

        if (!existing) {
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
            speakers: JSON.stringify(speakers),
            contentHash,
            firstSeenAt: now,
            lastSeenAt: now,
            isDeleted: 0,
          });

          await db.insert(eventChanges).values({
            eventId: item.id,
            eventTitle: item.title,
            changeType: "created",
            diffDetails: JSON.stringify({ location, track, startsAt, endsAt }),
            detectedAt: now,
          });

          createdCount++;
        } else if (existing.contentHash !== contentHash || existing.isDeleted === 1) {
          const diffs: Record<string, { old: unknown; new: unknown }> = {};
          if (existing.title !== item.title) diffs.title = { old: existing.title, new: item.title };
          if (existing.location !== location) diffs.location = { old: existing.location, new: location };
          if (existing.track !== track) diffs.track = { old: existing.track, new: track };
          if (existing.startsAt !== startsAt) diffs.startsAt = { old: existing.startsAt, new: startsAt };
          if (existing.endsAt !== endsAt) diffs.endsAt = { old: existing.endsAt, new: endsAt };
          if (existing.description !== description) diffs.description = { old: existing.description, new: description };

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
              speakers: JSON.stringify(speakers),
              contentHash,
              lastSeenAt: now,
              isDeleted: 0,
            })
            .where(eq(events.id, item.id));

          await db.insert(eventChanges).values({
            eventId: item.id,
            eventTitle: item.title,
            changeType: existing.isDeleted ? "uncancelled" : "updated",
            diffDetails: JSON.stringify(diffs),
            detectedAt: now,
          });

          updatedCount++;
        } else {
          await db
            .update(events)
            .set({ lastSeenAt: now, isDeleted: 0 })
            .where(eq(events.id, item.id));
        }
      } catch (e: unknown) {
        log(`Error processing event ${item.id}: ${e instanceof Error ? e.message : String(e)}`);
        errorCount++;
      }
    }
  }

  log(
    `Ingestion complete: ${scrapedEventIds.size} total scraped, ${createdCount} created, ${updatedCount} updated, ${deletedCount} deleted/cancelled, ${errorCount} errors.`,
  );

  return {
    totalScraped: scrapedEventIds.size,
    created: createdCount,
    updated: updatedCount,
    deleted: deletedCount,
    errors: errorCount,
    log: logs,
  };
}
