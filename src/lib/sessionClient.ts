import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://luruhkwrgisytejswlas.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_k7NdduzaXK358z8ew18ZKA_vBSieDlV';

const cache: Record<string, SupabaseClient> = {};

// Supabase client carrying session credentials as headers. The DB requires these on
// writes to session tables (committees, delegates, speakers_list, current_speaker,
// motions, documents, messages, feedback) — reads and realtime are unaffected.
export function sessionClient(sessionCode: string, chairSuffix?: string): SupabaseClient {
  const key = sessionCode + '|' + (chairSuffix ?? '');
  if (!cache[key]) {
    const headers: Record<string, string> = { 'x-session-code': sessionCode };
    if (chairSuffix) headers['x-chair-suffix'] = chairSuffix;
    cache[key] = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: { headers },
    });
  }
  return cache[key];
}
