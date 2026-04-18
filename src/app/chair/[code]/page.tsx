'use client';
import { use, useEffect, useState, useRef, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Committee, DelegateStatus } from '@/lib/types';
import RollCallPanel, { FlagCircle } from '@/components/RollCallPanel';
import MotionsModal from '@/components/MotionsModal';
import DocumentsModal from '@/components/DocumentsModal';
import { getFlagEmoji, getCountryByName, UN_COUNTRIES } from '@/lib/countries';
import { SettingsPanel } from '@/components/SettingsPanel';
import { useSettingsStore } from '@/lib/settingsStore';
import ChatPanel from '@/components/ChatPanel';
import {
  getCommitteeByCode,
  subscribeToCommittee,
  setPhase as setPhaseInDB,
  setDelegateStatus as setDelegateStatusInDB,
  addToSpeakersList as addToSpeakersListInDB,
  removeFromSpeakersList as removeFromSpeakersListInDB,
  addToCaucusList as addToCaucusListInDB,
  removeFromCaucusList as removeFromCaucusListInDB,
  reorderSpeakersList as reorderSpeakersListInDB,
  nextSpeaker as nextSpeakerInDB,
  syncSpeakerTime as syncSpeakerTimeInDB,
  startSpeakerTimer as startSpeakerTimerInDB,
  stopSpeakerTimer as stopSpeakerTimerInDB,
  updateCaucus as updateCaucusInDB,
  approveJoinRequest,
  denyJoinRequest,
  approveGslRequest,
  denyGslRequest,
  logSpeakingTime,
  resumeSession as resumeSessionInDB,
  claimResumeSession as claimResumeSessionInDB,
  startResumeRollCall as startResumeRollCallInDB,
} from '@/lib/committeeService';

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

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

const COUNTRY_ABBREV: Record<string, string> = {
  'United Kingdom': 'UK',
  'United States': 'USA',
  'United Arab Emirates': 'UAE',
  'South Korea': 'S. Korea',
  'North Korea': 'N. Korea',
  'Democratic Republic of Congo': 'DR Congo',
  'Dominican Republic': 'D.R.',
  'Central African Republic': 'CAR',
  'Papua New Guinea': 'PNG',
  'Trinidad and Tobago': 'T&T',
  'Bosnia and Herzegovina': 'BiH',
  'Saint Kitts and Nevis': 'St. Kitts',
  'Saint Vincent and the Grenadines': 'St. Vincent',
  'Antigua and Barbuda': 'Antigua',
  'Equatorial Guinea': 'Eq. Guinea',
};
function abbrevCountry(name: string): string {
  return COUNTRY_ABBREV[name] ?? name;
}

type CommitteeSetter = React.Dispatch<React.SetStateAction<Committee | null>>;

const localUpdateTime = { current: 0 };

function updateLocal(setCommittee: CommitteeSetter, updater: (c: Committee) => Committee, structural = false) {
  if (structural) localUpdateTime.current = Date.now();
  setCommittee((prev) => prev ? updater(prev) : prev);
}

