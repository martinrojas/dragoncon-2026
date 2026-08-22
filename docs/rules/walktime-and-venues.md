---
type: Domain Rules
title: Venue Transit & Capacity Calculation Rules
description: Calculation matrix for pedestrian and skybridge walk times between Atlanta host hotels and room line capacity heuristics.
tags: [domain-rules, walktime, navigation, venues]
generated: { by: docsmith/1.3.0, at: 2026-08-22T06:15:00Z }
verified: [{ by: docsmith/1.3.0, at: 2026-08-22T06:15:00Z }]
status: stable
maintainer: CyberDragon Engineering
sources:
  - id: walktime-module
    resource: lib/walktime.ts:1-111
    title: Core venue list, walk matrix table, and heuristic functions
  - id: walktime-tests
    resource: tests/walktime.test.ts:1-75
    title: Unit tests validating normalization, walk times, and capacity heuristics
---

# Venue Transit & Capacity Calculation Rules

> Domain rules governing hotel transit times, skybridge pedestrian routes, venue string normalization, and deterministic room line capacity heuristics for Dragon Con 2026.

---

## 1. Core Host Venues

The Atlanta Dragon Con footprint spans 6 primary convention venues in Downtown Atlanta [^walktime-module]:

| Venue Key | Primary Venue Name | Street Address | Skybridge Connected To |
| :--- | :--- | :--- | :--- |
| `HYATT` | Hyatt Regency Atlanta | 265 Peachtree St NE | Marriott Marquis |
| `MARRIOTT` | Marriott Marquis Atlanta | 265 Peachtree Center Ave NE | Hyatt Regency, Hilton Atlanta |
| `HILTON` | Hilton Atlanta | 255 Courtland St NE | Marriott Marquis |
| `SHERATON` | Courtland Grand (fka Sheraton Atlanta) | 165 Courtland St NE | None (Street level walk) |
| `WESTIN` | Westin Peachtree Plaza | 210 Peachtree St NW | AmericasMart (via street/tunnel) |
| `AMERICASMART` | AmericasMart Buildings 2 & 3 | 230 Ted Turner Dr NW | Westin Peachtree Plaza |

---

## 2. Walk Time Matrix (in Minutes)

Transit times between venues are defined as follows [^walktime-module]:

| From \ To | Hyatt | Marriott | Hilton | Courtland Grand | Westin | AmericasMart |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Hyatt** | 0 min | 4 min *(skybridge)* | 7 min | 10 min | 12 min | 8 min |
| **Marriott** | 4 min *(skybridge)* | 0 min | 5 min *(skybridge)* | 8 min | 11 min | 10 min |
| **Hilton** | 7 min | 5 min *(skybridge)* | 0 min | 6 min | 14 min | 12 min |
| **Courtland Grand** | 10 min | 8 min | 6 min | 0 min | 15 min | 14 min |
| **Westin** | 12 min | 11 min | 14 min | 15 min | 0 min | 6 min |
| **AmericasMart** | 8 min | 10 min | 12 min | 14 min | 6 min | 0 min |

### Transit Invariants & Fallbacks
- **Identical Venue:** When `venueA` and `venueB` normalize to the same venue key, walk time is `0` minutes with path `"Same venue"`.
- **Unmapped / Unknown Venue:** If either venue string cannot be normalized (e.g. external venue or null), transit defaults to `8` minutes with path label `"Con Floor Walk"`.

---

## 3. Venue String Normalization

Raw event location strings (e.g., `"Hyatt Regency - Centennial I"`, `"Courtland Grand Room 1600"`, `"Marriott Atrium Ballroom"`) are normalized to a `CoreVenue` key using case-insensitive substring matching [^walktime-module]:

1. If string contains `"HYATT"` $\to$ `HYATT`
2. If string contains `"MARRIOTT"` $\to$ `MARRIOTT`
3. If string contains `"HILTON"` $\to$ `HILTON`
4. If string contains `"SHERATON"` or `"COURTLAND"` $\to$ `SHERATON`
5. If string contains `"WESTIN"` $\to$ `WESTIN`
6. If string contains `"MART"` or `"AMERICA"` $\to$ `AMERICASMART`
7. Otherwise $\to$ `null` (triggers the 8-minute fallback)

---

## 4. Room Capacity & Line Heuristics

Because live convention hall turnstiles are unavailable via public API, the app computes a deterministic capacity heuristic from the combined event time and venue string [^walktime-module]:

```ts
let hash = 0;
const seed = (timeString || "") + (venue || "");
for (let i = 0; i < seed.length; i++) {
  hash = (hash << 5) - hash + seed.charCodeAt(i);
  hash |= 0;
}
const pct = 45 + (Math.abs(hash) % 50); // Bounded strictly between 45% and 94%
```

### Line Status Thresholds
- **$\text{pct} > 85\%$:** Status `"Line forming at door"`, accent color `var(--coral-500)`.
- **$\text{pct} > 70\%$:** Status `"Filling up"`, accent color `var(--gold-500)`.
- **$\text{pct} \le 70\%$:** Status `"Seating available"`, accent color `var(--jade-500)`.
