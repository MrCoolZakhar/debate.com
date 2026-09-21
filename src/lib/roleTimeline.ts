// roleTimeline.ts — a role's application window and its fee phases are ONE
// timeline. This is the client twin of the database's
// role_timeline_normalise() / enforce_role_config_timeline() trigger
// (migration role_config_timeline_consistency, 21 Sep 2026). The database is
// the authority and applies the same rules to every writer; this file lets
// the organiser settings derive the same answer BEFORE saving, say what moved
// in one line, and refuse to send a timeline the database would refuse.
//
// Why: MUNBU WS's delegate role closed on 20 Sep while its "Late" price ran
// to 23 Sep, so the page advertised days nobody could apply on and the
// applicants who tried were refused at Submit.
//
// The dates that govern a role (there is no payment deadline or invoice due
// date in the schema): applications_open_at, applications_close_at,
// fee_phases[].start_date / end_date, and the conference's end_date.
//
//   R1 Dated prices never contradict each other: each starts on or before it
//      ends, and sorted by start they are contiguous (the next starts the day
//      after the previous ends). An overlap (two prices on one day) or a gap
//      (a day with no price, which silently falls back to the flat fee, often
//      0) is refused.
//   R2 When dated prices exist they ARE the window: applications open on the
//      first price's start day and close on the last price's end day, days in
//      the conference's timezone (UTC when none is stored, which today is
//      every conference). The side that was edited wins:
//        prices edited      -> open / close follow (00:00 / 23:59), unless
//                              they already fall on that day
//        only close edited  -> the last price's end date follows
//        only open edited   -> the first price's start date follows
//      A close before the last price starts, or an open after the first
//      price ends, would empty that price: refused.
//   R3 Applications open before they close.
//   R4 Applications never close after the conference's last day.
//
// Undated prices (a half-filled row in the editor) are ignored, exactly as
// the app and resolve_phase_fee ignore them.

import type { FeePhase } from '@/lib/finance';
import { dayInZone, startOfDayIso, endOfDayIso } from '@/lib/applicationWindow';

export type TimelineRule =
  | 'arc_timeline_phase_dates'
  | 'arc_timeline_phases_overlap'
  | 'arc_timeline_phases_gap'
  | 'arc_timeline_open_after_first_price'
  | 'arc_timeline_close_before_last_price'
  | 'arc_timeline_open_before_close'
  | 'arc_timeline_after_conference';

export type TimelineChange = 'open' | 'close' | 'first_start' | 'last_end';

export interface TimelineInput {
  applications_open_at: string | null;
  applications_close_at: string | null;
  fee_phases: FeePhase[] | null;
}

export interface TimelineContext {
  timeZone: string | null;
  /** The conference's last day (YYYY-MM-DD), or null when dates are TBD. */
  conferenceEnd: string | null;
}

export type TimelineResult =
  | { ok: false; rule: TimelineRule }
  | {
      ok: true;
      applications_open_at: string | null;
      applications_close_at: string | null;
      fee_phases: FeePhase[] | null;
      changes: TimelineChange[];
      /** The prices that the open / close follow (for the one-line notice). */
      first: FeePhase | null;
      last: FeePhase | null;
    };

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function datedIndexes(phases: FeePhase[]): number[] {
  return phases
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p && DAY_RE.test(p.start_date ?? '') && DAY_RE.test(p.end_date ?? ''))
    .sort((a, b) => (a.p.start_date.localeCompare(b.p.start_date) || a.p.end_date.localeCompare(b.p.end_date)))
    .map(({ i }) => i);
}

/** The database's rules, applied to a proposed row. `changed` says which
 *  side the organiser edited (a new row counts as all three). */
