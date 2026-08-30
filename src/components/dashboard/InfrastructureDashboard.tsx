import React, { useState } from 'react';
import { useInfrastructure } from '../../context/InfrastructureContext';
import { DitherAreaChart } from '../dither/DitherAreaChart';
import { DitherMetricCard } from '../dither/DitherMetricCard';
import { AwsFleetView } from './AwsFleetView';
import { CloudflareInfraView } from './CloudflareInfraView';
import { OracleFleetView } from './OracleFleetView';
import { InfraLogStream } from './InfraLogStream';
import { formatCompactNumber } from '../../lib/utils';
import {
  Server,
  Cpu,
  ShieldCheck,
  Zap,
} from 'lucide-react';

export const InfrastructureDashboard: React.FC = () => {
  const { data, isLoading, selectedProvider } = useInfrastructure();
  const [activeChartMetric, setActiveChartMetric] = useState<
    'cpuAvg' | 'memoryAvg' | 'networkMbps' | 'workerRps'
  >('cpuAvg');

  if (isLoading || !data) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 font-mono text-xs text-muted-foreground">
        <div className="flex items-center space-x-2">
          <span className="animate-spin h-3 w-3 border-2 border-primary border-t-transparent rounded-full" />
          <span>CONNECTING INFRASTRUCTURE TELEMETRY STREAM...</span>
        </div>
      </div>
    );
  }

  const summary = data.summary || {
    totalInstances: 0,
    healthyInstances: 0,
    avgCpuUtilization: 0,
    totalTunnels: 0,
    healthyTunnels: 0,
    totalWorkers: 0,
    workerRequestsPerSec: 0,
  };
  const timeSeries = data.timeSeries || [];
  const awsInstances = data.awsInstances || [];
  const cloudflareTunnels = data.cloudflareTunnels || [];
  const cloudflareWorkers = data.cloudflareWorkers || [];
  const oracleInstances = data.oracleInstances || [];
  const infraLogs = data.infraLogs || [];

  const sparkCpu = timeSeries.map((t) => t.cpuAvg || 0);
  const sparkMemory = timeSeries.map((t) => t.memoryAvg || 0);
  const sparkNetwork = timeSeries.map((t) => t.networkMbps || 0);
  const sparkWorkerRps = timeSeries.map((t) => t.workerRps || 0);

  // Health Score Calculation
  const healthRatio = Math.round((summary.healthyInstances / (summary.totalInstances || 1)) * 100);

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-3 font-sans max-w-7xl mx-auto w-full min-w-0">
      {/* Top 4 Infrastructure Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 w-full min-w-0">
        <DitherMetricCard
          label="FLEET HEALTH"
          value={`${healthRatio}%`}
          subValue={`${summary.healthyInstances}/${summary.totalInstances} INSTANCES UP`}
          change={0.4}
          sparklineData={sparkCpu}
          icon={<Server className="h-3.5 w-3.5" />}
        />
        <DitherMetricCard
          label="AVG CPU LOAD"
          value={`${summary.avgCpuUtilization}%`}
          subValue="ACROSS FLEET"
          change={-1.8}
          sparklineData={sparkCpu}
          icon={<Cpu className="h-3.5 w-3.5" />}
        />
        <DitherMetricCard
          label="GATEWAY TUNNELS"
          value={`${summary.healthyTunnels}/${summary.totalTunnels}`}
          subValue="QUIC ZERO TRUST"
          change={0}
          sparklineData={sparkNetwork}
          icon={<ShieldCheck className="h-3.5 w-3.5" />}
        />
        <DitherMetricCard
          label="EDGE WORKERS"
          value={`${formatCompactNumber(summary.workerRequestsPerSec)}/s`}
          subValue={`${summary.totalWorkers} ACTIVE ISOLATES`}
          change={3.2}
          sparklineData={sparkWorkerRps}
          icon={<Zap className="h-3.5 w-3.5" />}
        />
      </div>

      {/* Main Dither Time-Series Chart */}
      <div className="border border-border bg-card p-3 space-y-2 w-full min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-1 min-w-0">
          <div className="flex items-center space-x-1 border border-border bg-secondary/40 p-0.5 rounded-[2px] font-mono text-[10px]">
            {(
              [
                { id: 'cpuAvg', label: 'CPU LOAD (%)' },
                { id: 'memoryAvg', label: 'MEMORY (%)' },
                { id: 'networkMbps', label: 'NETWORK (MB/S)' },
                { id: 'workerRps', label: 'WORKER RPS' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                onClick={() => setActiveChartMetric(m.id)}
                className={`px-2 py-0.5 rounded-[1px] transition-colors cursor-pointer ${
                  activeChartMetric === m.id
                    ? 'bg-primary text-primary-foreground font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="font-mono text-[10px] text-muted-foreground flex items-center space-x-2">
            <span>
              SOURCE:{' '}
              <strong className="text-foreground uppercase">
                {data.provider === 'unified-infra' ? 'GLOBAL FLEET MESH' : data.provider.toUpperCase()}
              </strong>
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          </div>
        </div>

        <DitherAreaChart
          series={timeSeries}
          metricKey={activeChartMetric}
          valueLabel={activeChartMetric.toUpperCase()}
          unit={
            activeChartMetric === 'cpuAvg' || activeChartMetric === 'memoryAvg'
              ? '%'
              : activeChartMetric === 'networkMbps'
              ? ' MB/s'
              : ' req/s'
          }
          height={190}
        />
      </div>

      {/* Provider-Specific Fleet Modules */}
      {(selectedProvider === 'unified-infra' || selectedProvider === 'aws') && awsInstances.length > 0 && (
        <AwsFleetView instances={awsInstances} />
      )}

      {(selectedProvider === 'unified-infra' || selectedProvider === 'cloudflare-infra') &&
        (cloudflareTunnels.length > 0 || cloudflareWorkers.length > 0) && (
          <CloudflareInfraView tunnels={cloudflareTunnels} workers={cloudflareWorkers} />
        )}

      {(selectedProvider === 'unified-infra' || selectedProvider === 'oracle') && oracleInstances.length > 0 && (
        <OracleFleetView instances={oracleInstances} />
      )}

      {/* Infrastructure Telemetry Log Stream */}
      {infraLogs && infraLogs.length > 0 && <InfraLogStream logs={infraLogs} />}
    </div>
  );
};
