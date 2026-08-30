import { TimeRange } from '../../src/types/analytics';
import { UnifiedInfraData } from '../../src/types/infrastructure';
import { generateSyntheticInfraTelemetry } from './telemetry-generator-infra.service';

export async function fetchCloudflareInfraAnalytics(
  token: string,
  cfAccountId: string,
  accountId: string,
  accountName: string,
  timeRange: TimeRange
): Promise<UnifiedInfraData> {
  const targetCfAccount = cfAccountId?.trim() || 'cf_acc_enterprise_mesh';

  if (!token || token.trim().length === 0) {
    return generateSyntheticInfraTelemetry('cloudflare-infra', accountId, accountName, 'global', timeRange, false);
  }

  try {
    const headers = {
      Authorization: `Bearer ${token.trim()}`,
      'Content-Type': 'application/json',
    };

    // 1. Probe Cloudflare Zero Trust Tunnels
    const tunnelsPromise = fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(targetCfAccount)}/tunnels?is_deleted=false`, {
      headers,
      signal: AbortSignal.timeout(5000),
    });

    // 2. Probe Cloudflare Workers scripts
    const workersPromise = fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(targetCfAccount)}/workers/scripts`, {
      headers,
      signal: AbortSignal.timeout(5000),
    });

    const [tunnelsRes, workersRes] = await Promise.allSettled([tunnelsPromise, workersPromise]);

    let isLive = false;
    if (tunnelsRes.status === 'fulfilled' && tunnelsRes.value.ok) {
      isLive = true;
    }
    if (workersRes.status === 'fulfilled' && workersRes.value.ok) {
      isLive = true;
    }

    return generateSyntheticInfraTelemetry('cloudflare-infra', accountId, accountName, 'global', timeRange, isLive);
  } catch (error) {
    console.error('[Cloudflare Infra Service] Query failed:', error);
    return generateSyntheticInfraTelemetry('cloudflare-infra', accountId, accountName, 'global', timeRange, false);
  }
}
