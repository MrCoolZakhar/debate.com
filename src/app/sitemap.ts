import { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabase';

// Re-generate hourly so newly listed public conferences enter the sitemap
// without waiting for a redeploy.
export const revalidate = 3600;

// Public conference pages are first-class SEO surfaces: each is_public
// conference gets its own /conferences/[slug] entry so Google discovers new
// listings without waiting for internal-link crawls. Failure here must never
// break the sitemap, so the fetch degrades to the static list.
async function conferenceEntries(): Promise<MetadataRoute.Sitemap> {
  try {
    const { data } = await supabase
      .from('conferences')
      .select('slug, updated_at')
      .eq('is_public', true);
    return (data ?? [])
      .filter((c): c is { slug: string; updated_at: string | null } => !!c.slug)
      .map((c) => ({
        url: `https://gavelling.com/conferences/${c.slug}`,
        // Real lastmod: crawlers prioritise entries whose date actually moved.
        ...(c.updated_at ? { lastModified: new Date(c.updated_at) } : {}),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }));
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const conferences = await conferenceEntries();
  return [
    { url: 'https://gavelling.com',             lastModified: new Date(), changeFrequency: 'daily',   priority: 1   },
    { url: 'https://gavelling.com/conferences/explore', lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: 'https://gavelling.com/conferences/map',     lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: 'https://gavelling.com/conferences/roles',   lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: 'https://gavelling.com/sessions',     lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.9 },
    { url: 'https://gavelling.com/about',        lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://gavelling.com/contact',      lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: 'https://gavelling.com/privacy',      lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    { url: 'https://gavelling.com/blog',         lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.9 },
    ...conferences,
    { url: 'https://gavelling.com/blog/how-to-run-mun-committee',    lastModified: new Date('2026-06-01'), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://gavelling.com/blog/best-mun-software-2026',      lastModified: new Date('2026-06-01'), changeFrequency: 'monthly', priority: 0.9 },
    { url: 'https://gavelling.com/blog/general-speakers-list-guide',  lastModified: new Date('2026-06-01'), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://gavelling.com/blog/mun-motions-explained',        lastModified: new Date('2026-06-01'), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://gavelling.com/blog/how-to-chair-first-mun',       lastModified: new Date('2026-06-01'), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://gavelling.com/blog/how-to-run-moderated-caucus',  lastModified: new Date('2026-06-07'), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://gavelling.com/blog/unmoderated-caucus-guide',     lastModified: new Date('2026-06-07'), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://gavelling.com/blog/mun-voting-procedures',        lastModified: new Date('2026-06-07'), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://gavelling.com/blog/mun-delegate-tips',            lastModified: new Date('2026-06-07'), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://gavelling.com/blog/mun-position-paper-guide',     lastModified: new Date('2026-06-07'), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://gavelling.com/blog/mun-resolution-writing',       lastModified: new Date('2026-06-07'), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://gavelling.com/blog/mun-rules-of-procedure',       lastModified: new Date('2026-06-07'), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://gavelling.com/blog/mun-security-council-guide',   lastModified: new Date('2026-06-07'), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://gavelling.com/blog/mun-crisis-committee-guide',   lastModified: new Date('2026-06-07'), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://gavelling.com/blog/free-mun-tools',               lastModified: new Date('2026-06-07'), changeFrequency: 'monthly', priority: 0.9 },
    { url: 'https://gavelling.com/blog/mun-conference-preparation',   lastModified: new Date('2026-06-07'), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://gavelling.com/blog/mun-public-speaking-tips',     lastModified: new Date('2026-06-07'), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://gavelling.com/blog/mun-opening-speech',           lastModified: new Date('2026-06-07'), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://gavelling.com/blog/mun-working-paper-guide',      lastModified: new Date('2026-06-07'), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://gavelling.com/blog/mun-amendment-guide',          lastModified: new Date('2026-06-07'), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://gavelling.com/blog/mun-right-of-reply',           lastModified: new Date('2026-06-07'), changeFrequency: 'monthly', priority: 0.7 },
    { url: 'https://gavelling.com/blog/tour-de-table-mun',            lastModified: new Date('2026-06-07'), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://gavelling.com/blog/mun-director-guide',           lastModified: new Date('2026-06-07'), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://gavelling.com/blog/mun-chair-script',             lastModified: new Date('2026-06-07'), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://gavelling.com/blog/mun-bloc-building',            lastModified: new Date('2026-06-07'), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://gavelling.com/blog/mun-awards-guide',             lastModified: new Date('2026-06-07'), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://gavelling.com/blog/mun-conference-planning',      lastModified: new Date('2026-06-07'), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://gavelling.com/blog/mun-technology-guide',         lastModified: new Date('2026-06-07'), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://gavelling.com/blog/mun-online-committees',        lastModified: new Date('2026-06-07'), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://gavelling.com/blog/mun-faculty-advisor-guide',    lastModified: new Date('2026-06-07'), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://gavelling.com/blog/mun-points-of-order',          lastModified: new Date('2026-06-07'), changeFrequency: 'monthly', priority: 0.8 },
  ];
}
