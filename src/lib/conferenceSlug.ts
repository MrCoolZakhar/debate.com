import type { getAuthedClient } from '@/lib/supabase-auth';

/**
 * CONFERENCE SLUG MINTING
 * ──────────────────────
 * `/conferences/<slug>` is the canonical conference URL. Historically the slug
 * was `generateSlug(fullName) + '-' + <random 5 chars>` — unique by luck, and
 * long and ugly by construction (`the-regional-union-of-youth-assemblies-model-
 * united-nations--5uljq`). This module mints the short form instead:
 *
 *     /conferences/limun2027
 *
 * ── THE LADDER ────────────────────────────────────────────────────────────
 *   1. `<acronym><yyyy>`            limun2027
 *   2. `<acronym><yy>`              limun27
 *   3. `<full-name>-<yyyy>`         london-international-model-un-2027
 *   4. `<acronym><yyyy>v1`, `v2` …  limun2027v1        (bounded, see below)
 *   5. legacy `<full-name>-<rand5>` — the terminal fallback; creation must
 *      never fail because the pretty names ran out.
 *
 * A rung is only skipped if the exact string is already taken, so the ladder
 * naturally handles the subtle cases: rung 2 (`limun27`) is a genuinely
 * distinct string, but it could equally be rung 1 for a dateless conference
 * whose acronym is literally "LIMUN27". We never parse a candidate back into
 * acronym + year — we compare whole strings against the DB, so that collision
 * is caught like any other.
 *
 * ── COLLISION SCOPE: ACRONYM **AND** YEAR ─────────────────────────────────
 * The ladder is keyed on the finished string, which embeds the year. LIMUN 2026
 * and LIMUN 2027 both want the acronym but mint `limun2026` / `limun2027` and
 * never contend. Only two conferences called LIMUN *in the same year* walk down
 * the ladder. A conference that recurs annually therefore keeps its clean name
 * every single year, which is the whole point.
 *
 * ── WHICH YEAR ────────────────────────────────────────────────────────────
 * `start_date`, falling back to `end_date` (a conference that spans New Year is
 * named for the year it opens). With `dates_tbd` there is no year at all, and
 * the ladder degrades to the bare acronym — `/conferences/dsmun`. Slugs are
 * never rewritten afterwards, so a TBD conference that later picks dates keeps
 * its yearless slug.
 *
 * ── EXISTING CONFERENCES ARE NOT TOUCHED ──────────────────────────────────
 * This runs at creation only. Every slug already in the DB stays exactly as it
 * is, and `/conferences/<old-long-slug>` keeps resolving forever.
 *
 * ── UNIQUENESS ────────────────────────────────────────────────────────────
 * `conferences.slug` carries a real UNIQUE constraint (`conferences_slug_key`),
 * so the database — not this file — is the arbiter. `conferenceSlugAttempts`
 * pre-filters the ladder with one SELECT purely to keep the common case to a
 * single insert; two organizers racing can still both see the same rung free.
 * The caller MUST therefore retry down the returned list on a 23505 naming the
 * slug constraint (see `isSlugTakenError`). The pre-filter is complete today
 * only because the `conferences` RLS SELECT policy "Anyone can read conferences
 * by link" is `USING (true)`; if that is ever narrowed, the pre-filter goes
 * partially blind and the 23505 retry becomes the only thing standing between a
 * racing organizer and a failed creation. Do not remove it.
 */

type AuthedClient = ReturnType<typeof getAuthedClient>;

/** Matches the historical `generateSlug` cap, and keeps rung 3 from being a wall of text. */
export const MAX_SLUG_LEN = 60;

/** How many `v1`, `v2` … rungs before falling through to the legacy random suffix. */
export const MAX_VERSION_RUNG = 20;

/**
 * Static sibling routes under `src/app/conferences/`. A slug equal to one of
 * these would be permanently shadowed by the static route, so it can never be
 * minted. (`src/lib/vanity.ts` keeps the equivalent list for ROOT-level routes;
 * that one guards `/<acronym>` vanity redirects and is a separate concern.)
 *
 * ⚠️ Adding a new `src/app/conferences/<name>/` folder? Add `<name>` here too.
 */
const RESERVED_CONFERENCE_SLUGS: ReadonlySet<string> = new Set([
  'explore', 'landing-lab', 'map', 'new', 'organise', 'organize', 'roles',
  // Defensive: plausible future siblings.
  'all', 'search', 'directory', 'calendar', 'index',
]);

