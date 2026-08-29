import { useMemo, useState } from "react";
import { checkEventConflict as checkEventConflictPure, calculateDailyWalkMinutes } from "../../../lib/scheduleUtils.ts";
import type { Conflict, EventItem, User, UserEventItem } from "../homeTypes.ts";

export interface UseAgendaOptions {
  currentUser: User | null;
  selectedDay: string;
  triggerToast: (message: string, type?: "ok" | "warn", actionLabel?: string, onAction?: () => void) => void;
  /** Sourced from `useScheduleFilters().eventsList` — needed to resolve a panel's title for toast copy. */
  eventsList: EventItem[];
  /** Sourced from `useHomeAuth().openAuthModal` — opens the sign-in sheet when a mutation is attempted while logged out. */
  onRequireAuth: () => void;
}

export function useAgenda({ currentUser, selectedDay, triggerToast, eventsList, onRequireAuth }: UseAgendaOptions) {
  const [agendaItems, setAgendaItems] = useState<UserEventItem[]>([]);
  const [agendaConflicts, setAgendaConflicts] = useState<Conflict[]>([]);
  const [userEventStatusMap, setUserEventStatusMap] = useState<Record<string, "going" | "interested">>({});

  // Load User Agenda
  const loadUserAgenda = async (userId: string) => {
    try {
      const res = await fetch(`/api/schedule?userId=${userId}`);
      const data = (await res.json()) as {
        success: boolean;
        items: UserEventItem[];
        conflicts: Conflict[];
      };
      if (data.success) {
        setAgendaItems(data.items);
        setAgendaConflicts(data.conflicts);

        const statusMap: Record<string, "going" | "interested"> = {};
        for (const item of data.items) {
          statusMap[item.eventId] = item.status;
        }
        setUserEventStatusMap(statusMap);
      }
    } catch (e: unknown) {
      console.error("Failed to load user agenda", e);
    }
  };

  // Helper to execute explicit schedule mutations without stale closure issues
  const executeScheduleMutation = async (
    eventId: string,
    action: "add" | "remove",
    status: "going" | "interested" = "going",
  ) => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }

    setUserEventStatusMap((prevMap) => {
      const nextMap = { ...prevMap };
      if (action === "remove") {
        delete nextMap[eventId];
      } else {
        nextMap[eventId] = status;
      }
      return nextMap;
    });

    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id, eventId, action, status }),
      });
      const data = (await res.json()) as { success: boolean };
      if (data.success) {
        loadUserAgenda(currentUser.id);
      }
    } catch (e: unknown) {
      console.error("Failed to update schedule", e);
    }
  };

  // Toggle Agenda Event with Undo Toast
  const handleToggleEvent = async (
    eventId: string,
    newStatus: "going" | "interested",
    bypassToast: boolean = false,
  ) => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }

    const currentStatus = userEventStatusMap[eventId];
    const isRemoving = currentStatus === newStatus;
    const action = isRemoving ? "remove" : "add";
    const statusToRestore = currentStatus || "going";

    if (!bypassToast) {
      const ev = eventsList.find((e) => e.id === eventId);
      const title = ev ? ev.title : "Panel";

      if (isRemoving) {
        triggerToast(`Removed "${title}" from schedule.`, "ok", "Undo", () => {
          executeScheduleMutation(eventId, "add", statusToRestore);
        });
      } else {
        const hasConflict = agendaConflicts.some((c) => c.event1Id === eventId || c.event2Id === eventId);
        if (hasConflict) {
          triggerToast(`Added — overlaps another panel.`, "warn", "Undo", () => {
            executeScheduleMutation(eventId, "remove");
          });
        } else {
          triggerToast(`Added "${title}" to your schedule.`, "ok", "Undo", () => {
            executeScheduleMutation(eventId, "remove");
          });
        }
      }
    }

    await executeScheduleMutation(eventId, action, newStatus);
  };

  const checkEventConflict = (eventId: string): boolean => checkEventConflictPure(eventId, agendaConflicts);

  // Daily Load Calculation for My Agenda Tab
  const activeDaySavedEvents = useMemo(() => {
    return agendaItems
      .map((item) => item.event)
      .filter((ev): ev is EventItem => !!ev && (!selectedDay || ev.day === selectedDay))
      .sort((a, b) => (a.startsAt || "").localeCompare(b.startsAt || ""));
  }, [agendaItems, selectedDay]);

  const totalWalkTimeMinutes = useMemo(
    () => calculateDailyWalkMinutes(activeDaySavedEvents),
    [activeDaySavedEvents],
  );

  // Clears saved-schedule state on sign-out; wired from `useHomeAuth`'s `onLogout` callback.
  const resetAgenda = () => {
    setAgendaItems([]);
    setUserEventStatusMap({});
  };

  return {
    agendaItems,
    agendaConflicts,
    userEventStatusMap,
    activeDaySavedEvents,
    totalWalkTimeMinutes,
    checkEventConflict,
    loadUserAgenda,
    executeScheduleMutation,
    handleToggleEvent,
    resetAgenda,
  };
}
