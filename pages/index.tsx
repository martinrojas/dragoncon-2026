import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import { useEffect, useMemo, useRef, useState, type FormEvent, type JSX } from "react";
import {
  AppBar,
  DayStrip,
  Icon,
  PanelCard,
  SegmentedControl,
  Tag,
  TimeRail,
  type DayItem,
} from "../components/CyberDragonUi";
import { PanelDetailModal } from "../components/PanelDetailModal";
import { calculateWalkTime } from "../lib/walktime";
import { AppStoragePanel, type InstallPromptEvent } from "../components/AppStoragePanel";
import { FeedbackPanel } from "../components/FeedbackPanel";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { setupGlobalErrorCatchers } from "../lib/errorReporting";
import { APP_VERSION } from "../lib/version";
import type { Props } from "./index.server";

export interface User {
  id: string;
  username: string;
  name: string;
  role?: string;
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

export function parseTimeDisplay(timeStr: string | null | undefined): {
  start: string;
  end?: string;
  slotLabel: string;
} {
  if (!timeStr) return { start: "TBD", slotLabel: "VARIES" };
  const parts = timeStr.includes("—") ? timeStr.split("—") : timeStr.split("-");
  const rawStart = parts[0]?.trim() || "TBD";
  const rawEnd = parts[1]?.trim();

  let cleanStart = rawStart;
  let cleanEnd = rawEnd;
  let slotLabel = "VARIES";

  const match = rawStart.match(/^0?(\d+):(\d+)\s*(AM|PM)?/i);
  if (match) {
    const hr = parseInt(match[1], 10);
    const min = match[2];
    const ampm = match[3] ? match[3].toUpperCase() : "PM";
    cleanStart = `${hr}:${min}`;
    slotLabel = `${hr} ${ampm}`;
  }

  if (rawEnd) {
    const endMatch = rawEnd.match(/^0?(\d+):(\d+)\s*(AM|PM)?/i);
    if (endMatch) {
      const endHr = parseInt(endMatch[1], 10);
      const endMin = endMatch[2];
      cleanEnd = `${endHr}:${endMin}`;
    }
  }

  return {
    start: cleanStart,
    end: cleanEnd,
    slotLabel,
  };
}

export function parseVenueRoom(locationStr: string | null | undefined): {
  venue: string;
  room?: string;
} {
  if (!locationStr) return { venue: "VENUE TBD" };
  const parts = locationStr.split(/ - | – | — |: /);
  if (parts.length > 1) {
    return {
      venue: parts[0].trim(),
      room: parts.slice(1).join(" ").trim(),
    };
  }
  return { venue: locationStr.trim() };
}

export function getDayEyebrow(dayStr: string): string {
  if (!dayStr) return "DRAGON CON '26 · ATLANTA GA";
  const upper = dayStr.toUpperCase();
  if (upper.includes("THU") || upper.includes("SEP 3")) return "THURSDAY · DAY 1";
  if (upper.includes("FRI") || upper.includes("SEP 4")) return "FRIDAY · DAY 2";
  if (upper.includes("SAT") || upper.includes("SEP 5")) return "SATURDAY · DAY 3";
  if (upper.includes("SUN") || upper.includes("SEP 6")) return "SUNDAY · DAY 4";
  if (upper.includes("MON") || upper.includes("SEP 7")) return "MONDAY · DAY 5";
  return dayStr.toUpperCase();
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
  const [scheduleViewFilter, setScheduleViewFilter] = useState<"All" | "Saved">("All");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [, setUserToken] = useState<string>("");
  const [changesList, setChangesList] = useState<EventChange[]>(recentChanges || []);

  // WebAuthn Passkey Support
  const [supportsPasskeys, setSupportsPasskeys] = useState(false);

  // Auth modal & inputs
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authError, setAuthError] = useState("");

  // Toast notifications
  const [toast, setToast] = useState<ToastState | null>(null);

