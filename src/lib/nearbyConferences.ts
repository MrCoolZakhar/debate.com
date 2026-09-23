// nearbyConferences.ts — "Conferences near you" on the homepage.
//
// Three conferences for the visitor, chosen in tiers:
//   1. in the visitor's own country,
//   2. in a country it borders (NEIGHBOURS),
//   3. in the same UN M49 sub-region (SUBREGION),
//   4. on the same continent (COUNTRY_CONTINENTS in countries.ts),
//   5. anywhere, soonest first.
// A conference a delegate can apply to (applications open now, or set up and
// opening later) always beats one they cannot; among those, nearer tiers win,
// open-now beats opening-later, then the soonest start. Conferences that take
// no applications are only used to fill the row, so it is always three when
// three upcoming conferences exist anywhere.
//
// Where the visitor is comes ONLY from /api/geo (Vercel's IP-country header,
// first party). Never a third-party lookup (CLAUDE.md §4 / /privacy). The
// server renders the tier-5 answer (no country) so crawlers and a failed geo
// lookup still get a sensible row; the client re-ranks once it has a country.

import { COUNTRY_CONTINENTS, getCountryByName } from '@/lib/countries';

/** UN M49 sub-regions, by ISO alpha-2. Countries absent here fall to the continent tier. */
const SUBREGION: Record<string, string> = {};
function region(name: string, codes: string) {
  for (const c of codes.split(' ')) SUBREGION[c] = name;
}
region('northern-africa', 'DZ EG LY MA SD TN EH');
region('eastern-africa', 'BI KM DJ ER ET KE MG MW MU MZ RW SC SO SS TZ UG ZM ZW');
region('middle-africa', 'AO CM CF TD CG CD GQ GA ST');
region('southern-africa', 'BW SZ LS NA ZA');
region('western-africa', 'BJ BF CV CI GM GH GN GW LR ML MR NE NG SN SL TG');
region('caribbean', 'AG BS BB CU DM DO GD HT JM KN LC VC TT');
region('central-america', 'BZ CR SV GT HN MX NI PA');
region('south-america', 'AR BO BR CL CO EC GY PY PE SR UY VE');
region('northern-america', 'CA US');
region('central-asia', 'KZ KG TJ TM UZ');
region('eastern-asia', 'CN JP KP KR MN TW HK MO');
region('south-eastern-asia', 'BN KH ID LA MY MM PH SG TH TL VN');
region('southern-asia', 'AF BD BT IN IR MV NP PK LK');
region('western-asia', 'AM AZ BH CY GE IQ IL JO KW LB OM PS QA SA SY TR AE YE');
region('eastern-europe', 'BY BG CZ HU MD PL RO RU SK UA');
region('northern-europe', 'DK EE FI IS IE LV LT NO SE GB');
region('southern-europe', 'AL AD BA HR GR VA IT MT ME MK PT SM RS SI ES XK');
region('western-europe', 'AT BE FR DE LI LU MC NL CH');
region('oceania', 'AU NZ FJ PG SB VU WS TO KI MH FM NR PW TV');

