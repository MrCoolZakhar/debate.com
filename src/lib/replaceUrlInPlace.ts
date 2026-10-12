// ── Change the query string without asking the server (11 Oct 2026) ──────────
//
// `router.replace(sameUrlWithNewQuery)` makes the App Router fetch the page's
// server payload again. Right after a production deploy that payload comes
// from the NEW build, Next sees the build has changed under the open tab and
// falls back to a full page load of the same URL ("hard navigation"). For a
// filter, a tab or a one-off notice param that is a spontaneous reload of the
// page the person is reading: the "weird reload" the owner reported, and it
// throws away anything open or typed.
//
// Next patches `window.history.replaceState` so `useSearchParams` and
// `usePathname` follow it with NO server request (documented App Router
// behaviour since 14.1), so a query-only change on a client-rendered page can
// never trip a deploy-skew reload. Use this only when nothing the SERVER
// renders depends on the query (a 'use client' page, or a server page that
// ignores searchParams); a real navigation to another page stays router.push.

export function replaceUrlInPlace(url: string): void {
  if (typeof window === 'undefined') return;
  try {
    const next = new URL(url, window.location.href);
    if (next.origin !== window.location.origin) {
      window.location.replace(next.toString());
      return;
    }
    const target = next.pathname + next.search + next.hash;
    const here = window.location.pathname + window.location.search + window.location.hash;
    if (target === here) return;
    // `null`, never `history.state`: Next's patch skips its own entries (they
    // carry `__NA`) to avoid a loop, so passing the current state through would
    // leave useSearchParams on the old query. With null it copies its tree in.
    window.history.replaceState(null, '', target);
  } catch {
    /* a URL that cannot be parsed changes nothing */
  }
}