  // Search & Filter Drawer
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDay, setSelectedDay] = useState<string>(() => {
    if (days && days.length > 0) {
      const sat = days.find((d) => d.toLowerCase().includes("sat"));
      return sat || days[0];
    }
    return "Sat";
  });
  const dayRestoredRef = useRef(false);
  const [selectedTrack, setSelectedTrack] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [hideEndedPanels, setHideEndedPanels] = useState(false);
  const [hideConflicts, setHideConflicts] = useState(false);
  const [walkabilityOnly, setWalkabilityOnly] = useState(false);

  // Panel Detail Modal state
  const [activeDetailItem, setActiveDetailItem] = useState<EventItem | null>(null);

  // Event Lists
  const [eventsList, setEventsList] = useState<EventItem[]>(initialEvents as EventItem[]);
  const [isSearching, setIsSearching] = useState(false);

  // User Agenda
  const [agendaItems, setAgendaItems] = useState<UserEventItem[]>([]);
  const [agendaConflicts, setAgendaConflicts] = useState<Conflict[]>([]);
  const [userEventStatusMap, setUserEventStatusMap] = useState<Record<string, "going" | "interested">>({});

  // Con Preferences
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [walkWarningsEnabled, setWalkWarningsEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(false);
  const [timeFormat, setTimeFormat] = useState<"12h" | "24h">("12h");
  const [homeVenue, setHomeVenue] = useState<string>("Hyatt Regency");

  // Friends & Overlap
  const [friendsList, setFriendsList] = useState<User[]>([]);
  const [friendUsernameInput, setFriendUsernameInput] = useState("");
  const [selectedFriend, setSelectedFriend] = useState<User | null>(null);
  const [friendSharedEvents, setFriendSharedEvents] = useState<EventItem[]>([]);
  const [friendMsg, setFriendMsg] = useState("");

  // Ingestion Sync & Cache
  const [isSyncing, setIsSyncing] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState("");
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());
  const [isOnline, setIsOnline] = useState(true);

  // Show toast helper with auto-dismiss
  const triggerToast = (
    message: string,
    type: "ok" | "warn" = "ok",
    actionLabel?: string,
    onAction?: () => void,
  ) => {
    setToast({ message, type, actionLabel, onAction });
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  // Initialize Auth & Settings
  useEffect(() => {
    setSupportsPasskeys(browserSupportsWebAuthn());

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(console.error);
    }

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && (navigator as unknown as { standalone?: boolean }).standalone === true);
    setIsInstalled(isStandalone);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as InstallPromptEvent);
    };
    const onAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);

    // Cloudflare Web Analytics (SPA mode)
    const cfBeaconToken = import.meta.env.VITE_CF_BEACON_TOKEN;
    if (cfBeaconToken && !document.querySelector('script[src*="cloudflareinsights.com/beacon"]')) {
      const script = document.createElement("script");
      script.type = "module";
      script.src = "https://static.cloudflareinsights.com/beacon.min.js";
      script.setAttribute("data-cf-beacon", JSON.stringify({ token: cfBeaconToken, spa: true }));
      document.head.appendChild(script);
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
        // ignore invalid json
      }
    }

    const savedHomeVenue = localStorage.getItem("dc_home_venue");
    if (savedHomeVenue) setHomeVenue(savedHomeVenue);

    const savedTimeFormat = localStorage.getItem("dc_time_format");
    if (savedTimeFormat === "12h" || savedTimeFormat === "24h") setTimeFormat(savedTimeFormat);
    const savedDay = localStorage.getItem("dc_selected_day");
    if (savedDay && days?.includes(savedDay)) setSelectedDay(savedDay);
    dayRestoredRef.current = true;

    const cleanupErrorCatchers = setupGlobalErrorCatchers(() => {
      const userStr = localStorage.getItem("dc_user");
      if (userStr) {
        try {
          return JSON.parse(userStr);
        } catch {
          // ignore
        }
      }
      return null;
    }, APP_VERSION);

    return () => {
      cleanupErrorCatchers();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);


  // Fetch filtered events
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

  // Persist selected day across reloads (armed after initial restore)
  useEffect(() => {
    if (!dayRestoredRef.current) return;
    if (selectedDay) localStorage.setItem("dc_selected_day", selectedDay);
  }, [selectedDay]);

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
        options: PublicKeyCredentialRequestOptionsJSON;
        error?: string;
      };
      if (!optData.success) throw new Error(optData.error || "Failed to get login options");

      const assertionResponse = await startAuthentication({ optionsJSON: optData.options });

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
        triggerToast(`Welcome back, ${verifyData.user.name}! ⚡`, "ok");
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
        options: PublicKeyCredentialCreationOptionsJSON;
        error?: string;
      };
      if (!optData.success) throw new Error(optData.error || "Failed to start registration");

      const registrationResponse = await startRegistration({ optionsJSON: optData.options });

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
        triggerToast(`Squad account created! 🔑`, "ok");
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
        options: PublicKeyCredentialCreationOptionsJSON;
        error?: string;
      };
      if (!optData.success) throw new Error(optData.error || "Failed to get registration options");

      const registrationResponse = await startRegistration({ optionsJSON: optData.options });

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
        triggerToast("🎉 Passkey registered! Next time log in with 1 click.", "ok");
      } else {
        triggerToast(verifyData.error || "Failed to register passkey", "warn");
      }
    } catch (e: unknown) {
      console.error(e);
      triggerToast(e instanceof Error ? e.message : "Passkey registration failed or cancelled", "warn");
    }
  };

  // Helper to execute explicit schedule mutations without stale closure issues
  const executeScheduleMutation = async (
    eventId: string,
    action: "add" | "remove",
    status: "going" | "interested" = "going",
  ) => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }

    setUserEventStatusMap((prevMap) => {
      const nextMap = { ...prevMap };
      if (action === "remove") {
        delete nextMap[eventId];
      } else {
        nextMap[eventId] = status;
      }
      return nextMap;
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

  // Toggle Agenda Event with Undo Toast
  const handleToggleEvent = async (
    eventId: string,
    newStatus: "going" | "interested",
    bypassToast: boolean = false,
  ) => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }

    const currentStatus = userEventStatusMap[eventId];
    const isRemoving = currentStatus === newStatus;
    const action = isRemoving ? "remove" : "add";
    const statusToRestore = currentStatus || "going";

    if (!bypassToast) {
      const ev = eventsList.find((e) => e.id === eventId);
      const title = ev ? ev.title : "Panel";

      if (isRemoving) {
        triggerToast(`Removed "${title}" from schedule.`, "ok", "Undo", () => {
          executeScheduleMutation(eventId, "add", statusToRestore);
        });
      } else {
        const hasConflict = agendaConflicts.some((c) => c.event1Id === eventId || c.event2Id === eventId);
        if (hasConflict) {
          triggerToast(`Added — overlaps another panel.`, "warn", "Undo", () => {
            executeScheduleMutation(eventId, "remove");
          });
        } else {
          triggerToast(`Added "${title}" to your schedule.`, "ok", "Undo", () => {
            executeScheduleMutation(eventId, "remove");
          });
        }
      }
    }

    await executeScheduleMutation(eventId, action, newStatus);
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
        triggerToast("Squad member added!", "ok");
      } else {
        setFriendMsg(data.error || "Failed to add friend");
      }
    } catch (e: unknown) {
      setFriendMsg("Network error adding friend");
    }
  };

  // Check for App & Schedule Updates (non-destructive attendee fetch)
  const handleCheckForUpdates = async () => {
    setIsSyncing(true);
    setSyncStatusMsg("Checking for updates...");
    try {
      // Check Service Worker PWA update if available
      if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            await reg.update();
            if (reg.waiting || reg.installing) {
              triggerToast("App update ready — reloading...", "ok");
              window.setTimeout(() => window.location.reload(), 900);
              return;
            }
          }
        } catch {
          // SW check error or unregistered
        }
      }

      // Refetch latest published events & changes from D1
      const [evRes, chRes] = await Promise.all([
        fetch("/api/events"),
        fetch("/api/changes"),
      ]);

      const evData = (await evRes.json().catch(() => ({}))) as {
        success?: boolean;
        events?: EventItem[];
      };
      if (evData.success && evData.events) {
        setEventsList(evData.events);
      }

      const chData = (await chRes.json().catch(() => ({}))) as {
        success?: boolean;
        changes?: EventChange[];
      };
      if (chData.success && chData.changes) {
        setChangesList(chData.changes);
      }

      setLastSyncTime(Date.now());
      setSyncStatusMsg("Schedule is up to date!");
      setTimeout(() => setSyncStatusMsg(""), 3000);
      triggerToast("Schedule is up to date", "ok");
    } catch {
      setSyncStatusMsg("Failed to check for updates");
      setTimeout(() => setSyncStatusMsg(""), 3000);
      triggerToast("Couldn't check for updates — offline?", "warn");
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
        triggerToast(`Logged in as ${data.user.name}`, "ok");
      } else {
        setAuthError(data.error || "Authentication failed");
      }
    } catch (e: unknown) {
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
    triggerToast("Signed out", "ok");
  };

  // Format Day Items for DayStrip (sorted chronologically by con date)
  // Format Day Items for DayStrip directly from server-driven days
  const formattedDays: DayItem[] = useMemo(() => {
    const parseDayInfo = (dayStr: string) => {
      const lower = dayStr.toLowerCase();

      let label = "CON";
      if (lower.includes("wed")) label = "WED";
      else if (lower.includes("thu")) label = "THU";
      else if (lower.includes("fri")) label = "FRI";
      else if (lower.includes("sat")) label = "SAT";
      else if (lower.includes("sun")) label = "SUN";
      else if (lower.includes("mon")) label = "MON";
      else if (lower.includes("tue")) label = "TUE";
      else {
        const parts = dayStr.split(",");
        label = (parts[0]?.trim().toUpperCase() || "CON").slice(0, 3);
      }

      const numMatch = dayStr.match(/\d+/);
      let dateNum: string;
      if (numMatch) {
        dateNum = numMatch[0].padStart(2, "0");
      } else {
        const fallbackDates: Record<string, string> = {
          WED: "02",
          THU: "03",
          FRI: "04",
          SAT: "05",
          SUN: "06",
          MON: "07",
          TUE: "08",
        };
        dateNum = fallbackDates[label] || "01";
      }

      const rank = parseInt(dateNum, 10) || 99;
      return { label, date: dateNum, rank };
    };

    const sortedDays = [...(days || [])].sort((a, b) => parseDayInfo(a).rank - parseDayInfo(b).rank);
    const seen = new Set<string>();
    const items: DayItem[] = [];

    for (const dayStr of sortedDays) {
      const { label, date } = parseDayInfo(dayStr);
      const key = `${label}-${date}`;
      if (!seen.has(key)) {
        seen.add(key);
        items.push({
          value: dayStr,
          label,
          date,
        });
      }
    }

    return items;
  }, [days]);

  // Contextual preceding venue helper for walk time calculations
  const getPrecedingVenue = (currentEvent: EventItem): string | null => {
    const daySaved = agendaItems
      .map((item) => item.event)
      .filter((ev): ev is EventItem => !!ev && ev.day === currentEvent.day)
      .sort((a, b) => (a.startsAt || "").localeCompare(b.startsAt || ""));

    const currentIndex = daySaved.findIndex((e) => e.id === currentEvent.id);
    if (currentIndex > 0) {
      return daySaved[currentIndex - 1].location;
    }

    const preceding = daySaved
      .filter((e) => (e.startsAt || "") < (currentEvent.startsAt || ""))
      .pop();

    return preceding?.location || homeVenue;
  };

  // Conflict checker for any event ID
  const checkEventConflict = (eventId: string): boolean => {
    return agendaConflicts.some((c) => c.event1Id === eventId || c.event2Id === eventId);
  };

  // Filter events according to smart checkboxes and segmented control
  const filteredEvents = useMemo(() => {
    return eventsList.filter((item) => {
      if (selectedDay && item.day !== selectedDay) {
        return false;
      }
      if (scheduleViewFilter === "Saved" && !userEventStatusMap[item.id]) {
        return false;
      }
      if (hideEndedPanels && item.status === "done") {
        return false;
      }
      if (hideConflicts && checkEventConflict(item.id)) {
        return false;
      }
      if (walkabilityOnly) {
        const walk = calculateWalkTime(getPrecedingVenue(item), item.location);
        if (walk.minutes > 10) return false;
      }
      return true;
    });
  }, [eventsList, selectedDay, scheduleViewFilter, userEventStatusMap, hideEndedPanels, hideConflicts, walkabilityOnly, homeVenue]);

  // Group events by time slots for TimeRail layout
  const groupedSlots = useMemo(() => {
    const map = new Map<string, { label: string; active: boolean; items: EventItem[] }>();

    for (const item of filteredEvents) {
      const timeInfo = parseTimeDisplay(item.timeString);
      const slotLabel = timeInfo.slotLabel;

      if (!map.has(slotLabel)) {
        map.set(slotLabel, {
          label: slotLabel,
          active: false,
          items: [],
        });
      }

      const slot = map.get(slotLabel)!;
      slot.items.push(item);
      if (item.status === "live") slot.active = true;
    }

    return Array.from(map.values());
  }, [filteredEvents]);

  // Minutes since last sync calculation
  const minutesSinceSync = Math.max(0, Math.floor((Date.now() - lastSyncTime) / 60000));

  // Daily Load Calculation for My Agenda Tab
  const activeDaySavedEvents = useMemo(() => {
    return agendaItems
      .map((item) => item.event)
      .filter((ev): ev is EventItem => !!ev && (!selectedDay || ev.day === selectedDay))
      .sort((a, b) => (a.startsAt || "").localeCompare(b.startsAt || ""));
  }, [agendaItems, selectedDay]);

  const totalWalkTimeMinutes = useMemo(() => {
    let total = 0;
    for (let i = 1; i < activeDaySavedEvents.length; i++) {
      const prev = activeDaySavedEvents[i - 1];
      const curr = activeDaySavedEvents[i];
      const walk = calculateWalkTime(prev.location, curr.location);
      total += walk.minutes;
    }
    return total;
  }, [activeDaySavedEvents]);

  const desktopNavTabs = [
    { id: "schedule", label: "Schedule", icon: "calendar-clock", active: activeTab === "schedule", onClick: () => setActiveTab("schedule") },
    { id: "agenda", label: "Mine", icon: "bookmark", active: activeTab === "agenda", badge: agendaItems.length, onClick: () => setActiveTab("agenda") },
    { id: "friends", label: "Squad", icon: "users", active: activeTab === "friends", onClick: () => setActiveTab("friends") },
    { id: "changes", label: "Changes", icon: "bell", active: activeTab === "changes", badge: changesList.length, onClick: () => setActiveTab("changes") },
    { id: "profile", label: "Profile", icon: "user", active: activeTab === "profile", onClick: () => setActiveTab("profile") },
  ];

  return (
    <ErrorBoundary
      contextName="MainApp"
      user={currentUser ? { id: currentUser.id, username: currentUser.username } : null}
      appVersion={APP_VERSION}
    >
      <div
        style={{
          minHeight: "100dvh",
          backgroundColor: "var(--canvas)",
          backgroundImage: "var(--grid-8)",
          color: "var(--text-primary)",
          fontFamily: "var(--font-core)",
          paddingBottom: "calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px) + 24px)",
        }}
      >
        <h1
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            overflow: "hidden",
            clip: "rect(0 0 0 0)",
            whiteSpace: "nowrap",
          }}
        >
          CyberDragon — Dragon Con 2026 schedule companion (Sep 3–7, Atlanta, GA)
        </h1>
        {/* Floating Toast Notification */}
        {toast && (
          <div className="cd-toast-container">
            <div className={`cd-toast ${toast.type === "warn" ? "warn" : "ok"}`}>
              <span>{toast.message}</span>
              {toast.actionLabel && toast.onAction && (
                <button
                  onClick={toast.onAction}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "var(--r-control)",
                    backgroundColor: "rgba(255,255,255,.15)",
                    border: "1px solid rgba(255,255,255,.3)",
                    color: "#fff",
                    font: "var(--type-micro)",
                    cursor: "pointer",
                  }}
                >
                  {toast.actionLabel}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Sync Notification Banner */}
        {syncStatusMsg && (
          <div
            style={{
              backgroundColor: "var(--purple-900)",
              borderBottom: "1px solid var(--line-purple)",
              color: "var(--gold-500)",
              padding: "6px var(--gutter)",
              textAlign: "center",
              font: "var(--type-data)",
              fontSize: 12,
            }}
          >
            {syncStatusMsg}
          </div>
        )}

        {/* TAB 1: SCHEDULE GRID & TIME RAIL */}
        {activeTab === "schedule" && (
          <div>
            {/* CyberDragon AppBar */}
            <AppBar
              eyebrow={getDayEyebrow(selectedDay)}
              title="Schedule"
              navTabs={desktopNavTabs}
              right={[
                ...(currentUser?.role === "admin"
                  ? [
                      {
                        icon: "shield-user",
                        label: "Admin",
                        onClick: () => {
                          window.location.href = "/admin";
                        },
                      },
                    ]
                  : []),
                {
                  icon: "search",
                  label: "Search",
                  active: showSearchInput || !!searchQuery,
                  onClick: () => setShowSearchInput((s) => !s),
                },
                {
                  icon: "sliders-horizontal",
                  label: "Filters",
                  active: !!selectedTrack || !!selectedLocation || hideEndedPanels || hideConflicts || walkabilityOnly,
                  onClick: () => setShowFilterSheet(true),
                },
                {
                  icon: "refresh-cw",
                  label: "Updates",
                  active: isSyncing,
                  onClick: handleCheckForUpdates,
                },
              ]}
            />
            {/* DayStrip */}
            <DayStrip days={formattedDays} value={selectedDay} onChange={setSelectedDay} />

            {/* Segmented Control ('All' | 'Saved') & Count */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 var(--gutter) 10px",
                maxWidth: 900,
                margin: "0 auto",
              }}
            >
              <SegmentedControl
                size="sm"
                options={["All", "Saved"]}
                value={scheduleViewFilter}
                onChange={(val) => setScheduleViewFilter(val as "All" | "Saved")}
              />
              <span className="cd-label" style={{ fontVariantNumeric: "tabular-nums" }}>
                {filteredEvents.length} PANELS
              </span>
            </div>

            {/* Inline Search Box when toggled */}
            {showSearchInput && (
              <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 var(--gutter) 12px" }}>
                <input
                  type="text"
                  placeholder="Search panels, guests, venues, tracks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "var(--r-control)",
                    border: "1px solid var(--line-subtle)",
                    backgroundColor: "var(--surface-inset)",
                    color: "var(--text-primary)",
                    font: "var(--type-body-sm)",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            )}

            {/* TimeRail Schedule Grid */}
            <main style={{ maxWidth: 900, margin: "0 auto", padding: "4px var(--gutter) 0" }}>
              {isSearching && (
                <div style={{ textAlign: "center", color: "var(--text-tertiary)", font: "var(--type-data)", padding: 40 }}>
                  SEARCHING THE GRID...
                </div>
              )}

              {!isSearching && filteredEvents.length === 0 && (
                <div
                  className="cd-glass-panel"
                  style={{ textAlign: "center", color: "var(--text-tertiary)", padding: 40, marginTop: 20 }}
                >
                  NO PANELS FOUND MATCHING FILTER CRITERIA.
                </div>
              )}

              {!isSearching &&
                groupedSlots.map((slot) => (
                  <TimeRail key={slot.label} label={slot.label} active={slot.active}>
                    {slot.items.map((ev) => {
                      const timeInfo = parseTimeDisplay(ev.timeString);
                      const venueInfo = parseVenueRoom(ev.location);
                      const isSaved = !!userEventStatusMap[ev.id];
                      const isConflict = checkEventConflict(ev.id);
                      const trackColor = TRACK_COLORS[ev.track?.toUpperCase() || ""] || "var(--purple-400)";
                      const walkInfo = calculateWalkTime(getPrecedingVenue(ev), ev.location);

                      return (
                        <PanelCard
                          key={ev.id}
                          time={timeInfo.start}
                          endTime={timeInfo.end}
                          title={ev.title}
                          venue={venueInfo.venue}
                          room={venueInfo.room}
                          track={ev.track || undefined}
                          trackColor={trackColor}
                          status={ev.status}
                          saved={isSaved}
                          conflict={isConflict}
                          walk={walkInfo.minutes > 0 ? `${walkInfo.minutes} min` : undefined}
                          onSave={() => handleToggleEvent(ev.id, isSaved ? (userEventStatusMap[ev.id] || "going") : "going")}
                          onClick={() => setActiveDetailItem(ev)}
                        />
                      );
                    })}
                  </TimeRail>
                ))}
            </main>
          </div>
        )}

        {/* TAB 2: MY SCHEDULE LOAD DASHBOARD */}
        {activeTab === "agenda" && (
          <div>
            <AppBar
              eyebrow={`${agendaItems.length} SESSIONS SAVED · 5 DAYS`}
              title="My Schedule"
              navTabs={desktopNavTabs}
              right={[
                {
                  icon: "download",
                  label: "Export ICS",
                  onClick: () => {
                    if (currentUser) {
                      window.location.href = `/api/export-ics?userId=${currentUser.id}`;
                    }
                  },
                },
              ]}
            />

            <DayStrip days={formattedDays} value={selectedDay} onChange={setSelectedDay} />

            <main style={{ maxWidth: 900, margin: "0 auto", padding: "4px var(--gutter) 0" }}>
              {!currentUser ? (
                <div className="cd-glass-panel" style={{ padding: 30, textAlign: "center" }}>
                  <h2 style={{ font: "var(--type-heading)", color: "var(--gold-500)", marginBottom: 8 }}>
                    SIGN IN TO BUILD YOUR SCHEDULE
                  </h2>
                  <p style={{ font: "var(--type-body)", color: "var(--text-secondary)", marginBottom: 20 }}>
                    Save panels, calculate walk times, track con stamina load, and sync with your squad.
                  </p>

                  {supportsPasskeys && (
                    <button
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
                    <button onClick={() => setShowAuthModal(true)} className="cd-btn cd-btn-signal">
                      LOG IN WITH PASSWORD
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  {/* Daily Stamina Load Dashboard */}
                  <div
                    className="cd-glass-panel"
                    style={{
                      marginBottom: "var(--module-gap)",
                      border: "1px solid var(--line-purple)",
                      background: "rgba(91,33,182,.15)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 8,
                      }}
                    >
                      <span className="cd-label">{selectedDay.toUpperCase() || "DAILY"} LOAD</span>
                      <span className="cd-data" style={{ color: "var(--gold-400)", fontSize: 12 }}>
                        {activeDaySavedEvents.length} / 8 SLOTS
                      </span>
                    </div>

                    {/* Progress Meter with 8 Ticks */}
                    <div className="cd-progress-track">
                      {Array.from({ length: 8 }).map((_, idx) => {
                        const isFilled = idx < activeDaySavedEvents.length;
                        const isOver = activeDaySavedEvents.length > 8 && idx === 7;
                        return (
                          <div
                            key={idx}
                            className={`cd-progress-tick ${isFilled ? "active" : ""} ${isOver ? "warn" : ""}`}
                          />
                        );
                      })}
                    </div>

                    {/* Stats 3-Column Grid */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: 14,
                        marginTop: 14,
                        textAlign: "center",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            font: "var(--fw-bold) 22px/1 var(--font-core)",
                            fontVariantNumeric: "tabular-nums",
                            color: "var(--purple-200)",
                          }}
                        >
                          {activeDaySavedEvents.length}
                        </div>
                        <div className="cd-label" style={{ marginTop: 4 }}>
                          SAVED
                        </div>
                      </div>

                      <div>
                        <div
                          style={{
                            font: "var(--fw-bold) 22px/1 var(--font-core)",
                            fontVariantNumeric: "tabular-nums",
                            color: agendaConflicts.length > 0 ? "var(--coral-500)" : "var(--text-primary)",
                          }}
                        >
                          {agendaConflicts.length}
                        </div>
                        <div className="cd-label" style={{ marginTop: 4 }}>
                          CONFLICTS
                        </div>
                      </div>

                      <div>
                        <div
                          style={{
                            font: "var(--fw-bold) 22px/1 var(--font-core)",
                            fontVariantNumeric: "tabular-nums",
                            color: "var(--gold-500)",
                          }}
                        >
                          {totalWalkTimeMinutes} <span style={{ fontSize: 13 }}>MIN</span>
                        </div>
                        <div className="cd-label" style={{ marginTop: 4 }}>
                          WALK TOTAL
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Conflict Alert Banner */}
                  {agendaConflicts.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        marginBottom: "var(--module-gap)",
                        background: "rgba(229,72,77,.10)",
                        border: "1px solid rgba(229,72,77,.35)",
                        borderRadius: "var(--r-panel)",
                      }}
                    >
                      <Icon name="triangle-alert" size={16} color="var(--coral-500)" />
                      <span style={{ flex: 1, font: "var(--type-body-sm)", color: "var(--coral-500)" }}>
                        {agendaConflicts.length} schedule conflict{agendaConflicts.length > 1 ? "s" : ""} detected.
                      </span>
                    </div>
                  )}

                  {/* Saved Events List */}
                  {activeDaySavedEvents.length === 0 ? (
                    <div
                      className="cd-glass-panel"
                      style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}
                    >
                      Nothing saved for this day yet. Browse the <strong>Schedule</strong> tab to bookmark panels!
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {activeDaySavedEvents.map((ev, index) => {
                        const timeInfo = parseTimeDisplay(ev.timeString);
                        const venueInfo = parseVenueRoom(ev.location);
                        const isConflict = checkEventConflict(ev.id);
                        const trackColor = TRACK_COLORS[ev.track?.toUpperCase() || ""] || "var(--purple-400)";

                        const prevEvent = index > 0 ? activeDaySavedEvents[index - 1] : null;
                        const walk = prevEvent
                          ? calculateWalkTime(prevEvent.location, ev.location)
                          : null;

                        return (
                          <div key={ev.id}>
                            {walk && walk.minutes > 0 && (
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                  padding: "4px 12px",
                                  margin: "4px 0",
                                  color: "var(--gold-400)",
                                  font: "var(--type-micro)",
                                }}
                              >
                                <Icon name="footprints" size={12} />
                                <span>
                                  {walk.minutes} MIN WALK • {walk.path}
                                </span>
                              </div>
                            )}
                            <PanelCard
                              time={timeInfo.start}
                              endTime={timeInfo.end}
                              title={ev.title}
                              venue={venueInfo.venue}
                              room={venueInfo.room}
                              track={ev.track || undefined}
                              trackColor={trackColor}
                              status={ev.status}
                              saved={true}
                              conflict={isConflict}
                              onSave={() => handleToggleEvent(ev.id, "going")}
                              onClick={() => setActiveDetailItem(ev)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </main>
          </div>
        )}

        {/* TAB 3: SQUAD (FRIENDS & OVERLAP) */}
        {activeTab === "friends" && (
          <div>
            <AppBar eyebrow="DRAGON CON '26 SQUAD" title="Squad" navTabs={desktopNavTabs} />

            <main style={{ maxWidth: 900, margin: "0 auto", padding: "16px var(--gutter)" }}>
              {!currentUser ? (
                <div className="cd-glass-panel" style={{ padding: 30, textAlign: "center" }}>
                  <h2 style={{ font: "var(--type-heading)", color: "var(--gold-500)", marginBottom: 8 }}>
                    CONNECT WITH YOUR SQUAD
                  </h2>
                  <p style={{ font: "var(--type-body)", color: "var(--text-secondary)", marginBottom: 16 }}>
                    Add your con buddies by username to compare schedules and find shared panels.
                  </p>
                  <button onClick={() => setShowAuthModal(true)} className="cd-btn cd-btn-signal">
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
                    <div style={{ marginBottom: 12, color: "var(--gold-500)", font: "var(--type-data)" }}>
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
                            borderColor: selectedFriend?.id === friend.id ? "var(--purple-400)" : "var(--line-hairline)",
                            boxShadow: selectedFriend?.id === friend.id ? "var(--glow-purple)" : "var(--shadow-2)",
                          }}
                        >
                          <div style={{ font: "var(--type-subhead)", color: "var(--text-primary)" }}>{friend.name}</div>
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
                      <span className="cd-label" style={{ display: "block", marginBottom: 12, color: "var(--gold-500)" }}>
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
                              }}
                            >
                              <div style={{ font: "var(--type-subhead)", color: "#fff" }}>{ev.title}</div>
                              <div className="cd-data" style={{ color: "var(--text-secondary)", fontSize: 11 }}>
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
            </main>
          </div>
        )}

        {/* TAB 4: UPDATES & DIFF FEED */}
        {activeTab === "changes" && (
          <div>
            <AppBar eyebrow="DRAGON CON '26" title="Schedule Changes" navTabs={desktopNavTabs} />

            <main style={{ maxWidth: 900, margin: "0 auto", padding: "16px var(--gutter)" }}>
              <span className="cd-label" style={{ display: "block", marginBottom: 14 }}>
                LIVE DIFF FEED & PROGRAMMING CHANGES
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {changesList.length === 0 ? (
                  <div className="cd-glass-panel" style={{ color: "var(--text-tertiary)", textAlign: "center", padding: 30 }}>
                    No schedule changes recorded yet. Click <strong>Updates</strong> to fetch the latest updates!
                  </div>
                ) : (
                  changesList.map((change: EventChange) => (
                    <div key={change.id} className="cd-glass-panel">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
                      <div className="cd-data" style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
                        DETECTED: {new Date(change.detectedAt).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </main>
          </div>
        )}

        {/* TAB 5: PROFILE SCREEN & AUTH */}
        {activeTab === "profile" && (
          <div>
            <AppBar
              title="Profile"
              navTabs={desktopNavTabs}
              right={
                currentUser
                  ? [
                      {
                        icon: "log-out",
                        label: "Sign out",
                        onClick: handleLogout,
                      },
                    ]
                  : []
              }
            />

            <main style={{ maxWidth: 900, margin: "0 auto", padding: "16px var(--gutter)" }}>
              {!currentUser ? (
                /* Logged-Out Authentication Card */
                <div className="cd-glass-panel cd-notch" style={{ padding: 24, maxWidth: 440, margin: "0 auto" }}>
                  <div className="cd-label" style={{ color: "var(--gold-500)", marginBottom: 8, textAlign: "center" }}>
                    CYBERDRAGON AUTHENTICATION
                  </div>
                  <h2 style={{ font: "var(--type-heading)", textAlign: "center", margin: "0 0 8px 0" }}>
                    {authMode === "login" ? "Welcome to CyberDragon" : "Create Squad Account"}
                  </h2>
                  <p
                    style={{
                      font: "var(--type-body-sm)",
                      color: "var(--text-secondary)",
                      textAlign: "center",
                      marginBottom: 20,
                    }}
                  >
                    Sign in for offline schedule syncing, walk-time alarms, and squad features.
                  </p>

                  {supportsPasskeys && (
                    <button
                      onClick={authMode === "login" ? handlePasskeyLogin : handleQuickPasskeyRegister}
                      className="cd-btn cd-btn-primary"
                      style={{
                        width: "100%",
                        padding: 12,
                        fontSize: 14,
                        marginBottom: 16,
                        background: "var(--grad-brand)",
                      }}
                    >
                      {authMode === "login" ? "⚡ 1-CLICK PASSKEY LOGIN" : "✨ 1-CLICK REGISTER WITH PASSKEY"}
                    </button>
                  )}

                  {authError && (
                    <div style={{ color: "var(--coral-500)", font: "var(--type-body-sm)", marginBottom: 12 }}>
                      {authError}
                    </div>
                  )}

                  <form onSubmit={handleAuthSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {authMode === "register" && (
                      <div>
                        <div className="cd-label" style={{ marginBottom: 4 }}>
                          YOUR NAME
                        </div>
                        <input
                          type="text"
                          placeholder="e.g. Alex"
                          value={authName}
                          onChange={(e) => setAuthName(e.target.value)}
                          style={{
                            width: "100%",
                            padding: 10,
                            borderRadius: "var(--r-control)",
                            border: "1px solid var(--line-subtle)",
                            backgroundColor: "var(--surface-inset)",
                            color: "#fff",
                            font: "var(--type-body-sm)",
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
                          font: "var(--type-body-sm)",
                          boxSizing: "border-box",
                        }}
                        required
                      />
                    </div>

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
                          font: "var(--type-body-sm)",
                          boxSizing: "border-box",
                        }}
                        required
                      />
                    </div>

                    <button type="submit" className="cd-btn cd-btn-signal" style={{ padding: 12, marginTop: 4 }}>
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
                /* Logged-In Profile Dashboard */
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {/* Digital Con Badge Card */}
                  <div
                    className="cd-glass-panel"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      background: "var(--surface-glass-strong)",
                      border: "1px solid var(--line-purple)",
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 52,
                        height: 52,
                        font: "var(--fw-bold) 18px/1 var(--font-core)",
                        color: "#fff",
                        background: "var(--grad-brand)",
                        borderRadius: "var(--r-2)",
                        boxShadow: "var(--inner-lip)",
                      }}
                    >
                      {currentUser.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: "var(--type-subhead)", color: "#fff", fontSize: 16 }}>{currentUser.name}</div>
                      <div className="cd-data" style={{ color: "var(--text-tertiary)", fontSize: 12 }}>
                        @{currentUser.username}
                      </div>
                      <div className="cd-data" style={{ color: "var(--gold-400)", fontSize: 11, marginTop: 2 }}>
                        BADGE DC-40-{currentUser.id.toUpperCase().slice(0, 8)}
                      </div>
                    </div>

                    {currentUser.role === "admin" && (
                      <a
                        href="/admin"
                        className="cd-btn cd-btn-signal"
                        style={{ textDecoration: "none", fontSize: 11, padding: "4px 8px", marginRight: 6 }}
                      >
                        [Admin]
                      </a>
                    )}
                    <span
                      className="cd-badge"
                      style={{ background: "var(--accent-quiet)", color: "var(--purple-300)", border: "1px solid var(--line-purple)" }}
                    >
                      ATTENDING
                    </span>
                  </div>

                  {/* Passkey Management */}
                  {supportsPasskeys && (
                    <div
                      className="cd-glass-panel"
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}
                    >
                      <div>
                        <div style={{ font: "var(--type-subhead)" }}>Passkey Biometrics</div>
                        <div className="cd-data" style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
                          Touch ID / Face ID 1-click login
                        </div>
                      </div>
                      <button
                        onClick={handleRegisterPasskey}
                        className="cd-btn cd-btn-ghost"
                        style={{ borderColor: "var(--line-purple)", color: "var(--purple-200)", padding: "6px 12px" }}
                      >
                        🔑 + Register Passkey
                      </button>
                    </div>
                  )}

                  {/* App & Offline Storage */}
                  <AppStoragePanel
                    isOnline={isOnline}
                    lastSyncedMinutesAgo={minutesSinceSync}
                    savedPanelCount={totalEvents || eventsList.length}
                    isSyncing={isSyncing}
                    installPrompt={installPrompt}
                    isInstalled={isInstalled}
                    onInstallPromptUsed={() => setInstallPrompt(null)}
                    onSyncNow={handleCheckForUpdates}
                    onNotify={triggerToast}
                  />

                  {/* Feedback Submission */}
                  <FeedbackPanel
                    user={{ id: currentUser.id, username: currentUser.username }}
                    onNotify={triggerToast}
                  />

                  {/* Con Alerts & Notifications */}
                  <div className="cd-glass-panel" style={{ padding: "12px 16px" }}>
                    <div className="cd-label" style={{ marginBottom: 8, color: "var(--gold-500)" }}>
                      CON ALERTS & NOTIFICATIONS
                    </div>

                    <div className="cd-switch-row" style={{ borderBottom: "1px solid var(--line-hairline)" }}>
                      <div>
                        <div style={{ font: "var(--type-body-sm)", color: "#fff" }}>Panel reminders</div>
                        <div className="cd-data" style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
                          15 minutes before panel start
                        </div>
                      </div>
                      <div
                        className={`cd-switch ${remindersEnabled ? "checked" : ""}`}
                        onClick={() => setRemindersEnabled(!remindersEnabled)}
                      >
                        <div className="cd-switch-thumb" />
                      </div>
                    </div>

                    <div className="cd-switch-row" style={{ borderBottom: "1px solid var(--line-hairline)" }}>
                      <div>
                        <div style={{ font: "var(--type-body-sm)", color: "#fff" }}>Walk-time warnings</div>
                        <div className="cd-data" style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
                          Flag tight hotel venue changes (&lt; 10 min)
                        </div>
                      </div>
                      <div
                        className={`cd-switch ${walkWarningsEnabled ? "checked" : ""}`}
                        onClick={() => setWalkWarningsEnabled(!walkWarningsEnabled)}
                      >
                        <div className="cd-switch-thumb" />
                      </div>
                    </div>

                    <div className="cd-switch-row">
                      <div>
                        <div style={{ font: "var(--type-body-sm)", color: "#fff" }}>Haptic feedback</div>
                        <div className="cd-data" style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
                          Vibrate on schedule actions & alarms
                        </div>
                      </div>
                      <div
                        className={`cd-switch ${hapticsEnabled ? "checked" : ""}`}
                        onClick={() => setHapticsEnabled(!hapticsEnabled)}
                      >
                        <div className="cd-switch-thumb" />
                      </div>
                    </div>
                  </div>

                  {/* Display & Venue Preferences */}
                  <div className="cd-glass-panel" style={{ padding: "12px 16px" }}>
                    <div className="cd-label" style={{ marginBottom: 12, color: "var(--gold-500)" }}>
                      DISPLAY & VENUE PREFERENCES
                    </div>

                    <div style={{ marginBottom: 14 }}>
                      <div className="cd-label" style={{ marginBottom: 6 }}>
                        TIME FORMAT
                      </div>
                      <select
                        value={timeFormat}
                        onChange={(e) => {
                          const val = e.target.value as "12h" | "24h";
                          setTimeFormat(val);
                          localStorage.setItem("dc_time_format", val);
                        }}
                        className="cd-select"
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
                        value={homeVenue}
                        onChange={(e) => {
                          setHomeVenue(e.target.value);
                          localStorage.setItem("dc_home_venue", e.target.value);
                        }}
                        className="cd-select"
                        style={{ width: "100%" }}
                      >
                        <option value="Hyatt Regency">Hyatt Regency Atlanta</option>
                        <option value="Marriott Marquis">Marriott Marquis Atlanta</option>
                        <option value="Hilton Atlanta">Hilton Atlanta</option>
                        <option value="Courtland Grand">Courtland Grand / Sheraton</option>
                        <option value="Westin Peachtree">Westin Peachtree Plaza</option>
                        <option value="AmericasMart">AmericasMart</option>
                      </select>
                    </div>
                  </div>

                  {/* Sign Out Action */}
                  <button
                    onClick={handleLogout}
                    className="cd-btn cd-btn-ghost"
                    style={{ color: "var(--coral-500)", borderColor: "var(--coral-500)", padding: 12 }}
                  >
                    SIGN OUT
                  </button>

                  <div className="cd-label" style={{ textAlign: "center", marginTop: 12 }}>
                    {`CYBERDRAGON ${APP_VERSION} · DRAGON CON 2026 COMPANION`}
                  </div>
                </div>
              )}
            </main>
          </div>
        )}

        {/* Filter Sheet Drawer */}
        {showFilterSheet && (
          <div className="cd-sheet" onClick={() => setShowFilterSheet(false)}>
            <div className="cd-sheet-panel cd-scroll" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h3 style={{ margin: 0, font: "var(--type-heading)", color: "var(--gold-500)" }}>Filter panels</h3>
                <button
                  onClick={() => setShowFilterSheet(false)}
                  className="cd-btn cd-btn-ghost"
                  style={{ padding: "4px 8px" }}
                >
                  ✕
                </button>
              </div>

              {/* Fan Tracks multi-selector */}
              <div className="cd-label" style={{ marginBottom: 8 }}>
                FAN TRACKS
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
                <Tag
                  accent="var(--gold-500)"
                  selected={selectedTrack === ""}
                  onClick={() => setSelectedTrack("")}
                >
                  ALL TRACKS
                </Tag>
                {tracks.map((t) => (
                  <Tag
                    key={t}
                    accent={TRACK_COLORS[t.toUpperCase()] || "var(--purple-400)"}
                    selected={selectedTrack === t}
                    onClick={() => setSelectedTrack(selectedTrack === t ? "" : t)}
                  >
                    {t}
                  </Tag>
                ))}
              </div>

              {/* Venues Selector */}
              {locations && locations.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <div className="cd-label" style={{ marginBottom: 8 }}>
                    VENUES & ROOMS
                  </div>
                  <select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className="cd-select"
                    style={{ width: "100%" }}
                  >
                    <option value="">ALL VENUES ({locations.length})</option>
                    {locations.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {/* Smart Condition Options */}
              <div className="cd-label" style={{ marginBottom: 8 }}>
                OPTIONS
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={hideEndedPanels}
                    onChange={(e) => setHideEndedPanels(e.target.checked)}
                  />
                  <span style={{ font: "var(--type-body-sm)" }}>Hide panels that have ended</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={hideConflicts}
                    onChange={(e) => setHideConflicts(e.target.checked)}
                  />
                  <span style={{ font: "var(--type-body-sm)" }}>Hide conflicts with my schedule</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={walkabilityOnly}
                    onChange={(e) => setWalkabilityOnly(e.target.checked)}
                  />
                  <div>
                    <span style={{ font: "var(--type-body-sm)", display: "block" }}>
                      Walkable in under 10 minutes
                    </span>
                    <span className="cd-data" style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
                      From previous saved panel or home hotel
                    </span>
                  </div>
                </label>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button
                  onClick={() => {
                    setSelectedTrack("");
                    setSelectedLocation("");
                    setHideEndedPanels(false);
                    setHideConflicts(false);
                    setWalkabilityOnly(false);
                  }}
                  className="cd-btn cd-btn-ghost"
                  style={{ flex: 1 }}
                >
                  Reset
                </button>
                <button
                  onClick={() => setShowFilterSheet(false)}
                  className="cd-btn cd-btn-primary"
                  style={{ flex: 2, background: "var(--grad-brand)" }}
                >
                  Show {filteredEvents.length} Panels
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Panel Detail Modal */}
        {activeDetailItem && (
          <PanelDetailModal
            item={activeDetailItem}
            previousVenue={getPrecedingVenue(activeDetailItem)}
            saved={!!userEventStatusMap[activeDetailItem.id]}
            onToggleSave={() =>
              handleToggleEvent(
                activeDetailItem.id,
                userEventStatusMap[activeDetailItem.id] ? userEventStatusMap[activeDetailItem.id] : "going",
              )
            }
            onClose={() => setActiveDetailItem(null)}
          />
        )}
        {/* Auth Modal Sheet */}
        {showAuthModal && (
          <div className="cd-sheet" onClick={() => setShowAuthModal(false)}>
            <div className="cd-sheet-panel cd-notch" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440, padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div className="cd-label" style={{ color: "var(--gold-500)" }}>
                  {authMode === "login" ? "LOG IN TO CYBERDRAGON" : "CREATE SQUAD ACCOUNT"}
                </div>
                <button onClick={() => setShowAuthModal(false)} className="cd-btn cd-btn-ghost" style={{ padding: "4px 8px" }}>
                  ✕
                </button>
              </div>

              {supportsPasskeys && authMode === "login" && (
                <button
                  onClick={handlePasskeyLogin}
                  className="cd-btn cd-btn-primary"
                  style={{ width: "100%", padding: 12, fontSize: 13, marginBottom: 16, background: "var(--grad-brand)" }}
                >
                  ⚡ 1-CLICK PASSKEY LOGIN
                </button>
              )}

              {supportsPasskeys && authMode === "register" && (
                <button
                  onClick={handleQuickPasskeyRegister}
                  className="cd-btn cd-btn-primary"
                  style={{ width: "100%", padding: 12, fontSize: 13, marginBottom: 16, background: "var(--grad-brand)" }}
                >
                  ✨ 1-CLICK REGISTER WITH PASSKEY
                </button>
              )}

              {authError && <div style={{ color: "var(--coral-500)", font: "var(--type-body-sm)", marginBottom: 12 }}>{authError}</div>}

              <form onSubmit={handleAuthSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {authMode === "register" && (
                  <input
                    type="text"
                    placeholder="Your Name (e.g. Alex)"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    style={{ padding: 10, borderRadius: "var(--r-control)", border: "1px solid var(--line-subtle)", backgroundColor: "var(--surface-inset)", color: "#fff", font: "var(--type-body-sm)" }}
                    required
                  />
                )}

                <input
                  type="text"
                  placeholder="Username"
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  style={{ padding: 10, borderRadius: "var(--r-control)", border: "1px solid var(--line-subtle)", backgroundColor: "var(--surface-inset)", color: "#fff", font: "var(--type-body-sm)" }}
                  required
                />

                <input
                  type="password"
                  placeholder="Password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  style={{ padding: 10, borderRadius: "var(--r-control)", border: "1px solid var(--line-subtle)", backgroundColor: "var(--surface-inset)", color: "#fff", font: "var(--type-body-sm)" }}
                  required
                />

                <button type="submit" className="cd-btn cd-btn-signal" style={{ padding: 12 }}>
                  {authMode === "login" ? "LOG IN WITH PASSWORD" : "REGISTER WITH PASSWORD"}
                </button>
              </form>

              <div style={{ marginTop: 16, textAlign: "center", font: "var(--type-body-sm)", color: "var(--text-tertiary)" }}>
                {authMode === "login" ? (
                  <span>
                    Need an account?{" "}
                    <button onClick={() => setAuthMode("register")} style={{ color: "var(--gold-500)", border: "none", background: "none", cursor: "pointer" }}>
                      Register
                    </button>
                  </span>
                ) : (
                  <span>
                    Already have an account?{" "}
                    <button onClick={() => setAuthMode("login")} style={{ color: "var(--gold-500)", border: "none", background: "none", cursor: "pointer" }}>
                      Log In
                    </button>
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Mobile Bottom TabBar (Fixed) */}
        <nav className="cd-tabbar">
          <button
            onClick={() => setActiveTab("schedule")}
            className={`cd-tabbar-item ${activeTab === "schedule" ? "active" : ""}`}
          >
            <Icon name="calendar-clock" size={20} />
            <span>Schedule</span>
          </button>

          <button
            onClick={() => setActiveTab("agenda")}
            className={`cd-tabbar-item ${activeTab === "agenda" ? "active" : ""}`}
          >
            <Icon name="bookmark" size={20} />
            <span>Mine</span>
            {agendaItems.length > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: 6,
                  right: "26%",
                  background: "var(--purple-500)",
                  color: "#fff",
                  fontSize: 9,
                  fontWeight: 700,
                  borderRadius: "50%",
                  width: 15,
                  height: 15,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {agendaItems.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("friends")}
            className={`cd-tabbar-item ${activeTab === "friends" ? "active" : ""}`}
          >
            <Icon name="users" size={20} />
            <span>Squad</span>
          </button>

          <button
            onClick={() => setActiveTab("profile")}
            className={`cd-tabbar-item ${activeTab === "profile" ? "active" : ""}`}
          >
            <Icon name="user" size={20} />
            <span>Profile</span>
          </button>
        </nav>
      </div>
    </ErrorBoundary>
  );
}
