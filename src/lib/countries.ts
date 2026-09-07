export interface Country {
  name: string;
  code: string; // ISO 3166-1 alpha-2
}

export function getFlagEmoji(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
    .join('');
}

// Twemoji CDN — renders identically on Windows, Mac, Linux, Android.
// Input: ISO 3166-1 alpha-2 country code e.g. 'GB', 'US', 'DE'
// Output: URL to a 72×72 PNG on jsDelivr's Twemoji mirror.
export function getFlagUrl(code: string): string {
  // Null-safe: committee-only preferences (delegate_preference_mode
  // 'committees_only') carry no country, so callers may pass an empty code.
  // Fall back to the globe glyph rather than building a broken flag URL.
  if (!code) return getTwemojiUrl('1f310');
  const points = code
    .toUpperCase()
    .split('')
    .map((c) => (c.codePointAt(0)! + 0x1F1A5).toString(16))
    .join('-');
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${points}.svg`;
}

// Twemoji URL for arbitrary non-flag emojis by their Unicode codepoint hex string.
// e.g. getTwemojiUrl('1f3a4') for 🎙, getTwemojiUrl('1f3c1') for 🏁
export function getTwemojiUrl(codepoint: string): string {
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${codepoint}.svg`;
}

export const UN_COUNTRIES: Country[] = [
  { name: 'Afghanistan', code: 'AF' },
  { name: 'Albania', code: 'AL' },
  { name: 'Algeria', code: 'DZ' },
  { name: 'Andorra', code: 'AD' },
  { name: 'Angola', code: 'AO' },
  { name: 'Antigua and Barbuda', code: 'AG' },
  { name: 'Argentina', code: 'AR' },
  { name: 'Armenia', code: 'AM' },
  { name: 'Australia', code: 'AU' },
  { name: 'Austria', code: 'AT' },
  { name: 'Azerbaijan', code: 'AZ' },
  { name: 'Bahamas', code: 'BS' },
  { name: 'Bahrain', code: 'BH' },
  { name: 'Bangladesh', code: 'BD' },
  { name: 'Barbados', code: 'BB' },
  { name: 'Belarus', code: 'BY' },
  { name: 'Belgium', code: 'BE' },
  { name: 'Belize', code: 'BZ' },
  { name: 'Benin', code: 'BJ' },
  { name: 'Bhutan', code: 'BT' },
  { name: 'Bolivia', code: 'BO' },
  { name: 'Bosnia and Herzegovina', code: 'BA' },
  { name: 'Botswana', code: 'BW' },
  { name: 'Brazil', code: 'BR' },
  { name: 'Brunei', code: 'BN' },
  { name: 'Bulgaria', code: 'BG' },
  { name: 'Burkina Faso', code: 'BF' },
  { name: 'Burundi', code: 'BI' },
  { name: 'Cabo Verde', code: 'CV' },
  { name: 'Cambodia', code: 'KH' },
  { name: 'Cameroon', code: 'CM' },
  { name: 'Canada', code: 'CA' },
  { name: 'Central African Republic', code: 'CF' },
  { name: 'Chad', code: 'TD' },
  { name: 'Chile', code: 'CL' },
  { name: 'China', code: 'CN' },
  { name: 'Colombia', code: 'CO' },
  { name: 'Comoros', code: 'KM' },
  { name: 'Congo', code: 'CG' },
  { name: 'Cook Islands', code: 'CK' },
  { name: 'Costa Rica', code: 'CR' },
  { name: "Côte d'Ivoire", code: 'CI' },
  { name: 'Croatia', code: 'HR' },
  { name: 'Cuba', code: 'CU' },
  { name: 'Cyprus', code: 'CY' },
  { name: 'Czech Republic', code: 'CZ' },
  { name: 'DR Congo', code: 'CD' },
  { name: 'Denmark', code: 'DK' },
  { name: 'Djibouti', code: 'DJ' },
  { name: 'Dominica', code: 'DM' },
  { name: 'Dominican Republic', code: 'DO' },
  { name: 'Ecuador', code: 'EC' },
  { name: 'Egypt', code: 'EG' },
  { name: 'El Salvador', code: 'SV' },
  { name: 'Equatorial Guinea', code: 'GQ' },
  { name: 'Eritrea', code: 'ER' },
  { name: 'Estonia', code: 'EE' },
  { name: 'Eswatini', code: 'SZ' },
  { name: 'Ethiopia', code: 'ET' },
  { name: 'Fiji', code: 'FJ' },
  { name: 'Finland', code: 'FI' },
  { name: 'France', code: 'FR' },
  { name: 'Gabon', code: 'GA' },
  { name: 'Gambia', code: 'GM' },
  { name: 'Georgia', code: 'GE' },
  { name: 'Germany', code: 'DE' },
  { name: 'Ghana', code: 'GH' },
  { name: 'Greece', code: 'GR' },
  { name: 'Grenada', code: 'GD' },
  { name: 'Guatemala', code: 'GT' },
  { name: 'Guinea', code: 'GN' },
  { name: 'Guinea-Bissau', code: 'GW' },
  { name: 'Guyana', code: 'GY' },
  { name: 'Haiti', code: 'HT' },
  { name: 'Holy See', code: 'VA' },
  { name: 'Honduras', code: 'HN' },
  { name: 'Hungary', code: 'HU' },
  { name: 'Iceland', code: 'IS' },
  { name: 'India', code: 'IN' },
  { name: 'Indonesia', code: 'ID' },
  { name: 'Iran', code: 'IR' },
  { name: 'Iraq', code: 'IQ' },
  { name: 'Ireland', code: 'IE' },
  { name: 'Israel', code: 'IL' },
  { name: 'Italy', code: 'IT' },
  { name: 'Jamaica', code: 'JM' },
  { name: 'Japan', code: 'JP' },
  { name: 'Jordan', code: 'JO' },
  { name: 'Kazakhstan', code: 'KZ' },
  { name: 'Kenya', code: 'KE' },
  { name: 'Kiribati', code: 'KI' },
  { name: 'Kosovo', code: 'XK' },
  { name: 'Kuwait', code: 'KW' },
  { name: 'Kyrgyzstan', code: 'KG' },
  { name: 'Laos', code: 'LA' },
  { name: 'Latvia', code: 'LV' },
  { name: 'Lebanon', code: 'LB' },
  { name: 'Lesotho', code: 'LS' },
  { name: 'Liberia', code: 'LR' },
  { name: 'Libya', code: 'LY' },
  { name: 'Liechtenstein', code: 'LI' },
  { name: 'Lithuania', code: 'LT' },
  { name: 'Luxembourg', code: 'LU' },
  { name: 'Madagascar', code: 'MG' },
  { name: 'Malawi', code: 'MW' },
  { name: 'Malaysia', code: 'MY' },
  { name: 'Maldives', code: 'MV' },
  { name: 'Mali', code: 'ML' },
  { name: 'Malta', code: 'MT' },
  { name: 'Marshall Islands', code: 'MH' },
  { name: 'Mauritania', code: 'MR' },
  { name: 'Mauritius', code: 'MU' },
  { name: 'Mexico', code: 'MX' },
  { name: 'Micronesia', code: 'FM' },
  { name: 'Moldova', code: 'MD' },
  { name: 'Monaco', code: 'MC' },
  { name: 'Mongolia', code: 'MN' },
  { name: 'Montenegro', code: 'ME' },
  { name: 'Morocco', code: 'MA' },
  { name: 'Mozambique', code: 'MZ' },
  { name: 'Myanmar', code: 'MM' },
  { name: 'Namibia', code: 'NA' },
  { name: 'Nauru', code: 'NR' },
  { name: 'Nepal', code: 'NP' },
  { name: 'Netherlands', code: 'NL' },
  { name: 'New Zealand', code: 'NZ' },
  { name: 'Nicaragua', code: 'NI' },
  { name: 'Niger', code: 'NE' },
  { name: 'Nigeria', code: 'NG' },
  { name: 'Niue', code: 'NU' },
  { name: 'North Korea', code: 'KP' },
  { name: 'North Macedonia', code: 'MK' },
  { name: 'Norway', code: 'NO' },
  { name: 'Oman', code: 'OM' },
  { name: 'Pakistan', code: 'PK' },
  { name: 'Palau', code: 'PW' },
  { name: 'Palestine', code: 'PS' },
  { name: 'Panama', code: 'PA' },
  { name: 'Papua New Guinea', code: 'PG' },
  { name: 'Paraguay', code: 'PY' },
  { name: 'Peru', code: 'PE' },
  { name: 'Philippines', code: 'PH' },
  { name: 'Poland', code: 'PL' },
  { name: 'Portugal', code: 'PT' },
  { name: 'Qatar', code: 'QA' },
  { name: 'Romania', code: 'RO' },
  { name: 'Russia', code: 'RU' },
  { name: 'Rwanda', code: 'RW' },
  { name: 'Saint Kitts and Nevis', code: 'KN' },
  { name: 'Saint Lucia', code: 'LC' },
  { name: 'Saint Vincent and the Grenadines', code: 'VC' },
  { name: 'Samoa', code: 'WS' },
  { name: 'San Marino', code: 'SM' },
  { name: 'Saudi Arabia', code: 'SA' },
  { name: 'Senegal', code: 'SN' },
  { name: 'Serbia', code: 'RS' },
  { name: 'Seychelles', code: 'SC' },
  { name: 'Sierra Leone', code: 'SL' },
  { name: 'Singapore', code: 'SG' },
  { name: 'Slovakia', code: 'SK' },
  { name: 'Slovenia', code: 'SI' },
  { name: 'Solomon Islands', code: 'SB' },
  { name: 'Somalia', code: 'SO' },
  { name: 'South Africa', code: 'ZA' },
  { name: 'South Korea', code: 'KR' },
  { name: 'South Sudan', code: 'SS' },
  { name: 'Spain', code: 'ES' },
  { name: 'Sri Lanka', code: 'LK' },
  { name: 'Sudan', code: 'SD' },
  { name: 'Suriname', code: 'SR' },
  { name: 'Sweden', code: 'SE' },
  { name: 'Switzerland', code: 'CH' },
  { name: 'Syria', code: 'SY' },
  { name: 'São Tomé and Príncipe', code: 'ST' },
  { name: 'Taiwan', code: 'TW' },
  { name: 'Tajikistan', code: 'TJ' },
  { name: 'Tanzania', code: 'TZ' },
  { name: 'Thailand', code: 'TH' },
  { name: 'Timor-Leste', code: 'TL' },
  { name: 'Togo', code: 'TG' },
  { name: 'Tonga', code: 'TO' },
  { name: 'Trinidad and Tobago', code: 'TT' },
  { name: 'Tunisia', code: 'TN' },
  { name: 'Türkiye', code: 'TR' },
  { name: 'Turkmenistan', code: 'TM' },
  { name: 'Tuvalu', code: 'TV' },
  { name: 'Uganda', code: 'UG' },
  { name: 'Ukraine', code: 'UA' },
  { name: 'United Arab Emirates', code: 'AE' },
  { name: 'United Kingdom', code: 'GB' },
  { name: 'United States', code: 'US' },
  { name: 'Uruguay', code: 'UY' },
  { name: 'Uzbekistan', code: 'UZ' },
  { name: 'Vanuatu', code: 'VU' },
  { name: 'Venezuela', code: 'VE' },
  { name: 'Vietnam', code: 'VN' },
  { name: 'Yemen', code: 'YE' },
  { name: 'Zambia', code: 'ZM' },
  { name: 'Zimbabwe', code: 'ZW' },
  { name: 'European Union', code: 'EU' },
];

