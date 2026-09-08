// currencies.ts — the single canonical currency list for the whole app.
// Every currency picker and every fee display imports from here (formerly
// duplicated across src/lib/utils.ts, src/lib/finance.ts and
// VouchersSection.tsx — consolidated so new currencies only need adding once).
//
// Ordering: USD, EUR, GBP first (PINNED_CURRENCY_CODES), then every other
// currency alphabetically by code. Pickers render this array as-is for the
// pinned block, then a divider, then the rest — see currencyPickerGroups().
//
// Each entry also carries the presentation and geo data the shared
// CurrencyPicker needs:
//   `country`      an ISO 3166-1 alpha-2 code used ONLY to draw a rectangular
//                  flag through getFlagUrl(). EUR is the one non-country: it
//                  uses 'EU', the ISO 3166-1 exceptionally-reserved code, which
//                  Twemoji ships as the European flag (1f1ea-1f1fa.svg) so it
//                  goes through the exact same flag pipeline as every other row
//                  rather than needing a bespoke glyph.
//   `countryLabel` the human place name shown as the row's second line and
//                  matched by the picker's search box.
//   `usedIn`       every alpha-2 country whose visitors should be recommended
//                  this currency. Drives COUNTRY_TO_CURRENCY / currencyForCountry().
//                  Not exhaustive economics: it is a "what would this organiser
//                  most likely charge in" heuristic, and a country that is not
//                  listed simply gets no recommendation.
//
// NOTHING here changes what is stored. Every column keeps taking the ISO 4217
// `code` exactly as written, in upper case.

import { getCountryByCode } from '@/lib/countries';

export interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
  /** ISO 3166-1 alpha-2 for the flag ('EU' for the euro). */
  country: string;
  /** Place name shown under the currency name and matched by search. */
  countryLabel: string;
  /** Alpha-2 countries whose visitors are recommended this currency. */
  usedIn: string[];
}

export const PINNED_CURRENCY_CODES = ['USD', 'EUR', 'GBP'] as const;

