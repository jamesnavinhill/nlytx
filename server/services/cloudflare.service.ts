import { TimeRange, UnifiedAnalyticsData, TimeSeriesPoint } from '../../src/types/analytics';
import { generateSyntheticTelemetry } from './telemetry-generator.service';
import { buildEmptyAnalyticsPayload, timeRangeWindow } from './telemetry-base';

interface CfDayGroup {
  dimensions: { date: string };
  sum: {
    requests: number;
    bytes: number;
    pageViews: number;
    threats: number;
    cachedRequests?: number;
  };
  uniq?: { uniques: number };
}

interface CfStatusGroup {
  dimensions: { edgeResponseStatusName?: string };
  sum: { requests: number };
}

export async function fetchCloudflareAnalytics(
  token: string,
  zoneId: string,
  timeRange: TimeRange,
  accountName: string,
  accountId: string
): Promise<UnifiedAnalyticsData> {
  const targetZone = zoneId?.trim() || '';

  // The zone-analytics token is scoped differently from the account token used
  // for tunnels/workers — prefer it for GraphQL when present.
  const effectiveToken = process.env.CLOUDFLARE_ZONE_ANALYTICS_TOKEN?.trim() || token?.trim();

  if (!effectiveToken || !targetZone || targetZone.startsWith('zone_')) {
    return generateSyntheticTelemetry('cloudflare', accountId, accountName, targetZone, timeRange, false);
  }

  try {
    const headers = {
      Authorization: `Bearer ${effectiveToken}`,
      'Content-Type': 'application/json',
    };

    const win = timeRangeWindow(timeRange);
    const since2x = new Date(Date.now() - win.days * 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Zone identity (name) — also acts as the credential liveness check
    let zoneName = accountName;
    const zoneRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(targetZone)}`, {
      headers,
      signal: AbortSignal.timeout(8000),
    });
    if (zoneRes.ok) {
      const zoneJson = await zoneRes.json();
      if (zoneJson.result?.name) zoneName = zoneJson.result.name;
    } else {
      return generateSyntheticTelemetry('cloudflare', accountId, accountName, targetZone, timeRange, false);
    }

    // Real zone analytics: fetch 2x window so period-over-period change is computable
    const query = `
      query ZoneAnalytics($zoneTag: String!, $since: Date!, $until: Date!) {
        viewer {
          zones(filter: { zoneTag: $zoneTag }) {
            httpRequests1dGroups(limit: 200, filter: { date_geq: $since, date_lt: $until }, orderBy: [date_ASC]) {
              dimensions { date }
              sum { requests bytes pageViews threats cachedRequests }
              uniq { uniques }
            }
          }
        }
      }`;

    const gqlRes = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables: { zoneTag: targetZone, since: since2x, until: win.endDate } }),
      signal: AbortSignal.timeout(12000),
    });

    if (!gqlRes.ok) {
      return generateSyntheticTelemetry('cloudflare', accountId, zoneName, targetZone, timeRange, false);
    }
    const gqlJson = await gqlRes.json();
    if (gqlJson.errors && !(gqlJson.data?.viewer?.zones?.[0]?.httpRequests1dGroups ?? []).length) {
      // Token lacks zone analytics scope — fall back to demo rather than empty "live" data
      console.warn('[Cloudflare Service] GraphQL authz error:', gqlJson.errors[0]?.message);
      return generateSyntheticTelemetry('cloudflare', accountId, zoneName, targetZone, timeRange, false);
    }
    const groups: CfDayGroup[] = gqlJson.data?.viewer?.zones?.[0]?.httpRequests1dGroups ?? [];

    const payload = buildEmptyAnalyticsPayload('cloudflare', accountId, zoneName, targetZone, timeRange);
    payload.isLive = true;

    const current = groups.filter((g) => g.dimensions.date >= win.startDate);
    const previous = groups.filter((g) => g.dimensions.date < win.startDate);

    for (const g of current) {
      const bytesMb = (g.sum.bytes ?? 0) / (1024 * 1024);
      payload.timeSeries.push({
        timestamp: new Date(`${g.dimensions.date}T00:00:00Z`).toISOString(),
        formattedTime: new Date(`${g.dimensions.date}T00:00:00Z`).toLocaleDateString([], { month: 'short', day: 'numeric' }),
        visitors: g.uniq?.uniques ?? 0,
        pageviews: g.sum.pageViews ?? 0,
        requests: g.sum.requests ?? 0,
        bandwidthMb: parseFloat(bytesMb.toFixed(2)),
        cacheHits: g.sum.cachedRequests ?? 0,
        errors: 0,
      } satisfies TimeSeriesPoint);
    }

    const sumOf = (arr: CfDayGroup[], pick: (g: CfDayGroup) => number) => arr.reduce((a, g) => a + (pick(g) || 0), 0);
    const curReq = sumOf(current, (g) => g.sum.requests ?? 0);
    const curCache = sumOf(current, (g) => g.sum.cachedRequests ?? 0);
    const prevReq = sumOf(previous, (g) => g.sum.requests ?? 0);
    const curUniq = sumOf(current, (g) => g.uniq?.uniques ?? 0);
    const prevUniq = sumOf(previous, (g) => g.uniq?.uniques ?? 0);
    const curPv = sumOf(current, (g) => g.sum.pageViews ?? 0);
    const prevPv = sumOf(previous, (g) => g.sum.pageViews ?? 0);

    payload.summary = {
      totalVisitors: curUniq,
      totalPageviews: curPv,
      bounceRate: 0, // not exposed by zone analytics
      avgSessionDuration: 0,
      bandwidthBytes: sumOf(current, (g) => g.sum.bytes ?? 0),
      cacheHitRatio: curReq > 0 ? parseFloat(((curCache / curReq) * 100).toFixed(1)) : 0,
      requestCount: curReq,
      threatsBlocked: sumOf(current, (g) => g.sum.threats ?? 0),
      errorRate: 0, // filled from status breakdown below when available
      visitorsChange: prevUniq > 0 ? parseFloat((((curUniq - prevUniq) / prevUniq) * 100).toFixed(1)) : 0,
      pageviewsChange: prevPv > 0 ? parseFloat((((curPv - prevPv) / prevPv) * 100).toFixed(1)) : 0,
    };
    void prevReq;

    // Status-code distribution (best effort; some datasets reject the dimension)
    try {
      const statusQuery = `
        query ZoneStatus($zoneTag: String!, $since: Date!, $until: Date!) {
          viewer {
            zones(filter: { zoneTag: $zoneTag }) {
              httpRequests1dGroups(limit: 200, filter: { date_geq: $since, date_lt: $until }, orderBy: [date_ASC]) {
                dimensions { edgeResponseStatusName }
                sum { requests }
              }
            }
          }
        }`;
      const statusRes = await fetch('https://api.cloudflare.com/client/v4/graphql', {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: statusQuery, variables: { zoneTag: targetZone, since: win.startDate, until: win.endDate } }),
        signal: AbortSignal.timeout(12000),
      });
      if (statusRes.ok) {
        const statusJson = await statusRes.json();
        const statusGroups: CfStatusGroup[] = statusJson.data?.viewer?.zones?.[0]?.httpRequests1dGroups ?? [];
        let s2 = 0, s3 = 0, s4 = 0, s5 = 0;
        for (const g of statusGroups) {
          const code = parseInt(g.dimensions.edgeResponseStatusName ?? '0', 10);
          if (code >= 200 && code < 300) s2 += g.sum.requests;
          else if (code >= 300 && code < 400) s3 += g.sum.requests;
          else if (code >= 400 && code < 500) s4 += g.sum.requests;
          else if (code >= 500) s5 += g.sum.requests;
        }
        payload.statusCodes = { status2xx: s2, status3xx: s3, status4xx: s4, status5xx: s5 };
        const total = s2 + s3 + s4 + s5;
        if (total > 0) {
          payload.summary.errorRate = parseFloat((((s4 + s5) / total) * 100).toFixed(2));
          for (const ts of payload.timeSeries) {
            ts.errors = Math.round(((s4 + s5) / total) * ts.requests);
          }
        }
      }
    } catch {
      // status breakdown optional
    }

    return payload;
  } catch (error) {
    console.error('[Cloudflare Service] API query failed:', error);
    return generateSyntheticTelemetry('cloudflare', accountId, accountName, targetZone, timeRange, false);
  }
}
