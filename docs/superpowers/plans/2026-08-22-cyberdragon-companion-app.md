# CyberDragon Companion App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the complete CyberDragon Companion App experience including the Atlanta con-floor walk time calculation matrix, mobile bottom TabBar navigation, Toast engine with Undo support, Panel Detail modal, Advanced Filter Sheet, Schedule Load dashboard, and Profile screen with digital badge card & passkey/password auth flows.

**Architecture:** Split functionality into modular design components (`lib/walktime.ts`, `components/CyberDragonUi.tsx`, `components/PanelDetailModal.tsx`), update `public/cyberdragon.css` with responsive CyberDragon design tokens, and integrate all tabs and sheets into `pages/index.tsx`.

**Tech Stack:** React 19, TypeScript, CyberDragon Design System (CSS variables, Space Grotesk + JetBrains Mono), Void Framework / Cloudflare Workers, `@simplewebauthn/browser`.

**Spec:** `docs/superpowers/specs/2026-08-22-cyberdragon-companion-app-design.md`

## Global Constraints

- Avoid `: any` or `as any` in TypeScript.
- Follow CyberDragon color tokens (`--canvas` `#0C0E11`, `--purple-600` `#5B21B6`, `--gold-500` `#E8B93A`, `--coral-500` `#E5484D`).
- Typography: Space Grotesk (`var(--font-core)`) for headings/body, JetBrains Mono (`var(--font-mono)`) for tabular times/data.
- All tasks must pass `pnpm build`.

---

### Task 1: Atlanta Dragon Con Hotel Walk Time Engine (`lib/walktime.ts`)

**Files:**
- Create: `lib/walktime.ts`
- Test: `tests/walktime.test.ts`

**Interfaces:**
- Produces:
  - `export function calculateWalkTime(venueA: string | null | undefined, venueB: string | null | undefined): { minutes: number; path: string }`
  - `export function getVenueCapacityStatus(timeString: string | null, venue: string | null): { pct: number; status: string; accent: string }`

- [ ] **Step 1: Write failing unit test for walk time calculations**

Write `tests/walktime.test.ts`:
```ts
import { test, expect } from "bun:test";
import { calculateWalkTime, getVenueCapacityStatus } from "../lib/walktime";

test("calculateWalkTime between Hyatt and Marriott", () => {
  const result = calculateWalkTime("Hyatt Regency Atlanta - Centennial I", "Marriott Marquis - Atrium Ballroom");
  expect(result.minutes).toBe(4);
  expect(result.path).toBe("Hyatt → Marriott");
});

test("calculateWalkTime same venue returns 0", () => {
  const result = calculateWalkTime("Hyatt Regency - Imperial", "Hyatt Regency - Centennial II");
  expect(result.minutes).toBe(0);
  expect(result.path).toBe("Same venue");
});

test("calculateWalkTime unknown venue defaults to 8", () => {
  const result = calculateWalkTime("Unknown Hotel", "Westin");
  expect(result.minutes).toBe(8);
});

test("getVenueCapacityStatus returns heuristic capacity", () => {
  const res = getVenueCapacityStatus("02:30 PM", "Marriott Marquis");
  expect(res.pct).toBeGreaterThan(0);
  expect(typeof res.status).toBe("string");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test` or `bun test tests/walktime.test.ts`
Expected: FAIL ("Cannot find module ../lib/walktime")

- [ ] **Step 3: Implement `lib/walktime.ts`**

