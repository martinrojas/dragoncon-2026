# Squad Share, Deep Linking & Detailed Schedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Web Share API invite links (`/?invite=<username>`), event deep links (`/?event=<id>`), and a detailed squad schedule browser with per-user privacy controls.

**Architecture:** 
- A shared `shareLink` utility wraps `navigator.share` with clipboard fallback.
- Client mount effects inspect URL search parameters to resolve pending invites and pop event modals for guests and authenticated users alike.
- D1 SQLite schema gains a `share_schedule` integer flag on the `users` table, exposed via a privacy API and enforced in `GET /api/friends`.

**Tech Stack:** React 19, TypeScript, Hono, Void Framework, Drizzle ORM / SQLite D1, Web Share API, Clipboard API.

**Spec:** `docs/superpowers/specs/2026-08-28-squad-share-deep-linking-design.md`

## Global Constraints

- Never commit credentials, tokens, or private keys.
- All endpoints must wrap handlers in `defineHandler` from `void` and export uppercase HTTP methods.
- Database schemas must be declared in `db/schema.ts` and generated with `pnpm run db:generate`.
- Every commit affecting client assets must bump `CACHE_NAME` in `public/sw.js`.
- All tests must pass with `pnpm test` and production build with `pnpm build`.

---

### Task 1: Database Schema & Migration for Privacy Toggle (`share_schedule`)

**Files:**
- Modify: `db/schema.ts:22-31`
- Test: `tests/schema.test.ts`
- Generate: `db/migrations/*`

**Interfaces:**
- Produces: `users.shareSchedule` (integer column with default `1`).

- [ ] **Step 1: Write the failing test for `users.shareSchedule`**

Edit `tests/schema.test.ts` to assert that `users.shareSchedule` is defined:
```ts
test("users table has a shareSchedule column, notNull with default 1", () => {
  assert.ok(users.shareSchedule, "users.shareSchedule column should be defined");
  assert.strictEqual(users.shareSchedule.name, "share_schedule");
  assert.strictEqual(users.shareSchedule.notNull, true);
  assert.strictEqual(users.shareSchedule.hasDefault, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL with "users.shareSchedule column should be defined"

- [ ] **Step 3: Add `shareSchedule` column to `db/schema.ts`**

Update `db/schema.ts`:
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

- [ ] **Step 4: Run test and generate migration**

Run: `pnpm test`
Expected: PASS

Run: `pnpm run db:generate`
Expected: Generates new migration SQL in `db/migrations/`

- [ ] **Step 5: Commit**

```bash
git add db/schema.ts db/migrations tests/schema.test.ts
git commit -m "feat: add share_schedule column to users table"
```

---

### Task 2: Web Share Utility & Tests (`lib/share.ts`)

**Files:**
- Create: `lib/share.ts`
- Test: `tests/share.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface SharePayload {
    title: string;
    text?: string;
    url: string;
  }
  export function shareLink(payload: SharePayload): Promise<{ shared: boolean; copied: boolean }>;
  ```

- [ ] **Step 1: Write the failing test for `shareLink`**

Create `tests/share.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { shareLink } from "../lib/share.ts";

test("shareLink uses navigator.share when available", async () => {
  let sharedPayload: unknown = null;
  // @ts-expect-error Mocking global navigator
  globalThis.navigator = {
    share: async (data: unknown) => {
      sharedPayload = data;
    },
  };

  const res = await shareLink({ title: "Panel", url: "https://con.app/?event=1" });
  assert.deepStrictEqual(res, { shared: true, copied: false });
  assert.deepStrictEqual(sharedPayload, { title: "Panel", url: "https://con.app/?event=1" });
});

test("shareLink falls back to clipboard when navigator.share is unavailable", async () => {
  let copiedText = "";
  // @ts-expect-error Mocking global navigator without share
  globalThis.navigator = {
    share: undefined,
    clipboard: {
      writeText: async (text: string) => {
        copiedText = text;
      },
    },
  };

  const res = await shareLink({ title: "Panel", url: "https://con.app/?event=2" });
  assert.deepStrictEqual(res, { shared: false, copied: true });
  assert.strictEqual(copiedText, "https://con.app/?event=2");
});

