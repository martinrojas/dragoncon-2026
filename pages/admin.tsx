import { useEffect, useState, useMemo, type FormEvent } from "react";
import { AppBar } from "../components/CyberDragonUi";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { setupGlobalErrorCatchers } from "../lib/errorReporting";
import { APP_VERSION } from "../lib/version";
import type { Props } from "./admin.server";
export interface User {
  id: string;
  username: string;
  name: string;
  role?: string;
}

export interface IngestionRun {
  id: number;
  userId: string;
  mode: string;
  status: string;
  days: string | null;
  stats: string | null;
  log: string | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

// `started_at`/`completed_at` come from SQLite `datetime('now')` -- UTC wall
// time with no zone suffix. Normalize to UTC, then render in con time (ET).
export function formatRunTimestamp(raw: string | null): string {
  if (!raw) return "-";
  const normalized = /Z$|[+-]\d{2}:?\d{2}$/.test(raw) ? raw : `${raw}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export interface IngestDiffSummary {
  createdEvents?: Array<{ id: string; title: string; location?: string; time?: string }>;
  updatedEvents?: Array<{ id: string; title?: string; changes?: string }>;
  deletedEvents?: Array<{ id: string; title?: string }>;
}

export interface FeedbackItem {
  id: string;
  userId: string | null;
  username: string | null;
  kind: string;
  message: string;
  contact: string | null;
  appVersion: string | null;
  userAgent: string | null;
  pageUrl: string | null;
  status: string;
  createdAt: string;
}

export const FEEDBACK_ACTIONS: Record<string, Array<{ label: string; next: string }>> = {
  new: [
    { label: "Start", next: "in_progress" },
    { label: "Complete", next: "done" },
    { label: "Archive", next: "archived" },
  ],
  in_progress: [
    { label: "Complete", next: "done" },
    { label: "Archive", next: "archived" },
  ],
  done: [
    { label: "Reopen", next: "new" },
    { label: "Archive", next: "archived" },
  ],
  archived: [{ label: "Reopen", next: "new" }],
};

export interface IngestResult {
  runId?: number;
  mode: string;
  totalScraped?: number;
  created?: number;
  updated?: number;
  deleted?: number;
  errors?: number;
  diffSummary?: IngestDiffSummary;
  log?: string[];
}

const DAY_OPTIONS = [
  { label: "All Days", value: "All" },
  { label: "Thu", value: "Thursday" },
  { label: "Fri", value: "Friday" },
  { label: "Sat", value: "Saturday" },
  { label: "Sun", value: "Sunday" },
  { label: "Mon", value: "Monday" },
];

export default function AdminPage(props: Props) {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (typeof window !== "undefined") {
      const savedUser = localStorage.getItem("dc_user");
      if (savedUser) {
        try {
          return JSON.parse(savedUser) as User;
        } catch {
          return null;
        }
      }
    }
    return null;
  });
  const [token, setToken] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("dc_token") || "";
    }
    return "";
  });
  // Auth form state
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Controls state
  const [syncMode, setSyncMode] = useState<"sync" | "dry-run" | "hard-resync">("sync");
  const [selectedDays, setSelectedDays] = useState<string[]>(["All"]);
  // Sized for the largest single con day (~650 upstream events) under the
  // Workers subrequests=2000 ceiling; still user-throttleable per run.
  const [throttleLimit, setThrottleLimit] = useState<number | undefined>(1900);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showHardResyncModal, setShowHardResyncModal] = useState(false);
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);

  // Results state
  const [latestResult, setLatestResult] = useState<IngestResult | null>(null);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [logFilter, setLogFilter] = useState<"all" | "created" | "updated" | "errors">("all");

  // History & stats state
  const [pastRuns, setPastRuns] = useState<IngestionRun[]>(props.initialRuns || []);
  const [dbStats, setDbStats] = useState({
    totalActiveEvents: props.totalActiveEvents ?? props.totalEvents ?? 0,
    totalDeletedEvents: props.totalDeletedEvents ?? 0,
    eventsByDay: props.eventsByDay || {},
    totalUsers: props.totalUsers ?? 0,
  });

  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [feedbackFilter, setFeedbackFilter] = useState<"new" | "all">("new");
  const [feedbackBusyId, setFeedbackBusyId] = useState<string | null>(null);
  const [selectedRunForLogModal, setSelectedRunForLogModal] = useState<IngestionRun | null>(null);

  // Load auth state from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem("dc_user");
    const savedToken = localStorage.getItem("dc_token");
    if (savedUser && savedToken) {
      try {
        const parsed = JSON.parse(savedUser) as User;
        setCurrentUser(parsed);
        setToken(savedToken);
        if (parsed.role === "admin") {
          refreshDashboardData(savedToken);
        }
      } catch {
        // ignore parse error
      }
    }

    const cleanupErrorCatchers = setupGlobalErrorCatchers(() => {
      const userStr = localStorage.getItem("dc_user");
      if (userStr) {
        try {
          return JSON.parse(userStr);
        } catch {
          // ignore
        }
      }
      return null;
    }, APP_VERSION);

    return () => {
      cleanupErrorCatchers();
    };
  }, []);

  // Handle client-side login inside Admin Access Denied view
  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setLoginError("Username and password are required.");
      return;
    }
    setLoginError("");
    setIsLoggingIn(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "login",
          username: loginUsername.trim(),
          password: loginPassword.trim(),
        }),
      });
      const data = (await res.json()) as { success: boolean; user?: User; token?: string; error?: string };
      if (data.success && data.user && data.token) {
        if (data.user.role !== "admin") {
          setLoginError("Access denied: User account is not an administrator.");
        } else {
          setCurrentUser(data.user);
          setToken(data.token);
          localStorage.setItem("dc_user", JSON.stringify(data.user));
          localStorage.setItem("dc_token", data.token);
          setLoginUsername("");
          setLoginPassword("");
        }
      } else {
        setLoginError(data.error || "Login failed.");
      }
    } catch {
      setLoginError("An unexpected error occurred.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Day chip toggle handler
  const handleDayChipClick = (val: string) => {
    if (val === "All") {
      setSelectedDays(["All"]);
      return;
    }
    let updated: string[];
    if (selectedDays.includes("All")) {
      updated = [val];
    } else if (selectedDays.includes(val)) {
      updated = selectedDays.filter((d) => d !== val);
      if (updated.length === 0) updated = ["All"];
    } else {
      updated = [...selectedDays, val];
      if (updated.length === 5) updated = ["All"];
    }
    setSelectedDays(updated);
  };

  // Refresh runs and stats from API
  const refreshDashboardData = async (authToken: string) => {
    try {
      const [runsRes, statsRes, feedbackRes] = await Promise.all([
        fetch("/api/admin/runs", { headers: { Authorization: `Bearer ${authToken}` } }),
        fetch("/api/admin/stats", { headers: { Authorization: `Bearer ${authToken}` } }),
        fetch("/api/feedback", { headers: { Authorization: `Bearer ${authToken}` } }),
      ]);
      const runsData = (await runsRes.json()) as { success: boolean; runs?: IngestionRun[] };
      const statsData = (await statsRes.json()) as {
        success: boolean;
        stats?: {
          totalActiveEvents: number;
          totalDeletedEvents: number;
          eventsByDay: Record<string, number>;
          totalUsers: number;
        };
      };
      if (runsData.success && runsData.runs) {
        setPastRuns(runsData.runs);
      }
      if (statsData.success && statsData.stats) {
        setDbStats(statsData.stats);
      }
      const feedbackData = (await feedbackRes.json().catch(() => ({}))) as {
        success?: boolean;
        feedback?: FeedbackItem[];
      };
      if (feedbackData.success && feedbackData.feedback) {
        setFeedbackItems(feedbackData.feedback);
      }
    } catch (err) {
      console.error("Failed to refresh admin dashboard data", err);
    }
  };

  // Apply a triage transition to a feedback item
  const updateFeedbackStatus = async (id: string, status: string) => {
    if (!token) return;
    setFeedbackBusyId(id);
    try {
      const res = await fetch(`/api/feedback/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; feedback?: FeedbackItem };
      if (data.success && data.feedback) {
        const updated = data.feedback;
        setFeedbackItems((items) => items.map((it) => (it.id === id ? updated : it)));
      }
    } catch (err) {
      console.error("Failed to update feedback status", err);
    } finally {
      setFeedbackBusyId(null);
    }
  };

  // Items shown in the attendee feedback panel based on triage filter
  const visibleFeedback =
    feedbackFilter === "all" ? feedbackItems : feedbackItems.filter((item) => item.status === "new");

  // Trigger sync execution
  const executeSync = async () => {
    if (!token) return;
    setIsSyncing(true);
    setSyncErrorMessage(null);
    setTerminalLogs([`[SYSTEM] Triggering sync run (mode: ${syncMode})...`]);

    const targetDays = selectedDays.includes("All")
      ? undefined
      : selectedDays;

    try {
      const res = await fetch("/api/admin/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          mode: syncMode,
          days: targetDays,
          maxDetailFetches: throttleLimit,
        }),
      });

      const data = (await res.json()) as {
        success: boolean;
        runId?: number;
        result?: IngestResult;
        error?: string;
      };

      if (data.success && data.result) {
        setLatestResult(data.result);
        const logs = data.result.log || [];
        setTerminalLogs(logs.length > 0 ? logs : ["Sync execution completed cleanly."]);
        await refreshDashboardData(token);
      } else {
        const errMsg = data.error || "Sync execution failed.";
        setSyncErrorMessage(errMsg);
        setTerminalLogs((prev) => [...prev, `! [ERROR] ${errMsg}`]);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setSyncErrorMessage(errMsg);
      setTerminalLogs((prev) => [...prev, `! [ERROR] Network or server error: ${errMsg}`]);
    } finally {
      setIsSyncing(false);
      setShowHardResyncModal(false);
    }
  };

  const handleStartSyncClick = () => {
    if (syncMode === "hard-resync") {
      setShowHardResyncModal(true);
    } else {
      executeSync();
    }
  };

  // Filtered log lines
  const filteredLogs = useMemo(() => {
    if (logFilter === "all") return terminalLogs;
    if (logFilter === "created") return terminalLogs.filter((l) => l.startsWith("+"));
    if (logFilter === "updated") return terminalLogs.filter((l) => l.startsWith("~"));
    if (logFilter === "errors")
      return terminalLogs.filter(
        (l) => l.startsWith("!") || l.startsWith("-") || l.toLowerCase().includes("error")
      );
    return terminalLogs;
  }, [terminalLogs, logFilter]);


  // Access Denied Render
  if (!currentUser || currentUser.role !== "admin") {
    return (
      <ErrorBoundary
        contextName="AdminAccess"
        user={currentUser ? { id: currentUser.id, username: currentUser.username } : null}
        appVersion={APP_VERSION}
      >
        <div style={{ minHeight: "100vh", background: "#0a0612", color: "#fff", padding: "40px 20px" }}>
        <div style={{ maxWidth: 460, margin: "0 auto" }}>
          <div
            className="cd-glass-panel cd-notch"
            style={{
              padding: 30,
              background: "var(--surface-glass-strong)",
              border: "1px solid var(--coral-500)",
              borderRadius: "var(--r-3)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <span
                style={{
                  background: "rgba(248, 113, 113, 0.15)",
                  color: "var(--coral-500)",
                  border: "1px solid var(--coral-500)",
                  padding: "4px 8px",
                  fontSize: 11,
                  font: "var(--font-mono)",
                  fontWeight: 700,
                  borderRadius: 4,
                }}
              >
                RESTRICTED
              </span>
            </div>

            <h2 style={{ font: "var(--type-heading)", color: "var(--coral-500)", fontSize: 20, marginBottom: 8 }}>
              ACCESS DENIED
            </h2>
            <p style={{ font: "var(--type-body)", color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>
              Administrator credentials required to access the CyberDragon Ingestion Dashboard.
            </p>

            {loginError && (
              <div
                style={{
                  background: "rgba(248,113,113,0.1)",
                  border: "1px solid var(--coral-500)",
                  color: "var(--coral-400)",
                  padding: "8px 12px",
                  fontSize: 12,
                  borderRadius: 4,
                  marginBottom: 16,
                }}
              >
                {loginError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label className="cd-label" style={{ display: "block", marginBottom: 4, fontSize: 11 }}>
                  ADMIN USERNAME
                </label>
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="Enter admin username..."
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: "rgba(0,0,0,0.4)",
                    border: "1px solid var(--line-purple)",
                    color: "#fff",
                    borderRadius: 4,
                    fontSize: 14,
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label className="cd-label" style={{ display: "block", marginBottom: 4, fontSize: 11 }}>
                  PASSWORD
                </label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter password..."
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: "rgba(0,0,0,0.4)",
                    border: "1px solid var(--line-purple)",
                    color: "#fff",
                    borderRadius: 4,
                    fontSize: 14,
                    outline: "none",
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="cd-btn cd-btn-signal"
                style={{ marginTop: 8, padding: "10px 16px", font: "var(--font-mono)", fontSize: 13 }}
              >
                {isLoggingIn ? "AUTHENTICATING..." : "[ 🔑 SIGN IN AS ADMIN ]"}
              </button>
            </form>

            <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px dashed var(--line-purple)", textAlign: "center" }}>
              <a
                href="/"
                style={{
                  font: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--purple-300)",
                  textDecoration: "none",
                }}
              >
                ← Return to Schedule
              </a>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
  }

  // Render Authenticated Admin Dashboard
  return (
    <ErrorBoundary
      contextName="AdminDashboard"
      user={currentUser ? { id: currentUser.id, username: currentUser.username } : null}
      appVersion={APP_VERSION}
    >
      <div style={{ minHeight: "100vh", background: "#0a0612", color: "#fff", paddingBottom: 60 }}>
      {/* Header AppBar */}
      <AppBar
        eyebrow="CYBERDRAGON 2026 ADMIN"
        title="Ingestion Dashboard"
        right={[
          {
            icon: "refresh-cw",
            label: "Refresh Stats",
            active: false,
            onClick: () => refreshDashboardData(token),
          },
          {
            icon: "arrow-left",
            label: "Schedule",
            onClick: () => {
              window.location.href = "/";
            },
          },
        ]}
      />

      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "16px var(--gutter)" }}>
        {/* Top Info Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 20,
            padding: "12px 16px",
            background: "var(--surface-glass-strong)",
            border: "1px solid var(--line-purple)",
            borderRadius: "var(--r-2)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                background: "var(--purple-600)",
                color: "#fff",
                padding: "2px 8px",
                borderRadius: 4,
                fontSize: 11,
                font: "var(--font-mono)",
                fontWeight: 700,
              }}
            >
              ADMIN: {currentUser.name}
            </span>
            <span className="cd-data" style={{ color: "var(--text-tertiary)", fontSize: 12 }}>
              @{currentUser.username}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ font: "var(--font-mono)", fontSize: 12, color: "var(--gold-400)" }}>
              ⚡ D1 ACTIVE EVENTS: <strong>{dbStats.totalActiveEvents}</strong>
            </div>
            <a
              href="/"
              className="cd-btn cd-btn-ghost"
              style={{ padding: "4px 10px", fontSize: 11, textDecoration: "none" }}
            >
              ← Back to Schedule
            </a>
          </div>
        </div>

        {/* Metric Cards Grid */}
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

        {/* Ingestion Controls Card */}
        <div className="cd-glass-panel" style={{ padding: 20, marginBottom: 20, border: "1px solid var(--line-purple)" }}>
          <h3 style={{ font: "var(--type-subhead)", color: "var(--gold-500)", marginBottom: 16, fontSize: 16 }}>
            ⚡ INGESTION CONTROLS
          </h3>

          {/* Sync Mode Selector */}
          <div style={{ marginBottom: 16 }}>
            <label className="cd-label" style={{ display: "block", marginBottom: 6, fontSize: 11 }}>
              SYNCHRONIZATION MODE
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button
                type="button"
                onClick={() => setSyncMode("sync")}
                style={{
                  padding: "8px 14px",
                  borderRadius: 4,
                  font: "var(--font-mono)",
                  fontSize: 12,
                  cursor: "pointer",
                  background: syncMode === "sync" ? "var(--purple-600)" : "rgba(255,255,255,0.05)",
                  color: syncMode === "sync" ? "#fff" : "var(--text-secondary)",
                  border: syncMode === "sync" ? "1px solid var(--purple-400)" : "1px solid var(--line-purple)",
                }}
              >
                Normal Sync (Diff & Write)
              </button>

              <button
                type="button"
                onClick={() => setSyncMode("dry-run")}
                style={{
                  padding: "8px 14px",
                  borderRadius: 4,
                  font: "var(--font-mono)",
                  fontSize: 12,
                  cursor: "pointer",
                  background: syncMode === "dry-run" ? "var(--cyan-600, #0891b2)" : "rgba(255,255,255,0.05)",
                  color: syncMode === "dry-run" ? "#fff" : "var(--text-secondary)",
                  border: syncMode === "dry-run" ? "1px solid var(--cyan-400, #22d3ee)" : "1px solid var(--line-purple)",
                }}
              >
                Dry Run (Safe Preview)
              </button>

              <button
                type="button"
                onClick={() => setSyncMode("hard-resync")}
                style={{
                  padding: "8px 14px",
                  borderRadius: 4,
                  font: "var(--font-mono)",
                  fontSize: 12,
                  cursor: "pointer",
                  background: syncMode === "hard-resync" ? "rgba(239, 68, 68, 0.3)" : "rgba(255,255,255,0.05)",
                  color: syncMode === "hard-resync" ? "var(--coral-400)" : "var(--text-secondary)",
                  border: syncMode === "hard-resync" ? "1px solid var(--coral-500)" : "1px solid var(--line-purple)",
                }}
              >
                ⚠️ Hard Resync (Reset & Overwrite)
              </button>
            </div>
          </div>

          {/* Day Chips Selector */}
          <div style={{ marginBottom: 16 }}>
            <label className="cd-label" style={{ display: "block", marginBottom: 6, fontSize: 11 }}>
              DAY FILTER CHIPS
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {DAY_OPTIONS.map((opt) => {
                const isSelected = selectedDays.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleDayChipClick(opt.value)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 14,
                      fontSize: 12,
                      font: "var(--font-mono)",
                      cursor: "pointer",
                      background: isSelected ? "var(--purple-600)" : "rgba(0,0,0,0.3)",
                      color: isSelected ? "#fff" : "var(--text-tertiary)",
                      border: isSelected ? "1px solid var(--gold-400)" : "1px solid var(--line-purple)",
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Throttle Limiter Dropdown & Submit Button Row */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 16 }}>
            <div>
              <label className="cd-label" style={{ display: "block", marginBottom: 4, fontSize: 11 }}>
                THROTTLE LIMITER
              </label>
              <select
                value={throttleLimit === undefined ? "full" : String(throttleLimit)}
                onChange={(e) => {
                  const val = e.target.value;
                  setThrottleLimit(val === "full" ? undefined : Number(val));
                }}
                style={{
                  padding: "8px 12px",
                  background: "#0f081d",
                  border: "1px solid var(--line-purple)",
                  color: "#fff",
                  borderRadius: 4,
                  fontSize: 13,
                  font: "var(--font-mono)",
                  outline: "none",
                }}
              >
                <option value="full">Full Run (Capped for Safety)</option>
                <option value="10">Test Run: Max 10 Events</option>
                <option value="50">Test Run: Max 50 Events</option>
              </select>
            </div>

            <button
              type="button"
              disabled={isSyncing}
              onClick={handleStartSyncClick}
              className="cd-btn cd-btn-signal"
              style={{
                padding: "9px 20px",
                font: "var(--font-mono)",
                fontSize: 13,
                background: syncMode === "hard-resync" ? "var(--coral-500)" : undefined,
              }}
            >
              {isSyncing ? "⚡ SYNC IN PROGRESS..." : syncMode === "hard-resync" ? "⚠️ EXECUTE HARD RESYNC" : "[ ⚡ EXECUTE SYNC ]"}
            </button>
          </div>

          {syncErrorMessage && (
            <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(248,113,113,0.15)", border: "1px solid var(--coral-500)", color: "var(--coral-400)", borderRadius: 4, fontSize: 12 }}>
              {syncErrorMessage}
            </div>
          )}
        </div>

        {/* Confirmation Modal for Hard Resync */}
        {showHardResyncModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.75)",
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
                maxWidth: 480,
                width: "100%",
                padding: 24,
                border: "2px solid var(--coral-500)",
                borderRadius: "var(--r-3)",
                background: "#140a1c",
              }}
            >
              <h3 style={{ font: "var(--type-heading)", color: "var(--coral-500)", fontSize: 18, marginBottom: 12 }}>
                ⚠️ CONFIRM HARD RESYNC
              </h3>
              <p style={{ font: "var(--type-body)", color: "var(--text-secondary)", fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
                Hard Resync will wipe local schedule events for the targeted days and re-fetch them from upstream core-apps source.
                Are you sure you want to proceed with full schedule reset?
              </p>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowHardResyncModal(false)}
                  className="cd-btn cd-btn-ghost"
                  style={{ padding: "8px 14px", fontSize: 12 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={executeSync}
                  className="cd-btn"
                  style={{
                    padding: "8px 16px",
                    background: "var(--coral-500)",
                    color: "#fff",
                    font: "var(--font-mono)",
                    fontSize: 12,
                  }}
                >
                  {isSyncing ? "EXECUTING..." : "CONFIRM HARD RESYNC"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Diff Inspector Component */}
        {latestResult && (
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
        )}

        {/* Live Terminal / Execution Console */}
        <div className="cd-glass-panel" style={{ padding: 16, marginBottom: 20, background: "#05030a", border: "1px solid var(--line-purple)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: isSyncing ? "#facc15" : "#4ade80" }} />
              <span style={{ font: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--gold-400)" }}>
                EXECUTION TERMINAL CONSOLE
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {(["all", "created", "updated", "errors"] as const).map((filterKey) => (
                <button
                  key={filterKey}
                  type="button"
                  onClick={() => setLogFilter(filterKey)}
                  style={{
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontSize: 11,
                    font: "var(--font-mono)",
                    cursor: "pointer",
                    background: logFilter === filterKey ? "var(--purple-600)" : "transparent",
                    color: logFilter === filterKey ? "#fff" : "var(--text-tertiary)",
                    border: "1px solid var(--line-purple)",
                    textTransform: "uppercase",
                  }}
                >
                  {filterKey}
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              maxHeight: 280,
              overflowY: "auto",
              padding: 12,
              background: "rgba(0,0,0,0.6)",
              borderRadius: 4,
              fontFamily: "JetBrains Mono, monospace, var(--font-mono)",
              fontSize: 12,
              lineHeight: 1.45,
            }}
          >
            {filteredLogs.length === 0 ? (
              <div style={{ color: "var(--text-tertiary)", fontStyle: "italic" }}>
                No log output available. Execute a sync run above to inspect progress.
              </div>
            ) : (
              filteredLogs.map((line, idx) => {
                let color = "#cbd5e1";
                if (line.startsWith("+")) color = "#4ade80";
                else if (line.startsWith("~")) color = "#facc15";
                else if (line.startsWith("-")) color = "#f87171";
                else if (line.startsWith("!") || line.toLowerCase().includes("error")) color = "#ff6b6b";

                return (
                  <div key={idx} style={{ color, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    <span style={{ color: "#475569", marginRight: 8, userSelect: "none" }}>
                      {String(idx + 1).padStart(3, " ")}
                    </span>
                    {line}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Past Runs History Table */}
        <div className="cd-glass-panel" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h4 style={{ font: "var(--type-subhead)", color: "var(--gold-400)", fontSize: 14 }}>
              📜 INGESTION RUN HISTORY
            </h4>
            <button
              type="button"
              onClick={() => refreshDashboardData(token)}
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
                            onClick={() => setSelectedRunForLogModal(run)}
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

        {/* Attendee Feedback Table */}
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
                    onClick={() => setFeedbackFilter(filterMode)}
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
                onClick={() => refreshDashboardData(token)}
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
                        {item.createdAt ? new Date(item.createdAt).toLocaleString() : "-"}
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
                          onClick={() => updateFeedbackStatus(item.id, action.next)}
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
                  onClick={() => setSelectedRunForLogModal(null)}
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
      </main>
      </div>
    </ErrorBoundary>
  );
}
