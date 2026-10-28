// ============================================================
// src/lib/advisorBoard/conferenceWindow.ts
//
// When a faculty advisor may watch a conference's rooms (owner, 23 Oct 2026: "FAs
// shouldn't be looking at committees if the conference hasn't started yet"). The
// conference's FIRST DAY is the only gate (the old advisor release date,
// conferences.session_release_advisors_at, is no longer read on the advisor side), and
// the rooms leave the board after the conference's LAST day.
//
//   before  until 00:00 of the start date in the conference's time zone (local midnight
//           of the start date when the conference has no zone)
//   open    from then until 00:00 of the day after the last day (end_date, else start_date)
//   after   from then on: the rooms are dropped from the board
//   tbd     dates to be decided (dates_tbd, or no start date): not open yet
//
// Pure: `now` is passed in (serverNow() at the call site).
// ============================================================

import { zonedIso } from '../applicationWindow';

export type ConferenceWindowState =
  | { state: 'tbd' }
  | { state: 'before'; opensAt: number; startDate: string }
  | { state: 'open' }
  | { state: 'after' };

export interface ConferenceDates {
  startDate: string | null;
  endDate: string | null;
  timezone?: string | null;
  datesTbd?: boolean | null;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function validZone(tz: string): boolean {
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; }
}

/** 00:00 of `day` (YYYY-MM-DD) in `timeZone`, or local midnight without one. */
export function dayStartMs(day: string, timeZone: string | null | undefined): number {
  if (timeZone && validZone(timeZone)) {
    const ms = new Date(zonedIso(day, 0, 0, timeZone)).getTime();
    if (Number.isFinite(ms)) return ms;
  }
  return new Date(`${day}T00:00:00`).getTime();
}

function nextDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

export function conferenceWindow(c: ConferenceDates, now: number): ConferenceWindowState {
  const start = (c.startDate ?? '').slice(0, 10);
  if (c.datesTbd || !DAY_RE.test(start)) return { state: 'tbd' };
  const opensAt = dayStartMs(start, c.timezone);
  if (!Number.isFinite(opensAt)) return { state: 'tbd' };
  if (now < opensAt) return { state: 'before', opensAt, startDate: start };
  const endRaw = (c.endDate ?? '').slice(0, 10);
  const last = DAY_RE.test(endRaw) && endRaw >= start ? endRaw : start;
  const closesAt = dayStartMs(nextDay(last), c.timezone);
  if (Number.isFinite(closesAt) && now >= closesAt) return { state: 'after' };
  return { state: 'open' };
}

/** The start date as a long date in `locale` ("24 October 2026"). The calendar day
 *  itself, never shifted by the viewer's zone. */
export function formatStartDay(day: string, locale: string): string {
  const [y, m, d] = day.split('-').map(Number);
  try {
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(Date.UTC(y, m - 1, d)));
  } catch {
    return day;
  }
}