/**
 * THE FOLDING RULE — read this before writing any country comparison.
 *
 * `fold()` lowercases, trims and strips combining diacritics: "Türkiye" folds
 * to "turkiye", "Côte d'Ivoire" to "cote d'ivoire", "São Tomé" to "sao tome".
 *
 * This is not cosmetic. A raw `'türkiye'.toLowerCase().includes('tu')` is
 * FALSE — the second character is `ü`, not `u` — so the day the canonical name
 * changed from "Turkey" to "Türkiye" every typeahead in the app stopped
 * finding it from "Tu". The same breaks Côte d'Ivoire and São Tomé, and in
 * ES/FR it breaks Perú, México and Turquía.
 *
 * NEW CALL SITES MUST NOT hand-roll `.toLowerCase().includes(...)` over a
 * country name. Use one of the shared helpers, which fold BOTH sides and
 * consult COUNTRY_NAME_ALIASES:
 *   - `countryMatchRank(enName, query, language)` — ranked, for ordered typeaheads
 *   - `matchesCountryQuery` / `startsWithCountryQuery` — boolean, on an EN name
 *   - `matchesSearch(country, query, language)` — boolean, on a `Country`
 *   - `findCountryFlexible(freeText)` — free text → canonical EN name (imports)
 */
export function fold(s: string): string {
  return (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/**
 * Former or alternate spellings, shorthands and acronyms that must resolve to
 * a current country.
 *
 * Türkiye asked the UN to retire "Turkey" in English in 2022 and the UN
 * adopted it, so that is the name the app shows. But roughly 120 rows across
 * profiles, conferences, delegates and speakers lists were written under the
 * old spelling, and every allocation, flag and nationality lookup goes through
 * an exact name match — renaming the canonical entry without this table would
 * quietly unresolve all of them. It also catches the diacritic-free "Turkiye"
 * that anyone without an ü on their keyboard will type.
 *
 * This is also the ONE home for the country acronyms ("uk", "drc", "dprk")
 * that used to be copy-pasted into three separate components. A shorthand that
 * lives here is understood by every search box, every paste importer and every
 * flag lookup at once.
 *
 * Keyed on the folded (lowercased, accent-stripped) form. Values MUST be an
 * exact canonical `UN_COUNTRIES[].name`.
 */
export const COUNTRY_NAME_ALIASES: Record<string, string> = {
  // ── Türkiye ────────────────────────────────────────────────────────────────
  turkey: 'Türkiye',
  turkiye: 'Türkiye',
  'republic of turkiye': 'Türkiye',
  'republic of turkey': 'Türkiye',
  // ── Renamed or alternately-spelled states ──────────────────────────────────
  czechia: 'Czech Republic',
  holland: 'Netherlands',
  'the netherlands': 'Netherlands',
  'kingdom of the netherlands': 'Netherlands',
  burma: 'Myanmar',
  swaziland: 'Eswatini',
  macedonia: 'North Macedonia',
  fyrom: 'North Macedonia',
  'former yugoslav republic of macedonia': 'North Macedonia',
  'cape verde': 'Cabo Verde',
  'ivory coast': "Côte d'Ivoire",
  'cote divoire': "Côte d'Ivoire",
  "cote d'ivoire": "Côte d'Ivoire",
  'cote d ivoire': "Côte d'Ivoire",
  'sao tome': 'São Tomé and Príncipe',
  'sao tome and principe': 'São Tomé and Príncipe',
  'sao tome & principe': 'São Tomé and Príncipe',
  'east timor': 'Timor-Leste',
  'timor leste': 'Timor-Leste',
  'vatican city': 'Holy See',
  vatican: 'Holy See',
  'state of palestine': 'Palestine',
  // ── The two Congos — order-independent, both spelled out ───────────────────
  drc: 'DR Congo',
  'dr congo': 'DR Congo',
  'democratic republic of the congo': 'DR Congo',
  'democratic republic of congo': 'DR Congo',
  'congo kinshasa': 'DR Congo',
  'congo drc': 'DR Congo',
  'republic of the congo': 'Congo',
  'congo brazzaville': 'Congo',
  // ── Long-form UN names ─────────────────────────────────────────────────────
  'russian federation': 'Russia',
  'the russian federation': 'Russia',
  rus: 'Russia',
  ussr: 'Russia',
  'soviet union': 'Russia',
  'syrian arab republic': 'Syria',
  'islamic republic of iran': 'Iran',
  'iran islamic republic of': 'Iran',
  'lao pdr': 'Laos',
  'laos pdr': 'Laos',
  "lao people's democratic republic": 'Laos',
  'lao peoples democratic republic': 'Laos',
  'viet nam': 'Vietnam',
  'bolivia plurinational': 'Bolivia',
  'plurinational state of bolivia': 'Bolivia',
  'bolivia plurinational state of': 'Bolivia',
  'venezuela bolivarian': 'Venezuela',
  'bolivarian republic of venezuela': 'Venezuela',
  'venezuela bolivarian republic of': 'Venezuela',
  'united republic of tanzania': 'Tanzania',
  'republic of moldova': 'Moldova',
  'brunei darussalam': 'Brunei',
  'federated states of micronesia': 'Micronesia',
  'micronesia federated states of': 'Micronesia',
  // ── The Koreas ─────────────────────────────────────────────────────────────
  'republic of korea': 'South Korea',
  'korea republic of': 'South Korea',
  rok: 'South Korea',
  dprk: 'North Korea',
  "democratic people's republic of korea": 'North Korea',
  'democratic peoples republic of korea': 'North Korea',
  // ── Acronyms and shorthands (formerly duplicated per-component) ────────────
  uk: 'United Kingdom',
  gb: 'United Kingdom',
  gbr: 'United Kingdom',
  'great britain': 'United Kingdom',
  britain: 'United Kingdom',
  england: 'United Kingdom',
  'the united kingdom': 'United Kingdom',
  'united kingdom of great britain and northern ireland': 'United Kingdom',
  us: 'United States',
  usa: 'United States',
  america: 'United States',
  'the united states': 'United States',
  'united states of america': 'United States',
  uae: 'United Arab Emirates',
  emirates: 'United Arab Emirates',
  'the emirates': 'United Arab Emirates',
  chn: 'China',
  prc: 'China',
  "people's republic of china": 'China',
  'peoples republic of china': 'China',
  fra: 'France',
  roc: 'Taiwan',
  'chinese taipei': 'Taiwan',
  car: 'Central African Republic',
  png: 'Papua New Guinea',
};

/** Canonical EN name → every folded alias key that points at it. Lets a
 *  typeahead match a HALF-typed alias ("turke") as well as a complete one. */
const ALIAS_KEYS_BY_COUNTRY: Map<string, string[]> = (() => {
  const m = new Map<string, string[]>();
  for (const [key, name] of Object.entries(COUNTRY_NAME_ALIASES)) {
    const list = m.get(name);
    if (list) list.push(key);
    else m.set(name, [key]);
  }
  return m;
})();

export function getCountryByName(name: string): Country | undefined {
  const n = fold(name);
  if (!n) return undefined;
  const direct = UN_COUNTRIES.find((c) => fold(c.name) === n);
  if (direct) return direct;
  const aliased = COUNTRY_NAME_ALIASES[n];
  return aliased ? UN_COUNTRIES.find((c) => c.name === aliased) : undefined;
}

/** ISO code when the text names a country, otherwise its folded form. Use this
 *  whenever two free-text country strings from different sources have to be
 *  compared for equality (a stored conference country vs. a filter list). */
export function countryIdentity(name: string): string {
  return getCountryByName(name)?.code ?? fold(name);
}

export function getCountryByCode(code: string): Country | undefined {
  return UN_COUNTRIES.find((c) => c.code.toUpperCase() === code.toUpperCase());
}

export const COUNTRY_NAMES_ES: Record<string, string> = {
  AF: 'Afganistán', AL: 'Albania', DZ: 'Argelia', AD: 'Andorra', AO: 'Angola',
  AG: 'Antigua y Barbuda', AR: 'Argentina', AM: 'Armenia', AU: 'Australia',
  AT: 'Austria', AZ: 'Azerbaiyán', BS: 'Bahamas', BH: 'Baréin', BD: 'Bangladesh',
  BB: 'Barbados', BY: 'Bielorrusia', BE: 'Bélgica', BZ: 'Belice', BJ: 'Benín',
  BT: 'Bután', BO: 'Bolivia', BA: 'Bosnia y Herzegovina', BW: 'Botsuana',
  BR: 'Brasil', BN: 'Brunéi', BG: 'Bulgaria', BF: 'Burkina Faso', BI: 'Burundi',
  CV: 'Cabo Verde', KH: 'Camboya', CM: 'Camerún', CA: 'Canadá', CF: 'República Centroafricana',
  TD: 'Chad', CL: 'Chile', CN: 'China', CO: 'Colombia', KM: 'Comoras',
  CG: 'Congo', CD: 'República Democrática del Congo', CR: 'Costa Rica',
  CI: 'Costa de Marfil', HR: 'Croacia', CU: 'Cuba', CY: 'Chipre',
  CZ: 'República Checa', DK: 'Dinamarca', DJ: 'Yibuti', DM: 'Dominica',
  DO: 'República Dominicana', EC: 'Ecuador', EG: 'Egipto', SV: 'El Salvador',
  GQ: 'Guinea Ecuatorial', ER: 'Eritrea', EE: 'Estonia', SZ: 'Suazilandia',
  ET: 'Etiopía', FJ: 'Fiyi', FI: 'Finlandia', FR: 'Francia', GA: 'Gabón',
  GM: 'Gambia', GE: 'Georgia', DE: 'Alemania', GH: 'Ghana', GR: 'Grecia',
  GD: 'Granada', GT: 'Guatemala', GN: 'Guinea', GW: 'Guinea-Bisáu',
  GY: 'Guyana', HT: 'Haití', HN: 'Honduras', HU: 'Hungría', IS: 'Islandia',
  IN: 'India', ID: 'Indonesia', IR: 'Irán', IQ: 'Irak', IE: 'Irlanda',
  IL: 'Israel', IT: 'Italia', JM: 'Jamaica', JP: 'Japón', JO: 'Jordania',
  KZ: 'Kazajistán', KE: 'Kenia', KI: 'Kiribati', KP: 'Corea del Norte',
  KR: 'Corea del Sur', KW: 'Kuwait', KG: 'Kirguistán', LA: 'Laos', LV: 'Letonia',
  LB: 'Líbano', LS: 'Lesoto', LR: 'Liberia', LY: 'Libia', LI: 'Liechtenstein',
  LT: 'Lituania', LU: 'Luxemburgo', MG: 'Madagascar', MW: 'Malaui',
  MY: 'Malasia', MV: 'Maldivas', ML: 'Malí', MT: 'Malta', MH: 'Islas Marshall',
  MR: 'Mauritania', MU: 'Mauricio', MX: 'México', FM: 'Micronesia',
  MD: 'Moldavia', MC: 'Mónaco', MN: 'Mongolia', ME: 'Montenegro', MA: 'Marruecos',
  MZ: 'Mozambique', MM: 'Myanmar', NA: 'Namibia', NR: 'Nauru', NP: 'Nepal',
  NL: 'Países Bajos', NZ: 'Nueva Zelanda', NI: 'Nicaragua', NE: 'Níger',
  NG: 'Nigeria', NO: 'Noruega', OM: 'Omán', PK: 'Pakistán', PW: 'Palaos',
  PA: 'Panamá', PG: 'Papúa Nueva Guinea', PY: 'Paraguay', PE: 'Perú',
  PH: 'Filipinas', PL: 'Polonia', PT: 'Portugal', QA: 'Catar', RO: 'Rumanía',
  RU: 'Rusia', RW: 'Ruanda', KN: 'San Cristóbal y Nieves', LC: 'Santa Lucía',
  VC: 'San Vicente y las Granadinas', WS: 'Samoa', SM: 'San Marino',
  ST: 'Santo Tomé y Príncipe', SA: 'Arabia Saudita', SN: 'Senegal', RS: 'Serbia',
  SC: 'Seychelles', SL: 'Sierra Leona', SG: 'Singapur', SK: 'Eslovaquia',
  SI: 'Eslovenia', SB: 'Islas Salomón', SO: 'Somalia', ZA: 'Sudáfrica',
  SS: 'Sudán del Sur', ES: 'España', LK: 'Sri Lanka', SD: 'Sudán',
  SR: 'Surinam', SE: 'Suecia', CH: 'Suiza', SY: 'Siria', TW: 'Taiwán',
  TJ: 'Tayikistán', TZ: 'Tanzania', TH: 'Tailandia', TL: 'Timor Oriental',
  TG: 'Togo', TO: 'Tonga', TT: 'Trinidad y Tobago', TN: 'Túnez', TR: 'Turquía',
  TM: 'Turkmenistán', TV: 'Tuvalu', UG: 'Uganda', UA: 'Ucrania',
  AE: 'Emiratos Árabes Unidos', GB: 'Reino Unido', US: 'Estados Unidos',
  UY: 'Uruguay', UZ: 'Uzbekistán', VU: 'Vanuatu', VE: 'Venezuela', VN: 'Vietnam',
  YE: 'Yemen', ZM: 'Zambia', ZW: 'Zimbabue', EU: 'Unión Europea',
  // Non-UN-member / observer states
  PS: 'Palestina', VA: 'Santa Sede', XK: 'Kosovo', CK: 'Islas Cook', NU: 'Niue',
};

export const COUNTRY_NAMES_FR: Record<string, string> = {
  AF: 'Afghanistan', AL: 'Albanie', DZ: 'Algérie', AD: 'Andorre', AO: 'Angola',
  AG: 'Antigua-et-Barbuda', AR: 'Argentine', AM: 'Arménie', AU: 'Australie',
  AT: 'Autriche', AZ: 'Azerbaïdjan', BS: 'Bahamas', BH: 'Bahreïn', BD: 'Bangladesh',
  BB: 'Barbade', BY: 'Biélorussie', BE: 'Belgique', BZ: 'Belize', BJ: 'Bénin',
  BT: 'Bhoutan', BO: 'Bolivie', BA: 'Bosnie-Herzégovine', BW: 'Botswana',
  BR: 'Brésil', BN: 'Brunéi', BG: 'Bulgarie', BF: 'Burkina Faso', BI: 'Burundi',
  CV: 'Cap-Vert', KH: 'Cambodge', CM: 'Cameroun', CA: 'Canada', CF: 'République centrafricaine',
  TD: 'Tchad', CL: 'Chili', CN: 'Chine', CO: 'Colombie', KM: 'Comores',
  CG: 'Congo', CD: 'République démocratique du Congo', CR: 'Costa Rica',
  CI: "Côte d'Ivoire", HR: 'Croatie', CU: 'Cuba', CY: 'Chypre',
  CZ: 'République tchèque', DK: 'Danemark', DJ: 'Djibouti', DM: 'Dominique',
  DO: 'République dominicaine', EC: 'Équateur', EG: 'Égypte', SV: 'El Salvador',
  GQ: 'Guinée équatoriale', ER: 'Érythrée', EE: 'Estonie', SZ: 'Eswatini',
  ET: 'Éthiopie', FJ: 'Fidji', FI: 'Finlande', FR: 'France', GA: 'Gabon',
  GM: 'Gambie', GE: 'Géorgie', DE: 'Allemagne', GH: 'Ghana', GR: 'Grèce',
  GD: 'Grenade', GT: 'Guatemala', GN: 'Guinée', GW: 'Guinée-Bissau',
  GY: 'Guyana', HT: 'Haïti', HN: 'Honduras', HU: 'Hongrie', IS: 'Islande',
  IN: 'Inde', ID: 'Indonésie', IR: 'Iran', IQ: 'Irak', IE: 'Irlande',
  IL: 'Israël', IT: 'Italie', JM: 'Jamaïque', JP: 'Japon', JO: 'Jordanie',
  KZ: 'Kazakhstan', KE: 'Kenya', KI: 'Kiribati', KP: 'Corée du Nord',
  KR: 'Corée du Sud', KW: 'Koweït', KG: 'Kirghizistan', LA: 'Laos', LV: 'Lettonie',
  LB: 'Liban', LS: 'Lesotho', LR: 'Libéria', LY: 'Libye', LI: 'Liechtenstein',
  LT: 'Lituanie', LU: 'Luxembourg', MG: 'Madagascar', MW: 'Malawi',
  MY: 'Malaisie', MV: 'Maldives', ML: 'Mali', MT: 'Malte', MH: 'Îles Marshall',
  MR: 'Mauritanie', MU: 'Maurice', MX: 'Mexique', FM: 'Micronésie',
  MD: 'Moldavie', MC: 'Monaco', MN: 'Mongolie', ME: 'Monténégro', MA: 'Maroc',
  MZ: 'Mozambique', MM: 'Myanmar', NA: 'Namibie', NR: 'Nauru', NP: 'Népal',
  NL: 'Pays-Bas', NZ: 'Nouvelle-Zélande', NI: 'Nicaragua', NE: 'Niger',
  NG: 'Nigéria', NO: 'Norvège', OM: 'Oman', PK: 'Pakistan', PW: 'Palaos',
  PA: 'Panama', PG: 'Papouasie-Nouvelle-Guinée', PY: 'Paraguay', PE: 'Pérou',
  PH: 'Philippines', PL: 'Pologne', PT: 'Portugal', QA: 'Qatar', RO: 'Roumanie',
  RU: 'Russie', RW: 'Rwanda', KN: 'Saint-Kitts-et-Nevis', LC: 'Sainte-Lucie',
  VC: 'Saint-Vincent-et-les-Grenadines', WS: 'Samoa', SM: 'Saint-Marin',
  ST: 'Sao Tomé-et-Principe', SA: 'Arabie saoudite', SN: 'Sénégal', RS: 'Serbie',
  SC: 'Seychelles', SL: 'Sierra Leone', SG: 'Singapour', SK: 'Slovaquie',
  SI: 'Slovénie', SB: 'Îles Salomon', SO: 'Somalie', ZA: 'Afrique du Sud',
  SS: 'Soudan du Sud', ES: 'Espagne', LK: 'Sri Lanka', SD: 'Soudan',
  SR: 'Suriname', SE: 'Suède', CH: 'Suisse', SY: 'Syrie', TW: 'Taïwan',
  TJ: 'Tadjikistan', TZ: 'Tanzanie', TH: 'Thaïlande', TL: 'Timor oriental',
  TG: 'Togo', TO: 'Tonga', TT: 'Trinité-et-Tobago', TN: 'Tunisie', TR: 'Turquie',
  TM: 'Turkménistan', TV: 'Tuvalu', UG: 'Ouganda', UA: 'Ukraine',
  AE: 'Émirats arabes unis', GB: 'Royaume-Uni', US: 'États-Unis',
  UY: 'Uruguay', UZ: 'Ouzbékistan', VU: 'Vanuatu', VE: 'Venezuela', VN: 'Viêt Nam',
  YE: 'Yémen', ZM: 'Zambie', ZW: 'Zimbabwe', EU: 'Union européenne',
  PS: 'Palestine', VA: 'Saint-Siège', XK: 'Kosovo', CK: 'Îles Cook', NU: 'Niue',
};

export const COUNTRY_NAMES_AR: Record<string, string> = {
  AF: 'أفغانستان', AL: 'ألبانيا', DZ: 'الجزائر', AD: 'أندورا', AO: 'أنغولا',
  AG: 'أنتيغوا وبربودا', AR: 'الأرجنتين', AM: 'أرمينيا', AU: 'أستراليا',
  AT: 'النمسا', AZ: 'أذربيجان', BS: 'الباهاما', BH: 'البحرين', BD: 'بنغلاديش',
  BB: 'بربادوس', BY: 'بيلاروسيا', BE: 'بلجيكا', BZ: 'بليز', BJ: 'بنين',
  BT: 'بوتان', BO: 'بوليفيا', BA: 'البوسنة والهرسك', BW: 'بوتسوانا',
  BR: 'البرازيل', BN: 'بروناي', BG: 'بلغاريا', BF: 'بوركينا فاسو', BI: 'بوروندي',
  CV: 'الرأس الأخضر', KH: 'كمبوديا', CM: 'الكاميرون', CA: 'كندا', CF: 'جمهورية أفريقيا الوسطى',
  TD: 'تشاد', CL: 'تشيلي', CN: 'الصين', CO: 'كولومبيا', KM: 'جزر القمر',
  CG: 'الكونغو', CD: 'جمهورية الكونغو الديمقراطية', CR: 'كوستاريكا',
  CI: 'ساحل العاج', HR: 'كرواتيا', CU: 'كوبا', CY: 'قبرص',
  CZ: 'جمهورية التشيك', DK: 'الدنمارك', DJ: 'جيبوتي', DM: 'دومينيكا',
  DO: 'جمهورية الدومينيكان', EC: 'الإكوادور', EG: 'مصر', SV: 'السلفادور',
  GQ: 'غينيا الاستوائية', ER: 'إريتريا', EE: 'إستونيا', SZ: 'إسواتيني',
  ET: 'إثيوبيا', FJ: 'فيجي', FI: 'فنلندا', FR: 'فرنسا', GA: 'الغابون',
  GM: 'غامبيا', GE: 'جورجيا', DE: 'ألمانيا', GH: 'غانا', GR: 'اليونان',
  GD: 'غرينادا', GT: 'غواتيمالا', GN: 'غينيا', GW: 'غينيا بيساو',
  GY: 'غيانا', HT: 'هايتي', HN: 'هندوراس', HU: 'المجر', IS: 'آيسلندا',
  IN: 'الهند', ID: 'إندونيسيا', IR: 'إيران', IQ: 'العراق', IE: 'أيرلندا',
  IL: 'إسرائيل', IT: 'إيطاليا', JM: 'جامايكا', JP: 'اليابان', JO: 'الأردن',
  KZ: 'كازاخستان', KE: 'كينيا', KI: 'كيريباتي', KP: 'كوريا الشمالية',
  KR: 'كوريا الجنوبية', KW: 'الكويت', KG: 'قيرغيزستان', LA: 'لاوس', LV: 'لاتفيا',
  LB: 'لبنان', LS: 'ليسوتو', LR: 'ليبيريا', LY: 'ليبيا', LI: 'ليختنشتاين',
  LT: 'ليتوانيا', LU: 'لوكسمبورغ', MG: 'مدغشقر', MW: 'مالاوي',
  MY: 'ماليزيا', MV: 'المالديف', ML: 'مالي', MT: 'مالطا', MH: 'جزر مارشال',
  MR: 'موريتانيا', MU: 'موريشيوس', MX: 'المكسيك', FM: 'ميكرونيزيا',
  MD: 'مولدوفا', MC: 'موناكو', MN: 'منغوليا', ME: 'الجبل الأسود', MA: 'المغرب',
  MZ: 'موزمبيق', MM: 'ميانمار', NA: 'ناميبيا', NR: 'ناورو', NP: 'نيبال',
  NL: 'هولندا', NZ: 'نيوزيلندا', NI: 'نيكاراغوا', NE: 'النيجر',
  NG: 'نيجيريا', NO: 'النرويج', OM: 'عُمان', PK: 'باكستان', PW: 'بالاو',
  PA: 'بنما', PG: 'بابوا غينيا الجديدة', PY: 'باراغواي', PE: 'بيرو',
  PH: 'الفلبين', PL: 'بولندا', PT: 'البرتغال', QA: 'قطر', RO: 'رومانيا',
  RU: 'روسيا', RW: 'رواندا', KN: 'سانت كيتس ونيفيس', LC: 'سانت لوسيا',
  VC: 'سانت فنسنت والغرينادين', WS: 'ساموا', SM: 'سان مارينو',
  ST: 'ساو تومي وبرينسيبي', SA: 'المملكة العربية السعودية', SN: 'السنغال', RS: 'صربيا',
  SC: 'سيشل', SL: 'سيراليون', SG: 'سنغافورة', SK: 'سلوفاكيا',
  SI: 'سلوفينيا', SB: 'جزر سليمان', SO: 'الصومال', ZA: 'جنوب أفريقيا',
  SS: 'جنوب السودان', ES: 'إسبانيا', LK: 'سريلانكا', SD: 'السودان',
  SR: 'سورينام', SE: 'السويد', CH: 'سويسرا', SY: 'سوريا', TW: 'تايوان',
  TJ: 'طاجيكستان', TZ: 'تنزانيا', TH: 'تايلاند', TL: 'تيمور الشرقية',
  TG: 'توغو', TO: 'تونغا', TT: 'ترينيداد وتوباغو', TN: 'تونس', TR: 'تركيا',
  TM: 'تركمانستان', TV: 'توفالو', UG: 'أوغندا', UA: 'أوكرانيا',
  AE: 'الإمارات العربية المتحدة', GB: 'المملكة المتحدة', US: 'الولايات المتحدة',
  UY: 'أوروغواي', UZ: 'أوزبكستان', VU: 'فانواتو', VE: 'فنزويلا', VN: 'فيتنام',
  YE: 'اليمن', ZM: 'زامبيا', ZW: 'زيمبابوي', EU: 'الاتحاد الأوروبي',
  // Non-UN-member / observer states
  PS: 'فلسطين', VA: 'الكرسي الرسولي', XK: 'كوسوفو', CK: 'جزر كوك', NU: 'نيوي',
};

export function getCountryDisplayName(name: string, language: string): string {
  if (language !== 'es' && language !== 'fr' && language !== 'ar') return name;
  if (language === 'ar') {
    if (name === 'African Union') return 'الاتحاد الأفريقي';
    const country = getCountryByName(name);
    if (!country) return name;
    const fromDict = COUNTRY_NAMES_AR[country.code];
    if (fromDict) return fromDict;
    try {
      const dn = new Intl.DisplayNames(['ar'], { type: 'region' });
      return dn.of(country.code) ?? name;
    } catch {
      return name;
    }
  }
  if (language === 'fr') {
    if (name === 'African Union') return 'Union africaine';
    const country = getCountryByName(name);
    if (!country) return name;
    const fromDict = COUNTRY_NAMES_FR[country.code];
    if (fromDict) return fromDict;
    try {
      const dn = new Intl.DisplayNames(['fr'], { type: 'region' });
      return dn.of(country.code) ?? name;
    } catch {
      return name;
    }
  }
  if (name === 'African Union') return 'Unión Africana';
  const country = getCountryByName(name);
  if (!country) return name;
  const fromDict = COUNTRY_NAMES_ES[country.code];
  if (fromDict) return fromDict;
  try {
    const dn = new Intl.DisplayNames(['es'], { type: 'region' });
    return dn.of(country.code) ?? name;
  } catch {
    return name;
  }
}

// Accent/diacritic-insensitive, language-aware comparator on DISPLAY names
export function compareCountryNames(a: string, b: string, language: string): number {
  return getCountryDisplayName(a, language).localeCompare(
    getCountryDisplayName(b, language), language, { sensitivity: 'base' });
}

/** True when `q` starts a WORD of `haystack` — so "emirates" finds
 *  "United Arab Emirates" and "guinea" finds "Papua New Guinea", without the
 *  noise of a bare substring match. Both arguments must already be folded. */
function startsAWord(haystack: string, q: string): boolean {
  if (haystack.startsWith(q)) return true;
  let i = haystack.indexOf(q, 1);
  while (i !== -1) {
    if (!/[a-z0-9]/.test(haystack[i - 1])) return true;
    i = haystack.indexOf(q, i + 1);
  }
  return false;
}

/**
 * How well `query` matches the country whose canonical EN name is `enName`.
 *
 *   0 — exact (EN or localised name)
 *   1 — exact alias ("turkey", "uk", "drc")
 *   2 — prefix of the name, of its localised name, or of one of its aliases,
 *       at a word boundary ("tu" → Türkiye, "emirates" → United Arab Emirates)
 *   3 — substring anywhere in the name or its localised name
 *   null — no match
 *
 * Every country typeahead should map/filter/sort on this rather than rolling
 * its own two-pass "prefix filter then substring filter" — the ranking is what
 * puts Türkiye above Portugal when someone types "tu".
 */
export function countryMatchRank(enName: string, query: string, language: string): number | null {
  const q = fold(query);
  if (!q) return null;
  const en = fold(enName);
  const display = language && language !== 'en' ? fold(getCountryDisplayName(enName, language)) : '';
  const aliases = ALIAS_KEYS_BY_COUNTRY.get(enName) ?? [];

  if (en === q || (display !== '' && display === q)) return 0;
  if (aliases.includes(q)) return 1;
  if (startsAWord(en, q) || (display !== '' && startsAWord(display, q))) return 2;
  if (aliases.some((a) => startsAWord(a, q))) return 2;
  if (en.includes(q) || (display !== '' && display.includes(q))) return 3;
  return null;
}

/** Shortest name first, alphabetical on ties — a deterministic winner where the
 *  old `.find()` silently depended on UN_COUNTRIES array order. */
function pickShortest(list: Country[]): string {
  return [...list].sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name))[0].name;
}

