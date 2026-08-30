# Nlytx — Unified Web Analytics

Distracting-free analytics dashboard with a dither-chart visual engine for Vercel, Cloudflare, and Google Analytics, plus multi-cloud infrastructure telemetry (AWS EC2, Cloudflare Zero Trust/Workers, Oracle OCI). Built on React 19 + Vite + Express, originally scaffolded on AI Studio, now developed and deployed from this repo.

**Live:** https://nlytx.navinhill.com (Vercel, static shell — see [deployment.md](deployment.md))

## Status snapshot — verified 2026-08-30

| Area | State |
| --- | --- |
| Build / lint / boot | ✅ Clean (`bun run lint`, `bun run build`, `bun run dev`) |
| Public demo data | ✅ Working — synthetic telemetry generator serves the whole UI with zero credentials |
| Cloudflare analytics | ✅ **Live data path verified** — real GraphQL + zone API, resolves `navinhill.com` |
| Cloudflare infra probe | ✅ Live — tunnels + workers APIs authenticate |
| AWS credentials | ✅ Live — scoped IAM user `nlytx-telemetry` (EC2 + CloudWatch read-only), STS-verified |
| Vercel credentials | ✅ Personal-account token verified — reads `jameshill/nlytx` (device-flow login 2026-08-30) |
| Google Analytics 4 | ⚠️ SA → Admin API + Data API verified (property `properties/503127554`); the app service still needs runtime SA-JWT minting |
| Neon auth/db | ✅ Provisioned & verified live — `DATABASE_URL` connects (`neondb`), Neon Auth endpoint reachable; app code still to be wired (R4) |
| Oracle OCI | ❌ No credentials on disk — view runs on demo data |
| Live deployment API | ❌ Static-only deploy — `/api/*` returns NOT_FOUND; `@vercel/analytics` not installed |
| Auth UI / marketing page | ❌ Not built yet |

**Known honesty note:** every provider service currently validates credentials with a real API call, then *discards the fetched numbers* and renders synthetic telemetry. The changelog entries in `.changelog/` (from earlier sessions) oversell this as "production implementations". See [architecture.md § Data plane reality](architecture.md#data-plane-reality) and [roadmap.md](roadmap.md).

## Docs map

| Doc | Contents |
| --- | --- |
| [architecture.md](architecture.md) | System architecture, request flow, service-by-service reality check |
| [environment.md](environment.md) | Every env key: purpose, provenance, live verification status |
| [deployment.md](deployment.md) | GitHub → Vercel pipeline, domain wiring, what the live deployment serves |
| [roadmap.md](roadmap.md) | Next build items + succinct unblock list |
| [verification/2026-08-30-verification-report.md](verification/2026-08-30-verification-report.md) | Full evidence log of the 2026-08-30 verification pass |
| [roadmap/outline.md](roadmap/outline.md) | Original project brief (source of truth for intent) |
| [_legacy/](_legacy) | Pre-2026-08-30 docs kept for history — marketing-flavored, do not trust for current facts |

## Commands

```bash
bun install        # install
bun run dev        # Express + Vite dev server on :3000
bun run lint       # tsc --noEmit
bun run build      # vite build + esbuild server bundle → dist/
bun run start      # node dist/server.cjs (production mode)
```

## Credential canon

Secrets are never hand-copied into repos. The canonical store is `C:\Users\james\projects\.auth` (`env/.env.canonical` for verified keys, `env/.env.legacy` for unverified). Repos receive gitignored projections. Nlytx's `.env` is such a projection — see [environment.md](environment.md).
