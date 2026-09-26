'use client';

// ── Mounted once in the root layout ─────────────────────────────────────────
//
// Renders whichever purchase pop-up the store says is open
// (src/lib/purchasePopup.ts), handles a Stripe return on ANY page
// (?credits=success&session_id=… / ?unlimited=success&session_id=…, the
// 3-D Secure path out of an embedded payment, and the hosted fallback), and
// mounts the site's notification stack on the pages that do not already have
// one, so a success toast has somewhere to land.

import { Suspense, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { usePurchasePopup } from '@/lib/purchasePopup';
import { notifyOk } from '@/lib/appNotify';
import { pollCreditsUntilChanged, readCreditBalance, refreshCreditsEverywhere } from '@/hooks/useCredits';
import { waitForUnlimited } from '@/lib/unlimitedStatus';
import PurchaseActivationNotice from './PurchaseActivationNotice';
import NotificationStack from '@/components/notifications/NotificationStack';
import { useNotifications } from '@/lib/sessionNotifications';
import CreditsPopup from './CreditsPopup';
import UnlimitedPopup from './UnlimitedPopup';
import { PURCHASE_CSS } from './purchaseKit';

/** Surfaces that mount their own <NotificationStack/> (chair page, /manage). */
const OWN_STACK_PREFIXES = ['/manage', '/chair', '/voting', '/delegate', '/advisor'];

export default function PurchasePopupHost() {
  const st = usePurchasePopup();
  const pathname = usePathname();
  const ownStack = OWN_STACK_PREFIXES.some((p) => pathname === p || pathname?.startsWith(p + '/'));
  return (
    <>
      <Suspense fallback={null}><PurchaseReturnHandler /></Suspense>
      {!ownStack && <LazyStack />}
      <PurchaseActivationNotice />
      {st.open ? <style>{PURCHASE_CSS}</style> : null}
      {st.open && st.kind === 'credits' ? <CreditsPopup key={st.nonce} request={st.request} /> : null}
      {st.open && st.kind === 'unlimited' ? <UnlimitedPopup key={st.nonce} request={st.request} /> : null}
    </>
  );
}

/** The stack runs one interval for the life of its mount, so it is mounted
 *  only while there is a card to show; with no card there is nothing to tick. */
function LazyStack() {
  const { items } = useNotifications();
  if (items.length === 0) return null;
  return <NotificationStack topPx={88} />;
}

function PurchaseReturnHandler() {
  const sp = useSearchParams();
  const credits = sp.get('credits');
  const unlimited = sp.get('unlimited');
  const { user, loading } = useAuth();
  useEffect(() => {
    if (loading) return;
    if (!credits && !unlimited) return;
    const url = new URL(window.location.href);
    const p = url.searchParams;
    if (!p.get('credits') && !p.get('unlimited')) return;
    ['credits', 'unlimited', 'session_id'].forEach((k) => p.delete(k));
    window.history.replaceState(window.history.state, '', url.pathname + (p.toString() ? `?${p.toString()}` : '') + url.hash);
    if (!user) return;
    if (credits === 'success') {
      notifyOk('Payment received. Your credits are being added.', 'purchase');
      void readCreditBalance().then((prev) => {
        refreshCreditsEverywhere();
        return pollCreditsUntilChanged(prev);
      }).then((now) => {
        if (now !== null) notifyOk(`Credits added. You now have ${now}.`, 'purchase');
      });
    }
    if (unlimited === 'success') {
      notifyOk('Welcome to Gavelling Unlimited.', 'purchase');
      // The webhook writes the plan a few seconds later: poll until it lands,
      // then every reader updates at once.
      void waitForUnlimited(user.id);
      refreshCreditsEverywhere();
    }
  }, [credits, unlimited, user, loading]);
  return null;
}
