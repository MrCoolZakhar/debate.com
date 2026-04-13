'use client';

import { useRef, useState } from 'react';
import { Committee, DelegateStatus } from '@/lib/types';
import { getFlagEmoji, getCountryByName, UN_COUNTRIES } from '@/lib/countries';
import {
  setDelegateStatus as setDelegateStatusInDB,
  setPhase as setPhaseInDB,
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
  const thumbPos = status === 'absent' ? 'left-[2px]' : status === 'present' ? 'left-[27px]' : 'left-[52px]';
  const thumbColor = status === 'absent' ? 'bg-red-300' : status === 'present' ? 'bg-green-500' : 'bg-blue-500';
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onCycle(); }}
      className="relative w-[76px] h-[26px] rounded-full bg-[#1A1209] border border-[#2E1E0F] cursor-pointer shrink-0 select-none"
      title="Tap to cycle: Absent → Present → PV"
    >
      <div className="absolute inset-0 grid grid-cols-3 items-center pointer-events-none">
        <span className={`text-[10px] font-bold text-center ${status === 'absent' ? 'text-red-900' : 'text-[#7A5A38]'}`}>A</span>
        <span className={`text-[10px] font-bold text-center ${status === 'present' ? 'text-white' : 'text-[#7A5A38]'}`}>P</span>
        <span className={`text-[10px] font-bold text-center ${status === 'present-voting' ? 'text-white' : 'text-[#7A5A38]'}`}>PV</span>
      </div>
      <div className={`absolute top-[3px] w-[22px] h-[20px] rounded-full transition-all duration-200 ${thumbPos} ${thumbColor}`} />
    </button>
  );
}

