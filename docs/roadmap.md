# Roadmap

Derived from [roadmap/outline.md](roadmap/outline.md) + the 2026-08-30 verification pass. Ordered by what unblocks what. Full evidence in [verification/2026-08-30-verification-report.md](verification/2026-08-30-verification-report.md).

## R1 — Unblock the jamesnavinhill18@gmail.com accounts ✅ DONE (2026-08-30 evening)

- [x] **Vercel**: device-flow `vercel login` completed as `jamesnavinhill`; personal token promoted to `.auth/env/.env.canonical` as `VERCEL_JNH_TOKEN` and verified reading `jameshill/nlytx`. The app's `VERCEL_BEARER_TOKEN` now uses it.
- [x] **Neon**: no new management key needed — the Neon → Vercel integration env (`DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_AUTH_BASE_URL`) was pulled and verified live. The old `re_5…` value was a Resend key, not Neon.

## R2 — Make the live site serve the real app

- [ ] Add `@vercel/analytics` (outline requirement; also missing locally).
- [ ] Deploy the Express API as Vercel functions (or split hosting per [deployment.md](deployment.md)) so `/api/*` stops returning NOT_FOUND. Add `vercel.json`.
- [ ] Mirror `.env` into Vercel project env vars — visible, not hidden (outline requirement).

## R3 — Real data plane *(the big one)*

The outline says "Nothing mocked". Today the provider services validate credentials and then render synthetic numbers (details: [architecture.md § Data plane reality](architecture.md#data-plane-reality)).

- [ ] Wire the **fetched** payloads through the unified schema: Cloudflare GraphQL `httpRequests1dGroups` (already queried, currently discarded), Vercel Web Analytics endpoints (`/v1/web/analytics/stats`, `/v1/web/insights/stats` — spec in `_legacy/research/web-analytics-integrations.md`), GA4 `runReport`.
- [ ] Replace the AWS stub (`aws-infra.service.ts` only checks the key prefix) with real EC2 `describe-instances` + CloudWatch metric queries — the `nlytx-telemetry` IAM user already has exactly these scopes.
- [ ] Real tunnels/workers metrics for Cloudflare-infra beyond the liveness probe.
- [ ] Keep `telemetry-generator*.service.ts` as the demo mode for anonymous visitors (outline: "keep Demo Data for the public site") — make it explicit: demo without auth, live with auth.

## R4 — Auth

- [ ] Neon Auth login (JWKS is already live; add session handling + a login UI).
- [ ] Persist per-user account/credential bindings (the vault is in-memory today; a restart wipes saved accounts — persistence needs the Neon db).
- [ ] Marketing page (outline: "small clean marketing page") as the public landing; dashboard behind it.

## R5 — Infrastructure provisioning (outline "Planned Next")

- [ ] Oracle x2 — **no OCI credentials exist on disk anywhere** (checked 2026-08-30); mint before provisioning.
- [ ] Galaxy x2 (litellm, mcp) and AWS langfuse instance — bring `.env`s over from on-disk creds per outline.
- [ ] Fold these instances into the infrastructure dashboard via the existing provider-service pattern once creds exist.

## R6 — Hygiene

- [x] Fix env import-order bug in `server.ts` (done 2026-08-30).
- [x] Replace mislabeled `AWS_*` Neon S3 keys with `NEON_S3_*` (done).
- [ ] Delete stale `~/.aws-keys/credentials/admin_accessKeys.csv` (rotated, fails STS).
- [ ] Commit the working tree (server.ts fix, `.env.example`, docs, moved legacy docs).
- [ ] Future milestones carried from legacy docs: K8s telemetry (EKS/GKE/OKE), anomaly detection, incident webhooks.
