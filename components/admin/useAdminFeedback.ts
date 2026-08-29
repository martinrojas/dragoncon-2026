import { useState, useMemo, useCallback } from "react";
import type { FeedbackItem } from "./adminTypes";

export function useAdminFeedback(
  token: string,
  feedbackItems: FeedbackItem[],
  setFeedbackItems: React.Dispatch<React.SetStateAction<FeedbackItem[]>>,
) {
  const [feedbackFilter, setFeedbackFilter] = useState<"new" | "all">("new");
  const [feedbackBusyId, setFeedbackBusyId] = useState<string | null>(null);

  const visibleFeedback = useMemo(() => {
    return feedbackFilter === "all"
      ? feedbackItems
      : feedbackItems.filter((item) => item.status === "new");
  }, [feedbackFilter, feedbackItems]);

  const updateFeedbackStatus = useCallback(
    async (id: string, status: string) => {
      if (!token) return;
      setFeedbackBusyId(id);
      try {
        const res = await fetch(`/api/feedback/${id}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          feedback?: FeedbackItem;
        };
        if (data.success && data.feedback) {
          const updated = data.feedback;
          setFeedbackItems((items) => items.map((it) => (it.id === id ? updated : it)));
        }
      } catch (err) {
        console.error("Failed to update feedback status", err);
      } finally {
        setFeedbackBusyId(null);
      }
    },
    [token, setFeedbackItems],
  );

  return {
    feedbackFilter,
    setFeedbackFilter,
    feedbackBusyId,
    visibleFeedback,
    updateFeedbackStatus,
  };
}
