import type {
  Accommodation,
  Flight,
  FlightLeg,
  Place,
  Stage,
  Transport,
  Trip,
} from '@shared/types/trip';

/** Vol d'aller ou de retour. */
export type FlightSide = 'outbound' | 'return';
const FLIGHT_KEY: Record<FlightSide, 'outboundFlight' | 'returnFlight'> = {
  outbound: 'outboundFlight',
  return: 'returnFlight',
};

/**
 * Fonctions de mutation pures : elles renvoient toujours un nouveau Trip
 * sans muter l'original (facilite l'autosave et l'undo éventuel).
 */

export function patchTrip(
  trip: Trip,
  patch: Partial<Pick<Trip, 'title' | 'description' | 'emoji' | 'destination' | 'destinationLocation'>>,
): Trip {
  return { ...trip, ...patch };
}

// --- Étapes ---

export function addStage(trip: Trip, stage: Stage): Trip {
  return { ...trip, stages: [...trip.stages, stage] };
}

export function updateStage(trip: Trip, stageId: string, patch: Partial<Stage>): Trip {
  return {
    ...trip,
    stages: trip.stages.map((s) => (s.id === stageId ? { ...s, ...patch } : s)),
  };
}

export function removeStage(trip: Trip, stageId: string): Trip {
  return { ...trip, stages: trip.stages.filter((s) => s.id !== stageId) };
}

export function moveStage(trip: Trip, stageId: string, direction: -1 | 1): Trip {
  const index = trip.stages.findIndex((s) => s.id === stageId);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= trip.stages.length) return trip;
  const stages = [...trip.stages];
  const [moved] = stages.splice(index, 1);
  stages.splice(target, 0, moved);
  return { ...trip, stages };
}

export function setAccommodation(
  trip: Trip,
  stageId: string,
  patch: Partial<Accommodation>,
): Trip {
  return {
    ...trip,
    stages: trip.stages.map((s) => {
      if (s.id !== stageId) return s;
      const base: Accommodation = s.accommodation ?? { name: 'Hébergement' };
      return { ...s, accommodation: { ...base, ...patch } };
    }),
  };
}

// --- Transport entre deux étapes (jambe de trajet) ---

export function setTransportLeg(trip: Trip, stageId: string, transport: Transport): Trip {
  return {
    ...trip,
    stages: trip.stages.map((s) =>
      s.id === stageId ? { ...s, transportToNext: transport } : s,
    ),
  };
}

export function updateTransportLeg(
  trip: Trip,
  stageId: string,
  patch: Partial<Transport>,
): Trip {
  return {
    ...trip,
    stages: trip.stages.map((s) => {
      if (s.id !== stageId || !s.transportToNext) return s;
      return { ...s, transportToNext: { ...s.transportToNext, ...patch } };
    }),
  };
}

export function removeTransportLeg(trip: Trip, stageId: string): Trip {
  return {
    ...trip,
    stages: trip.stages.map((s) => {
      if (s.id !== stageId) return s;
      const { transportToNext: _drop, ...rest } = s;
      return rest;
    }),
  };
}

// --- Lieux ---

export function addPlace(trip: Trip, stageId: string, place: Place): Trip {
  return {
    ...trip,
    stages: trip.stages.map((s) =>
      s.id === stageId ? { ...s, places: [...s.places, place] } : s,
    ),
  };
}

export function updatePlace(
  trip: Trip,
  stageId: string,
  placeId: string,
  patch: Partial<Place>,
): Trip {
  return {
    ...trip,
    stages: trip.stages.map((s) =>
      s.id === stageId
        ? { ...s, places: s.places.map((p) => (p.id === placeId ? { ...p, ...patch } : p)) }
        : s,
    ),
  };
}

export function removePlace(trip: Trip, stageId: string, placeId: string): Trip {
  return {
    ...trip,
    stages: trip.stages.map((s) =>
      s.id === stageId ? { ...s, places: s.places.filter((p) => p.id !== placeId) } : s,
    ),
  };
}

// --- Vols aller / retour ---

export function setFlight(trip: Trip, side: FlightSide, patch: Partial<Flight>): Trip {
  const key = FLIGHT_KEY[side];
  const base: Flight = trip[key] ?? { legs: [] };
  return { ...trip, [key]: { ...base, ...patch } };
}

export function removeFlight(trip: Trip, side: FlightSide): Trip {
  return { ...trip, [FLIGHT_KEY[side]]: undefined };
}

export function addFlightLeg(trip: Trip, side: FlightSide, leg: FlightLeg): Trip {
  const key = FLIGHT_KEY[side];
  const base: Flight = trip[key] ?? { legs: [] };
  return { ...trip, [key]: { ...base, legs: [...base.legs, leg] } };
}

export function updateFlightLeg(
  trip: Trip,
  side: FlightSide,
  legId: string,
  patch: Partial<FlightLeg>,
): Trip {
  const key = FLIGHT_KEY[side];
  const flight = trip[key];
  if (!flight) return trip;
  return {
    ...trip,
    [key]: {
      ...flight,
      legs: flight.legs.map((l) => (l.id === legId ? { ...l, ...patch } : l)),
    },
  };
}

export function removeFlightLeg(trip: Trip, side: FlightSide, legId: string): Trip {
  const key = FLIGHT_KEY[side];
  const flight = trip[key];
  if (!flight) return trip;
  return { ...trip, [key]: { ...flight, legs: flight.legs.filter((l) => l.id !== legId) } };
}
