/**
 * The cache-busting token in a conference's Open Graph image URL.
 *
 * WHY THIS EXISTS
 *
 * Today `og:image` points straight at the organiser's raw upload
 * (`…/conference-assets/banners/<uuid>-<ts>.webp`). That URL is stable for the
 * life of the row, and WhatsApp / iMessage / Facebook cache a preview image
 * against the URL essentially forever. So when an organiser replaces their
 * banner, fixes their acronym or moves the conference to a new city, every link
 * already shared in a group chat keeps showing the OLD picture. That is the
 * "shared conference links never update" complaint, and no amount of
 * `Cache-Control` on our side fixes it: the scrapers are not revalidating,
 * they already have the bytes.
 *
 * The only lever that actually works is CHANGING THE URL. `ogVersion()`
 * produces the segment that changes:
 *
 *     /api/og/conference/<slug>/<YYYY-MM-DD>-<hash>.jpg
 *
 * The route IGNORES this segment when it renders. It is pure cache identity.
 *
 * TWO INDEPENDENT TRIGGERS, ON PURPOSE
 *
 *  1. **The hash** covers every field the card draws — name, acronym, banner,
 *     logo, city, country, dates. An organiser edit changes the token on the
 *     next scrape, so a re-share picks up the new card immediately. This is the
 *     one that matters.
 *  2. **The date** rotates the token once a day regardless. It is the safety
 *     net for everything the hash cannot see: a card design change we ship, a
 *     banner file replaced at the same storage URL, a scraper that cached a
 *     failed render. Worst case a stale card self-heals within 24h.
 *
 * DO NOT REPLACE THIS WITH `conferences.updated_at`. It looks like the obvious
 * answer and it is measurably useless: across 169 rows the column holds only
 * FOUR distinct values, because it was bulk-updated by migrations rather than
 * maintained per-edit. Versioning on it would leave almost every conference
 * sharing one token — i.e. exactly the bug we are fixing, with extra steps.
 *
 * Deliberately dependency-free (no `node:crypto`): this is imported from
 * `generateMetadata` today, but it is a pure function of a row and there is no
 * reason a client surface should not be able to build the same URL.
 */

/** The fields that appear on the card. Structural, so DB rows and hand-built
 *  objects both satisfy it without a cast. */
export interface OgVersionInput {
  full_name?: string | null;
  acronym?: string | null;
  banner_url?: string | null;
  logo_url?: string | null;
  city?: string | null;
  country?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

/**
 * FNV-1a, 32-bit, rendered base36.
 *
 * Not cryptographic and does not need to be — the only thing riding on it is
 * "did any visible field change", and a collision costs one stale preview for
 * at most a day (the date half of the token rotates it out anyway). A real
 * digest would drag `node:crypto` into anything that imports this.
 */
function shortHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    // 32-bit FNV prime multiply, kept in range via Math.imul.
    h = Math.imul(h, 0x01000193);
  }
  // >>> 0 first: h is a signed int32 here and a negative value would render
  // with a leading '-', which is legal in a path but ugly and surprising.
  return (h >>> 0).toString(36).padStart(7, '0');
}

/** Today as 'YYYY-MM-DD' in UTC.
 *
 *  UTC rather than local time on purpose: this token is generated on whichever
 *  serverless region takes the request, and a local-time date would flip back
 *  and forth between regions either side of midnight, producing two live URLs
 *  for the same card and doubling the render cost for no benefit. */
function utcToday(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * The version token for a conference's share card: `YYYY-MM-DD-<hash>`.
 *
 * `now` is injectable for tests only; callers pass nothing.
 */
export function ogVersion(conf: OgVersionInput, now: Date = new Date()): string {
  // Newline-joined with an explicit field order. A separator that cannot occur
  // inside the values keeps "AB" + "C" from hashing the same as "A" + "BC".
  const payload = [
    conf.full_name ?? '',
    conf.acronym ?? '',
    conf.banner_url ?? '',
    conf.logo_url ?? '',
    conf.city ?? '',
    conf.country ?? '',
    conf.start_date ?? '',
    conf.end_date ?? '',
  ].join('\n');

  return `${utcToday(now)}-${shortHash(payload)}`;
}

/**
 * The full, absolute `og:image` URL for a conference.
 *
 * The `.jpg` suffix is not decoration. `ogImage()` in `src/lib/seo.ts` derives
 * `og:image:type` from the URL's extension, and an extensionless URL silently
 * drops the MIME hint that some scrapers use to decide whether to bother
 * fetching. The route strips the extension before using the segment (which it
 * ignores regardless), so the two stay in sync automatically.
 *
 * `origin` defaults to the production site; pass one to build a card URL
 * against a preview deployment or localhost.
 */
export function conferenceOgImageUrl(
  slug: string,
  conf: OgVersionInput,
  origin = 'https://gavelling.com',
): string {
  return `${origin}/api/og/conference/${encodeURIComponent(slug)}/${ogVersion(conf)}.jpg`;
}

/**
 * The bare token from a `[v]` path segment, with any image extension removed.
 *
 * The routes ignore the version entirely when rendering, so this exists only so
 * that what they echo back in `X-Og-Version` is the token itself rather than
 * `2026-09-03-1a2b3c4.jpg`. Keeping the two representations distinct in one
 * place is what stops the `.jpg` in `conferenceOgImageUrl` from quietly
 * becoming part of the token's meaning.
 */
export function versionToken(segment: string): string {
  return segment.replace(/\.(jpe?g|png|webp)$/i, '');
}

/**
 * The homepage card's URL. There is no row to hash, so the date alone drives
 * it: the homepage card shows live counts, and refreshing those once a day is
 * exactly the cadence they change at.
 */
export function homeOgImageUrl(origin = 'https://gavelling.com', now: Date = new Date()): string {
  return `${origin}/api/og/home/${utcToday(now)}.jpg`;
}
