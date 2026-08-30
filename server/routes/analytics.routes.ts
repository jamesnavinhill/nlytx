import { Router, Request, Response } from 'express';
import { vault } from '../services/credential-vault.service';
import { fetchVercelAnalytics } from '../services/vercel.service';
import { fetchCloudflareAnalytics } from '../services/cloudflare.service';
import { fetchGoogleAnalytics } from '../services/google-analytics.service';
import { generateSyntheticTelemetry } from '../services/telemetry-generator.service';
import { analyticsCache } from '../services/cache.service';
import { TimeRange, ProviderType, UnifiedAnalyticsData } from '../../src/types/analytics';

const router = Router();

async function resolveAnalyticsPayload(
  provider: ProviderType,
  accountId: string,
  timeRange: TimeRange
): Promise<UnifiedAnalyticsData> {
  const stored = vault.getAccount(accountId);
  const targetResource = stored?.account.targetResource || 'unified-mesh';
  const accountName = stored?.account.name || 'Analytics Feed';
  // Google credentials live in the SA JSON env var, not the vault — treat the
  // GA4 account as credentialed when it's present.
  const hasKey =
    !!stored?.apiKey ||
    (provider === 'google' && !!process.env.GOOGLE_ANALYTICS_SA_JSON_B64 && !!process.env.GOOGLE_ANALYTICS_PROPERTY_ID);

  if (provider === 'vercel' && hasKey) {
    return fetchVercelAnalytics(stored.apiKey!, targetResource, timeRange, accountName, accountId);
  }
  if (provider === 'cloudflare' && hasKey) {
    return fetchCloudflareAnalytics(stored.apiKey!, targetResource, timeRange, accountName, accountId);
  }
  if (provider === 'google' && hasKey) {
    return fetchGoogleAnalytics(stored.apiKey ?? '', targetResource, timeRange, accountName, accountId);
  }
  // Demo mode: no credentials for this provider
  return generateSyntheticTelemetry(provider, accountId, accountName, targetResource, timeRange, stored?.account.isLiveConnected || false);
}

// GET /api/analytics/data - Efficient cached analytics retrieval
router.get('/data', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  try {
    const accountId = (req.query.accountId as string) || 'acc-unified-all';
    const provider = (req.query.provider as ProviderType) || 'unified';
    const timeRange = (req.query.timeRange as TimeRange) || '24h';
    const forceRefresh = req.query.forceRefresh === 'true' || req.query.sync === 'true';

    // Check cache first unless force refresh requested
    if (!forceRefresh) {
      const cached = analyticsCache.get(provider, accountId, timeRange);
      if (cached) {
        res.json({
          success: true,
          data: cached,
          meta: {
            cached: true,
            latencyMs: Date.now() - startTime,
          },
        });
        return;
      }
    }

    const payload = await resolveAnalyticsPayload(provider, accountId, timeRange);

    // Store in cache for 60 seconds
    analyticsCache.set(provider, accountId, timeRange, payload);

    res.json({
      success: true,
      data: payload,
      meta: {
        cached: false,
        latencyMs: Date.now() - startTime,
        syncedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to load analytics payload:', error);
    res.status(500).json({ success: false, error: 'Internal telemetry retrieval failure' });
  }
});

// POST /api/analytics/sync - Explicit synchronization trigger
router.post('/sync', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  try {
    const { accountId, provider, timeRange } = req.body;
    const resolvedAccountId = accountId || 'acc-unified-all';
    const resolvedProvider: ProviderType = provider || 'unified';
    const resolvedTimeRange: TimeRange = timeRange || '24h';

    // Invalidate stale cache
    analyticsCache.invalidate(resolvedProvider, resolvedAccountId);

    const payload = await resolveAnalyticsPayload(resolvedProvider, resolvedAccountId, resolvedTimeRange);

    analyticsCache.set(resolvedProvider, resolvedAccountId, resolvedTimeRange, payload);

    res.json({
      success: true,
      data: payload,
      syncedAt: new Date().toISOString(),
      latencyMs: Date.now() - startTime,
    });
  } catch (error) {
    console.error('Failed to trigger synchronization:', error);
    res.status(500).json({ success: false, error: 'Synchronization trigger failure' });
  }
});

export default router;
