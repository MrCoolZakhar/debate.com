'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Committee, DelegateStatus } from '@/lib/types';
import { getFlagEmoji, getCountryByName, UN_COUNTRIES } from '@/lib/countries';
import {
  setPhase as setPhaseInDB,
  setDelegateStatus as setDelegateStatusInDB,
  removeFromSpeakersList as removeFromSpeakersListInDB,
} from '@/lib/committeeService';

// ── FlagCircle ────────────────────────────────────────────────────────────────
export function FlagCircle({ country, size = 'md' }: { country: string; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero' }) {
  const found = getCountryByName(country);
  const flag = found ? getFlagEmoji(found.code) : '🌐';
  const dim: Record<string, { box: string; font: string }> = {
    xs:   { box: 'w-7 h-7',   font: '1.6rem' },
    sm:   { box: 'w-9 h-9',   font: '2rem'   },
    md:   { box: 'w-12 h-12', font: '2.8rem' },
    lg:   { box: 'w-14 h-14', font: '3.2rem' },
    xl:   { box: 'w-20 h-20', font: '4.5rem' },
    hero: { box: 'w-60 h-60', font: '13rem'  },
  };
  const { box, font } = dim[size];
  return (
    <div className={`relative ${box} rounded-full overflow-hidden bg-[#2E1E0F] shrink-0`}>
      <span style={{ fontSize: font, lineHeight: '1', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'block' }}>
        {flag}
      </span>
    </div>
  );
}

// ── 3-state slider ────────────────────────────────────────────────────────────
function StatusSlider({ status, onCycle }: { status: DelegateStatus; onCycle: () => void }) {
  const thumbPos = status === 'absent' ? 'left-[2px]' : status === 'present' ? 'left-[31px]' : 'left-[60px]';
  const thumbColor = status === 'absent' ? 'bg-red-300' : status === 'present' ? 'bg-green-500' : 'bg-blue-500';
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onCycle(); }}
      className="relative w-[90px] h-[30px] rounded-full bg-[#1A1209] border border-[#2E1E0F] cursor-pointer shrink-0 select-none"
      title="Tap to cycle: Absent → Present → PV"
    >
      <div className="absolute inset-0 grid grid-cols-3 items-center pointer-events-none">
        <span className={`text-[10px] font-bold text-center ${status === 'absent' ? 'text-red-900' : 'text-[#7A5A38]'}`}>A</span>
        <span className={`text-[10px] font-bold text-center ${status === 'present' ? 'text-white' : 'text-[#7A5A38]'}`}>P</span>
        <span className={`text-[10px] font-bold text-center ${status === 'present-voting' ? 'text-white' : 'text-[#7A5A38]'}`}>PV</span>
      </div>
      <div className={`absolute top-[3px] w-[26px] h-[24px] rounded-full transition-all duration-200 ${thumbPos} ${thumbColor}`} />
    </button>
  );
}

// ── A-Z / QUEUE view toggle slider ────────────────────────────────────────────
function ViewToggle({ view, onChange }: { view: 'az' | 'queue'; onChange: (v: 'az' | 'queue') => void }) {
  const isQueue = view === 'queue';
  return (
    <button
      onClick={() => onChange(isQueue ? 'az' : 'queue')}
      className="relative w-[104px] h-[28px] rounded-full bg-[#1A1209] border border-[#2E1E0F] cursor-pointer select-none shrink-0"
      title="Toggle A-Z / Queue view"
    >
      <div className="absolute inset-0 grid grid-cols-2 items-center pointer-events-none z-10">
        <span className={`text-[10px] font-bold text-center ${!isQueue ? 'text-white' : 'text-[#7A5A38]'}`}>A-Z</span>
        <span className={`text-[10px] font-bold text-center ${isQueue ? 'text-[#B8844A]' : 'text-[#7A5A38]'}`}>QUEUE</span>
      </div>
      <div className={`absolute top-[2px] w-[50px] h-[24px] rounded-full transition-all duration-200 ${isQueue ? 'left-[52px] bg-[#7B4A1E]' : 'left-[2px] bg-[#2E1E0F]'}`} />
    </button>
  );
}

