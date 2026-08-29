import type { EventItem } from "./scheduleUtils.ts";

export function calculateMutualOverlap(
  userStatusMap: Record<string, "going" | "interested">,
  friendEvents: EventItem[],
): EventItem[] {
  return friendEvents.filter((ev) => !!userStatusMap[ev.id]);
}

export function isSelfInvite(
  currentUsername: string | null | undefined,
  inviteCode: string | null | undefined,
): boolean {
  if (!currentUsername || !inviteCode) return false;
  return currentUsername.trim().toLowerCase() === inviteCode.trim().toLowerCase();
}

export function cleanUrlParam(paramName: string): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete(paramName);
  window.history.replaceState({}, "", url.pathname + url.search + url.hash);
}
