// currencies.ts — the single canonical currency list for the whole app.
// Every currency picker and every fee display imports from here (formerly
// duplicated across src/lib/utils.ts, src/lib/finance.ts and
// VouchersSection.tsx — consolidated so new currencies only need adding once).
//
// Ordering: USD, EUR, GBP first (PINNED_CURRENCY_CODES), then every other
// currency alphabetically by code. Pickers render this array as-is for the
// pinned block, then a divider, then the rest — see currencyPickerGroups().

export interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
}

export const PINNED_CURRENCY_CODES = ['USD', 'EUR', 'GBP'] as const;

export const CURRENCIES: CurrencyOption[] = [
  // ── Pinned ─────────────────────────────────────────────────────────────
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },

  // ── Everything else, alphabetical by code ───────────────────────────────
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham' },
  { code: 'ARS', symbol: 'AR$', name: 'Argentine Peso' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka' },
  { code: 'BHD', symbol: 'BD', name: 'Bahraini Dinar' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc' },
  { code: 'CLP', symbol: 'CLP$', name: 'Chilean Peso' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'COP', symbol: 'COL$', name: 'Colombian Peso' },
  { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },
  { code: 'DZD', symbol: 'DA', name: 'Algerian Dinar' },
  { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound' },
  { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
  { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
  { code: 'ILS', symbol: '₪', name: 'Israeli New Shekel' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'JOD', symbol: 'JD', name: 'Jordanian Dinar' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
  { code: 'KWD', symbol: 'KD', name: 'Kuwaiti Dinar' },
  { code: 'LKR', symbol: 'Rs', name: 'Sri Lankan Rupee' },
  { code: 'MAD', symbol: 'DH', name: 'Moroccan Dirham' },
  { code: 'MXN', symbol: '$', name: 'Mexican Peso' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
  { code: 'OMR', symbol: 'OMR', name: 'Omani Rial' },
  { code: 'PEN', symbol: 'S/', name: 'Peruvian Sol' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso' },
  { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Złoty' },
  { code: 'QAR', symbol: 'QR', name: 'Qatari Riyal' },
  { code: 'RON', symbol: 'lei', name: 'Romanian Leu' },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble' },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht' },
  { code: 'TND', symbol: 'DT', name: 'Tunisian Dinar' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
  { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling' },
  { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling' },
  { code: 'VND', symbol: '₫', name: 'Vietnamese Dong' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
];

export const CURRENCY_CODES: string[] = CURRENCIES.map((c) => c.code);

const BY_CODE: Record<string, CurrencyOption> = Object.fromEntries(
  CURRENCIES.map((c) => [c.code, c])
);

export function currencySymbol(code: string): string {
  if (!code) return '';
  return BY_CODE[code.toUpperCase()]?.symbol ?? code;
}

/** Splits CURRENCIES into the pinned block (USD, EUR, GBP) and the
 *  alphabetical rest, for pickers that render a divider between them. */
export function currencyPickerGroups(): { pinned: CurrencyOption[]; rest: CurrencyOption[] } {
  const pinnedSet = new Set<string>(PINNED_CURRENCY_CODES);
  return {
    pinned: CURRENCIES.filter((c) => pinnedSet.has(c.code)),
    rest: CURRENCIES.filter((c) => !pinnedSet.has(c.code)),
  };
}
