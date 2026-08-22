---
type: Decision
title: "0001: Cloudflare Workers and D1 Self-Host Architecture"
description: Architectural decision to deploy directly to Cloudflare Workers and D1 SQLite using Void's self-host backend.
tags: [decision, adr, cloudflare, d1, hosting]
generated: { by: docsmith/1.3.0, at: 2026-08-22T06:15:00Z }
verified: [{ by: docsmith/1.3.0, at: 2026-08-22T06:15:00Z }]
status: stable
decision_status: accepted
maintainer: CyberDragon Engineering
sources:
  - id: wrangler-config
    resource: wrangler.jsonc:1-19
    title: Cloudflare Workers and D1 database binding configuration
  - id: deploy-workflow
    resource: .github/workflows/deploy.yml:1-28
    title: Cloudflare deployment CI/CD workflow
  - id: void-cli-cloudflare
    resource: package.json:10-15
    title: Package scripts targeting Cloudflare self-host backend
---

# 0001: Cloudflare Workers and D1 Self-Host Architecture

## Context

The CyberDragon companion app was developed with full-stack TypeScript using React 19 SSR, Hono API routes, and Drizzle ORM over SQLite. Void Cloud (the managed hosting platform for Void) remains in private beta, requiring a production deployment path.

---

## Decision

Deploy CyberDragon directly to the team's own **Cloudflare account** using Void's built-in self-host backend (`void deploy --backend cloudflare`) targeting **Cloudflare Workers** and **Cloudflare D1 (SQLite)** [^wrangler-config] [^deploy-workflow].

---

## Rationale

1. **Zero Application Code Changes:** The application was already written using `void/db` (which wraps Cloudflare D1) and Hono. Compiling to a native Cloudflare Worker requires no code refactoring.
2. **Edge Performance & Low Latency:** Cloudflare Workers run at hundreds of edge points of presence worldwide with sub-10ms startup times, providing rapid schedule rendering for con attendees.
3. **Generous Free Tier:** Cloudflare Workers Free Tier includes 100k requests/day and D1 provides 5 million read units/day and 5GB storage at zero hosting cost.
4. **Co-located Storage:** D1 SQLite databases run directly inside Cloudflare's edge network, avoiding cross-datacenter database latency.

---

## Alternatives Ruled Out

1. **Node.js / Bun Docker Container on Fly.io or VPS:**
   - *Reason for rejection:* Required refactoring `db/schema.ts` from `void/schema-d1` to `better-sqlite3`/`libsql`, adding persistent volume mounts, and incurring ongoing hosting costs.
2. **Pure Client-Side Static PWA (GitHub Pages / Vercel):**
   - *Reason for rejection:* Would drop server-rendered initial HTML, requiring heavy client-side initial data fetching and externalizing user passkey storage.
3. **Waiting for Void Cloud Public Release:**
   - *Reason for rejection:* Indefinite timeline for Dragon Con 2026 deployment.
