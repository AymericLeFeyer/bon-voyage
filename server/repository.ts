import { nanoid } from 'nanoid';
import { db } from './db.ts';
import type { Trip, TripInput, TripSummary } from '../shared/types/trip.ts';

interface TripRow {
  id: string;
  data: string;
  owner_id: string | null;
  is_public: number;
  created_at: string;
  updated_at: string;
}

const selectById = db.prepare('SELECT * FROM trips WHERE id = ?');
const insertStmt = db.prepare(
  'INSERT INTO trips (id, data, owner_id, is_public, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)',
);
const updateStmt = db.prepare('UPDATE trips SET data = ?, updated_at = ? WHERE id = ?');
const deleteStmt = db.prepare('DELETE FROM trips WHERE id = ?');
const setPublicStmt = db.prepare('UPDATE trips SET is_public = ? WHERE id = ?');
const claimOrphansStmt = db.prepare('UPDATE trips SET owner_id = ? WHERE owner_id IS NULL');

// Voyages possédés OU dont l'utilisateur est membre accepté.
const selectForUser = db.prepare(`
  SELECT DISTINCT t.* FROM trips t
  LEFT JOIN trip_members m ON m.trip_id = t.id AND m.user_id = ? AND m.status = 'accepted'
  WHERE t.owner_id = ? OR m.user_id IS NOT NULL
  ORDER BY t.updated_at DESC
`);

/** Reconstitue un Trip complet : contenu JSON + owner/public issus des colonnes. */
function rowToTrip(row: TripRow): Trip {
  const content = JSON.parse(row.data) as Trip;
  return {
    ...content,
    id: row.id,
    ownerId: row.owner_id ?? '',
    isPublic: row.is_public === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Retire les informations confidentielles (vue affichage / public). */
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

export function getTrip(id: string): Trip | null {
  const row = selectById.get(id) as unknown as TripRow | undefined;
  return row ? rowToTrip(row) : null;
}

/** Métadonnées brutes (owner_id / is_public) sans désérialiser tout le contenu. */
export function getTripMeta(id: string): { ownerId: string | null; isPublic: boolean } | null {
  const row = selectById.get(id) as unknown as TripRow | undefined;
  if (!row) return null;
  return { ownerId: row.owner_id, isPublic: row.is_public === 1 };
}

export function listTripsForUser(userId: string): (TripSummary & { ownerId: string })[] {
  const rows = selectForUser.all(userId, userId) as unknown as TripRow[];
  return rows.map((row) => {
    const trip = rowToTrip(row);
    return {
      id: trip.id,
      title: trip.title,
      updatedAt: trip.updatedAt,
      stageCount: trip.stages.length,
      owned: trip.ownerId === userId,
      isPublic: trip.isPublic,
      ownerId: trip.ownerId,
    };
  });
}

export function createTrip(input: TripInput, ownerId: string): Trip {
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
  insertStmt.run(id, JSON.stringify(content), ownerId, now, now);
  return content;
}

/** Met à jour le *contenu* du voyage (owner_id / is_public conservés). */
export function updateTrip(id: string, input: TripInput): Trip | null {
  const existing = getTrip(id);
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
  updateStmt.run(JSON.stringify(content), now, id);
  return content;
}

export function setTripPublic(id: string, isPublic: boolean): Trip | null {
  setPublicStmt.run(isPublic ? 1 : 0, id);
  return getTrip(id);
}

export function deleteTrip(id: string): boolean {
  const result = deleteStmt.run(id);
  return Number(result.changes) > 0;
}

/** Rattache tous les voyages sans propriétaire à un utilisateur (1er compte créé). */
export function claimOrphanTrips(ownerId: string): void {
  claimOrphansStmt.run(ownerId);
}
