export interface User {
  id: string;
  username: string;
  name: string;
  role?: string;
}

export interface IngestionRun {
  id: number;
  userId: string;
  mode: string;
  status: string;
  days: string | null;
  stats: string | null;
  log: string | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

// `started_at`/`completed_at` come from SQLite `datetime('now')` -- UTC wall
// time with no zone suffix. Normalize to UTC, then render in con time (ET).
export function formatRunTimestamp(raw: string | null): string {
  if (!raw) return "-";
  const normalized = /Z$|[+-]\d{2}:?\d{2}$/.test(raw) ? raw : `${raw}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export interface IngestDiffSummary {
  createdEvents?: Array<{ id: string; title: string; location?: string; time?: string }>;
  updatedEvents?: Array<{ id: string; title?: string; changes?: string }>;
  deletedEvents?: Array<{ id: string; title?: string }>;
}

export interface FeedbackItem {
  id: string;
  userId: string | null;
  username: string | null;
  kind: string;
  message: string;
  contact: string | null;
  appVersion: string | null;
  userAgent: string | null;
  pageUrl: string | null;
  status: string;
  createdAt: string;
}

export const FEEDBACK_ACTIONS: Record<string, Array<{ label: string; next: string }>> = {
  new: [
    { label: "Start", next: "in_progress" },
    { label: "Complete", next: "done" },
    { label: "Archive", next: "archived" },
  ],
  in_progress: [
    { label: "Complete", next: "done" },
    { label: "Archive", next: "archived" },
  ],
  done: [
    { label: "Reopen", next: "new" },
    { label: "Archive", next: "archived" },
  ],
  archived: [{ label: "Reopen", next: "new" }],
};

export interface IngestResult {
  runId?: number;
  mode: string;
  totalScraped?: number;
  created?: number;
  updated?: number;
  deleted?: number;
  errors?: number;
  diffSummary?: IngestDiffSummary;
  log?: string[];
}

export const DAY_OPTIONS = [
  { label: "All Days", value: "All" },
  { label: "Thu", value: "Thursday" },
  { label: "Fri", value: "Friday" },
  { label: "Sat", value: "Saturday" },
  { label: "Sun", value: "Sunday" },
  { label: "Mon", value: "Monday" },
];

export interface AdminDbStats {
  totalActiveEvents: number;
  totalDeletedEvents: number;
  eventsByDay: Record<string, number>;
  totalUsers: number;
  usage?: AdminUsageStats;
}

export interface AdminUsageStats {
  totalSaves: number;
  usersWithSaves: number;
  goingCount: number;
  interestedCount: number;
  medianSavesPerActiveUser: number;
  /** ET calendar date (YYYY-MM-DD) of the save action -> count, ascending by key. */
  savesByDate: Array<{ date: string; count: number }>;
  /** Fixed order: "0", "1-5", "6-20", "21+". */
  scheduleSizeBuckets: Array<{ label: string; users: number }>;
  /** Top 10, count desc then name asc. */
  topTracks: Array<{ name: string; count: number }>;
  /** Top 10, count desc then name asc. */
  topLocations: Array<{ name: string; count: number }>;
  /** events.day -> saved-event count, count desc then name asc. */
  savesByConDay: Array<{ name: string; count: number }>;
  /** Top 8 (con day, ET hour) buckets, count desc then day/hour asc. */
  peakHours: Array<{ day: string; hour: number; count: number }>;
}

export interface BadgeStyle {
  bg: string;
  color: string;
  border?: string;
  label?: string;
}

export const RUN_MODE_STYLES: Record<string, BadgeStyle> = {
  "hard-resync": { bg: "rgba(248,113,113,0.2)", color: "#f87171" },
  "dry-run": { bg: "rgba(168,85,247,0.2)", color: "#c084fc" },
  sync: { bg: "rgba(34,211,238,0.2)", color: "#22d3ee" },
};

export const RUN_STATUS_STYLES: Record<string, BadgeStyle> = {
  completed: { bg: "rgba(74,222,128,0.2)", color: "#4ade80" },
  failed: { bg: "rgba(248,113,113,0.2)", color: "#f87171" },
  running: { bg: "rgba(250,204,21,0.2)", color: "#facc15" },
};

export const FEEDBACK_KIND_STYLES: Record<string, BadgeStyle> = {
  bug: {
    bg: "rgba(229, 72, 77, 0.15)",
    color: "var(--coral-500)",
    border: "1px solid rgba(229, 72, 77, 0.3)",
    label: "BUG",
  },
  idea: {
    bg: "rgba(255, 193, 7, 0.15)",
    color: "var(--gold-400)",
    border: "1px solid rgba(255, 193, 7, 0.3)",
    label: "IDEA",
  },
};

export const FEEDBACK_STATUS_STYLES: Record<string, BadgeStyle> = {
  in_progress: {
    bg: "rgba(168, 85, 247, 0.15)",
    color: "var(--purple-300)",
    border: "1px solid rgba(168, 85, 247, 0.3)",
    label: "IN PROGRESS",
  },
  done: {
    bg: "rgba(168, 85, 247, 0.15)",
    color: "#4ade80",
    border: "1px solid rgba(168, 85, 247, 0.3)",
    label: "DONE",
  },
  archived: {
    bg: "rgba(255, 255, 255, 0.08)",
    color: "var(--text-tertiary)",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    label: "ARCHIVED",
  },
};

export function parseRunStats(
  stats: string | null | Record<string, number>,
): { created?: number; updated?: number; deleted?: number } | null {
  if (!stats) return null;
  if (typeof stats === "object") return stats;
  try {
    return JSON.parse(stats) as { created?: number; updated?: number; deleted?: number };
  } catch {
    return null;
  }
}
