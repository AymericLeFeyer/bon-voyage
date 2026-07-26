import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { nanoid } from 'nanoid';
import { pool } from './db.ts';
import type { PublicUser, User } from '../shared/types/user.ts';

const SESSION_COOKIE = 'bv_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 jours

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  country: string | null;
  avatar: string | null;
  created_at: Date;
}

const SELECT_USER_BY_ID = 'SELECT * FROM users WHERE id = $1';
const SELECT_USER_BY_EMAIL = 'SELECT * FROM users WHERE lower(email) = lower($1)';
const INSERT_USER = `
  INSERT INTO users (id, email, password_hash, name, country, avatar, created_at)
  VALUES ($1, $2, $3, $4, $5, $6, $7)
`;
const COUNT_USERS = 'SELECT COUNT(*)::int AS n FROM users';

const INSERT_SESSION =
  'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)';
const SELECT_SESSION = 'SELECT user_id, expires_at FROM sessions WHERE token = $1';
const DELETE_SESSION = 'DELETE FROM sessions WHERE token = $1';

// --- Mots de passe (node:crypto scrypt, aucun module natif) ---
function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const derived = scryptSync(password, Buffer.from(saltHex, 'hex'), 64);
  const expected = Buffer.from(hashHex, 'hex');
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

// --- Sérialisation ---
function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    country: row.country ?? undefined,
    avatar: row.avatar ?? undefined,
    createdAt: row.created_at.toISOString(),
  };
}

export function toPublicUser(user: User): PublicUser {
  return { id: user.id, email: user.email, name: user.name, avatar: user.avatar };
}

// --- Comptes ---
export async function isFirstUser(): Promise<boolean> {
  const { rows } = await pool.query<{ n: number }>(COUNT_USERS);
  return Number(rows[0].n) === 0;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const { rows } = await pool.query<UserRow>(SELECT_USER_BY_EMAIL, [email]);
  return rows[0] ? rowToUser(rows[0]) : null;
}

export async function findUserById(id: string): Promise<User | null> {
  const { rows } = await pool.query<UserRow>(SELECT_USER_BY_ID, [id]);
  return rows[0] ? rowToUser(rows[0]) : null;
}

export async function createUser(input: {
  email: string;
  password: string;
  name: string;
  country?: string;
  avatar?: string;
}): Promise<User> {
  const now = new Date().toISOString();
  const id = nanoid(12);
  await pool.query(INSERT_USER, [
    id,
    input.email.trim(),
    hashPassword(input.password),
    input.name.trim(),
    input.country?.trim() || null,
    input.avatar || null,
    now,
  ]);
  return {
    id,
    email: input.email.trim(),
    name: input.name.trim(),
    country: input.country?.trim() || undefined,
    avatar: input.avatar || undefined,
    createdAt: now,
  };
}

export async function authenticate(email: string, password: string): Promise<User | null> {
  const { rows } = await pool.query<UserRow>(SELECT_USER_BY_EMAIL, [email]);
  const row = rows[0];
  if (!row) return null;
  if (!verifyPassword(password, row.password_hash)) return null;
  return rowToUser(row);
}

export async function updateUserProfile(
  id: string,
  patch: { name?: string; country?: string; avatar?: string; password?: string },
): Promise<User | null> {
  const { rows } = await pool.query<UserRow>(SELECT_USER_BY_ID, [id]);
  const existing = rows[0];
  if (!existing) return null;
  const name = patch.name?.trim() || existing.name;
  const country = patch.country !== undefined ? patch.country.trim() || null : existing.country;
  const avatar = patch.avatar !== undefined ? patch.avatar || null : existing.avatar;
  const passwordHash = patch.password ? hashPassword(patch.password) : existing.password_hash;
  await pool.query(
    'UPDATE users SET name = $1, country = $2, avatar = $3, password_hash = $4 WHERE id = $5',
    [name, country, avatar, passwordHash, id],
  );
  return findUserById(id);
}

// --- Sessions & cookies ---
function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const now = Date.now();
  await pool.query(INSERT_SESSION, [
    token,
    userId,
    new Date(now).toISOString(),
    new Date(now + SESSION_TTL_MS).toISOString(),
  ]);
  return token;
}

export async function issueSession(res: Response, userId: string): Promise<void> {
  const token = await createSession(userId);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
}

export async function clearSession(req: Request, res: Response): Promise<void> {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (token) await pool.query(DELETE_SESSION, [token]);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

async function userFromRequest(req: Request): Promise<User | null> {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!token) return null;
  const { rows } = await pool.query<{ user_id: string; expires_at: Date }>(SELECT_SESSION, [token]);
  const row = rows[0];
  if (!row) return null;
  if (row.expires_at.getTime() < Date.now()) {
    await pool.query(DELETE_SESSION, [token]);
    return null;
  }
  return findUserById(row.user_id);
}

// Expose l'utilisateur courant sur la requête (typé plus bas).
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/**
 * Middleware optionnel : attache req.user si connecté, sans bloquer.
 * ⚠️ Asynchrone désormais : les erreurs sont passées à `next` (Express 4 ne
 * rattrape pas les rejets de promesse — un throw non géré tuerait le process).
 */
export const withUser: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  userFromRequest(req)
    .then((user) => {
      if (user) req.user = user;
      next();
    })
    .catch(next);
};

/** Middleware strict : 401 si non connecté. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentification requise' });
    return;
  }
  next();
}
