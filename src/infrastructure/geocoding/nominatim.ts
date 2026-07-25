import type { LatLng } from '@shared/types/trip';

/**
 * Autocomplétion d'adresses via Nominatim (OpenStreetMap), gratuit et sans clé.
 * Usage raisonnable requis (1 req/s) — l'appelant doit débouncer.
 */

export interface GeoSuggestion {
  label: string;
  location: LatLng;
  /** Code pays ISO 3166-1 alpha-2 (ex. « jp »), quand Nominatim le renvoie. */
  countryCode?: string;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  address?: { country_code?: string };
}

export async function searchAddress(
  query: string,
  signal?: AbortSignal,
): Promise<GeoSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', trimmed);
  url.searchParams.set('format', 'json');
  // addressdetails=1 : on récupère le code pays (→ emoji drapeau du voyage).
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '6');
  url.searchParams.set('accept-language', 'fr');

  const res = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return [];

  const results = (await res.json()) as NominatimResult[];
  return results.map((r) => ({
    label: r.display_name,
    location: { lat: Number(r.lat), lng: Number(r.lon) },
    countryCode: r.address?.country_code,
  }));
}
