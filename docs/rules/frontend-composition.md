---
type: Domain Rules
title: Frontend Composition and Browser-State Rules
description: Coordinator boundaries, SSR-safe browser state restoration, and shared frontend formatting invariants.
tags: [domain-rules, frontend, react, ssr, hydration]
generated: { by: docsmith/1.3.0, at: 2026-08-29T07:04:03Z }
verified: [{ by: docsmith/1.3.0, at: 2026-08-29T07:04:03Z }]
status: stable
maintainer: CyberDragon Engineering
sources:
  - id: home-coordinator
    resource: pages/index.tsx:1-178
    title: Home coordinator imports, hook wiring, mirror state, and shared view derivation
  - id: home-types
    resource: components/home/homeTypes.ts:1-84
    title: Canonical shared home types and track colors
  - id: filter-restore
    resource: components/home/hooks/useScheduleFilters.ts:24-113
    title: Mount-time filter restoration and restore-gated persistence
  - id: app-preferences
    resource: components/home/hooks/useAppSyncAndPrefs.ts:43-110
    title: Mount-time home venue and time-format restoration
  - id: admin-coordinator
    resource: pages/admin.tsx:1-100
    title: Admin coordinator imports and hook wiring
  - id: admin-types
    resource: components/admin/adminTypes.ts:1-34
    title: Shared administrator types and UTC timestamp formatting
  - id: schedule-utilities
    resource: lib/scheduleUtils.ts:1-70
    title: Pure venue, day, conflict, and walk-total functions
  - id: squad-utilities
    resource: lib/squadUtils.ts:1-23
    title: Pure overlap and self-invite functions plus URL cleanup
---

# Frontend Composition and Browser-State Rules

## Home coordinator boundary

`pages/index.tsx` composes the home application. It owns cross-domain presentation state, initializes five domain hooks, derives the saved-event view, and passes state and handlers into five tab components, three home modal components, banners, and the bottom tab bar.[^home-coordinator]

The five hooks separate authentication, schedule filtering, agenda state, squad state, and application synchronization/preferences. `components/home/homeTypes.ts` is the canonical type module for values shared across those hooks and views; `pages/index.tsx` re-exports the compatibility surface used before the refactor.[^home-coordinator][^home-types]

Pure schedule and squad calculations live in `lib/scheduleUtils.ts` and `lib/squadUtils.ts`. Hooks and coordinators reuse those functions instead of embedding a second implementation.[^schedule-utilities][^squad-utilities]

## Agenda/filter dependency boundary

Schedule filters need live agenda items and conflict data for walkability and conflict filtering. Agenda state needs the selected day and event list produced by schedule filters. The coordinator breaks this cycle with `mirrorAgendaItems` and `mirrorAgendaConflicts`, initializes the schedule hook with those mirrors, initializes the agenda hook from schedule output, and synchronizes agenda results back into the mirrors with effects.[^home-coordinator]

Keep that dependency boundary in the coordinator unless one hook's public contract changes. Importing either hook into the other would create a state ownership cycle.

## SSR-safe browser state

Browser storage and browser globals must not run during server rendering. Restore `localStorage` and `sessionStorage` values in mount effects, not `useState` initializers.[^filter-restore][^app-preferences]

`useScheduleFilters` applies two persistence gates:[^filter-restore]

- `filtersRestored` blocks the filtered-event fetch and filter persistence until the mount effect has restored track, location, and option values. This prevents the SSR event payload from being replaced by a default-filter request immediately before restored filters trigger a second request.
- `dayRestoredRef` blocks `dc_selected_day` persistence until the mount effect has read the saved day. This prevents the initial default day from overwriting the stored selection.

`useAppSyncAndPrefs` restores `dc_home_venue` and `dc_time_format` in its mount effect. Setter functions may persist later user actions after hydration.[^app-preferences]

## Admin coordinator boundary

`pages/admin.tsx` composes the administrator screen from four state hooks and focused presentation components. `useAdminAuth` owns access state, `useAdminDashboardData` owns loaded dashboard data, `useAdminIngest` owns ingestion execution state, and `useAdminFeedback` owns feedback filtering and transitions.[^admin-coordinator]

Shared administrator types and formatting live in `components/admin/adminTypes.ts`. Render ingestion and feedback timestamps through `formatRunTimestamp`; the formatter treats suffix-less SQLite `datetime('now')` values as UTC before converting them to the viewer's locale.[^admin-types]

## Provenance

[^home-coordinator]: Home coordinator imports, hook wiring, mirror state, and shared view derivation — `pages/index.tsx:1-178`
[^home-types]: Canonical shared home types and track colors — `components/home/homeTypes.ts:1-84`
[^filter-restore]: Mount-time filter restoration and restore-gated persistence — `components/home/hooks/useScheduleFilters.ts:24-113`
[^app-preferences]: Mount-time home venue and time-format restoration — `components/home/hooks/useAppSyncAndPrefs.ts:43-110`
[^admin-coordinator]: Admin coordinator imports and hook wiring — `pages/admin.tsx:1-100`
[^admin-types]: Shared administrator types and UTC timestamp formatting — `components/admin/adminTypes.ts:1-34`
[^schedule-utilities]: Pure venue, day, conflict, and walk-total functions — `lib/scheduleUtils.ts:1-70`
[^squad-utilities]: Pure overlap and self-invite functions plus URL cleanup — `lib/squadUtils.ts:1-23`
