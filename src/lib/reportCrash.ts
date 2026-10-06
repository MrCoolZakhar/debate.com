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

// AuthProvider keeps this current (on load, on every auth change and on every
// token refresh) so a report can say WHO hit the error instead of naming an
// anonymous page. The token is only ever sent to our own alert-crash function,
// which verifies it server-side; it is never stored and never sent anywhere else.
let reportAccessToken: string | null = null;

export function setReportIdentity(token: string | null): void {
  reportAccessToken = token;
}

/** A per-tab id so the server can dedupe a SIGNED-OUT visitor hitting the same
 *  error repeatedly. Random and meaningless on its own: it identifies nobody,
 *  it just distinguishes one browser session from another. */
function visitorId(): string | null {
  try {
    const existing = sessionStorage.getItem('gv-report-visitor');
    if (existing) return existing;
    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `v-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    sessionStorage.setItem('gv-report-visitor', id);
    return id;
  } catch {
    return null; // storage blocked (private mode, embedded frame) — dedupe on the server side only
  }
}

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

// ── Noise: never reported (6 Oct 2026) ───────────────────────────────────────
//
// The owner: "error messages are sometimes random ... really look at behind
// what error messages we get and if they are really necessary." Fourteen days
// of user_error_reports and crash_alerts said: the network dropping ("Load
// failed", "Failed to fetch", "Failed to send a request to the Edge
// Function"), a JWT that expired under a page left open, a deploy replacing
// the chunks a tab still held, and translators / extensions racing React's
// DOM. None of those is a fault in Gavelling, and several of them still
// reached the inbox (a reportBlocked of "Load failed" always pages). So the
// browser stops sending them at all, in ONE place: `send()` asks isNoiseError
// for every kind of report.
//
// The one exception is a crash of the ROOT layout (the document rendered
// nothing): a blank page is worth knowing about even when the cause is the
// network or a stale chunk, so only the pure browser noise (DOM races,
// ResizeObserver, extensions, opaque cross-origin) is dropped there.

// Not here on purpose: "Failed to send a request to the Edge Function" / FunctionsFetchError.
// While the browser is online that is also what a down or broken edge function (checkout)
// looks like, so it is still reported; offline is dropped above by navigator.onLine.
const NETWORK_RE =
  /Failed to fetch|NetworkError|Network request failed|Load failed|network ?error|ERR_INTERNET_DISCONNECTED|ERR_NETWORK_CHANGED|ERR_NETWORK_IO_SUSPENDED|ERR_CONNECTION_(RESET|CLOSED|REFUSED|TIMED_OUT|ABORTED)|ERR_NAME_NOT_RESOLVED|ERR_TIMED_OUT|AuthRetryableFetchError|The network connection was lost|The Internet connection appears to be offline|\btimed out\b|TimeoutError|ETIMEDOUT|ECONNRESET/i;

const ABORT_RE =
  /AbortError|The user aborted a request|signal is aborted|The operation was aborted|Request aborted|aborted without reason|Fetch is aborted/i;

const BROWSER_NOISE_RE =
  /ResizeObserver loop (limit exceeded|completed with undelivered notifications)|Failed to execute '(removeChild|insertBefore|appendChild|replaceChild)' on 'Node'|is not a child of this node|The object can not be found here|The node to be removed is not a child|NotFoundError: The object|^Script error\.?$|Converting circular structure to JSON[\s\S]*__reactFiber/i;

const EXTENSION_STACK_RE =
  /(chrome|moz|safari-web|ms-browser|chrome-untrusted)-extension:\/\//i;

/** A JWT that expired. The authed client (supabase-auth.ts) refreshes the
 *  session and retries silently; only a refresh that FAILED is worth a record,
 *  and supabase-auth reports that one itself (branch 'session_expired'). */
const JWT_EXPIRED_RE = /PGRST303|jwt expired|"exp" claim timestamp check failed/i;

function textOf(error: unknown): string {
  if (error == null) return '';
  if (typeof error === 'string') return error;
  const e = error as { name?: unknown; message?: unknown; stack?: unknown; code?: unknown };
  const bits: string[] = [];
  if (typeof e.name === 'string') bits.push(e.name);
  if (typeof e.message === 'string') bits.push(e.message);
  if (typeof e.code === 'string') bits.push(e.code);
  if (typeof e.stack === 'string') bits.push(e.stack);
  if (bits.length) return bits.join('\n');
  try { return String(error); } catch { return ''; }
}

/**
 * True when a report would only describe the visitor's browser or connection,
 * never a fault in Gavelling: offline, network failures and timeouts (ours from
 * resilientFetch included, which are named AbortError), aborted requests, a JWT
 * expiry the silent refresh handles, stale-deploy chunk failures (the reload in
 * recoverFromStaleDeploy handles them), ResizeObserver loop messages, React
 * losing a DOM race to a translator or an extension, and anything thrown from an
 * extension's own script.
 *
 * Pass the caught error and any other text you have (the raw message, a stack).
 */
export function isNoiseError(error: unknown, ...extra: Array<string | null | undefined>): boolean {
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
    const hay = [textOf(error), ...extra.filter((s): s is string => typeof s === 'string')].join('\n');
    if (!hay.trim()) return false;
    return (
      NETWORK_RE.test(hay) ||
      ABORT_RE.test(hay) ||
      BROWSER_NOISE_RE.test(hay) ||
      STALE_DEPLOY_RE.test(hay) ||
      JWT_EXPIRED_RE.test(hay) ||
      EXTENSION_STACK_RE.test(hay)
    );
  } catch {
    return false; // when in doubt, report
  }
}

/** The subset that is noise even for a root-layout crash (see above). */
function isBrowserNoise(...parts: Array<string | null | undefined>): boolean {
  const hay = parts.filter((s): s is string => typeof s === 'string').join('\n');
  return BROWSER_NOISE_RE.test(hay) || EXTENSION_STACK_RE.test(hay);
}

/** A refusal that is a rule working exactly as designed: our own RAISE
 *  (SQLSTATE P0001), a malformed id from a link (22P02, e.g. an invite URL cut
 *  short by an email client), and the plain sentences our payment and invite
 *  RPCs answer with. Recorded on the server as expected, never emailed. */
const EXPECTED_REFUSAL_RE =
  /already (been )?accepted|already has a payment awaiting review|is not payable|already paid in full|invalid input syntax for type uuid/i;

function isExpectedRefusal(code: string | null, detail: string): boolean {
  if (code === 'P0001' || code === '22P02') return true;
  return EXPECTED_REFUSAL_RE.test(detail);
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
  /** 'render' = an error boundary caught a throw; 'blocked' = a user action
   *  failed; 'user_error' = a sentence friendlyError put in front of someone. */
  kind: 'render' | 'blocked' | 'user_error';
  boundary?: Boundary;
  /** For 'blocked': the thing the user was trying to do, e.g. 'submit application'. */
  action?: string;
  /** The untranslated error we caught, before it was turned into a sentence. */
  raw?: string | null;
  /** The sentence the user actually read. */
  shown?: string | null;
  /** SQLSTATE or auth code, when the error carried one. */
  code?: string | null;
  /** Which friendlyError branch produced the sentence, e.g. 'constraint'. */
  branch?: string | null;
  /** True when this is a rule working as designed (a closed window, a wrong
   *  password), so the server records it and never emails it. */
  expected?: boolean;
  /** Per-tab id, so a signed-out visitor can be deduped. */
  visitor?: string | null;
};

/** The one noise gate every report passes through (see isNoiseError). */
function isDroppedAsNoise(report: Report): boolean {
  try {
    // A blank document is worth knowing about whatever caused it.
    if (report.kind === 'render' && report.boundary === 'root') {
      return isBrowserNoise(report.message, report.stack);
    }
    // supabase-auth's own report: the silent refresh FAILED, so the JWT text
    // in it is the point, not noise. Only drop it when the visitor is offline
    // (the refresh failed because nothing could get out).
    if (report.branch === 'session_expired') {
      return typeof navigator !== 'undefined' && navigator.onLine === false;
    }
    return isNoiseError(null, report.message, report.raw, report.stack);
  } catch {
    return false;
  }
}

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
  if (isDroppedAsNoise(report)) return;

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    // Only when someone is signed in: alert-crash verifies it and names them.
    if (reportAccessToken) headers.Authorization = `Bearer ${reportAccessToken}`;

    void fetch(ALERT_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...report, visitor: visitorId() }),
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

  // A rule refusing someone exactly as designed (our own RAISE, a malformed
  // id from a link, "this invite was already accepted") is not an outage.
  // It is still recorded, as an expected person report, so the server keeps
  // the baseline; it is never emailed. 6 Oct 2026: these were most of the
  // "blocked" emails of the previous fortnight.
  const code = err?.code != null ? String(err.code) : null;
  if (isExpectedRefusal(code, detail)) {
    send({
      message: detail,
      stack,
      digest: null,
      url: window.location.href,
      kind: 'user_error',
      action,
      raw: detail,
      shown: null,
      code,
      branch: 'expected_refusal',
      expected: true,
    });
    return;
  }

  send({
    message: `${action} failed — ${detail}`,
    stack,
    digest: null,
    url: window.location.href,
    kind: 'blocked',
    action,
    raw: detail,
  });
}

/** How long the same sentence, on the same page, stays quiet after one report. */
const USER_ERROR_QUIET_MS = 10 * 60 * 1000;
const recentUserErrors = new Map<string, number>();

/**
 * Report a sentence friendlyError put in front of a person.
 *
 * Every user-facing error goes through here, including the ones that are a rule
 * working exactly as designed (a closed application window, a wrong password).
 * Those carry `expected: true`, and the server records them without emailing —
 * they are the baseline that makes a real fault visible, and they are also the
 * cheapest way to find a rule that refuses more people than it should.
 *
 * Best-effort in the strictest sense: it cannot throw, it awaits nothing, and it
 * runs after the sentence has already been returned to the caller, so no user
 * ever waits on it.
 */
export function reportUserError(input: {
  shown: string;
  raw: string;
  code: string | null;
  branch: string;
  expected: boolean;
}): void {
  try {
    if (typeof window === 'undefined') return;

    // A component that re-renders on every keystroke can surface the same
    // sentence dozens of times in a row. The server dedupes too; this just
    // stops us making the requests at all.
    const key = `${input.branch}|${input.raw}|${window.location.pathname}`;
    const now = Date.now();
    const last = recentUserErrors.get(key);
    if (last != null && now - last < USER_ERROR_QUIET_MS) return;
    recentUserErrors.set(key, now);

    send({
      message: input.raw || input.shown,
      stack: null,
      digest: null,
      url: window.location.href,
      kind: 'user_error',
      shown: input.shown,
      raw: input.raw,
      code: input.code,
      branch: input.branch,
      expected: input.expected,
    });
  } catch {
    /* reporting an error must never become one */
  }
}
