import type { Metadata } from 'next';
import { pageMetadata, JSONLD_LOGO } from '@/lib/seo';
import StagefrontClient from './conferences/StagefrontClient';
import { fetchListedConferences, fetchPlatformStats } from '@/lib/listedConferences';
import { articles } from './blog/posts';
import type { HomeGuide } from './conferences/landing-lab/HomeSections';
import { listGuides } from '@/lib/premiumGuides';

// The cards and the trust counts are read here, on the
// server, so they are real in the HTML (they used to render "—" until a
// client fetch landed). Ten minutes is fresh enough for a front page and keeps
// it a cached page rather than a query per visit.
export const revalidate = 600;

// RULE (owner, 23 Sep 2026, after this regressed repeatedly): the site footer
// lists INFORMATION links only. Never a list of conferences, and never a
// per-conference link. Conference pages and country hubs are crawled from
// /conferences/all, which server-renders a real <a> for every public
// conference and every hub and is itself linked from every footer (as one
// "All conferences" link) and the sitemap, so the crawl path in CLAUDE.md §4
// holds without putting a directory under every page. If a crawl gap ever
// appears again, fix it on /conferences/all, not here.
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

// No extra link row under the page (removed 24 Sep 2026: it read as a second
// footer). Every hub it carried is reached by a plain server-rendered <a> on
// this page already: the site nav (/sessions, /about, /contact), the page's own
// sections (/conferences/explore, /conferences/map, /conferences/roles,
// /organisers) and FooterLegal (/conferences/all, /blog, /create, /join).

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

// "Learn MUN" on the homepage: the evergreen beginner guides, in this order.
// Slugs from src/app/blog/posts.ts; one that is renamed or removed there is
// simply skipped. The job board section (and its fetchJobStats() read) is off
// the page until the job board launches (24 Sep 2026).
const HOME_GUIDE_SLUGS = [
  'mun-for-beginners',
  'mun-position-paper-guide',
  'mun-rules-of-procedure',
  'mun-opening-speech',
  'mun-resolution-writing',
  'mun-delegate-tips',
];

// One row of three (owner, 25 Sep 2026: "one row and slightly shorter"):
// the first two blog guides above that exist, then one premium guide shown
// with its title and description only (the body stays behind the paywall on
// /guides/<slug>).
const blogGuides: HomeGuide[] = HOME_GUIDE_SLUGS.flatMap(slug => {
  const a = articles.find(p => p.slug === slug);
  return a
    ? [{ slug: a.slug, title: a.title, description: a.description, readingMinutes: a.readingMinutes, photo: a.photo }]
    : [];
}).slice(0, 2);
// The sponsorship playbook is the landing page's premium guide (owner, 25 Sep 2026).
const premiumPick = listGuides().find(g => g.slug === 'sponsorship-playbook') ?? listGuides()[0];
const homeGuides: HomeGuide[] = premiumPick
  ? [...blogGuides, { slug: premiumPick.slug, title: premiumPick.title, description: premiumPick.description, readingMinutes: premiumPick.readingMinutes, premium: true }]
  : blogGuides;

export default async function HomePage() {
  const [conferences, stats] = await Promise.all([
    fetchListedConferences(),
    fetchPlatformStats(),
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
      <StagefrontClient conferences={conferences} stats={stats} guides={homeGuides} />
    </>
  );
}
