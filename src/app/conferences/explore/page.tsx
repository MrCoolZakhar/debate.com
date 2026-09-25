import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { exploreOgImageUrl } from '@/lib/ogVersion';
import { Suspense } from 'react';
import Link from 'next/link';
import ConferencesExploreClient from './ConferencesExploreClient';
import Loader from '@/components/Loader';

// The crawl path to every conference page and every country hub is NOT on this
// page any more: it is /conferences/all (src/app/conferences/all/page.tsx),
// linked from every public footer. The directory that used to sit under the
// grid here read as a second footer and was moved there (24 Sep 2026, owner).
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

export default function ConferencesExplorePage() {
  return (
    <>
      <Suspense
        fallback={
          <div
            className="flex flex-col items-center justify-center px-6 text-center"
            style={{ minHeight: '100vh', backgroundColor: '#EDE7D8', fontFamily: "var(--font-brand), sans-serif" }}
          >
            {/* The grid bails out to client rendering (useSearchParams), so
                this fallback IS the server HTML in production. Its heading
                gives crawlers the page's h1; the client grid replaces it with
                its own. The sentence and the link under the loader are the
                page's real text and its plain <a href> into the directory
                (/conferences/all) for crawlers and no-JS visitors; the check
                needs 250+ characters of body text in the raw HTML. */}
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
    </>
  );
}
