import { createContext, useContext, type ReactNode } from 'react';
import type { TripAccess } from '@shared/types/trip';

interface TripAccessValue {
  /** Accès du visiteur au voyage courant. */
  access: TripAccess;
  /** true si édition autorisée (propriétaire ou membre accepté). */
  canEdit: boolean;
}

const TripAccessContext = createContext<TripAccessValue | null>(null);

/**
 * Fournit le niveau d'accès au voyage courant. Remplace l'ancien « mode admin »
 * (code secret) : c'est désormais l'API qui décide (`owner`/`editor` = édition,
 * `public` = vue affichage lecture seule sans infos confidentielles).
 */
export function TripAccessProvider({
  access,
  children,
}: {
  access: TripAccess;
  children: ReactNode;
}) {
  const canEdit = access === 'owner' || access === 'editor';
  return (
    <TripAccessContext.Provider value={{ access, canEdit }}>{children}</TripAccessContext.Provider>
  );
}

export function useTripAccess(): TripAccessValue {
  const ctx = useContext(TripAccessContext);
  if (!ctx) throw new Error('useTripAccess doit être utilisé dans un TripAccessProvider');
  return ctx;
}
