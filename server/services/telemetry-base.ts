import {
  ProviderType,
  TimeRange,
  UnifiedAnalyticsData,
  MetricSummary,
} from '../../src/types/analytics';
import {
  UnifiedInfraData,
  InfraProviderType,
  InfraMetricSummary,
} from '../../src/types/infrastructure';

export function emptySummary(): MetricSummary {
  return {
    totalVisitors: 0,
    totalPageviews: 0,
    bounceRate: 0,
    avgSessionDuration: 0,
    bandwidthBytes: 0,
    cacheHitRatio: 0,
    requestCount: 0,
    threatsBlocked: 0,
    errorRate: 0,
    visitorsChange: 0,
    pageviewsChange: 0,
  };
}

export function buildEmptyAnalyticsPayload(
  provider: ProviderType,
  accountId: string,
  accountName: string,
  targetResource: string,
  timeRange: TimeRange
): UnifiedAnalyticsData {
  return {
    provider,
    accountId,
    accountName,
    targetResource,
    timeRange,
    isLive: false,
    lastUpdated: new Date().toISOString(),
    summary: emptySummary(),
    timeSeries: [],
    topPaths: [],
    geoDistribution: [],
    devices: [],
    statusCodes: { status2xx: 0, status3xx: 0, status4xx: 0, status5xx: 0 },
    webVitals: {
      lcp: { value: 0, unit: 'ms', rating: 'good' },
      cls: { value: 0, unit: '', rating: 'good' },
      inp: { value: 0, unit: 'ms', rating: 'good' },
      fid: { value: 0, unit: 'ms', rating: 'good' },
      ttfb: { value: 0, unit: 'ms', rating: 'good' },
    },
  };
}

export function buildEmptyInfraPayload(
  provider: InfraProviderType,
  accountId: string,
  accountName: string,
  region: string
): UnifiedInfraData {
  const summary: InfraMetricSummary = {
    totalInstances: 0,
    healthyInstances: 0,
    totalTunnels: 0,
    healthyTunnels: 0,
    totalWorkers: 0,
    workerRequestsPerSec: 0,
    avgCpuUtilization: 0,
    avgMemoryUtilization: 0,
    activeAlertsCount: 0,
  };
  return {
    provider,
    accountId,
    accountName,
    region,
    isLive: false,
    lastUpdated: new Date().toISOString(),
    summary,
    awsInstances: [],
    cloudflareTunnels: [],
    cloudflareWorkers: [],
    oracleInstances: [],
    infraLogs: [],
    timeSeries: [],
  };
}

export function timeRangeWindow(timeRange: TimeRange): { days: number; startDate: string; endDate: string; sinceMs: number; untilMs: number } {
  const days = timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
  const untilMs = Date.now();
  const sinceMs = untilMs - days * 24 * 60 * 60 * 1000;
  const iso = (ms: number) => new Date(ms).toISOString().split('T')[0];
  return { days, startDate: iso(sinceMs), endDate: iso(untilMs), sinceMs, untilMs };
}
