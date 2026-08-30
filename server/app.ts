import express from 'express';
import analyticsRoutes from './routes/analytics.routes';
import accountsRoutes from './routes/accounts.routes';
import infrastructureRoutes from './routes/infrastructure.routes';
import authRoutes from './routes/auth.routes';

/**
 * API-only Express app. Shared by the local dev server (server.ts) and the
 * Vercel function entry (api/index.ts). Static/SPA serving is NOT handled here.
 */
export function createApiApp(): express.Express {
  const app = express();

  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/accounts', accountsRoutes);
  app.use('/api/infrastructure', infrastructureRoutes);
  app.use('/api/auth', authRoutes);

  return app;
}
