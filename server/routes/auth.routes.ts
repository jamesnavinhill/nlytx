import { Router, Request, Response } from 'express';
import {
  initSchema,
  findUserByEmail,
  createUser,
  createSession,
  getUserBySession,
  deleteSession,
  verifyPassword,
} from '../services/db.service';

const router = Router();

const COOKIE_NAME = 'nlytx_session';

function sessionCookie(token: string, expiresAt: Date): string {
  const parts = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Expires=${expiresAt.toUTCString()}`,
  ];
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') parts.push('Secure');
  return parts.join('; ');
}

function clearedCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: { id: string; email: string };
  }
}

// Session middleware shared with other routers via export
export async function attachUser(req: Request, res: Response, next: () => void): Promise<void> {
  try {
    const cookie = req.headers.cookie;
    const token = cookie
      ?.split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${COOKIE_NAME}=`))
      ?.slice(COOKIE_NAME.length + 1);
    if (token) {
      req.user = (await getUserBySession(token)) ?? undefined;
    }
  } catch (e) {
    console.error('Session lookup failed:', e);
  }
  next();
}

router.use(attachUser);

// GET /api/auth/me
router.get('/me', (req: Request, res: Response) => {
  res.json({ user: req.user ?? null, dbConnected: !!process.env.DATABASE_URL });
});

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    await initSchema();
    const { email, password } = req.body ?? {};
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ success: false, error: 'Valid email required' });
      return;
    }
    if (!password || password.length < 8) {
      res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
      return;
    }
    const existing = await findUserByEmail(email);
    if (existing) {
      res.status(409).json({ success: false, error: 'Account already exists — log in instead' });
      return;
    }
    const user = await createUser(email, password);
    const { token, expiresAt } = await createSession(user.id);
    res.setHeader('Set-Cookie', sessionCookie(token, expiresAt));
    res.json({ success: true, user });
  } catch (e: any) {
    console.error('Register failed:', e);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    await initSchema();
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Email and password required' });
      return;
    }
    const user = await findUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }
    const { token, expiresAt } = await createSession(user.id);
    res.setHeader('Set-Cookie', sessionCookie(token, expiresAt));
    res.json({ success: true, user: { id: user.id, email: user.email } });
  } catch (e: any) {
    console.error('Login failed:', e);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  try {
    const cookie = req.headers.cookie;
    const token = cookie
      ?.split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${COOKIE_NAME}=`))
      ?.slice(COOKIE_NAME.length + 1);
    if (token) await deleteSession(token);
  } finally {
    res.setHeader('Set-Cookie', clearedCookie());
    res.json({ success: true });
  }
});

export default router;
