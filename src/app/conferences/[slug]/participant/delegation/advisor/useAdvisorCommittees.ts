'use client';

// The faculty advisor's Committees section: only the committees the advisor's
// delegation sits in, with its people and open seats in each.
//
// Sources (all reads, keyed on ids, never on a token):
//   the delegation's seats   my_advisor_delegation() (the board's own read, shared
//                            cache in src/lib/advisorDelegation.ts): every seat of
//                            the caller's society in this conference, block seats
//                            with nobody in them included, plus the live room code
//   the committees           conference_committees (anon: id, name, abbreviation,
//                            logo_url, topics), as the conference page reads them
//   when advisors get codes  conferences.session_release_advisors_at (anon), the
//                            rule CommitteesSessionsCard uses
//   the people's photos      my_delegation_roster(p_society) (avatar_url), matched
//                            to a seat by committee, country and name
//
// A seat with no application and no name is an Open seat (my_advisor_delegation
// returns role null and studentName null only for a block seat).

import { useEffect, useMemo, useState } from 'react';
import { supabase as anonSupabase } from '@/lib/supabase';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { committeeDisplayName } from '@/lib/presetNames';
import { useMyAdvisorDelegation } from '@/lib/advisorDelegation';

export interface AdvisorSeatPerson {
  name: string | null;
  role: string | null;
  avatarUrl: string | null;
}

export interface AdvisorCommitteeSeat {
  key: string;
  countryName: string;
  countryCode: string | null;
  seat: number;
  /** Null for an Open seat. */
  person: AdvisorSeatPerson | null;
}

export interface AdvisorCommittee {
  key: string;
  /** conference_committees.id, null when the committee list could not be matched. */
  id: string | null;
  name: string;
  abbreviation: string | null;
  logoUrl: string | null;
  topics: string[];
  sessionCode: string | null;
  seats: AdvisorCommitteeSeat[];
  /** How many of the delegation's people sit here (open seats not counted). */
  people: number;
}

export type AdvisorCommitteesState =
  | { kind: 'loading' }
  | { kind: 'error' }
  /** my_advisor_delegation has no delegation for this conference: the old all-committees card. */
  | { kind: 'no-delegation' }
  | { kind: 'ready'; committees: AdvisorCommittee[]; releaseAt: string | null };

interface CommitteeMeta {
  id: string;
  name: string;
  abbreviation: string | null;
  logo_url: string | null;
  topics: string[] | null;
}

interface RosterPhoto {
  key: string;
  url: string;
}

const lc = (v: string | null | undefined) => (v ?? '').trim().toLowerCase();

