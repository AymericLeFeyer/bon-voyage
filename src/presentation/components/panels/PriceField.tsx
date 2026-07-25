import { CURRENCIES } from '@/shared/constants/catalog';
import { Field } from '../ui/Field';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';

interface PriceFieldProps {
  price?: number;
  currency?: string;
  persons?: number;
  /** Devise par défaut si aucune n'est saisie (l'euro sert de référence au budget). */
  defaultCurrency?: string;
  /** Libellé du champ prix. */
  label?: string;
  onChange: (patch: { price?: number; currency?: string; persons?: number }) => void;
}

/**
 * Bloc de saisie d'un prix : montant + devise + nombre de personnes.
 * Réutilisé pour les vols, hébergements, transports et lieux — le nombre de
 * personnes permet d'afficher le budget total ou par personne.
 */
export function PriceField({
  price,
  currency,
  persons,
  defaultCurrency = '€',
  label = 'Prix à prévoir',
  onChange,
}: PriceFieldProps) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-2">
      <Field label={label}>
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            value={price ?? ''}
            placeholder="0"
            onChange={(e) =>
              onChange({ price: e.target.value === '' ? undefined : Number(e.target.value) })
            }
          />
          <Select
            value={currency ?? defaultCurrency}
            className="w-20"
            onChange={(e) => onChange({ currency: e.target.value })}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      </Field>
      <Field label="Personnes">
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          value={persons ?? ''}
          placeholder="1"
          className="w-20 text-center"
          onChange={(e) =>
            onChange({ persons: e.target.value === '' ? undefined : Number(e.target.value) })
          }
        />
      </Field>
    </div>
  );
}
