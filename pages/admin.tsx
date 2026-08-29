import { useEffect, useState, useMemo, type SyntheticEvent } from "react";
import { AppBar } from "../components/CyberDragonUi";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { setupGlobalErrorCatchers } from "../lib/errorReporting";
import { APP_VERSION } from "../lib/version";
import type { Props } from "./admin.server";
import {
  formatRunTimestamp,
  FEEDBACK_ACTIONS,
  type User,
  type IngestionRun,
  type IngestDiffSummary,
  type FeedbackItem,
  type IngestResult,
  type AdminDbStats,
} from "../components/admin/adminTypes";
import { AdminAccessDenied } from "../components/admin/AdminAccessDenied";
import { AdminMetricsCards } from "../components/admin/AdminMetricsCards";
import { AdminIngestControls } from "../components/admin/AdminIngestControls";
import { AdminDiffSummary } from "../components/admin/AdminDiffSummary";
import { AdminTerminalConsole } from "../components/admin/AdminTerminalConsole";
import { AdminPastRunsTable } from "../components/admin/AdminPastRunsTable";
import { AdminFeedbackList } from "../components/admin/AdminFeedbackList";

export {
  formatRunTimestamp,
  FEEDBACK_ACTIONS,
  type User,
  type IngestionRun,
  type IngestDiffSummary,
  type FeedbackItem,
  type IngestResult,
  type AdminDbStats,
};

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
  const [dbStats, setDbStats] = useState<AdminDbStats>({
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
  const handleLoginSubmit = async (e: SyntheticEvent) => {
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
        stats?: AdminDbStats;
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
      <AdminAccessDenied
        currentUser={currentUser}
        loginUsername={loginUsername}
        loginPassword={loginPassword}
        loginError={loginError}
        isLoggingIn={isLoggingIn}
        onUsernameChange={setLoginUsername}
        onPasswordChange={setLoginPassword}
        onSubmit={handleLoginSubmit}
      />
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
          <AdminMetricsCards dbStats={dbStats} />

          {/* Ingestion Controls Card */}
          <AdminIngestControls
            syncMode={syncMode}
            selectedDays={selectedDays}
            throttleLimit={throttleLimit}
            isSyncing={isSyncing}
            showHardResyncModal={showHardResyncModal}
            syncErrorMessage={syncErrorMessage}
            onSyncModeChange={setSyncMode}
            onDayChipClick={handleDayChipClick}
            onThrottleLimitChange={setThrottleLimit}
            onStartSyncClick={handleStartSyncClick}
            onExecuteSync={executeSync}
            onCloseHardResyncModal={() => setShowHardResyncModal(false)}
          />

          {/* Diff Inspector Component */}
          <AdminDiffSummary latestResult={latestResult} />

          {/* Live Terminal / Execution Console */}
          <AdminTerminalConsole
            isSyncing={isSyncing}
            logFilter={logFilter}
            filteredLogs={filteredLogs}
            onLogFilterChange={setLogFilter}
          />

          {/* Past Runs History Table */}
          <AdminPastRunsTable
            pastRuns={pastRuns}
            selectedRunForLogModal={selectedRunForLogModal}
            onRefresh={() => refreshDashboardData(token)}
            onSelectRunForLogModal={setSelectedRunForLogModal}
          />

          {/* Attendee Feedback Table */}
          <AdminFeedbackList
            feedbackItems={feedbackItems}
            visibleFeedback={visibleFeedback}
            feedbackFilter={feedbackFilter}
            feedbackBusyId={feedbackBusyId}
            onFilterChange={setFeedbackFilter}
            onRefresh={() => refreshDashboardData(token)}
            onUpdateStatus={updateFeedbackStatus}
          />
        </main>
      </div>
    </ErrorBoundary>
  );
}
