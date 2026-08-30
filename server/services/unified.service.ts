import { TimeRange, UnifiedAnalyticsData, TimeSeriesPoint, GeoDistributionItem, DeviceBreakdownItem } from '../../src/types/analytics';
import { UnifiedInfraData } from '../../src/types/infrastructure';
import { buildEmptyAnalyticsPayload, buildEmptyInfraPayload } from './telemetry-base';

/**
 * Server-side rollups: one merged view across all credentialed provider
 * accounts. Used for the authenticated "unified" dashboard — no account
 * switching. Anonymous visitors get the synthetic demo instead.
 */

function mergeTimeSeries(parts: UnifiedAnalyticsData[]): TimeSeriesPoint[] {
  const byTs = new Map<string, TimeSeriesPoint>();
  for (const part of parts) {
    for (const pt of part.timeSeries) {
      const cur = byTs.get(pt.timestamp);
      if (cur) {
        cur.visitors += pt.visitors;
        cur.pageviews += pt.pageviews;
        cur.requests += pt.requests;
        cur.bandwidthMb = parseFloat((cur.bandwidthMb + pt.bandwidthMb).toFixed(2));
        cur.cacheHits += pt.cacheHits;
        cur.errors += pt.errors;
      } else {
        byTs.set(pt.timestamp, { ...pt });
      }
    }
  }
  return [...byTs.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function mergeAnalyticsPayloads(
  parts: UnifiedAnalyticsData[],
  timeRange: TimeRange
): UnifiedAnalyticsData | null {
  const live = parts.filter((p) => p.isLive);
  if (live.length === 0) return null;

  const payload = buildEmptyAnalyticsPayload('unified', 'acc-unified-all', 'All Accounts', 'all-live-sources', timeRange);
  payload.isLive = true;
  payload.accountName = live.map((p) => p.accountName).join(' + ');
  payload.timeSeries = mergeTimeSeries(live);

  const totals = live.reduce(
    (acc, p) => {
      acc.visitors += p.summary.totalVisitors;
      acc.pageviews += p.summary.totalPageviews;
      acc.bandwidth += p.summary.bandwidthBytes;
      acc.requests += p.summary.requestCount;
      acc.threats += p.summary.threatsBlocked;
      acc.weightedBounce += p.summary.bounceRate * p.summary.totalPageviews;
      acc.weightedDuration += p.summary.avgSessionDuration * p.summary.totalPageviews;
      acc.weightedVisitorsChange += p.summary.visitorsChange * p.summary.totalPageviews;
      acc.weightedPvChange += p.summary.pageviewsChange * p.summary.totalPageviews;
      return acc;
    },
    { visitors: 0, pageviews: 0, bandwidth: 0, requests: 0, threats: 0, weightedBounce: 0, weightedDuration: 0, weightedVisitorsChange: 0, weightedPvChange: 0 }
  );

  const tsRequests = payload.timeSeries.reduce((a, p) => a + p.requests, 0);
  const tsCache = payload.timeSeries.reduce((a, p) => a + p.cacheHits, 0);
  const tsErrors = payload.timeSeries.reduce((a, p) => a + p.errors, 0);

  payload.summary = {
    totalVisitors: totals.visitors,
    totalPageviews: totals.pageviews,
    bounceRate: totals.pageviews > 0 ? parseFloat((totals.weightedBounce / totals.pageviews).toFixed(1)) : 0,
    avgSessionDuration: totals.pageviews > 0 ? Math.round(totals.weightedDuration / totals.pageviews) : 0,
    bandwidthBytes: Math.round(totals.bandwidth),
    cacheHitRatio: tsRequests > 0 ? parseFloat(((tsCache / tsRequests) * 100).toFixed(1)) : 0,
    requestCount: totals.requests,
    threatsBlocked: totals.threats,
    errorRate: tsRequests > 0 ? parseFloat(((tsErrors / tsRequests) * 100).toFixed(2)) : 0,
    visitorsChange: totals.pageviews > 0 ? parseFloat((totals.weightedVisitorsChange / totals.pageviews).toFixed(1)) : 0,
    pageviewsChange: totals.pageviews > 0 ? parseFloat((totals.weightedPvChange / totals.pageviews).toFixed(1)) : 0,
  };

  // Top paths: merge, sort by views, keep top 10
  const byPath = new Map<string, { views: number; visitors: number; duration: number; bounce: number; n: number }>();
  for (const p of live) {
    for (const t of p.topPaths) {
      const cur = byPath.get(t.path) ?? { views: 0, visitors: 0, duration: 0, bounce: 0, n: 0 };
      cur.views += t.views;
      cur.visitors += t.uniqueVisitors;
      cur.duration += t.avgDurationSec;
      cur.bounce += t.bounceRate;
      cur.n += 1;
      byPath.set(t.path, cur);
    }
  }
  payload.topPaths = [...byPath.entries()]
    .sort(([, a], [, b]) => b.views - a.views)
    .slice(0, 10)
    .map(([path, v]) => ({
      path,
      views: v.views,
      uniqueVisitors: v.visitors,
      avgDurationSec: v.n ? Math.round(v.duration / v.n) : 0,
      bounceRate: v.n ? parseFloat((v.bounce / v.n).toFixed(1)) : 0,
    }));

  // Geo: merge by country code
  const byCountry = new Map<string, number>();
  for (const p of live) for (const g of p.geoDistribution) byCountry.set(g.countryCode, (byCountry.get(g.countryCode) ?? 0) + g.visitors);
  const totalGeo = [...byCountry.values()].reduce((a, b) => a + b, 0);
  payload.geoDistribution = [...byCountry.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([countryCode, visitors]) => ({
      countryCode,
      countryName: live.flatMap((p) => p.geoDistribution).find((g) => g.countryCode === countryCode)?.countryName ?? countryCode,
      visitors,
      percentage: totalGeo > 0 ? parseFloat(((visitors / totalGeo) * 100).toFixed(1)) : 0,
    } satisfies GeoDistributionItem));

  // Devices: merge
  const byDevice = new Map<string, number>();
  for (const p of live) for (const d of p.devices) byDevice.set(d.device, (byDevice.get(d.device) ?? 0) + d.count);
  const totalDev = [...byDevice.values()].reduce((a, b) => a + b, 0);
  payload.devices = [...byDevice.entries()].map(([device, count]) => ({
    device,
    count,
    percentage: totalDev > 0 ? parseFloat(((count / totalDev) * 100).toFixed(1)) : 0,
  } satisfies DeviceBreakdownItem));

  // Status codes: sum
  payload.statusCodes = live.reduce(
    (acc, p) => ({
      status2xx: acc.status2xx + p.statusCodes.status2xx,
      status3xx: acc.status3xx + p.statusCodes.status3xx,
      status4xx: acc.status4xx + p.statusCodes.status4xx,
      status5xx: acc.status5xx + p.statusCodes.status5xx,
    }),
    { status2xx: 0, status3xx: 0, status4xx: 0, status5xx: 0 }
  );

  // Web vitals: take the first part reporting non-zero vitals
  const vitalsPart = live.find((p) => p.webVitals.lcp.value > 0 || p.webVitals.inp.value > 0 || p.webVitals.ttfb.value > 0);
  if (vitalsPart) payload.webVitals = vitalsPart.webVitals;

  return payload;
}

export function mergeInfraPayloads(parts: UnifiedInfraData[]): UnifiedInfraData | null {
  const live = parts.filter((p) => p.isLive);
  if (live.length === 0) return null;

  const payload = buildEmptyInfraPayload('unified-infra', 'infra-mesh-all', 'All Systems Fleet', 'multi-region (Global)');
  payload.isLive = true;
  payload.accountName = live.map((p) => p.accountName).join(' + ');
  payload.awsInstances = live.flatMap((p) => p.awsInstances);
  payload.cloudflareTunnels = live.flatMap((p) => p.cloudflareTunnels);
  payload.cloudflareWorkers = live.flatMap((p) => p.cloudflareWorkers);
  payload.oracleInstances = live.flatMap((p) => p.oracleInstances);

  const withCpu = parts.filter((p) => p.summary.totalInstances > 0);
  payload.summary = {
    totalInstances: live.reduce((a, p) => a + p.summary.totalInstances, 0),
    healthyInstances: live.reduce((a, p) => a + p.summary.healthyInstances, 0),
    totalTunnels: live.reduce((a, p) => a + p.summary.totalTunnels, 0),
    healthyTunnels: live.reduce((a, p) => a + p.summary.healthyTunnels, 0),
    totalWorkers: live.reduce((a, p) => a + p.summary.totalWorkers, 0),
    workerRequestsPerSec: parseFloat(live.reduce((a, p) => a + p.summary.workerRequestsPerSec, 0).toFixed(1)),
    avgCpuUtilization: withCpu.length
      ? parseFloat((withCpu.reduce((a, p) => a + p.summary.avgCpuUtilization, 0) / withCpu.length).toFixed(1))
      : 0,
    avgMemoryUtilization: 0,
    activeAlertsCount: live.reduce((a, p) => a + p.summary.activeAlertsCount, 0),
  };

  payload.infraLogs = live
    .flatMap((p) => p.infraLogs)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 30);

  // Time series: union of timestamps; CPU/memory averaged, network/rps summed
  const byTs = new Map<string, { pts: { cpu: number[]; mem: number[]; net: number; rps: number; formatted: string } }>();
  for (const p of live) {
    for (const t of p.timeSeries) {
      const cur = byTs.get(t.timestamp) ?? { pts: { cpu: [], mem: [], net: 0, rps: 0, formatted: t.formattedTime } };
      cur.pts.cpu.push(t.cpuAvg);
      cur.pts.mem.push(t.memoryAvg);
      cur.pts.net += t.networkMbps;
      cur.pts.rps += t.workerRps;
      byTs.set(t.timestamp, cur);
    }
  }
  payload.timeSeries = [...byTs.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ts, v]) => ({
      timestamp: ts,
      formattedTime: v.pts.formatted,
      cpuAvg: v.pts.cpu.length ? parseFloat((v.pts.cpu.reduce((a, b) => a + b, 0) / v.pts.cpu.length).toFixed(1)) : 0,
      memoryAvg: v.pts.mem.length ? parseFloat((v.pts.mem.reduce((a, b) => a + b, 0) / v.pts.mem.length).toFixed(1)) : 0,
      networkMbps: parseFloat(v.pts.net.toFixed(2)),
      workerRps: parseFloat(v.pts.rps.toFixed(2)),
    }));

  return payload;
}
