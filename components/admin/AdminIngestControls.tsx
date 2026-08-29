import type { JSX } from "react";
import { DAY_OPTIONS } from "./adminTypes";

interface AdminIngestControlsProps {
  syncMode: "sync" | "dry-run" | "hard-resync";
  selectedDays: string[];
  throttleLimit: number | undefined;
  isSyncing: boolean;
  showHardResyncModal: boolean;
  syncErrorMessage: string | null;
  onSyncModeChange: (mode: "sync" | "dry-run" | "hard-resync") => void;
  onDayChipClick: (day: string) => void;
  onThrottleLimitChange: (limit: number | undefined) => void;
  onStartSyncClick: () => void;
  onExecuteSync: () => void;
  onCloseHardResyncModal: () => void;
}

export function AdminIngestControls({
  syncMode,
  selectedDays,
  throttleLimit,
  isSyncing,
  showHardResyncModal,
  syncErrorMessage,
  onSyncModeChange,
  onDayChipClick,
  onThrottleLimitChange,
  onStartSyncClick,
  onExecuteSync,
  onCloseHardResyncModal,
}: AdminIngestControlsProps): JSX.Element {
  return (
    <div className="cd-glass-panel" style={{ padding: 20, marginBottom: 20, border: "1px solid var(--line-purple)" }}>
      <h3 style={{ font: "var(--type-subhead)", color: "var(--gold-500)", marginBottom: 16, fontSize: 16 }}>
        ⚡ INGESTION CONTROLS
      </h3>

      {/* Sync Mode Selector */}
      <div style={{ marginBottom: 16 }}>
        <label className="cd-label" style={{ display: "block", marginBottom: 6, fontSize: 11 }}>
          SYNCHRONIZATION MODE
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            type="button"
            onClick={() => onSyncModeChange("sync")}
            style={{
              padding: "8px 14px",
              borderRadius: 4,
              font: "var(--font-mono)",
              fontSize: 12,
              cursor: "pointer",
              background: syncMode === "sync" ? "var(--purple-600)" : "rgba(255,255,255,0.05)",
              color: syncMode === "sync" ? "#fff" : "var(--text-secondary)",
              border: syncMode === "sync" ? "1px solid var(--purple-400)" : "1px solid var(--line-purple)",
            }}
          >
            Normal Sync (Diff & Write)
          </button>

          <button
            type="button"
            onClick={() => onSyncModeChange("dry-run")}
            style={{
              padding: "8px 14px",
              borderRadius: 4,
              font: "var(--font-mono)",
              fontSize: 12,
              cursor: "pointer",
              background: syncMode === "dry-run" ? "var(--cyan-600, #0891b2)" : "rgba(255,255,255,0.05)",
              color: syncMode === "dry-run" ? "#fff" : "var(--text-secondary)",
              border: syncMode === "dry-run" ? "1px solid var(--cyan-400, #22d3ee)" : "1px solid var(--line-purple)",
            }}
          >
            Dry Run (Safe Preview)
          </button>

          <button
            type="button"
            onClick={() => onSyncModeChange("hard-resync")}
            style={{
              padding: "8px 14px",
              borderRadius: 4,
              font: "var(--font-mono)",
              fontSize: 12,
              cursor: "pointer",
              background: syncMode === "hard-resync" ? "rgba(239, 68, 68, 0.3)" : "rgba(255,255,255,0.05)",
              color: syncMode === "hard-resync" ? "var(--coral-400)" : "var(--text-secondary)",
              border: syncMode === "hard-resync" ? "1px solid var(--coral-500)" : "1px solid var(--line-purple)",
            }}
          >
            ⚠️ Hard Resync (Reset & Overwrite)
          </button>
        </div>
      </div>

      {/* Day Chips Selector */}
      <div style={{ marginBottom: 16 }}>
        <label className="cd-label" style={{ display: "block", marginBottom: 6, fontSize: 11 }}>
          DAY FILTER CHIPS
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {DAY_OPTIONS.map((opt) => {
            const isSelected = selectedDays.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onDayChipClick(opt.value)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 14,
                  fontSize: 12,
                  font: "var(--font-mono)",
                  cursor: "pointer",
                  background: isSelected ? "var(--purple-600)" : "rgba(0,0,0,0.3)",
                  color: isSelected ? "#fff" : "var(--text-tertiary)",
                  border: isSelected ? "1px solid var(--gold-400)" : "1px solid var(--line-purple)",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Throttle Limiter Dropdown & Submit Button Row */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 16 }}>
        <div>
          <label className="cd-label" style={{ display: "block", marginBottom: 4, fontSize: 11 }}>
            THROTTLE LIMITER
          </label>
          <select
            value={throttleLimit === undefined ? "full" : String(throttleLimit)}
            onChange={(e) => {
              const val = e.target.value;
              onThrottleLimitChange(val === "full" ? undefined : Number(val));
            }}
            style={{
              padding: "8px 12px",
              background: "#0f081d",
              border: "1px solid var(--line-purple)",
              color: "#fff",
              borderRadius: 4,
              fontSize: 13,
              font: "var(--font-mono)",
              outline: "none",
            }}
          >
            <option value="full">Full Run (Capped for Safety)</option>
            <option value="10">Test Run: Max 10 Events</option>
            <option value="50">Test Run: Max 50 Events</option>
          </select>
        </div>

        <button
          type="button"
          disabled={isSyncing}
          onClick={onStartSyncClick}
          className="cd-btn cd-btn-signal"
          style={{
            padding: "9px 20px",
            font: "var(--font-mono)",
            fontSize: 13,
            background: syncMode === "hard-resync" ? "var(--coral-500)" : undefined,
          }}
        >
          {isSyncing ? "⚡ SYNC IN PROGRESS..." : syncMode === "hard-resync" ? "⚠️ EXECUTE HARD RESYNC" : "[ ⚡ EXECUTE SYNC ]"}
        </button>
      </div>

      {syncErrorMessage && (
        <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(248,113,113,0.15)", border: "1px solid var(--coral-500)", color: "var(--coral-400)", borderRadius: 4, fontSize: 12 }}>
          {syncErrorMessage}
        </div>
      )}

      {/* Confirmation Modal for Hard Resync */}
      {showHardResyncModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
            padding: 20,
          }}
        >
          <div
            className="cd-glass-panel"
            style={{
              maxWidth: 480,
              width: "100%",
              padding: 24,
              border: "2px solid var(--coral-500)",
              borderRadius: "var(--r-3)",
              background: "#140a1c",
            }}
          >
            <h3 style={{ font: "var(--type-heading)", color: "var(--coral-500)", fontSize: 18, marginBottom: 12 }}>
              ⚠️ CONFIRM HARD RESYNC
            </h3>
            <p style={{ font: "var(--type-body)", color: "var(--text-secondary)", fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
              Hard Resync will wipe local schedule events for the targeted days and re-fetch them from upstream core-apps source.
              Are you sure you want to proceed with full schedule reset?
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={onCloseHardResyncModal}
                className="cd-btn cd-btn-ghost"
                style={{ padding: "8px 14px", fontSize: 12 }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSyncing}
                onClick={onExecuteSync}
                className="cd-btn"
                style={{
                  padding: "8px 16px",
                  background: "var(--coral-500)",
                  color: "#fff",
                  font: "var(--font-mono)",
                  fontSize: 12,
                }}
              >
                {isSyncing ? "EXECUTING..." : "CONFIRM HARD RESYNC"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
