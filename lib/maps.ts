import { VENUE_MAPS, type RoomCoordinate, type VenueBooth, type VenueMapInfo } from "./maps-data.ts";

export { VENUE_MAPS, type RoomCoordinate, type VenueBooth, type VenueMapInfo };

export interface VenueMapMatchResult {
  map: VenueMapInfo;
  booth: VenueBooth | null;
  officialPlaceUrl: string;
  roomName: string | null;
  hasCoordinates: boolean;
}

/**
 * Returns the official Core-Apps deep link for an event, allowing attendees to rate the session.
 */
export function getOfficialEventUrl(eventId: string | null | undefined): string | null {
  if (!eventId) return null;
  // Core-Apps event IDs are 32-character hex strings
  const cleaned = eventId.trim();
  if (!cleaned) return null;
  return `https://app.core-apps.com/dragoncon26/event/${cleaned}`;
}

/**
 * Resolves an event location string (e.g. "Marriott Atrium Ballroom", "Hilton 301", "Hyatt Centennial I")
 * to its corresponding venue map, exact booth polygon coordinates (if available), and official Core-Apps URL.
 */
export function resolveVenueMap(locationStr: string | null | undefined): VenueMapMatchResult {
  const fallbackMap =
    VENUE_MAPS.find((m) => m.slug === "convention-footprint") || VENUE_MAPS[0];

  if (!locationStr || !locationStr.trim()) {
    return {
      map: fallbackMap,
      booth: null,
      officialPlaceUrl: fallbackMap.officialUrl,
      roomName: null,
      hasCoordinates: false,
    };
  }

  const raw = locationStr.trim();
  const lower = raw.toLowerCase();

  // 1. Try exact or partial room/booth name matching across all venues
  for (const vMap of VENUE_MAPS) {
    for (const booth of vMap.booths) {
      const bLower = booth.name.toLowerCase();
      if (lower === bLower || lower.includes(bLower) || bLower.includes(lower)) {
        return {
          map: vMap,
          booth,
          officialPlaceUrl: vMap.officialUrl,
          roomName: booth.name,
          hasCoordinates: (booth.coordinates?.length ?? 0) > 0,
        };
      }
    }
  }

  // 2. Match venue by hotel/building keywords if no specific booth matched
  let matchedSlug: string | null = null;

  if (lower.includes("marriott")) {
    matchedSlug = "marriott";
  } else if (lower.includes("hyatt")) {
    matchedSlug = "hyatt";
  } else if (lower.includes("hilton")) {
    matchedSlug = "hilton";
  } else if (lower.includes("westin")) {
    matchedSlug = "westin";
  } else if (
    lower.includes("courtland") ||
    lower.includes("sheraton") ||
    lower.includes("fandangles")
  ) {
    matchedSlug = "courtland-grand";
  } else if (lower.includes("americasmart") || lower.includes("building 2") || lower.includes("b2")) {
    matchedSlug = lower.includes("building 3") || lower.includes("b3") ? "americasmart-b3" : "americasmart-b2";
  } else if (lower.includes("building 3") || lower.includes("b3")) {
    matchedSlug = "americasmart-b3";
  } else if (lower.includes("aquarium")) {
    matchedSlug = "aquarium-shuttle";
  } else if (lower.includes("parade")) {
    matchedSlug = "parade-shuttle";
  } else if (lower.includes("shuttle")) {
    matchedSlug = "shuttles";
  }

  if (matchedSlug) {
    const vMap = VENUE_MAPS.find((m) => m.slug === matchedSlug) || fallbackMap;
    return {
      map: vMap,
      booth: null,
      officialPlaceUrl: vMap.officialUrl,
      roomName: raw,
      hasCoordinates: false,
    };
  }

  // 3. Fallback to convention footprint overview map
  return {
    map: fallbackMap,
    booth: null,
    officialPlaceUrl: fallbackMap.officialUrl,
    roomName: raw,
    hasCoordinates: false,
  };
}

/**
 * Formats booth coordinates into SVG polygon points string: "x1,y1 x2,y2 ..."
 */
export function getPolygonPointsString(coordinates: RoomCoordinate[] | undefined | null): string {
  if (!coordinates || coordinates.length === 0) return "";
  return coordinates.map((pt) => `${pt.x},${pt.y}`).join(" ");
}

/**
 * Computes bounding box and centroid (center x, center y) of booth coordinates.
 */
export function getBoothCentroidAndBounds(coordinates: RoomCoordinate[] | undefined | null): {
  cx: number;
  cy: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} | null {
  if (!coordinates || coordinates.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let sumX = 0;
  let sumY = 0;

  for (const pt of coordinates) {
    if (pt.x < minX) minX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y > maxY) maxY = pt.y;
    sumX += pt.x;
    sumY += pt.y;
  }

  const count = coordinates.length;
  return {
    cx: sumX / count,
    cy: sumY / count,
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