Create `lib/walktime.ts`:
```ts
// Dragon Con Atlanta Core Venues & Walk Time Matrix (in minutes)

export const CORE_VENUES = [
  "HYATT",
  "MARRIOTT",
  "HILTON",
  "SHERATON",
  "WESTIN",
  "AMERICASMART",
] as const;

export type CoreVenue = typeof CORE_VENUES[number];

const WALK_MATRIX: Record<CoreVenue, Record<CoreVenue, { minutes: number; path: string }>> = {
  HYATT: {
    HYATT: { minutes: 0, path: "Same venue" },
    MARRIOTT: { minutes: 4, path: "Hyatt → Marriott" },
    HILTON: { minutes: 7, path: "Hyatt → Hilton" },
    SHERATON: { minutes: 10, path: "Hyatt → Courtland" },
    WESTIN: { minutes: 12, path: "Hyatt → Westin" },
    AMERICASMART: { minutes: 8, path: "Hyatt → AmericasMart" },
  },
  MARRIOTT: {
    HYATT: { minutes: 4, path: "Marriott → Hyatt" },
    MARRIOTT: { minutes: 0, path: "Same venue" },
    HILTON: { minutes: 5, path: "Marriott → Hilton" },
    SHERATON: { minutes: 8, path: "Marriott → Courtland" },
    WESTIN: { minutes: 11, path: "Marriott → Westin" },
    AMERICASMART: { minutes: 10, path: "Marriott → AmericasMart" },
  },
  HILTON: {
    HYATT: { minutes: 7, path: "Hilton → Hyatt" },
    MARRIOTT: { minutes: 5, path: "Hilton → Marriott" },
    HILTON: { minutes: 0, path: "Same venue" },
    SHERATON: { minutes: 6, path: "Hilton → Courtland" },
    WESTIN: { minutes: 14, path: "Hilton → Westin" },
    AMERICASMART: { minutes: 12, path: "Hilton → AmericasMart" },
  },
  SHERATON: {
    HYATT: { minutes: 10, path: "Courtland → Hyatt" },
    MARRIOTT: { minutes: 8, path: "Courtland → Marriott" },
    HILTON: { minutes: 6, path: "Courtland → Hilton" },
    SHERATON: { minutes: 0, path: "Same venue" },
    WESTIN: { minutes: 15, path: "Courtland → Westin" },
    AMERICASMART: { minutes: 14, path: "Courtland → AmericasMart" },
  },
  WESTIN: {
    HYATT: { minutes: 12, path: "Westin → Hyatt" },
    MARRIOTT: { minutes: 11, path: "Westin → Marriott" },
    HILTON: { minutes: 14, path: "Westin → Hilton" },
    SHERATON: { minutes: 15, path: "Westin → Courtland" },
    WESTIN: { minutes: 0, path: "Same venue" },
    AMERICASMART: { minutes: 6, path: "Westin → AmericasMart" },
  },
  AMERICASMART: {
    HYATT: { minutes: 8, path: "AmericasMart → Hyatt" },
    MARRIOTT: { minutes: 10, path: "AmericasMart → Marriott" },
    HILTON: { minutes: 12, path: "AmericasMart → Hilton" },
    SHERATON: { minutes: 14, path: "AmericasMart → Courtland" },
    WESTIN: { minutes: 6, path: "AmericasMart → Westin" },
    AMERICASMART: { minutes: 0, path: "Same venue" },
  },
};

export function normalizeVenue(venueStr: string | null | undefined): CoreVenue | null {
  if (!venueStr) return null;
  const upper = venueStr.toUpperCase();
  if (upper.includes("HYATT")) return "HYATT";
  if (upper.includes("MARRIOTT")) return "MARRIOTT";
  if (upper.includes("HILTON")) return "HILTON";
  if (upper.includes("SHERATON") || upper.includes("COURTLAND")) return "SHERATON";
  if (upper.includes("WESTIN")) return "WESTIN";
  if (upper.includes("MART") || upper.includes("AMERICA")) return "AMERICASMART";
  return null;
}

export function calculateWalkTime(
  venueA: string | null | undefined,
  venueB: string | null | undefined,
): { minutes: number; path: string } {
  const normA = normalizeVenue(venueA);
  const normB = normalizeVenue(venueB);

  if (!normA || !normB) {
    return { minutes: 8, path: "Con Floor Walk" };
  }

  return WALK_MATRIX[normA][normB];
}

export function getVenueCapacityStatus(
  timeString: string | null,
  venue: string | null,
): { pct: number; status: string; accent: string } {
  // Deterministic capacity heuristic derived from venue & title strings
  let hash = 0;
  const seed = (timeString || "") + (venue || "");
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const pct = 45 + (Math.abs(hash) % 50); // 45% - 94%

  if (pct > 85) {
    return { pct, status: "Line forming at door", accent: "var(--coral-500)" };
  } else if (pct > 70) {
    return { pct, status: "Filling up", accent: "var(--gold-500)" };
  } else {
    return { pct, status: "Seating available", accent: "var(--jade-500)" };
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `bun test tests/walktime.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/walktime.ts tests/walktime.test.ts
git commit -m "feat: add Atlanta Dragon Con hotel walk time matrix and capacity heuristics"
```

---

### Task 2: CyberDragon CSS Styles & Mobile Components (`public/cyberdragon.css`)

**Files:**
- Modify: `public/cyberdragon.css`

**Interfaces:**
- Produces CSS classes: `.cd-tabbar`, `.cd-tabbar-item`, `.cd-toast`, `.cd-progress-meter`, `.cd-datacard`, `.cd-switch`, `.cd-select`, `.cd-sheet`.

- [ ] **Step 1: Add CSS definitions to `public/cyberdragon.css`**

Add at the end of `public/cyberdragon.css`:
```css
/* ===== Mobile Bottom TabBar ===== */
.cd-tabbar {
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 64px;
  background-color: var(--surface-glass-strong);
  backdrop-filter: var(--blur-bar);
  -webkit-backdrop-filter: var(--blur-bar);
  border-top: 1px solid var(--line-hairline);
  z-index: 200;
  box-shadow: var(--inner-lip);
}

