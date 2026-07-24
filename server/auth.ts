import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { nanoid } from 'nanoid';
import { db } from './db.ts';
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
  created_at: string;
}

const selectUserById = db.prepare('SELECT * FROM users WHERE id = ?');
const selectUserByEmail = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)');
const insertUser = db.prepare(
  'INSERT INTO users (id, email, password_hash, name, country, avatar, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
);
const countUsers = db.prepare('SELECT COUNT(*) AS n FROM users');

const insertSession = db.prepare(
  'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
);
const selectSession = db.prepare('SELECT user_id, expires_at FROM sessions WHERE token = ?');
const deleteSession = db.prepare('DELETE FROM sessions WHERE token = ?');

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
    createdAt: row.created_at,
  };
}

export function toPublicUser(user: User): PublicUser {
  return { id: user.id, email: user.email, name: user.name, avatar: user.avatar };
}

// --- Comptes ---
export function isFirstUser(): boolean {
  const row = countUsers.get() as unknown as { n: number };
  return Number(row.n) === 0;
}

export function findUserByEmail(email: string): User | null {
  const row = selectUserByEmail.get(email) as unknown as UserRow | undefined;
  return row ? rowToUser(row) : null;
}

export function findUserById(id: string): User | null {
  const row = selectUserById.get(id) as unknown as UserRow | undefined;
  return row ? rowToUser(row) : null;
}

export function createUser(input: {
  email: string;
  password: string;
  name: string;
  country?: string;
  avatar?: string;
}): User {
  const now = new Date().toISOString();
  const id = nanoid(12);
  insertUser.run(
    id,
    input.email.trim(),
    hashPassword(input.password),
    input.name.trim(),
    input.country?.trim() || null,
    input.avatar || null,
    now,
  );
  return {
    id,
    email: input.email.trim(),
    name: input.name.trim(),
    country: input.country?.trim() || undefined,
    avatar: input.avatar || undefined,
    createdAt: now,
  };
}

export function authenticate(email: string, password: string): User | null {
  const row = selectUserByEmail.get(email) as unknown as UserRow | undefined;
  if (!row) return null;
  if (!verifyPassword(password, row.password_hash)) return null;
  return rowToUser(row);
}

export function updateUserProfile(
  id: string,
  patch: { name?: string; country?: string; avatar?: string; password?: string },
): User | null {
  const existing = selectUserById.get(id) as unknown as UserRow | undefined;
  if (!existing) return null;
  const name = patch.name?.trim() || existing.name;
  const country = patch.country !== undefined ? patch.country.trim() || null : existing.country;
  const avatar = patch.avatar !== undefined ? patch.avatar || null : existing.avatar;
  const passwordHash = patch.password ? hashPassword(patch.password) : existing.password_hash;
  db.prepare(
    'UPDATE users SET name = ?, country = ?, avatar = ?, password_hash = ? WHERE id = ?',
  ).run(name, country, avatar, passwordHash, id);
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

function createSession(userId: string): string {
  const token = randomBytes(32).toString('hex');
  const now = Date.now();
  insertSession.run(
    token,
    userId,
    new Date(now).toISOString(),
    new Date(now + SESSION_TTL_MS).toISOString(),
  );
  return token;
}

export function issueSession(res: Response, userId: string): void {
  const token = createSession(userId);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
}

export function clearSession(req: Request, res: Response): void {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (token) deleteSession.run(token);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

function userFromRequest(req: Request): User | null {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!token) return null;
  const row = selectSession.get(token) as unknown as
    | { user_id: string; expires_at: string }
    | undefined;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    deleteSession.run(token);
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

/** Middleware optionnel : attache req.user si connecté, sans bloquer. */
export function withUser(req: Request, _res: Response, next: NextFunction): void {
  const user = userFromRequest(req);
  if (user) req.user = user;
  next();
}

/** Middleware strict : 401 si non connecté. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentification requise' });
    return;
  }
  next();
}
