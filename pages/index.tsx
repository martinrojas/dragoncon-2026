import { useEffect, useMemo, useState, type JSX } from "react";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { PanelDetailModal } from "../components/PanelDetailModal";
import { APP_VERSION } from "../lib/version";
import { parseTimeDisplay } from "../lib/walktime";
import { shareLink } from "../lib/share";
import { checkEventConflict as checkEventConflictPure, getDayEyebrow, parseVenueRoom } from "../lib/scheduleUtils";
import {
  TRACK_COLORS,
  type Conflict,
  type EventChange,
  type EventItem,
  type ToastState,
  type User,
  type UserEventItem,
} from "../components/home/homeTypes";
import { useHomeAuth } from "../components/home/hooks/useHomeAuth";
import { useScheduleFilters } from "../components/home/hooks/useScheduleFilters";
import { useAgenda } from "../components/home/hooks/useAgenda";
import { useSquad } from "../components/home/hooks/useSquad";
import { useAppSyncAndPrefs } from "../components/home/hooks/useAppSyncAndPrefs";
import { AuthModal } from "../components/home/modals/AuthModal";
import { ScheduleFilterSheet } from "../components/home/modals/ScheduleFilterSheet";
import { ToastNotification } from "../components/home/modals/ToastNotification";
import { ScheduleTab } from "../components/home/tabs/ScheduleTab";
import { AgendaTab } from "../components/home/tabs/AgendaTab";
import { SquadTab } from "../components/home/tabs/SquadTab";
import { ChangesTab } from "../components/home/tabs/ChangesTab";
import { ProfileTab } from "../components/home/tabs/ProfileTab";
import { BottomTabBar } from "../components/home/BottomTabBar";
import { HomeBanners } from "../components/home/HomeBanners";
import type { Props } from "./index.server";

export {
  TRACK_COLORS,
  type Conflict,
  type EventChange,
  type EventItem,
  type ToastState,
  type User,
  type UserEventItem,
};
export { parseTimeDisplay };
export { parseVenueRoom, getDayEyebrow };

