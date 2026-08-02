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
