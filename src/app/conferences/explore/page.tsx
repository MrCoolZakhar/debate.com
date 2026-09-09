import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { Suspense } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import ConferencesExploreClient from './ConferencesExploreClient';
import Loader from '@/components/Loader';

// Re-render hourly so the server-rendered directory below picks up newly
// published conferences without a redeploy.
export const revalidate = 3600;

export const metadata: Metadata = pageMetadata({
  title: 'Explore Model UN Conferences',
  description:
    'Browse Model UN conferences around the world by country, date, fee, and level. See committees, deadlines, and fees, then apply as a delegate, chair, or advisor in minutes.',
  path: '/conferences/explore',
  ogDescription:
    'Browse Model UN conferences around the world by country, date, fee, and level. Apply as a delegate, chair, or advisor in minutes.',
});

interface DirectoryConf {
  slug: string;
  full_name: string;
  city: string | null;
  country: string | null;
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
      .select('slug, full_name, city, country')
      .eq('is_public', true)
      .order('full_name', { ascending: true });
    confs = ((data as DirectoryConf[]) ?? []).filter((c) => c.slug && c.full_name);
  } catch {
    return null;
  }
  if (confs.length === 0) return null;

  return (
    <section
      aria-label="All conferences on Gavelling"
      style={{ backgroundColor: '#EDE7D8', borderTop: '1px solid rgba(221,212,192,0.9)' }}
    >
      <div className="mx-auto max-w-6xl px-6 py-8">
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
              fontFamily: "'Outfit', sans-serif",
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
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#1B3828',
                    textDecoration: 'none',
                  }}
                >
                  {c.full_name}
                </Link>
                {place && (
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: '#9A8A78' }}>
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

export default function ConferencesExplorePage() {
  return (
    <>
      <Suspense
        fallback={
          <div
            className="flex items-center justify-center"
            style={{ minHeight: '100vh', backgroundColor: '#EDE7D8' }}
          >
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
