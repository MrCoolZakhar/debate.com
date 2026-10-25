'use client';
// Gavelling Crisis: the database client for a crisis page.
// A person is either signed in with their Gavelling account (Bearer token) or entered with a
// personal code + password (a crisis token sent as the x-crisis-token header; crisis_me() in the
// database matches its hash). The personal-code token wins on the device that used it.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabase } from '@/lib/supabase';
import { getFreshAuthedClient } from '@/lib/supabase-auth';

const tokenKey = (conferenceSlug: string, crisisSlug: string) => `gavelling-crisis-token:${conferenceSlug}/${crisisSlug}`;

export function readCrisisToken(conferenceSlug: string, crisisSlug: string): string | null {
  try { return window.localStorage.getItem(tokenKey(conferenceSlug, crisisSlug)); } catch { return null; }
}
export function saveCrisisToken(conferenceSlug: string, crisisSlug: string, token: string) {
  try { window.localStorage.setItem(tokenKey(conferenceSlug, crisisSlug), token); } catch { /* private window */ }
}
export function clearCrisisToken(conferenceSlug: string, crisisSlug: string) {
  try { window.localStorage.removeItem(tokenKey(conferenceSlug, crisisSlug)); } catch { /* ignore */ }
}

const tokenClients = new Map<string, SupabaseClient>();
function clientForToken(token: string): SupabaseClient {
  let c = tokenClients.get(token);
  if (!c) {
    c = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { 'x-crisis-token': token } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    tokenClients.set(token, c);
  }
  return c;
}

/** The client to use for one call. Read it at call time (never hold it in state across awaits). */
export async function getCrisisClient(conferenceSlug: string, crisisSlug: string): Promise<SupabaseClient> {
  const token = readCrisisToken(conferenceSlug, crisisSlug);
  if (token) return clientForToken(token);
  const authed = await getFreshAuthedClient();
  return authed ?? supabase;
}

/** True when this device entered the crisis with a personal code. */
export function usesPersonalCode(conferenceSlug: string, crisisSlug: string): boolean {
  return !!readCrisisToken(conferenceSlug, crisisSlug);
}

/** The plain anon client, for the public change-ping channel and the code login. */
export const anonClient = supabase;
