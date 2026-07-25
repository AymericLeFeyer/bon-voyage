import type { TripInput } from '../shared/types/trip.ts';

/**
 * Voyage minimal créé quand le client n'envoie aucun contenu (appel direct de
 * l'API). L'UI, elle, demande toujours le nom + la destination avant de créer :
 * on ne pré-remplit donc plus d'exemple à effacer.
 */
export function buildDefaultTrip(): TripInput {
  return {
    title: 'Nouveau voyage',
    stages: [],
  };
}
