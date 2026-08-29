import { useEffect, useState } from "react";
import type { InstallPromptEvent } from "../../AppStoragePanel.tsx";
import { setupGlobalErrorCatchers } from "../../../lib/errorReporting.ts";
import { APP_VERSION } from "../../../lib/version.ts";
import { cleanUrlParam } from "../../../lib/squadUtils.ts";
import type { EventChange, EventItem } from "../homeTypes.ts";

export interface UseAppSyncAndPrefsOptions {
  recentChanges: EventChange[];
  triggerToast: (message: string, type?: "ok" | "warn", actionLabel?: string, onAction?: () => void) => void;
  /** Accepted for API-contract consistency with the plan; only the setter is used (see task-3-report.md deviations). */
  activeDetailItem: EventItem | null;
  setActiveDetailItem: (item: EventItem | null) => void;
  /** Sourced from `useScheduleFilters().setEventsList` — "check for updates" also refreshes the schedule grid. */
  onEventsRefreshed?: (events: EventItem[]) => void;
}

export function useAppSyncAndPrefs({
  recentChanges,
  triggerToast,
  setActiveDetailItem,
  onEventsRefreshed,
}: UseAppSyncAndPrefsOptions) {
  const [changesList, setChangesList] = useState<EventChange[]>(recentChanges || []);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState("");
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());
  const [isOnline, setIsOnline] = useState(true);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  // Con Preferences
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [walkWarningsEnabled, setWalkWarningsEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(false);
  const [timeFormat, setTimeFormatState] = useState<"12h" | "24h">("12h");
  const [homeVenue, setHomeVenueState] = useState<string>("Hyatt Regency");

  const setTimeFormat = (val: "12h" | "24h") => {
    setTimeFormatState(val);
    localStorage.setItem("dc_time_format", val);
  };
  const setHomeVenue = (val: string) => {
    setHomeVenueState(val);
    localStorage.setItem("dc_home_venue", val);
  };

  const cleanEventUrlParam = () => cleanUrlParam("event");

  // Initialize PWA install detection, connectivity tracking, restored display
  // prefs, global error reporting, and the ?event= deep link resolver.
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(console.error);
    }

    // iOS Safari exposes a non-standard `navigator.standalone` flag; narrow once via a named const.
    const iosNavigator = navigator as Navigator & { standalone?: boolean };
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches || iosNavigator.standalone === true;
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

    // Cloudflare Web Analytics (SPA mode) - only in production
    const cfBeaconToken = import.meta.env.VITE_CF_BEACON_TOKEN;
    if (
      import.meta.env.PROD &&
      cfBeaconToken &&
      !document.querySelector('script[src*="cloudflareinsights.com/beacon"]')
    ) {
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

    const savedHomeVenue = localStorage.getItem("dc_home_venue");
    if (savedHomeVenue) setHomeVenueState(savedHomeVenue);

    const savedTimeFormat = localStorage.getItem("dc_time_format");
    if (savedTimeFormat === "12h" || savedTimeFormat === "24h") setTimeFormatState(savedTimeFormat);

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

    // Resolve ?event=<id> deep link by fetching the event and opening its detail modal
    const eventParam = new URLSearchParams(window.location.search).get("event");
    if (eventParam) {
      fetch(`/api/events?id=${encodeURIComponent(eventParam)}`)
        .then((res) => res.json() as Promise<{ success: boolean; event?: EventItem }>)
        .then((data) => {
          if (data.success && data.event) {
            setActiveDetailItem(data.event);
          }
        })
        .catch(() => {
          // ignore deep link resolution errors
        });
    }

    return () => {
      cleanupErrorCatchers();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const [evRes, chRes] = await Promise.all([fetch("/api/events"), fetch("/api/changes")]);

      const evData = (await evRes.json().catch(() => ({}))) as { success?: boolean; events?: EventItem[] };
      if (evData.success && evData.events) {
        onEventsRefreshed?.(evData.events);
      }

      const chData = (await chRes.json().catch(() => ({}))) as { success?: boolean; changes?: EventChange[] };
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

  // Minutes since last sync calculation
  const minutesSinceSync = Math.max(0, Math.floor((Date.now() - lastSyncTime) / 60000));

  return {
    changesList,
    setChangesList,
    isSyncing,
    syncStatusMsg,
    lastSyncTime,
    minutesSinceSync,
    isOnline,
    installPrompt,
    setInstallPrompt,
    isInstalled,
    remindersEnabled,
    setRemindersEnabled,
    walkWarningsEnabled,
    setWalkWarningsEnabled,
    hapticsEnabled,
    setHapticsEnabled,
    timeFormat,
    setTimeFormat,
    homeVenue,
    setHomeVenue,
    handleCheckForUpdates,
    cleanEventUrlParam,
  };
}
