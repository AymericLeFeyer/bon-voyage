import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const databasePath = resolve(process.env.DATABASE_PATH ?? './data/trips.db');

// S'assurer que le dossier de la bdd existe.
mkdirSync(dirname(databasePath), { recursive: true });

// SQLite embarqué dans Node (node:sqlite) — aucun module natif à compiler.
export const db = new DatabaseSync(databasePath);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Le voyage complet est stocké comme document JSON, indexé par id.
// owner_id / is_public sont des colonnes dédiées (le JSON reste le *contenu*).
db.exec(`
  CREATE TABLE IF NOT EXISTS trips (
    id         TEXT PRIMARY KEY,
    data       TEXT NOT NULL,
    owner_id   TEXT,
    is_public  INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

// Comptes utilisateurs. avatar = data URL base64 (photo de profil), nullable.
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name          TEXT NOT NULL,
    country       TEXT,
    avatar        TEXT,
    created_at    TEXT NOT NULL
  );
`);

// Sessions par cookie (token opaque -> utilisateur), avec expiration.
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
`);

// Membres acceptés d'un voyage (hors propriétaire). Tout membre est éditeur.
// (Les invitations en attente vivent dans trip_invites, clé = email.)
db.exec(`
  CREATE TABLE IF NOT EXISTS trip_members (
    trip_id    TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status     TEXT NOT NULL DEFAULT 'accepted',
    created_at TEXT NOT NULL,
    PRIMARY KEY (trip_id, user_id)
  );
`);

// Invitations par email (compte existant ou non). Un token = un lien /invite/:token.
// Consommée à l'acceptation (→ trip_members) ou supprimée au refus / retrait.
db.exec(`
  CREATE TABLE IF NOT EXISTS trip_invites (
    token      TEXT PRIMARY KEY,
    trip_id    TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    email      TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (trip_id, email)
  );
`);

// --- Migration : ajouter owner_id / is_public si la table trips préexistait sans. ---
const tripColumns = (db.prepare('PRAGMA table_info(trips)').all() as unknown as {
  name: string;
}[]).map((c) => c.name);
if (!tripColumns.includes('owner_id')) {
  db.exec('ALTER TABLE trips ADD COLUMN owner_id TEXT;');
}
if (!tripColumns.includes('is_public')) {
  db.exec('ALTER TABLE trips ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;');
}
