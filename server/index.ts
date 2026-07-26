import express from 'express';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { initSchema, waitForDb } from './db.ts';
import {
  createTrip,
  deleteTrip,
  getTrip,
  listTripsForUser,
  setTripPublic,
  stripConfidential,
  updateTrip,
} from './repository.ts';
import {
  authenticate,
  clearSession,
  createUser,
  findUserByEmail,
  isFirstUser,
  issueSession,
  requireAuth,
  updateUserProfile,
  withUser,
} from './auth.ts';
import {
  acceptInvitation,
  acceptInviteByToken,
  canEdit,
  cancelInvite,
  createInvite,
  declineInvitation,
  declineInviteByToken,
  getInviteByToken,
  getMembers,
  getParticipantsOfTrips,
  listInvitationsForEmail,
  removeMember,
  resolveAccess,
} from './membership.ts';
import { appUrl, emailEnabled, logEmailConfig, sendInvitationEmail } from './email.ts';
import { claimOrphanTrips } from './repository.ts';
import { buildDefaultTrip } from './defaultTrip.ts';
import type { TripInput, TripSummary } from '../shared/types/trip.ts';
import type { LoginInput, ProfileUpdate, RegisterInput } from '../shared/types/user.ts';

const app = express();
const PORT = Number(process.env.PORT ?? 42069);

/**
 * ⚠️ Express 4 ne rattrape **pas** les rejets de promesse : un throw dans un
 * handler `async` produit un unhandled rejection qui tue le process au lieu de
 * renvoyer un 500. Tous les handlers asynchrones passent donc par ce wrapper.
 */
const ah =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '6mb' })); // 6mb : marge pour les avatars base64
app.use(withUser);

const api = express.Router();

