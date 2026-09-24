import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata } from '@/lib/seo';
import { fetchListedConferences, isUpcoming } from '@/lib/listedConferences';
import { countryHubs } from '@/lib/countryHubs';
import { COUNTRY_CONTINENTS, getCountryByName } from '@/lib/countries';
import MapClient from './MapClient';

// Refreshed hourly so the counts in the text below follow the board.
export const revalidate = 3600;

export const metadata: Metadata = pageMetadata({
  title: 'MUN Conference World Map',
  description:
    'See where Model UN conferences are happening on a world map. Browse by continent and country, then open any conference to view committees, dates, and fees.',
  path: '/conferences/map',
  ogDescription:
    'See where Model UN conferences are happening on a world map, from London to San Salvador.',
});

const SANS = "var(--font-brand), sans-serif";

export default async function ConferencesMapPage() {
  // The map itself is a client canvas. The heading and the words a search
  // engine can read are rendered here, on the server, directly under it.
  const all = await fetchListedConferences();
  const upcoming = all.filter(c => isUpcoming(c));
  const countries = new Set(upcoming.map(c => getCountryByName(c.country)?.code ?? c.country));
  const continents = new Set(
    [...countries].map(code => COUNTRY_CONTINENTS[String(code).toUpperCase()]).filter(Boolean),
  );
  const hubs = countryHubs(all);

  return (
    <>
      <MapClient />
      <section style={{ backgroundColor: '#EDE7D8', fontFamily: SANS }}>
        <div className="mx-auto max-w-4xl px-4 sm:px-6" style={{ paddingTop: 48, paddingBottom: 56 }}>
          <h1 style={{ fontWeight: 900, fontSize: 'clamp(26px, 3.4vw, 40px)', letterSpacing: '-0.015em', color: '#1C1410', margin: '0 0 12px', textWrap: 'balance' }}>
            Model UN conference world map
          </h1>
          <p style={{ fontSize: 16, lineHeight: 1.65, color: '#4A4238', margin: 0, textWrap: 'pretty' }}>
            {upcoming.length > 0
              ? `${upcoming.length} upcoming Model UN conferences in ${countries.size} countries across ${continents.size} continents, on one map. `
              : 'Model UN conferences around the world, on one map. '}
            Hover a continent and scroll to zoom in, then open any conference to see its committees, dates and delegate fee.
            Every conference on Gavelling takes applications from delegates, chairs and faculty advisors with a single profile.
          </p>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: '#4A4238', margin: '14px 0 0' }}>
            Prefer a list?{' '}
            <Link href="/conferences/explore" style={{ color: '#1B3828', fontWeight: 700 }}>Explore every conference</Link>
            {' '}by country, date and fee.
          </p>
          {hubs.length > 0 && (
            <ul className="flex flex-wrap gap-2" style={{ listStyle: 'none', margin: '20px 0 0', padding: 0 }}>
              {hubs.map(h => (
                <li key={h.slug}>
                  <Link
                    href={`/conferences/in/${h.slug}`}
                    className="inline-flex rounded-full px-3.5 py-2 focus:outline-none"
                    style={{ fontSize: 13, fontWeight: 600, color: '#1B3828', backgroundColor: '#F4EFE3', textDecoration: 'none', boxShadow: 'inset 0 0 0 1px rgba(27,56,40,0.10)' }}
                  >
                    MUN in {h.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
