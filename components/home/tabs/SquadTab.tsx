import type { FormEvent, JSX } from "react";
import { AppBar, Badge, SegmentedControl } from "../../CyberDragonUi.tsx";
import type { EventItem, NavTab, User } from "../homeTypes.ts";

interface SquadTabProps {
  currentUser: User | null;
  pendingInvite: string | null;
  onOpenAuthModal: (mode?: "login" | "register") => void;
  friendsList: User[];
  selectedFriend: User | null;
  friendSharedEvents: EventItem[];
  friendEventsList: EventItem[];
  friendScheduleHidden: boolean;
  friendViewMode: "all" | "overlap";
  setFriendViewMode: (m: "all" | "overlap") => void;
  friendUsernameInput: string;
  setFriendUsernameInput: (u: string) => void;
  friendMsg: string;
  onAddFriend: (e: FormEvent) => void;
  onCompareFriend: (f: User) => void;
  userEventStatusMap: Record<string, "going" | "interested">;
  checkFriendEventConflict: (ev: EventItem) => boolean;
  onToggleEvent: (id: string, status: "going" | "interested", bypassToast?: boolean) => void;
  onSelectEvent: (ev: EventItem) => void;
  onShareSquadLink: () => void;
  desktopNavTabs: NavTab[];
}

export function SquadTab({
  currentUser,
  pendingInvite,
  onOpenAuthModal,
  friendsList,
  selectedFriend,
  friendSharedEvents,
  friendEventsList,
  friendScheduleHidden,
  friendViewMode,
  setFriendViewMode,
  friendUsernameInput,
  setFriendUsernameInput,
  friendMsg,
  onAddFriend,
  onCompareFriend,
  userEventStatusMap,
  checkFriendEventConflict,
  onToggleEvent,
  onSelectEvent,
  onShareSquadLink,
  desktopNavTabs,
}: SquadTabProps): JSX.Element {
  return (
    <div>
      <AppBar eyebrow="DRAGON CON '26 SQUAD" title="Squad" navTabs={desktopNavTabs} />

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "16px var(--gutter)" }}>
        {!currentUser ? (
          <div className="cd-glass-panel" style={{ padding: 30, textAlign: "center" }}>
            <h2 style={{ font: "var(--type-heading)", color: "var(--gold-500)", marginBottom: 8 }}>
              {pendingInvite ? `@${pendingInvite.toUpperCase()} INVITED YOU TO SQUAD` : "CONNECT WITH YOUR SQUAD"}
            </h2>
            <p style={{ font: "var(--type-body)", color: "var(--text-secondary)", marginBottom: 16 }}>
              {pendingInvite
                ? `Connect with @${pendingInvite} on CyberDragon to compare panel schedules and coordinate con plans.`
                : "Add your con buddies by username to compare schedules and find shared panels."}
            </p>
            <button
              onClick={() => onOpenAuthModal(pendingInvite ? "register" : undefined)}
              className="cd-btn cd-btn-signal"
            >
              {pendingInvite ? `✨ JOIN @${pendingInvite.toUpperCase()}'S SQUAD` : "LOG IN"}
            </button>
          </div>
        ) : (
          <div>
            {/* Add Friend Form */}
            <form
              onSubmit={onAddFriend}
              className="cd-glass-panel"
              style={{ marginBottom: 16, display: "flex", gap: 8 }}
            >
              <input
                type="text"
                placeholder="Enter squad member's username..."
                value={friendUsernameInput}
                onChange={(e) => setFriendUsernameInput(e.target.value)}
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: "var(--r-control)",
                  border: "1px solid var(--line-subtle)",
                  backgroundColor: "var(--surface-inset)",
                  color: "#fff",
                  font: "var(--type-body-sm)",
                }}
              />
              <button type="submit" className="cd-btn cd-btn-primary">
                + ADD MEMBER
              </button>
            </form>

            <button
              type="button"
              onClick={onShareSquadLink}
              className="cd-btn cd-btn-secondary"
              style={{ width: "100%", marginBottom: 16 }}
            >
              🔗 SHARE MY SQUAD INVITE LINK
            </button>

            {friendMsg && (
              <div style={{ marginBottom: 12, color: "var(--gold-500)", font: "var(--type-data)" }}>
                {friendMsg}
              </div>
            )}

            {/* Squad List */}
            <span className="cd-label" style={{ display: "block", marginBottom: 12 }}>
              MY DRAGON CON SQUAD ({friendsList.length})
            </span>

            {friendsList.length === 0 ? (
              <div
                className="cd-glass-panel"
                style={{ color: "var(--text-tertiary)", padding: 20, textAlign: "center" }}
              >
                No squad members added yet. Ask your con buddy for their username!
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                  gap: 10,
                  marginBottom: 20,
                }}
              >
                {friendsList.map((friend) => (
                  <div
                    key={friend.id}
                    onClick={() => onCompareFriend(friend)}
                    className="cd-glass-panel"
                    style={{
                      cursor: "pointer",
                      borderColor: selectedFriend?.id === friend.id ? "var(--purple-400)" : "var(--line-hairline)",
                      boxShadow: selectedFriend?.id === friend.id ? "var(--glow-purple)" : "var(--shadow-2)",
                    }}
                  >
                    <div style={{ font: "var(--type-subhead)", color: "var(--text-primary)" }}>{friend.name}</div>
                    <div className="cd-data" style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
                      @{friend.username}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Detailed Squad Schedule Browser */}
            {selectedFriend && (
              <div className="cd-glass-panel">
                <span className="cd-label" style={{ display: "block", marginBottom: 12, color: "var(--gold-500)" }}>
                  {selectedFriend.name.toUpperCase()}'S SCHEDULE
                </span>

                {friendScheduleHidden ? (
                  <div
                    style={{
                      padding: 10,
                      marginBottom: 14,
                      backgroundColor: "var(--surface-inset)",
                      border: "1px solid var(--line-hairline)",
                      borderRadius: "var(--r-control)",
                      font: "var(--type-body-sm)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    🔒 @{selectedFriend.username} has set their schedule to private. Showing only mutual saved panels.
                  </div>
                ) : (
                  <SegmentedControl
                    size="sm"
                    options={[
                      { value: "all", label: `ALL SAVED PANELS (${friendEventsList.length})` },
                      { value: "overlap", label: `MUTUAL OVERLAP (${friendSharedEvents.length})` },
                    ]}
                    value={friendViewMode}
                    onChange={(val) => setFriendViewMode(val as "all" | "overlap")}
                    style={{ marginBottom: 14 }}
                  />
                )}

                {friendScheduleHidden || friendViewMode === "overlap" ? (
                  friendSharedEvents.length === 0 ? (
                    <p style={{ color: "var(--text-tertiary)", font: "var(--type-body-sm)" }}>
                      No matching panels on your agendas yet.
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {friendSharedEvents.map((ev) => (
                        <div
                          key={ev.id}
                          onClick={() => onSelectEvent(ev)}
                          style={{
                            backgroundColor: "var(--surface-inset)",
                            padding: 12,
                            borderRadius: "var(--r-control)",
                            border: "1px solid var(--line-hairline)",
                            cursor: "pointer",
                          }}
                        >
                          <div style={{ font: "var(--type-subhead)", color: "#fff" }}>{ev.title}</div>
                          <div className="cd-data" style={{ color: "var(--text-secondary)", fontSize: 11 }}>
                            {ev.day} • {ev.timeString} • {ev.location}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : friendEventsList.length === 0 ? (
                  <p style={{ color: "var(--text-tertiary)", font: "var(--type-body-sm)" }}>
                    No saved panels yet.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {friendEventsList.map((ev) => {
                      const bothGoing = !!userEventStatusMap[ev.id];
                      const hasConflict = !bothGoing && checkFriendEventConflict(ev);
                      return (
                        <div
                          key={ev.id}
                          style={{
                            backgroundColor: "var(--surface-inset)",
                            padding: 12,
                            borderRadius: "var(--r-control)",
                            border: "1px solid var(--line-hairline)",
                          }}
                        >
                          <div onClick={() => onSelectEvent(ev)} style={{ cursor: "pointer" }}>
                            <div style={{ font: "var(--type-subhead)", color: "#fff" }}>{ev.title}</div>
                            <div className="cd-data" style={{ color: "var(--text-secondary)", fontSize: 11 }}>
                              {ev.day} • {ev.timeString} • {ev.location}
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                            {bothGoing ? (
                              <Badge tone="ok">✓ Both Going</Badge>
                            ) : (
                              <>
                                {hasConflict && <Badge tone="soon">⚠️ Conflict</Badge>}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleEvent(ev.id, "going", true);
                                  }}
                                  className="cd-btn cd-btn-secondary"
                                  style={{ padding: "4px 10px", fontSize: 12 }}
                                >
                                  + ADD TO MINE
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
