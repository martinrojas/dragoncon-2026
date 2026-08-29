# CyberDragon Companion App — Dragon Con 2026 (v1.1.0)

CyberDragon is a high-performance, offline-capable mobile companion Progressive Web App (PWA) designed for Dragon Con 2026 in Atlanta, GA. Built with React 19 SSR, Hono, Void, and Cloudflare Workers with D1 SQLite.

---

## Features

- **Live & Offline Schedule Grid:** Full con schedule browsing with track filtering, multi-facet search, and day/time timeline rails.
- **Atlanta Con Floor Walk-Time Engine:** Real-time pedestrian and skybridge walk-time estimates between the 6 core host venues (Hyatt Regency, Marriott Marquis, Hilton Atlanta, Courtland Grand, Westin Peachtree Plaza, and AmericasMart).
- **Offline Venue Floor Plans & Room Polygon Overlays:** Interactive pinch/zoom floor plans for all 11 host venues and shuttles, glowing SVG room polygon overlays, centroid pin markers, and direct session rating links to the official Core-Apps app.
- **Schedule Stamina & Conflict Engine:** Daily load meters tracking saved panels, active overlap conflicts, and cumulative daily walking time.
- **WebAuthn & Passkey Authentication:** 1-click biometric passkey login/registration (Touch ID / Face ID / 1Password) backed by Cloudflare D1.
- **Schedule ICS Export:** Generate and download standard `.ics` calendar files for Apple Calendar / Google Calendar.
- **Admin Ingestion Dashboard:** Integrated web scraper with `sync`, `dry-run`, and `hard-resync` modes, live streaming logs, diff inspect, and audit run history.

---

## Tech Stack

- **Frontend:** React 19, React Compiler (`babel-plugin-react-compiler`), `@void/react`, CyberDragon Glass CSS Design System (`public/cyberdragon.css`), Service Worker PWA (`public/sw.js`).
- **Server & API:** Hono file-based routing (`routes/api/`), `@simplewebauthn/server` for passkeys, Cheerio for schedule scraping.
- **Database & ORM:** Cloudflare D1 (SQLite) with Drizzle ORM (`db/schema.ts`, `void/db`).
- **Toolchain & Runtime:** Vite+, Void, Cloudflare Workers (`workerd`).

---

## Local Development

### Prerequisites
- Node.js 20+
- pnpm 10+
- Wrangler CLI (`pnpm exec wrangler`)

### Getting Started

```bash
# Install dependencies
pnpm install

# Start local development server (with hot reload and local D1 SQLite)
pnpm dev

# Run unit tests
pnpm test

# Build production artifacts
pnpm build
```

---

## Database & Migrations

Drizzle manages database schemas defined in `db/schema.ts`:

```bash
# Generate new migration files from schema changes
pnpm run db:generate

# Apply pending migrations locally
pnpm run db:migrate

# Seed local database
pnpm run db:seed

# Promote a user account to administrator
pnpm run make-admin <username>
```

---

## Deployment (Cloudflare Workers + D1)

CyberDragon deploys directly to your own Cloudflare account using Void's native Cloudflare backend (`void deploy --backend cloudflare`).

### 1. First-Time Provisioning
```bash
# Login to your Cloudflare account
npx wrangler login

# Deploy and provision remote D1 database
pnpm run deploy:provision
```

### 2. Subsequent Deployments
```bash
pnpm run deploy
```

### 3. Continuous Integration (GitHub Actions)
`.github/workflows/deploy.yml` deploys on pushes to `main`. Required repository secrets:
- `CLOUDFLARE_API_TOKEN` (Cloudflare API token with *Workers Scripts: Edit* and *D1: Edit* permissions)
- `CLOUDFLARE_ACCOUNT_ID` (Cloudflare Account ID)

---

## Live Deployment

- **Production App:** [https://dragoncon.martinrojas.dev](https://dragoncon.martinrojas.dev) (or fallback [https://dragoncon-2026.martin-d28.workers.dev](https://dragoncon-2026.martin-d28.workers.dev))
- **API Endpoints:**
  - `GET /api/events` — Query and filter schedule events
  - `GET /api/changes` — Recent con schedule changes
  - `GET /api/schedule` — User saved agenda & conflict detector
  - `GET /api/export-ics` — User calendar export
  - `POST /api/admin/ingest` — Trigger schedule data sync
  - `GET /api/admin/stats` — Ingestion and DB metrics
  - `GET /api/admin/runs` — Ingestion run audit history