/** Land (and a few short-sea) neighbours, by ISO alpha-2. Symmetric where it matters. */
const NEIGHBOURS: Record<string, string> = {
  // Asia
  IN: 'PK NP BT BD LK MM CN MV', PK: 'IN AF IR CN', BD: 'IN MM', NP: 'IN CN', BT: 'IN CN',
  LK: 'IN MV', MV: 'IN LK', AF: 'PK IR TM UZ TJ CN', IR: 'IQ TR AM AZ TM AF PK',
  CN: 'IN PK NP BT MM LA VN KP MN RU KZ KG TJ AF HK MO TW', MN: 'CN RU', KZ: 'RU CN KG UZ TM',
  KG: 'KZ CN TJ UZ', TJ: 'KG CN AF UZ', UZ: 'KZ KG TJ AF TM', TM: 'KZ UZ AF IR',
  JP: 'KR CN', KR: 'JP CN', TW: 'CN JP PH', HK: 'CN MO', MO: 'CN HK',
  TH: 'MM LA KH MY', MY: 'TH ID SG BN', SG: 'MY ID', ID: 'MY TL PG SG', PH: 'TW MY ID',
  VN: 'CN LA KH', LA: 'CN VN KH TH MM', KH: 'TH LA VN', MM: 'IN BD CN LA TH', BN: 'MY', TL: 'ID',
  AE: 'SA OM QA', SA: 'JO IQ KW QA AE OM YE BH', QA: 'SA AE BH', BH: 'SA QA', KW: 'SA IQ',
  OM: 'AE SA YE', YE: 'SA OM', JO: 'SA IQ SY IL PS EG', IQ: 'TR IR KW SA JO SY',
  SY: 'TR IQ JO IL LB', LB: 'SY IL', IL: 'LB SY JO EG PS', PS: 'IL JO EG',
  TR: 'GR BG GE AM AZ IR IQ SY CY', GE: 'TR AM AZ RU', AM: 'TR GE AZ IR', AZ: 'RU GE AM IR TR',
  CY: 'TR GR',
  // Europe
  GB: 'IE FR', IE: 'GB', FR: 'BE LU DE CH IT ES MC AD GB', DE: 'DK PL CZ AT CH FR LU BE NL',
  NL: 'DE BE', BE: 'NL DE LU FR', LU: 'BE DE FR', CH: 'DE AT LI IT FR', AT: 'DE CZ SK HU SI IT CH LI',
  IT: 'FR CH AT SI SM VA MT', ES: 'FR PT AD', PT: 'ES', PL: 'DE CZ SK UA BY LT',
  CZ: 'DE PL SK AT', SK: 'CZ PL UA HU AT', HU: 'AT SK UA RO RS HR SI', SI: 'IT AT HU HR',
  HR: 'SI HU RS BA ME', RS: 'HU RO BG MK XK ME BA HR', BA: 'HR RS ME', ME: 'HR BA RS XK AL',
  AL: 'ME XK MK GR', MK: 'RS XK BG GR AL', XK: 'RS MK AL ME', GR: 'AL MK BG TR CY',
  BG: 'RO RS MK GR TR', RO: 'UA MD HU RS BG', MD: 'RO UA', UA: 'PL SK HU RO MD BY RU',
  BY: 'PL LT LV RU UA', LT: 'LV BY PL', LV: 'EE LT BY RU', EE: 'LV RU FI', FI: 'SE NO RU EE',
  SE: 'NO FI DK', NO: 'SE FI', DK: 'DE SE', IS: 'NO GB', RU: 'NO FI EE LV BY UA GE AZ KZ CN MN',
  MT: 'IT',
  // Africa
  EG: 'LY SD IL PS JO', LY: 'TN DZ NE TD SD EG', TN: 'DZ LY', DZ: 'MA TN LY NE ML MR',
  MA: 'DZ ES', NG: 'BJ NE TD CM GH', GH: 'CI BF TG NG', KE: 'ET SO SS UG TZ',
  TZ: 'KE UG RW BI CD ZM MW MZ', UG: 'KE SS CD RW TZ', ET: 'ER DJ SO KE SS SD',
  ZA: 'NA BW ZW MZ SZ LS', SN: 'MR ML GN GW GM', CI: 'LR GN ML BF GH', CM: 'NG TD CF CG GQ GA',
  RW: 'UG TZ BI CD', ZW: 'ZA BW ZM MZ', ZM: 'CD TZ MW MZ ZW BW NA AO',
  // Americas
  US: 'CA MX', CA: 'US', MX: 'US GT BZ', GT: 'MX BZ SV HN', SV: 'GT HN', HN: 'GT SV NI',
  NI: 'HN CR', CR: 'NI PA', PA: 'CR CO', CO: 'PA VE BR PE EC', VE: 'CO BR GY',
  EC: 'CO PE', PE: 'EC CO BR BO CL', BR: 'UY AR PY BO PE CO VE GY SR', BO: 'PE BR PY AR CL',
  PY: 'BO BR AR', AR: 'CL BO PY BR UY', UY: 'AR BR', CL: 'PE BO AR',
  // Oceania
  AU: 'NZ PG ID', NZ: 'AU', PG: 'ID AU',
};

export interface NearbyCandidate {
  id: string;
  country: string;
  start_date: string | null;
  /** 'open' | 'not_open' | anything else (closed, not set up) */
  window?: string | null;
}

/** ISO alpha-2 for a conference's stored country name ("Türkiye" → TR). */
export function countryCodeOf(name: string | null | undefined): string | null {
  if (!name) return null;
  const hit = getCountryByName(name.trim());
  return hit ? hit.code.toUpperCase() : null;
}

function tierOf(confCode: string | null, visitor: string | null): number {
  if (!visitor || !confCode) return 4;
  if (confCode === visitor) return 0;
  if ((NEIGHBOURS[visitor] ?? '').split(' ').includes(confCode)
    || (NEIGHBOURS[confCode] ?? '').split(' ').includes(visitor)) return 1;
  if (SUBREGION[visitor] && SUBREGION[visitor] === SUBREGION[confCode]) return 2;
  const cont = COUNTRY_CONTINENTS[visitor];
  if (cont && cont === COUNTRY_CONTINENTS[confCode]) return 3;
  return 4;
}

function windowRank(w: string | null | undefined): number {
  if (w === 'open') return 0;
  if (w === 'not_open') return 1;
  return 2;
}

/**
 * The `n` conferences to recommend. `visitorCode` is the ISO alpha-2 of the
 * visitor's country, or null (server render, failed lookup). Callers pass
 * UPCOMING, listed conferences only.
 */
export function recommendNearby<T extends NearbyCandidate>(
  conferences: readonly T[],
  visitorCode: string | null,
  n = 3,
): { picks: T[]; tier: number } {
  const v = visitorCode ? visitorCode.toUpperCase() : null;
  const ranked = conferences
    .map(c => ({ c, tier: tierOf(countryCodeOf(c.country), v), w: windowRank(c.window) }))
    .sort((a, b) =>
      Number(a.w === 2) - Number(b.w === 2)
      || a.tier - b.tier
      || a.w - b.w
      || (a.c.start_date ?? '9999').localeCompare(b.c.start_date ?? '9999'));
  const picks = ranked.slice(0, n);
  return { picks: picks.map(p => p.c), tier: picks.length ? picks[0].tier : 4 };
}
