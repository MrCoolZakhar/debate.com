'use client';

import { use, useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useCommitteeStore } from '@/lib/store';
import { Committee } from '@/lib/types';
import RollCallPanel from '@/components/RollCallPanel';
import MotionsPanel from '@/components/MotionsPanel';
import CaucusPanel from '@/components/CaucusPanel';
import { getFlagEmoji, getCountryByName, UN_COUNTRIES } from '@/lib/countries';

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function BigFlag({ country }: { country: string }) {
  const found = getCountryByName(country);
  const flag = found ? getFlagEmoji(found.code) : '🌐';
  return <span className="text-8xl leading-none select-none">{flag}</span>;
}

function SmallFlag({ country }: { country: string }) {
  const found = getCountryByName(country);
  const flag = found ? getFlagEmoji(found.code) : '🌐';
  return (
    <div className="w-9 h-9 rounded-full bg-[#1e2540] flex items-center justify-center text-xl shrink-0">
      {flag}
    </div>
  );
}

// Autocomplete input — pressing Enter adds the top matching country/delegate
function AddSpeakerInput({
  committee,
  onAdd,
}: {
  committee: Committee;
  onAdd: (delegateId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const presentDelegates = committee.delegates.filter((d) => d.status !== 'absent');
  const onList = new Set(committee.speakersList.map((s) => s.delegateId));
  const currentId = committee.currentSpeaker?.delegateId;

  const eligible = presentDelegates.filter(
    (d) => !onList.has(d.id) && d.id !== currentId
  );

  const matches = query.trim()
    ? eligible.filter((d) => d.country.toLowerCase().startsWith(query.toLowerCase()))
        .concat(eligible.filter((d) =>
          !d.country.toLowerCase().startsWith(query.toLowerCase()) &&
          d.country.toLowerCase().includes(query.toLowerCase())
        ))
    : [];

  const topMatch = matches[0] ?? null;

  const commit = (delegate: typeof topMatch) => {
    if (!delegate) return;
    onAdd(delegate.id);
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <div className="flex items-center bg-[#0f1526] border border-[#1e2540] focus-within:border-blue-600 rounded-xl overflow-hidden transition-colors">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(topMatch); }
            if (e.key === 'Escape') setQuery('');
          }}
          placeholder="Add to speakers list..."
          className="flex-1 bg-transparent px-4 py-3 text-white placeholder-[#4a5580] focus:outline-none text-sm"
        />
        {topMatch && query && (
          <span className="text-xs text-[#4a5580] px-3 truncate max-w-[140px]">
            ↵ {topMatch.country}
          </span>
        )}
      </div>

      {/* Dropdown suggestions */}
      {query && matches.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#0f1526] border border-[#1e2540] rounded-xl overflow-hidden z-20 shadow-xl">
          {matches.slice(0, 6).map((d, i) => {
            const found = getCountryByName(d.country);
            const flag = found ? getFlagEmoji(found.code) : '🌐';
            return (
              <button
                key={d.id}
                onMouseDown={(e) => { e.preventDefault(); commit(d); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === 0 ? 'bg-blue-900/30 text-white' : 'text-[#c0c8d8] hover:bg-[#1e2540]'}`}
              >
                <span className="text-lg">{flag}</span>
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

export default function ChairSession({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { committees, nextSpeaker, addToSpeakersList, removeFromSpeakersList, setSpeakerTimeLimit, tickSpeakerTimer } = useCommitteeStore();
  const [committee, setCommittee] = useState<Committee | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
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
  const progress = committee.currentSpeaker
    ? (committee.speakerTimeRemaining / committee.speakerTimeLimit) * 100
    : 100;
  const inSession = committee.phase !== 'pre-session' && committee.phase !== 'roll-call';

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col">
      {/* Slim header */}
      <header className="border-b border-[#1e2540] bg-[#0d1120] px-4 h-11 flex items-center gap-3 shrink-0">
        <Link href="/">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">M</div>
        </Link>
        <span className="font-bold text-white text-sm truncate">{committee.name}</span>
        <span className="text-[#4a5580] text-xs hidden sm:block truncate flex-1">{committee.topic}</span>
        <span className="text-xs text-[#8892aa] shrink-0">{present}/{committee.delegates.length}</span>
        <button
          onClick={() => { navigator.clipboard.writeText(committee.code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="text-xs font-mono bg-[#1e2540] hover:bg-[#2a3050] text-white px-2.5 py-1 rounded-lg transition-colors shrink-0"
        >
          {copied ? '✓ Copied' : committee.code}
        </button>
        <button
          onClick={() => setShowMotions((v) => !v)}
          className={`text-xs px-3 py-1 rounded-lg transition-colors shrink-0 ${showMotions ? 'bg-blue-700 text-white' : 'bg-[#1e2540] text-[#8892aa] hover:text-white'}`}
        >
          Motions
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden" style={{ height: 'calc(100vh - 44px)' }}>

        {/* Left: Roll Call */}
        <aside className="w-48 border-r border-[#1e2540] bg-[#0d1120] flex flex-col overflow-hidden shrink-0">
          <RollCallPanel committee={committee} />
        </aside>

        {/* Center */}
        <main className="flex-1 overflow-y-auto flex flex-col">

          {/* Pre-session */}
          {!inSession && (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center max-w-sm">
                <div className="text-5xl mb-4">🌐</div>
                <h2 className="text-2xl font-black text-white mb-2">{committee.name}</h2>
                <p className="text-[#8892aa] text-sm mb-6">{committee.topic}</p>
                <div className="bg-[#0f1526] border border-[#1e2540] rounded-xl p-4 mb-4">
                  <p className="text-xs text-[#4a5580] mb-1">SESSION CODE</p>
                  <p className="text-3xl font-black font-mono text-white tracking-widest">{committee.code}</p>
                </div>
                <p className="text-xs text-[#4a5580]">Mark attendance on the left, then begin.</p>
              </div>
            </div>
          )}

          {/* Caucus */}
          {(committee.phase === 'moderated-caucus' || committee.phase === 'unmoderated-caucus') && committee.caucus && (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="w-full max-w-lg">
                <CaucusPanel committee={committee} />
              </div>
            </div>
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
                <button
                  onClick={() => useCommitteeStore.getState().setPhase(committee.id, 'speakers-list')}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold transition-colors"
                >
                  Resume Session
                </button>
              </div>
            </div>
          )}

          {/* Main speakers list view */}
          {committee.phase === 'speakers-list' && (
            <div className="flex-1 flex flex-col">

              {/* ── BIG CURRENT SPEAKER ── */}
              <div className="flex-1 flex flex-col items-center justify-center px-8 py-10 min-h-0">
                {committee.currentSpeaker ? (
                  <>
                    <BigFlag country={committee.currentSpeaker.country} />
                    <h1 className="text-5xl font-black text-white mt-5 mb-2 text-center">
                      {committee.currentSpeaker.country}
                    </h1>

                    {/* Timer */}
                    <div className={`text-8xl font-black font-mono mt-4 mb-6 tabular-nums ${
                      committee.speakerTimeRemaining <= 10 ? 'text-red-400' :
                      committee.speakerTimeRemaining <= 30 ? 'text-yellow-400' : 'text-white'
                    }`}>
                      {formatTime(committee.speakerTimeRemaining)}
                    </div>

                    {/* Progress bar */}
                    <div className="w-full max-w-md h-2 bg-[#1a1f2e] rounded-full overflow-hidden mb-8">
                      <div
                        className={`h-full rounded-full transition-all ${
                          progress > 50 ? 'bg-blue-500' : progress > 20 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>

                    {/* Controls */}
                    <div className="flex gap-3 w-full max-w-sm">
                      <button
                        onClick={() => setTimerRunning((r) => !r)}
                        className={`flex-1 py-3 rounded-xl font-bold text-base transition-colors ${
                          timerRunning
                            ? 'bg-yellow-600 hover:bg-yellow-500 text-white'
                            : 'bg-green-600 hover:bg-green-500 text-white'
                        }`}
                      >
                        {timerRunning ? '⏸ Pause' : '▶ Start'}
                      </button>
                      <button
                        onClick={() => { setTimerRunning(false); nextSpeaker(committee.id); }}
                        className="flex-1 bg-[#1e2540] hover:bg-[#2a3050] text-white py-3 rounded-xl font-bold text-base transition-colors"
                      >
                        Next →
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-7xl mb-6">🎙️</div>
                    <h2 className="text-3xl font-black text-white mb-2">No Current Speaker</h2>
                    <p className="text-[#8892aa] mb-8">Add delegates to the list below</p>
                    <button
                      onClick={() => nextSpeaker(committee.id)}
                      disabled={committee.speakersList.length === 0}
                      className="bg-blue-600 hover:bg-blue-500 disabled:bg-[#1e2540] disabled:text-[#3a4060] text-white px-10 py-4 rounded-xl font-bold text-lg transition-colors"
                    >
                      Call First Speaker
                    </button>
                  </>
                )}
              </div>

              {/* ── NEXT UP ── */}
              <div className="border-t border-[#1e2540] bg-[#0d1120] px-6 py-4">
                {/* Time limit row */}
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs text-[#4a5580] font-mono shrink-0">TIME LIMIT</span>
                  <div className="flex gap-1.5">
                    {[30, 60, 90, 120, 180].map((t) => (
                      <button
                        key={t}
                        onClick={() => setSpeakerTimeLimit(committee.id, t)}
                        className={`text-xs px-2.5 py-1 rounded-lg transition-colors font-medium ${
                          committee.speakerTimeLimit === t
                            ? 'bg-blue-700 text-white'
                            : 'bg-[#1e2540] text-[#8892aa] hover:text-white'
                        }`}
                      >
                        {t}s
                      </button>
                    ))}
                    <input
                      type="number"
                      defaultValue={committee.speakerTimeLimit}
                      onBlur={(e) => setSpeakerTimeLimit(committee.id, parseInt(e.target.value) || 90)}
                      className="w-14 bg-[#1e2540] border border-[#2a3050] rounded-lg px-2 py-1 text-white text-xs text-center focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={() => { setTimerRunning(false); nextSpeaker(committee.id); }}
                    disabled={committee.speakersList.length === 0}
                    className="ml-auto text-xs bg-[#1e2540] hover:bg-[#2a3050] disabled:text-[#3a4060] text-white px-4 py-1.5 rounded-lg transition-colors"
                  >
                    Next Speaker →
                  </button>
                </div>

                {/* Next speakers row */}
                {committee.speakersList.length > 0 && (
                  <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
                    <span className="text-xs text-[#4a5580] font-mono shrink-0">NEXT UP</span>
                    {committee.speakersList.map((s, i) => (
                      <div key={s.delegateId} className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs text-[#4a5580] font-mono">{i + 1}</span>
                        <div className="relative group">
                          <SmallFlag country={s.country} />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-[#1e2540] text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            {s.country}
                          </div>
                          <button
                            onClick={() => removeFromSpeakersList(committee.id, s.delegateId)}
                            className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-600 rounded-full text-white text-xs items-center justify-center hidden group-hover:flex"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add speaker autocomplete */}
                <AddSpeakerInput
                  committee={committee}
                  onAdd={(id) => addToSpeakersList(committee.id, id)}
                />
              </div>
            </div>
          )}
        </main>

        {/* Right: Motions panel (slide in) */}
        {showMotions && (
          <aside className="w-72 border-l border-[#1e2540] bg-[#0d1120] flex flex-col overflow-hidden shrink-0">
            <MotionsPanel committee={committee} />
          </aside>
        )}
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
        <button onClick={() => setPhase(committee.id, 'speakers-list')} className="text-sm text-[#8892aa] hover:text-white border border-[#1e2540] px-3 py-1.5 rounded-lg transition-colors">
          ← Back
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
                        <label className={`block text-xs font-bold mb-1 ${f === 'for' ? 'text-green-400' : f === 'against' ? 'text-red-400' : 'text-yellow-400'}`}>
                          {f.charAt(0).toUpperCase() + f.slice(1)}
                        </label>
                        <input type="number" min={0} value={v[f]}
                          onChange={(e) => setVotes((prev) => ({ ...prev, [res.id]: { ...v, [f]: parseInt(e.target.value) || 0 } }))}
                          className="w-full bg-[#141929] border border-[#1e2540] rounded-lg px-2 py-2 text-white text-xl font-bold text-center focus:outline-none" />
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
