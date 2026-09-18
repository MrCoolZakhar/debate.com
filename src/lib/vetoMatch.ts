import { UN_COUNTRIES, getCountryByName, COUNTRY_NAME_ALIASES } from '@/lib/countries';

// ── Veto matching by country identity ───────────────────────────────────────
// A veto list holds free text ("Russia"), and so does a delegation name — which
// a chair imports from a roster in whatever spelling their conference uses. A
// raw `vetoList.includes(delegation)` therefore MISSES "Russian Federation",
// "United States of America", "USA" and "UK", and a vetoed resolution is silently
// recorded as PASSED. Both sides are resolved to an ISO-3166 alpha-2 identity
// first, and only fall back to string equality when neither side is a country
// (crisis cabinets, corporations, custom delegations).

/** Lowercase, de-accent, and reduce to single-spaced ASCII words. Non-Latin
 *  scripts reduce to '' — callers fall back to the raw string for those. */
function normalizeDelegation(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Spellings that are NOT the canonical UN_COUNTRIES name but mean the same seat.
 *  Keys are pre-normalization; they are normalized when the lookup map is built. */
const DELEGATION_ALIASES: Record<string, string> = {
  // P5 — the ones that actually decide a veto.
  // (alpha-3 forms too — some conferences import rosters as RUS/USA/GBR/CHN/FRA)
  'russian federation': 'RU', 'the russian federation': 'RU', 'rus': 'RU',
  'gbr': 'GB', 'chn': 'CN', 'fra': 'FR',
  'soviet union': 'RU', 'ussr': 'RU', 'union of soviet socialist republics': 'RU',
  'united states of america': 'US', 'the united states': 'US', 'the united states of america': 'US',
  'usa': 'US', 'u s a': 'US', 'u s': 'US', 'america': 'US', 'united states of america usa': 'US',
  'united kingdom of great britain and northern ireland': 'GB', 'the united kingdom': 'GB',
  'uk': 'GB', 'u k': 'GB', 'great britain': 'GB', 'britain': 'GB', 'england': 'GB',
  "people's republic of china": 'CN', 'peoples republic of china': 'CN', 'prc': 'CN',
  'mainland china': 'CN', 'china prc': 'CN',
  'french republic': 'FR', 'the french republic': 'FR',
  // Common roster spellings elsewhere — the same resolver serves custom veto lists.
  'republic of korea': 'KR', 'korea republic of': 'KR', 'rok': 'KR',
  "democratic people's republic of korea": 'KP', 'democratic peoples republic of korea': 'KP', 'dprk': 'KP',
  'democratic republic of the congo': 'CD', 'democratic republic of congo': 'CD', 'drc': 'CD',
  'republic of the congo': 'CG', 'congo brazzaville': 'CG',
  'islamic republic of iran': 'IR', 'iran islamic republic of': 'IR',
  'syrian arab republic': 'SY', 'uae': 'AE', 'the netherlands': 'NL', 'holland': 'NL',
  'turkiye': 'TR', 'czechia': 'CZ', 'burma': 'MM', 'cape verde': 'CV',
  'swaziland': 'SZ', 'macedonia': 'MK', 'vatican city': 'VA', 'vatican': 'VA',
  'ivory coast': 'CI', "cote d'ivoire": 'CI', 'cote divoire': 'CI',
  'bolivarian republic of venezuela': 'VE', 'state of palestine': 'PS',
  'united republic of tanzania': 'TZ', 'viet nam': 'VN', 'laos pdr': 'LA',
};

/** Every spelling this panel understands, normalized → ISO code.
 *
 *  Three layers, lowest precedence first:
 *   1. the canonical UN_COUNTRIES names
 *   2. the app-wide COUNTRY_NAME_ALIASES from countries.ts — the single home
 *      for "Turkey", "Czechia", "DRC", "UK", "Viet Nam" and friends, so a
 *      spelling taught to the search boxes is understood by the veto check too
 *   3. this file's DELEGATION_ALIASES, which stay because they carry forms the
 *      shared table deliberately does not (alpha-3 codes, "U.S.A." with dots —
 *      normalizeDelegation strips punctuation, `fold` does not)
 *  Later layers overwrite earlier ones, so a local entry always wins. */
const DELEGATION_IDENTITY = (() => {
  const map = new Map<string, string>();
  const codeOf = (name: string) => UN_COUNTRIES.find((c) => c.name === name)?.code;
  for (const c of UN_COUNTRIES) map.set(normalizeDelegation(c.name), c.code);
  for (const [alias, canonical] of Object.entries(COUNTRY_NAME_ALIASES)) {
    const key = normalizeDelegation(alias);
    const code = codeOf(canonical);
    if (key && code) map.set(key, code);
  }
  for (const [alias, code] of Object.entries(DELEGATION_ALIASES)) {
    const key = normalizeDelegation(alias);
    if (key) map.set(key, code);
  }
  return map;
})();

/**
 * Resolve a free-text delegation name to an ISO-3166 alpha-2 code, or null when
 * it is not a country (custom delegation, crisis character, corporation).
 */
export function delegationIdentity(value: string | null | undefined): string | null {
  const raw = (value ?? '').trim();
  if (!raw) return null;
  // Shared resolver first: canonical name or app-wide alias, folded so accents
  // and case never matter ("türkiye", "Turkey", "TURKIYE" are one seat).
  const exact = getCountryByName(raw);
  if (exact) return exact.code;
  const key = normalizeDelegation(raw);
  if (!key) return null;
  const hit = DELEGATION_IDENTITY.get(key);
  if (hit) return hit;
  // A roster imported as bare ISO codes ("US", "GB", "CN").
  if (/^[a-z]{2}$/.test(key)) {
    const byCode = UN_COUNTRIES.find((c) => c.code.toLowerCase() === key);
    if (byCode) return byCode.code;
  }
  return null;
}

/** Case/spacing-insensitive key used when neither side resolves to a country.
 *  Falls back to the raw lowercased string for non-Latin names. */
function looseKey(value: string): string {
  return normalizeDelegation(value) || value.trim().toLowerCase();
}

/** True when a veto-list entry and a delegation name are the same seat. */
export function vetoEntryMatches(entry: string, delegation: string): boolean {
  const a = delegationIdentity(entry);
  const b = delegationIdentity(delegation);
  if (a && b) return a === b;
  return looseKey(entry) === looseKey(delegation);
}

/** True when any of `delegations` is a veto holder under `vetoList`. */
export function isVetoDelegation(vetoList: string[], delegation: string): boolean {
  return vetoList.some((entry) => vetoEntryMatches(entry, delegation));
}

/** Veto entries that match NO delegation in the room. A silent no-match is exactly
 *  how a missing veto hides, so the panel surfaces these. */
export function unmatchedVetoEntries(vetoList: string[], delegations: string[]): string[] {
  return vetoList.filter((entry) => entry.trim() && !delegations.some((d) => vetoEntryMatches(entry, d)));
}

