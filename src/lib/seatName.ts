// ─────────────────────────────────────────────────────────────────────────────
// seatName: the ONE rule for showing a delegation or character name in a session
// (owner, Oct 2026: "when there is a country or especially character with multiple
// names, it still cuts off. The multiple line with a smaller font below would
// definitely work. Apply it everywhere there.")
//
// A long seat name is never cut with "…" (CLAUDE.md §8). It becomes TWO rows: a short
// form at the size the surface already uses, and the FULL name smaller beneath it,
// wrapping. `splitSeatName` decides the short form; `<SeatName>`
// (src/components/SeatName.tsx) draws it. A name that is already short comes back
// with `split: false` and is drawn exactly as before, once.
//
// A KNOWN COUNTRY is the exception (owner, 21 Oct 2026: "just show USA"): its short form
// ("USA", "UK", "UAE", "DRC", "United Kingdom") comes back with `alone: true` and is
// drawn ALONE, one row, the full name kept as the title and for screen readers.
// `seatFitFontPx` / `seatFitFontCss` step the size down for a name that is still too
// long for a narrow slot (the floor queue, the sidebar), so it fits without an ellipsis
// and without breaking a word.
//
// The short form is TAKEN FROM THE NAME, in this order (first hit wins):
//   1. the canonical short name of a known country ("United Kingdom of Great Britain
//      and Northern Ireland" -> "United Kingdom"), localized when a language is given;
//   2. an acronym the name itself spells out ("Ministry of Magic (MOM)" -> "MOM"),
//      never when the part before it is a person ("Dharmendra Pradhan (BJP)");
//   3. the part before a comma, bracket, colon or dash ("Vyacheslav Molotov, Foreign
//      Minister" -> "Vyacheslav Molotov");
//   4. a person's name without the title, else the surname with its particles
//      ("General Charles de Gaulle" -> "de Gaulle");
//   5. for a title with "of" ("Minister of Foreign Affairs of the Russian Federation"),
//      the initials of its capitalised words ("MFARF"), 3 to 6 letters;
//   6. the first whole words that fit.
// Pure: no I/O, no state.
// ─────────────────────────────────────────────────────────────────────────────

import { getCountryByName, getCountryDisplayName } from '@/lib/countries';
import { acronymInName } from '@/lib/presetNames';

/** Default: names up to this many characters are shown once, as they always were. */
export const SEAT_NAME_MAX = 18;

export type SeatNameParts = {
  /** The line that is drawn. Equal to `full` when neither split nor alone. */
  short: string;
  /** The whole name, exactly as given. */
  full: string;
  /** True when the name is drawn as two rows (short big, full small beneath). */
  split: boolean;
  /** True when a known country's short form is drawn ALONE, one row; `full` goes in the title. */
  alone: boolean;
};

const TITLES = [
  'field marshal', 'vice president', 'prime minister', 'deputy prime minister', 'foreign minister',
  'secretary general', 'secretary-general', 'lieutenant general', 'major general', 'brigadier general',
  'rear admiral', 'vice admiral', 'grand duke', 'crown prince', 'supreme leader', 'his majesty', 'her majesty',
  'general', 'gen.', 'gen', 'lt.', 'lieutenant', 'colonel', 'col.', 'admiral', 'adm.', 'marshal', 'major',
  'maj.', 'captain', 'capt.', 'commander', 'cmdr.', 'president', 'pres.', 'premier', 'chancellor', 'minister',
  'senator', 'sen.', 'ambassador', 'amb.', 'secretary', 'governor', 'gov.', 'mayor', 'judge', 'justice',
  'king', 'queen', 'prince', 'princess', 'emperor', 'empress', 'sultan', 'sheikh', 'shaikh', 'emir', 'amir',
  'tsar', 'czar', 'tsarina', 'kaiser', 'shah', 'pharaoh', 'pope', 'cardinal', 'archbishop', 'bishop',
  'father', 'rev.', 'reverend', 'sir', 'dame', 'lord', 'lady', 'duke', 'duchess', 'count', 'countess',
  'baron', 'baroness', 'dr.', 'dr', 'doctor', 'prof.', 'professor', 'mr.', 'mr', 'mrs.', 'mrs', 'ms.', 'ms',
  'mx.', 'comrade', 'chairman', 'director', 'commissioner', 'agent',
];

/** Lower-case words that sit inside a surname ("de Gaulle", "van der Bellen", "bin Salman"). */
const PARTICLES = new Set([
  'de', 'da', 'di', 'du', 'del', 'della', 'der', 'den', 'van', 'von', 'la', 'le', 'al', 'el', 'al-',
  'bin', 'ibn', 'bint', 'ben', 'dos', 'das', 'do', 'zu', 'ter', 'ten', 'y',
]);

