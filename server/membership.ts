import { randomBytes } from 'node:crypto';
import { pool, withTransaction } from './db.ts';
import { findUserByEmail, findUserById, toPublicUser } from './auth.ts';
import { getTripMeta, getTripTitle } from './repository.ts';
import type { Invitation, InviteInfo, PublicUser, TripMembers } from '../shared/types/user.ts';
import type { TripAccess } from '../shared/types/trip.ts';

interface MemberRow {
  trip_id: string;
  user_id: string;
  status: string;
  created_at: Date;
}
interface InviteRow {
  token: string;
  trip_id: string;
  email: string;
  created_at: Date;
}

const SELECT_MEMBERS_OF_TRIP =
  'SELECT * FROM trip_members WHERE trip_id = $1 ORDER BY created_at ASC';
const SELECT_MEMBERSHIP = 'SELECT user_id FROM trip_members WHERE trip_id = $1 AND user_id = $2';
const INSERT_MEMBER = `
  INSERT INTO trip_members (trip_id, user_id, status, created_at)
  VALUES ($1, $2, 'accepted', $3)
  ON CONFLICT (trip_id, user_id) DO NOTHING
`;
const DELETE_MEMBER = 'DELETE FROM trip_members WHERE trip_id = $1 AND user_id = $2';

const SELECT_INVITES_OF_TRIP =
  'SELECT * FROM trip_invites WHERE trip_id = $1 ORDER BY created_at ASC';
const SELECT_INVITE_BY_TOKEN = 'SELECT * FROM trip_invites WHERE token = $1';
const SELECT_INVITE_BY_TRIP_EMAIL =
  'SELECT * FROM trip_invites WHERE trip_id = $1 AND lower(email) = lower($2)';
const SELECT_INVITES_FOR_EMAIL =
  'SELECT * FROM trip_invites WHERE lower(email) = lower($1) ORDER BY created_at DESC';
const INSERT_INVITE =
  'INSERT INTO trip_invites (token, trip_id, email, created_at) VALUES ($1, $2, $3, $4)';
const DELETE_INVITE_BY_TRIP_EMAIL =
  'DELETE FROM trip_invites WHERE trip_id = $1 AND lower(email) = lower($2)';
const DELETE_INVITE_BY_TOKEN = 'DELETE FROM trip_invites WHERE token = $1';

// Participants (propriétaire + membres acceptés) de plusieurs voyages en UNE requête.
// ORDER BY : le propriétaire (sort_order = 0) toujours en tête.
const SELECT_PARTICIPANTS_OF_TRIPS = `
  SELECT t.id AS trip_id, u.id AS user_id, u.email, u.name, u.avatar,
         0 AS sort_order, t.created_at AS joined_at
    FROM trips t
    JOIN users u ON u.id = t.owner_id
   WHERE t.id = ANY($1::text[])
  UNION ALL
  SELECT m.trip_id, u.id AS user_id, u.email, u.name, u.avatar,
         1 AS sort_order, m.created_at AS joined_at
    FROM trip_members m
    JOIN users u ON u.id = m.user_id
   WHERE m.trip_id = ANY($1::text[]) AND m.status = 'accepted'
   ORDER BY sort_order ASC, joined_at ASC
`;

async function tripTitle(tripId: string): Promise<string> {
  return (await getTripTitle(tripId)) ?? 'Voyage';
}

/** Accès du visiteur (nullable = non connecté). null = aucun accès. */
export async function resolveAccess(
  tripId: string,
  userId: string | null,
): Promise<TripAccess | null> {
  const meta = await getTripMeta(tripId);
  if (!meta) return null;
  if (userId && meta.ownerId === userId) return 'owner';
  if (userId) {
    const { rows } = await pool.query(SELECT_MEMBERSHIP, [tripId, userId]);
    if (rows.length > 0) return 'editor';
  }
  if (meta.isPublic) return 'public';
  return null;
}

export async function canEdit(tripId: string, userId: string | null): Promise<boolean> {
  const access = await resolveAccess(tripId, userId);
  return access === 'owner' || access === 'editor';
}

export async function getMembers(tripId: string): Promise<TripMembers | null> {
  const meta = await getTripMeta(tripId);
  if (!meta || !meta.ownerId) return null;
  const owner = await findUserById(meta.ownerId);
  if (!owner) return null;
  const { rows: memberRows } = await pool.query<MemberRow>(SELECT_MEMBERS_OF_TRIP, [tripId]);
  const users = await Promise.all(memberRows.map((row) => findUserById(row.user_id)));
  const members = users.filter((u): u is NonNullable<typeof u> => u !== null).map(toPublicUser);
  const { rows: inviteRows } = await pool.query<InviteRow>(SELECT_INVITES_OF_TRIP, [tripId]);
  const pendingInvites = inviteRows.map((r) => r.email);
  return { owner: toPublicUser(owner), members, pendingInvites };
}

/**
 * Participants de plusieurs voyages d'un coup (propriétaire en tête).
 * Évite le N+1 de `GET /trips` : avec une base distante, appeler `getMembers`
 * dans une boucle coûtait un aller-retour réseau par voyage *et par membre*.
 */
export async function getParticipantsOfTrips(
  tripIds: string[],
): Promise<Map<string, PublicUser[]>> {
  const byTrip = new Map<string, PublicUser[]>();
  if (tripIds.length === 0) return byTrip;
  const { rows } = await pool.query<{
    trip_id: string;
    user_id: string;
    email: string;
    name: string;
    avatar: string | null;
  }>(SELECT_PARTICIPANTS_OF_TRIPS, [tripIds]);
  for (const row of rows) {
    const list = byTrip.get(row.trip_id) ?? [];
    list.push({
      id: row.user_id,
      email: row.email,
      name: row.name,
      avatar: row.avatar ?? undefined,
    });
    byTrip.set(row.trip_id, list);
  }
  return byTrip;
}

