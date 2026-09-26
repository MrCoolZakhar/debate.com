// MUN CV order (owner, 26 Sep 2026): most recent first by the entry's date.
// An entry with no date but a year in its conference name ("LIMUN 2025",
// "HMUN '24") is placed in that year, after the dated entries of the same year.
// An entry with neither goes to the bottom, newest added first.

type Orderable = { event_date?: string | null; conference_name?: string | null; created_at?: string | null };

/** A four-digit year (1990..2099) or an apostrophe year ('24) in the name. */
export function yearFromName(name: string | null | undefined): number | null {
  if (!name) return null;
  const full = name.match(/\b(19[9]\d|20\d\d)\b/);
  if (full) return Number(full[1]);
  const short = name.match(/[’'](\d{2})\b/);
  if (short) return 2000 + Number(short[1]);
  return null;
}

function key(e: Orderable): { tier: number; t: number } {
  if (e.event_date) return { tier: 0, t: new Date(`${e.event_date}T00:00:00`).getTime() };
  const y = yearFromName(e.conference_name);
  // Jan 1 of that year: below every dated entry of the same year.
  if (y) return { tier: 0, t: new Date(`${y}-01-01T00:00:00`).getTime() - 1 };
  return { tier: 1, t: e.created_at ? new Date(e.created_at).getTime() : 0 };
}

export function sortCvEntries<T extends Orderable>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ka = key(a); const kb = key(b);
    if (ka.tier !== kb.tier) return ka.tier - kb.tier;
    return kb.t - ka.t;
  });
}
