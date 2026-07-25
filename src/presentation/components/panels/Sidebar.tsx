import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  Check,
  Cloud,
  CloudOff,
  List,
  Loader2,
  Plus,
  Settings,
  Wallet,
} from 'lucide-react';
import type { Flight, Trip } from '@shared/types/trip';
import { TRANSPORT_MODES } from '@/shared/constants/catalog';
import { createStage, createTransport } from '@/domain/trip/services/tripFactory';
import { addStage, patchTrip, setTransportLeg } from '@/domain/trip/services/tripMutations';
import type { FlightSide } from '@/domain/trip/services/tripMutations';
import { formatTransportSummary } from '@/shared/lib/transport';
import { formatShortDate } from '@/shared/lib/date';
import { buildItinerary } from '@/shared/lib/itinerary';
import type { SaveStatus } from '@/presentation/hooks/useTrip';
import type { Selection } from '@/presentation/types';
import { cn } from '@/shared/lib/cn';
import { Button } from '../ui/Button';
import { ThemeToggle } from '../ThemeToggle';
import { UserMenu } from '../UserMenu';
import { BudgetModal } from './BudgetModal';

interface SidebarProps {
  trip: Trip;
  selection: Selection;
  saveStatus: SaveStatus;
  isAdmin: boolean;
  viewMode: 'stages' | 'days';
  mutate: (updater: (trip: Trip) => Trip) => void;
  onToggleView: () => void;
  onOpenSettings: () => void;
  onSelectStage: (stageId: string) => void;
  onSelectLeg: (stageId: string) => void;
  onSelectFlight: (side: FlightSide) => void;
  onSelectDay: (date: string) => void;
}

/** Entrée « Vol aller / retour », rendue comme une étape bout de voyage. */
function FlightRow({
  side,
  flight,
  active,
  isAdmin,
  onSelect,
}: {
  side: FlightSide;
  flight?: Flight;
  active: boolean;
  isAdmin: boolean;
  onSelect: (side: FlightSide) => void;
}) {
  if (!flight && !isAdmin) return null;
  const label = side === 'outbound' ? 'Vol aller' : 'Vol retour';
  return (
    <button
      onClick={() => onSelect(side)}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors',
        active
          ? 'border-primary bg-primary/5'
          : flight
            ? 'border-border hover:bg-muted'
            : 'border-dashed border-border text-muted-foreground hover:bg-muted',
      )}
    >
      <span className="text-lg">✈️</span>
      <div className="min-w-0 flex-1">
        <div className="font-medium">{label}</div>
        {flight?.airport ? (
          <div className="truncate text-xs text-muted-foreground">{flight.airport}</div>
        ) : (
          isAdmin && <div className="text-xs text-muted-foreground">Ajouter</div>
        )}
      </div>
    </button>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  const map = {
    idle: { icon: <Cloud className="h-3.5 w-3.5" />, text: 'Synchronisé', cls: 'text-muted-foreground' },
    saving: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, text: 'Enregistrement…', cls: 'text-muted-foreground' },
    saved: { icon: <Check className="h-3.5 w-3.5" />, text: 'Enregistré', cls: 'text-green-600' },
    error: { icon: <CloudOff className="h-3.5 w-3.5" />, text: 'Erreur de sauvegarde', cls: 'text-red-600' },
  }[status];
  return (
    <span className={cn('flex items-center gap-1 text-xs', map.cls)}>
      {map.icon}
      {map.text}
    </span>
  );
}

