'use client';

/**
 * /manage/[slug]/financials/settings is now only the way back from Stripe
 * (prompt 94). Stripe's hosted onboarding returns here with ?connect=return
 * or ?connect=refresh: the account is checked once (connect-onboard 'status',
 * as before), the conference re-read, and the organizer is sent to the
 * dashboard with the Payment method pop-up open, or the welcome flow at its
 * registration fee step when they left from there. Without the query it just
 * forwards to the same pop-up, so old links to Financials → Settings work.
 * The payment set-up itself lives in financials/onboarding/.
 */

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useManage } from '@/app/manage/[slug]/layout';
import { connectStatus, sessionGet, welcomeMarkerKey } from '../onboarding/paymentApi';

export default function FinancialsStripeReturnPage() {
  const { conference, refreshConferenceQuiet } = useManage();
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (!conference || ran.current) return;
    ran.current = true;
    const param = new URLSearchParams(window.location.search).get('connect');
    const resumeWelcome = sessionGet(welcomeMarkerKey(conference.id)) === '1';
    const target = `/manage/${conference.slug}/financials?open=${resumeWelcome ? 'welcome4' : 'payment'}`;
    if (param !== 'return' && param !== 'refresh') { router.replace(target); return; }
    void (async () => {
      await connectStatus(conference.id);
      refreshConferenceQuiet();
      router.replace(target);
    })();
  }, [conference, refreshConferenceQuiet, router]);

  return <p className="gv-st-quiet" aria-live="polite" style={{ fontSize: 15 }}>Taking you back to Financials</p>;
}
