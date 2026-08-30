import { TimeRange, UnifiedAnalyticsData, TimeSeriesPoint, WebVitalsMetrics } from '../../src/types/analytics';
import { generateSyntheticTelemetry } from './telemetry-generator.service';
import { buildEmptyAnalyticsPayload, timeRangeWindow } from './telemetry-base';

const API = 'https://api.vercel.com';

function teamQuery(): string {
  return process.env.VERCEL_TEAM_ID ? `&teamId=${process.env.VERCEL_TEAM_ID}` : '';
}

function rate(value: number, unit: 'ms' | 's' | '', good: number, poor: number): { value: number; unit: string; rating: 'good' | 'needs-improvement' | 'poor' } {
  return { value: parseFloat(value.toFixed(unit === '' ? 3 : 0)), unit, rating: value <= good ? 'good' : value <= poor ? 'needs-improvement' : 'poor' };
}

function mapVitals(v: any): WebVitalsMetrics {
  const num = (x: any): number => (typeof x === 'number' ? x : typeof x?.value === 'number' ? x.value : typeof x?.p75 === 'number' ? x.p75 : 0);
  return {
    lcp: rate(num(v?.lcp) || 0, 'ms', 2500, 4000),
    cls: rate(num(v?.cls) || 0, '', 0.1, 0.25),
    inp: rate(num(v?.inp) || num(v?.fid) || 0, 'ms', 200, 500),
    fid: rate(num(v?.fid) || 0, 'ms', 100, 300),
    ttfb: rate(num(v?.ttfb) || 0, 'ms', 800, 1800),
  };
}

interface SeriesStat {
  data?: { x: number; y: number }[];
  total?: number;
}

function seriesTotal(s: SeriesStat | undefined): number {
  if (!s) return 0;
  if (typeof s.total === 'number') return s.total;
  return (s.data ?? []).reduce((a, p) => a + (p.y ?? 0), 0);
}

export async function fetchVercelAnalytics(
  token: string,
  projectId: string,
  timeRange: TimeRange,
  accountName: string,
  accountId: string
): Promise<UnifiedAnalyticsData> {
  const targetId = projectId?.trim() || '';

  if (!token || token.trim().length === 0 || !targetId || !targetId.startsWith('prj_')) {
    return generateSyntheticTelemetry('vercel', accountId, accountName, targetId, timeRange, false);
  }

  try {
    const headers = {
      Authorization: `Bearer ${token.trim()}`,
      'Content-Type': 'application/json',
    };
    const win = timeRangeWindow(timeRange);

    // 1. Project identity — also the credential liveness check
    const projectRes = await fetch(`${API}/v9/projects/${encodeURIComponent(targetId)}?${teamQuery().slice(1)}`, {
      headers,
      signal: AbortSignal.timeout(8000),
    });
    if (!projectRes.ok) {
      return generateSyntheticTelemetry('vercel', accountId, accountName, targetId, timeRange, false);
    }
    const project = await projectRes.json();
    const projectName = project.name || accountName;

    const payload = buildEmptyAnalyticsPayload('vercel', accountId, projectName, targetId, timeRange);
    payload.isLive = true;

    const qs = `projectId=${encodeURIComponent(targetId)}&since=${win.sinceMs}&until=${win.untilMs}${teamQuery()}`;

    // 2. Real Web Analytics stats (views / visitors / bounces) — daily series
    try {
      const statsRes = await fetch(`${API}/v1/web/analytics/stats?${qs}`, { headers, signal: AbortSignal.timeout(12000) });
      if (statsRes.ok) {
        const stats = await statsRes.json();
        const views: SeriesStat = stats?.views;
        const visitors: SeriesStat = stats?.visitors;
        const daily: Record<string, { views: number; visitors: number }> = {};
        for (const p of views?.data ?? []) {
          const day = new Date(p.x).toISOString().split('T')[0];
          daily[day] = { views: (daily[day]?.views ?? 0) + (p.y ?? 0), visitors: daily[day]?.visitors ?? 0 };
        }
        for (const p of visitors?.data ?? []) {
          const day = new Date(p.x).toISOString().split('T')[0];
          daily[day] = { views: daily[day]?.views ?? 0, visitors: (daily[day]?.visitors ?? 0) + (p.y ?? 0) };
        }
        payload.timeSeries = Object.entries(daily)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([day, v]) => ({
            timestamp: new Date(`${day}T00:00:00Z`).toISOString(),
            formattedTime: new Date(`${day}T00:00:00Z`).toLocaleDateString([], { month: 'short', day: 'numeric' }),
            visitors: v.visitors,
            pageviews: v.views,
            requests: v.views,
            bandwidthMb: 0,
            cacheHits: 0,
            errors: 0,
          } satisfies TimeSeriesPoint));

        payload.summary.totalPageviews = seriesTotal(views);
        payload.summary.totalVisitors = seriesTotal(visitors);
        payload.summary.requestCount = seriesTotal(views);
        payload.summary.bounceRate = typeof stats?.bounces?.total === 'number' ? parseFloat((stats.bounces.total * 100).toFixed(1)) : 0;
      }
    } catch (e) {
      console.warn('[Vercel Service] analytics stats unavailable:', e);
    }

    // 3. Real top paths
    try {
      const pathsRes = await fetch(`${API}/v1/web/analytics/top-paths?${qs}&limit=10`, { headers, signal: AbortSignal.timeout(12000) });
      if (pathsRes.ok) {
        const pathsJson = await pathsRes.json();
        const rows: any[] = pathsJson?.topPaths ?? pathsJson?.paths ?? [];
        payload.topPaths = rows.slice(0, 10).map((r) => ({
          path: r.path ?? r.href ?? r.name ?? '(unknown)',
          views: r.total ?? r.views ?? r.count ?? 0,
          uniqueVisitors: r.visitors ?? r.uniqueVisitors ?? 0,
          avgDurationSec: Math.round(r.duration ?? r.avgDuration ?? 0),
          bounceRate: typeof r.bounceRate === 'number' ? parseFloat((r.bounceRate * 100).toFixed(1)) : 0,
        }));
      }
    } catch (e) {
      console.warn('[Vercel Service] top paths unavailable:', e);
    }

    // 4. Real Experience (web vitals) insights
    try {
      const insightsRes = await fetch(`${API}/v1/web/insights/stats?${qs}`, { headers, signal: AbortSignal.timeout(12000) });
      if (insightsRes.ok) {
        const insights = await insightsRes.json();
        if (insights?.vitals) {
          payload.webVitals = mapVitals(insights.vitals);
        }
      }
    } catch (e) {
      console.warn('[Vercel Service] insights unavailable:', e);
    }

    return payload;
  } catch (error) {
    console.error('[Vercel Service] API request failure:', error);
    return generateSyntheticTelemetry('vercel', accountId, accountName, targetId, timeRange, false);
  }
}
