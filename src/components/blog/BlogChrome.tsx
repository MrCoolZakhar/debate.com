/**
 * The chrome every blog page wears: the site header at the top, the ONE site
 * footer (SiteFooter) at the bottom, and the ivory page between them.
 *
 * WHY IT EXISTS. Until now a blog page had NO navigation at all. A reader
 * arriving from Google on "how to run a moderated caucus" reached a text column
 * with one link back to /blog and no way into the product, the conferences
 * directory, or anything else. That is the single biggest thing wrong with the
 * section (docs/ui-audit/00-DESIGN-RULEBOOK.md §8, item 2) and it is also an
 * indexability problem: CLAUDE.md §4 requires every sitemap URL to be reachable
 * by a plain server-rendered <a href> from another sitemap page, and the blog
 * was a leaf with one edge.
 *
 * `brand="conferences"` is stated rather than left to SiteNav's pathname
 * heuristic (which would read /blog as unknown). The blog is the top of the
 * whole funnel and Gavelling is conferences-first.
 */

import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';

const PAGE = '#EDE7D8';

export default function BlogChrome({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: PAGE, display: 'flex', flexDirection: 'column' }}>
      <SiteNav brand="conferences" />
      <main style={{ flex: 1 }}>{children}</main>

      <SiteFooter className="mt-[72px]" />
    </div>
  );
}
