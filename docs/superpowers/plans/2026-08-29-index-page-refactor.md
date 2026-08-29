# Index Page Refactor & Decomposition Implementation Plan

> **Status:** Complete (Implemented in commits `9af6400`..`2cc9b0b`)  
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
**Goal:** Decompose the monolithic 2,701-line `pages/index.tsx` into focused custom hooks, domain utility libraries, and presentation subcomponents while establishing full unit test coverage for extracted schedule and squad logic.

**Architecture:** Extract pure domain logic into `lib/scheduleUtils.ts` and `lib/squadUtils.ts`, extract stateful logic into 5 single-responsibility custom hooks under `components/home/hooks/`, isolate 5 full-screen tabs under `components/home/tabs/`, extract modals under `components/home/modals/`, and simplify `pages/index.tsx` into a lightweight ~120-line coordinator.

**Tech Stack:** React 19, TypeScript, Vitest, Void/Hono, @simplewebauthn/browser.

**Spec:** `docs/superpowers/specs/2026-08-29-index-page-refactor-spec.md`

## Global Constraints
- SSR Hydration Safety: All `localStorage` and `sessionStorage` restorations must occur inside mount `useEffect` hooks, never in `useState` initializers.
- Conventional commits: `feat:`, `fix:`, `refactor:`, `chore:`, `test:`.
- PWA Cache Versioning: Bump `CACHE_NAME` in `public/sw.js` (e.g. `dragoncon-pwa-v23` $\to$ `dragoncon-pwa-v24`).
- Backward Compatibility: Deep links (`?event=`, `?invite=`), ICS export, and WebAuthn passkey ceremonies must function identically.

---

### Task 1: Extract Pure Schedule & Squad Domain Utilities with Unit Tests

**Files:**
- Create: `lib/scheduleUtils.ts`
- Create: `lib/squadUtils.ts`
- Test: `tests/schedule-logic.test.ts`
- Test: `tests/squad-logic.test.ts`

**Interfaces:**
- Produces:
  - `lib/scheduleUtils.ts`: `parseVenueRoom(locationStr)`, `getDayEyebrow(dayStr)`, `getPrecedingVenue(currentEvent, savedEvents)`, `checkEventConflict(eventId, conflicts)`, `filterEvents(events, options)`, `groupEventsBySlot(events, timeFormat)`, `calculateDailyWalkMinutes(events)`
  - `lib/squadUtils.ts`: `calculateMutualOverlap(userEventIds, friendEvents)`, `cleanUrlParam(paramName)`, `isSelfInvite(username, inviteCode)`

- [x] **Step 1: Write failing unit tests for schedule domain utilities**

Create `tests/schedule-logic.test.ts`:
```ts
import { expect, test } from "vitest";
import {
  parseVenueRoom,
  getDayEyebrow,
  getPrecedingVenue,
  checkEventConflict,
  calculateDailyWalkMinutes,
} from "../lib/scheduleUtils.ts";

test("parseVenueRoom parses hotel and room correctly", () => {
  expect(parseVenueRoom("Hyatt Regency - Centennial I")).toEqual({
    venue: "Hyatt Regency",
    room: "Centennial I",
  });
  expect(parseVenueRoom("Marriott Marquis: Atrium Ballroom")).toEqual({
    venue: "Marriott Marquis",
    room: "Atrium Ballroom",
  });
  expect(parseVenueRoom(null)).toEqual({ venue: "VENUE TBD" });
});

test("getDayEyebrow returns correct day subtitle", () => {
  expect(getDayEyebrow("Friday, Sep 4")).toBe("FRIDAY · DAY 2");
  expect(getDayEyebrow("Saturday, Sep 5")).toBe("SATURDAY · DAY 3");
  expect(getDayEyebrow("")).toBe("DRAGON CON '26 · ATLANTA GA");
});

test("getPrecedingVenue finds the last saved event earlier on the same day", () => {
  const current = { id: "2", day: "Fri", startsAt: "2026-09-04T15:00:00Z", location: "Hilton" } as any;
  const saved = [
    { id: "1", day: "Fri", startsAt: "2026-09-04T13:00:00Z", location: "Hyatt" },
    { id: "3", day: "Sat", startsAt: "2026-09-05T10:00:00Z", location: "Marriott" },
  ] as any[];
  expect(getPrecedingVenue(current, saved)).toBe("Hyatt");
});

test("checkEventConflict returns true when event ID matches conflict record", () => {
  const conflicts = [{ event1Id: "ev-1", event2Id: "ev-2", title1: "A", title2: "B" }];
  expect(checkEventConflict("ev-1", conflicts)).toBe(true);
  expect(checkEventConflict("ev-2", conflicts)).toBe(true);
  expect(checkEventConflict("ev-3", conflicts)).toBe(false);
});

test("calculateDailyWalkMinutes sums consecutive venue walk times", () => {
  const events = [
    { id: "1", location: "Hyatt Regency" },
    { id: "2", location: "Marriott Marquis" },
    { id: "3", location: "Hilton Atlanta" },
  ] as any[];
  expect(calculateDailyWalkMinutes(events)).toBe(9); // Hyatt->Marriott (4) + Marriott->Hilton (5)
});
```

