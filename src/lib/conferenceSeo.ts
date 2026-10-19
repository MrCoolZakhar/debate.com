// conferenceSeo.ts — the words a search result shows for a conference page
// (/conferences/[slug]): the <title>, the meta description and the short
// server-rendered summary under the overview. Pure functions of data the page
// already loads, so they are safe on the server and testable by eye.
//
// WHY THE SHAPE (Search Console, Oct 2026): people search a conference by its
// short name and year ("gamun", "csmun 2026", "worldmun 2027") and we ranked
// on page one yet got almost no clicks, because the title opened with a long
// chain of "·" pieces and the description spent its first words on boilerplate.
// So the title leads with the searched name and year, then the full name and
// the place, and stays near 60 characters; the description leads with name,
// dates and place, then the facts a delegate decides on (is it open, until
// when, what it costs, how many committees). No en or em dashes (CLAUDE.md
// §8), and a name is never cut off with "…": a long title drops whole parts.

import { formatConferenceDates, hasConcluded, hasNoDates, DATES_TO_BE_DECIDED } from '@/lib/conferenceDates';
import { delegatePriceLabel, type DelegatePrice } from '@/lib/publicFees';

export interface ConferenceSeoInput {
  full_name: string | null;
  acronym: string | null;
  city: string | null;
  country: string | null;
  format: string | null;
  start_date: string | null;
  end_date: string | null;
  dates_tbd?: boolean | null;
  timezone?: string | null;
}

/** The delegate application window as public pages see it (listedConferences.windowState). */
export interface DelegateWindow {
  state: 'open' | 'not_open' | 'closed' | 'disabled';
  openAt: string | null;
  closeAt: string | null;
}

export const NO_WINDOW: DelegateWindow = { state: 'disabled', openAt: null, closeAt: null };

const TITLE_TARGET = 60;
const DESCRIPTION_MAX = 160;

const tidy = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

/** "Model United Nations", "Model UN", "...MUN" already say what it is. */
const SAYS_MUN = /mun\b|model\s+u(nited\s+)?n(ations?)?\b/i;

function yearOf(c: ConferenceSeoInput): string {
  return hasNoDates(c) ? '' : (c.start_date ?? '').slice(0, 4);
}

/** True when `text` already carries the year, as "2026" or a trailing "26". */
function carriesYear(text: string, year: string): boolean {
  if (!year) return true;
  return text.includes(year) || new RegExp(`(^|\\D)${year.slice(2)}$`).test(text);
}

function withoutYear(text: string, year: string): string {
  if (!year) return text;
  return tidy(text.replace(new RegExp(`[\\s,]*\\b${year}\\b[\\s,]*`, 'g'), ' '));
}

function isOnline(c: ConferenceSeoInput): boolean {
  return c.format === 'online' || /^online$/i.test(tidy(c.city));
}

/** The searched name: the acronym with the year ("GAMUN 2026"), else the full name with it. */
export function conferenceShortName(c: ConferenceSeoInput): string {
  const acronym = tidy(c.acronym);
  const lead = acronym || tidy(c.full_name) || 'Conference';
  const year = yearOf(c);
  return carriesYear(lead, year) ? lead : `${lead} ${year}`;
}

/** The full name when it says more than the acronym, without a year the short name already has. */
function longName(c: ConferenceSeoInput): string {
  const acronym = tidy(c.acronym);
  const full = tidy(c.full_name);
  if (!acronym || !full) return '';
  const short = conferenceShortName(c);
  const year = shownYear(c);
  const stripped = carriesYear(short, year) ? withoutYear(full, year) : full;
  if (!stripped || sameName(stripped, acronym, year) || sameName(stripped, short, year)) return '';
  return stripped;
}

/** The year the short name shows: the start year, else one the acronym carries ("BanMUN 2027"). */
function shownYear(c: ConferenceSeoInput): string {
  return yearOf(c) || (tidy(c.acronym).match(/\b(19|20)\d{2}\b/)?.[0] ?? '');
}

/** "TEDUTRAIN'26" says nothing "TEDUTRAIN 2026" does not. */
function sameName(a: string, b: string, year: string): boolean {
  const bare = (s: string) => {
    const t = s.toLowerCase().replace(/[^a-z0-9]/g, '');
    return year ? t.replace(new RegExp(`(${year}|${year.slice(2)})$`), '') : t;
  };
  return bare(a) === bare(b);
}

