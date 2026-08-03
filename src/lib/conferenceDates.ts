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