- [x] **Step 2: Write failing unit tests for squad domain utilities**

Create `tests/squad-logic.test.ts`:
```ts
import { expect, test } from "vitest";
import { calculateMutualOverlap, isSelfInvite } from "../lib/squadUtils.ts";

test("calculateMutualOverlap filters friend events matching user saved event IDs", () => {
  const userSavedMap = { "ev-1": "going" as const, "ev-2": "interested" as const };
  const friendEvents = [
    { id: "ev-1", title: "Cosplay Contest" },
    { id: "ev-3", title: "Anime Screening" },
  ] as any[];

  const overlap = calculateMutualOverlap(userSavedMap, friendEvents);
  expect(overlap.length).toBe(1);
  expect(overlap[0].id).toBe("ev-1");
});

test("isSelfInvite identifies when invite username matches current user", () => {
  expect(isSelfInvite("CyberKnight", "cyberknight")).toBe(true);
  expect(isSelfInvite("CyberKnight", "differentUser")).toBe(false);
  expect(isSelfInvite(null, "someUser")).toBe(false);
});
```

- [x] **Step 3: Run tests to verify failures**

Run: `pnpm vitest run tests/schedule-logic.test.ts tests/squad-logic.test.ts`
Expected: FAIL (modules not found)

- [x] **Step 4: Implement `lib/scheduleUtils.ts` and `lib/squadUtils.ts`**

Create `lib/scheduleUtils.ts`:
```ts
import type { EventItem, Conflict } from "../components/home/homeTypes.ts";
import { calculateWalkTime } from "./walktime.ts";

export function parseVenueRoom(locationStr: string | null | undefined): {
  venue: string;
  room?: string;
} {
  if (!locationStr) return { venue: "VENUE TBD" };
  const parts = locationStr.split(/ - | – | — |: /);
  if (parts.length > 1) {
    return {
      venue: parts[0].trim(),
      room: parts.slice(1).join(" ").trim(),
    };
  }
  return { venue: locationStr.trim() };
}

export function getDayEyebrow(dayStr: string): string {
  if (!dayStr) return "DRAGON CON '26 · ATLANTA GA";
  const upper = dayStr.toUpperCase();
  if (upper.includes("THU") || upper.includes("SEP 3")) return "THURSDAY · DAY 1";
  if (upper.includes("FRI") || upper.includes("SEP 4")) return "FRIDAY · DAY 2";
  if (upper.includes("SAT") || upper.includes("SEP 5")) return "SATURDAY · DAY 3";
  if (upper.includes("SUN") || upper.includes("SEP 6")) return "SUNDAY · DAY 4";
  if (upper.includes("MON") || upper.includes("SEP 7")) return "MONDAY · DAY 5";
  return dayStr.toUpperCase();
}

export function getPrecedingVenue(
  currentEvent: EventItem,
  savedEvents: EventItem[],
): string | null {
  const daySaved = savedEvents
    .filter((ev) => ev.day === currentEvent.day)
    .sort((a, b) => (a.startsAt || "").localeCompare(b.startsAt || ""));

  const idx = daySaved.findIndex((ev) => ev.id === currentEvent.id);
  if (idx > 0) {
    return daySaved[idx - 1].location;
  }
  if (idx === -1 && daySaved.length > 0 && currentEvent.startsAt) {
    const prior = daySaved.filter((ev) => (ev.startsAt || "") < (currentEvent.startsAt || ""));
    if (prior.length > 0) {
      return prior[prior.length - 1].location;
    }
  }
  return null;
}

export function checkEventConflict(eventId: string, conflicts: Conflict[]): boolean {
  return conflicts.some((c) => c.event1Id === eventId || c.event2Id === eventId);
}

export function calculateDailyWalkMinutes(events: EventItem[]): number {
  let total = 0;
  for (let i = 1; i < events.length; i++) {
    const prev = events[i - 1];
    const curr = events[i];
    const walk = calculateWalkTime(prev.location, curr.location);
    total += walk.minutes;
  }
  return total;
}
```

