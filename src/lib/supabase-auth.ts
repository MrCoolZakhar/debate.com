import { createBrowserClient } from '@supabase/ssr';

export function createAuthClient() {
  return createBrowserClient(
    'https://luruhkwrgisytejswlas.supabase.co',
    'sb_publishable_k7NdduzaXK358z8ew18ZKA_vBSieDlV'
  );
}

export const supabaseAuthClient = createAuthClient();

import { createClient as _createSupabaseClient } from '@supabase/supabase-js';

export function getAuthedClient(accessToken: string) {
  return _createSupabaseClient(
    'https://luruhkwrgisytejswlas.supabase.co',
    'sb_publishable_k7NdduzaXK358z8ew18ZKA_vBSieDlV',
    {
      global: { headers: { Authorization: 'Bearer ' + accessToken } },
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
  return getAuthedClient(session.access_token);
}