@media (max-width: 768px) {
  .cd-tabbar {
    display: flex;
    align-items: center;
    justify-content: space-around;
  }
}

.cd-tabbar-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font: var(--type-micro);
  cursor: pointer;
  gap: 3px;
  position: relative;
  transition: color var(--t-control);
}

.cd-tabbar-item.active {
  color: var(--gold-500);
}

/* ===== Toast Notification Engine ===== */
.cd-toast-container {
  position: fixed;
  left: var(--gutter);
  right: var(--gutter);
  bottom: 76px;
  z-index: 300;
  display: flex;
  justify-content: center;
  pointer-events: none;
}

@media (min-width: 769px) {
  .cd-toast-container {
    bottom: 24px;
    max-width: 480px;
    margin: 0 auto;
  }
}

.cd-toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  border-radius: var(--r-panel);
  background: var(--surface-glass-strong);
  backdrop-filter: var(--blur-toast);
  border: 1px solid var(--line-purple);
  box-shadow: var(--shadow-toast);
  color: var(--text-primary);
  font: var(--type-body-sm);
  width: 100%;
  animation: cd-slide-up 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

.cd-toast.warn {
  border-color: var(--coral-500);
  background: rgba(42, 18, 21, 0.92);
}

/* ===== Progress Meter ===== */
.cd-progress-meter {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cd-progress-track {
  display: flex;
  gap: 4px;
  height: 8px;
  width: 100%;
}

.cd-progress-tick {
  flex: 1;
  height: 100%;
  border-radius: 2px;
  background: var(--surface-3);
  transition: background var(--t-control);
}

.cd-progress-tick.active {
  background: var(--grad-brand);
}

.cd-progress-tick.warn {
  background: var(--coral-500);
}

/* ===== DataCard Metric Block ===== */
.cd-datacard {
  padding: 12px 14px;
  background: var(--surface-glass);
  border-radius: var(--r-panel);
  border: 1px solid var(--line-hairline);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cd-datacard-value {
  font: var(--fw-bold) 22px/1 var(--font-core);
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}

/* ===== Switch Control ===== */
.cd-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
}

.cd-switch {
  width: 44px;
  height: 24px;
  border-radius: 12px;
  background: var(--surface-3);
  border: 1px solid var(--line-subtle);
  position: relative;
  cursor: pointer;
  transition: background var(--t-control);
}

.cd-switch.checked {
  background: var(--purple-600);
  border-color: var(--purple-400);
}

.cd-switch-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  position: absolute;
  top: 2px;
  left: 2px;
  transition: transform var(--t-control);
}

