'use client';

// Counts one anonymous view of a public conference page, once per browser
// session per conference. No cookie, no id, no fingerprint: the request body
// is { slug, source, host? } and nothing else. The viewer's access token is
// forwarded only so the database can skip the conference's own organisers and
// anyone who already applied to it (a returning applicant is not a new
// visitor); it is never stored. See src/lib/trafficSource.ts.
//
// Which source a view is counted under (25 Sep 2026):
//   - the visit began on this conference's own pages: where THAT landing came
//     from (Instagram, Google, a direct link ...);
//   - it began elsewhere and reached here inside the app, and this browser
//     already knows how the visitor first found the conference: that first
//     touch, not 'gavelling';
//   - otherwise what the landing says ('gavelling' for Explore, home, ...),
//     and 'direct' when the visit began on an auth step with nothing stored.
// The first touch itself is kept by FirstTouchCapture (the conference layout),
// which also runs on localhost; only the COUNTING is skipped there.

import { useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { classifyLanding, ensureFirstTouch } from '@/lib/trafficSource';
import type { TrafficSource } from '@/lib/trafficSource';

export default function ConferenceViewBeacon({ slug }: { slug: string }) {
  const { session, loading } = useAuth();
  const token = session?.access_token ?? null;

  useEffect(() => {
    if (loading || !slug) return;
    // Read before anything is stored by this visit, then keep the first touch.
    const landing = classifyLanding(slug);
    const stored = ensureFirstTouch(slug);
    // Local dev and preview deployments share the production database: never
    // let them add to an organiser's numbers.
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h.endsWith('.vercel.app')) return;
    const flag = `gavelling-view:${slug}`;
    try {
      if (sessionStorage.getItem(flag)) return;
      sessionStorage.setItem(flag, '1');
    } catch {
      return; // no session storage: do not risk counting every render
    }
    let source: TrafficSource;
    let host: string | null = null;
    if (landing?.onThisConference) {
      source = landing.source;
      host = landing.host;
    } else if (stored) {
      source = stored.source;
      host = stored.source === 'other' ? stored.detail : null;
    } else {
      source = landing?.source ?? 'direct';
      host = landing?.host ?? null;
    }
    fetch('/api/conference-view', {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ slug, source, ...(host ? { host } : {}) }),
    }).catch(() => { /* a lost count is fine */ });
    // Once per mount; the token is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, slug]);

  return null;
}