/** Small words never counted as part of an acronym or left dangling at the end of a short form. */
const STOPWORDS = new Set([
  'of', 'the', 'and', 'for', 'to', 'in', 'on', 'at', 'a', 'an', 'de', 'del', 'des', 'la', 'le', 'les',
  'du', 'y', 'e', 'et', 'da', 'do', 'di', 'von', 'van', 'für', 'في', 'من', 'و',
]);

/** A word that makes two capitalised words a body, not a person ("European Commission"). */
const BODY_WORDS = new Set([
  'commission', 'council', 'union', 'bank', 'organization', 'organisation', 'agency', 'committee',
  'republic', 'kingdom', 'ministry', 'party', 'front', 'army', 'navy', 'federation', 'league', 'court',
  'assembly', 'parliament', 'fund', 'group', 'movement', 'association', 'corporation', 'company',
  'office', 'department', 'bureau', 'service', 'forces', 'nations', 'states', 'society', 'institute',
  'university', 'church', 'press', 'times', 'news', 'red', 'cross', 'crescent', 'emirates', 'islands',
  'community', 'alliance', 'coalition', 'command', 'guard', 'police', 'senate', 'house', 'cabinet',
]);

/** The short forms people use for long country names (moved here from the chair page's
 *  speaker strip, which used them alone and dropped the full name). English only. */
export const COUNTRY_SHORT: Record<string, string> = {
  'United Kingdom': 'UK',
  'United States': 'USA',
  'United Arab Emirates': 'UAE',
  'South Korea': 'S. Korea',
  'North Korea': 'N. Korea',
  'DR Congo': 'DRC',
  'Dominican Republic': 'D.R.',
  'Central African Republic': 'CAR',
  'Papua New Guinea': 'PNG',
  'Trinidad and Tobago': 'T&T',
  'Bosnia and Herzegovina': 'BiH',
  'Saint Kitts and Nevis': 'St. Kitts',
  'Saint Vincent and the Grenadines': 'St. Vincent',
  'Antigua and Barbuda': 'Antigua',
  'Equatorial Guinea': 'Eq. Guinea',
};

const UPPER = /^\p{Lu}/u;

function words(s: string): string[] {
  return s.split(/\s+/).filter(Boolean);
}

/** Drops leading honorific titles: "General Charles de Gaulle" -> "Charles de Gaulle". */
function stripTitles(name: string): string {
  let rest = name.trim();
  for (let guard = 0; guard < 4; guard++) {
    const lower = rest.toLowerCase();
    const hit = TITLES.find((t) => lower.startsWith(t + ' '));
    if (!hit) break;
    rest = rest.slice(hit.length).trim();
  }
  return rest;
}

/** 2 to 4 words, each capitalised, an initial ("F.") or a surname particle; no "of". */
function looksLikePerson(name: string): boolean {
  const ws = words(name);
  if (ws.length < 2 || ws.length > 5) return false;
  if (/\d/.test(name)) return false;
  if (ws.some((w) => ['of', 'for', 'and', 'the'].includes(w.toLowerCase()))) return false;
  if (ws.some((w) => BODY_WORDS.has(w.toLowerCase().replace(/[^\p{L}]/gu, '')))) return false;
  return ws.every((w) => UPPER.test(w) || PARTICLES.has(w.toLowerCase()) || /^\p{L}\.$/u.test(w));
}

/** "Charles de Gaulle" -> "de Gaulle", "Mohammed bin Salman" -> "bin Salman". */
function surname(name: string): string {
  const ws = words(name);
  let i = ws.length - 1;
  while (i > 0 && PARTICLES.has(ws[i - 1].toLowerCase())) i--;
  return ws.slice(i).join(' ');
}

function initials(name: string): string {
  return words(name.replace(/[-/]+/g, ' '))
    .filter((w) => !STOPWORDS.has(w.toLowerCase()) && UPPER.test(w))
    .map((w) => w.match(/\p{L}/u)?.[0] ?? '')
    .join('')
    .toUpperCase();
}

/** The first whole words that fit in `max`, never ending on "of" / "the" / "and". */
function firstWords(name: string, max: number): string {
  const ws = words(name);
  const out: string[] = [];
  for (const w of ws) {
    const next = [...out, w].join(' ');
    if (out.length > 0 && next.length > max) break;
    out.push(w);
  }
  while (out.length > 1 && STOPWORDS.has(out[out.length - 1].toLowerCase())) out.pop();
  return out.join(' ').replace(/[,:;–—-]+$/, '').trim();
}

