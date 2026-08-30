# Roadmap

Derived from [roadmap/outline.md](roadmap/outline.md). Items R1–R4 shipped 2026-08-30; what remains is below. Full evidence in [verification/2026-08-30-verification-report.md](verification/2026-08-30-verification-report.md).

## Shipped 2026-08-30

- [x] **R1** — jamesnavinhill18 Vercel access (device-flow login, `VERCEL_JNH_TOKEN` in canon) + Neon via the Vercel integration (`DATABASE_URL` et al., verified live).
- [x] **R2** — API deployed as a Vercel function (`api/index.js`, prebundled CJS via esbuild; `vercel.json` rewrites + SPA fallback); `@vercel/analytics` installed and serving; app env vars configured in Vercel production.
- [x] **R3** — Real data plane: Cloudflare GraphQL zone analytics (pending token scope, see below), Vercel Web Analytics + insights, GA4 `runReport` with runtime SA-JWT minting, real EC2 `describe-instances` + CloudWatch metrics, real CF tunnels/connectors/ingress + Workers invocation metrics. Synthetic generators remain as demo fallback (outline: "keep Demo Data for the public site").
- [x] **R4** — Neon Postgres auth: email/password (scrypt), httpOnly cookie sessions, per-user saved accounts persisted in Neon (`users` / `sessions` / `user_accounts` tables, created idempotently); login/register UI in the header.
- [x] **R6 partial** — env import-order fix, `NEON_S3_*` rename, stale key flagging, docs restructure.

## Remaining

### 1. Cloudflare Zone Analytics scope *(needs you, 2 minutes — the only credential left)*

The canon token can't read zone analytics (`authz` on `com.cloudflare.api.account.zone.analytics.read`) and cannot mint new tokens. Either:
- Edit the existing token in the Cloudflare dashboard (james@jami.studio) and add **Zone → Analytics → Read** for navinhill.com, or
- Create a new scoped token and add it to `.auth/env/.env.canonical` as `CLOUDFLARE_ANALYTICS_TOKEN` (then project into Nlytx `.env` as `CLOUDFLARE_API_TOKEN`).

Note: nlytx traffic resolves directly to Vercel (unproxied DNS), so CF zone analytics for navinhill.com is ~zero; jami.studio is proxied and shows real HTTP data — **but that traffic is litellm gateway calls (through the tunnel), not human web traffic**. If web-vs-gateway separation matters later, the GraphQL datasets support per-host breakdown (`clientRequestHTTPHost`) to split app domains from gateway hostnames.

### 2. Oracle OCI connector

No OCI credentials exist on disk anywhere (checked 2026-08-30). Mint an OCI API key + config, add `OCI_TENANCY_OCID` / `OCI_PRIVATE_KEY` (plus user/fingerprint), then replace the synthetic path in `oracle-infra.service.ts` using the real-SDK pattern from `aws-infra.service.ts`.

### 3. Marketing page

Outline: "small clean marketing page" as the public landing, dashboard behind it. SPA is single-view today; add a landing route or separate static page.

### 4. Nice-to-haves

- Web vitals/insights become meaningful as prod traffic accrues (Vercel + GA4 currently 0 by nature, not by bug).
- Anomaly detection, incident webhooks, K8s telemetry (carried from legacy docs).
- Rotate/delete the stale `~/.aws-keys/credentials/admin_accessKeys.csv` (fails STS).
- The `re_5…` value that was mislabeled `NEON_API_KEY` was a Resend key — if Resend is needed for transactional email later, mint properly and name it `RESEND_API_KEY`.

## Environment vars in Vercel production (mirror of local .env)

`VAULT_ENCRYPTION_KEY`, `VERCEL_BEARER_TOKEN`, `VERCEL_PROJECT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ZONE_ID`, `GOOGLE_ANALYTICS_PROPERTY_ID`, `GOOGLE_ANALYTICS_SA_JSON_B64`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` + the Neon integration vars (`DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_AUTH_BASE_URL`, `VITE_NEON_AUTH_URL`).
