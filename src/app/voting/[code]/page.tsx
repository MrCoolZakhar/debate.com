'use client';

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Committee, DelegateStatus } from '@/lib/types';
import { getCountryByName, getFlagUrl } from '@/lib/countries';
import { Emoji } from '@/components/Emoji';
import { getCommitteeByCode, setPhase as setPhaseInDB, setDelegateStatus as setDelegateStatusInDB, updateDocumentStatus as updateDocumentStatusInDB } from '@/lib/committeeService';
import { useSettingsStore } from '@/lib/settingsStore';
import { SettingsPanel } from '@/components/SettingsPanel';

function abbreviateCommitteeName(name: string): string {
  return name
    .replace(/\bUN\s+Security\s+Council\b/gi, 'UNSC')
    .replace(/\bUN\s+General\s+Assembly\b/gi, 'UNGA')
    .replace(/\bUN\s+Human\s+Rights\s+Council\b/gi, 'UNHRC')
    .replace(/United Nations Security Council/gi, 'UNSC')
    .replace(/Security Council/gi, 'UNSC')
    .replace(/United Nations General Assembly/gi, 'UNGA')
    .replace(/General Assembly/gi, 'UNGA')
    .replace(/United Nations Human Rights Council/gi, 'UNHRC')
    .replace(/Human Rights Council/gi, 'HRC')
    .replace(/^UN\s+/i, '');
}

type VoteChoice = 'for' | 'against' | 'for-rights' | 'against-rights' | 'abstain';
interface DelegateVote {
  delegateId: string;
  country: string;
  choice: VoteChoice;
}

type VotingPhase = 'voting' | 'rights-speakers' | 'result';

