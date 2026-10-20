'use client';

// ── The Job Board's extras for the Applications page (Job Board prompt 3) ──
//
// Read once per conference and signed-in organiser, beside the list:
//   unlimitedIds   conference_unlimited_applicants(p_conf): the application
//                  ids whose applicant holds Gavelling Unlimited (the badge).
//   picksByApp     job_application_picks(p_conf): each chair applicant's
//                  ranked listing picks with their screening answers.
//   teamCount      how many secretariat and staff applications this
//                  conference has. They are decided in Settings > Team only.
// And once: job_mark_reviewed(p_conf), fire and forget.
//
// Every read is best effort: a failed read leaves the empty value and says
// nothing (a missing badge or pick list never blocks the page).

import { useEffect, useRef, useState } from 'react';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import type { JobPick } from './JobPicksBlock';

interface PickRow {
  application_id: string;
  listing_id: string;
  title: string;
  rank: number | null;
  committee_id: string | null;
  answers: { id?: string; question?: string | null; answer?: string | null }[] | null;
}

export interface JobBoardApplicantExtras {
  unlimitedIds: Set<string>;
  picksByApp: Map<string, JobPick[]>;
  teamCount: number;
}

const EMPTY_SET = new Set<string>();
const EMPTY_MAP = new Map<string, JobPick[]>();

export function useJobBoardApplicantExtras(conferenceId: string | null | undefined, userId: string | null | undefined): JobBoardApplicantExtras {
  const [unlimitedIds, setUnlimitedIds] = useState<Set<string>>(EMPTY_SET);
  const [picksByApp, setPicksByApp] = useState<Map<string, JobPick[]>>(EMPTY_MAP);
  const [teamCount, setTeamCount] = useState(0);
  const markedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!conferenceId || !userId) return;
    let cancelled = false;
    (async () => {
      const supabase = await getFreshAuthedClient();
      if (!supabase || cancelled) return;

      if (markedFor.current !== conferenceId) {
        markedFor.current = conferenceId;
        void Promise.resolve(supabase.rpc('job_mark_reviewed', { p_conf: conferenceId })).catch(() => {});
      }

      let results;
      try {
        results = await Promise.all([
          supabase.rpc('conference_unlimited_applicants', { p_conf: conferenceId }),
          supabase.rpc('job_application_picks', { p_conf: conferenceId }),
          supabase.from('applications')
            .select('id', { count: 'exact', head: true })
            .eq('conference_id', conferenceId)
            .in('role', ['secretariat', 'staff']),
        ]);
      } catch {
        return;
      }
      if (cancelled) return;
      const [unl, picks, team] = results;

      if (!unl.error && Array.isArray(unl.data)) {
        setUnlimitedIds(new Set((unl.data as unknown[]).filter((x): x is string => typeof x === 'string')));
      }
      if (!picks.error && Array.isArray(picks.data)) {
        const next = new Map<string, JobPick[]>();
        for (const r of picks.data as PickRow[]) {
          if (!r?.application_id) continue;
          const list = next.get(r.application_id) ?? [];
          list.push({ listing_id: r.listing_id, title: r.title, rank: r.rank, answers: r.answers });
          next.set(r.application_id, list);
        }
        setPicksByApp(next);
      }
      if (!team.error) setTeamCount(team.count ?? 0);
    })();
    return () => { cancelled = true; };
  }, [conferenceId, userId]);

  return { unlimitedIds, picksByApp, teamCount };
}
