'use client';

// The reads behind the Overview of anyone in a delegation (owner, 21 Oct 2026:
// head delegates, faculty advisors and plain delegates see "very similar"
// dashboards). Every one is a read the delegation screens already make;
// nothing new on the database:
//   the people              my_delegation_roster(p_society) (names, photos,
//                           roles, statuses, payment status, allocation); any
//                           member may call it
//   their user and committee ids
//                           applications (a leader reads every member; a
//                           delegate their own row and the leaders')
//   the viewer's own seat   conference_allocations by user id in this
//                           conference's committees, the SAME read the page
//                           makes for `myAllocation`, so the seat appears the
//                           moment a leader allocates themselves (owner, 21 Oct
//                           2026: it used to wait for a reload)
//   the delegation's home   societies (name, city, country_code, logo_url)
//   open allocations        my_delegation_open_seats (leaders only)
//   position papers         position_papers of the members (leaders only,
//                           v2.readPaperStatuses through the position_papers RLS)
//   the committees' dates   conference_committees (position_paper_deadline,
//                           pp_submissions_enabled, study_guides_publish_at)
//   the conference's dates  conferences (start_date, end_date, dates_tbd)
// Effects are keyed on ids, never on a token; the client is made at call time
// (getFreshAuthedClient). The first read is the only one with a skeleton:
// `reload` swaps the data in place and a failed re-read keeps what is shown.
// Every landed change on the leader card (DELEGATION_CHANGED_EVENT) and an
// added delegate (DELEGATE_ADDED_EVENT) re-read it in place.

import { useCallback, useEffect, useRef, useState } from 'react';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError, plainOrFallback, UserFacingError } from '@/lib/friendlyError';
import type { RosterMember } from '../../DelegationPanel';
import type { ParticipantAllocation } from '../../types';
import { DELEGATIONS_V2_DB, readOpenSeats, readPaperStatuses, type OpenSeat } from '../v2';
import { DELEGATION_CHANGED_EVENT } from '../delegationEvents';
import { DELEGATE_ADDED_EVENT } from './AddDelegatePanel';

export interface OverviewCommittee {
  id: string;
  name: string;
  abbreviation: string | null;
  logo_url: string | null;
  paper_deadline: string | null;
  papers_on: boolean;
  guides_at: string | null;
}

export interface OverviewApp {
  user_id: string | null;
  assigned_committee_id: string | null;
  attending: boolean;
}

export interface OverviewSociety {
  name: string | null;
  city: string | null;
  country_code: string | null;
  logo_url: string | null;
}

export interface DelegationOverviewData {
  isLeader: boolean;
  /** The delegation's name (my_delegation_roster's society_name). */
  societyName: string | null;
  society: OverviewSociety | null;
  members: RosterMember[];
  apps: Map<string, OverviewApp>;
  /** Leaders only; null when not read or the read failed. */
  openSeats: OpenSeat[] | null;
  /** Paper status per member user id; null when not read or the read failed. */
  papers: Map<string, string> | null;
  committees: Map<string, OverviewCommittee>;
  conference: { start_date: string | null; end_date: string | null; dates_tbd: boolean } | null;
  /** The viewer's own allocation; undefined when the read failed (the page's copy is used then). */
  own: ParticipantAllocation | null | undefined;
}

export type DelegationOverviewState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; data: DelegationOverviewData };

const LIVE_STATUSES = ['accepted', 'assigned', 'checked-in'];
const OWN_SELECT = 'id, country_code, country_name, conference_committee_id, conference_committees (name, position_paper_deadline, session_code, released_to_delegates_at)';

