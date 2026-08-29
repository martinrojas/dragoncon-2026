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
}
