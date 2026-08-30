import crypto from 'crypto';

/**
 * Discovers every Vercel project the configured tokens can see — the personal
 * account (VERCEL_BEARER_TOKEN) and the studio-jami team (VERCEL_TEAM_TOKEN +
 * VERCEL_TEAM_ID). Results are cached for 5 minutes.
 */

export interface VercelSite {
  projectId: string;
  name: string;
  teamId?: string;
  token: string;
  /** stable account id used by /api/accounts + analytics resolution */
  accountId: string;
  createdAt: string;
}

interface SiteCache {
  sites: VercelSite[];
  expiresAt: number;
}

let cache: SiteCache | null = null;

interface RawProject {
  id: string;
  name: string;
  createdAt?: number;
}

async function listProjects(token: string, teamId?: string): Promise<RawProject[]> {
  const out: RawProject[] = [];
  let url = `https://api.vercel.com/v9/projects?limit=100${teamId ? `&teamId=${encodeURIComponent(teamId)}` : ''}`;
  for (let page = 0; page < 5; page++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return out;
    const json = await res.json();
    for (const p of json.projects ?? []) out.push({ id: p.id, name: p.name, createdAt: p.createdAt });
    const next = json.pagination?.next;
    if (!next) break;
    url = `https://api.vercel.com/v9/projects?limit=100&until=${encodeURIComponent(String(next))}${teamId ? `&teamId=${encodeURIComponent(teamId)}` : ''}`;
  }
  return out;
}

export async function listVercelSites(forceRefresh = false): Promise<VercelSite[]> {
  if (!forceRefresh && cache && Date.now() < cache.expiresAt) return cache.sites;

  const sites: VercelSite[] = [];
  const contexts: { token: string; teamId?: string }[] = [];

  const personal = process.env.VERCEL_BEARER_TOKEN?.trim();
  if (personal) contexts.push({ token: personal });

  const teamTok = process.env.VERCEL_TEAM_TOKEN?.trim();
  const teamId = process.env.VERCEL_TEAM_ID?.trim();
  if (teamTok && teamId) contexts.push({ token: teamTok, teamId });

  const settled = await Promise.allSettled(contexts.map((c) => listProjects(c.token, c.teamId)));
  settled.forEach((r, i) => {
    if (r.status !== 'fulfilled') {
      console.warn(`[Vercel Sites] project listing failed for context ${i}:`, r.reason);
      return;
    }
    for (const p of r.value) {
      sites.push({
        projectId: p.id,
        name: p.name,
        teamId: contexts[i].teamId,
        token: contexts[i].token,
        accountId: `vsite-${p.id}`,
        createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
      });
    }
  });

  cache = { sites, expiresAt: Date.now() + 5 * 60 * 1000 };
  return sites;
}

export async function findVercelSite(accountId: string): Promise<VercelSite | undefined> {
  if (!accountId.startsWith('vsite-')) return undefined;
  const sites = await listVercelSites();
  return sites.find((s) => s.accountId === accountId);
}

/** Deterministic per-site id (used where a stable seed id is needed) */
export function siteHash(projectId: string): string {
  return crypto.createHash('sha256').update(projectId).digest('hex').slice(0, 8);
}
