import { Router, Request, Response, NextFunction } from 'express';
import { analyticsCache } from '../services/cache.service';
import { attachUser } from './auth.routes';

const router = Router();

router.use(attachUser);

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Sign in required' });
    return;
  }
  next();
}

const GATEWAY_BASE_URL = process.env.YRKA_GATEWAY_BASE_URL || 'https://gateway.yrka.io/v1';
const INSIGHT_MODEL = process.env.YRKA_INSIGHT_MODEL || 'nv-z-ai-glm-5-3-flash';

/**
 * POST /api/insights — natural-language insight summary over the current
 * unified rollup (analytics or infrastructure). Auth-gated like every other
 * mutation; the gateway key stays server-side.
 */
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const apiKey = process.env.YRKA_GATEWAY_API_KEY;
  if (!apiKey) {
    res.status(503).json({ success: false, error: 'AI insights are not configured.' });
    return;
  }

  const { scope, accountId, timeRange } = req.body || {};
  const isInfra = scope === 'infrastructure';
  const cacheProvider = isInfra ? 'unified-infra' : 'unified';
  const cached = analyticsCache.get(cacheProvider, accountId || 'unified', timeRange || '24h');

  if (!cached) {
    res.status(404).json({ success: false, error: 'No analytics data loaded yet — run a sync first.' });
    return;
  }

  // Compact the rollup to the fields that matter for a summary.
  const summary = (cached as unknown as { summary?: Record<string, unknown> }).summary ?? {};
  const timeSeries = (cached as { timeSeries?: unknown[] }).timeSeries;
  const focus = isInfra
    ? { summary, seriesPoints: Array.isArray(timeSeries) ? timeSeries.slice(-12) : undefined }
    : {
        summary,
        topPaths: (cached as unknown as { topPaths?: unknown[] }).topPaths?.slice(0, 8),
        statusCodes: (cached as unknown as { statusCodes?: unknown }).statusCodes,
      };

  try {
    const upstream = await fetch(`${GATEWAY_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'x-agency-surface': 'nlytx',
      },
      body: JSON.stringify({
        model: INSIGHT_MODEL,
        messages: [
          {
            role: 'system',
            content: isInfra
              ? 'You are an infrastructure analyst. In at most 120 words of plain prose: fleet health assessment, the most notable signal, and one concrete action. No headings, no bullet lists.'
              : 'You are a web-analytics analyst. In at most 120 words of plain prose: traffic assessment, the most notable signal, and one concrete action. No headings, no bullet lists.',
          },
          {
            role: 'user',
            content: `Time range: ${timeRange || '24h'}. Rollup payload: ${JSON.stringify(focus).slice(0, 6000)}`,
          },
        ],
        max_tokens: 500,
        temperature: 0.4,
      }),
    });

    if (!upstream.ok) {
      res.status(502).json({ success: false, error: `Insight generation failed (${upstream.status}).` });
      return;
    }

    const data = await upstream.json();
    const insight = data?.choices?.[0]?.message?.content;
    if (typeof insight !== 'string' || !insight.trim()) {
      res.status(502).json({ success: false, error: 'Insight generation returned no content.' });
      return;
    }

    res.json({ success: true, insight: insight.trim() });
  } catch (error) {
    console.error('[insights] generation failed:', error);
    res.status(502).json({ success: false, error: 'Insight generation request failed.' });
  }
});

export default router;
