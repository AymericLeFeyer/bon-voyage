import type { Trip } from '@shared/types/trip';
import { travelCopy } from '@/shared/constants/travel';

/** Catégories de dépense agrégées dans la page stats. */
export type BudgetCategory = 'flights' | 'accommodation' | 'transport' | 'places';

/** Devise de référence : tous les totaux sont exprimés en euros. */
export const BASE_CURRENCY = '€';

/**
 * Taux de change saisis par l'utilisateur : nombre d'unités de la devise pour
 * 1 €. Les devises absentes sont traitées comme des équivalents euro.
 */
export type Rates = Record<string, number>;

/** Taux indicatifs proposés par défaut (modifiables dans la page budget). */
export const DEFAULT_RATES: Rates = { '¥': 165, $: 1.08, '£': 0.85 };

/** Symbole → code ISO, pour le formatage `Intl`. */
const CURRENCY_CODES: Record<string, string> = {
  '€': 'EUR',
  $: 'USD',
  '£': 'GBP',
  '¥': 'JPY',
};

export interface BudgetLine {
  category: BudgetCategory;
  label: string;
  /** Montant tel que saisi. */
  amount: number;
  currency: string;
  /** Nombre de personnes couvertes par ce montant. */
  persons: number;
  /** Montant total converti en euros (base). */
  eur: number;
  /** Montant par personne converti en euros. */
  eurPerPerson: number;
}

export interface BudgetBreakdown {
  lines: BudgetLine[];
  /** Total par catégorie, en euros. */
  byCategory: Record<BudgetCategory, number>;
  /** Total par personne et par catégorie, en euros. */
  byCategoryPerPerson: Record<BudgetCategory, number>;
  totalEur: number;
  totalEurPerPerson: number;
  /** Devises étrangères réellement utilisées dans le voyage (hors €). */
  foreignCurrencies: string[];
}

/**
 * Convertit un montant vers l'euro (devise de base).
 * `rates[devise]` = nombre d'unités de cette devise pour 1 €. Une devise sans
 * taux connu est traitée comme un équivalent euro.
 */
export function toEur(amount: number, currency: string | undefined, rates: Rates): number {
  if (!currency || currency === BASE_CURRENCY) return amount;
  const rate = rates[currency];
  return rate != null && rate > 0 ? amount / rate : amount;
}

/** Agrège tous les prix saisis (trajets, hébergements, transports, lieux) en un budget. */
export function computeBudget(trip: Trip, rates: Rates): BudgetBreakdown {
  const lines: BudgetLine[] = [];
  const push = (
    category: BudgetCategory,
    label: string,
    price: number | undefined,
    currency: string | undefined,
    persons: number | undefined,
  ) => {
    if (price == null || Number.isNaN(price)) return;
    const cur = currency ?? BASE_CURRENCY;
    const eur = toEur(price, cur, rates);
    const pers = persons != null && persons > 0 ? persons : 1;
    lines.push({ category, label, amount: price, currency: cur, persons: pers, eur, eurPerPerson: eur / pers });
  };

  // Trajets aller/retour : ignorés si le voyage est en mode « non défini ».
  const travel = travelCopy(trip);
  if (travel) {
    if (trip.outboundFlight) {
      const f = trip.outboundFlight;
      push('flights', travel.label.outbound, f.price, f.currency, f.persons);
    }
    if (trip.returnFlight) {
      const f = trip.returnFlight;
      push('flights', travel.label.return, f.price, f.currency, f.persons);
    }
  }

  trip.stages.forEach((stage, index) => {
    const acc = stage.accommodation;
    if (acc) push('accommodation', acc.name || stage.name, acc.price, acc.currency, acc.persons);

    const leg = stage.transportToNext;
    if (leg) {
      const next = trip.stages[index + 1];
      const label = next ? `${stage.name} → ${next.name}` : leg.label || `${stage.name} · transport`;
      push('transport', label, leg.price, leg.currency, leg.persons);
    }

    stage.places.forEach((place) => {
      push('places', place.name, place.price, place.currency, place.persons);
    });
  });

  const byCategory: Record<BudgetCategory, number> = {
    flights: 0,
    accommodation: 0,
    transport: 0,
    places: 0,
  };
  const byCategoryPerPerson: Record<BudgetCategory, number> = {
    flights: 0,
    accommodation: 0,
    transport: 0,
    places: 0,
  };
  for (const line of lines) {
    byCategory[line.category] += line.eur;
    byCategoryPerPerson[line.category] += line.eurPerPerson;
  }

  const foreign = [...new Set(lines.map((l) => l.currency))].filter((c) => c !== BASE_CURRENCY);

  const totalEur = lines.reduce((sum, line) => sum + line.eur, 0);
  const totalEurPerPerson = lines.reduce((sum, line) => sum + line.eurPerPerson, 0);
  return {
    lines,
    byCategory,
    byCategoryPerPerson,
    totalEur,
    totalEurPerPerson,
    foreignCurrencies: foreign,
  };
}

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(code: string): Intl.NumberFormat {
  let f = formatters.get(code);
  if (!f) {
    f = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: code, maximumFractionDigits: 0 });
    formatters.set(code, f);
  }
  return f;
}

/** Formate un montant dans la devise donnée (symbole libre accepté). */
export function formatMoney(amount: number, currency: string): string {
  const code = CURRENCY_CODES[currency];
  if (code) return formatter(code).format(amount);
  return `${Math.round(amount).toLocaleString('fr-FR')} ${currency}`;
}

export function formatEur(amount: number): string {
  return formatMoney(amount, BASE_CURRENCY);
}

/** Convertit un montant en euros vers une devise étrangère (pour l'affichage « ≈ »). */
export function fromEur(amountEur: number, currency: string, rates: Rates): number {
  const rate = rates[currency];
  return rate != null && rate > 0 ? amountEur * rate : amountEur;
}
