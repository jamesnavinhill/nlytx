import {
  ProviderType,
  TimeRange,
  UnifiedAnalyticsData,
  TimeSeriesPoint,
  TopPathItem,
  GeoDistributionItem,
  DeviceBreakdownItem,
  StatusCodeDistribution,
  WebVitalsMetrics,
} from '../../src/types/analytics';

export function generateSyntheticTelemetry(
  provider: ProviderType,
  accountId: string,
  accountName: string,
  targetResource: string,
  timeRange: TimeRange,
  isLive: boolean = false
): UnifiedAnalyticsData {
  const pointsCount = timeRange === '24h' ? 24 : timeRange === '7d' ? 28 : timeRange === '30d' ? 30 : 45;
  const now = new Date();

  // Multiplier based on provider type
  const baseMultiplier =
    provider === 'cloudflare' ? 2.4 : provider === 'vercel' ? 1.6 : provider === 'google' ? 1.2 : 3.0;

  const timeSeries: TimeSeriesPoint[] = [];
  let totalVisitors = 0;
  let totalPageviews = 0;
  let totalRequests = 0;
  let totalBandwidthBytes = 0;
  let totalCacheHits = 0;
  let totalErrors = 0;

  for (let i = pointsCount - 1; i >= 0; i--) {
    const pointDate = new Date(now.getTime());
    let formattedTime = '';

    if (timeRange === '24h') {
      pointDate.setHours(now.getHours() - i);
      formattedTime = pointDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      pointDate.setDate(now.getDate() - i);
      formattedTime = pointDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    // Cyclic realistic waveform with natural noise
    const diurnal = Math.sin((i / pointsCount) * Math.PI * 2 - Math.PI / 2) * 0.35 + 0.65;
    const noise = (Math.sin(i * 13.37) * 0.5 + 0.5) * 0.3;
    const factor = Math.max(0.2, diurnal + noise);

    const visitors = Math.round(140 * baseMultiplier * factor);
    const pageviews = Math.round(visitors * (1.8 + Math.sin(i * 1.5) * 0.4));
    const requests = Math.round(pageviews * (12 + (i % 5)));
    const bandwidthMb = parseFloat((requests * 0.14).toFixed(2));
    const cacheHits = Math.round(requests * (provider === 'cloudflare' ? 0.88 : 0.74));
    const errors = Math.max(0, Math.round(requests * (0.008 + (i % 7 === 0 ? 0.015 : 0))));

    totalVisitors += visitors;
    totalPageviews += pageviews;
    totalRequests += requests;
    totalBandwidthBytes += bandwidthMb * 1024 * 1024;
    totalCacheHits += cacheHits;
    totalErrors += errors;

    timeSeries.push({
      timestamp: pointDate.toISOString(),
      formattedTime,
      visitors,
      pageviews,
      requests,
      bandwidthMb,
      cacheHits,
      errors,
    });
  }

  const topPaths: TopPathItem[] = [
    { path: '/', views: Math.round(totalPageviews * 0.38), uniqueVisitors: Math.round(totalVisitors * 0.42), avgDurationSec: 142, bounceRate: 24.5 },
    { path: '/docs/api', views: Math.round(totalPageviews * 0.22), uniqueVisitors: Math.round(totalVisitors * 0.25), avgDurationSec: 280, bounceRate: 18.2 },
    { path: '/dashboard/realtime', views: Math.round(totalPageviews * 0.16), uniqueVisitors: Math.round(totalVisitors * 0.18), avgDurationSec: 360, bounceRate: 12.0 },
    { path: '/pricing', views: Math.round(totalPageviews * 0.12), uniqueVisitors: Math.round(totalVisitors * 0.14), avgDurationSec: 95, bounceRate: 38.4 },
    { path: '/changelog', views: Math.round(totalPageviews * 0.08), uniqueVisitors: Math.round(totalVisitors * 0.09), avgDurationSec: 110, bounceRate: 29.1 },
    { path: '/status', views: Math.round(totalPageviews * 0.04), uniqueVisitors: Math.round(totalVisitors * 0.05), avgDurationSec: 45, bounceRate: 52.0 },
  ];

  const geoDistribution: GeoDistributionItem[] = [
    { countryCode: 'US', countryName: 'United States', visitors: Math.round(totalVisitors * 0.44), percentage: 44.0 },
    { countryCode: 'DE', countryName: 'Germany', visitors: Math.round(totalVisitors * 0.15), percentage: 15.0 },
    { countryCode: 'GB', countryName: 'United Kingdom', visitors: Math.round(totalVisitors * 0.12), percentage: 12.0 },
    { countryCode: 'JP', countryName: 'Japan', visitors: Math.round(totalVisitors * 0.10), percentage: 10.0 },
    { countryCode: 'CA', countryName: 'Canada', visitors: Math.round(totalVisitors * 0.08), percentage: 8.0 },
    { countryCode: 'FR', countryName: 'France', visitors: Math.round(totalVisitors * 0.06), percentage: 6.0 },
    { countryCode: 'OTH', countryName: 'Other', visitors: Math.round(totalVisitors * 0.05), percentage: 5.0 },
  ];

  const devices: DeviceBreakdownItem[] = [
    { device: 'desktop', count: Math.round(totalVisitors * 0.68), percentage: 68.0 },
    { device: 'mobile', count: Math.round(totalVisitors * 0.28), percentage: 28.0 },
    { device: 'tablet', count: Math.round(totalVisitors * 0.04), percentage: 4.0 },
  ];

  const statusCodes: StatusCodeDistribution = {
    status2xx: Math.round(totalRequests * 0.962),
    status3xx: Math.round(totalRequests * 0.024),
    status4xx: Math.round(totalRequests * 0.011),
    status5xx: Math.round(totalRequests * 0.003),
  };

  const webVitals: WebVitalsMetrics = {
    lcp: { value: 1.12, unit: 's', rating: 'good' },
    cls: { value: 0.015, unit: '', rating: 'good' },
    inp: { value: 42, unit: 'ms', rating: 'good' },
    fid: { value: 8, unit: 'ms', rating: 'good' },
    ttfb: { value: 68, unit: 'ms', rating: 'good' },
  };

  const cacheHitRatio = totalRequests > 0 ? parseFloat(((totalCacheHits / totalRequests) * 100).toFixed(1)) : 85.0;
  const errorRate = totalRequests > 0 ? parseFloat(((totalErrors / totalRequests) * 100).toFixed(2)) : 0.8;

  return {
    provider,
    accountId,
    accountName,
    targetResource,
    timeRange,
    isLive,
    lastUpdated: now.toISOString(),
    summary: {
      totalVisitors,
      totalPageviews,
      bounceRate: 23.4,
      avgSessionDuration: 184,
      bandwidthBytes: totalBandwidthBytes,
      cacheHitRatio,
      requestCount: totalRequests,
      threatsBlocked: Math.round(totalRequests * (provider === 'cloudflare' ? 0.018 : 0.002)),
      errorRate,
      visitorsChange: 14.8,
      pageviewsChange: 18.2,
    },
    timeSeries,
    topPaths,
    geoDistribution,
    devices,
    statusCodes,
    webVitals,
  };
}
