// ── Crash reporting ──────────────────────────────────────────────────────────
// Fires the `alert-crash` edge function, which records the crash in
// crash_alerts and emails an URGENT alert (rate-limited server-side: one email
// per bug per 15 min, 10/hour overall — so a crash loop never inbox-bombs).
//
// Deliberately dependency-free and failure-proof: this runs on a page that has
// ALREADY broken, so it must never throw, never block rendering, and never
// depend on app state that might be the thing that's broken.

const ALERT_ENDPOINT = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}/functions/v1/alert-crash`;

// A chunk that 404s because the deployment it belonged to has been replaced.
// Nothing is wrong with the code — the visitor is simply holding a page from an
// older build, and every deploy creates a window where this can happen.
const STALE_DEPLOY_RE =
  /Failed to load chunk|ChunkLoadError|Loading chunk \d+ failed|Loading CSS chunk|error loading dynamically imported module|Importing a module script failed|Failed to fetch dynamically imported module/i;

const RECOVERY_FLAG = 'gv-stale-deploy-reloaded';

export function isStaleDeployError(error: unknown): boolean {
  const msg = (error as Error | null)?.message ?? String(error ?? '');
  return STALE_DEPLOY_RE.test(msg);
}

/**
 * Recover from a stale-deployment chunk failure by reloading, which fetches the
 * CURRENT build's HTML and its matching chunk names.
 *
 * `reset()` alone can never fix this — it re-renders the same component tree,
 * which re-requests the same missing file. So the error card's "Try again"
 * button was unwinnable for this class of error.
 *
 * Reloads at most ONCE per tab (sessionStorage): if the fresh build still can't
 * load its chunks, that's a genuine fault and belongs in the error card and the
 * alert email, not in a reload loop.
 *
 * Returns true when it has taken over — the caller should not report or render.
 */
export function recoverFromStaleDeploy(error: unknown): boolean {
  if (typeof window === 'undefined' || !isStaleDeployError(error)) return false;
  try {
    if (sessionStorage.getItem(RECOVERY_FLAG)) return false; // already tried; let it surface
    sessionStorage.setItem(RECOVERY_FLAG, '1');
  } catch {
    return false; // no sessionStorage (private mode) — don't risk a loop
  }
  window.location.reload();
  return true;
}


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
