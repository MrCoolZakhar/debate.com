// ── Crash reporting ──────────────────────────────────────────────────────────
// Fires the `alert-crash` edge function, which records the crash in
// crash_alerts and emails an URGENT alert (rate-limited server-side: one email
// per bug per 15 min, 10/hour overall — so a crash loop never inbox-bombs).
//
// Deliberately dependency-free and failure-proof: this runs on a page that has
// ALREADY broken, so it must never throw, never block rendering, and never
// depend on app state that might be the thing that's broken.

const ALERT_ENDPOINT = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}/functions/v1/alert-crash`;

export function reportCrash(error: (Error & { digest?: string }) | null | undefined): void {
  // Server render errors are already in the Vercel logs; this path is for the
  // browser, where a crash is otherwise completely silent (the response was a
  // perfectly healthy 200 — see the null start_date outage).
  if (typeof window === 'undefined') return;
  // Don't page anyone for an error on localhost.
  if (process.env.NODE_ENV !== 'production') return;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;

  try {
    const body = JSON.stringify({
      message: error?.message || String(error ?? 'Unknown error'),
      stack: error?.stack ?? null,
      digest: error?.digest ?? null,
      url: window.location.href,
    });
    void fetch(ALERT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      // The user may navigate away or reload immediately; keepalive lets the
      // report finish even as the page is torn down.
      keepalive: true,
    }).catch(() => { /* alerting is best-effort, never surface a failure */ });
  } catch {
    /* never let the reporter itself throw on an already-broken page */
  }
}
