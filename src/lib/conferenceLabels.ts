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

import { appendEditionYear } from '@/lib/presetNames';

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

/** The acronym as it should be shown: organiser's text + edition year. */
export function conferenceAcronymLabel(conf: ConferenceLabelInput): string {
  return appendEditionYear((conf.acronym ?? '').trim(), editionYear(conf));
}

/** The full name as it should be shown: organiser's text + edition year. */
export function conferenceFullNameLabel(conf: ConferenceLabelInput): string {
  return appendEditionYear((conf.full_name ?? '').trim(), editionYear(conf));
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
