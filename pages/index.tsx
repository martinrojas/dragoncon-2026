import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import { useEffect, useRef, useState, type FormEvent, type JSX } from "react";
import { PanelDetailModal, type EventItem } from "../components/PanelDetailModal";
import { calculateWalkTime, CORE_VENUES, type CoreVenue } from "../lib/walktime";
import type { Props } from "./index.server";

interface User {
  id: string;
  username: string;
  name: string;
}

interface UserEventItem {
  id: string;
  userId: string;
  eventId: string;
  status: "going" | "interested";
  notes: string | null;
  addedAt: string;
  event?: EventItem | null;
}

interface Conflict {
  event1Id: string;
  event2Id: string;
  title1: string;
  title2: string;
}

interface EventChange {
  id: number;
  eventId: string;
  eventTitle: string;
  changeType: string;
  diffDetails: string | null;
  detectedAt: string;
}

interface ToastState {
  message: string;
  type: "ok" | "warn";
  onUndo?: () => void;
}

export default function HomePage({
  totalEvents,
  initialEvents,
  tracks,
  days,
  locations,
  recentChanges,
}: Props): JSX.Element {
  const [activeTab, setActiveTab] = useState<"schedule" | "agenda" | "friends" | "changes" | "profile">("schedule");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [, setUserToken] = useState<string>("");

  // WebAuthn Passkey Support
  const [supportsPasskeys, setSupportsPasskeys] = useState(false);

  // Auth modal / form state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authError, setAuthError] = useState("");

  // Event Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDay, setSelectedDay] = useState("");
  const [selectedTrack, setSelectedTrack] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [eventsList, setEventsList] = useState<EventItem[]>(initialEvents as EventItem[]);
  const [isSearching, setIsSearching] = useState(false);

  // Advanced Filter Sheet Drawer
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [filterTracks, setFilterTracks] = useState<string[]>([]);
  const [filterHideEnded, setFilterHideEnded] = useState(false);
  const [filterHideConflicts, setFilterHideConflicts] = useState(false);
  const [filterWalkableUnder10, setFilterWalkableUnder10] = useState(false);

  // Saved Agenda & Conflicts
  const [agendaItems, setAgendaItems] = useState<UserEventItem[]>([]);
  const [agendaConflicts, setAgendaConflicts] = useState<Conflict[]>([]);
  const [userEventStatusMap, setUserEventStatusMap] = useState<Record<string, "going" | "interested">>({});

  // Active Detail Modal Item
  const [activeDetailItem, setActiveDetailItem] = useState<EventItem | null>(null);

  // Toast Engine
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  // Friends & Overlap
  const [friendsList, setFriendsList] = useState<User[]>([]);
  const [friendUsernameInput, setFriendUsernameInput] = useState("");
  const [selectedFriend, setSelectedFriend] = useState<User | null>(null);
  const [friendSharedEvents, setFriendSharedEvents] = useState<EventItem[]>([]);
  const [friendMsg, setFriendMsg] = useState("");

  // Ingest Sync & Offline Status
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  // Profile & Con Preferences State
  const [alertReminders, setAlertReminders] = useState(true);
  const [alertWalkTime, setAlertWalkTime] = useState(true);
  const [alertHaptics, setAlertHaptics] = useState(false);
  const [timeFormat, setTimeFormat] = useState<"12h" | "24h">("12h");
  const [homeVenue, setHomeVenue] = useState<string>("Hyatt Regency");

  // Show Toast Notification with 3200ms auto-dismiss and Undo support
  const showToast = (message: string, type: "ok" | "warn" = "ok", onUndo?: () => void) => {
    if (toastTimeoutRef.current !== null) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    setToast({ message, type, onUndo });
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3200);
  };

  // Initialize Auth, Preferences & Service Worker
  useEffect(() => {
    setSupportsPasskeys(browserSupportsWebAuthn());

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(console.error);
    }

    setIsOnline(navigator.onLine);
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    const savedUser = localStorage.getItem("dc_user");
    const savedToken = localStorage.getItem("dc_token");
    if (savedUser && savedToken) {
      try {
        const parsed = JSON.parse(savedUser) as User;
        setCurrentUser(parsed);
        setUserToken(savedToken);
        loadUserAgenda(parsed.id);
        loadFriends(parsed.id);
      } catch {
        // ignore invalid saved JSON
      }
    }

    const savedHomeVenue = localStorage.getItem("dc_home_venue");
    if (savedHomeVenue) setHomeVenue(savedHomeVenue);

    const savedTimeFormat = localStorage.getItem("dc_time_format");
    if (savedTimeFormat === "12h" || savedTimeFormat === "24h") setTimeFormat(savedTimeFormat);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      if (toastTimeoutRef.current !== null) window.clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  // Fetch filtered events when search or main filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (selectedDay) params.set("day", selectedDay);
    if (selectedTrack) params.set("track", selectedTrack);
    if (selectedLocation) params.set("location", selectedLocation);

    setIsSearching(true);
    fetch(`/api/events?${params.toString()}`)
      .then((res) => res.json() as Promise<{ success: boolean; events: EventItem[] }>)
      .then((data) => {
        if (data.success) {
          setEventsList(data.events);
        }
      })
      .catch(console.error)
      .finally(() => setIsSearching(false));
  }, [searchQuery, selectedDay, selectedTrack, selectedLocation]);

  // Load User Agenda
  const loadUserAgenda = async (userId: string) => {
    try {
      const res = await fetch(`/api/schedule?userId=${userId}`);
      const data = (await res.json()) as {
        success: boolean;
        items: UserEventItem[];
        conflicts: Conflict[];
      };
      if (data.success) {
        setAgendaItems(data.items);
        setAgendaConflicts(data.conflicts);

        const statusMap: Record<string, "going" | "interested"> = {};
        for (const item of data.items) {
          statusMap[item.eventId] = item.status;
        }
        setUserEventStatusMap(statusMap);
      }
    } catch (e: unknown) {
      console.error("Failed to load user agenda", e);
    }
  };

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

  // 1-Click Passkey Login
  const handlePasskeyLogin = async () => {
    setAuthError("");
    try {
      const optRes = await fetch("/api/auth/passkey?action=generate-login-options", {
        method: "POST",
      });
      const optData = (await optRes.json()) as {
        success: boolean;
        options: PublicKeyRequestOptionsResponse;
        error?: string;
      };
      if (!optData.success) throw new Error(optData.error || "Failed to get login options");

      const assertionResponse = await startAuthentication({
        optionsJSON: optData.options as unknown as PublicKeyCredentialRequestOptionsJSON,
      });

      const verifyRes = await fetch("/api/auth/passkey?action=verify-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assertionResponse,
          expectedChallenge: optData.options.challenge,
        }),
      });

      const verifyData = (await verifyRes.json()) as {
        success: boolean;
        user: User;
        token: string;
        error?: string;
      };

      if (verifyData.success) {
        setCurrentUser(verifyData.user);
        setUserToken(verifyData.token);
        localStorage.setItem("dc_user", JSON.stringify(verifyData.user));
        localStorage.setItem("dc_token", verifyData.token);
        loadUserAgenda(verifyData.user.id);
        loadFriends(verifyData.user.id);
        setShowAuthModal(false);
        showToast(`Welcome back, ${verifyData.user.name}!`, "ok");
      } else {
        setAuthError(verifyData.error || "Passkey login failed");
      }
    } catch (e: unknown) {
      console.error(e);
      const isNotAllowed = e instanceof Error && e.name === "NotAllowedError";
      setAuthError(
        isNotAllowed
          ? "Passkey prompt cancelled or DevTools virtual authenticator not active."
          : e instanceof Error
          ? e.message
          : "Passkey login failed",
      );
    }
  };

  // 1-Click Quick Passkey Signup & Registration
  const handleQuickPasskeyRegister = async () => {
    if (!authUsername.trim()) {
      setAuthError("Username is required to create a passkey account");
      return;
    }
    setAuthError("");

    try {
      const optRes = await fetch("/api/auth/passkey?action=quick-register-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: authUsername.trim(),
          name: authName.trim() || authUsername.trim(),
        }),
      });
      const optData = (await optRes.json()) as {
        success: boolean;
        user: User;
        options: PublicKeyCreationOptionsResponse;
        error?: string;
      };
      if (!optData.success) throw new Error(optData.error || "Failed to start registration");

      const registrationResponse = await startRegistration({
        optionsJSON: optData.options as unknown as PublicKeyCredentialCreationOptionsJSON,
      });

      const verifyRes = await fetch("/api/auth/passkey?action=verify-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: optData.user.id,
          registrationResponse,
          expectedChallenge: optData.options.challenge,
        }),
      });

      const verifyData = (await verifyRes.json()) as {
        success: boolean;
        user: User | null;
        token: string;
        error?: string;
      };

      if (verifyData.success && verifyData.user) {
        setCurrentUser(verifyData.user);
        setUserToken(verifyData.token);
        localStorage.setItem("dc_user", JSON.stringify(verifyData.user));
        localStorage.setItem("dc_token", verifyData.token);
        loadUserAgenda(verifyData.user.id);
        loadFriends(verifyData.user.id);
        setShowAuthModal(false);
        showToast(`Account created for ${verifyData.user.name}!`, "ok");
      } else {
        setAuthError(verifyData.error || "Failed to save passkey");
      }
    } catch (e: unknown) {
      console.error(e);
      const isNotAllowed = e instanceof Error && e.name === "NotAllowedError";
      setAuthError(
        isNotAllowed
          ? "Passkey prompt cancelled or DevTools virtual authenticator not active."
          : e instanceof Error
          ? e.message
          : "Passkey registration failed",
      );
    }
  };

  // Register Passkey for current user
  const handleRegisterPasskey = async () => {
    if (!currentUser) return;
    try {
      const optRes = await fetch("/api/auth/passkey?action=generate-register-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id, username: currentUser.username }),
      });
      const optData = (await optRes.json()) as {
        success: boolean;
        options: PublicKeyCreationOptionsResponse;
        error?: string;
      };
      if (!optData.success) throw new Error(optData.error || "Failed to get registration options");

      const registrationResponse = await startRegistration({
        optionsJSON: optData.options as unknown as PublicKeyCredentialCreationOptionsJSON,
      });

      const verifyRes = await fetch("/api/auth/passkey?action=verify-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          registrationResponse,
          expectedChallenge: optData.options.challenge,
        }),
      });

      const verifyData = (await verifyRes.json()) as { success: boolean; error?: string };
      if (verifyData.success) {
        showToast("🎉 Passkey registered successfully! 1-click biometric login enabled.", "ok");
      } else {
        showToast(verifyData.error || "Failed to register passkey", "warn");
      }
    } catch (e: unknown) {
      console.error(e);
      showToast(e instanceof Error ? e.message : "Passkey registration cancelled", "warn");
    }
  };

  // Compare Schedule with a Friend
  const handleCompareFriend = async (friend: User) => {
    if (!currentUser) return;
    setSelectedFriend(friend);
    try {
      const res = await fetch(`/api/friends?userId=${currentUser.id}&friendId=${friend.id}`);
      const data = (await res.json()) as { success: boolean; sharedEvents: EventItem[] };
      if (data.success) {
        setFriendSharedEvents(data.sharedEvents);
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
        body: JSON.stringify({
          userId: currentUser.id,
          friendUsername: friendUsernameInput.trim(),
        }),
      });
      const data = (await res.json()) as { success: boolean; message: string; error?: string };
      if (data.success) {
        setFriendMsg(data.message);
        setFriendUsernameInput("");
        loadFriends(currentUser.id);
        showToast(`Added ${friendUsernameInput.trim()} to squad!`, "ok");
      } else {
        setFriendMsg(data.error || "Failed to add friend");
      }
    } catch (e: unknown) {
      console.error(e);
      setFriendMsg("Network error adding friend");
    }
  };

  // Check if a target event has a conflict with existing saved items in agenda
  const checkEventOverlap = (target: EventItem, excludeId?: string): EventItem | null => {
    for (const item of agendaItems) {
      const ev = item.event;
      if (!ev || ev.id === (excludeId || target.id)) continue;
      // Overlap condition: starts before other ends and ends after other starts
      if (target.startsAt && target.endsAt && ev.startsAt && ev.endsAt) {
        if (target.startsAt < ev.endsAt && target.endsAt > ev.startsAt) {
          return ev;
        }
      } else if (target.day && ev.day && target.day === ev.day) {
        if (target.timeString && ev.timeString && target.timeString === ev.timeString) {
          return ev;
        }
      }
    }
    return null;
  };

  // Helper to execute explicit schedule mutations (add/remove/status restore) without stale closure toggle issues
  const executeScheduleMutation = async (
    eventId: string,
    action: "add" | "remove",
    status: "going" | "interested" = "going",
  ) => {
    if (!currentUser) return;

    setUserEventStatusMap((prev) => {
      const updated = { ...prev };
      if (action === "remove") {
        delete updated[eventId];
      } else {
        updated[eventId] = status;
      }
      return updated;
    });

    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          eventId,
          action,
          status,
        }),
      });
      const data = (await res.json()) as { success: boolean };
      if (data.success) {
        loadUserAgenda(currentUser.id);
      }
    } catch (e: unknown) {
      console.error("Failed to update schedule", e);
    }
  };

  // Toggle Agenda Event ('going' | 'interested' | remove) with Toast Notification Engine
  const handleToggleEvent = async (
    eventId: string,
    newStatus: "going" | "interested",
    suppressToast = false,
  ) => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }

    const currentStatus = userEventStatusMap[eventId];
    const isRemoving = currentStatus === newStatus || (currentStatus && !newStatus);
    const action = isRemoving ? "remove" : "add";
    const statusToRestore = currentStatus || "going";

    // Find the event object for toast messaging
    const targetEvent =
      eventsList.find((e) => e.id === eventId) ||
      agendaItems.find((a) => a.eventId === eventId)?.event ||
      (activeDetailItem?.id === eventId ? activeDetailItem : null);

    if (!suppressToast && targetEvent) {
      if (isRemoving) {
        showToast(`Removed "${targetEvent.title}" from your schedule.`, "ok", () => {
          executeScheduleMutation(eventId, "add", statusToRestore);
        });
      } else {
        const overlappingEvent = checkEventOverlap(targetEvent, eventId);
        if (overlappingEvent) {
          showToast(
            `Added — overlaps "${overlappingEvent.title}".`,
            "warn",
            () => {
              executeScheduleMutation(eventId, "remove");
            },
          );
        } else {
          showToast(`Added to your schedule.`, "ok", () => {
            executeScheduleMutation(eventId, "remove");
          });
        }
      }
    }

    await executeScheduleMutation(eventId, action, newStatus);
  };

  // Clear Entire User Schedule
  const handleClearSchedule = async () => {
    if (!currentUser) return;
    if (!window.confirm("Are you sure you want to clear your entire Dragon Con schedule?")) return;

    try {
      for (const item of agendaItems) {
        await fetch("/api/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: currentUser.id,
            eventId: item.eventId,
            action: "remove",
          }),
        });
      }
      setAgendaItems([]);
      setUserEventStatusMap({});
      setAgendaConflicts([]);
      showToast("Schedule cleared.", "ok");
    } catch (e: unknown) {
      console.error("Failed to clear schedule", e);
    }
  };

  // Trigger Data Ingestion Sync
  const handleRunSync = async () => {
    setIsSyncing(true);
    setSyncStatusMsg("Fetching latest Dragon Con 2026 data...");
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: ["Sep++3"], maxDetailFetches: 10 }),
      });
      const data = (await res.json()) as {
        success: boolean;
        result: { totalScraped: number; created: number; updated: number };
        error?: string;
      };
      if (data.success) {
        setSyncStatusMsg(
          `Sync Complete! Scraped ${data.result.totalScraped} events (${data.result.created} new, ${data.result.updated} updated).`,
        );
        setLastSyncTime(new Date());
        const evRes = await fetch("/api/events");
        const evData = (await evRes.json()) as { success: boolean; events: EventItem[] };
        if (evData.success) setEventsList(evData.events);
        showToast("Schedule synced with official database!", "ok");
      } else {
        setSyncStatusMsg(`Sync error: ${data.error}`);
      }
    } catch (e: unknown) {
      console.error(e);
      setSyncStatusMsg("Failed to run sync");
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle Auth Form Submission
  const handleAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: authMode,
          username: authUsername,
          password: authPassword,
          name: authName,
        }),
      });

      const data = (await res.json()) as {
        success: boolean;
        user: User;
        token: string;
        error?: string;
      };
      if (data.success) {
        setCurrentUser(data.user);
        setUserToken(data.token);
        localStorage.setItem("dc_user", JSON.stringify(data.user));
        localStorage.setItem("dc_token", data.token);
        setShowAuthModal(false);
        setAuthUsername("");
        setAuthPassword("");
        setAuthName("");
        loadUserAgenda(data.user.id);
        loadFriends(data.user.id);
        showToast(`Logged in as ${data.user.name}`, "ok");
      } else {
        setAuthError(data.error || "Authentication failed");
      }
    } catch (e: unknown) {
      console.error(e);
      setAuthError("Network error during auth");
    }
  };

  // Logout
  const handleLogout = () => {
    setCurrentUser(null);
    setUserToken("");
    localStorage.removeItem("dc_user");
    localStorage.removeItem("dc_token");
    setAgendaItems([]);
    setUserEventStatusMap({});
    setAgendaConflicts([]);
    showToast("Logged out.", "ok");
  };

  // Calculate preceding venue for any panel on a given day
  const getPrecedingVenue = (targetItem: EventItem | null): string | null => {
    if (!targetItem) return homeVenue;
    const targetDay = targetItem.day;
    const daySaved = agendaItems
      .filter((a) => a.event && (!targetDay || a.event.day === targetDay) && a.eventId !== targetItem.id)
      .map((a) => a.event!)
      .sort((a, b) => (a.startsAt || "").localeCompare(b.startsAt || ""));

    if (daySaved.length === 0) return homeVenue;

    // Find the saved panel right before this one
    const preceding = daySaved
      .filter((ev) => (ev.startsAt || "") < (targetItem.startsAt || ""))
      .pop();

    return preceding?.location || homeVenue;
  };

  // Calculate sum of walk times between consecutive saved panels for a given day
  const calculateTotalWalkTimeForDay = (dayStr: string | null): number => {
    const daySaved = agendaItems
      .filter((a) => a.event && (!dayStr || a.event.day === dayStr))
      .map((a) => a.event!)
      .sort((a, b) => (a.startsAt || "").localeCompare(b.startsAt || ""));

    if (daySaved.length <= 1) return 0;

    let totalMins = 0;
    for (let i = 0; i < daySaved.length - 1; i++) {
      const locA = daySaved[i].location;
      const locB = daySaved[i + 1].location;
      totalMins += calculateWalkTime(locA, locB).minutes;
    }
    return totalMins;
  };

  // Apply Advanced Filter Sheet options to eventsList
  const filteredEvents = eventsList.filter((ev) => {
    // Multi-track filter
    if (filterTracks.length > 0) {
      if (!ev.track || !filterTracks.includes(ev.track)) return false;
    }

    // Hide panels that have ended
    if (filterHideEnded && ev.endsAt) {
      const endTime = new Date(ev.endsAt).getTime();
      if (!isNaN(endTime) && endTime < Date.now()) return false;
    }

    // Hide conflicts with user schedule
    if (filterHideConflicts && currentUser) {
      if (checkEventOverlap(ev)) return false;
    }

    // Walkable in under 10 minutes from previous saved panel
    if (filterWalkableUnder10) {
      const prevVenue = getPrecedingVenue(ev);
      const walk = calculateWalkTime(prevVenue, ev.location);
      if (walk.minutes > 10) return false;
    }

    return true;
  });

  // Group events by time for TimeRail layout
  const groupEventsByTime = (items: EventItem[]) => {
    const map = new Map<string, EventItem[]>();
    for (const item of items) {
      let timeLabel = "VARIES";
      if (item.timeString) {
        const parts = item.timeString.split("—");
        timeLabel = parts[0]?.trim() || "VARIES";
      }
      if (!map.has(timeLabel)) map.set(timeLabel, []);
      map.get(timeLabel)!.push(item);
    }
    return Array.from(map.entries());
  };

  const groupedEvents = groupEventsByTime(filteredEvents);

  // Minutes since last sync calculation
  const minutesSinceSync = Math.max(
    0,
    Math.floor((Date.now() - lastSyncTime.getTime()) / (1000 * 60)),
  );

  // Active day in My Agenda tab (defaults to first day with saved panels or selectedDay)
  const agendaDay = selectedDay || days[0] || "Fri";
  const savedItemsForAgendaDay = agendaItems.filter(
    (a) => !selectedDay || a.event?.day === selectedDay,
  );
  const totalWalkTime = calculateTotalWalkTimeForDay(selectedDay || null);

  // Derive badge number from user ID
  const badgeId = currentUser
    ? `BADGE DC-40-${currentUser.id.replace(/^usr_/, "").toUpperCase().slice(0, 6).padEnd(6, "X")}`
    : "BADGE DC-40-GUEST";

  // User initials for digital badge
  const userInitials = currentUser
    ? currentUser.name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "DC";

  return (
    <>
      <link rel="stylesheet" href="/cyberdragon.css" />

      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "var(--canvas)",
          color: "var(--text-primary)",
          fontFamily: "var(--font-core)",
          paddingBottom: 80,
        }}
      >
        {/* CyberDragon App Bar Header */}
        <header
          style={{
            backgroundColor: "var(--surface-glass-strong)",
            backdropFilter: "var(--blur-bar)",
            WebkitBackdropFilter: "var(--blur-bar)",
            borderBottom: "1px solid var(--line-hairline)",
            boxShadow: "var(--shadow-2)",
            position: "sticky",
            top: 0,
            zIndex: 100,
          }}
        >
          <div style={{ height: 2, background: "var(--grad-rule)" }} />

          <div
            style={{
              maxWidth: 900,
              margin: "0 auto",
              padding: "10px var(--gutter)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                className="cd-label"
                style={{ fontSize: 10, letterSpacing: ".14em", color: "var(--text-tertiary)" }}
              >
                DRAGON CON '26 · ATLANTA GA
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h1
                  style={{
                    margin: 0,
                    fontSize: 20,
                    fontWeight: 700,
                    letterSpacing: "-.02em",
                    color: "var(--text-primary)",
                  }}
                >
                  Cyber<span style={{ color: "var(--gold-500)" }}>Dragon</span>
                </h1>
                <span className="cd-badge cd-badge-purple" style={{ fontSize: 9 }}>
                  {totalEvents} PANELS
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: isOnline ? "var(--jade-500)" : "var(--coral-500)",
                    fontWeight: 600,
                  }}
                >
                  {isOnline ? "● LIVE" : "○ OFFLINE"}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                onClick={handleRunSync}
                disabled={isSyncing}
                className="cd-btn cd-btn-ghost"
                style={{ fontSize: 12, padding: "4px 10px", height: 32 }}
              >
                {isSyncing ? "SYNCING..." : "🔄 SYNC"}
              </button>

              {currentUser ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setActiveTab("profile")}
                    className="cd-btn cd-btn-ghost"
                    style={{
                      padding: "3px 10px",
                      fontSize: 12,
                      borderColor: activeTab === "profile" ? "var(--purple-400)" : "var(--line-subtle)",
                      color: "var(--gold-400)",
                    }}
                  >
                    👤 {currentUser.name}
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="cd-btn cd-btn-ghost"
                    style={{ fontSize: 11, padding: "4px 8px", height: 28 }}
                  >
                    LOG OUT
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 6 }}>
                  {supportsPasskeys && (
                    <button
                      type="button"
                      onClick={handlePasskeyLogin}
                      className="cd-btn cd-btn-primary"
                      style={{
                        fontSize: 12,
                        padding: "6px 12px",
                        background: "var(--grad-brand)",
                        border: "none",
                      }}
                    >
                      ⚡ 1-CLICK LOGIN
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowAuthModal(true)}
                    className="cd-btn cd-btn-signal"
                    style={{ fontSize: 12, padding: "6px 12px" }}
                  >
                    LOG IN
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Sync Notification Banner */}
        {syncStatusMsg && (
          <div
            style={{
              backgroundColor: "var(--purple-900)",
              borderBottom: "1px solid var(--line-purple)",
              color: "var(--gold-500)",
              padding: "8px var(--gutter)",
              textAlign: "center",
              font: "var(--type-data)",
            }}
          >
            {syncStatusMsg}
          </div>
        )}

        {/* Main Content Area */}
        <main
          style={{
            maxWidth: 900,
            margin: "0 auto",
            padding: "16px var(--gutter) 40px var(--gutter)",
          }}
        >
          {/* Top Segmented Navigation Tabs */}
          <nav
            style={{
              display: "flex",
              backgroundColor: "var(--surface-2)",
              borderRadius: "var(--r-panel)",
              border: "1px solid var(--line-hairline)",
              padding: 4,
              marginBottom: 16,
              boxShadow: "var(--shadow-1)",
              gap: 2,
            }}
          >
            {[
              { id: "schedule" as const, label: "📅 SCHEDULE" },
              { id: "agenda" as const, label: `⭐ MY AGENDA (${agendaItems.length})` },
              { id: "friends" as const, label: "👥 SQUAD" },
              { id: "changes" as const, label: `🔔 UPDATES (${recentChanges.length})` },
              { id: "profile" as const, label: "👤 PROFILE" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  padding: "10px 4px",
                  border: "none",
                  borderRadius: "var(--r-control)",
                  backgroundColor: activeTab === tab.id ? "var(--purple-600)" : "transparent",
                  color: activeTab === tab.id ? "var(--text-primary)" : "var(--text-tertiary)",
                  font: "var(--type-label)",
                  cursor: "pointer",
                  transition: "all var(--t-control)",
                  boxShadow: activeTab === tab.id ? "var(--shadow-1), var(--inner-lip)" : "none",
                }}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* ============================================================== */}
          {/* TAB 1: SCHEDULE GRID WITH TIME RAIL & ADVANCED FILTERS         */}
          {/* ============================================================== */}
          {activeTab === "schedule" && (
            <div>
              {/* Day Strip Component */}
              <div
                className="cd-scroll"
                style={{
                  display: "flex",
                  gap: 8,
                  overflowX: "auto",
                  paddingBottom: 12,
                  marginBottom: 12,
                }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedDay("")}
                  className={`cd-day-chip ${selectedDay === "" ? "active" : ""}`}
                >
                  <span>ALL DAYS</span>
                </button>
                {days.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDay(d)}
                    className={`cd-day-chip ${selectedDay === d ? "active" : ""}`}
                  >
                    <span>{d.toUpperCase()}</span>
                  </button>
                ))}
              </div>

              {/* Search & Filter Header Bar */}
              <div className="cd-glass-panel" style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ display: "flex", flex: "1 1 100%", gap: 8 }}>
                    <input
                      type="text"
                      placeholder="Search panels, guests, venues, tracks..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        flex: 1,
                        padding: "10px 14px",
                        borderRadius: "var(--r-control)",
                        border: "1px solid var(--line-subtle)",
                        backgroundColor: "var(--surface-inset)",
                        color: "var(--text-primary)",
                        font: "var(--type-body-sm)",
                        boxSizing: "border-box",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowFilterSheet(true)}
                      className="cd-btn"
                      style={{
                        backgroundColor:
                          filterTracks.length > 0 ||
                          filterHideEnded ||
                          filterHideConflicts ||
                          filterWalkableUnder10
                            ? "var(--purple-600)"
                            : "var(--surface-2)",
                        borderColor:
                          filterTracks.length > 0 ||
                          filterHideEnded ||
                          filterHideConflicts ||
                          filterWalkableUnder10
                            ? "var(--purple-400)"
                            : "var(--line-subtle)",
                        color: "var(--text-primary)",
                        padding: "0 14px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      ⚡ FILTERS{" "}
                      {filterTracks.length > 0 ||
                      filterHideEnded ||
                      filterHideConflicts ||
                      filterWalkableUnder10
                        ? `(${
                            filterTracks.length +
                            (filterHideEnded ? 1 : 0) +
                            (filterHideConflicts ? 1 : 0) +
                            (filterWalkableUnder10 ? 1 : 0)
                          })`
                        : ""}
                    </button>
                  </div>

                  {/* Track selector */}
                  <select
                    value={selectedTrack}
                    onChange={(e) => setSelectedTrack(e.target.value)}
                    style={{
                      flex: 1,
                      minWidth: 140,
                      padding: 8,
                      borderRadius: "var(--r-control)",
                      backgroundColor: "var(--surface-inset)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--line-subtle)",
                      font: "var(--type-label)",
                    }}
                  >
                    <option value="">ALL FAN TRACKS</option>
                    {tracks.map((t) => (
                      <option key={t} value={t}>
                        {t.toUpperCase()}
                      </option>
                    ))}
                  </select>

                  {/* Location selector */}
                  <select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    style={{
                      flex: 1,
                      minWidth: 130,
                      padding: 8,
                      borderRadius: "var(--r-control)",
                      backgroundColor: "var(--surface-inset)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--line-subtle)",
                      font: "var(--type-label)",
                    }}
                  >
                    <option value="">ALL VENUES / ROOMS</option>
                    {locations.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Time Rail Layout */}
              {isSearching && (
                <div
                  style={{
                    textAlign: "center",
                    color: "var(--text-tertiary)",
                    font: "var(--type-data)",
                    padding: 30,
                  }}
                >
                  SEARCHING GRID...
                </div>
              )}

              {!isSearching && filteredEvents.length === 0 && (
                <div
                  className="cd-glass-panel"
                  style={{ textAlign: "center", color: "var(--text-tertiary)", padding: 30 }}
                >
                  NO PANELS FOUND MATCHING FILTER CRITERIA.
                </div>
              )}

              {!isSearching &&
                groupedEvents.map(([timeSlot, slotEvents]) => (
                  <div key={timeSlot} className="cd-time-rail">
                    {/* Mono Time Column */}
                    <div className="cd-rail-time active">{timeSlot}</div>

                    {/* Content Column */}
                    <div className="cd-rail-content">
                      {slotEvents.map((ev) => {
                        const userStatus = userEventStatusMap[ev.id];
                        const isSaved = !!userStatus;
                        return (
                          <div
                            key={ev.id}
                            className="cd-glass-panel"
                            style={{
                              borderLeft:
                                userStatus === "going"
                                  ? "4px solid var(--purple-500)"
                                  : userStatus === "interested"
                                  ? "4px solid var(--gold-500)"
                                  : "1px solid var(--line-hairline)",
                              boxShadow:
                                userStatus === "going"
                                  ? "var(--glow-purple)"
                                  : userStatus === "interested"
                                  ? "var(--glow-gold)"
                                  : "var(--shadow-2)",
                              cursor: "pointer",
                            }}
                            onClick={() => setActiveDetailItem(ev)}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "flex-start",
                                gap: 10,
                              }}
                            >
                              <div style={{ flex: 1 }}>
                                <h3
                                  style={{
                                    margin: "0 0 6px 0",
                                    font: "var(--type-subhead)",
                                    color: "var(--text-primary)",
                                  }}
                                >
                                  {ev.title}
                                </h3>
                                <div
                                  className="cd-data"
                                  style={{
                                    color: "var(--text-secondary)",
                                    fontSize: 12,
                                    display: "flex",
                                    gap: 12,
                                    flexWrap: "wrap",
                                    marginBottom: 6,
                                  }}
                                >
                                  <span>🕒 {ev.timeString || "TBD"}</span>
                                  <span>📍 {ev.location || "VENUE TBD"}</span>
                                </div>
                              </div>

                              {/* Save buttons */}
                              <div
                                style={{ display: "flex", gap: 6 }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleToggleEvent(ev.id, "going")}
                                  className="cd-btn"
                                  style={{
                                    padding: "4px 8px",
                                    fontSize: 11,
                                    backgroundColor:
                                      userStatus === "going" ? "var(--purple-600)" : "var(--surface-2)",
                                    color:
                                      userStatus === "going" ? "var(--text-primary)" : "var(--text-secondary)",
                                    borderColor:
                                      userStatus === "going" ? "var(--purple-400)" : "var(--line-subtle)",
                                  }}
                                >
                                  {userStatus === "going" ? "✓ GOING" : "GOING"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleEvent(ev.id, "interested")}
                                  className="cd-btn"
                                  style={{
                                    padding: "4px 8px",
                                    fontSize: 11,
                                    backgroundColor:
                                      userStatus === "interested" ? "var(--signal-quiet)" : "var(--surface-2)",
                                    color:
                                      userStatus === "interested" ? "var(--gold-500)" : "var(--text-secondary)",
                                    borderColor:
                                      userStatus === "interested" ? "var(--line-gold)" : "var(--line-subtle)",
                                  }}
                                >
                                  {userStatus === "interested" ? "★ STAR" : "STAR"}
                                </button>
                              </div>
                            </div>

                            {/* Track Tag & Badges */}
                            <div
                              style={{
                                marginTop: 8,
                                display: "flex",
                                gap: 8,
                                alignItems: "center",
                                flexWrap: "wrap",
                              }}
                            >
                              {ev.track && <span className="cd-badge cd-badge-purple">{ev.track}</span>}
                              {ev.day && (
                                <span
                                  className="cd-badge"
                                  style={{
                                    background: "var(--surface-3)",
                                    color: "var(--text-tertiary)",
                                  }}
                                >
                                  {ev.day}
                                </span>
                              )}
                              {isSaved && (
                                <span className="cd-badge cd-badge-gold">
                                  {userStatus === "going" ? "SAVED" : "STARRED"}
                                </span>
                              )}
                            </div>

                            {ev.description && (
                              <p
                                style={{
                                  margin: "8px 0 0 0",
                                  font: "var(--type-body-sm)",
                                  color: "var(--text-tertiary)",
                                  lineHeight: "1.4",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                }}
                              >
                                {ev.description}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: MY AGENDA & SCHEDULE LOAD DASHBOARD                     */}
          {/* ============================================================== */}
          {activeTab === "agenda" && (
            <div>
              {!currentUser ? (
                <div className="cd-glass-panel cd-notch" style={{ padding: 30, textAlign: "center" }}>
                  <h2 style={{ font: "var(--type-heading)", color: "var(--gold-500)", marginBottom: 8 }}>
                    SIGN IN TO BUILD YOUR SCHEDULE
                  </h2>
                  <p style={{ font: "var(--type-body)", color: "var(--text-secondary)", marginBottom: 20 }}>
                    Save panels, calculate walk times, track con stamina load, and sync with your squad.
                  </p>

                  {supportsPasskeys && (
                    <button
                      type="button"
                      onClick={handlePasskeyLogin}
                      className="cd-btn cd-btn-primary"
                      style={{
                        padding: "12px 24px",
                        fontSize: 14,
                        marginBottom: 12,
                        background: "var(--grad-brand)",
                      }}
                    >
                      ⚡ 1-CLICK PASSKEY LOGIN
                    </button>
                  )}

                  <div>
                    <button
                      type="button"
                      onClick={() => setShowAuthModal(true)}
                      className="cd-btn cd-btn-signal"
                    >
                      LOG IN WITH PASSWORD
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  {/* Schedule Load Dashboard Component */}
                  <div
                    className="cd-glass-panel cd-notch"
                    style={{
                      marginBottom: 16,
                      background: "var(--surface-glass-strong)",
                      border: "1px solid var(--line-purple)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 10,
                      }}
                    >
                      <span className="cd-label" style={{ color: "var(--gold-400)" }}>
                        {selectedDay ? `${selectedDay.toUpperCase()} STAMINA LOAD` : "CON SCHEDULE LOAD"}
                      </span>
                      <span className="cd-data" style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
                        {savedItemsForAgendaDay.length} / 8 MAX SLOTS
                      </span>
                    </div>

                    {/* Progress Meter with 8 Ticks */}
                    <div className="cd-progress-meter" style={{ marginBottom: 16 }}>
                      <div className="cd-progress-track">
                        {Array.from({ length: 8 }).map((_, idx) => {
                          const isActive = idx < savedItemsForAgendaDay.length;
                          const isWarn = savedItemsForAgendaDay.length > 8 && idx === 7;
                          return (
                            <div
                              key={idx}
                              className={`cd-progress-tick ${isActive ? "active" : ""} ${
                                isWarn ? "warn" : ""
                              }`}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {/* 3-Column Metrics Grid */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: 10,
                      }}
                    >
                      <div className="cd-datacard">
                        <div className="cd-label">SAVED</div>
                        <div className="cd-datacard-value" style={{ color: "var(--purple-300)" }}>
                          {savedItemsForAgendaDay.length}
                        </div>
                        <div className="cd-data" style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                          PANELS
                        </div>
                      </div>

                      <div className="cd-datacard">
                        <div className="cd-label">CONFLICTS</div>
                        <div
                          className="cd-datacard-value"
                          style={{
                            color: agendaConflicts.length > 0 ? "var(--coral-500)" : "var(--text-primary)",
                          }}
                        >
                          {agendaConflicts.length}
                        </div>
                        <div
                          className="cd-data"
                          style={{
                            fontSize: 10,
                            color: agendaConflicts.length > 0 ? "var(--coral-500)" : "var(--text-tertiary)",
                          }}
                        >
                          {agendaConflicts.length > 0 ? "OVERLAPS" : "CLEAN"}
                        </div>
                      </div>

                      <div className="cd-datacard">
                        <div className="cd-label">TOTAL WALK</div>
                        <div className="cd-datacard-value" style={{ color: "var(--gold-500)" }}>
                          {totalWalkTime} <span style={{ fontSize: 12 }}>MIN</span>
                        </div>
                        <div className="cd-data" style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                          CON FLOOR
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Conflict Warnings Banner */}
                  {agendaConflicts.length > 0 && (
                    <div
                      style={{
                        background: "rgba(229,72,77,.12)",
                        border: "1px solid var(--coral-500)",
                        borderRadius: "var(--r-panel)",
                        padding: 14,
                        marginBottom: 16,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span className="cd-badge cd-badge-coral">
                          ⚠️ CONFLICT DETECTED ({agendaConflicts.length})
                        </span>
                      </div>
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: 20,
                          color: "var(--coral-500)",
                          font: "var(--type-body-sm)",
                        }}
                      >
                        {agendaConflicts.map((c, i) => (
                          <li key={i}>
                            <strong>{c.title1}</strong> OVERLAPS WITH <strong>{c.title2}</strong>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Day Filter Strip for Agenda */}
                  <div
                    className="cd-scroll"
                    style={{
                      display: "flex",
                      gap: 8,
                      overflowX: "auto",
                      paddingBottom: 10,
                      marginBottom: 14,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedDay("")}
                      className={`cd-day-chip ${selectedDay === "" ? "active" : ""}`}
                    >
                      <span>ALL ({agendaItems.length})</span>
                    </button>
                    {days.map((d) => {
                      const dayCount = agendaItems.filter((a) => a.event?.day === d).length;
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setSelectedDay(d)}
                          className={`cd-day-chip ${selectedDay === d ? "active" : ""}`}
                        >
                          <span>
                            {d.toUpperCase()} ({dayCount})
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Agenda Header Controls */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 16,
                    }}
                  >
                    <span className="cd-label" style={{ fontSize: 13, color: "var(--text-primary)" }}>
                      SAVED PANELS ({savedItemsForAgendaDay.length})
                    </span>
                    <a
                      href={`/api/export-ics?userId=${currentUser.id}`}
                      download
                      className="cd-btn cd-btn-signal"
                      style={{ fontSize: 12, padding: "6px 12px" }}
                    >
                      📅 EXPORT .ICS
                    </a>
                  </div>

                  {/* Saved Events List with Walk Time Connectors */}
                  {savedItemsForAgendaDay.length === 0 ? (
                    <div
                      className="cd-glass-panel"
                      style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}
                    >
                      You haven't saved any panels for this day. Go to the{" "}
                      <button
                        type="button"
                        onClick={() => setActiveTab("schedule")}
                        style={{
                          color: "var(--gold-400)",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontWeight: "bold",
                        }}
                      >
                        Schedule
                      </button>{" "}
                      tab to star panels!
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {savedItemsForAgendaDay.map((item, idx) => {
                        const ev = item.event;
                        if (!ev) return null;

                        // Calculate walk from previous item in list
                        const prevItem = idx > 0 ? savedItemsForAgendaDay[idx - 1].event : null;
                        const walkFromPrev = prevItem
                          ? calculateWalkTime(prevItem.location, ev.location)
                          : calculateWalkTime(homeVenue, ev.location);

                        return (
                          <div key={item.id}>
                            {idx > 0 && (
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  padding: "4px 14px",
                                  color: "var(--gold-400)",
                                  fontSize: 11,
                                  fontFamily: "var(--font-mono)",
                                }}
                              >
                                <span>↓ {walkFromPrev.minutes} min walk</span>
                                <span style={{ color: "var(--text-tertiary)" }}>({walkFromPrev.path})</span>
                              </div>
                            )}

                            <div
                              className="cd-glass-panel"
                              style={{
                                borderLeft: "4px solid var(--purple-500)",
                                cursor: "pointer",
                              }}
                              onClick={() => setActiveDetailItem(ev)}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "flex-start",
                                }}
                              >
                                <div style={{ flex: 1 }}>
                                  <h3
                                    style={{
                                      margin: "0 0 4px 0",
                                      font: "var(--type-subhead)",
                                      color: "var(--text-primary)",
                                    }}
                                  >
                                    {ev.title}
                                  </h3>
                                  <div
                                    className="cd-data"
                                    style={{
                                      color: "var(--text-secondary)",
                                      fontSize: 12,
                                      display: "flex",
                                      gap: 12,
                                      flexWrap: "wrap",
                                    }}
                                  >
                                    <span>🕒 {ev.timeString || "TBD"}</span>
                                    <span>📍 {ev.location || "TBD"}</span>
                                    {ev.track && (
                                      <span className="cd-badge cd-badge-purple">{ev.track}</span>
                                    )}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleEvent(ev.id, item.status);
                                  }}
                                  className="cd-btn"
                                  style={{
                                    backgroundColor: "rgba(229,72,77,.2)",
                                    color: "var(--coral-500)",
                                    borderColor: "var(--coral-500)",
                                    padding: "4px 8px",
                                    fontSize: 11,
                                  }}
                                >
                                  REMOVE
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 3: FRIENDS & SQUAD OVERLAP                                 */}
          {/* ============================================================== */}
          {activeTab === "friends" && (
            <div>
              {!currentUser ? (
                <div className="cd-glass-panel cd-notch" style={{ padding: 30, textAlign: "center" }}>
                  <h2 style={{ font: "var(--type-heading)", color: "var(--gold-500)", marginBottom: 8 }}>
                    CONNECT WITH YOUR SQUAD
                  </h2>
                  <p style={{ font: "var(--type-body)", color: "var(--text-secondary)", marginBottom: 16 }}>
                    Add your con buddies by username to compare schedules and find shared panels.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAuthModal(true)}
                    className="cd-btn cd-btn-signal"
                  >
                    LOG IN
                  </button>
                </div>
              ) : (
                <div>
                  {/* Add Friend Form */}
                  <form
                    onSubmit={handleAddFriend}
                    className="cd-glass-panel"
                    style={{ marginBottom: 16, display: "flex", gap: 8 }}
                  >
                    <input
                      type="text"
                      placeholder="Enter squad member's username..."
                      value={friendUsernameInput}
                      onChange={(e) => setFriendUsernameInput(e.target.value)}
                      style={{
                        flex: 1,
                        padding: 10,
                        borderRadius: "var(--r-control)",
                        border: "1px solid var(--line-subtle)",
                        backgroundColor: "var(--surface-inset)",
                        color: "#fff",
                        font: "var(--type-body-sm)",
                      }}
                    />
                    <button type="submit" className="cd-btn cd-btn-primary">
                      + ADD MEMBER
                    </button>
                  </form>

                  {friendMsg && (
                    <div
                      style={{
                        marginBottom: 12,
                        color: "var(--gold-500)",
                        font: "var(--type-data)",
                      }}
                    >
                      {friendMsg}
                    </div>
                  )}

                  {/* Squad List */}
                  <span className="cd-label" style={{ display: "block", marginBottom: 12 }}>
                    MY DRAGON CON SQUAD ({friendsList.length})
                  </span>

                  {friendsList.length === 0 ? (
                    <div
                      className="cd-glass-panel"
                      style={{ color: "var(--text-tertiary)", padding: 20, textAlign: "center" }}
                    >
                      No squad members added yet. Ask your con buddy for their username!
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                        gap: 10,
                        marginBottom: 20,
                      }}
                    >
                      {friendsList.map((friend) => (
                        <div
                          key={friend.id}
                          onClick={() => handleCompareFriend(friend)}
                          className="cd-glass-panel"
                          style={{
                            cursor: "pointer",
                            borderColor:
                              selectedFriend?.id === friend.id
                                ? "var(--purple-400)"
                                : "var(--line-hairline)",
                            boxShadow:
                              selectedFriend?.id === friend.id
                                ? "var(--glow-purple)"
                                : "var(--shadow-2)",
                          }}
                        >
                          <div style={{ font: "var(--type-subhead)", color: "var(--text-primary)" }}>
                            {friend.name}
                          </div>
                          <div className="cd-data" style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
                            @{friend.username}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Overlap View */}
                  {selectedFriend && (
                    <div className="cd-glass-panel">
                      <span
                        className="cd-label"
                        style={{ display: "block", marginBottom: 12, color: "var(--gold-500)" }}
                      >
                        SHARED PANELS WITH {selectedFriend.name.toUpperCase()} ({friendSharedEvents.length})
                      </span>
                      {friendSharedEvents.length === 0 ? (
                        <p style={{ color: "var(--text-tertiary)", font: "var(--type-body-sm)" }}>
                          No matching panels on your agendas yet.
                        </p>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {friendSharedEvents.map((ev) => (
                            <div
                              key={ev.id}
                              style={{
                                backgroundColor: "var(--surface-inset)",
                                padding: 12,
                                borderRadius: "var(--r-control)",
                                border: "1px solid var(--line-hairline)",
                                cursor: "pointer",
                              }}
                              onClick={() => setActiveDetailItem(ev)}
                            >
                              <div style={{ font: "var(--type-subhead)", color: "#fff" }}>{ev.title}</div>
                              <div
                                className="cd-data"
                                style={{ color: "var(--text-secondary)", fontSize: 11 }}
                              >
                                {ev.day} • {ev.timeString} • {ev.location}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 4: RECENT UPDATES / DIFF FEED                              */}
          {/* ============================================================== */}
          {activeTab === "changes" && (
            <div>
              <span className="cd-label" style={{ display: "block", marginBottom: 14 }}>
                SCHEDULE CHANGES & DIFF FEED
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {recentChanges.length === 0 ? (
                  <div
                    className="cd-glass-panel"
                    style={{ color: "var(--text-tertiary)", textAlign: "center", padding: 30 }}
                  >
                    No schedule changes recorded yet. Click <strong>Sync</strong> to fetch the latest updates!
                  </div>
                ) : (
                  recentChanges.map((change: EventChange) => (
                    <div key={change.id} className="cd-glass-panel">
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span style={{ font: "var(--type-subhead)", color: "var(--text-primary)" }}>
                          {change.eventTitle}
                        </span>
                        <span
                          className={`cd-badge ${
                            change.changeType === "created" ? "cd-badge-gold" : "cd-badge-purple"
                          }`}
                        >
                          {change.changeType.toUpperCase()}
                        </span>
                      </div>
                      <div
                        className="cd-data"
                        style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}
                      >
                        DETECTED: {new Date(change.detectedAt).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 5: PROFILE & CON PREFERENCES                               */}
          {/* ============================================================== */}
          {activeTab === "profile" && (
            <div>
              {!currentUser ? (
                /* Logged-out Auth Card */
                <div
                  className="cd-glass-panel cd-notch"
                  style={{
                    maxWidth: 520,
                    margin: "0 auto",
                    padding: 28,
                    boxShadow: "var(--shadow-3)",
                  }}
                >
                  <div style={{ textAlign: "center", marginBottom: 20 }}>
                    <div className="cd-label" style={{ color: "var(--gold-400)", marginBottom: 4 }}>
                      CYBERDRAGON AUTHENTICATION
                    </div>
                    <h2
                      style={{
                        margin: 0,
                        font: "var(--type-title)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {authMode === "login" ? "Welcome to CyberDragon" : "Create Squad Profile"}
                    </h2>
                    <p
                      style={{
                        margin: "8px 0 0 0",
                        font: "var(--type-body)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Sign in for offline schedule syncing, walk-time alarms, and squad features.
                    </p>
                  </div>

                  {supportsPasskeys && (
                    <div style={{ marginBottom: 20 }}>
                      <button
                        type="button"
                        onClick={handlePasskeyLogin}
                        className="cd-btn cd-btn-primary"
                        style={{
                          width: "100%",
                          padding: "14px",
                          fontSize: 14,
                          background: "var(--grad-brand)",
                          boxShadow: "var(--glow-purple)",
                        }}
                      >
                        ⚡ 1-CLICK PASSKEY LOGIN
                      </button>
                    </div>
                  )}

                  {authError && (
                    <div
                      style={{
                        color: "var(--coral-500)",
                        font: "var(--type-body-sm)",
                        marginBottom: 14,
                        padding: 8,
                        backgroundColor: "rgba(229,72,77,.1)",
                        borderRadius: "var(--r-control)",
                      }}
                    >
                      {authError}
                    </div>
                  )}

                  <form
                    onSubmit={handleAuthSubmit}
                    style={{ display: "flex", flexDirection: "column", gap: 12 }}
                  >
                    {authMode === "register" && (
                      <div>
                        <div className="cd-label" style={{ marginBottom: 4 }}>
                          YOUR NAME / HANDLE
                        </div>
                        <input
                          type="text"
                          placeholder="e.g. Martin R."
                          value={authName}
                          onChange={(e) => setAuthName(e.target.value)}
                          style={{
                            width: "100%",
                            padding: 10,
                            borderRadius: "var(--r-control)",
                            border: "1px solid var(--line-subtle)",
                            backgroundColor: "var(--surface-inset)",
                            color: "#fff",
                            font: "var(--type-body)",
                            boxSizing: "border-box",
                          }}
                          required
                        />
                      </div>
                    )}

                    <div>
                      <div className="cd-label" style={{ marginBottom: 4 }}>
                        USERNAME
                      </div>
                      <input
                        type="text"
                        placeholder="dragon_fan_26"
                        value={authUsername}
                        onChange={(e) => setAuthUsername(e.target.value)}
                        style={{
                          width: "100%",
                          padding: 10,
                          borderRadius: "var(--r-control)",
                          border: "1px solid var(--line-subtle)",
                          backgroundColor: "var(--surface-inset)",
                          color: "#fff",
                          font: "var(--type-body)",
                          boxSizing: "border-box",
                        }}
                        required
                      />
                    </div>

                    {authMode === "register" && supportsPasskeys && (
                      <button
                        type="button"
                        onClick={handleQuickPasskeyRegister}
                        className="cd-btn cd-btn-ghost"
                        style={{
                          borderColor: "var(--line-purple)",
                          color: "var(--purple-300)",
                          padding: 12,
                        }}
                      >
                        ✨ 1-CLICK QUICK REGISTER (PASSKEY)
                      </button>
                    )}

                    <div>
                      <div className="cd-label" style={{ marginBottom: 4 }}>
                        PASSWORD
                      </div>
                      <input
                        type="password"
                        placeholder="••••••••••••"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        style={{
                          width: "100%",
                          padding: 10,
                          borderRadius: "var(--r-control)",
                          border: "1px solid var(--line-subtle)",
                          backgroundColor: "var(--surface-inset)",
                          color: "#fff",
                          font: "var(--type-body)",
                          boxSizing: "border-box",
                        }}
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      className="cd-btn cd-btn-signal"
                      style={{ padding: 12, marginTop: 6 }}
                    >
                      {authMode === "login" ? "LOG IN WITH PASSWORD" : "REGISTER ACCOUNT"}
                    </button>
                  </form>

                  <div
                    style={{
                      marginTop: 20,
                      textAlign: "center",
                      font: "var(--type-body-sm)",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    {authMode === "login" ? (
                      <span>
                        Need an account?{" "}
                        <button
                          type="button"
                          onClick={() => setAuthMode("register")}
                          style={{
                            color: "var(--gold-500)",
                            border: "none",
                            background: "none",
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
                        >
                          Register
                        </button>
                      </span>
                    ) : (
                      <span>
                        Already have an account?{" "}
                        <button
                          type="button"
                          onClick={() => setAuthMode("login")}
                          style={{
                            color: "var(--gold-500)",
                            border: "none",
                            background: "none",
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
                        >
                          Log In
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                /* Logged-In Profile Screen */
                <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640, margin: "0 auto" }}>
                  {/* Digital Con Badge Card */}
                  <div
                    className="cd-glass-panel cd-notch"
                    style={{
                      display: "flex",
                      gap: 16,
                      alignItems: "center",
                      border: "1px solid var(--line-purple)",
                      boxShadow: "var(--glow-purple)",
                      padding: 18,
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 56,
                        height: 56,
                        font: "var(--fw-bold) 20px/1 var(--font-core)",
                        color: "#fff",
                        background: "var(--grad-brand)",
                        borderRadius: "var(--r-2)",
                        boxShadow: "var(--inner-lip-strong)",
                        flexShrink: 0,
                      }}
                    >
                      {userInitials}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: "var(--type-heading)", color: "var(--text-primary)" }}>
                        {currentUser.name}
                      </div>
                      <div className="cd-data" style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                        @{currentUser.username}
                      </div>
                      <div
                        className="cd-data"
                        style={{ marginTop: 4, color: "var(--gold-400)", fontSize: 11 }}
                      >
                        {badgeId}
                      </div>
                    </div>
                    <span className="cd-badge cd-badge-purple">ATTENDING</span>
                  </div>

                  {/* Passkey Manager */}
                  {supportsPasskeys && (
                    <div className="cd-glass-panel" style={{ padding: 16 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <div style={{ font: "var(--type-subhead)", color: "var(--text-primary)" }}>
                            Passkey Biometrics
                          </div>
                          <div
                            className="cd-data"
                            style={{ fontSize: 11, color: "var(--text-tertiary)" }}
                          >
                            Touch ID / Face ID 1-click login
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleRegisterPasskey}
                          className="cd-btn cd-btn-ghost"
                          style={{ borderColor: "var(--line-purple)", color: "var(--purple-300)" }}
                        >
                          🔑 + Register Passkey
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Con Alerts Switches */}
                  <div className="cd-glass-panel" style={{ padding: "8px 16px" }}>
                    <div className="cd-label" style={{ padding: "8px 0", color: "var(--gold-400)" }}>
                      CON ALERTS & NOTIFICATIONS
                    </div>

                    <div className="cd-switch-row" style={{ borderTop: "1px solid var(--line-hairline)" }}>
                      <div>
                        <div style={{ font: "var(--type-body)", color: "var(--text-primary)" }}>
                          Panel reminders
                        </div>
                        <div className="cd-data" style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                          15 minutes before panel start
                        </div>
                      </div>
                      <div
                        className={`cd-switch ${alertReminders ? "checked" : ""}`}
                        onClick={() => setAlertReminders(!alertReminders)}
                        role="switch"
                        aria-checked={alertReminders}
                        tabIndex={0}
                      >
                        <div className="cd-switch-thumb" />
                      </div>
                    </div>

                    <div className="cd-switch-row" style={{ borderTop: "1px solid var(--line-hairline)" }}>
                      <div>
                        <div style={{ font: "var(--type-body)", color: "var(--text-primary)" }}>
                          Walk-time warnings
                        </div>
                        <div className="cd-data" style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                          Flag tight hotel venue changes (&lt; 10 min)
                        </div>
                      </div>
                      <div
                        className={`cd-switch ${alertWalkTime ? "checked" : ""}`}
                        onClick={() => setAlertWalkTime(!alertWalkTime)}
                        role="switch"
                        aria-checked={alertWalkTime}
                        tabIndex={0}
                      >
                        <div className="cd-switch-thumb" />
                      </div>
                    </div>

                    <div className="cd-switch-row" style={{ borderTop: "1px solid var(--line-hairline)" }}>
                      <div>
                        <div style={{ font: "var(--type-body)", color: "var(--text-primary)" }}>
                          Haptic feedback
                        </div>
                        <div className="cd-data" style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                          Vibrate on schedule actions &amp; alarms
                        </div>
                      </div>
                      <div
                        className={`cd-switch ${alertHaptics ? "checked" : ""}`}
                        onClick={() => setAlertHaptics(!alertHaptics)}
                        role="switch"
                        aria-checked={alertHaptics}
                        tabIndex={0}
                      >
                        <div className="cd-switch-thumb" />
                      </div>
                    </div>
                  </div>

                  {/* Display & Venue Baseline Preferences */}
                  <div className="cd-glass-panel" style={{ padding: 16 }}>
                    <div className="cd-label" style={{ marginBottom: 12, color: "var(--gold-400)" }}>
                      DISPLAY & VENUE PREFERENCES
                    </div>

                    <div style={{ display: "grid", gap: 14 }}>
                      <div>
                        <div className="cd-label" style={{ marginBottom: 6 }}>
                          TIME FORMAT
                        </div>
                        <select
                          className="cd-select"
                          value={timeFormat}
                          onChange={(e) => {
                            const val = e.target.value as "12h" | "24h";
                            setTimeFormat(val);
                            localStorage.setItem("dc_time_format", val);
                          }}
                          style={{ width: "100%" }}
                        >
                          <option value="12h">12-hour (e.g. 2:30 PM)</option>
                          <option value="24h">24-hour (e.g. 14:30)</option>
                        </select>
                      </div>

                      <div>
                        <div className="cd-label" style={{ marginBottom: 6 }}>
                          HOME HOTEL / STARTING VENUE
                        </div>
                        <select
                          className="cd-select"
                          value={homeVenue}
                          onChange={(e) => {
                            setHomeVenue(e.target.value);
                            localStorage.setItem("dc_home_venue", e.target.value);
                          }}
                          style={{ width: "100%" }}
                        >
                          {CORE_VENUES.map((v: CoreVenue) => (
                            <option key={v} value={v}>
                              {v === "HYATT"
                                ? "Hyatt Regency Atlanta"
                                : v === "MARRIOTT"
                                ? "Marriott Marquis Atlanta"
                                : v === "HILTON"
                                ? "Hilton Atlanta"
                                : v === "SHERATON"
                                ? "Sheraton / Courtland Grand"
                                : v === "WESTIN"
                                ? "Westin Peachtree Plaza"
                                : "AmericasMart Building 2 & 3"}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Offline Cache Status Meter */}
                  <div className="cd-glass-panel" style={{ padding: 16 }}>
                    <div className="cd-label" style={{ marginBottom: 8, color: "var(--gold-400)" }}>
                      OFFLINE SCHEDULE CACHE
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 10,
                      }}
                    >
                      <span className="cd-data" style={{ color: "var(--jade-500)", fontSize: 13 }}>
                        ● 100% Cached (Offline Ready)
                      </span>
                      <span className="cd-data" style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
                        Synced {minutesSinceSync} min ago
                      </span>
                    </div>

                    <div className="cd-progress-track" style={{ marginBottom: 14 }}>
                      <div className="cd-progress-tick active" />
                      <div className="cd-progress-tick active" />
                      <div className="cd-progress-tick active" />
                      <div className="cd-progress-tick active" />
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        type="button"
                        onClick={handleRunSync}
                        disabled={isSyncing}
                        className="cd-btn cd-btn-ghost"
                        style={{ flex: 1 }}
                      >
                        {isSyncing ? "Syncing..." : "🔄 Sync Now"}
                      </button>
                      <button
                        type="button"
                        onClick={() => showToast(`Digital Badge: ${badgeId}`, "ok")}
                        className="cd-btn cd-btn-ghost"
                        style={{ flex: 1 }}
                      >
                        📱 Show Badge
                      </button>
                    </div>
                  </div>

                  {/* Actions / Danger Zone */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={handleClearSchedule}
                      className="cd-btn"
                      style={{
                        backgroundColor: "rgba(229,72,77,.15)",
                        color: "var(--coral-500)",
                        borderColor: "var(--coral-500)",
                        padding: 12,
                      }}
                    >
                      Clear My Schedule
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="cd-btn cd-btn-ghost"
                      style={{ padding: 12 }}
                    >
                      Sign Out
                    </button>
                  </div>

                  <div
                    className="cd-label"
                    style={{ marginTop: 8, textAlign: "center", color: "var(--text-tertiary)" }}
                  >
                    CYBERDRAGON 1.4.0 · UNOFFICIAL COMPANION
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {/* ============================================================== */}
        {/* MOBILE BOTTOM TABBAR (FIXED VIEWPORT BOTTOM)                  */}
        {/* ============================================================== */}
        <nav className="cd-tabbar" aria-label="Mobile Navigation">
          <button
            type="button"
            className={`cd-tabbar-item ${activeTab === "schedule" ? "active" : ""}`}
            onClick={() => setActiveTab("schedule")}
          >
            <span style={{ fontSize: 18 }}>📅</span>
            <span>Schedule</span>
          </button>

          <button
            type="button"
            className={`cd-tabbar-item ${activeTab === "agenda" ? "active" : ""}`}
            onClick={() => setActiveTab("agenda")}
          >
            <span style={{ fontSize: 18, position: "relative" }}>
              ⭐
              {agendaItems.length > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -10,
                    backgroundColor: "var(--purple-600)",
                    color: "#fff",
                    fontSize: 9,
                    fontWeight: "bold",
                    padding: "1px 4px",
                    borderRadius: "var(--r-pill)",
                  }}
                >
                  {agendaItems.length}
                </span>
              )}
            </span>
            <span>Mine</span>
          </button>

          <button
            type="button"
            className={`cd-tabbar-item ${activeTab === "friends" ? "active" : ""}`}
            onClick={() => setActiveTab("friends")}
          >
            <span style={{ fontSize: 18 }}>👥</span>
            <span>Squad</span>
          </button>

          <button
            type="button"
            className={`cd-tabbar-item ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            <span style={{ fontSize: 18 }}>👤</span>
            <span>Profile</span>
          </button>
        </nav>

        {/* ============================================================== */}
        {/* FLOATING TOAST NOTIFICATION ENGINE                             */}
        {/* ============================================================== */}
        {toast && (
          <div className="cd-toast-container">
            <div className={`cd-toast ${toast.type}`}>
              <span style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
                {toast.type === "warn" ? "⚠️" : "✓"} {toast.message}
              </span>
              {toast.onUndo && (
                <button
                  type="button"
                  onClick={() => {
                    const undo = toast.onUndo;
                    setToast(null);
                    undo?.();
                  }}
                  className="cd-btn cd-btn-ghost"
                  style={{
                    padding: "2px 8px",
                    fontSize: 12,
                    color: "var(--gold-400)",
                    borderColor: "var(--line-gold)",
                  }}
                >
                  Undo
                </button>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* ADVANCED FILTER BOTTOM SHEET DRAWER                            */}
        {/* ============================================================== */}
        {showFilterSheet && (
          <div className="cd-sheet" onClick={() => setShowFilterSheet(false)}>
            <div className="cd-sheet-panel cd-scroll" onClick={(e) => e.stopPropagation()}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <div>
                  <div className="cd-label" style={{ color: "var(--gold-400)" }}>
                    ADVANCED PREFERENCES
                  </div>
                  <h3 style={{ margin: 0, font: "var(--type-heading)" }}>Filter Panels</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFilterSheet(false)}
                  className="cd-btn cd-btn-ghost"
                  style={{ padding: "4px 10px", fontSize: 16 }}
                >
                  ✕
                </button>
              </div>

              {/* Tracks Section */}
              <div style={{ marginBottom: 20 }}>
                <div className="cd-label" style={{ marginBottom: 8 }}>
                  FAN TRACKS (MULTI-SELECT)
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {tracks.map((t) => {
                    const isSelected = filterTracks.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setFilterTracks(filterTracks.filter((x) => x !== t));
                          } else {
                            setFilterTracks([...filterTracks, t]);
                          }
                        }}
                        className={`cd-day-chip ${isSelected ? "active" : ""}`}
                        style={{ fontSize: 11, padding: "5px 10px" }}
                      >
                        {isSelected ? `✓ ${t}` : t}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Smart Checkboxes Section */}
              <div style={{ marginBottom: 20 }}>
                <div className="cd-label" style={{ marginBottom: 8 }}>
                  SMART CONDITIONS
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div
                    className="cd-switch-row"
                    style={{
                      padding: "8px 12px",
                      background: "var(--surface-inset)",
                      borderRadius: "var(--r-control)",
                    }}
                  >
                    <div>
                      <div style={{ font: "var(--type-body-sm)", color: "var(--text-primary)" }}>
                        Hide panels that have ended
                      </div>
                      <div className="cd-data" style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                        Filter out past time slots
                      </div>
                    </div>
                    <div
                      className={`cd-switch ${filterHideEnded ? "checked" : ""}`}
                      onClick={() => setFilterHideEnded(!filterHideEnded)}
                      role="switch"
                      aria-checked={filterHideEnded}
                      tabIndex={0}
                    >
                      <div className="cd-switch-thumb" />
                    </div>
                  </div>

                  <div
                    className="cd-switch-row"
                    style={{
                      padding: "8px 12px",
                      background: "var(--surface-inset)",
                      borderRadius: "var(--r-control)",
                    }}
                  >
                    <div>
                      <div style={{ font: "var(--type-body-sm)", color: "var(--text-primary)" }}>
                        Hide conflicts with my schedule
                      </div>
                      <div className="cd-data" style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                        Exclude overlapping time slots
                      </div>
                    </div>
                    <div
                      className={`cd-switch ${filterHideConflicts ? "checked" : ""}`}
                      onClick={() => setFilterHideConflicts(!filterHideConflicts)}
                      role="switch"
                      aria-checked={filterHideConflicts}
                      tabIndex={0}
                    >
                      <div className="cd-switch-thumb" />
                    </div>
                  </div>

                  <div
                    className="cd-switch-row"
                    style={{
                      padding: "8px 12px",
                      background: "var(--surface-inset)",
                      borderRadius: "var(--r-control)",
                    }}
                  >
                    <div>
                      <div style={{ font: "var(--type-body-sm)", color: "var(--text-primary)" }}>
                        Walkable in under 10 minutes
                      </div>
                      <div className="cd-data" style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                        From previous saved panel or home venue
                      </div>
                    </div>
                    <div
                      className={`cd-switch ${filterWalkableUnder10 ? "checked" : ""}`}
                      onClick={() => setFilterWalkableUnder10(!filterWalkableUnder10)}
                      role="switch"
                      aria-checked={filterWalkableUnder10}
                      tabIndex={0}
                    >
                      <div className="cd-switch-thumb" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => {
                    setFilterTracks([]);
                    setFilterHideEnded(false);
                    setFilterHideConflicts(false);
                    setFilterWalkableUnder10(false);
                    setSelectedTrack("");
                    setSelectedLocation("");
                  }}
                  className="cd-btn cd-btn-ghost"
                  style={{ flex: 1, padding: 12 }}
                >
                  Reset Filters
                </button>
                <button
                  type="button"
                  onClick={() => setShowFilterSheet(false)}
                  className="cd-btn cd-btn-primary"
                  style={{ flex: 2, padding: 12, background: "var(--grad-brand)" }}
                >
                  Show {filteredEvents.length} Panels
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PANEL DETAIL MODAL INTEGRATION                                 */}
        {/* ============================================================== */}
        {activeDetailItem && (
          <PanelDetailModal
            item={activeDetailItem}
            previousVenue={getPrecedingVenue(activeDetailItem)}
            saved={!!userEventStatusMap[activeDetailItem.id]}
            onToggleSave={() =>
              handleToggleEvent(
                activeDetailItem.id,
                userEventStatusMap[activeDetailItem.id]
                  ? userEventStatusMap[activeDetailItem.id]
                  : "going",
              )
            }
            onClose={() => setActiveDetailItem(null)}
          />
        )}

        {/* ============================================================== */}
        {/* AUTH MODAL FALLBACK DIALOG                                     */}
        {/* ============================================================== */}
        {showAuthModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(12, 14, 17, 0.75)",
              backdropFilter: "var(--blur-scrim)",
              WebkitBackdropFilter: "var(--blur-scrim)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
            onClick={() => setShowAuthModal(false)}
          >
            <div
              className="cd-glass-panel cd-notch"
              style={{
                width: "100%",
                maxWidth: 380,
                padding: 24,
                boxShadow: "var(--shadow-sheet)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                style={{
                  margin: "0 0 16px 0",
                  font: "var(--type-heading)",
                  color: "var(--gold-500)",
                }}
              >
                {authMode === "login" ? "LOG IN TO CYBERDRAGON" : "CREATE SQUAD ACCOUNT"}
              </h2>

              {supportsPasskeys && authMode === "login" && (
                <button
                  type="button"
                  onClick={handlePasskeyLogin}
                  className="cd-btn cd-btn-primary"
                  style={{
                    width: "100%",
                    padding: 12,
                    fontSize: 13,
                    marginBottom: 16,
                    background: "var(--grad-brand)",
                  }}
                >
                  ⚡ 1-CLICK PASSKEY LOGIN
                </button>
              )}

              {authError && (
                <div
                  style={{
                    color: "var(--coral-500)",
                    font: "var(--type-body-sm)",
                    marginBottom: 12,
                  }}
                >
                  {authError}
                </div>
              )}

              <form
                onSubmit={handleAuthSubmit}
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {authMode === "register" && (
                  <input
                    type="text"
                    placeholder="Your Name (e.g. Alex)"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    style={{
                      padding: 10,
                      borderRadius: "var(--r-control)",
                      border: "1px solid var(--line-subtle)",
                      backgroundColor: "var(--surface-inset)",
                      color: "#fff",
                      font: "var(--type-body-sm)",
                    }}
                    required
                  />
                )}

                <input
                  type="text"
                  placeholder="Username"
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  style={{
                    padding: 10,
                    borderRadius: "var(--r-control)",
                    border: "1px solid var(--line-subtle)",
                    backgroundColor: "var(--surface-inset)",
                    color: "#fff",
                    font: "var(--type-body-sm)",
                  }}
                  required
                />

                <input
                  type="password"
                  placeholder="Password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  style={{
                    padding: 10,
                    borderRadius: "var(--r-control)",
                    border: "1px solid var(--line-subtle)",
                    backgroundColor: "var(--surface-inset)",
                    color: "#fff",
                    font: "var(--type-body-sm)",
                  }}
                  required
                />

                {authMode === "register" && supportsPasskeys && (
                  <button
                    type="button"
                    onClick={handleQuickPasskeyRegister}
                    className="cd-btn cd-btn-ghost"
                    style={{
                      borderColor: "var(--line-purple)",
                      color: "var(--purple-300)",
                      padding: 10,
                    }}
                  >
                    ✨ 1-CLICK REGISTER WITH PASSKEY
                  </button>
                )}

                <button
                  type="submit"
                  className="cd-btn cd-btn-signal"
                  style={{ padding: 12, marginTop: 4 }}
                >
                  {authMode === "login" ? "LOG IN WITH PASSWORD" : "REGISTER WITH PASSWORD"}
                </button>
              </form>

              <div
                style={{
                  marginTop: 16,
                  textAlign: "center",
                  font: "var(--type-body-sm)",
                  color: "var(--text-tertiary)",
                }}
              >
                {authMode === "login" ? (
                  <span>
                    Need an account?{" "}
                    <button
                      type="button"
                      onClick={() => setAuthMode("register")}
                      style={{
                        color: "var(--gold-500)",
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                      }}
                    >
                      Register
                    </button>
                  </span>
                ) : (
                  <span>
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setAuthMode("login")}
                      style={{
                        color: "var(--gold-500)",
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                      }}
                    >
                      Log In
                    </button>
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="cd-btn cd-btn-ghost"
                style={{ marginTop: 12, width: "100%", padding: 8 }}
              >
                CANCEL
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// Interfaces for response typing
interface PublicKeyRequestOptionsResponse {
  challenge: string;
  [key: string]: unknown;
}

interface PublicKeyCreationOptionsResponse {
  challenge: string;
  [key: string]: unknown;
}
