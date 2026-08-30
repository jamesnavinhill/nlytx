# Verification Report — 2026-08-30

Full evidence log for the verification pass that produced the current docs. "No assumptions" pass: every claim below was checked live on this date against the real APIs/deployments, not inferred from code or changelogs.

## 1. Project health

| Check | Command | Result |
| --- | --- | --- |
| Install | `bun install` | ✅ 356 packages, no changes |
| Lint | `bun run lint` (tsc --noEmit) | ✅ clean (run twice: before and after fixes) |
| Build | `bun run build` | ✅ vite build + `dist/server.cjs` (55.8kb) |
| Boot | `bun run dev` | ✅ Express on :3000 |
| Endpoints | curl against all route groups | ✅ health, analytics data/sync, accounts, infra data/sync/accounts |

## 2. Bug found & fixed

**Env import-order** — `server.ts` imported routes (which construct the credential vault at module load) before `dotenv.config()` executed; ES import hoisting meant the vault always seeded from an empty env. Symptom: every account `hasKey: false` despite valid credentials. Fix: `import 'dotenv/config'` as first import. Re-verified: vercel/cf/aws accounts now seed live.

## 3. Credential read-backs (live API calls)

| Credential | Method | Result |
| --- | --- | --- |
| Vercel canonical `VERCEL_ACCESS_TOKEN` | `GET api.vercel.com/v2/user` | ✅ james@jami.studio (studio-jami) |
| Vercel legacy `VERCEL_ACCESS_TOKEN` | same | ✅ same account (duplicate) |
| Vercel project `prj_M20YXbR6g9k5VzIXQfoaCnv5ihTL` | `GET /v9/projects/{id}` ± teamId | ❌ 404 — lives under jamesnavinhill18@gmail.com; no token for that account on disk |
| Cloudflare canonical `CLOUDFLARE_API_TOKEN` | `GET /client/v4/zones` | ✅ 3 zones: jami.studio, mygardens.app, **navinhill.com** (`1d561b7ab18fb22c3ecf01acc2210788`) |
| Cloudflare DNS records scope | `GET .../dns_records` | ❌ token lacks DNS read (analytics-only token; noted, not a defect) |
| AWS admin CSV key | STS GetCallerIdentity (SigV4, aws CLI) | ❌ SignatureDoesNotMatch — stale/rotated |
| AWS root key | same | ✅ account 463183324956 (used only to provision, never stored in app) |
| New IAM user **nlytx-telemetry** | STS after creation | ✅ `arn:aws:iam::463183324956:user/nlytx-telemetry` |
| GA4 service account | JWT → OAuth2 token exchange | ✅ token minted; Admin API `accountSummaries` → property `properties/503127554` ("marketing") |
| GA Data API | enable on GCP project 275024763395 + `runReport` | ✅ API enabled; runReport OK (0 rows — no traffic yet) |
| Neon `NEON_API_KEY` (old .env) | `GET /api/v2/users/me` | ❌ 401 — dead |
| Neon legacy keys | same | ✅ `NEON_PERSONAL_ACCESS_TOKEN` → login `james` (james@jami.studio) |
| Neon project `NEON_PROJECT_ID` | `GET /api/v2/projects/{id}` with PAT | ❌ 404 — belongs to jamesnavinhill18@gmail.com's Neon |
| Neon Auth JWKS | anonymous fetch | ✅ live, 1 EdDSA key |

## 4. AWS provisioning performed (authorized by outline: "provision all accounts as required")

1. Created IAM user `nlytx-telemetry` (tags: Project=nlytx).
2. Attached `AmazonEC2ReadOnlyAccess`, `CloudWatchReadOnlyAccess`.
3. Created access key → projected into Nlytx `.env` → verified via STS.
4. Read-only fleet check: 1× `t3.small` running, `agency-gateway-aws`, us-east-1.

## 5. Data plane reality (code audit + live behavior)

- Every provider service: credential probe → **discards fetched metrics** → renders synthetic telemetry (`isLive` flag + resolved resource name only). Per-service detail in [architecture.md](architecture.md).
- `aws-infra.service.ts` makes no AWS call at all (checks `AKIA`/`ASIA` prefix).
- Live confirmation: `GET /api/analytics/data?provider=cloudflare` → `isLive: true`, accountName resolved to real zone name `navinhill.com`; `provider=vercel` → falls back after the expected cross-account 404; infra cloudflare/aws → `isLive: true`.

