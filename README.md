# 🧭 Bon Voyage

**Planifiez vos voyages et voyez-les prendre forme sur la carte.**

Chaque voyage se compose d'**étapes** (là où l'on dort, dans un ordre défini) et, autour de chaque étape, de **lieux à visiter** sans ordre précis — le tout sur une carte interactive. Vols aller/retour, transports, budget, hébergements, créneaux planifiés, photos… Sauvegarde à la volée.

**Open source & self-hosted**, avec une option **SaaS** multi-comptes.

## Fonctionnement

- **Comptes** : inscription par email / mot de passe, profil (nom, photo, pays préféré).
- **Collaboration** : on **invite** des participants par email (compte existant ou non). Ils reçoivent un lien, **acceptent ou refusent**. Tout membre peut éditer.
  - **Emails optionnels** : sans configuration, l'invitation génère un **lien à partager manuellement** (rien à installer — idéal en self-hosted). Pour envoyer de vrais emails (utile en SaaS), renseignez `RESEND_API_KEY` ([Resend](https://resend.com), 3 000 emails/mois gratuits) — voir `.env.example`.
- **Vue affichage / vue admin** : dans les réglages, un voyage peut être rendu **public** (consultable sans compte via son lien). Un voyage public masque toujours les **informations confidentielles** (codes d'accès, n° de réservation…) — le filtrage est appliqué **côté serveur**.

## Stack

- **Frontend** : React 18 + Vite + TypeScript strict, architecture DDD, Tailwind (UI type shadcn/ui)
- **Carte** : MapLibre GL + react-map-gl, styles vectoriels CARTO (français forcé), autocomplétion d'adresses via Nominatim (OSM)
- **Backend** : Express + **PostgreSQL** (driver `pg`, 100 % JS — aucun module natif à compiler). Auth par cookie de session, mots de passe hashés via `node:crypto` (scrypt). Le voyage est stocké en document **JSONB**, donc requêtable depuis n'importe quel client SQL.
- **Déploiement** : Docker / docker-compose (pensé pour un homelab) — **deux services** : l'app et la base.

## Développement

```bash
cp .env.example .env         # puis renseignez POSTGRES_PASSWORD
docker compose up -d db      # la base seule suffit pour développer
npm install
npm run dev                  # front (5173) + back (42069) en parallèle
```

Le front proxifie `/api` vers `http://localhost:42069`. Ouvre http://localhost:5173.
Le schéma est créé automatiquement au démarrage du serveur.
Le **premier compte créé** récupère les éventuels voyages existants sans propriétaire.

## Production

```bash
npm run build        # build le front dans dist/
npm start            # sert dist/ + l'API sur le PORT (défaut 42069)
```

> En production, le cookie de session est marqué `secure` : servez l'app derrière **HTTPS**.

## Docker (homelab)

```bash
cp .env.example .env         # POSTGRES_PASSWORD est obligatoire
docker compose up -d         # tire l'image ghcr.io/aymericlefeyer/bon-voyage:latest
```

Deux conteneurs : `trip-visualizer` (app, port `42069`) et `trip-visualizer-db`
(PostgreSQL 16). Les données vivent dans le volume Docker `pgdata`.

L'image de l'app est **publiée par la CI** (voir plus bas) ; le serveur ne
compile rien. Pour builder localement (fork, modif non poussée) :

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

## Déploiement continu (GitHub Actions → Portainer)

`.github/workflows/deploy.yml` s'exécute à chaque push sur `main` :

1. **Lint + types** (`eslint`, `tsc -b`) ;
2. **Build de l'image Docker** (le `npm run build` du Dockerfile valide le
   bundle Vite) puis **push sur GHCR** en `:latest` et `:sha-<commit>` ;
3. **Appel du webhook Portainer**, qui re-pull l'image et redéploie la stack.

Si une étape échoue, rien n'est publié ni déployé. Le workflow est aussi
déclenchable à la main (onglet *Actions* → *Déploiement* → *Run workflow*).

### Mise en place (une seule fois)

1. **Portainer** → la stack → *Webhooks* → activer **Enable webhook**, copier
   l'URL (`https://portainer.exemple.com/api/stacks/webhooks/<uuid>`).
2. **GitHub** → *Settings* → *Secrets and variables* → *Actions* → nouveau
   secret **`PORTAINER_WEBHOOK`** avec cette URL. Sans ce secret, la CI publie
   l'image mais saute le déploiement (avec un avertissement).
3. **Visibilité du package** : au premier push, le package GHCR est *privé*.
   Soit on le passe en **public** (page du package → *Package settings* →
   *Change visibility*), soit on garde le privé et on ajoute un
   `docker login ghcr.io` sur le serveur (*Registries* dans Portainer) avec un
   PAT `read:packages`.

> Le webhook Portainer doit être joignable depuis les runners GitHub (Internet).
> Si ton Portainer n'est pas exposé, garde le workflow jusqu'à l'étape 2 : la
> stack se met à jour avec un `docker compose pull && docker compose up -d`.

Variante utile : pointer `APP_IMAGE` (dans le `.env`) sur un tag figé, par
exemple `APP_IMAGE=ghcr.io/aymericlefeyer/bon-voyage:sha-abc1234`, pour
épingler ou revenir à une version précédente.

### Se connecter à la base depuis l'extérieur

Le port de la base est publié sur l'hôte, réglable via `.env` :

```bash
psql "postgres://bonvoyage:<mot-de-passe>@localhost:5432/bonvoyage"
# le document du voyage est du JSONB, donc directement requêtable :
#   SELECT id, data->>'title', jsonb_array_length(data->'stages') FROM trips;
```

> ⚠️ Par défaut `DB_BIND_HOST=127.0.0.1` : la base n'écoute que sur l'hôte
> (utilisez un tunnel SSH ou Tailscale depuis un autre poste). Passer à
> `0.0.0.0` l'ouvre au réseau — **Docker publie ses ports en écrivant
> directement dans iptables et court-circuite `ufw`/`firewalld`**, donc un mot
> de passe fort est indispensable.

### Sauvegarde

La base n'est plus un fichier : on ne copie plus `./data`.

```bash
docker compose exec db pg_dump -U bonvoyage bonvoyage > sauvegarde.sql
```

### Migration depuis une ancienne installation SQLite

Les versions précédentes stockaient tout dans `./data/trips.db`. Script one-shot,
rejouable :

```bash
docker compose up -d db
npm run migrate:sqlite -- ./data/trips.db
```

Il affiche un récapitulatif des comptages source → cible en fin d'exécution.

## Variables d'environnement

Voir `.env.example` : `PORT`, `DATABASE_URL`, `POSTGRES_USER` / `POSTGRES_PASSWORD` /
`POSTGRES_DB`, `DB_BIND_HOST` / `DB_PORT`, et les variables email optionnelles.
