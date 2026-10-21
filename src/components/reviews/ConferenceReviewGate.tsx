'use client';

// ConferenceReviewGate (owner, 21 Oct 2026): on a conference's own page, a
// person who attended it (the page's `eligible`: signed in, attended as
// user_attended_conference() counts it, the last day has passed per
// `reviewWindowOpen`, no review of theirs yet) gets the review pop-up EVERY
// time they open the page, until they submit one. "Not now" closes it for this
// page view only; nothing is stored, so the next visit asks again.
//
// It never stacks, the same way LiveRoomsGate does not: it waits on
// `useBasicsGateBlocking()` (the auth modal, the basics and name gates) and on
// any other modal layer on screen (aria-modal / role=dialog, or a full-screen
// fixed layer that takes the pointer), polled every 900 ms until the screen is
// clear. Once open it stays open (LiveRoomsGate, which polls too, steps aside
// for it), and hides only while one of the blocking gates is up. It is mounted
// only by the conference page, so it never opens on a live session route.

import { useEffect, useState, type CSSProperties } from 'react';
import { useBasicsGateBlocking } from '@/lib/basicsGateState';
import ConferenceReviewDialog, { REVIEW_DIALOG_ATTR } from './ConferenceReviewDialog';
import type { ReviewConference } from '@/lib/conferenceReviews';

function otherModalOnScreen(): boolean {
  if (typeof document === 'undefined') return false;
  const mine = (el: Element) => !!el.closest(`[${REVIEW_DIALOG_ATTR}]`);
  const dialogs = document.querySelectorAll('[aria-modal="true"], [role="dialog"], [role="alertdialog"]');
  for (const el of Array.from(dialogs)) {
    if (!mine(el) && (el as HTMLElement).getClientRects().length > 0) return true;
  }
  const layers = document.querySelectorAll('.fixed.inset-0');
  for (const el of Array.from(layers)) {
    if (mine(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.pointerEvents !== 'none' && cs.display !== 'none' && cs.visibility !== 'hidden') return true;
  }
  return false;
}

export default function ConferenceReviewGate({
  conference, eligible, themeStyle, onSubmitted,
}: {
  conference: Pick<ReviewConference, 'id' | 'acronym' | 'full_name' | 'logo_url' | 'start_date'>;
  eligible: boolean;
  themeStyle?: CSSProperties;
  onSubmitted: () => void;
}) {
  const gatesBlocking = useBasicsGateBlocking();
  // "Not now" for this page view (keyed by conference, so moving to another
  // conference's page in the same mount asks again there).
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const [openFor, setOpenFor] = useState<string | null>(null);
  const wanted = eligible && dismissedFor !== conference.id;
  const open = wanted && openFor === conference.id;

  useEffect(() => {
    if (!wanted || open || gatesBlocking) return;
    const check = () => { if (!otherModalOnScreen()) setOpenFor(conference.id); };
    // The first look is a short beat in, so the root-layout gates that load
    // with the page (credits welcome, set-up reminder, live rooms) go first.
    const id = window.setInterval(check, 900);
    return () => window.clearInterval(id);
  }, [wanted, open, gatesBlocking, conference.id]);

  if (!open || gatesBlocking) return null;
  return (
    <ConferenceReviewDialog
      conference={conference}
      themeStyle={themeStyle}
      onClose={() => setDismissedFor(conference.id)}
      onSubmitted={() => { setDismissedFor(conference.id); onSubmitted(); }}
    />
  );
}
