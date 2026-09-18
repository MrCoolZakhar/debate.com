'use client';

// Counts one anonymous view of a public conference page, once per browser
// session per conference, and remembers the first-touch SOURCE in this browser
// so an application filed later can carry the category. No cookie, no id, no
// fingerprint: the request body is { slug, source, host? } and nothing else.
// The viewer's access token is forwarded only so the database can skip the
// conference's own organisers; it is never stored. See src/lib/trafficSource.ts.

import { useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { classifyTraffic, rememberFirstTouch } from '@/lib/trafficSource';

/** True when this page was reached by an in-app (client-side) navigation. */
function reachedInApp(): boolean {
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (!nav?.name) return false;
    return new URL(nav.name).pathname !== window.location.pathname;
  } catch {
    return false;
  }
}

export default function ConferenceViewBeacon({ slug }: { slug: string }) {
  const { session, loading } = useAuth();
  const token = session?.access_token ?? null;

  useEffect(() => {
    if (loading || !slug) return;
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
    const { source, host } = classifyTraffic({
      referrer: document.referrer,
      search: window.location.search,
      ownOrigin: window.location.origin,
      internalNav: reachedInApp(),
    });
    rememberFirstTouch(slug, source);
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
