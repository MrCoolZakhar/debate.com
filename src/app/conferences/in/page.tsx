import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, SITE_URL } from '@/lib/seo';
import { fetchListedConferences } from '@/lib/listedConferences';
import { allHubs, hubPath, HUB_INDEX_PATH, todayUtc, type Hub } from '@/lib/countryHubs';
import type { Continent } from '@/lib/countries';
import { Breadcrumbs, breadcrumbSchema, H2, HubGrid, HubShell, HubTitle, INLINE_LINK, JsonLd, Lead } from './hubKit';

// /conferences/in: every country with a public conference that is upcoming or
// was held in the last year, each with its rectangle flag and its count,
// grouped by continent and linking to its hub; above them the online, year
// and month hubs. Server-rendered plain links (the crawl path to the hubs,
// with /conferences/all). Which hubs exist is src/lib/countryHubs.ts.

// ISR: a static page re-rendered at most hourly. Nothing here is per visitor.
export const revalidate = 3600;

export const metadata: Metadata = pageMetadata({
  title: 'Model UN Conferences by Country',
  description:
    'Every country with Model UN conferences on Gavelling, by continent, with the number of upcoming conferences in each, plus online conferences and conferences by month.',
  path: HUB_INDEX_PATH,
});

const CONTINENT_ORDER: (Continent | 'Other')[] = ['Asia', 'Europe', 'Africa', 'North America', 'South America', 'Oceania', 'Other'];

function anchor(c: string): string {
  return c.toLowerCase().replace(/\s+/g, '-');
}

export default async function CountryListPage() {
  const all = await fetchListedConferences();
  // Empty = the read failed. Throw so ISR keeps the last good copy instead of
  // caching an empty list for an hour.
  if (all.length === 0) throw new Error('Listed conferences could not be read');
  const hubs = allHubs(all, todayUtc());
  const countries = hubs.filter(h => h.kind === 'country' && (h.count > 0 || h.recent > 0));
  const dated = hubs.filter(h => h.kind !== 'country' && h.indexable);
  const upcomingTotal = countries.reduce((n, h) => n + h.count, 0);

  const groups = new Map<Continent | 'Other', Hub[]>();
  for (const h of countries) {
    const k = h.continent ?? 'Other';
    groups.set(k, [...(groups.get(k) ?? []), h]);
  }
  const ordered = CONTINENT_ORDER.filter(k => groups.has(k)).map(k => [k, groups.get(k)!] as const);

  const url = `${SITE_URL}${HUB_INDEX_PATH}`;
  const collection = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Model UN Conferences by Country',
    url,
    isPartOf: { '@type': 'WebSite', name: 'Gavelling', url: SITE_URL },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: countries.length,
      itemListElement: countries.map((h, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE_URL}${hubPath(h.slug)}`,
        name: `Model UN conferences in ${h.name}`,
      })),
    },
  };
  const crumbs = breadcrumbSchema([
    { name: 'Home', url: SITE_URL },
    { name: 'Conferences', url: `${SITE_URL}/conferences/explore` },
    { name: 'By country', url },
  ]);

  return (
    <HubShell>
      <JsonLd data={collection} />
      <JsonLd data={crumbs} />
      <Breadcrumbs items={[{ label: 'Conferences', href: '/conferences/explore' }, { label: 'By country' }]} />
      <HubTitle>Model UN Conferences by Country</HubTitle>
      <Lead>
        {countries.length > 0
          ? `${countries.length} countries have Model UN conferences on Gavelling, ${upcomingTotal} of them upcoming. `
          : 'Every country with Model UN conferences on Gavelling. '}
        Pick a country for its conferences, cities, dates and delegate fees, or browse online conferences and
        conferences by month. For every conference A to Z, see{' '}
        <Link href="/conferences/all" className="focus:outline-none" style={INLINE_LINK}>all conferences</Link>.
      </Lead>

      {ordered.length > 1 && (
        <nav aria-label="Jump to a continent" style={{ marginTop: 20 }}>
          <ul className="flex flex-wrap gap-x-5 gap-y-2" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {ordered.map(([k]) => (
              <li key={k}>
                <a href={`#${anchor(k)}`} className="focus:outline-none" style={INLINE_LINK}>{k}</a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {dated.length > 0 && (
        <section aria-labelledby="hubs-dated" style={{ marginTop: 36 }}>
          <h2 id="hubs-dated" style={H2}>Online and By Date</h2>
          <HubGrid hubs={dated} />
        </section>
      )}

      {ordered.map(([continent, list]) => (
        <section key={continent} id={anchor(continent)} aria-labelledby={`hubs-${anchor(continent)}`} style={{ marginTop: 40, scrollMarginTop: 88 }}>
          <h2 id={`hubs-${anchor(continent)}`} style={H2}>{continent === 'Other' ? 'Other Countries' : continent}</h2>
          <HubGrid hubs={list} />
        </section>
      ))}

    </HubShell>
  );
}
