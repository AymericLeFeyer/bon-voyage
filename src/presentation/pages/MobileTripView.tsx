import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  KeyRound,
  List as ListIcon,
  Locate,
  Pencil,
  Plus,
  Settings,
  StickyNote,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { Flight, LatLng, Place, Stage, Trip } from '@shared/types/trip';
import { PLACE_CATEGORIES, TRANSPORT_MODES } from '@/shared/constants/catalog';
import { createStage, createTransport } from '@/domain/trip/services/tripFactory';
import { addStage, setTransportLeg, updatePlace } from '@/domain/trip/services/tripMutations';
import type { FlightSide } from '@/domain/trip/services/tripMutations';
import { formatTransportSummary } from '@/shared/lib/transport';
import { formatLongDate, formatPlanned, formatShortDate, nightsLabel } from '@/shared/lib/date';
import { sortPlacesChronologically } from '@/shared/lib/place';
import { buildItinerary } from '@/shared/lib/itinerary';
import { distanceLabel } from '@/shared/lib/geo';
import type { SaveStatus } from '@/presentation/hooks/useTrip';
import type { MapSelection } from '@/presentation/types';
import { ThemeToggle } from '@/presentation/components/ThemeToggle';
import { UserMenu } from '@/presentation/components/UserMenu';
import { TripMap } from '@/presentation/components/map/TripMap';
import { MobileSheet, type SheetSnap } from '@/presentation/components/mobile/MobileSheet';
import { QuickAddPlace } from '@/presentation/components/mobile/QuickAddPlace';
import { MapsSearchButton } from '@/presentation/components/details/parts';
import { ConfidentialBlock } from '@/presentation/components/details/ConfidentialBlock';
import { BudgetModal } from '@/presentation/components/panels/BudgetModal';
import { cn } from '@/shared/lib/cn';

interface MobileTripViewProps {
  trip: Trip;
  isAdmin: boolean;
  saveStatus: SaveStatus;
  mapSelection: MapSelection;
  placingMode: boolean;
  focusTarget?: { location: LatLng; nonce: number } | null;
  viewMode: 'stages' | 'days';
  mutate: (updater: (trip: Trip) => Trip) => void;
  onToggleView: () => void;
  onOpenSettings: () => void;
  onSelectStage: (stageId: string) => void;
  onSelectPlace: (stageId: string, placeId: string) => void;
  onSelectLeg: (stageId: string) => void;
  onSelectFlight: (side: FlightSide) => void;
  onMapClick: (location: LatLng) => void;
}

type Active =
  | { type: 'stage'; id: string }
  | { type: 'place'; stageId: string; placeId: string }
  | { type: 'flight'; side: FlightSide }
  | { type: 'day'; date: string }
  | null;

// --- Rail (navigation horizontale entre étapes) ---

function RailPill({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean;
  color?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'border-transparent text-white shadow-sm'
          : 'border-border bg-card text-foreground hover:bg-muted',
        active && !color && 'bg-primary text-primary-foreground',
      )}
      style={active && color ? { background: color } : undefined}
    >
      {children}
    </button>
  );
}

// --- Contenu d'une étape dans le sheet ---

function FocusPill({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-primary hover:bg-muted"
    >
      <Locate className="h-3.5 w-3.5" /> Sur la carte
    </button>
  );
}

function MapsLink({ url }: { url?: string }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-primary hover:bg-muted"
      title="Ouvrir dans Maps"
    >
      <ExternalLink className="h-4 w-4" />
    </a>
  );
}

/** Bloc de texte (notes, modalités, description) avec une petite icône. */
function SheetNote({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="flex gap-2 rounded-xl border border-border p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

function VisitedToggle({ visited, onToggle }: { visited: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      title={visited ? 'Marquer à visiter' : 'Marquer comme visité'}
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors',
        visited
          ? 'border-green-600 bg-green-600 text-white'
          : 'border-border text-muted-foreground hover:bg-muted',
      )}
    >
      <Check className="h-4 w-4" />
    </button>
  );
}

