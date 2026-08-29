import { useState, useCallback } from "react";
import { AppBar } from "../components/CyberDragonUi";
import { ErrorBoundary } from "../components/ErrorBoundary";
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
import { useAdminAuth } from "../components/admin/useAdminAuth";
import { useAdminDashboardData } from "../components/admin/useAdminDashboardData";
import { useAdminIngest } from "../components/admin/useAdminIngest";
import { useAdminFeedback } from "../components/admin/useAdminFeedback";

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
  const {
    pastRuns,
    dbStats,
    feedbackItems,
    setFeedbackItems,
    refreshDashboardData,
  } = useAdminDashboardData(props);

  const onAdminAuthenticated = useCallback(
    (authToken: string) => {
      refreshDashboardData(authToken);
    },
    [refreshDashboardData],
  );

  const {
    currentUser,
    token,
    loginUsername,
    loginPassword,
    loginError,
    isLoggingIn,
    setLoginUsername,
    setLoginPassword,
    handleLoginSubmit,
  } = useAdminAuth(onAdminAuthenticated);

  const onSyncSuccess = useCallback(() => {
    return refreshDashboardData(token);
  }, [refreshDashboardData, token]);

  const {
    syncMode,
    selectedDays,
    throttleLimit,
    isSyncing,
    showHardResyncModal,
    syncErrorMessage,
    latestResult,
    logFilter,
    filteredLogs,
    setSyncMode,
    setThrottleLimit,
    setShowHardResyncModal,
    setLogFilter,
    handleDayChipClick,
    handleStartSyncClick,
    executeSync,
  } = useAdminIngest(token, onSyncSuccess);

  const {
    feedbackFilter,
    setFeedbackFilter,
    feedbackBusyId,
    visibleFeedback,
    updateFeedbackStatus,
  } = useAdminFeedback(token, feedbackItems, setFeedbackItems);

  const [selectedRunForLogModal, setSelectedRunForLogModal] = useState<IngestionRun | null>(null);

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

  return (
    <ErrorBoundary
      contextName="AdminDashboard"
      user={currentUser ? { id: currentUser.id, username: currentUser.username } : null}
      appVersion={APP_VERSION}
    >
      <div style={{ minHeight: "100vh", background: "#0a0612", color: "#fff", paddingBottom: 60 }}>
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

          <AdminMetricsCards dbStats={dbStats} />

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

          <AdminDiffSummary latestResult={latestResult} />

          <AdminTerminalConsole
            isSyncing={isSyncing}
            logFilter={logFilter}
            filteredLogs={filteredLogs}
            onLogFilterChange={setLogFilter}
          />

          <AdminPastRunsTable
            pastRuns={pastRuns}
            selectedRunForLogModal={selectedRunForLogModal}
            onRefresh={() => refreshDashboardData(token)}
            onSelectRunForLogModal={setSelectedRunForLogModal}
          />

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
