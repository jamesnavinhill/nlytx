# Architecture

Verified against the code on 2026-08-30. Where the code diverges from earlier claims, this doc is authoritative.

## Stack

- **Frontend**: React 19, Vite 6, Tailwind 4, Radix UI primitives, custom canvas/SVG dither chart engine (`src/lib/dither-engine.ts`, `src/components/dither/`).
- **Backend**: Express 4 (`server.ts`) mounting three route groups under `/api`. Runs as a single Node process; in dev Vite middleware serves the SPA, in production Express serves `dist/` static files.
- **State**: React contexts (`src/context/AnalyticsContext.tsx`, `InfrastructureContext.tsx`, `ThemeContext.tsx`) polling the Express API.

## Request flow

```
Browser ──► Express API (server.ts)
             ├─ /api/analytics/{data,sync}     → analytics.routes.ts
             ├─ /api/accounts{,/save,/test-connection}  → accounts.routes.ts
             ├─ /api/infrastructure/{data,sync,accounts,instance-action} → infrastructure.routes.ts
             │      each route → credential-vault.service → provider service → cache.service (60s TTL)
             └─ /api/health
```

- **credential-vault.service.ts** — AES-256-GCM in-memory store keyed off `VAULT_ENCRYPTION_KEY`. Seeds default accounts (analytics + infrastructure) from env vars at boot. Secrets never leave the server; the client only sees `{id, name, hasKey, isLiveConnected}`.
- **cache.service.ts** — namespaced in-memory cache, `provider::accountId::timeRange` keys, 60s TTL; `POST /sync` forces invalidation.
- **telemetry-generator.service.ts / telemetry-generator-infra.service.ts** — synthetic data engines. This is what the public demo site renders, and — currently — everything else too.

## Data plane

Rewritten 2026-08-30 to return **real API data** mapped into the unified schema (`buildEmptyAnalyticsPayload` / `buildEmptyInfraPayload` in `telemetry-base.ts` give the contract-complete shells). Per service:

| Service | Real data returned |
| --- | --- |
| `vercel.service.ts` | Project identity + Web Analytics `/v1/web/analytics/stats` (daily views/visitors), `top-paths`, Experience insights → web vitals. View counters are 0 until prod traffic accrues. |
| `cloudflare.service.ts` | Zone identity + GraphQL `httpRequests1dGroups` (requests, pageviews, bytes, cached, threats, uniques, status breakdown). Needs a token with **Zone Analytics Read** — currently falls back to demo. |
| `google-analytics.service.ts` | GA4 `runReport` (users, pageviews, sessions, bounce, duration) aggregated across date/page/country/device. Authenticates by **minting SA-JWTs at runtime** from `GOOGLE_ANALYTICS_SA_JSON_B64` (50-min cache). |
| `aws-infra.service.ts` | EC2 `DescribeInstances` + `DescribeInstanceStatus` + CloudWatch `GetMetricStatistics` (CPU avg + history, network kbps, disk ops) via `@aws-sdk`. Memory stays 0 (needs CW agent). |
| `cloudflare-infra.service.ts` | Real tunnels + connectors + ingress rules (`cfd_tunnel` API) and Workers scripts with GraphQL `workersInvocationsAdaptive` (rps, error rate, p50/p99 CPU). |
| `oracle-infra.service.ts` | No credentials on disk — still synthetic. |

Demo mode: any provider without credentials (or anonymous public traffic paths that fail) returns `generateSyntheticTelemetry` with `isLive: false`, so the site always renders. Liveness is honest: `isLive: true` only after a real API read succeeded.

Auth: `/api/auth/*` (register/login/logout/me) issues httpOnly cookie sessions backed by Neon Postgres (`users`, `sessions`). `POST /api/accounts/save` also persists the encrypted credential reference to `user_accounts` for logged-in users; `GET /api/accounts` merges env-seeded + persisted accounts (deduped by id).

Unified views are **auth-gated** (`unified.service.ts`): anonymous visitors get the synthetic demo rollup; signed-in users get a live merge of every credentialed provider account (analytics: time series summed by date, summaries recomputed, top paths/geo/devices merged; infrastructure: instance/tunnel/worker arrays concatenated, logs merged). Signed-in responses never contain synthetic data — a provider without credentials contributes nothing (honest empty view). Cache keys are namespaced `u:` for authenticated requests so demo and live payloads never collide.

## Known bugs fixed during verification

- **Env load ordering** (`server.ts`): route imports were hoisted above `dotenv.config()`, so the credential vault constructed against an empty env and every seeded account showed `hasKey: false` even with credentials present. Fixed by switching to `import 'dotenv/config'` as the first import (2026-08-30).

## Frontend

- `AppHeader` / `CollapsibleSidebar` — dual-category nav (ANALYTICS / INFRASTRUCTURE) with per-provider account trees.
- Dashboard views: `AnalyticsDashboard`, `InfrastructureDashboard` + `AwsFleetView`, `CloudflareInfraView`, `OracleFleetView`, `InfraLogStream`.
- `SettingsDialog` — credential entry per provider; `POST /api/accounts/test-connection` performs the live verification.
- Demo/public mode is implicit: any visitor gets synthetic telemetry without logging in. (No auth exists yet — see roadmap.)

## Types

Shared contracts live in `src/types/analytics.ts` (providers: `unified | vercel | cloudflare | google`) and `src/types/infrastructure.ts` (`unified-infra | aws | cloudflare-infra | oracle`).
