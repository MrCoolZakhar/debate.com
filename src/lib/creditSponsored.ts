// creditSponsored.ts — which conferences pay their applicants' Gavelling credit.
//
// A conference with sponsorship credits in its Store (store_add_sponsorship)
// is "Credit sponsored": applying costs the delegate nothing. The set comes
// from `credit_sponsored_conference_ids()` (anon) for lists, and
// `conference_credit_sponsored(p_conf)` answers for one conference.

import { supabase as anon } from '@/lib/supabase';

export async function fetchCreditSponsoredIds(): Promise<Set<string>> {
  try {
    const { data, error } = await anon.rpc('credit_sponsored_conference_ids');
    if (error || !Array.isArray(data)) return new Set();
    // SETOF uuid arrives as a list of strings, or of {…} rows depending on the client.
    const ids = (data as unknown[]).map(v => (typeof v === 'string' ? v : (v as Record<string, unknown>)?.credit_sponsored_conference_ids ?? (v as Record<string, unknown>)?.id));
    return new Set(ids.filter((v): v is string => typeof v === 'string'));
  } catch {
    return new Set();
  }
}

export async function fetchConferenceCreditSponsored(conferenceId: string): Promise<boolean> {
  try {
    const { data, error } = await anon.rpc('conference_credit_sponsored', { p_conf: conferenceId });
    return !error && data === true;
  } catch {
    return false;
  }
}

/** The one sentence shown on the conference page and the apply overview. */
export function creditSponsoredLine(acronym: string): string {
  return `${acronym} pays your Gavelling credit. Applying costs you nothing`;
}