export type InviteResult =
  | { ok: true; token: string; email: string; existingAccount: boolean }
  | { ok: false; reason: 'owner' | 'already-member' | 'already-invited' };

/**
 * Crée (ou récupère) une invitation par email. Fonctionne que l'email ait un
 * compte ou non. Renvoie le token pour construire le lien /invite/:token.
 */
export async function createInvite(tripId: string, email: string): Promise<InviteResult> {
  const meta = await getTripMeta(tripId);
  if (!meta || !meta.ownerId) return { ok: false, reason: 'already-invited' };

  const owner = await findUserById(meta.ownerId);
  if (owner && owner.email.toLowerCase() === email.toLowerCase()) {
    return { ok: false, reason: 'owner' };
  }

  const invited = await findUserByEmail(email);
  if (invited) {
    const { rows } = await pool.query(SELECT_MEMBERSHIP, [tripId, invited.id]);
    if (rows.length > 0) return { ok: false, reason: 'already-member' };
  }

  const { rows: existingRows } = await pool.query<InviteRow>(SELECT_INVITE_BY_TRIP_EMAIL, [
    tripId,
    email,
  ]);
  const existing = existingRows[0];
  if (existing) {
    // Déjà invité : on réutilise le token (renvoi d'email possible).
    return { ok: true, token: existing.token, email, existingAccount: Boolean(invited) };
  }

  const token = randomBytes(24).toString('hex');
  await pool.query(INSERT_INVITE, [token, tripId, email.trim(), new Date().toISOString()]);
  return { ok: true, token, email: email.trim(), existingAccount: Boolean(invited) };
}

export async function getInviteByToken(token: string): Promise<InviteInfo | null> {
  const { rows } = await pool.query<InviteRow>(SELECT_INVITE_BY_TOKEN, [token]);
  const row = rows[0];
  if (!row) return null;
  const meta = await getTripMeta(row.trip_id);
  if (!meta || !meta.ownerId) return null;
  const owner = await findUserById(meta.ownerId);
  if (!owner) return null;
  return {
    tripId: row.trip_id,
    tripTitle: await tripTitle(row.trip_id),
    owner: toPublicUser(owner),
    email: row.email,
  };
}

/** Invitations en attente pour un email (bannière accueil). */
export async function listInvitationsForEmail(email: string): Promise<Invitation[]> {
  const { rows } = await pool.query<InviteRow>(SELECT_INVITES_FOR_EMAIL, [email]);
  const out: Invitation[] = [];
  for (const row of rows) {
    const meta = await getTripMeta(row.trip_id);
    if (!meta || !meta.ownerId) continue;
    const owner = await findUserById(meta.ownerId);
    if (!owner) continue;
    out.push({
      tripId: row.trip_id,
      tripTitle: await tripTitle(row.trip_id),
      owner: toPublicUser(owner),
    });
  }
  return out;
}

/**
 * L'utilisateur accepte l'invitation qui vise son email → devient membre.
 * Transaction : ajout du membre + consommation de l'invitation sont indissociables.
 */
export async function acceptInvitation(
  tripId: string,
  user: { id: string; email: string },
): Promise<boolean> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<InviteRow>(SELECT_INVITE_BY_TRIP_EMAIL, [
      tripId,
      user.email,
    ]);
    if (rows.length === 0) return false;
    await client.query(INSERT_MEMBER, [tripId, user.id, new Date().toISOString()]);
    await client.query(DELETE_INVITE_BY_TRIP_EMAIL, [tripId, user.email]);
    return true;
  });
}

/** L'utilisateur refuse l'invitation qui vise son email. */
export async function declineInvitation(tripId: string, email: string): Promise<boolean> {
  const result = await pool.query(DELETE_INVITE_BY_TRIP_EMAIL, [tripId, email]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * Acceptation via le lien email (token = capacité). Rattache l'utilisateur
 * connecté au voyage, quel que soit l'email de son compte. Renvoie le tripId.
 */
export async function acceptInviteByToken(token: string, userId: string): Promise<string | null> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<InviteRow>(SELECT_INVITE_BY_TOKEN, [token]);
    const invite = rows[0];
    if (!invite) return null;
    await client.query(INSERT_MEMBER, [invite.trip_id, userId, new Date().toISOString()]);
    await client.query(DELETE_INVITE_BY_TOKEN, [token]);
    return invite.trip_id;
  });
}

/** Refus via le lien email. */
export async function declineInviteByToken(token: string): Promise<boolean> {
  const result = await pool.query(DELETE_INVITE_BY_TOKEN, [token]);
  return (result.rowCount ?? 0) > 0;
}

/** Retire un membre accepté (propriétaire, ou l'utilisateur se retire lui-même). */
export async function removeMember(tripId: string, userId: string): Promise<boolean> {
  const result = await pool.query(DELETE_MEMBER, [tripId, userId]);
  return (result.rowCount ?? 0) > 0;
}

/** Annule une invitation en attente (propriétaire). */
export async function cancelInvite(tripId: string, email: string): Promise<boolean> {
  const result = await pool.query(DELETE_INVITE_BY_TRIP_EMAIL, [tripId, email]);
  return (result.rowCount ?? 0) > 0;
}