test("shareLink returns { shared: false, copied: false } on user abort", async () => {
  // @ts-expect-error Mocking AbortError
  globalThis.navigator = {
    share: async () => {
      const err = new Error("Abort");
      err.name = "AbortError";
      throw err;
    },
  };

  const res = await shareLink({ title: "Panel", url: "https://con.app/?event=3" });
  assert.deepStrictEqual(res, { shared: false, copied: false });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL with "Cannot find module '../lib/share.ts'"

- [ ] **Step 3: Implement `lib/share.ts`**

Create `lib/share.ts`:
```ts
export interface SharePayload {
  title: string;
  text?: string;
  url: string;
}

export async function shareLink(payload: SharePayload): Promise<{ shared: boolean; copied: boolean }> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share(payload);
      return { shared: true, copied: false };
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") {
        return { shared: false, copied: false };
      }
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(payload.url);
      return { shared: false, copied: true };
    } catch {
      return { shared: false, copied: false };
    }
  }

  return { shared: false, copied: false };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/share.ts tests/share.test.ts
git commit -m "feat: add shareLink utility with clipboard fallback"
```

---

### Task 3: Privacy Settings API Endpoint & Tests (`routes/api/user/privacy.ts`)

**Files:**
- Create: `routes/api/user/privacy.ts`
- Test: `tests/user-privacy.test.ts`

**Interfaces:**
- Produces: `PATCH /api/user/privacy`
  - Body: `{ userId: string, shareSchedule: boolean }`
  - Response: `{ success: boolean, shareSchedule: number }`

- [ ] **Step 1: Write the failing test for `PATCH /api/user/privacy`**

Create `tests/user-privacy.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { withRuntimeEnv } from "void/_env";
import { PATCH } from "../routes/api/user/privacy.ts";

function createFakeD1() {
  const sqliteDb = new DatabaseSync(":memory:");
  sqliteDb.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      avatar_url TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      share_schedule INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT INTO users (id, username, name, password_hash, share_schedule)
    VALUES ('u_alice', 'alice', 'Alice', 'hash', 1);
  `);

  return {
    prepare(sqlText: string) {
      const stmt = sqliteDb.prepare(sqlText);
      return {
        bind(...params: unknown[]) {
          return {
            raw() {
              return stmt.all(...(params as never[])).map((row) => Object.values(row as object));
            },
            all() {
              return { results: stmt.all(...(params as never[])) };
            },
            run() {
              const info = stmt.run(...(params as never[]));
              return { success: true, meta: { changes: info.changes, last_row_id: Number(info.lastInsertRowid) } };
            },
          };
        },
      };
    },
  };
}

