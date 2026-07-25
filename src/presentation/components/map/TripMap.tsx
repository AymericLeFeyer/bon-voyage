import { useCallback, useEffect, useMemo, useRef } from 'react';
import Map, { Layer, Marker, Source, type MapRef } from 'react-map-gl/maplibre';
import type { FeatureCollection, LineString } from 'geojson';
import type { LatLng, Trip } from '@shared/types/trip';
import { PLACE_CATEGORIES, TRANSPORT_MODES } from '@/shared/constants/catalog';
import type { FlightSide } from '@/domain/trip/services/tripMutations';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { FlightPin, LegPin, PlacePin, StagePin } from './pins';
import { applyMapLanguage, MAP_STYLE_URLS } from './mapStyle';

interface TripMapProps {
  trip: Trip;
  selectedStageId: string | null;
  selectedPlaceId: string | null;
  selectedLegStageId: string | null;
  selectedFlight: FlightSide | null;
  placingMode: boolean;
  /**
   * Demande de recadrage : la carte vole vers `location` à chaque nouveau `nonce`.
   * `bottomInset` (px) réserve un espace bas (hauteur du bottom sheet mobile) pour
   * que le point ne soit pas masqué.
   */
  focusTarget?: { location: LatLng; nonce: number; bottomInset?: number } | null;
  onSelectStage: (stageId: string) => void;
  onSelectPlace: (stageId: string, placeId: string) => void;
  onSelectLeg: (stageId: string) => void;
  onSelectFlight: (side: FlightSide) => void;
  onMapClick: (location: LatLng) => void;
}

const JAPAN_VIEW = { longitude: 138.2529, latitude: 36.2048, zoom: 5 };

function collectPoints(trip: Trip): LatLng[] {
  const points: LatLng[] = [];
  if (trip.outboundFlight?.airportLocation) points.push(trip.outboundFlight.airportLocation);
  for (const stage of trip.stages) {
    if (stage.accommodation?.location) points.push(stage.accommodation.location);
    for (const place of stage.places) {
      if (place.location) points.push(place.location);
    }
  }
  if (trip.returnFlight?.airportLocation) points.push(trip.returnFlight.airportLocation);
  return points;
}

