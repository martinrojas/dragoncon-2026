import type { JSX } from "react";
import type { IngestResult } from "./adminTypes";

interface AdminDiffSummaryProps {
  latestResult: IngestResult | null;
}

export function AdminDiffSummary({ latestResult }: AdminDiffSummaryProps): JSX.Element | null {
  if (!latestResult) return null;

  return (
    <div className="cd-glass-panel" style={{ padding: 16, marginBottom: 20, border: "1px solid var(--purple-400)" }}>
      <h4 style={{ font: "var(--type-subhead)", color: "var(--gold-400)", marginBottom: 12, fontSize: 14 }}>
        📊 LATEST RUN DIFF SUMMARY (Mode: {latestResult.mode})
      </h4>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <span style={{ padding: "4px 10px", borderRadius: 4, background: "rgba(74, 222, 128, 0.15)", color: "#4ade80", border: "1px solid #4ade80", font: "var(--font-mono)", fontSize: 12 }}>
          Created: {latestResult.created ?? 0}
        </span>
        <span style={{ padding: "4px 10px", borderRadius: 4, background: "rgba(250, 204, 21, 0.15)", color: "#facc15", border: "1px solid #facc15", font: "var(--font-mono)", fontSize: 12 }}>
          Updated: {latestResult.updated ?? 0}
        </span>
        <span style={{ padding: "4px 10px", borderRadius: 4, background: "rgba(248, 113, 113, 0.15)", color: "#f87171", border: "1px solid #f87171", font: "var(--font-mono)", fontSize: 12 }}>
          Deleted: {latestResult.deleted ?? 0}
        </span>
        <span style={{ padding: "4px 10px", borderRadius: 4, background: "rgba(217, 70, 239, 0.15)", color: "#d946ef", border: "1px solid #d946ef", font: "var(--font-mono)", fontSize: 12 }}>
          Errors: {latestResult.errors ?? 0}
        </span>
      </div>

      {latestResult.diffSummary && (
        <div style={{ fontSize: 12, font: "var(--font-mono)", color: "var(--text-secondary)" }}>
          {latestResult.diffSummary.createdEvents && latestResult.diffSummary.createdEvents.length > 0 && (
            <details style={{ marginBottom: 6 }}>
              <summary style={{ cursor: "pointer", color: "#4ade80" }}>
                Created Events List ({latestResult.diffSummary.createdEvents.length})
              </summary>
              <ul style={{ margin: "4px 0 0 16px", padding: 0, listStyle: "disc" }}>
                {latestResult.diffSummary.createdEvents.slice(0, 20).map((ev) => (
                  <li key={ev.id}>
                    <strong>{ev.title}</strong> {ev.location ? `@ ${ev.location}` : ""} {ev.time ? `(${ev.time})` : ""}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {latestResult.diffSummary.updatedEvents && latestResult.diffSummary.updatedEvents.length > 0 && (
            <details style={{ marginBottom: 6 }}>
              <summary style={{ cursor: "pointer", color: "#facc15" }}>
                Updated Events List ({latestResult.diffSummary.updatedEvents.length})
              </summary>
              <ul style={{ margin: "4px 0 0 16px", padding: 0, listStyle: "disc" }}>
                {latestResult.diffSummary.updatedEvents.slice(0, 20).map((ev) => (
                  <li key={ev.id}>
                    <strong>{ev.title || ev.id}</strong> {ev.changes ? `: ${ev.changes}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