test("PATCH /api/user/privacy updates share_schedule flag", async () => {
  const fakeD1 = createFakeD1();
  await withRuntimeEnv({ DB: fakeD1 as never }, async () => {
    const req = new Request("http://localhost/api/user/privacy", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "u_alice", shareSchedule: false }),
    });

    const res = await PATCH({ req } as never);
    const data = (await res.json()) as { success: boolean; shareSchedule: number };

    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.shareSchedule, 0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL with missing module `routes/api/user/privacy.ts`

- [ ] **Step 3: Implement `routes/api/user/privacy.ts`**

Create `routes/api/user/privacy.ts`:
```ts
import type { Context } from "hono";
import { defineHandler } from "void";
import { db, eq } from "void/db";
import { users } from "../../../db/schema";

export const PATCH = defineHandler(async (c: Context) => {
  try {
    const body = (await c.req.json().catch(() => ({}))) as {
      userId?: string;
      shareSchedule?: boolean;
    };

    const { userId, shareSchedule } = body;

    if (!userId || typeof shareSchedule !== "boolean") {
      return c.json({ success: false, error: "userId and shareSchedule boolean required" }, 400);
    }

    const value = shareSchedule ? 1 : 0;

    await db
      .update(users)
      .set({ shareSchedule: value })
      .where(eq(users.id, userId));

    return c.json({ success: true, shareSchedule: value });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ success: false, error: message }, 500);
  }
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add routes/api/user/privacy.ts tests/user-privacy.test.ts
git commit -m "feat: add user privacy settings endpoint"
```

---

### Task 4: Extended Friends API with Schedule Privacy & Tests (`routes/api/friends.ts`)

**Files:**
- Modify: `routes/api/friends.ts:1-55`
- Test: `tests/friends-privacy.test.ts`

**Interfaces:**
- Produces: `GET /api/friends?userId=<myId>&friendId=<friendId>`
  - Response (Public): `{ success: true, scheduleHidden: false, friend: {...}, friendEvents: [...], sharedEventIds: [...] }`
  - Response (Private): `{ success: true, scheduleHidden: true, friend: {...}, friendEvents: [], sharedEvents: [...], sharedEventIds: [...] }`

- [ ] **Step 1: Write the failing test for `GET /api/friends` privacy enforcement**

Create `tests/friends-privacy.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { withRuntimeEnv } from "void/_env";
import { GET } from "../routes/api/friends.ts";

function createFakeFriendsD1() {
  const sqliteDb = new DatabaseSync(":memory:");
  sqliteDb.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      avatar_url TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      share_schedule INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      location TEXT,
      track TEXT,
      starts_at TEXT,
      ends_at TEXT,
      duration_minutes INTEGER,
      day TEXT,
      time_string TEXT,
      speakers TEXT,
      content_hash TEXT,
      is_deleted INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE user_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'going',
      notes TEXT,
      added_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE friendships (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      friend_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'accepted',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT INTO users (id, username, name, password_hash, share_schedule) VALUES
      ('u_alice', 'alice', 'Alice', 'hash', 1),
      ('u_bob_pub', 'bob', 'Bob', 'hash', 1),
      ('u_charlie_priv', 'charlie', 'Charlie', 'hash', 0);

    INSERT INTO events (id, title, day, time_string, location) VALUES
      ('ev_1', 'Intro to Cyberpunk', 'Friday', '10:00 AM', 'Hyatt'),
      ('ev_2', 'Cosplay Armor 101', 'Friday', '1:00 PM', 'Marriott');

    INSERT INTO user_events (id, user_id, event_id) VALUES
      ('ue_1', 'u_alice', 'ev_1'),
      ('ue_2', 'u_bob_pub', 'ev_1'),
      ('ue_3', 'u_bob_pub', 'ev_2'),
      ('ue_4', 'u_charlie_priv', 'ev_1'),
      ('ue_5', 'u_charlie_priv', 'ev_2');
  `);

  return {
    prepare(sqlText: string) {
      const stmt = sqliteDb.prepare(sqlText);
      return {
        bind(...params: unknown[]) {
          return {
            raw() {
              return stmt.all(...(params as never[])).map((row) => Object.values(row as object));
            },
            all() {
              return { results: stmt.all(...(params as never[])) };
            },
            run() {
              const info = stmt.run(...(params as never[]));
              return { success: true, meta: { changes: info.changes, last_row_id: Number(info.lastInsertRowid) } };
            },
          };
        },
      };
    },
  };
}

test("GET /api/friends returns full friendEvents when friend share_schedule is 1", async () => {
  const fakeD1 = createFakeFriendsD1();
  await withRuntimeEnv({ DB: fakeD1 as never }, async () => {
    const req = {
      query: (k: string) => (k === "userId" ? "u_alice" : k === "friendId" ? "u_bob_pub" : null),
    };
    const res = await GET({ req, json: (d: unknown, s = 200) => ({ status: s, json: async () => d }) } as never);
    const body = (await res.json()) as { success: boolean; scheduleHidden: boolean; friendEvents: unknown[]; sharedEventIds: string[] };

    assert.strictEqual(body.success, true);
    assert.strictEqual(body.scheduleHidden, false);
    assert.strictEqual(body.friendEvents.length, 2);
    assert.deepStrictEqual(body.sharedEventIds, ["ev_1"]);
  });
});

