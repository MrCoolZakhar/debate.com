'use client';

// ── /pricing/subscription?renew=once ─────────────────────────────────────────
// The failed-renewal email links here. On mount, once, open the Unlimited
// pop-up in its one-time-year form and take `renew` out of the URL so a
// reload or a shared link does not open it again. Mounted inside a Suspense
// boundary by the page, because useSearchParams needs one; the boundary never
// wraps the h1.

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { openUnlimitedPopup } from '@/lib/purchasePopup';

export default function RenewOnceOpener() {
  const params = useSearchParams();
  const fired = useRef(false);
  const renew = params?.get('renew');

  useEffect(() => {
    if (renew !== 'once' || fired.current) return;
    fired.current = true;
    openUnlimitedPopup({ renewOnce: true });
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('renew');
      window.history.replaceState(window.history.state, '', url.pathname + (url.search || '') + url.hash);
    } catch {
      /* the URL is cosmetic here; the pop-up is already open */
    }
  }, [renew]);

  return null;
}