function midpoint(a: LatLng, b: LatLng): LatLng {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

export function TripMap({
  trip,
  selectedStageId,
  selectedPlaceId,
  selectedLegStageId,
  selectedFlight,
  placingMode,
  focusTarget,
  onSelectStage,
  onSelectPlace,
  onSelectLeg,
  onSelectFlight,
  onMapClick,
}: TripMapProps) {
  const { theme } = useTheme();
  const mapRef = useRef<MapRef>(null);
  const points = useMemo(() => collectPoints(trip), [trip]);

  // Itinéraire ordonné : aéroport d'aller → nuits → aéroport de retour.
  const routeData = useMemo<FeatureCollection<LineString>>(() => {
    const ordered: (LatLng | undefined)[] = [
      trip.outboundFlight?.airportLocation,
      ...trip.stages.map((s) => s.accommodation?.location),
      trip.returnFlight?.airportLocation,
    ];
    const coords = ordered
      .filter((l): l is LatLng => Boolean(l))
      .map((l) => [l.lng, l.lat] as [number, number]);
    return {
      type: 'FeatureCollection',
      features:
        coords.length > 1
          ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }]
          : [],
    };
  }, [trip.stages, trip.outboundFlight, trip.returnFlight]);

  // Liens en pointillés entre chaque nuit et ses lieux satellites.
  const linkData = useMemo<FeatureCollection<LineString>>(() => {
    const features: FeatureCollection<LineString>['features'] = [];
    for (const stage of trip.stages) {
      const base = stage.accommodation?.location;
      if (!base) continue;
      for (const place of stage.places) {
        if (!place.location) continue;
        features.push({
          type: 'Feature',
          properties: { color: stage.color },
          geometry: {
            type: 'LineString',
            coordinates: [
              [base.lng, base.lat],
              [place.location.lng, place.location.lat],
            ],
          },
        });
      }
    }
    return { type: 'FeatureCollection', features };
  }, [trip.stages]);

  const fitToTrip = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    // Voyage encore vide : on cadre sur la destination saisie à la création.
    if (points.length === 0) {
      const dest = trip.destinationLocation;
      if (dest) map.jumpTo({ center: [dest.lng, dest.lat], zoom: 8 });
      return;
    }
    const lngs = points.map((p) => p.lng);
    const lats = points.map((p) => p.lat);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 70, maxZoom: 13, duration: 0 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id]);

  // Recadrer uniquement au changement de voyage.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(fitToTrip, [trip.id]);

  // Recadrage à la demande (bouton « Focus » d'une modale) : vole vers le point, zoomé.
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !focusTarget) return;
    // ⚠️ Ne jamais passer `padding: undefined` à flyTo (maplibre v4 lève) : on
    // n'ajoute la clé que si un inset est fourni (hauteur du bottom sheet mobile).
    const options: Parameters<typeof map.flyTo>[0] = {
      center: [focusTarget.location.lng, focusTarget.location.lat],
      zoom: 14,
      duration: 900,
    };
    if (focusTarget.bottomInset) {
      options.padding = { top: 0, bottom: focusTarget.bottomInset, left: 0, right: 0 };
    }
    map.flyTo(options);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTarget?.nonce]);

  // (Ré)appliquer la traduction française des labels au changement de thème.
  // ⚠️ Un changement de thème = react-map-gl fait un `setStyle` → la carte se
  // recharge en **langue locale**. Il ne faut donc PAS réappliquer sur l'ancien
  // style (`isStyleLoaded()` renverrait `true` avant le rechargement, et le
  // français serait aussitôt écrasé) : on attend toujours le prochain `idle`,
  // qui n'arrive qu'une fois la NOUVELLE style rendue.
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const run = () => applyMapLanguage(map);
    map.once('idle', run);
    return () => {
      map.off('idle', run);
    };
  }, [theme]);

  return (
    <Map
      ref={mapRef}
      initialViewState={JAPAN_VIEW}
      mapStyle={MAP_STYLE_URLS[theme]}
      cursor={placingMode ? 'crosshair' : undefined}
      style={{ width: '100%', height: '100%' }}
      onLoad={() => {
        const map = mapRef.current?.getMap();
        if (map) applyMapLanguage(map);
        fitToTrip();
      }}
      onClick={(e) => {
        if (placingMode) onMapClick({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      }}
    >
      <Source id="route" type="geojson" data={routeData}>
        <Layer
          id="route-line"
          type="line"
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{ 'line-color': '#64748b', 'line-width': 3, 'line-opacity': 0.55 }}
        />
      </Source>

      <Source id="links" type="geojson" data={linkData}>
        <Layer
          id="link-line"
          type="line"
          paint={{
            'line-color': ['get', 'color'],
            'line-width': 1.5,
            'line-opacity': 0.5,
            'line-dasharray': [2, 2],
          }}
        />
      </Source>

      {/* Aéroports des vols aller / retour (pays visité) */}
      {(['outbound', 'return'] as const).map((side) => {
        const flight = side === 'outbound' ? trip.outboundFlight : trip.returnFlight;
        const loc = flight?.airportLocation;
        if (!loc) return null;
        return (
          <Marker
            key={`flight-${side}`}
            longitude={loc.lng}
            latitude={loc.lat}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              onSelectFlight(side);
            }}
          >
            <FlightPin selected={selectedFlight === side} />
          </Marker>
        );
      })}

      {/* Marqueurs de transport au milieu de chaque jambe de trajet */}
      {trip.stages.map((stage, index) => {
        const from = stage.accommodation?.location;
        const to = trip.stages[index + 1]?.accommodation?.location;
        if (!stage.transportToNext || !from || !to) return null;
        const mid = midpoint(from, to);
        return (
          <Marker
            key={`leg-${stage.id}`}
            longitude={mid.lng}
            latitude={mid.lat}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              onSelectLeg(stage.id);
            }}
          >
            <LegPin
              emoji={TRANSPORT_MODES[stage.transportToNext.mode].emoji}
              selected={selectedLegStageId === stage.id}
            />
          </Marker>
        );
      })}

      {/* Lieux satellites */}
      {trip.stages.flatMap((stage) =>
        stage.places
          .filter((p) => p.location)
          .map((p) => (
            <Marker
              key={p.id}
              longitude={p.location!.lng}
              latitude={p.location!.lat}
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                onSelectPlace(stage.id, p.id);
              }}
            >
              <PlacePin
                color={stage.color}
                emoji={PLACE_CATEGORIES[p.category].emoji}
                visited={p.visited}
                selected={selectedPlaceId === p.id}
              />
            </Marker>
          )),
      )}

      {/* Étapes (nuits) */}
      {trip.stages.map((stage, index) => {
        const base = stage.accommodation?.location;
        if (!base) return null;
        return (
          <Marker
            key={stage.id}
            longitude={base.lng}
            latitude={base.lat}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              onSelectStage(stage.id);
            }}
          >
            <StagePin
              order={index + 1}
              color={stage.color}
              emoji={stage.emoji}
              selected={selectedStageId === stage.id}
            />
          </Marker>
        );
      })}
    </Map>
  );
}
