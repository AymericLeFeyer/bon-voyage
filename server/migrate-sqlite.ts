/**
 * Migration one-shot SQLite → PostgreSQL.
 *
 *   npm run migrate:sqlite -- ./data/trips.db
 *
 * Lit l'ancien fichier avec `node:sqlite` (toujours fourni par Node 24, plus
 * aucune dépendance de production dessus) et réinsère les données dans la base
 * pointée par DATABASE_URL. Rejouable sans risque : tout est en
 * `ON CONFLICT DO NOTHING`.
 *
 * ⚠️ `data/` contient plusieurs bases (trips.db, test-auth.db…) : le chemin est
 * un argument obligatoire, jamais une constante.
 * ⚠️ Si vous déplacez le fichier .db, emportez aussi ses `-wal` / `-shm` :
 * en mode WAL, les écritures récentes vivent dans le `-wal`.
 */
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { initSchema, pool, waitForDb } from './db.ts';

const sourcePath = process.argv[2];
if (!sourcePath) {
  console.error('Usage : npm run migrate:sqlite -- <chemin/vers/base.db>');
  process.exit(1);
}

const absolute = resolve(sourcePath);
if (!existsSync(absolute)) {
  console.error(`❌  Fichier introuvable : ${absolute}`);
  process.exit(1);
}

/** Une table SQLite absente (schéma antérieur à l'auth) ne doit pas tout arrêter. */
function readTable(db: DatabaseSync, table: string): Record<string, unknown>[] {
  try {
    return db.prepare(`SELECT * FROM ${table}`).all() as unknown as Record<string, unknown>[];
  } catch {
    console.log(`   (table ${table} absente de la source — ignorée)`);
    return [];
  }
}

const str = (v: unknown): string => String(v);
const nullable = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));
/** SQLite stocke les booléens en 0/1, Postgres attend un vrai boolean. */
const bool = (v: unknown): boolean => v === 1 || v === '1' || v === true;

console.log(`📦  Source SQLite : ${absolute}`);
const sqlite = new DatabaseSync(absolute, { readOnly: true });

await waitForDb();
await initSchema();

// L'ordre suit les clés étrangères : users → trips → sessions → membres → invitations.
const users = readTable(sqlite, 'users');
for (const u of users) {
  await pool.query(
    `INSERT INTO users (id, email, password_hash, name, country, avatar, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO NOTHING`,
    [
      str(u.id),
      str(u.email),
      str(u.password_hash),
      str(u.name),
      nullable(u.country),
      nullable(u.avatar),
      str(u.created_at),
    ],
  );
}

const trips = readTable(sqlite, 'trips');
for (const t of trips) {
  // `data` est déjà du JSON sérialisé : on le passe tel quel en ::jsonb,
  // sans reparser (aucune raison de risquer une reformulation du document).
  await pool.query(
    `INSERT INTO trips (id, data, owner_id, is_public, created_at, updated_at)
     VALUES ($1, $2::jsonb, $3, $4, $5, $6)
     ON CONFLICT (id) DO NOTHING`,
    [
      str(t.id),
      str(t.data),
      nullable(t.owner_id),
      bool(t.is_public),
      str(t.created_at),
      str(t.updated_at),
    ],
  );
}

const sessions = readTable(sqlite, 'sessions');
for (const s of sessions) {
  await pool.query(
    `INSERT INTO sessions (token, user_id, created_at, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (token) DO NOTHING`,
    [str(s.token), str(s.user_id), str(s.created_at), str(s.expires_at)],
  );
}

const members = readTable(sqlite, 'trip_members');
for (const m of members) {
  await pool.query(
    `INSERT INTO trip_members (trip_id, user_id, status, created_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (trip_id, user_id) DO NOTHING`,
    [str(m.trip_id), str(m.user_id), str(m.status ?? 'accepted'), str(m.created_at)],
  );
}

const invites = readTable(sqlite, 'trip_invites');
for (const i of invites) {
  await pool.query(
    `INSERT INTO trip_invites (token, trip_id, email, created_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (token) DO NOTHING`,
    [str(i.token), str(i.trip_id), str(i.email), str(i.created_at)],
  );
}

sqlite.close();

// Récapitulatif source / cible : c'est le contrôle qui valide la migration.
const tables = ['users', 'trips', 'sessions', 'trip_members', 'trip_invites'] as const;
const sourceCounts: Record<string, number> = {
  users: users.length,
  trips: trips.length,
  sessions: sessions.length,
  trip_members: members.length,
  trip_invites: invites.length,
};

console.log('\n✅  Migration terminée\n');
console.log('table            source → cible');
for (const table of tables) {
  const { rows } = await pool.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM ${table}`);
  console.log(`${table.padEnd(16)} ${String(sourceCounts[table]).padStart(5)} → ${rows[0].n}`);
}
console.log(
  '\n(la cible peut être supérieure à la source si la base contenait déjà des données)',
);

await pool.end();
