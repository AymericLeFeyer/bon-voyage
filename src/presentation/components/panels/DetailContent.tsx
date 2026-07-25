import type { LatLng, Trip } from '@shared/types/trip';
import type { PlacingTarget, Selection } from '@/presentation/types';
import { travelCopy } from '@/shared/constants/travel';
import { DayDetail } from './DayDetail';
import { StageDetail } from '../details/StageDetail';
import { PlaceDetail } from '../details/PlaceDetail';
import { LegDetail } from '../details/LegDetail';
import { FlightDetail } from '../details/FlightDetail';
import { PlaceEditor } from './PlaceEditor';
import { StageEditor } from './StageEditor';
import { TransportLegEditor } from './TransportLegEditor';
import { FlightEditor } from './FlightEditor';

export interface DetailContentProps {
  trip: Trip;
  selection: Selection;
  isAdmin: boolean;
  placingTarget: PlacingTarget;
  mutate: (updater: (trip: Trip) => Trip) => void;
  setPlacingTarget: (target: PlacingTarget) => void;
  onSelectStage: (stageId: string) => void;
  onSelectPlace: (stageId: string, placeId: string) => void;
  onFocus: (location: LatLng) => void;
  onClose: () => void;
  /** Empile un tiroir par-dessus (vue par jour). */
  onPush?: (sel: NonNullable<Selection>) => void;
  /** Sélection du tiroir enfant (au-dessus) → surligne l'item correspondant (vue par jour). */
  childSelection?: Selection;
  /** Colonne simple pour les étapes (tiroir étroit desktop). */
  compact?: boolean;
}

function midpoint(a: LatLng, b: LatLng): LatLng {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

/**
 * Corps de la vue détail/édition d'un élément sélectionné (étape, lieu, jambe, vol).
 * - Admin → éditeurs (formulaires).
 * - Visualisation → vues lecture seule.
 * Réutilisé par la modale (mobile) et le tiroir latéral (desktop).
 */
export function DetailContent({
  trip,
  selection,
  isAdmin,
  placingTarget,
  mutate,
  setPlacingTarget,
  onSelectStage,
  onSelectPlace,
  onFocus,
  onClose,
  onPush,
  childSelection,
  compact,
}: DetailContentProps) {
  const focusHandler = (location?: LatLng) => (location ? () => onFocus(location) : undefined);
  if (!selection) return null;

  if (selection.kind === 'day') {
    const base = trip.stages.find((s) => {
      const ci = s.accommodation?.checkInDate;
      const co = s.accommodation?.checkOutDate;
      return ci != null && co != null && ci <= selection.date && selection.date < co;
    });
    const focus = focusHandler(base?.accommodation?.location);
    return (
      <DayDetail
        trip={trip}
        date={selection.date}
        childSelection={childSelection}
        onPush={onPush ?? (() => {})}
        onFocus={focus}
        onClose={onClose}
      />
    );
  }

  if (selection.kind === 'flight') {
    const flight = selection.side === 'outbound' ? trip.outboundFlight : trip.returnFlight;
    const copy = travelCopy(trip);
    // Mode « non défini » : plus aucun trajet aller/retour à afficher.
    if (!flight || !copy) return null;
    const focus = focusHandler(flight.airportLocation);
    return isAdmin ? (
      <FlightEditor
        side={selection.side}
        flight={flight}
        copy={copy}
        placingTarget={placingTarget}
        mutate={mutate}
        setPlacingTarget={setPlacingTarget}
        onFocus={focus}
        onClose={onClose}
      />
    ) : (
      <FlightDetail
        side={selection.side}
        flight={flight}
        copy={copy}
        onFocus={focus}
        onClose={onClose}
      />
    );
  }

  if (selection.kind === 'leg') {
    const index = trip.stages.findIndex((s) => s.id === selection.stageId);
    const stage = trip.stages[index];
    if (!stage || !stage.transportToNext) return null;
    const nextStage = trip.stages[index + 1];
    const from = stage.accommodation?.location;
    const to = nextStage?.accommodation?.location;
    const focus = focusHandler(from && to ? midpoint(from, to) : undefined);
    return isAdmin ? (
      <TransportLegEditor
        trip={trip}
        stageId={selection.stageId}
        mutate={mutate}
        onFocus={focus}
        onClose={onClose}
      />
    ) : (
      <LegDetail stage={stage} nextStage={nextStage} onFocus={focus} onClose={onClose} />
    );
  }

  if (selection.kind === 'stage') {
    const stage = trip.stages.find((s) => s.id === selection.stageId);
    if (!stage) return null;
    const focus = focusHandler(stage.accommodation?.location);
    // Lieu ouvert dans le tiroir enfant → surligné dans la liste de l'étape.
    const selectedPlaceId =
      childSelection?.kind === 'place' && childSelection.stageId === stage.id
        ? childSelection.placeId
        : undefined;
    return isAdmin ? (
      <StageEditor
        trip={trip}
        stage={stage}
        placingTarget={placingTarget}
        mutate={mutate}
        setPlacingTarget={setPlacingTarget}
        onSelectPlace={onSelectPlace}
        onFocus={focus}
        onClose={onClose}
        selectedPlaceId={selectedPlaceId}
        compact={compact}
      />
    ) : (
      <StageDetail
        trip={trip}
        stage={stage}
        onSelectPlace={(placeId) => onSelectPlace(stage.id, placeId)}
        onFocus={focus}
        onClose={onClose}
        selectedPlaceId={selectedPlaceId}
        compact={compact}
      />
    );
  }

  // selection.kind === 'place'
  const stage = trip.stages.find((s) => s.id === selection.stageId);
  const place = stage?.places.find((p) => p.id === selection.placeId);
  if (!stage || !place) return null;
  const focus = focusHandler(place.location);
  return isAdmin ? (
    <PlaceEditor
      trip={trip}
      stageId={stage.id}
      place={place}
      placingTarget={placingTarget}
      mutate={mutate}
      setPlacingTarget={setPlacingTarget}
      onBackToStage={onSelectStage}
      onFocus={focus}
      onClose={onClose}
    />
  ) : (
    <PlaceDetail stage={stage} place={place} onFocus={focus} onClose={onClose} />
  );
}
