import { createBrowserClient } from '@supabase/ssr';

export function createAuthClient() {
  return createBrowserClient(
    'https://luruhkwrgisytejswlas.supabase.co',
    'sb_publishable_k7NdduzaXK358z8ew18ZKA_vBSieDlV'
  );
}

export const supabaseAuthClient = createAuthClient();

import { createClient as _createSupabaseClient } from '@supabase/supabase-js';

// ── A page left open never tells a signed-in person their session expired ──
//
// (27 Sep 2026.) The error reports showed "JWT expired" (PGRST303) about once
// an hour from organisers who left /manage/<slug>/live open overnight. The page
// polled with the token it had when it loaded, and a background tab's refresh
// timer is throttled by the browser, so the token died under it. Three layers,
// all in the browser, all invisible when things are fine:
//
// 1. `latestToken` follows the auth SDK's own session (every sign-in and every
//    token refresh), and every client made by getAuthedClient sends IT rather
//    than the token its caller captured, so a client built once, or a token
//    held in React state, never goes stale while the SDK has a newer one.
// 2. A request answered "JWT expired" refreshes the session once (shared by
//    every request that fails at the same moment, bounded by a timeout) and
//    retries the SAME request once with the new token. A retry that succeeds
//    shows nothing and reports nothing.
// 3. Only when that refresh fails (the person really is signed out) is the
//    sign-in pop-up opened with "Your session has expired. Please sign in
//    again." and one error report sent, at most once a minute. The report is
//    marked expected (recorded, never emailed): being asked to sign in again
//    is the rule working, not a fault. A refresh that TIMED OUT, or a browser
//    that is offline, announces nothing at all (6 Oct 2026).
//
// Plus a safety net: on window focus and on the tab becoming visible, the SDK
// is asked for its session, which refreshes an expired token before the page's
// own polling runs again (refreshSessionNow, which a page can also await).

export const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please sign in again.';

const isBrowser = typeof window !== 'undefined';
let latestToken: string | null = null;

if (isBrowser) {
  try {
    supabaseAuthClient.auth.onAuthStateChange((_event, session) => {
      // Never call the SDK from inside this callback (it holds the auth lock);
      // only remember the token.
      latestToken = session?.access_token ?? null;
    });
  } catch {
    /* the SDK failing to subscribe must never break the page */
  }
}

let refreshing: Promise<string | null> | null = null;
/** True when the last refreshOnce gave up on its 8 s timeout rather than being
 *  told there is no session. A hung auth lock or a dead connection is not the
 *  person being signed out, so it never opens the sign-in pop-up (6 Oct 2026). */
let lastRefreshTimedOut = false;

/** Refresh the session once for every caller that asks at the same moment.
 *  Resolves to the new access token, or null when there is no session any more.
 *  Bounded, because the SDK's auth lock can hang (see AuthProvider). */
function refreshOnce(): Promise<string | null> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    let timedOut = false;
    const timeout = new Promise<null>((resolve) => setTimeout(() => { timedOut = true; resolve(null); }, 8000));
    const attempt = (async () => {
      try {
        const { data } = await supabaseAuthClient.auth.refreshSession();
        if (data.session?.access_token) return data.session.access_token;
      } catch {
        /* fall through to reading the stored session */
      }
      // Another tab may have refreshed first and rotated the refresh token.
      try {
        const { data } = await supabaseAuthClient.auth.getSession();
        return data.session?.access_token ?? null;
      } catch {
        return null;
      }
    })();
    const token = await Promise.race([attempt, timeout]);
    lastRefreshTimedOut = !token && timedOut;
    if (token) latestToken = token;
    return token;
  })().finally(() => {
    // Let the next expiry, an hour from now, refresh again.
    setTimeout(() => { refreshing = null; }, 0);
  });
  return refreshing;
}

let lastWake = 0;
let waking: Promise<void> | null = null;

/** Ask the SDK for its session, which refreshes an expired token. Safe to call
 *  often (shared while in flight, at most once every 3 seconds); a page that
 *  was hidden awaits it before polling again. Never throws. */
