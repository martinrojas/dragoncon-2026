// Dragon Con Atlanta Core Venues & Walk Time Matrix (in minutes)

export const CORE_VENUES = [
  "HYATT",
  "MARRIOTT",
  "HILTON",
  "SHERATON",
  "WESTIN",
  "AMERICASMART",
] as const;

export type CoreVenue = typeof CORE_VENUES[number];

const WALK_MATRIX: Record<CoreVenue, Record<CoreVenue, { minutes: number; path: string }>> = {
  HYATT: {
    HYATT: { minutes: 0, path: "Same venue" },
    MARRIOTT: { minutes: 4, path: "Hyatt → Marriott" },
    HILTON: { minutes: 7, path: "Hyatt → Hilton" },
    SHERATON: { minutes: 10, path: "Hyatt → Courtland" },
    WESTIN: { minutes: 12, path: "Hyatt → Westin" },
    AMERICASMART: { minutes: 8, path: "Hyatt → AmericasMart" },
  },
  MARRIOTT: {
    HYATT: { minutes: 4, path: "Marriott → Hyatt" },
    MARRIOTT: { minutes: 0, path: "Same venue" },
    HILTON: { minutes: 5, path: "Marriott → Hilton" },
    SHERATON: { minutes: 8, path: "Marriott → Courtland" },
    WESTIN: { minutes: 11, path: "Marriott → Westin" },
    AMERICASMART: { minutes: 10, path: "Marriott → AmericasMart" },
  },
  HILTON: {
    HYATT: { minutes: 7, path: "Hilton → Hyatt" },
    MARRIOTT: { minutes: 5, path: "Hilton → Marriott" },
    HILTON: { minutes: 0, path: "Same venue" },
    SHERATON: { minutes: 6, path: "Hilton → Courtland" },
    WESTIN: { minutes: 14, path: "Hilton → Westin" },
    AMERICASMART: { minutes: 12, path: "Hilton → AmericasMart" },
  },
  SHERATON: {
    HYATT: { minutes: 10, path: "Courtland → Hyatt" },
    MARRIOTT: { minutes: 8, path: "Courtland → Marriott" },
    HILTON: { minutes: 6, path: "Courtland → Hilton" },
    SHERATON: { minutes: 0, path: "Same venue" },
    WESTIN: { minutes: 15, path: "Courtland → Westin" },
    AMERICASMART: { minutes: 14, path: "Courtland → AmericasMart" },
  },
  WESTIN: {
    HYATT: { minutes: 12, path: "Westin → Hyatt" },
    MARRIOTT: { minutes: 11, path: "Westin → Marriott" },
    HILTON: { minutes: 14, path: "Westin → Hilton" },
    SHERATON: { minutes: 15, path: "Westin → Courtland" },
    WESTIN: { minutes: 0, path: "Same venue" },
    AMERICASMART: { minutes: 6, path: "Westin → AmericasMart" },
  },
  AMERICASMART: {
    HYATT: { minutes: 8, path: "AmericasMart → Hyatt" },
    MARRIOTT: { minutes: 10, path: "AmericasMart → Marriott" },
    HILTON: { minutes: 12, path: "AmericasMart → Hilton" },
    SHERATON: { minutes: 14, path: "AmericasMart → Courtland" },
    WESTIN: { minutes: 6, path: "AmericasMart → Westin" },
    AMERICASMART: { minutes: 0, path: "Same venue" },
  },
};

export function normalizeVenue(venueStr: string | null | undefined): CoreVenue | null {
  if (!venueStr) return null;
  const upper = venueStr.toUpperCase();
  if (upper.includes("HYATT")) return "HYATT";
  if (upper.includes("MARRIOTT")) return "MARRIOTT";
  if (upper.includes("HILTON")) return "HILTON";
  if (upper.includes("SHERATON") || upper.includes("COURTLAND")) return "SHERATON";
  if (upper.includes("WESTIN")) return "WESTIN";
  if (upper.includes("MART") || upper.includes("AMERICA")) return "AMERICASMART";
  return null;
}

export function calculateWalkTime(
  venueA: string | null | undefined,
  venueB: string | null | undefined,
): { minutes: number; path: string } {
  const normA = normalizeVenue(venueA);
  const normB = normalizeVenue(venueB);

  if (!normA || !normB) {
    return { minutes: 8, path: "Con Floor Walk" };
  }

  return WALK_MATRIX[normA][normB];
}

export function getVenueCapacityStatus(
  timeString: string | null,
  venue: string | null,
): { pct: number; status: string; accent: string } {
  // Deterministic capacity heuristic derived from venue & title strings
  let hash = 0;
  const seed = (timeString || "") + (venue || "");
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const pct = 45 + (Math.abs(hash) % 50); // 45% - 94%

  if (pct > 85) {
    return { pct, status: "Line forming at door", accent: "var(--coral-500)" };
  } else if (pct > 70) {
    return { pct, status: "Filling up", accent: "var(--gold-500)" };
  } else {
    return { pct, status: "Seating available", accent: "var(--jade-500)" };
  }
}
