export type InfraProviderType = 'unified-infra' | 'aws' | 'cloudflare-infra' | 'oracle';

export type ActiveCategory = 'analytics' | 'infrastructure';

export interface InfraAccount {
  id: string;
  provider: InfraProviderType;
  name: string;
  region: string;
  targetResource: string;
  hasKey: boolean;
  isLiveConnected: boolean;
  createdAt: string;
}

export interface AwsInstance {
  instanceId: string;
  name: string;
  state: 'running' | 'stopped' | 'stopping' | 'pending' | 'rebooting';
  instanceType: string;
  availabilityZone: string;
  publicIp: string;
  privateIp: string;
  systemStatus: 'ok' | 'impaired' | 'initializing';
  instanceStatus: 'ok' | 'impaired' | 'initializing';
  cpuUtilization: number; // percentage
  memoryUtilization: number; // percentage
  diskReadOps: number;
  diskWriteOps: number;
  networkInKbps: number;
  networkOutKbps: number;
  uptimeHours: number;
  launchTime: string;
  tags: Record<string, string>;
  cpuHistory: number[];
}

export interface CloudflareGatewayTunnel {
  id: string;
  name: string;
  status: 'healthy' | 'degraded' | 'down' | 'inactive';
  connectors: {
    id: string;
    version: string;
    originIp: string;
    colo: string;
    state: 'connected' | 'disconnected';
  }[];
  ingressRules: {
    hostname: string;
    service: string;
    path?: string;
  }[];
  bytesTransferred: number;
  activeConnections: number;
  latencyMs: number;
  createdAt: string;
}

export interface CloudflareWorkerService {
  id: string;
  name: string;
  status: 'active' | 'gradual-rollout' | 'paused';
  routes: string[];
  requestsPerSec: number;
  p50CpuMs: number;
  p99CpuMs: number;
  subrequestCount: number;
  errorRate: number; // percentage
  memoryMb: number;
  scriptSizeKb: number;
  lastDeployed: string;
  invocationHistory: number[];
}

export interface OracleComputeInstance {
  ocid: string;
  displayName: string;
  shape: string;
  ocpuCount: number;
  memoryGb: number;
  availabilityDomain: string;
  faultDomain: string;
  lifecycleState: 'RUNNING' | 'STOPPED' | 'STARTING' | 'TERMINATING';
  cpuUtilization: number;
  memoryUtilization: number;
  vnicState: 'ATTACHED' | 'PROVISIONING';
  publicIp: string;
  privateIp: string;
  blockVolumeReadIops: number;
  blockVolumeWriteIops: number;
  timeCreated: string;
  cpuHistory: number[];
}

export interface InfraLogEvent {
  id: string;
  timestamp: string;
  provider: InfraProviderType;
  source: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL' | 'SUCCESS';
  message: string;
  metadata?: Record<string, string | number>;
}

export interface InfraMetricSummary {
  totalInstances: number;
  healthyInstances: number;
  totalTunnels: number;
  healthyTunnels: number;
  totalWorkers: number;
  workerRequestsPerSec: number;
  avgCpuUtilization: number;
  avgMemoryUtilization: number;
  activeAlertsCount: number;
}

export interface InfraTimeSeriesPoint {
  timestamp: string;
  formattedTime: string;
  cpuAvg: number;
  memoryAvg: number;
  networkMbps: number;
  workerRps: number;
}

export interface UnifiedInfraData {
  provider: InfraProviderType;
  accountId: string;
  accountName: string;
  region: string;
  isLive: boolean;
  lastUpdated: string;
  summary: InfraMetricSummary;
  awsInstances: AwsInstance[];
  cloudflareTunnels: CloudflareGatewayTunnel[];
  cloudflareWorkers: CloudflareWorkerService[];
  oracleInstances: OracleComputeInstance[];
  infraLogs: InfraLogEvent[];
  timeSeries: InfraTimeSeriesPoint[];
}

export type OracleInstance = OracleComputeInstance;
export type InfrastructureLogEntry = InfraLogEvent;

export interface InfraCredentialsPayload {
  accountId?: string;
  provider: InfraProviderType;
  name: string;
  region?: string;
  targetResource: string;
  apiKey?: string;
  apiSecret?: string;
  tenancyOcid?: string;
  userOcid?: string;
  fingerprint?: string;
  privateKey?: string;
}
