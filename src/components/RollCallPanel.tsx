'use client';

import { useState } from 'react';
import { Committee, DelegateStatus } from '@/lib/types';
import { useCommitteeStore } from '@/lib/store';
import { getFlagEmoji, getCountryByName, UN_COUNTRIES } from '@/lib/countries';

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
    <div className={`${box} rounded-full overflow-hidden flex items-center justify-center bg-[#1a2035] shrink-0`}>
      <span style={{ fontSize: font, lineHeight: 1 }}>{flag}</span>
    </div>
  );
}

export default function RollCallPanel({ committee }: { committee: Committee }) {
  const { setDelegateStatus, setPhase, addDelegate } = useCommitteeStore();
  const [search, setSearch] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [customName, setCustomName] = useState('');

  const present = committee.delegates.filter((d) => d.status !== 'absent').length;
  const total = committee.delegates.length;
  const quorum = Math.ceil(total / 2) + 1;
  const hasQuorum = present >= quorum;

  const filtered = committee.delegates.filter((d) =>
    d.country.toLowerCase().includes(search.toLowerCase())
  );

  const cycleStatus = (id: string, current: DelegateStatus) => {
    const next: DelegateStatus =
      current === 'absent' ? 'present' : current === 'present' ? 'present-voting' : 'absent';
    setDelegateStatus(committee.id, id, next);
  };

  const availableToAdd = UN_COUNTRIES.filter(
    (c) =>
      !committee.delegates.some((d) => d.country === c.name) &&
      c.name.toLowerCase().includes(countrySearch.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-[#1e2540]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold text-white">Roll Call</span>
          <div className="flex gap-3">
            <button
              onClick={() => committee.delegates.forEach((d) => setDelegateStatus(committee.id, d.id, 'present'))}
              className="text-xs text-[#8892aa] hover:text-green-400 transition-colors"
            >
              All Present
            </button>
            <button
              onClick={() => committee.delegates.forEach((d) => setDelegateStatus(committee.id, d.id, 'absent'))}
              className="text-xs text-[#8892aa] hover:text-red-400 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between mb-2">
          <span className={`text-base font-bold ${hasQuorum ? 'text-green-400' : 'text-yellow-400'}`}>
            {present} / {total} present
          </span>
          <span className="text-xs text-[#4a5580]">
            {hasQuorum ? '✓ Quorum reached' : `Need ${quorum - present} more`}
          </span>
        </div>
        <div className="h-1.5 bg-[#1a1f2e] rounded-full overflow-hidden mb-3">
          <div
            className={`h-full rounded-full transition-all ${hasQuorum ? 'bg-green-500' : 'bg-yellow-500'}`}
            style={{ width: total > 0 ? `${(present / total) * 100}%` : '0%' }}
          />
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="w-full bg-[#141929] border border-[#1e2540] rounded-lg px-3 py-2 text-white text-sm placeholder-[#4a5580] focus:outline-none focus:border-blue-600"
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {filtered.map((d) => (
          <button
            key={d.id}
            onClick={() => cycleStatus(d.id, d.status)}
            title="Tap to cycle: Absent → Present → P&V"
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
              d.status === 'present'
                ? 'bg-green-950/40 border border-green-800/30'
                : d.status === 'present-voting'
                ? 'bg-blue-950/40 border border-blue-800/30'
                : 'border border-transparent hover:bg-[#141929]'
            }`}
          >
            <FlagCircle country={d.country} size="xs" />
            <span className={`flex-1 text-sm truncate ${d.status !== 'absent' ? 'text-white font-medium' : 'text-[#8892aa]'}`}>
              {d.country}
            </span>
            <span className={`text-xs font-bold w-6 text-right shrink-0 ${
              d.status === 'present' ? 'text-green-400' :
              d.status === 'present-voting' ? 'text-blue-400' : 'text-[#2a3050]'
            }`}>
              {d.status === 'present' ? 'P' : d.status === 'present-voting' ? 'PV' : 'A'}
            </span>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-[#1e2540] px-3 py-3 space-y-2">
        <button
          onClick={() => setShowPicker((v) => !v)}
          className="w-full text-sm text-[#8892aa] hover:text-white bg-[#141929] hover:bg-[#1e2540] py-2.5 rounded-xl transition-colors"
        >
          {showPicker ? '✕ Close' : '+ Add country'}
        </button>

        {showPicker && (
          <div className="bg-[#0d1120] border border-[#1e2540] rounded-xl overflow-hidden">
            <input
              type="text"
              value={countrySearch}
              onChange={(e) => setCountrySearch(e.target.value)}
              placeholder="Search countries..."
              autoFocus
              className="w-full bg-transparent px-3 py-2.5 text-white text-sm placeholder-[#4a5580] focus:outline-none border-b border-[#1e2540]"
            />
            <div className="max-h-40 overflow-y-auto">
              {availableToAdd.slice(0, 60).map((c) => (
                <button
                  key={c.code + c.name}
                  onClick={() => { addDelegate(committee.id, c.name); setCountrySearch(''); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#1e2540] transition-colors text-left"
                >
                  <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>{getFlagEmoji(c.code)}</span>
                  <span className="text-sm text-[#c0c8d8]">{c.name}</span>
                </button>
              ))}
              {availableToAdd.length === 0 && (
                <div className="px-3 py-3 text-sm text-[#4a5580] text-center">All countries added</div>
              )}
            </div>
            <div className="border-t border-[#1e2540] p-2.5 flex gap-2">
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && customName.trim()) { addDelegate(committee.id, customName.trim()); setCustomName(''); } }}
                placeholder="Custom name..."
                className="flex-1 bg-[#141929] border border-[#1e2540] rounded-lg px-3 py-2 text-white text-sm focus:outline-none placeholder-[#4a5580]"
              />
              <button
                onClick={() => { if (customName.trim()) { addDelegate(committee.id, customName.trim()); setCustomName(''); } }}
                className="bg-blue-700 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        )}

        {(committee.phase === 'pre-session' || committee.phase === 'roll-call') && (
          <button
            onClick={() => setPhase(committee.id, 'speakers-list')}
            disabled={!hasQuorum}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-[#1e2540] disabled:text-[#3a4060] text-white py-3 rounded-xl text-sm font-bold transition-colors"
          >
            {hasQuorum ? 'Begin Session →' : `Need ${quorum - present} more for quorum`}
          </button>
        )}
      </div>
    </div>
  );
}
