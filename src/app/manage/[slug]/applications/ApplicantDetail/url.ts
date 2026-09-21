'use client';

// URL state for the applicant pop-up: ?app=<application id>&tab=<tab>.
// The pop-up is linkable and survives a reload. Written with
// history.replaceState (the Next app router syncs useSearchParams with it),
// so opening and closing never adds history entries and never triggers a
// data refetch.

import { useEffect, useRef } from 'react';

export const APPLICANT_TABS = ['overview', 'preferences', 'experience', 'answers', 'payment'] as const;
export type ApplicantTab = typeof APPLICANT_TABS[number];

function writeParams(mut: (p: URLSearchParams) => void) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  const before = url.search;
  mut(url.searchParams);
  if (url.search === before) return;
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

/** The application id in the URL when the page loads. */
export function initialApplicantId(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('app');
}

/** The tab in the URL, if it names a real tab. */
export function initialApplicantTab(): ApplicantTab | null {
  if (typeof window === 'undefined') return null;
  const t = new URLSearchParams(window.location.search).get('tab');
  return (APPLICANT_TABS as readonly string[]).includes(t ?? '') ? (t as ApplicantTab) : null;
}

export function writeApplicantTab(tab: ApplicantTab) {
  writeParams(p => { if (tab === 'overview') p.delete('tab'); else p.set('tab', tab); });
}

/**
 * Keeps ?app= in step with the page's open review id.
 * `loaded` = the applications list has arrived; only then can an id from the
 * URL that matches no application be dropped from the address bar.
 */
export function useApplicantUrlSync(reviewId: string | null, exists: boolean, loaded: boolean) {
  const prev = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (prev.current === undefined) {
      prev.current = reviewId;
      // First render: the id came FROM the URL, nothing to write.
      if (reviewId && loaded && !exists) writeParams(p => { p.delete('app'); p.delete('tab'); });
      return;
    }
    if (reviewId && loaded && !exists) {
      writeParams(p => { p.delete('app'); p.delete('tab'); });
      prev.current = reviewId;
      return;
    }
    if (prev.current === reviewId) return;
    const switched = prev.current !== reviewId;
    prev.current = reviewId;
    writeParams(p => {
      if (reviewId) {
        p.set('app', reviewId);
        if (switched) p.delete('tab');
      } else {
        p.delete('app');
        p.delete('tab');
      }
    });
  }, [reviewId, exists, loaded]);
}