/** Longest name first — the MOST SPECIFIC name contained in a longer input, so
 *  "Democratic Republic of the Congo" resolves to DR Congo, not to Congo. */
function pickLongest(list: Country[]): string {
  return [...list].sort((a, b) => b.name.length - a.name.length || a.name.localeCompare(b.name))[0].name;
}

/**
 * Free text → canonical EN country name, for paste/CSV importers.
 *
 * The order below is load-bearing. Exact names, then aliases, then localised
 * names, then ISO codes ALL run before the loose fallback, because the loose
 * fallback guesses: it used to resolve "UK" to **Ukraine** (fold('Ukraine')
 * starts with "uk") and "Democratic Republic of the Congo" to **Congo** (the
 * shorter name won on array order). Aliases now claim both, the fallback
 * refuses inputs under 3 characters, and its ties break deterministically.
 */
export function findCountryFlexible(input: string): string | null {
  const n = fold(input);
  if (!n) return null;
  // 1. exact across canonical EN names
  const exact = UN_COUNTRIES.find((c) => fold(c.name) === n);
  if (exact) return exact.name;
  // 2. retired spellings, long-form UN names and acronyms
  const aliased = COUNTRY_NAME_ALIASES[n];
  if (aliased) return aliased;
  // 3. exact across the ES/FR/AR dictionaries (value match → code → EN name)
  for (const dict of [COUNTRY_NAMES_ES, COUNTRY_NAMES_FR, COUNTRY_NAMES_AR]) {
    const codeEntry = Object.entries(dict).find(([, v]) => fold(v) === n);
    if (codeEntry) { const c = UN_COUNTRIES.find((u) => u.code === codeEntry[0]); if (c) return c.name; }
  }
  // 4. a bare ISO 3166-1 alpha-2 code, as rosters are often exported
  if (/^[a-z]{2}$/.test(n)) {
    const byCode = UN_COUNTRIES.find((c) => c.code.toLowerCase() === n);
    if (byCode) return byCode.name;
  }
  // 5. loose fallback — never for 1–2 characters, which are codes or noise
  if (n.length < 3) return null;
  const prefixed = UN_COUNTRIES.filter((c) => fold(c.name).startsWith(n));
  if (prefixed.length) return pickShortest(prefixed);
  const contains = UN_COUNTRIES.filter((c) => fold(c.name).includes(n));
  if (contains.length) return pickShortest(contains);
  const contained = UN_COUNTRIES.filter((c) => n.includes(fold(c.name)));
  if (contained.length) return pickLongest(contained);
  return null;
}

