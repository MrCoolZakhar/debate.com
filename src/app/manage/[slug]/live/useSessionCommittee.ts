'use client';

// ─────────────────────────────────────────────────────────────────────────────
// The live session, read exactly the way the chair's console reads it.
//
// The organiser's Scoreboard, History, Documents and Attendance views render the
// SESSION's own components (ScoreboardTable with the chair's props,
// DelegateProfile, HistoryTab, the ResolutionPicker card look). Those take a
// full `Committee` and the committee's `feedback` rows, so this hook loads them
// through the chair page's own readers (`getCommitteeByCode`,
// `getFeedbackForCommittee`, `loadVoteStates`) instead of a second, thinner
// assembly. Every sessions table is public-read, so an organiser's anon client
// reads the same rows the dais does.
//
// READ ONLY. Nothing here writes. It re-reads every 20 s while the tab is visible
// (and at once when it becomes visible), which is enough for a secretariat
// watching from the side; the chair's realtime machinery is not needed here.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import { getCommitteeByCode, getFeedbackForCommittee, type FeedbackEntry } from '@/lib/committeeService';
import { loadVoteStates, type VoteStateV1 } from '@/lib/voteState';
import type { Committee } from '@/lib/types';

export interface SessionSnapshot {
  committee: Committee;
  feedback: FeedbackEntry[];
  voteStates: Record<string, VoteStateV1>;
}

const REFRESH_MS = 20_000;

export function useSessionCommittee(code: string | null | undefined): {
  data: SessionSnapshot | null;
  loading: boolean;
  error: string;
} {
  const [data, setData] = useState<SessionSnapshot | null>(null);
  const [loading, setLoading] = useState(!!code);
  const [error, setError] = useState('');
  const hasData = useRef(false);

  useEffect(() => {
    hasData.current = false;
    if (!code) { setData(null); setLoading(false); return; }
    let alive = true;
    let inFlight = false;
    setLoading(true);

    const load = async () => {
      if (inFlight) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      inFlight = true;
      try {
        const committee = await getCommitteeByCode(code);
        if (!alive) return;
        if (!committee) {
          // Keep the last good snapshot on a transient failure; only a first load reports.
          if (!hasData.current) setError("Couldn't load this session. Try again in a moment.");
          return;
        }
        const [feedback, votes] = await Promise.all([
          getFeedbackForCommittee(committee.id, { code: committee.code, chairSuffix: committee.dbChairJoinSuffix ?? undefined }),
          loadVoteStates(committee.id),
        ]);
        if (!alive) return;
        hasData.current = true;
        setData({ committee, feedback, voteStates: votes ?? {} });
        setError('');
      } catch (err) {
        console.error('[useSessionCommittee] load failed:', err);
        if (alive && !hasData.current) setError("Couldn't load this session. Try again in a moment.");
      } finally {
        inFlight = false;
        if (alive) setLoading(false);
      }
    };

    void load();
    const timer = setInterval(() => { void load(); }, REFRESH_MS);
    const onVis = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { alive = false; clearInterval(timer); document.removeEventListener('visibilitychange', onVis); };
  }, [code]);

  return { data, loading, error };
}
