// Centralized conference-session access verification, shared by /join and the session-page guards.
// Standalone sessions are anonymous by design and never gated here.
import { getAuthedClient } from '@/lib/supabase-auth';
import { supabase as anonSupabase } from '@/lib/supabase';

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
  | { kind: 'organizer'; committee: ConferenceCommitteeInfo };

// Privacy-agnostic detection: committees.session_origin is anon-readable, so this works
// for private conferences too (unlike reading conference_committees as anon).
export async function detectConferenceSession(code: string): Promise<boolean> {
  try {
    const { data } = await anonSupabase
      .from('committees')
      .select('session_origin')
      .eq('code', code.toUpperCase())
      .maybeSingle();
    return (data as { session_origin?: string } | null)?.session_origin === 'conference';
  } catch {
    return false;
  }
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

  const { data: ccRaw } = await sb
    .from('conference_committees')
    .select('id, name, conference_id, session_code, chair_user_ids, conferences (full_name, acronym, slug)')
    .eq('session_code', upper)
    .maybeSingle();

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
    const { data: alloc } = await sb
      .from('conference_allocations')
      .select('country_code, country_name')
      .eq('conference_committee_id', committee.id)
      .eq('user_id', userId)
      .maybeSingle();
    if (alloc) {
      const a = alloc as { country_code: string; country_name: string };
      return { kind: 'delegate', country: { code: a.country_code, name: a.country_name }, committee };
    }
  }

  if (committee) {
    const { data: org } = await sb
      .from('conference_organizers')
      .select('role')
      .eq('conference_id', committee.conference_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (org) {
      return { kind: 'organizer', committee };
    }
  }

  // Accepted faculty-advisors / observers get conference-wide advisor-view access.
  if (committee) {
    const { data: adv } = await sb
      .from('applications')
      .select('role')
      .eq('conference_id', committee.conference_id)
      .eq('user_id', userId)
      .in('role', ['faculty-advisor', 'observer'])
      .in('status', ['accepted', 'assigned'])
      .maybeSingle();
    if (adv) {
      return { kind: 'advisor', committee };
    }
  }

  return { kind: 'denied', committee };
}
