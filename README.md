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
- **Backend** : Express + `node:sqlite` (embarqué dans Node, aucun module natif). Auth par cookie de session, mots de passe hashés via `node:crypto` (scrypt). Le voyage est stocké en document JSON.
- **Déploiement** : Docker / docker-compose (pensé pour un homelab)

## Développement

```bash
npm install
npm run dev          # front (5173) + back (42069) en parallèle
```

Le front proxifie `/api` vers `http://localhost:42069`. Ouvre http://localhost:5173.
Le **premier compte créé** récupère les éventuels voyages existants sans propriétaire.

## Production

```bash
npm run build        # build le front dans dist/
npm start            # sert dist/ + l'API sur le PORT (défaut 42069)
```

> En production, le cookie de session est marqué `secure` : servez l'app derrière **HTTPS**.

## Docker (homelab)

```bash
docker compose up -d --build
```

La bdd SQLite est persistée dans `./data` (volume). Accessible sur le port `42069`.

## Variables d'environnement

Voir `.env.example` : `PORT`, `DATABASE_PATH`.
