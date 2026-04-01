'use client';

import { useRef, useState } from 'react';
import { Committee, DelegateStatus } from '@/lib/types';
import { useCommitteeStore } from '@/lib/store';
import { getFlagEmoji, getCountryByName, UN_COUNTRIES } from '@/lib/countries';

// ── FlagCircle (fixed: no top-clipping) ──────────────────────────────────────
export function FlagCircle({ country, size = 'md' }: { country: string; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' }) {
  const found = getCountryByName(country);
  const flag = found ? getFlagEmoji(found.code) : '🌐';
  const dim: Record<string, { box: string; font: string }> = {
    xs: { box: 'w-7 h-7',   font: '1.6rem' },
    sm: { box: 'w-10 h-10', font: '2.2rem' },
    md: { box: 'w-12 h-12', font: '2.8rem' },
    lg: { box: 'w-20 h-20', font: '4.5rem' },
    xl: { box: 'w-32 h-32', font: '7rem'   },
  };
  const { box, font } = dim[size];
  return (
    <div className={`relative ${box} rounded-full overflow-hidden bg-[#2E1E0F] shrink-0`}>
      <span style={{
        fontSize: font,
        lineHeight: '1',
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        display: 'block',
      }}>
        {flag}
      </span>
    </div>
  );
}


// ── 3-state iPhone-style slider ───────────────────────────────────────────────
function StatusSlider({ status, onCycle }: { status: DelegateStatus; onCycle: () => void }) {
  const thumbPos = status === 'absent' ? 'left-[2px]' : status === 'present' ? 'left-[27px]' : 'left-[52px]';
  const thumbColor = status === 'absent' ? 'bg-[#3a4060]' : status === 'present' ? 'bg-green-500' : 'bg-blue-500';

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onCycle(); }}
      className="relative w-[76px] h-[26px] rounded-full bg-[#1A1209] border border-[#2E1E0F] cursor-pointer shrink-0 select-none"
      title="Tap to cycle: Absent → Present → PV"
    >
      <div className="absolute inset-0 flex items-center justify-around px-1 pointer-events-none">
        <span className={`text-[10px] font-bold z-10 ${status === 'absent' ? 'text-white' : 'text-[#7A5A38]'}`}>A</span>
        <span className={`text-[10px] font-bold z-10 ${status === 'present' ? 'text-white' : 'text-[#7A5A38]'}`}>P</span>
        <span className={`text-[10px] font-bold z-10 ${status === 'present-voting' ? 'text-white' : 'text-[#7A5A38]'}`}>PV</span>
      </div>
      <div className={`absolute top-[3px] w-[22px] h-[20px] rounded-full transition-all duration-200 ${thumbPos} ${thumbColor}`} />
    </button>
  );
}