function shortFor(name: string, max: number, language: string | undefined, depth = 0): string {
  // 1. A known country: its canonical short name. A country whose own name is long
  //    ("Bosnia and Herzegovina") is never shortened: it simply wraps.
  const country = getCountryByName(name);
  if (country) {
    const canon = language ? getCountryDisplayName(country.name, language) : country.name;
    const english = !language || language === 'en';
    const abbrev = english ? COUNTRY_SHORT[country.name] : undefined;
    if (canon && canon.length <= max && canon.length < name.length) return canon;
    if (abbrev && abbrev.length < name.length) return abbrev;
    return canon && canon.length < name.length ? canon : '';
  }
  // The part before a comma, bracket, colon or dash (step 3).
  const lead = name.split(/\s*(?:,|\(|\[|:|\s[–—-]\s)\s*/)[0]?.trim() ?? '';
  // 2. An acronym the name itself states, unless what comes before it is a
  //    PERSON (25 Oct 2026): "Dharmendra Pradhan (BJP)" is the minister, and
  //    the bracket is his party, so a Lok Sabha room must not read "BJP, BJP,
  //    BJP". The name is the main label (step 3) and the full text sits beneath.
  //    A body keeps its acronym: "United Nations Security Council (UNSC)",
  //    "Ministry of Magic (MOM)".
  const personLead = lead.length >= 2 && lead.length < name.length && looksLikePerson(stripTitles(lead));
  const stated = personLead ? null : acronymInName(name);
  if (stated && stated.length < name.length) return stated;
  // 3. The part before a comma, bracket, colon or dash.
  if (lead.length >= 2 && lead.length < name.length) {
    return lead.length <= max || depth > 0 ? lead : shortFor(lead, max, language, depth + 1);
  }
  // 4. A person: without the title, else the surname.
  const bare = stripTitles(name);
  if (looksLikePerson(bare)) {
    if (bare.length <= max && bare.length < name.length) return bare;
    const sn = surname(bare);
    if (sn && sn.length < name.length) return sn;
  }
  // 5. A title with "of": initials of its capitalised words.
  if (/\sof\s/i.test(name)) {
    const ac = initials(name);
    if (ac.length >= 3 && ac.length <= 6) return ac;
  }
  // 6. The first words that fit, only for a long name of four words or more. Anything
  //    shorter has no honest short form and wraps whole ("European Commission").
  return words(name).length >= 4 ? firstWords(name, max) : '';
}

/**
 * Splits a seat name into a short form and the full name. `name` is what the surface
 * shows (already localized); `language` lets a known country's short name be localized.
 * Names of `max` characters or fewer are never split.
 */
export function splitSeatName(name: string | null | undefined, opts: { max?: number; language?: string } = {}): SeatNameParts {
  const full = (name ?? '').trim();
  const max = opts.max ?? SEAT_NAME_MAX;
  if (full.length <= max) return { short: full, full, split: false, alone: false };
  const short = shortFor(full, max, opts.language).trim();
  if (!short || short.length >= full.length || short.toLowerCase() === full.toLowerCase()) {
    return { short: full, full, split: false, alone: false };
  }
  // A known country's short form is a name in its own right: shown alone.
  if (getCountryByName(full)) return { short, full, split: false, alone: true };
  return { short, full, split: true, alone: false };
}

// ── Fitting a name to a narrow slot ─────────────────────────────────────────────
// Measure-free: the size comes from the character counts alone. GLYPH_EM is a slight
// over-estimate of an Inter glyph's average advance at weight 600, so a name judged to
// fit really does. Two conditions: the LONGEST word fits on one line (so it never breaks
// mid-word) and the whole name fits in `lines` lines.

const GLYPH_EM = 0.58;

function fitCounts(text: string): { longest: number; total: number } {
  const t = (text ?? '').trim();
  const longest = words(t).reduce((m, w) => Math.max(m, [...w].length), 0);
  return { longest, total: [...t].length };
}

/** A font size in px for `text` in a slot `widthPx` wide: `basePx` when it fits, else a
 *  half-pixel step smaller, never below `minPx` (default 75% of the base). */
export function seatFitFontPx(
  text: string, widthPx: number, basePx: number, opts: { minPx?: number; lines?: number } = {},
): number {
  const { longest, total } = fitCounts(text);
  const min = Math.min(basePx, opts.minPx ?? basePx * 0.75);
  if (!longest || widthPx <= 0) return basePx;
  const lines = Math.max(1, opts.lines ?? 2);
  const byWord = widthPx / (longest * GLYPH_EM);
  const byLines = (widthPx * lines) / (total * GLYPH_EM);
  const fit = Math.min(basePx, byWord, byLines);
  return Math.max(min, Math.floor(fit * 2) / 2);
}

/** The same rule as a CSS `font-size` in container units, for a slot whose width is not
 *  known in px (a resizable sidebar). The nearest ancestor needs `container-type: inline-size`. */
export function seatFitFontCss(
  text: string, basePx: number, opts: { minPx?: number; lines?: number } = {},
): string {
  const { longest, total } = fitCounts(text);
  const min = Math.min(basePx, opts.minPx ?? basePx * 0.75);
  if (!longest) return `${basePx}px`;
  const lines = Math.max(1, opts.lines ?? 2);
  const byWord = (100 / (longest * GLYPH_EM)).toFixed(3);
  const byLines = ((100 * lines) / (total * GLYPH_EM)).toFixed(3);
  return `clamp(${min}px, min(${byWord}cqi, ${byLines}cqi), ${basePx}px)`;
}
