'use client';

import { use, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCommitteeStore } from '@/lib/store';
import { Committee } from '@/lib/types';
import ChatPanel from '@/components/ChatPanel';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function DelegateSession({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const searchParams = useSearchParams();
  const country = searchParams.get('country') || '';
  const { committees, addToSpeakersList, proposeMotion } = useCommitteeStore();
  const [committee, setCommittee] = useState<Committee | null>(null);
  const [tab, setTab] = useState<'session' | 'motions' | 'resolutions' | 'chat'>('session');

  useEffect(() => {
    const found = Object.values(committees).find((c) => c.code === code.toUpperCase());
    if (found) setCommittee(found);
  }, [committees, code]);

  if (!committee) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold text-white mb-2">Session not found</h1>
          <p className="text-[#8892aa] mb-6">Code "{code}" is invalid or the session ended.</p>
          <Link href="/join" className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-semibold transition-colors">
            Try Again
          </Link>
        </div>
      </div>
    );
  }

  const myDelegate = committee.delegates.find((d) => d.country === country);
  const isOnSpeakersList = committee.speakersList.some((s) => s.country === country);
  const isCurrentSpeaker = committee.currentSpeaker?.country === country;
  const progress = isCurrentSpeaker ? (committee.speakerTimeRemaining / committee.speakerTimeLimit) * 100 : 0;

  const phaseLabel: Record<string, string> = {
    'pre-session': 'Pre-Session',
    'roll-call': 'Roll Call',
    'speakers-list': 'General Debate',
    'moderated-caucus': 'Moderated Caucus',
    'unmoderated-caucus': 'Unmoderated Caucus',
    'voting': 'Voting Procedure',
    'adjourned': 'Adjourned',
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex flex-col">
      {/* Header */}
      <header className="border-b border-[#1e2540] bg-[#0d1120] px-4 h-14 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold">M</div>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-white text-sm truncate">{committee.name}</div>
          <div className="text-xs text-[#8892aa] truncate">{committee.topic}</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-white">{country}</div>
          <div className="text-xs text-[#8892aa]">{phaseLabel[committee.phase] || committee.phase}</div>
        </div>
      </header>

      {/* Tab nav */}
      <div className="flex border-b border-[#1e2540] bg-[#0d1120]">
        {(['session', 'motions', 'resolutions', 'chat'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-xs font-semibold capitalize transition-colors ${
              tab === t ? 'text-white border-b-2 border-blue-500' : 'text-[#4a5580] hover:text-[#8892aa]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'session' && (
          <div className="p-4 space-y-4 max-w-2xl mx-auto">
            {/* Status card */}
            <div className={`rounded-xl p-5 border ${
              isCurrentSpeaker
                ? 'bg-blue-900/30 border-blue-600/50'
                : committee.phase === 'moderated-caucus' || committee.phase === 'unmoderated-caucus'
                ? 'bg-purple-900/20 border-purple-700/30'
                : 'bg-[#0f1526] border-[#1e2540]'
            }`}>
              <div className="text-xs font-mono text-[#4a5580] mb-2">SESSION STATUS</div>
              <div className={`text-2xl font-black mb-1 ${
                isCurrentSpeaker ? 'text-blue-300' :
                committee.phase === 'adjourned' ? 'text-red-400' : 'text-white'
              }`}>
                {isCurrentSpeaker ? '🎙️ You Have the Floor' : phaseLabel[committee.phase] || committee.phase}
              </div>

              {isCurrentSpeaker && (
                <div className="mt-4">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-[#8892aa]">Remaining time</span>
                    <span className={`text-sm font-mono font-bold ${committee.speakerTimeRemaining <= 10 ? 'text-red-400' : 'text-white'}`}>
                      {formatTime(committee.speakerTimeRemaining)}
                    </span>
                  </div>
                  <div className="h-3 bg-[#1a1f2e] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        progress > 50 ? 'bg-blue-500' : progress > 20 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {committee.caucus && (
                <div className="mt-3">
                  <div className="text-sm text-[#8892aa] mb-2">
                    {committee.caucus.type === 'moderated' ? 'Moderated' : 'Unmoderated'} Caucus
                    {committee.caucus.purpose && ` — ${committee.caucus.purpose}`}
                  </div>
                  <div className="text-3xl font-black font-mono text-white">
                    {formatTime(committee.caucus.remainingTime)}
                  </div>
                  <div className="h-2 bg-[#1a1f2e] rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full bg-purple-500 rounded-full transition-all"
                      style={{ width: `${(committee.caucus.remainingTime / committee.caucus.totalTime) * 100}%` }}
                    />
                  </div>
                  {committee.caucus.currentSpeaker && (
                    <div className="mt-3 text-sm">
                      <span className="text-[#8892aa]">Speaking: </span>
                      <span className={`font-bold ${committee.caucus.currentSpeaker === country ? 'text-blue-300' : 'text-white'}`}>
                        {committee.caucus.currentSpeaker}
                        {committee.caucus.currentSpeaker === country && ' (You)'}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Current speaker (if not me) */}
            {committee.currentSpeaker && !isCurrentSpeaker && committee.phase === 'speakers-list' && (
              <div className="bg-[#0f1526] border border-[#1e2540] rounded-xl p-4">
                <div className="text-xs text-[#4a5580] font-mono mb-2">NOW SPEAKING</div>
                <div className="text-lg font-bold text-white">{committee.currentSpeaker.country}</div>
                <div className="text-sm font-mono text-[#8892aa] mt-1">{formatTime(committee.speakerTimeRemaining)}</div>
              </div>
            )}

            {/* Speakers list */}
            {committee.phase === 'speakers-list' && (
              <div className="bg-[#0f1526] border border-[#1e2540] rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-[#4a5580] font-mono">SPEAKERS LIST</div>
                  {!isOnSpeakersList && !isCurrentSpeaker && myDelegate?.status !== 'absent' && (
                    <button
                      onClick={() => myDelegate && addToSpeakersList(committee.id, myDelegate.id)}
                      className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-lg font-medium transition-colors"
                    >
                      + Add Me
                    </button>
                  )}
                  {isOnSpeakersList && (
                    <span className="text-xs text-green-400 font-medium">✓ On list</span>
                  )}
                </div>
                {committee.speakersList.length === 0 ? (
                  <p className="text-sm text-[#4a5580]">No speakers queued</p>
                ) : (
                  <div className="space-y-1">
                    {committee.speakersList.map((s, i) => (
                      <div key={s.delegateId} className={`flex items-center gap-3 py-1.5 px-2 rounded-lg text-sm ${s.country === country ? 'bg-blue-950/30 border border-blue-800/20' : ''}`}>
                        <span className="text-[#4a5580] text-xs w-4 font-mono">{i + 1}</span>
                        <span className={s.country === country ? 'text-blue-300 font-bold' : 'text-[#c0c8d8]'}>
                          {s.country}{s.country === country && ' (You)'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* My delegation status */}
            <div className="bg-[#0f1526] border border-[#1e2540] rounded-xl p-4">
              <div className="text-xs text-[#4a5580] font-mono mb-3">YOUR DELEGATION</div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">{country}</div>
                  <div className="text-sm text-[#8892aa] mt-0.5">
                    Status:{' '}
                    <span className={
                      myDelegate?.status === 'present' ? 'text-green-400' :
                      myDelegate?.status === 'present-voting' ? 'text-blue-400' : 'text-red-400'
                    }>
                      {myDelegate?.status === 'present' ? 'Present' :
                       myDelegate?.status === 'present-voting' ? 'Present & Voting' : 'Absent'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'motions' && (
          <div className="p-4 max-w-2xl mx-auto space-y-3">
            <h2 className="text-lg font-bold text-white">Pending Motions</h2>
            {committee.motions.filter((m) => m.status === 'pending').length === 0 ? (
              <div className="text-center py-8 text-[#4a5580]">No pending motions</div>
            ) : (
              committee.motions
                .filter((m) => m.status === 'pending')
                .map((motion) => (
                  <div key={motion.id} className="bg-[#0f1526] border border-[#1e2540] rounded-xl p-4">
                    <div className="font-semibold text-white text-sm capitalize">{motion.type.replace(/-/g, ' ')}</div>
                    <div className="text-xs text-[#8892aa] mt-1">Proposed by {motion.proposedBy}</div>
                    {motion.purpose && <div className="text-xs text-[#8892aa] italic mt-1">"{motion.purpose}"</div>}
                    {motion.totalTime && (
                      <div className="text-xs text-[#4a5580] mt-1">
                        {Math.floor(motion.totalTime / 60)}m total
                        {motion.speakingTime && `, ${motion.speakingTime}s per speaker`}
                      </div>
                    )}
                  </div>
                ))
            )}
          </div>
        )}

        {tab === 'resolutions' && (
          <div className="p-4 max-w-2xl mx-auto space-y-3">
            <h2 className="text-lg font-bold text-white">Resolutions</h2>
            {committee.resolutions.length === 0 ? (
              <div className="text-center py-8 text-[#4a5580]">No resolutions submitted</div>
            ) : (
              committee.resolutions.map((res) => (
                <div key={res.id} className="bg-[#0f1526] border border-[#1e2540] rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div className="font-semibold text-white text-sm">{res.title}</div>
                    <span className={`text-xs font-bold ml-3 ${
                      res.status === 'passed' ? 'text-emerald-400' :
                      res.status === 'failed' ? 'text-red-400' :
                      res.status === 'approved' ? 'text-green-400' :
                      res.status === 'submitted' ? 'text-blue-400' :
                      res.status === 'rejected' ? 'text-red-400' : 'text-yellow-400'
                    }`}>{res.status}</span>
                  </div>
                  <div className="text-xs text-[#8892aa] mt-1">Sponsors: {res.sponsors.join(', ')}</div>
                  {res.content && (
                    <div className="mt-2 text-xs text-[#4a5580] bg-[#141929] rounded-lg p-2 max-h-24 overflow-y-auto whitespace-pre-wrap">
                      {res.content}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'chat' && (
          <div className="h-[calc(100vh-120px)]">
            <ChatPanel committee={committee} senderName={country} />
          </div>
        )}
      </div>
    </div>
  );
}