/** "ANKARA" reads as "Ankara"; anything typed in mixed case is left alone. */
function placeCase(s: string): string {
  const t = tidy(s);
  if (t.length <= 3 || t !== t.toUpperCase() || t === t.toLowerCase()) return t;
  return t.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, p: string, ch: string) => p + ch.toUpperCase());
}

/**
 * "<Short name> <year>: <Full name>, <City or Online>" plus " · Model UN
 * conference" only when no part of the name says Model UN, then the brand.
 * Over about 60 characters it drops the place when the full name already
 * contains it, then the full name, never a part of a word.
 */
export function conferenceSeoTitle(c: ConferenceSeoInput): string {
  const short = conferenceShortName(c);
  const full = longName(c);
  const city = placeCase(c.city ?? '');
  const place = isOnline(c) ? 'Online' : city;
  const placeInName = !!place && full.toLowerCase().includes(place.toLowerCase());
  const says = SAYS_MUN.test(`${short} ${full}`);
  const suffix = says ? '' : ' · Model UN conference';

  const build = (withFull: boolean, withPlace: boolean) =>
    `${short}${withFull && full ? `: ${full}` : ''}${withPlace && place ? `, ${place}` : ''}`;

  const candidates = [
    build(true, true),
    ...(placeInName ? [build(true, false)] : []),
    build(false, true),
  ];
  const core = candidates.find((t) => (t + suffix).length <= TITLE_TARGET) ?? candidates[candidates.length - 1];
  return `${core}${suffix} | Gavelling`;
}

/** "21 to 22 Nov 2026", "30 Aug to 2 Sep 2026", "5 Dec 2026"; '' when undated. */
export function conferenceDateText(c: ConferenceSeoInput): string {
  if (hasNoDates(c)) return '';
  return formatConferenceDates(c.start_date, c.end_date, { style: 'dmy-end-year-spaced', fallback: '' })
    .replace(/\s*[–—-]\s*/g, ' to ');
}

/** "8 Jan 2027" for an instant, as the day it is in the conference's timezone. */
export function windowDayText(iso: string, timeZone: string | null | undefined): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  try {
    return d.toLocaleDateString('en-GB', { ...opts, timeZone: timeZone || 'UTC' });
  } catch {
    return d.toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });
  }
}

/** "Global Assembly Model United Nations (GAMUN 2026)", or the short name alone. */
function nameForSentence(c: ConferenceSeoInput): string {
  const full = tidy(c.full_name);
  const acronym = tidy(c.acronym);
  const short = conferenceShortName(c);
  // No acronym: the short name IS the full name (with its year).
  if (!full || !acronym) return short;
  const year = shownYear(c);
  if (sameName(full, acronym, year)) return carriesYear(full, year) ? full : short;
  // "Harvard WorldMUN 2027 (WORLDMUN)", never the year twice.
  const inBrackets = year && full.includes(year) ? acronym : short;
  return `${full} (${inBrackets})`;
}

/** "runs online from 21 to 22 Nov 2026" / "ran in Riga, Latvia on 14 Mar 2027". */
function whereAndWhen(c: ConferenceSeoInput): string {
  const over = hasConcluded(c);
  const verb = over ? 'ran' : 'runs';
  const placeParts = [placeCase(c.city ?? ''), placeCase(c.country ?? '')].filter((p) => p && !/^online$/i.test(p));
  const where = c.format === 'online' || (isOnline(c) && placeParts.length === 0)
    ? 'online'
    : placeParts.length
      ? `in ${placeParts.join(', ')}${c.format === 'hybrid' ? ' and online' : ''}`
      : '';
  const dates = conferenceDateText(c);
  const single = !hasNoDates(c) && (!c.end_date || c.end_date === c.start_date);
  const when = dates ? `${single ? 'on' : 'from'} ${dates}` : `(${DATES_TO_BE_DECIDED.toLowerCase()})`;
  return [verb, where, when].filter(Boolean).join(' ');
}

/** The application sentence, or '' when there is nothing true to say. */
export function delegateWindowSentence(c: ConferenceSeoInput, w: DelegateWindow): string {
  if (hasConcluded(c)) return '';
  if (w.state === 'open') {
    const until = w.closeAt ? windowDayText(w.closeAt, c.timezone) : '';
    return until ? `Delegate applications are open until ${until}.` : 'Delegate applications are open.';
  }
  if (w.state === 'not_open') {
    const from = w.openAt ? windowDayText(w.openAt, c.timezone) : '';
    return from ? `Delegate applications open on ${from}.` : 'Delegate applications open soon.';
  }
  if (w.state === 'closed') return 'Delegate applications are closed.';
  return '';
}

