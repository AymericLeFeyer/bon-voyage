import pg from 'pg';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    'DATABASE_URL est requis (ex. postgres://bonvoyage:motdepasse@localhost:5432/bonvoyage). ' +
      'Voir .env.example — en dev, lancez `docker compose up -d db`.',
  );
}

export const pool = new Pool({ connectionString, max: 10 });

// Un client inactif qui tombe (redémarrage du conteneur db, coupure réseau) émet
// une erreur sur le pool : sans ce listener, Node la traite comme non gérée et
// tue le process. Le pool recrée le client tout seul à la requête suivante.
pool.on('error', (err) => {
  console.error('⚠️  Erreur du pool PostgreSQL (le client sera recréé) :', err.message);
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Attend que PostgreSQL réponde. Le conteneur `db` peut démarrer après l'app
 * (ou redémarrer en cours de vie) : on réessaie avant d'abandonner.
 */
export async function waitForDb(retries = 15, delayMs = 2000): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (error) {
      if (attempt === retries) throw error;
      const message = error instanceof Error ? error.message : String(error);
      console.log(`⏳  PostgreSQL indisponible (${attempt}/${retries}) : ${message}`);
      await sleep(delayMs);
    }
  }
}

/**
 * Crée le schéma si absent. Doit être awaité **avant** `app.listen`
 * (contrairement à l'ancien SQLite synchrone, créé à l'import du module).
 */
export async function initSchema(): Promise<void> {
  // Le voyage complet est stocké comme document JSONB, indexé par id.
  // owner_id / is_public sont des colonnes dédiées (le JSON reste le *contenu*).
  // JSONB (et non TEXT) : la base est exposée à l'extérieur, on veut pouvoir
  // requêter le contenu (`data->>'title'`) depuis un client SQL.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS trips (
      id         TEXT PRIMARY KEY,
      data       JSONB NOT NULL,
      owner_id   TEXT,
      is_public  BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );
  `);

  // Comptes utilisateurs. avatar = data URL base64 (photo de profil), nullable.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      name          TEXT NOT NULL,
      country       TEXT,
      avatar        TEXT,
      created_at    TIMESTAMPTZ NOT NULL
    );
  `);

  // ⚠️ Unicité **insensible à la casse** : toutes les recherches de compte se font
  // en `lower(email)`. Un simple UNIQUE sur email laisserait coexister
  // a@x.com et A@x.com, dont une seule serait jamais retrouvée à la connexion.
  await pool.query(
    'CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));',
  );

  // Sessions par cookie (token opaque -> utilisateur), avec expiration.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL
    );
  `);

  // Membres acceptés d'un voyage (hors propriétaire). Tout membre est éditeur.
  // (Les invitations en attente vivent dans trip_invites, clé = email.)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS trip_members (
      trip_id    TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status     TEXT NOT NULL DEFAULT 'accepted',
      created_at TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (trip_id, user_id)
    );
  `);

  // Invitations par email (compte existant ou non). Un token = un lien /invite/:token.
  // Consommée à l'acceptation (→ trip_members) ou supprimée au refus / retrait.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS trip_invites (
      token      TEXT PRIMARY KEY,
      trip_id    TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      email      TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      UNIQUE (trip_id, email)
    );
  `);

  // Index de support des accès fréquents (liste des voyages, résolution de session,
  // invitations d'un email).
  await pool.query('CREATE INDEX IF NOT EXISTS trips_owner_idx ON trips (owner_id);');
  await pool.query('CREATE INDEX IF NOT EXISTS trip_members_user_idx ON trip_members (user_id);');
  await pool.query('CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);');
  await pool.query(
    'CREATE INDEX IF NOT EXISTS trip_invites_email_idx ON trip_invites (lower(email));',
  );
}

/**
 * Exécute une suite de requêtes dans une transaction. Nécessaire dès qu'une
 * opération enchaîne plusieurs écritures (ex. accepter une invitation =
 * ajouter le membre + consommer l'invitation) : en réseau, une coupure entre
 * les deux laisserait la base incohérente.
 */
export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