// ── Add Speaker Input ─────────────────────────────────────────────────────────
function AddSpeakerInput({ committee, onAdd }: { committee: Committee; onAdd: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const onList = new Set([
    ...committee.speakersList.map((s) => s.delegateId),
    ...(committee.currentSpeaker ? [committee.currentSpeaker.delegateId] : []),
  ]);
  const eligible = committee.delegates.filter(
    (d) => d.status !== 'absent' && d.id !== committee.currentSpeaker?.delegateId
  );
  const q = query.trim().toLowerCase();
  const matches = q
    ? eligible.filter((d) => d.country.trim().toLowerCase().startsWith(q))
        .concat(eligible.filter((d) => !d.country.trim().toLowerCase().startsWith(q) && d.country.trim().toLowerCase().includes(q)))
    : [];
  const topNotOnList = matches.find((d) => !onList.has(d.id)) ?? null;
  const commit = (d: typeof topNotOnList) => { if (!d || onList.has(d.id)) return; onAdd(d.id); setQuery(''); };
  return (
    <div className="relative">
      <div className="flex items-center bg-[#150F09] border border-[#2E1E0F] focus-within:border-[#7B4A1E] rounded-xl transition-colors">
        <input ref={inputRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(topNotOnList); } if (e.key === 'Escape') setQuery(''); }}
          placeholder="Add to speakers list..." autoFocus
          className="flex-1 bg-transparent px-4 py-3 text-white placeholder-[#7A5A38] focus:outline-none text-sm" />
        {topNotOnList && query && <span className="text-xs text-[#7A5A38] px-3 truncate max-w-[120px]">↵ {topNotOnList.country}</span>}
      </div>
      {query && matches.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#150F09] border border-[#2E1E0F] rounded-xl overflow-hidden shadow-xl z-10 max-h-48 overflow-y-auto">
          {matches.slice(0, 6).map((d, i) => {
            const found = getCountryByName(d.country);
            const alreadyOnList = onList.has(d.id);
            if (alreadyOnList) {
              return (
                <div key={d.id} className="w-full flex items-center gap-3 px-4 py-2.5 opacity-40">
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

// ── Right of Reply country input — type-ahead, no dropdown ───────────────────
function RtrCountryInput({
  committee,
  value,
  onChange,
}: {
  committee: Committee;
  value: string;
  onChange: (v: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const eligible = committee.delegates.filter((d) => d.status !== 'absent');
  const q = query.trim().toLowerCase();
  const matches = q
    ? eligible
        .filter((d) => d.country.trim().toLowerCase().startsWith(q))
        .concat(eligible.filter((d) =>
          !d.country.trim().toLowerCase().startsWith(q) &&
          d.country.trim().toLowerCase().includes(q)
        ))
    : [];
  const topMatch = matches[0] ?? null;

  return (
    <div className="relative flex-1">
      <div className="flex items-center bg-[#150F09] border border-[#2E1E0F] focus-within:border-[#7B4A1E] rounded-xl transition-colors">
        <input
          ref={inputRef}
          type="text"
          value={query}
          autoFocus
          onChange={(e) => { setQuery(e.target.value); onChange(''); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (topMatch) { setQuery(topMatch.country); onChange(topMatch.country); }
            }
            if (e.key === 'Escape') { setQuery(''); onChange(''); }
          }}
          placeholder="Type country…"
          className="flex-1 bg-transparent px-3 py-1.5 text-white text-xs placeholder-[#7A5A38] focus:outline-none"
        />
        {topMatch && query && !value && query.toLowerCase() !== topMatch.country.toLowerCase() && (
          <span className="text-[10px] text-[#7A5A38] px-2 truncate max-w-[90px]">↵ {topMatch.country}</span>
        )}
      </div>
      {query && matches.length > 0 && !value && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#150F09] border border-[#2E1E0F] rounded-xl overflow-hidden shadow-xl z-10">
          {matches.slice(0, 5).map((d, i) => {
            const found = getCountryByName(d.country);
            return (
              <button
                key={d.id}
                onMouseDown={(e) => { e.preventDefault(); setQuery(d.country); onChange(d.country); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${i === 0 ? 'bg-[#7B4A1E]/20 text-white' : 'text-[#E8D5B7] hover:bg-[#2E1E0F]'}`}
              >
                <span className="text-sm">{found ? getFlagEmoji(found.code) : '🌐'}</span>
                <span className="flex-1">{d.country}</span>
                {i === 0 && <span className="text-[#7A5A38] shrink-0">Enter ↵</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Caucus Speaker Queue ──────────────────────────────────────────────────────
function CaucusSpeakerQueue({ committee, spokenCountries, onRemove, onReorder, customTdT, currentSpeakerCountry, speakerOffset }: {
  committee: Committee; spokenCountries: string[]; onRemove: (delegateId: string) => void;
  onReorder?: (newList: { delegateId: string; country: string }[]) => void;
  customTdT?: boolean; currentSpeakerCountry?: string | null; speakerOffset?: number;
}) {
  const dragIndexRef = useRef<number | null>(null);
  if (committee.caucusQueue.length === 0) return null;
  const queueSize = committee.caucusQueue.length;
  const flagSize: 'xl' | 'md' = queueSize <= 8 ? 'xl' : 'md';
  const displayList = committee.caucusQueue.slice(0, 15);
  const overflow = queueSize > 15 ? queueSize - 15 : 0;
  // For custom TdT: count how many have spoken to determine speaker numbers
  const baseOffset = speakerOffset ?? 1;
  return (
    <div className="flex flex-wrap items-start gap-3 pt-1 pb-1 max-w-full justify-center">
      {displayList.map((s, i) => {
        const alreadySpoke = spokenCountries.includes(s.country);
        const isCurrentSpeakerEntry = customTdT && s.country === currentSpeakerCountry;
        const speakerNum = baseOffset + i + 1; // +1 since current speaker is not in queue
        const showMasked = customTdT && !isCurrentSpeakerEntry;
        return (
          <div key={s.delegateId} className="flex flex-col items-center gap-1 relative group"
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
            }}>
            <div className="relative">
              {showMasked ? (
                <div className={`${flagSize === 'xl' ? 'w-20 h-20' : 'w-12 h-12'} rounded-full bg-[#2E1E0F] flex items-center justify-center shrink-0`}>
                  <span style={{ fontSize: flagSize === 'xl' ? '2rem' : '1.4rem' }}>🌐</span>
                </div>
              ) : (
                <FlagCircle country={s.country} size={flagSize} />
              )}
              {alreadySpoke && !showMasked && (
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                  <span className="text-[9px] font-bold text-yellow-300">✓</span>
                </div>
              )}
            </div>
            <span className={`line-clamp-2 break-words whitespace-normal leading-tight max-w-[80px] text-xs font-semibold text-center ${alreadySpoke ? 'text-yellow-400' : 'text-[#C4A882]'}`}>
              {showMasked ? `Speaker ${speakerNum}` : abbrevCountry(s.country)}
            </span>
            {i === 0 && !alreadySpoke && <span className="text-sm font-bold text-[#B8844A]">Up next</span>}
            <button onClick={() => onRemove(s.delegateId)}
              className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full text-white text-[10px] hidden group-hover:flex items-center justify-center">✕</button>
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
function DraggableSpeakersQueue({ list, onReorder, onRemove }: {
  list: { delegateId: string; country: string }[];
  onReorder: (newList: { delegateId: string; country: string }[]) => void;
  onRemove: (delegateId: string) => void;
}) {
  const dragIndexRef = useRef<number | null>(null);
  const qLen = list.length;
  const displayItems = list.slice(0, 7);
  const overflow = qLen > 7 ? qLen - 7 : 0;
  return (
    <div className="flex flex-col items-center w-full mb-4">
      <div className="flex flex-nowrap items-start gap-4 pt-2 pb-1 justify-center">
        {displayItems.map((s, i) => (
          <div key={s.delegateId} className="flex flex-col items-center gap-1 relative group cursor-grab shrink-0"
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
            }}>
            <div className="rounded-full">
              <FlagCircle country={s.country} size="xl" />
            </div>
            <span className="line-clamp-2 break-words whitespace-normal leading-tight max-w-[80px] text-xs font-semibold text-[#C4A882] text-center">{abbrevCountry(s.country)}</span>
            {i === 0 && <span className="text-sm font-bold text-[#B8844A]">Up next</span>}
            <button onClick={() => onRemove(s.delegateId)}
              className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full text-white text-[10px] hidden group-hover:flex items-center justify-center">✕</button>
          </div>
        ))}
      </div>
      {overflow > 0 && (
        <div className="text-center text-xs text-[#7A5A38] mt-2">+{overflow} more in queue</div>
      )}
    </div>
  );
}

// ── Caucus Queue Sidebar (numbered list view for sidebar) ─────────────────────
function CaucusQueueSidebar({ committee, onRemove, onReorder }: {
  committee: Committee;
  onRemove: (delegateId: string) => void;
  onReorder: (newList: { delegateId: string; country: string }[]) => void;
}) {
  const dragIndexRef = useRef<number | null>(null);
  const queue = committee.caucusQueue ?? [];
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-[#2E1E0F] shrink-0">
        <span className="text-sm font-bold text-white">Speaker Queue</span>
        <span className="text-xs text-[#7A5A38] ml-2 font-mono">{queue.length} speakers</span>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {queue.length === 0 ? (
          <div className="px-4 py-8 text-center text-[#7A5A38] text-sm">No speakers queued</div>
        ) : (
          queue.map((s, i) => {
            const found = getCountryByName(s.country);
            return (
              <div
                key={s.delegateId}
                draggable
                onDragStart={() => { dragIndexRef.current = i; }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  const from = dragIndexRef.current;
                  if (from === null || from === i) return;
                  const newList = [...queue];
                  const [moved] = newList.splice(from, 1);
                  newList.splice(i, 0, moved);
                  onReorder(newList);
                  dragIndexRef.current = null;
                }}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all bg-[#150F09] border border-[#2E1E0F] hover:border-[#7B4A1E]/40 cursor-grab group"
              >
                <span className="text-xs text-[#7A5A38] font-mono w-5 text-right shrink-0">{i + 1}</span>
                <span className="text-lg shrink-0">{found ? getFlagEmoji(found.code) : '🌐'}</span>
                <span className="flex-1 text-sm text-white line-clamp-2 break-words whitespace-normal leading-tight">{s.country}</span>
                <button
                  onClick={() => onRemove(s.delegateId)}
                  className="text-[#7A5A38] hover:text-red-500 transition-colors text-xs opacity-0 group-hover:opacity-100 shrink-0"
                >✕</button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Caucus Add Speaker Input ──────────────────────────────────────────────────
function CaucusAddSpeakerInput({ committee, spokenCountries, onAdd, maxSpeakers, currentQueueLength }: {
  committee: Committee; spokenCountries: string[]; onAdd: (id: string) => void;
  maxSpeakers?: number; currentQueueLength?: number;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const onList = new Set((committee.caucusQueue ?? committee.speakersList).map((s) => s.delegateId));
  const eligible = committee.delegates.filter((d) => d.status !== 'absent');
  const isFull = maxSpeakers !== undefined && currentQueueLength !== undefined && currentQueueLength >= maxSpeakers;
  const cq = query.trim().toLowerCase();
  const matches = cq
    ? eligible.filter((d) => d.country.trim().toLowerCase().startsWith(cq))
        .concat(eligible.filter((d) => !d.country.trim().toLowerCase().startsWith(cq) && d.country.trim().toLowerCase().includes(cq)))
    : [];
  const topNotOnList = matches.find((d) => !onList.has(d.id)) ?? null;
  const commit = (d: typeof topNotOnList) => { if (!d || onList.has(d.id) || isFull) return; onAdd(d.id); setQuery(''); };
  return (
    <div className="relative">
      {isFull && (
        <div className="mb-2 text-xs text-yellow-500 text-center px-2">
          Queue full — {maxSpeakers} speaker{maxSpeakers !== 1 ? 's' : ''} fit in remaining time
        </div>
      )}
      <div className={`flex items-center bg-[#150F09] border rounded-xl transition-colors ${isFull ? 'border-yellow-700/40 opacity-60' : 'border-[#2E1E0F] focus-within:border-[#7B4A1E]'}`}>
        <input ref={inputRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(topNotOnList); } if (e.key === 'Escape') setQuery(''); }}
          placeholder={isFull ? 'Queue full' : 'Add to speakers list…'}
          disabled={isFull}
          className="flex-1 bg-transparent px-4 py-3 text-white placeholder-[#7A5A38] focus:outline-none text-sm disabled:cursor-not-allowed" />
        {topNotOnList && query && !isFull && <span className="text-xs text-[#7A5A38] px-3 truncate max-w-[120px]">↵ {topNotOnList.country}</span>}
      </div>
      {query && matches.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#150F09] border border-[#2E1E0F] rounded-xl overflow-hidden shadow-xl z-10 max-h-48 overflow-y-auto">
          {matches.slice(0, 6).map((d) => {
            const found = getCountryByName(d.country);
            const alreadyOnList = onList.has(d.id);
            const spoke = spokenCountries.includes(d.country);
            if (alreadyOnList) {
              return (
                <div key={d.id} className="w-full flex items-center gap-3 px-4 py-2.5 opacity-40">
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
  const { getSettings } = useSettingsStore();
  const moderatedName = getSettings(committee.code).motionNames?.moderated ?? 'Moderated Caucus';
  const [speakerRunning, setSpeakerRunning] = useState(false);
  const speakerRef = useRef<NodeJS.Timeout | null>(null);
  const caucusRef = useRef(committee.caucus);
  caucusRef.current = committee.caucus;
  const caucus = committee.caucus!;
  const spokenCountries = caucus.spokenCountries ?? [];
  const [showExtend, setShowExtend] = useState(false);
  const [extendMins, setExtendMins] = useState(5);
  const [showCaucusRtr, setShowCaucusRtr] = useState(false);
  const [caucusRtrCountry, setCaucusRtrCountry] = useState('');
  const [rtrCaucusId, setRtrCaucusId] = useState<string | null>(null);
  const isRtrActiveRef = useRef(false);

  useEffect(() => {
    if (speakerRunning) {
      const tick = () => {
        const c = caucusRef.current;
        if (!c || c.remainingTime <= 0) { setSpeakerRunning(false); return; }
        updateLocal(setCommittee, (prev) => {
          if (!prev.caucus) return prev;
          const newTotal = isRtrActiveRef.current
            ? prev.caucus.remainingTime
            : Math.max(0, prev.caucus.remainingTime - 1);
          const newSpeaker = Math.max(0, prev.caucus.speakerTimeRemaining - 1);
          if (newSpeaker === 0) setSpeakerRunning(false);
          return {
            ...prev,
            phase: newTotal === 0 ? 'speakers-list' : prev.phase,
            caucus: newTotal === 0 ? null : { ...prev.caucus, remainingTime: newTotal, speakerTimeRemaining: newSpeaker },
          };
        });
      };
      tick();
      speakerRef.current = setInterval(tick, 1000);
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
    // Don't re-add current speaker
    if (committee.caucus?.currentSpeaker === delegate.country) return;
    // Cap queue to fit within remaining total time
    const maxSpeakers = caucus.speakingTime > 0 ? Math.floor(caucus.remainingTime / caucus.speakingTime) : 0;
    if ((committee.caucusQueue ?? []).length >= maxSpeakers) return;
    const caucusNextPos = (committee.caucusQueue ?? []).length + 1;
    updateLocal(setCommittee, (c) => ({ ...c, caucusQueue: [...(c.caucusQueue ?? []), { delegateId, country: delegate.country }] }));
    addToCaucusListInDB(committee.id, delegateId, delegate.country, caucusNextPos);
  };

  const handleExtendCaucus = (extraSecs: number) => {
    updateLocal(setCommittee, (c) => {
      if (!c.caucus) return c;
      const newRemaining = c.caucus.remainingTime + extraSecs;
      const newTotal = c.caucus.totalTime + extraSecs;
      const updated = { ...c.caucus, remainingTime: newRemaining, totalTime: newTotal };
      updateCaucusInDB(committee.id, updated);
      return { ...c, caucus: updated };
    });
    setShowExtend(false);
  };

  const handleNext = () => {
    setSpeakerRunning(false);
    isRtrActiveRef.current = false;
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
    // Persist proposerPosition to DB immediately so realtime refetch won't re-show the prompt
    const updatedCaucus = { ...caucus, proposerPosition: position };
    updateCaucusInDB(committee.id, updatedCaucus);
    updateLocal(setCommittee, (c) => {
      if (!c.caucus) return c;
      const without = (c.caucusQueue ?? []).filter((s) => s.delegateId !== delegate.id);
      const newList = position === 'first' ? [entry, ...without] : [...without, entry];
      return { ...c, caucusQueue: newList, caucus: { ...c.caucus, proposerPosition: position } };
    });
  };

  const handleEndCaucus = () => {
    setSpeakerRunning(false);
    setPhaseInDB(committee.id, 'speakers-list');
    updateCaucusInDB(committee.id, null);
    updateLocal(setCommittee, (c) => ({ ...c, caucus: null, phase: 'speakers-list', caucusQueue: [] }), true);
  };

  const handleCaucusRtr = () => {
    if (!caucusRtrCountry) return;
    const delegate = committee.delegates.find((d) => d.country === caucusRtrCountry && d.status !== 'absent');
    if (!delegate) return;
    const rtrEntry = { delegateId: delegate.id, country: caucusRtrCountry };
    updateLocal(setCommittee, (c) => ({
      ...c,
      caucusQueue: [rtrEntry, ...(c.caucusQueue ?? [])],
      caucus: c.caucus ? { ...c.caucus, speakerTimeRemaining: Math.min(30, c.caucus.remainingTime) } : c.caucus,
    }));
    // RTR inserted at front — position 0 (other entries will shift on next reorder)
    addToCaucusListInDB(committee.id, delegate.id, caucusRtrCountry, 0);
    setRtrCaucusId(delegate.id);
    isRtrActiveRef.current = true;
    setCaucusRtrCountry('');
    setShowCaucusRtr(false);
  };

  const speakerProgress = caucus.speakingTime > 0 ? (caucus.speakerTimeRemaining / caucus.speakingTime) * 100 : 0;
  const totalProgress = caucus.totalTime > 0 ? (caucus.remainingTime / caucus.totalTime) * 100 : 0;

  if (caucus.proposerPosition === null) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <p className="text-xs text-[#7B4A1E] font-mono tracking-widest mb-4">MODERATED CAUCUS PROPOSED</p>
        <div className="mb-4"><FlagCircle country={caucus.proposedBy} size="xl" /></div>
        <h2 className="text-3xl font-black text-white mb-2">{caucus.proposedBy}</h2>
        <p className="text-[#C4A882] text-lg mb-8">
          proposed this caucus. Would they like to speak <span className="text-white font-semibold">first</span> or <span className="text-white font-semibold">last</span>?
        </p>
        <div className="flex gap-4 w-full max-w-sm">
          <button onClick={() => handleSetProposerPosition('first')} className="flex-1 py-5 rounded-2xl font-black text-xl bg-[#7B4A1E] hover:bg-[#8B5A2B] text-white transition-colors">First</button>
          <button onClick={() => handleSetProposerPosition('last')} className="flex-1 py-5 rounded-2xl font-black text-xl bg-[#2E1E0F] hover:bg-[#3D2A15] text-white transition-colors">Last</button>
        </div>
      </div>
    );
  }

  const isCustomTdT = !!(caucus.purpose?.includes('Custom') && caucus.purpose?.startsWith('Tour de Table'));

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-4 min-h-0">
        <div className="text-center mb-3">
          {(() => {
            const isTdT = caucus.purpose?.startsWith('Tour de Table');
            const title = isTdT ? 'TOUR DE TABLE' : moderatedName.toUpperCase();
            return <p className="text-5xl font-black text-[#B8844A] tracking-tight">{title}</p>;
          })()}
          {caucus.purpose && !caucus.purpose.startsWith('Tour de Table') && <p className="text-4xl font-bold text-[#C4A882] mt-1">{caucus.purpose}</p>}
          {spokenCountries.length > 0 && (
            <p className="text-xs text-yellow-500 mt-0.5">{spokenCountries.length} delegate{spokenCountries.length !== 1 ? 's' : ''} spoke</p>
          )}
        </div>
        {caucus.currentSpeaker ? (
          <>
            {committee.caucusQueue.length > 0 && (
              <div className="mb-4 w-full flex justify-center">
                <CaucusSpeakerQueue
                  committee={{...committee, caucusQueue: committee.caucusQueue.slice(1)}}
                  spokenCountries={spokenCountries}
                  onRemove={handleRemoveFromQueue}
                  onReorder={handleReorderCaucusQueue}
                  customTdT={isCustomTdT}
                  currentSpeakerCountry={caucus.currentSpeaker}
                  speakerOffset={spokenCountries.length + 1}
                />
              </div>
            )}
            {isCustomTdT && spokenCountries.length > 0
              ? <div className="text-6xl">🌐</div>
              : <FlagCircle country={caucus.currentSpeaker} size="xl" />
            }
            <h1 className="text-3xl font-black text-white mt-3 mb-1 text-center">
              {isCustomTdT && spokenCountries.length > 0
                ? `Speaker ${spokenCountries.length + 1}`
                : caucus.currentSpeaker}
            </h1>
            <div className={`text-6xl font-black font-mono mt-2 mb-3 tabular-nums ${caucus.speakerTimeRemaining <= 10 ? 'text-red-500' : caucus.speakerTimeRemaining <= 30 ? 'text-yellow-500' : 'text-white'}`}>
              {formatTime(caucus.speakerTimeRemaining)}
            </div>
            <div className="w-full max-w-md h-2 bg-[#2E1E0F] rounded-full overflow-hidden mb-4">
              <div className={`h-full rounded-full transition-all ${speakerProgress > 50 ? 'bg-[#B8844A]' : speakerProgress > 20 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${speakerProgress}%` }} />
            </div>
            <div className="flex gap-3 w-full max-w-sm flex-wrap justify-center">
              <button
                onClick={() => {
                  setSpeakerRunning(false);
                  updateLocal(setCommittee, (c) => {
                    if (!c.caucus) return c;
                    const resetTo = Math.min(c.caucus.speakingTime, c.caucus.remainingTime);
                    return { ...c, caucus: { ...c.caucus, speakerTimeRemaining: resetTo } };
                  });
                }}
                className="px-3 py-2.5 rounded-xl font-bold text-xs bg-[#2E1E0F] hover:bg-[#3D2A15] text-[#C4A882] transition-colors border border-[#2E1E0F]"
                title="Restart speaker time"
              >↺</button>
              <button onClick={() => setSpeakerRunning((r) => !r)} className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors ${speakerRunning ? 'bg-yellow-600 hover:bg-yellow-500 text-white' : 'bg-[#3D6B35] hover:bg-[#4A7C42] text-white'}`}>
                {speakerRunning ? '⏸ Pause' : '▶ Start'}
              </button>
              <button onClick={handleNext} className="flex-1 bg-[#2E1E0F] hover:bg-[#3D2A15] text-white py-2.5 rounded-xl font-bold text-sm transition-colors">
                Next →
              </button>
              {!caucus.purpose?.startsWith('Tour de Table') && (
                <button
                  onClick={() => setShowCaucusRtr((v) => !v)}
                  className={`px-3 py-2.5 rounded-xl font-bold text-xs transition-colors ${showCaucusRtr ? 'bg-orange-600 border-orange-500 text-white' : 'bg-orange-900/40 hover:bg-orange-800/50 border border-orange-700/40 text-orange-300'}`}
                >
                  Right of Reply
                </button>
              )}
            </div>
            {!caucus.purpose?.startsWith('Tour de Table') && showCaucusRtr && (
              <div className="mt-3 bg-[#1A1209] border border-orange-700/40 rounded-xl p-3 w-full max-w-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-orange-400 font-semibold">Right of Reply (30s)</span>
                  <button onClick={() => setShowCaucusRtr(false)} className="text-[#7A5A38] hover:text-white text-sm">✕</button>
                </div>
                <div className="flex gap-2 items-center mb-2">
                  <RtrCountryInput committee={committee} value={caucusRtrCountry} onChange={setCaucusRtrCountry} />
                </div>
                <button
                  onClick={handleCaucusRtr}
                  disabled={!caucusRtrCountry}
                  className="w-full py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs rounded-lg font-bold transition-colors"
                >
                  Grant Right of Reply
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            {committee.caucusQueue.length > 0 && (
              <div className="mb-4 w-full flex justify-center">
                <CaucusSpeakerQueue
                  committee={committee}
                  spokenCountries={spokenCountries}
                  onRemove={handleRemoveFromQueue}
                  onReorder={handleReorderCaucusQueue}
                  customTdT={isCustomTdT}
                  currentSpeakerCountry={null}
                  speakerOffset={spokenCountries.length}
                />
              </div>
            )}
            <div className="text-5xl mb-3">🎙</div>
            <h2 className="text-2xl font-black text-white mb-1">No Current Speaker</h2>
            <p className="text-[#C4A882] mb-4 text-center text-sm">Add delegates below, then call the first speaker.</p>
            <button onClick={handleNext} disabled={(committee.caucusQueue ?? []).length === 0}
              className="bg-[#7B4A1E] hover:bg-[#8B5A2B] disabled:bg-[#2E1E0F] disabled:text-[#7A5A38] text-white px-8 py-3 rounded-xl font-bold transition-colors">
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
          <button onClick={() => setShowExtend((v) => !v)} className="px-3 py-1.5 rounded-lg font-bold text-xs bg-[#2E1E0F] hover:bg-emerald-950/50 text-[#C4A882] hover:text-emerald-400 transition-colors border border-[#2E1E0F] hover:border-emerald-900/50">
            Extend
          </button>
          <button onClick={handleEndCaucus} className="px-3 py-1.5 rounded-lg font-bold text-xs bg-[#2E1E0F] hover:bg-red-950/50 text-[#C4A882] hover:text-red-400 transition-colors border border-[#2E1E0F] hover:border-red-900/50">
            End Caucus
          </button>
        </div>
        {showExtend && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-emerald-400 font-semibold shrink-0">Extend by</span>
            {[1, 2, 5, 10].map((m) => (
              <button key={m} onClick={() => handleExtendCaucus(m * 60)}
                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-900/30 hover:bg-emerald-800/40 border border-emerald-700/30 text-emerald-300 transition-colors">
                {m}m
              </button>
            ))}
            <input type="number" min={1} value={extendMins} onChange={(e) => setExtendMins(parseInt(e.target.value) || 1)}
              className="w-12 bg-[#150F09] border border-[#2E1E0F] rounded-lg px-2 py-1 text-white text-xs focus:outline-none" />
            <button onClick={() => handleExtendCaucus(extendMins * 60)}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-900/30 hover:bg-emerald-800/40 border border-emerald-700/30 text-emerald-300 transition-colors">
              + custom
            </button>
          </div>
        )}
        <CaucusAddSpeakerInput
          committee={committee}
          spokenCountries={spokenCountries}
          onAdd={handleAddToQueue}
          maxSpeakers={caucus.speakingTime > 0 ? Math.floor(caucus.remainingTime / caucus.speakingTime) : 0}
          currentQueueLength={(committee.caucusQueue ?? []).length}
        />
      </div>
    </div>
  );
}

// ── Unmoderated Caucus View ───────────────────────────────────────────────────
function UnmoderatedCaucusView({ committee, setCommittee }: { committee: Committee; setCommittee: CommitteeSetter }) {
  const { getSettings } = useSettingsStore();
  const unmoderatedName = getSettings(committee.code).motionNames?.unmoderated ?? 'Unmoderated Caucus';
  const [running, setRunning] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const caucus = committee.caucus!;
  const remainingRef = useRef(caucus.remainingTime);
  remainingRef.current = caucus.remainingTime;
  const [showExtendUnmod, setShowExtendUnmod] = useState(false);
  const [extendMinsUnmod, setExtendMinsUnmod] = useState(5);

  useEffect(() => {
    if (running) {
      const tick = () => {
        if (remainingRef.current <= 0) { setRunning(false); return; }
        updateLocal(setCommittee, (c) => {
          if (!c.caucus) return c;
          const newTotal = Math.max(0, c.caucus.remainingTime - 1);
          return { ...c, caucus: newTotal === 0 ? null : { ...c.caucus, remainingTime: newTotal } };
        });
      };
      tick();
      intervalRef.current = setInterval(tick, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const handleEndCaucus = () => {
    setRunning(false);
    setPhaseInDB(committee.id, 'speakers-list');
    updateCaucusInDB(committee.id, null);
    updateLocal(setCommittee, (c) => ({ ...c, caucus: null, phase: 'speakers-list', caucusQueue: [] }), true);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 py-12">
      <p className="text-xs text-purple-400 font-mono mb-4">{unmoderatedName.toUpperCase()}</p>
      {caucus.purpose && <p className="text-[#C4A882] mb-6">{caucus.purpose}</p>}
      <div className={`text-9xl font-black font-mono tabular-nums mb-8 ${caucus.remainingTime <= 30 ? 'text-red-500' : 'text-white'}`}>
        {formatTime(caucus.remainingTime)}
      </div>
      <div className="w-full max-w-sm h-2 bg-[#2E1E0F] rounded-full overflow-hidden mb-8">
        <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${caucus.totalTime > 0 ? (caucus.remainingTime / caucus.totalTime) * 100 : 0}%` }} />
      </div>
      <div className="flex gap-3 flex-wrap justify-center">
        <button onClick={() => setRunning((r) => !r)} className={`px-8 py-3 rounded-xl font-bold transition-colors ${running ? 'bg-yellow-600 hover:bg-yellow-500 text-white' : 'bg-[#3D6B35] hover:bg-[#4A7C42] text-white'}`}>
          {running ? '⏸ Pause' : '▶ Resume'}
        </button>
        <button onClick={() => setShowExtendUnmod((v) => !v)} className="px-4 py-3 rounded-xl font-bold bg-[#2E1E0F] hover:bg-emerald-950/50 text-[#C4A882] hover:text-emerald-400 transition-colors border border-[#2E1E0F] hover:border-emerald-900/50">
          Extend
        </button>
        <button onClick={handleEndCaucus} className="px-8 py-3 rounded-xl font-bold bg-[#2E1E0F] hover:bg-[#3D2A15] text-white transition-colors">
          End Caucus
        </button>
      </div>
      {showExtendUnmod && (
        <div className="flex items-center gap-2 mt-4">
          <span className="text-xs text-emerald-400 font-semibold shrink-0">Extend by</span>
          {[1, 2, 5, 10].map((m) => (
            <button key={m} onClick={() => {
              updateLocal(setCommittee, (c) => {
                if (!c.caucus) return c;
                const newRemaining = c.caucus.remainingTime + m * 60;
                const newTotal = c.caucus.totalTime + m * 60;
                const updated = { ...c.caucus, remainingTime: newRemaining, totalTime: newTotal };
                updateCaucusInDB(committee.id, updated);
                return { ...c, caucus: updated };
              });
              setShowExtendUnmod(false);
            }} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-900/30 hover:bg-emerald-800/40 border border-emerald-700/30 text-emerald-300 transition-colors">
              {m}m
            </button>
          ))}
          <input type="number" min={1} value={extendMinsUnmod} onChange={(e) => setExtendMinsUnmod(parseInt(e.target.value) || 1)}
            className="w-12 bg-[#150F09] border border-[#2E1E0F] rounded-lg px-2 py-1 text-white text-xs focus:outline-none" />
          <button onClick={() => {
            updateLocal(setCommittee, (c) => {
              if (!c.caucus) return c;
              const newRemaining = c.caucus.remainingTime + extendMinsUnmod * 60;
              const newTotal = c.caucus.totalTime + extendMinsUnmod * 60;
              const updated = { ...c.caucus, remainingTime: newRemaining, totalTime: newTotal };
              updateCaucusInDB(committee.id, updated);
              return { ...c, caucus: updated };
            });
            setShowExtendUnmod(false);
          }} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-900/30 hover:bg-emerald-800/40 border border-emerald-700/30 text-emerald-300 transition-colors">
            + custom
          </button>
        </div>
      )}
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
            strokeLinecap="round" transform="rotate(-90 50 50)" style={{ transition: 'stroke-dashoffset 0.3s' }} />
          <text x="50" y="56" textAnchor="middle" fill="white" fontSize="24" fontWeight="bold">{count}</text>
        </svg>
        <button onClick={onInc} className="absolute -top-1 -right-1 w-7 h-7 bg-[#2E1E0F] hover:bg-[#3D2A15] rounded-full text-white text-sm font-bold transition-colors">+</button>
        <button onClick={onDec} disabled={count === 0} className="absolute -bottom-1 -right-1 w-7 h-7 bg-[#2E1E0F] hover:bg-[#3D2A15] disabled:opacity-30 rounded-full text-white text-sm font-bold transition-colors">−</button>
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
    setVotes((p) => { const v = p[id] || { for: 0, against: 0, abstain: 0 }; return { ...p, [id]: { ...v, [field]: Math.max(0, v[field] + delta) } }; });
  const handleBack = () => { updateLocal(setCommittee, (c) => ({ ...c, phase: 'speakers-list' })); setPhaseInDB(committee.id, 'speakers-list'); };
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-8 max-w-2xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-white">Voting Procedure</h2>
          <button onClick={handleBack} className="text-sm text-[#C4A882] hover:text-white border border-[#2E1E0F] hover:border-[#7B4A1E] px-3 py-1.5 rounded-lg transition-colors">← Back to GSL</button>
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
                <div className={`text-center py-6 rounded-xl ${res.status === 'passed' ? 'bg-green-900/20' : 'bg-red-900/20'}`}>
                  <p className={`text-3xl font-black ${res.status === 'passed' ? 'text-green-400' : 'text-red-400'}`}>{res.status === 'passed' ? 'PASSED ✓' : 'FAILED ✗'}</p>
                  <p className="text-sm text-[#C4A882] mt-2">{v.for} in favour · {v.against} against · {v.abstain} abstain</p>
                </div>
              ) : (
                <div>
                  <div className="flex justify-around items-center mb-8">
                    <VoteCircle label="In Favour" count={v.for} total={totalPresent} strokeColor="#22c55e" onInc={() => adj(res.id, 'for', 1)} onDec={() => adj(res.id, 'for', -1)} />
                    <VoteCircle label="Abstain" count={v.abstain} total={totalPresent} strokeColor="#eab308" onInc={() => adj(res.id, 'abstain', 1)} onDec={() => adj(res.id, 'abstain', -1)} />
                    <VoteCircle label="Against" count={v.against} total={totalPresent} strokeColor="#ef4444" onInc={() => adj(res.id, 'against', 1)} onDec={() => adj(res.id, 'against', -1)} />
                  </div>
                  <button onClick={() => { const result = v.for > v.against ? 'passed' : 'failed'; updateLocal(setCommittee, (c) => ({ ...c, resolutions: c.resolutions.map((r) => r.id === res.id ? { ...r, status: result } : r) })); }}
                    className="w-full bg-[#7B4A1E] hover:bg-[#8B5A2B] text-white py-3 rounded-xl font-bold transition-colors">
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

// ── Session Ended Content ─────────────────────────────────────────────────────
function SessionEndedContent({ committee, hoursRemaining }: { committee: Committee; hoursRemaining: number | null }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
      <div className="text-5xl mb-6">🏁</div>
      <h1 className="text-5xl font-black text-white mb-4">This committee has ended.</h1>
      <p className="text-xl text-[#C4A882] mb-2">{committee.name}</p>
      <p className="text-lg text-[#7A5A38] mb-8">{committee.topic}</p>
      {hoursRemaining !== null && (
        <p className="text-base text-[#7A5A38]">{hoursRemaining} hour{hoursRemaining !== 1 ? 's' : ''} until committee is deleted</p>
      )}
      <p className="text-xs text-[#7A5A38] mt-8">Press ESC to return to main menu</p>
    </div>
  );
}

// ── Main Chair Session ────────────────────────────────────────────────────────
function ChairSessionInner({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const myChairName = searchParams.get('chairName') ?? '';
  const [committee, setCommittee] = useState<Committee | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionSuspended, setSessionSuspended] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [suspendTab, setSuspendTab] = useState<'suspend' | 'session'>('suspend');
  const [endedTab, setEndedTab] = useState<'ended' | 'session'>('ended');
  const [hoursRemaining, setHoursRemaining] = useState<number | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [showRollCall, setShowRollCall] = useState(true);
  const [showMotions, setShowMotions] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [copied, setCopied] = useState(false);
  const [speakerTimeLimit, setSpeakerTimeLimitLocal] = useState(90);
  const [showSettings, setShowSettings] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatReadCount, setChatReadCount] = useState(0);
  // Only one of these can be open at a time
  const [activePopover, setActivePopover] = useState<'extraTime' | 'rightToReply' | null>(null);
  const [extraTimeSecs, setExtraTimeSecs] = useState('');
  const [extraTimeAdded, setExtraTimeAdded] = useState(false);
  // RTR overlay — completely independent of GSL
  const [rtrOpen, setRtrOpen] = useState(false);
  const [rtrCountry, setRtrCountry] = useState('');
  const [rtrSeconds, setRtrSeconds] = useState(30);
  const [rtrTimerActive, setRtrTimerActive] = useState(false);
  const [rtrTimeRemaining, setRtrTimeRemaining] = useState(30);
  const rtrIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Isolated timer atom — ticks never touch the `committee` object, preventing
  // whole-tree re-renders every second.
  const [speakerTimeRemaining, setSpeakerTimeRemaining] = useState(90);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerRunningRef = useRef(false);
  const committeeIdRef = useRef('');
  const speakerTimeLimitRef = useRef(speakerTimeLimit);
  // Mutable map of delegateId → current status — updated immediately on each cycle
  // so rapid clicks read the post-click status, not the pre-re-render (stale) status.
  const delegateStatusRef = useRef<Map<string, DelegateStatus>>(new Map());
  timerRunningRef.current = timerRunning;
  speakerTimeLimitRef.current = speakerTimeLimit;

  useEffect(() => {
    if (committee) document.title = `${abbreviateCommitteeName(committee.name)} — Gavelling Session`;
    return () => { document.title = 'Gavelling'; };
  }, [committee?.name]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    async function load() {
      const found = await getCommitteeByCode(code);
      if (found) {
        if (found.suspendedAt) {
          setSessionSuspended(true);
        } else if (found.endedAt) {
          setSessionEnded(true);
        }
      }
      setCommittee(found ?? null);
      if (found) {
        setSpeakerTimeLimitLocal(found.speakerTimeLimit);
        setSpeakerTimeRemaining(found.speakerTimeRemaining);
        committeeIdRef.current = found.id;
      }
      setLoading(false);
      if (found) {
        unsubscribe = subscribeToCommittee(found.id, async () => {
          const withinDebounce = Date.now() - localUpdateTime.current < 3000;
          const updated = await getCommitteeByCode(code);
          if (!updated) return;

          if (withinDebounce) {
            // During debounce: only sync pendingMotions and session state — never touch timer or structural state
            setCommittee((prev) => {
              if (!prev) return prev;
              let next = { ...prev, pendingMotions: updated.pendingMotions };
              if (updated.endedAt) next = { ...next, endedAt: updated.endedAt, expiresAt: updated.expiresAt };
              if (updated.suspendedAt !== prev.suspendedAt) next = { ...next, suspendedAt: updated.suspendedAt, resumingChair: updated.resumingChair, phase: updated.phase };
              return next;
            });
            if (updated.endedAt) { setSessionEnded(true); setSessionSuspended(false); }
            else if (updated.suspendedAt) { setSessionSuspended(true); }
            else { setSessionSuspended(false); }
            return;
          }

          // Outside debounce: full update
          if (updated.endedAt) {
            setSessionEnded(true);
          } else if (updated.suspendedAt) {
            setSessionSuspended(true);
          } else {
            setSessionEnded(false);
            setSessionSuspended(false);
          }
          setCommittee(updated);
          // Sync isolated timer atom only when local timer is not running
          if (!timerRunningRef.current) {
            if (updated.speakerStartedAt) {
              const elapsed = Math.round((Date.now() - new Date(updated.speakerStartedAt).getTime()) / 1000);
              setSpeakerTimeRemaining(Math.max(0, updated.speakerTimeLimit - elapsed));
            } else {
              setSpeakerTimeRemaining(updated.speakerTimeRemaining);
            }
          }
        });
      }
    }
    load();
    return () => unsubscribe?.();
  }, [code]);

  // Timer — isolated: only updates the speakerTimeRemaining atom, never the committee object.
  // This prevents whole-tree re-renders every second (S1).
  // tickSpeakerTimerInDB removed — DB is synced only at pause/next/expire (S2).
  useEffect(() => {
    if (timerRunning) {
      const tick = () => {
        setSpeakerTimeRemaining((prev) => {
          const next = Math.max(0, prev - 1);
          if (next === 0) setTimerRunning(false);
          return next;
        });
      };
      // Fire once immediately (fixes 1-second delay), then every 1000ms
      tick();
      intervalRef.current = setInterval(tick, 1000);
    } else {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    }
    return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };
  }, [timerRunning]);

  // RTR overlay countdown — fully independent of speakersList/DB
  useEffect(() => {
    if (rtrTimerActive) {
      rtrIntervalRef.current = setInterval(() => {
        setRtrTimeRemaining((prev) => {
          if (prev <= 1) { setRtrTimerActive(false); return 0; }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (rtrIntervalRef.current) { clearInterval(rtrIntervalRef.current); rtrIntervalRef.current = null; }
    }
    return () => { if (rtrIntervalRef.current) { clearInterval(rtrIntervalRef.current); rtrIntervalRef.current = null; } };
  }, [rtrTimerActive]);

  // Keep delegateStatusRef in sync with DB truth (realtime events, initial load).
  // Cycles update the ref immediately; this effect reconciles external changes.
  useEffect(() => {
    if (!committee?.delegates) return;
    const incoming = new Map(committee.delegates.map((d) => [d.id, d.status]));
    // Only overwrite entries that have NOT been dirtied by a pending cycle
    // (i.e. entries not currently "in flight"). Simplest safe approach: full replace.
    delegateStatusRef.current = incoming;
  }, [committee?.delegates]);

  // Stable Set references — prevents RollCallPanel re-renders when only timer ticks
  const gslListIds = useMemo(
    () => {
      const ids = new Set((committee?.speakersList ?? []).map((s) => s.delegateId));
      if (committee?.currentSpeaker?.delegateId) ids.add(committee.currentSpeaker.delegateId);
      return ids;
    },
    [committee?.speakersList, committee?.currentSpeaker]
  );
  const caucusQueueIds = useMemo(
    () => new Set((committee?.caucusQueue ?? []).map((s) => s.delegateId)),
    [committee?.caucusQueue]
  );

  // ── Stable callbacks (must be before early returns — Rules of Hooks) ──────────

  // Cycle a delegate's roll-call status using a mutable ref so rapid clicks always
  // read the post-previous-click status, not a stale render closure.
  const handleCycleStatus = useCallback((delegateId: string) => {
    const current = delegateStatusRef.current.get(delegateId);
    if (current === undefined) return;
    const next: DelegateStatus =
      current === 'absent' ? 'present' : current === 'present' ? 'present-voting' : 'absent';
    delegateStatusRef.current.set(delegateId, next); // Update ref immediately before re-render
    updateLocal(setCommittee, (c) => ({
      ...c,
      delegates: c.delegates.map((d) => d.id === delegateId ? { ...d, status: next } : d),
      ...(next === 'absent' ? {
        speakersList: c.speakersList.filter((s) => s.delegateId !== delegateId),
        caucusQueue: (c.caucusQueue ?? []).filter((s) => s.delegateId !== delegateId),
      } : {}),
    }), true);
    setDelegateStatusInDB(delegateId, next);
    if (next === 'absent') {
      removeFromSpeakersListInDB(committeeIdRef.current, delegateId);
      removeFromCaucusListInDB(committeeIdRef.current, delegateId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddToSpeakersList = useCallback((delegateId: string) => {
    if (!committee) return;
    const delegate = committee.delegates.find((d) => d.id === delegateId);
    if (!delegate) return;
    const alreadyOn = committee.speakersList.some((s) => s.delegateId === delegateId);
    if (alreadyOn) return;
    if (committee.currentSpeaker?.delegateId === delegateId) return;
    // Pass position from local state to skip the SELECT round-trip in the DB function,
    // keeping the write under the debounce window (Bug 1 fix)
    const nextPosition = committee.speakersList.length + 1;
    updateLocal(setCommittee, (c) => ({ ...c, speakersList: [...c.speakersList, { delegateId, country: delegate.country }] }), true);
    addToSpeakersListInDB(committee.id, delegateId, delegate.country, nextPosition);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee?.id, committee?.delegates, committee?.speakersList, committee?.currentSpeaker]);

  const handleRemoveFromSpeakersList = useCallback((delegateId: string) => {
    if (!committee) return;
    updateLocal(setCommittee, (c) => ({ ...c, speakersList: c.speakersList.filter((s) => s.delegateId !== delegateId) }), true);
    removeFromSpeakersListInDB(committee.id, delegateId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee?.id]);

  const handleReorderSpeakersList = useCallback((newList: { delegateId: string; country: string }[]) => {
    if (!committee) return;
    updateLocal(setCommittee, (c) => ({ ...c, speakersList: newList }), true);
    reorderSpeakersListInDB(committee.id, newList, 'gsl');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee?.id]);

  const handleStatusChange = useCallback((delegateId: string, status: DelegateStatus) => {
    if (!committee) return;
    updateLocal(setCommittee, (c) => ({
      ...c,
      delegates: c.delegates.map((d) => d.id === delegateId ? { ...d, status } : d),
      ...(status === 'absent' ? {
        speakersList: c.speakersList.filter((s) => s.delegateId !== delegateId),
        caucusQueue: (c.caucusQueue ?? []).filter((s) => s.delegateId !== delegateId),
      } : {}),
    }), true);
    setDelegateStatusInDB(delegateId, status);
    if (status === 'absent') {
      removeFromSpeakersListInDB(committee.id, delegateId);
      removeFromCaucusListInDB(committee.id, delegateId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee?.id]);

  const handleDelegateAdd = useCallback(async (country: string) => {
    if (!committee) return;
    const { addDelegate: addDelegateInDB } = await import('@/lib/committeeService');
    const realId = await addDelegateInDB(committee.id, country);
    if (realId) {
      updateLocal(setCommittee, (c) => ({
        ...c,
        delegates: [...c.delegates, { id: realId, country, status: 'absent' }],
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee?.id]);

  useEffect(() => {
    if (!sessionEnded && !sessionSuspended) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') router.push('/'); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [sessionEnded, sessionSuspended, router]);

  useEffect(() => {
    if (committee?.endedAt) {
      setSessionEnded(true);
      setSessionSuspended(false);
    } else if (committee?.suspendedAt) {
      setSessionSuspended(true);
      setSessionEnded(false);
    }
  }, [committee?.endedAt, committee?.suspendedAt]);

  useEffect(() => {
    if (!committee?.expiresAt) { setHoursRemaining(null); return; }
    function calc() {
      const ms = new Date(committee!.expiresAt!).getTime() - Date.now();
      setHoursRemaining(Math.max(0, Math.floor(ms / (1000 * 60 * 60))));
    }
    calc();
    const id = setInterval(calc, 60_000);
    return () => clearInterval(id);
  }, [committee?.expiresAt]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D0906] flex items-center justify-center">
        <div className="text-center">
          {/* Loading GIF — add loading.gif to /public/ */}
          <img
            src="/loading.gif"
            alt="Loading…"
            className="w-20 h-20 mx-auto mb-4 object-contain"
            onError={(e) => {
              // Fallback to spinner if gif not present
              (e.target as HTMLImageElement).style.display = 'none';
              const fallback = document.createElement('div');
              fallback.className = 'w-8 h-8 border-2 border-[#7B4A1E] border-t-transparent rounded-full animate-spin mx-auto mb-4';
              (e.target as HTMLImageElement).parentElement?.prepend(fallback);
            }}
          />
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
          <Link href="/create" className="bg-[#7B4A1E] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#8B5A2B] transition-colors">Create Committee</Link>
        </div>
      </div>
    );
  }

  const present = committee.delegates.filter((d) => d.status !== 'absent').length;
  const progress = committee.currentSpeaker ? (speakerTimeRemaining / committee.speakerTimeLimit) * 100 : 0;
  const isPreSession = committee.phase === 'pre-session';

  // ── Optimistic action handlers ──────────────────────────────────────────────

  const handleNextSpeaker = async () => {
    setTimerRunning(false);
    stopSpeakerTimerInDB(committeeIdRef.current);
    setExtraTimeAdded(false);

    if (committee.currentSpeaker) {
      const secondsSpoken = committee.speakerTimeLimit - speakerTimeRemaining;
      if (secondsSpoken > 0) {
        const ctx = committee.phase === 'moderated-caucus' ? 'moderated-caucus' : 'speakers-list';
        const topic = committee.phase === 'moderated-caucus'
          ? (committee.caucus?.purpose ?? committee.topic)
          : committee.topic;
        logSpeakingTime(committee.id, committee.currentSpeaker.country, secondsSpoken, ctx, topic);
      }
    }

    const removeDelegateId = committee.speakersList[0]?.delegateId ?? null;
    const [next, ...rest] = committee.speakersList;
    const timeToUse = speakerTimeLimit;

    setSpeakerTimeRemaining(timeToUse);

    localUpdateTime.current = Date.now();

    updateLocal(setCommittee, (c) => ({
      ...c,
      currentSpeaker: next ?? null,
      speakersList: rest,
      speakerTimeRemaining: timeToUse,
    }));

    await nextSpeakerInDB(
      committee.id,
      timeToUse,
      next?.delegateId ?? null,
      next?.country ?? null,
      removeDelegateId,
    );
    localUpdateTime.current = Date.now();
  };

  const handleAddExtraTime = (secs: number) => {
    setSpeakerTimeRemaining((prev) => prev + secs);
    setExtraTimeAdded(true);
    setActivePopover(null);
    setExtraTimeSecs('');
  };

  const handleToggleTimer = () => {
    const starting = !timerRunning;
    setTimerRunning(starting);
    if (starting) {
      startSpeakerTimerInDB(committeeIdRef.current);
    } else {
      // Sync current remaining time to DB on pause (S2 — no per-second writes)
      stopSpeakerTimerInDB(committeeIdRef.current);
      syncSpeakerTimeInDB(committeeIdRef.current, speakerTimeRemaining);
    }
  };

  const handleRestartTime = () => {
    setTimerRunning(false);
    stopSpeakerTimerInDB(committeeIdRef.current);
    setExtraTimeAdded(false);
    setSpeakerTimeRemaining(speakerTimeLimit);
  };

  const handleSetSpeakerTimeLimit = (seconds: number) => {
    setSpeakerTimeLimitLocal(seconds);
    setSpeakerTimeRemaining(seconds);
    updateLocal(setCommittee, (c) => ({ ...c, speakerTimeLimit: seconds, speakerTimeRemaining: seconds }));
  };

  const handleResumeSession = () => {
    updateLocal(setCommittee, (c) => ({ ...c, phase: 'speakers-list' }));
    setPhaseInDB(committee.id, 'speakers-list');
  };

  const handleResumeClick = async () => {
    if (!committee) return;
    const claimedName = myChairName || committee.chairNames[0] || 'Chair';
    const claimed = await claimResumeSessionInDB(committee.id, claimedName);
    if (!claimed) return;
    updateLocal(setCommittee, (c) => ({ ...c, phase: 'pre-session', suspendedAt: null }));
    setSessionSuspended(false);
    await startResumeRollCallInDB(committee.id);
  };

  const handlePhaseChange = (phase: string) => {
    updateLocal(setCommittee, (c) => ({ ...c, phase: phase as Committee['phase'] }), true);
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

  const handleApproveGslRequest = async (motionId: string, delegateId: string, country: string) => {
    await approveGslRequest(committee.id, motionId, delegateId, country);
    const delegate = committee.delegates.find((d) => d.id === delegateId);
    if (!delegate) return;
    updateLocal(setCommittee, (c) => ({
      ...c,
      speakersList: [...c.speakersList, { delegateId, country }],
      pendingMotions: c.pendingMotions.filter((m) => m.id !== motionId),
    }));
  };

  const handleDenyGslRequest = async (motionId: string) => {
    await denyGslRequest(motionId);
    updateLocal(setCommittee, (c) => ({
      ...c,
      pendingMotions: c.pendingMotions.filter((m) => m.id !== motionId),
    }));
  };

  const isLastGSLSpeaker = committee.speakersList.length === 0;

  // Blocked modal handler — only allow after roll call
  const handleMotionsClick = () => {
    if (isPreSession) return;
    setShowMotions((v) => !v);
  };
  const handleDocumentsClick = () => {
    if (isPreSession) return;
    setShowDocuments((v) => !v);
  };
  const handleToggleChat = () => {
    const newShow = !showChat;
    setShowChat(newShow);
    if (newShow) setChatReadCount(committee?.messages.filter(m => !m.content.startsWith('__log__:')).length ?? 0);
  };

  return (
    <div className="h-screen bg-[#0D0906] flex flex-col overflow-hidden">
      <header className="border-b border-[#2E1E0F] bg-[#150F08] px-4 h-11 flex items-center gap-2">
        <Link href="/">
          <img src="/gavelling-logo.png" alt="Gavelling" className="w-[16vw] h-auto max-h-9 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </Link>
        <span className="font-bold text-white text-sm truncate">{committee.name}</span>
        <span className="text-[#7A5A38] text-xs hidden sm:block truncate flex-1">{committee.topic}</span>
        {committee.phase !== 'pre-session' && (
          <button onClick={() => setShowRollCall((v) => !v)}
            className={`text-xs px-3 py-1 rounded-lg transition-colors shrink-0 ${showRollCall ? 'bg-[#7B4A1E] text-white' : 'bg-[#2E1E0F] text-[#C4A882] hover:text-white'}`}>
            Roll Call {present}/{committee.delegates.length}
          </button>
        )}
        {/* Motions — disabled during pre-session or when ended */}
        {!sessionEnded && (
          <button
            onClick={handleMotionsClick}
            title={isPreSession ? 'Complete roll call first' : undefined}
            className={`text-xs px-3 py-1 rounded-lg transition-colors shrink-0 relative ${
              isPreSession ? 'opacity-40 cursor-not-allowed bg-[#2E1E0F] text-[#7A5A38]' :
              showMotions ? 'bg-[#7B4A1E] text-white' : 'bg-[#2E1E0F] text-[#C4A882] hover:text-white'
            }`}>
            Motions
            {!isPreSession && (committee.pendingMotions ?? []).filter((m) => m.type !== ('join-request' as string) && (m.type as string) !== 'gsl-request').length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#7B4A1E] rounded-full text-white text-[10px] flex items-center justify-center">
                {(committee.pendingMotions ?? []).filter((m) => m.type !== ('join-request' as string) && (m.type as string) !== 'gsl-request').length}
              </span>
            )}
          </button>
        )}
        {/* Documents — disabled during pre-session or when ended */}
        {!sessionEnded && (
        <button
          onClick={handleDocumentsClick}
          title={isPreSession ? 'Complete roll call first' : undefined}
          className={`text-xs px-3 py-1 rounded-lg transition-colors shrink-0 relative ${
            isPreSession ? 'opacity-40 cursor-not-allowed bg-[#2E1E0F] text-[#7A5A38]' :
            showDocuments ? 'bg-[#7B4A1E] text-white' : 'bg-[#2E1E0F] text-[#C4A882] hover:text-white'
          }`}>
          Documents
          {!isPreSession && (() => {
            const activeCount = (committee.documents ?? []).filter((d) => d.status === 'submitted').length;
            return activeCount > 0 ? <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#7B4A1E] rounded-full text-white text-[10px] flex items-center justify-center">{activeCount}</span> : null;
          })()}
        </button>
        )}
        {/* Chat — disabled during pre-session or when ended */}
        {!sessionEnded && (
        <button
          onClick={() => { if (!isPreSession) handleToggleChat(); }}
          title={isPreSession ? 'Complete roll call first' : undefined}
          className={`text-xs px-3 py-1 rounded-lg transition-colors shrink-0 relative ${
            isPreSession ? 'opacity-40 cursor-not-allowed bg-[#2E1E0F] text-[#7A5A38]' :
            showChat ? 'bg-[#7B4A1E] text-white' : 'bg-[#2E1E0F] text-[#C4A882] hover:text-white'
          }`}>
          💬 Chat
          {!isPreSession && (() => {
            const total = committee.messages.filter((m) => !m.content.startsWith('__log__:')).length;
            const unread = total - chatReadCount;
            return unread > 0 && !showChat ? (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#7B4A1E] rounded-full text-white text-[10px] flex items-center justify-center">
                {unread}
              </span>
            ) : null;
          })()}
        </button>
        )}
        <button onClick={() => { navigator.clipboard.writeText(committee.code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="text-xs font-mono bg-[#2E1E0F] hover:bg-[#3D2A15] text-white px-2.5 py-1 rounded-lg transition-colors shrink-0">
          {copied ? '✓' : committee.code}
        </button>
        <button onClick={() => setShowSettings(true)} className="text-[#7A5A38] hover:text-white transition-colors shrink-0 text-3xl">⚙</button>
      </header>
      {/* Ended tab bar */}
      {sessionEnded && (
        <div className="flex border-b border-[#2E1E0F] bg-[#150F08] shrink-0">
          <button onClick={() => setEndedTab('ended')}
            className={`flex-1 py-2.5 text-sm font-bold transition-colors border-b-2 ${endedTab === 'ended' ? 'text-white border-[#7B4A1E]' : 'text-[#7A5A38] border-transparent hover:text-[#C4A882]'}`}>
            🏁 End View
          </button>
          <button onClick={() => setEndedTab('session')}
            className={`flex-1 py-2.5 text-sm font-bold transition-colors border-b-2 ${endedTab === 'session' ? 'text-white border-[#7B4A1E]' : 'text-[#7A5A38] border-transparent hover:text-[#C4A882]'}`}>
            👁 Session View
          </button>
        </div>
      )}
      {/* Suspend tab bar */}
      {!sessionEnded && sessionSuspended && (
        <div className="flex border-b border-[#2E1E0F] bg-[#150F08] shrink-0">
          <button onClick={() => setSuspendTab('suspend')}
            className={`flex-1 py-2.5 text-sm font-bold transition-colors border-b-2 ${suspendTab === 'suspend' ? 'text-white border-[#7B4A1E]' : 'text-[#7A5A38] border-transparent hover:text-[#C4A882]'}`}>
            ⏸ Suspend View
          </button>
          <button onClick={() => setSuspendTab('session')}
            className={`flex-1 py-2.5 text-sm font-bold transition-colors border-b-2 ${suspendTab === 'session' ? 'text-white border-[#7B4A1E]' : 'text-[#7A5A38] border-transparent hover:text-[#C4A882]'}`}>
            🪑 Session View
          </button>
        </div>
      )}
      {sessionEnded && endedTab === 'session' && (
        <div className="shrink-0 bg-amber-900/20 border-b border-amber-700/40 px-4 py-2 text-center text-amber-300 text-sm font-semibold">
          Session has ended — view only
        </div>
      )}
      {!sessionEnded && sessionSuspended && suspendTab === 'session' && (
        <div className="shrink-0 bg-amber-900/20 border-b border-amber-700/40 px-4 py-2 text-center text-amber-300 text-sm font-semibold">
          Session is suspended — delegates cannot see this view
        </div>
      )}
      {/* Join request banner */}
      {(committee.pendingMotions ?? []).filter((m) => m.type === ('join-request' as string)).length > 0 && (
        <div className="shrink-0 bg-[#1A0E06] border-b border-[#7B4A1E]/40 px-4 py-2 flex flex-wrap gap-4">
          {(committee.pendingMotions ?? [])
            .filter((m) => m.type === ('join-request' as string))
            .map((m) => {
              let delegateId = '';
              let desiredStatus: 'present' | 'present-voting' = 'present';
              try { const parsed = JSON.parse(m.topic); delegateId = parsed.delegateId; desiredStatus = parsed.desiredStatus; } catch {}
              const found = getCountryByName(m.proposedBy);
              const flag = found ? getFlagEmoji(found.code) : '🌐';
              return (
                <div key={m.id} className="flex items-center gap-3 text-sm">
                  <span className="text-[#B8844A] font-bold shrink-0">🚪 Join Request</span>
                  <span className="font-mono text-lg">{flag}</span>
                  <span className="text-white font-semibold">{m.proposedBy}</span>
                  <span className="text-[#C4A882] text-xs">wants to join as</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${desiredStatus === 'present-voting' ? 'bg-blue-900/40 text-blue-300' : 'bg-green-900/40 text-green-300'}`}>
                    {desiredStatus === 'present-voting' ? 'P+V' : 'P'}
                  </span>
                  <button onClick={() => handleApproveJoinRequest(m.id, delegateId, desiredStatus)}
                    className="ml-2 px-3 py-1 bg-green-800/50 hover:bg-green-700/60 border border-green-700/50 text-green-300 text-xs rounded-lg font-semibold transition-colors">Approve</button>
                  <button onClick={() => handleDenyJoinRequest(m.id)}
                    className="px-3 py-1 bg-red-950/50 hover:bg-red-900/60 border border-red-900/50 text-red-400 text-xs rounded-lg font-semibold transition-colors">Deny</button>
                </div>
              );
            })}
        </div>
      )}
      {/* GSL speak request banner */}
      {(committee.pendingMotions ?? []).filter((m) => (m.type as string) === 'gsl-request').length > 0 && (
        <div className="shrink-0 bg-[#0E1A0E] border-b border-green-800/40 px-4 py-2 flex flex-wrap gap-4">
          {(committee.pendingMotions ?? [])
            .filter((m) => (m.type as string) === 'gsl-request')
            .map((m) => {
              let delegateId = '';
              try { const parsed = JSON.parse(m.topic); delegateId = parsed.delegateId; } catch {}
              const found = getCountryByName(m.proposedBy);
              const flag = found ? getFlagEmoji(found.code) : '🌐';
              return (
                <div key={m.id} className="flex items-center gap-3 text-sm">
                  <span className="text-green-400 font-bold shrink-0">🎙️ GSL Request</span>
                  <span className="font-mono text-lg">{flag}</span>
                  <span className="text-white font-semibold">{m.proposedBy}</span>
                  <span className="text-[#C4A882] text-xs">wants to speak</span>
                  <button onClick={() => handleApproveGslRequest(m.id, delegateId, m.proposedBy)}
                    className="ml-2 px-3 py-1 bg-green-800/50 hover:bg-green-700/60 border border-green-700/50 text-green-300 text-xs rounded-lg font-semibold transition-colors">Add to GSL</button>
                  <button onClick={() => handleDenyGslRequest(m.id)}
                    className="px-3 py-1 bg-red-950/50 hover:bg-red-900/60 border border-red-900/50 text-red-400 text-xs rounded-lg font-semibold transition-colors">Deny</button>
                </div>
              );
            })}
        </div>
      )}
      {sessionEnded && endedTab === 'ended' ? (
        <SessionEndedContent committee={committee} hoursRemaining={hoursRemaining} />
      ) : (!sessionEnded && sessionSuspended && suspendTab === 'suspend') ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
          {(() => {
            const anotherChairResuming = committee.resumingChair && committee.resumingChair !== (myChairName || committee.chairNames[0]);
            return (
              <>
                <div className="text-5xl mb-6">⏸️</div>
                <h1 className="text-5xl font-black text-white mb-4">Session Adjourned</h1>
                <p className="text-xl text-[#C4A882] mb-12">This session has been temporarily suspended.</p>
                {anotherChairResuming ? (
                  <>
                    <button disabled className="px-12 py-5 bg-[#2E1E0F] text-[#7A5A38] text-xl font-black rounded-2xl cursor-not-allowed">
                      Resume Session
                    </button>
                    <p className="text-sm text-[#B8844A] mt-4">{committee.resumingChair} is resuming the session…</p>
                  </>
                ) : (
                  <button
                    onClick={handleResumeClick}
                    className="px-12 py-5 bg-[#7B4A1E] hover:bg-[#8B5A2B] text-white text-xl font-black rounded-2xl transition-colors">
                    Resume Session
                  </button>
                )}
                <p className="text-xs text-[#7A5A38] mt-8">Press ESC to return to main menu</p>
              </>
            );
          })()}
        </div>
      ) : (
      <div className="flex-1 flex overflow-hidden">
        {showChat && !sessionEnded && (
          <ChatPanel
            committee={committee}
            senderName={committee.chairNames[0] ?? 'Chair'}
            isChair={true}
            onClose={() => setShowChat(false)}
            readOnly={sessionEnded}
          />
        )}
        {!showChat && committee.phase === 'pre-session' && (
          <div className="flex-1 flex items-center justify-center px-6 py-8">
            <div className="w-full max-w-md bg-[#1A1209] border border-[#2E1E0F] rounded-2xl overflow-hidden" style={{ maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
              <RollCallPanel committee={committee}
                onAddToList={handleAddToSpeakersList}
                onListIds={gslListIds}
                onRemoveFromList={handleRemoveFromSpeakersList}
                onCycleStatus={handleCycleStatus}
                onStatusChange={handleStatusChange}
                onPhaseChange={handlePhaseChange}
                onDelegateAdd={handleDelegateAdd}
                isRollCallPhase={true}
                isReadOnly={sessionEnded} />
            </div>
          </div>
        )}
        {!showChat && committee.phase !== 'pre-session' && (
          <>
            {showRollCall && (
              <aside className="w-[22rem] border-r border-[#2E1E0F] bg-[#0D0906] flex flex-col overflow-hidden shrink-0">
                {committee.phase === 'moderated-caucus' ? (
                  <RollCallPanel committee={{ ...committee, speakersList: committee.caucusQueue ?? [] }}
                    onAddToList={(delegateId) => {
                      const delegate = committee.delegates.find((d) => d.id === delegateId);
                      if (!delegate) return;
                      if (committee.caucus?.currentSpeaker === delegate.country) return;
                      const inlinePos = (committee.caucusQueue ?? []).length + 1;
                      updateLocal(setCommittee, (c) => ({ ...c, caucusQueue: [...(c.caucusQueue ?? []), { delegateId, country: delegate.country }] }));
                      addToCaucusListInDB(committee.id, delegateId, delegate.country, inlinePos);
                    }}
                    onListIds={caucusQueueIds}
                    onRemoveFromList={(delegateId) => {
                      updateLocal(setCommittee, (c) => ({ ...c, caucusQueue: (c.caucusQueue ?? []).filter((s) => s.delegateId !== delegateId) }));
                      removeFromCaucusListInDB(committee.id, delegateId);
                    }}
                    onReorderList={(newList) => {
                      updateLocal(setCommittee, (c) => ({ ...c, caucusQueue: newList }));
                      reorderSpeakersListInDB(committee.id, newList, 'caucus');
                    }}
                    onCycleStatus={handleCycleStatus}
                    onStatusChange={handleStatusChange}
                    onDelegateAdd={handleDelegateAdd}
                    isRollCallPhase={false}
                    isReadOnly={sessionEnded} />
                ) : committee.phase === 'unmoderated-caucus' ? (
                  <RollCallPanel committee={committee}
                    onCycleStatus={handleCycleStatus}
                    onStatusChange={handleStatusChange}
                    onDelegateAdd={handleDelegateAdd}
                    isRollCallPhase={false}
                    isReadOnly={sessionEnded} />
                ) : (
                  <RollCallPanel committee={committee}
                    onAddToList={handleAddToSpeakersList}
                    onListIds={gslListIds}
                    onRemoveFromList={handleRemoveFromSpeakersList}
                    onCycleStatus={handleCycleStatus}
                    onStatusChange={handleStatusChange}
                    onPhaseChange={handlePhaseChange}
                    onDelegateAdd={handleDelegateAdd}
                    onReorderList={handleReorderSpeakersList}
                    isRollCallPhase={false}
                    isReadOnly={sessionEnded} />
                )}
              </aside>
            )}
            <main className="flex-1 overflow-hidden flex flex-col min-w-0">
              {committee.phase === 'moderated-caucus' && committee.caucus && (
                <ModeratedCaucusView committee={committee} setCommittee={setCommittee} />
              )}
              {committee.phase === 'unmoderated-caucus' && committee.caucus && (
                <UnmoderatedCaucusView committee={committee} setCommittee={setCommittee} />
              )}
              {committee.phase === 'voting' && (
                <VotingView committee={committee} setCommittee={setCommittee} />
              )}
{committee.phase === 'speakers-list' && (
                <>
                <div className="flex-1 flex flex-row overflow-hidden">
                  {/* GSL content area — overflow-hidden is intentional. Never use overflow-y-auto here:
                      it creates a scroll context that causes browser scrollbars to appear, cutting off
                      the flag queue at top and the Right of Reply button at bottom. */}
                  <div className="flex-1 flex flex-col items-center justify-center px-4 py-4 overflow-hidden">
                    {committee.currentSpeaker ? (
                      <>
                        {committee.speakersList.length > 0 && (
                          <DraggableSpeakersQueue
                            list={committee.speakersList}
                            onReorder={handleReorderSpeakersList}
                            onRemove={handleRemoveFromSpeakersList}
                          />
                        )}
                        <div className="flex flex-col items-center">
                          {/* Current speaker flag */}
                          <div className="ring-4 ring-[#7B4A1E] rounded-full">
                            <div className="relative w-36 h-36 rounded-full overflow-hidden bg-[#2E1E0F] shrink-0">
                              <span style={{ fontSize: '8rem', lineHeight: '1', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                                {(() => { const f = getCountryByName(committee.currentSpeaker.country); return f ? getFlagEmoji(f.code) : '🌐'; })()}
                              </span>
                            </div>
                          </div>
                          <h1 className="text-5xl font-black text-white mt-2 mb-1 text-center">{committee.currentSpeaker.country}</h1>
                          <div className={`text-8xl font-black font-mono mt-2 mb-3 tabular-nums ${
                            extraTimeAdded ? 'text-emerald-400' :
                            speakerTimeRemaining <= 10 ? 'text-red-500' :
                            speakerTimeRemaining <= 30 ? 'text-yellow-600' : 'text-white'
                          }`}>
                            {formatTime(speakerTimeRemaining)}
                            {extraTimeAdded && <span className="text-base ml-2 font-normal text-emerald-400">+time</span>}
                          </div>
                          <div className="w-full max-w-md h-2 bg-[#2E1E0F] rounded-full overflow-hidden mb-3">
                            <div className={`h-full rounded-full transition-all ${progress > 50 ? 'bg-[#B8844A]' : progress > 20 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                        {isLastGSLSpeaker && (
                          <div className="mb-2 px-4 py-2 bg-yellow-900/30 border border-yellow-700/40 rounded-lg text-yellow-400 text-xs text-center">
                            Add at least one more delegate before starting — the GSL can never be empty.
                          </div>
                        )}
                        {!sessionEnded && (
                        <div className="flex gap-2 w-full max-w-sm mt-1 flex-wrap justify-center">
                          {/* Restart button */}
                          <button onClick={handleRestartTime}
                            title="Restart time"
                            className="px-3 py-3 bg-[#2E1E0F] hover:bg-[#3D2A15] border border-[#3D2A15] hover:border-[#7B4A1E] rounded-xl font-bold text-sm text-[#C4A882] transition-colors">
                            ↺
                          </button>
                          {/* Start/Pause */}
                          <button onClick={handleToggleTimer}
                            disabled={isLastGSLSpeaker}
                            className={`flex-1 py-3 px-6 rounded-xl font-bold text-base transition-colors ${
                              timerRunning ? 'bg-yellow-600 hover:bg-yellow-500 text-white' :
                              isLastGSLSpeaker ? 'bg-[#2E1E0F] text-[#7A5A38] cursor-not-allowed' :
                              'bg-[#3D6B35] hover:bg-[#4A7C42] text-white'
                            }`}>
                            {timerRunning ? '⏸ Pause' : '▶ Start'}
                          </button>
                          <button onClick={handleNextSpeaker} disabled={committee.speakersList.length === 0}
                            className="flex-1 bg-[#2E1E0F] hover:bg-[#3D2A15] disabled:opacity-40 text-white py-3 px-6 rounded-xl font-bold text-base transition-colors">
                            Next →
                          </button>
                          {/* Add Time button */}
                          <button
                            onClick={() => setActivePopover(activePopover === 'extraTime' ? null : 'extraTime')}
                            title="Add time"
                            className={`px-3 py-3 border rounded-xl font-bold text-sm transition-colors ${
                              activePopover === 'extraTime'
                                ? 'bg-emerald-900/40 border-emerald-700/50 text-emerald-300'
                                : 'bg-[#2E1E0F] hover:bg-emerald-950/50 hover:border-emerald-800/50 border-[#3D2A15] text-[#C4A882]'
                            }`}>
                            +⏱
                          </button>
                          {/* Right of Reply button */}
                          <button
                            onClick={() => setActivePopover(activePopover === 'rightToReply' ? null : 'rightToReply')}
                            className={`px-3 py-3 border rounded-xl font-bold text-xs transition-colors ${
                              activePopover === 'rightToReply'
                                ? 'bg-orange-600 border-orange-500 text-white'
                                : 'bg-orange-900/40 hover:bg-orange-800/50 border-orange-700/40 text-orange-300'
                            }`}>
                            Right of Reply
                          </button>
                        </div>
                        )}
                        {/* Extra time popover */}
                        {!sessionEnded && activePopover === 'extraTime' && (
                          <div className="mt-3 bg-[#1A1209] border border-emerald-700/40 rounded-xl p-3 w-full max-w-sm">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-emerald-400 font-semibold">Add time</span>
                              <button onClick={() => setActivePopover(null)} className="text-[#7A5A38] hover:text-white text-sm">✕</button>
                            </div>
                            <div className="flex gap-2 mb-2">
                              {[15, 30, 60].map((s) => (
                                <button key={s} onClick={() => handleAddExtraTime(s)}
                                  className="flex-1 py-2 bg-emerald-900/30 hover:bg-emerald-800/40 border border-emerald-700/30 text-emerald-300 text-xs rounded-lg font-bold transition-colors">
                                  {s === 60 ? '1m' : `${s}s`}
                                </button>
                              ))}
                            </div>
                            <div className="flex gap-2 items-center">
                              <input
                                type="number"
                                value={extraTimeSecs}
                                onChange={(e) => setExtraTimeSecs(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { const n = parseInt(extraTimeSecs); if (n > 0) handleAddExtraTime(n); } }}
                                placeholder="Custom sec…"
                                style={{ MozAppearance: 'textfield' } as React.CSSProperties}
                                className="flex-1 bg-[#150F09] border border-[#2E1E0F] rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-emerald-700/50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              />
                              <button
                                onClick={() => { const n = parseInt(extraTimeSecs); if (n > 0) handleAddExtraTime(n); }}
                                disabled={!extraTimeSecs || parseInt(extraTimeSecs) <= 0}
                                className="px-3 py-1.5 bg-emerald-800/50 hover:bg-emerald-700/60 disabled:opacity-40 text-emerald-300 text-xs rounded-lg font-semibold transition-colors">
                                Add ↵
                              </button>
                            </div>
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
                        <div className="text-7xl mb-6">🎙</div>
                        <h2 className="text-3xl font-black text-white mb-2">No Current Speaker</h2>
                        <p className="text-[#C4A882] mb-4 text-center">Add delegates below, then call the first speaker.</p>
                        {committee.speakersList.length === 1 && (
                          <div className="mb-4 px-4 py-2 bg-yellow-900/30 border border-yellow-700/40 rounded-lg text-yellow-400 text-xs text-center">
                            Only 1 delegate on the list — add more before starting.
                          </div>
                        )}
                        {!sessionEnded && (
                          <button onClick={handleNextSpeaker} disabled={committee.speakersList.length < 2}
                            className="bg-[#7B4A1E] hover:bg-[#8B5A2B] disabled:bg-[#2E1E0F] disabled:text-[#7A5A38] text-white px-8 py-3 rounded-xl font-bold transition-colors">
                            Call First Speaker
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>{/* end flex-row */}
                {!sessionEnded && (
                <div className="border-t border-[#2E1E0F] bg-[#0D0906] px-6 py-4">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-xs text-[#7A5A38] font-mono shrink-0">TIME</span>
                    <div className="flex gap-1.5">
                      {[30, 60, 90, 120, 180].map((t) => (
                        <button key={t} onClick={() => handleSetSpeakerTimeLimit(t)}
                          className={`text-xs px-2.5 py-1 rounded-lg transition-colors font-semibold ${speakerTimeLimit === t ? 'bg-[#7B4A1E] text-white' : 'bg-[#2E1E0F] text-[#C4A882] hover:text-white'}`}>
                          {t}s
                        </button>
                      ))}
                      <input type="number" value={speakerTimeLimit}
                        onChange={(e) => handleSetSpeakerTimeLimit(parseInt(e.target.value) || 90)}
                        className="w-14 bg-[#150F09] border border-[#2E1E0F] rounded-lg px-2 py-1 text-white text-xs focus:outline-none" />
                    </div>
                  </div>
                  <AddSpeakerInput committee={committee} onAdd={handleAddToSpeakersList} />
                </div>
                )}
                </>
              )}
            </main>
          </>
        )}
      </div>
      )}
      {showMotions && !isPreSession && !sessionEnded && (
        <MotionsModal
          committee={committee}
          onClose={() => setShowMotions(false)}
          onCommitteeUpdate={(updater) => updateLocal(setCommittee, updater)}
        />
      )}
      {showDocuments && !isPreSession && !sessionEnded && (
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
        />
      )}
      {/* RTR OVERLAY — fixed position, completely outside document flow.
          Never render this inside any flex/grid container — it must not
          affect the layout of the GSL centre column in any way. */}
      {activePopover === 'rightToReply' && (
        <div
          className="fixed z-50"
          style={{ top: '50%', right: '2rem', transform: 'translateY(-50%)' }}
        >
          <div className="bg-[#1A1209] border border-orange-700/40 rounded-xl p-4 w-72 shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-orange-400 font-semibold">Right of Reply</span>
              <button onClick={() => {
                setActivePopover(null);
                setRtrOpen(false);
                setRtrTimerActive(false);
                setRtrCountry('');
                setRtrTimeRemaining(rtrSeconds);
              }} className="text-[#7A5A38] hover:text-white text-sm">✕</button>
            </div>
            {!rtrOpen ? (
              // ── Setup view ────────────────────────────────────
              <>
                <RtrCountryInput
                  committee={committee}
                  value={rtrCountry}
                  onChange={(v) => setRtrCountry(v)}
                />
                <div className="flex gap-2 mt-2 mb-2">
                  {[15, 20, 30].map((s) => (
                    <button
                      key={s}
                      onClick={() => setRtrSeconds(s)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors border ${
                        rtrSeconds === s
                          ? 'bg-orange-600 border-orange-500 text-white'
                          : 'bg-[#2E1E0F] border-[#2E1E0F] text-[#C4A882] hover:border-orange-700/50'
                      }`}
                    >
                      {s}s
                    </button>
                  ))}
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={5} max={300}
                      value={rtrSeconds}
                      onChange={(e) => setRtrSeconds(parseInt(e.target.value) || 30)}
                      style={{ MozAppearance: 'textfield' } as React.CSSProperties}
                      className="w-14 bg-[#150F09] border border-[#2E1E0F] rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <span className="text-xs text-[#7A5A38]">s</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!rtrCountry) return;
                    setRtrTimeRemaining(rtrSeconds);
                    setRtrTimerActive(false);
                    setRtrOpen(true);
                  }}
                  disabled={!rtrCountry}
                  className="w-full py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs rounded-lg font-bold transition-colors"
                >
                  Grant Right of Reply
                </button>
              </>
            ) : (
              // ── Active timer view ──────────────────────────────
              <>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className="text-xl">{(() => { const f = getCountryByName(rtrCountry); return f ? getFlagEmoji(f.code) : '🌐'; })()}</span>
                  <span className="text-sm text-white font-bold flex-1">{rtrCountry}</span>
                  <span className="text-xs text-orange-400 font-mono">Right of Reply</span>
                </div>
                <div className={`text-5xl font-black font-mono text-center mb-3 tabular-nums ${
                  rtrTimeRemaining <= 5 ? 'text-red-500' : rtrTimeRemaining <= 10 ? 'text-yellow-500' : 'text-orange-300'
                }`}>
                  {Math.floor(rtrTimeRemaining / 60)}:{String(rtrTimeRemaining % 60).padStart(2, '0')}
                </div>
                <div className="w-full h-1.5 bg-[#2E1E0F] rounded-full overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full transition-all ${rtrTimeRemaining / rtrSeconds > 0.5 ? 'bg-orange-500' : rtrTimeRemaining / rtrSeconds > 0.2 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${(rtrTimeRemaining / rtrSeconds) * 100}%` }}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setRtrTimerActive((r) => !r)}
                    className={`flex-1 py-2 rounded-lg font-bold text-xs transition-colors ${
                      rtrTimerActive ? 'bg-yellow-600 hover:bg-yellow-500 text-white' : 'bg-[#3D6B35] hover:bg-[#4A7C42] text-white'
                    }`}
                  >
                    {rtrTimerActive ? '⏸ Pause' : '▶ Start'}
                  </button>
                  <button
                    onClick={() => {
                      setRtrTimerActive(false);
                      setRtrOpen(false);
                      setRtrCountry('');
                      setRtrTimeRemaining(rtrSeconds);
                      setActivePopover(null);
                    }}
                    className="px-3 py-2 rounded-lg font-bold text-xs bg-[#2E1E0F] hover:bg-[#3D2A15] text-[#C4A882] transition-colors"
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChairSession({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0D0906] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#7B4A1E] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ChairSessionInner params={params} />
    </Suspense>
  );
}
