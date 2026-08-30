import postgres from 'postgres';
import crypto from 'crypto';

/**
 * Neon Postgres persistence: users, sessions, and per-user saved provider
 * accounts. Schema is created idempotently on first use.
 */

let sql: postgres.Sql | null = null;
let initPromise: Promise<void> | null = null;

export function getDb(): postgres.Sql | null {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  if (!sql) {
    sql = postgres(url, { max: 5, connect_timeout: 10, idle_timeout: 20 });
  }
  return sql;
}

export async function initSchema(): Promise<void> {
  const db = getDb();
  if (!db) return;
  if (!initPromise) {
    initPromise = (async () => {
      await db!`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
      await db!`
        CREATE TABLE IF NOT EXISTS sessions (
          token TEXT PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
      await db!`
        CREATE TABLE IF NOT EXISTS user_accounts (
          id TEXT PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          provider TEXT NOT NULL,
          name TEXT NOT NULL,
          target_resource TEXT NOT NULL,
          encrypted_api_key JSONB,
          encrypted_api_secret JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
    })().catch((e) => {
      initPromise = null;
      throw e;
    });
  }
  return initPromise;
}

// --- password hashing (scrypt, no native deps) ---

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

// --- AES-256-GCM for stored account keys (same key as the credential vault) ---

function masterKey(): Buffer {
  const secret = process.env.VAULT_ENCRYPTION_KEY || 'unified-analytics-master-salt-2026';
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptJson(value: string): { iv: string; authTag: string; ciphertext: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey(), iv);
  const ciphertext = cipher.update(value, 'utf8', 'hex') + cipher.final('hex');
  return { iv: iv.toString('hex'), authTag: cipher.getAuthTag().toString('hex'), ciphertext };
}

export function decryptJson(data: { iv: string; authTag: string; ciphertext: string }): string | undefined {
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey(), Buffer.from(data.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));
    return decipher.update(data.ciphertext, 'hex', 'utf8') + decipher.final('utf8');
  } catch {
    return undefined;
  }
}

// --- users & sessions ---

export interface DbUser {
  id: string;
  email: string;
}

export async function findUserByEmail(email: string): Promise<(DbUser & { passwordHash: string }) | null> {
  const db = getDb();
  if (!db) return null;
  const rows = await db`SELECT id, email, password_hash FROM users WHERE email = ${email.toLowerCase()} LIMIT 1`;
  return rows[0] ? { id: rows[0].id, email: rows[0].email, passwordHash: rows[0].password_hash } : null;
}

export async function createUser(email: string, password: string): Promise<DbUser> {
  const db = getDb()!;
  const rows = await db`
    INSERT INTO users (email, password_hash) VALUES (${email.toLowerCase()}, ${hashPassword(password)})
    RETURNING id, email`;
  return { id: rows[0].id, email: rows[0].email };
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const db = getDb()!;
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db`INSERT INTO sessions (token, user_id, expires_at) VALUES (${token}, ${userId}, ${expiresAt})`;
  return { token, expiresAt };
}

export async function getUserBySession(token: string): Promise<DbUser | null> {
  const db = getDb();
  if (!db) return null;
  const rows = await db`
    SELECT u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ${token} AND s.expires_at > now() LIMIT 1`;
  return rows[0] ? { id: rows[0].id, email: rows[0].email } : null;
}

export async function deleteSession(token: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db`DELETE FROM sessions WHERE token = ${token}`;
}

// --- persisted user accounts ---

export interface PersistedAccount {
  id: string;
  provider: string;
  name: string;
  targetResource: string;
  encryptedApiKey?: { iv: string; authTag: string; ciphertext: string };
  encryptedApiSecret?: { iv: string; authTag: string; ciphertext: string };
  createdAt: string;
}

export async function saveUserAccount(userId: string, account: PersistedAccount): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db`
    INSERT INTO user_accounts (id, user_id, provider, name, target_resource, encrypted_api_key, encrypted_api_secret, created_at)
    VALUES (${account.id}, ${userId}, ${account.provider}, ${account.name}, ${account.targetResource},
            ${db.json(account.encryptedApiKey ?? null)}, ${db.json(account.encryptedApiSecret ?? null)}, ${account.createdAt})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, target_resource = EXCLUDED.target_resource,
      encrypted_api_key = EXCLUDED.encrypted_api_key, encrypted_api_secret = EXCLUDED.encrypted_api_secret`;
}

export async function getUserAccounts(userId: string): Promise<PersistedAccount[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db`
    SELECT id, provider, name, target_resource, encrypted_api_key, encrypted_api_secret, created_at
    FROM user_accounts WHERE user_id = ${userId} ORDER BY created_at`;
  return rows.map((r) => ({
    id: r.id,
    provider: r.provider,
    name: r.name,
    targetResource: r.target_resource,
    encryptedApiKey: r.encrypted_api_key ?? undefined,
    encryptedApiSecret: r.encrypted_api_secret ?? undefined,
    createdAt: r.created_at?.toISOString?.() ?? new Date().toISOString(),
  }));
}

export async function deleteUserAccount(userId: string, id: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const rows = await db`DELETE FROM user_accounts WHERE user_id = ${userId} AND id = ${id} RETURNING id`;
  return rows.length > 0;
}
