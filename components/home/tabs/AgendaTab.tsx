import type { JSX } from "react";
import { AppBar, DayStrip, Icon, PanelCard, type DayItem } from "../../CyberDragonUi.tsx";
import { calculateWalkTime, parseTimeDisplay } from "../../../lib/walktime.ts";
import { parseVenueRoom } from "../../../lib/scheduleUtils.ts";
import { TRACK_COLORS, type Conflict, type EventItem, type NavTab, type User, type UserEventItem } from "../homeTypes.ts";

interface AgendaTabProps {
  currentUser: User | null;
  supportsPasskeys: boolean;
  onOpenAuthModal: () => void;
  onPasskeyLogin: () => void;
  agendaItems: UserEventItem[];
  agendaConflicts: Conflict[];
  selectedDay: string;
  setSelectedDay: (d: string) => void;
  formattedDays: DayItem[];
  activeDaySavedEvents: EventItem[];
  totalWalkTimeMinutes: number;
  checkEventConflict: (id: string) => boolean;
  onToggleEvent: (id: string, status: "going" | "interested", bypassToast?: boolean) => void;
  onSelectEvent: (ev: EventItem) => void;
  desktopNavTabs: NavTab[];
}

export function AgendaTab({
  currentUser,
  supportsPasskeys,
  onOpenAuthModal,
  onPasskeyLogin,
  agendaItems,
  agendaConflicts,
  selectedDay,
  setSelectedDay,
  formattedDays,
  activeDaySavedEvents,
  totalWalkTimeMinutes,
  checkEventConflict,
  onToggleEvent,
  onSelectEvent,
  desktopNavTabs,
}: AgendaTabProps): JSX.Element {
  return (
    <div>
      <AppBar
        eyebrow={`${agendaItems.length} SESSIONS SAVED · 5 DAYS`}
        title="My Schedule"
        navTabs={desktopNavTabs}
        right={[
          {
            icon: "download",
            label: "Export ICS",
            onClick: () => {
              if (currentUser) {
                window.location.href = `/api/export-ics?userId=${currentUser.id}`;
              }
            },
          },
        ]}
      />

      <DayStrip days={formattedDays} value={selectedDay} onChange={setSelectedDay} />

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "4px var(--gutter) 0" }}>
        {!currentUser ? (
          <div className="cd-glass-panel" style={{ padding: 30, textAlign: "center" }}>
            <h2 style={{ font: "var(--type-heading)", color: "var(--gold-500)", marginBottom: 8 }}>
              SIGN IN TO BUILD YOUR SCHEDULE
            </h2>
            <p style={{ font: "var(--type-body)", color: "var(--text-secondary)", marginBottom: 20 }}>
              Save panels, calculate walk times, track con stamina load, and sync with your squad.
            </p>

            {supportsPasskeys && (
              <button
                onClick={onPasskeyLogin}
                className="cd-btn cd-btn-primary"
                style={{
                  padding: "12px 24px",
                  fontSize: 14,
                  marginBottom: 12,
                  background: "var(--grad-brand)",
                }}
              >
                ⚡ 1-CLICK PASSKEY LOGIN
              </button>
            )}

            <div>
              <button onClick={onOpenAuthModal} className="cd-btn cd-btn-signal">
                LOG IN WITH PASSWORD
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Daily Stamina Load Dashboard */}
            <div
              className="cd-glass-panel"
              style={{
                marginBottom: "var(--module-gap)",
                border: "1px solid var(--line-purple)",
                background: "rgba(91,33,182,.15)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <span className="cd-label">{selectedDay.toUpperCase() || "DAILY"} LOAD</span>
                <span className="cd-data" style={{ color: "var(--gold-400)", fontSize: 12 }}>
                  {activeDaySavedEvents.length} / 8 SLOTS
                </span>
              </div>

              {/* Progress Meter with 8 Ticks */}
              <div className="cd-progress-track">
                {Array.from({ length: 8 }).map((_, idx) => {
                  const isFilled = idx < activeDaySavedEvents.length;
                  const isOver = activeDaySavedEvents.length > 8 && idx === 7;
                  return (
                    <div
                      key={idx}
                      className={`cd-progress-tick ${isFilled ? "active" : ""} ${isOver ? "warn" : ""}`}
                    />
                  );
                })}
              </div>

              {/* Stats 3-Column Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 14,
                  marginTop: 14,
                  textAlign: "center",
                }}
              >
                <div>
                  <div
                    style={{
                      font: "var(--fw-bold) 22px/1 var(--font-core)",
                      fontVariantNumeric: "tabular-nums",
                      color: "var(--purple-200)",
                    }}
                  >
                    {activeDaySavedEvents.length}
                  </div>
                  <div className="cd-label" style={{ marginTop: 4 }}>
                    SAVED
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      font: "var(--fw-bold) 22px/1 var(--font-core)",
                      fontVariantNumeric: "tabular-nums",
                      color: agendaConflicts.length > 0 ? "var(--coral-500)" : "var(--text-primary)",
                    }}
                  >
                    {agendaConflicts.length}
                  </div>
                  <div className="cd-label" style={{ marginTop: 4 }}>
                    CONFLICTS
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      font: "var(--fw-bold) 22px/1 var(--font-core)",
                      fontVariantNumeric: "tabular-nums",
                      color: "var(--gold-500)",
                    }}
                  >
                    {totalWalkTimeMinutes} <span style={{ fontSize: 13 }}>MIN</span>
                  </div>
                  <div className="cd-label" style={{ marginTop: 4 }}>
                    WALK TOTAL
                  </div>
                </div>
              </div>
            </div>

            {/* Conflict Alert Banner */}
            {agendaConflicts.length > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  marginBottom: "var(--module-gap)",
                  background: "rgba(229,72,77,.10)",
                  border: "1px solid rgba(229,72,77,.35)",
                  borderRadius: "var(--r-panel)",
                }}
              >
                <Icon name="triangle-alert" size={16} color="var(--coral-500)" />
                <span style={{ flex: 1, font: "var(--type-body-sm)", color: "var(--coral-500)" }}>
                  {agendaConflicts.length} schedule conflict{agendaConflicts.length > 1 ? "s" : ""} detected.
                </span>
              </div>
            )}

            {/* Saved Events List */}
            {activeDaySavedEvents.length === 0 ? (
              <div
                className="cd-glass-panel"
                style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}
              >
                Nothing saved for this day yet. Browse the <strong>Schedule</strong> tab to bookmark panels!
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {activeDaySavedEvents.map((ev, index) => {
                  const timeInfo = parseTimeDisplay(ev.timeString);
                  const venueInfo = parseVenueRoom(ev.location);
                  const isConflict = checkEventConflict(ev.id);
                  const trackColor = TRACK_COLORS[ev.track?.toUpperCase() || ""] || "var(--purple-400)";

                  const prevEvent = index > 0 ? activeDaySavedEvents[index - 1] : null;
                  const walk = prevEvent
                    ? calculateWalkTime(prevEvent.location, ev.location)
                    : null;

                  return (
                    <div key={ev.id}>
                      {walk && walk.minutes > 0 && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "4px 12px",
                            margin: "4px 0",
                            color: "var(--gold-400)",
                            font: "var(--type-micro)",
                          }}
                        >
                          <Icon name="footprints" size={12} />
                          <span>
                            {walk.minutes} MIN WALK • {walk.path}
                          </span>
                        </div>
                      )}
                      <PanelCard
                        time={timeInfo.start}
                        endTime={timeInfo.end}
                        title={ev.title}
                        venue={venueInfo.venue}
                        room={venueInfo.room}
                        track={ev.track || undefined}
                        trackColor={trackColor}
                        status={ev.status}
                        saved={true}
                        conflict={isConflict}
                        onSave={() => onToggleEvent(ev.id, "going")}
                        onClick={() => onSelectEvent(ev)}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
