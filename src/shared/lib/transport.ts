import type { Transport } from '@shared/types/trip';

/**
 * Résumé compact d'un transport : « 320 km · 09:12–11:30 · 89€ ».
 * Utilisé par la sidebar, la vue mobile et les vues détail.
 */
export function formatTransportSummary(t: Transport): string {
  const parts: string[] = [];
  if (t.distanceKm != null) parts.push(`${t.distanceKm} km`);
  if (t.departureTime || t.arrivalTime) {
    parts.push([t.departureTime, t.arrivalTime].filter(Boolean).join('–'));
  }
  if (t.price != null) parts.push(`${t.price}${t.currency ?? '€'}`);
  return parts.join(' · ');
}