/** Boolean form on a `Country`. An empty search matches everything, so a
 *  picker rendering `UN_COUNTRIES.filter(matchesSearch)` still lists them all. */
export function matchesSearch(c: Country, search: string, language: string): boolean {
  if (!search.trim()) return true;
  return countryMatchRank(c.name, search, language) !== null;
}

/** Boolean form on a canonical EN name. Empty query matches nothing. */
export function matchesCountryQuery(enName: string, query: string, language: string): boolean {
  return countryMatchRank(enName, query, language) !== null;
}

/** The "show these first" tier: exact, alias and word-boundary prefix hits.
 *  Call sites pair it with `matchesCountryQuery` to get a two-tier ordering
 *  without sorting; new call sites should prefer `countryMatchRank` directly. */
export function startsWithCountryQuery(enName: string, query: string, language: string): boolean {
  const rank = countryMatchRank(enName, query, language);
  return rank !== null && rank <= 2;
}

// ── Continents ───────────────────────────────────────────────────────────────
// Follows the UN M49 geoscheme for the handful of transcontinental cases
// (Russia → Europe, Türkiye/Georgia/Armenia/Azerbaijan/Cyprus → Asia).

export type Continent = 'Africa' | 'Asia' | 'Europe' | 'North America' | 'South America' | 'Oceania';

