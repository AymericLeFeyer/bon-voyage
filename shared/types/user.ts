/**
 * Types partagés (front/back) pour les comptes utilisateurs et l'appartenance
 * à un voyage. Voir shared/types/trip.ts pour le voyage lui-même.
 */

/** Utilisateur tel qu'exposé au client (jamais le hash de mot de passe). */
export interface User {
  id: string;
  email: string;
  /** Nom affiché. */
  name: string;
  /** Pays préféré (code ou libellé libre). Optionnel. */
  country?: string;
  /** Photo de profil en data URL (base64), stockée en base. Optionnel. */
  avatar?: string;
  createdAt: string;
}

/** Vue publique restreinte d'un utilisateur (listes de membres, invitant…). */
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  country?: string;
  avatar?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

/** Mise à jour du profil (tous champs optionnels ; password change le mot de passe). */
export interface ProfileUpdate {
  name?: string;
  country?: string;
  avatar?: string;
  password?: string;
}

/**
 * Participants d'un voyage : le propriétaire, les membres acceptés (qui ont un
 * compte) et les invitations par email encore en attente (compte ou non).
 */
export interface TripMembers {
  owner: PublicUser;
  members: PublicUser[];
  /** Emails invités qui n'ont pas encore accepté. */
  pendingInvites: string[];
}

/** Invitation en attente reçue par l'utilisateur courant (bannière accueil). */
export interface Invitation {
  tripId: string;
  tripTitle: string;
  owner: PublicUser;
}

/** Détail d'une invitation résolue depuis son token (page /invite/:token). */
export interface InviteInfo {
  tripId: string;
  tripTitle: string;
  owner: PublicUser;
  /** Email destinataire de l'invitation (sert à pré-remplir l'inscription). */
  email: string;
}

/** Réponse à une invitation : membres à jour + lien à partager + statut d'envoi. */
export interface InviteResponse {
  members: TripMembers;
  /** Lien /invite/:token à partager (toujours fourni, utile en mode console). */
  inviteUrl: string;
  /** true si un email a réellement été envoyé (provider configuré). */
  emailSent: boolean;
}
