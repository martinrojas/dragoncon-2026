import type { JSX } from "react";
import type { AdminUsageStats } from "./adminTypes";

interface AdminUsageMetricsProps {
  usage: AdminUsageStats | undefined;
  totalUsers: number;
}

function BarRow({ label, value, max }: { label: string; value: number; max: number }): JSX.Element {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
      <span style={{ minWidth: 96, fontSize: 11, color: "var(--text-secondary)" }}>{label}</span>
      <div style={{ flex: 1, background: "rgba(168, 85, 247, 0.12)", borderRadius: 2 }}>
        <div
          style={{
            width: `${max > 0 ? (value / max) * 100 : 0}%`,
            background: "var(--purple-600)",
            height: 10,
            borderRadius: 2,
          }}
        />
      </div>
      <span style={{ font: "var(--font-mono)", fontSize: 11, color: "var(--gold-400)", minWidth: 28, textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}

export function AdminUsageMetrics({ usage, totalUsers }: AdminUsageMetricsProps): JSX.Element {
  const maxSize = Math.max(0, ...(usage?.scheduleSizeBuckets ?? []).map((b) => b.users));
  const maxDate = Math.max(0, ...(usage?.savesByDate ?? []).map((d) => d.count));
  const maxTrack = Math.max(0, ...(usage?.topTracks ?? []).map((t) => t.count));
  const maxLocation = Math.max(0, ...(usage?.topLocations ?? []).map((l) => l.count));

  return (
    <div className="cd-glass-panel" style={{ padding: 16, marginBottom: 20 }}>
      <h4 style={{ font: "var(--type-subhead)", color: "var(--gold-400)", fontSize: 14, margin: "0 0 12px" }}>
        📊 USAGE METRICS
      </h4>

      {!usage || usage.totalSaves === 0 ? (
        <div style={{ padding: 20, textAlign: "center", color: "var(--text-tertiary)", fontSize: 12 }}>
          No saved-schedule activity yet.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {[
              `TOTAL SAVES: ${usage.totalSaves}`,
              `ACTIVE USERS: ${usage.usersWithSaves}/${totalUsers}`,
              `GOING: ${usage.goingCount}`,
              `INTERESTED: ${usage.interestedCount}`,
              `MEDIAN SAVES: ${usage.medianSavesPerActiveUser}`,
            ].map((chip) => (
              <span
                key={chip}
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
                {chip}
              </span>
            ))}
          </div>

          <div className="cd-label" style={{ color: "var(--purple-300)", fontSize: 11, marginBottom: 6 }}>
            SCHEDULE SIZE
          </div>
          {usage.scheduleSizeBuckets.map((b) => (
            <BarRow key={b.label} label={b.label} value={b.users} max={maxSize} />
          ))}

          <div className="cd-label" style={{ color: "var(--purple-300)", fontSize: 11, margin: "12px 0 6px" }}>
            SAVES PER DAY (ET)
          </div>
          {usage.savesByDate.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>No dated saves</div>
          ) : (
            usage.savesByDate.map((d) => <BarRow key={d.date} label={d.date} value={d.count} max={maxDate} />)
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginTop: 12 }}>
            <div>
              <div className="cd-label" style={{ color: "var(--purple-300)", fontSize: 11, marginBottom: 6 }}>
                TOP TRACKS
              </div>
              {usage.topTracks.map((t) => (
                <BarRow key={t.name} label={t.name} value={t.count} max={maxTrack} />
              ))}
            </div>
            <div>
              <div className="cd-label" style={{ color: "var(--purple-300)", fontSize: 11, marginBottom: 6 }}>
                TOP LOCATIONS
              </div>
              {usage.topLocations.map((l) => (
                <BarRow key={l.name} label={l.name} value={l.count} max={maxLocation} />
              ))}
            </div>
          </div>

          <div className="cd-label" style={{ color: "var(--purple-300)", fontSize: 11, margin: "12px 0 6px" }}>
            SAVES BY CON DAY
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {usage.savesByConDay.map((d) => (
              <span
                key={d.name}
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
                {d.name}: {d.count}
              </span>
            ))}
          </div>

          <div className="cd-label" style={{ color: "var(--purple-300)", fontSize: 11, margin: "12px 0 6px" }}>
            PEAK SAVED-SCHEDULE HOURS (ET)
          </div>
          {usage.peakHours.map((p) => (
            <div
              key={`${p.day}-${p.hour}`}
              style={{ font: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)", padding: "2px 0" }}
            >
              {p.day} {String(p.hour).padStart(2, "0")}:00 — {p.count}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
