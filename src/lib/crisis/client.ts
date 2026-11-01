'use client';
// Gavelling Crisis: the database client for a crisis page.
// A person is either signed in with their Gavelling account (Bearer token) or entered with a
// personal code + password (a crisis token sent as the x-crisis-token header; crisis_me() in the
// database matches its hash). The personal-code token wins on the device that used it.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabase } from '@/lib/supabase';
import { getFreshAuthedClient, supabaseAuthClient } from '@/lib/supabase-auth';

const tokenKey = (conferenceSlug: string, crisisSlug: string) => `gavelling-crisis-token:${conferenceSlug}/${crisisSlug}`;

// "Try it as" token: the director's two-hour test token lives in THIS TAB only (sessionStorage), so the director's
// other tabs and devices stay themselves and closing the tab ends it. A personal-code token (a real person signing in)
// stays in localStorage for the device. The view token wins over the stored one, in its tab only.
const viewKey = (conferenceSlug: string, crisisSlug: string) => `gavelling-crisis-view-token:${conferenceSlug}/${crisisSlug}`;

export function readCrisisToken(conferenceSlug: string, crisisSlug: string): string | null {
  try {
    const view = window.sessionStorage.getItem(viewKey(conferenceSlug, crisisSlug));
    if (view) return view;
  } catch { /* no session storage */ }
  try { return window.localStorage.getItem(tokenKey(conferenceSlug, crisisSlug)); } catch { return null; }
}
export function saveCrisisToken(conferenceSlug: string, crisisSlug: string, token: string) {
  try { window.localStorage.setItem(tokenKey(conferenceSlug, crisisSlug), token); } catch { /* private window */ }
}
/** Clears both: the device's personal-code token and this tab's "Try it as" token. */
export function clearCrisisToken(conferenceSlug: string, crisisSlug: string) {
  try { window.localStorage.removeItem(tokenKey(conferenceSlug, crisisSlug)); } catch { /* ignore */ }
  clearViewToken(conferenceSlug, crisisSlug);
}
export function clearViewToken(conferenceSlug: string, crisisSlug: string) {
  try { window.sessionStorage.removeItem(viewKey(conferenceSlug, crisisSlug)); } catch { /* ignore */ }
}
/** True when THIS TAB is trying the crisis as someone else. */
export function isViewingAs(conferenceSlug: string, crisisSlug: string): boolean {
  try { return !!window.sessionStorage.getItem(viewKey(conferenceSlug, crisisSlug)); } catch { return false; }
}
/** Reads what is stored on the device for a crisis, to put it back after a "Try it as" call wrote over it. */
export function peekDeviceToken(conferenceSlug: string, crisisSlug: string): string | null {
  try { return window.localStorage.getItem(tokenKey(conferenceSlug, crisisSlug)); } catch { return null; }
}
/**
 * viewAs() stores the new token for the device. Call this right after it: the token moves into THIS TAB only and
 * the device's own token (if a person signed in with a code here) is put back. Nothing else is signed out.
 */
export function keepViewTokenInThisTab(conferenceSlug: string, crisisSlug: string, previousDeviceToken: string | null): boolean {
  let token: string | null = null;
  try {
    token = window.localStorage.getItem(tokenKey(conferenceSlug, crisisSlug));
    if (previousDeviceToken) window.localStorage.setItem(tokenKey(conferenceSlug, crisisSlug), previousDeviceToken);
    else window.localStorage.removeItem(tokenKey(conferenceSlug, crisisSlug));
  } catch { /* ignore */ }
  if (!token || token === previousDeviceToken) return false;
  try { window.sessionStorage.setItem(viewKey(conferenceSlug, crisisSlug), token); return true; } catch { return false; }
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
  // One client per access token, reused by every call and poller. Making a new one per call (getFreshAuthedClient)
  // created a fresh auth client every few seconds: hundreds of them per tab, each warning in the dev server's log,
  // until the dev server ran out of memory (30 Oct 2026). A new token (after a refresh) gets one new client.
  const { data: { session } } = await supabaseAuthClient.auth.getSession();
  if (!session) return supabase;
  if (authed && authed.token === session.access_token) return authed.client;
  const fresh = await getFreshAuthedClient();
  if (!fresh) return supabase;
  authed = { token: session.access_token, client: fresh };
  return fresh;
}
let authed: { token: string; client: SupabaseClient } | null = null;

/** True when this device entered the crisis with a personal code. */
export function usesPersonalCode(conferenceSlug: string, crisisSlug: string): boolean {
  return !!readCrisisToken(conferenceSlug, crisisSlug);
}

/** The plain anon client, for the public change-ping channel and the code login. */
export const anonClient = supabase;