.cd-switch.checked .cd-switch-thumb {
  transform: translateX(20px);
}
```

- [ ] **Step 2: Verify `pnpm build`**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add public/cyberdragon.css
git commit -m "style: add mobile TabBar, Toast, ProgressMeter, and Switch styles to cyberdragon.css"
```

---

### Task 3: Panel Detail Modal Component (`components/PanelDetailModal.tsx`)

**Files:**
- Create: `components/PanelDetailModal.tsx`

**Interfaces:**
- Consumes: `calculateWalkTime`, `getVenueCapacityStatus` from `lib/walktime.ts`
- Produces: `export function PanelDetailModal(props: PanelDetailModalProps)`

- [ ] **Step 1: Create `components/PanelDetailModal.tsx`**

```tsx
import type { EventItem } from "../pages/index";
import { calculateWalkTime, getVenueCapacityStatus } from "../lib/walktime";

export interface PanelDetailModalProps {
  item: EventItem;
  previousVenue?: string | null;
  saved: boolean;
  onToggleSave: () => void;
  onClose: () => void;
}

export function PanelDetailModal({
  item,
  previousVenue,
  saved,
  onToggleSave,
  onClose,
}: PanelDetailModalProps) {
  const walkInfo = calculateWalkTime(previousVenue, item.location);
  const capInfo = getVenueCapacityStatus(item.timeString, item.location);

  // Parse speakers into panelist avatars
  const panelists = item.speakers
    ? item.speakers.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "var(--blur-scrim)",
        backdropFilter: "var(--blur-scrim)",
        WebkitBackdropFilter: "var(--blur-scrim)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        className="cd-glass-panel cd-notch cd-scroll"
        style={{
          width: "100%",
          maxWidth: 600,
          maxHeight: "88vh",
          overflowY: "auto",
          padding: 24,
          boxShadow: "var(--shadow-sheet)",
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <span className="cd-badge cd-badge-purple" style={{ marginBottom: 6, display: "inline-block" }}>
              {item.track || "FAN TRACK"}
            </span>
            <h2 style={{ margin: "4px 0", font: "var(--type-title)", color: "var(--text-primary)" }}>
              {item.title}
            </h2>
            <div className="cd-data" style={{ color: "var(--gold-400)", fontSize: 13 }}>
              📍 {item.location || "VENUE TBD"} • 🕒 {item.timeString || "TIME TBD"}
            </div>
          </div>
          <button onClick={onClose} className="cd-btn cd-btn-ghost" style={{ padding: "4px 10px", fontSize: 16 }}>
            ✕
          </button>
        </div>

        {/* Metrics Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margin: "16px 0" }}>
          <div className="cd-datacard">
            <div className="cd-label">WALK FROM LAST</div>
            <div className="cd-datacard-value" style={{ color: "var(--gold-500)" }}>
              {walkInfo.minutes} <span style={{ fontSize: 12 }}>MIN</span>
            </div>
            <div className="cd-data" style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
              {walkInfo.path}
            </div>
          </div>

          <div className="cd-datacard">
            <div className="cd-label">ESTIMATED CAPACITY</div>
            <div className="cd-datacard-value" style={{ color: capInfo.accent }}>
              {capInfo.pct}%
            </div>
            <div className="cd-data" style={{ fontSize: 11, color: capInfo.accent }}>
              {capInfo.status}
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="cd-glass-panel" style={{ marginBottom: 16 }}>
          <div className="cd-label" style={{ marginBottom: 6 }}>ABOUT THIS PANEL</div>
          <p style={{ margin: 0, font: "var(--type-body)", color: "var(--text-secondary)", lineHeight: "1.5" }}>
            {item.description || "Official description not yet published by programming."}
          </p>
        </div>

        {/* Panelists */}
        {panelists.length > 0 && (
          <div className="cd-glass-panel" style={{ marginBottom: 16, padding: "12px 16px" }}>
            <div className="cd-label" style={{ marginBottom: 10 }}>PANELISTS & GUESTS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {panelists.map((guest, idx) => {
                const surname = guest.split(" ").pop() || "G";
                const initials = surname.slice(0, 2).toUpperCase();
                return (
                  <div key={guest} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 32,
                        height: 32,
                        font: "var(--type-label)",
                        color: "var(--purple-200)",
                        backgroundColor: "var(--accent-quiet)",
                        border: "1px solid var(--line-purple)",
                        borderRadius: "var(--r-control)",
                      }}
                    >
                      {initials}
                    </span>
                    <span style={{ flex: 1, font: "var(--type-body)", color: "var(--text-primary)" }}>
                      {guest}
                    </span>
                    <span className="cd-badge" style={{ background: "var(--surface-3)", color: "var(--text-tertiary)", fontSize: 10 }}>
                      {idx === 0 ? "MODERATOR" : "PANELIST"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button
            onClick={() => {
              const query = encodeURIComponent(`${item.title} ${item.location || ""}`);
              window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
            }}
            className="cd-btn cd-btn-ghost"
            style={{ flex: 1, padding: 12 }}
          >
            🗺️ ROUTE MAP
          </button>

          <button
            onClick={onToggleSave}
            className="cd-btn cd-btn-primary"
            style={{
              flex: 2,
              padding: 12,
              background: saved ? "var(--purple-600)" : "var(--grad-brand)",
              borderColor: saved ? "var(--purple-400)" : "none",
            }}
          >
            {saved ? "✓ ON MY SCHEDULE" : "+ ADD TO SCHEDULE"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add components/PanelDetailModal.tsx
git commit -m "feat: add PanelDetailModal component with walk time matrix & guest list"
```

