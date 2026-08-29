export interface User {
  id: string;
  username: string;
  name: string;
  role?: string;
  shareSchedule?: number;
}

export interface EventItem {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  track: string | null;
  startsAt: string | null;
  endsAt: string | null;
  durationMinutes: number | null;
  day: string | null;
  timeString: string | null;
  speakers: string | null;
  contentHash: string;
  status?: "live" | "soon" | "done" | "upcoming";
}

export interface UserEventItem {
  id: string;
  userId: string;
  eventId: string;
  status: "going" | "interested";
  notes: string | null;
  addedAt: string;
  event?: EventItem | null;
}

export interface Conflict {
  event1Id: string;
  event2Id: string;
  title1: string;
  title2: string;
}

export interface EventChange {
  id: number;
  eventId: string;
  eventTitle: string;
  changeType: string;
  diffDetails: string | null;
  detectedAt: string;
}

export interface ToastState {
  message: string;
  type: "ok" | "warn";
  actionLabel?: string;
  onAction?: () => void;
}

export const TRACK_COLORS: Record<string, string> = {
  "MAIN PROGRAMMING": "var(--purple-400)",
  COSPLAY: "var(--gold-500)",
  "SCI-FI LIT": "var(--cyan-500)",
  "FANTASY LITERATURE": "var(--cyan-500)",
  LITERATURE: "var(--cyan-500)",
  GAMING: "var(--jade-500)",
  "VIDEO GAMING": "var(--jade-500)",
  "ANIME & MANGA": "var(--coral-500)",
  ANIMATION: "var(--coral-500)",
  "SCIENCE & SPACE": "var(--grey-300)",
  SCIENCE: "var(--grey-300)",
  "ROBOTICS & MAKERS": "var(--gold-400)",
  "PUPPETRY TRACK": "var(--purple-300)",
  HORROR: "var(--coral-600)",
  WORKSHOPS: "var(--gold-500)",
  COSTUMING: "var(--gold-500)",
};
