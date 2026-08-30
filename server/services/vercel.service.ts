import { TimeRange, UnifiedAnalyticsData, TimeSeriesPoint } from '../../src/types/analytics';
import { generateSyntheticTelemetry } from './telemetry-generator.service';
import { buildEmptyAnalyticsPayload, timeRangeWindow } from './telemetry-base';
import { VercelSite } from './vercel-sites.service';

const API = 'https://api.vercel.com';

interface VisitRow {
  timestamp: string;
  visitors: number;
  pageviews: number;
}

/**
 * Web Analytics via /v1/query/web-analytics/visits/aggregate (the current
 * official query API — the legacy /v1/web/analytics/stats endpoint is dead).
 * Accepts either a bare token+projectId pair or a discovered VercelSite
 * (which carries its own token + teamId).
 */
export async function fetchVercelAnalytics(
  tokenOrSite: string | VercelSite,
  projectIdOrFallback: string,
  timeRange: TimeRange,
  accountName: string,
  accountId: string
): Promise<UnifiedAnalyticsData> {
  const site = typeof tokenOrSite === 'object' ? tokenOrSite : undefined;
  const token = (typeof tokenOrSite === 'object' ? tokenOrSite.token : tokenOrSite)?.trim();
  const projectId = (site ? site.projectId : projectIdOrFallback)?.trim();
  const teamId = site?.teamId;
  const displayName = site?.name ?? accountName;

  if (!token || !projectId || !projectId.startsWith('prj_')) {
    return generateSyntheticTelemetry('vercel', accountId, displayName, projectId, timeRange, false);
  }

  try {
    const win = timeRangeWindow(timeRange);
    // Vercel (hobby plan) only grants the latest 31 days of web analytics data
    const earliestAllowed = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const sinceMs = Math.max(Date.now() - win.days * 2 * 24 * 60 * 60 * 1000, earliestAllowed);
    const since2x = new Date(sinceMs).toISOString();

    const aggregate = async (sinceIso: string): Promise<{ rows: VisitRow[]; authed: boolean }> => {
      const qs = new URLSearchParams({
        projectId,
        since: sinceIso,
        until: new Date(win.untilMs).toISOString(),
        by: 'day',
        limit: String(Math.max(win.days * 2 + 1, 31)),
      });
      if (teamId) qs.set('teamId', teamId);
      const res = await fetch(`${API}/v1/query/web-analytics/visits/aggregate?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) {
        // 400/403 typically means Web Analytics is not enabled on the project
        return { rows: [], authed: res.ok };
      }
      const json = await res.json();
      return { rows: json.data ?? [], authed: true };
    };

    // One call spans 2x window; split rows into current vs previous period
    const cur = await aggregate(since2x);

    if (!cur.authed && cur.rows.length === 0) {
      // Analytics not enabled for this project — honest zero view, still a real project
      const payload = buildEmptyAnalyticsPayload('vercel', accountId, displayName, projectId, timeRange);
      return payload;
    }

    const startBoundary = new Date(Date.now() - win.days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const curRows = cur.rows.filter((r) => r.timestamp.slice(0, 10) >= startBoundary);
    const prevRows = cur.rows.filter((r) => r.timestamp.slice(0, 10) < startBoundary);

    const payload = buildEmptyAnalyticsPayload('vercel', accountId, displayName, projectId, timeRange);
    payload.isLive = true;

    payload.timeSeries = curRows.map((r) => {
      const d = new Date(r.timestamp);
      return {
        timestamp: d.toISOString(),
        formattedTime: d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        visitors: r.visitors ?? 0,
        pageviews: r.pageviews ?? 0,
        requests: r.pageviews ?? 0,
        bandwidthMb: 0,
        cacheHits: 0,
        errors: 0,
      } satisfies TimeSeriesPoint;
    });

    const sumVisitors = (rows: VisitRow[]) => rows.reduce((a, r) => a + (r.visitors ?? 0), 0);
    const sumPv = (rows: VisitRow[]) => rows.reduce((a, r) => a + (r.pageviews ?? 0), 0);
    const curV = sumVisitors(curRows);
    const curPv = sumPv(curRows);
    const prevV = sumVisitors(prevRows);
    const prevPv = sumPv(prevRows);

    payload.summary.totalVisitors = curV;
    payload.summary.totalPageviews = curPv;
    payload.summary.requestCount = curPv;
    payload.summary.visitorsChange = prevV > 0 ? parseFloat((((curV - prevV) / prevV) * 100).toFixed(1)) : 0;
    payload.summary.pageviewsChange = prevPv > 0 ? parseFloat((((curPv - prevPv) / prevPv) * 100).toFixed(1)) : 0;

    return payload;
  } catch (error) {
    console.error('[Vercel Service] query failure:', error);
    return generateSyntheticTelemetry('vercel', accountId, displayName, projectId, timeRange, false);
  }
}
