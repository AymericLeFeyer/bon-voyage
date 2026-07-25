import type { TravelMode, Trip } from '@shared/types/trip';

/** Côté du trajet « bout de voyage ». */
export type JourneySide = 'outbound' | 'return';

/** Mode de trajet réellement suivi dans l'app (`none` exclu). */
export type TrackedTravelMode = Exclude<TravelMode, 'none'>;

/** Libellés de l'UI pour un mode de trajet donné (avion ou train). */
export interface TravelCopy {
  emoji: string;
  /** Libellé nu : « Vol aller » / « Train retour ». */
  label: Record<JourneySide, string>;
  /** Titre avec emoji, pour les en-têtes de tiroir/modale. */
  title: Record<JourneySide, string>;
  /** Libellé du point d'entrée/sortie dans le pays visité. */
  hubLabel: Record<JourneySide, string>;
  /** Nom court de ce point (vue lecture seule) : « Aéroport » / « Gare ». */
  hubShort: string;
  hubPlaceholder: string;
  /** Titre de la liste des segments. */
  segmentsTitle: string;
  numberLabel: string;
  numberPlaceholder: string;
  /** Placeholder des champs départ/arrivée d'un segment. */
  endpointPlaceholder: string;
  notesPlaceholder: string;
  /** Catégorie du budget. */
  budgetCategory: string;
  /** Bouton de suppression dans l'éditeur. */
  removeLabel: string;
  /** Info-bulle du crayon d'édition (mobile). */
  editLabel: string;
  /** Note en tête de l'éditeur. */
  mapHint: string;
}

export const TRAVEL_COPY: Record<TrackedTravelMode, TravelCopy> = {
  plane: {
    emoji: '✈️',
    label: { outbound: 'Vol aller', return: 'Vol retour' },
    title: { outbound: '✈️ Vol aller', return: '✈️ Vol retour' },
    hubLabel: {
      outbound: "Aéroport d'arrivée (pays visité)",
      return: 'Aéroport de départ (pays visité)',
    },
    hubShort: 'Aéroport',
    hubPlaceholder: 'Ex : Aéroport de Tokyo Narita',
    segmentsTitle: 'Vols & correspondances',
    numberLabel: 'N° de vol',
    numberPlaceholder: 'Ex : AF276',
    endpointPlaceholder: 'Aéroport / ville',
    notesPlaceholder: 'Bagages, terminal, enregistrement…',
    budgetCategory: 'Vols',
    removeLabel: 'Supprimer ce vol',
    editLabel: 'Éditer le vol',
    mapHint: "Seul l'aéroport du pays visité est affiché sur la carte.",
  },
  train: {
    emoji: '🚆',
    label: { outbound: 'Train aller', return: 'Train retour' },
    title: { outbound: '🚆 Train aller', return: '🚆 Train retour' },
    hubLabel: {
      outbound: "Gare d'arrivée (pays visité)",
      return: 'Gare de départ (pays visité)',
    },
    hubShort: 'Gare',
    hubPlaceholder: 'Ex : Gare de Lisboa Oriente',
    segmentsTitle: 'Trains & correspondances',
    numberLabel: 'N° de train',
    numberPlaceholder: 'Ex : TGV 6201',
    endpointPlaceholder: 'Gare / ville',
    notesPlaceholder: 'Voiture, place, bagages…',
    budgetCategory: 'Trains',
    removeLabel: 'Supprimer ce trajet',
    editLabel: 'Éditer le trajet',
    mapHint: 'Seule la gare du pays visité est affichée sur la carte.',
  },
};

/** Choix proposés à la création du voyage et dans les réglages. */
export const TRAVEL_MODE_OPTIONS: {
  value: TravelMode;
  label: string;
  emoji: string;
  hint: string;
}[] = [
  { value: 'plane', label: 'Avion', emoji: '✈️', hint: 'Vol aller / retour' },
  { value: 'train', label: 'Train', emoji: '🚆', hint: 'Train aller / retour' },
  { value: 'none', label: 'Non défini', emoji: '—', hint: 'Aucun trajet suivi' },
];

/**
 * Mode de trajet effectif d'un voyage. Les voyages créés avant ce réglage n'ont
 * pas de `travelMode` : ils étaient tous en mode avion, on le conserve.
 */
export function resolveTravelMode(trip: Pick<Trip, 'travelMode'>): TravelMode {
  return trip.travelMode ?? 'plane';
}

/**
 * Libellés du trajet aller/retour d'un voyage, ou `null` si le mode est « non
 * défini » — dans ce cas l'app n'affiche aucune entrée aller/retour.
 */
export function travelCopy(trip: Pick<Trip, 'travelMode'>): TravelCopy | null {
  const mode = resolveTravelMode(trip);
  return mode === 'none' ? null : TRAVEL_COPY[mode];
}
