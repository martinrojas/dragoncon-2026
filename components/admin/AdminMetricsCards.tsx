import type { JSX } from "react";
import type { AdminDbStats } from "./adminTypes";

interface AdminMetricsCardsProps {
  dbStats: AdminDbStats;
}

export function AdminMetricsCards({ dbStats }: AdminMetricsCardsProps): JSX.Element {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 20 }}>
      <div className="cd-glass-panel" style={{ padding: 16 }}>
        <div className="cd-label" style={{ color: "var(--purple-300)", fontSize: 11, marginBottom: 4 }}>
          TOTAL ACTIVE EVENTS
        </div>
        <div style={{ font: "var(--font-mono)", fontSize: 24, fontWeight: 700, color: "#fff" }}>
          {dbStats.totalActiveEvents}
        </div>
        {dbStats.totalDeletedEvents > 0 && (
          <div style={{ fontSize: 11, color: "var(--coral-400)", marginTop: 2 }}>
            ({dbStats.totalDeletedEvents} deleted)
          </div>
        )}
      </div>

      <div className="cd-glass-panel" style={{ padding: 16 }}>
        <div className="cd-label" style={{ color: "var(--purple-300)", fontSize: 11, marginBottom: 4 }}>
          TOTAL USERS
        </div>
        <div style={{ font: "var(--font-mono)", fontSize: 24, fontWeight: 700, color: "#fff" }}>
          {dbStats.totalUsers}
        </div>
      </div>

      <div className="cd-glass-panel" style={{ padding: 16, gridColumn: "span 2" }}>
        <div className="cd-label" style={{ color: "var(--purple-300)", fontSize: 11, marginBottom: 6 }}>
          EVENTS BY DAY BREAKDOWN
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {Object.keys(dbStats.eventsByDay).length === 0 ? (
            <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>No day breakdown available</span>
          ) : (
            Object.entries(dbStats.eventsByDay).map(([day, count]) => (
              <span
                key={day}
                style={{
                  background: "rgba(168, 85, 247, 0.15)",
                  border: "1px solid var(--line-purple)",
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontSize: 12,
                  font: "var(--font-mono)",
                  color: "var(--gold-400)",
                }}
              >
                {day}: {count}
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
