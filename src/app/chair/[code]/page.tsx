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
  removePendingMotion as removePendingMotionInDB,
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

const COUNTRY_ACRONYMS: Record<string, string> = {
  'uk':   'United Kingdom',
  'us':   'United States',
  'usa':  'United States',
  'uae':  'United Arab Emirates',
  'drc':  'DR Congo',
  'roc':  'Taiwan',
  'rok':  'South Korea',
  'dprk': 'North Korea',
  'car':  'Central African Republic',
  'png':  'Papua New Guinea',
};

function resolveQuery(raw: string): string {
  const lower = raw.trim().toLowerCase();
  return COUNTRY_ACRONYMS[lower] ?? raw.trim();
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
  const q = resolveQuery(query).toLowerCase();
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
  const q = resolveQuery(query).toLowerCase();
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

// ── Draggable GSL Speakers Queue ──────────────────────────────────────────────
function DraggableSpeakersQueue({ list, onReorder, onRemove, lastSpeakerDelegateId }: {
  list: { delegateId: string; country: string }[];
  onReorder: (newList: { delegateId: string; country: string }[]) => void;
  onRemove: (delegateId: string) => void;
  lastSpeakerDelegateId?: string | null;
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
            {lastSpeakerDelegateId && s.delegateId === lastSpeakerDelegateId && i !== 0 && (
              <span className="text-xs font-bold text-[#7A5A38] bg-[#2E1E0F] px-1.5 py-0.5 rounded">Last</span>
            )}
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
function CaucusQueueSidebar({ committee, onRemove, onReorder, lastSpeakerDelegateId }: {
  committee: Committee;
  onRemove: (delegateId: string) => void;
  onReorder: (newList: { delegateId: string; country: string }[]) => void;
  lastSpeakerDelegateId?: string | null;
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
                {lastSpeakerDelegateId && s.delegateId === lastSpeakerDelegateId && (
                  <span className="text-xs font-bold text-[#7A5A38] bg-[#2E1E0F] px-1.5 py-0.5 rounded shrink-0">Last</span>
                )}
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
function CaucusAddSpeakerInput({ committee, spokenCountries, onAdd, onAddFirst, onAddLast, maxSpeakers, currentQueueLength }: {
  committee: Committee; spokenCountries: string[]; onAdd: (id: string) => void;
  onAddFirst?: (id: string) => void; onAddLast?: (id: string) => void;
  maxSpeakers?: number; currentQueueLength?: number;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const onList = new Set((committee.caucusQueue ?? committee.speakersList).map((s) => s.delegateId));
  const eligible = committee.delegates.filter((d) => d.status !== 'absent');
  const isFull = maxSpeakers !== undefined && currentQueueLength !== undefined && currentQueueLength >= maxSpeakers;
  const cq = resolveQuery(query).toLowerCase();
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
                {isFirst && !spoke && (
                  <div className="flex items-center gap-1 shrink-0">
                    {onAddFirst && (
                      <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onAddFirst(d.id); setQuery(''); }}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-[#2E1E0F] hover:bg-[#3D2A15] text-[#B8844A] font-bold border border-[#3D2A15] transition-colors">
                        ↑ First
                      </button>
                    )}
                    {onAddLast && (
                      <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onAddLast(d.id); setQuery(''); }}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-[#2E1E0F] hover:bg-[#3D2A15] text-[#B8844A] font-bold border border-[#3D2A15] transition-colors">
                        ↓ Last
                      </button>
                    )}
                    <span className="text-xs text-[#7A5A38]">Enter ↵</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
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

// ── Moderated Caucus Main ─────────────────────────────────────────────────────
function ModeratedCaucusMain({
  committee, setCommittee,
  speakerTimeRemaining, timerRunning,
  activePopover, setActivePopover, extraTimeAdded,
  handleToggleTimer, handleRestartTime, handleNextCaucusSpeaker, handleEndCaucus,
  sessionEnded,
}: {
  committee: Committee; setCommittee: CommitteeSetter;
  speakerTimeRemaining: number; timerRunning: boolean;
  activePopover: 'extraTime' | 'rightToReply' | null;
  setActivePopover: (v: 'extraTime' | 'rightToReply' | null) => void;
  extraTimeAdded: boolean;
  handleToggleTimer: () => void;
  handleRestartTime: () => void;
  handleNextCaucusSpeaker: () => Promise<void>;
  handleEndCaucus: () => void;
  sessionEnded: boolean;
}) {
  const { getSettings } = useSettingsStore();
  const caucus = committee.caucus!;
  const queue = committee.caucusQueue ?? [];
  const speakerTime = caucus.speakingTime;
  const isTdT = caucus.purpose?.startsWith('Tour de Table') ?? false;
  const caucusTitle = isTdT ? 'TOUR DE TABLE' : (getSettings(committee.code).motionNames?.moderated ?? 'Moderated Caucus').toUpperCase();
  const spokenCountries = caucus.spokenCountries ?? [];

  // Local live remaining-time — ticks in lockstep with speakerTimeRemaining.
  const [liveRemaining, setLiveRemaining] = useState(caucus.remainingTime);
  const liveRemainingRef = useRef(caucus.remainingTime);

  // Resync when DB remainingTime jumps by more than 2s (extend / external write).
  useEffect(() => {
    const drift = Math.abs(caucus.remainingTime - liveRemainingRef.current);
    if (drift > 2) {
      liveRemainingRef.current = caucus.remainingTime;
      setLiveRemaining(caucus.remainingTime);
    }
  }, [caucus.remainingTime]);

  // Tick total in lockstep with the speaker atom — one decrement per speaker tick.
  const lastSpeakerTickRef = useRef(speakerTimeRemaining);
  useEffect(() => {
    if (!timerRunning) { lastSpeakerTickRef.current = speakerTimeRemaining; return; }
    const delta = lastSpeakerTickRef.current - speakerTimeRemaining;
    lastSpeakerTickRef.current = speakerTimeRemaining;
    if (delta > 0) {
      setLiveRemaining((prev) => {
        const next = Math.max(0, prev - delta);
        liveRemainingRef.current = next;
        return next;
      });
    }
  }, [speakerTimeRemaining, timerRunning]);

  const speakTime2 = speakerTime > 0 ? speakerTime : 1;
  const remainingForMax = committee.caucus?.remainingTime ?? liveRemaining;
  const maxByTime = Math.floor(remainingForMax / speakTime2);
  const totalProgress = caucus.totalTime > 0 ? (liveRemaining / caucus.totalTime) * 100 : 0;
  const caucusProgress = speakerTime > 0 ? (speakerTimeRemaining / speakerTime) * 100 : 0;

  const handleCaucusAddToQueue = (delegateId: string) => {
    const delegate = committee.delegates.find((d) => d.id === delegateId);
    if (!delegate) return;
    if (committee.currentSpeaker?.delegateId === delegateId) return;
    if (queue.some((s) => s.delegateId === delegateId)) return;
    if (queue.length >= maxByTime) return;
    const nextPosition = queue.length + 1;
    updateLocal(setCommittee, (c) => ({ ...c, caucusQueue: [...(c.caucusQueue ?? []), { delegateId, country: delegate.country }] }), true);
    addToCaucusListInDB(committee.id, delegateId, delegate.country, nextPosition);
  };

  const handleCaucusAddFirst = (delegateId: string) => {
    const delegate = committee.delegates.find((d) => d.id === delegateId);
    if (!delegate) return;
    if (queue.some((s) => s.delegateId === delegateId)) return;
    if (queue.length >= maxByTime) return;
    const newList = [{ delegateId, country: delegate.country }, ...queue];
    updateLocal(setCommittee, (c) => ({ ...c, caucusQueue: newList }), true);
    addToCaucusListInDB(committee.id, delegateId, delegate.country, 0);
    setTimeout(() => reorderSpeakersListInDB(committee.id, newList, 'caucus'), 400);
  };

  const handleCaucusAddLast = (delegateId: string) => {
    const delegate = committee.delegates.find((d) => d.id === delegateId);
    if (!delegate) return;
    if (queue.some((s) => s.delegateId === delegateId)) return;
    if (queue.length >= maxByTime) return;
    const nextPosition = queue.length + 1;
    const newList = [...queue, { delegateId, country: delegate.country }];
    updateLocal(setCommittee, (c) => ({ ...c, caucusQueue: newList }), true);
    addToCaucusListInDB(committee.id, delegateId, delegate.country, nextPosition);
  };

  const handleCaucusRemoveFromQueue = (delegateId: string) => {
    updateLocal(setCommittee, (c) => ({ ...c, caucusQueue: (c.caucusQueue ?? []).filter((s) => s.delegateId !== delegateId) }), true);
    removeFromCaucusListInDB(committee.id, delegateId);
  };

  const handleCaucusReorderQueue = (newList: { delegateId: string; country: string }[]) => {
    updateLocal(setCommittee, (c) => ({ ...c, caucusQueue: newList }), true);
    reorderSpeakersListInDB(committee.id, newList, 'caucus');
  };

  return (
    <>
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-4 overflow-hidden">
        <div className="text-center mb-3 shrink-0">
          <p className="text-xs font-mono tracking-widest text-[#7B4A1E] mb-1">{caucusTitle}</p>
          {!isTdT && caucus.purpose && <p className="text-base font-semibold text-[#C4A882]">{caucus.purpose}</p>}
        </div>

        {committee.currentSpeaker ? (
          <>
            {queue.length > 0 && (
              <DraggableSpeakersQueue
                list={queue}
                onReorder={handleCaucusReorderQueue}
                onRemove={handleCaucusRemoveFromQueue}
              />
            )}
            <div className="flex flex-col items-center">
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
              <div className="w-full max-w-2xl h-2 bg-[#2E1E0F] rounded-full overflow-hidden mb-3">
                <div className={`h-full rounded-full transition-all ${caucusProgress > 50 ? 'bg-[#B8844A]' : caucusProgress > 20 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${caucusProgress}%` }} />
              </div>
            </div>
            {!sessionEnded && (
              <div className="flex gap-2 w-full max-w-sm mt-1 flex-wrap justify-center">
                <button onClick={handleRestartTime} title="Restart speaker time"
                  className="px-3 py-3 bg-[#2E1E0F] hover:bg-[#3D2A15] border border-[#3D2A15] hover:border-[#7B4A1E] rounded-xl font-bold text-sm text-[#C4A882] transition-colors">
                  ↺
                </button>
                <button onClick={handleToggleTimer}
                  className={`flex-1 py-3 px-6 rounded-xl font-bold text-base transition-colors ${timerRunning ? 'bg-yellow-600 hover:bg-yellow-500 text-white' : 'bg-[#3D6B35] hover:bg-[#4A7C42] text-white'}`}>
                  {timerRunning ? '⏸ Pause' : '▶ Start'}
                </button>
                <button onClick={handleNextCaucusSpeaker} disabled={queue.length === 0}
                  className="flex-1 bg-[#2E1E0F] hover:bg-[#3D2A15] disabled:opacity-40 text-white py-3 px-6 rounded-xl font-bold text-base transition-colors">
                  Next →
                </button>
                <button onClick={() => setActivePopover(activePopover === 'extraTime' ? null : 'extraTime')} title="Add time"
                  className={`px-3 py-3 border rounded-xl font-bold text-sm transition-colors ${activePopover === 'extraTime' ? 'bg-emerald-900/40 border-emerald-700/50 text-emerald-300' : 'bg-[#2E1E0F] hover:bg-emerald-950/50 hover:border-emerald-800/50 border-[#3D2A15] text-[#C4A882]'}`}>
                  +⏱
                </button>
                {!isTdT && (
                  <button onClick={() => setActivePopover(activePopover === 'rightToReply' ? null : 'rightToReply')}
                    className={`px-3 py-3 border rounded-xl font-bold text-xs transition-colors ${activePopover === 'rightToReply' ? 'bg-orange-600 border-orange-500 text-white' : 'bg-orange-900/40 hover:bg-orange-800/50 border-orange-700/40 text-orange-300'}`}>
                    Right of Reply
                  </button>
                )}
              </div>
            )}
            {spokenCountries.length > 0 && (
              <p className="text-xs text-yellow-500 mt-2">{spokenCountries.length} delegate{spokenCountries.length !== 1 ? 's' : ''} spoke</p>
            )}
          </>
        ) : (
          <>
            {queue.length > 0 && (
              <DraggableSpeakersQueue
                list={queue}
                onReorder={handleCaucusReorderQueue}
                onRemove={handleCaucusRemoveFromQueue}
              />
            )}
            <div className="text-7xl mb-6">🎙</div>
            <h2 className="text-3xl font-black text-white mb-2">No Current Speaker</h2>
            <p className="text-[#C4A882] mb-4 text-center">Add delegates below, then call the first speaker.</p>
            {!sessionEnded && (
              <button onClick={handleNextCaucusSpeaker} disabled={queue.length === 0}
                className="bg-[#7B4A1E] hover:bg-[#8B5A2B] disabled:bg-[#2E1E0F] disabled:text-[#7A5A38] text-white px-8 py-3 rounded-xl font-bold transition-colors">
                Call First Speaker
              </button>
            )}
          </>
        )}
      </div>

      {!sessionEnded && (
        <div className="border-t border-[#2E1E0F] bg-[#0D0906] px-6 py-4">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs text-[#7A5A38] font-mono shrink-0">TOTAL</span>
            <p className={`text-lg font-black font-mono shrink-0 ${liveRemaining <= 30 ? 'text-red-500' : 'text-white'}`}>{formatTime(liveRemaining)}</p>
            <div className="flex-1 h-2 bg-[#2E1E0F] rounded-full overflow-hidden">
              <div className="h-full bg-[#B8844A]/60 rounded-full transition-all" style={{ width: `${totalProgress}%` }} />
            </div>
            <button onClick={handleEndCaucus}
              className="px-3 py-1.5 rounded-lg font-bold text-xs bg-[#2E1E0F] hover:bg-red-950/50 text-[#C4A882] hover:text-red-400 transition-colors border border-[#2E1E0F] hover:border-red-900/50">
              End Caucus
            </button>
          </div>
          <CaucusAddSpeakerInput
            committee={committee}
            spokenCountries={spokenCountries}
            onAdd={handleCaucusAddToQueue}
            onAddFirst={handleCaucusAddFirst}
            onAddLast={handleCaucusAddLast}
            maxSpeakers={maxByTime}
            currentQueueLength={queue.length}
          />
        </div>
      )}
    </>
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
  const { updateSetting, getSettings } = useSettingsStore();
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
  const [showSliders, setShowSliders] = useState(false);
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
  const [caucusMaxReachedMsg, setCaucusMaxReachedMsg] = useState(false);

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
  const committeePhaseRef = useRef('');
  const speakerTimeLimitRef = useRef(speakerTimeLimit);
  // Mutable map of delegateId → current status — updated immediately on each cycle
  // so rapid clicks read the post-click status, not the pre-re-render (stale) status.
  const delegateStatusRef = useRef<Map<string, DelegateStatus>>(new Map());
  timerRunningRef.current = timerRunning;
  speakerTimeLimitRef.current = speakerTimeLimit;
  committeePhaseRef.current = committee?.phase ?? '';

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
      if (found) {
        // Clean up orphaned suspend/end-debate motions left from cycles where the delete silently failed
        const staleMotions = (found.pendingMotions ?? []).filter(
          (m) => m.type === 'suspend-debate' || m.type === 'end-debate'
        );
        if (staleMotions.length > 0) {
          staleMotions.forEach((m) => removePendingMotionInDB(m.id));
          found.pendingMotions = (found.pendingMotions ?? []).filter(
            (m) => m.type !== 'suspend-debate' && m.type !== 'end-debate'
          );
        }
      }
      setCommittee(found ?? null);
      if (found) {
        setSpeakerTimeLimitLocal(found.speakerTimeLimit);
        setSpeakerTimeRemaining(found.speakerTimeRemaining);
        committeeIdRef.current = found.id;
        if (found.dbChairJoinSuffix) {
          updateSetting(found.code, 'chairJoinSuffix', found.dbChairJoinSuffix);
        }
        if (found.dbSeparateChairCode !== undefined) {
          updateSetting(found.code, 'separateChairCode', found.dbSeparateChairCode);
        }
      }
      setLoading(false);
      if (found) {
        unsubscribe = subscribeToCommittee(found.id, async (table) => {
          // Timer writes current_speaker every second — chair owns this entirely, never re-fetch.
          if (table === 'current_speaker') return;

          const withinDebounce = Date.now() - localUpdateTime.current < 3000;

          // Within debounce: structural tables (speakers_list, delegates) changed because
          // the chair just wrote them. Skip the fetch entirely — optimistic state is truth.
          // Only fetch for motion/session/document events where another actor may have written.
          if (withinDebounce) {
            if (table === 'speakers_list' || table === 'delegates') return;
            const updated = await getCommitteeByCode(code);
            if (!updated) return;
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

          // Outside debounce: full update — another actor (delegate, co-chair) changed something.
          const updated = await getCommitteeByCode(code);
          if (!updated) return;
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

  const caucusRollCallCommittee = useMemo(
    () => committee ? { ...committee, speakersList: committee.caucusQueue ?? [] } : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [committee?.caucusQueue, committee?.delegates, committee?.currentSpeaker, committee?.phase]
  );

  const caucusMaxSpeakers = useMemo(() => {
    if (!committee?.caucus) return null;
    const speakTime = committee.caucus.speakingTime > 0 ? committee.caucus.speakingTime : 1;
    return Math.floor(committee.caucus.remainingTime / speakTime);
  }, [committee?.caucus?.remainingTime, committee?.caucus?.speakingTime]);

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
      ...(next === 'absent' && c.phase !== 'pre-session' ? {
        speakersList: c.speakersList.filter((s) => s.delegateId !== delegateId),
        caucusQueue: (c.caucusQueue ?? []).filter((s) => s.delegateId !== delegateId),
      } : {}),
    }), true);
    setDelegateStatusInDB(delegateId, next);
    if (next === 'absent' && committeePhaseRef.current !== 'pre-session') {
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
      ...(status === 'absent' && c.phase !== 'pre-session' ? {
        speakersList: c.speakersList.filter((s) => s.delegateId !== delegateId),
        caucusQueue: (c.caucusQueue ?? []).filter((s) => s.delegateId !== delegateId),
      } : {}),
    }), true);
    setDelegateStatusInDB(delegateId, status);
    if (status === 'absent' && committee.phase !== 'pre-session') {
      removeFromSpeakersListInDB(committee.id, delegateId);
      removeFromCaucusListInDB(committee.id, delegateId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee?.id, committee?.phase]);

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
    if (sessionSuspended) setSuspendTab('suspend');
  }, [sessionSuspended]);

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

  const handleNextCaucusSpeaker = async () => {
    if (!committee.caucus) return;
    setTimerRunning(false);
    stopSpeakerTimerInDB(committeeIdRef.current);
    setExtraTimeAdded(false);

    const secondsSpoken = committee.caucus.speakingTime - speakerTimeRemaining;
    if (secondsSpoken > 0 && committee.currentSpeaker) {
      logSpeakingTime(
        committee.id,
        committee.currentSpeaker.country,
        secondsSpoken,
        'moderated-caucus',
        committee.caucus.purpose ?? committee.topic,
      );
    }

    const queue = committee.caucusQueue ?? [];
    const [next, ...rest] = queue;
    const speakTime = committee.caucus.speakingTime;
    const spentOnCurrent = committee.caucus.speakingTime - speakerTimeRemaining;
    const newRemaining = Math.max(0, committee.caucus.remainingTime - spentOnCurrent);

    setSpeakerTimeRemaining(speakTime);
    localUpdateTime.current = Date.now();

    updateLocal(setCommittee, (c) => {
      if (!c.caucus) return c;
      const prev = c.currentSpeaker?.country ?? null;
      const newSpoken = prev && !c.caucus.spokenCountries.includes(prev)
        ? [...c.caucus.spokenCountries, prev]
        : c.caucus.spokenCountries;
      const updatedCaucus = {
        ...c.caucus,
        currentSpeaker: next?.country ?? null,
        speakerTimeRemaining: speakTime,
        remainingTime: newRemaining,
        spokenCountries: newSpoken,
      };
      if (newRemaining <= 0) {
        updateCaucusInDB(c.id, null);
        return { ...c, caucus: null, phase: 'speakers-list' as const, caucusQueue: [], currentSpeaker: null, speakerTimeRemaining: speakTime };
      }
      updateCaucusInDB(c.id, updatedCaucus);
      return { ...c, caucusQueue: rest, caucus: updatedCaucus, currentSpeaker: next ?? null, speakerTimeRemaining: speakTime };
    }, false);

    await nextSpeakerInDB(
      committee.id,
      speakTime,
      next?.delegateId ?? null,
      next?.country ?? null,
      null,
    );
    localUpdateTime.current = Date.now();
  };

  const handleEndCaucus = () => {
    setTimerRunning(false);
    stopSpeakerTimerInDB(committeeIdRef.current);
    updateCaucusInDB(committee.id, null);
    updateLocal(setCommittee, (c) => ({
      ...c,
      caucus: null,
      phase: 'speakers-list' as const,
      caucusQueue: [],
      currentSpeaker: null,
      speakerTimeRemaining: c.speakerTimeLimit,
    }), true);
    setSpeakerTimeRemaining(committee.speakerTimeLimit);
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
    updateLocal(setCommittee, (c) => {
      let updated = { ...c, phase: phase as Committee['phase'] };
      if (phase === 'speakers-list' && c.phase === 'pre-session') {
        const absentIds = new Set(c.delegates.filter((d) => d.status === 'absent').map((d) => d.id));
        const toRemove = c.speakersList.filter((s) => absentIds.has(s.delegateId));
        updated.speakersList = c.speakersList.filter((s) => !absentIds.has(s.delegateId));
        toRemove.forEach((s) => removeFromSpeakersListInDB(c.id, s.delegateId));
      }
      return updated;
    }, true);
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
          <img src="/gavelling-logo.png" alt="Gavelling" className="w-[14vw] h-auto max-h-8 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </Link>

        {committee.phase !== 'pre-session' && !sessionEnded ? (
          <div className="flex flex-1 min-w-0 h-full">
            <button onClick={() => setShowSliders((v) => !v)}
              className={`flex-1 text-sm font-bold transition-colors border-b-2 ${showSliders ? 'text-white border-[#7B4A1E]' : 'text-[#7A5A38] border-transparent hover:text-[#C4A882]'}`}>
              Roll Call
            </button>
            <button onClick={handleMotionsClick}
              className={`flex-1 text-sm font-bold transition-colors border-b-2 relative ${showMotions ? 'text-white border-[#7B4A1E]' : 'text-[#7A5A38] border-transparent hover:text-[#C4A882]'}`}>
              Motions
              {(committee.pendingMotions ?? []).filter((m) => m.type !== ('join-request' as string) && (m.type as string) !== 'gsl-request').length > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-[#7B4A1E] rounded-full text-white text-[10px] flex items-center justify-center">
                  {(committee.pendingMotions ?? []).filter((m) => m.type !== ('join-request' as string) && (m.type as string) !== 'gsl-request').length}
                </span>
              )}
            </button>
            <button onClick={handleDocumentsClick}
              className={`flex-1 text-sm font-bold transition-colors border-b-2 relative ${showDocuments ? 'text-white border-[#7B4A1E]' : 'text-[#7A5A38] border-transparent hover:text-[#C4A882]'}`}>
              Documents
              {(() => { const n = (committee.documents ?? []).filter((d) => d.status === 'submitted').length; return n > 0 ? <span className="absolute top-1 right-1 w-4 h-4 bg-[#7B4A1E] rounded-full text-white text-[10px] flex items-center justify-center">{n}</span> : null; })()}
            </button>
            <button onClick={() => { if (!isPreSession) handleToggleChat(); }}
              className={`flex-1 text-sm font-bold transition-colors border-b-2 relative ${showChat ? 'text-white border-[#7B4A1E]' : 'text-[#7A5A38] border-transparent hover:text-[#C4A882]'}`}>
              Chat
              {(() => { const unread = committee.messages.filter((m) => !m.content.startsWith('__log__:')).length - chatReadCount; return unread > 0 && !showChat ? <span className="absolute top-1 right-1 w-4 h-4 bg-[#7B4A1E] rounded-full text-white text-[10px] flex items-center justify-center">{unread}</span> : null; })()}
            </button>
          </div>
        ) : (
          <span className="text-[#7A5A38] text-xs hidden sm:block truncate flex-1">{committee.name} — {committee.topic}</span>
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
                {caucusMaxReachedMsg && (
                  <div className="shrink-0 px-3 py-2 bg-amber-900/20 border-b border-amber-700/40 text-amber-300 text-xs text-center font-semibold">
                    Maximum speakers reached — add more delegates if time remains after current speakers.
                  </div>
                )}
                {(committee.phase === 'moderated-caucus' || committee.caucus?.type === 'moderated') ? (
                  <RollCallPanel committee={caucusRollCallCommittee ?? { ...committee, speakersList: committee.caucusQueue ?? [] }}
                    onAddToList={(delegateId) => {
                      const delegate = committee.delegates.find((d) => d.id === delegateId);
                      if (!delegate) return;
                      if (committee.caucus?.currentSpeaker === delegate.country) return;
                      if (caucusMaxSpeakers !== null && (committee.caucusQueue ?? []).length >= caucusMaxSpeakers) {
                        setCaucusMaxReachedMsg(true);
                        setTimeout(() => setCaucusMaxReachedMsg(false), 3000);
                        return;
                      }
                      const inlinePos = (committee.caucusQueue ?? []).length + 1;
                      updateLocal(setCommittee, (c) => ({ ...c, caucusQueue: [...(c.caucusQueue ?? []), { delegateId, country: delegate.country }] }), true);
                      addToCaucusListInDB(committee.id, delegateId, delegate.country, inlinePos);
                    }}
                    onListIds={caucusQueueIds}
                    onRemoveFromList={(delegateId) => {
                      updateLocal(setCommittee, (c) => ({ ...c, caucusQueue: (c.caucusQueue ?? []).filter((s) => s.delegateId !== delegateId) }), true);
                      removeFromCaucusListInDB(committee.id, delegateId);
                    }}
                    onReorderList={(newList) => {
                      updateLocal(setCommittee, (c) => ({ ...c, caucusQueue: newList }), true);
                      reorderSpeakersListInDB(committee.id, newList, 'caucus');
                    }}
                    onCycleStatus={handleCycleStatus}
                    onStatusChange={handleStatusChange}
                    onDelegateAdd={handleDelegateAdd}
                    isRollCallPhase={showSliders}
                    isReadOnly={sessionEnded} />
                ) : (committee.phase === 'unmoderated-caucus' || committee.caucus?.type === 'unmoderated') ? (
                  <RollCallPanel committee={committee}
                    onCycleStatus={handleCycleStatus}
                    onStatusChange={handleStatusChange}
                    onDelegateAdd={handleDelegateAdd}
                    isRollCallPhase={showSliders}
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
                    isRollCallPhase={showSliders}
                    isReadOnly={sessionEnded} />
                )}
              </aside>
            )}
            <main className="flex-1 overflow-hidden flex flex-col min-w-0">
              {committee.phase === 'moderated-caucus' && committee.caucus && (
                <ModeratedCaucusMain
                  committee={committee}
                  setCommittee={setCommittee}
                  speakerTimeRemaining={speakerTimeRemaining}
                  timerRunning={timerRunning}
                  activePopover={activePopover}
                  setActivePopover={setActivePopover}
                  extraTimeAdded={extraTimeAdded}
                  handleToggleTimer={handleToggleTimer}
                  handleRestartTime={handleRestartTime}
                  handleNextCaucusSpeaker={handleNextCaucusSpeaker}
                  handleEndCaucus={handleEndCaucus}
                  sessionEnded={sessionEnded}
                />
              )}
              {committee.phase === 'unmoderated-caucus' && committee.caucus && (
                <UnmoderatedCaucusView committee={committee} setCommittee={setCommittee} />
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
                          <div className="w-full max-w-2xl h-2 bg-[#2E1E0F] rounded-full overflow-hidden mb-3">
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
      {/* EXTRA TIME OVERLAY — fixed position, same anchor as RTR overlay */}
      {!sessionEnded && activePopover === 'extraTime' && (
        <div
          className="fixed z-50"
          style={{ top: '50%', right: '2rem', transform: 'translateY(-50%)' }}
        >
          <div className="bg-[#1A1209] border border-emerald-700/40 rounded-xl p-3 w-72 shadow-2xl">
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
        </div>
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
