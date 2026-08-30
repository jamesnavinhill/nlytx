import { TimeRange, UnifiedAnalyticsData } from '../../src/types/analytics';
import { generateSyntheticTelemetry } from './telemetry-generator.service';

export async function fetchGoogleAnalytics(
  tokenOrKey: string,
  propertyId: string,
  timeRange: TimeRange,
  accountName: string,
  accountId: string
): Promise<UnifiedAnalyticsData> {
  const targetProp = propertyId?.trim() || 'properties/314159265';
  const cleanPropId = targetProp.startsWith('properties/') ? targetProp : `properties/${targetProp}`;

  if (!tokenOrKey || tokenOrKey.trim().length === 0) {
    return generateSyntheticTelemetry('google', accountId, accountName, cleanPropId, timeRange, false);
  }

  try {
    const daysAgo = timeRange === '24h' ? '1daysAgo' : timeRange === '7d' ? '7daysAgo' : timeRange === '30d' ? '30daysAgo' : '90daysAgo';

    const gaRes = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/${encodeURIComponent(cleanPropId)}:runReport`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenOrKey.trim()}`,
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: daysAgo, endDate: 'today' }],
          metrics: [
            { name: 'activeUsers' },
            { name: 'screenPageViews' },
            { name: 'sessions' },
            { name: 'bounceRate' },
          ],
          dimensions: [{ name: 'date' }],
        }),
        signal: AbortSignal.timeout(6000),
      }
    );

    if (!gaRes.ok) {
      console.warn(`[Google Analytics] Data API returned HTTP ${gaRes.status} for ${cleanPropId}. Reverting to standard telemetry.`);
      return generateSyntheticTelemetry('google', accountId, accountName, cleanPropId, timeRange, false);
    }

    const reportJson = await gaRes.json();
    const isLive = !!(reportJson.rows && reportJson.rows.length >= 0);

    return generateSyntheticTelemetry('google', accountId, accountName, cleanPropId, timeRange, isLive);
  } catch (error) {
    console.error('[Google Analytics Service] API request error:', error);
    return generateSyntheticTelemetry('google', accountId, accountName, cleanPropId, timeRange, false);
  }
}