function PlaceCard({
  place,
  origin,
  isAdmin,
  onOpen,
  onToggleVisited,
}: {
  place: Place;
  origin?: LatLng | null;
  isAdmin: boolean;
  onOpen: () => void;
  onToggleVisited: () => void;
}) {
  const cat = PLACE_CATEGORIES[place.category];
  const distance = distanceLabel(origin, place.location);
  const price = place.price != null ? `${place.price}${place.currency ?? '€'}` : null;
  const planned = formatPlanned(place.plannedDate, place.plannedTime);
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl border bg-card p-2.5',
        place.reserved
          ? 'border-amber-300 bg-amber-50/60 dark:border-amber-500/40 dark:bg-amber-500/5'
          : 'border-border',
      )}
    >
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="text-2xl leading-none">{cat.emoji}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={cn('truncate font-medium', place.visited && 'text-muted-foreground line-through')}>
              {place.name}
            </span>
            {place.reserved && (
              <span
                className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
                title="Réservé"
              >
                🎟️
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {planned && <span className="shrink-0 font-medium text-primary">🕒 {planned}</span>}
            {place.address && <span className="truncate">{place.address}</span>}
            {distance && <span className="shrink-0">· {distance}</span>}
            {price && <span className="shrink-0 font-medium tabular-nums">· {price}</span>}
          </div>
        </div>
      </button>
      <MapsLink url={place.googleMapsUrl} />
      {isAdmin && <VisitedToggle visited={place.visited} onToggle={onToggleVisited} />}
    </div>
  );
}

interface StageContentProps {
  trip: Trip;
  stage: Stage;
  isAdmin: boolean;
  onEditStage: () => void;
  onOpenPlace: (placeId: string) => void;
  onAddPlace: () => void;
  onEditLeg: () => void;
  onAddLeg: () => void;
  onToggleVisited: (placeId: string, visited: boolean) => void;
  onFocus: (location?: LatLng) => void;
}

