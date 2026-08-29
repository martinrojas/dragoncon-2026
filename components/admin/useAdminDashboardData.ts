import { useState, useCallback } from "react";
import type { AdminDbStats, FeedbackItem, IngestionRun } from "./adminTypes";

interface InitialDashboardProps {
  initialRuns?: IngestionRun[];
  totalActiveEvents?: number;
  totalEvents?: number;
  totalDeletedEvents?: number;
  eventsByDay?: Record<string, number>;
  totalUsers?: number;
}

export function useAdminDashboardData(initialProps: InitialDashboardProps) {
  const [pastRuns, setPastRuns] = useState<IngestionRun[]>(initialProps.initialRuns || []);
  const [dbStats, setDbStats] = useState<AdminDbStats>({
    totalActiveEvents: initialProps.totalActiveEvents ?? initialProps.totalEvents ?? 0,
    totalDeletedEvents: initialProps.totalDeletedEvents ?? 0,
    eventsByDay: initialProps.eventsByDay || {},
    totalUsers: initialProps.totalUsers ?? 0,
  });
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);

  const refreshDashboardData = useCallback(async (authToken: string) => {
    if (!authToken) return;
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
  }, []);

  return {
    pastRuns,
    dbStats,
    feedbackItems,
    setFeedbackItems,
    refreshDashboardData,
  };
}
