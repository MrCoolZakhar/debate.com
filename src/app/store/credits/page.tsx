import { Suspense } from 'react';
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { StoreBar } from '@/components/store/storeKit';
import RenewOnceOpener from '@/components/pricing/RenewOnceOpener';

// ── Credits and Unlimited (/store/credits) ──────────────────────────────────
// Prompt 86 fills this page (bundles, Unlimited, ?plan=unlimited scrolls to
// it). Until then the tab never 404s, and the failed-renewal email's
// ?renew=once (redirected from /pricing/subscription) still opens the
// Unlimited pop-up.

export const metadata: Metadata = pageMetadata({
  title: 'Credits and Unlimited',
  description: 'Gavelling credits and Gavelling Unlimited: one credit is one conference application, and Unlimited covers every application while it is active.',
  path: '/store/credits',
});

export default function StoreCreditsPage() {
  return (
    <>
      <StoreBar />
      <Suspense fallback={null}>
        <RenewOnceOpener />
      </Suspense>
      <header className="gv-s-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 'clamp(40px, 5vw, 72px)', paddingBottom: 'clamp(40px, 5vw, 72px)' }}>
        <h1 className="gv-s-caps" style={{ fontSize: 'clamp(56px, 7.4vw, 124px)' }}>Credits and Unlimited</h1>
        <p className="gv-s-line" style={{ fontSize: 19 }}>Coming in the next update</p>
      </header>
    </>
  );
}
