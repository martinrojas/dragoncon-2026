# Spec: Index Page Architecture & Decomposition

> **Status:** Draft  
> **Date:** 2026-08-29  
> **Target:** `pages/index.tsx` (and newly extracted modules under `components/home/`)  
> **Author:** CyberDragon Engineering  

---

## 1. Context & Motivation

`pages/index.tsx` currently spans 2,701 lines and handles 6 distinct sub-domains in a monolithic structure:
1. WebAuthn Passkeys & password fallback authentication.
2. Schedule browsing, search, DayStrip navigation, and TimeRail layout.
3. User Agenda management, optimistic mutations, conflict detection, and stamina/walk calculations.
4. Squad coordination, friend list management, deep-link invite ceremonies, and schedule overlap comparison.
5. Ingestion update checks, diff feeds, and PWA offline storage/install management.
6. User preferences and feedback submission.

This design presents several code smells:
- **Divergent Change:** Any change to schedule filtering, auth, squad, or preferences requires modifying the same 2,700-line file.
- **Monolithic JSX:** 1,500+ lines of nested ternaries inside a single `return` statement.
- **Untested UI & Domain Utilities:** Schedule conflict detection, deep link invite handlers, walkability filters, and stamina meters live embedded inside React lifecycle hooks without isolated unit tests.

---

## 2. Goals & Non-Goals

### Goals
- Decompose `pages/index.tsx` into single-responsibility custom hooks (`components/home/hooks/`), standalone tab components (`components/home/tabs/`), and modals (`components/home/modals/`).
- Reduce `pages/index.tsx` to a lightweight coordinator (~120 lines).
- Extract pure domain logic helpers into `lib/scheduleUtils.ts` and `lib/squadUtils.ts`.
- Provide complete unit test coverage for newly extracted domain logic in `tests/schedule-logic.test.ts` and `tests/squad-logic.test.ts`.
- Maintain 100% backward compatibility with SSR hydration, deep links (`?event=`, `?invite=`), and PWA service worker caching.

### Non-Goals
- Altering the backend API contracts (`/api/events`, `/api/schedule`, `/api/friends`, `/api/auth/passkey`).
- Redesigning visual themes or CSS design tokens in `public/cyberdragon.css`.

---

## 3. Architecture & File Structure

```
lib/
  ├── scheduleUtils.ts                  # Pure domain logic: conflicts, walk tallies, time grouping, venue parsing
  └── squadUtils.ts                     # Pure domain logic: overlap calculation, invite URL parsing, privacy mapping
components/home/
  ├── homeTypes.ts                      # Shared TypeScript interfaces for home page subcomponents & hooks
  ├── hooks/
  │   ├── useHomeAuth.ts                # Passkey WebAuthn, password auth, user persistence, auth modal state
  │   ├── useScheduleFilters.ts         # Day selection, search query, track/location filters, filter sheet state
  │   ├── useAgenda.ts                  # Saved events, conflict detection, stamina walk tally, optimistic mutations
  │   ├── useSquad.ts                   # Friends list, friend schedule comparison, invite deep link handling
  │   └── useAppSyncAndPrefs.ts         # Update checks, diff feed, PWA install prompt, online/offline, preferences
  ├── tabs/
  │   ├── ScheduleTab.tsx               # Schedule grid, TimeRail, search bar, DayStrip
  │   ├── AgendaTab.tsx                 # Agenda load dashboard, stamina meter, conflict banner, saved cards
  │   ├── SquadTab.tsx                  # Squad member cards, invite share link, friend comparison view
  │   ├── ChangesTab.tsx                # Chronological change feed
  │   └── ProfileTab.tsx                # Passkey credentials, preferences toggles, storage panel, logout
  └── modals/
      ├── ScheduleFilterSheet.tsx       # Slide-over filter drawer
      ├── AuthModal.tsx                 # WebAuthn passkey + password fallback modal
      └── ToastNotification.tsx         # Floating alert & undo toast container
pages/
  ├── index.tsx                         # ~120-line coordinator
  └── index.server.ts                   # SSR loader (unchanged)
tests/
  ├── schedule-logic.test.ts            # Unit tests for scheduleUtils & conflict detection
  └── squad-logic.test.ts               # Unit tests for squadUtils & invite/overlap handling
```

---

## 4. Invariants & Backward Compatibility Requirements

1. **SSR Hydration Safety:** All `localStorage` and `sessionStorage` state restorations must occur inside client-side `useEffect` hooks, never in `useState` initializers.
2. **Deep-Link Handling:**
   - `?event=<uuid>` opens the matching event in `PanelDetailModal` and cleans the URL query param without triggering a page reload.
   - `?invite=<username>` opens `AuthModal` in register mode if unauthenticated, or prompts to accept friend invite if authenticated, and cleans the URL query param.
3. **PWA Service Worker:** Bump `CACHE_NAME` in `public/sw.js` (e.g. `dragoncon-pwa-v23` $\to$ `v24`).
4. **Zero Regressions:** Pass 100% of unit tests (`pnpm test`) and maintain zero TypeScript/LSP diagnostics.
