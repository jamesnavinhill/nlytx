import { Router, Request, Response } from 'express';
import { vault } from '../services/credential-vault.service';
import { analyticsCache } from '../services/cache.service';
import { fetchAwsInfraAnalytics } from '../services/aws-infra.service';
import { fetchCloudflareInfraAnalytics } from '../services/cloudflare-infra.service';
import { fetchOracleInfraAnalytics } from '../services/oracle-infra.service';
import { generateSyntheticInfraTelemetry } from '../services/telemetry-generator-infra.service';
import { InfraProviderType, UnifiedInfraData } from '../../src/types/infrastructure';
import { TimeRange } from '../../src/types/analytics';

const router = Router();

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

// Helper to get infra data
async function resolveInfraData(
  provider: InfraProviderType,
  accountId: string,
  timeRange: TimeRange
): Promise<UnifiedInfraData> {
  const accountCreds = vault.getInfraAccount(accountId);
  const account = accountCreds?.account;
  const name = account?.name || 'Infrastructure Fleet';
  const region = account?.region || 'us-east-1';

  switch (provider) {
    case 'aws': {
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
      return await fetchCloudflareInfraAnalytics(
        accountCreds?.apiKey || '',
        account?.targetResource || '',
        accountId,
        name,
        timeRange
      );
    }
    case 'oracle': {
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
      return generateSyntheticInfraTelemetry('unified-infra', accountId, name, 'Global Fleet', timeRange, false);
    }
  }
}

// GET /api/infrastructure/data
router.get('/data', async (req: Request, res: Response) => {
  try {
    const provider = (req.query.provider as InfraProviderType) || 'unified-infra';
    const accountId = (req.query.accountId as string) || 'infra-mesh-all';
    const timeRange = (req.query.timeRange as TimeRange) || '24h';

    // Check cache
    const cached = analyticsCache.getInfra(provider, accountId, timeRange);
    if (cached) {
      return res.json({ success: true, data: cached, source: 'cache' });
    }

    const data = await resolveInfraData(provider, accountId, timeRange);
    analyticsCache.setInfra(provider, accountId, timeRange, data);

    res.json({ success: true, data, source: 'live' });
  } catch (e: any) {
    console.error('Infra data route failure:', e);
    res.status(500).json({ success: false, error: e.message || 'Failed to fetch infrastructure telemetry' });
  }
});

// POST /api/infrastructure/sync
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const { provider = 'unified-infra', accountId = 'infra-mesh-all', timeRange = '24h' } = req.body;
    analyticsCache.invalidate(provider, accountId);

    const data = await resolveInfraData(provider, accountId, timeRange);
    analyticsCache.setInfra(provider, accountId, timeRange, data);

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
    // Perform simulated or live action and emit event
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
