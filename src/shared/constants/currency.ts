/**
 * Devises proposées à la saisie.
 *
 * ⚠️ La devise est stockée par son **code ISO** (`EUR`, `JPY`…) et non par son
 * symbole : plusieurs devises partagent le même signe (`$` = USD, CAD, AUD…).
 * Les voyages créés avant ce changement contiennent un symbole (`€`, `¥`, `$`,
 * `£`) → toujours passer par `normalizeCurrency` avant de comparer ou convertir.
 */

export interface CurrencyInfo {
  /** Code ISO 4217 — valeur réellement stockée. */
  code: string;
  symbol: string;
  label: string;
}

/** Devise de référence : tous les totaux du budget sont exprimés en euros. */
export const BASE_CURRENCY = 'EUR';

export const CURRENCIES: CurrencyInfo[] = [
  // Europe
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'GBP', symbol: '£', label: 'Livre sterling' },
  { code: 'CHF', symbol: 'CHF', label: 'Franc suisse' },
  { code: 'SEK', symbol: 'kr', label: 'Couronne suédoise' },
  { code: 'NOK', symbol: 'kr', label: 'Couronne norvégienne' },
  { code: 'DKK', symbol: 'kr', label: 'Couronne danoise' },
  { code: 'ISK', symbol: 'kr', label: 'Couronne islandaise' },
  { code: 'PLN', symbol: 'zł', label: 'Zloty polonais' },
  { code: 'CZK', symbol: 'Kč', label: 'Couronne tchèque' },
  { code: 'HUF', symbol: 'Ft', label: 'Forint hongrois' },
  { code: 'RON', symbol: 'lei', label: 'Leu roumain' },
  { code: 'BGN', symbol: 'лв', label: 'Lev bulgare' },
  { code: 'RSD', symbol: 'дин', label: 'Dinar serbe' },
  { code: 'TRY', symbol: '₺', label: 'Livre turque' },
  { code: 'UAH', symbol: '₴', label: 'Hryvnia ukrainienne' },
  { code: 'GEL', symbol: '₾', label: 'Lari géorgien' },

  // Amériques
  { code: 'USD', symbol: '$', label: 'Dollar américain' },
  { code: 'CAD', symbol: '$', label: 'Dollar canadien' },
  { code: 'MXN', symbol: '$', label: 'Peso mexicain' },
  { code: 'BRL', symbol: 'R$', label: 'Réal brésilien' },
  { code: 'ARS', symbol: '$', label: 'Peso argentin' },
  { code: 'CLP', symbol: '$', label: 'Peso chilien' },
  { code: 'COP', symbol: '$', label: 'Peso colombien' },
  { code: 'PEN', symbol: 'S/', label: 'Sol péruvien' },
  { code: 'CRC', symbol: '₡', label: 'Colón costaricien' },

  // Asie & Pacifique
  { code: 'JPY', symbol: '¥', label: 'Yen japonais' },
  { code: 'CNY', symbol: '¥', label: 'Yuan chinois' },
  { code: 'KRW', symbol: '₩', label: 'Won sud-coréen' },
  { code: 'HKD', symbol: '$', label: 'Dollar de Hong Kong' },
  { code: 'TWD', symbol: '$', label: 'Dollar taïwanais' },
  { code: 'SGD', symbol: '$', label: 'Dollar de Singapour' },
  { code: 'THB', symbol: '฿', label: 'Baht thaïlandais' },
  { code: 'VND', symbol: '₫', label: 'Dong vietnamien' },
  { code: 'IDR', symbol: 'Rp', label: 'Roupie indonésienne' },
  { code: 'MYR', symbol: 'RM', label: 'Ringgit malaisien' },
  { code: 'PHP', symbol: '₱', label: 'Peso philippin' },
  { code: 'INR', symbol: '₹', label: 'Roupie indienne' },
  { code: 'NPR', symbol: '₨', label: 'Roupie népalaise' },
  { code: 'LKR', symbol: '₨', label: 'Roupie srilankaise' },
  { code: 'AUD', symbol: '$', label: 'Dollar australien' },
  { code: 'NZD', symbol: '$', label: 'Dollar néo-zélandais' },
  { code: 'XPF', symbol: 'F', label: 'Franc pacifique' },

  // Afrique & Moyen-Orient
  { code: 'MAD', symbol: 'DH', label: 'Dirham marocain' },
  { code: 'TND', symbol: 'DT', label: 'Dinar tunisien' },
  { code: 'EGP', symbol: 'E£', label: 'Livre égyptienne' },
  { code: 'ZAR', symbol: 'R', label: 'Rand sud-africain' },
  { code: 'KES', symbol: 'KSh', label: 'Shilling kényan' },
  { code: 'MUR', symbol: '₨', label: 'Roupie mauricienne' },
  { code: 'XOF', symbol: 'CFA', label: 'Franc CFA (Ouest)' },
  { code: 'AED', symbol: 'AED', label: 'Dirham des Émirats' },
  { code: 'SAR', symbol: 'SAR', label: 'Riyal saoudien' },
  { code: 'QAR', symbol: 'QAR', label: 'Riyal qatari' },
  { code: 'JOD', symbol: 'JD', label: 'Dinar jordanien' },
  { code: 'ILS', symbol: '₪', label: 'Shekel israélien' },
];

