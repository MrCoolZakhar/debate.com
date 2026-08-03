import type { Metadata } from 'next';
import Link from 'next/link';
import StagefrontClient from './conferences/StagefrontClient';
import { supabase } from '@/lib/supabase';

// The landing composition fetches its conferences CLIENT-side (useEffect), so
// the server-rendered HTML a crawler receives contains no conference links at
// all. That left every /conferences/[slug] page reachable only through
// /conferences/explore — a deep, thin link graph, and the reason Search Console
// reports public conferences as "Discovered – currently not indexed" with
// "Referring page: None detected". This server-rendered index gives every public
// conference a real, crawlable <a> from the site's highest-authority page.
// Revalidates hourly so newly published conferences are linked without a deploy.
export const revalidate = 3600;

async function publicConferences(): Promise<{ slug: string; full_name: string; acronym: string | null }[]> {
  try {
    const { data } = await supabase
      .from('conferences')
      .select('slug, full_name, acronym')
      .eq('is_public', true)
      .order('start_date', { ascending: true })
      .limit(200);
    return (data ?? []).filter((c): c is { slug: string; full_name: string; acronym: string | null } => !!c?.slug);
  } catch {
    return [];
  }
}

export const metadata: Metadata = {
  // The root page shares the root layout's segment, so the `%s | Gavelling`
  // title template does NOT apply here — the brand must be inline.
  title: 'Find Model UN Conferences | Gavelling',
  description:
    'Find your next Model UN conference on Gavelling: real conferences, real committee rooms, from London to San Salvador. Apply as a delegate, chair, or advisor. Organisers list free.',
  alternates: {
    canonical: 'https://gavelling.com',
    languages: {
      'en-US': 'https://gavelling.com',
      'es': 'https://gavelling.com?lang=es',
      'fr': 'https://gavelling.com?lang=fr',
      'ar': 'https://gavelling.com?lang=ar',
    },
  },
  openGraph: { url: 'https://gavelling.com' },
};

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Gavelling',
  url: 'https://gavelling.com',
  logo: {
    '@type': 'ImageObject',
    url: 'https://gavelling.com/GavellingLogo.png',
    width: 400,
    height: 100,
  },
  sameAs: [
    'https://www.instagram.com/wearegavelling/',
    'https://twitter.com/wearegavelling',
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'wearegavelling@gmail.com',
    contactType: 'customer support',
  },
  description:
    'Gavelling builds modern software for the global Model UN community: a conference discovery and management platform plus live session tools for chairs.',
};

// WebSite schema lives on the site root (one per site). The SearchAction
// mirrors the landing search bar, which hands the query to /conferences/explore
// via its ?search= param.
const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Gavelling',
  url: 'https://gavelling.com',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://gavelling.com/conferences/explore?search={search_term_string}',
    },
    'query-input': 'required name=search_term_string',
  },
};

export default async function HomePage() {
  const conferences = await publicConferences();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <StagefrontClient />

      {/* Crawlable conference index. Visually quiet by design — this is a real
          directory footer for readers AND the crawl path to every conference
          page. Deliberately server-rendered (never behind the client fetch) and
          never `display:none`/`hidden`, which Google discounts as cloaking. */}
      {conferences.length > 0 && (
        <nav
          aria-label="All conferences on Gavelling"
          style={{ borderTop: '1px solid rgba(221,212,192,0.7)', backgroundColor: '#FAF8F3' }}
        >
          <div className="mx-auto w-full max-w-6xl px-5 py-10">
            {/* No visible heading: the label read as SEO furniture. The nav's
                aria-label still names the section for assistive tech, and the
                LINKS — the actual crawl path to every conference page — are
                untouched. */}
            <ul className="flex flex-wrap gap-x-4 gap-y-2" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {conferences.map(c => (
                <li key={c.slug}>
                  <Link
                    href={`/conferences/${c.slug}`}
                    style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: '#5C5140', textDecoration: 'none' }}
                  >
                    {c.full_name || c.acronym}
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/conferences/explore"
              className="inline-block mt-5"
              style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: '#1B3828', textDecoration: 'none' }}
            >
              Explore all Model UN conferences →
            </Link>
          </div>
        </nav>
      )}
    </>
  );
}
