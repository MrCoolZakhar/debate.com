import type { Metadata } from 'next';
import { pageMetadata, JSONLD_LOGO } from '@/lib/seo';
import Link from 'next/link';
import StagefrontClient from './conferences/StagefrontClient';
import { fetchListedConferences, fetchJobStats, fetchPlatformStats } from '@/lib/listedConferences';

// The cards, the trust counts and the job-board figures are read here, on the
// server, so they are real in the HTML (they used to render "—" until a
// client fetch landed). Ten minutes is fresh enough for a front page and keeps
// it a cached page rather than a query per visit.
export const revalidate = 600;

// RULE (owner, 23 Sep 2026, after this regressed repeatedly): the site footer
// lists INFORMATION links only. Never a list of conferences, and never a
// per-conference link. Conference pages are crawled from /conferences/explore,
// which server-renders a real <a> for every public conference and is itself
// linked from the footer and the sitemap, so the crawl path in CLAUDE.md §4
// holds without putting a directory under every page. If a crawl gap ever
// appears again, fix it on /conferences/explore, not here.
export const metadata: Metadata = pageMetadata({
  // The root page shares the root layout's segment, so the `%s | Gavelling`
  // title template does NOT apply here — the brand must be inline.
  title: 'Find Model UN Conferences | Gavelling',
  description:
    'Find your next Model UN conference on Gavelling: real conferences, real committee rooms, from London to San Salvador. Apply as a delegate, chair, or advisor. Organisers list free.',
  path: '/',
  // NO hreflang. The site has one URL per page; es/fr/ar are a client-side
  // preference, not separate server-rendered pages. The old alternates pointed
  // at `?lang=xx`, which nothing reads and which canonicalise back to `/`, so
  // Search Console filed them as "Alternative page with proper canonical tag".
  // Only add `languages` if real, indexable, self-canonical locale URLs exist.
});

// Server-rendered links to every hub, so a crawler reaches the blog, the job
// board and the session tools from the strongest page on the site (the
// composition above renders client-side and its links are not in the HTML).
const HUB_LINKS: { href: string; label: string }[] = [
  { href: '/conferences/explore', label: 'Explore conferences' },
  { href: '/conferences/map', label: 'Conference map' },
  { href: '/conferences/roles', label: 'Chair and staff roles' },
  { href: '/organisers', label: 'For organisers' },
  { href: '/blog', label: 'MUN guides' },
  { href: '/sessions', label: 'Committee session software' },
  { href: '/create', label: 'Create a committee' },
  { href: '/join', label: 'Join a session' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Gavelling',
  url: 'https://gavelling.com',
  logo: JSONLD_LOGO,
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
  const [conferences, stats, jobStats] = await Promise.all([
    fetchListedConferences(),
    fetchPlatformStats(),
    fetchJobStats(),
  ]);
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
      <StagefrontClient conferences={conferences} stats={stats} jobStats={jobStats} />

      <nav aria-label="Gavelling" style={{ backgroundColor: '#FAF8F3' }}>
        <ul
          className="mx-auto w-full max-w-6xl px-5 pb-7 flex flex-wrap gap-x-5 gap-y-2"
          style={{ listStyle: 'none', margin: '0 auto', paddingTop: 28 }}
        >
          {HUB_LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: '#5C5140', textDecoration: 'none' }}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
