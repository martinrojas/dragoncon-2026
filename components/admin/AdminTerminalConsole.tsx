import type { JSX } from "react";

interface AdminTerminalConsoleProps {
  isSyncing: boolean;
  logFilter: "all" | "created" | "updated" | "errors";
  filteredLogs: string[];
  onLogFilterChange: (filter: "all" | "created" | "updated" | "errors") => void;
}

export function AdminTerminalConsole({
  isSyncing,
  logFilter,
  filteredLogs,
  onLogFilterChange,
}: AdminTerminalConsoleProps): JSX.Element {
  return (
    <div className="cd-glass-panel" style={{ padding: 16, marginBottom: 20, background: "#05030a", border: "1px solid var(--line-purple)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: isSyncing ? "#facc15" : "#4ade80" }} />
          <span style={{ font: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--gold-400)" }}>
            EXECUTION TERMINAL CONSOLE
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {(["all", "created", "updated", "errors"] as const).map((filterKey) => (
            <button
              key={filterKey}
              type="button"
              onClick={() => onLogFilterChange(filterKey)}
              style={{
                padding: "2px 8px",
                borderRadius: 4,
                fontSize: 11,
                font: "var(--font-mono)",
                cursor: "pointer",
                background: logFilter === filterKey ? "var(--purple-600)" : "transparent",
                color: logFilter === filterKey ? "#fff" : "var(--text-tertiary)",
                border: "1px solid var(--line-purple)",
                textTransform: "uppercase",
              }}
            >
              {filterKey}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          maxHeight: 280,
          overflowY: "auto",
          padding: 12,
          background: "rgba(0,0,0,0.6)",
          borderRadius: 4,
          fontFamily: "JetBrains Mono, monospace, var(--font-mono)",
          fontSize: 12,
          lineHeight: 1.45,
        }}
      >
        {filteredLogs.length === 0 ? (
          <div style={{ color: "var(--text-tertiary)", fontStyle: "italic" }}>
            No log output available. Execute a sync run above to inspect progress.
          </div>
        ) : (
          filteredLogs.map((line, idx) => {
            let color = "#cbd5e1";
            if (line.startsWith("+")) color = "#4ade80";
            else if (line.startsWith("~")) color = "#facc15";
            else if (line.startsWith("-")) color = "#f87171";
            else if (line.startsWith("!") || line.toLowerCase().includes("error")) color = "#ff6b6b";

            return (
              <div key={idx} style={{ color, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                <span style={{ color: "#475569", marginRight: 8, userSelect: "none" }}>
                  {String(idx + 1).padStart(3, " ")}
                </span>
                {line}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
