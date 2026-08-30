import { Router, Request, Response } from 'express';
import { vault } from '../services/credential-vault.service';
import { fetchVercelAnalytics } from '../services/vercel.service';
import { fetchCloudflareAnalytics } from '../services/cloudflare.service';
import { fetchGoogleAnalytics } from '../services/google-analytics.service';
import { generateSyntheticTelemetry } from '../services/telemetry-generator.service';
import { mergeAnalyticsPayloads } from '../services/unified.service';
import { buildEmptyAnalyticsPayload } from '../services/telemetry-base';
import { analyticsCache } from '../services/cache.service';
import { attachUser } from './auth.routes';
import { TimeRange, ProviderType, UnifiedAnalyticsData } from '../../src/types/analytics';

const router = Router();

router.use(attachUser);

const UNIFIED_ACCOUNT = 'acc-unified-all';

function hasGoogleSa(): boolean {
  return !!process.env.GOOGLE_ANALYTICS_SA_JSON_B64 && !!process.env.GOOGLE_ANALYTICS_PROPERTY_ID;
}

/**
 * Live rollup across every credentialed provider account. Providers without
 * credentials are skipped (never synthesized) — an authenticated user only
 * ever sees real data, even if that means an honest empty view.
 */
async function resolveUnifiedLive(timeRange: TimeRange): Promise<UnifiedAnalyticsData> {
  const jobs: Promise<UnifiedAnalyticsData>[] = [];

  const vercel = vault.getAccount('acc-vercel-edge');
  if (vercel?.apiKey) {
    jobs.push(fetchVercelAnalytics(vercel.apiKey, vercel.account.targetResource, timeRange, vercel.account.name, vercel.account.id));
  }

  const cf = vault.getAccount('acc-cf-apex');
  if (cf?.apiKey) {
    jobs.push(fetchCloudflareAnalytics(cf.apiKey, cf.account.targetResource, timeRange, cf.account.name, cf.account.id));
  }

  if (hasGoogleSa()) {
    const ga = vault.getAccount('acc-ga4-main');
    jobs.push(fetchGoogleAnalytics('', ga?.account.targetResource ?? '', timeRange, ga?.account.name ?? 'Google Analytics', 'acc-ga4-main'));
  }

  if (jobs.length === 0) {
    return buildEmptyAnalyticsPayload('unified', UNIFIED_ACCOUNT, 'All Accounts', 'all-live-sources', timeRange);
  }

  const settled = await Promise.allSettled(jobs);
  const parts = settled
    .filter((s): s is PromiseFulfilledResult<UnifiedAnalyticsData> => s.status === 'fulfilled')
    .map((s) => s.value);

  return mergeAnalyticsPayloads(parts, timeRange) ?? buildEmptyAnalyticsPayload('unified', UNIFIED_ACCOUNT, 'All Accounts', 'all-live-sources', timeRange);
}

async function resolveAnalyticsPayload(
  provider: ProviderType,
  accountId: string,
  timeRange: TimeRange,
  authenticated: boolean
): Promise<UnifiedAnalyticsData> {
  // Unified view: demo for anonymous visitors, live rollup for signed-in users.
  if (provider === 'unified' || accountId === UNIFIED_ACCOUNT) {
    if (!authenticated) {
      return generateSyntheticTelemetry('unified', accountId, 'Analytics Feed', 'unified-mesh', timeRange, false);
    }
    return resolveUnifiedLive(timeRange);
  }

  const stored = vault.getAccount(accountId);
  const targetResource = stored?.account.targetResource || 'unified-mesh';
  const accountName = stored?.account.name || 'Analytics Feed';
  const hasKey = !!stored?.apiKey || (provider === 'google' && hasGoogleSa());

  if (provider === 'vercel' && stored?.apiKey) {
    return fetchVercelAnalytics(stored.apiKey, targetResource, timeRange, accountName, accountId);
  }
  if (provider === 'cloudflare' && stored?.apiKey) {
    return fetchCloudflareAnalytics(stored.apiKey, targetResource, timeRange, accountName, accountId);
  }
  if (provider === 'google' && hasGoogleSa()) {
    return fetchGoogleAnalytics(stored?.apiKey ?? '', targetResource, timeRange, accountName, accountId);
  }

  // No credentials: signed-in users get an honest empty view, anonymous get demo.
  if (authenticated) {
    return buildEmptyAnalyticsPayload(provider, accountId, accountName, targetResource, timeRange);
  }
  return generateSyntheticTelemetry(provider, accountId, accountName, targetResource, timeRange, false);
}

// GET /api/analytics/data - Efficient cached analytics retrieval
router.get('/data', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  try {
    const accountId = (req.query.accountId as string) || UNIFIED_ACCOUNT;
    const provider = (req.query.provider as ProviderType) || 'unified';
    const timeRange = (req.query.timeRange as TimeRange) || '24h';
    const forceRefresh = req.query.forceRefresh === 'true' || req.query.sync === 'true';
    const authenticated = !!req.user;
    // Separate cache namespaces so demo and live payloads never collide
    const cacheAccountId = authenticated ? `u:${accountId}` : accountId;

    if (!forceRefresh) {
      const cached = analyticsCache.get(provider, cacheAccountId, timeRange);
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

    const payload = await resolveAnalyticsPayload(provider, accountId, timeRange, authenticated);
    analyticsCache.set(provider, cacheAccountId, timeRange, payload);

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
    const resolvedAccountId = accountId || UNIFIED_ACCOUNT;
    const resolvedProvider: ProviderType = provider || 'unified';
    const resolvedTimeRange: TimeRange = timeRange || '24h';
    const authenticated = !!req.user;
    const cacheAccountId = authenticated ? `u:${resolvedAccountId}` : resolvedAccountId;

    analyticsCache.invalidate(resolvedProvider, cacheAccountId);

    const payload = await resolveAnalyticsPayload(resolvedProvider, resolvedAccountId, resolvedTimeRange, authenticated);
    analyticsCache.set(resolvedProvider, cacheAccountId, resolvedTimeRange, payload);

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
