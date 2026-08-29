import type { FormEvent, JSX } from "react";
import { AppBar } from "../../CyberDragonUi.tsx";
import { AppStoragePanel, type InstallPromptEvent } from "../../AppStoragePanel.tsx";
import { FeedbackPanel } from "../../FeedbackPanel.tsx";
import { APP_VERSION } from "../../../lib/version.ts";
import type { EventItem, NavTab, User } from "../homeTypes.ts";

interface ProfileTabProps {
  currentUser: User | null;
  pendingInvite: string | null;
  supportsPasskeys: boolean;
  authMode: "login" | "register";
  setAuthMode: (mode: "login" | "register") => void;
  authUsername: string;
  setAuthUsername: (u: string) => void;
  authPassword: string;
  setAuthPassword: (p: string) => void;
  authName: string;
  setAuthName: (n: string) => void;
  authError: string;
  onAuthSubmit: (e: FormEvent) => void;
  onPasskeyLogin: () => void;
  onQuickPasskeyRegister: () => void;
  onRegisterPasskey: () => void;
  onLogout: () => void;
  shareScheduleState: boolean;
  onTogglePrivacy: () => void;
  remindersEnabled: boolean;
  setRemindersEnabled: (r: boolean) => void;
  walkWarningsEnabled: boolean;
  setWalkWarningsEnabled: (w: boolean) => void;
  hapticsEnabled: boolean;
  setHapticsEnabled: (h: boolean) => void;
  timeFormat: "12h" | "24h";
  setTimeFormat: (t: "12h" | "24h") => void;
  homeVenue: string;
  setHomeVenue: (v: string) => void;
  isOnline: boolean;
  isInstalled: boolean;
  installPrompt: InstallPromptEvent | null;
  onInstallPromptUsed: () => void;
  totalEvents?: number;
  eventsList: EventItem[];
  minutesSinceSync: number;
  onCheckForUpdates: () => void;
  isSyncing: boolean;
  onNotify: (message: string, type?: "ok" | "warn") => void;
  desktopNavTabs: NavTab[];
}

