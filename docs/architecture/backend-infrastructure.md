# Backend Infrastructure & Telemetry Architecture

## Executive Summary
This document details the production backend infrastructure for the Unified Web Analytics Dashboard. It describes the credential isolation, encryption at rest, API integration services for Vercel, Cloudflare, and Google Analytics 4, as well as the caching layer and synchronization triggers.

## 1. Cryptographic Credential Vault
- **Algorithm**: AES-256-GCM authenticated encryption with 96-bit random IVs and 128-bit authentication tags.
- **Key Derivation**: SHA-256 derived master key from the `VAULT_ENCRYPTION_KEY` environment variable.
- **Security Boundary**: Raw API keys are never exposed to client-side code; client APIs only interact with sanitized resource references (`id`, `name`, `hasKey`, `isLiveConnected`).

## 2. Multi-Provider Ingestion Engine
- **Vercel**: REST client querying project and deployment status via `/v9/projects/{id}` and `/v6/deployments`.
- **Cloudflare**: GraphQL Analytics client querying `httpRequests1dGroups` and zone health verification `/client/v4/zones/{zoneId}`.
- **Google Analytics 4**: GA4 Data API client calling `/v1beta/properties/{propertyId}:runReport` with dimension and metric aggregation.

## 3. High-Efficiency In-Memory Caching & Sync
- **Cache Strategy**: Keyed by `provider::accountId::timeRange` with a 60-second TTL to avoid API rate limiting.
- **Synchronization**: Triggered via `POST /api/analytics/sync` or manual interface refresh, clearing cached entries and requesting live provider updates.
