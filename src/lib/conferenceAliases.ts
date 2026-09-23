import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';

/**
 * OLD CONFERENCE LINKS
 * ────────────────────
 * A conference's slug follows its name: rename KU MUN and `/conferences/demomun`
 * becomes `/conferences/kumun2026` (the database trigger
 * `conferences_reslug_on_rename`, migration
 * `conference_slug_aliases_and_reslug_on_rename`). Every slug it ever answered
 * to is kept in `conference_slug_aliases`, and this module is how a request
 * holding one of them finds the current slug.
 *
 * Used by `src/middleware.ts` (the 308 for `/conferences/<old>/…` and
 * `/manage/<old>/…`) and by `src/lib/vanity.ts` (an old acronym typed as a
 * bare `/ACRONYM`).
 *
 * ── WHY A POINT LOOKUP, NOT A LOADED INDEX ────────────────────────────────
 * `vanity.ts` can load its whole index because it only covers public
 * conferences (68 rows). This one covers every conference that ever renamed,
 * for every request to `/conferences/*` and `/manage/*`, so it asks about the
 * one segment in front of it and MEMOISES the answer — including the "no such
 * alias" answer, which is what the vast majority of requests get. A live slug
 * therefore costs one lookup per minute per isolate, not one per request, and
 * bot probing cannot turn the middleware into a query amplifier.
 *
 * Plain `fetch` against PostgREST rather than supabase-js: this runs in
 * middleware, where the smallest possible bundle and zero runtime assumptions
 * are worth more than the client's ergonomics.
 */

const TTL_MS = 60_000;
/** Bounded so a flood of invented paths cannot grow the map without limit. */
const MAX_MEMO = 500;

interface Memo {
  at: number;
  /** The conference's CURRENT slug, or null: unknown, or already current. */
  target: string | null;
}

const memo = new Map<string, Memo>();

function readMemo(slug: string): Memo | null {
  const hit = memo.get(slug);
  if (!hit) return null;
  if (Date.now() - hit.at >= TTL_MS) {
    memo.delete(slug);
    return null;
  }
  return hit;
}

function writeMemo(slug: string, target: string | null) {
  if (memo.size >= MAX_MEMO) {
    // Oldest insertion first — Map preserves insertion order.
    const oldest = memo.keys().next();
    if (!oldest.done) memo.delete(oldest.value);
  }
  memo.set(slug, { at: Date.now(), target });
}

/** Same shape a slug can ever have (see `isMintableSlug` in conferenceSlug.ts). */
const SLUG_SHAPE = /^[a-z0-9][a-z0-9-]{0,63}$/;

interface AliasRow {
  slug: string;
  conferences: { slug: string | null } | null;
}

/**
 * The conference's current slug, for a path segment that is an OLD slug.
 *
 * Returns null — meaning "leave this request alone" — when the segment is not
 * an alias at all, when it is the conference's current slug already (so there
 * is nothing to redirect to and no loop to fall into), or when the lookup
 * fails. Failing open matters: a transient database blip must not 404 a live
 * conference page.
 */
export async function currentConferenceSlug(segment: string): Promise<string | null> {
  const slug = segment.toLowerCase();
  if (!SLUG_SHAPE.test(slug)) return null;

  const hit = readMemo(slug);
  if (hit) return hit.target;

  try {
    const url =
      `${SUPABASE_URL}/rest/v1/conference_slug_aliases` +
      `?select=slug,conferences(slug)&slug=eq.${encodeURIComponent(slug)}&limit=1`;
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;                       // fail open, and do not memoise
    const rows = (await res.json()) as AliasRow[];
    const current = rows[0]?.conferences?.slug ?? null;
    // Equal means this IS the live slug (every live slug is seeded as its own
    // alias). Nothing to do, and redirecting would be a loop.
    const target = current && current !== slug ? current : null;
    writeMemo(slug, target);
    return target;
  } catch {
    return null;
  }
}

/** Test seam: drop the memo so a change is visible without waiting out the TTL. */
export function forgetConferenceAliases() {
  memo.clear();
}
