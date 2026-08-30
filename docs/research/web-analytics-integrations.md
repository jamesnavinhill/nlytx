# Research: Modern Web Analytics API Integrations

## Executive Summary
This document provides production-grade technical specifications for unifying web analytics across top-tier infrastructure and analytics providers: Vercel Web Analytics, Cloudflare GraphQL/REST Analytics, and Google Analytics 4 (GA4).

## 1. Vercel Web Analytics & Speed Insights
- **API Surface**: Vercel REST API v1 (`https://api.vercel.com`)
- **Key Endpoints**:
  - `GET /v1/projects`: List configured deployments and project IDs
  - `GET /v1/web/analytics/stats`: Realtime & aggregated metrics (views, unique visitors, bounces)
  - `GET /v1/web/analytics/top-paths`: URL routing telemetry
  - `GET /v1/web/insights/stats`: Real user monitoring (RUM), Web Vitals (LCP, FID, CLS, INP, TTFB)
- **Auth Model**: Bearer Token (`Authorization: Bearer <VERCEL_TOKEN>`)
- **Rate Limits**: 100 requests / minute per token

## 2. Cloudflare Analytics Engine & GraphQL API
- **API Surface**: Cloudflare GraphQL Analytics API (`https://api.cloudflare.com/client/v4/graphql`)
- **Dataset Models**:
  - `httpRequests1mGroups` / `httpRequests1hGroups` / `httpRequests1dGroups`:
    - Total requests, unique IPs, bytes transmitted
    - HTTP status distribution (2xx, 3xx, 4xx, 5xx)
    - Cache hit/miss ratio (`cacheStatus`)
    - Security events and WAF threat mitigation
- **Auth Model**: Scoped API Token (`Authorization: Bearer <CF_API_TOKEN>`) with Zone ID targeting.

## 3. Google Analytics 4 (GA4) Data API
- **API Surface**: Google Analytics Data API v1beta (`https://analyticsdata.googleapis.com/v1beta/properties/{propertyId}:runReport`)
- **Metrics**: `activeUsers`, `screenPageViews`, `sessions`, `bounceRate`, `averageSessionDuration`, `conversions`
- **Dimensions**: `date`, `hour`, `country`, `deviceCategory`, `pagePath`
- **Auth Model**: Google OAuth2 Bearer Token / Service Account JWT.

## 4. Dither Rendering Paradigm
- Dithering algorithms (Bayer Matrix Ordered, Floyd-Steinberg Error Diffusion, Atkinson, Blue Noise Grid) convert continuous density fields into crisp pixel-grid dot distributions.
- Enables retro-futuristic, high-contrast, zero-blur visualization across light and dark displays.
