import type { Metadata } from 'next';
import { cache, Suspense } from 'react';
import Link from 'next/link';
import { absoluteUrl, pageMetadata, SITE_URL } from '@/lib/seo';
import { exploreOgImageUrl } from '@/lib/ogVersion';
import { fetchListedConferences, isUpcoming, type ListedConference } from '@/lib/listedConferences';
import { countryHubs } from '@/lib/countryHubs';
import ConferencesExploreClient from './ConferencesExploreClient';
import ExploreDirectory from './ExploreDirectory';
import SiteFooter from '@/components/SiteFooter';
import Loader from '@/components/Loader';

// /conferences/explore. The browse grid (ConferencesExploreClient) renders
// client-side (useSearchParams), so in production its raw HTML is only the
// Suspense fallback. Everything a crawler needs is therefore rendered HERE, on
// the server, and every piece of it is visible and part of the design:
//   - the fallback's h1, its real sentence and its link to /conferences/all;
//   - ExploreDirectory under the grid: every upcoming conference as a plain
//     <a href>, the country hubs, the A to Z directory and the guides;
//   - JSON-LD: CollectionPage + ItemList of Events, and a BreadcrumbList.
// The A to Z crawl path to EVERY conference page and hub stays /conferences/all
// (linked from every footer). No hreflang. The sitemap lists this URL with the
// newest conference update as its lastmod (src/app/sitemap.ts).
export const revalidate = 3600;

const IVORY = '#EDE7D8';
// The paper grain every public page lays over the ivory (pricing, legal).
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

const load = cache(async () => {
  const all = await fetchListedConferences();
  const upcoming = all.filter(c => isUpcoming(c));
  return { upcoming, hubs: countryHubs(all).slice(0, 12) };
});

function seasonLabel(now = new Date()): string {
  // The academic MUN season: from August it is this year and next.
  const y = now.getUTCFullYear();
  const start = now.getUTCMonth() >= 7 ? y : y - 1;
  return `${start}-${start + 1}`;
}

export async function generateMetadata(): Promise<Metadata> {
  const { upcoming } = await load();
  const countries = new Set(upcoming.map(c => c.country).filter(Boolean)).size;
  const n = upcoming.length;
  const lead = n > 0
    ? `${n} upcoming Model UN conferences${countries > 1 ? ` in ${countries} countries` : ''} worldwide.`
    : 'Upcoming Model UN conferences worldwide.';
  return pageMetadata({
    title: { absolute: `Model UN Conferences ${seasonLabel()}: Find and Apply | Gavelling` },
    description: `${lead} Browse MUN conferences by country, date, fee and level, then apply as a delegate, chair or advisor with one Gavelling profile.`,
    path: '/conferences/explore',
    ogTitle: 'Find your next Model UN conference',
    ogDescription:
      'Browse Model UN conferences worldwide by country, date and fee. Apply as a delegate, chair or advisor in minutes.',
    // Its own card, not the site-wide one: this page is where delegates find a
    // conference, and the card says so, centred for WhatsApp's square crop.
    // Dated URL; the page revalidates hourly, so the token rolls daily.
    image: exploreOgImageUrl(),
    imageAlt: 'Find your next Model UN conference on Gavelling.',
    imageSize: { width: 1200, height: 630 },
  });
}

/** schema.org Event for one listed conference. Offers only with a known price. */
function eventLd(c: ListedConference) {
  const url = `${SITE_URL}/conferences/${c.slug}`;
  const mode = c.format === 'online'
    ? 'https://schema.org/OnlineEventAttendanceMode'
    : c.format === 'hybrid'
      ? 'https://schema.org/MixedEventAttendanceMode'
      : 'https://schema.org/OfflineEventAttendanceMode';
  const price = c.delegate_price;
  return {
    '@type': 'Event',
    name: c.full_name || c.acronym,
    ...(c.acronym && c.acronym !== c.full_name ? { alternateName: c.acronym } : {}),
    startDate: c.start_date,
    ...(c.end_date ? { endDate: c.end_date } : {}),
    eventAttendanceMode: mode,
    eventStatus: 'https://schema.org/EventScheduled',
    url,
    ...(c.banner_url || c.logo_url ? { image: [absoluteUrl(c.banner_url || c.logo_url || '')] } : {}),
    location: c.format === 'online'
      ? { '@type': 'VirtualLocation', url }
      : {
          '@type': 'Place',
          name: [c.city, c.country].filter(Boolean).join(', ') || c.full_name,
          address: {
            '@type': 'PostalAddress',
            ...(c.city ? { addressLocality: c.city } : {}),
            ...(c.country ? { addressCountry: c.country } : {}),
          },
        },
    ...(price.kind !== 'tbd'
      ? {
          offers: {
            '@type': 'Offer',
            name: 'Delegate',
            url: `${url}/apply`,
            price: price.kind === 'free' ? 0 : price.amount,
            priceCurrency: price.kind === 'paid' ? price.currency : (c.fee_currency || 'USD'),
          },
        }
      : {}),
  };
}

