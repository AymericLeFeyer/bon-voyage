import type { PlaceCategory, TransportMode } from '@shared/types/trip';

export const PLACE_CATEGORIES: Record<PlaceCategory, { label: string; emoji: string }> = {
  sight: { label: 'Incontournable', emoji: '📍' },
  food: { label: 'Restaurant / Food', emoji: '🍽️' },
  shopping: { label: 'Shopping', emoji: '🛍️' },
  nature: { label: 'Nature', emoji: '🌿' },
  culture: { label: 'Culture / Patrimoine', emoji: '🏛️' },
  nightlife: { label: 'Vie nocturne', emoji: '🍸' },
  other: { label: 'Autre', emoji: '✨' },
};

export const TRANSPORT_MODES: Record<TransportMode, { label: string; emoji: string }> = {
  train: { label: 'Train', emoji: '🚆' },
  highspeed: { label: 'Train à grande vitesse', emoji: '🚄' },
  // Alias historique de `highspeed` : affichable, plus proposé à la saisie.
  shinkansen: { label: 'Train à grande vitesse', emoji: '🚄' },
  bus: { label: 'Bus', emoji: '🚌' },
  plane: { label: 'Avion', emoji: '✈️' },
  ferry: { label: 'Ferry', emoji: '⛴️' },
  car: { label: 'Voiture', emoji: '🚗' },
  walk: { label: 'À pied', emoji: '🚶' },
  other: { label: 'Autre', emoji: '➡️' },
};

/** Modes proposés dans le sélecteur (sans les alias dépréciés). */
export const TRANSPORT_MODE_OPTIONS = (
  Object.keys(TRANSPORT_MODES) as TransportMode[]
).filter((mode) => mode !== 'shinkansen');

/** Emojis suggérés pour illustrer une étape (cliquables dans l'éditeur). */
export const STAGE_EMOJIS = [
  '🏙️',
  '🏛️',
  '🏰',
  '🏔️',
  '🏖️',
  '🗼',
  '🏝️',
  '♨️',
  '🌋',
  '🍽️',
  '🍷',
  '🌊',
];

/** Devises proposées (l'euro sert de devise de référence pour le budget). */
export const CURRENCIES = ['€', '$', '£', '¥'];

/** Palette d'accents proposée pour les étapes. */
export const STAGE_COLORS = [
  '#e11d48',
  '#2563eb',
  '#16a34a',
  '#d97706',
  '#7c3aed',
  '#0891b2',
  '#db2777',
  '#4d7c0f',
];