export function refreshSessionNow(): Promise<void> {
  if (!isBrowser) return Promise.resolve();
  if (waking) return waking;
  if (Date.now() - lastWake < 3000) return Promise.resolve();
  lastWake = Date.now();
  waking = (async () => {
    try {
      const timeout = new Promise<void>((resolve) => setTimeout(resolve, 8000));
      await Promise.race([
        supabaseAuthClient.auth.getSession().then(({ data }) => {
          if (data.session?.access_token) latestToken = data.session.access_token;
        }),
        timeout,
      ]);
    } catch {
      /* a failed read changes nothing; the retry path still covers the page */
    }
  })().finally(() => { waking = null; });
  return waking;
}

if (isBrowser) {
  try {
    const wake = () => {
      if (document.visibilityState === 'visible') void refreshSessionNow();
    };
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', wake);
  } catch {
    /* never break the page over a listener */
  }
}

let expiredAnnouncedAt = 0;

/** The refresh failed: the person really is signed out. Tell them once, with
 *  the sign-in pop-up, and report it once. */
function announceExpired(raw: string) {
  // Offline, or the refresh never answered: nothing says the session is gone.
  if (lastRefreshTimedOut) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  if (Date.now() - expiredAnnouncedAt < 60_000) return;
  expiredAnnouncedAt = Date.now();
  void import('./authModal').then((m) => {
    if (!m.isAuthModalOpen()) m.openAuth({ notice: SESSION_EXPIRED_MESSAGE });
  }).catch(() => {});
  void import('./reportCrash').then((m) => {
    m.reportUserError({ shown: SESSION_EXPIRED_MESSAGE, raw, code: 'PGRST303', branch: 'session_expired', expected: true });
  }).catch(() => {});
}

/** PostgREST answers an expired token 401 PGRST303 "JWT expired"; Storage and
 *  the Functions gateway say it in their own words. */
function looksExpired(status: number, body: string): boolean {
  if (status !== 401 && status !== 403 && status !== 400) return false;
  return /PGRST303|jwt expired|"exp" claim|invalid jwt/i.test(body);
}

function withToken(init: RequestInit | undefined, token: string): RequestInit {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', 'Bearer ' + token);
  return { ...init, headers };
}

function bearerOf(init: RequestInit | undefined): string | null {
  const value = new Headers(init?.headers).get('Authorization');
  return value && value.startsWith('Bearer ') ? value.slice(7) : null;
}

function makeAuthedFetch(fallbackToken: string): typeof fetch {
  return async (input, init) => {
    if (!isBrowser) return fetch(input, init);
    // Only swap a bearer this client set itself (never, say, the anon key).
    const sent = bearerOf(init);
    const current = latestToken && sent === fallbackToken ? latestToken : null;
    const first = current ? withToken(init, current) : init;
    const res = await fetch(input, first);
    if (res.status !== 401 && res.status !== 403 && res.status !== 400) return res;
    let body = '';
    try { body = await res.clone().text(); } catch { return res; }
    if (!looksExpired(res.status, body)) return res;
    // A body we cannot send twice (a stream) cannot be retried.
    if (init?.body && typeof ReadableStream !== 'undefined' && init.body instanceof ReadableStream) return res;
    const fresh = await refreshOnce();
    if (!fresh) {
      announceExpired(body.slice(0, 300));
      return res;
    }
    return fetch(input, withToken(init, fresh));
  };
}

export function getAuthedClient(accessToken: string) {
  return _createSupabaseClient(
    'https://luruhkwrgisytejswlas.supabase.co',
    'sb_publishable_k7NdduzaXK358z8ew18ZKA_vBSieDlV',
    {
      global: {
        headers: { Authorization: 'Bearer ' + accessToken },
        fetch: makeAuthedFetch(accessToken),
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}

/**
 * Same as getAuthedClient, but reads the access token fresh from the auth
 * SDK at call time instead of trusting a token captured in a React closure
 * (e.g. from useAuth() at an earlier render). A session held in component
 * state can go stale between renders; this re-reads supabaseAuthClient's
 * own session so writes always use its current token. Returns null if
 * there's no active session (caller should surface a re-auth prompt).
 */
export async function getFreshAuthedClient() {
  const { data: { session } } = await supabaseAuthClient.auth.getSession();
  if (!session) return null;
  latestToken = session.access_token;
  return getAuthedClient(session.access_token);
}
