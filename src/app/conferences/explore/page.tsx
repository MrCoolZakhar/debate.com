import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { exploreOgImageUrl } from '@/lib/ogVersion';
import { Suspense } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import ConferencesExploreClient from './ConferencesExploreClient';
import Loader from '@/components/Loader';
import { isListedConference } from '@/lib/publicConferences';
import { countryHubs, type CountryHub } from '@/lib/countryHubs';

// Re-render hourly so the server-rendered directory below picks up newly
// published conferences without a redeploy.
export const revalidate = 3600;

export const metadata: Metadata = pageMetadata({
  title: 'Explore Model UN Conferences',
  description:
    'Browse Model UN conferences around the world by country, date, fee, and level. See committees, deadlines, and fees, then apply as a delegate, chair, or advisor in minutes.',
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

interface DirectoryConf {
  slug: string;
  full_name: string;
  city: string | null;
  country: string | null;
  is_demo: boolean | null;
  start_date: string | null;
  end_date: string | null;
  updated_at: string | null;
}

// The interactive grid above loads client-side (and geo-filters by default),
// so its conference links never appear in the server HTML. This plain,
// visible directory gives crawlers — and no-JS visitors — a real <a href>
// path to every public conference page, with the conference name as anchor
// text.
async function ConferenceDirectory() {
  let confs: DirectoryConf[] = [];
  try {
    const { data } = await supabase
      .from('conferences')
      .select('slug, full_name, city, country, is_demo, start_date, end_date, updated_at')
      .eq('is_public', true)
      .order('full_name', { ascending: true });
    // Test and demo conferences are never listed (src/lib/publicConferences.ts).
    confs = ((data as DirectoryConf[]) ?? []).filter((c) => c.full_name && isListedConference(c));
  } catch {
    return null;
  }
  if (confs.length === 0) return null;
  const hubs = countryHubs(confs);

  return (
    <section
      aria-label="All conferences on Gavelling"
      style={{ backgroundColor: '#EDE7D8', borderTop: '1px solid rgba(221,212,192,0.9)' }}
    >
      <div className="mx-auto max-w-6xl px-6 py-8">
        {hubs.length > 0 && <CountryHubLinks hubs={hubs} />}
        {/* COLLAPSED, NOT REMOVED, and the distinction is the whole point.
            This wall of names is the crawl path: the browse UI above renders
            client-side, so without these <a href>s the conference pages have
            no server-rendered route in from anywhere, which is what had
            Search Console reporting them as "Discovered, currently not
            indexed".

            <details> keeps every link in the delivered HTML and keeps it one
            hop from this page. Google indexes content inside an accordion
            normally and has said so repeatedly; it is NOT the `display:none`
            case the original comment warned about, because that one hides
            content the markup still asserts is visible. Here the markup says
            "this is a disclosure widget", which is honest, and it is what
            <details> is for.

            So the SEO is untouched and the page stops being a directory
            nobody asked for. It also stops getting worse: at 54 conferences
            it was a screenful, at 500 it would be a wall. */}
        <details>
          <summary
            className="focus:outline-none"
            style={{
              fontFamily: "var(--font-brand), sans-serif",
              fontWeight: 800,
              fontSize: 11,
              letterSpacing: '0.14em',
              color: '#9A8A78',
              textTransform: 'uppercase',
              cursor: 'pointer',
              listStyle: 'none',
            }}
          >
            Every conference on Gavelling ({confs.length})
          </summary>
        <ul
          className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2.5"
          style={{ listStyle: 'none', margin: 0, padding: 0 }}
        >
          {confs.map((c) => {
            const place = [c.city, c.country].filter(Boolean).join(', ');
            return (
              <li key={c.slug}>
                <Link
                  href={`/conferences/${c.slug}`}
                  style={{
                    fontFamily: "var(--font-brand), sans-serif",
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#1B3828',
                    textDecoration: 'none',
                  }}
                >
                  {c.full_name}
                </Link>
                {place && (
                  <span style={{ fontFamily: "var(--font-brand), sans-serif", fontSize: 12, color: '#9A8A78' }}>
                    {' '}— {place}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        </details>
      </div>
    </section>
  );
}

// Country hubs (/conferences/in/<country>) for every country with enough
// upcoming conferences: plain links, always open, so each hub has a
// server-rendered way in. Deliberately here and NOT in the footer.
function CountryHubLinks({ hubs }: { hubs: CountryHub[] }) {
  return (
    <nav aria-label="Conferences by country" style={{ marginBottom: 28 }}>
      <h2
        style={{
          fontFamily: "var(--font-brand), sans-serif",
          fontWeight: 800,
          fontSize: 11,
          letterSpacing: '0.14em',
          color: '#5C5140',
          textTransform: 'uppercase',
          margin: '0 0 12px',
        }}
      >
        Conferences by country
      </h2>
      <ul className="flex flex-wrap gap-2" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {hubs.map((h) => (
          <li key={h.slug}>
            <Link
              href={`/conferences/in/${h.slug}`}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 focus:outline-none"
              style={{
                fontFamily: "var(--font-brand), sans-serif",
                fontSize: 13,
                fontWeight: 600,
                color: '#1B3828',
                backgroundColor: '#F4EFE3',
                textDecoration: 'none',
                boxShadow: 'inset 0 0 0 1px rgba(27,56,40,0.10)',
              }}
            >
              MUN in {h.name}
              <span style={{ color: '#5C5140', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{h.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function ConferencesExplorePage() {
  return (
    <>
      <Suspense
        fallback={
          <div
            className="flex items-center justify-center"
            style={{ minHeight: '100vh', backgroundColor: '#EDE7D8' }}
          >
            {/* The grid bails out to client rendering (useSearchParams), so
                this fallback IS the server HTML. Its heading gives crawlers the
                page's h1; the client grid replaces it with its own. */}
            <h1 className="sr-only">Explore Model UN conferences</h1>
            <Loader size={72} label="Loading conferences" />
          </div>
        }
      >
        <ConferencesExploreClient />
      </Suspense>
      <ConferenceDirectory />
    </>
  );
}
