'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabaseAuthClient } from '@/lib/supabase-auth';
import { setReportIdentity } from '@/lib/reportCrash';

interface Profile {
  id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  unlimited_status: 'none' | 'monthly' | 'annual';
  setup_reminder_seen_at: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  /** Re-read the signed-in person's profile row in place (after an avatar or
   *  name change), instead of reloading the page to pick it up. */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: false,
  signOut: async () => {},
  refreshProfile: async () => {},
});

// ── Stable identities (11 Oct 2026, "the website does a weird reload") ──────
// supabase-js announces SIGNED_IN every time a tab becomes visible again
// (`_recoverAndRefresh` re-reads the stored session and notifies), and
// TOKEN_REFRESHED about once an hour. Each announcement carries freshly parsed
// objects, so `setUser` / `setSession` / `setProfile` used to hand every
// consumer a NEW object even when nothing had changed. More than a hundred
// effects across the site depend on `user`, `session` or `profile`; on every
// return to the tab they all ran again, and the ones that start with a
// loading state put a full-screen loader over the page and drew it again: a
// spontaneous "reload". So the provider keeps the previous object whenever
// the new one says the same thing. A real change (a new token, another
// account, an edited profile) still produces a new object.
function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
}

function stableUser(prev: User | null, next: User | null): User | null {
  if (!prev || !next || prev.id !== next.id) return next;
  return sameJson(prev, next) ? prev : next;
}

function stableSession(prev: Session | null, next: Session | null): Session | null {
  if (!prev || !next) return next;
  if (prev.access_token !== next.access_token || prev.refresh_token !== next.refresh_token) return next;
  if (prev.user?.id !== next.user?.id) return next;
  return sameJson(prev.user, next.user) ? prev : next;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = supabaseAuthClient;
  // The profile row is read again only when the signed-in ACCOUNT changes, or
  // when a page asks (refreshProfile). It used to be re-read on every auth
  // event, i.e. every time the tab came back into view.
  const profileForRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);

  function applyAuth(next: Session | null) {
    setSession((prev) => stableSession(prev, next));
    setUser((prev) => stableUser(prev, next?.user ?? null));
    userIdRef.current = next?.user?.id ?? null;
  }

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, email, avatar_url, unlimited_status, setup_reminder_seen_at')
      .eq('id', userId)
      .single();
    // A late answer for an account that has since signed out is dropped.
    if (data && userIdRef.current === userId) {
      setProfile((prev) => (sameJson(prev, data) ? prev : (data as Profile)));
    } else if (!data && profileForRef.current === userId) {
      // The read did not land: let the next auth event (tab back in view) try again.
      profileForRef.current = null;
    }
  }

  function loadProfileOnce(userId: string) {
    if (profileForRef.current === userId) return;
    profileForRef.current = userId;
    void fetchProfile(userId);
  }

  const refreshProfile = useCallback(async () => {
    const id = userIdRef.current;
    if (id) await fetchProfile(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // supabase-js acquires a navigator Web Lock for getSession(); a stale lock or a hung
    // token refresh (aggravated by many GoTrueClient instances sharing the same storage
    // key) can block it FOREVER, wedging every page behind an eternal authLoading spinner.
    // Same failure class as the signOut hang below, bound it the same way: on timeout,
    // render logged-out; if the SDK resolves later, onAuthStateChange still updates state.
    // A browser that holds a stored session waits longer before rendering signed-out:
    // getSession() waits behind a token refresh, and rendering "Log in" while it runs
    // made a signed-in organiser sign in with Google three times in 13 minutes
    // (19 Oct 2026). With nothing stored there is nothing to wait for.
    let resolved = false;
    const hasStoredSession = (() => {
      try { return document.cookie.includes('sb-luruhkwrgisytejswlas-auth-token'); } catch { return false; }
    })();
    const failsafe = setTimeout(() => {
      if (!resolved) setLoading(false);
    }, hasStoredSession ? 12000 : 2500);

    supabase.auth.getSession().then(({ data: { session } }) => {
      resolved = true;
      clearTimeout(failsafe);
      applyAuth(session);
      setReportIdentity(session?.access_token ?? null);
      if (session?.user) loadProfileOnce(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        resolved = true;
        applyAuth(session);
        // Also fires on every token refresh, so error reports never carry a stale token.
        setReportIdentity(session?.access_token ?? null);
        // Never await the profile fetch here: a slow/hung profiles read must not keep
        // the whole app gated behind authLoading.
        setLoading(false);
        if (session?.user) {
          // An account change (email, metadata) may have touched the profile row.
          if (event === 'USER_UPDATED') void fetchProfile(session.user.id);
          else loadProfileOnce(session.user.id);
        } else {
          profileForRef.current = null;
          setProfile(null);
        }
      }
    );

    return () => { clearTimeout(failsafe); subscription.unsubscribe(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signOut() {
    // supabase-js acquires a navigator Web Lock for auth.signOut(). If that lock is held
    // by a stale or in-flight token refresh, the call can hang indefinitely, blocking the
    // caller's redirect and leaving the user apparently signed in until a manual reload.
    // Bound the SDK call with a timeout so it can never block sign-out.
    try {
      await Promise.race([
        supabase.auth.signOut({ scope: 'local' }),
        new Promise<void>((resolve) => setTimeout(resolve, 1200)),
      ]);
    } catch {}
    // Backstop: clear the persisted session directly (the SDK call may have been blocked
    // before it could), so the post-signout hard navigation always starts logged out.
    try {
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith('sb-') && k.includes('-auth-token')) localStorage.removeItem(k);
      });
    } catch {}
    // The @supabase/ssr browser client persists the session in COOKIES, not localStorage.
    // Clearing localStorage alone left the session recoverable on the next page load, so the
    // hard navigation rehydrated it and a second sign-out click was needed. Expire the auth
    // cookies too so sign-out always takes on the first click.
    try {
      document.cookie.split(';').forEach((c) => {
        const name = c.split('=')[0].trim();
        if (name.startsWith('sb-') && name.includes('-auth-token')) {
          document.cookie = name + '=; Max-Age=0; path=/';
          document.cookie = name + '=; Max-Age=0; path=/; domain=' + window.location.hostname;
        }
      });
    } catch {}
    setUser(null);
    setSession(null);
    userIdRef.current = null;
    profileForRef.current = null;
    setReportIdentity(null);
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
