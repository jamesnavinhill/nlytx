import React, { useState } from 'react';
import { useAnalytics } from '../../context/AnalyticsContext';
import { DitherAreaChart } from '../dither/DitherAreaChart';
import { DitherMetricCard } from '../dither/DitherMetricCard';
import { DitherBarChart } from '../dither/DitherBarChart';
import { DitherGeoMatrix } from '../dither/DitherGeoMatrix';
import { DitherWebVitals } from '../dither/DitherWebVitals';
import { formatBytes, formatCompactNumber } from '../../lib/utils';
import {
  Users,
  Eye,
  Database,
  ShieldCheck,
  Zap,
  Activity,
  HardDrive,
  Globe,
  Radio,
  FileText,
} from 'lucide-react';

export const AnalyticsDashboard: React.FC = () => {
  const { data, isLoading } = useAnalytics();
  const [activeChartMetric, setActiveChartMetric] = useState<
    'visitors' | 'pageviews' | 'requests' | 'bandwidthMb' | 'cacheHits'
  >('visitors');

  if (isLoading || !data) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 font-mono text-xs text-muted-foreground">
        <div className="flex items-center space-x-2">
          <span className="animate-spin h-3 w-3 border-2 border-primary border-t-transparent rounded-full" />
          <span>CONNECTING DATA STREAM...</span>
        </div>
      </div>
    );
  }

  const summary = data.summary || {
    totalVisitors: 0,
    totalPageviews: 0,
    totalRequests: 0,
    bandwidthBytes: 0,
    cacheHitRatio: 0,
    visitorsChange: 0,
    pageviewsChange: 0,
  };
  const timeSeries = data.timeSeries || [];
  const topPaths = data.topPaths || [];
  const geoDistribution = data.geoDistribution || [];
  const devices = data.devices || [];
  const statusCodes = data.statusCodes || { status2xx: 0, status3xx: 0, status4xx: 0, status5xx: 0 };
  const webVitals = data.webVitals;

  const sparkVisitors = timeSeries.map((t) => t.visitors || 0);
  const sparkPageviews = timeSeries.map((t) => t.pageviews || 0);
  const sparkRequests = timeSeries.map((t) => t.requests || 0);
  const sparkBandwidth = timeSeries.map((t) => t.bandwidthMb || 0);

  // Status code items for bar chart
  const statusCodeItems = [
    { label: '2XX OK', value: statusCodes.status2xx || 0, subLabel: 'SUCCESS' },
    { label: '3XX REDIRECT', value: statusCodes.status3xx || 0, subLabel: 'CACHE' },
    { label: '4XX CLIENT ERR', value: statusCodes.status4xx || 0, subLabel: 'NOT FOUND' },
    { label: '5XX SERVER ERR', value: statusCodes.status5xx || 0, subLabel: 'ORIGIN' },
  ];

  // Top paths items for bar chart
  const pathItems = topPaths.map((p) => ({
    label: p.path,
    value: p.views,
    subLabel: `${p.bounceRate}% BR`,
  }));

  // Device items for bar chart
  const deviceItems = devices.map((d) => ({
    label: (d.device || '').toUpperCase(),
    value: d.count,
    subLabel: `${d.percentage}%`,
  }));

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-3 font-sans max-w-7xl mx-auto w-full min-w-0">
      {/* Top 4 Metric Summaries */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <DitherMetricCard
          label="VISITORS"
          value={formatCompactNumber(summary.totalVisitors)}
          subValue="UNIQUE HOSTS"
          change={summary.visitorsChange}
          sparklineData={sparkVisitors}
          icon={<Users className="h-3.5 w-3.5" />}
        />
        <DitherMetricCard
          label="PAGEVIEWS"
          value={formatCompactNumber(summary.totalPageviews)}
          subValue="TOTAL SESSIONS"
          change={summary.pageviewsChange}
          sparklineData={sparkPageviews}
          icon={<Eye className="h-3.5 w-3.5" />}
        />
        <DitherMetricCard
          label="CACHE HIT"
          value={`${summary.cacheHitRatio}%`}
          subValue="EDGE PROXIED"
          change={1.2}
          sparklineData={sparkRequests}
          icon={<Zap className="h-3.5 w-3.5" />}
        />
        <DitherMetricCard
          label="BANDWIDTH"
          value={formatBytes(summary.bandwidthBytes)}
          subValue="TRANSIT DATA"
          change={-2.4}
          sparklineData={sparkBandwidth}
          icon={<HardDrive className="h-3.5 w-3.5" />}
        />
      </div>

      {/* Main Dither Chart Section with Metric Switcher */}
      <div className="border border-border bg-card p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
          <div className="flex items-center space-x-1 border border-border bg-secondary/40 p-0.5 rounded-[2px] font-mono text-[10px]">
            {(
              [
                { id: 'visitors', label: 'VISITORS' },
                { id: 'pageviews', label: 'VIEWS' },
                { id: 'requests', label: 'REQUESTS' },
                { id: 'bandwidthMb', label: 'DATA (MB)' },
                { id: 'cacheHits', label: 'CACHE' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                onClick={() => setActiveChartMetric(m.id)}
                className={`px-2 py-0.5 rounded-[1px] transition-colors cursor-pointer ${
                  activeChartMetric === m.id
                    ? 'bg-foreground text-background font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="font-mono text-[10px] text-muted-foreground flex items-center space-x-2">
            <span className="flex items-center space-x-1">
              <span className="w-2 h-0.5 bg-primary block" />
              <span>PRIMARY SERIES</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-0.5 bg-muted-foreground/60 border-t border-dashed block" />
              <span>TRENDLINE</span>
            </span>
          </div>
        </div>

        <DitherAreaChart
          series={timeSeries}
          metricKey={activeChartMetric}
          secondaryMetricKey={activeChartMetric === 'visitors' ? 'pageviews' : 'visitors'}
          height={240}
        />
      </div>

      {/* Core Web Vitals Row */}
      {webVitals && (
        <div className="border border-border bg-card p-3 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-[11px] font-mono border-b border-border pb-1.5">
            <span className="text-foreground font-semibold uppercase tracking-wider">CORE WEB VITALS</span>
            <span>EDGE REAL-USER MONITORING</span>
          </div>
          <DitherWebVitals vitals={webVitals} />
        </div>
      )}

      {/* Breakdown Grid: Status Codes, Top Paths, Geo, Devices */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Status Codes */}
        <div className="border border-border bg-card p-3 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-[11px] font-mono border-b border-border pb-1.5">
            <span className="text-foreground font-semibold uppercase tracking-wider">HTTP STATUS CODES</span>
            <span className="flex items-center space-x-1">
              <ShieldCheck className="w-3 h-3 text-primary" />
              <span>EDGE LOGS</span>
            </span>
          </div>
          <DitherBarChart items={statusCodeItems} />
        </div>

        {/* Top Requested Paths */}
        <div className="border border-border bg-card p-3 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-[11px] font-mono border-b border-border pb-1.5">
            <span className="text-foreground font-semibold uppercase tracking-wider">TOP REQUEST PATHS</span>
            <span className="flex items-center space-x-1">
              <FileText className="w-3 h-3 text-primary" />
              <span>ROUTING</span>
            </span>
          </div>
          <DitherBarChart items={pathItems} />
        </div>

        {/* Geographic Distribution */}
        <div className="border border-border bg-card p-3 space-y-2 md:col-span-2">
          <div className="flex items-center justify-between text-muted-foreground text-[11px] font-mono border-b border-border pb-1.5">
            <span className="text-foreground font-semibold uppercase tracking-wider">GLOBAL TRAFFIC MATRIX</span>
            <span className="flex items-center space-x-1">
              <Globe className="w-3 h-3 text-primary" />
              <span>ANYCAST EGRESS</span>
            </span>
          </div>
          <DitherGeoMatrix items={geoDistribution} />
        </div>

        {/* Device Breakdown */}
        <div className="border border-border bg-card p-3 space-y-2 md:col-span-2">
          <div className="flex items-center justify-between text-muted-foreground text-[11px] font-mono border-b border-border pb-1.5">
            <span className="text-foreground font-semibold uppercase tracking-wider">CLIENT DEVICE BREAKDOWN</span>
            <span className="flex items-center space-x-1">
              <Activity className="w-3 h-3 text-primary" />
              <span>USER AGENT</span>
            </span>
          </div>
          <DitherBarChart items={deviceItems} />
        </div>
      </div>
    </div>
  );
};
