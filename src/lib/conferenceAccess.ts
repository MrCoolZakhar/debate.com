// Centralized conference-session access verification, shared by /join and the session-page guards.
// Standalone sessions are anonymous by design and never gated here.
import { getAuthedClient } from '@/lib/supabase-auth';
import { supabase as anonSupabase } from '@/lib/supabase';
import { getSessionJoinRules } from '@/lib/seatClaims';

export interface ConferenceCommitteeInfo {
  id: string;
  name: string;
  conference_id: string;
  session_code: string;
  conference: { full_name: string; acronym: string; slug: string } | null;
}

export type ConferenceAccess =
  | { kind: 'standalone' }
  | { kind: 'signin' }
  | { kind: 'denied'; committee: ConferenceCommitteeInfo | null }
  | { kind: 'delegate'; country: { code: string; name: string }; committee: ConferenceCommitteeInfo }
  | { kind: 'chair'; committee: ConferenceCommitteeInfo }
  | { kind: 'advisor'; committee: ConferenceCommitteeInfo }
  | { kind: 'organizer'; committee: ConferenceCommitteeInfo }
  // A read failed (network drop, an access token that expired while the tab slept) and no
  // positive answer was found. NOT a verdict: the session pages keep a live session on
  // screen and otherwise show an inline retry. Callers that only branch on the positive
  // kinds (the join page) treat it like 'denied', exactly as before it existed.
  | { kind: 'error' };

// Is this session's DAIS gated by conference records? The chair, voting and advisor
// pages treat `false` as a standalone session (anonymous, chair code), so this is the one
// switch that decides whether they gate.
//
// True only for a conference session whose conference committee has an assigned chair, a
// pending chair invite or an unclaimed imported chair. A conference that never set up its
// dais (organisers who ran applications elsewhere and only share the session code) is
// open: its chairs join with the 4-digit chair code exactly like a standalone session.
//
// Delegate seats are NOT decided here. They are gated per seat by claim_delegate_seat
// (src/lib/seatClaims.ts): reserved seats need the allocated account, every other seat
// needs only the code. The name is historical; the chair and voting pages still call it.
// The advisor page does NOT: it gates on isConferenceSession() below, whatever the dais.
//
// session_join_rules is anon-callable, so private conferences are covered. It FAILS CLOSED:
// if the RPC cannot be read it falls back to isConferenceSession() (the old rule, every
// conference session gated), and if that cannot be read either the answer is true.
export async function detectConferenceSession(code: string): Promise<boolean> {
  return (await detectConferenceSessionOrNull(code)) ?? true;
}

// Same question, but says when it could NOT be answered (null) instead of failing closed.
// For the session-page access guards (src/lib/useSessionAccess.ts): a transient failure
// must never turn a live session into a sign-in or "not your committee" screen.
export async function detectConferenceSessionOrNull(code: string): Promise<boolean | null> {
  const rules = await getSessionJoinRules(code);
  if (rules) return rules.found && rules.isConference && !rules.chairsOpen;
  return isConferenceSessionOrNull(code);
}

// Is this a conference-linked session at all (`committees.session_origin = 'conference'`)?
// Independent of the dais. The advisor view gates on this: an advisor can nudge delegates,
// and that view belongs to the conference's own advisors and organisers even when its
// dais is open to the chair code. `committees` is anon-readable, so private conferences
// are covered.
//
// FAILS CLOSED. supabase-js resolves with `error` instead of throwing, so the error is
// checked explicitly: a read error or a throw answers true (gated). Only a definite answer
// ("no such session", or a row that is not a conference session) answers false.
export async function isConferenceSession(code: string): Promise<boolean> {
  return (await isConferenceSessionOrNull(code)) ?? true;
}

/** null = the read failed (see detectConferenceSessionOrNull). */
export async function isConferenceSessionOrNull(code: string): Promise<boolean | null> {
  try {
    const { data, error } = await anonSupabase
      .from('committees')
      .select('session_origin')
      .eq('code', code.toUpperCase())
      .maybeSingle();
    if (error) return null;
    return (data as { session_origin?: string } | null)?.session_origin === 'conference';
  } catch {
    return null;
  }
}

// PGRST116 ("more than one row" for maybeSingle) is a data answer, not a dropped read; it
// kept its old meaning (no match) so it can never pin a page on the retry screen.
function isTransientReadError(error: { code?: string } | null): boolean {
  return !!error && error.code !== 'PGRST116';
}

// Authed verification. The conference_committees row is readable when the user is an
// allocated delegate or assigned chair (the "Associated users read their committee" policy),
// an organizer, or the conference is public — so this resolves for private conferences too,
// for people who actually belong.
export async function verifyConferenceAccess(
  code: string,
  accessToken: string,
  userId: string
): Promise<ConferenceAccess> {
  const sb = getAuthedClient(accessToken);
  const upper = code.toUpperCase();

  const { data: ccRaw, error: ccError } = await sb
    .from('conference_committees')
    .select('id, name, conference_id, session_code, chair_user_ids, conferences (full_name, acronym, slug)')
    .eq('session_code', upper)
    .maybeSingle();
  // An expired token or a dropped connection is not "not your committee".
  if (isTransientReadError(ccError)) return { kind: 'error' };
  let readFailed = false;

  const cc = ccRaw as {
    id: string; name: string; conference_id: string; session_code: string;
    chair_user_ids: string[] | null;
    conferences: { full_name: string; acronym: string; slug: string } | null;
  } | null;

  const committee: ConferenceCommitteeInfo | null = cc
    ? { id: cc.id, name: cc.name, conference_id: cc.conference_id, session_code: cc.session_code, conference: cc.conferences ?? null }
    : null;

  if (cc && (cc.chair_user_ids ?? []).includes(userId)) {
    return { kind: 'chair', committee: committee as ConferenceCommitteeInfo };
  }

  if (committee) {
    const { data: alloc, error: allocError } = await sb
      .from('conference_allocations')
      .select('country_code, country_name')
      .eq('conference_committee_id', committee.id)
      .eq('user_id', userId)
      .maybeSingle();
    if (isTransientReadError(allocError)) readFailed = true;
    if (alloc) {
      const a = alloc as { country_code: string; country_name: string };
      return { kind: 'delegate', country: { code: a.country_code, name: a.country_name }, committee };
    }
  }

  if (committee) {
    const { data: org, error: orgError } = await sb
      .from('conference_organizers')
      .select('role')
      .eq('conference_id', committee.conference_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (isTransientReadError(orgError)) readFailed = true;
    if (org) {
      return { kind: 'organizer', committee };
    }
  }

  // Accepted faculty-advisors / observers get conference-wide advisor-view access.
  if (committee) {
    const { data: adv, error: advError } = await sb
      .from('applications')
      .select('role')
      .eq('conference_id', committee.conference_id)
      .eq('user_id', userId)
      .in('role', ['faculty-advisor', 'observer'])
      // checked-in is still an accepted participant: at the venue, which is
      // exactly when the advisor view is needed.
      .in('status', ['accepted', 'assigned', 'checked-in'])
      .maybeSingle();
    if (isTransientReadError(advError)) readFailed = true;
    if (adv) {
      return { kind: 'advisor', committee };
    }
  }

  return readFailed ? { kind: 'error' } : { kind: 'denied', committee };
}