Create `lib/squadUtils.ts`:
```ts
import type { EventItem } from "../components/home/homeTypes.ts";

export function calculateMutualOverlap(
  userStatusMap: Record<string, "going" | "interested">,
  friendEvents: EventItem[],
): EventItem[] {
  return friendEvents.filter((ev) => !!userStatusMap[ev.id]);
}

export function isSelfInvite(
  currentUsername: string | null | undefined,
  inviteCode: string | null | undefined,
): boolean {
  if (!currentUsername || !inviteCode) return false;
  return currentUsername.trim().toLowerCase() === inviteCode.trim().toLowerCase();
}

export function cleanUrlParam(paramName: string): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete(paramName);
  window.history.replaceState({}, "", url.pathname + url.search + url.hash);
}
```

- [x] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run tests/schedule-logic.test.ts tests/squad-logic.test.ts`
Expected: PASS

- [x] **Step 6: Commit**

```bash
git add lib/scheduleUtils.ts lib/squadUtils.ts tests/schedule-logic.test.ts tests/squad-logic.test.ts
git commit -m "feat(domain): extract schedule and squad pure domain utilities with unit tests"
```

---

### Task 2: Define Shared Types & Extract Modals/Toast Components

**Files:**
- Create: `components/home/homeTypes.ts`
- Create: `components/home/modals/ToastNotification.tsx`
- Create: `components/home/modals/AuthModal.tsx`
- Create: `components/home/modals/ScheduleFilterSheet.tsx`

**Interfaces:**
- Produces:
  - `homeTypes.ts`: `User`, `EventItem`, `UserEventItem`, `Conflict`, `EventChange`, `ToastState`, `TRACK_COLORS`
  - `ToastNotification.tsx`: `<ToastNotification toast={toast} onDismiss={onDismiss} />`
  - `AuthModal.tsx`: `<AuthModal isOpen={isOpen} onClose={onClose} ... />`
  - `ScheduleFilterSheet.tsx`: `<ScheduleFilterSheet isOpen={isOpen} onClose={onClose} ... />`

- [x] **Step 1: Create `components/home/homeTypes.ts`**

Extract standard interfaces from `pages/index.tsx`:
```ts
export interface User {
  id: string;
  username: string;
  name: string;
  role?: string;
  shareSchedule?: number;
}

export interface EventItem {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  track: string | null;
  startsAt: string | null;
  endsAt: string | null;
  durationMinutes: number | null;
  day: string | null;
  timeString: string | null;
  speakers: string | null;
  contentHash: string;
  status?: "live" | "soon" | "done" | "upcoming";
}

export interface UserEventItem {
  id: string;
  userId: string;
  eventId: string;
  status: "going" | "interested";
  notes: string | null;
  addedAt: string;
  event?: EventItem | null;
}

export interface Conflict {
  event1Id: string;
  event2Id: string;
  title1: string;
  title2: string;
}

export interface EventChange {
  id: number;
  eventId: string;
  eventTitle: string;
  changeType: string;
  diffDetails: string | null;
  detectedAt: string;
}

export interface ToastState {
  message: string;
  type: "ok" | "warn";
  actionLabel?: string;
  onAction?: () => void;
}

export const TRACK_COLORS: Record<string, string> = {
  "MAIN PROGRAMMING": "var(--purple-400)",
  COSPLAY: "var(--gold-500)",
  "SCI-FI LIT": "var(--cyan-500)",
  "FANTASY LITERATURE": "var(--cyan-500)",
  LITERATURE: "var(--cyan-500)",
  GAMING: "var(--jade-500)",
  "VIDEO GAMING": "var(--jade-500)",
  "ANIME & MANGA": "var(--coral-500)",
  ANIMATION: "var(--coral-500)",
  "SCIENCE & SPACE": "var(--grey-300)",
  SCIENCE: "var(--grey-300)",
  "ROBOTICS & MAKERS": "var(--gold-400)",
  "PUPPETRY TRACK": "var(--purple-300)",
  HORROR: "var(--coral-600)",
  WORKSHOPS: "var(--gold-500)",
  COSTUMING: "var(--gold-500)",
};
```

- [x] **Step 2: Create `components/home/modals/ToastNotification.tsx`**

```tsx
import type { JSX } from "react";
import type { ToastState } from "../homeTypes.ts";

export interface ToastNotificationProps {
  toast: ToastState | null;
}

