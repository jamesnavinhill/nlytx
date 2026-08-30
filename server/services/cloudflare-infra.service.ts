import { TimeRange } from '../../src/types/analytics';
import { UnifiedInfraData, CloudflareGatewayTunnel, CloudflareWorkerService } from '../../src/types/infrastructure';
import { generateSyntheticInfraTelemetry } from './telemetry-generator-infra.service';
import { buildEmptyInfraPayload, timeRangeWindow } from './telemetry-base';

const CF_API = 'https://api.cloudflare.com/client/v4';

export async function fetchCloudflareInfraAnalytics(
  token: string,
  cfAccountId: string,
  accountId: string,
  accountName: string,
  timeRange: TimeRange
): Promise<UnifiedInfraData> {
  const targetAccount = cfAccountId?.trim() || '';

  if (!token || token.trim().length === 0 || !targetAccount || targetAccount.startsWith('cf_acc_')) {
    return generateSyntheticInfraTelemetry('cloudflare-infra', accountId, accountName, 'global', timeRange, false);
  }

  try {
    const headers = {
      Authorization: `Bearer ${token.trim()}`,
      'Content-Type': 'application/json',
    };
    const win = timeRangeWindow(timeRange);

    // Verify account access first
    const acctRes = await fetch(`${CF_API}/accounts/${encodeURIComponent(targetAccount)}`, {
      headers,
      signal: AbortSignal.timeout(8000),
    });
    if (!acctRes.ok) {
      return generateSyntheticInfraTelemetry('cloudflare-infra', accountId, accountName, 'global', timeRange, false);
    }
    const acctJson = await acctRes.json();
    const resolvedName = acctJson.result?.name ?? accountName;

    const payload = buildEmptyInfraPayload('cloudflare-infra', accountId, resolvedName, 'Global Edge');

    // 1. Real Zero Trust tunnels + connectors + ingress config
    try {
      const tunnelsRes = await fetch(`${CF_API}/accounts/${encodeURIComponent(targetAccount)}/cfd_tunnel?is_deleted=false`, {
        headers,
        signal: AbortSignal.timeout(10000),
      });
      if (tunnelsRes.ok) {
        const tunnelsJson = await tunnelsRes.json();
        const tunnels: CloudflareGatewayTunnel[] = [];
        for (const t of tunnelsJson.result ?? []) {
          let connectors: CloudflareGatewayTunnel['connectors'] = [];
          try {
            const connRes = await fetch(`${CF_API}/accounts/${encodeURIComponent(targetAccount)}/cfd_tunnel/${t.id}/connections`, {
              headers,
              signal: AbortSignal.timeout(8000),
            });
            if (connRes.ok) {
              const connJson = await connRes.json();
              connectors = (connJson.result ?? []).map((c: any) => ({
                id: c.id ?? '',
                version: c.version ?? '',
                originIp: c.origin_ip ?? c.source_ip ?? '',
                colo: c.colo_name ?? c.colo ?? '',
                state: (c.status === 'connected' || c.id ? 'connected' : 'disconnected') as 'connected' | 'disconnected',
              }));
            }
          } catch {
            // connectors optional
          }

          let ingressRules: CloudflareGatewayTunnel['ingressRules'] = [];
          try {
            const cfgRes = await fetch(`${CF_API}/accounts/${encodeURIComponent(targetAccount)}/cfd_tunnel/${t.id}/configurations`, {
              headers,
              signal: AbortSignal.timeout(8000),
            });
            if (cfgRes.ok) {
              const cfgJson = await cfgRes.json();
              ingressRules = (cfgJson.result?.config?.ingress ?? [])
                .filter((r: any) => r.hostname)
                .map((r: any) => ({ hostname: r.hostname, service: r.service ?? '', path: r.path }));
            }
          } catch {
            // ingress optional
          }

          tunnels.push({
            id: t.id,
            name: t.name ?? t.id,
            status: t.status === 'healthy' ? 'healthy' : t.status === 'degraded' ? 'degraded' : t.connections?.length ? 'degraded' : 'inactive',
            connectors,
            ingressRules,
            bytesTransferred: 0, // per-tunnel transfer metrics are not exposed via API
            activeConnections: connectors.filter((c) => c.state === 'connected').length,
            latencyMs: 0,
            createdAt: t.created_at ?? new Date().toISOString(),
          });
        }
        payload.cloudflareTunnels = tunnels;
      }
    } catch (e) {
      console.warn('[CF Infra] tunnels fetch failed:', e);
    }

    // 2. Real Workers scripts + GraphQL invocation metrics
    try {
      const scriptsRes = await fetch(`${CF_API}/accounts/${encodeURIComponent(targetAccount)}/workers/scripts`, {
        headers,
        signal: AbortSignal.timeout(10000),
      });
      if (scriptsRes.ok) {
        const scriptsJson = await scriptsRes.json();
        const scripts: any[] = scriptsJson.result ?? [];

        // Aggregate invocation metrics per script over the window
        const metricsByScript = new Map<string, { requests: number; errors: number; p50: number; p99: number }>();
        try {
          const sinceIso = new Date(win.sinceMs).toISOString().slice(0, 19) + 'Z';
          const gql = `
            query WorkerMetrics($accountTag: String!, $since: Time!, $until: Time!) {
              viewer {
                accounts(filter: { accountTag: $accountTag }) {
                  workersInvocationsAdaptive(
                    limit: 10000,
                    filter: { scriptName_in: [${scripts.map((s) => `"${s.id}"`).join(', ')}], datetime_geq: $since, datetime_lt: $until },
                    orderBy: [scriptName_ASC]
                  ) {
                    sum { requests errors subrequests }
                    quantiles { cpuTimeP50 cpuTimeP99 }
                    dimensions { scriptName }
                  }
                }
              }
            }`;
          const gqlRes = await fetch('https://api.cloudflare.com/client/v4/graphql', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              query: gql,
              variables: { accountTag: targetAccount, since: sinceIso, until: new Date(win.untilMs).toISOString() },
            }),
            signal: AbortSignal.timeout(12000),
          });
          if (gqlRes.ok) {
            const gqlJson = await gqlRes.json();
            for (const row of gqlJson.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive ?? []) {
              metricsByScript.set(row.dimensions.scriptName, {
                requests: row.sum?.requests ?? 0,
                errors: row.sum?.errors ?? 0,
                p50: (row.quantiles?.cpuTimeP50 ?? 0) / 1000, // µs → ms
                p99: (row.quantiles?.cpuTimeP99 ?? 0) / 1000,
              });
            }
          }
        } catch (e) {
          console.warn('[CF Infra] worker metrics query failed:', e);
        }

        const windowSeconds = Math.max(1, win.days * 24 * 60 * 60);
        const workers: CloudflareWorkerService[] = scripts.map((s) => {
          const m = metricsByScript.get(s.id) ?? { requests: 0, errors: 0, p50: 0, p99: 0 };
          return {
            id: s.id,
            name: s.id,
            status: 'active',
            routes: [],
            requestsPerSec: parseFloat((m.requests / windowSeconds).toFixed(2)),
            p50CpuMs: parseFloat(m.p50.toFixed(2)),
            p99CpuMs: parseFloat(m.p99.toFixed(2)),
            subrequestCount: 0,
            errorRate: m.requests > 0 ? parseFloat(((m.errors / m.requests) * 100).toFixed(3)) : 0,
            memoryMb: 0,
            scriptSizeKb: s.size ? Math.round(s.size / 1024) : 0,
            lastDeployed: s.modified_on ?? s.created_on ?? new Date().toISOString(),
            invocationHistory: [],
          };
        });
        payload.cloudflareWorkers = workers;
      }
    } catch (e) {
      console.warn('[CF Infra] workers fetch failed:', e);
    }

    payload.isLive = true;
    const tunnels = payload.cloudflareTunnels;
    const healthy = tunnels.filter((t) => t.status === 'healthy');
    const totalWorkerReq = payload.cloudflareWorkers.reduce((a, w) => a + w.requestsPerSec, 0);
    payload.summary = {
      totalInstances: 0,
      healthyInstances: 0,
      totalTunnels: tunnels.length,
      healthyTunnels: healthy.length + tunnels.filter((t) => t.status === 'degraded' && t.activeConnections > 0).length,
      totalWorkers: payload.cloudflareWorkers.length,
      workerRequestsPerSec: parseFloat(totalWorkerReq.toFixed(1)),
      avgCpuUtilization: payload.cloudflareWorkers.length
        ? parseFloat((payload.cloudflareWorkers.reduce((a, w) => a + w.p50CpuMs, 0) / payload.cloudflareWorkers.length).toFixed(1))
        : 0,
      avgMemoryUtilization: 0,
      activeAlertsCount: tunnels.filter((t) => t.status === 'down').length,
    };

    payload.timeSeries = tunnels.flatMap((t) =>
      t.connectors.map((c, idx) => ({
        timestamp: new Date().toISOString(),
        formattedTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        cpuAvg: 0,
        memoryAvg: 0,
        networkMbps: 0,
        workerRps: parseFloat((payload.summary.workerRequestsPerSec / Math.max(1, idx + 1)).toFixed(2)),
      }))
    );

    payload.infraLogs = [
      ...tunnels.map((t) => ({
        id: `cfd-${t.id}`,
        timestamp: new Date().toISOString(),
        provider: 'cloudflare-infra' as const,
        source: t.name,
        level: (t.status === 'healthy' ? 'SUCCESS' : t.status === 'down' ? 'ERROR' : 'INFO') as any,
        message: `Tunnel ${t.status} — ${t.activeConnections} active connector(s)${t.ingressRules.length ? `, ${t.ingressRules.length} ingress rule(s)` : ''}`,
        metadata: { connectors: t.connectors.map((c) => c.colo).filter(Boolean).join(',') },
      })),
      ...payload.cloudflareWorkers.map((w) => ({
        id: `wkr-${w.id}`,
        timestamp: w.lastDeployed,
        provider: 'cloudflare-infra' as const,
        source: w.name,
        level: (w.errorRate > 1 ? 'WARN' : 'INFO') as any,
        message: `Worker active — ${w.requestsPerSec} rps, p50 cpu ${w.p50CpuMs}ms, errors ${w.errorRate}%`,
        metadata: { sizeKb: w.scriptSizeKb },
      })),
    ];

    return payload;
  } catch (error) {
    console.error('[CF Infra] query failed:', error);
    return generateSyntheticInfraTelemetry('cloudflare-infra', accountId, accountName, 'global', timeRange, false);
  }
}
