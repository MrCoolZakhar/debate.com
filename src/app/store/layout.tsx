import type { ReactNode } from 'react';
import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';
import { GotAQuestion, StoreStyles } from '@/components/store/storeKit';

// ── The Store shell (prompt 85, 27 Nov 2026) ────────────────────────────────
// Black edge to edge (the owner's exception to the ivory page rule, CLAUDE.md
// section 8): the site nav in its overlay tone on a black band, the page, the
// Got a question box, then the site footer (the crawl path every public page
// carries). Each page mounts its own sticky StoreBar, because on /store it
// sits under the sale hero.

export default function StoreLayout({ children }: { children: ReactNode }) {
  return (
    // overflow-x CLIP, never hidden: hidden would make this a scroll container
    // and the sticky StoreBar would stop sticking.
    <div className="gv-s min-h-screen flex flex-col" style={{ overflowX: 'clip' }}>
      <StoreStyles />
      <div className="gv-s-navband">
        <SiteNav overlay />
      </div>
      <main style={{ flex: '1 1 auto', minWidth: 0 }}>{children}</main>
      <GotAQuestion />
      <SiteFooter />
    </div>
  );
}
