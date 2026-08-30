import {
  EC2Client,
  DescribeInstancesCommand,
  DescribeInstanceStatusCommand,
} from '@aws-sdk/client-ec2';
import {
  CloudWatchClient,
  GetMetricStatisticsCommand,
} from '@aws-sdk/client-cloudwatch';
import { TimeRange } from '../../src/types/analytics';
import { UnifiedInfraData, AwsInstance } from '../../src/types/infrastructure';
import { generateSyntheticInfraTelemetry } from './telemetry-generator-infra.service';
import { buildEmptyInfraPayload, timeRangeWindow } from './telemetry-base';

export async function fetchAwsInfraAnalytics(
  accessKeyId: string,
  secretAccessKey: string,
  region: string,
  accountId: string,
  accountName: string,
  timeRange: TimeRange
): Promise<UnifiedInfraData> {
  const resolvedRegion = region?.trim() || 'us-east-1';

  if (!accessKeyId?.trim() || !secretAccessKey?.trim()) {
    return generateSyntheticInfraTelemetry('aws', accountId, accountName, resolvedRegion, timeRange, false);
  }

  try {
    const ec2 = new EC2Client({
      region: resolvedRegion,
      credentials: { accessKeyId: accessKeyId.trim(), secretAccessKey: secretAccessKey.trim() },
    });
    const cw = new CloudWatchClient({
      region: resolvedRegion,
      credentials: { accessKeyId: accessKeyId.trim(), secretAccessKey: secretAccessKey.trim() },
    });

    const win = timeRangeWindow(timeRange);
    const period = timeRange === '24h' ? 3600 : 4 * 3600;
    const startTime = new Date(Date.now() - win.days * 24 * 60 * 60 * 1000);

    const desc = await ec2.send(new DescribeInstancesCommand({}), { abortSignal: AbortSignal.timeout(15000) });

    const instances: AwsInstance[] = [];
    for (const res of desc.Reservations ?? []) {
      for (const i of res.Instances ?? []) {
        const tags: Record<string, string> = {};
        for (const t of i.Tags ?? []) if (t.Key && t.Value) tags[t.Key] = t.Value;

        const instanceId = i.InstanceId ?? '';
        const launchTime = i.LaunchTime ?? new Date();
        const state = (i.State?.Name ?? 'stopped') as AwsInstance['state'];

        // Status checks (running instances only)
        let systemStatus: AwsInstance['systemStatus'] = 'initializing';
        let instanceStatus: AwsInstance['instanceStatus'] = 'initializing';
        if (state === 'running') {
          try {
            const st = await ec2.send(
              new DescribeInstanceStatusCommand({ InstanceIds: [instanceId], IncludeAllInstances: true }),
              { abortSignal: AbortSignal.timeout(10000) }
            );
            const s = st.InstanceStatuses?.[0];
            systemStatus = (s?.SystemStatus?.Status as AwsInstance['systemStatus']) ?? 'initializing';
            instanceStatus = (s?.InstanceStatus?.Status as AwsInstance['instanceStatus']) ?? 'initializing';
          } catch {
            // status check optional
          }
        } else {
          systemStatus = 'ok';
          instanceStatus = 'ok';
        }

        // CloudWatch metrics for running instances
        let cpu = 0;
        let networkInKbps = 0;
        let networkOutKbps = 0;
        let diskReadOps = 0;
        let diskWriteOps = 0;
        const cpuHistory: number[] = [];

        if (state === 'running') {
          const getStat = async (metric: string, namespace: string, stat: string, dims: any[]): Promise<{ avg: number; sum: number; points: number[] }> => {
            try {
              const r = await cw.send(
                new GetMetricStatisticsCommand({
                  Namespace: namespace,
                  MetricName: metric,
                  Dimensions: dims,
                  StartTime: startTime,
                  EndTime: new Date(),
                  Period: period,
                  Statistics: [stat === 'Sum' ? 'Sum' : 'Average'],
                }),
                { abortSignal: AbortSignal.timeout(10000) }
              );
              const pts = [...(r.Datapoints ?? [])].sort((a, b) => (a.Timestamp?.getTime() ?? 0) - (b.Timestamp?.getTime() ?? 0));
              const vals = pts.map((p) => (stat === 'Sum' ? p.Sum ?? 0 : p.Average ?? 0));
              const sum = vals.reduce((a, b) => a + b, 0);
              const avg = vals.length ? sum / vals.length : 0;
              return { avg, sum, points: vals };
            } catch {
              return { avg: 0, sum: 0, points: [] };
            }
          };

          const dims = [{ Name: 'InstanceId', Value: instanceId }];
          const cpuStat = await getStat('CPUUtilization', 'AWS/EC2', 'Average', dims);
          cpu = parseFloat(cpuStat.avg.toFixed(1));
          cpuHistory.push(...cpuStat.points.map((p) => parseFloat(p.toFixed(1))));

          const netIn = await getStat('NetworkIn', 'AWS/EC2', 'Sum', dims);
          const netOut = await getStat('NetworkOut', 'AWS/EC2', 'Sum', dims);
          const windowSeconds = win.days * 24 * 60 * 60;
          networkInKbps = parseFloat(((netIn.sum / windowSeconds / 1024) * 8).toFixed(1));
          networkOutKbps = parseFloat(((netOut.sum / windowSeconds / 1024) * 8).toFixed(1));

          const diskRead = await getStat('DiskReadOps', 'AWS/EC2', 'Sum', dims);
          const diskWrite = await getStat('DiskWriteOps', 'AWS/EC2', 'Sum', dims);
          diskReadOps = Math.round(diskRead.sum);
          diskWriteOps = Math.round(diskWrite.sum);
        }

        instances.push({
          instanceId,
          name: tags.Name ?? instanceId,
          state,
          instanceType: i.InstanceType ?? '',
          availabilityZone: i.Placement?.AvailabilityZone ?? resolvedRegion,
          publicIp: i.PublicIpAddress ?? '',
          privateIp: i.PrivateIpAddress ?? '',
          systemStatus,
          instanceStatus,
          cpuUtilization: cpu,
          memoryUtilization: 0, // requires CloudWatch agent
          diskReadOps,
          diskWriteOps,
          networkInKbps,
          networkOutKbps,
          uptimeHours: state === 'running' ? Math.max(0, Math.round((Date.now() - launchTime.getTime()) / 3600000)) : 0,
          launchTime: launchTime.toISOString(),
          tags,
          cpuHistory,
        });
      }
    }

    const payload = buildEmptyInfraPayload('aws', accountId, accountName, resolvedRegion);
    payload.isLive = true;
    payload.awsInstances = instances;
    const running = instances.filter((i) => i.state === 'running');
    payload.summary = {
      totalInstances: instances.length,
      healthyInstances: running.filter((i) => i.systemStatus === 'ok' && i.instanceStatus === 'ok').length,
      totalTunnels: 0,
      healthyTunnels: 0,
      totalWorkers: 0,
      workerRequestsPerSec: 0,
      avgCpuUtilization: running.length ? parseFloat((running.reduce((a, i) => a + i.cpuUtilization, 0) / running.length).toFixed(1)) : 0,
      avgMemoryUtilization: 0,
      activeAlertsCount: 0,
    };

    // Fleet-level time series from the first running instance's CPU history
    const ref = running[0];
    payload.timeSeries = ref?.cpuHistory.map((cpu, idx) => ({
      timestamp: new Date(startTime.getTime() + idx * period * 1000).toISOString(),
      formattedTime: timeRange === '24h'
        ? new Date(startTime.getTime() + idx * period * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : new Date(startTime.getTime() + idx * period * 1000).toLocaleDateString([], { month: 'short', day: 'numeric' }),
      cpuAvg: cpu,
      memoryAvg: 0,
      networkMbps: parseFloat((((ref.networkInKbps + ref.networkOutKbps) / 8) / (win.days * 24)).toFixed(2)),
      workerRps: 0,
    })) ?? [];

    payload.infraLogs = instances.map((i) => ({
      id: `aws-${i.instanceId}`,
      timestamp: new Date().toISOString(),
      provider: 'aws' as const,
      source: i.name,
      level: i.state === 'running' && i.systemStatus === 'ok' ? 'SUCCESS' : i.state === 'stopped' ? 'INFO' : 'WARN',
      message: `${i.instanceType} ${i.state} — system ${i.systemStatus}, instance ${i.instanceStatus}, cpu ${i.cpuUtilization}%`,
      metadata: { az: i.availabilityZone, publicIp: i.publicIp },
    }));

    return payload;
  } catch (error) {
    console.error('[AWS Infra Service] query failed:', error);
    return generateSyntheticInfraTelemetry('aws', accountId, accountName, region || 'us-east-1', timeRange, false);
  }
}
