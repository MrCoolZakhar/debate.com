'use client';

import { use, useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useCommitteeStore } from '@/lib/store';
import { Committee } from '@/lib/types';
import RollCallPanel, { FlagCircle } from '@/components/RollCallPanel';
import MotionsModal from '@/components/MotionsModal';
import { getFlagEmoji, getCountryByName } from '@/lib/countries';

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function AddSpeakerInput({ committee, onAdd }: { committee: Committee; onAdd: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const onList = new Set(committee.speakersList.map((s) => s.delegateId));
  const eligible = committee.delegates.filter(
    (d) => d.status !== 'absent' && !onList.has(d.id) && d.id !== committee.currentSpeaker?.delegateId
  );
  const matches = query.trim()
    ? eligible
        .filter((d) => d.country.toLowerCase().startsWith(query.toLowerCase()))
        .concat(eligible.filter((d) => !d.country.toLowerCase().startsWith(query.toLowerCase()) && d.country.toLowerCase().includes(query.toLowerCase())))
    : [];
  const top = matches[0] ?? null;
  const commit = (d: typeof top) => { if (!d) return; onAdd(d.id); setQuery(''); inputRef.current?.focus(); };
  return (
    <div className="relative">
      <div className="flex items-center bg-[#0f1526] border border-[#1e2540] focus-within:border-blue-600 rounded-xl overflow-hidden transition-colors">
        <input ref={inputRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(top); } if (e.key === 'Escape') setQuery(''); }}
          placeholder="Add to speakers list..." autoFocus
          className="flex-1 bg-transparent px-4 py-3 text-white placeholder-[#4a5580] focus:outline-none text-sm" />
        {top && query && <span className="text-xs text-[#4a5580] px-3 truncate max-w-[140px]">↵ {top.country}</span>}
      </div>
      {query && matches.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#0f1526] border border-[#1e2540] rounded-xl overflow-hidden z-20 shadow-xl">
          {matches.slice(0, 6).map((d, i) => {
            const found = getCountryByName(d.country);
            return (
              <button key={d.id} onMouseDown={(e) => { e.preventDefault(); commit(d); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === 0 ? 'bg-blue-900/30 text-white' : 'text-[#c0c8d8] hover:bg-[#1e2540]'}`}>
                <span className="text-lg">{found ? getFlagEmoji(found.code) : '🌐'}</span>
                <span className="text-sm">{d.country}</span>
                {i === 0 && <span className="ml-auto text-xs text-[#4a5580]">Enter ↵</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Full-screen moderated caucus view ──
function ModeratedCaucusView({ committee }: { committee: Committee }) {
  const { tickCaucus, endCaucus, nextCaucusSpeaker } = useCommitteeStore();
  const [running, setRunning] = useState(true);
  const [speakerQuery, setSpeakerQuery] = useState('');
  const speakerInputRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const caucus = committee.caucus!;

  useEffect(() => {
    if (running && caucus.remainingTime > 0) {
      intervalRef.current = setInterval(() => tickCaucus(committee.id), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, caucus.remainingTime, committee.id, tickCaucus]);

  const presentDelegates = committee.delegates.filter((d) => d.status !== 'absent');
  const speakerMatches = speakerQuery.trim()
    ? presentDelegates.filter((d) => d.country.toLowerCase().startsWith(speakerQuery.toLowerCase()))
        .concat(presentDelegates.filter((d) => !d.country.toLowerCase().startsWith(speakerQuery.toLowerCase()) && d.country.toLowerCase().includes(speakerQuery.toLowerCase())))
    : [];
  const topSpeaker = speakerMatches[0] ?? null;
  const callSpeaker = (country: string) => { nextCaucusSpeaker(committee.id, country); setSpeakerQuery(''); speakerInputRef.current?.focus(); };

  const totalProgress = caucus.totalTime > 0 ? (caucus.remainingTime / caucus.totalTime) * 100 : 0;
  const speakerProgress = caucus.speakingTime > 0 ? (caucus.speakerTimeRemaining / caucus.speakingTime) * 100 : 0;

  return (
    <div className="flex-1 overflow-y-auto flex flex-col items-center justify-between px-8 py-8 min-h-0">
      {/* Top: purpose + total time */}
      <div className="w-full text-center mb-4">
        <p className="text-xs text-blue-400 font-mono mb-1">MODERATED CAUCUS</p>
        {caucus.purpose && <p className="text-[#8892aa] text-base">{caucus.purpose}</p>}
      </div>

      {/* Current caucus speaker */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {caucus.currentSpeaker ? (
          <>
            <FlagCircle country={caucus.currentSpeaker} size="xl" />
            <h1 className="text-5xl font-black text-white mt-4 mb-2">{caucus.currentSpeaker}</h1>
            <div className={`text-7xl font-black font-mono mt-3 mb-4 tabular-nums ${
              caucus.speakerTimeRemaining <= 5 ? 'text-red-400' : caucus.speakerTimeRemaining <= 15 ? 'text-yellow-400' : 'text-white'
            }`}>
              {formatTime(caucus.speakerTimeRemaining)}
            </div>
            <div className="w-full max-w-sm h-2 bg-[#1a1f2e] rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${speakerProgress > 50 ? 'bg-blue-500' : speakerProgress > 20 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${speakerProgress}%` }} />
            </div>
          </>
        ) : (
          <>
            <div className="text-6xl mb-4">🎙️</div>
            <p className="text-2xl font-black text-white mb-2">Call a Speaker</p>
            <p className="text-[#8892aa] text-sm">Type a country name below</p>
          </>
        )}
      </div>

      {/* Bottom controls */}
      <div className="w-full max-w-md space-y-4">
        {/* Total time */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[#4a5580] font-mono">TOTAL REMAINING</p>
            <p className={`text-2xl font-black font-mono ${caucus.remainingTime <= 30 ? 'text-red-400' : 'text-white'}`}>
              {formatTime(caucus.remainingTime)}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setRunning((r) => !r)}
              className={`px-5 py-2 rounded-xl font-bold text-sm transition-colors ${running ? 'bg-yellow-600 hover:bg-yellow-500 text-white' : 'bg-green-600 hover:bg-green-500 text-white'}`}>
              {running ? '⏸ Pause' : '▶ Resume'}
            </button>
            <button onClick={() => endCaucus(committee.id)}
              className="px-5 py-2 rounded-xl font-bold text-sm bg-[#1e2540] hover:bg-red-900/40 hover:text-red-400 text-[#8892aa] transition-colors border border-transparent hover:border-red-800/30">
              End
            </button>
          </div>
        </div>

        <div className="h-1.5 bg-[#1a1f2e] rounded-full overflow-hidden">
          <div className="h-full bg-blue-600/60 rounded-full transition-all" style={{ width: `${totalProgress}%` }} />
        </div>

        {/* Call next speaker */}
        <div className="relative">
          <div className="flex items-center bg-[#0f1526] border border-[#1e2540] focus-within:border-blue-600 rounded-xl overflow-hidden transition-colors">
            <input ref={speakerInputRef} type="text" value={speakerQuery} onChange={(e) => setSpeakerQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && topSpeaker) { e.preventDefault(); callSpeaker(topSpeaker.country); } if (e.key === 'Escape') setSpeakerQuery(''); }}
              placeholder="Call next speaker..." autoFocus
              className="flex-1 bg-transparent px-4 py-3 text-white placeholder-[#4a5580] focus:outline-none text-sm" />
            {topSpeaker && speakerQuery && <span className="text-xs text-[#4a5580] px-3 truncate max-w-[140px]">↵ {topSpeaker.country}</span>}
          </div>
          {speakerQuery && speakerMatches.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#0f1526] border border-[#1e2540] rounded-xl overflow-hidden z-20 shadow-xl">
              {speakerMatches.slice(0, 5).map((d, i) => {
                const found = getCountryByName(d.country);
                return (
                  <button key={d.id} onMouseDown={(e) => { e.preventDefault(); callSpeaker(d.country); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === 0 ? 'bg-blue-900/30 text-white' : 'text-[#c0c8d8] hover:bg-[#1e2540]'}`}>
                    <span className="text-lg">{found ? getFlagEmoji(found.code) : '🌐'}</span>
                    <span className="text-sm">{d.country}</span>
                    {i === 0 && <span className="ml-auto text-xs text-[#4a5580]">Enter ↵</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ChairSession({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { committees, nextSpeaker, addToSpeakersList, removeFromSpeakersList, setSpeakerTimeLimit, tickSpeakerTimer } = useCommitteeStore();
  const [committee, setCommittee] = useState<Committee | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [showRollCall, setShowRollCall] = useState(false);
  const [showMotions, setShowMotions] = useState(false);
  const [copied, setCopied] = useState(false);
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
  const progress = committee.currentSpeaker ? (committee.speakerTimeRemaining / committee.speakerTimeLimit) * 100 : 100;

  return (
    <div className="h-screen bg-[#0a0e1a] flex flex-col overflow-hidden">
      {/* Slim header */}
      <header className="border-b border-[#1e2540] bg-[#0d1120] px-4 h-11 flex items-center gap-3 shrink-0">
        <Link href="/">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">M</div>
        </Link>
        <span className="font-bold text-white text-sm truncate">{committee.name}</span>
        <span className="text-[#4a5580] text-xs hidden sm:block truncate flex-1">{committee.topic}</span>
        <button
          onClick={() => setShowRollCall((v) => !v)}
          className={`text-xs px-3 py-1 rounded-lg transition-colors shrink-0 ${showRollCall ? 'bg-green-800/50 text-green-300' : 'bg-[#1e2540] text-[#8892aa] hover:text-white'}`}
        >
          Roll Call {present}/{committee.delegates.length}
        </button>
        <button
          onClick={() => setShowMotions((v) => !v)}
          className={`text-xs px-3 py-1 rounded-lg transition-colors shrink-0 relative ${showMotions ? 'bg-blue-700 text-white' : 'bg-[#1e2540] text-[#8892aa] hover:text-white'}`}
        >
          Motions
          {(committee.pendingMotions ?? []).length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full text-white text-[10px] flex items-center justify-center font-bold">
              {committee.pendingMotions.length}
            </span>
          )}
        </button>
        <button
          onClick={() => { navigator.clipboard.writeText(committee.code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="text-xs font-mono bg-[#1e2540] hover:bg-[#2a3050] text-white px-2.5 py-1 rounded-lg transition-colors shrink-0"
        >
          {copied ? '✓' : committee.code}
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden" style={{ height: 'calc(100vh - 44px)' }}>

        {/* Roll Call (collapsible, hidden by default) */}
        {showRollCall && (
          <aside className="w-64 border-r border-[#1e2540] bg-[#0d1120] flex flex-col overflow-hidden shrink-0">
            <RollCallPanel committee={committee} />
          </aside>
        )}

        {/* Center */}
        <main className="flex-1 overflow-hidden flex flex-col">

          {/* Moderated caucus — full screen */}
          {committee.phase === 'moderated-caucus' && committee.caucus && (
            <ModeratedCaucusView committee={committee} />
          )}

          {/* Unmoderated caucus */}
          {committee.phase === 'unmoderated-caucus' && committee.caucus && (
            <UnmoderatedCaucusView committee={committee} />
          )}

          {/* Voting */}
          {committee.phase === 'voting' && (
            <div className="flex-1 p-8 max-w-2xl mx-auto w-full">
              <VotingView committee={committee} />
            </div>
          )}

          {/* Adjourned */}
          {committee.phase === 'adjourned' && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="text-5xl mb-4">🔔</div>
                <h2 className="text-2xl font-black text-white mb-6">Session Adjourned</h2>
                <button onClick={() => useCommitteeStore.getState().setPhase(committee.id, 'speakers-list')}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold transition-colors">
                  Resume Session
                </button>
              </div>
            </div>
          )}

          {/* Speakers list */}
          {committee.phase === 'speakers-list' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Big current speaker */}
              <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-8 py-10 min-h-0">
                {committee.currentSpeaker ? (
                  <>
                    {/* Next up — flags above timer, up to 15, scrollable */}
                    {committee.speakersList.length > 0 && (
                      <div className="flex items-end gap-4 mb-8 overflow-x-auto pb-1 max-w-full">
                        {committee.speakersList.slice(0, 15).map((s, i) => (
                          <div key={s.delegateId} className="flex flex-col items-center gap-2 relative group shrink-0">
                            <FlagCircle country={s.country} size="lg" />
                            <span className="text-xs text-[#8892aa] text-center w-20 truncate">{s.country}</span>
                            <button
                              onClick={() => removeFromSpeakersList(committee.id, s.delegateId)}
                              className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full text-white text-xs items-center justify-center hidden group-hover:flex leading-none"
                            >✕</button>
                          </div>
                        ))}
                        {committee.speakersList.length > 15 && (
                          <div className="flex flex-col items-center gap-2 shrink-0">
                            <div className="w-20 h-20 rounded-full bg-[#1a2035] flex items-center justify-center">
                              <span className="text-lg font-bold text-[#8892aa]">+{committee.speakersList.length - 15}</span>
                            </div>
                            <span className="text-xs text-[#4a5580]">more</span>
                          </div>
                        )}
                      </div>
                    )}

                    <FlagCircle country={committee.currentSpeaker.country} size="xl" />
                    <h1 className="text-5xl font-black text-white mt-5 mb-2 text-center">{committee.currentSpeaker.country}</h1>
                    <div className={`text-8xl font-black font-mono mt-4 mb-6 tabular-nums ${
                      committee.speakerTimeRemaining <= 10 ? 'text-red-400' : committee.speakerTimeRemaining <= 30 ? 'text-yellow-400' : 'text-white'
                    }`}>
                      {formatTime(committee.speakerTimeRemaining)}
                    </div>
                    <div className="w-full max-w-md h-2 bg-[#1a1f2e] rounded-full overflow-hidden mb-8">
                      <div className={`h-full rounded-full transition-all ${progress > 50 ? 'bg-blue-500' : progress > 20 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${progress}%` }} />
                    </div>
                    <div className="flex gap-3 w-full max-w-sm">
                      <button onClick={() => setTimerRunning((r) => !r)}
                        className={`flex-1 py-3 rounded-xl font-bold text-base transition-colors ${timerRunning ? 'bg-yellow-600 hover:bg-yellow-500 text-white' : 'bg-green-600 hover:bg-green-500 text-white'}`}>
                        {timerRunning ? '⏸ Pause' : '▶ Start'}
                      </button>
                      <button onClick={() => { setTimerRunning(false); nextSpeaker(committee.id); }}
                        className="flex-1 bg-[#1e2540] hover:bg-[#2a3050] text-white py-3 rounded-xl font-bold text-base transition-colors">
                        Next →
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Next up — flags above no-speaker state */}
                    {committee.speakersList.length > 0 && (
                      <div className="flex items-end gap-5 mb-10">
                        {committee.speakersList.slice(0, 4).map((s, i) => (
                          <div key={s.delegateId} className="flex flex-col items-center gap-2 relative group">
                            <FlagCircle country={s.country} size="lg" />
                            <span className="text-xs text-[#8892aa] text-center max-w-[80px] truncate">{s.country}</span>
                            <button
                              onClick={() => removeFromSpeakersList(committee.id, s.delegateId)}
                              className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full text-white text-xs items-center justify-center hidden group-hover:flex leading-none"
                            >✕</button>
                          </div>
                        ))}
                        {committee.speakersList.length > 4 && (
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-20 h-20 rounded-full bg-[#1a2035] flex items-center justify-center">
                              <span className="text-lg font-bold text-[#8892aa]">+{committee.speakersList.length - 4}</span>
                            </div>
                            <span className="text-xs text-[#4a5580]">more</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="text-7xl mb-6">🎙️</div>
                    <h2 className="text-3xl font-black text-white mb-2">No Current Speaker</h2>
                    <p className="text-[#8892aa] mb-8 text-center">Add delegates below, then call the first speaker</p>
                    <button onClick={() => nextSpeaker(committee.id)} disabled={committee.speakersList.length === 0}
                      className="bg-blue-600 hover:bg-blue-500 disabled:bg-[#1e2540] disabled:text-[#3a4060] text-white px-10 py-4 rounded-xl font-bold text-lg transition-colors">
                      Call First Speaker
                    </button>
                  </>
                )}
              </div>

              {/* Bottom bar */}
              <div className="border-t border-[#1e2540] bg-[#0d1120] px-6 py-4">
                {/* Time presets */}
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs text-[#4a5580] font-mono shrink-0">TIME</span>
                  <div className="flex gap-1.5">
                    {[30, 60, 90, 120, 180].map((t) => (
                      <button key={t} onClick={() => setSpeakerTimeLimit(committee.id, t)}
                        className={`text-xs px-2.5 py-1 rounded-lg transition-colors font-medium ${committee.speakerTimeLimit === t ? 'bg-blue-700 text-white' : 'bg-[#1e2540] text-[#8892aa] hover:text-white'}`}>
                        {t}s
                      </button>
                    ))}
                    <input type="number" defaultValue={committee.speakerTimeLimit}
                      onBlur={(e) => setSpeakerTimeLimit(committee.id, parseInt(e.target.value) || 90)}
                      className="w-14 bg-[#1e2540] border border-[#2a3050] rounded-lg px-2 py-1 text-white text-xs text-center focus:outline-none" />
                  </div>
                </div>

                <AddSpeakerInput committee={committee} onAdd={(id) => addToSpeakersList(committee.id, id)} />
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Motions modal overlay */}
      {showMotions && (
        <MotionsModal committee={committee} onClose={() => setShowMotions(false)} />
      )}
    </div>
  );
}

function UnmoderatedCaucusView({ committee }: { committee: Committee }) {
  const { tickCaucus, endCaucus } = useCommitteeStore();
  const [running, setRunning] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const caucus = committee.caucus!;

  useEffect(() => {
    if (running && caucus.remainingTime > 0) {
      intervalRef.current = setInterval(() => tickCaucus(committee.id), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, caucus.remainingTime, committee.id, tickCaucus]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 py-12">
      <p className="text-xs text-purple-400 font-mono mb-4">UNMODERATED CAUCUS</p>
      {caucus.purpose && <p className="text-[#8892aa] mb-6">{caucus.purpose}</p>}
      <div className={`text-9xl font-black font-mono tabular-nums mb-8 ${caucus.remainingTime <= 30 ? 'text-red-400' : 'text-white'}`}>
        {formatTime(caucus.remainingTime)}
      </div>
      <div className="w-full max-w-sm h-2 bg-[#1a1f2e] rounded-full overflow-hidden mb-8">
        <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${(caucus.remainingTime / caucus.totalTime) * 100}%` }} />
      </div>
      <div className="flex gap-3">
        <button onClick={() => setRunning((r) => !r)}
          className={`px-8 py-3 rounded-xl font-bold transition-colors ${running ? 'bg-yellow-600 hover:bg-yellow-500 text-white' : 'bg-green-600 hover:bg-green-500 text-white'}`}>
          {running ? '⏸ Pause' : '▶ Resume'}
        </button>
        <button onClick={() => endCaucus(committee.id)}
          className="px-8 py-3 rounded-xl font-bold bg-[#1e2540] hover:bg-red-900/40 hover:text-red-400 text-[#8892aa] transition-colors border border-transparent hover:border-red-800/30">
          End Caucus
        </button>
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
        <h2 className="text-2xl font-black text-white">Voting Procedure</h2>
        <button onClick={() => setPhase(committee.id, 'speakers-list')} className="text-sm text-[#8892aa] hover:text-white border border-[#1e2540] px-3 py-1.5 rounded-lg transition-colors">← Back</button>
      </div>
      {approved.length === 0 ? (
        <div className="text-center py-12 text-[#4a5580]">No approved resolutions to vote on.</div>
      ) : approved.map((res) => {
        const v = votes[res.id] || { for: 0, against: 0, abstain: 0 };
        const done = res.status === 'passed' || res.status === 'failed';
        return (
          <div key={res.id} className="bg-[#0f1526] border border-[#1e2540] rounded-xl p-5">
            <h3 className="font-bold text-white mb-4">{res.title}</h3>
            {done ? (
              <div className={`text-center py-4 rounded-xl ${res.status === 'passed' ? 'bg-green-950/40 border border-green-800/40' : 'bg-red-950/40 border border-red-800/40'}`}>
                <p className={`text-2xl font-black ${res.status === 'passed' ? 'text-green-400' : 'text-red-400'}`}>{res.status === 'passed' ? '✓ PASSED' : '✗ FAILED'}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  {(['for', 'against', 'abstain'] as const).map((f) => (
                    <div key={f}>
                      <label className={`block text-xs font-bold mb-1 ${f === 'for' ? 'text-green-400' : f === 'against' ? 'text-red-400' : 'text-yellow-400'}`}>{f.charAt(0).toUpperCase() + f.slice(1)}</label>
                      <input type="number" min={0} value={v[f]}
                        onChange={(e) => setVotes((p) => ({ ...p, [res.id]: { ...v, [f]: parseInt(e.target.value) || 0 } }))}
                        className="w-full bg-[#141929] border border-[#1e2540] rounded-lg px-2 py-2 text-white text-xl font-bold text-center focus:outline-none" />
                    </div>
                  ))}
                </div>
                <button onClick={() => updateResolutionStatus(committee.id, res.id, v.for > v.against ? 'passed' : 'failed')}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg font-bold transition-colors">Finalize Vote</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