function AddCountryInput({ committee }: { committee: Committee }) {
  const { addDelegate } = useCommitteeStore();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const existingNames = new Set(committee.delegates.map((d) => d.country.toLowerCase()));

  // All UN countries matching query — startsWith first, then includes
  const allMatches = query.trim()
    ? UN_COUNTRIES.filter((c) => c.name.toLowerCase().startsWith(query.toLowerCase()))
        .concat(UN_COUNTRIES.filter((c) => !c.name.toLowerCase().startsWith(query.toLowerCase()) && c.name.toLowerCase().includes(query.toLowerCase())))
    : [];
  const top = allMatches.find((c) => !existingNames.has(c.name.toLowerCase())) ?? allMatches[0] ?? null;

  const commit = (name: string) => {
    if (!existingNames.has(name.toLowerCase())) {
      addDelegate(committee.id, name);
    }
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <div className="flex items-center bg-[#0D0906] border border-[#2E1E0F] focus-within:border-[#7B4A1E] rounded-xl overflow-hidden transition-colors">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && top) { e.preventDefault(); commit(top.name); }
            if (e.key === 'Escape') setQuery('');
          }}
          placeholder="Add country…"
          className="flex-1 bg-transparent px-3 py-2.5 text-white text-sm placeholder-[#7A5A38] focus:outline-none"
        />
        {top && query && !existingNames.has(top.name.toLowerCase()) && (
          <span className="text-[10px] text-[#7A5A38] px-2 truncate max-w-[80px]">↵ {top.name}</span>
        )}
      </div>
      {query && allMatches.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#0D0906] border border-[#2E1E0F] rounded-xl overflow-hidden z-30 shadow-xl max-h-52 overflow-y-auto">
          {allMatches.slice(0, 8).map((c, i) => {
            const alreadyAdded = existingNames.has(c.name.toLowerCase());
            return (
              <button
                key={c.code}
                onMouseDown={(e) => { e.preventDefault(); if (!alreadyAdded) commit(c.name); }}
                disabled={alreadyAdded}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                  alreadyAdded
                    ? 'opacity-50 cursor-default bg-[#150F09]'
                    : i === 0
                    ? 'bg-[#7B4A1E]/20 text-white'
                    : 'text-[#E8D5B7] hover:bg-[#2E1E0F]'
                }`}
              >
                <span className="text-base">{getFlagEmoji(c.code)}</span>
                <span className="text-sm flex-1">{c.name}</span>
                {alreadyAdded
                  ? <span className="text-[10px] text-yellow-500 shrink-0">Already on GSL</span>
                  : i === 0
                  ? <span className="text-[10px] text-[#7A5A38] shrink-0">Enter ↵</span>
                  : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Roll Call Panel ───────────────────────────────────────────────────────────
export default function RollCallPanel({ committee }: { committee: Committee }) {
  const { setDelegateStatus, setPhase } = useCommitteeStore();
  const [search, setSearch] = useState('');

  const present = committee.delegates.filter((d) => d.status !== 'absent').length;
  const total = committee.delegates.length;
  const quorum = Math.ceil(total / 4);
  const hasQuorum = present >= quorum;

  // Always alphabetical
  const sorted = [...committee.delegates].sort((a, b) => a.country.localeCompare(b.country));
  const filtered = sorted.filter((d) =>
    d.country.toLowerCase().includes(search.toLowerCase())
  );

  const cycleStatus = (id: string, current: DelegateStatus) => {
    const next: DelegateStatus =
      current === 'absent' ? 'present' : current === 'present' ? 'present-voting' : 'absent';
    setDelegateStatus(committee.id, id, next);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-[#2E1E0F] shrink-0">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold text-white">Roll Call</span>
          <div className="flex gap-3">
            <button
              onClick={() => committee.delegates.forEach((d) => setDelegateStatus(committee.id, d.id, 'present'))}
              className="text-xs text-[#C4A882] hover:text-green-400 transition-colors"
            >
              All Present
            </button>
            <button
              onClick={() => committee.delegates.forEach((d) => setDelegateStatus(committee.id, d.id, 'absent'))}
              className="text-xs text-[#C4A882] hover:text-red-400 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between mb-2">
          <span className={`text-base font-bold ${hasQuorum ? 'text-green-400' : 'text-yellow-400'}`}>
            {present} / {total} present
          </span>
          <span className="text-xs text-[#7A5A38]">
            {hasQuorum ? '✓ Quorum' : `Need ${quorum - present} more`}
          </span>
        </div>
        <div className="h-1.5 bg-[#2E1E0F] rounded-full overflow-hidden mb-3">
          <div
            className={`h-full rounded-full transition-all ${hasQuorum ? 'bg-green-500' : 'bg-yellow-500'}`}
            style={{ width: total > 0 ? `${(present / total) * 100}%` : '0%' }}
          />
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter…"
          className="w-full bg-[#1A1209] border border-[#2E1E0F] rounded-lg px-3 py-2 text-white text-sm placeholder-[#7A5A38] focus:outline-none focus:border-[#7B4A1E]"
        />
      </div>

      {/* Delegate list — scrolls independently */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {filtered.map((d) => (
          <div
            key={d.id}
            className={`flex items-center gap-2 px-2.5 py-2 rounded-xl transition-all ${
              d.status === 'present'
                ? 'bg-green-950/40 border border-green-800/30'
                : d.status === 'present-voting'
                ? 'bg-[#7B4A1E]/20 border border-[#7B4A1E]/30'
                : 'border border-transparent'
            }`}
          >
            <FlagCircle country={d.country} size="xs" />
            <span className={`flex-1 text-sm truncate ${d.status !== 'absent' ? 'text-white font-medium' : 'text-[#C4A882]'}`}>
              {d.country}
            </span>
            <StatusSlider status={d.status} onCycle={() => cycleStatus(d.id, d.status)} />
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-[#2E1E0F] px-3 py-3 space-y-2 shrink-0">
        <AddCountryInput committee={committee} />

        {(committee.phase === 'pre-session' || committee.phase === 'roll-call') && (
          <button
            onClick={() => setPhase(committee.id, 'speakers-list')}
            disabled={!hasQuorum}
            className="w-full bg-[#3D6B35] hover:bg-[#4A7C42] disabled:bg-[#2E1E0F] disabled:text-[#7A5A38] text-white py-3 rounded-xl text-sm font-bold transition-colors"
          >
            {hasQuorum ? 'Begin Session →' : `Need ${quorum - present} more for quorum`}
          </button>
        )}
      </div>
    </div>
  );
}
