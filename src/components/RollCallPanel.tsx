'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Committee, DelegateStatus } from '@/lib/types';
import { getFlagUrl, getCountryByName, UN_COUNTRIES } from '@/lib/countries';
import {
  setPhase as setPhaseInDB,
  setDelegateStatus as setDelegateStatusInDB,
  removeFromSpeakersList as removeFromSpeakersListInDB,
} from '@/lib/committeeService';

// ── FlagCircle ────────────────────────────────────────────────────────────────
export function FlagCircle({ country, size = 'md' }: { country: string; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero' }) {
  const found = getCountryByName(country);
  const dim: Record<string, string> = {
    xs:   'w-7 h-7',
    sm:   'w-9 h-9',
    md:   'w-12 h-12',
    lg:   'w-14 h-14',
    xl:   'w-20 h-20',
    hero: 'w-60 h-60',
  };
  const box = dim[size];
  return (
    <div className={`relative ${box} rounded-full overflow-hidden shrink-0 flex items-center justify-center`} style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
      {found
        ? <img src={getFlagUrl(found.code)} alt={found.code} className="w-[85%] h-[85%] object-contain" style={{ border: '1.5px solid rgba(28,20,16,0.10)', borderRadius: 'inherit' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>}
    </div>
  );
}

// ── 3-state slider ────────────────────────────────────────────────────────────
function StatusSlider({ status, onCycle }: { status: DelegateStatus; onCycle: () => void }) {
  const thumbPos = status === 'absent' ? 'left-[2px]' : status === 'present' ? 'left-[32px]' : 'left-[62px]';
  const thumbColor = status === 'absent' ? 'bg-[#8B2020]' : status === 'present' ? 'bg-[#3D7A52]' : 'bg-[#B6871F]';
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onCycle(); }}
      className="relative w-[90px] h-[30px] rounded-full cursor-pointer shrink-0 select-none transition-all" style={{ backgroundColor: 'rgba(255,255,255,0.10)', border: '1.5px solid rgba(255,255,255,0.22)' }}
      title="Tap to cycle: Absent → Present → PV"
    >
      <div className="absolute inset-0 grid grid-cols-3 items-center pointer-events-none">
        <span className={`text-[10px] font-bold text-center ${status === 'absent' ? 'text-white' : 'text-white/40'}`}>A</span>
        <span className={`text-[10px] font-bold text-center ${status === 'present' ? 'text-white' : 'text-white/40'}`}>P</span>
        <span className={`text-[10px] font-bold text-center ${status === 'present-voting' ? 'text-white' : 'text-white/40'}`}>PV</span>
      </div>
      <div className={`absolute top-[2px] w-[26px] h-[22px] rounded-full transition-all duration-200 shadow-sm ${thumbPos} ${thumbColor}`} />
    </button>
  );
}