// ─────────────────────────────  Auth  ─────────────────────────────
api.post(
  '/auth/register',
  ah(async (req, res) => {
    const { email, password, name, country, avatar } = (req.body ?? {}) as RegisterInput;
    if (!email?.trim() || !password || !name?.trim()) {
      res.status(400).json({ error: 'Email, mot de passe et nom sont requis' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères' });
      return;
    }
    if (await findUserByEmail(email)) {
      res.status(409).json({ error: 'Un compte existe déjà avec cet email' });
      return;
    }
    const first = await isFirstUser();
    const user = await createUser({ email, password, name, country, avatar });
    if (first) await claimOrphanTrips(user.id); // rattache les voyages orphelins au 1er compte
    await issueSession(res, user.id);
    res.status(201).json(user);
  }),
);

api.post(
  '/auth/login',
  ah(async (req, res) => {
    const { email, password } = (req.body ?? {}) as LoginInput;
    const user = email && password ? await authenticate(email, password) : null;
    if (!user) {
      res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      return;
    }
    await issueSession(res, user.id);
    res.json(user);
  }),
);

api.post(
  '/auth/logout',
  ah(async (req, res) => {
    await clearSession(req, res);
    res.status(204).end();
  }),
);

api.get('/auth/me', (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Non connecté' });
    return;
  }
  res.json(req.user);
});

api.patch(
  '/auth/me',
  requireAuth,
  ah(async (req, res) => {
    const patch = (req.body ?? {}) as ProfileUpdate;
    if (patch.password !== undefined && patch.password.length < 6) {
      res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères' });
      return;
    }
    const updated = await updateUserProfile(req.user!.id, patch);
    if (!updated) {
      res.status(404).json({ error: 'Utilisateur introuvable' });
      return;
    }
    res.json(updated);
  }),
);

// ─────────────────────────────  Voyages  ─────────────────────────────
api.get(
  '/trips',
  requireAuth,
  ah(async (req, res) => {
    // On joint les participants (propriétaire + membres acceptés) pour afficher
    // leurs avatars dans la liste. Une seule requête pour tous les voyages :
    // en base distante, un getMembers() par voyage était un N+1 coûteux.
    const rows = await listTripsForUser(req.user!.id);
    const participants = await getParticipantsOfTrips(rows.map((r) => r.id));
    const summaries: TripSummary[] = rows.map((row) => ({
      ...row,
      members: participants.get(row.id) ?? [],
    }));
    res.json(summaries);
  }),
);

api.post(
  '/trips',
  requireAuth,
  ah(async (req, res) => {
    const input = (req.body && Object.keys(req.body).length > 0
      ? req.body
      : buildDefaultTrip()) as TripInput;
    const trip = await createTrip(input, req.user!.id);
    res.status(201).json(trip);
  }),
);

api.get(
  '/trips/:id',
  ah(async (req, res) => {
    const access = await resolveAccess(req.params.id, req.user?.id ?? null);
    if (!access) {
      res.status(req.user ? 404 : 401).json({ error: 'Voyage introuvable ou accès refusé' });
      return;
    }
    const trip = await getTrip(req.params.id);
    if (!trip) {
      res.status(404).json({ error: 'Voyage introuvable' });
      return;
    }
    // Vue affichage (public) : on retire les infos confidentielles côté serveur.
    const payload = access === 'public' ? stripConfidential(trip) : trip;
    res.json({ trip: payload, access });
  }),
);

api.put(
  '/trips/:id',
  requireAuth,
  ah(async (req, res) => {
    if (!(await canEdit(req.params.id, req.user!.id))) {
      res.status(403).json({ error: 'Édition non autorisée' });
      return;
    }
    const trip = await updateTrip(req.params.id, req.body as TripInput);
    if (!trip) {
      res.status(404).json({ error: 'Voyage introuvable' });
      return;
    }
    res.json(trip);
  }),
);

api.patch(
  '/trips/:id/settings',
  requireAuth,
  ah(async (req, res) => {
    if ((await resolveAccess(req.params.id, req.user!.id)) !== 'owner') {
      res.status(403).json({ error: 'Réservé au propriétaire' });
      return;
    }
    const { isPublic } = (req.body ?? {}) as { isPublic?: boolean };
    const trip = await setTripPublic(req.params.id, Boolean(isPublic));
    if (!trip) {
      res.status(404).json({ error: 'Voyage introuvable' });
      return;
    }
    res.json(trip);
  }),
);

api.delete(
  '/trips/:id',
  requireAuth,
  ah(async (req, res) => {
    if ((await resolveAccess(req.params.id, req.user!.id)) !== 'owner') {
      res.status(403).json({ error: 'Réservé au propriétaire' });
      return;
    }
    const ok = await deleteTrip(req.params.id);
    res.status(ok ? 204 : 404).end();
  }),
);

// ─────────────────────────────  Membres & invitations  ─────────────────────────────
api.get(
  '/trips/:id/members',
  requireAuth,
  ah(async (req, res) => {
    if (!(await canEdit(req.params.id, req.user!.id))) {
      res.status(403).json({ error: 'Accès refusé' });
      return;
    }
    const members = await getMembers(req.params.id);
    if (!members) {
      res.status(404).json({ error: 'Voyage introuvable' });
      return;
    }
    res.json(members);
  }),
);

api.post(
  '/trips/:id/invite',
  requireAuth,
  ah(async (req, res) => {
    if (!(await canEdit(req.params.id, req.user!.id))) {
      res.status(403).json({ error: 'Accès refusé' });
      return;
    }
    const { email } = (req.body ?? {}) as { email?: string };
    if (!email?.trim() || !email.includes('@')) {
      res.status(400).json({ error: 'Email invalide' });
      return;
    }
    const result = await createInvite(req.params.id, email.trim());
    if (!result.ok) {
      const message =
        result.reason === 'owner'
          ? 'Vous êtes déjà propriétaire de ce voyage'
          : result.reason === 'already-member'
            ? 'Cette personne est déjà membre'
            : 'Cette personne est déjà invitée';
      res.status(409).json({ error: message });
      return;
    }

    const origin = req.headers.origin ?? undefined;
    const inviteUrl = `${appUrl(origin)}/invite/${result.token}`;
    const trip = await getTrip(req.params.id);
    await sendInvitationEmail({
      to: result.email,
      tripTitle: trip?.title ?? 'un voyage',
      inviterName: req.user!.name,
      acceptUrl: inviteUrl,
    });

    res.status(201).json({
      members: await getMembers(req.params.id),
      inviteUrl,
      emailSent: emailEnabled,
    });
  }),
);

// Annulation d'une invitation en attente (propriétaire).
api.delete(
  '/trips/:id/invites',
  requireAuth,
  ah(async (req, res) => {
    if ((await resolveAccess(req.params.id, req.user!.id)) !== 'owner') {
      res.status(403).json({ error: 'Réservé au propriétaire' });
      return;
    }
    const { email } = (req.body ?? {}) as { email?: string };
    if (email) await cancelInvite(req.params.id, email);
    res.status(204).end();
  }),
);

// ─────────────────────────────  Invitation par lien (token)  ─────────────────────────────
api.get(
  '/invites/:token',
  ah(async (req, res) => {
    const info = await getInviteByToken(req.params.token);
    if (!info) {
      res.status(404).json({ error: 'Invitation introuvable ou déjà utilisée' });
      return;
    }
    res.json(info);
  }),
);

api.post(
  '/invites/:token/accept',
  requireAuth,
  ah(async (req, res) => {
    const tripId = await acceptInviteByToken(req.params.token, req.user!.id);
    if (!tripId) {
      res.status(404).json({ error: 'Invitation introuvable ou déjà utilisée' });
      return;
    }
    res.json({ tripId });
  }),
);

api.post(
  '/invites/:token/decline',
  requireAuth,
  ah(async (req, res) => {
    await declineInviteByToken(req.params.token);
    res.status(204).end();
  }),
);

api.delete(
  '/trips/:id/members/:userId',
  requireAuth,
  ah(async (req, res) => {
    const isOwner = (await resolveAccess(req.params.id, req.user!.id)) === 'owner';
    const isSelf = req.params.userId === req.user!.id;
    if (!isOwner && !isSelf) {
      res.status(403).json({ error: 'Action non autorisée' });
      return;
    }
    await removeMember(req.params.id, req.params.userId);
    res.status(204).end();
  }),
);

api.get(
  '/me/invitations',
  requireAuth,
  ah(async (req, res) => {
    res.json(await listInvitationsForEmail(req.user!.email));
  }),
);

api.post(
  '/me/invitations/:tripId/accept',
  requireAuth,
  ah(async (req, res) => {
    const ok = await acceptInvitation(req.params.tripId, {
      id: req.user!.id,
      email: req.user!.email,
    });
    res.status(ok ? 204 : 404).end();
  }),
);

api.post(
  '/me/invitations/:tripId/decline',
  requireAuth,
  ah(async (req, res) => {
    const ok = await declineInvitation(req.params.tripId, req.user!.email);
    res.status(ok ? 204 : 404).end();
  }),
);

app.use('/api', api);

// En production, on sert le frontend buildé et on laisse le routeur SPA gérer les routes.
if (process.env.NODE_ENV === 'production') {
  const distDir = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
  if (existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(resolve(distDir, 'index.html'));
    });
  }
}

// Filet final : toute erreur passée à next() (dont les rejets capturés par `ah`)
// atterrit ici au lieu de faire tomber le process.
const onError: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error('💥  Erreur non gérée :', err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Erreur serveur' });
};
app.use(onError);

// ─────────────────────────────  Démarrage  ─────────────────────────────
// La base est désormais un service distinct : on attend qu'elle réponde et on
// crée le schéma **avant** d'accepter des requêtes.
await waitForDb();
await initSchema();

app.listen(PORT, () => {
  console.log(`🧭  Bon Voyage API sur http://localhost:${PORT}`);
  logEmailConfig();
});