export function delegateFeeSentence(price: DelegatePrice): string {
  if (price.kind === 'free') return 'Free for delegates.';
  if (price.kind === 'paid') return `Delegate fee from ${delegatePriceLabel(price)}.`;
  return 'Delegate fee to be announced.';
}

export interface CommitteeLite {
  name: string;
  abbreviation: string | null;
}

function committeesSentence(committees: readonly CommitteeLite[], named: number): string {
  const n = committees.length;
  if (n === 0) return '';
  const labels = committees
    .map((c) => tidy(c.abbreviation) || tidy(c.name))
    .filter(Boolean)
    .slice(0, named);
  const count = `${n} ${n === 1 ? 'committee' : 'committees'}`;
  if (labels.length === 0 || named === 0) return `${count}.`;
  if (n === 1) return `1 committee: ${labels[0]}.`;
  const list = labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
  return `${count} including ${list}.`;
}

/**
 * The meta description: name, place and dates first, then whether delegate
 * applications are open and until when, the delegate fee, the committees. A
 * fact is added only while the whole stays within about 160 characters, so a
 * snippet is never cut mid-sentence by us.
 */
export function conferenceSeoDescription(
  c: ConferenceSeoInput,
  committees: readonly CommitteeLite[],
  price: DelegatePrice,
  w: DelegateWindow,
): string {
  const says = SAYS_MUN.test(`${tidy(c.acronym)} ${tidy(c.full_name)}`);
  const name = nameForSentence(c);
  let out = `${name}${says ? '' : ', a Model UN conference,'} ${whereAndWhen(c)}.`;
  const over = hasConcluded(c);
  const add = (s: string) => {
    if (s && `${out} ${s}`.length <= DESCRIPTION_MAX) out = `${out} ${s}`;
  };
  add(delegateWindowSentence(c, w));
  if (!over) add(delegateFeeSentence(price));
  // The most committees that still fit, named; else the bare count.
  const sentence = [2, 1, 0].map((k) => committeesSentence(committees, k)).find((s) => s && `${out} ${s}`.length <= DESCRIPTION_MAX);
  if (sentence) add(sentence);
  if (!over && w.state === 'open') add('Apply on Gavelling.');
  return out;
}

/**
 * The server-rendered summary under the overview: every fact the page holds
 * in one plain paragraph, so no conference page is thin when the organiser
 * wrote little (CLAUDE.md §3, indexability). Never a limit on length here:
 * it is page text, not a snippet.
 */
export function conferenceSummary(
  c: ConferenceSeoInput & { student_level?: string | null; expected_delegates?: number | null },
  committees: readonly CommitteeLite[],
  price: DelegatePrice,
  w: DelegateWindow,
): string {
  const says = SAYS_MUN.test(`${tidy(c.acronym)} ${tidy(c.full_name)}`);
  const parts: string[] = [`${nameForSentence(c)}${says ? '' : ', a Model UN conference,'} ${whereAndWhen(c)}.`];
  const level = tidy(c.student_level).toLowerCase();
  const levelText = level === 'school' || level === 'high_school' || level === 'high school'
    ? 'high school students'
    : level === 'university'
      ? 'university students'
      : level === 'both'
        ? 'high school and university students'
        : '';
  const expected = c.expected_delegates && c.expected_delegates > 0 ? c.expected_delegates : 0;
  if (levelText || expected) {
    parts.push(`It is for ${levelText || 'delegates'}${expected ? `, with about ${expected.toLocaleString('en')} delegates expected` : ''}.`);
  }
  if (committees.length) {
    const labels = committees.map((cm) => {
      const name = tidy(cm.name);
      const abbr = tidy(cm.abbreviation);
      return abbr && abbr.toLowerCase() !== name.toLowerCase() ? `${name} (${abbr})` : name;
    }).filter(Boolean);
    const list = labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
    parts.push(`${committees.length === 1 ? 'Its committee is' : `Its ${committees.length} committees are`} ${list}.`);
  }
  const window = delegateWindowSentence(c, w);
  if (window) parts.push(window);
  if (!hasConcluded(c)) parts.push(delegateFeeSentence(price));
  return parts.join(' ');
}
