import { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabase';
import { articles } from './blog/posts';
import { SITE_URL } from '@/lib/seo';
import { isListedConference } from '@/lib/publicConferences';
import { countryHubs } from '@/lib/countryHubs';

// ── The sitemap: every indexable URL, exactly as it canonicalises ────────────
//
// Rules (enforced by `npm run check:indexability`):
//  - list only URLs that answer 200 with no redirect, a self-canonical and no
//    noindex. Never a redirecting path (/conferences → /), never a query string.
//  - lastmod must be TRUE. It used to be `new Date()` for every static page,
//    i.e. "changed right now" on every generation, which teaches Google to
//    ignore our lastmod entirely. Static pages carry the date their content
//    last changed (bump it when you edit the page); hub pages carry the newest
//    conference update, because that is what changes on them.
//
// Dynamic, not ISR. With `revalidate = 3600` production served the same copy
// for 5+ days (x-vercel-cache HIT, age 433593 s, lastmod frozen at the 11 Sep
// deploy), so conferences published since were missing. The query is one small
// select and Google fetches the sitemap a few times a day.
export const dynamic = 'force-dynamic';

const url = (path: string) => (path === '/' ? SITE_URL : `${SITE_URL}${path}`);

// Content dates of the static pages. Bump when the page's text changes.
const STATIC_PAGES: { path: string; lastModified: string; changeFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly'; priority: number }[] = [
  { path: '/sessions',          lastModified: '2026-08-13', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/create',            lastModified: '2026-09-17', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/join',              lastModified: '2026-09-16', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/conferences/roles', lastModified: '2026-09-08', changeFrequency: 'weekly',  priority: 0.7 },
  { path: '/about',             lastModified: '2026-09-15', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/contact',           lastModified: '2026-08-13', changeFrequency: 'yearly',  priority: 0.5 },
  { path: '/privacy',           lastModified: '2026-08-28', changeFrequency: 'yearly',  priority: 0.3 },
  { path: '/terms',             lastModified: '2026-08-28', changeFrequency: 'yearly',  priority: 0.3 },
];

// Blog post content dates now live ON the post, in the manifest
// (src/app/blog/posts.ts): `updated ?? date`. They used to be a second table
// here, which meant a post could carry one date in its own JSON-LD and a
// different one in the sitemap, and a new post silently inherited a default
// date it never had. One field, one truth, and a new post cannot be forgotten.
const BLOG_PRIORITY: Record<string, number> = {
  'best-mun-software-2026': 0.9,
  'muncommand-alternative': 0.9,
  'mymun-alternative': 0.9,
  'muncoordinated-alternative': 0.9,
  'free-mun-tools': 0.9,
};

interface ConfRow {
  slug: string | null;
  full_name?: string | null;
  is_demo?: boolean | null;
  country?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  updated_at: string | null;
  awards_published_at?: string | null;
}

// Failure here must never break the sitemap: degrade to the static list.
// Test and demo conferences ("test mun", "TestMUN7", is_demo) are public but
// never advertised (src/lib/publicConferences.ts): they stay reachable by link.
async function publicConferences(): Promise<ConfRow[]> {
  try {
    const { data, error } = await supabase
      .from('conferences')
      .select('slug, full_name, is_demo, country, start_date, end_date, updated_at, awards_published_at')
      .eq('is_public', true)
      .order('updated_at', { ascending: false });
    if (!error) return ((data as ConfRow[]) ?? []).filter(isListedConference);
    const fallback = await supabase.from('conferences').select('slug, full_name, is_demo, updated_at').eq('is_public', true);
    return ((fallback.data as ConfRow[]) ?? []).filter(isListedConference);
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const conferences = await publicConferences();
  const newestConference = conferences
    .map((c) => (c.updated_at ? new Date(c.updated_at).getTime() : 0))
    .reduce((a, b) => Math.max(a, b), 0);
  // Hubs list conferences, so they change when a conference does.
  const hubDate = newestConference ? new Date(newestConference) : new Date('2026-09-17');
  const newestPost = new Date(
    articles.map((a) => a.updated ?? a.date).sort().at(-1) ?? '2026-08-13',
  );

  return [
    { url: url('/'), lastModified: hubDate, changeFrequency: 'daily', priority: 1 },
    { url: url('/conferences/explore'), lastModified: hubDate, changeFrequency: 'daily', priority: 0.9 },
    // The server-rendered A to Z directory: the crawl path to every conference
    // page and country hub (linked from every footer). Lists conferences, so
    // its lastmod is the newest conference update.
    { url: url('/conferences/all'), lastModified: hubDate, changeFrequency: 'daily', priority: 0.8 },
    { url: url('/conferences/map'), lastModified: hubDate, changeFrequency: 'weekly', priority: 0.6 },
    // The organiser landing page (static copy plus the live conference list).
    { url: url('/organisers'), lastModified: hubDate, changeFrequency: 'weekly', priority: 0.9 },
    // Country hubs: only countries with enough upcoming public conferences
    // (countryHubs.ts decides, the hub page 404s below the same threshold).
    ...countryHubs(conferences).map((h) => ({
      url: url(`/conferences/in/${h.slug}`),
      lastModified: h.lastModified ? new Date(h.lastModified) : hubDate,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    // /blog lists the posts, so it changes when the newest post does. Derived
    // rather than hardcoded: a hand-kept date here went stale every time a post
    // was added, which is the same "lastmod that lies" problem as above.
    { url: url('/blog'), lastModified: newestPost, changeFrequency: 'weekly', priority: 0.9 },
    ...STATIC_PAGES.map((p) => ({
      url: url(p.path),
      lastModified: new Date(p.lastModified),
      changeFrequency: p.changeFrequency,
      priority: p.priority,
    })),
    ...conferences.flatMap((c) => {
      const entries: MetadataRoute.Sitemap = [
        {
          url: url(`/conferences/${c.slug}`),
          ...(c.updated_at ? { lastModified: new Date(c.updated_at) } : {}),
          changeFrequency: 'weekly',
          priority: 0.8,
        },
      ];
      // The public honour roll exists once awards are published.
      if (c.awards_published_at) {
        entries.push({
          url: url(`/conferences/${c.slug}/awards`),
          lastModified: new Date(c.awards_published_at),
          changeFrequency: 'yearly',
          priority: 0.5,
        });
      }
      return entries;
    }),
    ...articles.map((a) => ({
      url: url(`/blog/${a.slug}`),
      lastModified: new Date(a.updated ?? a.date),
      changeFrequency: 'monthly' as const,
      priority: BLOG_PRIORITY[a.slug] ?? 0.8,
    })),
  ];
}
