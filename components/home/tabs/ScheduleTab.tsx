import type { JSX } from "react";
import { AppBar, DayStrip, PanelCard, SegmentedControl, TimeRail, type DayItem } from "../../CyberDragonUi.tsx";
import { calculateWalkTime, parseTimeDisplay } from "../../../lib/walktime.ts";
import { getDayEyebrow, parseVenueRoom } from "../../../lib/scheduleUtils.ts";
import { TRACK_COLORS, type EventItem, type NavTab, type User } from "../homeTypes.ts";

interface ScheduleTabProps {
  currentUser: User | null;
  selectedDay: string;
  setSelectedDay: (d: string) => void;
  formattedDays: DayItem[];
  scheduleViewFilter: "All" | "Saved";
  setScheduleViewFilter: (f: "All" | "Saved") => void;
  showSearchInput: boolean;
  setShowSearchInput: (s: boolean | ((prev: boolean) => boolean)) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  excludedTracks: string[];
  selectedLocation: string;
  hideEndedPanels: boolean;
  hideConflicts: boolean;
  walkabilityOnly: boolean;
  onOpenFilterSheet: () => void;
  onCheckForUpdates: () => void;
  isSyncing: boolean;
  isSearching: boolean;
  filteredEvents: EventItem[];
  groupedSlots: Array<{ label: string; active: boolean; items: EventItem[] }>;
  userEventStatusMap: Record<string, "going" | "interested">;
  checkEventConflict: (id: string) => boolean;
  getPrecedingVenue: (ev: EventItem) => string | null;
  onToggleEvent: (id: string, status: "going" | "interested", bypassToast?: boolean) => void;
  onSelectEvent: (ev: EventItem) => void;
  desktopNavTabs: NavTab[];
}

export function ScheduleTab({
  currentUser,
  selectedDay,
  setSelectedDay,
  formattedDays,
  scheduleViewFilter,
  setScheduleViewFilter,
  showSearchInput,
  setShowSearchInput,
  searchQuery,
  setSearchQuery,
  excludedTracks,
  selectedLocation,
  hideEndedPanels,
  hideConflicts,
  walkabilityOnly,
  onOpenFilterSheet,
  onCheckForUpdates,
  isSyncing,
  isSearching,
  filteredEvents,
  groupedSlots,
  userEventStatusMap,
  checkEventConflict,
  getPrecedingVenue,
  onToggleEvent,
  onSelectEvent,
  desktopNavTabs,
}: ScheduleTabProps): JSX.Element {
  return (
    <div>
      {/* CyberDragon AppBar */}
      <AppBar
        eyebrow={getDayEyebrow(selectedDay)}
        title="Schedule"
        navTabs={desktopNavTabs}
        right={[
          ...(currentUser?.role === "admin"
            ? [
                {
                  icon: "shield-user",
                  label: "Admin",
                  onClick: () => {
                    window.location.href = "/admin";
                  },
                },
              ]
            : []),
          {
            icon: "search",
            label: "Search",
            active: showSearchInput || !!searchQuery,
            onClick: () => setShowSearchInput((s) => !s),
          },
          {
            icon: "sliders-horizontal",
            label: "Filters",
            active: excludedTracks.length > 0 || !!selectedLocation || hideEndedPanels || hideConflicts || walkabilityOnly,
            onClick: onOpenFilterSheet,
          },
          {
            icon: "refresh-cw",
            label: "Updates",
            active: isSyncing,
            onClick: onCheckForUpdates,
          },
        ]}
      />
      {/* DayStrip */}
      <DayStrip days={formattedDays} value={selectedDay} onChange={setSelectedDay} />

      {/* Segmented Control ('All' | 'Saved') & Count */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 var(--gutter) 10px",
          maxWidth: 900,
          margin: "0 auto",
        }}
      >
        <SegmentedControl
          size="sm"
          options={["All", "Saved"]}
          value={scheduleViewFilter}
          onChange={(val) => setScheduleViewFilter(val as "All" | "Saved")}
        />
        <span className="cd-label" style={{ fontVariantNumeric: "tabular-nums" }}>
          {filteredEvents.length} PANELS
        </span>
      </div>

      {/* Inline Search Box when toggled */}
      {showSearchInput && (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 var(--gutter) 12px" }}>
          <input
            type="text"
            placeholder="Search panels, guests, venues, tracks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: "var(--r-control)",
              border: "1px solid var(--line-subtle)",
              backgroundColor: "var(--surface-inset)",
              color: "var(--text-primary)",
              font: "var(--type-body-sm)",
              boxSizing: "border-box",
            }}
          />
        </div>
      )}

      {/* TimeRail Schedule Grid */}
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "4px var(--gutter) 0" }}>
        {isSearching && (
          <div style={{ textAlign: "center", color: "var(--text-tertiary)", font: "var(--type-data)", padding: 40 }}>
            SEARCHING THE GRID...
          </div>
        )}

        {!isSearching && filteredEvents.length === 0 && (
          <div
            className="cd-glass-panel"
            style={{ textAlign: "center", color: "var(--text-tertiary)", padding: 40, marginTop: 20 }}
          >
            NO PANELS FOUND MATCHING FILTER CRITERIA.
          </div>
        )}

        {!isSearching &&
          groupedSlots.map((slot) => (
            <TimeRail key={slot.label} label={slot.label} active={slot.active}>
              {slot.items.map((ev) => {
                const timeInfo = parseTimeDisplay(ev.timeString);
                const venueInfo = parseVenueRoom(ev.location);
                const isSaved = !!userEventStatusMap[ev.id];
                const isConflict = checkEventConflict(ev.id);
                const trackColor = TRACK_COLORS[ev.track?.toUpperCase() || ""] || "var(--purple-400)";
                const walkInfo = calculateWalkTime(getPrecedingVenue(ev), ev.location);

                return (
                  <PanelCard
                    key={ev.id}
                    time={timeInfo.start}
                    endTime={timeInfo.end}
                    title={ev.title}
                    venue={venueInfo.venue}
                    room={venueInfo.room}
                    track={ev.track || undefined}
                    trackColor={trackColor}
                    status={ev.status}
                    saved={isSaved}
                    conflict={isConflict}
                    walk={walkInfo.minutes > 0 ? `${walkInfo.minutes} min` : undefined}
                    onSave={() => onToggleEvent(ev.id, isSaved ? (userEventStatusMap[ev.id] || "going") : "going")}
                    onClick={() => onSelectEvent(ev)}
                  />
                );
              })}
            </TimeRail>
          ))}
      </main>
    </div>
  );
}
