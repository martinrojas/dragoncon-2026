import { useEffect, useState, type FormEvent } from "react";
import { cleanUrlParam } from "../../../lib/squadUtils.ts";
import type { EventItem, User, UserEventItem } from "../homeTypes.ts";

export interface UseSquadOptions {
  currentUser: User | null;
  triggerToast: (message: string, type?: "ok" | "warn", actionLabel?: string, onAction?: () => void) => void;
  /** Accepted for API-contract consistency with the plan; the friend-conflict check below only needs `agendaItems`. */
  userEventStatusMap: Record<string, "going" | "interested">;
  /** Accepted for API-contract consistency with the plan; not exercised by squad logic (see task-3-report.md deviations). */
  checkEventConflict: (eventId: string) => boolean;
  /** Sourced from `useAgenda().agendaItems` — needed to flag time-overlap conflicts on a friend's un-saved panels. */
  agendaItems: UserEventItem[];
  /** Sourced from `useHomeAuth().updateCurrentUser` — the privacy toggle patches `currentUser.shareSchedule`. */
  updateCurrentUser: (updater: (prev: User) => User) => void;
}

export function useSquad({ currentUser, triggerToast, agendaItems, updateCurrentUser }: UseSquadOptions) {
  const [friendsList, setFriendsList] = useState<User[]>([]);
  const [friendUsernameInput, setFriendUsernameInput] = useState("");
  const [selectedFriend, setSelectedFriend] = useState<User | null>(null);
  const [friendSharedEvents, setFriendSharedEvents] = useState<EventItem[]>([]);
  const [friendMsg, setFriendMsg] = useState("");
  const [pendingInvite, setPendingInvite] = useState<string | null>(null);
  const [friendEventsList, setFriendEventsList] = useState<EventItem[]>([]);
  const [friendScheduleHidden, setFriendScheduleHidden] = useState(false);
  const [friendViewMode, setFriendViewMode] = useState<"all" | "overlap">("all");
  const [shareScheduleState, setShareScheduleState] = useState(true);

  const cleanInviteUrlParam = () => cleanUrlParam("invite");

  // Resolve a ?invite=<username> deep link on mount, persisting it across login/registration.
  useEffect(() => {
    const inviteParam = new URLSearchParams(window.location.search).get("invite");
    if (inviteParam) {
      sessionStorage.setItem("dc_pending_invite", inviteParam);
      setPendingInvite(inviteParam);
    } else {
      const savedInvite = sessionStorage.getItem("dc_pending_invite");
      if (savedInvite) setPendingInvite(savedInvite);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync Squad privacy toggle state whenever the logged-in user changes.
  useEffect(() => {
    setShareScheduleState(currentUser ? currentUser.shareSchedule !== 0 : true);
  }, [currentUser]);

  // Clear a self-invite (user opened their own squad share link) and clean the URL.
  useEffect(() => {
    if (currentUser && pendingInvite && pendingInvite.toLowerCase() === currentUser.username.toLowerCase()) {
      setPendingInvite(null);
      sessionStorage.removeItem("dc_pending_invite");
      cleanInviteUrlParam();
    }
  }, [currentUser, pendingInvite]);

  // Load Friends List
  const loadFriends = async (userId: string) => {
    try {
      const res = await fetch(`/api/friends?userId=${userId}`);
      const data = (await res.json()) as { success: boolean; friends: User[] };
      if (data.success) {
        setFriendsList(data.friends);
      }
    } catch (e: unknown) {
      console.error("Failed to load friends", e);
    }
  };

  // Compare Schedule with a Friend
  const handleCompareFriend = async (friend: User) => {
    if (!currentUser) return;
    setSelectedFriend(friend);
    setFriendViewMode("all");
    setFriendEventsList([]);
    setFriendSharedEvents([]);
    try {
      const res = await fetch(`/api/friends?userId=${currentUser.id}&friendId=${friend.id}`);
      const data = (await res.json()) as {
        success: boolean;
        friendEvents?: EventItem[];
        sharedEvents?: EventItem[];
        scheduleHidden?: boolean;
      };
      if (data.success) {
        setFriendEventsList(data.friendEvents || []);
        setFriendSharedEvents(data.sharedEvents || []);
        setFriendScheduleHidden(!!data.scheduleHidden);
      }
    } catch (e: unknown) {
      console.error(e);
    }
  };

  // Add Friend
  const handleAddFriend = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser || !friendUsernameInput.trim()) return;
    setFriendMsg("");

    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id, friendUsername: friendUsernameInput.trim() }),
      });
      const data = (await res.json()) as { success: boolean; message: string; error?: string };
      if (data.success) {
        setFriendMsg(data.message);
        setFriendUsernameInput("");
        loadFriends(currentUser.id);
        triggerToast("Squad member added!", "ok");
      } else {
        setFriendMsg(data.error || "Failed to add friend");
      }
    } catch {
      setFriendMsg("Network error adding friend");
    }
  };

  // Accept a pending squad invite from a shared link
  const handleAcceptInvite = async () => {
    if (!currentUser || !pendingInvite) return;
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id, friendUsername: pendingInvite }),
      });
      const data = (await res.json()) as { success: boolean; error?: string };
      if (data.success) {
        loadFriends(currentUser.id);
        triggerToast("Squad member added!", "ok");
      } else {
        triggerToast(data.error || "Failed to add friend", "warn");
      }
    } catch (e: unknown) {
      console.error("Failed to accept squad invite", e);
    } finally {
      setPendingInvite(null);
      sessionStorage.removeItem("dc_pending_invite");
      cleanInviteUrlParam();
    }
  };

  const handleDismissInvite = () => {
    setPendingInvite(null);
    sessionStorage.removeItem("dc_pending_invite");
    cleanInviteUrlParam();
  };

  // Toggle Squad schedule sharing privacy
  const handleTogglePrivacy = async () => {
    if (!currentUser) return;
    const newValue = !shareScheduleState;
    setShareScheduleState(newValue);
    try {
      const res = await fetch("/api/user/privacy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id, shareSchedule: newValue }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        shareSchedule?: number;
        error?: string;
      };
      if (data.success) {
        updateCurrentUser((prev) => ({ ...prev, shareSchedule: data.shareSchedule ?? (newValue ? 1 : 0) }));
        triggerToast(
          newValue ? "Full schedule shared with Squad" : "Schedule set to private (mutual overlap only)",
          "ok",
        );
      } else {
        setShareScheduleState(!newValue);
        triggerToast(data.error || "Failed to update privacy setting", "warn");
      }
    } catch (e: unknown) {
      console.error("Failed to update privacy setting", e);
      setShareScheduleState(!newValue);
      triggerToast("Network error updating privacy setting", "warn");
    }
  };

  // Conflict checker for a friend's event against the current user's own saved schedule
  const checkFriendEventConflict = (ev: EventItem): boolean => {
    if (!ev.startsAt || !ev.endsAt) return false;
    const evStart = new Date(ev.startsAt).getTime();
    const evEnd = new Date(ev.endsAt).getTime();
    return agendaItems.some((item) => {
      const other = item.event;
      if (item.status !== "going" || !other || item.eventId === ev.id) return false;
      if (other.day !== ev.day || !other.startsAt || !other.endsAt) return false;
      const oStart = new Date(other.startsAt).getTime();
      const oEnd = new Date(other.endsAt).getTime();
      return evStart < oEnd && oStart < evEnd;
    });
  };

  return {
    friendsList,
    friendUsernameInput,
    setFriendUsernameInput,
    selectedFriend,
    friendSharedEvents,
    friendMsg,
    pendingInvite,
    friendEventsList,
    friendScheduleHidden,
    friendViewMode,
    setFriendViewMode,
    shareScheduleState,
    loadFriends,
    handleAddFriend,
    handleCompareFriend,
    handleAcceptInvite,
    handleDismissInvite,
    handleTogglePrivacy,
    cleanInviteUrlParam,
    checkFriendEventConflict,
  };
}