export function useAdvisorCommittees(conferenceId: string, societyId: string): AdvisorCommitteesState {
  const delegation = useMyAdvisorDelegation();
  const [meta, setMeta] = useState<{ key: string; committees: CommitteeMeta[]; releaseAt: string | null } | null>(null);
  const [photos, setPhotos] = useState<{ key: string; list: RosterPhoto[] } | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [{ data: ccData }, { data: confData }] = await Promise.all([
          anonSupabase.from('conference_committees')
            .select('id, name, abbreviation, logo_url, topics')
            .eq('conference_id', conferenceId),
          anonSupabase.from('conferences')
            .select('session_release_advisors_at')
            .eq('id', conferenceId)
            .maybeSingle(),
        ]);
        if (!alive) return;
        setMeta({
          key: conferenceId,
          committees: (ccData ?? []) as CommitteeMeta[],
          releaseAt: (confData as { session_release_advisors_at?: string | null } | null)?.session_release_advisors_at ?? null,
        });
      } catch {
        // The seats still render from my_advisor_delegation, with the emblem chain's fallbacks.
        if (alive) setMeta({ key: conferenceId, committees: [], releaseAt: null });
      }
    })();
    return () => { alive = false; };
  }, [conferenceId]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const c = await getFreshAuthedClient();
        if (!c || !alive) return;
        const { data, error } = await c.rpc('my_delegation_roster', { p_society: societyId });
        if (!alive || error) return;
        const members = ((data as { members?: unknown } | null)?.members ?? []) as {
          name?: string | null; avatar_url?: string | null;
          allocation?: { committee?: string | null; country_name?: string | null } | null;
        }[];
        const list: RosterPhoto[] = [];
        for (const m of Array.isArray(members) ? members : []) {
          if (!m?.avatar_url || !m.allocation) continue;
          list.push({ key: `${lc(m.allocation.committee)}|${lc(m.allocation.country_name)}|${lc(m.name)}`, url: m.avatar_url });
        }
        setPhotos({ key: societyId, list });
      } catch {
        // Photos are a nicety: initials are drawn instead.
      }
    })();
    return () => { alive = false; };
  }, [societyId]);

  const conference = delegation.conferences.find(c => c.conferenceId === conferenceId) ?? null;
  const metaHere = meta?.key === conferenceId ? meta : null;
  const photoMap = useMemo(() => {
    const m = new Map<string, string>();
    if (photos?.key === societyId) for (const p of photos.list) m.set(p.key, p.url);
    return m;
  }, [photos, societyId]);

  const committees = useMemo<AdvisorCommittee[] | null>(() => {
    if (!conference) return null;
    const byKey = new Map<string, AdvisorCommittee>();
    const all = metaHere?.committees ?? [];
    for (const s of conference.seats) {
      const match = all.find(c => c.name === s.committeeName && lc(c.abbreviation) === lc(s.committeeAbbreviation))
        ?? all.find(c => c.name === s.committeeName)
        ?? null;
      const key = match?.id ?? `name:${s.committeeName}|${s.committeeAbbreviation ?? ''}`;
      let entry = byKey.get(key);
      if (!entry) {
        entry = {
          key,
          id: match?.id ?? null,
          name: s.committeeName,
          abbreviation: s.committeeAbbreviation ?? match?.abbreviation ?? null,
          logoUrl: match?.logo_url ?? null,
          topics: (match?.topics ?? []).filter(t => typeof t === 'string' && t.trim()),
          sessionCode: null,
          seats: [],
          people: 0,
        };
        byKey.set(key, entry);
      }
      if (!entry.sessionCode && s.sessionCode) entry.sessionCode = s.sessionCode;
      const open = !s.studentName && !s.role;
      const person: AdvisorSeatPerson | null = open ? null : {
        name: s.studentName,
        role: s.role,
        avatarUrl: photoMap.get(`${lc(s.committeeName)}|${lc(s.countryName)}|${lc(s.studentName)}`) ?? null,
      };
      if (person) entry.people += 1;
      entry.seats.push({
        key: `${s.countryCode ?? s.countryName}|${s.seat}|${entry.seats.length}`,
        countryName: s.countryName,
        countryCode: s.countryCode,
        seat: s.seat,
        person,
      });
    }
    const out = [...byKey.values()];
    for (const c of out) {
      c.seats.sort((a, b) => a.countryName.localeCompare(b.countryName) || a.seat - b.seat);
    }
    const label = (c: AdvisorCommittee) => (c.abbreviation ?? '').trim() || committeeDisplayName(c.name, c.abbreviation);
    return out.sort((a, b) => b.people - a.people || label(a).localeCompare(label(b)) || a.name.localeCompare(b.name));
  }, [conference, metaHere, photoMap]);

  // Once anything was read it stays on screen through a re-read (no loader).
  if (conference && committees && metaHere) {
    if (!conference.societyName && conference.seats.length === 0) return { kind: 'no-delegation' };
    return { kind: 'ready', committees, releaseAt: metaHere.releaseAt };
  }
  if (delegation.status === 'loading' || !metaHere) return { kind: 'loading' };
  if (delegation.status === 'error') return { kind: 'error' };
  return { kind: 'no-delegation' };
}
