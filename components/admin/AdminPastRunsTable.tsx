import type { JSX } from "react";
import { formatRunTimestamp, type IngestionRun } from "./adminTypes";

interface AdminPastRunsTableProps {
  pastRuns: IngestionRun[];
  selectedRunForLogModal: IngestionRun | null;
  onRefresh: () => void;
  onSelectRunForLogModal: (run: IngestionRun | null) => void;
}

export function AdminPastRunsTable({
  pastRuns,
  selectedRunForLogModal,
  onRefresh,
  onSelectRunForLogModal,
}: AdminPastRunsTableProps): JSX.Element {
  return (
    <>
      <div className="cd-glass-panel" style={{ padding: 16, maxHeight: "50vh", overflowY: "scroll", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h4 style={{ font: "var(--type-subhead)", color: "var(--gold-400)", fontSize: 14 }}>
            📜 INGESTION RUN HISTORY
          </h4>
          <button
            type="button"
            onClick={onRefresh}
            className="cd-btn cd-btn-ghost"
            style={{ padding: "4px 8px", fontSize: 11 }}
          >
            Refresh Table
          </button>
        </div>

        {pastRuns.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text-tertiary)", fontSize: 12 }}>
            No ingestion runs recorded yet.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, font: "var(--font-mono)" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line-purple)", textAlign: "left", color: "var(--purple-300)" }}>
                  <th style={{ padding: 8 }}>ID</th>
                  <th style={{ padding: 8 }}>STARTED</th>
                  <th style={{ padding: 8 }}>MODE</th>
                  <th style={{ padding: 8 }}>STATUS</th>
                  <th style={{ padding: 8 }}>STATS</th>
                  <th style={{ padding: 8, textAlign: "right" }}>LOG</th>
                </tr>
              </thead>
              <tbody>
                {pastRuns.map((run) => {
                  let parsedStatsObj: Record<string, number> | null = null;
                  if (run.stats) {
                    try {
                      parsedStatsObj = typeof run.stats === "string" ? JSON.parse(run.stats) as Record<string, number> : run.stats as Record<string, number>;
                    } catch {
                      parsedStatsObj = null;
                    }
                  }

                  return (
                    <tr key={run.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={{ padding: 8, color: "var(--gold-400)" }}>#{run.id}</td>
                      <td style={{ padding: 8, color: "var(--text-tertiary)" }}>
                        {formatRunTimestamp(run.startedAt)}
                      </td>
                      <td style={{ padding: 8 }}>
                        <span
                          style={{
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontSize: 10,
                            background: run.mode === "hard-resync" ? "rgba(248,113,113,0.2)" : run.mode === "dry-run" ? "rgba(168,85,247,0.2)" : "rgba(34,211,238,0.2)",
                            color: run.mode === "hard-resync" ? "#f87171" : run.mode === "dry-run" ? "#c084fc" : "#22d3ee",
                          }}
                        >
                          {run.mode}
                        </span>
                      </td>
                      <td style={{ padding: 8 }}>
                        <span
                          style={{
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontSize: 10,
                            background: run.status === "completed" ? "rgba(74,222,128,0.2)" : run.status === "failed" ? "rgba(248,113,113,0.2)" : "rgba(250,204,21,0.2)",
                            color: run.status === "completed" ? "#4ade80" : run.status === "failed" ? "#f87171" : "#facc15",
                          }}
                        >
                          {run.status}
                        </span>
                      </td>
                      <td style={{ padding: 8, color: "var(--text-secondary)" }}>
                        {parsedStatsObj ? (
                          <span>
                            +{parsedStatsObj.created ?? 0} ~{parsedStatsObj.updated ?? 0} -{parsedStatsObj.deleted ?? 0}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td style={{ padding: 8, textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() => onSelectRunForLogModal(run)}
                          className="cd-btn cd-btn-ghost"
                          style={{ padding: "2px 8px", fontSize: 11 }}
                        >
                          View Log
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Log Modal */}
      {selectedRunForLogModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.8)",
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
              maxWidth: 720,
              width: "100%",
              padding: 20,
              background: "#0c0717",
              border: "1px solid var(--purple-400)",
              borderRadius: "var(--r-3)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h3 style={{ font: "var(--type-heading)", color: "var(--gold-400)", fontSize: 16 }}>
                📜 RUN #{selectedRunForLogModal.id} LOG OUTPUT
              </h3>
              <button
                type="button"
                onClick={() => onSelectRunForLogModal(null)}
                className="cd-btn cd-btn-ghost"
                style={{ padding: "4px 8px", fontSize: 12 }}
              >
                ✕ Close
              </button>
            </div>

            <div
              style={{
                maxHeight: 360,
                overflowY: "auto",
                padding: 12,
                background: "#05030a",
                borderRadius: 4,
                fontFamily: "JetBrains Mono, monospace, var(--font-mono)",
                fontSize: 12,
                lineHeight: 1.45,
                color: "#e2e8f0",
              }}
            >
              {selectedRunForLogModal.log ? (
                selectedRunForLogModal.log.split("\n").map((line, idx) => (
                  <div key={idx} style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {line}
                  </div>
                ))
              ) : (
                <div style={{ color: "var(--text-tertiary)", fontStyle: "italic" }}>
                  No log content recorded for this run.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
