import { useEffect, useMemo, useRef, useState } from "react";
import type { DayItem } from "../../CyberDragonUi.tsx";
import { calculateWalkTime, parseTimeDisplay } from "../../../lib/walktime.ts";
import type { EventItem, UserEventItem } from "../homeTypes.ts";

export interface UseScheduleFiltersOptions {
  initialEvents: EventItem[];
  days: string[];
  /** Consumed by ScheduleFilterSheet directly from page props, not read inside this hook. */
  locations: string[];
  agendaItems: UserEventItem[];
  homeVenue: string;
  /** Sourced from `useAgenda().checkEventConflict` — needed by the "hide conflicts" filter. */
  checkEventConflict: (eventId: string) => boolean;
}

export function useScheduleFilters({
  initialEvents,
  days,
  agendaItems,
  homeVenue,
  checkEventConflict,
}: UseScheduleFiltersOptions) {
  const [selectedDay, setSelectedDay] = useState<string>(() => {
    if (days && days.length > 0) {
      const validDays = days.filter((d) => !d.toLowerCase().includes("tue"));
      const sat = validDays.find((d) => d.toLowerCase().includes("sat"));
      return sat || validDays[0] || "Sat";
    }
    return "Sat";
  });
  const dayRestoredRef = useRef(false);
  const [excludedTracks, setExcludedTracks] = useState<string[]>([]);
  const [filtersRestored, setFiltersRestored] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [hideEndedPanels, setHideEndedPanels] = useState(false);
  const [hideConflicts, setHideConflicts] = useState(false);
  const [walkabilityOnly, setWalkabilityOnly] = useState(false);
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [eventsList, setEventsList] = useState<EventItem[]>(initialEvents);
  const [isSearching, setIsSearching] = useState(false);

  // Restore persisted day/filter selections (browser-only; runs once after mount).
  useEffect(() => {
    const savedDay = localStorage.getItem("dc_selected_day");
    if (savedDay && days?.includes(savedDay)) setSelectedDay(savedDay);
    dayRestoredRef.current = true;

    try {
      const savedTracks: unknown = JSON.parse(localStorage.getItem("dc_excluded_tracks") || "[]");
      if (Array.isArray(savedTracks)) {
        setExcludedTracks(savedTracks.filter((t): t is string => typeof t === "string"));
      }
    } catch {
      // ignore invalid json
    }
    const savedLocation = localStorage.getItem("dc_filter_location");
    if (savedLocation) setSelectedLocation(savedLocation);
    try {
      const savedOptions = JSON.parse(localStorage.getItem("dc_filter_options") || "{}") as {
        hideEndedPanels?: boolean;
        hideConflicts?: boolean;
        walkabilityOnly?: boolean;
      };
      setHideEndedPanels(!!savedOptions.hideEndedPanels);
      setHideConflicts(!!savedOptions.hideConflicts);
      setWalkabilityOnly(!!savedOptions.walkabilityOnly);
    } catch {
      // ignore invalid json
    }
    setFiltersRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch filtered events. Waits for the localStorage restore above so SSR's
  // `initialEvents` aren't replaced by a default-filter fetch that a restored
  // filter would immediately supersede.
  useEffect(() => {
    if (!filtersRestored) return;
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (selectedDay) params.set("day", selectedDay);
    for (const t of excludedTracks) params.append("excludeTracks", t);
    if (selectedLocation) params.set("location", selectedLocation);

    setIsSearching(true);
    fetch(`/api/events?${params.toString()}`)
      .then((res) => res.json() as Promise<{ success: boolean; events: EventItem[] }>)
      .then((data) => {
        if (data.success) setEventsList(data.events);
      })
      .catch(console.error)
      .finally(() => setIsSearching(false));
  }, [filtersRestored, searchQuery, selectedDay, excludedTracks, selectedLocation]);

  // Persist filter state across reloads (armed after initial restore).
  useEffect(() => {
    if (!filtersRestored) return;
    localStorage.setItem("dc_excluded_tracks", JSON.stringify(excludedTracks));
    localStorage.setItem("dc_filter_location", selectedLocation);
    localStorage.setItem(
      "dc_filter_options",
      JSON.stringify({ hideEndedPanels, hideConflicts, walkabilityOnly }),
    );
  }, [filtersRestored, excludedTracks, selectedLocation, hideEndedPanels, hideConflicts, walkabilityOnly]);

  // Persist selected day across reloads (armed after initial restore).
  useEffect(() => {
    if (!dayRestoredRef.current) return;
    if (selectedDay) localStorage.setItem("dc_selected_day", selectedDay);
  }, [selectedDay]);

  // Format day items for DayStrip directly from server-driven days.
  const formattedDays: DayItem[] = useMemo(() => {
    const parseDayInfo = (dayStr: string) => {
      const lower = dayStr.toLowerCase();

      let label = "CON";
      if (lower.includes("wed")) label = "WED";
      else if (lower.includes("thu")) label = "THU";
      else if (lower.includes("fri")) label = "FRI";
      else if (lower.includes("sat")) label = "SAT";
      else if (lower.includes("sun")) label = "SUN";
      else if (lower.includes("mon")) label = "MON";
      else if (lower.includes("tue")) label = "TUE";
      else {
        const parts = dayStr.split(",");
        label = (parts[0]?.trim().toUpperCase() || "CON").slice(0, 3);
      }

      const numMatch = dayStr.match(/\d+/);
      let dateNum: string;
      if (numMatch) {
        dateNum = numMatch[0].padStart(2, "0");
      } else {
        const fallbackDates: Record<string, string> = {
          WED: "02",
          THU: "03",
          FRI: "04",
          SAT: "05",
          SUN: "06",
          MON: "07",
          TUE: "08",
        };
        dateNum = fallbackDates[label] || "01";
      }

      const rank = parseInt(dateNum, 10) || 99;
      return { label, date: dateNum, rank };
    };

    const sortedDays = [...(days || [])]
      .filter((d) => !d.toLowerCase().includes("tue"))
      .sort((a, b) => parseDayInfo(a).rank - parseDayInfo(b).rank);
    const seen = new Set<string>();
    const items: DayItem[] = [];

    for (const dayStr of sortedDays) {
      const { label, date } = parseDayInfo(dayStr);
      const key = `${label}-${date}`;
      if (!seen.has(key)) {
        seen.add(key);
        items.push({ value: dayStr, label, date });
      }
    }

    return items;
  }, [days]);

  // Contextual preceding venue helper for walk time calculations, ported
  // verbatim from the original inline implementation. Note: only the
  // "no earlier saved event this day" branch falls back to `homeVenue` — an
  // already-saved current event's immediately preceding venue is returned
  // as-is, even if its location happens to be empty.
  const getPrecedingVenue = (currentEvent: EventItem): string | null => {
    const daySaved = agendaItems
      .map((item) => item.event)
      .filter((ev): ev is EventItem => !!ev && ev.day === currentEvent.day)
      .sort((a, b) => (a.startsAt || "").localeCompare(b.startsAt || ""));

    const currentIndex = daySaved.findIndex((e) => e.id === currentEvent.id);
    if (currentIndex > 0) {
      return daySaved[currentIndex - 1].location;
    }

    const preceding = daySaved.filter((e) => (e.startsAt || "") < (currentEvent.startsAt || "")).pop();
    return preceding?.location || homeVenue;
  };

  // Filter events according to smart checkboxes.
  const filteredEvents = useMemo(() => {
    return eventsList
      .filter((item) => {
        if (selectedDay && item.day !== selectedDay) return false;
        if (item.track && excludedTracks.includes(item.track)) return false;
        if (hideEndedPanels && item.status === "done") return false;
        if (hideConflicts && checkEventConflict(item.id)) return false;
        if (walkabilityOnly) {
          const walk = calculateWalkTime(getPrecedingVenue(item), item.location);
          if (walk.minutes > 10) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.startsAt && b.startsAt) {
          const diff = a.startsAt.localeCompare(b.startsAt);
          if (diff !== 0) return diff;
        } else if (a.startsAt) {
          return -1;
        } else if (b.startsAt) {
          return 1;
        }
        return (a.title || "").localeCompare(b.title || "");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    eventsList,
    selectedDay,
    excludedTracks,
    hideEndedPanels,
    hideConflicts,
    walkabilityOnly,
    checkEventConflict,
    agendaItems,
    homeVenue,
  ]);

  // Group events by time slots for TimeRail layout.
  const groupedSlots = useMemo(() => {
    const map = new Map<string, { label: string; active: boolean; items: EventItem[] }>();

    for (const item of filteredEvents) {
      const timeInfo = parseTimeDisplay(item.timeString);
      const slotLabel = timeInfo.slotLabel;

      if (!map.has(slotLabel)) {
        map.set(slotLabel, { label: slotLabel, active: false, items: [] });
      }

      const slot = map.get(slotLabel)!;
      slot.items.push(item);
      if (item.status === "live") slot.active = true;
    }

    return Array.from(map.values());
  }, [filteredEvents]);

  const onToggleExcludeTrack = (track: string) => {
    setExcludedTracks((prev) => (prev.includes(track) ? prev.filter((x) => x !== track) : [...prev, track]));
  };
  const onResetTracks = () => setExcludedTracks([]);
  const onResetAll = () => {
    setExcludedTracks([]);
    setSelectedLocation("");
    setHideEndedPanels(false);
    setHideConflicts(false);
    setWalkabilityOnly(false);
  };

  return {
    selectedDay,
    setSelectedDay,
    excludedTracks,
    setExcludedTracks,
    selectedLocation,
    setSelectedLocation,
    searchQuery,
    setSearchQuery,
    hideEndedPanels,
    setHideEndedPanels,
    hideConflicts,
    setHideConflicts,
    walkabilityOnly,
    setWalkabilityOnly,
    showFilterSheet,
    setShowFilterSheet,
    showSearchInput,
    setShowSearchInput,
    eventsList,
    setEventsList,
    isSearching,
    formattedDays,
    filteredEvents,
    groupedSlots,
    getPrecedingVenue,
    onToggleExcludeTrack,
    onResetTracks,
    onResetAll,
  };
}
