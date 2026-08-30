/**
 * How a conference's name and acronym are written across the app.
 *
 * Two rules, one place:
 *
 *  1. **The acronym is whatever the organiser says it is.** Not every
 *     conference on Gavelling is a Model UN conference, and plenty of the ones
 *     that are do not use initials — "MODEL NATO GERMANY" and "NATO MUN" are
 *     both perfectly good acronyms. Letters, digits, spaces, ampersands,
 *     hyphens, dots and apostrophes all get through; we only reject the empty
 *     and the absurd.
 *
 *  2. **The edition year always follows the name — including the acronym.**
 *     Conferences run annually and the same acronym belongs to many editions,
 *     so a bare "LIMUN" is ambiguous the moment there is more than one.
 *     `appendEditionYear` never doubles a year the label already carries.
 */

/** Append the edition year to a label, unless the label already carries it.
 *  "Already carries it" covers both the full year ("Hult 2026") and the
 *  two-digit shorthand acronyms are usually built from ("XMUN26"), which is
 *  why we do not simply reuse presetNames' appendEditionYear here. */
function withYear(label: string, year: string | null): string {
  const base = label.trim();
  if (!year) return base;
  if (!base) return year;
  if (base.includes(year)) return base;
  // Trailing two-digit shorthand: "XMUN26" for 2026, but not "MUN20" for 2026.
  if (base.endsWith(year.slice(2)) && /[A-Za-z]\d{2}$/.test(base)) return base;
  return `${base} ${year}`;
}

/** Everything the label helpers need. Deliberately structural, so both DB rows
 *  and hand-built objects satisfy it. */
export interface ConferenceLabelInput {
  full_name?: string | null;
  acronym?: string | null;
  start_date?: string | null;
  /** Some surfaces already resolved the edition year; pass it to skip the parse. */
  year?: string | number | null;
}

/** The four-digit edition year, from an explicit `year` or the start date. */
export function editionYear(conf: ConferenceLabelInput): string | null {
  if (conf.year !== null && conf.year !== undefined && String(conf.year).trim()) {
    return String(conf.year).trim();
  }
  const sd = (conf.start_date ?? '').trim();
  return /^\d{4}/.test(sd) ? sd.slice(0, 4) : null;
}

/** The acronym as it should be shown: organiser's text + edition year.
 *  A blank acronym stays blank — `withYear('', '2026')` would otherwise return
 *  a bare "2026", which is truthy enough to defeat every caller's fallback and
 *  render a conference as the year it happens in. The column is plain `text`
 *  with no constraint, so rows predating validation really do have one. */
export function conferenceAcronymLabel(conf: ConferenceLabelInput): string {
  const acr = (conf.acronym ?? '').trim();
  return acr ? withYear(acr, editionYear(conf)) : '';
}

/** The full name as it should be shown: organiser's text + edition year.
 *  Blank in, blank out, for the same reason as the acronym above. */
export function conferenceFullNameLabel(conf: ConferenceLabelInput): string {
  const full = (conf.full_name ?? '').trim();
  return full ? withYear(full, editionYear(conf)) : '';
}

/** Both labels at once, for headers that print the acronym big and the full
 *  name small beneath it. `secondary` is null when the two would say the same
 *  thing, so callers never render a redundant subtitle. */
export function conferenceLabels(conf: ConferenceLabelInput): { primary: string; secondary: string | null } {
  const primary = conferenceAcronymLabel(conf) || conferenceFullNameLabel(conf);
  const full = conferenceFullNameLabel(conf);
  const same = !full || full.toLowerCase() === primary.toLowerCase();
  return { primary, secondary: same ? null : full };
}

// ── Acronym validation ─────────────────────────────────────────────────────

/** Characters an acronym may contain beyond letters and digits. Wide on
 *  purpose — see rule 1 above. */
const ACRONYM_ALLOWED = /^[\p{L}\p{N} .,'’&/-]+$/u;

const ACRONYM_MAX = 40;

/** '' when the acronym is usable, otherwise the reason it is not. */
export function acronymProblem(acr: string): string {
  const trimmed = (acr ?? '').trim();
  if (trimmed.length < 2) return 'Acronym must be at least 2 characters.';
  if (trimmed.length > ACRONYM_MAX) return `Acronym must be ${ACRONYM_MAX} characters or fewer.`;
  if (!ACRONYM_ALLOWED.test(trimmed)) return 'Acronym can only contain letters, numbers, spaces and basic punctuation.';
  return '';
}
