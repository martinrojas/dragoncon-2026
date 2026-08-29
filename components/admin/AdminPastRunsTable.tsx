import type { JSX } from "react";
import {
  formatRunTimestamp,
  parseRunStats,
  RUN_MODE_STYLES,
  RUN_STATUS_STYLES,
  type IngestionRun,
} from "./adminTypes";
import { AdminRunLogModal } from "./AdminRunLogModal";

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
                  const parsedStatsObj = parseRunStats(run.stats);
                  const modeStyle = RUN_MODE_STYLES[run.mode] ?? RUN_MODE_STYLES.sync;
                  const statusStyle = RUN_STATUS_STYLES[run.status] ?? RUN_STATUS_STYLES.running;

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
                            background: modeStyle.bg,
                            color: modeStyle.color,
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
                            background: statusStyle.bg,
                            color: statusStyle.color,
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
      <AdminRunLogModal
        run={selectedRunForLogModal}
        onClose={() => onSelectRunForLogModal(null)}
      />
    </>
  );
}
