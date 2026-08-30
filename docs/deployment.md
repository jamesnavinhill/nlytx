# Deployment

Verified live 2026-08-30 (post-build). Account mapping comes from [roadmap/outline.md](roadmap/outline.md).

## Pipeline

```
this repo ──push──► github.com/jamesnavinhill/nlytx (main)
                        │  (Vercel GitHub integration, jamesnavinhill18@gmail.com account)
                        ▼
              Vercel project jameshill/nlytx = prj_M20YXbR6g9k5VzIXQfoaCnv5ihTL
              buildCommand: bun run build  (see vercel.json)
                        ▼
              https://nlytx.navinhill.com  (DNS: Cloudflare zone navinhill.com → Vercel)
```

## Production shape (working)

- **Static SPA**: `vite build` → `dist/`, served by Vercel's CDN. SPA fallback via the `((?!api/).*)` rewrite to `/index.html`.
- **API**: `api/index.js` — a **prebundled CommonJS function** (esbuild bundle of `server/api-entry.ts`, which wraps `server/app.ts`). `vercel.json` rewrites `/api/(.*)` → the function. `maxDuration: 15`.
- **Analytics**: `@vercel/analytics` mounted in `src/App.tsx`; script served at `/_vercel/insights/script.js` (verified 200).

### Function packaging — why the prebundle exists (learned the hard way)

The repo root is `"type": "module"`. Vercel's TS compiler then emits ESM for `api/index.ts`, but keeps relative imports extensionless — Node throws `ERR_MODULE_NOT_FOUND` at runtime. Pinning `api/package.json` to `commonjs` made the loader CJS while the compiler still emitted `import` statements → `SyntaxError`. And `.cjs` is not a supported function extension. The reliable setup (current):

1. `server/api-entry.ts` = the function source (TS lives in `server/`, imports extensionless as usual for tsx/esbuild).
2. `bun run build` also runs `esbuild server/api-entry.ts --bundle --platform=node --format=cjs --outfile=api/index.js` (everything bundled, no externals — ~4.7MB).
3. `api/index.js` + `api/package.json` (`{"type":"commonjs"}`) are **committed** so the `functions` pattern matches at source scan time.
4. `api/index.ts` must NOT exist alongside it (conflicting function names error).

If you change any `server/` code, run `bun run build` and commit the regenerated `api/index.js` — or just push; the Vercel build regenerates it identically before packaging.

## Environment

All app credentials are configured as **production** env vars on the project (added via CLI 2026-08-30; list in [roadmap.md](roadmap.md#environment-vars-in-vercel-production-mirror-of-local-env)). Values originate from `C:\Users\james\projects\.auth` canon and mirror the local `.env`. Neon connection vars come from the Neon → Vercel integration.

## Account map

- **GitHub source**: jamesnavinhill18@gmail.com — `gh` CLI authed as `jamesnavinhill`; repo renamed `Analytics` → `nlytx`.
- **Vercel host**: jamesnavinhill18@gmail.com ("jameshill" context). CLI authed via device-flow login; personal API token in canon as `VERCEL_JNH_TOKEN`.
- **DNS**: Cloudflare zone `navinhill.com` (`1d561b7ab18fb22c3ecf01acc2210788`), james@jami.studio. Records are unproxied — traffic goes straight to Vercel's edge (which is why Cloudflare zone analytics sees ~no HTTP traffic for this site).

## Verified live (2026-08-30 ~05:25 UTC)

- `GET /api/health` → 200 JSON
- `GET /api/analytics/data?provider=vercel` → `isLive: true`, project name `nlytx`
- `GET /api/analytics/data?provider=google` → `isLive: true` (real GA4 property)
- `GET /api/infrastructure/data?provider=aws` → `isLive: true`, 1 instance, real CloudWatch CPU 1.2%
- `GET /api/infrastructure/data?provider=cloudflare-infra` → `isLive: true`, real tunnel + worker counts
- `POST /api/auth/register` + `/me` → session cookie issued, `dbConnected: true`
- `GET /some/deep/route` → 200 (SPA fallback)
- `GET /_vercel/insights/script.js` → 200