const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

/**
 * Symboles hérités des voyages créés avant le passage aux codes ISO.
 * Volontairement limité aux 4 devises alors proposées : le symbole seul est
 * ambigu (`$`) et on ne devine rien au-delà de cet historique connu.
 */
const LEGACY_SYMBOLS: Record<string, string> = {
  '€': 'EUR',
  '¥': 'JPY',
  $: 'USD',
  '£': 'GBP',
};

/** Ramène une valeur stockée (code ISO ou ancien symbole) à un code ISO. */
export function normalizeCurrency(value: string | undefined): string {
  if (!value) return BASE_CURRENCY;
  const trimmed = value.trim();
  if (BY_CODE.has(trimmed)) return trimmed;
  const upper = trimmed.toUpperCase();
  if (BY_CODE.has(upper)) return upper;
  return LEGACY_SYMBOLS[trimmed] ?? trimmed;
}

/** Symbole d'affichage d'une devise (repli : le code lui-même). */
export function currencySymbol(value: string | undefined): string {
  const code = normalizeCurrency(value);
  return BY_CODE.get(code)?.symbol ?? code;
}

/** `null` = code refusé par `Intl` → on formate le nombre seul + le symbole. */
const formatters = new Map<string, Intl.NumberFormat | null>();
const plainFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

/** Formate un montant dans sa devise (« 12 500 ¥ », « 89 € »). */
export function formatAmount(amount: number, value: string | undefined): string {
  const code = normalizeCurrency(value);
  let formatter = formatters.get(code);
  if (formatter === undefined) {
    try {
      formatter = new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: code,
        maximumFractionDigits: 0,
      });
    } catch {
      // Code inconnu d'`Intl` (donnée exotique ou corrompue) : repli manuel.
      formatter = null;
    }
    formatters.set(code, formatter);
  }
  return formatter
    ? formatter.format(amount)
    : `${plainFormat.format(amount)} ${currencySymbol(code)}`;
}

/**
 * Taux indicatifs : nombre d'unités de la devise pour 1 €. Ordres de grandeur
 * destinés à éviter un total absurde tant que rien n'est saisi — la page budget
 * permet de corriger le taux de chaque devise utilisée.
 */
export const DEFAULT_RATES: Record<string, number> = {
  GBP: 0.85,
  CHF: 0.94,
  SEK: 11.2,
  NOK: 11.7,
  DKK: 7.46,
  ISK: 150,
  PLN: 4.3,
  CZK: 25,
  HUF: 395,
  RON: 4.98,
  BGN: 1.96,
  RSD: 117,
  TRY: 44,
  UAH: 45,
  GEL: 2.95,
  USD: 1.08,
  CAD: 1.48,
  MXN: 20,
  BRL: 6.2,
  ARS: 1250,
  CLP: 1030,
  COP: 4400,
  PEN: 4.05,
  CRC: 550,
  JPY: 165,
  CNY: 7.8,
  KRW: 1500,
  HKD: 8.4,
  TWD: 35,
  SGD: 1.42,
  THB: 36,
  VND: 27500,
  IDR: 17500,
  MYR: 4.7,
  PHP: 62,
  INR: 93,
  NPR: 149,
  LKR: 325,
  AUD: 1.65,
  NZD: 1.8,
  XPF: 119.33,
  MAD: 10.8,
  TND: 3.4,
  EGP: 53,
  ZAR: 19.5,
  KES: 140,
  MUR: 50,
  XOF: 655.96,
  AED: 3.97,
  SAR: 4.05,
  QAR: 3.94,
  JOD: 0.77,
  ILS: 4,
};
