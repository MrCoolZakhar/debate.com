// ── Crash reporting ──────────────────────────────────────────────────────────
// Fires the `alert-crash` edge function, which records EVERY report in
// crash_alerts and then decides — server-side — whether it is worth an email.
//
// WHAT AN ALERT MEANS
// An alert means a user hit something that actually blocked them: a write
// failed, a submit failed, an auth or payment step failed, or a page rendered
// nothing. It does NOT mean "an exception reached an error boundary".
//
// That distinction matters because of what the first month of data actually
// contained: 23 recorded bugs, 23 emails, and not one genuine fault. 21 of the
// 23 were React losing a DOM race against a translator or an extension
// ("Failed to execute 'removeChild'/'insertBefore' on 'Node'", and its WebKit
// wording "The object can not be found here"). Every stack frame sat inside the
// React reconciler with no app code in it at all. Nobody was blocked; the pages
// kept working. Paging on those trained everyone to ignore the alert.
//
// So this file no longer decides severity. It reports what it OBSERVED — which
// boundary caught the throw, or which user action failed — and `alert-crash`
// classifies. Keeping the rules on the server means they can be retuned by
// redeploying one function, and it means a mis-tuned rule can never silently
// discard a report: the row is written before any rule runs.
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

/**
 * Which boundary caught the throw. The server treats these very differently:
 *
 *   'root'  — the root layout itself died, so the document rendered NOTHING.
 *             The user is definitively blocked, whatever the message says.
 *   'route' — a subtree died and the branded card replaced it. The rest of the
 *             app, the nav and any other route are still usable, so this is
 *             only worth an email once it proves it is recurring.
 */
type Boundary = 'route' | 'root';

/** Everything the reporter is willing to assert about a report. */
type Report = {
  message: string;
  stack: string | null;
  digest: string | null;
  url: string;
  /** 'render' = an error boundary caught a throw; 'blocked' = a user action failed. */
  kind: 'render' | 'blocked';
  boundary?: Boundary;
  /** For 'blocked': the thing the user was trying to do, e.g. 'submit application'. */
  action?: string;
};

/**
 * The single network path. Everything below funnels through here so there is
 * exactly one place that can fail, and it swallows everything.
 */
function send(report: Report): void {
  // Server render errors are already in the Vercel logs; this path is for the
  // browser, where a crash is otherwise completely silent (the response was a
  // perfectly healthy 200 — see the null start_date outage).
  if (typeof window === 'undefined') return;
  // Don't page anyone for an error on localhost.
  if (process.env.NODE_ENV !== 'production') return;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;

  try {
    void fetch(ALERT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
      // The user may navigate away or reload immediately; keepalive lets the
      // report finish even as the page is torn down.
      keepalive: true,
    }).catch(() => { /* alerting is best-effort, never surface a failure */ });
  } catch {
    /* never let the reporter itself throw on an already-broken page */
  }
}

/**
 * Report a throw that an error boundary caught.
 *
 * This is a RENDER report, not automatically an alert. The server decides:
 * a root-boundary crash pages immediately (nothing rendered), a route-boundary
 * crash pages once it recurs, and a DOM-reconciliation race pages never.
 */
export function reportCrash(
  error: (Error & { digest?: string }) | null | undefined,
  boundary: Boundary = 'route',
): void {
  if (typeof window === 'undefined') return;
  send({
    message: error?.message || String(error ?? 'Unknown error'),
    stack: error?.stack ?? null,
    digest: error?.digest ?? null,
    url: window.location.href,
    kind: 'render',
    boundary,
  });
}

/**
 * Report that a user action FAILED — the "you can't work" / "this couldn't be
 * submitted" case. This always pages, because by construction the caller only
 * reaches it when the user has been stopped.
 *
 * Use it wherever a failure is currently caught and turned into a toast or an
 * inline error, because those paths are invisible to the error boundaries: the
 * app catches the failure, renders a tidy message, and nobody is ever told. A
 * failed application submit or a rejected payment is precisely the thing worth
 * waking up for, and today it produces no alert at all.
 *
 *   const { error } = await supabase.from('applications').insert(row);
 *   if (error) { reportBlocked('submit application', error); setError(...); }
 *
 * `action` should describe what the USER was doing, in plain words — it becomes
 * the subject line, so "submit application" reads better than "insertApp".
 */
export function reportBlocked(
  action: string,
  error?: unknown,
  context?: Record<string, unknown>,
): void {
  if (typeof window === 'undefined') return;

  const err = error as { message?: unknown; stack?: unknown; code?: unknown; details?: unknown } | null;
  const detail =
    (typeof err?.message === 'string' && err.message) ||
    (error != null ? String(error) : '') ||
    'no error detail';

  // Supabase returns plain objects, not Errors, so there is usually no stack.
  // The code/details fields are the useful part — keep them.
  let stack: string | null = typeof err?.stack === 'string' ? err.stack : null;
  if (!stack) {
    const bits: string[] = [];
    if (err?.code != null) bits.push(`code: ${String(err.code)}`);
    if (err?.details != null) bits.push(`details: ${String(err.details)}`);
    if (context) {
      try { bits.push(`context: ${JSON.stringify(context)}`); } catch { /* unserialisable — skip */ }
    }
    stack = bits.length ? bits.join('\n') : null;
  }

  send({
    message: `${action} failed — ${detail}`,
    stack,
    digest: null,
    url: window.location.href,
    kind: 'blocked',
    action,
  });
}
