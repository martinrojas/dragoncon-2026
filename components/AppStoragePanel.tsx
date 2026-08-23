import React, { useEffect, useState } from "react";
import { VENUE_MAPS } from "../lib/maps";
import { APP_VERSION } from "../lib/version";

export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export interface AppStoragePanelProps {
  isOnline: boolean;
  lastSyncedMinutesAgo: number;
  savedPanelCount: number;
  isSyncing: boolean;
  installPrompt: InstallPromptEvent | null;
  isInstalled: boolean;
  onInstallPromptUsed: () => void;
  onSyncNow: () => void;
  onNotify: (message: string, type?: "ok" | "warn") => void;
}

export function AppStoragePanel({
  isOnline,
  lastSyncedMinutesAgo,
  savedPanelCount,
  isSyncing,
  installPrompt,
  isInstalled,
  onInstallPromptUsed,
  onSyncNow,
  onNotify,
}: AppStoragePanelProps): React.JSX.Element {
  const [storageUsedLabel, setStorageUsedLabel] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);

  const refreshStorage = async (): Promise<void> => {
    if (typeof navigator !== "undefined" && navigator.storage && typeof navigator.storage.estimate === "function") {
      try {
        const { usage } = await navigator.storage.estimate();
        setStorageUsedLabel(`${((usage ?? 0) / 1048576).toFixed(1)} MB`);
      } catch {
        setStorageUsedLabel(null);
      }
    } else {
      setStorageUsedLabel(null);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    void refreshStorage();
  }, []);

  const resolveCacheName = async (): Promise<string> => {
    if (typeof caches === "undefined") return "dragoncon-pwa-v1";
    try {
      const keys = await caches.keys();
      return keys.find((k) => k.startsWith("dragoncon-pwa-")) ?? "dragoncon-pwa-v1";
    } catch {
      return "dragoncon-pwa-v1";
    }
  };

  const handleInstallClick = async (): Promise<void> => {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === "accepted") {
        onNotify("CyberDragon added to your home screen");
      }
    } catch {
      onNotify("Couldn't add to home screen — try from your browser menu", "warn");
    } finally {
      onInstallPromptUsed();
    }
  };

  const handleSaveForOffline = async (): Promise<void> => {
    if (typeof caches === "undefined") {
      onNotify("This browser can't save offline data", "warn");
      return;
    }

    setIsSaving(true);
    try {
      const mapUrls = VENUE_MAPS.map((v) => v.localPath).filter((p): p is string => Boolean(p));
      const urlsToCache = ["/", "/manifest.webmanifest", "/cyberdragon.css", ...mapUrls];

      const cacheName = await resolveCacheName();
      const cache = await caches.open(cacheName);

      const results = await Promise.allSettled(urlsToCache.map((u) => cache.add(u)));
      const rejectedCount = results.filter((r) => r.status === "rejected").length;
      const savedCount = results.length - rejectedCount;

      if (rejectedCount > 0) {
        onNotify(`Saved ${savedCount} of ${results.length} items for offline use`, "warn");
      } else {
        onNotify(`Saved ${results.length} of ${results.length} items for offline use`);
      }
      await refreshStorage();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onNotify(`Offline save issue: ${msg}`, "warn");
    } finally {
      setIsSaving(false);
    }
  };

  const handleFreeUpSpace = async (): Promise<void> => {
    const confirmed = window.confirm(
      "Clear saved offline data? Your account, saved panels, and settings stay safe."
    );
    if (!confirmed) return;

    if (typeof caches === "undefined") {
      onNotify("No offline data found");
      return;
    }

    setIsClearing(true);
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await refreshStorage();
      onNotify("Offline data cleared");
    } catch {
      onNotify("Couldn't clear offline data", "warn");
    } finally {
      setIsClearing(false);
    }
  };

  const handleCheckForUpdates = async (): Promise<void> => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      onNotify("Offline mode isn't available on this browser", "warn");
      return;
    }

    setIsChecking(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        onNotify("Offline mode isn't set up yet — try Save For Offline", "warn");
        return;
      }

      await reg.update();
      if (reg.waiting || reg.installing) {
        onNotify("Update ready — reloading");
        window.setTimeout(() => window.location.reload(), 900);
      } else {
        onNotify("You're on the latest version");
      }
    } catch {
      onNotify("Couldn't check for updates", "warn");
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="cd-glass-panel" style={{ padding: "12px 16px" }}>
      <div className="cd-label" style={{ marginBottom: 8, color: "var(--gold-500)" }}>
        APP & OFFLINE STORAGE
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {isInstalled ? (
          <div style={{ font: "var(--type-body-sm)", color: "var(--jade-500)", display: "flex", alignItems: "center", gap: 6 }}>
            <span>✓</span> Installed on this device — you&apos;re all set.
          </div>
        ) : installPrompt ? (
          <div>
            <button
              type="button"
              className="cd-btn cd-btn-ghost"
              style={{ fontSize: 12, borderColor: "var(--purple-500)" }}
              onClick={() => void handleInstallClick()}
            >
              📲 Add to Home Screen
            </button>
          </div>
        ) : (
          <div style={{ font: "var(--type-body-sm)", color: "var(--text-secondary)" }}>
            iPhone: tap Share (⎋), then &quot;Add to Home Screen&quot;. Android: open the browser menu (⋮), then &quot;Install app&quot;.
          </div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
          <button
            type="button"
            className="cd-btn cd-btn-ghost"
            style={{ fontSize: 12 }}
            disabled={isSaving}
            onClick={() => void handleSaveForOffline()}
          >
            {isSaving ? "Saving…" : "⬇️ Save For Offline"}
          </button>

          <button
            type="button"
            className="cd-btn cd-btn-ghost"
            style={{ fontSize: 12 }}
            disabled={isClearing}
            onClick={() => void handleFreeUpSpace()}
          >
            {isClearing ? "Clearing…" : "🧹 Free Up Space"}
          </button>

          <button
            type="button"
            className="cd-btn cd-btn-ghost"
            style={{ fontSize: 12 }}
            disabled={isChecking}
            onClick={() => void handleCheckForUpdates()}
          >
            {isChecking ? "Checking…" : "🔄 Check For Updates"}
          </button>
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--line-hairline)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", font: "var(--type-body-sm)" }}>
          <span className="cd-label">Connection</span>
          <span className="cd-data">
            {isOnline ? (
              <span style={{ color: "var(--jade-500)" }}>Online</span>
            ) : (
              <span style={{ color: "var(--coral-500)" }}>Offline — using saved data</span>
            )}
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", font: "var(--type-body-sm)" }}>
          <span className="cd-label">Schedule</span>
          <span className="cd-data">
            {lastSyncedMinutesAgo === 0 ? "Updated just now" : `Updated ${lastSyncedMinutesAgo} min ago`} · {savedPanelCount} panels saved
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", font: "var(--type-body-sm)" }}>
          <span className="cd-label">Storage used</span>
          <span className="cd-data">{storageUsedLabel ?? "Not available on this browser"}</span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", font: "var(--type-body-sm)" }}>
          <span className="cd-label">App version</span>
          <span className="cd-data">{APP_VERSION}</span>
        </div>

        <div style={{ marginTop: 6, display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            className="cd-btn cd-btn-ghost"
            style={{ fontSize: 12 }}
            disabled={isSyncing}
            onClick={onSyncNow}
          >
            {isSyncing ? "Syncing…" : "🔄 Sync Schedule Now"}
          </button>
        </div>
      </div>
    </div>
  );
}
