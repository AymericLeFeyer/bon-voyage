import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';
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

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '6mb' })); // 6mb : marge pour les avatars base64
app.use(withUser);

const api = express.Router();

// ─────────────────────────────  Auth  ─────────────────────────────
api.post('/auth/register', (req, res) => {
  const { email, password, name, country, avatar } = (req.body ?? {}) as RegisterInput;
  if (!email?.trim() || !password || !name?.trim()) {
    res.status(400).json({ error: 'Email, mot de passe et nom sont requis' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères' });
    return;
  }
  if (findUserByEmail(email)) {
    res.status(409).json({ error: 'Un compte existe déjà avec cet email' });
    return;
  }
  const first = isFirstUser();
  const user = createUser({ email, password, name, country, avatar });
  if (first) claimOrphanTrips(user.id); // rattache les voyages orphelins au 1er compte
  issueSession(res, user.id);
  res.status(201).json(user);
});

api.post('/auth/login', (req, res) => {
  const { email, password } = (req.body ?? {}) as LoginInput;
  const user = email && password ? authenticate(email, password) : null;
  if (!user) {
    res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    return;
  }
  issueSession(res, user.id);
  res.json(user);
});

api.post('/auth/logout', (req, res) => {
  clearSession(req, res);
  res.status(204).end();
});

api.get('/auth/me', (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Non connecté' });
    return;
  }
  res.json(req.user);
});

api.patch('/auth/me', requireAuth, (req, res) => {
  const patch = (req.body ?? {}) as ProfileUpdate;
  if (patch.password !== undefined && patch.password.length < 6) {
    res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères' });
    return;
  }
  const updated = updateUserProfile(req.user!.id, patch);
  if (!updated) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  res.json(updated);
});

// ─────────────────────────────  Voyages  ─────────────────────────────
api.get('/trips', requireAuth, (req, res) => {
  // On joint les participants (propriétaire + membres acceptés) pour afficher
  // leurs avatars dans la liste des voyages.
  const summaries: TripSummary[] = listTripsForUser(req.user!.id).map((row) => {
    const members = getMembers(row.id);
    return {
      ...row,
      members: members ? [members.owner, ...members.members] : [],
    };
  });
  res.json(summaries);
});

api.post('/trips', requireAuth, (req, res) => {
  const input = (req.body && Object.keys(req.body).length > 0
    ? req.body
    : buildDefaultTrip()) as TripInput;
  const trip = createTrip(input, req.user!.id);
  res.status(201).json(trip);
});

api.get('/trips/:id', (req, res) => {
  const access = resolveAccess(req.params.id, req.user?.id ?? null);
  if (!access) {
    res.status(req.user ? 404 : 401).json({ error: 'Voyage introuvable ou accès refusé' });
    return;
  }
  const trip = getTrip(req.params.id);
  if (!trip) {
    res.status(404).json({ error: 'Voyage introuvable' });
    return;
  }
  // Vue affichage (public) : on retire les infos confidentielles côté serveur.
  const payload = access === 'public' ? stripConfidential(trip) : trip;
  res.json({ trip: payload, access });
});

api.put('/trips/:id', requireAuth, (req, res) => {
  if (!canEdit(req.params.id, req.user!.id)) {
    res.status(403).json({ error: 'Édition non autorisée' });
    return;
  }
  const trip = updateTrip(req.params.id, req.body as TripInput);
  if (!trip) {
    res.status(404).json({ error: 'Voyage introuvable' });
    return;
  }
  res.json(trip);
});

api.patch('/trips/:id/settings', requireAuth, (req, res) => {
  if (resolveAccess(req.params.id, req.user!.id) !== 'owner') {
    res.status(403).json({ error: 'Réservé au propriétaire' });
    return;
  }
  const { isPublic } = (req.body ?? {}) as { isPublic?: boolean };
  const trip = setTripPublic(req.params.id, Boolean(isPublic));
  if (!trip) {
    res.status(404).json({ error: 'Voyage introuvable' });
    return;
  }
  res.json(trip);
});

api.delete('/trips/:id', requireAuth, (req, res) => {
  if (resolveAccess(req.params.id, req.user!.id) !== 'owner') {
    res.status(403).json({ error: 'Réservé au propriétaire' });
    return;
  }
  const ok = deleteTrip(req.params.id);
  res.status(ok ? 204 : 404).end();
});

// ─────────────────────────────  Membres & invitations  ─────────────────────────────
api.get('/trips/:id/members', requireAuth, (req, res) => {
  if (!canEdit(req.params.id, req.user!.id)) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  const members = getMembers(req.params.id);
  if (!members) {
    res.status(404).json({ error: 'Voyage introuvable' });
    return;
  }
  res.json(members);
});

api.post('/trips/:id/invite', requireAuth, async (req, res) => {
  if (!canEdit(req.params.id, req.user!.id)) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  const { email } = (req.body ?? {}) as { email?: string };
  if (!email?.trim() || !email.includes('@')) {
    res.status(400).json({ error: 'Email invalide' });
    return;
  }
  const result = createInvite(req.params.id, email.trim());
  if (!result.ok) {
    const message =
      result.reason === 'owner'
        ? "Vous êtes déjà propriétaire de ce voyage"
        : result.reason === 'already-member'
          ? 'Cette personne est déjà membre'
          : 'Cette personne est déjà invitée';
    res.status(409).json({ error: message });
    return;
  }

  const origin = req.headers.origin ?? undefined;
  const inviteUrl = `${appUrl(origin)}/invite/${result.token}`;
  await sendInvitationEmail({
    to: result.email,
    tripTitle: getTrip(req.params.id)?.title ?? 'un voyage',
    inviterName: req.user!.name,
    acceptUrl: inviteUrl,
  });

  res.status(201).json({ members: getMembers(req.params.id), inviteUrl, emailSent: emailEnabled });
});

// Annulation d'une invitation en attente (propriétaire).
api.delete('/trips/:id/invites', requireAuth, (req, res) => {
  if (resolveAccess(req.params.id, req.user!.id) !== 'owner') {
    res.status(403).json({ error: 'Réservé au propriétaire' });
    return;
  }
  const { email } = (req.body ?? {}) as { email?: string };
  if (email) cancelInvite(req.params.id, email);
  res.status(204).end();
});

// ─────────────────────────────  Invitation par lien (token)  ─────────────────────────────
api.get('/invites/:token', (req, res) => {
  const info = getInviteByToken(req.params.token);
  if (!info) {
    res.status(404).json({ error: 'Invitation introuvable ou déjà utilisée' });
    return;
  }
  res.json(info);
});

api.post('/invites/:token/accept', requireAuth, (req, res) => {
  const tripId = acceptInviteByToken(req.params.token, req.user!.id);
  if (!tripId) {
    res.status(404).json({ error: 'Invitation introuvable ou déjà utilisée' });
    return;
  }
  res.json({ tripId });
});

api.post('/invites/:token/decline', requireAuth, (req, res) => {
  declineInviteByToken(req.params.token);
  res.status(204).end();
});

api.delete('/trips/:id/members/:userId', requireAuth, (req, res) => {
  const isOwner = resolveAccess(req.params.id, req.user!.id) === 'owner';
  const isSelf = req.params.userId === req.user!.id;
  if (!isOwner && !isSelf) {
    res.status(403).json({ error: 'Action non autorisée' });
    return;
  }
  removeMember(req.params.id, req.params.userId);
  res.status(204).end();
});

api.get('/me/invitations', requireAuth, (req, res) => {
  res.json(listInvitationsForEmail(req.user!.email));
});

api.post('/me/invitations/:tripId/accept', requireAuth, (req, res) => {
  const ok = acceptInvitation(req.params.tripId, { id: req.user!.id, email: req.user!.email });
  res.status(ok ? 204 : 404).end();
});

api.post('/me/invitations/:tripId/decline', requireAuth, (req, res) => {
  const ok = declineInvitation(req.params.tripId, req.user!.email);
  res.status(ok ? 204 : 404).end();
});

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

app.listen(PORT, () => {
  console.log(`🧭  Bon Voyage API sur http://localhost:${PORT}`);
  logEmailConfig();
});
