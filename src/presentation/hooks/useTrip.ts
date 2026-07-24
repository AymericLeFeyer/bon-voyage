import { useCallback, useEffect, useRef, useState } from 'react';
import type { Trip, TripAccess, TripInput } from '@shared/types/trip';
import { tripRepository } from '@/infrastructure/trip/HttpTripRepository';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseTripResult {
  trip: Trip | null;
  /** Accès du visiteur (owner/editor/public), null tant que non chargé. */
  access: TripAccess | null;
  loading: boolean;
  loadError: string | null;
  saveStatus: SaveStatus;
  /** Applique une mutation pure et déclenche l'autosave débouncé. */
  mutate: (updater: (trip: Trip) => Trip) => void;
  /** Remplace localement le voyage (ex. après un changement de réglage). */
  setTrip: (trip: Trip) => void;
}

const AUTOSAVE_DELAY_MS = 700;

function toInput(trip: Trip): TripInput {
  const { id: _id, createdAt: _c, updatedAt: _u, ownerId: _o, isPublic: _p, ...input } = trip;
  return input;
}

export function useTrip(tripId: string): UseTripResult {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [access, setAccess] = useState<TripAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Trip | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    tripRepository
      .getById(tripId)
      .then((envelope) => {
        if (active) {
          setTrip(envelope.trip);
          setAccess(envelope.access);
        }
      })
      .catch((err: unknown) => {
        if (active) setLoadError(err instanceof Error ? err.message : 'Erreur de chargement');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tripId]);

  const flush = useCallback(async () => {
    const toSave = pendingRef.current;
    if (!toSave) return;
    pendingRef.current = null;
    setSaveStatus('saving');
    try {
      await tripRepository.update(toSave.id, toInput(toSave));
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }, []);

  const mutate = useCallback(
    (updater: (trip: Trip) => Trip) => {
      setTrip((current) => {
        if (!current) return current;
        const next = updater(current);
        pendingRef.current = next;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => void flush(), AUTOSAVE_DELAY_MS);
        return next;
      });
    },
    [flush],
  );

  // Sauvegarde immédiate si l'onglet se ferme avec des changements en attente.
  useEffect(() => {
    const handler = () => {
      if (pendingRef.current) void flush();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [flush]);

  return { trip, access, loading, loadError, saveStatus, mutate, setTrip };
}
