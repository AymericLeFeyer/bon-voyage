import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import type { LatLng } from '@shared/types/trip';
import { setAccommodation, setFlight, updatePlace } from '@/domain/trip/services/tripMutations';
import type { FlightSide } from '@/domain/trip/services/tripMutations';
import { createFlight } from '@/domain/trip/services/tripFactory';
import { useTrip } from '@/presentation/hooks/useTrip';
import { useIsMobile } from '@/presentation/hooks/useMediaQuery';
import { tripRepository } from '@/infrastructure/trip/HttpTripRepository';
import { TripAccessProvider } from '@/presentation/mode/TripAccessProvider';
import { TripSettingsModal } from '@/presentation/components/trip/TripSettingsModal';
import { deriveMapSelection, type PlacingTarget, type Selection } from '@/presentation/types';
import { Sidebar } from '@/presentation/components/panels/Sidebar';
import { DetailModal } from '@/presentation/components/panels/DetailModal';
import { DetailDrawer } from '@/presentation/components/panels/DetailDrawer';
import { TripMap } from '@/presentation/components/map/TripMap';
import { MobileTripView } from './MobileTripView';

export function TripPage() {
  const { id = '' } = useParams();
  const { trip, access, loading, loadError, saveStatus, mutate, setTrip } = useTrip(id);
  const isMobile = useIsMobile();
  const canEdit = access === 'owner' || access === 'editor';
  const [settingsOpen, setSettingsOpen] = useState(false);

  const setPublic = async (isPublic: boolean) => {
    const updated = await tripRepository.setPublic(id, isPublic);
    setTrip(updated);
  };

  // Vue par étape (défaut) ou par jour. Persisté.
  const [viewMode, setViewMode] = useState<'stages' | 'days'>(
    () => (localStorage.getItem('trip-visualizer.viewMode') === 'days' ? 'days' : 'stages'),
  );
  const toggleView = () => {
    setViewMode((v) => {
      const next = v === 'stages' ? 'days' : 'stages';
      localStorage.setItem('trip-visualizer.viewMode', next);
      return next;
    });
    setStack([]);
  };

  // Pile de sélections (desktop = tiroirs empilés : étape → lieu). Le dessus = actif.
  const [stack, setStack] = useState<NonNullable<Selection>[]>([]);
  const selection: Selection = stack.length ? stack[stack.length - 1] : null;
  // Base de la pile = élément « fil d'Ariane » surligné dans la sidebar/rail
  // (l'étape/le jour reste coloré même quand un lieu enfant est ouvert au-dessus).
  const rootSelection: Selection = stack.length ? stack[0] : null;
  const [placingTarget, setPlacingTarget] = useState<PlacingTarget>(null);
  const [focusTarget, setFocusTarget] = useState<{ location: LatLng; nonce: number } | null>(null);

  const stageLocation = (stageId: string) =>
    trip?.stages.find((s) => s.id === stageId)?.accommodation?.location;
  const placeLocation = (stageId: string, placeId: string) =>
    trip?.stages.find((s) => s.id === stageId)?.places.find((p) => p.id === placeId)?.location;
  const focusStage = (stageId: string) => {
    const loc = stageLocation(stageId);
    if (loc) setFocusTarget({ location: loc, nonce: Date.now() });
  };
  const focusPlace = (stageId: string, placeId: string) => {
    const loc = placeLocation(stageId, placeId);
    if (loc) setFocusTarget({ location: loc, nonce: Date.now() });
  };

  const selectStage = (stageId: string) => setStack([{ kind: 'stage', stageId }]);
  // Sélection d'une étape depuis la sidebar/tiroir : recadre aussi la carte.
  const selectStageFromList = (stageId: string) => {
    selectStage(stageId);
    focusStage(stageId);
  };
  // Un lieu ouvre un 2ᵉ tiroir par-dessus son étape (contexte conservé).
  const selectPlace = (stageId: string, placeId: string) =>
    setStack([
      { kind: 'stage', stageId },
      { kind: 'place', stageId, placeId },
    ]);
  // Ouverture d'un lieu depuis un tiroir (liste d'étape) : recadre aussi la carte.
  const selectPlaceFromDrawer = (stageId: string, placeId: string) => {
    selectPlace(stageId, placeId);
    focusPlace(stageId, placeId);
  };
  const selectLeg = (stageId: string) => setStack([{ kind: 'leg', stageId }]);
  const selectFlight = (side: FlightSide) => {
    // En admin, créer le vol à la volée s'il n'existe pas encore.
    const exists = side === 'outbound' ? trip?.outboundFlight : trip?.returnFlight;
    if (canEdit && !exists) mutate((t) => setFlight(t, side, createFlight()));
    setStack([{ kind: 'flight', side }]);
  };
  const selectDay = (date: string) => {
    setStack([{ kind: 'day', date }]);
    // Recadre sur la base (hébergement) de la nuit correspondante.
    const base = trip?.stages.find((s) => {
      const ci = s.accommodation?.checkInDate;
      const co = s.accommodation?.checkOutDate;
      return ci != null && co != null && ci <= date && date < co;
    });
    if (base?.accommodation?.location) {
      setFocusTarget({ location: base.accommodation.location, nonce: Date.now() });
    }
  };
  // Ouvre `sel` comme tiroir enfant du tiroir d'index `index` : remplace tout ce
  // qui était au-dessus (un seul lieu ouvert à la fois depuis une journée).
  const pushFrom = (index: number, sel: NonNullable<Selection>) =>
    setStack((s) => [...s.slice(0, index + 1), sel]);
  // Ferme le tiroir d'index i et tous ceux au-dessus.
  const closeFrom = (index: number) => setStack((s) => s.slice(0, index));
  const clearSelection = () => setStack([]);

  // « Focus » mobile : recadre la carte et ferme la modale pour voir le point.
  const focusOnMap = (location: LatLng) => {
    setFocusTarget({ location, nonce: Date.now() });
    clearSelection();
  };

  // « Focus » desktop : garde les tiroirs ouverts. La carte est déjà réduite à
  // l'espace à droite des tiroirs (frères flex) → le flyTo centre sur ce qu'il
  // reste de carte visible, sans avoir à calculer d'inset.
  const focusInDrawer = (location: LatLng) => {
    setFocusTarget({ location, nonce: Date.now() });
  };

  const handleMapClick = (location: LatLng) => {
    if (!placingTarget) return;
    if (placingTarget.kind === 'accommodation') {
      mutate((t) => setAccommodation(t, placingTarget.stageId, { location }));
    } else if (placingTarget.kind === 'flightAirport') {
      mutate((t) => setFlight(t, placingTarget.side, { airportLocation: location }));
    } else {
      mutate((t) => updatePlace(t, placingTarget.stageId, placingTarget.placeId, { location }));
    }
    setPlacingTarget(null);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Chargement du voyage…
      </div>
    );
  }

  if (loadError || !trip) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <p className="text-lg font-semibold">Voyage introuvable</p>
        <p className="text-sm text-muted-foreground">{loadError ?? 'Ce lien ne correspond à aucun voyage.'}</p>
        <a href="/" className="text-sm text-primary underline">
          Retour à l'accueil
        </a>
      </div>
    );
  }

  const mapSelection = deriveMapSelection(selection);

  // Bandeau de placement (position fixed → partagé desktop/mobile).
  const placementBanner = placingTarget && (
    <div className="fixed left-1/2 top-4 z-[1300] -translate-x-1/2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg">
      Clique sur la carte pour placer le point
      <button className="ml-3 underline opacity-90" onClick={() => setPlacingTarget(null)}>
        annuler
      </button>
    </div>
  );

  const resolvedAccess = access ?? 'public';

  const settingsModal = (
    <TripSettingsModal
      open={settingsOpen}
      onClose={() => setSettingsOpen(false)}
      tripId={trip.id}
      access={resolvedAccess}
      isPublic={trip.isPublic}
      onSetPublic={setPublic}
    />
  );

  if (isMobile) {
    return (
      <TripAccessProvider access={resolvedAccess}>
        <MobileTripView
          trip={trip}
          isAdmin={canEdit}
          saveStatus={saveStatus}
          mapSelection={mapSelection}
          placingMode={placingTarget !== null}
          focusTarget={focusTarget}
          viewMode={viewMode}
          mutate={mutate}
          onToggleView={toggleView}
          onOpenSettings={() => setSettingsOpen(true)}
          onSelectStage={selectStage}
          onSelectPlace={selectPlace}
          onSelectLeg={selectLeg}
          onSelectFlight={selectFlight}
          onMapClick={handleMapClick}
        />
        {/* Mobile : l'édition passe par une modale (les taps carte pilotent le sheet). */}
        <DetailModal
          trip={trip}
          selection={selection}
          isAdmin={canEdit}
          placingTarget={placingTarget}
          mutate={mutate}
          setPlacingTarget={setPlacingTarget}
          onSelectStage={selectStage}
          onSelectPlace={selectPlace}
          onFocus={focusOnMap}
          onClose={clearSelection}
        />
        {settingsModal}
        {placementBanner}
      </TripAccessProvider>
    );
  }

  return (
    <TripAccessProvider access={resolvedAccess}>
      <div className="flex h-full">
        <Sidebar
          trip={trip}
          selection={rootSelection}
          saveStatus={saveStatus}
          isAdmin={canEdit}
          viewMode={viewMode}
          mutate={mutate}
          onToggleView={toggleView}
          onOpenSettings={() => setSettingsOpen(true)}
          onSelectStage={selectStageFromList}
          onSelectLeg={selectLeg}
          onSelectFlight={selectFlight}
          onSelectDay={selectDay}
        />

      {/* Desktop : tiroirs empilés redimensionnables. Bornés en largeur (scroll
          horizontal interne) pour toujours laisser ~260px de carte cliquable. */}
      {stack.length > 0 && (
        <div className="flex h-full max-w-[calc(100vw-600px)] shrink-0 overflow-x-auto">
          {stack.map((sel, i) => (
            <DetailDrawer
              key={i}
              trip={trip}
              selection={sel}
              isAdmin={canEdit}
              placingTarget={placingTarget}
              mutate={mutate}
              setPlacingTarget={setPlacingTarget}
              childSelection={stack[i + 1] ?? null}
              onSelectStage={selectStage}
              onSelectPlace={selectPlaceFromDrawer}
              onPush={(sel2) => {
                pushFrom(i, sel2);
                if (sel2.kind === 'place') focusPlace(sel2.stageId, sel2.placeId);
                else if (sel2.kind === 'stage') focusStage(sel2.stageId);
              }}
              onFocus={focusInDrawer}
              onClose={() => closeFrom(i)}
            />
          ))}
        </div>
      )}

      <main className="relative min-w-0 flex-1">
        <TripMap
          trip={trip}
          selectedStageId={mapSelection.selectedStageId}
          selectedPlaceId={mapSelection.selectedPlaceId}
          selectedLegStageId={mapSelection.selectedLegStageId}
          selectedFlight={mapSelection.selectedFlight}
          placingMode={placingTarget !== null}
          focusTarget={focusTarget}
          onSelectStage={selectStage}
          onSelectPlace={selectPlace}
          onSelectLeg={selectLeg}
          onSelectFlight={selectFlight}
          onMapClick={handleMapClick}
        />
      </main>

        {settingsModal}
        {placementBanner}
      </div>
    </TripAccessProvider>
  );
}
