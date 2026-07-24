import type { Invitation, InviteInfo, InviteResponse, TripMembers } from '@shared/types/user';

/** Contrat de gestion des membres & invitations d'un voyage. */
export interface MembershipRepository {
  getMembers(tripId: string): Promise<TripMembers>;
  /** Invite un email (compte ou non). Renvoie les membres à jour + le lien à partager. */
  invite(tripId: string, email: string): Promise<InviteResponse>;
  /** Annule une invitation en attente (propriétaire). */
  cancelInvite(tripId: string, email: string): Promise<void>;
  /** Retire un membre accepté (propriétaire) ou se retire soi-même (userId = soi). */
  removeMember(tripId: string, userId: string): Promise<void>;

  /** Invitations en attente reçues par l'utilisateur courant (bannière accueil). */
  listInvitations(): Promise<Invitation[]>;
  acceptInvitation(tripId: string): Promise<void>;
  declineInvitation(tripId: string): Promise<void>;

  /** Résout une invitation depuis son token (page /invite/:token). */
  getInvite(token: string): Promise<InviteInfo>;
  /** Accepte via le lien email → renvoie le tripId rejoint. */
  acceptInvite(token: string): Promise<{ tripId: string }>;
  declineInvite(token: string): Promise<void>;
}
