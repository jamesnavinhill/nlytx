export type ProviderType = 'vercel' | 'cloudflare' | 'google' | 'unified';

export type TimeRange = '24h' | '7d' | '30d' | '90d';

export type DitherAlgorithm = 'bayer' | 'floyd-steinberg' | 'atkinson' | 'dot-matrix' | 'grain';

export interface ProviderAccount {
  id: string;
  provider: ProviderType;
  name: string;
  targetResource: string; // project ID, zone ID, or GA property ID
  hasKey: boolean;
  isLiveConnected: boolean;
  createdAt: string;
}

export interface MetricSummary {
  totalVisitors: number;
  totalPageviews: number;
  bounceRate: number; // percentage
  avgSessionDuration: number; // seconds
  bandwidthBytes: number;
  cacheHitRatio: number; // percentage
  requestCount: number;
  threatsBlocked: number;
  errorRate: number; // 4xx/5xx percentage
  visitorsChange: number; // percentage change vs previous
  pageviewsChange: number;
}

export interface TimeSeriesPoint {
  timestamp: string;
  formattedTime: string;
  visitors: number;
  pageviews: number;
  requests: number;
  bandwidthMb: number;
  cacheHits: number;
  errors: number;
}

export interface TopPathItem {
  path: string;
  views: number;
  uniqueVisitors: number;
  avgDurationSec: number;
  bounceRate: number;
}

export interface GeoDistributionItem {
  countryCode: string;
  countryName: string;
  visitors: number;
  percentage: number;
}

export interface DeviceBreakdownItem {
  device: 'desktop' | 'mobile' | 'tablet' | 'bot' | string;
  count: number;
  percentage: number;
}

export interface StatusCodeDistribution {
  status2xx: number;
  status3xx: number;
  status4xx: number;
  status5xx: number;
}

export interface WebVitalsMetrics {
  lcp: { value: number; unit: string; rating: 'good' | 'needs-improvement' | 'poor' };
  cls: { value: number; unit: string; rating: 'good' | 'needs-improvement' | 'poor' };
  inp: { value: number; unit: string; rating: 'good' | 'needs-improvement' | 'poor' };
  fid: { value: number; unit: string; rating: 'good' | 'needs-improvement' | 'poor' };
  ttfb: { value: number; unit: string; rating: 'good' | 'needs-improvement' | 'poor' };
}

export interface UnifiedAnalyticsData {
  provider: ProviderType;
  accountId: string;
  accountName: string;
  targetResource: string;
  timeRange: TimeRange;
  isLive: boolean;
  lastUpdated: string;
  summary: MetricSummary;
  timeSeries: TimeSeriesPoint[];
  topPaths: TopPathItem[];
  geoDistribution: GeoDistributionItem[];
  devices: DeviceBreakdownItem[];
  statusCodes: StatusCodeDistribution;
  webVitals: WebVitalsMetrics;
}

export interface ProviderCredentialsPayload {
  accountId?: string;
  provider: ProviderType;
  name: string;
  targetResource: string;
  apiKey?: string;
  apiSecret?: string;
}