function StageContent({
  trip,
  stage,
  isAdmin,
  onEditStage,
  onOpenPlace,
  onAddPlace,
  onEditLeg,
  onAddLeg,
  onToggleVisited,
  onFocus,
}: StageContentProps) {
  const order = trip.stages.findIndex((s) => s.id === stage.id) + 1;
  const acc = stage.accommodation;
  const index = order - 1;
  const isLast = index === trip.stages.length - 1;
  const leg = stage.transportToNext;
  const nights = nightsLabel(acc?.checkInDate, acc?.checkOutDate);
  const places = sortPlacesChronologically(stage.places);

  return (
    <div className="space-y-4">
      {stage.imageUrl && (
        <img
          src={stage.imageUrl}
          alt=""
          className="h-40 w-full rounded-xl border border-border bg-muted object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      )}
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-white"
          style={{ background: stage.color }}
        >
          {stage.emoji ?? order}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-lg font-bold leading-tight">{stage.name}</h2>
            {nights && (
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {nights}
              </span>
            )}
          </div>
          {(acc?.checkInDate || acc?.checkOutDate) && (
            <p className="text-xs text-muted-foreground">
              {[acc?.checkInDate, acc?.checkOutDate].filter(Boolean).map(formatLongDate).join(' → ')}
            </p>
          )}
        </div>
        {isAdmin && (
          <button
            onClick={onEditStage}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted"
            title="Éditer l'étape"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Hébergement */}
      {acc?.name && (
        <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold">🛏️ {acc.name}</div>
              {acc.address && (
                <div className="text-xs text-muted-foreground">{acc.address}</div>
              )}
            </div>
          </div>
          {(acc.arrivalTime || acc.departureTime) && (
            <div className="text-xs text-muted-foreground">
              {[
                acc.arrivalTime && `arrivée ${acc.arrivalTime}`,
                acc.departureTime && `départ ${acc.departureTime}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>
          )}
          {acc.price != null && (
            <div className="text-xs text-muted-foreground">
              Prix : {acc.price}
              {acc.currency ?? '€'}
            </div>
          )}
          {acc.modalities && (
            <div className="flex gap-1.5 text-xs text-muted-foreground">
              <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 flex-1 whitespace-pre-wrap">{acc.modalities}</span>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {acc.location && <FocusPill onClick={() => onFocus(acc.location)} />}
            <MapsSearchButton query={acc.address || acc.name} />
          </div>
        </div>
      )}

      {/* Lieux à visiter */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">
          À visiter <span className="text-muted-foreground">({places.length})</span>
        </h3>

        {places.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            {isAdmin ? 'Ajoute les spots que tu veux voir.' : 'Aucun lieu pour cette étape.'}
          </p>
        ) : (
          <div className="space-y-2">
            {places.map((place) => (
              <PlaceCard
                key={place.id}
                place={place}
                origin={stage.accommodation?.location}
                isAdmin={isAdmin}
                onOpen={() => onOpenPlace(place.id)}
                onToggleVisited={() => onToggleVisited(place.id, !place.visited)}
              />
            ))}
          </div>
        )}

        {/* Ajout d'un lieu en fin de liste (remplace l'ancien FAB). */}
        {isAdmin && (
          <button
            onClick={onAddPlace}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border p-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            <Plus className="h-4 w-4" /> Ajouter un lieu
          </button>
        )}
      </div>

      {/* Transport vers l'étape suivante */}
      {!isLast &&
        (leg ? (
          <button
            onClick={onEditLeg}
            className="flex w-full items-center gap-2 rounded-xl border border-border p-3 text-left transition-colors hover:bg-muted"
          >
            <span className="text-lg">{TRANSPORT_MODES[leg.mode].emoji}</span>
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              Vers {trip.stages[index + 1]?.name} · {formatTransportSummary(leg) || TRANSPORT_MODES[leg.mode].label}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        ) : isAdmin ? (
          <button
            onClick={onAddLeg}
            className="flex w-full items-center gap-1.5 rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground hover:bg-muted"
          >
            <Plus className="h-4 w-4" /> Ajouter le transport vers {trip.stages[index + 1]?.name}
          </button>
        ) : null)}

      <SheetNote icon={StickyNote}>{stage.notes}</SheetNote>

      <ConfidentialBlock text={stage.confidential} />
    </div>
  );
}

function PlaceContent({
  stage,
  place,
  isAdmin,
  onBack,
  onEdit,
  onToggleVisited,
  onFocus,
}: {
  stage: Stage;
  place: Place;
  isAdmin: boolean;
  onBack: () => void;
  onEdit: () => void;
  onToggleVisited: () => void;
  onFocus: (location?: LatLng) => void;
}) {
  const cat = PLACE_CATEGORIES[place.category];
  const distance = distanceLabel(stage.accommodation?.location, place.location);
  const planned = formatPlanned(place.plannedDate, place.plannedTime);
  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> {stage.name}
      </button>

      {place.imageUrl && (
        <img
          src={place.imageUrl}
          alt=""
          className="h-40 w-full rounded-xl border border-border bg-muted object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      )}

      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-muted text-2xl">
          {cat.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className={cn('truncate text-lg font-bold leading-tight', place.visited && 'line-through')}>
              {place.name}
            </h2>
            {place.reserved && (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                🎟️ Réservé
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {cat.label}
            {planned && ` · 🕒 ${planned}`}
            {distance && ` · ${distance} de l'hébergement`}
            {place.price != null && ` · ${place.price}${place.currency ?? '€'}`}
            {place.visited && ' · déjà visité'}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={onEdit}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted"
            title="Éditer le lieu"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </div>

      {place.address && <p className="text-sm text-muted-foreground">{place.address}</p>}

      <SheetNote icon={StickyNote}>{place.notes}</SheetNote>

      <ConfidentialBlock text={place.confidential} />

      <div className="flex flex-wrap items-center gap-2">
        {place.location && <FocusPill onClick={() => onFocus(place.location)} />}
        <MapsSearchButton query={place.address || place.name} />
        {isAdmin && (
          <button
            onClick={onToggleVisited}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors',
              place.visited
                ? 'border-green-600 text-green-700 dark:text-green-500'
                : 'border-border text-muted-foreground hover:bg-muted',
            )}
          >
            <Check className="h-3.5 w-3.5" />
            {place.visited ? 'Visité' : 'Marquer visité'}
          </button>
        )}
      </div>
    </div>
  );
}

function FlightContent({
  side,
  flight,
  isAdmin,
  onEdit,
  onFocus,
}: {
  side: FlightSide;
  flight: Flight;
  isAdmin: boolean;
  onEdit: () => void;
  onFocus: (location?: LatLng) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-2xl">
          ✈️
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold leading-tight">
            {side === 'outbound' ? 'Vol aller' : 'Vol retour'}
          </h2>
          {flight.airport && (
            <p className="truncate text-xs text-muted-foreground">{flight.airport}</p>
          )}
        </div>
        {isAdmin && (
          <button
            onClick={onEdit}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted"
            title="Éditer le vol"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </div>

      {flight.legs.map((leg, i) => (
        <div key={leg.id} className="rounded-xl border border-border p-3 text-sm">
          <div className="font-medium">{leg.flightNumber || `Segment ${i + 1}`}</div>
          {(leg.from || leg.to) && (
            <div className="text-muted-foreground">
              {[leg.from, leg.to].filter(Boolean).join(' → ')}
            </div>
          )}
          {(leg.departureTime || leg.arrivalTime) && (
            <div className="text-muted-foreground">
              {[leg.departureTime, leg.arrivalTime].filter(Boolean).join(' – ')}
            </div>
          )}
        </div>
      ))}

      {flight.price != null && (
        <p className="text-sm text-muted-foreground">
          Prix : {flight.price}
          {flight.currency ?? '€'}
        </p>
      )}
      <SheetNote icon={StickyNote}>{flight.notes}</SheetNote>
      {flight.airportLocation && <FocusPill onClick={() => onFocus(flight.airportLocation)} />}
    </div>
  );
}

function DayContent({
  trip,
  date,
  onOpenStage,
  onOpenPlace,
  onOpenFlight,
  onFocus,
}: {
  trip: Trip;
  date: string;
  onOpenStage: (stageId: string) => void;
  onOpenPlace: (stageId: string, placeId: string) => void;
  onOpenFlight: (side: FlightSide) => void;
  onFocus: (location?: LatLng) => void;
}) {
  const day = buildItinerary(trip).find((d) => d.date === date);

  const program = (day
    ? [
        ...day.flights.map((f) => ({
          key: `flight-${f.side}`,
          time: f.flight.legs[0]?.departureTime,
          emoji: '✈️',
          label: f.side === 'outbound' ? 'Vol aller' : 'Vol retour',
          travel: true,
          onClick: () => onOpenFlight(f.side),
        })),
        ...day.legs.map((l) => ({
          key: `leg-${l.stage.id}`,
          time: l.leg.departureTime,
          emoji: TRANSPORT_MODES[l.leg.mode].emoji,
          label: `${l.stage.name}${l.nextStage ? ` → ${l.nextStage.name}` : ''}`,
          travel: true,
          onClick: () => onOpenStage(l.stage.id),
        })),
        ...day.places.map((p) => ({
          key: `place-${p.place.id}`,
          time: p.place.plannedTime,
          emoji: PLACE_CATEGORIES[p.place.category].emoji,
          label: p.place.name,
          travel: false,
          onClick: () => onOpenPlace(p.stage.id, p.place.id),
        })),
      ].sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'))
    : []) as { key: string; time?: string; emoji: string; label: string; travel: boolean; onClick: () => void }[];

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl text-white"
          style={{ background: day?.stage?.color ?? '#64748b' }}
        >
          🗓️
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-bold capitalize leading-tight">
            {formatLongDate(date)}
          </h2>
          <p className="truncate text-xs text-muted-foreground">
            {day?.stage ? day.stage.name : 'En transit'}
          </p>
        </div>
        {day?.stage?.accommodation?.location && (
          <button
            onClick={() => onFocus(day.stage!.accommodation!.location)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-primary hover:bg-muted"
            title="Sur la carte"
          >
            <Locate className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Programme du jour ({program.length})</h3>
        {program.length > 0 ? (
          program.map((item) => (
            <button
              key={item.key}
              onClick={item.onClick}
              className={cn(
                'flex w-full items-start gap-2.5 rounded-xl border bg-card p-2.5 text-left transition-colors hover:bg-muted',
                item.travel ? 'border-dashed border-border' : 'border-border',
              )}
            >
              <span className="w-11 shrink-0 pt-0.5 text-xs font-semibold tabular-nums text-primary">
                {item.time ?? '—'}
              </span>
              <span className="shrink-0 text-xl leading-tight">{item.emoji}</span>
              <span className="min-w-0 flex-1 break-words text-sm font-medium">{item.label}</span>
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            {day?.stage ? `Journée libre à ${day.stage.name}.` : 'Rien de planifié ce jour.'}
          </p>
        )}
      </div>

      {/* Hébergement = fin de journée */}
      {day?.stage && (
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold">Nuit</h3>
          <button
            onClick={() => onOpenStage(day.stage!.id)}
            className="flex w-full items-start gap-3 rounded-xl border border-border bg-muted/40 p-3 text-left transition-colors hover:bg-muted"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
              style={{ background: day.stage.color }}
            >
              {day.stage.emoji ?? '🛏️'}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block break-words text-sm font-semibold">{day.stage.name}</span>
              {day.stage.accommodation?.name && (
                <span className="block break-words text-xs text-muted-foreground">
                  🛏️ {day.stage.accommodation.name}
                </span>
              )}
            </span>
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </div>
      )}
    </div>
  );
}

export function MobileTripView({
  trip,
  isAdmin,
  saveStatus,
  mapSelection,
  placingMode,
  focusTarget,
  viewMode,
  mutate,
  onToggleView,
  onOpenSettings,
  onSelectStage,
  onSelectPlace,
  onSelectLeg,
  onSelectFlight,
  onMapClick,
}: MobileTripViewProps) {
  const [snap, setSnap] = useState<SheetSnap>('half');
  const [addOpen, setAddOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [mapFocus, setMapFocus] = useState<
    { location: LatLng; nonce: number; bottomInset?: number } | null | undefined
  >(focusTarget);

  const days = useMemo(() => buildItinerary(trip), [trip]);

  const defaultActive = useMemo<Active>(() => {
    if (viewMode === 'days') return days[0] ? { type: 'day', date: days[0].date } : null;
    if (trip.stages[0]) return { type: 'stage', id: trip.stages[0].id };
    if (trip.outboundFlight) return { type: 'flight', side: 'outbound' };
    return null;
  }, [viewMode, days, trip.stages, trip.outboundFlight]);
  const [active, setActive] = useState<Active>(defaultActive);

  // Au changement de vue (jour ↔ étape), repartir sur l'élément par défaut.
  useEffect(() => {
    setActive(defaultActive);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  // Recentre la sélection si l'étape/le lieu actif disparaît.
  useEffect(() => {
    const stageId =
      active?.type === 'stage' ? active.id : active?.type === 'place' ? active.stageId : null;
    if (stageId && !trip.stages.some((s) => s.id === stageId)) {
      setActive(defaultActive);
    }
  }, [trip.stages, active, defaultActive]);

  // Suit les demandes de focus émises par les boutons « Focus » des modales.
  useEffect(() => {
    if (!focusTarget) return;
    setSnap('peek');
    setMapFocus({
      location: focusTarget.location,
      nonce: focusTarget.nonce,
      bottomInset: Math.round(window.innerHeight * 0.22),
    });
  }, [focusTarget]);

  // Laisse voir la carte quand on place un point.
  useEffect(() => {
    if (placingMode) setSnap('peek');
  }, [placingMode]);

  // Hauteur du sheet selon le cran → padding bas pour ne pas masquer le point.
  const sheetInset = (s: SheetSnap) =>
    Math.round(window.innerHeight * (s === 'full' ? 0.9 : s === 'half' ? 0.5 : 0.22));
  const flyTo = (loc: LatLng | undefined, insetSnap: SheetSnap) => {
    if (!loc) return;
    setMapFocus({ location: loc, nonce: Date.now(), bottomInset: sheetInset(insetSnap) });
  };
  // Bouton « Sur la carte » : replie le sheet pour bien voir le point.
  const focusOnMap = (loc?: LatLng) => {
    setSnap('peek');
    flyTo(loc, 'peek');
  };

  const handleAddStage = () => {
    const stage = createStage(trip.stages.length);
    mutate((t) => addStage(t, stage));
    setActive({ type: 'stage', id: stage.id });
    onSelectStage(stage.id);
  };

  const stageLoc = (id: string) => trip.stages.find((s) => s.id === id)?.accommodation?.location;
  const placeLoc = (stageId: string, placeId: string) =>
    trip.stages.find((s) => s.id === stageId)?.places.find((p) => p.id === placeId)?.location;
  const flightLoc = (side: FlightSide) =>
    (side === 'outbound' ? trip.outboundFlight : trip.returnFlight)?.airportLocation;

  // Sélection depuis le rail OU la carte : recadre la carte + montre le détail en bas.
  const pickStage = (id: string) => {
    setActive({ type: 'stage', id });
    setSnap('half');
    flyTo(stageLoc(id), 'half');
  };
  const pickPlace = (stageId: string, placeId: string) => {
    setActive({ type: 'place', stageId, placeId });
    setSnap('half');
    flyTo(placeLoc(stageId, placeId), 'half');
  };
  const pickFlight = (side: FlightSide) => {
    setActive({ type: 'flight', side });
    setSnap('half');
    flyTo(flightLoc(side), 'half');
  };
  const pickDay = (date: string) => {
    setActive({ type: 'day', date });
    setSnap('half');
    const base = days.find((d) => d.date === date)?.stage?.accommodation?.location;
    flyTo(base, 'half');
  };

  const activeStage =
    active?.type === 'stage' ? trip.stages.find((s) => s.id === active.id) : undefined;
  const activePlaceStage =
    active?.type === 'place' ? trip.stages.find((s) => s.id === active.stageId) : undefined;
  const activePlace =
    active?.type === 'place'
      ? activePlaceStage?.places.find((p) => p.id === active.placeId)
      : undefined;
  const activeFlight =
    active?.type === 'flight'
      ? active.side === 'outbound'
        ? trip.outboundFlight
        : trip.returnFlight
      : undefined;

  // Mobile : les taps sur la carte pilotent toujours le bottom sheet (jamais de modale).
  const mapHandlers = {
    onSelectStage: (id: string) => pickStage(id),
    onSelectPlace: (stageId: string, placeId: string) => pickPlace(stageId, placeId),
    onSelectLeg: (stageId: string) => pickStage(stageId),
    onSelectFlight: (side: FlightSide) => pickFlight(side),
  };

  const activeStageId =
    active?.type === 'stage'
      ? active.id
      : active?.type === 'place'
        ? active.stageId
        : active?.type === 'day'
          ? (days.find((d) => d.date === active.date)?.stage?.id ?? null)
          : null;
  const selectedStageId = mapSelection.selectedStageId ?? activeStageId;
  const selectedPlaceId =
    mapSelection.selectedPlaceId ?? (active?.type === 'place' ? active.placeId : null);
  const selectedFlight = mapSelection.selectedFlight ?? (active?.type === 'flight' ? active.side : null);

  return (
    <div className="relative h-full overflow-hidden">
      {/* Carte plein écran */}
      <div className="absolute inset-0">
        <TripMap
          trip={trip}
          selectedStageId={selectedStageId}
          selectedPlaceId={selectedPlaceId}
          selectedLegStageId={mapSelection.selectedLegStageId}
          selectedFlight={selectedFlight}
          placingMode={placingMode}
          focusTarget={mapFocus}
          onMapClick={onMapClick}
          {...mapHandlers}
        />
      </div>

      {/* Barre supérieure flottante */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-[950] flex items-center gap-2 p-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="pointer-events-auto flex min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-card/90 px-3 py-2 shadow-sm backdrop-blur">
          <Link to="/" className="text-muted-foreground" aria-label="Retour">
            ←
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-bold leading-tight">{trip.title}</h1>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              {isAdmin ? (
                <>
                  <Pencil className="h-2.5 w-2.5" />
                  {saveStatus === 'saving'
                    ? 'Enregistrement…'
                    : saveStatus === 'error'
                      ? 'Erreur de sauvegarde'
                      : 'Édition'}
                </>
              ) : (
                <>
                  <Eye className="h-2.5 w-2.5" /> Lecture seule
                </>
              )}
            </span>
          </div>
        </div>
        <div className="pointer-events-auto flex items-center rounded-full border border-border bg-card/90 shadow-sm backdrop-blur">
          <button
            onClick={onToggleView}
            className="flex h-9 w-9 items-center justify-center text-foreground"
            title={viewMode === 'stages' ? 'Vue par jour' : 'Vue par étape'}
          >
            {viewMode === 'stages' ? (
              <CalendarDays className="h-4 w-4" />
            ) : (
              <ListIcon className="h-4 w-4" />
            )}
          </button>
          {isAdmin && (
            <button
              onClick={() => setBudgetOpen(true)}
              className="flex h-9 w-9 items-center justify-center text-foreground"
              title="Budget"
            >
              <Wallet className="h-4 w-4" />
            </button>
          )}
          {isAdmin && (
            <button
              onClick={onOpenSettings}
              className="flex h-9 w-9 items-center justify-center text-foreground"
              title="Paramètres du voyage"
            >
              <Settings className="h-4 w-4" />
            </button>
          )}
          <ThemeToggle />
          <div className="flex h-9 w-9 items-center justify-center">
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Bottom sheet : rail + détail de l'élément actif */}
      <MobileSheet
        snap={snap}
        onSnapChange={setSnap}
        rail={
          <div className="flex gap-2 overflow-x-auto px-4 pb-3 pt-0.5 scroll-thin">
            {viewMode === 'days' ? (
              days.map((d, i) => (
                <RailPill
                  key={d.date}
                  color={d.stage?.color}
                  active={active?.type === 'day' && active.date === d.date}
                  onClick={() => pickDay(d.date)}
                >
                  <span>J{i + 1}</span>
                  {formatShortDate(d.date)}
                </RailPill>
              ))
            ) : (
              <>
                {(trip.outboundFlight || isAdmin) && (
                  <RailPill
                    active={active?.type === 'flight' && active.side === 'outbound'}
                    onClick={() => pickFlight('outbound')}
                  >
                    ✈️ Aller
                  </RailPill>
                )}
                {trip.stages.map((s, i) => (
                  <RailPill
                    key={s.id}
                    color={s.color}
                    active={
                      (active?.type === 'stage' && active.id === s.id) ||
                      (active?.type === 'place' && active.stageId === s.id)
                    }
                    onClick={() => pickStage(s.id)}
                  >
                    <span>{s.emoji ?? i + 1}</span>
                    {s.name}
                  </RailPill>
                ))}
                {(trip.returnFlight || isAdmin) && (
                  <RailPill
                    active={active?.type === 'flight' && active.side === 'return'}
                    onClick={() => pickFlight('return')}
                  >
                    ✈️ Retour
                  </RailPill>
                )}
                {isAdmin && (
                  <RailPill active={false} onClick={handleAddStage}>
                    <Plus className="h-3.5 w-3.5" /> Étape
                  </RailPill>
                )}
              </>
            )}
          </div>
        }
      >
        {active?.type === 'day' ? (
          <DayContent
            trip={trip}
            date={active.date}
            onOpenStage={(stageId) => pickStage(stageId)}
            onOpenPlace={(stageId, placeId) => pickPlace(stageId, placeId)}
            onOpenFlight={(side) => pickFlight(side)}
            onFocus={(loc) => focusOnMap(loc)}
          />
        ) : activePlace && activePlaceStage ? (
          <PlaceContent
            stage={activePlaceStage}
            place={activePlace}
            isAdmin={isAdmin}
            onBack={() => setActive({ type: 'stage', id: activePlaceStage.id })}
            onEdit={() => onSelectPlace(activePlaceStage.id, activePlace.id)}
            onToggleVisited={() =>
              mutate((t) =>
                updatePlace(t, activePlaceStage.id, activePlace.id, { visited: !activePlace.visited }),
              )
            }
            onFocus={(loc) => focusOnMap(loc)}
          />
        ) : activeStage ? (
          <StageContent
            trip={trip}
            stage={activeStage}
            isAdmin={isAdmin}
            onEditStage={() => onSelectStage(activeStage.id)}
            onOpenPlace={(placeId) => pickPlace(activeStage.id, placeId)}
            onAddPlace={() => setAddOpen(true)}
            onEditLeg={() => onSelectLeg(activeStage.id)}
            onAddLeg={() => {
              mutate((t) => setTransportLeg(t, activeStage.id, createTransport()));
              onSelectLeg(activeStage.id);
            }}
            onToggleVisited={(placeId, visited) =>
              mutate((t) => updatePlace(t, activeStage.id, placeId, { visited }))
            }
            onFocus={(loc) => focusOnMap(loc)}
          />
        ) : activeFlight && active?.type === 'flight' ? (
          <FlightContent
            side={active.side}
            flight={activeFlight}
            isAdmin={isAdmin}
            onEdit={() => onSelectFlight(active.side)}
            onFocus={(loc) => focusOnMap(loc)}
          />
        ) : (
          <p className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
            {isAdmin ? 'Ajoute ta première étape avec le bouton « Étape ».' : 'Ce voyage est vide.'}
          </p>
        )}
      </MobileSheet>

      {addOpen && (
        <QuickAddPlace
          trip={trip}
          defaultStageId={active?.type === 'stage' ? active.id : undefined}
          mutate={mutate}
          onClose={() => setAddOpen(false)}
        />
      )}

      <BudgetModal trip={trip} open={budgetOpen} onClose={() => setBudgetOpen(false)} />
    </div>
  );
}
