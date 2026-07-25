/**
 * Types partagés entre le frontend et le backend.
 * Le voyage complet est stocké tel quel (document JSON) côté SQLite.
 */

import type { PublicUser } from './user.ts';

export interface LatLng {
  lat: number;
  lng: number;
}

/** Lieu où l'on dort / base d'une étape. */
export interface Accommodation {
  name: string;
  address?: string;
  location?: LatLng;
  googleMapsUrl?: string;
  /** Date d'arrivée (YYYY-MM-DD). */
  checkInDate?: string;
  /** Date de départ (YYYY-MM-DD). */
  checkOutDate?: string;
  /** Heure d'arrivée / check-in (HH:MM). */
  arrivalTime?: string;
  /** Heure de départ / check-out (HH:MM). */
  departureTime?: string;
  /** Modalités : code d'accès, dépôt de bagages, caution, etc. */
  modalities?: string;
  /** Prix du séjour. */
  price?: number;
  /** Devise (¥, €, $…). */
  currency?: string;
  /** Nombre de personnes couvertes par ce prix (défaut 1). */
  persons?: number;
  notes?: string;
}

/** Catégorie de lieu à visiter (sert au style du marqueur). */
export type PlaceCategory =
  | 'sight'
  | 'food'
  | 'shopping'
  | 'nature'
  | 'culture'
  | 'nightlife'
  | 'other';

/** Point d'intérêt satellite, sans ordre précis, rattaché à une étape. */
export interface Place {
  id: string;
  name: string;
  category: PlaceCategory;
  address?: string;
  location?: LatLng;
  googleMapsUrl?: string;
  notes?: string;
  visited: boolean;
  /** Réservé / billet pris (mis en avant dans la liste pour ne pas l'oublier). */
  reserved?: boolean;
  /** Prix (billet, activité…). */
  price?: number;
  /** Devise (¥, €, $…). */
  currency?: string;
  /** Nombre de personnes couvertes par ce prix (défaut 1). */
  persons?: number;
  /** Jour prévu de la visite (YYYY-MM-DD). Sert au tri chronologique. */
  plannedDate?: string;
  /** Heure prévue de la visite (HH:MM). Sert au tri chronologique. */
  plannedTime?: string;
  /** Image d'illustration (URL). */
  imageUrl?: string;
  /** Informations confidentielles (codes, n° de résa…), visibles en mode admin uniquement. */
  confidential?: string;
}

/** Étape = une base (là où l'on dort), les étapes sont ordonnées. */
export interface Stage {
  id: string;
  name: string;
  /** Couleur d'accent de l'étape (hex). */
  color: string;
  /** Emoji illustrant l'étape (affiché dans le marqueur, sinon le numéro). */
  emoji?: string;
  accommodation?: Accommodation;
  places: Place[];
  /** Transport vers l'étape suivante (jambe de trajet). */
  transportToNext?: Transport;
  notes?: string;
  /** Image d'illustration (URL). */
  imageUrl?: string;
  /** Informations confidentielles (codes, n° de résa…), visibles en mode admin uniquement. */
  confidential?: string;
}

/**
 * Moyen de transport d'une jambe de trajet.
 * `shinkansen` est un **alias historique** de `highspeed` (données existantes) :
 * il n'est plus proposé à la saisie mais reste affichable.
 */
export type TransportMode =
  | 'train'
  | 'highspeed'
  | 'shinkansen'
  | 'bus'
  | 'plane'
  | 'ferry'
  | 'car'
  | 'walk'
  | 'other';

/** Segment de transport (jambe entre deux étapes ou trajet libre). */
export interface Transport {
  id: string;
  mode: TransportMode;
  label: string;
  from?: string;
  to?: string;
  /** Date (YYYY-MM-DD). */
  date?: string;
  departureTime?: string;
  arrivalTime?: string;
  /** Distance du trajet en kilomètres. */
  distanceKm?: number;
  /** N° de train / de réservation / voie. */
  reference?: string;
  /** Prix à prévoir. */
  price?: number;
  /** Devise (¥, €, $…). */
  currency?: string;
  /** Nombre de personnes couvertes par ce prix (défaut 1). */
  persons?: number;
  notes?: string;
}

