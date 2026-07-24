import { randomBytes } from 'node:crypto';
import { db } from './db.ts';
import { findUserByEmail, findUserById, toPublicUser } from './auth.ts';
import { getTripMeta } from './repository.ts';
import type { Invitation, InviteInfo, TripMembers } from '../shared/types/user.ts';
import type { TripAccess } from '../shared/types/trip.ts';

interface MemberRow {
  trip_id: string;
  user_id: string;
  status: string;
  created_at: string;
}
interface InviteRow {
  token: string;
  trip_id: string;
  email: string;
  created_at: string;
}

const selectMembersOfTrip = db.prepare(
  'SELECT * FROM trip_members WHERE trip_id = ? ORDER BY created_at ASC',
);
const selectMembership = db.prepare(
  'SELECT user_id FROM trip_members WHERE trip_id = ? AND user_id = ?',
);
const insertMember = db.prepare(
  "INSERT OR IGNORE INTO trip_members (trip_id, user_id, status, created_at) VALUES (?, ?, 'accepted', ?)",
);
const deleteMember = db.prepare('DELETE FROM trip_members WHERE trip_id = ? AND user_id = ?');

const selectInvitesOfTrip = db.prepare(
  'SELECT * FROM trip_invites WHERE trip_id = ? ORDER BY created_at ASC',
);
const selectInviteByToken = db.prepare('SELECT * FROM trip_invites WHERE token = ?');
const selectInviteByTripEmail = db.prepare(
  'SELECT * FROM trip_invites WHERE trip_id = ? AND lower(email) = lower(?)',
);
const selectInvitesForEmail = db.prepare(
  'SELECT * FROM trip_invites WHERE lower(email) = lower(?) ORDER BY created_at DESC',
);
const insertInvite = db.prepare(
  'INSERT INTO trip_invites (token, trip_id, email, created_at) VALUES (?, ?, ?, ?)',
);
const deleteInviteByTripEmail = db.prepare(
  'DELETE FROM trip_invites WHERE trip_id = ? AND lower(email) = lower(?)',
);
const deleteInviteByToken = db.prepare('DELETE FROM trip_invites WHERE token = ?');

function tripTitle(tripId: string): string {
  const row = db.prepare('SELECT data FROM trips WHERE id = ?').get(tripId) as unknown as
    | { data: string }
    | undefined;
  if (!row) return 'Voyage';
  try {
    return (JSON.parse(row.data) as { title?: string }).title ?? 'Voyage';
  } catch {
    return 'Voyage';
  }
}

/** Accès du visiteur (nullable = non connecté). null = aucun accès. */
export function resolveAccess(tripId: string, userId: string | null): TripAccess | null {
  const meta = getTripMeta(tripId);
  if (!meta) return null;
  if (userId && meta.ownerId === userId) return 'owner';
  if (userId && selectMembership.get(tripId, userId)) return 'editor';
  if (meta.isPublic) return 'public';
  return null;
}

export function canEdit(tripId: string, userId: string | null): boolean {
  const access = resolveAccess(tripId, userId);
  return access === 'owner' || access === 'editor';
}

export function getMembers(tripId: string): TripMembers | null {
  const meta = getTripMeta(tripId);
  if (!meta || !meta.ownerId) return null;
  const owner = findUserById(meta.ownerId);
  if (!owner) return null;
  const memberRows = selectMembersOfTrip.all(tripId) as unknown as MemberRow[];
  const members = memberRows
    .map((row) => findUserById(row.user_id))
    .filter((u): u is NonNullable<typeof u> => u !== null)
    .map(toPublicUser);
  const inviteRows = selectInvitesOfTrip.all(tripId) as unknown as InviteRow[];
  const pendingInvites = inviteRows.map((r) => r.email);
  return { owner: toPublicUser(owner), members, pendingInvites };
}

export type InviteResult =
  | { ok: true; token: string; email: string; existingAccount: boolean }
  | { ok: false; reason: 'owner' | 'already-member' | 'already-invited' };

