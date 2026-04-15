'use client';

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Committee } from '@/lib/types';
import { getCountryByName, getFlagEmoji } from '@/lib/countries';
import { getCommitteeByCode } from '@/lib/committeeService';
import { useSettingsStore } from '@/lib/settingsStore';

type VoteChoice = 'for' | 'against' | 'for-rights' | 'against-rights' | 'abstain';
interface DelegateVote {
  delegateId: string;
  country: string;
  choice: VoteChoice;
}

type VotingPhase = 'voting' | 'rights-speakers' | 'result';

function getFlag(country: string) {
  const found = getCountryByName(country);
  return found ? getFlagEmoji(found.code) : '🌐';
}

function VoteScale({ forCount, againstCount, totalVoted }: {
  forCount: number; againstCount: number; totalVoted: number;
}) {
  const forPct = totalVoted > 0 ? (forCount / totalVoted) * 50 : 0;
  const againstPct = totalVoted > 0 ? (againstCount / totalVoted) * 50 : 0;
  return (
    <div className="w-full max-w-2xl px-4">
      <div className="relative h-7 bg-[#1A1209] rounded-full overflow-hidden border border-[#2E1E0F]">
        <div
          className="absolute right-1/2 top-0 bottom-0 bg-red-500/70 transition-all duration-300"
          style={{ width: `${againstPct}%` }}
        />
        <div
          className="absolute left-1/2 top-0 bottom-0 bg-green-500/70 transition-all duration-300"
          style={{ width: `${forPct}%` }}
        />
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-[#7A5A38] -translate-x-px" />
      </div>
      <div className="flex justify-between mt-1.5 text-xs font-bold">
        <span className="text-red-400">← {againstCount} Against</span>
        <span className="text-[#7A5A38] text-[10px] font-normal">{totalVoted} voted</span>
        <span className="text-green-400">{forCount} For →</span>
      </div>
    </div>
  );
}

export default function VotingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);

  // ── ALL hooks must be called before any early returns ──────────────────────
  const getSettings = useSettingsStore((s) => s.getSettings);
  const [committee, setCommittee] = useState<Committee | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [votes, setVotes] = useState<DelegateVote[]>([]);
  const [phase, setPhase] = useState<VotingPhase>('voting');
  const [currentVoterIndex, setCurrentVoterIndex] = useState(0);
  const [rightsIndex, setRightsIndex] = useState(0);
  const [rightsSpeakerTime, setRightsSpeakerTime] = useState(60);
  const [rightsRunning, setRightsRunning] = useState(false);
  const rightsTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function load() {
      const found = await getCommitteeByCode(code);
      setCommittee(found ?? null);
      setLoading(false);
    }
    load();
  }, [code]);

  // Rights speaker countdown timer
  useEffect(() => {
    if (rightsRunning) {
      rightsTimerRef.current = setInterval(() => {
        setRightsSpeakerTime((prev) => {
          if (prev <= 1) { setRightsRunning(false); return 0; }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (rightsTimerRef.current) { clearInterval(rightsTimerRef.current); rightsTimerRef.current = null; }
    }
    return () => { if (rightsTimerRef.current) { clearInterval(rightsTimerRef.current); rightsTimerRef.current = null; } };
  }, [rightsRunning]);

  // Reset rights timer when speaker index changes
  useEffect(() => {
    setRightsSpeakerTime(60);
    setRightsRunning(false);
  }, [rightsIndex]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D0906] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#7B4A1E] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!committee) {
    return (
      <div className="min-h-screen bg-[#0D0906] flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold text-white mb-2">Committee not found</h1>
          <p className="text-[#C4A882] mb-6">Code &ldquo;{code}&rdquo; is invalid or the session ended.</p>
          <Link href="/" className="bg-[#7B4A1E] hover:bg-[#8B5A2B] text-white px-6 py-3 rounded-lg font-semibold transition-colors">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  // ── committee is guaranteed non-null from here ─────────────────────────────
  const settings = getSettings(committee.code);

  const introducedDRs = (committee.documents ?? []).filter(
    (d) => d.type === 'draft-resolution' && d.status === 'introduced'
  );
  const selectedDoc = introducedDRs.find((d) => d.id === selectedDocId) ?? null;
  const presentDelegates = committee.delegates
    .filter((d) => d.status !== 'absent')
    .sort((a, b) => a.country.localeCompare(b.country));

  const forCount = votes.filter((v) => v.choice === 'for' || v.choice === 'for-rights').length;
  const againstCount = votes.filter((v) => v.choice === 'against' || v.choice === 'against-rights').length;
  const abstainCount = votes.filter((v) => v.choice === 'abstain').length;
  const withRightsAll = votes
    .filter((v) => v.choice === 'for-rights' || v.choice === 'against-rights')
    .sort((a, b) => a.country.localeCompare(b.country));
  const withRights = withRightsAll.slice(0, 10);

  // Veto check
  const p5Veto = settings.vetoMode === 'p5'
    && votes.some((v) => settings.p5Delegations.includes(v.country) && (v.choice === 'against' || v.choice === 'against-rights'));
  const unanimousRequired = settings.vetoMode === 'unanimous';
  const pvDelegates = committee.delegates.filter((d) => d.status === 'present-voting');
  const unanimousFail = unanimousRequired && pvDelegates.some((d) => {
    const vote = votes.find((v) => v.delegateId === d.id);
    return !vote || vote.choice === 'against' || vote.choice === 'against-rights' || vote.choice === 'abstain';
  });

  // Threshold check (substantive votes)
  const totalDecisive = forCount + againstCount; // abstentions excluded from denominator
  let thresholdMet = false;
  if (settings.substantiveThreshold === 'supermajority-2-3') {
    thresholdMet = totalDecisive > 0 && forCount >= (2 / 3) * totalDecisive;
  } else if (settings.substantiveThreshold === 'consensus') {
    thresholdMet = againstCount === 0 && forCount > 0;
  } else {
    // simple majority: more for than against
    thresholdMet = forCount > againstCount;
  }

  const passed = !p5Veto && !unanimousFail && thresholdMet;

  const startNewVote = (docId: string) => {
    setSelectedDocId(docId);
    setVotes([]);
    setPhase('voting');
    setCurrentVoterIndex(0);
    setRightsIndex(0);
  };

  const castVoteAndAdvance = (delegateId: string, country: string, choice: VoteChoice) => {
    setVotes((prev) => {
      const existing = prev.find((v) => v.delegateId === delegateId);
      if (existing) return prev.map((v) => v.delegateId === delegateId ? { ...v, choice } : v);
      return [...prev, { delegateId, country, choice }];
    });
    setCurrentVoterIndex((i) => i + 1);
  };

  const handleFinishVoting = () => {
    if (withRights.length > 0) {
      setPhase('rights-speakers');
      setRightsIndex(0);
    } else {
      setPhase('result');
    }
  };

  const handleNextRightsSpeaker = () => {
    if (rightsIndex + 1 >= withRights.length) {
      setPhase('result');
    } else {
      setRightsIndex((i) => i + 1);
    }
  };

  const Header = ({ children }: { children?: React.ReactNode }) => (
    <header className="border-b border-[#2E1E0F] bg-[#150F08] px-6 h-12 flex items-center gap-4 shrink-0">
      <Link href="/">
        <img
          src="/gavelling-logo.png"
          alt="Gavelling"
          className="w-[16vw] h-auto max-h-8 object-contain"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      </Link>
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-sm font-bold text-white truncate">{committee.name}</span>
      </div>
      {children}
    </header>
  );

  // ── Doc selection screen ──────────────────────────────────────────────────
  if (!selectedDoc) {
    return (
      <div className="min-h-screen bg-[#0D0906] flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-96 space-y-3">
            <p className="text-xs font-mono text-[#7A5A38] text-center mb-5 tracking-widest">
              SELECT DRAFT RESOLUTION TO VOTE ON
            </p>
            {introducedDRs.length === 0 ? (
              <p className="text-sm text-[#7A5A38] text-center py-8">No introduced draft resolutions.</p>
            ) : (
              introducedDRs.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => startNewVote(doc.id)}
                  className="w-full text-left px-4 py-4 rounded-xl border border-[#2E1E0F] bg-[#1A1209] text-[#C4A882] hover:border-[#7B4A1E]/60 hover:bg-[#7B4A1E]/10 transition-colors"
                >
                  <span className="text-xs font-mono font-bold text-[#7B4A1E] block">{doc.docCode}</span>
                  <span className="text-base font-bold text-white block mt-0.5">{doc.title}</span>
                  {doc.sponsors.length > 0 && (
                    <span className="text-xs text-[#7A5A38] block mt-1">Sponsors: {doc.sponsors.join(', ')}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  const currentDelegate = currentVoterIndex < presentDelegates.length
    ? presentDelegates[currentVoterIndex]
    : null;
  const upcomingDelegates = presentDelegates.slice(currentVoterIndex + 1, currentVoterIndex + 6);

  return (
    <div className="h-screen bg-[#0D0906] flex flex-col overflow-hidden">
      <Header>
        <span className="text-xs font-mono font-bold text-[#7B4A1E] bg-[#2E1E0F] px-2 py-0.5 rounded shrink-0">
          {selectedDoc.docCode}
        </span>
        <span className="text-sm font-bold text-white truncate hidden sm:block">{selectedDoc.title}</span>
        <span className="text-xs text-[#7A5A38] shrink-0">
          {Math.min(currentVoterIndex, presentDelegates.length)}/{presentDelegates.length} voted
        </span>
        <button
          onClick={() => setSelectedDocId(null)}
          className="text-xs text-[#7A5A38] hover:text-[#C4A882] transition-colors shrink-0"
        >
          ← DRs
        </button>
      </Header>

      {/* ── Active voting: one delegate at a time ── */}
      {phase === 'voting' && currentDelegate && (
        <div className="flex-1 flex flex-col items-center justify-between py-6 px-4 overflow-hidden">
          {/* Current voter */}
          <div className="flex-1 flex flex-col items-center justify-center min-h-0">
            <div
              style={{ fontSize: 'min(22vw, 18vh)', lineHeight: '1' }}
              className="select-none mb-3"
            >
              {getFlag(currentDelegate.country)}
            </div>
            <h1
              style={{ fontSize: 'min(5.5vw, 5vh)' }}
              className="font-black text-white text-center leading-tight mb-1"
            >
              {currentDelegate.country}
            </h1>
            <p className="text-[#7A5A38] text-sm">
              {currentVoterIndex + 1} of {presentDelegates.length}
            </p>
          </div>

          {/* Vote buttons */}
          <div className="flex gap-3 w-full max-w-3xl mb-4">
            <button
              onClick={() => castVoteAndAdvance(currentDelegate.id, currentDelegate.country, 'for')}
              className="flex-1 bg-green-800/40 hover:bg-green-700/60 border border-green-600/50 text-green-300 font-black text-base py-6 rounded-2xl transition-colors"
            >
              In Favour
            </button>
            <button
              onClick={() => castVoteAndAdvance(currentDelegate.id, currentDelegate.country, 'for-rights')}
              className="flex-1 bg-amber-900/30 hover:bg-amber-800/50 border border-amber-600/40 text-amber-300 font-black text-sm py-6 rounded-2xl transition-colors leading-snug"
            >
              In Favour<br />with Rights
            </button>
            {currentDelegate.status === 'present' && (
              <button
                onClick={() => castVoteAndAdvance(currentDelegate.id, currentDelegate.country, 'abstain')}
                className="flex-1 bg-[#2E1E0F]/60 hover:bg-[#3D2A15]/80 border border-[#7A5A38]/50 text-[#C4A882] font-black text-base py-6 rounded-2xl transition-colors"
              >
                Abstain
              </button>
            )}
            <button
              onClick={() => castVoteAndAdvance(currentDelegate.id, currentDelegate.country, 'against-rights')}
              className="flex-1 bg-orange-900/30 hover:bg-orange-800/50 border border-orange-600/40 text-orange-300 font-black text-sm py-6 rounded-2xl transition-colors leading-snug"
            >
              Against<br />with Rights
            </button>
            <button
              onClick={() => castVoteAndAdvance(currentDelegate.id, currentDelegate.country, 'against')}
              className="flex-1 bg-red-800/40 hover:bg-red-700/60 border border-red-600/50 text-red-300 font-black text-base py-6 rounded-2xl transition-colors"
            >
              Against
            </button>
          </div>

          {/* Scale */}
          <VoteScale forCount={forCount} againstCount={againstCount} totalVoted={votes.length} />

          {/* Upcoming voters */}
          {upcomingDelegates.length > 0 && (
            <div className="mt-4 w-full max-w-2xl">
              <p className="text-[10px] text-[#7A5A38] font-mono text-center mb-2 tracking-widest">UP NEXT</p>
              <div className="flex items-center justify-center gap-4">
                {upcomingDelegates.map((d, i) => (
                  <div
                    key={d.id}
                    className="flex flex-col items-center gap-1"
                    style={{ opacity: Math.max(0.2, 1 - i * 0.18) }}
                  >
                    <span style={{ fontSize: i === 0 ? '4rem' : `${Math.max(1.2, 2.8 - i * 0.2)}rem`, lineHeight: '1' }}>
                      {getFlag(d.country)}
                    </span>
                    <span className="text-[9px] text-[#7A5A38] text-center max-w-[52px] truncate">
                      {d.country}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── All voted — proceed screen ── */}
      {phase === 'voting' && !currentDelegate && (
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6">
          <div className="text-6xl">🗳️</div>
          <h2 className="text-3xl font-black text-white">
            All {presentDelegates.length} delegates have voted
          </h2>
          <div className="flex gap-10 text-center">
            <div>
              <div className="text-4xl font-black text-green-400">{forCount}</div>
              <div className="text-[#C4A882] text-sm mt-1">For</div>
            </div>
            <div>
              <div className="text-4xl font-black text-red-400">{againstCount}</div>
              <div className="text-[#C4A882] text-sm mt-1">Against</div>
            </div>
            {abstainCount > 0 && (
              <div>
                <div className="text-4xl font-black text-[#C4A882]">{abstainCount}</div>
                <div className="text-[#7A5A38] text-sm mt-1">Abstain</div>
              </div>
            )}
            {withRights.length > 0 && (
              <div>
                <div className="text-4xl font-black text-amber-400">{withRights.length}</div>
                <div className="text-[#C4A882] text-sm mt-1">w/ Rights</div>
              </div>
            )}
          </div>
          <VoteScale forCount={forCount} againstCount={againstCount} totalVoted={votes.length} />
          <button
            onClick={handleFinishVoting}
            className="bg-[#7B4A1E] hover:bg-[#8B5A2B] text-white px-12 py-4 rounded-2xl font-black text-lg transition-colors mt-2"
          >
            {withRights.length > 0
              ? `Proceed to Rights Speakers (${withRights.length}) →`
              : 'See Final Result →'}
          </button>
        </div>
      )}

      {/* ── Rights speakers ── */}
      {phase === 'rights-speakers' && withRights.length > 0 && (
        <div className="flex-1 flex flex-col items-center justify-between py-8 px-8 overflow-hidden">
          <div className="flex-1 flex flex-col items-center justify-center min-h-0">
            <p className="text-xs text-amber-400 font-mono tracking-widest mb-6">
              RIGHTS SPEAKERS — {rightsIndex + 1} OF {withRights.length}
            </p>
            <div
              style={{ fontSize: 'min(18vw, 16vh)', lineHeight: '1' }}
              className="select-none mb-3"
            >
              {getFlag(withRights[rightsIndex].country)}
            </div>
            <h1
              style={{ fontSize: 'min(5vw, 4vh)' }}
              className="font-black text-white text-center mb-2"
            >
              {withRights[rightsIndex].country}
            </h1>
            <p className="text-amber-400 font-semibold">
              {withRights[rightsIndex].choice === 'for-rights' ? '★ In Favour with Rights' : '★ Against with Rights'}
            </p>
            {/* Rights speaker countdown timer */}
            <div className={`text-6xl font-black font-mono mt-4 tabular-nums ${rightsSpeakerTime <= 10 ? 'text-red-500' : rightsSpeakerTime <= 20 ? 'text-yellow-500' : 'text-white'}`}>
              {Math.floor(rightsSpeakerTime / 60)}:{String(rightsSpeakerTime % 60).padStart(2, '0')}
            </div>
            <div className="flex gap-3 mt-3">
              <button
                onClick={() => setRightsRunning((r) => !r)}
                className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-colors ${rightsRunning ? 'bg-yellow-600 hover:bg-yellow-500 text-white' : 'bg-[#3D6B35] hover:bg-[#4A7C42] text-white'}`}
              >
                {rightsRunning ? '⏸ Pause' : '▶ Start'}
              </button>
            </div>
          </div>

          <div className="w-full max-w-md space-y-1 mb-4">
            {withRights.map((v, i) => (
              <div
                key={v.delegateId}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-opacity ${
                  i === rightsIndex
                    ? 'bg-amber-900/20 border border-amber-700/30 opacity-100'
                    : i < rightsIndex
                    ? 'opacity-30'
                    : 'opacity-60'
                }`}
              >
                <span className="text-[#7A5A38] text-xs w-5 font-mono text-right">{i + 1}</span>
                <span className="text-white">{getFlag(v.country)} {v.country}</span>
                <span className={`ml-auto text-xs ${
                  i < rightsIndex ? 'text-[#7A5A38]' :
                  i === rightsIndex ? 'text-amber-400 font-bold' :
                  'text-[#7A5A38]'
                }`}>
                  {i < rightsIndex ? 'Done' :
                   i === rightsIndex ? 'Speaking' :
                   v.choice === 'for-rights' ? 'For w/ Rights' : 'Against w/ Rights'}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={() => { setRightsRunning(false); handleNextRightsSpeaker(); }}
            className="w-full max-w-md bg-[#7B4A1E] hover:bg-[#8B5A2B] text-white py-4 rounded-2xl font-black text-lg transition-colors"
          >
            {rightsIndex + 1 < withRights.length ? 'Next Rights Speaker →' : 'See Final Result →'}
          </button>
        </div>
      )}

      {/* ── Final result ── */}
      {phase === 'result' && (
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6">
          <p className="text-xs font-mono text-[#7A5A38] tracking-widest">
            FINAL RESULT — {selectedDoc.docCode}
          </p>
          <div className={`rounded-3xl border px-16 py-12 text-center ${
            passed ? 'bg-green-950/30 border-green-700/40' : 'bg-red-950/30 border-red-700/40'
          }`}>
            <div className={`text-6xl font-black mb-3 ${passed ? 'text-green-400' : 'text-red-400'}`}>
              {passed ? '✓ PASSED' : '✗ FAILED'}
            </div>
            <p className="text-xl font-bold text-white mb-6">{selectedDoc.title}</p>
            <div className="flex justify-center gap-10">
              <div className="text-center">
                <div className="text-4xl font-black text-green-400">{forCount}</div>
                <div className="text-[#C4A882] mt-1">For</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-black text-red-400">{againstCount}</div>
                <div className="text-[#C4A882] mt-1">Against</div>
              </div>
              {abstainCount > 0 && (
                <div className="text-center">
                  <div className="text-4xl font-black text-[#C4A882]">{abstainCount}</div>
                  <div className="text-[#7A5A38] mt-1">Abstain</div>
                </div>
              )}
              {withRights.length > 0 && (
                <div className="text-center">
                  <div className="text-4xl font-black text-amber-400">{withRights.length}</div>
                  <div className="text-[#C4A882] mt-1">w/ Rights</div>
                </div>
              )}
            </div>
            {p5Veto && (
              <p className="text-red-400 text-sm mt-4 font-semibold">🛡️ P5 veto exercised</p>
            )}
            {unanimousFail && (
              <p className="text-red-400 text-sm mt-4 font-semibold">⚠️ Unanimous vote required — failed</p>
            )}
            {!p5Veto && !unanimousFail && settings.substantiveThreshold === 'supermajority-2-3' && (
              <p className={`text-sm mt-3 font-semibold ${thresholdMet ? 'text-green-400' : 'text-red-400'}`}>
                2/3 supermajority required · {forCount}/{totalDecisive} ({totalDecisive > 0 ? Math.round(forCount / totalDecisive * 100) : 0}%)
              </p>
            )}
            {!p5Veto && !unanimousFail && settings.substantiveThreshold === 'consensus' && (
              <p className={`text-sm mt-3 font-semibold ${thresholdMet ? 'text-green-400' : 'text-red-400'}`}>
                Consensus required · {againstCount} voted against
              </p>
            )}
          </div>
          <VoteScale forCount={forCount} againstCount={againstCount} totalVoted={votes.length} />
          <div className="flex gap-3">
            <button
              onClick={() => startNewVote(selectedDoc.id)}
              className="bg-[#2E1E0F] hover:bg-[#3E2A1A] border border-[#2E1E0F] text-[#C4A882] py-3 px-6 rounded-xl font-bold transition-colors"
            >
              Vote Again
            </button>
            <button
              onClick={() => setSelectedDocId(null)}
              className="bg-[#2E1E0F] hover:bg-[#3E2A1A] border border-[#2E1E0F] text-[#C4A882] py-3 px-6 rounded-xl font-bold transition-colors"
            >
              ← Back to DRs
            </button>
          </div>
        </div>
      )}
    </div>
  );
}