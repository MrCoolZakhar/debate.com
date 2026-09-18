'use client';

// What the chair page shows while the room is in voting mode (`phase === 'voting'`).
//
// /voting/[code] sets that phase when the Moderator opens it (V-3), so delegate phones
// switch to "Vote in progress". The chair page renders no main view for 'voting', so a
// Commenter on the chair page, or a Moderator who came back with the browser's Back button
// instead of "Back to Session", used to see an empty panel. This card fills it:
//   • every chair: open the voting screen (the Commenter gets the live read-only tally);
//   • the Moderator only: return the room to exactly the phase it was in before voting,
//     through the same `set_committee_voting_phase` the voting screen uses (V-4).
// Nothing here touches committee state optimistically: the phase change arrives through
// the chair page's own realtime refetch.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Vote } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import type { Committee } from '@/lib/types';
import { setVotingPhase } from '@/lib/voteState';

export function VotingInProgressCard({ committee, isViewOnly, chairName }: {
  committee: Pick<Committee, 'id' | 'code' | 'dbChairJoinSuffix' | 'endedAt'>;
  isViewOnly: boolean;
  chairName: string;
}) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const openVoting = () => {
    router.push(`/voting/${committee.code}${chairName ? `?chairName=${encodeURIComponent(chairName)}` : ''}`);
  };

  const returnToDebate = async () => {
    setBusy(true);
    setFailed(false);
    const r = await setVotingPhase(committee.id, false, committee.code, committee.dbChairJoinSuffix ?? undefined);
    setBusy(false);
    if (!r.ok) setFailed(true);
  };

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-10">
      <div
        className="w-full max-w-md rounded-2xl px-6 py-6 text-center"
        style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', boxShadow: '0 12px 32px rgba(27,56,40,0.10)' }}
      >
        <div className="mx-auto mb-3 w-11 h-11 rounded-full flex items-center justify-center" style={{ backgroundColor: '#1B3828', color: '#EED98A' }}>
          <Vote size={20} />
        </div>
        <h2 className="text-lg font-black" style={{ color: '#1B3828' }}>{t('voting_in_progress_chair_title')}</h2>
        <p className="text-sm mt-1.5 leading-relaxed" style={{ color: '#6A5A4A' }}>
          {t(isViewOnly ? 'voting_in_progress_chair_body_commenter' : 'voting_in_progress_chair_body')}
        </p>
        {failed && (
          <p role="alert" className="text-sm font-semibold mt-3" style={{ color: '#8B2020' }}>{t('voting_phase_leave_failed')}</p>
        )}
        <div className="mt-5 flex flex-wrap gap-2 justify-center">
          <button
            onClick={openVoting}
            className="px-5 py-2.5 rounded-xl font-black text-sm focus:outline-none gv-lift"
            style={{ backgroundColor: '#1B3828', color: '#EED98A' }}
          >
            {t('voting_open_screen')}
          </button>
          {!isViewOnly && !committee.endedAt && (
            <button
              onClick={() => { void returnToDebate(); }}
              disabled={busy}
              className="px-5 py-2.5 rounded-xl font-bold text-sm focus:outline-none gv-lift disabled:opacity-60"
              style={{ backgroundColor: '#EDE7D8', color: '#1C1410', border: '1.5px solid #DDD4C0' }}
            >
              {t('voting_return_to_debate')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
