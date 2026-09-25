// siteView.ts — the site-wide anonymous page counter (25 Sep 2026).
//
// One short page key per path and one source word per browser session, and
// nothing else: no cookie, no id, no IP, no user agent leaves the browser.
// The source is judged the way the conference counter judges a landing
// (src/lib/trafficSource.ts): the LANDING document's referrer or utm, decided
// once per session and kept in sessionStorage, so every page of the visit is
// filed under where the visit began. Auth hops decide nothing ('direct').

import { classifyTraffic } from '@/lib/trafficSource';

export const SITE_SOURCE_KEY = 'gavelling-site-source';

/** The page key for a path: home, explore, guides/<slug>, conference, other ... */
export function sitePageKey(pathname: string): string {
  const p = (pathname || '/').toLowerCase().replace(/\/+$/, '') || '/';
  if (p === '/') return 'home';
  const seg = p.split('/').filter(Boolean);
  const first = seg[0];
  const slug = (s: string | undefined) => (s ? s.replace(/[^a-z0-9_-]/g, '').slice(0, 40) : '');
  if (first === 'conferences') {
    if (seg[1] === 'explore') return 'explore';
    if (seg[1] === 'map') return 'map';
    if (seg[1] === 'all' || seg[1] === 'roles' || seg[1] === 'new' || seg[1] === 'in') return `conferences/${seg[1]}`;
    if (seg[1]) return 'conference';
    return 'other';
  }
  if (first === 'guides') return seg[1] ? `guides/${slug(seg[1])}` : 'guides';
  if (first === 'blog') return seg[1] ? `blog/${slug(seg[1])}` : 'blog';
  if (first === 'pricing') return 'pricing';
  if (first === 'help') return 'help';
  if (first === 'sessions') return 'sessions';
  if (first === 'join') return 'join';
  if (first === 'create') return 'create';
  if (first === 'manage') return 'manage';
  if (first === 'account' || first === 'my-conferences') return 'account';
  if (first === 'about' || first === 'contact' || first === 'organisers' || first === 'cv') return first;
  return 'other';
}

/** The visit's source word, decided on the first page of the session. */
export function siteSourceWord(): string {
  try {
    const kept = sessionStorage.getItem(SITE_SOURCE_KEY);
    if (kept) return kept;
  } catch { /* no storage: decide each time */ }
  let word = 'direct';
  try {
    let landing = window.location.href;
    try {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      if (nav?.name) landing = nav.name;
    } catch { /* use the current location */ }
    const url = new URL(landing);
    const c = url.searchParams.has('auth') || url.pathname.startsWith('/auth')
      ? null
      : classifyTraffic({ referrer: document.referrer, search: url.search, ownOrigin: window.location.origin, internalNav: false, userAgent: navigator.userAgent });
    if (c) word = (c.detail ?? c.source).toLowerCase();
  } catch { /* direct */ }
  if (!/^[a-z0-9][a-z0-9.-]{0,39}$/.test(word)) word = 'other';
  try { sessionStorage.setItem(SITE_SOURCE_KEY, word); } catch { /* fine */ }
  return word;
}
