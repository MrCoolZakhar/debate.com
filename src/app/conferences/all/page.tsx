import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { pageMetadata, SITE_URL } from '@/lib/seo';
import { supabase } from '@/lib/supabase';
import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';
import { isListedConference } from '@/lib/publicConferences';
import { countryHubs } from '@/lib/countryHubs';

// /conferences/all: the plain directory of every listed conference and every
// country hub, as server-rendered <a href>s.
//
// THIS PAGE IS THE CRAWL PATH (CLAUDE.md §4). The browse grid on
// /conferences/explore renders client-side, so its conference links are not
// in the raw HTML. This page used to live as a section under that grid, where
// it read as a second footer; it moved here (24 Sep 2026, owner) and is linked
// from every public footer (FooterLegal, "All conferences"), so every
// conference page and every country hub is one hop from any public page.
// Never noindex it, never render these lists client-side, and keep it in the
// sitemap (src/app/sitemap.ts).

// Re-render hourly so newly published conferences appear without a redeploy.
export const revalidate = 3600;

export const metadata: Metadata = pageMetadata({
  title: 'All Model UN Conferences on Gavelling',
  description:
    'Every Model UN conference listed on Gavelling, A to Z, with the city and country of each, plus country pages for the places with the most upcoming conferences.',
  path: '/conferences/all',
});

const SANS = 'var(--font-brand), sans-serif';
const FOREST = '#1B3828';
const INK = '#1C1410';
const INK_SOFT = '#5C5140';
const GOLD = '#B6871F';

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

async function loadConferences(): Promise<DirectoryConf[]> {
  try {
    const { data } = await supabase
      .from('conferences')
      .select('slug, full_name, city, country, is_demo, start_date, end_date, updated_at')
      .eq('is_public', true)
      .order('full_name', { ascending: true });
    // Test and demo conferences are never listed (src/lib/publicConferences.ts).
    return ((data as DirectoryConf[]) ?? [])
      .filter((c) => c.slug && c.full_name?.trim() && isListedConference(c))
      .map((c) => ({ ...c, full_name: c.full_name.replace(/\s+/g, ' ').trim() }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name, 'en', { sensitivity: 'base' }));
  } catch {
    return [];
  }
}

/** The A to Z heading a conference files under: its first letter, or # . */
function initialOf(name: string): string {
  const ch = name.normalize('NFKD').replace(/[̀-ͯ]/g, '').charAt(0).toUpperCase();
  return /[A-Z]/.test(ch) ? ch : '#';
}

function groupByInitial(confs: DirectoryConf[]): [string, DirectoryConf[]][] {
  const groups = new Map<string, DirectoryConf[]>();
  for (const c of confs) {
    const k = initialOf(c.full_name);
    const list = groups.get(k) ?? [];
    list.push(c);
    groups.set(k, list);
  }
  return [...groups.entries()].sort(([a], [b]) => (a === '#' ? -1 : b === '#' ? 1 : a.localeCompare(b)));
}

const h2Style: React.CSSProperties = {
  fontFamily: SANS,
  fontWeight: 800,
  fontSize: 12,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: INK_SOFT,
  margin: '0 0 16px',
};

