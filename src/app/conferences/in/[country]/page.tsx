import type { Metadata } from 'next';
import { cache } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { pageMetadata, SITE_URL } from '@/lib/seo';
import SiteNav from '@/components/SiteNav';
import { LabFooter } from '../../landing-lab/shared';
import { fetchListedConferences, isUpcoming } from '@/lib/listedConferences';
import { countryHubs, inCountry } from '@/lib/countryHubs';
import ConferenceLinkList from '../ConferenceLinkList';

// /conferences/in/<country>: every upcoming public conference in one country,
// as plain server-rendered links. A hub exists only while the country has at
// least HUB_MIN upcoming listed conferences (countryHubs.ts); otherwise 404,
// and the sitemap drops it with the same rule. Linked from
// /conferences/explore, never from the footer (CLAUDE.md §4).

export const revalidate = 3600;

const load = cache(async (slug: string) => {
  const all = await fetchListedConferences();
  const hub = countryHubs(all).find(h => h.slug === slug.toLowerCase());
  if (!hub) return null;
  const conferences = all.filter(c => isUpcoming(c) && inCountry(c, hub.code));
  const cities = [...new Set(conferences.map(c => c.city).filter(c => c && !/^online$/i.test(c)))];
  return { hub, conferences, cities };
});

export async function generateMetadata({ params }: { params: Promise<{ country: string }> }): Promise<Metadata> {
  const { country } = await params;
  const data = await load(country);
  if (!data) {
    return pageMetadata({
      title: 'Model UN conferences',
      description: 'Model UN conferences on Gavelling.',
      path: `/conferences/in/${country}`,
      robots: { index: false, follow: true },
    });
  }
  const { hub, conferences, cities } = data;
  const where = cities.length ? ` in ${cities.slice(0, 3).join(', ')}${cities.length > 3 ? ' and more' : ''}` : '';
  return pageMetadata({
    title: `Model UN Conferences in ${hub.name} (${conferences.length} upcoming)`,
    description: `${conferences.length} upcoming Model UN conferences in ${hub.name}${where}. See dates, cities and delegate fees, then apply as a delegate, chair or advisor on Gavelling.`,
    path: `/conferences/in/${hub.slug}`,
  });
}

export default async function CountryHubPage({ params }: { params: Promise<{ country: string }> }) {
  const { country } = await params;
  const data = await load(country);
  if (!data) notFound();
  const { hub, conferences, cities } = data;
  const openCount = conferences.filter(c => c.window === 'open').length;

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Model UN conferences in ${hub.name}`,
    itemListElement: conferences.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}/conferences/${c.slug}`,
      name: c.full_name,
    })),
  };
  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Conferences', item: `${SITE_URL}/conferences/explore` },
      { '@type': 'ListItem', position: 3, name: hub.name, item: `${SITE_URL}/conferences/in/${hub.slug}` },
    ],
  };

  return (
    <div style={{ backgroundColor: '#FAF8F3', minHeight: '100vh' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />
      <SiteNav brand="conferences" />
      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6" style={{ paddingTop: 40, paddingBottom: 72, fontFamily: "var(--font-brand), sans-serif" }}>
        <nav aria-label="Breadcrumb" style={{ fontSize: 13, color: '#5C5140' }}>
          <Link href="/conferences/explore" style={{ color: '#1B3828', fontWeight: 600, textDecoration: 'none' }}>Conferences</Link>
          <span aria-hidden="true"> / </span>
          <span>{hub.name}</span>
        </nav>
        <h1 style={{ fontWeight: 900, fontSize: 'clamp(30px, 4.4vw, 52px)', letterSpacing: '-0.02em', lineHeight: 1.05, color: '#1C1410', margin: '14px 0 12px', textWrap: 'balance' }}>
          Model UN conferences in {hub.name}
        </h1>
        <p style={{ fontSize: 'clamp(15px, 1.1vw, 18px)', lineHeight: 1.6, color: '#4A4238', maxWidth: 640, margin: 0, textWrap: 'pretty' }}>
          {conferences.length} upcoming conferences in {hub.name}
          {cities.length ? `, in ${cities.slice(0, 4).join(', ')}${cities.length > 4 ? ' and more' : ''}` : ''}.
          {openCount > 0 ? ` ${openCount} ${openCount === 1 ? 'is' : 'are'} taking delegate applications now.` : ''}
          {' '}Each page has the committees, dates and fees, and you apply on Gavelling with one profile.
        </p>
        <div style={{ marginTop: 32 }}>
          <ConferenceLinkList conferences={conferences} />
        </div>
        <p style={{ marginTop: 32, fontSize: 14, color: '#5C5140' }}>
          Looking further afield?{' '}
          <Link href="/conferences/explore" style={{ color: '#1B3828', fontWeight: 700 }}>Explore every conference</Link>
          {' '}or{' '}
          <Link href="/conferences/map" style={{ color: '#1B3828', fontWeight: 700 }}>see them on the map</Link>.
        </p>
      </main>
      <LabFooter />
    </div>
  );
}
