import type { JSX } from "react";
import { Tag } from "../../CyberDragonUi.tsx";
import { TRACK_COLORS } from "../homeTypes.ts";

interface ScheduleFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  tracks?: string[];
  excludedTracks: string[];
  onToggleExcludeTrack: (track: string) => void;
  onResetTracks: () => void;
  locations?: string[];
  selectedLocation: string;
  setSelectedLocation: (loc: string) => void;
  hideEndedPanels: boolean;
  setHideEndedPanels: (h: boolean) => void;
  hideConflicts: boolean;
  setHideConflicts: (h: boolean) => void;
  walkabilityOnly: boolean;
  setWalkabilityOnly: (w: boolean) => void;
  onResetAll: () => void;
  /** Count of panels matching the current filters, shown on the "Show N Panels" button. */
  filteredCount: number;
}

export function ScheduleFilterSheet({
  isOpen,
  onClose,
  tracks,
  excludedTracks,
  onToggleExcludeTrack,
  onResetTracks,
  locations,
  selectedLocation,
  setSelectedLocation,
  hideEndedPanels,
  setHideEndedPanels,
  hideConflicts,
  setHideConflicts,
  walkabilityOnly,
  setWalkabilityOnly,
  onResetAll,
  filteredCount,
}: ScheduleFilterSheetProps): JSX.Element | null {
  if (!isOpen) return null;

  return (
    <div className="cd-sheet" onClick={() => onClose()}>
      <div className="cd-sheet-panel cd-scroll" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, font: "var(--type-heading)", color: "var(--gold-500)" }}>Filter panels</h3>
          <button
            onClick={() => onClose()}
            className="cd-btn cd-btn-ghost"
            style={{ padding: "4px 8px" }}
          >
            ✕
          </button>
        </div>

        {/* Fan Tracks multi-selector */}
        <div className="cd-label" style={{ marginBottom: 8 }}>
          FAN TRACKS
          {excludedTracks.length > 0 && (
            <span style={{ color: "var(--coral-500)", marginLeft: 6 }}>
              {excludedTracks.length} HIDDEN
            </span>
          )}
        </div>
        <div className="cd-data" style={{ color: "var(--text-tertiary)", fontSize: 11, marginBottom: 8 }}>
          Tap a track to hide it. Everything not hidden stays visible.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
          <Tag
            accent="var(--gold-500)"
            selected={excludedTracks.length === 0}
            onClick={() => onResetTracks()}
          >
            ALL TRACKS
          </Tag>
          {(tracks ?? []).map((t) => {
            const isExcluded = excludedTracks.includes(t);
            return (
              <Tag
                key={t}
                accent={isExcluded ? "var(--coral-500)" : TRACK_COLORS[t.toUpperCase()] || "var(--purple-400)"}
                selected={isExcluded}
                onClick={() => onToggleExcludeTrack(t)}
              >
                <span
                  style={{
                    textDecoration: isExcluded ? "line-through" : "none",
                    opacity: isExcluded ? 0.65 : 1,
                  }}
                >
                  {t}
                </span>
              </Tag>
            );
          })}
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
            onClick={() => onResetAll()}
            className="cd-btn cd-btn-ghost"
            style={{ flex: 1 }}
          >
            Reset
          </button>
          <button
            onClick={() => onClose()}
            className="cd-btn cd-btn-primary"
            style={{ flex: 2, background: "var(--grad-brand)" }}
          >
            Show {filteredCount} Panels
          </button>
        </div>
      </div>
    </div>
  );
}
