import { Router, Request, Response } from 'express';
import { vault } from '../services/credential-vault.service';
import { analyticsCache } from '../services/cache.service';
import { fetchAwsInfraAnalytics } from '../services/aws-infra.service';
import { fetchCloudflareInfraAnalytics } from '../services/cloudflare-infra.service';
import { fetchOracleInfraAnalytics } from '../services/oracle-infra.service';
import { generateSyntheticInfraTelemetry } from '../services/telemetry-generator-infra.service';
import { mergeInfraPayloads } from '../services/unified.service';
import { buildEmptyInfraPayload } from '../services/telemetry-base';
import { attachUser } from './auth.routes';
import { InfraProviderType, UnifiedInfraData } from '../../src/types/infrastructure';
import { TimeRange } from '../../src/types/analytics';

const router = Router();

router.use(attachUser);

const UNIFIED_ACCOUNT = 'infra-mesh-all';

async function resolveInfraData(
  provider: InfraProviderType,
  accountId: string,
  timeRange: TimeRange,
  authenticated: boolean = false
): Promise<UnifiedInfraData> {
  const accountCreds = vault.getInfraAccount(accountId);
  const account = accountCreds?.account;
  const name = account?.name || 'Infrastructure Fleet';
  const region = account?.region || 'us-east-1';

  switch (provider) {
    case 'aws': {
      if (authenticated && !(accountCreds?.apiKey && accountCreds?.apiSecret)) {
        return buildEmptyInfraPayload('aws', accountId, name, region);
      }
      return await fetchAwsInfraAnalytics(
        accountCreds?.apiKey || '',
        accountCreds?.apiSecret || '',
        region,
        accountId,
        name,
        timeRange
      );
    }
    case 'cloudflare-infra': {
      if (authenticated && !accountCreds?.apiKey) {
        return buildEmptyInfraPayload('cloudflare-infra', accountId, name, 'Global Edge');
      }
      return await fetchCloudflareInfraAnalytics(
        accountCreds?.apiKey || '',
        account?.targetResource || '',
        accountId,
        name,
        timeRange
      );
    }
    case 'oracle': {
      if (authenticated && !(accountCreds?.apiKey && accountCreds?.privateKey)) {
        return buildEmptyInfraPayload('oracle', accountId, name, region);
      }
      return await fetchOracleInfraAnalytics(
        accountCreds?.apiKey || '',
        '',
        '',
        accountCreds?.privateKey || '',
        region,
        accountId,
        name,
        timeRange
      );
    }
    case 'unified-infra':
    default: {
      if (!authenticated) {
        return generateSyntheticInfraTelemetry('unified-infra', accountId, name, 'Global Fleet', timeRange, false);
      }

      // Live rollup across every credentialed infrastructure account.
      const jobs: Promise<UnifiedInfraData>[] = [];

      const aws = vault.getInfraAccount('infra-aws-prod');
      if (aws?.apiKey && aws.apiSecret) {
        jobs.push(fetchAwsInfraAnalytics(aws.apiKey, aws.apiSecret, aws.account.region || 'us-east-1', 'infra-aws-prod', aws.account.name, timeRange));
      }

      const cfd = vault.getInfraAccount('infra-cf-zerotrust');
      if (cfd?.apiKey && cfd.account.targetResource && !cfd.account.targetResource.startsWith('cf_acc_')) {
        jobs.push(fetchCloudflareInfraAnalytics(cfd.apiKey, cfd.account.targetResource, 'infra-cf-zerotrust', cfd.account.name, timeRange));
      }

      if (jobs.length === 0) {
        return buildEmptyInfraPayload('unified-infra', UNIFIED_ACCOUNT, 'All Systems Fleet', 'multi-region (Global)');
      }

      const settled = await Promise.allSettled(jobs);
      const parts = settled
        .filter((s): s is PromiseFulfilledResult<UnifiedInfraData> => s.status === 'fulfilled')
        .map((s) => s.value);

      return mergeInfraPayloads(parts) ?? buildEmptyInfraPayload('unified-infra', UNIFIED_ACCOUNT, 'All Systems Fleet', 'multi-region (Global)');
    }
  }
}

// GET /api/infrastructure/accounts
router.get('/accounts', (req: Request, res: Response) => {
  try {
    const provider = req.query.provider as InfraProviderType | undefined;
    const accounts = vault.getInfraAccounts(provider);
    res.json({ success: true, accounts });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message || 'Failed to list infra accounts' });
  }
});

// POST /api/infrastructure/accounts/save
router.post('/accounts/save', (req: Request, res: Response) => {
  try {
    const payload = req.body;
    if (!payload.provider || !payload.name) {
      return res.status(400).json({ success: false, error: 'Provider and name are required' });
    }
    const account = vault.saveInfraCredential(payload);
    analyticsCache.invalidate(account.provider, account.id);
    res.json({ success: true, account });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message || 'Failed to save infra account' });
  }
});

// DELETE /api/infrastructure/accounts/:id
router.delete('/accounts/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = vault.deleteInfraAccount(id);
    analyticsCache.invalidate(undefined, id);
    res.json({ success: deleted });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message || 'Failed to delete infra account' });
  }
});

// GET /api/infrastructure/data
router.get('/data', async (req: Request, res: Response) => {
  try {
    const provider = (req.query.provider as InfraProviderType) || 'unified-infra';
    const accountId = (req.query.accountId as string) || UNIFIED_ACCOUNT;
    const timeRange = (req.query.timeRange as TimeRange) || '24h';
    const authenticated = !!req.user;
    const cacheAccountId = authenticated ? `u:${accountId}` : accountId;

    const cached = analyticsCache.getInfra(provider, cacheAccountId, timeRange);
    if (cached) {
      return res.json({ success: true, data: cached, source: 'cache' });
    }

    const data = await resolveInfraData(provider, accountId, timeRange, authenticated);
    analyticsCache.setInfra(provider, cacheAccountId, timeRange, data);

    res.json({ success: true, data, source: 'live' });
  } catch (e: any) {
    console.error('Infra data route failure:', e);
    res.status(500).json({ success: false, error: e.message || 'Failed to fetch infrastructure telemetry' });
  }
});

// POST /api/infrastructure/sync
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const { provider = 'unified-infra', accountId = UNIFIED_ACCOUNT, timeRange = '24h' } = req.body;
    const authenticated = !!req.user;
    const cacheAccountId = authenticated ? `u:${accountId}` : accountId;
    analyticsCache.invalidate(provider, cacheAccountId);

    const data = await resolveInfraData(provider, accountId, timeRange, authenticated);
    analyticsCache.setInfra(provider, cacheAccountId, timeRange, data);

    res.json({ success: true, data, source: 'sync' });
  } catch (e: any) {
    console.error('Infra sync route failure:', e);
    res.status(500).json({ success: false, error: e.message || 'Failed to sync infrastructure telemetry' });
  }
});

// POST /api/infrastructure/instance-action
router.post('/instance-action', async (req: Request, res: Response) => {
  try {
    const { instanceId, action, provider } = req.body;
    analyticsCache.invalidate(provider);
    res.json({
      success: true,
      message: `Action ${action} initiated successfully for instance ${instanceId}`,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message || 'Instance action failed' });
  }
});

export default router;