export const CURRENCIES: CurrencyOption[] = [
  // ── Pinned ─────────────────────────────────────────────────────────────
  { code: 'USD', symbol: '$', name: 'US Dollar', country: 'US', countryLabel: 'United States', usedIn: ['US', 'EC', 'SV', 'PA', 'TL', 'ZW', 'PR', 'GU', 'VI', 'AS', 'MP', 'MH', 'FM', 'PW', 'BQ', 'TC', 'VG'] },
  { code: 'EUR', symbol: '€', name: 'Euro', country: 'EU', countryLabel: 'Eurozone', usedIn: ['AT', 'BE', 'HR', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES', 'AD', 'MC', 'SM', 'VA', 'ME', 'XK'] },
  { code: 'GBP', symbol: '£', name: 'British Pound', country: 'GB', countryLabel: 'United Kingdom', usedIn: ['GB', 'IM', 'JE', 'GG'] },

  // ── Everything else, alphabetical by code ───────────────────────────────
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham', country: 'AE', countryLabel: 'United Arab Emirates', usedIn: ['AE'] },
  { code: 'ARS', symbol: 'AR$', name: 'Argentine Peso', country: 'AR', countryLabel: 'Argentina', usedIn: ['AR'] },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', country: 'AU', countryLabel: 'Australia', usedIn: ['AU', 'NR', 'TV', 'KI', 'CX', 'CC', 'NF'] },
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka', country: 'BD', countryLabel: 'Bangladesh', usedIn: ['BD'] },
  { code: 'BHD', symbol: 'BD', name: 'Bahraini Dinar', country: 'BH', countryLabel: 'Bahrain', usedIn: ['BH'] },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', country: 'BR', countryLabel: 'Brazil', usedIn: ['BR'] },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', country: 'CA', countryLabel: 'Canada', usedIn: ['CA'] },
  { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc', country: 'CH', countryLabel: 'Switzerland', usedIn: ['CH', 'LI'] },
  { code: 'CLP', symbol: 'CLP$', name: 'Chilean Peso', country: 'CL', countryLabel: 'Chile', usedIn: ['CL'] },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', country: 'CN', countryLabel: 'China', usedIn: ['CN'] },
  { code: 'COP', symbol: 'COL$', name: 'Colombian Peso', country: 'CO', countryLabel: 'Colombia', usedIn: ['CO'] },
  { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna', country: 'CZ', countryLabel: 'Czechia', usedIn: ['CZ'] },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone', country: 'DK', countryLabel: 'Denmark', usedIn: ['DK', 'GL', 'FO'] },
  { code: 'DZD', symbol: 'DA', name: 'Algerian Dinar', country: 'DZ', countryLabel: 'Algeria', usedIn: ['DZ'] },
  { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound', country: 'EG', countryLabel: 'Egypt', usedIn: ['EG'] },
  { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi', country: 'GH', countryLabel: 'Ghana', usedIn: ['GH'] },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', country: 'HK', countryLabel: 'Hong Kong', usedIn: ['HK'] },
  { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint', country: 'HU', countryLabel: 'Hungary', usedIn: ['HU'] },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', country: 'ID', countryLabel: 'Indonesia', usedIn: ['ID'] },
  { code: 'ILS', symbol: '₪', name: 'Israeli New Shekel', country: 'IL', countryLabel: 'Israel', usedIn: ['IL'] },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', country: 'IN', countryLabel: 'India', usedIn: ['IN'] },
  { code: 'JOD', symbol: 'JD', name: 'Jordanian Dinar', country: 'JO', countryLabel: 'Jordan', usedIn: ['JO'] },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', country: 'JP', countryLabel: 'Japan', usedIn: ['JP'] },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling', country: 'KE', countryLabel: 'Kenya', usedIn: ['KE'] },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won', country: 'KR', countryLabel: 'South Korea', usedIn: ['KR'] },
  { code: 'KWD', symbol: 'KD', name: 'Kuwaiti Dinar', country: 'KW', countryLabel: 'Kuwait', usedIn: ['KW'] },
  { code: 'LKR', symbol: 'Rs', name: 'Sri Lankan Rupee', country: 'LK', countryLabel: 'Sri Lanka', usedIn: ['LK'] },
  { code: 'MAD', symbol: 'DH', name: 'Moroccan Dirham', country: 'MA', countryLabel: 'Morocco', usedIn: ['MA', 'EH'] },
  { code: 'MXN', symbol: '$', name: 'Mexican Peso', country: 'MX', countryLabel: 'Mexico', usedIn: ['MX'] },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', country: 'MY', countryLabel: 'Malaysia', usedIn: ['MY'] },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', country: 'NG', countryLabel: 'Nigeria', usedIn: ['NG'] },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', country: 'NO', countryLabel: 'Norway', usedIn: ['NO', 'SJ', 'BV'] },
  // Nepal writes the rupee as रू (or Rs). Distinct from INR/PKR/LKR, which is
  // why it needs its own row rather than borrowing one of theirs.
  { code: 'NPR', symbol: 'रू', name: 'Nepalese Rupee', country: 'NP', countryLabel: 'Nepal', usedIn: ['NP'] },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', country: 'NZ', countryLabel: 'New Zealand', usedIn: ['NZ', 'CK', 'NU', 'TK', 'PN'] },
  { code: 'OMR', symbol: 'OMR', name: 'Omani Rial', country: 'OM', countryLabel: 'Oman', usedIn: ['OM'] },
  { code: 'PEN', symbol: 'S/', name: 'Peruvian Sol', country: 'PE', countryLabel: 'Peru', usedIn: ['PE'] },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso', country: 'PH', countryLabel: 'Philippines', usedIn: ['PH'] },
  { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee', country: 'PK', countryLabel: 'Pakistan', usedIn: ['PK'] },
  { code: 'PLN', symbol: 'zł', name: 'Polish Złoty', country: 'PL', countryLabel: 'Poland', usedIn: ['PL'] },
  { code: 'QAR', symbol: 'QR', name: 'Qatari Riyal', country: 'QA', countryLabel: 'Qatar', usedIn: ['QA'] },
  { code: 'RON', symbol: 'lei', name: 'Romanian Leu', country: 'RO', countryLabel: 'Romania', usedIn: ['RO'] },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble', country: 'RU', countryLabel: 'Russia', usedIn: ['RU'] },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal', country: 'SA', countryLabel: 'Saudi Arabia', usedIn: ['SA'] },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', country: 'SE', countryLabel: 'Sweden', usedIn: ['SE'] },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', country: 'SG', countryLabel: 'Singapore', usedIn: ['SG'] },
  { code: 'THB', symbol: '฿', name: 'Thai Baht', country: 'TH', countryLabel: 'Thailand', usedIn: ['TH'] },
  { code: 'TND', symbol: 'DT', name: 'Tunisian Dinar', country: 'TN', countryLabel: 'Tunisia', usedIn: ['TN'] },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira', country: 'TR', countryLabel: 'Türkiye', usedIn: ['TR'] },
  { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling', country: 'TZ', countryLabel: 'Tanzania', usedIn: ['TZ'] },
  { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling', country: 'UG', countryLabel: 'Uganda', usedIn: ['UG'] },
  { code: 'VND', symbol: '₫', name: 'Vietnamese Dong', country: 'VN', countryLabel: 'Vietnam', usedIn: ['VN'] },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', country: 'ZA', countryLabel: 'South Africa', usedIn: ['ZA', 'LS', 'NA', 'SZ'] },
];

export const CURRENCY_CODES: string[] = CURRENCIES.map((c) => c.code);

const BY_CODE: Record<string, CurrencyOption> = Object.fromEntries(
  CURRENCIES.map((c) => [c.code, c])
);

/** Alpha-2 country → ISO 4217 code. Built from every entry's `usedIn`; the
 *  first currency to claim a country wins, and the list is ordered so the
 *  pinned three are asked first (nothing currently collides). */
export const COUNTRY_TO_CURRENCY: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const c of CURRENCIES) {
    for (const cc of c.usedIn) {
      if (!map[cc]) map[cc] = c.code;
    }
  }
  return map;
})();