export const COUNTRY_CONTINENTS: Record<string, Continent> = {
  // Africa
  DZ: 'Africa', AO: 'Africa', BJ: 'Africa', BW: 'Africa', BF: 'Africa', BI: 'Africa',
  CV: 'Africa', CM: 'Africa', CF: 'Africa', TD: 'Africa', KM: 'Africa', CG: 'Africa',
  CD: 'Africa', CI: 'Africa', DJ: 'Africa', EG: 'Africa', GQ: 'Africa', ER: 'Africa',
  SZ: 'Africa', ET: 'Africa', GA: 'Africa', GM: 'Africa', GH: 'Africa', GN: 'Africa',
  GW: 'Africa', KE: 'Africa', LS: 'Africa', LR: 'Africa', LY: 'Africa', MG: 'Africa',
  MW: 'Africa', ML: 'Africa', MR: 'Africa', MU: 'Africa', MA: 'Africa', MZ: 'Africa',
  NA: 'Africa', NE: 'Africa', NG: 'Africa', RW: 'Africa', ST: 'Africa', SN: 'Africa',
  SC: 'Africa', SL: 'Africa', SO: 'Africa', ZA: 'Africa', SS: 'Africa', SD: 'Africa',
  TZ: 'Africa', TG: 'Africa', TN: 'Africa', UG: 'Africa', ZM: 'Africa', ZW: 'Africa',

  // Asia
  AF: 'Asia', AM: 'Asia', AZ: 'Asia', BH: 'Asia', BD: 'Asia', BT: 'Asia', BN: 'Asia',
  KH: 'Asia', CN: 'Asia', CY: 'Asia', GE: 'Asia', IN: 'Asia', ID: 'Asia', IR: 'Asia',
  IQ: 'Asia', IL: 'Asia', JP: 'Asia', JO: 'Asia', KZ: 'Asia', KW: 'Asia', KG: 'Asia',
  LA: 'Asia', LB: 'Asia', MY: 'Asia', MV: 'Asia', MN: 'Asia', MM: 'Asia', NP: 'Asia',
  KP: 'Asia', OM: 'Asia', PK: 'Asia', PS: 'Asia', PH: 'Asia', QA: 'Asia', SA: 'Asia',
  SG: 'Asia', KR: 'Asia', LK: 'Asia', SY: 'Asia', TW: 'Asia', TJ: 'Asia', TH: 'Asia',
  TL: 'Asia', TR: 'Asia', TM: 'Asia', AE: 'Asia', UZ: 'Asia', VN: 'Asia', YE: 'Asia',

  // Europe
  AL: 'Europe', AD: 'Europe', AT: 'Europe', BY: 'Europe', BE: 'Europe', BA: 'Europe',
  BG: 'Europe', HR: 'Europe', CZ: 'Europe', DK: 'Europe', EE: 'Europe', FI: 'Europe',
  FR: 'Europe', DE: 'Europe', GR: 'Europe', VA: 'Europe', HU: 'Europe', IS: 'Europe',
  IE: 'Europe', IT: 'Europe', XK: 'Europe', LV: 'Europe', LI: 'Europe', LT: 'Europe',
  LU: 'Europe', MT: 'Europe', MD: 'Europe', MC: 'Europe', ME: 'Europe', NL: 'Europe',
  MK: 'Europe', NO: 'Europe', PL: 'Europe', PT: 'Europe', RO: 'Europe', RU: 'Europe',
  SM: 'Europe', RS: 'Europe', SK: 'Europe', SI: 'Europe', ES: 'Europe', SE: 'Europe',
  CH: 'Europe', UA: 'Europe', GB: 'Europe', EU: 'Europe',

  // North America (incl. Central America + Caribbean)
  AG: 'North America', BS: 'North America', BB: 'North America', BZ: 'North America',
  CA: 'North America', CR: 'North America', CU: 'North America', DM: 'North America',
  DO: 'North America', SV: 'North America', GD: 'North America', GT: 'North America',
  HT: 'North America', HN: 'North America', JM: 'North America', MX: 'North America',
  NI: 'North America', PA: 'North America', KN: 'North America', LC: 'North America',
  VC: 'North America', TT: 'North America', US: 'North America',

  // South America
  AR: 'South America', BO: 'South America', BR: 'South America', CL: 'South America',
  CO: 'South America', EC: 'South America', GY: 'South America', PY: 'South America',
  PE: 'South America', SR: 'South America', UY: 'South America', VE: 'South America',

  // Oceania
  AU: 'Oceania', CK: 'Oceania', FJ: 'Oceania', KI: 'Oceania', MH: 'Oceania',
  FM: 'Oceania', NR: 'Oceania', NZ: 'Oceania', NU: 'Oceania', PW: 'Oceania',
  PG: 'Oceania', WS: 'Oceania', SB: 'Oceania', TO: 'Oceania', TV: 'Oceania', VU: 'Oceania',
};

export function countryToContinent(name: string): Continent | null {
  const country = getCountryByName(name);
  if (!country) return null;
  return COUNTRY_CONTINENTS[country.code] ?? null;
}
