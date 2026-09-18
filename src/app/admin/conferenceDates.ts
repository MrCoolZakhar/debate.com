// When a conference counts as PAST on the staff console.
//
// A conference is past once its last day is behind us: the end date, or the
// start date when there is no end date. Dates TBD, or no dates at all, is never
// past (nothing says it is over). start_date / end_date are `date` columns, so
// they are compared as 'YYYY-MM-DD' strings against the reader's local today,
// never through Date (which would shift the day for anyone east of Greenwich).

export interface ConferenceDateFields {
  dates_tbd: boolean;
  start_date: string | null;
  end_date: string | null;
}

function localToday(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function isPastConference(r: ConferenceDateFields, today: string = localToday()): boolean {
  if (r.dates_tbd) return false;
  const last = (r.end_date || r.start_date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(last)) return false;
  return last < today;
}
