/**
 * Drapeau emoji à partir d'un code pays ISO 3166-1 alpha-2 (ex. « jp » → 🇯🇵).
 * Les drapeaux sont composés de deux « regional indicator symbols » (U+1F1E6 = A).
 */
export function flagEmoji(countryCode?: string): string | undefined {
  const code = countryCode?.trim().toUpperCase();
  if (!code || !/^[A-Z]{2}$/.test(code)) return undefined;
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