export default async function AllConferencesPage() {
  const confs = await loadConferences();
  const hubs = countryHubs(confs);
  const groups = groupByInitial(confs);

  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Conferences', item: `${SITE_URL}/conferences/explore` },
      { '@type': 'ListItem', position: 3, name: 'All conferences', item: `${SITE_URL}/conferences/all` },
    ],
  };

  return (
    <div style={{ backgroundColor: '#FAF8F3', minHeight: '100vh' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />
      <SiteNav brand="conferences" />
      <main
        className="mx-auto w-full max-w-5xl px-4 sm:px-6"
        style={{ paddingTop: 40, paddingBottom: 72, fontFamily: SANS }}
      >
        <nav aria-label="Breadcrumb" style={{ fontSize: 13, color: INK_SOFT }}>
          <Link href="/conferences/explore" style={{ color: FOREST, fontWeight: 600, textDecoration: 'none' }}>
            Conferences
          </Link>
          <span aria-hidden="true"> / </span>
          <span>All conferences</span>
        </nav>
        <h1
          style={{
            fontWeight: 900,
            fontSize: 'clamp(30px, 4.4vw, 52px)',
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
            color: INK,
            margin: '14px 0 12px',
            textWrap: 'balance',
          }}
        >
          All Model UN conferences on Gavelling
        </h1>
        <p
          style={{
            fontSize: 'clamp(15px, 1.1vw, 18px)',
            lineHeight: 1.6,
            color: '#4A4238',
            maxWidth: 640,
            margin: 0,
            textWrap: 'pretty',
          }}
        >
          {confs.length > 0
            ? `Every conference listed on Gavelling, ${confs.length} in all, from A to Z. `
            : 'Every conference listed on Gavelling, from A to Z. '}
          Each page has the committees, dates and fees, and you apply as a delegate, chair or advisor with one
          profile. To filter by date, fee or level,{' '}
          <Link href="/conferences/explore" className="hover:text-[#0F3A28]" style={{ color: FOREST, fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3 }}>
            explore conferences
          </Link>
          .
        </p>

        {hubs.length > 0 && (
          <section aria-labelledby="by-country" style={{ marginTop: 44 }}>
            <h2 id="by-country" style={h2Style}>
              By country
            </h2>
            <ul
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-1"
              style={{ listStyle: 'none', margin: 0, padding: 0 }}
            >
              {hubs.map((h) => (
                <li key={h.slug}>
                  <Link
                    href={`/conferences/in/${h.slug}`}
                    className="group inline-flex items-center gap-2 py-1.5 focus:outline-none focus-visible:underline"
                    style={{ color: FOREST, textDecoration: 'none', fontSize: 15, fontWeight: 600 }}
                  >
                    <MapPin size={15} aria-hidden="true" style={{ color: GOLD, flexShrink: 0 }} />
                    <span className="group-hover:underline">Model UN in {h.name}</span>
                    <span style={{ color: INK_SOFT, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                      {h.count} upcoming
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="a-to-z" style={{ marginTop: 48 }}>
          <h2 id="a-to-z" style={h2Style}>
            A to Z
          </h2>
          {confs.length === 0 ? (
            <p style={{ fontSize: 15, color: INK_SOFT, margin: 0 }}>
              The list could not be loaded just now. Please try again in a moment, or{' '}
              <Link href="/conferences/explore" className="hover:text-[#0F3A28]" style={{ color: FOREST, fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3 }}>
                explore conferences
              </Link>
              .
            </p>
          ) : (
            <div className="flex flex-col" style={{ gap: 28 }}>
              {groups.map(([letter, list]) => (
                <div key={letter} className="grid grid-cols-[2.25rem_1fr] gap-x-3">
                  <h3
                    aria-label={letter === '#' ? 'Other' : letter}
                    style={{
                      margin: 0,
                      fontSize: 20,
                      fontWeight: 800,
                      lineHeight: '28px',
                      color: GOLD,
                    }}
                  >
                    {letter}
                  </h3>
                  <ul
                    className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2"
                    style={{
                      listStyle: 'none',
                      margin: 0,
                      padding: '0 0 0 0',
                      borderTop: '1px solid rgba(221,212,192,0.9)',
                      paddingTop: 10,
                    }}
                  >
                    {list.map((c) => {
                      const place = [c.city, c.country]
                        .map((s) => (s ?? '').replace(/\s+/g, ' ').trim())
                        .filter(Boolean)
                        .join(', ');
                      return (
                        <li key={c.slug} style={{ lineHeight: 1.45 }}>
                          <Link
                            href={`/conferences/${c.slug}`}
                            className="hover:underline focus:outline-none focus-visible:underline"
                            style={{ fontSize: 15, fontWeight: 600, color: FOREST, textDecoration: 'none' }}
                          >
                            {c.full_name}
                          </Link>
                          {place && (
                            <span style={{ display: 'block', fontSize: 13, color: INK_SOFT }}>{place}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
