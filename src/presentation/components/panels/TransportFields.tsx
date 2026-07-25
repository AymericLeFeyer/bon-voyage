import { Calculator } from 'lucide-react';
import type { LatLng, Transport, TransportMode } from '@shared/types/trip';
import { TRANSPORT_MODES, TRANSPORT_MODE_OPTIONS } from '@/shared/constants/catalog';
import { haversineKm } from '@/shared/lib/geo';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { PriceField } from './PriceField';

interface TransportFieldsProps {
  transport: Transport;
  onPatch: (patch: Partial<Transport>) => void;
  /** Masque l'intitulé libre (jambe entre étapes où from/to suffisent). */
  hideLabel?: boolean;
  /** Extrémités géolocalisées : active le calcul auto de la distance. */
  from?: LatLng;
  to?: LatLng;
}

export function TransportFields({ transport, onPatch, hideLabel, from, to }: TransportFieldsProps) {
  const canCompute = Boolean(from && to);
  return (
    <div className="space-y-3">
      <Field label="Moyen de transport">
        <Select
          value={transport.mode}
          onChange={(e) => onPatch({ mode: e.target.value as TransportMode })}
        >
          {TRANSPORT_MODE_OPTIONS.map((key) => (
            <option key={key} value={key}>
              {TRANSPORT_MODES[key].emoji} {TRANSPORT_MODES[key].label}
            </option>
          ))}
        </Select>
      </Field>

      {!hideLabel && (
        <Field label="Intitulé">
          <Input
            value={transport.label}
            placeholder="Ex : Shinkansen Tokyo → Kyoto"
            onChange={(e) => onPatch({ label: e.target.value })}
          />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Field label="Départ">
          <Input
            value={transport.from ?? ''}
            placeholder="Gare / ville"
            onChange={(e) => onPatch({ from: e.target.value })}
          />
        </Field>
        <Field label="Arrivée">
          <Input
            value={transport.to ?? ''}
            placeholder="Gare / ville"
            onChange={(e) => onPatch({ to: e.target.value })}
          />
        </Field>
        <Field label="Date">
          <Input
            type="date"
            value={transport.date ?? ''}
            onChange={(e) => onPatch({ date: e.target.value })}
          />
        </Field>
        <Field label="Référence">
          <Input
            value={transport.reference ?? ''}
            placeholder="N° train / voie"
            onChange={(e) => onPatch({ reference: e.target.value })}
          />
        </Field>
        <Field label="Heure de départ">
          <Input
            type="time"
            value={transport.departureTime ?? ''}
            onChange={(e) => onPatch({ departureTime: e.target.value })}
          />
        </Field>
        <Field label="Heure d'arrivée">
          <Input
            type="time"
            value={transport.arrivalTime ?? ''}
            onChange={(e) => onPatch({ arrivalTime: e.target.value })}
          />
        </Field>
        <Field label="Distance (km)">
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              value={transport.distanceKm ?? ''}
              placeholder="0"
              onChange={(e) =>
                onPatch({ distanceKm: e.target.value === '' ? undefined : Number(e.target.value) })
              }
            />
            {canCompute && (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                title="Calculer la distance à vol d'oiseau entre les deux points"
                onClick={() => onPatch({ distanceKm: Math.round(haversineKm(from!, to!)) })}
              >
                <Calculator className="h-4 w-4" />
              </Button>
            )}
          </div>
        </Field>
      </div>

      <PriceField
        price={transport.price}
        currency={transport.currency}
        persons={transport.persons}
        onChange={onPatch}
      />

      <Field label="Notes">
        <Textarea
          value={transport.notes ?? ''}
          onChange={(e) => onPatch({ notes: e.target.value })}
        />
      </Field>
    </div>
  );
}
