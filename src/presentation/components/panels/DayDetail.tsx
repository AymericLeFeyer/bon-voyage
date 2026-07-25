import { useMemo } from 'react';
import { ChevronRight, MapPin } from 'lucide-react';
import type { Trip } from '@shared/types/trip';
import type { Selection } from '@/presentation/types';
import { PLACE_CATEGORIES, TRANSPORT_MODES } from '@/shared/constants/catalog';
import { buildItinerary } from '@/shared/lib/itinerary';
import { travelCopy } from '@/shared/constants/travel';
import { formatLongDate } from '@/shared/lib/date';
import { cn } from '@/shared/lib/cn';
import { DetailHeader } from '../details/parts';

interface DayDetailProps {
  trip: Trip;
  date: string;
  /** Sélection du tiroir enfant → surligne l'item ouvert du programme. */
  childSelection?: Selection;
  /** Empile un nouveau tiroir (lieu, transport, vol, étape) par-dessus la journée. */
  onPush: (sel: NonNullable<Selection>) => void;
  onFocus?: () => void;
  onClose?: () => void;
}

interface ProgramItem {
  key: string;
  time?: string;
  emoji: string;
  label: string;
  sub?: string;
  /** `travel` (vols/trajets) = bordure en pointillés ; `place` = lieu à visiter. */
  variant: 'travel' | 'place';
  /** L'item est ouvert dans le tiroir enfant → surligné. */
  selected: boolean;
  onClick: () => void;
}

/** Ligne cliquable du programme d'une journée (texte à la ligne = cliquable même étroit). */
function ProgramRow({ item }: { item: ProgramItem }) {
  return (
    <li>
      <button
        type="button"
        onClick={item.onClick}
        className={cn(
          'flex w-full items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors',
          item.variant === 'travel' && 'border-dashed',
          item.selected
            ? 'border-primary bg-primary/5'
            : cn('border-border hover:bg-muted'),
        )}
      >
        <span className="w-11 shrink-0 pt-0.5 text-xs font-semibold tabular-nums text-primary">
          {item.time ?? '—'}
        </span>
        <span className="shrink-0 text-lg leading-tight">{item.emoji}</span>
        <span className="min-w-0 flex-1">
          <span className="block break-words text-sm font-medium">{item.label}</span>
          {item.sub && <span className="block break-words text-xs text-muted-foreground">{item.sub}</span>}
        </span>
        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
    </li>
  );
}

/**
 * Vue détail d'une journée (mode « vue par jour »). Un seul programme
 * chronologique fusionnant vols, **transports (= étapes à faire du jour)** et
 * lieux planifiés. Chaque item empile un tiroir (`onPush`).
 */
export function DayDetail({ trip, date, childSelection, onPush, onFocus, onClose }: DayDetailProps) {
  const day = useMemo(() => buildItinerary(trip).find((d) => d.date === date), [trip, date]);

  const program = useMemo<ProgramItem[]>(() => {
    if (!day) return [];
    const items: ProgramItem[] = [];

    // `day.flights` est déjà vide quand le mode de trajet est « non défini ».
    const travel = travelCopy(trip);
    for (const f of day.flights) {
      items.push({
        key: `flight-${f.side}`,
        time: f.flight.legs[0]?.departureTime,
        emoji: travel?.emoji ?? '✈️',
        label: travel?.label[f.side] ?? 'Trajet',
        sub: f.flight.airport,
        variant: 'travel',
        selected: childSelection?.kind === 'flight' && childSelection.side === f.side,
        onClick: () => onPush({ kind: 'flight', side: f.side }),
      });
    }
    for (const l of day.legs) {
      items.push({
        key: `leg-${l.stage.id}`,
        time: l.leg.departureTime,
        emoji: TRANSPORT_MODES[l.leg.mode].emoji,
        label: `${l.stage.name}${l.nextStage ? ` → ${l.nextStage.name}` : ''}`,
        sub: [l.leg.from, l.leg.to].filter(Boolean).join(' → ') || undefined,
        variant: 'travel',
        selected: childSelection?.kind === 'leg' && childSelection.stageId === l.stage.id,
        onClick: () => onPush({ kind: 'leg', stageId: l.stage.id }),
      });
    }
    for (const p of day.places) {
      items.push({
        key: `place-${p.place.id}`,
        time: p.place.plannedTime,
        emoji: PLACE_CATEGORIES[p.place.category].emoji,
        label: p.place.name,
        sub: p.place.address,
        variant: 'place',
        selected: childSelection?.kind === 'place' && childSelection.placeId === p.place.id,
        onClick: () => onPush({ kind: 'place', stageId: p.stage.id, placeId: p.place.id }),
      });
    }

    return items.sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'));
  }, [trip, day, childSelection, onPush]);

  return (
    <div className="flex min-h-0 flex-col">
      <DetailHeader
        onFocus={onFocus}
        onClose={onClose}
        title={<span className="truncate capitalize">🗓️ {formatLongDate(date)}</span>}
      />

      <div className="flex-1 min-h-0 space-y-4 overflow-y-auto p-4 scroll-thin">
        {day?.arrivalStage && day.arrivalStage.id !== day.stage?.id && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0 text-primary" /> Arrivée à {day.arrivalStage.name}
          </div>
        )}

        {/* Programme du jour (vols + transports + lieux) */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Programme du jour ({program.length})</h3>
          {program.length > 0 ? (
            <ul className="space-y-1.5">
              {program.map((item) => (
                <ProgramRow key={item.key} item={item} />
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
              {day?.stage ? `Journée libre à ${day.stage.name}.` : 'Rien de planifié ce jour.'}
            </p>
          )}
        </div>

        {/* Hébergement = fin de journée (là où l'on dort ce soir) */}
        {day?.stage && (
          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold">Nuit</h3>
            <button
              type="button"
              onClick={() => onPush({ kind: 'stage', stageId: day.stage!.id })}
              className={cn(
                'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                childSelection?.kind === 'stage' && childSelection.stageId === day.stage.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-muted/40 hover:bg-muted',
              )}
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ background: day.stage.color }}
              >
                {day.stage.emoji ?? trip.stages.findIndex((s) => s.id === day.stage!.id) + 1}
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
    </div>
  );
}