export function useDelegationOverview({ conferenceId, societyId, userId, leader, conferenceCommitteeIds }: {
  conferenceId: string;
  societyId: string;
  userId: string | null;
  /** The viewer leads (head delegate or faculty advisor): open seats and papers are read too. */
  leader: boolean;
  /** Every committee of this conference, for the viewer's own allocation. */
  conferenceCommitteeIds: string[];
}): { state: DelegationOverviewState; reload: () => Promise<void> } {
  const [state, setState] = useState<DelegationOverviewState>({ kind: 'loading' });
  const shown = useRef(false);
  const seq = useRef(0);
  const committeeKey = [...new Set(conferenceCommitteeIds.filter(Boolean))].sort().join(',');

  const reload = useCallback(async () => {
    const my = ++seq.current;
    const fallback = 'Your delegation could not be read. Refresh the page to try again.';
    try {
      const c = await getFreshAuthedClient();
      if (!c) throw new UserFacingError('Your session has expired. Refresh the page and sign in again.');
      const confCommitteeIds = committeeKey ? committeeKey.split(',') : [];
      const [rosterRes, appsRes, openSeats, confRes, societyRes, ownRes] = await Promise.all([
        c.rpc('my_delegation_roster', { p_society: societyId }),
        c.from('applications').select('id, user_id, assigned_committee_id, attending')
          .eq('society_id', societyId).in('status', LIVE_STATUSES),
        leader && DELEGATIONS_V2_DB ? readOpenSeats(societyId) : Promise.resolve<OpenSeat[] | null>(null),
        c.from('conferences').select('start_date, end_date, dates_tbd').eq('id', conferenceId).maybeSingle(),
        c.from('societies').select('name, city, country_code, logo_url').eq('id', societyId).maybeSingle(),
        userId && confCommitteeIds.length > 0
          ? c.from('conference_allocations').select(OWN_SELECT).eq('user_id', userId).in('conference_committee_id', confCommitteeIds).limit(1).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (rosterRes.error) throw rosterRes.error;
      const r = (rosterRes.data ?? {}) as { ok?: boolean; message?: string; society_name?: string | null; is_leader?: boolean; members?: RosterMember[] };
      if (r.ok !== true) throw new UserFacingError(plainOrFallback(r.message, fallback));
      const members = Array.isArray(r.members) ? r.members : [];
      const isLeader = r.is_leader === true;

      const apps = new Map<string, OverviewApp>();
      for (const a of (appsRes.data ?? []) as { id: string; user_id: string | null; assigned_committee_id: string | null; attending: boolean | null }[]) {
        apps.set(a.id, { user_id: a.user_id, assigned_committee_id: a.assigned_committee_id, attending: a.attending !== false });
      }
      const own: ParticipantAllocation | null | undefined = ownRes.error
        ? undefined
        : ((ownRes.data as unknown as ParticipantAllocation | null) ?? null);

      // A delegate's Overview is about their own committee; a leader's about
      // every committee the delegation sits in.
      const committeeIds = [...new Set([
        ...(isLeader ? [...apps.values()].map(a => a.assigned_committee_id) : []),
        ...(openSeats ?? []).map(s => s.conference_committee_id),
        own?.conference_committee_id ?? null,
      ].filter((x): x is string => !!x))];
      const userIds = [...new Set([...apps.values()].map(a => a.user_id).filter((x): x is string => !!x))];

      const [ccRes, papers] = await Promise.all([
        committeeIds.length > 0
          ? c.from('conference_committees')
            .select('id, name, abbreviation, logo_url, position_paper_deadline, pp_submissions_enabled, study_guides_publish_at')
            .in('id', committeeIds)
          : Promise.resolve({ data: [], error: null }),
        isLeader && DELEGATIONS_V2_DB ? readPaperStatuses(userIds, committeeIds) : Promise.resolve<Map<string, string> | null>(null),
      ]);
      const committees = new Map<string, OverviewCommittee>();
      for (const cc of (ccRes.data ?? []) as {
        id: string; name: string; abbreviation: string | null; logo_url: string | null;
        position_paper_deadline: string | null; pp_submissions_enabled: boolean | null; study_guides_publish_at: string | null;
      }[]) {
        committees.set(cc.id, {
          id: cc.id, name: cc.name, abbreviation: cc.abbreviation, logo_url: cc.logo_url,
          paper_deadline: cc.position_paper_deadline, papers_on: cc.pp_submissions_enabled !== false,
          guides_at: cc.study_guides_publish_at,
        });
      }
      const conf = confRes.data as { start_date?: string | null; end_date?: string | null; dates_tbd?: boolean | null } | null;

      if (my !== seq.current) return;
      shown.current = true;
      setState({
        kind: 'ready',
        data: {
          isLeader,
          societyName: (r.society_name ?? '').trim() || null,
          society: (societyRes.data as OverviewSociety | null) ?? null,
          members,
          apps,
          openSeats,
          papers,
          committees,
          conference: conf ? { start_date: conf.start_date ?? null, end_date: conf.end_date ?? null, dates_tbd: conf.dates_tbd === true } : null,
          own,
        },
      });
    } catch (e) {
      if (my !== seq.current) return;
      // A failed re-read keeps what is on screen.
      if (!shown.current) setState({ kind: 'error', message: friendlyError(e, fallback) });
    }
  }, [conferenceId, societyId, userId, leader, committeeKey]);

  useEffect(() => { void Promise.resolve().then(reload); }, [reload]);

  // A landed change on the leader card, or a delegate added: read again in place.
  useEffect(() => {
    const again = () => { void reload(); };
    window.addEventListener(DELEGATION_CHANGED_EVENT, again);
    window.addEventListener(DELEGATE_ADDED_EVENT, again);
    return () => {
      window.removeEventListener(DELEGATION_CHANGED_EVENT, again);
      window.removeEventListener(DELEGATE_ADDED_EVENT, again);
    };
  }, [reload]);

  return { state, reload };
}
