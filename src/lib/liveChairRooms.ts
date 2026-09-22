'use client';

// ── Conference rooms the signed-in user chairs that are in progress ───────────
//
// One RPC, `my_live_chair_rooms()` (SECURITY DEFINER, authenticated only). It
// answers for the CALLER only: conference committees whose `chair_user_ids`
// holds auth.uid() (the same record the join page's verified conference-chair
// path checks, so "Join as chair" never lands on a denied screen), whose linked
// session exists and has not ended, and whose conference runs today (the
// conference's timezone when it is a valid zone name, else UTC). It never
// returns the chair suffix: `committees.settings` is not read at all.
//
// Read by `SessionsResumePrompt` on /sessions.

import { getAuthedClient } from '@/lib/supabase-auth';

export interface LiveChairRoom {
  conferenceCommitteeId: string;
  committeeName: string;
  committeeAbbreviation: string | null;
  committeeLogoUrl: string | null;
  conferenceName: string;
  conferenceAcronym: string | null;
  conferenceLogoUrl: string | null;
  /** A country NAME ("India"), as organisers type it. */
  conferenceCountry: string | null;
  conferenceSlug: string | null;
  startDate: string;
  endDate: string;
  sessionCode: string;
  topic: string | null;
  phase: string;
  suspended: boolean;
  started: boolean;
}

type Row = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

function fromRow(r: Row): LiveChairRoom | null {
  const code = str(r.session_code);
  const name = str(r.committee_name);
  if (!code || !name) return null;
  return {
    conferenceCommitteeId: String(r.conference_committee_id ?? ''),
    committeeName: name,
    committeeAbbreviation: str(r.committee_abbreviation),
    committeeLogoUrl: str(r.committee_logo_url),
    conferenceName: str(r.conference_name) ?? '',
    conferenceAcronym: str(r.conference_acronym),
    conferenceLogoUrl: str(r.conference_logo_url),
    conferenceCountry: str(r.conference_country),
    conferenceSlug: str(r.conference_slug),
    startDate: String(r.start_date ?? ''),
    endDate: String(r.end_date ?? ''),
    sessionCode: code.toUpperCase(),
    topic: str(r.topic),
    phase: String(r.phase ?? ''),
    suspended: r.suspended === true,
    started: r.started === true,
  };
}

/** The caller's live chair rooms. `null` when the read failed (never shown as
 *  "no rooms" to anyone, the prompt simply stays closed). */
export async function fetchMyLiveChairRooms(accessToken: string): Promise<LiveChairRoom[] | null> {
  try {
    const { data, error } = await getAuthedClient(accessToken).rpc('my_live_chair_rooms');
    if (error || !Array.isArray(data)) return null;
    return (data as Row[]).map(fromRow).filter((r): r is LiveChairRoom => !!r);
  } catch {
    return null;
  }
}
