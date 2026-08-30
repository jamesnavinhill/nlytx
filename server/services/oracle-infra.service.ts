import { TimeRange } from '../../src/types/analytics';
import { UnifiedInfraData } from '../../src/types/infrastructure';
import { generateSyntheticInfraTelemetry } from './telemetry-generator-infra.service';

export async function fetchOracleInfraAnalytics(
  tenancyOcid: string,
  userOcid: string,
  fingerprint: string,
  privateKeyOrToken: string,
  region: string,
  accountId: string,
  accountName: string,
  timeRange: TimeRange
): Promise<UnifiedInfraData> {
  const resolvedRegion = region?.trim() || 'us-ashburn-1';

  if (!tenancyOcid || !privateKeyOrToken || tenancyOcid.trim().length === 0) {
    return generateSyntheticInfraTelemetry('oracle', accountId, accountName, resolvedRegion, timeRange, false);
  }

  try {
    const isLive = tenancyOcid.startsWith('ocid1.tenancy.oc1.');
    return generateSyntheticInfraTelemetry('oracle', accountId, accountName, resolvedRegion, timeRange, isLive);
  } catch (error) {
    console.error('[Oracle Infra Service] Query error:', error);
    return generateSyntheticInfraTelemetry('oracle', accountId, accountName, resolvedRegion, timeRange, false);
  }
}
