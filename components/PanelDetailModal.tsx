import type { JSX } from "react";
import { useEffect } from "react";
import { calculateWalkTime, getVenueCapacityStatus } from "../lib/walktime";

export interface EventItem {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  track?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  durationMinutes?: number | null;
  day?: string | null;
  timeString?: string | null;
  speakers?: string | null;
  contentHash?: string;
}

export interface PanelDetailModalProps {
  item: EventItem;
  previousVenue?: string | null;
  saved: boolean;
  onToggleSave: () => void;
  onClose: () => void;
}

export function PanelDetailModal({
  item,
  previousVenue,
  saved,
  onToggleSave,
  onClose,
}: PanelDetailModalProps): JSX.Element {
  const walkInfo = calculateWalkTime(previousVenue, item.location);
  const capInfo = getVenueCapacityStatus(item.timeString ?? null, item.location ?? null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Parse speakers into panelist avatars
  const panelists = item.speakers
    ? item.speakers
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(12, 14, 17, 0.75)",
        backdropFilter: "var(--blur-scrim)",
        WebkitBackdropFilter: "var(--blur-scrim)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        className="cd-glass-panel cd-notch cd-scroll"
        style={{
          width: "100%",
          maxWidth: 600,
          maxHeight: "88vh",
          overflowY: "auto",
          padding: 24,
          boxShadow: "var(--shadow-sheet)",
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 12,
            gap: 12,
          }}
        >
          <div style={{ flex: 1 }}>
            <span
              className="cd-badge cd-badge-purple"
              style={{ marginBottom: 6, display: "inline-block" }}
            >
              {item.track || "FAN TRACK"}
            </span>
            <h2
              style={{
                margin: "4px 0",
                font: "var(--type-title)",
                color: "var(--text-primary)",
                wordBreak: "break-word",
              }}
            >
              {item.title}
            </h2>
            <div className="cd-data" style={{ color: "var(--gold-400)", fontSize: 13 }}>
              📍 {item.location || "VENUE TBD"} • 🕒 {item.timeString || "TIME TBD"}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cd-btn cd-btn-ghost"
            style={{ padding: "4px 10px", fontSize: 16, lineHeight: 1 }}
            aria-label="Close detail modal"
          >
            ✕
          </button>
        </div>

        {/* Metrics Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            margin: "16px 0",
          }}
        >
          <div className="cd-datacard">
            <div className="cd-label">WALK FROM LAST</div>
            <div className="cd-datacard-value" style={{ color: "var(--gold-500)" }}>
              {walkInfo.minutes} <span style={{ fontSize: 12 }}>MIN</span>
            </div>
            <div className="cd-data" style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
              {walkInfo.path}
            </div>
          </div>

          <div className="cd-datacard">
            <div className="cd-label">ESTIMATED CAPACITY</div>
            <div className="cd-datacard-value" style={{ color: capInfo.accent }}>
              {capInfo.pct}%
            </div>
            <div className="cd-data" style={{ fontSize: 11, color: capInfo.accent }}>
              {capInfo.status}
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="cd-glass-panel" style={{ marginBottom: 16 }}>
          <div className="cd-label" style={{ marginBottom: 6 }}>
            ABOUT THIS PANEL
          </div>
          <p
            style={{
              margin: 0,
              font: "var(--type-body)",
              color: "var(--text-secondary)",
              lineHeight: "1.5",
              whiteSpace: "pre-line",
            }}
          >
            {item.description || "Official description not yet published by programming."}
          </p>
        </div>

        {/* Panelists */}
        {panelists.length > 0 && (
          <div
            className="cd-glass-panel"
            style={{ marginBottom: 16, padding: "12px 16px" }}
          >
            <div className="cd-label" style={{ marginBottom: 10 }}>
              PANELISTS & GUESTS
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {panelists.map((guest, idx) => {
                const parts = guest.split(" ").filter(Boolean);
                const initials =
                  parts.length > 1
                    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
                    : parts[0]
                    ? parts[0].slice(0, 2).toUpperCase()
                    : "G";
                return (
                  <div
                    key={`${guest}-${idx}`}
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 32,
                        height: 32,
                        font: "var(--type-label)",
                        color: "var(--purple-200)",
                        backgroundColor: "var(--accent-quiet)",
                        border: "1px solid var(--line-purple)",
                        borderRadius: "var(--r-control)",
                        flexShrink: 0,
                      }}
                    >
                      {initials}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        font: "var(--type-body)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {guest}
                    </span>
                    <span
                      className="cd-badge"
                      style={{
                        background: "var(--surface-3)",
                        color: "var(--text-tertiary)",
                        fontSize: 10,
                      }}
                    >
                      {idx === 0 ? "MODERATOR" : "PANELIST"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button
            type="button"
            onClick={() => {
              const query = encodeURIComponent(
                `${item.title} ${item.location || ""}`.trim()
              );
              window.open(
                `https://www.google.com/maps/search/?api=1&query=${query}`,
                "_blank",
                "noopener,noreferrer"
              );
            }}
            className="cd-btn cd-btn-ghost"
            style={{ flex: 1, padding: 12 }}
          >
            🗺️ ROUTE MAP
          </button>

          <button
            type="button"
            onClick={onToggleSave}
            className="cd-btn cd-btn-primary"
            style={{
              flex: 2,
              padding: 12,
              background: saved ? "var(--purple-600)" : "var(--grad-brand)",
              borderColor: saved ? "var(--purple-400)" : "transparent",
            }}
          >
            {saved ? "✓ ON MY SCHEDULE" : "+ ADD TO SCHEDULE"}
          </button>
        </div>
      </div>
    </div>
  );
}
