import type { Flight, Place, Stage, Transport, Trip } from '@shared/types/trip';
import { resolveTravelMode } from '@/shared/constants/travel';

export type FlightSide = 'outbound' | 'return';

export interface DayPlaceRef {
  stage: Stage;
  place: Place;
}
export interface DayLegRef {
  stage: Stage;
  leg: Transport;
  nextStage?: Stage;
}
export interface DayFlightRef {
  side: FlightSide;
  flight: Flight;
}

/** Résumé d'une journée du voyage. */
export interface DaySummary {
  /** Jour (YYYY-MM-DD). */
  date: string;
  /** Étape où l'on dort cette nuit-là (base). */
  stage?: Stage;
  /** Étape dont c'est le jour d'arrivée (check-in). */
  arrivalStage?: Stage;
  /** Étape dont c'est le jour de départ (check-out). */
  departureStage?: Stage;
  flights: DayFlightRef[];
  legs: DayLegRef[];
  /** Lieux planifiés ce jour, triés par heure. */
  places: DayPlaceRef[];
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Collecte toutes les dates ISO renseignées dans le voyage. */
function collectDates(trip: Trip, withTravel: boolean): string[] {
  const dates: (string | undefined)[] = withTravel
    ? [trip.outboundFlight?.date, trip.returnFlight?.date]
    : [];
  for (const stage of trip.stages) {
    dates.push(stage.accommodation?.checkInDate, stage.accommodation?.checkOutDate);
    dates.push(stage.transportToNext?.date);
    for (const place of stage.places) dates.push(place.plannedDate);
  }
  return dates.filter((d): d is string => Boolean(d));
}

/**
 * Construit l'itinéraire jour par jour à partir de toutes les dates saisies
 * (vols, séjours, transports, créneaux des lieux). Renvoie `[]` si aucune date.
 */
export function buildItinerary(trip: Trip): DaySummary[] {
  // Mode de trajet « non défini » : les vols/trains bout de voyage sont ignorés.
  const withTravel = resolveTravelMode(trip) !== 'none';
  const dates = collectDates(trip, withTravel);
  if (dates.length === 0) return [];

  const start = dates.reduce((min, d) => (d < min ? d : min));
  const end = dates.reduce((max, d) => (d > max ? d : max));

  const days: DaySummary[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) {
    const stage = trip.stages.find((s) => {
      const ci = s.accommodation?.checkInDate;
      const co = s.accommodation?.checkOutDate;
      return ci != null && co != null && ci <= day && day < co;
    });
    const arrivalStage = trip.stages.find((s) => s.accommodation?.checkInDate === day);
    const departureStage = trip.stages.find((s) => s.accommodation?.checkOutDate === day);

    const flights: DayFlightRef[] = [];
    if (withTravel) {
      if (trip.outboundFlight?.date === day) flights.push({ side: 'outbound', flight: trip.outboundFlight });
      if (trip.returnFlight?.date === day) flights.push({ side: 'return', flight: trip.returnFlight });
    }

    const legs: DayLegRef[] = [];
    trip.stages.forEach((s, i) => {
      if (s.transportToNext?.date === day) {
        legs.push({ stage: s, leg: s.transportToNext, nextStage: trip.stages[i + 1] });
      }
    });

    const places: DayPlaceRef[] = [];
    for (const s of trip.stages) {
      for (const p of s.places) {
        if (p.plannedDate === day) places.push({ stage: s, place: p });
      }
    }
    // Même jour pour tous → tri par heure (les sans-heure en fin).
    places.sort((a, b) => (a.place.plannedTime ?? '99:99').localeCompare(b.place.plannedTime ?? '99:99'));

    days.push({ date: day, stage, arrivalStage, departureStage, flights, legs, places });
  }

  return days;
}
