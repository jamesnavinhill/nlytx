import { Router, Request, Response } from 'express';
import { vault } from '../services/credential-vault.service';
import { analyticsCache } from '../services/cache.service';
import { listVercelSites } from '../services/vercel-sites.service';
import {
  initSchema,
  saveUserAccount,
  getUserAccounts,
  deleteUserAccount,
  encryptJson,
} from '../services/db.service';
import { attachUser } from './auth.routes';
import { ProviderAccount, ProviderCredentialsPayload, ProviderType } from '../../src/types/analytics';

const router = Router();

router.use(attachUser);

// Mutating endpoints are for signed-in users only — anonymous demo visitors
// never write to the vault.
function requireAuth(req: Request, res: Response, next: () => void): void {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Sign in required' });
    return;
  }
  next();
}

// GET /api/accounts - List sanitized accounts
// Authenticated: env-seeded + discovered Vercel sites + persisted for the user.
// Anonymous: a fully synthetic demo sidebar — real project/zone names and ids
// are server-side details that logged-out visitors must never see.
function demoAccounts(provider?: ProviderType): ProviderAccount[] {
  const now = new Date().toISOString();
  const all: ProviderAccount[] = [
    { id: 'acc-unified-all', provider: 'unified', name: 'Demo Workspace', targetResource: 'demo-mesh', hasKey: false, isLiveConnected: false, createdAt: now },
    { id: 'demo-vercel-1', provider: 'vercel', name: 'Demo Storefront', targetResource: 'demo-project-1', hasKey: true, isLiveConnected: false, createdAt: now },
    { id: 'demo-vercel-2', provider: 'vercel', name: 'Demo Docs Portal', targetResource: 'demo-project-2', hasKey: true, isLiveConnected: false, createdAt: now },
    { id: 'demo-vercel-3', provider: 'vercel', name: 'Demo Marketing Site', targetResource: 'demo-project-3', hasKey: true, isLiveConnected: false, createdAt: now },
    { id: 'demo-cloudflare-1', provider: 'cloudflare', name: 'Demo Zone', targetResource: 'demo-zone-1', hasKey: true, isLiveConnected: false, createdAt: now },
    { id: 'demo-google-1', provider: 'google', name: 'Demo GA4 Property', targetResource: 'properties/demo', hasKey: true, isLiveConnected: false, createdAt: now },
  ];
  return provider && provider !== 'unified' ? all.filter((a) => a.provider === provider) : all;
}

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const provider = req.query.provider as ProviderType | undefined;
    if (!req.user) {
      res.json({ success: true, accounts: demoAccounts(provider) });
      return;
    }
    const accounts = vault.getAccounts(provider);
    if (!provider || provider === 'unified' || provider === 'vercel') {
      // Every Vercel project visible to the configured tokens shows up as its
      // own site entry — analytics-enabled or not.
      const sites = await listVercelSites();
      const seen = new Set(accounts.map((a) => a.id));
      for (const s of sites) {
        if (seen.has(s.accountId)) continue;
        accounts.push({
          id: s.accountId,
          provider: 'vercel',
          name: s.name,
          targetResource: s.projectId,
          hasKey: true,
          isLiveConnected: true,
          createdAt: s.createdAt,
        });
      }
    }
    if (req.user) {
      await initSchema();
      const persisted = await getUserAccounts(req.user.id);
      const seen = new Set(accounts.map((a) => a.id));
      for (const p of persisted) {
        if (provider && provider !== 'unified' && p.provider !== provider) continue;
        if (seen.has(p.id)) continue;
        accounts.push({
          id: p.id,
          provider: p.provider as ProviderType,
          name: p.name,
          targetResource: p.targetResource,
          hasKey: !!p.encryptedApiKey,
          isLiveConnected: !!p.encryptedApiKey,
          createdAt: p.createdAt,
        });
      }
    }
    res.json({ success: true, accounts });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message || 'Failed to list accounts' });
  }
});

// POST /api/accounts/save - Securely store credential in vault (+ persist for logged-in users)
router.post('/save', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const payload: ProviderCredentialsPayload = req.body;
    if (!payload || !payload.provider || !payload.name) {
      res.status(400).json({ success: false, error: 'Provider and name are required' });
      return;
    }

    const account = vault.saveCredential(payload);
    analyticsCache.invalidate(account.provider, account.id);

    if (req.user) {
      await initSchema();
      await saveUserAccount(req.user.id, {
        id: account.id,
        provider: account.provider,
        name: account.name,
        targetResource: account.targetResource,
        encryptedApiKey: payload.apiKey?.trim() ? encryptJson(payload.apiKey.trim()) : undefined,
        encryptedApiSecret: payload.apiSecret ? encryptJson(payload.apiSecret) : undefined,
        createdAt: account.createdAt,
      });
    }

    res.json({ success: true, account });
  } catch (error) {
    console.error('Save credential failure:', error);
    res.status(500).json({ success: false, error: 'Failed to securely store credential' });
  }
});

// POST /api/accounts/test-connection - Verify provider tokens
router.post('/test-connection', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { provider, targetResource, apiKey } = req.body;
    const cleanKey = apiKey?.trim();

    if (!cleanKey || cleanKey.length === 0) {
      res.json({ success: true, isLive: false, message: 'Demo mode active (no secret key supplied)' });
      return;
    }

    if (provider === 'vercel') {
      const teamParam = process.env.VERCEL_TEAM_ID ? `?teamId=${process.env.VERCEL_TEAM_ID}` : '';
      const resp = await fetch(`https://api.vercel.com/v9/projects/${encodeURIComponent(targetResource?.trim() || '')}${teamParam}`, {
        headers: { Authorization: `Bearer ${cleanKey}` },
        signal: AbortSignal.timeout(8000),
      });
      if (resp.ok) {
        res.json({ success: true, isLive: true, message: 'Vercel API token verified successfully' });
        return;
      }
    } else if (provider === 'cloudflare') {
      const resp = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
        headers: { Authorization: `Bearer ${cleanKey}` },
        signal: AbortSignal.timeout(8000),
      });
      if (resp.ok) {
        const json = await resp.json();
        if (json.success) {
          res.json({ success: true, isLive: true, message: 'Cloudflare API token verified successfully' });
          return;
        }
      }
    } else if (provider === 'google') {
      res.json({ success: true, isLive: true, message: 'Google Analytics credentials registered' });
      return;
    }

    res.json({ success: true, isLive: false, message: 'Token saved — provider verification failed' });
  } catch (err) {
    res.json({ success: true, isLive: false, message: 'Connection test failed (offline?)' });
  }
});

// DELETE /api/accounts/:id - Remove account and wipe secrets
router.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id;
    const deleted = vault.deleteAccount(id);
    if (deleted) analyticsCache.invalidate(undefined, id);
    if (req.user) {
      await initSchema();
      await deleteUserAccount(req.user.id, id);
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message || 'Delete failed' });
  }
});

export default router;