/** JSON for a <script> tag: organiser-typed names can never close the tag. */
function ld(obj: object): string {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

export default async function ConferencesExplorePage() {
  const { upcoming, hubs } = await load();
  // Events need a start date (Google's minimum for the type).
  const dated = upcoming.filter(c => !c.dates_tbd && !!c.start_date);
  const collection = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Explore Model UN Conferences',
    url: `${SITE_URL}/conferences/explore`,
    description: 'Upcoming Model UN conferences worldwide, with dates, places and delegate fees, open to apply on Gavelling.',
    isPartOf: { '@type': 'WebSite', name: 'Gavelling', url: SITE_URL },
    mainEntity: {
      '@type': 'ItemList',
      name: 'Upcoming Model UN conferences',
      numberOfItems: dated.length,
      itemListOrder: 'https://schema.org/ItemListOrderAscending',
      itemListElement: dated.map((c, i) => ({ '@type': 'ListItem', position: i + 1, item: eventLd(c) })),
    },
  };
  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Explore conferences', item: `${SITE_URL}/conferences/explore` },
    ],
  };

  return (
    // The ivory ground and its paper grain belong to the page, so the grid,
    // the server-rendered directory under it and the footer share one surface.
    <div className="relative flex flex-col min-h-screen" style={{ backgroundColor: IVORY, overflowX: 'clip', fontFamily: 'var(--font-brand), sans-serif' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(collection) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(breadcrumbs) }} />
      <div
        className="pointer-events-none fixed inset-0 z-0"
        aria-hidden
        style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }}
      />
      <style>{`
        .gv-explore-wrap { width: 100%; max-width: 1720px; margin: 0 auto; padding-left: 16px; padding-right: 16px; }
        @media (min-width: 640px) { .gv-explore-wrap { padding-left: 24px; padding-right: 24px; } }
        @media (min-width: 1024px) { .gv-explore-wrap { padding-left: 40px; padding-right: 40px; } }
      `}</style>
      <div className="relative z-10 flex flex-col flex-1">
        <Suspense
          fallback={
            <div
              className="flex flex-col items-center justify-center px-6 text-center"
              style={{ minHeight: '100vh' }}
            >
              {/* The grid bails out to client rendering (useSearchParams), so
                  this fallback IS the server HTML of the top of the page in
                  production. Its heading is the page's h1 for crawlers; the
                  client grid replaces it with its own. The sentence and the
                  link are real text and a plain <a href> into the directory. */}
              <h1 className="sr-only">Explore Model UN Conferences</h1>
              <Loader size={72} label="Loading conferences" />
              <p style={{ maxWidth: 460, margin: '20px 0 0', fontSize: 14, lineHeight: 1.6, color: '#5C5140' }}>
                Browse Model UN conferences around the world by country, date, fee and level. Each conference page
                lists its committees, deadlines and fees, and you apply as a delegate, chair or advisor with one
                Gavelling profile.
              </p>
              <Link
                href="/conferences/all"
                className="focus:outline-none"
                style={{ marginTop: 10, fontSize: 14, fontWeight: 700, color: '#1B3828', textDecoration: 'underline', textUnderlineOffset: 3 }}
              >
                See every conference, A to Z
              </Link>
            </div>
          }
        >
          <ConferencesExploreClient />
        </Suspense>
        <ExploreDirectory conferences={upcoming} hubs={hubs} />
        <SiteFooter />
      </div>
    </div>
  );
}