## 6. Live deployment

- `https://nlytx.navinhill.com` → 200 via Vercel, deployed 2026-08-30 ~03:05 UTC (GitHub auto-deploy from `jamesnavinhill/nlytx`, formerly `Analytics`).
- `/api/health` and `/api/analytics/data` on the live URL → Vercel `NOT_FOUND` (static-only deploy).
- No `@vercel/analytics` script in the served HTML; package not in `package.json`.
- DNS: `nlytx.navinhill.com` → 216.198.79.65 / 64.29.17.65 (Vercel); apex → 76.76.21.21 (Vercel).

## 7. Frontend

- No auth/login UI anywhere in `src/` (only a false positive in `button.tsx`).
- No marketing page — `index.html` is the dashboard.
- Demo mode works as intended: anonymous visitor gets synthetic telemetry for the whole UI.

## Net result

Everything runnable locally is healthy and honestly labeled; the remote site is a demo shell. The two hard external blockers for the rest are the missing jamesnavinhill18 Vercel token and Neon key ([roadmap R1](../roadmap.md)).

## Addendum — evening same day: both blockers cleared

- **Vercel**: device-flow login (`vercel login` → user clicked https://vercel.com/oauth/device) authenticated the CLI as `jamesnavinhill`. Personal token promoted to canon (`VERCEL_JNH_TOKEN`); verified `GET /v9/projects/prj_M20YXbR6g9k5VzIXQfoaCnv5ihTL` → `nlytx`. Project settings confirmed: Framework Preset **Vite** (static), owner `jameshill`, created 29 Aug 2026 23:05 UTC. Project env contains the Neon integration vars (NEON_AUTH_BASE_URL, VITE_NEON_AUTH_URL, DATABASE_URL, DATABASE_URL_UNPOOLED).
- **Neon**: `DATABASE_URL` verified by live connect → db `neondb`, user `neondb_owner`, no tables yet. Neon Auth endpoint reachable. The old `re_5…` value was a **Resend** key mislabeled `NEON_API_KEY` — no Neon management key is needed.
- **Nlytx `.env` updated**: personal token as `VERCEL_BEARER_TOKEN`, Neon connection strings added, temp `.env.vercel` removed after merge. Server re-verified: vault seeds Vercel live, `GET /api/analytics/data?provider=vercel` → `isLive: true` with real project name `nlytx`.
- Remaining unchanged: static-only deployment (R2), synthetic data plane (R3), auth code (R4), OCI creds absent (R5).

## Addendum 2 — end-to-end build + deploy, same day late evening

Shipped R2/R3/R4 in one pass and deployed to production (`nlytx.navinhill.com`, deployment `nlytx-a942n7tqp` era onward):

- **Real data plane implemented**: Cloudflare GraphQL analytics, Vercel Web Analytics/insights, GA4 `runReport` with runtime SA-JWT minting (`GOOGLE_ANALYTICS_SA_JSON_B64`), EC2 DescribeInstances + CloudWatch GetMetricStatistics (`@aws-sdk`), CF cfd_tunnel/connections/configurations + Workers `workersInvocationsAdaptive`. Synthetic generators kept as demo fallback; `telemetry-base.ts` provides contract-complete empty shells.
- **Vercel function packaging** took three iterations (all documented in deployment.md): ESM `ERR_MODULE_NOT_FOUND` → `api/package.json` CJS pin failed (compiler still emitted ESM) → prebundled CJS via esbuild → `.cjs` extension unsupported → final: committed `api/index.js` bundle + `api/package.json` `{"type":"commonjs"}` + source moved to `server/api-entry.ts`.
- **11 env vars added to Vercel production** via CLI (vault key, Vercel/CF/GA4/AWS credentials).
- **Live verification at ~05:25 UTC**: `/api/health` 200; Vercel + GA4 + AWS + CF-infra endpoints all `isLive: true` with real data (AWS CPU 1.2% real CloudWatch; CF 1 tunnel + 1 worker); auth register/me working against Neon on prod (`dbConnected: true`); SPA fallback 200; `/_vercel/insights/script.js` 200.
- **Known limitation**: Cloudflare zone analytics returns authz error (token lacks Zone Analytics Read) → honest demo fallback. One user action fixes it (see roadmap).

Net: the live site is now the real app — demo data for anonymous visitors, live provider data server-side, working accounts that persist in Neon.
