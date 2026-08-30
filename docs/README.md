# Nlytx — Unified Web Analytics

Distraction-free analytics dashboard with a dither-chart visual engine for Vercel, Cloudflare, and Google Analytics, plus multi-cloud infrastructure telemetry (AWS EC2, Cloudflare Zero Trust/Workers, Oracle OCI). React 19 + Vite + Express, deployed as Vercel static SPA + Node API function, with Neon Postgres auth and persistence.

**Live:** https://nlytx.navinhill.com

## Status snapshot — verified 2026-08-30 (post-deploy)

| Area | State |
| --- | --- |
| Production deployment | ✅ Live — static SPA + `/api/*` Vercel function (same origin), SPA fallback working |
| Real data plane | ✅ **Live data**: AWS EC2+CloudWatch (fleet CPU, status, network), Cloudflare tunnels/workers (real counts + invocation metrics), GA4 `runReport` (runtime SA-JWT), Vercel Web Analytics (live project identity; view counters fill as traffic accrues). Synthetic generator remains as demo fallback |
| Cloudflare zone analytics | ⚠️ Token lacks `Zone Analytics Read` scope — falls back to demo until a scoped token exists (only unowned credential left) |
| Neon auth + persistence | ✅ Live on prod — email/password accounts, sessions, and saved provider accounts persist in Neon Postgres |
| @vercel/analytics | ✅ Installed and serving (`/_vercel/insights/script.js` 200) |
| Demo data for public site | ✅ Anonymous visitors get the full UI; login only gates persistence |
| Oracle OCI | ❌ No credentials on disk — view runs on demo data |
| Marketing page | ❌ Not built (dashboard serves as landing) |

See [verification/2026-08-30-verification-report.md](verification/2026-08-30-verification-report.md) for the full evidence log and [roadmap.md](roadmap.md) for what remains.

## Architecture at a glance

```
Browser ──► nlytx.navinhill.com (Vercel)
             ├─ static SPA (Vite build)            — React dashboard, dither charts
             ├─ /api/* → api/index.js function     — Express app (server/app.ts, prebundled CJS)
             │     ├─ /api/analytics  … Vercel / Cloudflare / GA4 connectors
             │     ├─ /api/infrastructure … AWS EC2+CloudWatch / CF tunnels+workers / OCI
             │     ├─ /api/accounts   … credential vault + per-user persistence
             │     └─ /api/auth       … Neon Postgres sessions (scrypt, httpOnly cookies)
             └─ GitHub auto-deploy from jamesnavinhill/nlytx (main)
```

## Docs map

| Doc | Contents |
| --- | --- |
| [architecture.md](architecture.md) | System architecture, request flow, service-by-service notes |
| [environment.md](environment.md) | Every env key: purpose, provenance, live verification status |
| [deployment.md](deployment.md) | GitHub → Vercel pipeline, domain wiring, function packaging notes |
| [roadmap.md](roadmap.md) | Remaining build items + unblock list |
| [verification/2026-08-30-verification-report.md](verification/2026-08-30-verification-report.md) | Full evidence log of the verification passes |
| [roadmap/outline.md](roadmap/outline.md) | Original project brief (source of truth for intent) |
| [_legacy/](_legacy) | Pre-2026-08-30 docs kept for history — marketing-flavored, do not trust for current facts |

## Commands

```bash
bun install        # install
bun run dev        # Express + Vite dev server on :3000
bun run lint       # tsc --noEmit
bun run build      # vite build + esbuild server bundle + esbuild api function bundle
bun run start      # node dist/server.cjs (production mode, local)
```

## Credential canon

Secrets are never hand-copied into repos. The canonical store is `C:\Users\james\projects\.auth` (`env/.env.canonical` for verified keys, `env/.env.legacy` for unverified). Repos receive gitignored projections. Nlytx's `.env` is such a projection; the same values are configured as Vercel project env vars — see [environment.md](environment.md).
