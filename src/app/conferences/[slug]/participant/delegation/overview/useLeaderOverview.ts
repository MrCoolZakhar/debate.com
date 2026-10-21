'use client';

// The reads behind a leader's Overview recap (owner, 21 Oct 2026: "a recap a
// faculty advisor would want"). Every one is a read the delegation screens
// already make; nothing new on the database:
//   the people              my_delegation_roster(p_society) (names, photos,
//                           roles, statuses, payment status, allocation)
//   their user and committee ids
//                           applications (the leaders' RLS read, as DelegationPanel)
//   open allocations        my_delegation_open_seats (v2.readOpenSeats)
//   position papers         position_papers rows of the members (v2.readPaperStatuses,
//                           readable by leaders through the position_papers RLS)
//   the committees' dates   conference_committees (position_paper_deadline,
//                           pp_submissions_enabled, study_guides_publish_at)
//   the conference's dates  conferences (start_date, end_date, dates_tbd)
//   the leader's tickets    my_pay_overview (readPayOverview, the /pay read the
//                           Financials card counts tickets from); a failed read
//                           leaves the tickets tile empty, never the recap
// Effects are keyed on ids, never on a token; the client is made at call time
// (getFreshAuthedClient). The first read is the only one with a skeleton:
// `reload` swaps the data in place and a failed re-read keeps what is shown.

import { useCallback, useEffect, useRef, useState } from 'react';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError, plainOrFallback, UserFacingError } from '@/lib/friendlyError';
import type { RosterMember } from '../../DelegationPanel';
import { DELEGATIONS_V2_DB, readOpenSeats, readPaperStatuses, type OpenSeat } from '../v2';
import { readPayOverview, type PayOverview } from '../../../pay/payApi';

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

export interface LeaderOverviewData {
  isLeader: boolean;
  members: RosterMember[];
  apps: Map<string, OverviewApp>;
  openSeats: OpenSeat[] | null;
  /** Paper status per member user id; null when the read failed. */
  papers: Map<string, string> | null;
  committees: Map<string, OverviewCommittee>;
  conference: { start_date: string | null; end_date: string | null; dates_tbd: boolean } | null;
  /** The leader's own items (my_pay_overview); null when the read failed. */
  pay: PayOverview | null;
}

export type LeaderOverviewState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; data: LeaderOverviewData };

const LIVE_STATUSES = ['accepted', 'assigned', 'checked-in'];

export function useLeaderOverview(conferenceId: string, societyId: string): { state: LeaderOverviewState; reload: () => Promise<void> } {
  const [state, setState] = useState<LeaderOverviewState>({ kind: 'loading' });
  const shown = useRef(false);
  const seq = useRef(0);

  const reload = useCallback(async () => {
    const my = ++seq.current;
    const fallback = 'Your delegation could not be read. Refresh the page to try again.';
    try {
      const c = await getFreshAuthedClient();
      if (!c) throw new UserFacingError('Your session has expired. Refresh the page and sign in again.');
      const [rosterRes, appsRes, openSeats, confRes, pay] = await Promise.all([
        c.rpc('my_delegation_roster', { p_society: societyId }),
        c.from('applications').select('id, user_id, assigned_committee_id, attending')
          .eq('society_id', societyId).in('status', LIVE_STATUSES),
        DELEGATIONS_V2_DB ? readOpenSeats(societyId) : Promise.resolve<OpenSeat[] | null>([]),
        c.from('conferences').select('start_date, end_date, dates_tbd').eq('id', conferenceId).maybeSingle(),
        readPayOverview(conferenceId).catch(() => null),
      ]);
      if (rosterRes.error) throw rosterRes.error;
      const r = (rosterRes.data ?? {}) as { ok?: boolean; message?: string; is_leader?: boolean; members?: RosterMember[] };
      if (r.ok !== true) throw new UserFacingError(plainOrFallback(r.message, fallback));
      const members = Array.isArray(r.members) ? r.members : [];

      const apps = new Map<string, OverviewApp>();
      for (const a of (appsRes.data ?? []) as { id: string; user_id: string | null; assigned_committee_id: string | null; attending: boolean | null }[]) {
        apps.set(a.id, { user_id: a.user_id, assigned_committee_id: a.assigned_committee_id, attending: a.attending !== false });
      }

      const committeeIds = [...new Set([
        ...[...apps.values()].map(a => a.assigned_committee_id).filter((x): x is string => !!x),
        ...(openSeats ?? []).map(s => s.conference_committee_id).filter(Boolean),
      ])];
      const userIds = [...new Set([...apps.values()].map(a => a.user_id).filter((x): x is string => !!x))];

      const [ccRes, papers] = await Promise.all([
        committeeIds.length > 0
          ? c.from('conference_committees')
            .select('id, name, abbreviation, logo_url, position_paper_deadline, pp_submissions_enabled, study_guides_publish_at')
            .in('id', committeeIds)
          : Promise.resolve({ data: [], error: null }),
        DELEGATIONS_V2_DB ? readPaperStatuses(userIds, committeeIds) : Promise.resolve<Map<string, string> | null>(null),
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
          isLeader: r.is_leader === true,
          members,
          apps,
          openSeats,
          papers,
          committees,
          conference: conf ? { start_date: conf.start_date ?? null, end_date: conf.end_date ?? null, dates_tbd: conf.dates_tbd === true } : null,
          pay,
        },
      });
    } catch (e) {
      if (my !== seq.current) return;
      // A failed re-read keeps what is on screen.
      if (!shown.current) setState({ kind: 'error', message: friendlyError(e, fallback) });
    }
  }, [conferenceId, societyId]);

  useEffect(() => { void Promise.resolve().then(reload); }, [reload]);

  return { state, reload };
}