export default function HomePage({
  totalEvents,
  initialEvents,
  tracks,
  days,
  locations,
  recentChanges,
}: Props): JSX.Element {
  const [activeTab, setActiveTab] = useState<"schedule" | "agenda" | "friends" | "changes" | "profile">("schedule");
  const [scheduleViewFilter, setScheduleViewFilter] = useState<"All" | "Saved">("All");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [activeDetailItem, setActiveDetailItem] = useState<EventItem | null>(null);

  // Mirrors of useAgenda's saved-schedule state, fed into useScheduleFilters (which
  // needs live conflict/agenda data for its "hide conflicts" & walkability filters).
  // Declared here — ahead of both hooks — to break the natural circular dependency
  // between useScheduleFilters (needs agenda data) and useAgenda (needs selectedDay
  // from useScheduleFilters); synced via effect once useAgenda's real values exist.
  const [mirrorAgendaItems, setMirrorAgendaItems] = useState<UserEventItem[]>([]);
  const [mirrorAgendaConflicts, setMirrorAgendaConflicts] = useState<Conflict[]>([]);

  const triggerToast = (
    message: string,
    type: "ok" | "warn" = "ok",
    actionLabel?: string,
    onAction?: () => void,
  ) => {
    setToast({ message, type, actionLabel, onAction });
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const appSync = useAppSyncAndPrefs({
    recentChanges,
    triggerToast,
    activeDetailItem,
    setActiveDetailItem,
    onEventsRefreshed: (events) => schedule.setEventsList(events),
  });

  const auth = useHomeAuth({
    triggerToast,
    onAuthenticated: (user) => {
      agenda.loadUserAgenda(user.id);
      squad.loadFriends(user.id);
    },
    onLogout: () => {
      agenda.resetAgenda();
    },
  });

  const schedule = useScheduleFilters({
    initialEvents,
    days,
    locations,
    agendaItems: mirrorAgendaItems,
    homeVenue: appSync.homeVenue,
    checkEventConflict: (id) => checkEventConflictPure(id, mirrorAgendaConflicts),
  });

  const agenda = useAgenda({
    currentUser: auth.currentUser,
    selectedDay: schedule.selectedDay,
    triggerToast,
    eventsList: schedule.eventsList,
    onRequireAuth: auth.openAuthModal,
  });

  useEffect(() => {
    setMirrorAgendaItems(agenda.agendaItems);
  }, [agenda.agendaItems]);

  useEffect(() => {
    setMirrorAgendaConflicts(agenda.agendaConflicts);
  }, [agenda.agendaConflicts]);

  const squad = useSquad({
    currentUser: auth.currentUser,
    triggerToast,
    userEventStatusMap: agenda.userEventStatusMap,
    checkEventConflict: agenda.checkEventConflict,
    agendaItems: agenda.agendaItems,
    updateCurrentUser: auth.updateCurrentUser,
  });

  // Re-apply the "Saved" segmented-control filter on top of useScheduleFilters'
  // output (that hook only knows about day/track/location/search — not agenda data).
  const visibleEvents = useMemo(
    () =>
      scheduleViewFilter === "Saved"
        ? schedule.filteredEvents.filter((e) => !!agenda.userEventStatusMap[e.id])
        : schedule.filteredEvents,
    [scheduleViewFilter, schedule.filteredEvents, agenda.userEventStatusMap],
  );

  const visibleGroupedSlots = useMemo(() => {
    if (scheduleViewFilter !== "Saved") return schedule.groupedSlots;
    const map = new Map<string, { label: string; active: boolean; items: EventItem[] }>();
    for (const item of visibleEvents) {
      const slotLabel = parseTimeDisplay(item.timeString).slotLabel;
      if (!map.has(slotLabel)) map.set(slotLabel, { label: slotLabel, active: false, items: [] });
      const slot = map.get(slotLabel)!;
      slot.items.push(item);
      if (item.status === "live") slot.active = true;
    }
    return Array.from(map.values());
  }, [scheduleViewFilter, visibleEvents, schedule.groupedSlots]);

  const handleShareSquadLink = async () => {
    if (!auth.currentUser) return;
    const displayName = auth.currentUser.name?.trim() || `@${auth.currentUser.username}`;
    const url = `${window.location.origin}/?invite=${encodeURIComponent(auth.currentUser.username)}`;
    const res = await shareLink({
      title: "Join my CyberDragon Squad",
      text: `Join ${displayName}'s Dragon Con squad on CyberDragon!`,
      url,
    });
    if (res.copied) {
      triggerToast("Invite link copied to clipboard!", "ok");
    }
  };

  const desktopNavTabs = [
    { id: "schedule", label: "Schedule", icon: "calendar-clock", active: activeTab === "schedule", onClick: () => setActiveTab("schedule") },
    { id: "agenda", label: "Mine", icon: "bookmark", active: activeTab === "agenda", badge: agenda.agendaItems.length, onClick: () => setActiveTab("agenda") },
    { id: "friends", label: "Squad", icon: "users", active: activeTab === "friends", onClick: () => setActiveTab("friends") },
    { id: "changes", label: "Changes", icon: "bell", active: activeTab === "changes", badge: appSync.changesList.length, onClick: () => setActiveTab("changes") },
    { id: "profile", label: "Profile", icon: "user", active: activeTab === "profile", onClick: () => setActiveTab("profile") },
  ];

  return (
    <ErrorBoundary
      contextName="MainApp"
      user={auth.currentUser ? { id: auth.currentUser.id, username: auth.currentUser.username } : null}
      appVersion={APP_VERSION}
    >
      <div
        style={{
          minHeight: "100dvh",
          backgroundColor: "var(--canvas)",
          backgroundImage: "var(--grid-8)",
          color: "var(--text-primary)",
          fontFamily: "var(--font-core)",
          paddingBottom: "calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px) + 24px)",
        }}
      >
        <h1
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            overflow: "hidden",
            clip: "rect(0 0 0 0)",
            whiteSpace: "nowrap",
          }}
        >
          CyberDragon — Dragon Con 2026 schedule companion (Sep 3–7, Atlanta, GA)
        </h1>

        <ToastNotification toast={toast} />

        <HomeBanners
          syncStatusMsg={appSync.syncStatusMsg}
          pendingInvite={squad.pendingInvite}
          currentUser={auth.currentUser}
          onAcceptInvite={squad.handleAcceptInvite}
          onDismissInvite={squad.handleDismissInvite}
          onOpenRegister={() => auth.openAuthModal("register")}
        />

        {activeTab === "schedule" && (
          <ScheduleTab
            currentUser={auth.currentUser}
            selectedDay={schedule.selectedDay}
            setSelectedDay={schedule.setSelectedDay}
            formattedDays={schedule.formattedDays}
            scheduleViewFilter={scheduleViewFilter}
            setScheduleViewFilter={setScheduleViewFilter}
            showSearchInput={schedule.showSearchInput}
            setShowSearchInput={schedule.setShowSearchInput}
            searchQuery={schedule.searchQuery}
            setSearchQuery={schedule.setSearchQuery}
            excludedTracks={schedule.excludedTracks}
            selectedLocation={schedule.selectedLocation}
            hideEndedPanels={schedule.hideEndedPanels}
            hideConflicts={schedule.hideConflicts}
            walkabilityOnly={schedule.walkabilityOnly}
            onOpenFilterSheet={() => schedule.setShowFilterSheet(true)}
            onCheckForUpdates={appSync.handleCheckForUpdates}
            isSyncing={appSync.isSyncing}
            isSearching={schedule.isSearching}
            filteredEvents={visibleEvents}
            groupedSlots={visibleGroupedSlots}
            userEventStatusMap={agenda.userEventStatusMap}
            checkEventConflict={agenda.checkEventConflict}
            getPrecedingVenue={schedule.getPrecedingVenue}
            onToggleEvent={agenda.handleToggleEvent}
            onSelectEvent={setActiveDetailItem}
            desktopNavTabs={desktopNavTabs}
          />
        )}

        {activeTab === "agenda" && (
          <AgendaTab
            currentUser={auth.currentUser}
            supportsPasskeys={auth.supportsPasskeys}
            onOpenAuthModal={() => auth.openAuthModal()}
            onPasskeyLogin={auth.handlePasskeyLogin}
            agendaItems={agenda.agendaItems}
            agendaConflicts={agenda.agendaConflicts}
            selectedDay={schedule.selectedDay}
            setSelectedDay={schedule.setSelectedDay}
            formattedDays={schedule.formattedDays}
            activeDaySavedEvents={agenda.activeDaySavedEvents}
            totalWalkTimeMinutes={agenda.totalWalkTimeMinutes}
            checkEventConflict={agenda.checkEventConflict}
            onToggleEvent={agenda.handleToggleEvent}
            onSelectEvent={setActiveDetailItem}
            desktopNavTabs={desktopNavTabs}
          />
        )}

        {activeTab === "friends" && (
          <SquadTab
            currentUser={auth.currentUser}
            pendingInvite={squad.pendingInvite}
            onOpenAuthModal={auth.openAuthModal}
            friendsList={squad.friendsList}
            selectedFriend={squad.selectedFriend}
            friendSharedEvents={squad.friendSharedEvents}
            friendEventsList={squad.friendEventsList}
            friendScheduleHidden={squad.friendScheduleHidden}
            friendViewMode={squad.friendViewMode}
            setFriendViewMode={squad.setFriendViewMode}
            friendUsernameInput={squad.friendUsernameInput}
            setFriendUsernameInput={squad.setFriendUsernameInput}
            friendMsg={squad.friendMsg}
            onAddFriend={squad.handleAddFriend}
            onCompareFriend={squad.handleCompareFriend}
            userEventStatusMap={agenda.userEventStatusMap}
            checkFriendEventConflict={squad.checkFriendEventConflict}
            onToggleEvent={agenda.handleToggleEvent}
            onSelectEvent={setActiveDetailItem}
            onShareSquadLink={handleShareSquadLink}
            desktopNavTabs={desktopNavTabs}
          />
        )}

        {activeTab === "changes" && <ChangesTab changesList={appSync.changesList} desktopNavTabs={desktopNavTabs} />}

        {activeTab === "profile" && (
          <ProfileTab
            currentUser={auth.currentUser}
            pendingInvite={squad.pendingInvite}
            supportsPasskeys={auth.supportsPasskeys}
            authMode={auth.authMode}
            setAuthMode={auth.setAuthMode}
            authUsername={auth.authUsername}
            setAuthUsername={auth.setAuthUsername}
            authPassword={auth.authPassword}
            setAuthPassword={auth.setAuthPassword}
            authName={auth.authName}
            setAuthName={auth.setAuthName}
            authError={auth.authError}
            onAuthSubmit={auth.handleAuthSubmit}
            onPasskeyLogin={auth.handlePasskeyLogin}
            onQuickPasskeyRegister={auth.handleQuickPasskeyRegister}
            onRegisterPasskey={auth.handleRegisterPasskey}
            onLogout={auth.handleLogout}
            shareScheduleState={squad.shareScheduleState}
            onTogglePrivacy={squad.handleTogglePrivacy}
            remindersEnabled={appSync.remindersEnabled}
            setRemindersEnabled={appSync.setRemindersEnabled}
            walkWarningsEnabled={appSync.walkWarningsEnabled}
            setWalkWarningsEnabled={appSync.setWalkWarningsEnabled}
            hapticsEnabled={appSync.hapticsEnabled}
            setHapticsEnabled={appSync.setHapticsEnabled}
            timeFormat={appSync.timeFormat}
            setTimeFormat={appSync.setTimeFormat}
            homeVenue={appSync.homeVenue}
            setHomeVenue={appSync.setHomeVenue}
            isOnline={appSync.isOnline}
            isInstalled={appSync.isInstalled}
            installPrompt={appSync.installPrompt}
            onInstallPromptUsed={() => appSync.setInstallPrompt(null)}
            totalEvents={totalEvents}
            eventsList={schedule.eventsList}
            minutesSinceSync={appSync.minutesSinceSync}
            onCheckForUpdates={appSync.handleCheckForUpdates}
            isSyncing={appSync.isSyncing}
            onNotify={triggerToast}
            desktopNavTabs={desktopNavTabs}
          />
        )}

        {/* Panel Detail Modal */}
        {activeDetailItem && (
          <PanelDetailModal
            item={activeDetailItem}
            previousVenue={schedule.getPrecedingVenue(activeDetailItem)}
            saved={!!agenda.userEventStatusMap[activeDetailItem.id]}
            onToggleSave={() =>
              agenda.handleToggleEvent(
                activeDetailItem.id,
                agenda.userEventStatusMap[activeDetailItem.id]
                  ? agenda.userEventStatusMap[activeDetailItem.id]
                  : "going",
              )
            }
            onClose={() => {
              setActiveDetailItem(null);
              appSync.cleanEventUrlParam();
            }}
          />
        )}

        <AuthModal
          isOpen={auth.showAuthModal}
          onClose={() => auth.setShowAuthModal(false)}
          authMode={auth.authMode}
          setAuthMode={auth.setAuthMode}
          authUsername={auth.authUsername}
          setAuthUsername={auth.setAuthUsername}
          authPassword={auth.authPassword}
          setAuthPassword={auth.setAuthPassword}
          authName={auth.authName}
          setAuthName={auth.setAuthName}
          authError={auth.authError}
          setAuthError={auth.setAuthError}
          supportsPasskeys={auth.supportsPasskeys}
          onPasskeyLogin={auth.handlePasskeyLogin}
          onQuickPasskeyRegister={auth.handleQuickPasskeyRegister}
          onAuthSubmit={auth.handleAuthSubmit}
          pendingInvite={squad.pendingInvite}
        />

        <ScheduleFilterSheet
          isOpen={schedule.showFilterSheet}
          onClose={() => schedule.setShowFilterSheet(false)}
          searchQuery={schedule.searchQuery}
          setSearchQuery={schedule.setSearchQuery}
          tracks={tracks}
          excludedTracks={schedule.excludedTracks}
          onToggleExcludeTrack={schedule.onToggleExcludeTrack}
          onResetTracks={schedule.onResetTracks}
          locations={locations}
          selectedLocation={schedule.selectedLocation}
          setSelectedLocation={schedule.setSelectedLocation}
          hideEndedPanels={schedule.hideEndedPanels}
          setHideEndedPanels={schedule.setHideEndedPanels}
          hideConflicts={schedule.hideConflicts}
          setHideConflicts={schedule.setHideConflicts}
          walkabilityOnly={schedule.walkabilityOnly}
          setWalkabilityOnly={schedule.setWalkabilityOnly}
          onResetAll={schedule.onResetAll}
          filteredCount={visibleEvents.length}
        />

        <BottomTabBar activeTab={activeTab} setActiveTab={setActiveTab} agendaCount={agenda.agendaItems.length} />
      </div>
    </ErrorBoundary>
  );
}