export function ToastNotification({ toast }: ToastNotificationProps): JSX.Element | null {
  if (!toast) return null;

  return (
    <div className="cd-toast-container">
      <div className={`cd-toast ${toast.type === "warn" ? "warn" : "ok"}`}>
        <span>{toast.message}</span>
        {toast.actionLabel && toast.onAction && (
          <button
            type="button"
            onClick={toast.onAction}
            className="cd-btn cd-btn-ghost"
            style={{
              padding: "2px 8px",
              marginLeft: 8,
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.3)",
              color: "#fff",
            }}
          >
            {toast.actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
```

- [x] **Step 3: Create `components/home/modals/AuthModal.tsx` & `components/home/modals/ScheduleFilterSheet.tsx`**

Extract JSX sheets from `pages/index.tsx:2369-2615`.

- [x] **Step 4: Run typecheck / build to verify components compile**

Run: `pnpm build`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add components/home/homeTypes.ts components/home/modals/
git commit -m "feat(ui): extract home modal sheets and toast notification component"
```

---

### Task 3: Extract Custom Hooks

**Files:**
- Create: `components/home/hooks/useHomeAuth.ts`
- Create: `components/home/hooks/useScheduleFilters.ts`
- Create: `components/home/hooks/useAgenda.ts`
- Create: `components/home/hooks/useSquad.ts`
- Create: `components/home/hooks/useAppSyncAndPrefs.ts`

**Interfaces:**
- Produces:
  - `useHomeAuth`: Returns auth state, passkey handlers, login/register modal state, session tokens.
  - `useScheduleFilters`: Returns day strip selection, search query, track exclusion list, location filters, `filteredEvents`, and `groupedSlots`.
  - `useAgenda`: Returns `agendaItems`, `agendaConflicts`, `totalWalkTimeMinutes`, `handleToggleEvent`, and optimistic mutation executor.
  - `useSquad`: Returns `friendsList`, friend comparison, invite accept/dismiss, and squad privacy toggle.
  - `useAppSyncAndPrefs`: Returns update sync status, diff list, PWA installation, and con preferences.

- [x] **Step 1: Implement `useHomeAuth.ts`**
- [x] **Step 2: Implement `useScheduleFilters.ts`**
- [x] **Step 3: Implement `useAgenda.ts`**
- [x] **Step 4: Implement `useSquad.ts`**
- [x] **Step 5: Implement `useAppSyncAndPrefs.ts`**
- [x] **Step 6: Run tests and typecheck**

Run: `pnpm test && pnpm build`
Expected: PASS

- [x] **Step 7: Commit**

```bash
git add components/home/hooks/
git commit -m "feat(hooks): extract custom hooks for auth, filters, agenda, squad, and app prefs"
```

---

### Task 4: Extract Tab Components

**Files:**
- Create: `components/home/tabs/ScheduleTab.tsx`
- Create: `components/home/tabs/AgendaTab.tsx`
- Create: `components/home/tabs/SquadTab.tsx`
- Create: `components/home/tabs/ChangesTab.tsx`
- Create: `components/home/tabs/ProfileTab.tsx`

**Interfaces:**
- Produces:
  - `<ScheduleTab />`: Renders TimeRail, search bar, DayStrip, event list.
  - `<AgendaTab />`: Renders stamina load meter, conflict alert banner, saved cards, and ICS export.
  - `<SquadTab />`: Renders friend cards, invite link sharing, and schedule overlap comparison.
  - `<ChangesTab />`: Renders chronological schedule diff feed.
  - `<ProfileTab />`: Renders user profile, Passkey manager, preferences switches, and feedback trigger.

- [x] **Step 1: Implement `ScheduleTab.tsx`**
- [x] **Step 2: Implement `AgendaTab.tsx`**
- [x] **Step 3: Implement `SquadTab.tsx`**
- [x] **Step 4: Implement `ChangesTab.tsx`**
- [x] **Step 5: Implement `ProfileTab.tsx`**
- [x] **Step 6: Run build and tests**

Run: `pnpm test && pnpm build`
Expected: PASS

- [x] **Step 7: Commit**

```bash
git add components/home/tabs/
git commit -m "feat(ui): extract individual tab components for schedule, agenda, squad, changes, and profile"
```

---

### Task 5: Refactor `pages/index.tsx` into Coordinator & Update PWA Cache

**Files:**
- Modify: `pages/index.tsx`
- Modify: `public/sw.js`
- Modify: `docs/log.md`

- [x] **Step 1: Simplify `pages/index.tsx` into a ~120-line coordinator calling the extracted hooks and tabs**
- [x] **Step 2: Bump PWA cache version in `public/sw.js` (`dragoncon-pwa-v23` $\to$ `dragoncon-pwa-v24`)**
- [x] **Step 3: Run full test suite and build verification**
Expected: All 140+ unit tests pass, zero TypeScript/LSP errors, clean SSR and client bundles.

- [x] **Step 4: Update session log in `docs/log.md`**
- [x] **Step 5: Commit**

```bash
git add pages/index.tsx public/sw.js docs/log.md
git commit -m "refactor(home): streamline index page coordinator into modular hooks and tabs"
```