export function ProfileTab({
  currentUser,
  pendingInvite,
  supportsPasskeys,
  authMode,
  setAuthMode,
  authUsername,
  setAuthUsername,
  authPassword,
  setAuthPassword,
  authName,
  setAuthName,
  authError,
  onAuthSubmit,
  onPasskeyLogin,
  onQuickPasskeyRegister,
  onRegisterPasskey,
  onLogout,
  shareScheduleState,
  onTogglePrivacy,
  remindersEnabled,
  setRemindersEnabled,
  walkWarningsEnabled,
  setWalkWarningsEnabled,
  hapticsEnabled,
  setHapticsEnabled,
  timeFormat,
  setTimeFormat,
  homeVenue,
  setHomeVenue,
  isOnline,
  isInstalled,
  installPrompt,
  onInstallPromptUsed,
  totalEvents,
  eventsList,
  minutesSinceSync,
  onCheckForUpdates,
  isSyncing,
  onNotify,
  desktopNavTabs,
}: ProfileTabProps): JSX.Element {
  return (
    <div>
      <AppBar
        title="Profile"
        navTabs={desktopNavTabs}
        right={
          currentUser
            ? [
                {
                  icon: "log-out",
                  label: "Sign out",
                  onClick: onLogout,
                },
              ]
            : []
        }
      />

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "16px var(--gutter)" }}>
        {!currentUser ? (
          <>
            {pendingInvite && (
              <div
                className="cd-glass-panel cd-notch"
                style={{ padding: 16, maxWidth: 440, margin: "0 auto 16px" }}
              >
                <p style={{ font: "var(--type-body-sm)", color: "var(--text-primary)", textAlign: "center", margin: 0 }}>
                  ✨ <strong style={{ color: "var(--gold-500)" }}>@{pendingInvite}</strong> invited you to
                  join their squad! Sign in or register below to connect.
                </p>
              </div>
            )}
            {/* Logged-Out Authentication Card */}
            <div className="cd-glass-panel cd-notch" style={{ padding: 24, maxWidth: 440, margin: "0 auto" }}>
            <div className="cd-label" style={{ color: "var(--gold-500)", marginBottom: 8, textAlign: "center" }}>
              CYBERDRAGON AUTHENTICATION
            </div>
            <h2 style={{ font: "var(--type-heading)", textAlign: "center", margin: "0 0 8px 0" }}>
              {authMode === "login" ? "Welcome to CyberDragon" : "Create Squad Account"}
            </h2>
            <p
              style={{
                font: "var(--type-body-sm)",
                color: "var(--text-secondary)",
                textAlign: "center",
                marginBottom: 20,
              }}
            >
              Sign in for offline schedule syncing, walk-time alarms, and squad features.
            </p>

            {supportsPasskeys && (
              <button
                onClick={authMode === "login" ? onPasskeyLogin : onQuickPasskeyRegister}
                className="cd-btn cd-btn-primary"
                style={{
                  width: "100%",
                  padding: 12,
                  fontSize: 14,
                  marginBottom: 16,
                  background: "var(--grad-brand)",
                }}
              >
                {authMode === "login" ? "⚡ 1-CLICK PASSKEY LOGIN" : "✨ 1-CLICK REGISTER WITH PASSKEY"}
              </button>
            )}

            {authError && (
              <div style={{ color: "var(--coral-500)", font: "var(--type-body-sm)", marginBottom: 12 }}>
                {authError}
              </div>
            )}

            <form onSubmit={onAuthSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {authMode === "register" && (
                <div>
                  <div className="cd-label" style={{ marginBottom: 4 }}>
                    YOUR NAME
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. Alex"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    style={{
                      width: "100%",
                      padding: 10,
                      borderRadius: "var(--r-control)",
                      border: "1px solid var(--line-subtle)",
                      backgroundColor: "var(--surface-inset)",
                      color: "#fff",
                      font: "var(--type-body-sm)",
                      boxSizing: "border-box",
                    }}
                    required
                  />
                </div>
              )}

              <div>
                <div className="cd-label" style={{ marginBottom: 4 }}>
                  USERNAME
                </div>
                <input
                  type="text"
                  placeholder="dragon_fan_26"
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: "var(--r-control)",
                    border: "1px solid var(--line-subtle)",
                    backgroundColor: "var(--surface-inset)",
                    color: "#fff",
                    font: "var(--type-body-sm)",
                    boxSizing: "border-box",
                  }}
                  required
                />
              </div>

              <div>
                <div className="cd-label" style={{ marginBottom: 4 }}>
                  PASSWORD
                </div>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: "var(--r-control)",
                    border: "1px solid var(--line-subtle)",
                    backgroundColor: "var(--surface-inset)",
                    color: "#fff",
                    font: "var(--type-body-sm)",
                    boxSizing: "border-box",
                  }}
                  required
                />
              </div>

              <button type="submit" className="cd-btn cd-btn-signal" style={{ padding: 12, marginTop: 4 }}>
                {authMode === "login" ? "LOG IN WITH PASSWORD" : "REGISTER WITH PASSWORD"}
              </button>
            </form>

            <div
              style={{
                marginTop: 16,
                textAlign: "center",
                font: "var(--type-body-sm)",
                color: "var(--text-tertiary)",
              }}
            >
              {authMode === "login" ? (
                <span>
                  Need an account?{" "}
                  <button
                    onClick={() => setAuthMode("register")}
                    style={{
                      color: "var(--gold-500)",
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Register
                  </button>
                </span>
              ) : (
                <span>
                  Already have an account?{" "}
                  <button
                    onClick={() => setAuthMode("login")}
                    style={{
                      color: "var(--gold-500)",
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Log In
                  </button>
                </span>
              )}
            </div>
          </div>
          </>
        ) : (
          /* Logged-In Profile Dashboard */
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Digital Con Badge Card */}
            <div
              className="cd-glass-panel"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                background: "var(--surface-glass-strong)",
                border: "1px solid var(--line-purple)",
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 52,
                  height: 52,
                  font: "var(--fw-bold) 18px/1 var(--font-core)",
                  color: "#fff",
                  background: "var(--grad-brand)",
                  borderRadius: "var(--r-2)",
                  boxShadow: "var(--inner-lip)",
                }}
              >
                {currentUser.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "var(--type-subhead)", color: "#fff", fontSize: 16 }}>{currentUser.name}</div>
                <div className="cd-data" style={{ color: "var(--text-tertiary)", fontSize: 12 }}>
                  @{currentUser.username}
                </div>
                <div className="cd-data" style={{ color: "var(--gold-400)", fontSize: 11, marginTop: 2 }}>
                  BADGE DC-40-{currentUser.id.toUpperCase().slice(0, 8)}
                </div>
              </div>

              {currentUser.role === "admin" && (
                <a
                  href="/admin"
                  className="cd-btn cd-btn-signal"
                  style={{ textDecoration: "none", fontSize: 11, padding: "4px 8px", marginRight: 6 }}
                >
                  [Admin]
                </a>
              )}
              <span
                className="cd-badge"
                style={{ background: "var(--accent-quiet)", color: "var(--purple-300)", border: "1px solid var(--line-purple)" }}
              >
                ATTENDING
              </span>
            </div>

            {/* Squad Privacy */}
            <div className="cd-glass-panel" style={{ padding: "12px 16px" }}>
              <div className="cd-label" style={{ marginBottom: 8, color: "var(--gold-500)" }}>
                SQUAD PRIVACY
              </div>
              <div
                className="cd-switch-row"
                onClick={onTogglePrivacy}
                style={{ cursor: "pointer", userSelect: "none" }}
                role="switch"
                aria-checked={shareScheduleState}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onTogglePrivacy();
                  }
                }}
              >
                <div>
                  <div style={{ font: "var(--type-body-sm)", color: "#fff" }}>Share full schedule with Squad</div>
                  <div className="cd-data" style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
                    {shareScheduleState
                      ? "Squad members can see everything on your schedule."
                      : "Squad members only see panels you both have saved."}
                  </div>
                </div>
                <div className={`cd-switch ${shareScheduleState ? "checked" : ""}`}>
                  <div className="cd-switch-thumb" />
                </div>
              </div>
            </div>

            {/* Passkey Management */}
            {supportsPasskeys && (
              <div
                className="cd-glass-panel"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}
              >
                <div>
                  <div style={{ font: "var(--type-subhead)" }}>Passkey Biometrics</div>
                  <div className="cd-data" style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
                    Touch ID / Face ID 1-click login
                  </div>
                </div>
                <button
                  onClick={onRegisterPasskey}
                  className="cd-btn cd-btn-ghost"
                  style={{ borderColor: "var(--line-purple)", color: "var(--purple-200)", padding: "6px 12px" }}
                >
                  🔑 + Register Passkey
                </button>
              </div>
            )}

            {/* App & Offline Storage */}
            <AppStoragePanel
              isOnline={isOnline}
              lastSyncedMinutesAgo={minutesSinceSync}
              savedPanelCount={totalEvents || eventsList.length}
              isSyncing={isSyncing}
              installPrompt={installPrompt}
              isInstalled={isInstalled}
              onInstallPromptUsed={onInstallPromptUsed}
              onSyncNow={onCheckForUpdates}
              onNotify={onNotify}
            />

            {/* Feedback Submission */}
            <FeedbackPanel
              user={{ id: currentUser.id, username: currentUser.username }}
              onNotify={onNotify}
            />

            {/* Con Alerts & Notifications */}
            <div className="cd-glass-panel" style={{ padding: "12px 16px" }}>
              <div className="cd-label" style={{ marginBottom: 8, color: "var(--gold-500)" }}>
                CON ALERTS & NOTIFICATIONS
              </div>

              <div className="cd-switch-row" style={{ borderBottom: "1px solid var(--line-hairline)" }}>
                <div>
                  <div style={{ font: "var(--type-body-sm)", color: "#fff" }}>Panel reminders</div>
                  <div className="cd-data" style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
                    15 minutes before panel start
                  </div>
                </div>
                <div
                  className={`cd-switch ${remindersEnabled ? "checked" : ""}`}
                  onClick={() => setRemindersEnabled(!remindersEnabled)}
                >
                  <div className="cd-switch-thumb" />
                </div>
              </div>

              <div className="cd-switch-row" style={{ borderBottom: "1px solid var(--line-hairline)" }}>
                <div>
                  <div style={{ font: "var(--type-body-sm)", color: "#fff" }}>Walk-time warnings</div>
                  <div className="cd-data" style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
                    Flag tight hotel venue changes (&lt; 10 min)
                  </div>
                </div>
                <div
                  className={`cd-switch ${walkWarningsEnabled ? "checked" : ""}`}
                  onClick={() => setWalkWarningsEnabled(!walkWarningsEnabled)}
                >
                  <div className="cd-switch-thumb" />
                </div>
              </div>

              <div className="cd-switch-row">
                <div>
                  <div style={{ font: "var(--type-body-sm)", color: "#fff" }}>Haptic feedback</div>
                  <div className="cd-data" style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
                    Vibrate on schedule actions & alarms
                  </div>
                </div>
                <div
                  className={`cd-switch ${hapticsEnabled ? "checked" : ""}`}
                  onClick={() => setHapticsEnabled(!hapticsEnabled)}
                >
                  <div className="cd-switch-thumb" />
                </div>
              </div>
            </div>

            {/* Display & Venue Preferences */}
            <div className="cd-glass-panel" style={{ padding: "12px 16px" }}>
              <div className="cd-label" style={{ marginBottom: 12, color: "var(--gold-500)" }}>
                DISPLAY & VENUE PREFERENCES
              </div>

              <div style={{ marginBottom: 14 }}>
                <div className="cd-label" style={{ marginBottom: 6 }}>
                  TIME FORMAT
                </div>
                <select
                  value={timeFormat}
                  onChange={(e) => {
                    const val = e.target.value as "12h" | "24h";
                    setTimeFormat(val);
                    localStorage.setItem("dc_time_format", val);
                  }}
                  className="cd-select"
                  style={{ width: "100%" }}
                >
                  <option value="12h">12-hour (e.g. 2:30 PM)</option>
                  <option value="24h">24-hour (e.g. 14:30)</option>
                </select>
              </div>

              <div>
                <div className="cd-label" style={{ marginBottom: 6 }}>
                  HOME HOTEL / STARTING VENUE
                </div>
                <select
                  value={homeVenue}
                  onChange={(e) => {
                    setHomeVenue(e.target.value);
                    localStorage.setItem("dc_home_venue", e.target.value);
                  }}
                  className="cd-select"
                  style={{ width: "100%" }}
                >
                  <option value="Hyatt Regency">Hyatt Regency Atlanta</option>
                  <option value="Marriott Marquis">Marriott Marquis Atlanta</option>
                  <option value="Hilton Atlanta">Hilton Atlanta</option>
                  <option value="Courtland Grand">Courtland Grand / Sheraton</option>
                  <option value="Westin Peachtree">Westin Peachtree Plaza</option>
                  <option value="AmericasMart">AmericasMart</option>
                </select>
              </div>
            </div>

            {/* Sign Out Action */}
            <button
              onClick={onLogout}
              className="cd-btn cd-btn-ghost"
              style={{ color: "var(--coral-500)", borderColor: "var(--coral-500)", padding: 12 }}
            >
              SIGN OUT
            </button>

            <div className="cd-label" style={{ textAlign: "center", marginTop: 12 }}>
              {`CYBERDRAGON ${APP_VERSION} · DRAGON CON 2026 COMPANION`}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
