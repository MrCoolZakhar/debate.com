// ── Conference date ordering ─────────────────────────────────────────────────
// A conference's start_date is OPTIONAL (nullable): dates can be left unset, and
// the "dates TBD" flag deliberately stores NULL start/end dates. Sorting such a
// row with a bare `a.start_date.localeCompare(...)` throws
// "Cannot read properties of null" and takes the whole client render down — a
// single dateless row is enough to break a page. Always sort through here.

/**
 * Compare two conference start dates ('YYYY-MM-DD' or null).
 *
 * Undated (TBD) conferences always sort LAST, in BOTH directions — an unknown
 * date is never "the soonest" and never "the latest", it simply isn't on the
 * timeline, so it belongs at the end of either ordering.
 */
/** Today as a local 'YYYY-MM-DD' string, so date-only comparisons never shift
 *  a conference by a day for users west/east of UTC. */
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Has this conference already finished?
 *
 * Used to keep finished conferences out of the public BROWSE surfaces. Their
 * pages stay live, linkable and indexable — this only decides what we put in
 * front of someone shopping for a conference to attend.
 *
 * Rules:
 *  • The last day is `end_date`, falling back to `start_date` for single-day
 *    conferences that never set an end.
 *  • Undated / "dates TBD" conferences are NEVER concluded — an unknown date
 *    hasn't happened yet. (The old `daysUntil` path returned NaN here and
 *    relied on `NaN < 0` being false; this states it outright.)
 *  • A conference running TODAY is still on, so the comparison is strictly
 *    "last day is before today".
 */
export function hasConcluded(
  c: { start_date?: string | null; end_date?: string | null },
  today: string = todayISO(),
): boolean {
  const lastDay = (c.end_date || c.start_date || '').slice(0, 10);
  if (!lastDay) return false;
  return lastDay < today;
}

export function compareStartDate(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: 'asc' | 'desc' = 'asc',
): number {
  const av = a || null;
  const bv = b || null;
  if (!av && !bv) return 0;
  if (!av) return 1;  // a is undated → after b
  if (!bv) return -1; // b is undated → after a
  return direction === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
}

// ── Conference date DISPLAY ──────────────────────────────────────────────────
//
// `conferences.start_date` / `end_date` are Postgres `date` columns and arrive
// as plain 'YYYY-MM-DD' strings. Two things went wrong repeatedly when each
// surface hand-rolled its own formatter, which is why they now all come here:
//
//  1. NO SINGLE-DAY COLLAPSE. A one-day conference has start === end, and a
//     naive "range" formatter renders it "30–30 Aug 2026". Every function below
//     collapses that to "30 Aug 2026".
//
//  2. TIMEZONE DRIFT. `new Date('2026-08-30')` is parsed as UTC midnight, which
//     is 30 Aug 20:00 in New York on the 29th — i.e. `.getDate()` and
//     `.toLocaleDateString()` both report the PREVIOUS DAY for every user west
//     of UTC. We never build a Date from the raw string: `parseDateOnly` pulls
//     the y/m/d fields out with a regex, so the calendar date the organiser
//     typed is the calendar date every viewer sees, everywhere on Earth.
//
// CONSOLIDATING THE VISUAL FORMAT IS DELIBERATELY *NOT* WHAT THIS DOES. The
// call sites disagree on dash spacing, month position and whether a cross-year
// range repeats the start year, and those are seven separate public surfaces.
// Each `style` below reproduces one existing look exactly. If you want them to
// agree, that is a design decision — make it explicitly, don't drift into it.

/** Jan…Dec. The month table every card/detail surface renders. */
export const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/**
 * Intl's en-GB short months. Identical to `MONTHS_SHORT` except September,
 * which modern CLDR renders "Sept", not "Sep".
 *
 * Only `/conferences/roles` used `toLocaleDateString('en-GB', …)` and therefore
 * only that page shows "Sept" today. It keeps this table so fixing the
 * single-day bug does not also silently restyle one live page. New call sites
 * should use the default `MONTHS_SHORT`.
 */
export const MONTHS_SHORT_EN_GB = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec',
] as const;

interface YMD { y: number; m: number; d: number }

/**
 * Read the calendar fields out of a date-only string WITHOUT constructing a
 * Date, so there is no UTC-vs-local shift. Tolerates a full timestamp by
 * matching only the leading date portion.
 */
