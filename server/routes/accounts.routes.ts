import { Router, Request, Response } from 'express';
import { vault } from '../services/credential-vault.service';
import { analyticsCache } from '../services/cache.service';
import {
  initSchema,
  saveUserAccount,
  getUserAccounts,
  deleteUserAccount,
  encryptJson,
} from '../services/db.service';
import { attachUser } from './auth.routes';
import { ProviderCredentialsPayload, ProviderType } from '../../src/types/analytics';

const router = Router();

router.use(attachUser);

// GET /api/accounts - List sanitized accounts (env-seeded + persisted for the logged-in user)
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const provider = req.query.provider as ProviderType | undefined;
    const accounts = vault.getAccounts(provider);
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
router.post('/save', async (req: Request, res: Response): Promise<void> => {
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
router.post('/test-connection', async (req: Request, res: Response): Promise<void> => {
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
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
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