// ── Add country input ─────────────────────────────────────────────────────────
// Fix #8: Allows ANY free-text country name — not just UN_COUNTRIES.
// If it matches a known country, use it. If not, allow it as a custom entity.
function AddCountryInput({ committee, onAdd }: { committee: Committee; onAdd: (country: string) => void }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const existingNames = new Set(committee.delegates.map((d) => d.country.toLowerCase()));

  // Known country matches
  const knownMatches = query.trim()
    ? UN_COUNTRIES.filter((c) => c.name.toLowerCase().startsWith(query.toLowerCase()))
        .concat(UN_COUNTRIES.filter((c) =>
          !c.name.toLowerCase().startsWith(query.toLowerCase()) &&
          c.name.toLowerCase().includes(query.toLowerCase())))
    : [];

  // The best known match that isn't already added
  const topKnown = knownMatches.find((c) => !existingNames.has(c.name.toLowerCase())) ?? null;

  // Custom entry: anything typed that isn't already in the committee
  const trimmed = query.trim();
  const isCustom = trimmed.length > 0 && !existingNames.has(trimmed.toLowerCase());
  // Show custom option only if it doesn't already exactly match a known result
  const showCustomOption = isCustom && (!topKnown || topKnown.name.toLowerCase() !== trimmed.toLowerCase());

  const commit = (name: string) => {
    const normalised = name.trim();
    if (!normalised || existingNames.has(normalised.toLowerCase())) return;
    onAdd(normalised);
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <div className="flex items-center bg-[#150F09] border border-[#2E1E0F] focus-within:border-[#7B4A1E] rounded-xl overflow-hidden transition-colors">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              // Enter uses top known match first; if none, use the raw typed text
              if (topKnown) commit(topKnown.name);
              else if (trimmed) commit(trimmed);
            }
            if (e.key === 'Escape') setQuery('');
          }}
          placeholder="Add country or observer…"
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
          {knownMatches.slice(0, showCustomOption ? 5 : 8).map((c, i) => {
            const alreadyAdded = existingNames.has(c.name.toLowerCase());
            return (
              <button
                key={c.code}
                onMouseDown={(e) => { e.preventDefault(); if (!alreadyAdded) commit(c.name); }}
                disabled={alreadyAdded}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                  alreadyAdded
                    ? 'opacity-50 cursor-default bg-[#2E1E0F]'
                    : i === 0
                    ? 'bg-[#7B4A1E]/20 text-white'
                    : 'text-[#E8D5B7] hover:bg-[#2E1E0F]'
                }`}
              >
                <span className="text-base">{getFlagEmoji(c.code)}</span>
                <span className="text-sm flex-1">{c.name}</span>
                {alreadyAdded
                  ? <span className="text-[10px] text-yellow-500 shrink-0">Already added</span>
                  : i === 0 ? <span className="text-[10px] text-[#7A5A38] shrink-0">Enter ↵</span>
                  : null}
              </button>
            );
          })}

          {/* Fix #8: Custom / observer entry */}
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
// Fix #5: Shows the complete GSL in order when the "+N more" overflow is clicked
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
                    title="Remove from list"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Roll Call Panel ───────────────────────────────────────────────────────────
export default function RollCallPanel({
  committee,
  onAddToList,
  onListIds,
  onRemoveFromList,   // Fix #6: new prop to remove from GSL via left panel
  onStatusChange,
  onPhaseChange,
  onDelegateAdd,
  isRollCallPhase = false,  // Fix #2: when true, clicking a row cycles status only (no GSL add)
}: {
  committee: Committee;
  onAddToList?: (delegateId: string) => void;
  onListIds?: Set<string>;
  onRemoveFromList?: (delegateId: string) => void;  // Fix #6
  onStatusChange?: (delegateId: string, status: DelegateStatus) => void;
  onPhaseChange?: (phase: string) => void;
  onDelegateAdd?: (country: string) => void;
  isRollCallPhase?: boolean;  // Fix #2
}) {
  const [search, setSearch] = useState('');
  const [showFullList, setShowFullList] = useState(false);  // Fix #5

  const present = committee.delegates.filter((d) => d.status !== 'absent').length;
  const total = committee.delegates.length;

  const sorted = [...committee.delegates].sort((a, b) => a.country.localeCompare(b.country));
  const filtered = sorted.filter((d) => d.country.toLowerCase().includes(search.toLowerCase()));

  const cycleStatus = (id: string, current: DelegateStatus) => {
    const next: DelegateStatus =
      current === 'absent' ? 'present' : current === 'present' ? 'present-voting' : 'absent';
    onStatusChange?.(id, next);
    setDelegateStatusInDB(id, next);
  };

  const handleAllPresent = () => {
    committee.delegates.forEach((d) => {
      onStatusChange?.(d.id, 'present');
      setDelegateStatusInDB(d.id, 'present');
    });
  };

  const handleClear = () => {
    committee.delegates.forEach((d) => {
      onStatusChange?.(d.id, 'absent');
      setDelegateStatusInDB(d.id, 'absent');
    });
  };

  const handleBeginSession = () => {
    onPhaseChange?.('speakers-list');
    setPhaseInDB(committee.id, 'speakers-list');
  };

  // Fix #7 + #1: delegate add goes ONLY through onDelegateAdd prop (chair page handles DB insert
  // and gets the real UUID back). RollCallPanel no longer calls addDelegateInDB directly —
  // that was the duplicate insert bug.
  const handleAddDelegate = (country: string) => {
    onDelegateAdd?.(country);
    // Previously also called addDelegateInDB here — removed to fix duplicate insert bug (#1)
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-[#2E1E0F] shrink-0">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold text-white">Roll Call</span>
          <div className="flex gap-3">
            <button onClick={handleAllPresent} className="text-xs text-[#C4A882] hover:text-green-600 transition-colors">All Present</button>
            <button onClick={handleClear} className="text-xs text-[#C4A882] hover:text-red-500 transition-colors">Clear</button>
          </div>
        </div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-base font-bold text-green-400">{present} / {total} present</span>
          {/* Fix #5: click to open full GSL popup */}
          {onListIds && onListIds.size > 0 && (
            <button
              onClick={() => setShowFullList(true)}
              className="text-xs text-[#7B4A1E] hover:text-[#C4A882] font-semibold transition-colors"
            >
              GSL: {onListIds.size} →
            </button>
          )}
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter…"
          className="w-full bg-[#150F09] border border-[#2E1E0F] rounded-lg px-3 py-2 text-white text-sm placeholder-[#7A5A38] focus:outline-none focus:border-[#7B4A1E]"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {filtered.map((d) => {
          const isOnList = onListIds?.has(d.id) ?? false;
          const isAbsent = d.status === 'absent';

          // Fix #2: in roll-call phase, row click cycles status.
          // In session phase, row click adds to GSL — but ONLY if not absent (#4).
          const handleRowClick = () => {
            if (isRollCallPhase) {
              cycleStatus(d.id, d.status);
            } else if (onAddToList && !isAbsent) {
              // Fix #4: absent delegates cannot be added to GSL
              if (!isOnList) onAddToList(d.id);
              else if (onRemoveFromList) onRemoveFromList(d.id); // Fix #6: click again to remove
            }
          };

          return (
            <div
              key={d.id}
              onClick={handleRowClick}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-xl transition-all ${
                // Fix #4: absent delegates are visually dimmed
                isAbsent
                  ? 'border border-transparent opacity-40'
                  : d.status === 'present'
                  ? 'bg-green-950/30 border border-green-800/30'
                  : 'bg-blue-950/30 border border-blue-800/30'
              } ${
                // Only show pointer/hover when the click will do something useful
                (!isRollCallPhase && onAddToList && !isAbsent) || isRollCallPhase
                  ? 'cursor-pointer hover:bg-[#2E1E0F]/50'
                  : isAbsent && !isRollCallPhase
                  ? 'cursor-not-allowed'
                  : ''
              }`}
            >
              <div className="relative shrink-0">
                <FlagCircle country={d.country} size="xs" />
                {isOnList && (
                  <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full text-white text-[7px] flex items-center justify-center font-bold">✓</div>
                )}
              </div>
              <span className={`flex-1 text-sm truncate ${!isAbsent ? 'text-white font-medium' : 'text-[#7A5A38]'}`}>
                {d.country}
              </span>
              {/* Fix #4: show "Absent" label so it's clear they can't be added */}
              {isAbsent && !isRollCallPhase && (
                <span className="text-[10px] text-[#7A5A38] shrink-0 font-mono">absent</span>
              )}
              {/* Slider stops propagation internally so row click won't double-fire */}
              <div onClick={(e) => e.stopPropagation()}>
                <StatusSlider status={d.status} onCycle={() => cycleStatus(d.id, d.status)} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-[#2E1E0F] px-3 py-3 space-y-2 shrink-0">
        {/* Fix #7 + #8: custom AddCountryInput */}
        <AddCountryInput committee={committee} onAdd={handleAddDelegate} />
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

      {/* Fix #5: Full GSL popup */}
      {showFullList && (
        <FullListPopup
          list={committee.speakersList}
          title="General Speakers List"
          onClose={() => setShowFullList(false)}
          onRemove={onRemoveFromList ? (id) => {
            onRemoveFromList(id);
          } : undefined}
        />
      )}
    </div>
  );
}