import type { JSX } from "react";
import {
  FEEDBACK_ACTIONS,
  formatRunTimestamp,
  type FeedbackItem,
} from "./adminTypes";

interface AdminFeedbackListProps {
  feedbackItems: FeedbackItem[];
  visibleFeedback: FeedbackItem[];
  feedbackFilter: "new" | "all";
  feedbackBusyId: string | null;
  onFilterChange: (filter: "new" | "all") => void;
  onRefresh: () => void;
  onUpdateStatus: (id: string, status: string) => void;
}

export function AdminFeedbackList({
  feedbackItems,
  visibleFeedback,
  feedbackFilter,
  feedbackBusyId,
  onFilterChange,
  onRefresh,
  onUpdateStatus,
}: AdminFeedbackListProps): JSX.Element {
  return (
    <div className="cd-glass-panel" style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h4 style={{ font: "var(--type-subhead)", color: "var(--gold-400)", fontSize: 14 }}>
          💬 ATTENDEE FEEDBACK
        </h4>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {(["new", "all"] as const).map((filterMode) => {
            const active = feedbackFilter === filterMode;
            return (
              <button
                key={filterMode}
                type="button"
                onClick={() => onFilterChange(filterMode)}
                className="cd-btn"
                style={{
                  padding: "4px 8px",
                  fontSize: 11,
                  background: active ? "rgba(255, 193, 7, 0.15)" : "transparent",
                  color: active ? "var(--gold-400)" : "var(--text-secondary)",
                  border: `1px solid ${active ? "rgba(255, 193, 7, 0.3)" : "rgba(255, 255, 255, 0.12)"}`,
                }}
              >
                {filterMode === "new" ? "New Only" : "Show All"}
              </button>
            );
          })}
          <button
            type="button"
            onClick={onRefresh}
            className="cd-btn cd-btn-ghost"
            style={{ padding: "4px 8px", fontSize: 11 }}
          >
            Refresh Table
          </button>
        </div>
      </div>

      {feedbackItems.length === 0 || visibleFeedback.length === 0 ? (
        <div style={{ padding: 20, textAlign: "center", color: "var(--text-tertiary)", fontSize: 12 }}>
          {feedbackItems.length === 0 ? "No feedback submitted yet." : "No new feedback — switch to Show All."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visibleFeedback.map((item) => {
            const isBug = item.kind === "bug";
            return (
              <div
                key={item.id}
                style={{
                  padding: 12,
                  background: "rgba(255, 255, 255, 0.03)",
                  borderRadius: "var(--r-2)",
                  opacity: item.status === "new" ? 1 : 0.55,
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      className="cd-badge"
                      style={{
                        background: isBug ? "rgba(229, 72, 77, 0.15)" : "rgba(255, 193, 7, 0.15)",
                        color: isBug ? "var(--coral-500)" : "var(--gold-400)",
                        border: `1px solid ${isBug ? "rgba(229, 72, 77, 0.3)" : "rgba(255, 193, 7, 0.3)"}`,
                        fontSize: 10,
                        padding: "2px 6px",
                      }}
                    >
                      {isBug ? "BUG" : "IDEA"}
                    </span>
                    {item.contact === "Automated Error Report" && (
                      <span
                        className="cd-badge"
                        style={{
                          background: "rgba(168, 85, 247, 0.15)",
                          color: "var(--purple-300)",
                          border: "1px solid rgba(168, 85, 247, 0.3)",
                          fontSize: 10,
                          padding: "2px 6px",
                        }}
                      >
                        AUTO-REPORT
                      </span>
                    )}
                    {item.status !== "new" && (
                      <span
                        className="cd-badge"
                        style={{
                          background:
                            item.status === "archived" ? "rgba(255, 255, 255, 0.08)" : "rgba(168, 85, 247, 0.15)",
                          color:
                            item.status === "archived"
                              ? "var(--text-tertiary)"
                              : item.status === "done"
                                ? "#4ade80"
                                : "var(--purple-300)",
                          border: `1px solid ${
                            item.status === "archived" ? "rgba(255, 255, 255, 0.15)" : "rgba(168, 85, 247, 0.3)"
                          }`,
                          fontSize: 10,
                          padding: "2px 6px",
                        }}
                      >
                        {item.status === "in_progress" ? "IN PROGRESS" : item.status.toUpperCase()}
                      </span>
                    )}
                    <span style={{ fontSize: 12, color: "var(--purple-300)", fontWeight: 500 }}>
                      @{item.username ?? "anonymous"}
                    </span>
                    {item.appVersion && (
                      <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                        v{item.appVersion}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                    {formatRunTimestamp(item.createdAt)}
                  </span>
                </div>

                <div style={{ fontSize: 13, color: "#fff", whiteSpace: "pre-line", marginBottom: item.contact ? 6 : 0, lineHeight: 1.4 }}>
                  {item.message}
                </div>

                {item.contact && (
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    <span style={{ color: "var(--text-tertiary)" }}>Contact: </span>
                    {item.contact}
                  </div>
                )}
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 8 }}>
                  {(FEEDBACK_ACTIONS[item.status] ?? []).map((action) => (
                    <button
                      key={action.next}
                      type="button"
                      disabled={feedbackBusyId === item.id}
                      onClick={() => onUpdateStatus(item.id, action.next)}
                      className="cd-btn cd-btn-ghost"
                      style={{ padding: "3px 8px", fontSize: 10 }}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
