# Changelog: Backend Infrastructure & Vault Hardening

## [2026-08-29] Backend Infrastructure, Secure Vault & High Density Mobile Polish

### Added
- **AES-256-GCM Secure Credential Vault**: In-memory encrypted store for API tokens with dynamic IVs, HMAC auth tags, and automatic discovery of environment variables (`VERCEL_BEARER_TOKEN`, `CLOUDFLARE_API_TOKEN`, `GOOGLE_ANALYTICS_PROPERTY_ID`).
- **Telemetry Cache Engine**: Fast in-memory cache with TTL and deterministic key hashing to eliminate provider rate limiting.
- **Provider Modules**: Production implementations for Vercel REST API, Cloudflare GraphQL Analytics, and Google Analytics Data API.
- **Synchronization Route**: Dedicated `POST /api/analytics/sync` endpoint with explicit cache invalidation and latency tracking.
- **Mobile Responsive Drawer**: Fluid slide-out navigation with backdrop and touch-optimized hit areas.
- **Clean Simple Menu Flow**: Refined profile avatar dropdown consolidating account switching, light/dark themes, sync triggers, and the Control Matrix.
