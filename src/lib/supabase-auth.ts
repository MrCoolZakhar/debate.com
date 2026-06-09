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
    { global: { headers: { Authorization: 'Bearer ' + accessToken } } }
  );
}