---

### Task 4: Refactor PWA Shell & Profile Screen (`pages/index.tsx`)

**Files:**
- Modify: `pages/index.tsx`

**Interfaces:**
- Integrates `PanelDetailModal`, mobile `TabBar`, `Toast` notifications, `FilterSheet`, `ScheduleLoadDashboard`, and `ProfileScreen`.

- [ ] **Step 1: Update `pages/index.tsx` with all CyberDragon Companion features**

Update `pages/index.tsx` to include:
1. `toast` state object `{ message: string; type: 'ok' | 'warn'; onUndo?: () => void } | null` with 3200ms auto-dismiss timer.
2. `activeDetailItem` state to trigger `PanelDetailModal`.
3. `FilterSheet` drawer toggle with Track selection tags & Walkability switches.
4. `ScheduleLoadDashboard` on the My Agenda tab calculating:
   - Daily slot count progress meter (`savedCount / 8`).
   - Total walk time sum derived from `calculateWalkTime()`.
5. `ProfileScreen` when the `profile` tab is selected:
   - Logged-out state displaying Passkey and Password login forms.
   - Logged-in state displaying Digital Con Badge (`BADGE DC-40-XXXXXX`), `🔑 + Add Passkey` trigger, Con Preferences (Home Venue baseline, 12h/24h format), and Sign Out button.
6. Mobile `TabBar` fixed at screen bottom with `📅 Schedule`, `⭐ Mine`, `👥 Squad`, and `👤 Profile`.

- [ ] **Step 2: Run `pnpm build` to verify compilation**

Run: `pnpm build`
Expected: PASS (builds `void_worker` SSR and client bundles).

- [ ] **Step 3: Run dev server smoke check**

Run: `curl -s http://localhost:5173/ | grep -E "cd-tabbar" | head -n 5`
Expected: Output showing rendered `.cd-tabbar` HTML markup.

- [ ] **Step 4: Commit**

```bash
git add pages/index.tsx
git commit -m "feat: integrate CyberDragon Companion App shell with TabBar, Toast, FilterSheet, and Profile auth"
```

---

### Task 5: Verification & End-to-End Build Check

**Files:**
- Check: Workspace state

- [ ] **Step 1: Run complete build suite**

Run: `pnpm build`
Expected: PASS with zero errors.

- [ ] **Step 2: Run walktime tests**

Run: `bun test tests/walktime.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit final plan verification**

```bash
git status
```
Expected: Clean working tree.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-22-cyberdragon-companion-app.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?