function parseDateOnly(value: string | null | undefined): YMD | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(value.trim());
  if (!m) return null;
  const y = +m[1], mo = +m[2] - 1, d = +m[3];
  if (mo < 0 || mo > 11 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

/**
 * Which existing visual layout to reproduce. The examples show, in order:
 * single day · same month · same year, different month · different year.
 *
 * - `'dmy'`
 *     30 Aug 2026 · 30–31 Aug 2026 · 30 Aug – 2 Sep 2026 · 30 Dec 2026 – 2 Jan 2027
 * - `'dmy-end-year'` — as `'dmy'`, but a cross-year range carries only the END
 *   year (the compact card style).
 *     30 Aug 2026 · 30–31 Aug 2026 · 30 Aug – 2 Sep 2026 · 30 Dec – 2 Jan 2027
 * - `'dmy-end-year-spaced'` — as `'dmy-end-year'`, but the same-month range uses
 *   a SPACED en dash.
 *     30 Aug 2026 · 30 – 31 Aug 2026 · 30 Aug – 2 Sep 2026 · 30 Dec – 2 Jan 2027
 * - `'md'` — month first, no year at all (the year is rendered separately; see
 *   `splitConferenceDates`). Both months are always named.
 *     Aug 30 · Aug 30 – Aug 31 · Aug 30 – Sep 2 · Dec 30 – Jan 2
 * - `'dm-upper'` — compact ledger form, upper-cased, no year.
 *     30 AUG · 30–31 AUG · 30 AUG – 2 SEP · 30 DEC – 2 JAN
 */
export type ConferenceDateStyle =
  | 'dmy'
  | 'dmy-end-year'
  | 'dmy-end-year-spaced'
  | 'md'
  | 'dm-upper';

export interface FormatConferenceDatesOptions {
  /** Visual layout to reproduce. Default `'dmy'`. */
  style?: ConferenceDateStyle;
  /** Month-name table. Default `MONTHS_SHORT`. */
  months?: readonly string[];
  /**
   * Returned when the conference has NO start date — i.e. dates are unset or
   * `dates_tbd` nulled them out. The existing surfaces disagree here on
   * purpose: the cards say `'TBD'` (the default), `/conferences/roles` says
   * `''` so its whole date row is dropped. Pass whatever that call site did.
   */
  fallback?: string;
}

/**
 * Format a conference's dates for display.
 *
 * A MISSING `end` IS A ONE-DAY CONFERENCE, not missing dates — the same rule
 * `hasConcluded` above already applies (`end_date || start_date`). Only a
 * missing `start` yields `fallback`.
 */
export function formatConferenceDates(
  start: string | null | undefined,
  end: string | null | undefined,
  options: FormatConferenceDatesOptions = {},
): string {
  const { style = 'dmy', months = MONTHS_SHORT, fallback = 'TBD' } = options;

  const s = parseDateOnly(start);
  if (!s) return fallback;
  const e = parseDateOnly(end) ?? s;

  const month = (p: YMD) => months[p.m];
  const single = s.y === e.y && s.m === e.m && s.d === e.d;
  // Both guards matter: a same-MONTH shorthand that forgets the year renders
  // Jun 2026 – Jun 2027 as "12–14 JUN".
  const sameMonth = s.y === e.y && s.m === e.m;

  if (style === 'md') {
    return single
      ? `${month(s)} ${s.d}`
      : `${month(s)} ${s.d} – ${month(e)} ${e.d}`;
  }

  if (style === 'dm-upper') {
    const up = (p: YMD) => month(p).toUpperCase();
    if (single) return `${s.d} ${up(s)}`;
    if (sameMonth) return `${s.d}–${e.d} ${up(s)}`;
    return `${s.d} ${up(s)} – ${e.d} ${up(e)}`;
  }

  if (single) return `${s.d} ${month(s)} ${s.y}`;
  if (sameMonth) {
    const dash = style === 'dmy-end-year-spaced' ? ' – ' : '–';
    return `${s.d}${dash}${e.d} ${month(s)} ${s.y}`;
  }
  // Cross-month: BOTH months must be named. The bug this replaces was
  // `${s.d}–${e.d} ${month(s)}`, which renders 30 Aug – 2 Sep as "30–2 Aug".
  if (s.y === e.y) return `${s.d} ${month(s)} – ${e.d} ${month(e)} ${e.y}`;
  if (style === 'dmy') return `${s.d} ${month(s)} ${s.y} – ${e.d} ${month(e)} ${e.y}`;
  return `${s.d} ${month(s)} – ${e.d} ${month(e)} ${e.y}`;
}

/**
 * Two-line variant for the explore directory rows: the day range on one line
 * ("Aug 30 – Sep 2", or just "Aug 30" for a one-day conference) and the year
 * beneath it ("2026", or "2026–27" when the conference straddles New Year).
 *
 * `fallback` applies to `range` only; `year` is `''` when there is no start.
 */
export function splitConferenceDates(
  start: string | null | undefined,
  end: string | null | undefined,
  options: Pick<FormatConferenceDatesOptions, 'months' | 'fallback'> = {},
): { range: string; year: string } {
  const { months = MONTHS_SHORT, fallback = 'TBD' } = options;

  const s = parseDateOnly(start);
  if (!s) return { range: fallback, year: '' };
  const e = parseDateOnly(end) ?? s;

  return {
    range: formatConferenceDates(start, end, { style: 'md', months, fallback }),
    year: s.y === e.y ? String(s.y) : `${s.y}–${String(e.y).slice(2)}`,
  };
}
