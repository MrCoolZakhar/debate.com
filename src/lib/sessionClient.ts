import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { OFFLINE_RESILIENCE, resilientFetch } from './offlineResilience';

const SUPABASE_URL = 'https://luruhkwrgisytejswlas.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_k7NdduzaXK358z8ew18ZKA_vBSieDlV';

const cache: Record<string, SupabaseClient> = {};

// Supabase client carrying session credentials as headers. The DB requires these on
// writes to session tables (committees, delegates, speakers_list, current_speaker,
// motions, documents, messages, feedback) — reads and realtime are unaffected.
// With OFFLINE_RESILIENCE on, its requests time out (src/lib/offlineResilience.ts), so a
// hung write becomes a network-class failure that runWrite can park and retry.
export function sessionClient(
  sessionCode: string,
  chairSuffix?: string,
  /** `timeout: false` = no per-request timeout (D6): the organiser's roster editor and other
   *  large or slow batches, where a slow success must not read as a failure. Default: the
   *  timeout (session writes / RPCs 20 s, reads 12 s) while OFFLINE_RESILIENCE is on. */
  opts?: { timeout?: boolean },
): SupabaseClient {
  const timed = OFFLINE_RESILIENCE && opts?.timeout !== false;
  const key = sessionCode + '|' + (chairSuffix ?? '') + (OFFLINE_RESILIENCE && !timed ? '|plain' : '');
  if (!cache[key]) {
    const headers: Record<string, string> = { 'x-session-code': sessionCode };
    if (chairSuffix) headers['x-chair-suffix'] = chairSuffix;
    cache[key] = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: timed ? { headers, fetch: resilientFetch } : { headers },
    });
  }
  return cache[key];
}

let readClient: SupabaseClient | null = null;

/** Anon client for the session SLICE reads and the read-backs inside session writes, with
 *  the per-request timeout. Only used while OFFLINE_RESILIENCE is on (committeeService falls
 *  back to the shared anon client otherwise). Never used for realtime, auth or conferences. */
export function sessionReadClient(): SupabaseClient {
  if (!readClient) {
    readClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: { fetch: resilientFetch },
    });
  }
  return readClient;
}