export function normaliseRoleTimeline(
  input: TimelineInput,
  changed: { phases: boolean; open: boolean; close: boolean },
  ctx: TimelineContext,
): TimelineResult {
  const tz = ctx.timeZone;
  const phases = (input.fee_phases ?? []).map(p => ({ ...p }));
  let open = input.applications_open_at;
  let close = input.applications_close_at;
  const changes: TimelineChange[] = [];

  // R1
  const order = datedIndexes(phases);
  for (let k = 0; k < order.length; k++) {
    const cur = phases[order[k]];
    if (cur.start_date > cur.end_date) return { ok: false, rule: 'arc_timeline_phase_dates' };
    if (k > 0) {
      const prev = phases[order[k - 1]];
      if (cur.start_date <= prev.end_date) return { ok: false, rule: 'arc_timeline_phases_overlap' };
      if (cur.start_date > addDays(prev.end_date, 1)) return { ok: false, rule: 'arc_timeline_phases_gap' };
    }
  }

  // R2
  let first: FeePhase | null = null;
  let last: FeePhase | null = null;
  if (order.length > 0) {
    first = phases[order[0]];
    last = phases[order[order.length - 1]];
    if (changed.open && !changed.phases && open) {
      const day = dayInZone(open, tz);
      if (day > first.end_date) return { ok: false, rule: 'arc_timeline_open_after_first_price' };
      if (day !== first.start_date) { first.start_date = day; changes.push('first_start'); }
    } else if (!open || dayInZone(open, tz) !== first.start_date) {
      open = startOfDayIso(first.start_date, tz);
      changes.push('open');
    }
    if (changed.close && !changed.phases && close) {
      const day = dayInZone(close, tz);
      if (day < last.start_date) return { ok: false, rule: 'arc_timeline_close_before_last_price' };
      if (day !== last.end_date) { last.end_date = day; changes.push('last_end'); }
    } else if (!close || dayInZone(close, tz) !== last.end_date) {
      close = endOfDayIso(last.end_date, tz);
      changes.push('close');
    }
  }

  // R3
  if (open && close && new Date(open).getTime() >= new Date(close).getTime()) {
    return { ok: false, rule: 'arc_timeline_open_before_close' };
  }
  // R4
  if (ctx.conferenceEnd && close && new Date(close).getTime() > new Date(endOfDayIso(ctx.conferenceEnd, tz)).getTime()) {
    return { ok: false, rule: 'arc_timeline_after_conference' };
  }

  return {
    ok: true,
    applications_open_at: open,
    applications_close_at: close,
    fee_phases: input.fee_phases === null && phases.length === 0 ? null : phases,
    changes,
    first,
    last,
  };
}

/** Editing one end of a price moves its neighbour with it, so prices stay
 *  back to back: a new end date pulls the next price's start to the day after,
 *  a new start date pulls the previous price's end to the day before. Only
 *  dated neighbours move, and never so far that a neighbour would end before
 *  it starts (that is left for R1 to refuse). */
export function linkNeighbourPhase(phases: FeePhase[], idx: number, field: 'start_date' | 'end_date'): FeePhase[] {
  const next = phases.map(p => ({ ...p }));
  const edited = next[idx];
  if (!edited || !DAY_RE.test(edited[field] ?? '')) return next;
  const order = datedIndexes(next);
  const pos = order.indexOf(idx);
  if (pos < 0) return next;
  if (field === 'end_date' && pos + 1 < order.length) {
    const n = next[order[pos + 1]];
    const s = addDays(edited.end_date, 1);
    if (s <= n.end_date) n.start_date = s;
  }
  if (field === 'start_date' && pos > 0) {
    const p = next[order[pos - 1]];
    const e = addDays(edited.start_date, -1);
    if (e >= p.start_date) p.end_date = e;
  }
  return next;
}

/** One click to line overlapping or gapped prices up, earliest first: each
 *  price starts the day after the previous one ends; a gap is closed by
 *  extending the earlier price. Returns null when that would empty a price
 *  (then the organiser has to decide which one to drop). */
export function lineUpPhases(phases: FeePhase[]): FeePhase[] | null {
  const next = phases.map(p => ({ ...p }));
  const order = datedIndexes(next);
  for (let k = 1; k < order.length; k++) {
    const prev = next[order[k - 1]];
    const cur = next[order[k]];
    const want = addDays(prev.end_date, 1);
    if (cur.start_date <= prev.end_date) {
      if (want > cur.end_date) return null;
      cur.start_date = want;
    } else if (cur.start_date > want) {
      prev.end_date = addDays(cur.start_date, -1);
    }
  }
  return next;
}
