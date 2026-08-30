import crypto from 'crypto';
import { TimeRange, UnifiedAnalyticsData } from '../../src/types/analytics';
import { generateSyntheticTelemetry } from './telemetry-generator.service';
import { buildEmptyAnalyticsPayload, timeRangeWindow } from './telemetry-base';

const DATA_API = 'https://analyticsdata.googleapis.com/v1beta';

/**
 * GA4 Data API requires OAuth2 — API keys cannot call runReport. We mint an
 * access token from the service-account JSON (GOOGLE_ANALYTICS_SA_JSON_B64,
 * base64 of the key file) with a module-level cache (~50 min of the 1h TTL).
 */
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;

  const raw = process.env.GOOGLE_ANALYTICS_SA_JSON_B64?.trim();
  if (!raw) return null;
  let sa: any;
  try {
    const json = process.env.GOOGLE_ANALYTICS_SA_JSON
      ? process.env.GOOGLE_ANALYTICS_SA_JSON
      : Buffer.from(raw, 'base64').toString('utf8');
    sa = JSON.parse(json);
  } catch (e) {
    console.error('[GA4 Service] malformed service-account payload:', e);
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const b64 = (o: any) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64(header)}.${b64(claim)}`;
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64url');
  const assertion = `${unsigned}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    console.error('[GA4 Service] token exchange failed:', res.status, await res.text().catch(() => ''));
    return null;
  }
  const tokenJson = await res.json();
  cachedToken = { token: tokenJson.access_token, expiresAt: Date.now() + 50 * 60 * 1000 };
  return cachedToken.token;
}

function normalizePropertyId(id: string): string | null {
  const trimmed = id?.trim() ?? '';
  const match = trimmed.match(/(\d+)/);
  return match ? match[1] : null;
}

interface GaRow {
  dimensionValues: { value: string }[];
  metricValues: { value: string }[];
}

