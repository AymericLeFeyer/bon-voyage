import { Crosshair, Plus, Trash2, X } from 'lucide-react';
import type { Flight, Trip } from '@shared/types/trip';
import { createFlightLeg } from '@/domain/trip/services/tripFactory';
import {
  addFlightLeg,
  removeFlight,
  removeFlightLeg,
  setFlight,
  updateFlightLeg,
  type FlightSide,
} from '@/domain/trip/services/tripMutations';
import type { PlacingTarget } from '@/presentation/types';
import type { TravelCopy } from '@/shared/constants/travel';
import { cn } from '@/shared/lib/cn';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { AddressAutocomplete } from '../AddressAutocomplete';
import { FocusButton } from '../details/parts';
import { PriceField } from './PriceField';

interface FlightEditorProps {
  side: FlightSide;
  flight: Flight;
  /** Libellés du mode de trajet du voyage (avion ou train). */
  copy: TravelCopy;
  placingTarget: PlacingTarget;
  mutate: (updater: (trip: Trip) => Trip) => void;
  setPlacingTarget: (target: PlacingTarget) => void;
  onFocus?: () => void;
  onClose: () => void;
}

export function FlightEditor({
  side,
  flight,
  copy,
  placingTarget,
  mutate,
  setPlacingTarget,
  onFocus,
  onClose,
}: FlightEditorProps) {
  const placing = placingTarget?.kind === 'flightAirport' && placingTarget.side === side;
  const set = (patch: Partial<Flight>) => mutate((t) => setFlight(t, side, patch));

  return (
    <div className="flex min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-semibold">{copy.title[side]}</h2>
        <div className="flex items-center gap-1">
          {onFocus && <FocusButton onClick={onFocus} />}
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 min-h-0 space-y-4 overflow-y-auto p-4 scroll-thin">
        <p className="text-xs text-muted-foreground">
          {copy.mapHint}
        </p>

        <div className="space-y-2">
          <Field label={copy.hubLabel[side]}>
            <AddressAutocomplete
              value={flight.airport ?? ''}
              placeholder={copy.hubPlaceholder}
              onChange={(text) => set({ airport: text })}
              onSelect={(s) => set({ airport: s.label, airportLocation: s.location })}
            />
          </Field>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={placing ? 'primary' : 'secondary'}
              onClick={() =>
                setPlacingTarget(placing ? null : { kind: 'flightAirport', side })
              }
              className={cn(placing && 'ring-2 ring-ring')}
            >
              <Crosshair className="h-3.5 w-3.5" />
              {placing ? 'Clique sur la carte…' : 'Placer sur la carte'}
            </Button>
            {flight.airportLocation && (
              <span className="text-xs text-muted-foreground">
                {flight.airportLocation.lat.toFixed(4)}, {flight.airportLocation.lng.toFixed(4)}
              </span>
            )}
          </div>
        </div>

        <Field label="Date">
          <Input
            type="date"
            value={flight.date ?? ''}
            onChange={(e) => set({ date: e.target.value })}
          />
        </Field>

        {/* --- Segments / correspondances --- */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{copy.segmentsTitle} ({flight.legs.length})</h3>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => mutate((t) => addFlightLeg(t, side, createFlightLeg()))}
            >
              <Plus className="h-3.5 w-3.5" /> Segment
            </Button>
          </div>

          {flight.legs.map((leg, index) => (
            <div key={leg.id} className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Segment {index + 1}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-600"
                  onClick={() => mutate((t) => removeFlightLeg(t, side, leg.id))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Field label={copy.numberLabel}>
                <Input
                  value={leg.flightNumber ?? ''}
                  placeholder={copy.numberPlaceholder}
                  onChange={(e) =>
                    mutate((t) => updateFlightLeg(t, side, leg.id, { flightNumber: e.target.value }))
                  }
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Départ">
                  <Input
                    value={leg.from ?? ''}
                    placeholder={copy.endpointPlaceholder}
                    onChange={(e) =>
                      mutate((t) => updateFlightLeg(t, side, leg.id, { from: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Arrivée">
                  <Input
                    value={leg.to ?? ''}
                    placeholder={copy.endpointPlaceholder}
                    onChange={(e) =>
                      mutate((t) => updateFlightLeg(t, side, leg.id, { to: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Heure de départ">
                  <Input
                    type="time"
                    value={leg.departureTime ?? ''}
                    onChange={(e) =>
                      mutate((t) =>
                        updateFlightLeg(t, side, leg.id, { departureTime: e.target.value }),
                      )
                    }
                  />
                </Field>
                <Field label="Heure d'arrivée">
                  <Input
                    type="time"
                    value={leg.arrivalTime ?? ''}
                    onChange={(e) =>
                      mutate((t) =>
                        updateFlightLeg(t, side, leg.id, { arrivalTime: e.target.value }),
                      )
                    }
                  />
                </Field>
              </div>
            </div>
          ))}

          {flight.legs.length === 0 && (
            <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
              Aucun segment.
            </p>
          )}
        </section>

        <PriceField
          price={flight.price}
          currency={flight.currency}
          persons={flight.persons}
          onChange={set}
        />

        <Field label="Notes">
          <Textarea
            value={flight.notes ?? ''}
            placeholder={copy.notesPlaceholder}
            onChange={(e) => set({ notes: e.target.value })}
          />
        </Field>

        <Button
          variant="danger"
          className="w-full"
          onClick={() => {
            mutate((t) => removeFlight(t, side));
            onClose();
          }}
        >
          <Trash2 className="h-4 w-4" /> {copy.removeLabel}
        </Button>
      </div>
    </div>
  );
}