test("GET /api/friends hides friendEvents when friend share_schedule is 0", async () => {
  const fakeD1 = createFakeFriendsD1();
  await withRuntimeEnv({ DB: fakeD1 as never }, async () => {
    const req = {
      query: (k: string) => (k === "userId" ? "u_alice" : k === "friendId" ? "u_charlie_priv" : null),
    };
    const res = await GET({ req, json: (d: unknown, s = 200) => ({ status: s, json: async () => d }) } as never);
    const body = (await res.json()) as { success: boolean; scheduleHidden: boolean; friendEvents: unknown[]; sharedEvents: unknown[]; sharedEventIds: string[] };

    assert.strictEqual(body.success, true);
    assert.strictEqual(body.scheduleHidden, true);
    assert.strictEqual(body.friendEvents.length, 0);
    assert.strictEqual(body.sharedEvents.length, 1);
    assert.deepStrictEqual(body.sharedEventIds, ["ev_1"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL with undefined fields in response

- [ ] **Step 3: Update `routes/api/friends.ts`**

Edit `routes/api/friends.ts`:
```ts
import type { Context } from "hono";
import { defineHandler } from "void";
import { db, eq, inArray } from "void/db";
import { events, friendships, userEvents, users } from "../../db/schema";

export const GET = defineHandler(async (c: Context) => {
  const userId = c.req.query("userId");
  const friendId = c.req.query("friendId");

  if (!userId) {
    return c.json({ success: false, error: "userId parameter required" }, 400);
  }

  if (friendId) {
    const [targetFriend] = await db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        avatarUrl: users.avatarUrl,
        shareSchedule: users.shareSchedule,
      })
      .from(users)
      .where(eq(users.id, friendId));

    if (!targetFriend) {
      return c.json({ success: false, error: "Friend user not found" }, 404);
    }

    const userSaved = await db.select().from(userEvents).where(eq(userEvents.userId, userId));
    const friendSaved = await db.select().from(userEvents).where(eq(userEvents.userId, friendId));

    const userEventIds = new Set(userSaved.map((s) => s.eventId));
    const friendEventIds = friendSaved.map((s) => s.eventId);
    const sharedEventIds = friendSaved.filter((s) => userEventIds.has(s.eventId)).map((s) => s.eventId);

    const isPublic = targetFriend.shareSchedule === 1;

    let friendEventsList: (typeof events.$inferSelect)[] = [];
    let sharedEventsList: (typeof events.$inferSelect)[] = [];

    if (isPublic && friendEventIds.length > 0) {
      friendEventsList = await db.select().from(events).where(inArray(events.id, friendEventIds));
    }

    if (sharedEventIds.length > 0) {
      sharedEventsList = await db.select().from(events).where(inArray(events.id, sharedEventIds));
    }

    return c.json({
      success: true,
      scheduleHidden: !isPublic,
      friend: {
        id: targetFriend.id,
        username: targetFriend.username,
        name: targetFriend.name,
        avatarUrl: targetFriend.avatarUrl,
      },
      friendEvents: friendEventsList,
      sharedEvents: sharedEventsList,
      sharedEventIds,
    });
  }

  const list = await db
    .select()
    .from(friendships)
    .where(eq(friendships.userId, userId));

  if (list.length === 0) {
    return c.json({ success: true, friends: [] });
  }

  const friendIds = list.map((f) => f.friendId);
  const friendUsers = await db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      avatarUrl: users.avatarUrl,
      shareSchedule: users.shareSchedule,
    })
    .from(users)
    .where(inArray(users.id, friendIds));

  return c.json({ success: true, friends: friendUsers });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add routes/api/friends.ts tests/friends-privacy.test.ts
git commit -m "feat: extend friends endpoint with schedule visibility and full agenda"
```

---

### Task 5: Event Sharing & Deep Linking UI (`components/PanelDetailModal.tsx` & `pages/index.tsx`)

**Files:**
- Modify: `components/PanelDetailModal.tsx`
- Modify: `pages/index.tsx`

**Interfaces:**
- Consumes: `lib/share.ts` (`shareLink`)
- UI Behaviors:
  - Detail modal displays "📤 SHARE PANEL".
  - On mount, `?event=<id>` in URL auto-opens `PanelDetailModal` for that event.
  - Closing modal cleans URL query param via `window.history.replaceState`.

- [ ] **Step 1: Add Share Button to `PanelDetailModal.tsx`**

Edit `components/PanelDetailModal.tsx`:
- Import `shareLink` from `../lib/share`.
- Add share state toast state (e.g. `shareToast`).
- Add button in the action buttons section:
```tsx
<button
  type="button"
  onClick={async () => {
    const url = typeof window !== "undefined" ? `${window.location.origin}/?event=${item.id}` : `https://dragoncon.martinrojas.dev/?event=${item.id}`;
    const res = await shareLink({
      title: item.title,
      text: `${item.title} · ${item.day || ""} ${item.timeString || ""}`,
      url,
    });
    if (res.copied) {
      setShareToast("Link copied to clipboard!");
      setTimeout(() => setShareToast(""), 3000);
    }
  }}
  className="cd-btn cd-btn-secondary"
  style={{
    flex: 1,
    padding: 12,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  }}
>
  📤 SHARE PANEL
</button>
```

- [ ] **Step 2: Wire Event Deep Linking in `pages/index.tsx`**

In `pages/index.tsx`:
- In the initial mount `useEffect`, read `const eventParam = new URLSearchParams(window.location.search).get("event")`.
- If present, fetch `/api/events?id=${eventParam}` (or look up in `eventsList`) and set `setActiveDetailItem(event)`.
- When closing modal (`onClose={() => { setActiveDetailItem(null); cleanEventUrlParam(); }}`), replace URL with current search omitting `event`.

- [ ] **Step 3: Run unit tests and verify build**

Run: `pnpm test && pnpm build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add components/PanelDetailModal.tsx pages/index.tsx
git commit -m "feat: add event deep link resolution and share button"
```

---

### Task 6: Squad Invite Links & Confirmation Banner UI (`pages/index.tsx`)

**Files:**
- Modify: `pages/index.tsx`

**Interfaces:**
- Consumes: `lib/share.ts` (`shareLink`)
- UI Behaviors:
  - Squad Tab displays "🔗 INVITE TO SQUAD" button.
  - On mount, `?invite=<username>` sets pending invite state.
  - If logged in, renders top confirmation banner: *"@username invited you to their Squad! [Add to Squad] [Dismiss]"*.
  - If logged out, renders invitation notice above auth form and auto-arms banner upon login.

- [ ] **Step 1: Add Invite Share Button to Squad Tab**

In `pages/index.tsx`:
- In Squad Tab under Add Member form, add:
```tsx
<button
  type="button"
  onClick={async () => {
    if (!currentUser) return;
    const url = `${window.location.origin}/?invite=${encodeURIComponent(currentUser.username)}`;
    const res = await shareLink({
      title: "Join my CyberDragon Squad",
      text: `Join @${currentUser.username}'s Dragon Con squad on CyberDragon!`,
      url,
    });
    if (res.copied) {
      setFriendMsg("Invite link copied to clipboard!");
      setTimeout(() => setFriendMsg(""), 3000);
    }
  }}
  className="cd-btn cd-btn-secondary"
  style={{ width: "100%", marginBottom: 16 }}
>
  🔗 SHARE MY SQUAD INVITE LINK
</button>
```

- [ ] **Step 2: Add Invite Resolution & Confirmation Banner**

In `pages/index.tsx`:
- Add state: `pendingInvite: string | null` (read from `?invite=` on mount).
- Add banner component at top of main view when `pendingInvite` is active and user is logged in.
- Provide "Add to Squad" action which calls `POST /api/friends` with `{ userId: currentUser.id, friendUsername: pendingInvite }`, then clears `pendingInvite` and cleans URL.
- Provide "Dismiss" action which clears `pendingInvite` and cleans URL.

- [ ] **Step 3: Run unit tests and verify build**

Run: `pnpm test && pnpm build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add pages/index.tsx
git commit -m "feat: add squad invite links and confirmation banner"
```

---

### Task 7: Detailed Squad Schedule Browser & Privacy Controls UI (`pages/index.tsx`)

**Files:**
- Modify: `pages/index.tsx`
- Bump: `public/sw.js` (`CACHE_NAME`)

**Interfaces:**
- Consumes: `PATCH /api/user/privacy`, `GET /api/friends?userId=...&friendId=...`
- UI Behaviors:
  - Profile Tab includes "Squad Privacy" toggle switch to update `shareSchedule`.
  - Squad Tab allows toggling between "All Saved Events" and "Mutual Overlap" when viewing a friend.
  - Cards highlight Mutual Matches, Time Conflicts, and a "+ Add to Mine" quick action.

- [ ] **Step 1: Add Privacy Toggle in Profile Tab**

In `pages/index.tsx`:
- Add state `shareScheduleState: boolean` (synced with `currentUser.shareSchedule !== 0`).
- Render toggle card in Profile Tab calling `PATCH /api/user/privacy`.

- [ ] **Step 2: Build Detailed Schedule Browser in Squad Tab**

In `pages/index.tsx`:
- Update `handleCompareFriend(friend)` to store `friendEvents` and `scheduleHidden`.
- Render view selector: `[All Saved Events (N)]` and `[Mutual Overlap (N)]`.
- If `scheduleHidden`, display banner: *"🔒 @username has set their schedule to private. Showing only mutual saved panels."*
- Render friend event cards with:
  - `✓ Both Going` (green badge if in `userEventStatusMap`).
  - `⚠️ Conflict` (gold badge if overlaps with an item in `agendaItems`).
  - `+ Add to Mine` button (if not saved, 1-click adds to schedule via `POST /api/schedule`).

- [ ] **Step 3: Bump PWA Cache Version**

Edit `public/sw.js`:
- Bump `CACHE_NAME` (e.g. `dragoncon-pwa-v1` -> `dragoncon-pwa-v2`).

- [ ] **Step 4: Run full test suite and production build**

Run: `pnpm test && pnpm build`
Expected: All tests pass and build succeeds.

- [ ] **Step 5: Commit**

```bash
git add pages/index.tsx public/sw.js
git commit -m "feat: add detailed squad schedule browser, privacy toggle, and bump pwa cache"
```

---