export function Sidebar({
  trip,
  selection,
  saveStatus,
  isAdmin,
  viewMode,
  mutate,
  onToggleView,
  onOpenSettings,
  onSelectStage,
  onSelectLeg,
  onSelectFlight,
  onSelectDay,
}: SidebarProps) {
  const [budgetOpen, setBudgetOpen] = useState(false);

  const handleAddStage = () => {
    const stage = createStage(trip.stages.length);
    mutate((t) => addStage(t, stage));
    onSelectStage(stage.id);
  };

  const handleAddLeg = (stageId: string) => {
    mutate((t) => setTransportLeg(t, stageId, createTransport()));
    onSelectLeg(stageId);
  };

  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col border-r border-border bg-card">
      <div className="space-y-2 border-b border-border p-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
            ← Mes voyages
          </Link>
          <div className="flex items-center gap-1">
            {isAdmin && <SaveIndicator status={saveStatus} />}
            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                title="Paramètres du voyage"
                onClick={onOpenSettings}
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {trip.emoji && <span className="shrink-0 text-xl leading-none">{trip.emoji}</span>}
          {isAdmin ? (
            <input
              value={trip.title}
              onChange={(e) => mutate((t) => patchTrip(t, { title: e.target.value }))}
              className="w-full bg-transparent text-lg font-bold outline-none focus:ring-0"
              placeholder="Titre du voyage"
            />
          ) : (
            <h1 className="text-lg font-bold">{trip.title}</h1>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            title={viewMode === 'stages' ? 'Basculer en vue par jour' : 'Basculer en vue par étape'}
            onClick={onToggleView}
          >
            {viewMode === 'stages' ? (
              <>
                <CalendarDays className="h-3.5 w-3.5" /> Vue par jour
              </>
            ) : (
              <>
                <List className="h-3.5 w-3.5" /> Vue par étape
              </>
            )}
          </Button>
          {isAdmin && (
            <Button
              variant="secondary"
              size="sm"
              title="Budget du voyage"
              onClick={() => setBudgetOpen(true)}
            >
              <Wallet className="h-3.5 w-3.5" /> Budget
            </Button>
          )}
        </div>
      </div>

      <BudgetModal trip={trip} open={budgetOpen} onClose={() => setBudgetOpen(false)} />

      {viewMode === 'days' ? (
        <DayList trip={trip} selection={selection} onSelectDay={onSelectDay} />
      ) : (
      <div className="flex-1 space-y-2 overflow-y-auto p-3 scroll-thin">
        <FlightRow
          side="outbound"
          flight={trip.outboundFlight}
          active={selection?.kind === 'flight' && selection.side === 'outbound'}
          isAdmin={isAdmin}
          onSelect={onSelectFlight}
        />

        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Étapes
          </h2>
          {isAdmin && (
            <button
              onClick={handleAddStage}
              className="text-muted-foreground hover:text-foreground"
              title="Ajouter une étape"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>

        {trip.stages.map((stage, index) => {
          const active = selection?.kind === 'stage' && selection.stageId === stage.id;
          const legActive = selection?.kind === 'leg' && selection.stageId === stage.id;
          const leg = stage.transportToNext;
          const isLast = index === trip.stages.length - 1;
          return (
            <Fragment key={stage.id}>
              <button
                onClick={() => onSelectStage(stage.id)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                  active ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted',
                )}
              >
                <span
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ background: stage.color }}
                >
                  {stage.emoji ?? index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{stage.name}</div>
                  {stage.accommodation?.name && (
                    <div className="truncate text-xs text-muted-foreground">
                      🛏️ {stage.accommodation.name}
                    </div>
                  )}
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {stage.places.length} lieu{stage.places.length > 1 ? 'x' : ''} à visiter
                  </div>
                </div>
              </button>

              {/* Connecteur de transport vers l'étape suivante */}
              {!isLast && (
                <div className="flex items-center gap-2 pl-[26px]">
                  <div className="h-5 w-px shrink-0 bg-border" />
                  {leg ? (
                    <button
                      onClick={() => onSelectLeg(stage.id)}
                      className={cn(
                        'flex min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
                        legActive ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted',
                      )}
                    >
                      <span>{TRANSPORT_MODES[leg.mode].emoji}</span>
                      <span className="truncate text-muted-foreground">
                        {formatTransportSummary(leg) || TRANSPORT_MODES[leg.mode].label}
                      </span>
                    </button>
                  ) : isAdmin ? (
                    <button
                      onClick={() => handleAddLeg(stage.id)}
                      className="flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
                    >
                      <Plus className="h-3 w-3" /> transport
                    </button>
                  ) : null}
                </div>
              )}
            </Fragment>
          );
        })}

        {trip.stages.length === 0 && (
          <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            {isAdmin ? 'Aucune étape. Ajoute ta première étape.' : 'Aucune étape pour ce voyage.'}
          </p>
        )}

        <FlightRow
          side="return"
          flight={trip.returnFlight}
          active={selection?.kind === 'flight' && selection.side === 'return'}
          isAdmin={isAdmin}
          onSelect={onSelectFlight}
        />
      </div>
      )}
    </aside>
  );
}

/** Liste des journées (vue par jour). */
function DayList({
  trip,
  selection,
  onSelectDay,
}: {
  trip: Trip;
  selection: Selection;
  onSelectDay: (date: string) => void;
}) {
  const days = buildItinerary(trip);
  if (days.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-3 scroll-thin">
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
          Renseigne des dates (séjours, vols, créneaux) pour voir le voyage jour par jour.
        </p>
      </div>
    );
  }
  return (
    <div className="flex-1 space-y-2 overflow-y-auto p-3 scroll-thin">
      {days.map((day, index) => {
        const active = selection?.kind === 'day' && selection.date === day.date;
        const count = day.flights.length + day.legs.length + day.places.length;
        return (
          <button
            key={day.date}
            onClick={() => onSelectDay(day.date)}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors',
              active ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted',
            )}
          >
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ background: day.stage?.color ?? '#64748b' }}
            >
              J{index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium capitalize">{formatShortDate(day.date)}</div>
              <div className="truncate text-xs text-muted-foreground">
                {day.stage ? day.stage.name : 'En transit'}
                {count > 0 && ` · ${count} élément${count > 1 ? 's' : ''}`}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
