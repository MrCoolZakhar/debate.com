'use client';

// Counts one anonymous view per page key per browser session across the
// site, the same way ConferenceViewBeacon counts a conference page. The body
// is { page, source } and nothing else. Nothing is counted on localhost,
// 127.0.0.1 or *.vercel.app (they share the production database). Mounted
// once in the root layout. See src/lib/siteView.ts.

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { sitePageKey, siteSourceWord } from '@/lib/siteView';

export default function SiteViewBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname) return;
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h.endsWith('.vercel.app')) return;
    const page = sitePageKey(pathname);
    const flag = `gavelling-site-view:${page}`;
    try {
      if (sessionStorage.getItem(flag)) return;
      sessionStorage.setItem(flag, '1');
    } catch {
      return; // no session storage: do not risk counting every render
    }
    const source = siteSourceWord();
    fetch('/api/site-view', {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page, source }),
    }).catch(() => { /* a lost count is fine */ });
  }, [pathname]);
  return null;
}
