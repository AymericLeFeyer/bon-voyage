import { useMemo, useState } from 'react';
import type { Trip } from '@shared/types/trip';
import {
  computeBudget,
  formatEur,
  formatMoney,
  fromEur,
  DEFAULT_RATES,
  type BudgetCategory,
  type Rates,
} from '@/shared/lib/budget';
import { travelCopy } from '@/shared/constants/travel';
import { Modal } from '../ui/Modal';
import { DetailHeader } from '../details/parts';
import { Input } from '../ui/Input';

const RATES_KEY = 'trip-visualizer.rates';
/** Ancienne clé (taux yen unique) — migrée au premier chargement. */
const LEGACY_JPY_KEY = 'trip-visualizer.jpyRate';

function loadRates(): Rates {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_RATES };
  const rates: Rates = { ...DEFAULT_RATES };
  const legacy = Number(localStorage.getItem(LEGACY_JPY_KEY));
  if (Number.isFinite(legacy) && legacy > 0) rates['¥'] = legacy;
  try {
    const raw = localStorage.getItem(RATES_KEY);
    if (raw) {
      for (const [currency, value] of Object.entries(JSON.parse(raw) as Rates)) {
        if (Number.isFinite(value) && value > 0) rates[currency] = value;
      }
    }
  } catch {
    // Stockage illisible : on garde les taux par défaut.
  }
  return rates;
}

const CATEGORY_META: Record<BudgetCategory, { label: string; emoji: string }> = {
  flights: { label: 'Trajets', emoji: '🎫' },
  accommodation: { label: 'Hébergements', emoji: '🛏️' },
  transport: { label: 'Transports', emoji: '🚆' },
  places: { label: 'Lieux / Activités', emoji: '🎟️' },
};

const CATEGORY_ORDER: BudgetCategory[] = ['flights', 'accommodation', 'transport', 'places'];

interface BudgetModalProps {
  trip: Trip;
  open: boolean;
  onClose: () => void;
}

/** Page stats (admin) : total dépensé par catégorie, converti en euros. */
export function BudgetModal({ trip, open, onClose }: BudgetModalProps) {
  const [rates, setRates] = useState<Rates>(loadRates);
  const [perPerson, setPerPerson] = useState(false);

  const budget = useMemo(() => computeBudget(trip, rates), [trip, rates]);
  const travel = travelCopy(trip);

  // Libellé de la catégorie « bout de voyage » selon le mode (vols / trains).
  const categoryMeta = (category: BudgetCategory) =>
    category === 'flights' && travel
      ? { label: travel.budgetCategory, emoji: travel.emoji }
      : CATEGORY_META[category];

  const total = perPerson ? budget.totalEurPerPerson : budget.totalEur;
  const byCategory = perPerson ? budget.byCategoryPerPerson : budget.byCategory;

  // Équivalent affiché sous les totaux : seulement si une unique devise
  // étrangère est utilisée (sinon la conversion n'aurait pas de sens).
  const secondary = budget.foreignCurrencies.length === 1 ? budget.foreignCurrencies[0] : null;
  const approx = (eur: number) =>
    secondary ? `≈ ${formatMoney(fromEur(eur, secondary, rates), secondary)}` : null;

  const updateRate = (currency: string, value: number) => {
    setRates((current) => {
      const next = { ...current, [currency]: value };
      if (value > 0) localStorage.setItem(RATES_KEY, JSON.stringify(next));
      return next;
    });
  };

  return (
    <Modal open={open} onClose={onClose} className="w-full max-w-lg">
      <div className="flex min-h-0 flex-col">
        <DetailHeader title={<span>💶 Budget du voyage</span>} onClose={onClose} />

        <div className="flex-1 min-h-0 space-y-4 overflow-y-auto p-4 scroll-thin">
          {/* Taux de change : un champ par devise étrangère réellement utilisée */}
          {budget.foreignCurrencies.map((currency) => (
            <div
              key={currency}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-3"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium">Taux de change</div>
                <p className="text-xs text-muted-foreground">
                  Utilisé pour convertir {currency} ↔ €.
                </p>
              </div>
              <div className="flex items-center gap-1.5 whitespace-nowrap text-sm">
                <span>1 € =</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={rates[currency] ?? 1}
                  className="w-24 text-right"
                  onChange={(e) => updateRate(currency, Number(e.target.value))}
                />
                <span>{currency}</span>
              </div>
            </div>
          ))}

          {/* Bascule Total / Par personne */}
          <div className="flex rounded-lg border border-border p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setPerPerson(false)}
              className={`flex-1 rounded-md px-3 py-1.5 font-medium transition-colors ${
                perPerson ? 'text-muted-foreground hover:bg-muted' : 'bg-primary text-primary-foreground'
              }`}
            >
              Total
            </button>
            <button
              type="button"
              onClick={() => setPerPerson(true)}
              className={`flex-1 rounded-md px-3 py-1.5 font-medium transition-colors ${
                perPerson ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              Par personne
            </button>
          </div>

          {/* Total mis en avant */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-center">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {perPerson ? 'Coût par personne' : 'Total dépensé'}
            </div>
            <div className="mt-1 text-3xl font-bold text-primary">{formatEur(total)}</div>
            {approx(total) && <div className="text-sm text-muted-foreground">{approx(total)}</div>}
          </div>

          {/* Détail par catégorie */}
          <div className="space-y-2">
            {CATEGORY_ORDER.map((category) => {
              const meta = categoryMeta(category);
              const eur = byCategory[category];
              const lines = budget.lines.filter((l) => l.category === category);
              if (lines.length === 0) return null;
              return (
                <div key={category} className="rounded-lg border border-border">
                  <div className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="flex items-center gap-2 font-medium">
                      <span>{meta.emoji}</span>
                      {meta.label}
                      <span className="text-xs text-muted-foreground">({lines.length})</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatEur(eur)}</div>
                      {approx(eur) && (
                        <div className="text-xs text-muted-foreground">{approx(eur)}</div>
                      )}
                    </div>
                  </div>

                  <ul className="border-t border-border">
                    {lines.map((line, index) => (
                      <li
                        key={`${line.label}-${index}`}
                        className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm"
                      >
                        <span className="min-w-0 truncate text-muted-foreground">
                          {line.label}
                          {line.persons > 1 && (
                            <span className="ml-1 text-xs">· {line.persons} pers.</span>
                          )}
                        </span>
                        <span className="shrink-0 tabular-nums">
                          {perPerson ? formatEur(line.eurPerPerson) : `${line.amount}${line.currency}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {budget.lines.length === 0 && (
            <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
              Aucun prix renseigné pour l'instant. Ajoute des prix aux trajets, hébergements,
              transports et lieux pour voir le total.
            </p>
          )}

          <p className="text-center text-[11px] text-muted-foreground">
            Total calculé à partir des prix saisis, convertis en euros
            {budget.foreignCurrencies.length > 0 ? ' aux taux ci-dessus' : ''}.
          </p>
        </div>
      </div>
    </Modal>
  );
}
