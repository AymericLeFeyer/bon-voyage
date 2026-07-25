import type { Place } from '@shared/types/trip';

/**
 * Raccourcit un `display_name` Nominatim (« Kyoto, Préfecture de Kyoto, Japon »)
 * en « lieu, pays » — suffisant comme libellé de destination.
 */
export function shortPlaceLabel(displayName: string): string {
  const parts = displayName
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? displayName.trim();
  const first = parts[0];
  const country = parts[parts.length - 1];
  return first === country ? first : `${first}, ${country}`;
}

/**
 * Clé de tri chronologique d'un lieu (date puis heure prévues).
 * Les lieux sans créneau renvoient `null` → renvoyés en fin de liste.
 */
function planKey(place: Place): string | null {
  if (!place.plannedDate && !place.plannedTime) return null;
  // Valeurs hautes par défaut : un lieu avec seulement l'heure passe après ceux datés.
  const date = place.plannedDate ?? '9999-12-31';
  const time = place.plannedTime ?? '99:99';
  return `${date} ${time}`;
}

/**
 * Trie les lieux par créneau prévu (chronologique). Les lieux non planifiés
 * restent à la fin, dans leur ordre d'origine (tri stable).
 */
export function sortPlacesChronologically(places: Place[]): Place[] {
  return places
    .map((place, index) => ({ place, index, key: planKey(place) }))
    .sort((a, b) => {
      if (a.key && b.key) {
        if (a.key === b.key) return a.index - b.index;
        return a.key < b.key ? -1 : 1;
      }
      if (a.key) return -1;
      if (b.key) return 1;
      return a.index - b.index;
    })
    .map((entry) => entry.place);
}
