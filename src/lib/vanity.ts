import { supabase } from '@/lib/supabase';

/**
 * VANITY CONFERENCE URLs
 * ──────────────────────
 * Lets `gavelling.com/worldmun` reach `/conferences/harvard-worldmun-2027-2h45a`.
 *
 * This is PURELY ADDITIVE. `/conferences/<slug>` is and stays the canonical URL —
 * nothing here changes, rewrites or retires it. The vanity path 307-redirects to
 * the canonical one, so there is never a second indexable copy of the page.
 *
 * The mapping is derived at runtime from `conferences.acronym`, so a new
 * conference gets its vanity URL with no code change and no redeploy (within the
 * cache TTL below). Resolution is deliberately conservative:
 *
 *   1. PUBLIC ONLY. Only `is_public = true` conferences are resolvable. Note that
 *      the `conferences` RLS policy "Anyone can read conferences by link" is
 *      `USING (true)`, so a private conference IS readable by anyone holding its
 *      slug. That used to be tolerable because every slug carried a random 5-char
 *      suffix and was therefore unguessable.
 *
 *      ⚠️ THAT IS NO LONGER TRUE FOR CONFERENCES CREATED FROM 2026 ONWARDS.
 *      `src/lib/conferenceSlug.ts` now mints short slugs (`limun2027`), and every
 *      conference is created private, so a new private conference's URL is
 *      guessable from its acronym and year. "Private" means unlisted, not
 *      access-controlled. If real privacy is ever wanted, it has to come from
 *      narrowing this RLS policy — not from slug entropy.
 *
 *      The is_public filter here stays regardless: /<acronym> is a promoted,
 *      crawlable surface, and an unlisted conference must not be advertised on it.
 *   2. UNAMBIGUOUS ONLY. `acronym` is NOT unique in the DB (verified: TMUN is
 *      shared by two public conferences). A shared acronym resolves to nothing at
 *      all rather than guessing which conference the visitor meant.
 *   3. RESERVED-FIRST. Anything that is, or might become, a real top-level route
 *      is rejected before we ever touch the database.
 */

/**
 * ⚠️  ADDING A NEW TOP-LEVEL ROUTE (`src/app/<name>/`)? ADD `<name>` HERE TOO.  ⚠️
 *
 * `src/app/[slug]/page.tsx` is a root-level dynamic segment. Next.js gives static
 * routes precedence over dynamic ones, so a real `src/app/pricing/page.tsx` will
 * still win over `[slug]` and CANNOT be shadowed by it — that part is safe.
 *
 * What this list is actually for is the other direction: without it, every
 * unmatched top-level path (`/wp-admin`, `/pricing` before it exists, typos, bot
 * probes) would fall into `[slug]` and cost a conference lookup before 404-ing.
 * It also stops a conference from ever claiming an acronym that collides with a
 * route name. Entries are compared both raw and normalised (hyphens stripped).
 */
const RESERVED_RAW: readonly string[] = [
  // ── Real top-level route segments under src/app/ (keep in sync) ──
  'about', 'account', 'admin', 'advisor', 'api', 'auth', 'blog', 'chair',
  'conferences', 'contact', 'create', 'cv', 'delegate', 'delegation',
  'dev-dash-preview', 'grain-dev', 'invites', 'join', 'manage', 'my-conferences',
  'privacy', 'sessions', 'terms', 'voting',
  // ── File-based / metadata routes at the root ──
  'robots', 'robots.txt', 'sitemap', 'sitemap.xml', 'favicon', 'favicon.ico',
  'icon', 'apple-icon', 'opengraph-image', 'manifest', 'site.webmanifest',
  'llms.txt', '_next', 'well-known',
  // ── Top-level folders in public/ (served as static assets) ──
  'ambassador-photos', 'awards', 'banners', 'committee-emblems', 'demo-logos',
  'email', 'landing', 'logos', 'map', 'mun-logos', 'onboarding', 'roles',
  'tutorial',
  // ── Defensive: plausible future top-level pages. Reserving one costs a
  //    conference nothing today (no acronym in the DB matches any of these) and
  //    saves a silent surprise later.
  'app', 'dashboard', 'docs', 'explore', 'features', 'help', 'home', 'login',
  'logout', 'new', 'pricing', 'search', 'settings', 'signin', 'signup',
  'support', 'team', 'users',
];

/** Collapse a label or URL segment to its comparable form: `MUNBU WS'26/` → `munbuws26`. */
export function normalizeVanity(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const RESERVED = new Set<string>([
  ...RESERVED_RAW.map(s => s.toLowerCase()),
  ...RESERVED_RAW.map(normalizeVanity),
]);

/**
 * Cheap structural gate applied before anything else. Rejects the overwhelming
 * majority of junk traffic (`/.env`, `/wp-login.php`, encoded payloads, absurd
 * lengths) without a database round-trip.
 */
function isVanityCandidate(raw: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,63}$/i.test(raw);
}

/**
 * Hand-pinned vanity names, checked before derived acronyms.
 *
 * Use sparingly. The point of a pin is a link that is already out in the world on
 * printed material / socials, where "the organiser edited their acronym" must not
 * be able to break it. A pin is still resolved against the live public-conference
 * set, so pinning can never expose a conference that went private.
 */
const PINNED: Readonly<Record<string, string>> = {
  // Actively being shared as gavelling.com/worldmun.
  worldmun: 'harvard-worldmun-2027-2h45a',
};

type VanityIndex = ReadonlyMap<string, string>;

let cached: { at: number; index: VanityIndex } | null = null;
const TTL_MS = 60_000;

async function loadIndex(): Promise<VanityIndex> {
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return cached.index;

  const { data, error } = await supabase
    .from('conferences')
    .select('slug, acronym')
    .eq('is_public', true)
    .not('acronym', 'is', null);

  if (error || !data) {
    // Prefer a stale index over 404-ing a live marketing link on a transient blip.
    return cached?.index ?? new Map();
  }

  const rows = data as { slug: string; acronym: string | null }[];
  const index = new Map<string, string>();
  const ambiguous = new Set<string>();
  const publicSlugs = new Set<string>();

  for (const row of rows) {
    publicSlugs.add(row.slug);
    const key = normalizeVanity(row.acronym ?? '');
    if (!key || RESERVED.has(key)) continue;
    if (index.has(key)) {
      // Two public conferences share this acronym — refuse to guess.
      ambiguous.add(key);
      continue;
    }
    index.set(key, row.slug);
  }
  for (const key of ambiguous) index.delete(key);

  // Pins win over derived acronyms, but only for conferences that are actually
  // public right now — a pin must never become a private-conference backdoor.
  for (const [name, slug] of Object.entries(PINNED)) {
    if (publicSlugs.has(slug)) index.set(normalizeVanity(name), slug);
  }

  cached = { at: now, index };
  return index;
}

/**
 * Resolve a single top-level URL segment to a conference slug.
 * Returns null for anything reserved, malformed, unknown, private or ambiguous —
 * the caller must turn that into a real 404.
 */
export async function resolveConferenceVanity(segment: string): Promise<string | null> {
  if (!isVanityCandidate(segment)) return null;
  if (RESERVED.has(segment.toLowerCase())) return null;
  const key = normalizeVanity(segment);
  if (!key || RESERVED.has(key)) return null;
  try {
    return (await loadIndex()).get(key) ?? null;
  } catch {
    return null;
  }
}
