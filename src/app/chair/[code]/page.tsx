'use client';

import { use, useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useCommitteeStore } from '@/lib/store';
import { Committee } from '@/lib/types';
import RollCallPanel, { FlagCircle } from '@/components/RollCallPanel';
import MotionsModal from '@/components/MotionsModal';
import { getFlagEmoji, getCountryByName } from '@/lib/countries';

function MiniPie({ fraction, color }: { fraction: number; color: string }) {
  const r = 8; const c = 2 * Math.PI * r;
  return (
    <svg width="20" height="20" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r={r} fill="none" stroke="#2a1a0a" strokeWidth="3"/>
      <circle cx="10" cy="10" r={r} fill="none" stroke={color} strokeWidth="3"
        strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(fraction, 1))}
        transform="rotate(-90 10 10)" style={{transition:'stroke-dashoffset 0.3s'}}/>
    </svg>
  );
}

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
      <div className="flex items-center bg-[#150F09] border border-[#2E1E0F] focus-within:border-[#7B4A1E] rounded-xl overflow-hidden transition-colors">
        <input ref={inputRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(top); } if (e.key === 'Escape') setQuery(''); }}
          placeholder="Add to speakers list..." autoFocus
          className="flex-1 bg-transparent px-4 py-3 text-white placeholder-[#7A5A38] focus:outline-none text-sm" />
        {top && query && <span className="text-xs text-[#7A5A38] px-3 truncate max-w-[140px]">↵ {top.country}</span>}
      </div>
      {query && matches.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#150F09] border border-[#2E1E0F] rounded-xl overflow-hidden z-20 shadow-xl">
          {matches.slice(0, 6).map((d, i) => {
            const found = getCountryByName(d.country);
            return (
              <button key={d.id} onMouseDown={(e) => { e.preventDefault(); commit(d); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === 0 ? 'bg-[#7B4A1E]/20 text-white' : 'text-[#E8D5B7] hover:bg-[#2E1E0F]'}`}>
                <span className="text-lg">{found ? getFlagEmoji(found.code) : '🌐'}</span>
                <span className="text-sm">{d.country}</span>
                {i === 0 && <span className="ml-auto text-xs text-[#7A5A38]">Enter ↵</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Next-up speaker flags row (shared between with/without current speaker) ──
function CaucusSpeakerQueue({
  committee,
  spokenCountries,
}: {
  committee: Committee;
  spokenCountries: string[];
}) {
  const { removeFromSpeakersList } = useCommitteeStore();
  if (committee.speakersList.length === 0) return null;
  return (
    <div className="flex items-start gap-3 overflow-x-auto pt-1 pb-1 max-w-full">
      {committee.speakersList.slice(0, 15).map((s) => {
        const alreadySpoke = spokenCountries.includes(s.country);
        return (
          <div key={s.delegateId} className="flex flex-col items-center gap-1 relative group shrink-0">
            <div className="relative">
              <FlagCircle country={s.country} size="sm" />
              {alreadySpoke && (
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                  <span className="text-[9px] font-bold text-yellow-300">✓</span>
                </div>
              )}
            </div>
            <span className={`text-[10px] text-center w-12 truncate ${alreadySpoke ? 'text-yellow-400' : 'text-[#C4A882]'}`}>
              {s.country}
            </span>
            <button onClick={() => removeFromSpeakersList(committee.id, s.delegateId)}
              className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full text-white text-xs items-center justify-center hidden group-hover:flex leading-none">✕</button>
          </div>
        );
      })}
      {committee.speakersList.length > 15 && (
        <div className="flex flex-col items-center gap-1 shrink-0">
          <div className="w-10 h-10 rounded-full bg-[#2E1E0F] flex items-center justify-center">
            <span className="text-xs font-bold text-[#C4A882]">+{committee.speakersList.length - 15}</span>
          </div>
          <span className="text-[10px] text-[#7A5A38]">more</span>
        </div>
      )}
    </div>
  );
}

// ── Add speaker input with "already spoke" hint ──
function CaucusAddSpeakerInput({ committee, spokenCountries, onAdd }: { committee: Committee; spokenCountries: string[]; onAdd: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const onList = new Set(committee.speakersList.map((s) => s.delegateId));
  const eligible = committee.delegates.filter((d) => d.status !== 'absent' && !onList.has(d.id));
  const matches = query.trim()
    ? eligible.filter((d) => d.country.toLowerCase().startsWith(query.toLowerCase()))
        .concat(eligible.filter((d) => !d.country.toLowerCase().startsWith(query.toLowerCase()) && d.country.toLowerCase().includes(query.toLowerCase())))
    : [];
  const top = matches[0] ?? null;
  const commit = (d: typeof top) => { if (!d) return; onAdd(d.id); setQuery(''); inputRef.current?.focus(); };
  return (
    <div className="relative">
      <div className="flex items-center bg-[#150F09] border border-[#2E1E0F] focus-within:border-[#7B4A1E] rounded-xl overflow-hidden transition-colors">
        <input ref={inputRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(top); } if (e.key === 'Escape') setQuery(''); }}
          placeholder="Add to speakers list…"
          className="flex-1 bg-transparent px-4 py-3 text-white placeholder-[#7A5A38] focus:outline-none text-sm" />
        {top && query && <span className="text-xs text-[#7A5A38] px-3 truncate max-w-[140px]">↵ {top.country}</span>}
      </div>
      {query && matches.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#150F09] border border-[#2E1E0F] rounded-xl overflow-hidden z-20 shadow-xl">
          {matches.slice(0, 6).map((d, i) => {
            const found = getCountryByName(d.country);
            const spoke = spokenCountries.includes(d.country);
            return (
              <button key={d.id} onMouseDown={(e) => { e.preventDefault(); commit(d); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === 0 ? 'bg-[#7B4A1E]/20 text-white' : 'text-[#E8D5B7] hover:bg-[#2E1E0F]'}`}>
                <span className="text-lg">{found ? getFlagEmoji(found.code) : '🌐'}</span>
                <span className="text-sm flex-1">{d.country}</span>
                {spoke && <span className="text-[10px] text-yellow-500 shrink-0">already spoke</span>}
                {i === 0 && !spoke && <span className="text-xs text-[#7A5A38] shrink-0">Enter ↵</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Moderated caucus — mirrors speakers-list structure ──
function ModeratedCaucusView({ committee }: { committee: Committee }) {
  const { tickCaucusBoth, advanceCaucusSpeaker, setProposerPosition, endCaucus, addToSpeakersList } = useCommitteeStore();
  const [speakerRunning, setSpeakerRunning] = useState(false);
  const speakerRef = useRef<NodeJS.Timeout | null>(null);
  const caucus = committee.caucus!;
  const spokenCountries = caucus.spokenCountries ?? [];

  // Single interval: ticks both total and speaker when speaker is running
  useEffect(() => {
    if (speakerRunning && caucus.currentSpeaker && caucus.speakerTimeRemaining > 0 && caucus.remainingTime > 0) {
      speakerRef.current = setInterval(() => tickCaucusBoth(committee.id), 1000);
    } else {
      if (speakerRef.current) clearInterval(speakerRef.current);
    }
    return () => { if (speakerRef.current) clearInterval(speakerRef.current); };
  }, [speakerRunning, caucus.currentSpeaker, caucus.speakerTimeRemaining, caucus.remainingTime, committee.id, tickCaucusBoth]);

  useEffect(() => {
    if (caucus.speakerTimeRemaining === 0) setSpeakerRunning(false);
  }, [caucus.speakerTimeRemaining]);

  const handleNext = () => { setSpeakerRunning(false); advanceCaucusSpeaker(committee.id); };
  const speakerProgress = caucus.speakingTime > 0 ? (caucus.speakerTimeRemaining / caucus.speakingTime) * 100 : 0;
  const totalProgress = caucus.totalTime > 0 ? (caucus.remainingTime / caucus.totalTime) * 100 : 0;

  // ── Step 1: Proposer position ──────────────────────────────────────────────
  if (caucus.proposerPosition === null) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <p className="text-xs text-[#B8844A] font-mono tracking-widest mb-4">MODERATED CAUCUS — {caucus.purpose}</p>
        <div className="mb-4">
          <FlagCircle country={caucus.proposedBy} size="xl" />
        </div>
        <h2 className="text-3xl font-black text-white mb-2">{caucus.proposedBy}</h2>
        <p className="text-[#C4A882] text-lg mb-8">
          proposed this caucus. Would they like to speak <span className="text-white font-semibold">first</span> or <span className="text-white font-semibold">last</span>?
        </p>
        <div className="flex gap-4 w-full max-w-sm">
          <button onClick={() => setProposerPosition(committee.id, 'first')}
            className="flex-1 py-5 rounded-2xl font-black text-xl bg-[#7B4A1E] hover:bg-[#8B5A2B] text-white transition-colors">
            First
          </button>
          <button onClick={() => setProposerPosition(committee.id, 'last')}
            className="flex-1 py-5 rounded-2xl font-black text-xl bg-[#2E1E0F] hover:bg-[#3D2A15] text-white transition-colors">
            Last
          </button>
        </div>
      </div>
    );
  }

  // ── Step 2: Normal caucus view ─────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-4 min-h-0">
        <div className="text-center mb-3">
          <p className="text-xs text-[#B8844A] font-mono tracking-widest">MODERATED CAUCUS</p>
          {caucus.purpose && <p className="text-[#C4A882] text-sm mt-0.5">{caucus.purpose}</p>}
          {spokenCountries.length > 0 && (
            <p className="text-xs text-yellow-500 mt-0.5">{spokenCountries.length} delegate{spokenCountries.length !== 1 ? 's' : ''} already spoke</p>
          )}
        </div>

        {caucus.currentSpeaker ? (
          <>
            {committee.speakersList.length > 0 && (
              <div className="mb-4 w-full flex justify-center">
                <CaucusSpeakerQueue committee={committee} spokenCountries={spokenCountries} />
              </div>
            )}
            <FlagCircle country={caucus.currentSpeaker} size="xl" />
            <h1 className="text-3xl font-black text-white mt-3 mb-1 text-center">{caucus.currentSpeaker}</h1>
            <div className={`text-6xl font-black font-mono mt-2 mb-3 tabular-nums ${
              caucus.speakerTimeRemaining <= 5 ? 'text-red-400' : caucus.speakerTimeRemaining <= 15 ? 'text-yellow-400' : 'text-white'
            }`}>
              {formatTime(caucus.speakerTimeRemaining)}
            </div>
            <div className="w-full max-w-md h-2 bg-[#2E1E0F] rounded-full overflow-hidden mb-4">
              <div className={`h-full rounded-full transition-all ${speakerProgress > 50 ? 'bg-[#B8844A]' : speakerProgress > 20 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${speakerProgress}%` }} />
            </div>
            <div className="flex gap-3 w-full max-w-sm">
              <button onClick={() => setSpeakerRunning((r) => !r)}
                className={`flex-1 py-2.5 rounded-xl font-bold text-base transition-colors text-white ${speakerRunning ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-green-600 hover:bg-green-500'}`}>
                {speakerRunning ? '⏸ Pause' : '▶ Start'}
              </button>
              <button onClick={handleNext}
                className="flex-1 bg-[#2E1E0F] hover:bg-[#3D2A15] text-white py-2.5 rounded-xl font-bold text-base transition-colors">
                Next →
              </button>
            </div>
          </>
        ) : (
          <>
            {committee.speakersList.length > 0 && (
              <div className="mb-4 w-full flex justify-center">
                <CaucusSpeakerQueue committee={committee} spokenCountries={spokenCountries} />
              </div>
            )}
            <div className="text-5xl mb-3">🎙️</div>
            <h2 className="text-2xl font-black text-white mb-1">No Current Speaker</h2>
            <p className="text-[#C4A882] mb-4 text-center text-sm">Add delegates below, then call the first speaker</p>
            <button onClick={handleNext} disabled={committee.speakersList.length === 0}
              className="bg-[#7B4A1E] hover:bg-[#8B5A2B] disabled:bg-[#2E1E0F] disabled:text-[#7A5A38] text-white px-8 py-3 rounded-xl font-bold text-base transition-colors">
              Call First Speaker
            </button>
          </>
        )}
      </div>

      {/* Bottom bar */}
      <div className="border-t border-[#2E1E0F] bg-[#0D0906] px-6 py-3">
        <div className="flex items-center gap-3 mb-3">
          <div className="shrink-0">
            <p className="text-xs text-[#7A5A38] font-mono">TOTAL REMAINING</p>
            <p className={`text-lg font-black font-mono ${caucus.remainingTime <= 30 ? 'text-red-400' : 'text-white'}`}>
              {formatTime(caucus.remainingTime)}
            </p>
          </div>
          <div className="flex-1 h-1.5 bg-[#2E1E0F] rounded-full overflow-hidden">
            <div className="h-full bg-[#B8844A]/60 rounded-full transition-all" style={{ width: `${totalProgress}%` }} />
          </div>
          <span className="text-xs text-[#7A5A38]">ticks with speaker</span>
          <button onClick={() => endCaucus(committee.id)}
            className="px-3 py-1.5 rounded-lg font-bold text-xs bg-[#2E1E0F] hover:bg-red-900/40 hover:text-red-400 text-[#C4A882] transition-colors">
            End Caucus
          </button>
        </div>
        <CaucusAddSpeakerInput committee={committee} spokenCountries={spokenCountries} onAdd={(id) => addToSpeakersList(committee.id, id)} />
      </div>
    </div>
  );
}

export default function ChairSession({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { committees, nextSpeaker, addToSpeakersList, removeFromSpeakersList, setSpeakerTimeLimit, tickSpeakerTimer } = useCommitteeStore();
  const [committee, setCommittee] = useState<Committee | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [showRollCall, setShowRollCall] = useState(true); // open by default for roll call
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
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#1A0F08] text-xl font-bold mb-4">Committee not found</p>
          <Link href="/create" className="bg-[#7B4A1E] text-white px-6 py-3 rounded-xl font-semibold">Create one</Link>
        </div>
      </div>
    );
  }

  const present = committee.delegates.filter((d) => d.status !== 'absent').length;
  const progress = committee.currentSpeaker ? (committee.speakerTimeRemaining / committee.speakerTimeLimit) * 100 : 100;

  return (
    <div className="h-screen bg-[#FAF7F2] flex flex-col overflow-hidden">
      {/* Slim header */}
      <header className="border-b border-[#2E1E0F] bg-[#150F08] px-4 h-11 flex items-center gap-3 shrink-0">
        <Link href="/">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#7B4A1E] to-[#4E7C45] flex items-center justify-center text-xs font-bold shrink-0 text-white">G</div>
        </Link>
        <span className="font-bold text-white text-sm truncate">{committee.name}</span>
        <span className="text-[#7A5A38] text-xs hidden sm:block truncate flex-1">{committee.topic}</span>
        {committee.phase !== 'pre-session' && (
          <button
            onClick={() => setShowRollCall((v) => !v)}
            className={`text-xs px-3 py-1 rounded-lg transition-colors shrink-0 ${showRollCall ? 'bg-green-800/50 text-green-300' : 'bg-[#2E1E0F] text-[#C4A882] hover:text-white'}`}
          >
            Roll Call {present}/{committee.delegates.length}
          </button>
        )}
        <button
          onClick={() => setShowMotions((v) => !v)}
          className={`text-xs px-3 py-1 rounded-lg transition-colors shrink-0 relative ${showMotions ? 'bg-[#7B4A1E] text-white' : 'bg-[#2E1E0F] text-[#C4A882] hover:text-white'}`}
        >
          Motions
          {(committee.pendingMotions ?? []).length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#7B4A1E] rounded-full text-white text-[10px] flex items-center justify-center font-bold">
              {committee.pendingMotions.length}
            </span>
          )}
        </button>
        <button
          onClick={() => { navigator.clipboard.writeText(committee.code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="text-xs font-mono bg-[#2E1E0F] hover:bg-[#3D2A15] text-white px-2.5 py-1 rounded-lg transition-colors shrink-0"
        >
          {copied ? '✓' : committee.code}
        </button>
      </header>

      {/* Stats bar — only during active session */}
      {committee.phase !== 'pre-session' && (
        <div className="border-b border-[#2E1E0F] bg-[#150F08] px-4 py-1.5 flex items-center gap-6 shrink-0">
          <span className="text-xs text-[#C4A882] font-mono">
            {present} present
          </span>
          <div className="flex items-center gap-1.5">
            <MiniPie fraction={2/3} color="#B8844A" />
            <span className="text-xs text-[#C4A882]">2/3: <span className="text-white font-bold">{Math.ceil((present * 2) / 3)}</span></span>
          </div>
          <div className="flex items-center gap-1.5">
            <MiniPie fraction={1/2} color="#6BA562" />
            <span className="text-xs text-[#C4A882]">1/2: <span className="text-white font-bold">{Math.floor(present / 2) + 1}</span></span>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">

        {/* Pre-session: full-width roll call */}
        {committee.phase === 'pre-session' && (
          <div className="flex-1 flex items-center justify-center px-6 py-8">
            <div className="w-full max-w-lg bg-[#150F09] border border-[#2E1E0F] rounded-2xl overflow-hidden" style={{ height: '80vh', maxHeight: '640px' }}>
              <RollCallPanel committee={committee} />
            </div>
          </div>
        )}

        {/* Active session layout: optional sidebar + main */}
        {committee.phase !== 'pre-session' && (
          <>
            {/* Roll Call sidebar (collapsible) */}
            {showRollCall && (
              <aside className="w-64 border-r border-[#2E1E0F] bg-[#0D0906] flex flex-col overflow-hidden shrink-0">
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
            <VotingView committee={committee} />
          )}

          {/* Adjourned */}
          {committee.phase === 'adjourned' && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="text-5xl mb-4">🔔</div>
                <h2 className="text-2xl font-black text-white mb-6">Session Adjourned</h2>
                <button onClick={() => useCommitteeStore.getState().setPhase(committee.id, 'speakers-list')}
                  className="bg-[#7B4A1E] hover:bg-[#8B5A2B] text-white px-8 py-3 rounded-xl font-bold transition-colors">
                  Resume Session
                </button>
              </div>
            </div>
          )}

          {/* Speakers list */}
          {committee.phase === 'speakers-list' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Big current speaker */}
              <div className="flex-1 flex flex-col items-center justify-center px-8 py-6 min-h-0 overflow-hidden">
                {committee.currentSpeaker ? (
                  <>
                    {/* Next up — flags above timer, up to 15, scrollable */}
                    {committee.speakersList.length > 0 && (
                      <div className="flex items-start gap-4 mb-8 overflow-x-auto pt-2 pb-1 max-w-full">
                        {committee.speakersList.slice(0, 15).map((s) => (
                          <div key={s.delegateId} className="flex flex-col items-center gap-2 relative group shrink-0">
                            <FlagCircle country={s.country} size="lg" />
                            <span className="text-xs text-[#C4A882] text-center w-20 truncate">{s.country}</span>
                            <button
                              onClick={() => removeFromSpeakersList(committee.id, s.delegateId)}
                              className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full text-white text-xs items-center justify-center hidden group-hover:flex leading-none"
                            >✕</button>
                          </div>
                        ))}
                        {committee.speakersList.length > 15 && (
                          <div className="flex flex-col items-center gap-2 shrink-0">
                            <div className="w-20 h-20 rounded-full bg-[#2E1E0F] flex items-center justify-center">
                              <span className="text-lg font-bold text-[#C4A882]">+{committee.speakersList.length - 15}</span>
                            </div>
                            <span className="text-xs text-[#7A5A38]">more</span>
                          </div>
                        )}
                      </div>
                    )}

                    <FlagCircle country={committee.currentSpeaker.country} size="xl" />
                    <h1 className="text-5xl font-black text-white mt-5 mb-2 text-center">{committee.currentSpeaker.country}</h1>
                    <div className={`text-7xl font-black font-mono mt-3 mb-4 tabular-nums ${
                      committee.speakerTimeRemaining <= 10 ? 'text-red-400' : committee.speakerTimeRemaining <= 30 ? 'text-yellow-400' : 'text-white'
                    }`}>
                      {formatTime(committee.speakerTimeRemaining)}
                    </div>
                    <div className="w-full max-w-md h-2 bg-[#2E1E0F] rounded-full overflow-hidden mb-4">
                      <div className={`h-full rounded-full transition-all ${progress > 50 ? 'bg-[#B8844A]' : progress > 20 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${progress}%` }} />
                    </div>
                    {committee.speakersList.length === 0 && (
                      <div className="mb-4 px-4 py-2 bg-yellow-900/30 border border-yellow-700/40 rounded-xl text-yellow-400 text-sm text-center max-w-sm">
                        ⚠ Last speaker — add more delegates before the timer ends.
                      </div>
                    )}
                    <div className="flex gap-3 w-full max-w-sm mt-2">
                      <button onClick={() => setTimerRunning((r) => !r)}
                        className={`flex-1 py-3 rounded-xl font-bold text-base transition-colors ${timerRunning ? 'bg-yellow-600 hover:bg-yellow-500 text-white' : 'bg-[#3D6B35] hover:bg-[#4A7C42] text-white'}`}>
                        {timerRunning ? '⏸ Pause' : '▶ Start'}
                      </button>
                      <button onClick={() => { setTimerRunning(false); nextSpeaker(committee.id); }}
                        className="flex-1 bg-[#2E1E0F] hover:bg-[#3D2A15] text-white py-3 rounded-xl font-bold text-base transition-colors">
                        Next →
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Next up — flags above no-speaker state */}
                    {committee.speakersList.length > 0 && (
                      <div className="flex items-end gap-5 mb-10">
                        {committee.speakersList.slice(0, 4).map((s) => (
                          <div key={s.delegateId} className="flex flex-col items-center gap-2 relative group">
                            <FlagCircle country={s.country} size="lg" />
                            <span className="text-xs text-[#C4A882] text-center max-w-[80px] truncate">{s.country}</span>
                            <button
                              onClick={() => removeFromSpeakersList(committee.id, s.delegateId)}
                              className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full text-white text-xs items-center justify-center hidden group-hover:flex leading-none"
                            >✕</button>
                          </div>
                        ))}
                        {committee.speakersList.length > 4 && (
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-20 h-20 rounded-full bg-[#2E1E0F] flex items-center justify-center">
                              <span className="text-lg font-bold text-[#C4A882]">+{committee.speakersList.length - 4}</span>
                            </div>
                            <span className="text-xs text-[#7A5A38]">more</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="text-7xl mb-6">🎙️</div>
                    <h2 className="text-3xl font-black text-white mb-2">No Current Speaker</h2>
                    <p className="text-[#C4A882] mb-4 text-center">Add delegates below, then call the first speaker</p>
                    {committee.speakersList.length === 1 && (
                      <div className="mb-4 px-4 py-2 bg-yellow-900/30 border border-yellow-700/40 rounded-xl text-yellow-400 text-sm text-center max-w-sm">
                        Only 1 delegate on the list — add more before starting. When the last speaker finishes, the debate ends.
                      </div>
                    )}
                    <button onClick={() => nextSpeaker(committee.id)} disabled={committee.speakersList.length === 0 || committee.speakersList.length === 1}
                      className="bg-[#7B4A1E] hover:bg-[#8B5A2B] disabled:bg-[#2E1E0F] disabled:text-[#7A5A38] text-white px-10 py-4 rounded-xl font-bold text-lg transition-colors">
                      Call First Speaker
                    </button>
                  </>
                )}
              </div>

              {/* Bottom bar */}
              <div className="border-t border-[#2E1E0F] bg-[#0D0906] px-6 py-4">
                {/* Time presets */}
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs text-[#7A5A38] font-mono shrink-0">TIME</span>
                  <div className="flex gap-1.5">
                    {[30, 60, 90, 120, 180].map((t) => (
                      <button key={t} onClick={() => setSpeakerTimeLimit(committee.id, t)}
                        className={`text-xs px-2.5 py-1 rounded-lg transition-colors font-medium ${committee.speakerTimeLimit === t ? 'bg-[#7B4A1E] text-white' : 'bg-[#2E1E0F] text-[#C4A882] hover:text-white'}`}>
                        {t}s
                      </button>
                    ))}
                    <input type="number" defaultValue={committee.speakerTimeLimit}
                      onBlur={(e) => setSpeakerTimeLimit(committee.id, parseInt(e.target.value) || 90)}
                      className="w-14 bg-[#2E1E0F] border border-[#3D2A15] rounded-lg px-2 py-1 text-white text-xs text-center focus:outline-none" />
                  </div>
                </div>

                <AddSpeakerInput committee={committee} onAdd={(id) => addToSpeakersList(committee.id, id)} />
              </div>
            </div>
          )}
            </main>
          </>
        )}
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
      {caucus.purpose && <p className="text-[#C4A882] mb-6">{caucus.purpose}</p>}
      <div className={`text-9xl font-black font-mono tabular-nums mb-8 ${caucus.remainingTime <= 30 ? 'text-red-400' : 'text-white'}`}>
        {formatTime(caucus.remainingTime)}
      </div>
      <div className="w-full max-w-sm h-2 bg-[#2E1E0F] rounded-full overflow-hidden mb-8">
        <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${(caucus.remainingTime / caucus.totalTime) * 100}%` }} />
      </div>
      <div className="flex gap-3">
        <button onClick={() => setRunning((r) => !r)}
          className={`px-8 py-3 rounded-xl font-bold transition-colors ${running ? 'bg-yellow-600 hover:bg-yellow-500 text-white' : 'bg-green-600 hover:bg-green-500 text-white'}`}>
          {running ? '⏸ Pause' : '▶ Resume'}
        </button>
        <button onClick={() => endCaucus(committee.id)}
          className="px-8 py-3 rounded-xl font-bold bg-[#2E1E0F] hover:bg-red-900/40 hover:text-red-400 text-[#C4A882] transition-colors border border-transparent hover:border-red-800/30">
          End Caucus
        </button>
      </div>
    </div>
  );
}

function VoteCircle({ label, count, total, strokeColor, onInc, onDec }: {
  label: string; count: number; total: number; strokeColor: string;
  onInc: () => void; onDec: () => void;
}) {
  const r = 36; const circumference = 2 * Math.PI * r;
  const fraction = total > 0 ? Math.min(count / total, 1) : 0;
  const labelColor = label === 'In Favour' ? 'text-green-400' : label === 'Against' ? 'text-red-400' : 'text-yellow-400';
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <svg width="110" height="110" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#2E1E0F" strokeWidth="10" />
          <circle cx="50" cy="50" r={r} fill="none" stroke={strokeColor} strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - fraction)}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
            style={{ transition: 'stroke-dashoffset 0.3s ease' }}
          />
          <text x="50" y="56" textAnchor="middle" fill="white" fontSize="24" fontWeight="bold" fontFamily="monospace">{count}</text>
        </svg>
        <button onClick={onInc}
          className="absolute -top-1 -right-1 w-7 h-7 bg-[#2E1E0F] hover:bg-[#3D2A15] rounded-full text-white font-bold text-base flex items-center justify-center border border-[#3D2A15] leading-none">+</button>
        <button onClick={onDec} disabled={count === 0}
          className="absolute -bottom-1 -right-1 w-7 h-7 bg-[#1e2540] hover:bg-[#2a3050] disabled:opacity-30 rounded-full text-white text-lg flex items-center justify-center border border-[#3D2A15] leading-none">−</button>
      </div>
      <span className={`text-sm font-semibold ${labelColor}`}>{label}</span>
    </div>
  );
}

function VotingView({ committee }: { committee: Committee }) {
  const { updateResolutionStatus, setPhase } = useCommitteeStore();
  const [votes, setVotes] = useState<Record<string, { for: number; against: number; abstain: number }>>({});
  const totalPresent = committee.delegates.filter((d) => d.status !== 'absent').length;
  const approved = committee.resolutions.filter((r) => r.status === 'approved');

  const adj = (id: string, field: 'for' | 'against' | 'abstain', delta: number) =>
    setVotes((p) => {
      const v = p[id] || { for: 0, against: 0, abstain: 0 };
      return { ...p, [id]: { ...v, [field]: Math.max(0, (v[field] || 0) + delta) } };
    });

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-8 max-w-2xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-white">Voting Procedure</h2>
          <button onClick={() => setPhase(committee.id, 'speakers-list')} className="text-sm text-[#C4A882] hover:text-white border border-[#2E1E0F] px-3 py-1.5 rounded-lg transition-colors">← Back</button>
        </div>
        {approved.length === 0 ? (
          <div className="text-center py-12 text-[#7A5A38]">No approved resolutions to vote on.</div>
        ) : approved.map((res) => {
          const v = votes[res.id] || { for: 0, against: 0, abstain: 0 };
          const done = res.status === 'passed' || res.status === 'failed';
          return (
            <div key={res.id} className="bg-[#150F09] border border-[#2E1E0F] rounded-xl p-6 mb-4">
              <h3 className="font-bold text-white mb-6 text-lg text-center">{res.title}</h3>
              {done ? (
                <div className={`text-center py-6 rounded-xl ${res.status === 'passed' ? 'bg-green-950/40 border border-green-800/40' : 'bg-red-950/40 border border-red-800/40'}`}>
                  <p className={`text-3xl font-black ${res.status === 'passed' ? 'text-green-400' : 'text-red-400'}`}>{res.status === 'passed' ? '✓ PASSED' : '✗ FAILED'}</p>
                  <p className="text-sm text-[#C4A882] mt-2">{v.for} in favour · {v.against} against · {v.abstain} abstain</p>
                </div>
              ) : (
                <div>
                  <div className="flex justify-around items-center mb-8">
                    <VoteCircle label="In Favour" count={v.for} total={totalPresent} strokeColor="#22c55e"
                      onInc={() => adj(res.id, 'for', 1)} onDec={() => adj(res.id, 'for', -1)} />
                    <VoteCircle label="Abstain" count={v.abstain} total={totalPresent} strokeColor="#eab308"
                      onInc={() => adj(res.id, 'abstain', 1)} onDec={() => adj(res.id, 'abstain', -1)} />
                    <VoteCircle label="Against" count={v.against} total={totalPresent} strokeColor="#ef4444"
                      onInc={() => adj(res.id, 'against', 1)} onDec={() => adj(res.id, 'against', -1)} />
                  </div>
                  <button onClick={() => updateResolutionStatus(committee.id, res.id, v.for > v.against ? 'passed' : 'failed')}
                    className="w-full bg-[#7B4A1E] hover:bg-[#8B5A2B] text-white py-3 rounded-xl font-bold transition-colors text-base">
                    Finalize Vote
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
