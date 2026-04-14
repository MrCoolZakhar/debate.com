'use client';

import { use, useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Committee, DelegateStatus } from '@/lib/types';
import RollCallPanel, { FlagCircle } from '@/components/RollCallPanel';
import MotionsModal from '@/components/MotionsModal';
import DocumentsModal from '@/components/DocumentsModal';
import { getFlagEmoji, getCountryByName } from '@/lib/countries';
import { SettingsPanel } from '@/components/SettingsPanel';
import { useSettingsStore } from '@/lib/settingsStore';
import ChatPanel from '@/components/ChatPanel';
import {
  getCommitteeByCode,
  subscribeToCommittee,
  setPhase as setPhaseInDB,
  addToSpeakersList as addToSpeakersListInDB,
  removeFromSpeakersList as removeFromSpeakersListInDB,
  addToCaucusList as addToCaucusListInDB,
  removeFromCaucusList as removeFromCaucusListInDB,
  reorderSpeakersList as reorderSpeakersListInDB,
  nextSpeaker as nextSpeakerInDB,
  tickSpeakerTimer as tickSpeakerTimerInDB,
  updateCaucus as updateCaucusInDB,
  approveJoinRequest,
  denyJoinRequest,
  logSpeakingTime,
} from '@/lib/committeeService';


function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

type CommitteeSetter = React.Dispatch<React.SetStateAction<Committee | null>>;

const localUpdateTime = { current: 0 };

function updateLocal(setCommittee: CommitteeSetter, updater: (c: Committee) => Committee) {
  localUpdateTime.current = Date.now();
  setCommittee((prev) => prev ? updater(prev) : prev);
}

