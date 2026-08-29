import { useState, useMemo, useCallback } from "react";
import type { IngestResult } from "./adminTypes";

export function useAdminIngest(token: string, onSyncSuccess?: () => Promise<void> | void) {
  const [syncMode, setSyncMode] = useState<"sync" | "dry-run" | "hard-resync">("sync");
  const [selectedDays, setSelectedDays] = useState<string[]>(["All"]);
  // Sized for the largest single con day (~650 upstream events) under the
  // Workers subrequests=2000 ceiling; still user-throttleable per run.
  const [throttleLimit, setThrottleLimit] = useState<number | undefined>(1900);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showHardResyncModal, setShowHardResyncModal] = useState(false);
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);

  const [latestResult, setLatestResult] = useState<IngestResult | null>(null);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [logFilter, setLogFilter] = useState<"all" | "created" | "updated" | "errors">("all");

  const handleDayChipClick = useCallback(
    (val: string) => {
      if (val === "All") {
        setSelectedDays(["All"]);
        return;
      }
      setSelectedDays((prev) => {
        if (prev.includes("All")) {
          return [val];
        }
        if (prev.includes(val)) {
          const updated = prev.filter((d) => d !== val);
          return updated.length === 0 ? ["All"] : updated;
        }
        const updated = [...prev, val];
        return updated.length === 5 ? ["All"] : updated;
      });
    },
    [],
  );

  const executeSync = useCallback(async () => {
    if (!token) return;
    setIsSyncing(true);
    setSyncErrorMessage(null);
    setTerminalLogs([`[SYSTEM] Triggering sync run (mode: ${syncMode})...`]);

    const targetDays = selectedDays.includes("All") ? undefined : selectedDays;

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
        if (onSyncSuccess) {
          await onSyncSuccess();
        }
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
  }, [token, syncMode, selectedDays, throttleLimit, onSyncSuccess]);

  const handleStartSyncClick = useCallback(() => {
    if (syncMode === "hard-resync") {
      setShowHardResyncModal(true);
    } else {
      executeSync();
    }
  }, [syncMode, executeSync]);

  const filteredLogs = useMemo(() => {
    if (logFilter === "all") return terminalLogs;
    if (logFilter === "created") return terminalLogs.filter((l) => l.startsWith("+"));
    if (logFilter === "updated") return terminalLogs.filter((l) => l.startsWith("~"));
    if (logFilter === "errors")
      return terminalLogs.filter(
        (l) => l.startsWith("!") || l.startsWith("-") || l.toLowerCase().includes("error"),
      );
    return terminalLogs;
  }, [terminalLogs, logFilter]);

  return {
    syncMode,
    selectedDays,
    throttleLimit,
    isSyncing,
    showHardResyncModal,
    syncErrorMessage,
    latestResult,
    terminalLogs,
    logFilter,
    filteredLogs,
    setSyncMode,
    setThrottleLimit,
    setShowHardResyncModal,
    setLogFilter,
    handleDayChipClick,
    handleStartSyncClick,
    executeSync,
  };
}
