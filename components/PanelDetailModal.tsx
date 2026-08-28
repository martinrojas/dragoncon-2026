import type { JSX } from "react";
import { useState, useEffect, useRef } from "react";
import { calculateWalkTime } from "../lib/walktime";
import { resolveVenueMap, getOfficialEventUrl } from "../lib/maps";
import { shareLink } from "../lib/share";
import { VenueMapModal } from "./VenueMapModal";

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
  const [showMapModal, setShowMapModal] = useState<boolean>(false);
  const [shareToast, setShareToast] = useState<string>("");

  const walkInfo = calculateWalkTime(previousVenue, item.location);
  const mapMatch = resolveVenueMap(item.location);
  const officialEventUrl = getOfficialEventUrl(item.id);

  const dialogRef = useRef<HTMLDialogElement>(null);

  // Native <dialog>: showModal() gives top layer, focus trap, and Escape-to-close;
  // React's onClose wires the native `close` event back to parent state.
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  // Parse speakers into panelist avatars
  const panelists = item.speakers
    ? item.speakers
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  return (
    <>
      <dialog
        ref={dialogRef}
        onClose={onClose}
        onClick={(e) => {
          if (e.target === dialogRef.current) onClose();
        }}
        className="cd-glass-panel cd-notch cd-scroll cd-scrim"
        style={{
          position: "fixed",
          top: "auto",
          bottom: 0,
          left: 0,
          right: 0,
          margin: "0 auto",
          width: "100%",
          maxWidth: 600,
          maxHeight: "88vh",
          overflowY: "auto",
          padding: 24,
          color: "inherit",
          boxShadow: "var(--shadow-sheet)",
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
        }}
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

            <div
              className="cd-datacard"
              onClick={() => setShowMapModal(true)}
              style={{
                cursor: "pointer",
                border: "1px solid var(--line-gold)",
                transition: "var(--t-control)",
                backgroundColor: "var(--surface-3)",
              }}
              title="Click to view hotel floor plan"
            >
              <div className="cd-label" style={{ display: "flex", justifyContent: "space-between" }}>
                <span>VENUE FLOOR MAP</span>
                <span style={{ color: "var(--gold-500)" }}>🗺️ ↗</span>
              </div>
              <div
                className="cd-datacard-value"
                style={{
                  color: "var(--gold-400)",
                  fontSize: 15,
                  fontWeight: "bold",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {mapMatch.map.name}
              </div>
              <div className="cd-data" style={{ fontSize: 11, color: "var(--purple-300)" }}>
                {mapMatch.booth ? `Room: ${mapMatch.booth.name}` : "Tap to open floor plan"}
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
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowMapModal(true)}
                className="cd-btn cd-btn-secondary"
                style={{
                  flex: 1,
                  padding: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                🗺️ VIEW FLOOR MAP
              </button>

              {officialEventUrl && (
                <a
                  href={officialEventUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cd-btn cd-btn-ghost"
                  style={{
                    flex: 1,
                    padding: 12,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    borderBottom: "1px solid var(--line-gold)",
                    color: "var(--gold-400)",
                  }}
                  title="Open official Dragon Con app event page to rate session"
                >
                  ⭐ RATE SESSION ↗
                </a>
              )}

              <button
                type="button"
                onClick={async () => {
                  const url =
                    typeof window !== "undefined"
                      ? `${window.location.origin}/?event=${item.id}`
                      : `https://dragoncon.martinrojas.dev/?event=${item.id}`;
                  const res = await shareLink({
                    title: item.title,
                    text: `${item.title} · ${item.day || ""} ${item.timeString || ""}`,
                    url,
                  });
                  if (res.copied) {
                    setShareToast("Link copied to clipboard!");
                    setTimeout(() => setShareToast(""), 3000);
                  }
                }}
                className="cd-btn cd-btn-secondary"
                style={{
                  flex: 1,
                  padding: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                📤 SHARE PANEL
              </button>
            </div>

            <button
              type="button"
              onClick={onToggleSave}
              className="cd-btn cd-btn-primary"
              style={{
                width: "100%",
                padding: 14,
                background: saved ? "var(--purple-600)" : "var(--grad-brand)",
                borderColor: saved ? "var(--purple-400)" : "transparent",
              }}
            >
              {saved ? "✓ ON MY SCHEDULE" : "+ ADD TO SCHEDULE"}
            </button>

            {shareToast && (
              <div
                className="cd-data"
                style={{ textAlign: "center", color: "var(--jade-400)", fontSize: 12 }}
              >
                {shareToast}
              </div>
            )}
          </div>
      </dialog>

      {/* Render offline Floor Plan Modal */}
      {showMapModal && (
        <VenueMapModal
          location={item.location}
          title={item.title}
          onClose={() => setShowMapModal(false)}
        />
      )}
    </>
  );
}
