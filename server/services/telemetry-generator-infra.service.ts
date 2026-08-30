import {
  AwsInstance,
  CloudflareGatewayTunnel,
  CloudflareWorkerService,
  InfraLogEvent,
  InfraMetricSummary,
  InfraProviderType,
  InfraTimeSeriesPoint,
  OracleComputeInstance,
  UnifiedInfraData,
} from '../../src/types/infrastructure';
import { TimeRange } from '../../src/types/analytics';

export function generateSyntheticInfraTelemetry(
  provider: InfraProviderType,
  accountId: string,
  accountName: string,
  region: string,
  timeRange: TimeRange,
  isLive: boolean
): UnifiedInfraData {
  const now = Date.now();
  const pointCount = timeRange === '24h' ? 24 : timeRange === '7d' ? 28 : timeRange === '30d' ? 30 : 45;
  const intervalMs =
    timeRange === '24h'
      ? 60 * 60 * 1000
      : timeRange === '7d'
      ? 6 * 60 * 60 * 1000
      : 24 * 60 * 60 * 1000;

  // Generate AWS Instances
  const awsInstances: AwsInstance[] = [
    {
      instanceId: 'i-0a81c4e9f3b2018a',
      name: 'prod-api-edge-cluster-01',
      state: 'running',
      instanceType: 'c7g.2xlarge',
      availabilityZone: `${region.includes('eu') ? 'eu-central-1a' : 'us-east-1a'}`,
      publicIp: '54.210.88.14',
      privateIp: '10.0.12.4',
      systemStatus: 'ok',
      instanceStatus: 'ok',
      cpuUtilization: 38.4 + (Math.sin(now / 10000) * 8),
      memoryUtilization: 62.1,
      diskReadOps: 1420,
      diskWriteOps: 3890,
      networkInKbps: 18450,
      networkOutKbps: 42300,
      uptimeHours: 742,
      launchTime: new Date(now - 742 * 3600 * 1000).toISOString(),
      tags: { Environment: 'production', Team: 'core-platform', AutoScaling: 'asg-api-v2' },
      cpuHistory: Array.from({ length: 12 }, (_, i) => Math.round(30 + Math.sin(i * 0.7) * 15 + Math.random() * 8)),
    },
    {
      instanceId: 'i-058b73df89c4129e',
      name: 'prod-api-edge-cluster-02',
      state: 'running',
      instanceType: 'c7g.2xlarge',
      availabilityZone: `${region.includes('eu') ? 'eu-central-1b' : 'us-east-1b'}`,
      publicIp: '54.210.89.201',
      privateIp: '10.0.13.19',
      systemStatus: 'ok',
      instanceStatus: 'ok',
      cpuUtilization: 44.1 + (Math.cos(now / 8000) * 9),
      memoryUtilization: 67.8,
      diskReadOps: 1680,
      diskWriteOps: 4120,
      networkInKbps: 21300,
      networkOutKbps: 48900,
      uptimeHours: 742,
      launchTime: new Date(now - 742 * 3600 * 1000).toISOString(),
      tags: { Environment: 'production', Team: 'core-platform', AutoScaling: 'asg-api-v2' },
      cpuHistory: Array.from({ length: 12 }, (_, i) => Math.round(35 + Math.cos(i * 0.6) * 14 + Math.random() * 8)),
    },
    {
      instanceId: 'i-09f422e11cd7a06c',
      name: 'auth-vault-worker-01',
      state: 'running',
      instanceType: 't4g.xlarge',
      availabilityZone: `${region.includes('eu') ? 'eu-central-1a' : 'us-east-1a'}`,
      publicIp: '52.90.114.73',
      privateIp: '10.0.20.8',
      systemStatus: 'ok',
      instanceStatus: 'ok',
      cpuUtilization: 19.2 + Math.random() * 4,
      memoryUtilization: 41.5,
      diskReadOps: 320,
      diskWriteOps: 1100,
      networkInKbps: 4200,
      networkOutKbps: 6800,
      uptimeHours: 1280,
      launchTime: new Date(now - 1280 * 3600 * 1000).toISOString(),
      tags: { Environment: 'production', SecurityZone: 'vault-isolated' },
      cpuHistory: Array.from({ length: 12 }, (_, i) => Math.round(18 + Math.random() * 6)),
    },
    {
      instanceId: 'i-0b291d904fa18c44',
      name: 'db-read-replica-east',
      state: 'running',
      instanceType: 'm6i.2xlarge',
      availabilityZone: `${region.includes('eu') ? 'eu-central-1c' : 'us-east-1c'}`,
      publicIp: '54.89.202.11',
      privateIp: '10.0.30.15',
      systemStatus: 'ok',
      instanceStatus: 'ok',
      cpuUtilization: 52.8 + (Math.sin(now / 6000) * 12),
      memoryUtilization: 79.4,
      diskReadOps: 14200,
      diskWriteOps: 8600,
      networkInKbps: 34100,
      networkOutKbps: 89400,
      uptimeHours: 2190,
      launchTime: new Date(now - 2190 * 3600 * 1000).toISOString(),
      tags: { Environment: 'production', Database: 'pg-cluster-main' },
      cpuHistory: Array.from({ length: 12 }, (_, i) => Math.round(48 + Math.sin(i * 0.9) * 16 + Math.random() * 6)),
    },
    {
      instanceId: 'i-0c774f1b802de99a',
      name: 'batch-event-indexer-03',
      state: 'stopped',
      instanceType: 'c6i.xlarge',
      availabilityZone: `${region.includes('eu') ? 'eu-central-1a' : 'us-east-1a'}`,
      publicIp: '-',
      privateIp: '10.0.40.55',
      systemStatus: 'ok',
      instanceStatus: 'ok',
      cpuUtilization: 0,
      memoryUtilization: 0,
      diskReadOps: 0,
      diskWriteOps: 0,
      networkInKbps: 0,
      networkOutKbps: 0,
      uptimeHours: 0,
      launchTime: new Date(now - 48 * 3600 * 1000).toISOString(),
      tags: { Environment: 'staging', Role: 'scheduled-batch' },
      cpuHistory: Array.from({ length: 12 }, () => 0),
    },
  ];

  // Generate Cloudflare Zero Trust Tunnels
  const cloudflareTunnels: CloudflareGatewayTunnel[] = [
    {
      id: 'cf-tun-8a9d10e-k8s',
      name: 'k8s-ingress-prod-east',
      status: 'healthy',
      connectors: [
        { id: 'conn-01a', version: '2026.4.1', originIp: '10.0.10.12', colo: 'IAD', state: 'connected' },
        { id: 'conn-01b', version: '2026.4.1', originIp: '10.0.10.13', colo: 'EWR', state: 'connected' },
      ],
      ingressRules: [
        { hostname: 'api.mesh.internal', service: 'http://10.0.12.4:8080' },
        { hostname: 'grafana.mesh.internal', service: 'http://10.0.22.90:3000' },
      ],
      bytesTransferred: 48200000000,
      activeConnections: 342,
      latencyMs: 1.8,
      createdAt: new Date(now - 180 * 24 * 3600 * 1000).toISOString(),
    },
    {
      id: 'cf-tun-4f22c90-db',
      name: 'db-secure-gateway-quic',
      status: 'healthy',
      connectors: [
        { id: 'conn-02a', version: '2026.4.1', originIp: '10.0.30.15', colo: 'IAD', state: 'connected' },
      ],
      ingressRules: [
        { hostname: 'pg-proxy.mesh.internal', service: 'tcp://10.0.30.15:5432' },
      ],
      bytesTransferred: 19400000000,
      activeConnections: 48,
      latencyMs: 2.1,
      createdAt: new Date(now - 90 * 24 * 3600 * 1000).toISOString(),
    },
    {
      id: 'cf-tun-19cb40a-auth',
      name: 'auth-vault-tunnel-edge',
      status: 'healthy',
      connectors: [
        { id: 'conn-03a', version: '2026.4.1', originIp: '10.0.20.8', colo: 'IAD', state: 'connected' },
        { id: 'conn-03b', version: '2026.4.1', originIp: '10.0.20.9', colo: 'ORD', state: 'connected' },
      ],
      ingressRules: [
        { hostname: 'vault.mesh.internal', service: 'https://10.0.20.8:8200' },
      ],
      bytesTransferred: 8700000000,
      activeConnections: 95,
      latencyMs: 1.4,
      createdAt: new Date(now - 120 * 24 * 3600 * 1000).toISOString(),
    },
  ];

  // Generate Cloudflare Workers
  const cloudflareWorkers: CloudflareWorkerService[] = [
    {
      id: 'wrk-edge-router-v3',
      name: 'edge-request-router',
      status: 'active',
      routes: ['*api.domain.com/v1/*', '*api.domain.com/v2/*'],
      requestsPerSec: 1480 + Math.round(Math.sin(now / 5000) * 320),
      p50CpuMs: 1.8,
      p99CpuMs: 6.4,
      subrequestCount: 2,
      errorRate: 0.02,
      memoryMb: 128,
      scriptSizeKb: 48.2,
      lastDeployed: new Date(now - 2 * 3600 * 1000).toISOString(),
      invocationHistory: Array.from({ length: 12 }, (_, i) => Math.round(1200 + Math.sin(i * 0.8) * 400 + Math.random() * 100)),
    },
    {
      id: 'wrk-auth-jwt-interceptor',
      name: 'auth-jwt-verifier-edge',
      status: 'active',
      routes: ['*api.domain.com/auth/*', '*api.domain.com/secure/*'],
      requestsPerSec: 890 + Math.round(Math.cos(now / 7000) * 150),
      p50CpuMs: 0.9,
      p99CpuMs: 3.1,
      subrequestCount: 1,
      errorRate: 0.01,
      memoryMb: 64,
      scriptSizeKb: 22.4,
      lastDeployed: new Date(now - 18 * 3600 * 1000).toISOString(),
      invocationHistory: Array.from({ length: 12 }, (_, i) => Math.round(750 + Math.cos(i * 0.7) * 200 + Math.random() * 80)),
    },
    {
      id: 'wrk-og-dynamic-renderer',
      name: 'og-dither-image-generator',
      status: 'active',
      routes: ['*cdn.domain.com/og/*', '*assets.domain.com/banner/*'],
      requestsPerSec: 145 + Math.round(Math.sin(now / 9000) * 40),
      p50CpuMs: 8.2,
      p99CpuMs: 18.5,
      subrequestCount: 3,
      errorRate: 0.05,
      memoryMb: 256,
      scriptSizeKb: 142.8,
      lastDeployed: new Date(now - 48 * 3600 * 1000).toISOString(),
      invocationHistory: Array.from({ length: 12 }, (_, i) => Math.round(120 + Math.sin(i * 0.5) * 50 + Math.random() * 20)),
    },
    {
      id: 'wrk-rate-limiter-kv',
      name: 'distributed-ddos-shield',
      status: 'active',
      routes: ['*domain.com/login', '*domain.com/register'],
      requestsPerSec: 410 + Math.round(Math.sin(now / 4000) * 90),
      p50CpuMs: 1.1,
      p99CpuMs: 4.2,
      subrequestCount: 1,
      errorRate: 0.00,
      memoryMb: 64,
      scriptSizeKb: 18.1,
      lastDeployed: new Date(now - 72 * 3600 * 1000).toISOString(),
      invocationHistory: Array.from({ length: 12 }, (_, i) => Math.round(350 + Math.sin(i * 0.9) * 100 + Math.random() * 30)),
    },
  ];

  // Generate Oracle Cloud (OCI) Instances
  const oracleInstances: OracleComputeInstance[] = [
    {
      ocid: 'ocid1.instance.oc1.iad.abuwgljrw47g6ka7',
      displayName: 'oci-ampere-a1-prod-01',
      shape: 'VM.Standard.A1.Flex (4 OCPU / 24 GB)',
      ocpuCount: 4,
      memoryGb: 24,
      availabilityDomain: 'AD-1',
      faultDomain: 'FAULT-DOMAIN-1',
      lifecycleState: 'RUNNING',
      cpuUtilization: 31.2 + (Math.sin(now / 8500) * 7),
      memoryUtilization: 54.6,
      vnicState: 'ATTACHED',
      publicIp: '129.153.180.44',
      privateIp: '172.16.1.10',
      blockVolumeReadIops: 2400,
      blockVolumeWriteIops: 4800,
      timeCreated: new Date(now - 140 * 24 * 3600 * 1000).toISOString(),
      cpuHistory: Array.from({ length: 12 }, (_, i) => Math.round(26 + Math.sin(i * 0.7) * 12 + Math.random() * 6)),
    },
    {
      ocid: 'ocid1.instance.oc1.iad.abuwgljr78k94ba2',
      displayName: 'oci-ampere-a1-prod-02',
      shape: 'VM.Standard.A1.Flex (4 OCPU / 24 GB)',
      ocpuCount: 4,
      memoryGb: 24,
      availabilityDomain: 'AD-2',
      faultDomain: 'FAULT-DOMAIN-2',
      lifecycleState: 'RUNNING',
      cpuUtilization: 36.8 + (Math.cos(now / 9500) * 8),
      memoryUtilization: 59.2,
      vnicState: 'ATTACHED',
      publicIp: '129.153.181.98',
      privateIp: '172.16.1.11',
      blockVolumeReadIops: 2650,
      blockVolumeWriteIops: 5100,
      timeCreated: new Date(now - 140 * 24 * 3600 * 1000).toISOString(),
      cpuHistory: Array.from({ length: 12 }, (_, i) => Math.round(30 + Math.cos(i * 0.6) * 11 + Math.random() * 5)),
    },
    {
      ocid: 'ocid1.instance.oc1.iad.abuwgljr33l01df9',
      displayName: 'oci-standard3-db-storage-node',
      shape: 'VM.Standard3.Flex (8 OCPU / 64 GB)',
      ocpuCount: 8,
      memoryGb: 64,
      availabilityDomain: 'AD-1',
      faultDomain: 'FAULT-DOMAIN-3',
      lifecycleState: 'RUNNING',
      cpuUtilization: 49.5 + (Math.sin(now / 6200) * 11),
      memoryUtilization: 72.8,
      vnicState: 'ATTACHED',
      publicIp: '129.153.184.205',
      privateIp: '172.16.2.4',
      blockVolumeReadIops: 18900,
      blockVolumeWriteIops: 14200,
      timeCreated: new Date(now - 220 * 24 * 3600 * 1000).toISOString(),
      cpuHistory: Array.from({ length: 12 }, (_, i) => Math.round(44 + Math.sin(i * 0.8) * 14 + Math.random() * 7)),
    },
    {
      ocid: 'ocid1.instance.oc1.iad.abuwgljr90xx44b8',
      displayName: 'oci-standby-recovery-worker',
      shape: 'VM.Standard.E4.Flex (2 OCPU / 16 GB)',
      ocpuCount: 2,
      memoryGb: 16,
      availabilityDomain: 'AD-3',
      faultDomain: 'FAULT-DOMAIN-1',
      lifecycleState: 'STOPPED',
      cpuUtilization: 0,
      memoryUtilization: 0,
      vnicState: 'ATTACHED',
      publicIp: '-',
      privateIp: '172.16.3.18',
      blockVolumeReadIops: 0,
      blockVolumeWriteIops: 0,
      timeCreated: new Date(now - 60 * 24 * 3600 * 1000).toISOString(),
      cpuHistory: Array.from({ length: 12 }, () => 0),
    },
  ];

  // Generate Log Stream
  const infraLogs: InfraLogEvent[] = [
    {
      id: 'log-01',
      timestamp: new Date(now - 14 * 1000).toISOString(),
      provider: 'aws',
      source: 'AutoScalingGroup::asg-api-v2',
      level: 'INFO',
      message: 'EC2 health check passed for 2/2 targets in us-east-1a, latency 2.1ms',
      metadata: { instance: 'i-0a81c4e9f3b2018a', az: 'us-east-1a' },
    },
    {
      id: 'log-02',
      timestamp: new Date(now - 38 * 1000).toISOString(),
      provider: 'cloudflare-infra',
      source: 'CloudflareTunnel::k8s-ingress-prod-east',
      level: 'SUCCESS',
      message: 'Connector conn-01a negotiated HTTP/3 QUIC connection with edge POP IAD',
      metadata: { tunnelId: 'cf-tun-8a9d10e-k8s', colo: 'IAD' },
    },
    {
      id: 'log-03',
      timestamp: new Date(now - 75 * 1000).toISOString(),
      provider: 'cloudflare-infra',
      source: 'Worker::edge-request-router',
      level: 'INFO',
      message: 'Worker execution 0.02% error rate, p50 CPU 1.8ms across 284 edge PoPs',
      metadata: { rps: 1480, p99CpuMs: 6.4 },
    },
    {
      id: 'log-04',
      timestamp: new Date(now - 120 * 1000).toISOString(),
      provider: 'oracle',
      source: 'OCI::ComputeService',
      level: 'INFO',
      message: 'Block volume attach NVMe health verified on oci-ampere-a1-prod-01 (AD-1)',
      metadata: { shape: 'VM.Standard.A1.Flex', iops: 7200 },
    },
    {
      id: 'log-05',
      timestamp: new Date(now - 180 * 1000).toISOString(),
      provider: 'aws',
      source: 'CloudWatch::AlarmService',
      level: 'INFO',
      message: 'CPUUtilization metric alarm state OK for db-read-replica-east (52.8%)',
      metadata: { threshold: '80%', currentValue: '52.8%' },
    },
    {
      id: 'log-06',
      timestamp: new Date(now - 290 * 1000).toISOString(),
      provider: 'cloudflare-infra',
      source: 'ZeroTrust::GatewayPolicy',
      level: 'SUCCESS',
      message: 'Identity posture verified for 95 active tunnel sessions through auth-vault',
      metadata: { posture: 'PASS', protocol: 'QUIC' },
    },
  ];

  // Generate Time Series for Infrastructure
  const timeSeries: InfraTimeSeriesPoint[] = [];
  for (let i = pointCount; i >= 0; i--) {
    const t = new Date(now - i * intervalMs);
    const timeFormatted =
      timeRange === '24h'
        ? t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : t.toLocaleDateString([], { month: 'short', day: 'numeric' });

    const baseCpu = 35 + Math.sin(i * 0.4) * 12;
    const baseMem = 58 + Math.cos(i * 0.3) * 8;
    const baseNet = 85 + Math.sin(i * 0.5) * 35;
    const baseRps = 2400 + Math.sin(i * 0.6) * 600;

    timeSeries.push({
      timestamp: t.toISOString(),
      formattedTime: timeFormatted,
      cpuAvg: Math.round(baseCpu * 10) / 10,
      memoryAvg: Math.round(baseMem * 10) / 10,
      networkMbps: Math.round(baseNet * 10) / 10,
      workerRps: Math.round(baseRps),
    });
  }

  // Summary aggregation
  const runningAws = awsInstances.filter((i) => i.state === 'running').length;
  const runningOci = oracleInstances.filter((i) => i.lifecycleState === 'RUNNING').length;
  const totalInstances = awsInstances.length + oracleInstances.length;
  const healthyInstances = runningAws + runningOci;

  const healthyTunnels = cloudflareTunnels.filter((t) => t.status === 'healthy').length;
  const totalWorkerRps = cloudflareWorkers.reduce((acc, w) => acc + w.requestsPerSec, 0);

  const avgCpu = Math.round(
    [...awsInstances, ...oracleInstances]
      .filter((i) => ('state' in i ? i.state === 'running' : i.lifecycleState === 'RUNNING'))
      .reduce((acc, i) => acc + i.cpuUtilization, 0) / (healthyInstances || 1)
  );

  const avgMem = Math.round(
    [...awsInstances, ...oracleInstances]
      .filter((i) => ('state' in i ? i.state === 'running' : i.lifecycleState === 'RUNNING'))
      .reduce((acc, i) => acc + i.memoryUtilization, 0) / (healthyInstances || 1)
  );

  const summary: InfraMetricSummary = {
    totalInstances,
    healthyInstances,
    totalTunnels: cloudflareTunnels.length,
    healthyTunnels,
    totalWorkers: cloudflareWorkers.length,
    workerRequestsPerSec: totalWorkerRps,
    avgCpuUtilization: avgCpu,
    avgMemoryUtilization: avgMem,
    activeAlertsCount: 0,
  };

  return {
    provider,
    accountId,
    accountName,
    region,
    isLive,
    lastUpdated: new Date().toISOString(),
    summary,
    awsInstances: provider === 'aws' || provider === 'unified-infra' ? awsInstances : [],
    cloudflareTunnels: provider === 'cloudflare-infra' || provider === 'unified-infra' ? cloudflareTunnels : [],
    cloudflareWorkers: provider === 'cloudflare-infra' || provider === 'unified-infra' ? cloudflareWorkers : [],
    oracleInstances: provider === 'oracle' || provider === 'unified-infra' ? oracleInstances : [],
    infraLogs,
    timeSeries,
  };
}
