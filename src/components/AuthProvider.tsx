'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabaseAuthClient } from '@/lib/supabase-auth';

interface Profile {
  id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  unlimited_status: 'none' | 'monthly' | 'annual';
  points_balance: number;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = supabaseAuthClient;

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, email, avatar_url, unlimited_status, points_balance')
      .eq('id', userId)
      .single();
    if (data) setProfile(data as Profile);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
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
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