/** Lowercase, drop everything that is not a-z0-9. `MUN-BU WS'26` → `munbuws26`. */
export function normalizeAcronym(raw: string): string {
  return (raw ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Lowercase, hyphenate, collapse. Same shape as the legacy `generateSlug`. */
export function slugifyName(raw: string, maxLen = MAX_SLUG_LEN): string {
  return (raw ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, maxLen)
    .replace(/^-+|-+$/g, '');
}

/**
 * The year the conference happens in. `start_date` wins; `end_date` covers a
 * conference that only recorded when it finishes. Returns null when dates are
 * TBD or unparseable — the ladder handles a missing year on its own.
 */
export function conferenceYear(
  startDate: string | null | undefined,
  endDate?: string | null,
): number | null {
  for (const d of [startDate, endDate]) {
    const m = /^(\d{4})-\d{2}-\d{2}/.exec((d ?? '').trim());
    if (m) {
      const y = Number(m[1]);
      // Sanity bound: a typo'd year must not produce `limun0202`.
      if (y >= 1900 && y <= 2999) return y;
    }
  }
  return null;
}

/** A slug must be URL-clean, start alphanumeric, and not shadow a static route. */
function isMintableSlug(slug: string): boolean {
  if (!slug || slug.length > MAX_SLUG_LEN) return false;
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) return false;
  if (RESERVED_CONFERENCE_SLUGS.has(slug)) return false;
  return true;
}

export interface SlugInput {
  acronym: string;
  fullName: string;
  /** From `conferenceYear(startDate, endDate)`. */
  year: number | null;
}

/**
 * The deterministic ladder, in order, already filtered for shape and reserved
 * names and de-duplicated. Pure — no database access, which is what makes the
 * whole scheme testable without writing a row.
 */
export function conferenceSlugLadder({ acronym, fullName, year }: SlugInput): string[] {
  const acr = normalizeAcronym(acronym);
  const out: string[] = [];
  const push = (s: string) => {
    if (isMintableSlug(s) && !out.includes(s)) out.push(s);
  };

  if (year === null) {
    // No year to hang the name on. Bare acronym, then the full name.
    if (acr) push(acr);
    push(slugifyName(fullName));
  } else {
    const yy = String(year % 100).padStart(2, '0');
    if (acr) {
      push(`${acr}${year}`);
      push(`${acr}${yy}`);
    }
    // Rung 3: the long form. Trim the name so name + '-' + year still fits, and
    // do not double the year when the full name already ends with it
    // ("London International MUN 2027" → …-mun-2027, not …-mun-2027-2027).
    const nameSlug = slugifyName(fullName, MAX_SLUG_LEN);
    if (nameSlug) {
      if (new RegExp(`(^|-)${year}$`).test(nameSlug)) {
        push(nameSlug);
      } else {
        const room = MAX_SLUG_LEN - String(year).length - 1;
        const trimmed = slugifyName(fullName, room);
        if (trimmed) push(`${trimmed}-${year}`);
      }
    }
  }

  // Rung 4: bounded versioning. Past the bound the caller falls through to the
  // legacy random suffix rather than counting forever.
  const versionBase = acr ? (year === null ? acr : `${acr}${year}`) : slugifyName(fullName, 40);
  if (versionBase) {
    for (let v = 1; v <= MAX_VERSION_RUNG; v++) push(`${versionBase}v${v}`);
  }

  return out;
}

/**
 * The pre-2026 scheme, kept as the terminal fallback so a creation can never
 * fail for want of a pretty name. Non-deterministic on purpose.
 */
export function legacyRandomSlug(fullName: string): string {
  const base = slugifyName(fullName) || 'conference';
  return `${base}-${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Postgres 23505 on `conferences_slug_key`. Anything else (a duplicate primary
 * key, an RLS refusal, a network blip) is a real failure and must NOT be
 * retried down the ladder.
 */
export function isSlugTakenError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code !== '23505') return false;
  return /slug/i.test(err.message ?? '');
}

/**
 * The ordered list of slugs to attempt, freed of everything already in the DB.
 * One SELECT. Always returns at least one entry — the legacy random slug is
 * appended (twice, in case of an astronomically unlucky collision) so the
 * caller always has something to insert.
 */
export async function conferenceSlugAttempts(
  supabase: AuthedClient,
  input: SlugInput,
): Promise<string[]> {
  const ladder = conferenceSlugLadder(input);
  let free = ladder;

  if (ladder.length) {
    const { data, error } = await supabase
      .from('conferences')
      .select('slug')
      .in('slug', ladder);
    if (!error && data) {
      const taken = new Set((data as { slug: string }[]).map(r => r.slug));
      free = ladder.filter(s => !taken.has(s));
    }
    // On error we keep the unfiltered ladder: the 23505 retry below still
    // converges, it just costs an extra insert or two.
  }

  return [...free, legacyRandomSlug(input.fullName), legacyRandomSlug(input.fullName)];
}