// ── Add country input ─────────────────────────────────────────────────────────
function AddCountryInput({ committee, onAdd, onQueryChange }: { committee: Committee; onAdd: (country: string) => void; onQueryChange?: (q: string) => void }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const existingNames = new Set(committee.delegates.map((d) => d.country.toLowerCase()));

  const updateQuery = (q: string) => { setQuery(q); onQueryChange?.(q); };

  const rq = query.trim().toLowerCase();
  const knownMatches = rq
    ? UN_COUNTRIES.filter((c) => c.name.trim().toLowerCase().startsWith(rq))
        .concat(UN_COUNTRIES.filter((c) =>
          !c.name.trim().toLowerCase().startsWith(rq) &&
          c.name.trim().toLowerCase().includes(rq)))
    : [];

  const topKnown = knownMatches.find((c) => !existingNames.has(c.name.toLowerCase())) ?? null;
  const trimmed = query.trim();
  const isCustom = trimmed.length > 0 && !existingNames.has(trimmed.toLowerCase());
  const showCustomOption = isCustom && (!topKnown || topKnown.name.toLowerCase() !== trimmed.toLowerCase());

  const commit = (name: string) => {
    const normalised = name.trim();
    if (!normalised || existingNames.has(normalised.toLowerCase())) return;
    onAdd(normalised);
    updateQuery('');
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <div className="flex items-center bg-[#150F09] border border-[#2E1E0F] focus-within:border-[#7B4A1E] rounded-xl overflow-hidden transition-colors">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => updateQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (topKnown) commit(topKnown.name);
              else if (trimmed) commit(trimmed);
            }
            if (e.key === 'Escape') updateQuery('');
          }}
          placeholder="Filter or add country / observer…"
          className="flex-1 bg-transparent px-3 py-2.5 text-white text-sm placeholder-[#7A5A38] focus:outline-none"
        />
        {query && (topKnown || trimmed) && (
          <span className="text-[10px] text-[#7A5A38] px-2 truncate max-w-[80px]">
            ↵ {topKnown ? topKnown.name : trimmed}
          </span>
        )}
      </div>

      {query && (knownMatches.length > 0 || showCustomOption) && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#150F09] border border-[#2E1E0F] rounded-xl overflow-hidden z-30 shadow-xl max-h-52 overflow-y-auto">
          {knownMatches
            .filter((c) => !existingNames.has(c.name.toLowerCase()))
            .slice(0, showCustomOption ? 5 : 8)
            .map((c, i) => (
              <button
                key={c.code}
                onMouseDown={(e) => { e.preventDefault(); commit(c.name); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                  i === 0 ? 'bg-[#7B4A1E]/20 text-white' : 'text-[#E8D5B7] hover:bg-[#2E1E0F]'
                }`}
              >
                <span className="text-base">{getFlagEmoji(c.code)}</span>
                <span className="text-sm flex-1">{c.name}</span>
                {i === 0 && <span className="text-[10px] text-[#7A5A38] shrink-0">Enter ↵</span>}
              </button>
            ))}
          {showCustomOption && (
            <button
              onMouseDown={(e) => { e.preventDefault(); commit(trimmed); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors text-[#E8D5B7] hover:bg-[#2E1E0F] border-t border-[#2E1E0F]"
            >
              <span className="text-base">🌐</span>
              <span className="text-sm flex-1">{trimmed}</span>
              <span className="text-[10px] text-[#7B4A1E] shrink-0 font-semibold">Add custom</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Full speakers list popup ──────────────────────────────────────────────────
function FullListPopup({
  list,
  title,
  onClose,
  onRemove,
}: {
  list: { delegateId: string; country: string }[];
  title: string;
  onClose: () => void;
  onRemove?: (delegateId: string) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(5, 8, 20, 0.80)', backdropFilter: 'blur(4px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#1A1209] border border-[#2E1E0F] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2E1E0F] shrink-0">
          <h3 className="font-black text-white text-base">{title}</h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#7A5A38] font-mono">{list.length} speakers</span>
            <button onClick={onClose} className="text-[#7A5A38] hover:text-white text-xl leading-none">✕</button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1">
          {list.length === 0 ? (
            <div className="px-5 py-8 text-center text-[#7A5A38] text-sm">No speakers queued</div>
          ) : (
            list.map((s, i) => (
              <div key={s.delegateId} className="flex items-center gap-3 px-4 py-2.5 border-b border-[#2E1E0F]/40 group hover:bg-[#2E1E0F]/30 transition-colors">
                <span className="text-xs text-[#7A5A38] font-mono w-6 text-right shrink-0">{i + 1}</span>
                <FlagCircle country={s.country} size="xs" />
                <span className="text-sm text-white flex-1 truncate">{s.country}</span>
                {onRemove && (
                  <button
                    onClick={() => onRemove(s.delegateId)}
                    className="text-[#7A5A38] hover:text-red-500 transition-colors text-xs opacity-0 group-hover:opacity-100 shrink-0"
                  >✕</button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── MajorityPie ───────────────────────────────────────────────────────────────
// arcFill: fixed fraction 0–1 for the arc shape (never changes per chart).
// label:   live-computed number shown next to the arc.
// color:   always active — these are informational thresholds, not pass/fail.
function MajorityPie({ arcFill, color, label }: {
  arcFill: number; color: string; label: string;
}) {
  const r = 13; const circ = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-1">
      <svg width="32" height="32" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r={r} fill="none" stroke="#2E1E0F" strokeWidth="5" />
        <circle cx="16" cy="16" r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - Math.min(arcFill, 1))}
          strokeLinecap="round"
          transform="rotate(-90 16 16)"
          style={{ transition: 'stroke-dashoffset 0.3s' }}
        />
      </svg>
      <span className="text-xs font-bold text-white">{label}</span>
    </div>
  );
}

// ── Roll Call Panel ───────────────────────────────────────────────────────────
function RollCallPanelInner({
  committee,
  onAddToList,
  onListIds,
  onRemoveFromList,
  onCycleStatus,
  onStatusChange,
  onPhaseChange,
  onDelegateAdd,
  onReorderList,
  isRollCallPhase = false,
  isReadOnly = false,
}: {
  committee: Committee;
  onAddToList?: (delegateId: string) => void;
  onListIds?: Set<string>;
  onRemoveFromList?: (delegateId: string) => void;
  /** Preferred over onStatusChange for toggle clicks — parent reads from a ref for rapid-click safety */
  onCycleStatus?: (delegateId: string) => void;
  onStatusChange?: (delegateId: string, status: DelegateStatus) => void;
  onPhaseChange?: (phase: string) => void;
  onDelegateAdd?: (country: string) => void;
  onReorderList?: (newList: { delegateId: string; country: string }[]) => void;
  isRollCallPhase?: boolean;
  isReadOnly?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [listView, setListView] = useState<'az' | 'queue'>('az');
  const [showFullList, setShowFullList] = useState(false);
  const [localStatuses, setLocalStatuses] = useState<Record<string, DelegateStatus>>({});
  const listRef = useRef<HTMLDivElement>(null);
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    setLocalStatuses({});
  }, [committee.id]);

  const present = committee.delegates.filter((d) => (localStatuses[d.id] ?? d.status) !== 'absent').length;
  const total = committee.delegates.length;

  // Build a map: delegateId → position in GSL (1-indexed)
  const queuePositionMap = new Map<string, number>();
  (committee.speakersList ?? []).forEach((s, i) => {
    queuePositionMap.set(s.delegateId, i + 1);
  });

  const cycleStatus = (id: string, current: DelegateStatus) => {
    const next: DelegateStatus =
      current === 'absent' ? 'present' : current === 'present' ? 'present-voting' : 'absent';
    setLocalStatuses((prev) => ({ ...prev, [id]: next }));
    onStatusChange?.(id, next);
    setDelegateStatusInDB(id, next);
    if (!isRollCallPhase && next === 'absent' && queuePositionMap.has(id)) {
      onRemoveFromList?.(id);
      removeFromSpeakersListInDB(committee.id, id);
    }
  };

  const handleAllPresent = () => {
    const newStatuses: Record<string, DelegateStatus> = {};
    committee.delegates.forEach((d) => {
      newStatuses[d.id] = 'present';
      onStatusChange?.(d.id, 'present');
      setDelegateStatusInDB(d.id, 'present');
    });
    setLocalStatuses(newStatuses);
  };

  const handleAllPresentVoting = () => {
    const newStatuses: Record<string, DelegateStatus> = {};
    committee.delegates.forEach((d) => {
      newStatuses[d.id] = 'present-voting';
      onStatusChange?.(d.id, 'present-voting');
      setDelegateStatusInDB(d.id, 'present-voting');
    });
    setLocalStatuses(newStatuses);
  };

  const handleClear = () => {
    const newStatuses: Record<string, DelegateStatus> = {};
    committee.delegates.forEach((d) => {
      newStatuses[d.id] = 'absent';
      onStatusChange?.(d.id, 'absent');
      setDelegateStatusInDB(d.id, 'absent');
    });
    setLocalStatuses(newStatuses);
  };

  const handleBeginSession = () => {
    onPhaseChange?.('speakers-list');
    setPhaseInDB(committee.id, 'speakers-list');
  };

  const handleAddDelegate = (country: string) => {
    onDelegateAdd?.(country);
  };

  // A-Z view: pure alphabetical, no status separation
  const alphabetical = [...committee.delegates].sort((a, b) => a.country.localeCompare(b.country));
  // allAlpha shared base for queueOrdered (alphabetical among non-queue delegates)
  const allAlpha = alphabetical;

  // Queue view: GSL delegates first (in order), then present/PV alphabetically, then absent
  const inQueue = (committee.speakersList ?? [])
    .map((s) => committee.delegates.find((d) => d.id === s.delegateId))
    .filter(Boolean) as typeof committee.delegates;
  const inQueueIds = new Set(inQueue.map((d) => d.id));
  const notInQueue = allAlpha.filter((d) => !inQueueIds.has(d.id));
  const notInQueuePresent = notInQueue.filter((d) => d.status !== 'absent');
  const notInQueueAbsent = notInQueue.filter((d) => d.status === 'absent');
  const queueOrdered = [...inQueue, ...notInQueuePresent, ...notInQueueAbsent];

  const baseList = listView === 'queue' ? queueOrdered : alphabetical;
  // When searching: show all, but grey out non-matches so the filter is visible
  const filtered = baseList;

  // Auto-scroll to first match when search changes
  useEffect(() => {
    if (!search || !listRef.current) return;
    const firstMatch = listRef.current.querySelector('[data-matches="true"]') as HTMLElement | null;
    firstMatch?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [search]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-[#2E1E0F] shrink-0">
        <p className="text-lg font-black text-white leading-tight truncate mb-0.5">{committee.name}</p>
        {committee.topic && (
          <p className="text-xs text-[#C4A882] leading-snug line-clamp-2 mb-2">
            <span className="text-[#7A5A38] font-semibold">Topic: </span>{committee.topic}
          </p>
        )}
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            <MajorityPie arcFill={1} color="#4A90D9" label={`${present}`} />
            <MajorityPie arcFill={2 / 3} color="#E8A94A" label={`${Math.ceil(present * 2 / 3)}`} />
            <MajorityPie arcFill={0.5} color="#3D6B35" label={`${Math.floor(present / 2) + 1}`} />
          </div>
          <ViewToggle view={listView} onChange={setListView} />
        </div>
        {isRollCallPhase && (
          <div className="flex gap-1.5 mt-2">
            <button onClick={handleClear} className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg bg-[#2E1E0F] text-red-400 hover:bg-red-950/40 transition-colors">Clear All</button>
            <button onClick={handleAllPresent} className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg bg-[#2E1E0F] text-green-400 hover:bg-green-950/40 transition-colors">All Present</button>
            <button onClick={handleAllPresentVoting} className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg bg-[#2E1E0F] text-blue-400 hover:bg-blue-950/40 transition-colors">All P+V</button>
          </div>
        )}
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {filtered.map((d, idx) => {
          const effectiveStatus = localStatuses[d.id] ?? d.status;
          const isOnList = onListIds?.has(d.id) ?? false;
          const isAbsent = effectiveStatus === 'absent';
          const queuePos = queuePositionMap.get(d.id) ?? null;
          const matchesSearch = !search || d.country.toLowerCase().includes(search.toLowerCase());
          const isDraggable = listView === 'queue' && !isRollCallPhase && queuePositionMap.has(d.id);
          const isCurrentSpeaker = committee.currentSpeaker?.delegateId === d.id;
          // "Up next" = first in queue, not currently speaking
          const isUpNext = !isCurrentSpeaker && listView === 'queue' && queuePos === 1;

          const handleRowClick = () => {
            if (onAddToList && !isAbsent) {
              if (!isOnList) onAddToList(d.id);
              else if (onRemoveFromList) onRemoveFromList(d.id);
            }
          };

          return (
            <div key={d.id}>
              {dragOverIndex === idx && dragOverIndex !== dragIndexRef.current && (
                <div className="h-0.5 bg-[#7B4A1E] rounded-full mx-2 -mb-0.5" />
              )}
              <div
                data-matches={matchesSearch ? 'true' : 'false'}
                onClick={handleRowClick}
                draggable={isDraggable}
                onDragStart={() => { if (isDraggable) dragIndexRef.current = idx; }}
                onDragOver={(e) => { e.preventDefault(); if (listView === 'queue' && !isRollCallPhase) setDragOverIndex(idx); }}
                onDrop={() => {
                  const from = dragIndexRef.current;
                  const to = idx;
                  if (from === null || from === to || !onReorderList) { setDragOverIndex(null); return; }
                  const gslItems = (committee.speakersList ?? []);
                  const fromDelegateId = filtered[from]?.id;
                  const toDelegateId = d.id;
                  const fromIdx = gslItems.findIndex(s => s.delegateId === fromDelegateId);
                  const toIdx = gslItems.findIndex(s => s.delegateId === toDelegateId);
                  if (fromIdx < 0 || toIdx < 0) { setDragOverIndex(null); return; }
                  const newList = [...gslItems];
                  const [moved] = newList.splice(fromIdx, 1);
                  newList.splice(toIdx, 0, moved);
                  onReorderList(newList);
                  dragIndexRef.current = null;
                  setDragOverIndex(null);
                }}
                onDragEnd={() => { dragIndexRef.current = null; setDragOverIndex(null); }}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all ${
                  !matchesSearch
                    ? 'border border-transparent opacity-25'
                    : isCurrentSpeaker
                    ? 'bg-[#7B4A1E]/20 border-2 border-[#7B4A1E]'
                    : isAbsent
                    ? 'border border-transparent opacity-40'
                    : effectiveStatus === 'present'
                    ? 'bg-green-950/30 border border-green-800/30'
                    : 'bg-blue-950/30 border border-blue-800/30'
                } ${
                  (!isRollCallPhase && onAddToList && !isAbsent) || isRollCallPhase
                    ? 'cursor-pointer hover:bg-[#2E1E0F]/50'
                    : isAbsent && !isRollCallPhase
                    ? 'cursor-not-allowed'
                    : ''
                } ${isDraggable ? 'cursor-grab' : ''}`}
              >
                <div className="relative shrink-0">
                  <FlagCircle country={d.country} size={isUpNext ? 'md' : 'sm'} />
                  {/* Queue position bubble */}
                  {queuePos !== null && (
                    <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-0.5 bg-[#7B4A1E] rounded-full text-white text-[13px] flex items-center justify-center font-black leading-none">
                      {queuePos <= 99 ? queuePos : '99+'}
                    </div>
                  )}
                </div>
                <span className={`flex-1 line-clamp-2 break-words whitespace-normal leading-tight max-w-[100px] ${isUpNext ? 'text-lg font-bold' : 'text-base'} ${!isAbsent ? 'text-white font-medium' : 'text-[#7A5A38]'}`}>
                  {d.country}
                </span>
                {isAbsent && !isRollCallPhase && (
                  <span className="text-[10px] text-[#7A5A38] shrink-0 font-mono ml-auto">absent</span>
                )}
                {isRollCallPhase && (
                  <div onClick={(e) => e.stopPropagation()} className={`ml-auto shrink-0 ${isReadOnly ? 'pointer-events-none opacity-50' : ''}`}>
                    <StatusSlider status={effectiveStatus} onCycle={() => cycleStatus(d.id, effectiveStatus)} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-[#2E1E0F] px-3 py-3 space-y-2 shrink-0 overflow-visible">
        <AddCountryInput committee={committee} onAdd={handleAddDelegate} onQueryChange={setSearch} />
        {(committee.phase === 'pre-session' || committee.phase === 'roll-call') && (
          <button
            onClick={handleBeginSession}
            disabled={present < 1}
            className="w-full bg-[#3D6B35] hover:bg-[#4A7C42] disabled:bg-[#2E1E0F] disabled:text-[#7A5A38] text-white py-3 rounded-xl text-sm font-bold transition-colors"
          >
            {present >= 1 ? 'Begin Session →' : 'Add at least 1 delegate'}
          </button>
        )}
      </div>

      {showFullList && (
        <FullListPopup
          list={committee.speakersList}
          title="General Speakers List"
          onClose={() => setShowFullList(false)}
          onRemove={onRemoveFromList ? (id) => { onRemoveFromList(id); } : undefined}
        />
      )}
    </div>
  );
}

const RollCallPanel = React.memo(RollCallPanelInner, (prev, next) => {
  return (
    prev.committee.delegates === next.committee.delegates &&
    prev.committee.speakersList === next.committee.speakersList &&
    prev.committee.phase === next.committee.phase &&
    prev.committee.currentSpeaker === next.committee.currentSpeaker &&
    prev.committee.caucusQueue === next.committee.caucusQueue &&
    prev.isRollCallPhase === next.isRollCallPhase &&
    prev.isReadOnly === next.isReadOnly &&
    prev.onListIds === next.onListIds
  );
});

export default RollCallPanel;