// ── A-Z / QUEUE view toggle slider ────────────────────────────────────────────
function ViewToggle({ view, onChange }: { view: 'az' | 'queue'; onChange: (v: 'az' | 'queue') => void }) {
  const isQueue = view === 'queue';
  return (
    <button
      data-tutorial="sidebar-view-toggle"
      data-current-view={view}
      onClick={() => onChange(isQueue ? 'az' : 'queue')}
      className="relative w-[104px] h-[28px] rounded-full cursor-pointer select-none shrink-0"
      style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
      title="Toggle A-Z / Queue view"
    >
      <div className={`absolute top-[1px] w-[51px] h-[26px] rounded-full transition-all duration-200 ${isQueue ? 'left-[51px]' : 'left-[1px]'}`}
        style={{ backgroundColor: 'rgba(255,255,255,0.22)' }} />
      <div className="absolute inset-0 flex items-center pointer-events-none z-10">
        <span className={`w-[52px] text-[10px] font-bold text-center leading-none ${!isQueue ? 'text-white' : 'text-white/40'}`}>A-Z</span>
        <span className={`w-[52px] text-[10px] font-bold text-center leading-none ${isQueue ? 'text-white' : 'text-white/40'}`}>QUEUE</span>
      </div>
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
      <div className="flex items-center rounded-xl overflow-hidden transition-all" style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
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
          className="flex-1 bg-transparent px-3 py-2.5 text-sm focus:outline-none placeholder-white/30" style={{ color: '#EDE7D8' }}
        />
        {query && (topKnown || trimmed) && (
          <span className="text-[10px] text-[#9A8A78] px-2 truncate max-w-[80px]">
            ↵ {topKnown ? topKnown.name : trimmed}
          </span>
        )}
      </div>

      {query && (knownMatches.length > 0 || showCustomOption) && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl overflow-hidden z-30 shadow-xl max-h-52 overflow-y-auto">
          {knownMatches
            .filter((c) => !existingNames.has(c.name.toLowerCase()))
            .slice(0, showCustomOption ? 5 : 8)
            .map((c, i) => (
              <button
                key={c.code}
                onMouseDown={(e) => { e.preventDefault(); commit(c.name); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                  i === 0 ? 'bg-[#1B3828]/20 text-[#1C1410]' : 'text-[#1C1410] hover:bg-[#DDD4C0]'
                }`}
              >
                <img src={getFlagUrl(c.code)} alt={c.code} className="w-5 h-5 object-contain shrink-0" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                <span className="text-sm flex-1">{c.name}</span>
                {i === 0 && <span className="text-[10px] text-[#9A8A78] shrink-0">Enter ↵</span>}
              </button>
            ))}
          {showCustomOption && (
            <button
              onMouseDown={(e) => { e.preventDefault(); commit(trimmed); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors text-[#1C1410] hover:bg-[#DDD4C0] border-t border-[#DDD4C0]"
            >
              <span className="text-base">🌐</span>
              <span className="text-sm flex-1">{trimmed}</span>
              <span className="text-[10px] text-[#1B3828] shrink-0 font-semibold">Add custom</span>
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
      <div className="bg-[#EDE7D8] border-2 border-[#C8BAA8] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#DDD4C0] shrink-0">
          <h3 className="font-black text-[#1C1410] text-base">{title}</h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#9A8A78] font-mono">{list.length} speakers</span>
            <button onClick={onClose} className="text-[#9A8A78] hover:text-[#1C1410] text-xl leading-none">✕</button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1">
          {list.length === 0 ? (
            <div className="px-5 py-8 text-center text-[#9A8A78] text-sm">No speakers queued</div>
          ) : (
            list.map((s, i) => (
              <div key={s.delegateId} className="flex items-center gap-3 px-4 py-2.5 border-b border-[#DDD4C0]/40 group hover:bg-[#DDD4C0]/30 transition-colors">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
                  style={{ backgroundColor: 'rgba(238,217,138,0.15)', color: '#EED98A', border: '1px solid rgba(238,217,138,0.25)' }}>
                  {i + 1}
                </span>
                <FlagCircle country={s.country} size="xs" />
                <span className="text-sm text-[#1C1410] flex-1 truncate">{s.country}</span>
                {onRemove && (
                  <button
                    onClick={() => onRemove(s.delegateId)}
                    className="text-[#9A8A78] hover:text-[#8B2020] transition-colors text-xs opacity-0 group-hover:opacity-100 shrink-0"
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
export function MajorityPie({ arcFill, color, label }: {
  arcFill: number; color: string; label: string;
}) {
  const r = 13; const circ = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-1">
      <svg width="32" height="32" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="5" />
        <circle cx="16" cy="16" r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - Math.min(arcFill, 1))}
          strokeLinecap="round"
          transform="rotate(-90 16 16)"
          style={{ transition: 'stroke-dashoffset 0.3s' }}
        />
      </svg>
      <span className="text-xs font-bold" style={{ color: '#EDE7D8' }}>{label}</span>
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
  showBulkActions = false,
  showViewToggle = true,
  isReadOnly = false,
  isTdT = false,
  isRoomOrderTdT = false,
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
  showBulkActions?: boolean;
  showViewToggle?: boolean;
  isReadOnly?: boolean;
  isTdT?: boolean;
  isRoomOrderTdT?: boolean;
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
  // Current speaker is always #1; queue starts at 2 if there's a current speaker.
  const queuePositionMap = new Map<string, number>();
  if (committee.currentSpeaker?.delegateId) {
    queuePositionMap.set(committee.currentSpeaker.delegateId, 1);
  }
  const queueOffset = committee.currentSpeaker ? 2 : 1;
  (committee.speakersList ?? []).forEach((s, i) => {
    queuePositionMap.set(s.delegateId, i + queueOffset);
  });
  // Caucus current speaker — only when committee.currentSpeaker is null (caucus mode)
  if (!committee.currentSpeaker && committee.caucus?.currentSpeaker) {
    const caucusCurrent = committee.delegates.find((d) => d.country === committee.caucus!.currentSpeaker);
    if (caucusCurrent) queuePositionMap.set(caucusCurrent.id, 1);
  }

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

  const currentSpeakerDelegate = committee.currentSpeaker?.delegateId
    ? committee.delegates.find((d) => d.id === committee.currentSpeaker!.delegateId) ?? null
    : null;
  const caucusCurrentDelegate = (!committee.currentSpeaker && committee.caucus?.currentSpeaker)
    ? committee.delegates.find((d) => d.country === committee.caucus!.currentSpeaker) ?? null
    : null;
  const speakerAtTop = currentSpeakerDelegate ?? caucusCurrentDelegate;
  const finalQueueOrdered = speakerAtTop
    ? [speakerAtTop, ...queueOrdered.filter((d) => d.id !== speakerAtTop.id)]
    : queueOrdered;

  const baseList = listView === 'queue' ? finalQueueOrdered : alphabetical;
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
      <div className="px-4 pt-4 pb-3 shrink-0 relative z-10" style={{ borderBottom: '1px solid rgba(61,122,82,0.4)' }}>
        <p className="text-lg font-black leading-tight truncate mb-0.5" style={{ color: '#EED98A' }}>{committee.name}</p>
        {committee.topic && (
          <p className="text-xs leading-snug line-clamp-2 mb-2" style={{ color: 'rgba(238,217,138,0.55)' }}>
            <span className="font-semibold" style={{ color: 'rgba(238,217,138,0.7)' }}>Topic: </span>{committee.topic}
          </p>
        )}
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            <MajorityPie arcFill={1} color="#2A5A3C" label={`${present}`} />
            <MajorityPie arcFill={2 / 3} color="#B6871F" label={`${Math.ceil(present * 2 / 3)}`} />
            <MajorityPie arcFill={0.5} color="#8A7A6A" label={`${Math.floor(present / 2) + 1}`} />
          </div>
          {showViewToggle && <ViewToggle view={listView} onChange={setListView} />}
        </div>
        {showBulkActions && (
          <div className="flex gap-1.5 mt-2">
            <button onClick={handleClear} className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1.5 rounded-lg transition-colors" style={{ backgroundColor: 'rgba(139,32,32,0.25)', color: '#F4A0A0', border: '1px solid rgba(139,32,32,0.4)' }}>Clear All</button>
            <button onClick={handleAllPresent} className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1.5 rounded-lg transition-colors" style={{ backgroundColor: 'rgba(61,122,82,0.3)', color: '#EDE7D8', border: '1px solid rgba(61,122,82,0.4)' }}>All Present</button>
            <button onClick={handleAllPresentVoting} className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1.5 rounded-lg transition-colors" style={{ backgroundColor: 'rgba(182,135,31,0.25)', color: '#EED98A', border: '1px solid rgba(182,135,31,0.35)' }}>All P+V</button>
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
          const isCurrentSpeakerInPanel = queuePos === 1 && (
            committee.currentSpeaker?.delegateId === d.id ||
            committee.caucus?.currentSpeaker === d.country
          );
          const isUpNext = listView === 'queue' && isCurrentSpeakerInPanel;

          const handleRowClick = () => {
            if (onAddToList && !isAbsent) {
              if (!isOnList) onAddToList(d.id);
              else if (onRemoveFromList) onRemoveFromList(d.id);
            }
          };

          return (
            <div key={d.id}>
              {dragOverIndex === idx && dragOverIndex !== dragIndexRef.current && (
                <div className="h-0.5 bg-[#1B3828] rounded-full mx-2 -mb-0.5" />
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
                    ? 'opacity-20'
                    : isCurrentSpeaker
                    ? 'border-2'
                    : isAbsent
                    ? 'opacity-35'
                    : effectiveStatus === 'present'
                    ? 'border'
                    : 'border'
                } ${
                  (!isRollCallPhase && onAddToList && !isAbsent) || isRollCallPhase
                    ? 'cursor-pointer'
                    : isAbsent && !isRollCallPhase
                    ? 'cursor-not-allowed'
                    : ''
                } ${isDraggable ? 'cursor-grab' : ''}`}
                style={{
                  backgroundColor: !matchesSearch ? 'transparent'
                    : isCurrentSpeaker ? 'rgba(238,217,138,0.12)'
                    : isAbsent ? 'transparent'
                    : effectiveStatus === 'present' ? 'rgba(61,122,82,0.22)'
                    : 'rgba(182,135,31,0.18)',
                  borderColor: !matchesSearch ? 'transparent'
                    : isCurrentSpeaker ? 'rgba(238,217,138,0.5)'
                    : isAbsent ? 'transparent'
                    : effectiveStatus === 'present' ? 'rgba(61,122,82,0.4)'
                    : 'rgba(182,135,31,0.4)',
                }}
                onMouseEnter={(e) => { if (!isAbsent) (e.currentTarget as HTMLElement).style.backgroundColor = effectiveStatus === 'present' ? 'rgba(61,122,82,0.38)' : effectiveStatus === 'present-voting' ? 'rgba(182,135,31,0.32)' : 'rgba(238,217,138,0.08)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = !matchesSearch ? 'transparent' : isCurrentSpeaker ? 'rgba(238,217,138,0.12)' : isAbsent ? 'transparent' : effectiveStatus === 'present' ? 'rgba(61,122,82,0.22)' : 'rgba(182,135,31,0.18)'; }}
              >
                <div className="relative shrink-0">
                  {isRoomOrderTdT && queuePos !== null ? (
                    <div className={`${isUpNext ? 'w-12 h-12' : 'w-9 h-9'} rounded-full bg-[#DDD4C0] border border-[#C8BAA8] flex items-center justify-center`}>
                      <span className={`font-black text-[#B6871F] ${isUpNext ? 'text-xl' : 'text-sm'}`}>{queuePos}</span>
                    </div>
                  ) : (
                    <FlagCircle country={d.country} size={isUpNext ? 'md' : 'sm'} />
                  )}
                  {/* Queue position bubble — omitted when isRoomOrderTdT since position is already the primary display */}
                  {queuePos !== null && !isRoomOrderTdT && (
                    <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-0.5 rounded-full flex items-center justify-center font-black leading-none text-[10px]"
                      style={{ backgroundColor: '#EDE7D8', color: '#1B3828', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
                      {queuePos === 1 && (committee.currentSpeaker?.delegateId === d.id || committee.caucus?.currentSpeaker === d.country) ? '★' : queuePos <= 99 ? queuePos : '99+'}
                    </div>
                  )}
                </div>
                <span className={`flex-1 truncate ${isUpNext ? 'text-lg font-bold' : 'text-base'} ${!isAbsent ? 'font-medium' : 'opacity-50'}`} style={{ color: '#EDE7D8' }}>
                  {d.country}
                </span>
                {isAbsent && !isRollCallPhase && (
                  <span className="text-[10px] shrink-0 font-mono ml-auto uppercase tracking-wide" style={{ color: 'rgba(237,231,216,0.35)' }}>absent</span>
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

      <div className="px-3 py-3 space-y-2 shrink-0 overflow-visible relative z-10" style={{ borderTop: '1px solid rgba(61,122,82,0.3)' }}>
        <AddCountryInput committee={committee} onAdd={handleAddDelegate} onQueryChange={setSearch} />
        {(committee.phase === 'pre-session' || committee.phase === 'roll-call') && (
          <button
            onClick={handleBeginSession}
            disabled={present < 1}
            className="w-full disabled:opacity-40 disabled:cursor-not-allowed py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all active:scale-[0.98]" style={{ backgroundColor: '#EDE7D8', color: '#1B3828' }} onMouseEnter={(e) => { if ((e.currentTarget as HTMLButtonElement).disabled) return; (e.currentTarget as HTMLElement).style.backgroundColor = '#DDD4C0'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(237,231,216,0.3)'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#EDE7D8'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
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
    prev.showBulkActions === next.showBulkActions &&
    prev.showViewToggle === next.showViewToggle &&
    prev.isReadOnly === next.isReadOnly &&
    prev.isTdT === next.isTdT &&
    prev.isRoomOrderTdT === next.isRoomOrderTdT &&
    prev.onListIds === next.onListIds
  );
});

export default RollCallPanel;
