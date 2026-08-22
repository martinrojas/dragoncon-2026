# CyberDragon Companion App — Design Specification

**Date:** 2026-08-22  
**Status:** Approved  
**Author:** CyberDragon Engineering Team  
**Target:** Dragon Con 2026 Mobile PWA (`pages/index.tsx`, `public/cyberdragon.css`, `lib/walktime.ts`)

---

## 1. Overview & Objectives

Bring the full offline design experience from `reference/CyberDragon Companion App (offline).html` into the production Dragon Con 2026 PWA. This specification outlines four core subsystem enhancements:
1. Mobile-first **Bottom TabBar** & **Toast Notification Engine** with `Undo` support.
2. **Panel Detail View** with Atlanta con-floor walk time calculation, room line capacity heuristics, and panelist avatar grids.
3. **Advanced Filter Sheet** & **Schedule Load Dashboard** featuring daily slot load meters and total walk time counters.
4. **Profile & Con Preferences Screen** featuring a digital con badge card, home venue baseline settings, time format preferences, and offline cache status.

---

## 2. Subsystems & Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          CYBERDRAGON PWA APP SHELL                       │
│  Top Bar (Desktop > 768px)  /  Fixed TabBar (Mobile <= 768px: Sched,     │
│                              Mine, Squad, Profile)                       │
└──────────────────────────────────────────────────────────────────────────┘
       │                           │                     │
       ▼                           ▼                     ▼
┌─────────────────┐       ┌───────────────────┐   ┌──────────────────────┐
│  SCHEDULE GRID  │       │    MY SCHEDULE    │   │  PROFILE & SETTINGS  │
├─────────────────┤       ├───────────────────┤   ├──────────────────────┤
│ • TimeRail      │       │ • ProgressMeter   │   │ • Digital Con Badge  │
│ • FilterSheet   │       │   (Slot Load)     │   │ • Home Venue Baseline│
│ • DetailModal   │       │ • Total Walk Time │   │ • Time Format Select │
└─────────────────┘       │ • Conflict Banner │   │ • Offline Cache Sync │
                          └───────────────────┘   └──────────────────────┘
