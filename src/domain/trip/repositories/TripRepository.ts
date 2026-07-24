import type { Trip, TripEnvelope, TripInput, TripSummary } from '@shared/types/trip';

/** Contrat d'accès aux voyages (implémenté côté infrastructure). */
export interface TripRepository {
  list(): Promise<TripSummary[]>;
  /** Récupère le voyage + le niveau d'accès du visiteur courant. */
  getById(id: string): Promise<TripEnvelope>;
  create(input?: TripInput): Promise<Trip>;
  update(id: string, input: TripInput): Promise<Trip>;
  remove(id: string): Promise<void>;
  /** Réglage propriétaire : rend le voyage public (vue affichage) ou privé. */
  setPublic(id: string, isPublic: boolean): Promise<Trip>;
}