/** The full option for an ISO 4217 code, or undefined. Case-insensitive on
 *  the way in; NEVER changes the casing of anything stored. */
export function findCurrency(code: string | null | undefined): CurrencyOption | undefined {
  if (!code) return undefined;
  return BY_CODE[code.toUpperCase()];
}

export function currencySymbol(code: string): string {
  if (!code) return '';
  return BY_CODE[code.toUpperCase()]?.symbol ?? code;
}

/** Flag country code for a currency, '' when the code is unknown so a caller
 *  renders a neutral placeholder instead of a broken image. */
export function currencyFlagCode(code: string | null | undefined): string {
  return findCurrency(code)?.country ?? '';
}

/** The currency an organiser in `countryCode` most likely charges in, or null
 *  when we have no opinion (unknown/absent geo, a country we do not map).
 *  Callers must treat null as "show no recommendation", never as a default. */
export function currencyForCountry(countryCode: string | null | undefined): CurrencyOption | null {
  if (!countryCode) return null;
  const code = COUNTRY_TO_CURRENCY[countryCode.toUpperCase()];
  return code ? BY_CODE[code] ?? null : null;
}

/** Lowercased search text per currency: the ISO code, the currency name, the
 *  symbol, the headline place label and the FULL NAME of every country in
 *  `usedIn`. The last part is what makes "germany", "ireland" and "spain" all
 *  find the Euro, which is the search an organiser actually types. Built once,
 *  lazily, because it walks the country table. */
const HAYSTACK = new Map<string, string>();

function haystackFor(option: CurrencyOption): string {
  const cached = HAYSTACK.get(option.code);
  if (cached) return cached;
  const names = option.usedIn
    .map((cc) => getCountryByCode(cc)?.name ?? '')
    .filter(Boolean);
  const text = [option.code, option.name, option.symbol, option.countryLabel, ...option.usedIn, ...names]
    .join(' ')
    .toLowerCase();
  HAYSTACK.set(option.code, text);
  return text;
}

/** Does this currency match a free-text query? See HAYSTACK for the fields
 *  searched. Empty query matches everything. */
export function currencyMatches(option: CurrencyOption, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return haystackFor(option).includes(q);
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