/**
 * Mode de trajet « bout de voyage » (aller/retour), choisi à la création.
 * `none` = aucun trajet d'arrivée/départ n'est suivi dans l'app.
 */
export type TravelMode = 'plane' | 'train' | 'none';

/** Segment d'un trajet aller/retour (une correspondance = un segment supplémentaire). */
export interface FlightLeg {
  id: string;
  /** Numéro de vol / de train (ex. AF276, TGV 6201). */
  flightNumber?: string;
  from?: string;
  to?: string;
  departureTime?: string;
  arrivalTime?: string;
}

/**
 * Trajet d'aller ou de retour (avion ou train selon `Trip.travelMode`), traité
 * comme une étape « bout de voyage ». `airport`/`airportLocation` = le point
 * d'entrée/sortie du pays visité affiché sur la carte (aéroport ou gare :
 * arrivée pour l'aller, départ pour le retour).
 */
export interface Flight {
  airport?: string;
  airportLocation?: LatLng;
  /** Date (YYYY-MM-DD). */
  date?: string;
  /** Segments dans l'ordre (≥ 2 = avec correspondance(s)). */
  legs: FlightLeg[];
  price?: number;
  currency?: string;
  /** Nombre de personnes couvertes par ce prix (défaut 1). */
  persons?: number;
  notes?: string;
}

export interface Trip {
  id: string;
  title: string;
  description?: string;
  /** Emoji illustrant le voyage (par défaut le drapeau du pays de destination). */
  emoji?: string;
  /** Destination principale (libellé lisible, ex. « Sicile, Italie »). Saisie à la création. */
  destination?: string;
  /** Coordonnées de la destination : centre la carte tant qu'aucune étape n'est placée. */
  destinationLocation?: LatLng;
  /**
   * Mode de trajet aller/retour. Absent = voyage créé avant ce réglage,
   * traité comme `plane` (cf. `resolveTravelMode`).
   */
  travelMode?: TravelMode;
  /** Trajet d'aller (avant la première étape). */
  outboundFlight?: Flight;
  stages: Stage[];
  /** Trajet de retour (après la dernière étape). */
  returnFlight?: Flight;
  /** Propriétaire du voyage (créateur). Géré côté serveur, non éditable via autosave. */
  ownerId: string;
  /** Voyage rendu public (vue affichage sans infos confidentielles). Réglage propriétaire. */
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Niveau d'accès du visiteur courant à un voyage.
 * - `owner`  : propriétaire (édition + réglages + suppression)
 * - `editor` : membre accepté (édition)
 * - `public` : non-membre consultant un voyage public (vue affichage, lecture seule, sans confidentiel)
 */
export type TripAccess = 'owner' | 'editor' | 'public';

/** Réponse de récupération d'un voyage : le voyage + l'accès du visiteur. */
export interface TripEnvelope {
  trip: Trip;
  access: TripAccess;
}

/** Vue résumée d'un voyage (liste sur la page d'accueil). */
export interface TripSummary {
  id: string;
  title: string;
  emoji?: string;
  destination?: string;
  updatedAt: string;
  stageCount: number;
  /** true si l'utilisateur courant est le propriétaire de ce voyage. */
  owned: boolean;
  isPublic: boolean;
  /** Participants (propriétaire en tête, puis les membres acceptés). */
  members: PublicUser[];
}

/**
 * Payload accepté pour créer/mettre à jour le *contenu* d'un voyage.
 * `ownerId`/`isPublic` sont gérés par le serveur (colonnes dédiées), jamais via l'autosave.
 */
export type TripInput = Omit<Trip, 'id' | 'createdAt' | 'updatedAt' | 'ownerId' | 'isPublic'>;