export async function fetchGoogleAnalytics(
  _tokenOrKey: string,
  propertyId: string,
  timeRange: TimeRange,
  accountName: string,
  accountId: string
): Promise<UnifiedAnalyticsData> {
  const propId = normalizePropertyId(propertyId);

  if (!propId) {
    return generateSyntheticTelemetry('google', accountId, accountName, propertyId, timeRange, false);
  }

  try {
    const token = await getAccessToken();
    if (!token) {
      return generateSyntheticTelemetry('google', accountId, accountName, propertyId, timeRange, false);
    }

    const win = timeRangeWindow(timeRange);
    const prevStart = new Date(Date.now() - win.days * 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const res = await fetch(`${DATA_API}/properties/${propId}:runReport`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dateRanges: [{ startDate: prevStart, endDate: win.endDate }],
        dimensions: [{ name: 'date' }, { name: 'pagePath' }, { name: 'country' }, { name: 'deviceCategory' }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'screenPageViews' },
          { name: 'sessions' },
          { name: 'bounceRate' },
          { name: 'averageSessionDuration' },
        ],
        limit: 10000,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.error('[GA4 Service] runReport failed:', res.status, await res.text().catch(() => ''));
      return generateSyntheticTelemetry('google', accountId, accountName, propertyId, timeRange, false);
    }

    const json = await res.json();
    const rows: GaRow[] = json.rows ?? [];

    const payload = buildEmptyAnalyticsPayload('google', accountId, accountName, `properties/${propId}`, timeRange);
    payload.isLive = true;

    if (rows.length === 0) {
      // Property exists and is reachable; it simply has no traffic in the window yet.
      return payload;
    }

    const metric = (r: GaRow, i: number) => parseFloat(r.metricValues[i]?.value ?? '0');

    // Aggregate
    const byDay = new Map<string, { visitors: number; pageviews: number }>();
    const byPath = new Map<string, { views: number; sessions: number; bounce: number; duration: number }>();
    const byCountry = new Map<string, number>();
    const byDevice = new Map<string, number>();
    const curRange = (d: string) => d >= win.startDate.replace(/-/g, '');

    let totalVisitors = 0, prevVisitors = 0, totalPv = 0, prevPv = 0;
    let sessionSum = 0, sessionCount = 0, bounceSum = 0, durationSum = 0;

    for (const r of rows) {
      const [date, path, country, device] = r.dimensionValues.map((d) => d.value);
      const visitors = metric(r, 0);
      const pageviews = metric(r, 1);
      const sessions = metric(r, 2);
      const bounce = metric(r, 3);
      const duration = metric(r, 4);
      const isCurrent = curRange(date);

      if (isCurrent) {
        totalVisitors += visitors;
        totalPv += pageviews;
        const day = byDay.get(date) ?? { visitors: 0, pageviews: 0 };
        day.visitors += visitors;
        day.pageviews += pageviews;
        byDay.set(date, day);

        const p = byPath.get(path) ?? { views: 0, sessions: 0, bounce: 0, duration: 0 };
        p.views += pageviews;
        p.sessions += sessions;
        p.bounce += bounce;
        p.duration += duration;
        byPath.set(path, p);

        byCountry.set(country, (byCountry.get(country) ?? 0) + visitors);
        byDevice.set(device, (byDevice.get(device) ?? 0) + visitors);

        if (sessions > 0) {
          sessionSum += sessions;
          sessionCount += 1;
          bounceSum += bounce;
          durationSum += duration;
        }
      } else {
        prevVisitors += visitors;
        prevPv += pageviews;
      }
    }

    payload.timeSeries = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        timestamp: new Date(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T00:00:00Z`).toISOString(),
        formattedTime: new Date(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T00:00:00Z`).toLocaleDateString([], { month: 'short', day: 'numeric' }),
        visitors: v.visitors,
        pageviews: v.pageviews,
        requests: v.pageviews,
        bandwidthMb: 0,
        cacheHits: 0,
        errors: 0,
      }));

    payload.topPaths = [...byPath.entries()]
      .sort(([, a], [, b]) => b.views - a.views)
      .slice(0, 10)
      .map(([path, p]) => ({
        path,
        views: p.views,
        uniqueVisitors: p.sessions,
        avgDurationSec: p.sessions > 0 ? Math.round(p.duration / p.sessions) : 0,
        bounceRate: p.sessions > 0 ? parseFloat(((p.bounce / p.sessions) * 100).toFixed(1)) : 0,
      }));

    const countryNames: Record<string, string> = {};
    const totalGeo = [...byCountry.values()].reduce((a, b) => a + b, 0) || 1;
    payload.geoDistribution = [...byCountry.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([code, visitors]) => ({
        countryCode: code,
        countryName: countryNames[code] ?? code,
        visitors,
        percentage: parseFloat(((visitors / totalGeo) * 100).toFixed(1)),
      }));

    const totalDev = [...byDevice.values()].reduce((a, b) => a + b, 0) || 1;
    payload.devices = [...byDevice.entries()].map(([device, count]) => ({
      device,
      count,
      percentage: parseFloat(((count / totalDev) * 100).toFixed(1)),
    }));

    payload.summary = {
      totalVisitors,
      totalPageviews: totalPv,
      bounceRate: sessionCount > 0 ? parseFloat(((bounceSum / sessionCount) * 100).toFixed(1)) : 0,
      avgSessionDuration: sessionCount > 0 ? Math.round(durationSum / sessionCount) : 0,
      bandwidthBytes: 0,
      cacheHitRatio: 0,
      requestCount: totalPv,
      threatsBlocked: 0,
      errorRate: 0,
      visitorsChange: prevVisitors > 0 ? parseFloat((((totalVisitors - prevVisitors) / prevVisitors) * 100).toFixed(1)) : 0,
      pageviewsChange: prevPv > 0 ? parseFloat((((totalPv - prevPv) / prevPv) * 100).toFixed(1)) : 0,
    };

    return payload;
  } catch (error) {
    console.error('[GA4 Service] query failure:', error);
    return generateSyntheticTelemetry('google', accountId, accountName, propertyId, timeRange, false);
  }
}
