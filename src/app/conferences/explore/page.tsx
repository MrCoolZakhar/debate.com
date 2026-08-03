import type { Metadata } from 'next';
import { OG_BASE } from '@/lib/seo';
import { Suspense } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import ConferencesExploreClient from './ConferencesExploreClient';

// Re-render hourly so the server-rendered directory below picks up newly
// published conferences without a redeploy.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Explore Model UN Conferences',
  description:
    'Browse Model UN conferences around the world by country, date, fee, and level. See committees, deadlines, and fees, then apply as a delegate, chair, or advisor in minutes.',
  alternates: { canonical: 'https://gavelling.com/conferences/explore' },
  openGraph: {
    ...OG_BASE,
    title: 'Explore Model UN Conferences',
    description:
      'Browse Model UN conferences around the world by country, date, fee, and level. Apply as a delegate, chair, or advisor in minutes.',
    url: 'https://gavelling.com/conferences/explore',
    siteName: 'Gavelling',
    type: 'website',
  },
};

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
      <div className="mx-auto max-w-6xl px-6 py-12">
        <h2
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontWeight: 800,
            fontSize: 11,
            letterSpacing: '0.14em',
            color: '#9A8A78',
            textTransform: 'uppercase',
            margin: 0,
          }}
        >
          Every conference on Gavelling
        </h2>
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
      </div>
    </section>
  );
}

export default function ConferencesExplorePage() {
  return (
    <>
      <Suspense fallback={<div style={{ minHeight: '100vh', backgroundColor: '#EDE7D8' }} />}>
        <ConferencesExploreClient />
      </Suspense>
      <ConferenceDirectory />
    </>
  );
}