```

---

## 3. Subsystem Specifications

### 3.1 Mobile TabBar & Toast Notification Engine

- **Mobile TabBar (`TabBar`):**
  - Rendered at the bottom of the viewport when screen width is $\le 768\text{px}$.
  - Fixed position (`position: fixed; bottom: 0; left: 0; right: 0; height: 60px`).
  - Tabs: `Schedule` (calendar-clock icon), `Mine` (bookmark icon + saved badge count), `Squad` (users icon), `Profile` (user icon).
  - Background: `var(--surface-glass-strong)` with `backdrop-filter: var(--blur-bar)` and top hairline border.

- **Toast Engine (`Toast`):**
  - Toast banner floating above the bottom bar (`bottom: calc(var(--tabbar-h) + 12px)`).
  - Tones: `ok` (jade border/accent for saved), `warn` (gold/coral border for schedule conflicts).
  - Contains descriptive text (e.g. *"Added — overlaps Worldbuilding panel."*), auto-dismisses after 3200ms, and provides an **Undo** button.

---

### 3.2 Panel Detail View & Con Floor Walk Time Engine

- **Walk Time Engine (`lib/walktime.ts`):**
  - Maintains a distance/walk-time matrix between core Atlanta Dragon Con venues:
    - `Hyatt Regency Atlanta` (265 Peachtree St)
    - `Marriott Marquis Atlanta` (265 Peachtree Center Ave)
    - `Hilton Atlanta` (255 Courtland St NE)
    - `Sheraton Atlanta / Courtland Grand` (165 Courtland St NE)
    - `Westin Peachtree Plaza` (210 Peachtree St NW)
    - `AmericasMart Building 2 & 3` (230 Ted Turner Dr NW)
  - Inter-hotel lookup table (e.g. Hyatt $\leftrightarrow$ Marriott: 4 min skybridge; Marriott $\leftrightarrow$ Hilton: 5 min skybridge; Hyatt $\leftrightarrow$ Westin: 12 min street walk; Hyatt $\leftrightarrow$ AmericasMart: 8 min street walk).
  - Computes `walkMinutes` from the user's previously saved panel end location to the current panel start location.

- **Panel Detail Screen (`PanelDetailModal`):**
  - Eyebrow header with Fan Track tag and track color accent.
  - Title, venue, room, time range, and age suitability tag.
  - `DataCard` metrics:
    - **Walk from last panel:** Estimated minutes + venue connection path (e.g. *8 min · Marriott → Hyatt*).
    - **Room Capacity:** Estimated capacity % + line status (*Line forming*, *At capacity*, *Seating open*).
  - **Panelists:** List of speakers parsed from event description or `speakers` column with initials avatar (`var(--accent-quiet)` background) and role tag (`MODERATOR` vs `PANELIST`).
  - **Conflict Alert Banner:** Inline gold/coral alert if panel overlaps an existing saved agenda item.
  - **Action Footer:** "Route" button (Google Maps / Hotel map trigger) and "Add to Schedule / On my schedule" toggle.

---

### 3.3 Advanced Filter Sheet & Schedule Load Dashboard

- **Advanced Filter Sheet (`FilterSheet`):**
  - Slide-up bottom sheet triggered by the `Filters` button on the Schedule tab header.
  - Multi-select track tags (`Tag` component) with track accent colors.
  - Smart checkboxes:
    - `Hide panels that have ended`
    - `Hide conflicts with my schedule`
    - `Walkable in under 10 minutes from previous panel`
  - Action buttons: `Reset` (clears filter state) and `Show N panels` (applies and closes sheet).

- **Schedule Load Dashboard (`MyScheduleScreen` Header):**
  - Rendered at the top of the **My Schedule** tab.
  - `ProgressMeter`: Slotted bar showing `savedCount / 8 slots` max daily stamina budget.
  - Stat Grid (3 columns):
    - `SAVED`: Number of panels saved for selected day.
    - `CONFLICTS`: Number of active overlapping panel pairs (styled coral if $> 0$).
    - `WALK TOTAL`: Sum of estimated walk time between consecutive saved panels for the day (in minutes).

---

### 3.4 Profile, Con Preferences & Digital Badge Card

- **Profile View (`ProfileScreen`):**
  - **Digital Con Badge:** Glass card featuring user initials avatar (purple-to-gold gradient fill), display name, and formatted badge identifier (e.g., `BADGE DC-40-118824`).
  - **Alert Toggles:**
    - `Panel Reminders`: Enable/disable 15-minute start warnings.
    - `Walk-Time Warnings`: Enable/disable warnings when venue transition is tight ($< 5$ min margin).
    - `Haptic Feedback`: Toggle touch haptics.
  - **Display Preferences:**
    - `Time Format`: Select between `12-hour (2:30 PM)` and `24-hour (14:30)`.
    - `Home Venue`: Baseline hotel (e.g. Hyatt, Marriott, Hilton) used to calculate initial morning walk times.
  - **Offline Cache Status:**
    - Sync progress meter showing offline status ("Synced 4 min ago").
    - `Sync Now` trigger and `Clear My Schedule` safety prompt.

---

## 4. File Changes & Data Flow

| File Path | Action | Description |
|---|---|---|
| `lib/walktime.ts` | **Create** | Atlanta Dragon Con hotel walk-time lookup table and calculation helper. |
| `public/cyberdragon.css` | **Update** | Add CSS rules for `TabBar`, `Toast`, `ProgressMeter`, `DataCard`, `Switch`, `Select`, `FilterSheet`, and mobile responsive styles. |
| `pages/index.tsx` | **Update** | Refactor PWA shell with `TabBar`, `Toast`, `PanelDetailModal`, `FilterSheet`, `ScheduleDashboard`, and `ProfileScreen`. |

---

## 5. Verification Plan

1. **Build & Type Check:** Run `pnpm build` to verify clean TypeScript compilation and asset bundling.
2. **Walk Time Calculation:** Test `calculateWalkTime("Marriott Marquis", "Hyatt Regency")` returns `4` min.
3. **Panel Detail Modal:** Verify clicking any panel opens the detail modal with walk stats, room capacity, panelists, and saved status toggle.
4. **Toast Engine:** Verify starring a panel triggers a toast with `Undo` button that reverts state when clicked.
5. **Mobile Viewport Test:** Verify responsive bottom `TabBar` renders on viewports $\le 768\text{px}$.
