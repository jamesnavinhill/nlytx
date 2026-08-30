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

## Data plane reality

The provider services follow this pattern (verified 2026-08-30):

1. If no credential → synthetic telemetry with `isLive: false`.
2. If credential → **one lightweight real API call** to validate it (e.g. Vercel `GET /v9/projects/{id}`, Cloudflare zone lookup, Cloudflare tunnels/workers list).
3. The fetched metric payloads are **discarded**; synthetic telemetry is generated anyway with `isLive: true` and the resolved resource name.

Per service:

| Service | Real API call | Real metrics used? |
| --- | --- | --- |
| `vercel.service.ts` | project + deployments lookup | No — metadata only |
| `cloudflare.service.ts` | GraphQL `httpRequests1dGroups` + zone | No — result discarded |
| `google-analytics.service.ts` | GA4 `runReport` | No — result discarded |
| `aws-infra.service.ts` | **none** — just checks key prefix `AKIA`/`ASIA` | No |
| `cloudflare-infra.service.ts` | tunnels + workers scripts list | No — liveness only |
| `oracle-infra.service.ts` | **none** | No |

Consequence: with valid credentials the UI labels data "live" and resolves real account/zone names, but all numbers are synthetic. Closing this gap (return the fetched metrics through the unified schema) is the top roadmap item.

## Known bugs fixed during verification

- **Env load ordering** (`server.ts`): route imports were hoisted above `dotenv.config()`, so the credential vault constructed against an empty env and every seeded account showed `hasKey: false` even with credentials present. Fixed by switching to `import 'dotenv/config'` as the first import (2026-08-30).

## Frontend

- `AppHeader` / `CollapsibleSidebar` — dual-category nav (ANALYTICS / INFRASTRUCTURE) with per-provider account trees.
- Dashboard views: `AnalyticsDashboard`, `InfrastructureDashboard` + `AwsFleetView`, `CloudflareInfraView`, `OracleFleetView`, `InfraLogStream`.
- `SettingsDialog` — credential entry per provider; `POST /api/accounts/test-connection` performs the live verification.
- Demo/public mode is implicit: any visitor gets synthetic telemetry without logging in. (No auth exists yet — see roadmap.)

## Types

Shared contracts live in `src/types/analytics.ts` (providers: `unified | vercel | cloudflare | google`) and `src/types/infrastructure.ts` (`unified-infra | aws | cloudflare-infra | oracle`).
