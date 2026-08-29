import type { JSX } from "react";
import { AppBar } from "../../CyberDragonUi.tsx";
import type { EventChange, NavTab } from "../homeTypes.ts";

interface ChangesTabProps {
  changesList: EventChange[];
  desktopNavTabs: NavTab[];
}

export function ChangesTab({ changesList, desktopNavTabs }: ChangesTabProps): JSX.Element {
  return (
    <div>
      <AppBar eyebrow="DRAGON CON '26" title="Schedule Changes" navTabs={desktopNavTabs} />

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "16px var(--gutter)" }}>
        <span className="cd-label" style={{ display: "block", marginBottom: 14 }}>
          LIVE DIFF FEED & PROGRAMMING CHANGES
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {changesList.length === 0 ? (
            <div className="cd-glass-panel" style={{ color: "var(--text-tertiary)", textAlign: "center", padding: 30 }}>
              No schedule changes recorded yet. Click <strong>Updates</strong> to fetch the latest updates!
            </div>
          ) : (
            changesList.map((change: EventChange) => (
              <div key={change.id} className="cd-glass-panel">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ font: "var(--type-subhead)", color: "var(--text-primary)" }}>
                    {change.eventTitle}
                  </span>
                  <span
                    className={`cd-badge ${
                      change.changeType === "created" ? "cd-badge-gold" : "cd-badge-purple"
                    }`}
                  >
                    {change.changeType.toUpperCase()}
                  </span>
                </div>
                <div className="cd-data" style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
                  DETECTED: {new Date(change.detectedAt).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