function getFlag(country: string) {
  const found = getCountryByName(country);
  return found
    ? <img src={getFlagUrl(found.code)} alt={found.code} className="inline-block object-contain" style={{ width: '1em', height: '1em' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
    : <Emoji size="1em">🌐</Emoji>;
}

function VoteScale({ forCount, againstCount, totalVoted }: {
  forCount: number; againstCount: number; totalVoted: number;
}) {
  const forPct = totalVoted > 0 ? (forCount / totalVoted) * 50 : 0;
  const againstPct = totalVoted > 0 ? (againstCount / totalVoted) * 50 : 0;
  return (
    <div className="w-full max-w-2xl px-4">
      <div className="relative h-7 bg-[#EDE7D8] rounded-full overflow-hidden border border-[#DDD4C0]">
        <div
          className="absolute right-1/2 top-0 bottom-0 bg-red-500/70 transition-all duration-300"
          style={{ width: `${againstPct}%` }}
        />
        <div
          className="absolute left-1/2 top-0 bottom-0 bg-green-500/70 transition-all duration-300"
          style={{ width: `${forPct}%` }}
        />
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-[#9A8A78] -translate-x-px" />
      </div>
      <div className="flex justify-between mt-1.5 text-xs font-bold">
        <span className="text-red-400">← {againstCount} Against</span>
        <span className="text-[#9A8A78] text-[10px] font-normal">{totalVoted} voted</span>
        <span className="text-green-400">{forCount} For →</span>
      </div>
    </div>
  );
}

export default function VotingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();

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
  const [rollCallDone, setRollCallDone] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  // Local delegate statuses for roll call modal (mirrors committee.delegates)
  const [rollCallStatuses, setRollCallStatuses] = useState<Record<string, DelegateStatus>>({});
  const [rightsTimerLimit, setRightsTimerLimit] = useState(60);
  const [orderedRights, setOrderedRights] = useState<DelegateVote[]>([]);
  const dragIndexRef = useRef<number | null>(null);
  const resultPersistedRef = useRef(false);

  useEffect(() => {
    async function load() {
      const found = await getCommitteeByCode(code);
      setCommittee(found ?? null);
      if (found) {
        const statuses: Record<string, DelegateStatus> = {};
        found.delegates.forEach((d) => { statuses[d.id] = d.status; });
        setRollCallStatuses(statuses);
      }
      setLoading(false);
    }
    load();
  }, [code]);

  useEffect(() => {
    if (committee) document.title = `${abbreviateCommitteeName(committee.name)} — Voting`;
    return () => { document.title = 'Gavelling'; };
  }, [committee?.name]);

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

  // Reset rights timer when speaker index or limit changes
  useEffect(() => {
    setRightsSpeakerTime(rightsTimerLimit);
    setRightsRunning(false);
  }, [rightsIndex, rightsTimerLimit]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F1E9] flex items-center justify-center">
        <img src="/loading.gif" alt="Loading..." className="w-24 h-24 object-contain" />
      </div>
    );
  }

  if (!committee) {
    return (
      <div className="min-h-screen bg-[#F6F1E9] flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4"><Emoji size="2.5rem">🔍</Emoji></div>
          <h1 className="text-2xl font-bold text-[#1C1410] mb-2">Committee not found</h1>
          <p className="text-[#6A5A4A] mb-6">Code &ldquo;{code}&rdquo; is invalid or the session ended.</p>
          <Link href="/" className="bg-[#1B3828] hover:bg-[#2A5A3C] text-white px-6 py-3 rounded-lg font-semibold transition-colors">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  // ── committee is guaranteed non-null from here ─────────────────────────────
  const settings = getSettings(committee.code);

  const allDRs = (committee.documents ?? []).filter(
    (d) => d.type === 'draft-resolution' &&
      ['introduced', 'passed', 'failed'].includes(d.status)
  );
  const selectedDoc = allDRs.find((d) => d.id === selectedDocId) ?? null;
  // Use roll call statuses (local) if roll call is done, else use DB status
  const presentDelegates = committee.delegates
    .filter((d) => (rollCallDone ? rollCallStatuses[d.id] ?? d.status : d.status) !== 'absent')
    .sort((a, b) => a.country.localeCompare(b.country));

  const forCount = votes.filter((v) => v.choice === 'for' || v.choice === 'for-rights').length;
  const againstCount = votes.filter((v) => v.choice === 'against' || v.choice === 'against-rights').length;
  const abstainCount = votes.filter((v) => v.choice === 'abstain').length;
  const withRightsAll = votes
    .filter((v) => v.choice === 'for-rights' || v.choice === 'against-rights')
    .sort((a, b) => a.country.localeCompare(b.country));
  const withRights = withRightsAll.slice(0, 10);

  // Veto check (2c: use vetoCountries if set, else fall back to p5Delegations then hardcoded P5)
  const vetoList = settings.vetoCountries?.length
    ? settings.vetoCountries
    : (settings.p5Delegations?.length ? settings.p5Delegations : ["China","France","Russia","United Kingdom","United States"]);
  const p5Veto = settings.vetoMode === 'p5'
    && votes.some((v) => vetoList.includes(v.country) && (v.choice === 'against' || v.choice === 'against-rights'));
  const unanimousRequired = settings.vetoMode === 'unanimous';
  // Unanimous: every present delegate (P and PV) must vote 'for' or 'for-rights'
  const presentAndPvDelegates = committee.delegates.filter(
    (d) => (rollCallStatuses[d.id] ?? d.status) !== 'absent'
  );
  const unanimousFail =
    unanimousRequired &&
    phase === 'result' &&
    presentAndPvDelegates.some((d) => {
      const vote = votes.find((v) => v.delegateId === d.id);
      return !vote || (vote.choice !== 'for' && vote.choice !== 'for-rights');
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

  const persistResult = (docId: string, result: 'passed' | 'failed') => {
    if (resultPersistedRef.current) return;
    resultPersistedRef.current = true;
    updateDocumentStatusInDB(docId, result);
    // Update local committee state so the DR list reflects the result immediately
    setCommittee((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        documents: prev.documents.map((d) =>
          d.id === docId ? { ...d, status: result } : d
        ),
      };
    });
  };

  const startNewVote = (docId: string) => {
    setSelectedDocId(docId);
    setVotes([]);
    setPhase('voting');
    setCurrentVoterIndex(0);
    setRightsIndex(0);
    setOrderedRights([]);
    resultPersistedRef.current = false;
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
      setOrderedRights([...withRights]);
      setPhase('rights-speakers');
      setRightsIndex(0);
    } else {
      setPhase('result');
      if (selectedDoc) persistResult(selectedDoc.id, passed ? 'passed' : 'failed');
    }
  };

  const handleNextRightsSpeaker = () => {
    if (rightsIndex + 1 >= orderedRights.length) {
      setPhase('result');
      if (selectedDoc) persistResult(selectedDoc.id, passed ? 'passed' : 'failed');
    } else {
      setRightsIndex((i) => i + 1);
    }
  };

  const handleBackToSession = async () => {
    await setPhaseInDB(committee.id, 'speakers-list');
    router.push(`/chair/${committee.code}`);
  };
  const handleEndDebate = async () => {
    await setPhaseInDB(committee.id, 'adjourned');
    router.push('/');
  };

  const Header = ({ children }: { children?: React.ReactNode }) => (
    <header className="border-b border-[#DDD4C0] bg-[#FAF8F3] px-6 h-12 flex items-center gap-4 shrink-0">
      <Link href="/">
        <img
          src="/GavellingLogo.png"
          alt="Gavelling"
          className="w-[16vw] h-auto max-h-8 object-contain"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      </Link>
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-sm font-bold text-[#1C1410] truncate">{abbreviateCommitteeName(committee.name)}</span>
      </div>
      <button
        onClick={handleBackToSession}
        className="text-xs px-3 py-1 rounded-lg bg-[#DDD4C0] text-[#6A5A4A] hover:text-[#1C1410] transition-colors shrink-0"
      >
        ← Back to Session
      </button>
      <button
        onClick={handleEndDebate}
        className="text-xs px-3 py-1 rounded-lg bg-red-950/50 text-red-400 hover:bg-red-900/60 border border-red-900/50 transition-colors shrink-0"
      >
        End Debate
      </button>
      <button onClick={() => setShowSettings(true)} className="text-[#9A8A78] hover:text-[#1C1410] transition-colors shrink-0 text-2xl">⚙</button>
      {children}
    </header>
  );

  // ── Roll call modal (blocks until dismissed) ─────────────────────────────
  const RollCallModal = () => {
    const sorted = [...committee.delegates].sort((a, b) => a.country.localeCompare(b.country));
    const cycleStatus = (id: string) => {
      setRollCallStatuses((prev) => {
        const cur = prev[id] ?? 'absent';
        const next: DelegateStatus = cur === 'absent' ? 'present' : cur === 'present' ? 'present-voting' : 'absent';
        setDelegateStatusInDB(id, next);
        return { ...prev, [id]: next };
      });
    };
    const thumbPos = (status: DelegateStatus) =>
      status === 'absent' ? 'left-[2px]' : status === 'present' ? 'left-[31px]' : 'left-[60px]';
    const thumbColor = (status: DelegateStatus) =>
      status === 'absent' ? 'bg-red-300' : status === 'present' ? 'bg-green-500' : 'bg-blue-500';
    const presentCount = Object.values(rollCallStatuses).filter((s) => s !== 'absent').length;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(5, 4, 3, 0.92)', backdropFilter: 'blur(4px)' }}>
        <div className="bg-[#EDE7D8] border border-[#DDD4C0] rounded-2xl w-full max-w-md shadow-2xl flex flex-col" style={{ maxHeight: '85vh' }}>
          <div className="px-5 py-4 border-b border-[#DDD4C0] shrink-0">
            <h2 className="text-base font-black text-[#1C1410]">Roll Call</h2>
            <p className="text-xs text-[#9A8A78] mt-0.5">{presentCount} of {committee.delegates.length} delegates present — confirm before voting</p>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
            {sorted.map((d) => {
              const status = rollCallStatuses[d.id] ?? d.status;
              return (
                <div key={d.id} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all ${
                  status === 'absent' ? 'opacity-40 border border-transparent' :
                  status === 'present' ? 'bg-green-950/30 border border-green-800/30' :
                  'bg-blue-950/30 border border-blue-800/30'
                }`}>
                  {(() => { const f = getCountryByName(d.country); return f ? <img src={getFlagUrl(f.code)} alt={f.code} className="w-5 h-5 object-contain inline-block" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : <Emoji size="1.25rem">🌐</Emoji>; })()}
                  <span className="flex-1 text-sm text-[#1C1410] truncate">{d.country}</span>
                  <button
                    onClick={() => cycleStatus(d.id)}
                    className={`relative w-[90px] h-[30px] rounded-full bg-[#EDE7D8] border border-[#DDD4C0] cursor-pointer shrink-0 select-none`}
                  >
                    <div className="absolute inset-0 grid grid-cols-3 items-center pointer-events-none">
                      <span className={`text-[10px] font-bold text-center ${status === 'absent' ? 'text-red-900' : 'text-[#9A8A78]'}`}>A</span>
                      <span className={`text-[10px] font-bold text-center ${status === 'present' ? 'text-[#1C1410]' : 'text-[#9A8A78]'}`}>P</span>
                      <span className={`text-[10px] font-bold text-center ${status === 'present-voting' ? 'text-[#1C1410]' : 'text-[#9A8A78]'}`}>PV</span>
                    </div>
                    <div className={`absolute top-[3px] w-[26px] h-[24px] rounded-full transition-all duration-200 ${thumbPos(status)} ${thumbColor(status)}`} />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="px-4 py-4 border-t border-[#DDD4C0] shrink-0">
            <button
              onClick={() => setRollCallDone(true)}
              disabled={presentCount === 0}
              className="w-full bg-[#1B3828] hover:bg-[#2A5A3C] disabled:bg-[#DDD4C0] disabled:text-[#9A8A78] text-white py-3 rounded-xl font-black text-sm transition-colors"
            >
              {presentCount > 0 ? `Start Voting with ${presentCount} delegates →` : 'Mark at least 1 delegate present'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Doc selection screen ──────────────────────────────────────────────────
  if (!selectedDoc) {
    return (
      <div className="min-h-screen bg-[#F6F1E9] flex flex-col">
        <Header />
        {!rollCallDone && <RollCallModal />}
        {showSettings && <SettingsPanel committee={committee} onClose={() => setShowSettings(false)} />}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-96 space-y-3">
            <p className="text-xs font-mono text-[#9A8A78] text-center mb-5 tracking-widest">
              SELECT DRAFT RESOLUTION TO VOTE ON
            </p>
            {allDRs.length === 0 ? (
              <p className="text-sm text-[#9A8A78] text-center py-8">No introduced draft resolutions.</p>
            ) : (
              allDRs.map((doc) => {
                const isVoted = doc.status === 'passed' || doc.status === 'failed';
                return (
                  <button
                    key={doc.id}
                    onClick={() => !isVoted && startNewVote(doc.id)}
                    disabled={isVoted}
                    className={`w-full text-left px-4 py-4 rounded-xl border transition-colors ${
                      isVoted
                        ? 'border-[#DDD4C0] bg-[#F6F1E9] opacity-60 cursor-not-allowed'
                        : 'border-[#DDD4C0] bg-[#EDE7D8] text-[#6A5A4A] hover:border-[#1B3828]/60 hover:bg-[#1B3828]/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-xs font-mono font-bold text-[#1B3828]">{doc.docCode}</span>
                      {doc.status === 'passed' && (
                        <span className="text-[10px] font-bold text-green-400 bg-green-950/40 border border-green-800/40 px-2 py-0.5 rounded-full">✓ PASSED</span>
                      )}
                      {doc.status === 'failed' && (
                        <span className="text-[10px] font-bold text-red-400 bg-red-950/40 border border-red-800/40 px-2 py-0.5 rounded-full">✗ FAILED</span>
                      )}
                    </div>
                    <span className="text-base font-bold text-[#1C1410] block">{doc.title}</span>
                    {doc.sponsors.length > 0 && (
                      <span className="text-xs text-[#9A8A78] block mt-1">Sponsors: {doc.sponsors.join(', ')}</span>
                    )}
                  </button>
                );
              })
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
    <div className="h-screen bg-[#F6F1E9] flex flex-col overflow-hidden">
      <Header>
        <span className="text-xs font-mono font-bold text-[#1B3828] bg-[#DDD4C0] px-2 py-0.5 rounded shrink-0">
          {selectedDoc.docCode}
        </span>
        <span className="text-sm font-bold text-[#1C1410] truncate hidden sm:block">{selectedDoc.title}</span>
        <span className="text-xs text-[#9A8A78] shrink-0">
          {Math.min(currentVoterIndex, presentDelegates.length)}/{presentDelegates.length} voted
        </span>
        <button
          onClick={() => setSelectedDocId(null)}
          className="text-xs text-[#9A8A78] hover:text-[#6A5A4A] transition-colors shrink-0"
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
              className="select-none mb-3 flex items-center justify-center"
            >
              {getFlag(currentDelegate.country)}
            </div>
            <h1
              style={{ fontSize: 'min(5.5vw, 5vh)' }}
              className="font-black text-[#1C1410] text-center leading-tight mb-1"
            >
              {currentDelegate.country}
            </h1>
            <p className="text-[#9A8A78] text-sm">
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
            {(rollCallStatuses[currentDelegate.id] ?? currentDelegate.status) === 'present' ? (
              <button
                onClick={() => castVoteAndAdvance(currentDelegate.id, currentDelegate.country, 'abstain')}
                className="flex-1 bg-[#DDD4C0]/60 hover:bg-[#C8BAA8]/80 border border-[#9A8A78]/50 text-[#6A5A4A] font-black text-base py-6 rounded-2xl transition-colors"
              >
                Abstain
              </button>
            ) : (
              <button disabled className="flex-1 bg-[#DDD4C0]/30 border border-[#9A8A78]/20 text-[#9A8A78] font-black text-base py-6 rounded-2xl opacity-40 cursor-not-allowed">
                Abstain (P+V)
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
              <p className="text-[10px] text-[#9A8A78] font-mono text-center mb-2 tracking-widest">UP NEXT</p>
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
                    <span className="text-[9px] text-[#9A8A78] text-center max-w-[52px] truncate">
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
          <Emoji size="3.75rem">🗳️</Emoji>
          <h2 className="text-3xl font-black text-[#1C1410]">
            All {presentDelegates.length} delegates have voted
          </h2>
          <div className="flex gap-10 text-center">
            <div>
              <div className="text-4xl font-black text-green-400">{forCount}</div>
              <div className="text-[#6A5A4A] text-sm mt-1">For</div>
            </div>
            <div>
              <div className="text-4xl font-black text-red-400">{againstCount}</div>
              <div className="text-[#6A5A4A] text-sm mt-1">Against</div>
            </div>
            {abstainCount > 0 && (
              <div>
                <div className="text-4xl font-black text-[#6A5A4A]">{abstainCount}</div>
                <div className="text-[#9A8A78] text-sm mt-1">Abstain</div>
              </div>
            )}
            {withRights.length > 0 && (
              <div>
                <div className="text-4xl font-black text-amber-400">{withRights.length}</div>
                <div className="text-[#6A5A4A] text-sm mt-1">w/ Rights</div>
              </div>
            )}
          </div>
          <VoteScale forCount={forCount} againstCount={againstCount} totalVoted={votes.length} />
          <button
            onClick={handleFinishVoting}
            className="bg-[#1B3828] hover:bg-[#2A5A3C] text-white px-12 py-4 rounded-2xl font-black text-lg transition-colors mt-2"
          >
            {withRights.length > 0
              ? `Proceed to Rights Speakers (${withRights.length}) →`
              : 'See Final Result →'}
          </button>
        </div>
      )}

      {/* ── Rights speakers ── */}
      {phase === 'rights-speakers' && orderedRights.length > 0 && (
        <div className="flex-1 flex flex-col items-center justify-between py-8 px-8 overflow-hidden">
          <div className="flex-1 flex flex-col items-center justify-center min-h-0">
            <p className="text-xs text-amber-400 font-mono tracking-widest mb-6">
              RIGHTS SPEAKERS — {rightsIndex + 1} OF {orderedRights.length}
            </p>
            <div
              style={{ fontSize: 'min(18vw, 16vh)', lineHeight: '1' }}
              className="select-none mb-3 flex items-center justify-center"
            >
              {getFlag(orderedRights[rightsIndex].country)}
            </div>
            <h1
              style={{ fontSize: 'min(5vw, 4vh)' }}
              className="font-black text-[#1C1410] text-center mb-2"
            >
              {orderedRights[rightsIndex].country}
            </h1>
            <p className="text-amber-400 font-semibold">
              {orderedRights[rightsIndex].choice === 'for-rights' ? '★ In Favour with Rights' : '★ Against with Rights'}
            </p>
            {/* Rights speaker countdown timer */}
            <div className={`text-6xl font-black font-mono mt-4 tabular-nums ${rightsSpeakerTime <= 10 ? 'text-red-500' : rightsSpeakerTime <= 20 ? 'text-yellow-500' : 'text-[#1C1410]'}`}>
              {Math.floor(rightsSpeakerTime / 60)}:{String(rightsSpeakerTime % 60).padStart(2, '0')}
            </div>
            <div className="flex gap-2 mt-3 flex-wrap justify-center">
              <button
                onClick={() => setRightsRunning((r) => !r)}
                className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-colors ${rightsRunning ? 'bg-yellow-600 hover:bg-yellow-500 text-white' : 'bg-[#2A5A3C] hover:bg-[#3D7A52] text-white'}`}
              >
                {rightsRunning ? '⏸ Pause' : '▶ Start'}
              </button>
              {[30, 45, 60, 90, 120].map((s) => (
                <button key={s} onClick={() => setRightsTimerLimit(s)}
                  className={`px-3 py-2.5 rounded-xl font-bold text-xs transition-colors ${rightsTimerLimit === s ? 'bg-[#1B3828] text-white' : 'bg-[#DDD4C0] text-[#6A5A4A] hover:bg-[#C8BAA8]'}`}>
                  {s}s
                </button>
              ))}
            </div>
          </div>

          <div className="w-full max-w-md space-y-1 mb-4">
            {orderedRights.map((v, i) => (
              <div
                key={v.delegateId}
                draggable={i > rightsIndex}
                onDragStart={() => { dragIndexRef.current = i; }}
                onDragOver={(e) => { if (i > rightsIndex) e.preventDefault(); }}
                onDrop={() => {
                  const from = dragIndexRef.current;
                  if (from === null || from === i || from <= rightsIndex || i <= rightsIndex) return;
                  setOrderedRights((prev) => {
                    const arr = [...prev];
                    const [item] = arr.splice(from, 1);
                    arr.splice(i, 0, item);
                    return arr;
                  });
                  dragIndexRef.current = null;
                }}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-opacity ${
                  i === rightsIndex
                    ? 'bg-amber-900/20 border border-amber-700/30 opacity-100'
                    : i < rightsIndex
                    ? 'opacity-30'
                    : 'opacity-60 cursor-grab'
                }`}
              >
                {i > rightsIndex && <span className="text-[#9A8A78] text-xs">⠿</span>}
                <span className="text-[#9A8A78] text-xs w-5 font-mono text-right">{i + 1}</span>
                <span className="text-[#1C1410]">{getFlag(v.country)} {v.country}</span>
                <span className={`ml-auto text-xs ${
                  i < rightsIndex ? 'text-[#9A8A78]' :
                  i === rightsIndex ? 'text-amber-400 font-bold' :
                  'text-[#9A8A78]'
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
            className="w-full max-w-md bg-[#1B3828] hover:bg-[#2A5A3C] text-white py-4 rounded-2xl font-black text-lg transition-colors"
          >
            {rightsIndex + 1 < orderedRights.length ? 'Next Rights Speaker →' : 'See Final Result →'}
          </button>
        </div>
      )}

      {/* ── Final result ── */}
      {phase === 'result' && (
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6">
          <p className="text-xs font-mono text-[#9A8A78] tracking-widest">
            FINAL RESULT — {selectedDoc.docCode}
          </p>
          <div className={`rounded-3xl border px-16 py-12 text-center ${
            passed ? 'bg-green-950/30 border-green-700/40' : 'bg-red-950/30 border-red-700/40'
          }`}>
            <div className={`text-6xl font-black mb-3 ${passed ? 'text-green-400' : 'text-red-400'}`}>
              {passed ? '✓ PASSED' : '✗ FAILED'}
            </div>
            <p className="text-xl font-bold text-[#1C1410] mb-6">{selectedDoc.title}</p>
            <div className="flex justify-center gap-10">
              <div className="text-center">
                <div className="text-4xl font-black text-green-400">{forCount}</div>
                <div className="text-[#6A5A4A] mt-1">For</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-black text-red-400">{againstCount}</div>
                <div className="text-[#6A5A4A] mt-1">Against</div>
              </div>
              {abstainCount > 0 && (
                <div className="text-center">
                  <div className="text-4xl font-black text-[#6A5A4A]">{abstainCount}</div>
                  <div className="text-[#9A8A78] mt-1">Abstain</div>
                </div>
              )}
              {withRights.length > 0 && (
                <div className="text-center">
                  <div className="text-4xl font-black text-amber-400">{withRights.length}</div>
                  <div className="text-[#6A5A4A] mt-1">w/ Rights</div>
                </div>
              )}
            </div>
            {p5Veto && (
              <p className="text-red-400 text-sm mt-4 font-semibold flex items-center gap-1 justify-center"><Emoji size="1em">🛡️</Emoji> P5 veto exercised</p>
            )}
            {unanimousFail && (
              <p className="text-red-400 text-sm mt-4 font-semibold">
                ⚠️ Unanimous vote required — one or more delegates voted against or abstained
              </p>
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
              className="bg-[#DDD4C0] hover:bg-[#EDE7D8] border border-[#DDD4C0] text-[#6A5A4A] py-3 px-6 rounded-xl font-bold transition-colors"
            >
              Vote Again
            </button>
            <button
              onClick={() => setSelectedDocId(null)}
              className="bg-[#DDD4C0] hover:bg-[#EDE7D8] border border-[#DDD4C0] text-[#6A5A4A] py-3 px-6 rounded-xl font-bold transition-colors"
            >
              Move to Next DR →
            </button>
            <button
              onClick={handleEndDebate}
              className="bg-red-950/50 hover:bg-red-900/60 border border-red-900/50 text-red-400 py-3 px-6 rounded-xl font-bold transition-colors"
            >
              End Debate
            </button>
          </div>
        </div>
      )}
      {showSettings && <SettingsPanel committee={committee} onClose={() => setShowSettings(false)} />}
    </div>
  );
}