// ── Add Speaker Input ─────────────────────────────────────────────────────────
function AddSpeakerInput({ committee, onAdd }: { committee: Committee; onAdd: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const onList = new Set(committee.speakersList.map((s) => s.delegateId));
  const eligible = committee.delegates.filter(
    (d) => d.status !== 'absent' && d.id !== committee.currentSpeaker?.delegateId
  );
  const matches = query.trim()
    ? eligible.filter((d) => d.country.toLowerCase().startsWith(query.toLowerCase()))
        .concat(eligible.filter((d) => !d.country.toLowerCase().startsWith(query.toLowerCase()) && d.country.toLowerCase().includes(query.toLowerCase())))
    : [];
  const topNotOnList = matches.find((d) => !onList.has(d.id)) ?? null;
  const commit = (d: typeof topNotOnList) => { if (!d || onList.has(d.id)) return; onAdd(d.id); setQuery(''); inputRef.current?.focus(); };
  return (
    <div className="relative">
      <div className="flex items-center bg-[#150F09] border border-[#2E1E0F] focus-within:border-[#7B4A1E] rounded-xl overflow-hidden transition-colors">
        <input ref={inputRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(topNotOnList); } if (e.key === 'Escape') setQuery(''); }}
          placeholder="Add to speakers list..." autoFocus
          className="flex-1 bg-transparent px-4 py-3 text-white placeholder-[#7A5A38] focus:outline-none text-sm" />
        {topNotOnList && query && <span className="text-xs text-[#7A5A38] px-3 truncate max-w-[140px]">↵ {topNotOnList.country}</span>}
      </div>
      {query && matches.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#150F09] border border-[#2E1E0F] rounded-xl overflow-hidden z-20 shadow-xl">
          {matches.slice(0, 6).map((d, i) => {
            const found = getCountryByName(d.country);
            const alreadyOnList = onList.has(d.id);
            if (alreadyOnList) {
              return (
                <div key={d.id} className="w-full flex items-center gap-3 px-4 py-2.5 opacity-50 cursor-not-allowed">
                  <span className="text-lg">{found ? getFlagEmoji(found.code) : '🌐'}</span>
                  <span className="text-sm flex-1 text-[#7A5A38]">{d.country}</span>
                  <span className="text-xs text-[#7A5A38]">already on list</span>
                </div>
              );
            }
            const isFirst = d === topNotOnList;
            return (
              <button key={d.id} onMouseDown={(e) => { e.preventDefault(); commit(d); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${isFirst ? 'bg-[#7B4A1E]/20 text-white' : 'text-[#E8D5B7] hover:bg-[#2E1E0F]'}`}>
                <span className="text-lg">{found ? getFlagEmoji(found.code) : '🌐'}</span>
                <span className="text-sm">{d.country}</span>
                {isFirst && <span className="ml-auto text-xs text-[#7A5A38]">Enter ↵</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Caucus Speaker Queue ──────────────────────────────────────────────────────
function CaucusSpeakerQueue({ committee, spokenCountries, onRemove, onReorder }: {
  committee: Committee; spokenCountries: string[]; onRemove: (delegateId: string) => void;
  onReorder?: (newList: { delegateId: string; country: string }[]) => void;
}) {
  const dragIndexRef = useRef<number | null>(null);
  if (committee.caucusQueue.length === 0) return null;
  const queueSize = committee.caucusQueue.length;
  const flagSize: 'lg' | 'sm' = queueSize <= 8 ? 'lg' : 'sm';
  const displayList = committee.caucusQueue.slice(0, 15);
  const overflow = queueSize > 15 ? queueSize - 15 : 0;
  return (
    <div className="flex flex-wrap items-start gap-3 pt-1 pb-1 max-w-full justify-center">
      {displayList.map((s, i) => {
        const alreadySpoke = spokenCountries.includes(s.country);
        return (
          <div
            key={s.delegateId}
            className="flex flex-col items-center gap-1 relative group cursor-grab active:cursor-grabbing select-none"
            draggable
            onDragStart={() => { dragIndexRef.current = i; }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              const from = dragIndexRef.current;
              if (from === null || from === i || !onReorder) return;
              const full = [...committee.caucusQueue];
              const [moved] = full.splice(from, 1);
              full.splice(i, 0, moved);
              onReorder(full);
              dragIndexRef.current = null;
            }}
          >
            <div className="relative">
              <FlagCircle country={s.country} size={flagSize} />
              {alreadySpoke && (
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                  <span className="text-[9px] font-bold text-yellow-300">✓</span>
                </div>
              )}
            </div>
            <span className={`text-[10px] text-center w-12 truncate ${alreadySpoke ? 'text-yellow-600' : 'text-[#C4A882]'}`}>{s.country}</span>
            {i === 0 && !alreadySpoke && (
              <span className="text-[9px] font-semibold text-[#B8844A]">Up next...</span>
            )}
            <button onClick={() => onRemove(s.delegateId)}
              className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full text-white text-xs items-center justify-center hidden group-hover:flex leading-none">✕</button>
          </div>
        );
      })}
      {overflow > 0 && (
        <div className="flex flex-col items-center gap-1">
          <div className="w-9 h-9 rounded-full bg-[#2E1E0F] flex items-center justify-center">
            <span className="text-xs font-bold text-[#C4A882]">+{overflow}</span>
          </div>
          <span className="text-[10px] text-[#7A5A38]">more</span>
        </div>
      )}
    </div>
  );
}

// ── Draggable GSL Speakers Queue ──────────────────────────────────────────────
function DraggableSpeakersQueue({
  list,
  onReorder,
  onRemove,
}: {
  list: { delegateId: string; country: string }[];
  onReorder: (newList: { delegateId: string; country: string }[]) => void;
  onRemove: (delegateId: string) => void;
}) {
  const dragIndexRef = useRef<number | null>(null);
  const qLen = list.length;
  const fSize: 'lg' | 'sm' = qLen <= 8 ? 'lg' : 'sm';
  const displayItems = list.slice(0, 15);
  const overflow = qLen > 15 ? qLen - 15 : 0;
  return (
    <div className="flex flex-wrap items-start gap-4 mb-8 pt-2 pb-1 max-w-full justify-center">
      {displayItems.map((s, i) => (
        <div
          key={s.delegateId}
          className="flex flex-col items-center gap-1 relative group cursor-grab active:cursor-grabbing select-none"
          draggable
          onDragStart={() => { dragIndexRef.current = i; }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            const from = dragIndexRef.current;
            if (from === null || from === i) return;
            const newList = [...list];
            const [moved] = newList.splice(from, 1);
            newList.splice(i, 0, moved);
            onReorder(newList);
            dragIndexRef.current = null;
          }}
        >
          <FlagCircle country={s.country} size={fSize} />
          <span className="text-xs text-[#C4A882] text-center w-14 truncate">{s.country}</span>
          {i === 0 && (
            <span className="text-[9px] font-semibold text-[#B8844A]">Up next...</span>
          )}
          <button onClick={() => onRemove(s.delegateId)}
            className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full text-white text-xs items-center justify-center hidden group-hover:flex leading-none">✕</button>
        </div>
      ))}
      {overflow > 0 && (
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-full bg-[#2E1E0F] flex items-center justify-center">
            <span className="text-sm font-bold text-[#C4A882]">+{overflow}</span>
          </div>
          <span className="text-xs text-[#7A5A38]">more</span>
        </div>
      )}
    </div>
  );
}

// ── Caucus Add Speaker Input ──────────────────────────────────────────────────
function CaucusAddSpeakerInput({ committee, spokenCountries, onAdd }: {
  committee: Committee; spokenCountries: string[]; onAdd: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const onList = new Set((committee.caucusQueue ?? committee.speakersList).map((s) => s.delegateId));
  const eligible = committee.delegates.filter((d) => d.status !== 'absent');
  const matches = query.trim()
    ? eligible.filter((d) => d.country.toLowerCase().startsWith(query.toLowerCase()))
        .concat(eligible.filter((d) => !d.country.toLowerCase().startsWith(query.toLowerCase()) && d.country.toLowerCase().includes(query.toLowerCase())))
    : [];
  const topNotOnList = matches.find((d) => !onList.has(d.id)) ?? null;
  const commit = (d: typeof topNotOnList) => { if (!d || onList.has(d.id)) return; onAdd(d.id); setQuery(''); inputRef.current?.focus(); };
  return (
    <div className="relative">
      <div className="flex items-center bg-[#150F09] border border-[#2E1E0F] focus-within:border-[#7B4A1E] rounded-xl overflow-hidden transition-colors">
        <input ref={inputRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(topNotOnList); } if (e.key === 'Escape') setQuery(''); }}
          placeholder="Add to speakers list…"
          className="flex-1 bg-transparent px-4 py-3 text-white placeholder-[#7A5A38] focus:outline-none text-sm" />
        {topNotOnList && query && <span className="text-xs text-[#7A5A38] px-3 truncate max-w-[140px]">↵ {topNotOnList.country}</span>}
      </div>
      {query && matches.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#150F09] border border-[#2E1E0F] rounded-xl overflow-hidden z-20 shadow-xl">
          {matches.slice(0, 6).map((d) => {
            const found = getCountryByName(d.country);
            const alreadyOnList = onList.has(d.id);
            const spoke = spokenCountries.includes(d.country);
            if (alreadyOnList) {
              return (
                <div key={d.id} className="w-full flex items-center gap-3 px-4 py-2.5 opacity-50 cursor-not-allowed">
                  <span className="text-lg">{found ? getFlagEmoji(found.code) : '🌐'}</span>
                  <span className="text-sm flex-1 text-[#7A5A38]">{d.country}</span>
                  <span className="text-xs text-[#7A5A38]">already on list</span>
                </div>
              );
            }
            const isFirst = d === topNotOnList;
            return (
              <button key={d.id} onMouseDown={(e) => { e.preventDefault(); commit(d); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${isFirst ? 'bg-[#7B4A1E]/20 text-white' : 'text-[#E8D5B7] hover:bg-[#2E1E0F]'}`}>
                <span className="text-lg">{found ? getFlagEmoji(found.code) : '🌐'}</span>
                <span className="text-sm flex-1">{d.country}</span>
                {spoke && <span className="text-[10px] text-yellow-500 shrink-0">already spoke</span>}
                {isFirst && !spoke && <span className="text-xs text-[#7A5A38] shrink-0">Enter ↵</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Moderated Caucus View ─────────────────────────────────────────────────────
function ModeratedCaucusView({ committee, setCommittee }: { committee: Committee; setCommittee: CommitteeSetter }) {
  const [speakerRunning, setSpeakerRunning] = useState(false);
  const speakerRef = useRef<NodeJS.Timeout | null>(null);
  const caucusRef = useRef(committee.caucus);
  caucusRef.current = committee.caucus;
  const caucus = committee.caucus!;
  const spokenCountries = caucus.spokenCountries ?? [];

  useEffect(() => {
    if (speakerRunning) {
      speakerRef.current = setInterval(() => {
        const c = caucusRef.current;
        if (!c || c.remainingTime <= 0) { setSpeakerRunning(false); return; }
        updateLocal(setCommittee, (prev) => {
          if (!prev.caucus) return prev;
          const newTotal = Math.max(0, prev.caucus.remainingTime - 1);
          const newSpeaker = Math.max(0, prev.caucus.speakerTimeRemaining - 1);
          if (newSpeaker === 0) setSpeakerRunning(false);
          return {
            ...prev,
            phase: newTotal === 0 ? 'speakers-list' : prev.phase,
            caucus: newTotal === 0 ? null : { ...prev.caucus, remainingTime: newTotal, speakerTimeRemaining: newSpeaker },
          };
        });
      }, 1000);
    } else {
      if (speakerRef.current) clearInterval(speakerRef.current);
    }
    return () => { if (speakerRef.current) clearInterval(speakerRef.current); };
  }, [speakerRunning]);

  const handleRemoveFromQueue = (delegateId: string) => {
    updateLocal(setCommittee, (c) => ({ ...c, caucusQueue: (c.caucusQueue ?? []).filter((s) => s.delegateId !== delegateId) }));
    removeFromCaucusListInDB(committee.id, delegateId);
  };

  const handleReorderCaucusQueue = (newList: { delegateId: string; country: string }[]) => {
    updateLocal(setCommittee, (c) => ({ ...c, caucusQueue: newList }));
    reorderSpeakersListInDB(committee.id, newList, 'caucus');
  };

  const handleAddToQueue = (delegateId: string) => {
    const delegate = committee.delegates.find((d) => d.id === delegateId);
    if (!delegate) return;
    updateLocal(setCommittee, (c) => ({ ...c, caucusQueue: [...(c.caucusQueue ?? []), { delegateId, country: delegate.country }] }));
    addToCaucusListInDB(committee.id, delegateId, delegate.country);
  };

  const handleNext = () => {
    setSpeakerRunning(false);
    const [next, ...rest] = committee.caucusQueue ?? [];
    const prev = caucus.currentSpeaker;
    updateLocal(setCommittee, (c) => {
      if (!c.caucus) return c;
      const newSpoken = prev && !c.caucus.spokenCountries.includes(prev)
        ? [...c.caucus.spokenCountries, prev] : c.caucus.spokenCountries;
      return {
        ...c,
        caucusQueue: rest,
        caucus: { ...c.caucus, currentSpeaker: next?.country ?? null, speakerTimeRemaining: c.caucus.speakingTime, spokenCountries: newSpoken },
      };
    });
  };

  const handleSetProposerPosition = (position: 'first' | 'last') => {
    const proposer = caucus.proposedBy;
    const delegate = committee.delegates.find((d) => d.country === proposer);
    if (!delegate) return;
    const entry = { delegateId: delegate.id, country: proposer };
    updateLocal(setCommittee, (c) => {
      if (!c.caucus) return c;
      const without = (c.caucusQueue ?? []).filter((s) => s.delegateId !== delegate.id);
      const newList = position === 'first' ? [entry, ...without] : [...without, entry];
      return { ...c, caucusQueue: newList, caucus: { ...c.caucus, proposerPosition: position } };
    });
  };

  const handleEndCaucus = async () => {
    setSpeakerRunning(false);
    await updateCaucusInDB(committee.id, null);
    await setPhaseInDB(committee.id, 'speakers-list');
    const updated = await getCommitteeByCode(committee.code);
    if (updated) { localUpdateTime.current = Date.now(); setCommittee(updated); }
    else { updateLocal(setCommittee, (c) => ({ ...c, caucus: null, phase: 'speakers-list', caucusQueue: [] })); }
  };

  const speakerProgress = caucus.speakingTime > 0 ? (caucus.speakerTimeRemaining / caucus.speakingTime) * 100 : 0;
  const totalProgress = caucus.totalTime > 0 ? (caucus.remainingTime / caucus.totalTime) * 100 : 0;

  if (caucus.proposerPosition === null) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <p className="text-xs text-[#7B4A1E] font-mono tracking-widest mb-4">MODERATED CAUCUS — {caucus.purpose}</p>
        <div className="mb-4"><FlagCircle country={caucus.proposedBy} size="xl" /></div>
        <h2 className="text-3xl font-black text-white mb-2">{caucus.proposedBy}</h2>
        <p className="text-[#C4A882] text-lg mb-8">
          proposed this caucus. Would they like to speak <span className="text-white font-semibold">first</span> or <span className="text-white font-semibold">last</span>?
        </p>
        <div className="flex gap-4 w-full max-w-sm">
          <button onClick={() => handleSetProposerPosition('first')}
            className="flex-1 py-5 rounded-2xl font-black text-xl bg-[#7B4A1E] hover:bg-[#8B5A2B] text-white transition-colors">First</button>
          <button onClick={() => handleSetProposerPosition('last')}
            className="flex-1 py-5 rounded-2xl font-black text-xl bg-[#2E1E0F] hover:bg-[#3D2A15] border border-[#2E1E0F] text-white transition-colors">Last</button>
        </div>
      </div>
    );
  }

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
                <CaucusSpeakerQueue committee={{...committee, speakersList: committee.caucusQueue ?? []}} spokenCountries={spokenCountries} onRemove={handleRemoveFromQueue} onReorder={handleReorderCaucusQueue} />
              </div>
            )}
            <FlagCircle country={caucus.currentSpeaker} size="xl" />
            <h1 className="text-3xl font-black text-white mt-3 mb-1 text-center">{caucus.currentSpeaker}</h1>
            <div className={`text-6xl font-black font-mono mt-2 mb-3 tabular-nums ${caucus.speakerTimeRemaining <= 5 ? 'text-red-500' : caucus.speakerTimeRemaining <= 15 ? 'text-yellow-600' : 'text-white'}`}>
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
                className="flex-1 bg-[#2E1E0F] hover:bg-[#3D2A15] border border-[#2E1E0F] text-white py-2.5 rounded-xl font-bold text-base transition-colors">
                Next →
              </button>
            </div>
          </>
        ) : (
          <>
            {committee.speakersList.length > 0 && (
              <div className="mb-4 w-full flex justify-center">
                <CaucusSpeakerQueue committee={{...committee, speakersList: committee.caucusQueue ?? []}} spokenCountries={spokenCountries} onRemove={handleRemoveFromQueue} onReorder={handleReorderCaucusQueue} />
              </div>
            )}
            <div className="text-5xl mb-3">🎙️</div>
            <h2 className="text-2xl font-black text-white mb-1">No Current Speaker</h2>
            <p className="text-[#C4A882] mb-4 text-center text-sm">Add delegates below, then call the first speaker</p>
            <button onClick={handleNext} disabled={(committee.caucusQueue ?? []).length === 0}
              className="bg-[#7B4A1E] hover:bg-[#8B5A2B] disabled:bg-[#2E1E0F] disabled:text-[#7A5A38] text-white px-8 py-3 rounded-xl font-bold text-base transition-colors">
              Call First Speaker
            </button>
          </>
        )}
      </div>

      <div className="border-t border-[#2E1E0F] bg-[#0D0906] px-6 py-3">
        <div className="flex items-center gap-3 mb-3">
          <div className="shrink-0">
            <p className="text-xs text-[#7A5A38] font-mono">TOTAL REMAINING</p>
            <p className={`text-lg font-black font-mono ${caucus.remainingTime <= 30 ? 'text-red-500' : 'text-white'}`}>{formatTime(caucus.remainingTime)}</p>
          </div>
          <div className="flex-1 h-1.5 bg-[#2E1E0F] rounded-full overflow-hidden">
            <div className="h-full bg-[#B8844A]/60 rounded-full transition-all" style={{ width: `${totalProgress}%` }} />
          </div>
          <span className="text-xs text-[#7A5A38]">ticks with speaker</span>
          <button onClick={handleEndCaucus}
            className="px-3 py-1.5 rounded-lg font-bold text-xs bg-[#2E1E0F] border border-[#2E1E0F] hover:bg-red-950/40 hover:text-red-500 hover:border-red-800/40 text-[#C4A882] transition-colors">
            End Caucus
          </button>
        </div>
        <CaucusAddSpeakerInput committee={committee} spokenCountries={spokenCountries} onAdd={handleAddToQueue} />
      </div>
    </div>
  );
}

// ── Unmoderated Caucus View ───────────────────────────────────────────────────
function UnmoderatedCaucusView({ committee, setCommittee }: { committee: Committee; setCommittee: CommitteeSetter }) {
  const [running, setRunning] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const caucus = committee.caucus!;
  const remainingRef = useRef(caucus.remainingTime);
  remainingRef.current = caucus.remainingTime;

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        if (remainingRef.current <= 0) { setRunning(false); return; }
        updateLocal(setCommittee, (c) => {
          if (!c.caucus) return c;
          const newTotal = Math.max(0, c.caucus.remainingTime - 1);
          return { ...c, caucus: newTotal === 0 ? null : { ...c.caucus, remainingTime: newTotal }, phase: newTotal === 0 ? 'speakers-list' : c.phase };
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const handleEndCaucus = async () => {
    setRunning(false);
    await updateCaucusInDB(committee.id, null);
    await setPhaseInDB(committee.id, 'speakers-list');
    const updated = await getCommitteeByCode(committee.code);
    if (updated) { localUpdateTime.current = Date.now(); setCommittee(updated); }
    else { updateLocal(setCommittee, (c) => ({ ...c, caucus: null, phase: 'speakers-list' })); }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 py-12">
      <p className="text-xs text-purple-400 font-mono mb-4">UNMODERATED CAUCUS</p>
      {caucus.purpose && <p className="text-[#C4A882] mb-6">{caucus.purpose}</p>}
      <div className={`text-9xl font-black font-mono tabular-nums mb-8 ${caucus.remainingTime <= 30 ? 'text-red-500' : 'text-white'}`}>
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
        <button onClick={handleEndCaucus}
          className="px-8 py-3 rounded-xl font-bold bg-[#2E1E0F] hover:bg-red-950/40 hover:text-red-500 text-[#C4A882] border border-[#2E1E0F] hover:border-red-800/40 transition-colors">
          End Caucus
        </button>
      </div>
    </div>
  );
}

// ── Vote Circle ───────────────────────────────────────────────────────────────
function VoteCircle({ label, count, total, strokeColor, onInc, onDec }: {
  label: string; count: number; total: number; strokeColor: string; onInc: () => void; onDec: () => void;
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
            strokeDasharray={circumference} strokeDashoffset={circumference * (1 - fraction)}
            strokeLinecap="round" transform="rotate(-90 50 50)" style={{ transition: 'stroke-dashoffset 0.3s ease' }} />
          <text x="50" y="56" textAnchor="middle" fill="white" fontSize="24" fontWeight="bold" fontFamily="monospace">{count}</text>
        </svg>
        <button onClick={onInc} className="absolute -top-1 -right-1 w-7 h-7 bg-[#2E1E0F] hover:bg-[#3D2A15] border border-[#2E1E0F] rounded-full text-white font-bold text-base flex items-center justify-center leading-none">+</button>
        <button onClick={onDec} disabled={count === 0} className="absolute -bottom-1 -right-1 w-7 h-7 bg-[#2E1E0F] hover:bg-[#3D2A15] border border-[#2E1E0F] disabled:opacity-30 rounded-full text-white text-lg flex items-center justify-center leading-none">−</button>
      </div>
      <span className={`text-sm font-semibold ${labelColor}`}>{label}</span>
    </div>
  );
}

// ── Voting View ───────────────────────────────────────────────────────────────
function VotingView({ committee, setCommittee }: { committee: Committee; setCommittee: CommitteeSetter }) {
  const [votes, setVotes] = useState<Record<string, { for: number; against: number; abstain: number }>>({});
  const totalPresent = committee.delegates.filter((d) => d.status !== 'absent').length;
  const approved = committee.resolutions.filter((r) => r.status === 'approved');

  const adj = (id: string, field: 'for' | 'against' | 'abstain', delta: number) =>
    setVotes((p) => { const v = p[id] || { for: 0, against: 0, abstain: 0 }; return { ...p, [id]: { ...v, [field]: Math.max(0, (v[field] || 0) + delta) } }; });

  const handleBack = () => {
    updateLocal(setCommittee, (c) => ({ ...c, phase: 'speakers-list' }));
    setPhaseInDB(committee.id, 'speakers-list');
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-8 max-w-2xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-white">Voting Procedure</h2>
          <button onClick={handleBack} className="text-sm text-[#C4A882] hover:text-white border border-[#2E1E0F] px-3 py-1.5 rounded-lg transition-colors">← Back</button>
        </div>
        {approved.length === 0 ? (
          <div className="text-center py-12 text-[#7A5A38]">No approved resolutions to vote on.</div>
        ) : approved.map((res) => {
          const v = votes[res.id] || { for: 0, against: 0, abstain: 0 };
          const done = res.status === 'passed' || res.status === 'failed';
          return (
            <div key={res.id} className="bg-[#1A1209] border border-[#2E1E0F] rounded-xl p-6 mb-4">
              <h3 className="font-bold text-white mb-6 text-lg text-center">{res.title}</h3>
              {done ? (
                <div className={`text-center py-6 rounded-xl ${res.status === 'passed' ? 'bg-green-950/40 border border-green-800/40' : 'bg-red-950/40 border border-red-800/40'}`}>
                  <p className={`text-3xl font-black ${res.status === 'passed' ? 'text-green-400' : 'text-red-400'}`}>{res.status === 'passed' ? '✓ PASSED' : '✗ FAILED'}</p>
                  <p className="text-sm text-[#C4A882] mt-2">{v.for} in favour · {v.against} against · {v.abstain} abstain</p>
                </div>
              ) : (
                <div>
                  <div className="flex justify-around items-center mb-8">
                    <VoteCircle label="In Favour" count={v.for} total={totalPresent} strokeColor="#22c55e" onInc={() => adj(res.id, 'for', 1)} onDec={() => adj(res.id, 'for', -1)} />
                    <VoteCircle label="Abstain" count={v.abstain} total={totalPresent} strokeColor="#eab308" onInc={() => adj(res.id, 'abstain', 1)} onDec={() => adj(res.id, 'abstain', -1)} />
                    <VoteCircle label="Against" count={v.against} total={totalPresent} strokeColor="#ef4444" onInc={() => adj(res.id, 'against', 1)} onDec={() => adj(res.id, 'against', -1)} />
                  </div>
                  <button onClick={() => {
                    const result = v.for > v.against ? 'passed' : 'failed';
                    updateLocal(setCommittee, (c) => ({ ...c, resolutions: c.resolutions.map((r) => r.id === res.id ? { ...r, status: result } : r) }));
                  }} className="w-full bg-[#7B4A1E] hover:bg-[#8B5A2B] text-white py-3 rounded-xl font-bold transition-colors text-base">
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

// ── Main Chair Session ────────────────────────────────────────────────────────
export default function ChairSession({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const [committee, setCommittee] = useState<Committee | null>(null);
  const [loading, setLoading] = useState(true);
  const [timerRunning, setTimerRunning] = useState(false);
  const [showRollCall, setShowRollCall] = useState(true);
  const [showMotions, setShowMotions] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [copied, setCopied] = useState(false);
  const [speakerTimeLimit, setSpeakerTimeLimitLocal] = useState(90);
  const [showSettings, setShowSettings] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [extraTimeOpen, setExtraTimeOpen] = useState(false);
  const [extraTimeSecs, setExtraTimeSecs] = useState(30);
  const [extraTimeAdded, setExtraTimeAdded] = useState(false);
  const [rightToReplyOpen, setRightToReplyOpen] = useState(false);
  const [rtrCountry, setRtrCountry] = useState('');
  const [rtrSeconds, setRtrSeconds] = useState(30);
  const [rtrOverrideTime, setRtrOverrideTime] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerRunningRef = useRef(false);
  const committeeIdRef = useRef('');
  timerRunningRef.current = timerRunning;

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    async function load() {
      const found = await getCommitteeByCode(code);
      setCommittee(found ?? null);
      if (found) {
        setSpeakerTimeLimitLocal(found.speakerTimeLimit);
        committeeIdRef.current = found.id;
      }
      setLoading(false);
      if (found) {
        unsubscribe = subscribeToCommittee(found.id, async () => {
          if (Date.now() - localUpdateTime.current < 2000) return;
          const updated = await getCommitteeByCode(code);
          if (updated) {
            setCommittee((prev) => {
              if (!prev) return updated;
              return {
                ...updated,
                speakerTimeRemaining: timerRunningRef.current
                  ? prev.speakerTimeRemaining
                  : updated.speakerTimeRemaining,
              };
            });
          }
        });
      }
    }
    load();
    return () => unsubscribe?.();
  }, [code]);

  useEffect(() => {
    if (timerRunning) {
      intervalRef.current = setInterval(() => {
        updateLocal(setCommittee, (c) => {
          const newTime = Math.max(0, c.speakerTimeRemaining - 1);
          if (newTime === 0) setTimerRunning(false);
          return { ...c, speakerTimeRemaining: newTime };
        });
        if (committeeIdRef.current) tickSpeakerTimerInDB(committeeIdRef.current);
      }, 1000);
    } else {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    }
    return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };
  }, [timerRunning]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D0906] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#7B4A1E] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#C4A882] text-sm">Loading session...</p>
        </div>
      </div>
    );
  }

  if (!committee) {
    return (
      <div className="min-h-screen bg-[#0D0906] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-xl font-bold mb-4">Committee not found</p>
          <Link href="/create" className="bg-[#7B4A1E] text-white px-6 py-3 rounded-xl font-semibold">Create one</Link>
        </div>
      </div>
    );
  }

  const present = committee.delegates.filter((d) => d.status !== 'absent').length;
  const progress = committee.currentSpeaker ? (committee.speakerTimeRemaining / committee.speakerTimeLimit) * 100 : 100;

  // ── Optimistic action handlers ──────────────────────────────────────────────

  const handleAddToSpeakersList = (delegateId: string) => {
    const delegate = committee.delegates.find((d) => d.id === delegateId);
    if (!delegate) return;
    const alreadyOn = committee.speakersList.some((s) => s.delegateId === delegateId);
    if (alreadyOn) return;
    updateLocal(setCommittee, (c) => ({ ...c, speakersList: [...c.speakersList, { delegateId, country: delegate.country }] }));
    addToSpeakersListInDB(committee.id, delegateId, delegate.country);
  };

  const handleRemoveFromSpeakersList = (delegateId: string) => {
    updateLocal(setCommittee, (c) => ({ ...c, speakersList: c.speakersList.filter((s) => s.delegateId !== delegateId) }));
    removeFromSpeakersListInDB(committee.id, delegateId);
  };

  const handleNextSpeaker = () => {
    setTimerRunning(false);
    setExtraTimeAdded(false);
    // Log speaking time for the delegate whose turn is ending
    if (committee.currentSpeaker) {
      const secondsSpoken = committee.speakerTimeLimit - committee.speakerTimeRemaining;
      if (secondsSpoken > 0) {
        const ctx = committee.phase === 'moderated-caucus' ? 'moderated-caucus'
          : committee.phase === 'unmoderated-caucus' ? 'unmoderated-caucus'
          : 'speakers-list';
        logSpeakingTime(committee.id, committee.currentSpeaker.country, secondsSpoken, ctx, committee.topic);
      }
    }
    const [next, ...rest] = committee.speakersList;
    const timeToUse = rtrOverrideTime ?? speakerTimeLimit;
    setRtrOverrideTime(null);
    updateLocal(setCommittee, (c) => ({
      ...c,
      currentSpeaker: next ?? null,
      speakersList: rest,
      speakerTimeRemaining: timeToUse,
    }));
    nextSpeakerInDB(committee.id, timeToUse);
  };

  const handleAddExtraTime = () => {
    const secs = extraTimeSecs;
    updateLocal(setCommittee, (c) => ({ ...c, speakerTimeRemaining: c.speakerTimeRemaining + secs }));
    setExtraTimeAdded(true);
    setExtraTimeOpen(false);
  };

  const handleRightToReply = () => {
    if (!rtrCountry) return;
    const delegate = committee.delegates.find((d) => d.country === rtrCountry && d.status !== 'absent');
    if (!delegate) return;
    const entry = { delegateId: delegate.id, country: rtrCountry };
    updateLocal(setCommittee, (c) => ({
      ...c,
      speakersList: [entry, ...c.speakersList.filter((s) => s.delegateId !== delegate.id)],
    }));
    setRtrOverrideTime(rtrSeconds);
    setRtrCountry('');
    setRightToReplyOpen(false);
  };

  const handleSetSpeakerTimeLimit = (seconds: number) => {
    setSpeakerTimeLimitLocal(seconds);
    updateLocal(setCommittee, (c) => ({ ...c, speakerTimeLimit: seconds, speakerTimeRemaining: seconds }));
  };

  const handleResumeSession = () => {
    updateLocal(setCommittee, (c) => ({ ...c, phase: 'speakers-list' }));
    setPhaseInDB(committee.id, 'speakers-list');
  };

  const handleReorderSpeakersList = (newList: { delegateId: string; country: string }[]) => {
    updateLocal(setCommittee, (c) => ({ ...c, speakersList: newList }));
    reorderSpeakersListInDB(committee.id, newList, 'gsl');
  };

  const handleStatusChange = (delegateId: string, status: DelegateStatus) => {
    updateLocal(setCommittee, (c) => ({
      ...c,
      delegates: c.delegates.map((d) => d.id === delegateId ? { ...d, status } : d),
      // Auto-remove from both lists when marking absent
      ...(status === 'absent' ? {
        speakersList: c.speakersList.filter((s) => s.delegateId !== delegateId),
        caucusQueue: (c.caucusQueue ?? []).filter((s) => s.delegateId !== delegateId),
      } : {}),
    }));
    if (status === 'absent') {
      removeFromSpeakersListInDB(committee.id, delegateId);
      removeFromCaucusListInDB(committee.id, delegateId);
    }
  };

  const handlePhaseChange = (phase: string) => {
    updateLocal(setCommittee, (c) => ({ ...c, phase: phase as Committee['phase'] }));
  };

  const handleDelegateAdd = async (country: string) => {
    const { addDelegate: addDelegateInDB } = await import('@/lib/committeeService');
    const realId = await addDelegateInDB(committee.id, country);
    if (realId) {
      updateLocal(setCommittee, (c) => ({
        ...c,
        delegates: [...c.delegates, { id: realId, country, status: 'absent' }],
      }));
    }
  };

  const handleApproveJoinRequest = async (motionId: string, delegateId: string, desiredStatus: 'present' | 'present-voting') => {
    await approveJoinRequest(committee.id, motionId, delegateId, desiredStatus);
    updateLocal(setCommittee, (c) => ({
      ...c,
      delegates: c.delegates.map((d) => d.id === delegateId ? { ...d, status: desiredStatus } : d),
      pendingMotions: c.pendingMotions.filter((m) => m.id !== motionId),
    }));
  };

  const handleDenyJoinRequest = async (motionId: string) => {
    await denyJoinRequest(motionId);
    updateLocal(setCommittee, (c) => ({
      ...c,
      pendingMotions: c.pendingMotions.filter((m) => m.id !== motionId),
    }));
  };

  // Fix 2: GSL can never run out — block Start when current speaker is the last one
  const isLastGSLSpeaker = committee.speakersList.length === 0;

  return (
    <div className="h-screen bg-[#0D0906] flex flex-col overflow-hidden">
      <header className="border-b border-[#2E1E0F] bg-[#150F08] px-4 h-11 flex items-center gap-3 shrink-0">
        <Link href="/">
          <img src="/gavelling-logo.png" alt="Gavelling" className="w-[16vw] h-auto max-h-9 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </Link>
        <span className="font-bold text-white text-sm truncate">{committee.name}</span>
        <span className="text-[#7A5A38] text-xs hidden sm:block truncate flex-1">{committee.topic}</span>
        {committee.phase !== 'pre-session' && (
          <button onClick={() => setShowRollCall((v) => !v)}
            className={`text-xs px-3 py-1 rounded-lg transition-colors shrink-0 ${showRollCall ? 'bg-green-800/50 text-green-300' : 'bg-[#2E1E0F] text-[#C4A882] hover:text-white'}`}>
            Roll Call {present}/{committee.delegates.length}
          </button>
        )}
        <button onClick={() => setShowMotions((v) => !v)}
          className={`text-xs px-3 py-1 rounded-lg transition-colors shrink-0 relative ${showMotions ? 'bg-[#7B4A1E] text-white' : 'bg-[#2E1E0F] text-[#C4A882] hover:text-white'}`}>
          Motions
          {(committee.pendingMotions ?? []).filter((m) => m.type !== ('join-request' as string)).length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#7B4A1E] rounded-full text-white text-[10px] flex items-center justify-center font-bold">{(committee.pendingMotions ?? []).filter((m) => m.type !== ('join-request' as string)).length}</span>
          )}
        </button>
        <button onClick={() => setShowDocuments((v) => !v)}
          className={`text-xs px-3 py-1 rounded-lg transition-colors shrink-0 relative ${showDocuments ? 'bg-[#7B4A1E] text-white' : 'bg-[#2E1E0F] text-[#C4A882] hover:text-white'}`}>
          Documents
          {(() => {
            const activeCount = (committee.documents ?? []).filter((d) => d.status === 'submitted' || d.status === 'on-floor').length;
            return activeCount > 0 ? <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#7B4A1E] rounded-full text-white text-[10px] flex items-center justify-center font-bold">{activeCount}</span> : null;
          })()}
        </button>
        <button onClick={() => setShowChat((v) => !v)}
          className={`text-xs px-3 py-1 rounded-lg transition-colors shrink-0 relative ${showChat ? 'bg-[#7B4A1E] text-white' : 'bg-[#2E1E0F] text-[#C4A882] hover:text-white'}`}>
          💬 Chat
          {committee.messages.filter((m) => !m.content.startsWith('__log__:')).length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#7B4A1E] rounded-full text-white text-[10px] flex items-center justify-center font-bold">
              {committee.messages.filter((m) => !m.content.startsWith('__log__:')).length}
            </span>
          )}
        </button>
        <button onClick={() => { navigator.clipboard.writeText(committee.code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="text-xs font-mono bg-[#2E1E0F] hover:bg-[#3D2A15] text-white px-2.5 py-1 rounded-lg transition-colors shrink-0">
          {copied ? '✓' : committee.code}
        </button>
        <button onClick={() => setShowSettings(true)}
          className="text-[#7A5A38] hover:text-white transition-colors shrink-0 text-lg leading-none px-1"
          title="Session Settings">
          ⚙️
        </button>
      </header>


      {/* Join request banner */}
      {(committee.pendingMotions ?? []).filter((m) => m.type === ('join-request' as string)).length > 0 && (
        <div className="shrink-0 bg-[#1A0E06] border-b border-[#7B4A1E]/40 px-4 py-2 flex flex-col gap-1.5">
          {(committee.pendingMotions ?? [])
            .filter((m) => m.type === ('join-request' as string))
            .map((m) => {
              let delegateId = '';
              let desiredStatus: 'present' | 'present-voting' = 'present';
              try {
                const parsed = JSON.parse(m.topic);
                delegateId = parsed.delegateId;
                desiredStatus = parsed.desiredStatus;
              } catch { /* ignore */ }
              const found = getCountryByName(m.proposedBy);
              const flag = found ? getFlagEmoji(found.code) : '🌐';
              return (
                <div key={m.id} className="flex items-center gap-3 text-sm">
                  <span className="text-[#B8844A] font-bold shrink-0">🚪 Join Request</span>
                  <span className="font-mono text-lg">{flag}</span>
                  <span className="text-white font-semibold">{m.proposedBy}</span>
                  <span className="text-[#C4A882] text-xs">wants to join as</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${desiredStatus === 'present-voting' ? 'bg-blue-900/50 text-blue-300 border border-blue-700/40' : 'bg-green-900/50 text-green-300 border border-green-700/40'}`}>
                    {desiredStatus === 'present-voting' ? 'P+V' : 'P'}
                  </span>
                  <button
                    onClick={() => handleApproveJoinRequest(m.id, delegateId, desiredStatus)}
                    className="ml-2 px-3 py-1 bg-green-800/50 hover:bg-green-700/60 border border-green-700/40 text-green-300 rounded-lg text-xs font-bold transition-colors">
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => handleDenyJoinRequest(m.id)}
                    className="px-3 py-1 bg-red-950/50 hover:bg-red-900/60 border border-red-800/40 text-red-400 rounded-lg text-xs font-bold transition-colors">
                    ✕ Deny
                  </button>
                </div>
              );
            })}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {committee.phase === 'pre-session' && (
          <div className="flex-1 flex items-center justify-center px-6 py-8">
            <div className="w-full max-w-lg bg-[#1A1209] border border-[#2E1E0F] rounded-2xl overflow-hidden shadow-lg" style={{ height: '80vh', maxHeight: '640px' }}>
              <RollCallPanel committee={committee}
                  onAddToList={handleAddToSpeakersList}
                  onListIds={new Set(committee.speakersList.map((s) => s.delegateId))}
                  onRemoveFromList={handleRemoveFromSpeakersList}
                  onStatusChange={handleStatusChange}
                  onPhaseChange={handlePhaseChange}
                  onDelegateAdd={handleDelegateAdd}
                  isRollCallPhase={true} />
            </div>
          </div>
        )}

        {committee.phase !== 'pre-session' && (
          <>
            {showRollCall && (
              <aside className="w-64 border-r border-[#2E1E0F] bg-[#0D0906] flex flex-col overflow-hidden shrink-0">
                <RollCallPanel committee={committee}
                  onAddToList={handleAddToSpeakersList}
                  onListIds={new Set(committee.speakersList.map((s) => s.delegateId))}
                  onRemoveFromList={handleRemoveFromSpeakersList}
                  onStatusChange={handleStatusChange}
                  onPhaseChange={handlePhaseChange}
                  onDelegateAdd={handleDelegateAdd}
                  isRollCallPhase={false} />
              </aside>
            )}

            <main className="flex-1 overflow-hidden flex flex-col">
              {committee.phase === 'moderated-caucus' && committee.caucus && (
                <ModeratedCaucusView committee={committee} setCommittee={setCommittee} />
              )}
              {committee.phase === 'unmoderated-caucus' && committee.caucus && (
                <UnmoderatedCaucusView committee={committee} setCommittee={setCommittee} />
              )}
              {committee.phase === 'voting' && (
                <VotingView committee={committee} setCommittee={setCommittee} />
              )}
              {committee.phase === 'adjourned' && (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-5xl mb-4">🔔</div>
                    <h2 className="text-2xl font-black text-white mb-6">Session Adjourned</h2>
                    <button onClick={handleResumeSession}
                      className="bg-[#7B4A1E] hover:bg-[#8B5A2B] text-white px-8 py-3 rounded-xl font-bold transition-colors">
                      Resume Session
                    </button>
                  </div>
                </div>
              )}
              {committee.phase === 'speakers-list' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 flex flex-col items-center justify-center px-8 py-6 min-h-0 overflow-hidden">
                    {committee.currentSpeaker ? (
                      <>
                        {committee.speakersList.length > 0 && (
                          <DraggableSpeakersQueue
                            list={committee.speakersList}
                            onReorder={handleReorderSpeakersList}
                            onRemove={handleRemoveFromSpeakersList}
                          />
                        )}
                        {/* Fix 1: size="xl" — was "hero" (240px) which buried the buttons */}
                        <FlagCircle country={committee.currentSpeaker.country} size="xl" />
                        <h1 className="text-5xl font-black text-white mt-5 mb-2 text-center">{committee.currentSpeaker.country}</h1>
                        <div className={`text-7xl font-black font-mono mt-3 mb-4 tabular-nums ${
                          extraTimeAdded ? 'text-emerald-400' :
                          committee.speakerTimeRemaining <= 10 ? 'text-red-500' :
                          committee.speakerTimeRemaining <= 30 ? 'text-yellow-600' : 'text-white'
                        }`}>
                          {formatTime(committee.speakerTimeRemaining)}
                          {extraTimeAdded && <span className="text-base ml-2 font-normal text-emerald-500">+ext</span>}
                        </div>
                        <div className="w-full max-w-md h-2 bg-[#2E1E0F] rounded-full overflow-hidden mb-4">
                          <div className={`h-full rounded-full transition-all ${progress > 50 ? 'bg-[#B8844A]' : progress > 20 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${progress}%` }} />
                        </div>
                        {/* Fix 2: warn when this speaker is the last on the GSL */}
                        {isLastGSLSpeaker && (
                          <div className="mb-4 px-4 py-2 bg-yellow-900/30 border border-yellow-700/40 rounded-xl text-yellow-400 text-sm text-center max-w-sm">
                            Add at least one more delegate before starting — the GSL can never run out.
                          </div>
                        )}
                        <div className="flex gap-2 w-full max-w-sm mt-2 flex-wrap justify-center">
                          {/* Fix 2: Start blocked when last GSL speaker */}
                          <button onClick={() => setTimerRunning((r) => !r)}
                            disabled={isLastGSLSpeaker}
                            className={`flex-1 py-3 rounded-xl font-bold text-base transition-colors ${
                              timerRunning
                                ? 'bg-yellow-600 hover:bg-yellow-500 text-white'
                                : isLastGSLSpeaker
                                ? 'bg-[#2E1E0F] text-[#7A5A38] cursor-not-allowed'
                                : 'bg-[#3D6B35] hover:bg-[#4A7C42] text-white'
                            }`}>
                            {timerRunning ? '⏸ Pause' : '▶ Start'}
                          </button>
                          <button onClick={handleNextSpeaker} disabled={committee.speakersList.length === 0}
                            className="flex-1 bg-[#2E1E0F] hover:bg-[#3D2A15] disabled:opacity-40 disabled:cursor-not-allowed border border-[#2E1E0F] text-white py-3 rounded-xl font-bold text-base transition-colors">
                            Next →
                          </button>
                          <button onClick={() => setExtraTimeOpen(true)}
                            title="Add extra time to current speaker"
                            className="px-3 py-3 bg-[#2E1E0F] hover:bg-emerald-950/50 hover:border-emerald-700/50 border border-[#2E1E0F] text-emerald-400 rounded-xl font-bold text-sm transition-colors">
                            +⏱
                          </button>
                          <button onClick={() => setRightToReplyOpen(true)}
                            title="Right to Reply"
                            className="px-3 py-3 bg-[#2E1E0F] hover:bg-amber-950/50 hover:border-amber-700/50 border border-[#2E1E0F] text-amber-400 rounded-xl font-bold text-sm transition-colors">
                            ↩
                          </button>
                        </div>
                        {/* Extra time popover */}
                        {extraTimeOpen && (
                          <div className="mt-3 flex items-center gap-2 bg-[#1A1209] border border-emerald-700/40 rounded-xl px-4 py-2.5 w-full max-w-sm">
                            <span className="text-xs text-emerald-400 font-semibold shrink-0">Add time:</span>
                            <input type="number" min={5} max={300} value={extraTimeSecs}
                              onChange={(e) => setExtraTimeSecs(parseInt(e.target.value) || 30)}
                              className="w-16 bg-[#150F09] border border-[#2E1E0F] rounded-lg px-2 py-1 text-white text-xs text-center focus:outline-none" />
                            <span className="text-xs text-[#7A5A38]">sec</span>
                            <button onClick={handleAddExtraTime} className="ml-auto px-3 py-1 bg-emerald-800/50 hover:bg-emerald-700/60 text-emerald-300 rounded-lg text-xs font-bold">Add</button>
                            <button onClick={() => setExtraTimeOpen(false)} className="text-[#7A5A38] hover:text-white text-xs">✕</button>
                          </div>
                        )}
                        {/* Right to reply popover */}
                        {rightToReplyOpen && (
                          <div className="mt-3 flex items-center gap-2 bg-[#1A1209] border border-amber-700/40 rounded-xl px-4 py-2.5 w-full max-w-sm flex-wrap">
                            <span className="text-xs text-amber-400 font-semibold shrink-0 w-full mb-1">Right to Reply</span>
                            <select value={rtrCountry} onChange={(e) => setRtrCountry(e.target.value)}
                              className="flex-1 bg-[#150F09] border border-[#2E1E0F] rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none min-w-0">
                              <option value="">Select country…</option>
                              {committee.delegates.filter((d) => d.status !== 'absent').sort((a,b) => a.country.localeCompare(b.country)).map((d) => (
                                <option key={d.id} value={d.country}>{d.country}</option>
                              ))}
                            </select>
                            <input type="number" min={10} max={180} value={rtrSeconds}
                              onChange={(e) => setRtrSeconds(parseInt(e.target.value) || 30)}
                              className="w-14 bg-[#150F09] border border-[#2E1E0F] rounded-lg px-2 py-1 text-white text-xs text-center focus:outline-none" />
                            <span className="text-xs text-[#7A5A38]">sec</span>
                            <button onClick={handleRightToReply} disabled={!rtrCountry} className="px-3 py-1 bg-amber-800/50 hover:bg-amber-700/60 disabled:opacity-40 text-amber-300 rounded-lg text-xs font-bold">Grant</button>
                            <button onClick={() => setRightToReplyOpen(false)} className="text-[#7A5A38] hover:text-white text-xs">✕</button>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {committee.speakersList.length > 0 && (
                          <DraggableSpeakersQueue
                            list={committee.speakersList}
                            onReorder={handleReorderSpeakersList}
                            onRemove={handleRemoveFromSpeakersList}
                          />
                        )}
                        <div className="text-7xl mb-6">🎙️</div>
                        <h2 className="text-3xl font-black text-white mb-2">No Current Speaker</h2>
                        <p className="text-[#C4A882] mb-4 text-center">Add delegates below, then call the first speaker</p>
                        {committee.speakersList.length === 1 && (
                          <div className="mb-4 px-4 py-2 bg-yellow-900/30 border border-yellow-700/40 rounded-xl text-yellow-400 text-sm text-center max-w-sm">
                            Only 1 delegate on the list — add more before starting.
                          </div>
                        )}
                        <button onClick={handleNextSpeaker} disabled={committee.speakersList.length === 0 || committee.speakersList.length === 1}
                          className="bg-[#7B4A1E] hover:bg-[#8B5A2B] disabled:bg-[#2E1E0F] disabled:text-[#7A5A38] text-white px-10 py-4 rounded-xl font-bold text-lg transition-colors">
                          Call First Speaker
                        </button>
                      </>
                    )}
                  </div>

                  <div className="border-t border-[#2E1E0F] bg-[#0D0906] px-6 py-4">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-xs text-[#7A5A38] font-mono shrink-0">TIME</span>
                      <div className="flex gap-1.5">
                        {[30, 60, 90, 120, 180].map((t) => (
                          <button key={t} onClick={() => handleSetSpeakerTimeLimit(t)}
                            className={`text-xs px-2.5 py-1 rounded-lg transition-colors font-medium ${speakerTimeLimit === t ? 'bg-[#7B4A1E] text-white' : 'bg-[#1A1209] border border-[#2E1E0F] text-[#C4A882] hover:text-white'}`}>
                            {t}s
                          </button>
                        ))}
                        <input type="number" value={speakerTimeLimit}
                          onChange={(e) => handleSetSpeakerTimeLimit(parseInt(e.target.value) || 90)}
                          className="w-14 bg-[#150F09] border border-[#2E1E0F] rounded-lg px-2 py-1 text-white text-xs text-center focus:outline-none" />
                      </div>
                    </div>
                    <AddSpeakerInput committee={committee} onAdd={handleAddToSpeakersList} />
                  </div>
                </div>
              )}
            </main>

            {showChat && (
              <aside className="w-72 border-l border-[#2E1E0F] bg-[#0D0906] flex flex-col overflow-hidden shrink-0">
                <ChatPanel committee={committee} senderName={committee.chairName} isChair={true} />
              </aside>
            )}
          </>
        )}
      </div>

      {showMotions && (
        <MotionsModal
          committee={committee}
          onClose={() => setShowMotions(false)}
          onCommitteeUpdate={(updater) => updateLocal(setCommittee, updater)}
        />
      )}
      {showDocuments && (
        <DocumentsModal
          committee={committee}
          onClose={() => setShowDocuments(false)}
          onCommitteeUpdate={(updater) => updateLocal(setCommittee, updater)}
        />
      )}
      {showSettings && (
        <SettingsPanel
          committee={committee}
          onClose={() => setShowSettings(false)}
          onCodeChange={(newCode) => {
            setShowSettings(false);
            router.push(`/chair/${newCode}`);
          }}
        />
      )}
    </div>
  );
}