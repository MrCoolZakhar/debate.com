'use client';

import { use, useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useCommitteeStore } from '@/lib/store';
import { Committee } from '@/lib/types';
import RollCallPanel from '@/components/RollCallPanel';
import MotionsPanel from '@/components/MotionsPanel';
import CaucusPanel from '@/components/CaucusPanel';
import { getFlagEmoji, getCountryByName } from '@/lib/countries';

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function FlagCircle({ country }: { country: string }) {
  const found = getCountryByName(country);
  const flag = found ? getFlagEmoji(found.code) : '🌐';
  return (
    <div className="w-10 h-10 rounded-full bg-[#1e2540] flex items-center justify-center text-xl shrink-0">
      {flag}
    </div>
  );
}

export default function ChairSession({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { committees, nextSpeaker, addToSpeakersList, removeFromSpeakersList, setSpeakerTimeLimit, tickSpeakerTimer } = useCommitteeStore();
  const [committee, setCommittee] = useState<Committee | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [showMotions, setShowMotions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [newTimeLimit, setNewTimeLimit] = useState('90');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const found = Object.values(committees).find((c) => c.code === code.toUpperCase());
    setCommittee(found ?? null);
  }, [committees, code]);

  useEffect(() => {
    if (timerRunning && committee?.currentSpeaker) {
      intervalRef.current = setInterval(() => tickSpeakerTimer(committee.id), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timerRunning, committee?.id, committee?.currentSpeaker, tickSpeakerTimer]);

  useEffect(() => {
    if (committee?.speakerTimeRemaining === 0) setTimerRunning(false);
  }, [committee?.speakerTimeRemaining]);

  if (!committee) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-xl font-bold mb-4">Committee not found</p>
          <Link href="/create" className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold">Create one</Link>
        </div>
      </div>
    );
  }

  const present = committee.delegates.filter((d) => d.status !== 'absent').length;
  const presentDelegates = committee.delegates.filter((d) => d.status !== 'absent');
  const onList = new Set(committee.speakersList.map((s) => s.delegateId));
  const progress = committee.currentSpeaker ? (committee.speakerTimeRemaining / committee.speakerTimeLimit) * 100 : 100;
  const inSession = committee.phase !== 'pre-session' && committee.phase !== 'roll-call';

  const phaseColor = {
    'pre-session': 'text-yellow-400',
    'roll-call': 'text-orange-400',
    'speakers-list': 'text-green-400',
    'moderated-caucus': 'text-blue-400',
    'unmoderated-caucus': 'text-purple-400',
    'voting': 'text-yellow-400',
    'adjourned': 'text-red-400',
  }[committee.phase] ?? 'text-white';

  const phaseLabel = {
    'pre-session': 'Pre-Session',
    'roll-call': 'Roll Call',
    'speakers-list': 'In Session',
    'moderated-caucus': 'Mod. Caucus',
    'unmoderated-caucus': 'Unmod. Caucus',
    'voting': 'Voting',
    'adjourned': 'Adjourned',
  }[committee.phase] ?? committee.phase;

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col">
      {/* Header */}
      <header className="border-b border-[#1e2540] bg-[#0d1120] px-4 h-12 flex items-center gap-3 shrink-0">
        <Link href="/">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold">M</div>
        </Link>
        <span className="font-bold text-white text-sm truncate">{committee.name}</span>
        <span className="text-[#4a5580] text-xs hidden sm:block truncate flex-1">{committee.topic}</span>
        <span className={`text-xs font-bold ${phaseColor} shrink-0`}>● {phaseLabel}</span>
        <span className="text-xs text-[#8892aa] shrink-0">{present}/{committee.delegates.length}</span>
        <button
          onClick={() => { navigator.clipboard.writeText(committee.code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="text-xs font-mono bg-[#1e2540] hover:bg-[#2a3050] text-white px-2.5 py-1 rounded-lg transition-colors shrink-0"
        >
          {copied ? '✓' : committee.code}
        </button>
      </header>

      {/* Body: 3 columns */}
      <div className="flex-1 flex overflow-hidden" style={{ height: 'calc(100vh - 48px)' }}>

        {/* Left: Roll Call — always visible */}
        <aside className="w-52 border-r border-[#1e2540] bg-[#0d1120] flex flex-col overflow-hidden shrink-0">
          <RollCallPanel committee={committee} />
        </aside>

        {/* Center: Session */}
        <main className="flex-1 overflow-y-auto bg-[#0a0e1a]">
          {/* Pre-session welcome */}
          {!inSession && (
            <div className="h-full flex items-center justify-center p-8">
              <div className="text-center max-w-sm">
                <div className="text-4xl mb-4">🌐</div>
                <h2 className="text-2xl font-black text-white mb-2">{committee.name}</h2>
                <p className="text-[#8892aa] text-sm mb-6">{committee.topic}</p>
                <div className="bg-[#0f1526] border border-[#1e2540] rounded-xl p-4 mb-6">
                  <p className="text-xs text-[#4a5580] mb-1">SESSION CODE</p>
                  <p className="text-3xl font-black font-mono text-white tracking-widest">{committee.code}</p>
                </div>
                <p className="text-xs text-[#8892aa]">Mark attendance on the left, then begin the session.</p>
              </div>
            </div>
          )}

          {/* Caucus view */}
          {(committee.phase === 'moderated-caucus' || committee.phase === 'unmoderated-caucus') && committee.caucus && (
            <div className="p-6 max-w-2xl mx-auto">
              <CaucusPanel committee={committee} />
            </div>
          )}

          {/* Voting */}
          {committee.phase === 'voting' && (
            <div className="p-6 max-w-2xl mx-auto">
              <VotingView committee={committee} />
            </div>
          )}

          {/* Speakers list session */}
          {committee.phase === 'speakers-list' && (
            <div className="flex flex-col h-full">
              {/* Current speaker */}
              <div className={`p-5 border-b border-[#1e2540] ${committee.currentSpeaker ? 'bg-[#0d1526]' : 'bg-[#0d1120]'}`}>
                {committee.currentSpeaker ? (
                  <div>
                    <p className="text-xs text-[#4a5580] font-mono mb-3">NOW SPEAKING</p>
                    <div className="flex items-center gap-4 mb-4">
                      <FlagCircle country={committee.currentSpeaker.country} />
                      <div className="flex-1 min-w-0">
                        <p className="text-2xl font-black text-white">{committee.currentSpeaker.country}</p>
                      </div>
                      <div className={`text-4xl font-black font-mono ${committee.speakerTimeRemaining <= 10 ? 'text-red-400' : 'text-white'}`}>
                        {formatTime(committee.speakerTimeRemaining)}
                      </div>
                    </div>
                    <div className="h-2 bg-[#1a1f2e] rounded-full overflow-hidden mb-4">
                      <div
                        className={`h-full rounded-full transition-all ${progress > 50 ? 'bg-blue-500' : progress > 20 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setTimerRunning((r) => !r)}
                        className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors ${timerRunning ? 'bg-yellow-600 hover:bg-yellow-500 text-white' : 'bg-green-600 hover:bg-green-500 text-white'}`}
                      >
                        {timerRunning ? '⏸ Pause' : '▶ Start Timer'}
                      </button>
                      <button
                        onClick={() => { setTimerRunning(false); nextSpeaker(committee.id); }}
                        className="flex-1 bg-[#1e2540] hover:bg-[#2a3050] text-white py-2.5 rounded-xl font-bold text-sm transition-colors"
                      >
                        Next Speaker →
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-[#4a5580] font-mono mb-1">FLOOR</p>
                      <p className="text-[#8892aa] text-sm">No current speaker</p>
                    </div>
                    <button
                      onClick={() => nextSpeaker(committee.id)}
                      disabled={committee.speakersList.length === 0}
                      className="bg-blue-600 hover:bg-blue-500 disabled:bg-[#1e2540] disabled:text-[#3a4060] text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors"
                    >
                      Call Next Speaker
                    </button>
                  </div>
                )}
              </div>

              {/* Speaking time config */}
              <div className="px-5 py-3 border-b border-[#1e2540] flex items-center gap-3">
                <span className="text-xs text-[#4a5580] font-mono shrink-0">SPEAKING TIME</span>
                <input
                  type="number"
                  value={newTimeLimit}
                  onChange={(e) => setNewTimeLimit(e.target.value)}
                  className="w-16 bg-[#141929] border border-[#1e2540] rounded-lg px-2 py-1 text-white text-xs text-center focus:outline-none"
                />
                <span className="text-xs text-[#4a5580]">sec</span>
                <button
                  onClick={() => setSpeakerTimeLimit(committee.id, parseInt(newTimeLimit) || 90)}
                  className="text-xs bg-[#1e2540] hover:bg-[#2a3050] text-white px-3 py-1 rounded-lg transition-colors"
                >
                  Set
                </button>
                <div className="flex gap-1">
                  {[30, 60, 90, 120, 180].map((t) => (
                    <button key={t} onClick={() => { setSpeakerTimeLimit(committee.id, t); setNewTimeLimit(String(t)); }}
                      className={`text-xs px-2 py-1 rounded transition-colors ${committee.speakerTimeLimit === t ? 'bg-blue-700 text-white' : 'bg-[#141929] text-[#8892aa] hover:text-white'}`}>
                      {t}s
                    </button>
                  ))}
                </div>
              </div>

              {/* Speakers queue */}
              <div className="flex-1 overflow-y-auto p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-[#4a5580] font-mono">SPEAKERS LIST — {committee.speakersList.length} queued</p>
                </div>

                {committee.speakersList.length === 0 && (
                  <p className="text-[#4a5580] text-sm text-center py-8">No speakers queued — add from below</p>
                )}

                <div className="space-y-1.5 mb-6">
                  {committee.speakersList.map((s, i) => (
                    <div key={s.delegateId} className="flex items-center gap-3 bg-[#0f1526] border border-[#1e2540] rounded-xl px-3 py-2.5">
                      <span className="text-xs text-[#3a4060] font-mono w-4">{i + 1}</span>
                      <FlagCircle country={s.country} />
                      <span className="flex-1 text-sm text-white font-medium">{s.country}</span>
                      <button onClick={() => removeFromSpeakersList(committee.id, s.delegateId)} className="text-[#3a4060] hover:text-red-400 text-xs transition-colors">✕</button>
                    </div>
                  ))}
                </div>

                {/* Add to list */}
                <p className="text-xs text-[#4a5580] font-mono mb-2">ADD TO LIST</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {presentDelegates
                    .filter((d) => !onList.has(d.id) && committee.currentSpeaker?.delegateId !== d.id)
                    .map((d) => {
                      const found = getCountryByName(d.country);
                      const flag = found ? getFlagEmoji(found.code) : '🌐';
                      return (
                        <button
                          key={d.id}
                          onClick={() => addToSpeakersList(committee.id, d.id)}
                          className="flex items-center gap-2 bg-[#0f1526] hover:bg-[#141929] border border-[#1e2540] hover:border-blue-700/30 rounded-xl px-3 py-2 transition-all text-left"
                        >
                          <span className="text-base">{flag}</span>
                          <span className="text-xs text-[#c0c8d8] truncate">+ {d.country}</span>
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          {committee.phase === 'adjourned' && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl mb-4">🔔</div>
                <h2 className="text-xl font-black text-white mb-4">Session Adjourned</h2>
                <button
                  onClick={() => useCommitteeStore.getState().setPhase(committee.id, 'speakers-list')}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
                >
                  Resume Session
                </button>
              </div>
            </div>
          )}
        </main>

        {/* Right: Motions */}
        <aside className={`border-l border-[#1e2540] bg-[#0d1120] flex flex-col overflow-hidden shrink-0 transition-all ${showMotions ? 'w-72' : 'w-10'}`}>
          <button
            onClick={() => setShowMotions((v) => !v)}
            className="h-10 flex items-center justify-center text-[#4a5580] hover:text-white transition-colors border-b border-[#1e2540] shrink-0"
            title={showMotions ? 'Hide motions' : 'Show motions'}
          >
            {showMotions ? '›' : '‹'}
          </button>
          {showMotions && (
            <div className="flex-1 overflow-y-auto">
              <MotionsPanel committee={committee} />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function VotingView({ committee }: { committee: Committee }) {
  const { updateResolutionStatus, setPhase } = useCommitteeStore();
  const [votes, setVotes] = useState<Record<string, { for: number; against: number; abstain: number }>>({});
  const approved = committee.resolutions.filter((r) => r.status === 'approved');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-white">Voting Procedure</h2>
        <button onClick={() => setPhase(committee.id, 'speakers-list')} className="text-sm text-[#8892aa] hover:text-white border border-[#1e2540] px-3 py-1.5 rounded-lg transition-colors">
          ← Back to Debate
        </button>
      </div>
      {approved.length === 0 ? (
        <div className="text-center py-12 text-[#4a5580]">No approved resolutions to vote on.</div>
      ) : (
        approved.map((res) => {
          const v = votes[res.id] || { for: 0, against: 0, abstain: 0 };
          const done = res.status === 'passed' || res.status === 'failed';
          return (
            <div key={res.id} className="bg-[#0f1526] border border-[#1e2540] rounded-xl p-5">
              <h3 className="font-bold text-white mb-1">{res.title}</h3>
              <p className="text-xs text-[#8892aa] mb-4">Sponsors: {res.sponsors.join(', ')}</p>
              {done ? (
                <div className={`text-center py-4 rounded-xl ${res.status === 'passed' ? 'bg-green-950/40 border border-green-800/40' : 'bg-red-950/40 border border-red-800/40'}`}>
                  <p className={`text-2xl font-black ${res.status === 'passed' ? 'text-green-400' : 'text-red-400'}`}>{res.status === 'passed' ? '✓ PASSED' : '✗ FAILED'}</p>
                  <p className="text-xs text-[#8892aa] mt-1">For: {v.for} · Against: {v.against} · Abstain: {v.abstain}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    {(['for', 'against', 'abstain'] as const).map((f) => (
                      <div key={f}>
                        <label className={`block text-xs font-bold mb-1 ${f === 'for' ? 'text-green-400' : f === 'against' ? 'text-red-400' : 'text-yellow-400'}`}>
                          {f.charAt(0).toUpperCase() + f.slice(1)}
                        </label>
                        <input type="number" min={0} value={v[f]}
                          onChange={(e) => setVotes((prev) => ({ ...prev, [res.id]: { ...v, [f]: parseInt(e.target.value) || 0 } }))}
                          className="w-full bg-[#141929] border border-[#1e2540] rounded-lg px-2 py-2 text-white text-lg font-bold text-center focus:outline-none" />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => updateResolutionStatus(committee.id, res.id, v.for > v.against ? 'passed' : 'failed')}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg font-bold transition-colors"
                  >
                    Finalize Vote
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
