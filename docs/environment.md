# Environment

Every key the app reads, its provenance, and its live verification status from the 2026-08-30 pass. Secrets themselves live in `.env` (gitignored) and are projected from the credential canon at `C:\Users\james\projects\.auth`.

The `.auth` house rule: a key earns a place in canonical env only after a live API read-back. Values from the legacy pool are treated as unverified until proven. This table is the Nlytx-side application of that rule.

## Credential vault

| Key | Provenance | Verified |
| --- | --- | --- |
| `VAULT_ENCRYPTION_KEY` | Generated fresh 2026-08-30 (32-byte hex) | n/a — derives AES-256-GCM master key |

## Analytics providers

| Key | Provenance | Verified | Notes |
| --- | --- | --- | --- |
| `VERCEL_BEARER_TOKEN` | Personal-account CLI token, promoted 2026-08-30 to `.auth/env/.env.canonical` as `VERCEL_JNH_TOKEN` | ✅ `GET /v9/projects/prj_M20…` → `nlytx` | Belongs to **jamesnavinhill18@gmail.com** (via device-flow `vercel login`); the app's Vercel connector uses this one. studio-jami's `VERCEL_ACCESS_TOKEN` remains in canon for that team. |
| `VERCEL_PROJECT_ID` | `docs/roadmap/outline.md` | ✅ live read-back | `prj_M20YXbR6g9k5VzIXQfoaCnv5ihTL` = `jameshill/nlytx`, framework preset Vite |
| `CLOUDFLARE_API_TOKEN` | `.auth/env/.env.canonical` | ✅ zone list + GraphQL + tokens/verify | No DNS-record scope (fine for analytics; blocked DNS edits during verification) |
| `CLOUDFLARE_ACCOUNT_ID` | `.auth/env/.env.canonical` | ✅ via API | jami-studio account |
| `CLOUDFLARE_ZONE_ID` | set 2026-08-30 from zone list | ✅ | `1d561b7ab18fb22c3ecf01acc2210788` = **navinhill.com** |
| `GOOGLE_ANALYTICS_PROPERTY_ID` | discovered 2026-08-30 via SA | ✅ Admin API `accountSummaries` | `properties/503127554` — "marketing" under "jami-studio account" |
| `GOOGLE_ANALYTICS_API_KEY` | — | ⚠️ path verified, key slot unusable | GA Data API requires OAuth/SA JWT (1h TTL); a static env value cannot work. SA: `jami-studio@jami-studio.iam.gserviceaccount.com`, key file `~/.gcloud-keys/jami-studio/jami-studio-edb6bc6e5d8c.json`. GA Data API was **enabled** on GCP project `275024763395` during verification; `runReport` succeeds (0 rows — property has no traffic yet). Needs runtime minting in `google-analytics.service.ts`. |

## Infrastructure providers

| Key | Provenance | Verified | Notes |
| --- | --- | --- | --- |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Created 2026-08-30 | ✅ STS `GetCallerIdentity` | IAM user **nlytx-telemetry** (`arn:aws:iam::463183324956:user/nlytx-telemetry`), policies `AmazonEC2ReadOnlyAccess` + `CloudWatchReadOnlyAccess`. Provisioned with root keys per outline's "provision all accounts as required". |
| `AWS_REGION` | set | ✅ | `us-east-1`; live fleet: 1× t3.small `agency-gateway-aws` (i-09058b290df3d01cc) |
| `CLOUDFLARE_ZERO_TRUST_TOKEN` | falls back to `CLOUDFLARE_API_TOKEN` | ✅ | Tunnels + workers probe authenticates |
| `OCI_TENANCY_OCID` / `OCI_PRIVATE_KEY` | **not on disk anywhere** | ❌ | Oracle view runs on demo data |

## Neon (auth/db) — corrected 2026-08-30 evening: NOT blocked, fully provisioned

The earlier "dead key" conclusion was a wrong-key mixup, and the management key was never the important credential anyway. The live credentials come from the Neon → Vercel integration and are verified:

| Key | Provenance | Verified | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` / `DATABASE_URL_UNPOOLED` | Vercel project env (pulled via `vercel env pull`) | ✅ live connect | `neondb` as `neondb_owner` at `ep-snowy-star-a5kpdfyo...` (us-east-2); db currently empty — auth tables are created on first SDK run |
| `NEON_AUTH_BASE_URL` / `VITE_NEON_AUTH_URL` | Vercel project env | ✅ reachable | Neon Auth (Stack Auth style) service endpoint |
| `NEON_PROJECT_ID` / `NEON_JWKS_URL` | prior session projection | ✅ JWKS live | Serves 1 EdDSA key |
| `NEON_API_KEY` (old value) | prior session projection | ❌ was never a Neon key | Value started with `re_5` = **Resend** key format. Neon keys start with `napi_`. Removed from `.env`. |
| `NEON_PERSONAL_ACCESS_TOKEN` | `.auth/env/.env.legacy` | ✅ | Login `james` / james@jami.studio — the *other* Neon account; kept in legacy pool |
| `NEON_S3_ENDPOINT_URL` / `NEON_S3_ACCESS_KEY_ID` / `NEON_S3_SECRET_ACCESS_KEY` | renamed 2026-08-30 | untested | Previously mislabeled `AWS_*` (`nak_`/`nsk_` keys + S3 endpoint); nothing in the repo reads them |

## Stale/dead keys found during verification

| Key | Where | Status |
| --- | --- | --- |
| `admin_accessKeys.csv` (`AKIAWXV7AU4OI6LLPP4C`) | `~/.aws-keys/credentials/` | ❌ SignatureDoesNotMatch — rotated/stale; delete or replace |
| `NEON_API_KEY` | old Nlytx `.env` | ❌ 401 — re-mint |
| Oracle OCI | — | never existed on disk |

## Rules

1. `.env` is a projection — regenerate it from canon, don't hand-edit secrets in repos.
2. Every new key gets a live read-back before it counts as verified (see [verification/](verification/)).
3. `GEMINI_API_KEY` / `APP_URL` from the AI Studio scaffold are no longer read by the app (no LLM calls by design) and were dropped from `.env`.
