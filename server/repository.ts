import { nanoid } from 'nanoid';
import { pool } from './db.ts';
import type { Trip, TripInput, TripSummary } from '../shared/types/trip.ts';

interface TripRow {
  id: string;
  /** Colonne JSONB : `pg` renvoie déjà l'objet désérialisé (pas de JSON.parse). */
  data: Trip;
  owner_id: string | null;
  is_public: boolean;
  created_at: Date;
  updated_at: Date;
}

const SELECT_BY_ID = 'SELECT * FROM trips WHERE id = $1';
const INSERT_TRIP = `
  INSERT INTO trips (id, data, owner_id, is_public, created_at, updated_at)
  VALUES ($1, $2::jsonb, $3, false, $4, $5)
`;
const UPDATE_TRIP = 'UPDATE trips SET data = $1::jsonb, updated_at = $2 WHERE id = $3';
const DELETE_TRIP = 'DELETE FROM trips WHERE id = $1';
const SET_PUBLIC = 'UPDATE trips SET is_public = $1 WHERE id = $2';
const CLAIM_ORPHANS = 'UPDATE trips SET owner_id = $1 WHERE owner_id IS NULL';

// Voyages possédés OU dont l'utilisateur est membre accepté.
const SELECT_FOR_USER = `
  SELECT t.* FROM trips t
  WHERE t.owner_id = $1
     OR EXISTS (
       SELECT 1 FROM trip_members m
       WHERE m.trip_id = t.id AND m.user_id = $1 AND m.status = 'accepted'
     )
  ORDER BY t.updated_at DESC
`;

/** Reconstitue un Trip complet : contenu JSON + owner/public issus des colonnes. */
function rowToTrip(row: TripRow): Trip {
  return {
    ...row.data,
    id: row.id,
    ownerId: row.owner_id ?? '',
    isPublic: row.is_public,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/** Retire les informations confidentielles (vue affichage / public). Pure. */
export function stripConfidential(trip: Trip): Trip {
  return {
    ...trip,
    stages: trip.stages.map((stage) => {
      const { confidential: _c, ...rest } = stage;
      return {
        ...rest,
        places: stage.places.map((place) => {
          const { confidential: _pc, ...placeRest } = place;
          return placeRest;
        }),
      };
    }),
  };
}

export async function getTrip(id: string): Promise<Trip | null> {
  const { rows } = await pool.query<TripRow>(SELECT_BY_ID, [id]);
  return rows[0] ? rowToTrip(rows[0]) : null;
}

/** Métadonnées brutes (owner_id / is_public) sans rapatrier tout le contenu. */
export async function getTripMeta(
  id: string,
): Promise<{ ownerId: string | null; isPublic: boolean } | null> {
  const { rows } = await pool.query<{ owner_id: string | null; is_public: boolean }>(
    'SELECT owner_id, is_public FROM trips WHERE id = $1',
    [id],
  );
  const row = rows[0];
  if (!row) return null;
  return { ownerId: row.owner_id, isPublic: row.is_public };
}

/** Titre seul (invitations) : on ne désérialise pas tout le document. */
export async function getTripTitle(id: string): Promise<string | null> {
  const { rows } = await pool.query<{ title: string | null }>(
    "SELECT data->>'title' AS title FROM trips WHERE id = $1",
    [id],
  );
  if (rows.length === 0) return null;
  return rows[0].title ?? 'Voyage';
}

/** Résumés sans les participants : ceux-ci sont ajoutés par la route (voir membership). */
export type TripSummaryRow = Omit<TripSummary, 'members'> & { ownerId: string };

export async function listTripsForUser(userId: string): Promise<TripSummaryRow[]> {
  const { rows } = await pool.query<TripRow>(SELECT_FOR_USER, [userId]);
  return rows.map((row) => {
    const trip = rowToTrip(row);
    return {
      id: trip.id,
      title: trip.title,
      emoji: trip.emoji,
      destination: trip.destination,
      updatedAt: trip.updatedAt,
      stageCount: trip.stages.length,
      owned: trip.ownerId === userId,
      isPublic: trip.isPublic,
      ownerId: trip.ownerId,
    };
  });
}

export async function createTrip(input: TripInput, ownerId: string): Promise<Trip> {
  const now = new Date().toISOString();
  const id = nanoid(10);
  const content: Trip = {
    ...input,
    id,
    ownerId,
    isPublic: false,
    createdAt: now,
    updatedAt: now,
  };
  await pool.query(INSERT_TRIP, [id, JSON.stringify(content), ownerId, now, now]);
  return content;
}

/** Met à jour le *contenu* du voyage (owner_id / is_public conservés). */
export async function updateTrip(id: string, input: TripInput): Promise<Trip | null> {
  const existing = await getTrip(id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const content: Trip = {
    ...input,
    id: existing.id,
    ownerId: existing.ownerId,
    isPublic: existing.isPublic,
    createdAt: existing.createdAt,
    updatedAt: now,
  };
  await pool.query(UPDATE_TRIP, [JSON.stringify(content), now, id]);
  return content;
}

export async function setTripPublic(id: string, isPublic: boolean): Promise<Trip | null> {
  await pool.query(SET_PUBLIC, [isPublic, id]);
  return getTrip(id);
}

export async function deleteTrip(id: string): Promise<boolean> {
  const result = await pool.query(DELETE_TRIP, [id]);
  return (result.rowCount ?? 0) > 0;
}

/** Rattache tous les voyages sans propriétaire à un utilisateur (1er compte créé). */
export async function claimOrphanTrips(ownerId: string): Promise<void> {
  await pool.query(CLAIM_ORPHANS, [ownerId]);
}
