# Squad Invite Links, Event Deep Linking & Detailed Friend Schedule Browser

**Date:** 2026-08-28  
**Status:** Approved  
**Scope:** Client PWA (`pages/index.tsx`, `components/PanelDetailModal.tsx`, `lib/share.ts`), Backend API (`routes/api/friends.ts`, `routes/api/user.ts`), Database Schema (`db/schema.ts`, migrations)

---

## 1. Overview & Goals

This specification adds sharing, deep linking, and collaborative schedule exploration features to CyberDragon for Dragon Con 2026:
1. **Squad Invite Links:** Enables users to share a personalized link (`/?invite=<username>`) via the native Web Share API or clipboard, complete with an in-app confirmation banner and guest onboarding flow.
2. **Event Deep Linking & Sharing:** Enables sharing any panel directly from `PanelDetailModal` with a clean URL (`/?event=<id>`), allowing guests and logged-in users to immediately view details, speakers, and venue maps, and bookmark directly to their schedule.
3. **Detailed Friend Schedule Browser:** Allows squad members to browse a friend's full saved agenda (with mutual match indicators, conflict flags, and quick-add actions), governed by a user privacy toggle (`shareSchedule` enabled by default).

---

## 2. Architecture & Data Model

### 2.1 Database Schema (`db/schema.ts`)
* Add `shareSchedule` integer column to the `users` table:
  ```ts
  export const users = sqliteTable("users", {
    id: text("id").primaryKey(),
    username: text("username").notNull().unique(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    avatarUrl: text("avatar_url"),
    role: text("role").notNull().default("user"),
    shareSchedule: integer("share_schedule").notNull().default(1),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  });
  ```
* Run `pnpm run db:generate` to produce the local migration snapshot and SQL.

### 2.2 Profile & Privacy API
* Add `PATCH /api/user/privacy` or extend user update endpoint to allow toggling `shareSchedule` (0 or 1).
* Request body: `{ userId: string, shareSchedule: boolean }`.
* Response: `{ success: true, shareSchedule: boolean }`.

### 2.3 Extended Friends API (`routes/api/friends.ts`)
* `GET /api/friends?userId=<myId>&friendId=<friendId>`:
  * Fetch friend's profile to inspect `shareSchedule`.
  * If `shareSchedule === 1`:
    * Fetch friend's saved events from `user_events` + `events`.
    * Identify `sharedEventIds` (intersection with caller's saved events).
    * Return:
      ```json
      {
        "success": true,
        "scheduleHidden": false,
        "friend": { "id": "...", "username": "...", "name": "..." },
        "friendEvents": [ ... ],
        "sharedEventIds": [ "ev_1", "ev_2" ]
      }
      ```
  * If `shareSchedule === 0`:
    * Fetch only `sharedEvents` (mutual overlap).
    * Return:
      ```json
      {
        "success": true,
        "scheduleHidden": true,
        "friend": { "id": "...", "username": "...", "name": "..." },
        "friendEvents": [],
        "sharedEvents": [ ... ],
        "sharedEventIds": [ ... ]
      }
      ```

---

## 3. Web Share & Deep Linking Workflows

### 3.1 Share Utility (`lib/share.ts`)
```ts
export interface SharePayload {
  title: string;
  text?: string;
  url: string;
}

export async function shareLink(payload: SharePayload): Promise<{ shared: boolean; copied: boolean }> {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share(payload);
      return { shared: true, copied: false };
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") {
        return { shared: false, copied: false };
      }
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(payload.url);
    return { shared: false, copied: true };
  }

  return { shared: false, copied: false };
}
```

### 3.2 Event Deep Linking (`/?event=<id>`)
1. **Trigger:** Inside `PanelDetailModal.tsx`, add an action button: `📤 SHARE PANEL`.
   * Calls `shareLink({ title: item.title, text: `${item.title} · ${item.day} ${item.timeString}`, url: `${origin}/?event=${item.id}` })`.
   * Shows toast: *"Link copied to clipboard!"* if copied.
2. **Mount Detection:** In `pages/index.tsx`:
   * On initial load, inspect `new URLSearchParams(window.location.search).get("event")`.
   * If present: Look up the event in the schedule or query `/api/events?id=<id>`.
   * Sets `activeDetailItem` to open the `PanelDetailModal`.
   * When modal closes, clean the URL param using `history.replaceState`.

### 3.3 Squad Invite Links (`/?invite=<username>`)
1. **Trigger:** In the **Squad** tab, add a `🔗 INVITE TO SQUAD` button.
   * Calls `shareLink({ title: "Join my CyberDragon Squad", text: `Join @${currentUser.username}'s Dragon Con squad on CyberDragon`, url: `${origin}/?invite=${currentUser.username}` })`.
2. **Mount Detection:**
   * On initial load, inspect `new URLSearchParams(window.location.search).get("invite")`.
   * **If Logged In:**
     * Render a top confirmation banner:
       > **"@username invited you to their Squad!"** `[Add to Squad]` `[Dismiss]`
     * Clicking **"Add to Squad"** fires `POST /api/friends` with `{ userId: currentUser.id, friendUsername: inviteUsername }` and refreshes the squad list.
   * **If Logged Out:**
     * Retain the pending invite in local state.
     * Show welcoming banner above login/register forms:
       > **"@username invited you to their Squad! Log in or create an account to connect."**
     * Upon authentication success, display the confirmation banner.

---

## 4. Squad Detailed Schedule Browser UI

### 4.1 UI Layout in Squad Tab (`pages/index.tsx`)
When a friend card is selected:
1. **Header:** Friend's Avatar, Name, `@username`, and Badge number.
2. **Privacy Banner (if private):** If `scheduleHidden === true`, displays a badge: *"🔒 Schedule is set to private. Showing only mutual saved panels."*
3. **Tab Toggle (if public):**
   * **"All Saved Panels (<count>)"**
   * **"Mutual Overlap (<count>)"**
4. **Card Indicators in "All Saved Panels" View:**
   * **Mutual Match:** `✓ Both Going` (green highlight).
   * **Time Conflict:** `⚠️ Overlaps with [Your Event Title]` (gold highlight).
   * **Quick Add:** `+ Add to Schedule` button to save without opening the modal.

### 4.2 Profile Screen Privacy Setting
In the **Profile** tab under User Badge:
* **"Squad Privacy"** card with toggle switch:
  * Label: *"Share full schedule with Squad"* (Default: Checked).
  * Subtitle: *"Allow squad members to browse your saved events. If disabled, friends only see mutual panels."*

---

## 5. Testing & Verification

1. **Unit Tests (`tests/share.test.ts`, `tests/friends.test.ts`):**
   * Test `shareLink` fallback handling when `navigator.share` is undefined vs defined.
   * Test `/api/friends` endpoint with `shareSchedule === 1` and `shareSchedule === 0`.
2. **End-to-End Browser Verification:**
   * Verify opening `/?event=<id>` auto-pops `PanelDetailModal` for guest and logged-in users.
   * Verify closing the modal removes `?event=` from URL.
   * Verify opening `/?invite=<username>` shows the confirmation banner.
   * Verify privacy toggle on Profile screen hides full schedule in friend view.
