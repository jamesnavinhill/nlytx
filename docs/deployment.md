# Deployment

Verified 2026-08-30. Account mapping comes from [roadmap/outline.md](roadmap/outline.md).

## Pipeline

```
this repo ──push──► github.com/jamesnavinhill/nlytx (main)
                        │  (Vercel GitHub integration, jamesnavinhill18@gmail.com account)
                        ▼
              Vercel project prj_M20YXbR6g9k5VzIXQfoaCnv5ihTL
                        ▼
              https://nlytx.navinhill.com
              (DNS: Cloudflare zone navinhill.com, zone id 1d561b7ab18fb22c3ecf01acc2210788 → Vercel)
```

- **GitHub source account**: jamesnavinhill18@gmail.com — `gh` CLI is authed as `jamesnavinhill`; repo was renamed `Analytics` → `nlytx`.
- **Vercel host account**: jamesnavinhill18@gmail.com (per outline: "subdomain host"). The `vercel` CLI on this machine is authed as **james@jami.studio (studio-jami)** — a different account. No token for the personal account exists on disk, so the deployment cannot be inspected or managed via CLI yet (unblock item R1).
- **DNS**: managed at Cloudflare under james@jami.studio. `nlytx.navinhill.com` → Vercel anycast (216.198.79.65 / 64.29.17.65); apex `navinhill.com` → 76.76.21.21 (also Vercel).

## What the live deployment serves today

Checked via HTTP on 2026-08-30 ~03:27 UTC:

- ✅ `GET /` → 200, the React dashboard shell ("Unified Web Analytics"), deployed minutes before the check (GitHub auto-deploy working).
- ❌ `GET /api/health`, `GET /api/analytics/data` → Vercel `NOT_FOUND`. The deployment is **static-only**: `server.ts` (Express) is not deployed as serverless functions, and there is no `api/` directory or `vercel.json` in the repo.
- ❌ `@vercel/analytics` is not installed and no `_vercel-insights` script is emitted (outline requires it).

## Making the API live (the missing half)

The production build already bundles the Express server (`bun run build` → `dist/server.cjs`), but Vercel's current project settings run a static Vite build only. Two viable shapes, decide when building roadmap item R2:

1. **Vercel functions**: move the three route groups into an `api/` directory (Vercel Node functions) or a single catch-all `api/[...path].ts` wrapping the Express app. Add `vercel.json` rewrites so `/api/*` hits the function and everything else falls through to the SPA.
2. **Different host for the API**: keep Vercel static for the UI and run `dist/server.cjs` on one of the planned instances (Oracle/AWS), proxying through Cloudflare. Matches the outline's "Current Live: Cloudflare Gateway/Tunnel + AWS" pattern.

Either way, credentials must be re-provisioned as Vercel env vars (mirroring `.env`) — note the cross-account Vercel token issue in [environment.md](environment.md) applies to `VERCEL_BEARER_TOKEN` in production too.

## Deployment hygiene

- Repo has no `vercel.json`; framework detection is treating this as a static Vite project. Adding it (or an `api/` dir) is part of R2.
- `bun.lock` has local modifications; commit alongside the next code change.
- Root user (463183324956) keys stay out of the repo; the app uses the scoped `nlytx-telemetry` IAM user.