/**
 * Crée (ou récupère) une invitation par email. Fonctionne que l'email ait un
 * compte ou non. Renvoie le token pour construire le lien /invite/:token.
 */
export function createInvite(tripId: string, email: string): InviteResult {
  const meta = getTripMeta(tripId);
  if (!meta || !meta.ownerId) return { ok: false, reason: 'already-invited' };

  const owner = findUserById(meta.ownerId);
  if (owner && owner.email.toLowerCase() === email.toLowerCase()) {
    return { ok: false, reason: 'owner' };
  }

  const invited = findUserByEmail(email);
  if (invited && selectMembership.get(tripId, invited.id)) {
    return { ok: false, reason: 'already-member' };
  }

  const existing = selectInviteByTripEmail.get(tripId, email) as unknown as InviteRow | undefined;
  if (existing) {
    // Déjà invité : on réutilise le token (renvoi d'email possible).
    return { ok: true, token: existing.token, email, existingAccount: Boolean(invited) };
  }

  const token = randomBytes(24).toString('hex');
  insertInvite.run(token, tripId, email.trim(), new Date().toISOString());
  return { ok: true, token, email: email.trim(), existingAccount: Boolean(invited) };
}

export function getInviteByToken(token: string): InviteInfo | null {
  const row = selectInviteByToken.get(token) as unknown as InviteRow | undefined;
  if (!row) return null;
  const meta = getTripMeta(row.trip_id);
  if (!meta || !meta.ownerId) return null;
  const owner = findUserById(meta.ownerId);
  if (!owner) return null;
  return {
    tripId: row.trip_id,
    tripTitle: tripTitle(row.trip_id),
    owner: toPublicUser(owner),
    email: row.email,
  };
}

/** Invitations en attente pour un email (bannière accueil). */
export function listInvitationsForEmail(email: string): Invitation[] {
  const rows = selectInvitesForEmail.all(email) as unknown as InviteRow[];
  const out: Invitation[] = [];
  for (const row of rows) {
    const meta = getTripMeta(row.trip_id);
    if (!meta || !meta.ownerId) continue;
    const owner = findUserById(meta.ownerId);
    if (!owner) continue;
    out.push({ tripId: row.trip_id, tripTitle: tripTitle(row.trip_id), owner: toPublicUser(owner) });
  }
  return out;
}

/** L'utilisateur accepte l'invitation qui vise son email → devient membre. */
export function acceptInvitation(tripId: string, user: { id: string; email: string }): boolean {
  const invite = selectInviteByTripEmail.get(tripId, user.email) as unknown as
    | InviteRow
    | undefined;
  if (!invite) return false;
  insertMember.run(tripId, user.id, new Date().toISOString());
  deleteInviteByTripEmail.run(tripId, user.email);
  return true;
}

/** L'utilisateur refuse l'invitation qui vise son email. */
export function declineInvitation(tripId: string, email: string): boolean {
  const result = deleteInviteByTripEmail.run(tripId, email);
  return Number(result.changes) > 0;
}

/**
 * Acceptation via le lien email (token = capacité). Rattache l'utilisateur
 * connecté au voyage, quel que soit l'email de son compte. Renvoie le tripId.
 */
export function acceptInviteByToken(token: string, userId: string): string | null {
  const invite = selectInviteByToken.get(token) as unknown as InviteRow | undefined;
  if (!invite) return null;
  insertMember.run(invite.trip_id, userId, new Date().toISOString());
  deleteInviteByToken.run(token);
  return invite.trip_id;
}

/** Refus via le lien email. */
export function declineInviteByToken(token: string): boolean {
  const result = deleteInviteByToken.run(token);
  return Number(result.changes) > 0;
}

/** Retire un membre accepté (propriétaire, ou l'utilisateur se retire lui-même). */
export function removeMember(tripId: string, userId: string): boolean {
  const result = deleteMember.run(tripId, userId);
  return Number(result.changes) > 0;
}

/** Annule une invitation en attente (propriétaire). */
export function cancelInvite(tripId: string, email: string): boolean {
  const result = deleteInviteByTripEmail.run(tripId, email);
  return Number(result.changes) > 0;
}
