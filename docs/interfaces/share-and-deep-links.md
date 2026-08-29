---
type: API Contracts
title: Client Share and Deep-Link Contracts
description: Browser sharing behavior and the event and squad invitation URL contracts.
tags: [api-contracts, sharing, deep-links, pwa]
generated: { by: docsmith/1.3.0, at: 2026-08-29T07:04:03Z }
verified: [{ by: docsmith/1.3.0, at: 2026-08-29T07:04:03Z }]
status: stable
maintainer: CyberDragon Engineering
sources:
  - id: share-utility
    resource: lib/share.ts:1-29
    title: Native share and clipboard fallback result contract
  - id: share-tests
    resource: tests/share.test.ts:1-53
    title: Native share, clipboard fallback, and user-abort regression tests
  - id: panel-share
    resource: components/PanelDetailModal.tsx:308-324
    title: Event share URL generation and copied-link notification
  - id: event-resolver
    resource: components/home/hooks/useAppSyncAndPrefs.ts:48-125
    title: Event query parameter resolution after client mount
  - id: event-cleanup
    resource: pages/index.tsx:354-363
    title: Event query parameter removal when the detail modal closes
  - id: squad-share
    resource: pages/index.tsx:158-170
    title: Squad invitation URL generation and copied-link notification
  - id: squad-resolver
    resource: components/home/hooks/useSquad.ts:30-57
    title: Invitation persistence and self-invite cleanup after client mount
  - id: squad-actions
    resource: components/home/hooks/useSquad.ts:123-152
    title: Invitation acceptance and dismissal cleanup
  - id: url-cleaner
    resource: lib/squadUtils.ts:18-22
    title: Query parameter removal without page navigation
---

# Client Share and Deep-Link Contracts

## Share result contract

`shareLink(payload)` accepts `{ title, text?, url }` and returns `{ shared, copied }`.[^share-utility]

1. If `navigator.share` succeeds, it returns `{ shared: true, copied: false }`.
2. If native sharing is unavailable or throws a non-`AbortError`, it attempts to copy only `payload.url` through `navigator.clipboard.writeText`.
3. If the user cancels native sharing with `AbortError`, it returns `{ shared: false, copied: false }` without copying.
4. If neither browser API succeeds, it returns `{ shared: false, copied: false }`.

The unit tests cover native sharing, clipboard fallback, and user cancellation.[^share-tests]

## Event links

An event share URL uses `/?event=<event-id>`. `PanelDetailModal` builds the URL from `window.location.origin`, passes the event title and schedule text to `shareLink`, and reports clipboard success inside the modal.[^panel-share]

After the home page mounts, `useAppSyncAndPrefs` reads `event` from `window.location.search`, fetches `/api/events?id=<encoded-id>`, and opens `PanelDetailModal` only when the response contains a successful event.[^event-resolver] Closing the modal removes `event` with `history.replaceState`; the cleanup preserves the path, remaining query parameters, and hash without reloading the page.[^event-cleanup][^url-cleaner]

## Squad invitation links

A squad share URL uses `/?invite=<encoded-username>`. The home coordinator passes the invitation title, display text, and URL to `shareLink`, then reports clipboard success through the shared toast.[^squad-share]

After the home page mounts, `useSquad` reads `invite` from the query string. It stores a present value in `sessionStorage` as `dc_pending_invite`; if the URL has no value, it restores the pending username from that key. This keeps an invitation pending across login or registration in the same browser session.[^squad-resolver]

A logged-in user cannot accept their own invitation: `isSelfInvite` compares trimmed usernames case-insensitively, then clears state, session storage, and the query parameter.[^squad-resolver] Accepting an invitation sends `POST /api/friends` with the current user ID and inviting username. Accepting or dismissing removes the pending state, storage key, and URL parameter.[^squad-actions]

## SSR boundary

The share utility guards browser API access with `typeof navigator !== "undefined"`. Initial event and invitation query-string reads and pending-invite storage restoration run inside mount effects; later cleanup runs after hydration from effects or user-action callbacks.[^share-utility][^event-resolver][^squad-resolver][^squad-actions]

## Provenance

[^share-utility]: Native share and clipboard fallback result contract — `lib/share.ts:1-29`
[^share-tests]: Native share, clipboard fallback, and user-abort regression tests — `tests/share.test.ts:1-53`
[^panel-share]: Event share URL generation and copied-link notification — `components/PanelDetailModal.tsx:308-324`
[^event-resolver]: Event query parameter resolution after client mount — `components/home/hooks/useAppSyncAndPrefs.ts:48-125`
[^event-cleanup]: Event query parameter removal when the detail modal closes — `pages/index.tsx:354-363`
[^squad-share]: Squad invitation URL generation and copied-link notification — `pages/index.tsx:158-170`
[^squad-resolver]: Invitation persistence and self-invite cleanup after client mount — `components/home/hooks/useSquad.ts:30-57`
[^squad-actions]: Invitation acceptance and dismissal cleanup — `components/home/hooks/useSquad.ts:123-152`
[^url-cleaner]: Query parameter removal without page navigation — `lib/squadUtils.ts:18-22`
