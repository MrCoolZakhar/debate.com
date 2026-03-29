'use client';

import { useState } from 'react';
import { Committee, DelegateStatus } from '@/lib/types';
import { useCommitteeStore } from '@/lib/store';
import { getFlagEmoji, getCountryByName, UN_COUNTRIES } from '@/lib/countries';

function FlagCircle({ country }: { country: string }) {
  const found = getCountryByName(country);
  const flag = found ? getFlagEmoji(found.code) : '🌐';
  return (
    <div className="w-6 h-6 rounded-full bg-[#1e2540] flex items-center justify-center shrink-0 text-sm">
      {flag}
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
      <div className="p-3 border-b border-[#1e2540]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono text-[#4a5580]">ROLL CALL</span>
          <div className="flex gap-2">
            <button
              onClick={() => committee.delegates.forEach((d) => setDelegateStatus(committee.id, d.id, 'present'))}
              className="text-xs text-[#8892aa] hover:text-green-400 transition-colors"
            >
              All P
            </button>
            <button
              onClick={() => committee.delegates.forEach((d) => setDelegateStatus(committee.id, d.id, 'absent'))}
              className="text-xs text-[#8892aa] hover:text-red-400 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between mb-1.5">
          <span className={`text-sm font-bold ${hasQuorum ? 'text-green-400' : 'text-yellow-400'}`}>
            {present}/{total}
          </span>
          <span className="text-xs text-[#4a5580]">
            {hasQuorum ? '✓ Quorum' : `+${quorum - present} for quorum`}
          </span>
        </div>
        <div className="h-1 bg-[#1a1f2e] rounded-full overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all ${hasQuorum ? 'bg-green-500' : 'bg-yellow-500'}`}
            style={{ width: total > 0 ? `${(present / total) * 100}%` : '0%' }}
          />
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search delegates..."
          className="w-full bg-[#141929] border border-[#1e2540] rounded-lg px-2.5 py-1.5 text-white text-xs placeholder-[#4a5580] focus:outline-none focus:border-blue-600"
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {filtered.map((d) => (
          <button
            key={d.id}
            onClick={() => cycleStatus(d.id, d.status)}
            title="Click: Absent → Present → P&V → Absent"
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all text-left ${
              d.status === 'present'
                ? 'bg-green-950/40 border border-green-800/30'
                : d.status === 'present-voting'
                ? 'bg-blue-950/40 border border-blue-800/30'
                : 'border border-transparent hover:bg-[#141929]'
            }`}
          >
            <FlagCircle country={d.country} />
            <span className={`flex-1 text-xs truncate ${d.status !== 'absent' ? 'text-white' : 'text-[#8892aa]'}`}>
              {d.country}
            </span>
            <span className={`text-xs font-bold w-5 text-right ${
              d.status === 'present' ? 'text-green-400' :
              d.status === 'present-voting' ? 'text-blue-400' : 'text-[#2a3050]'
            }`}>
              {d.status === 'present' ? 'P' : d.status === 'present-voting' ? 'PV' : 'A'}
            </span>
          </button>
        ))}
      </div>

      {/* Footer: add country + begin session */}
      <div className="border-t border-[#1e2540] p-2 space-y-2">
        <button
          onClick={() => setShowPicker((v) => !v)}
          className="w-full text-xs text-[#8892aa] hover:text-white bg-[#141929] hover:bg-[#1e2540] py-2 rounded-lg transition-colors"
        >
          {showPicker ? '✕ Close' : '+ Add country'}
        </button>

        {showPicker && (
          <div className="bg-[#0d1120] border border-[#1e2540] rounded-xl overflow-hidden">
            <input
              type="text"
              value={countrySearch}
              onChange={(e) => setCountrySearch(e.target.value)}
              placeholder="Search all countries..."
              autoFocus
              className="w-full bg-transparent px-3 py-2 text-white text-xs placeholder-[#4a5580] focus:outline-none border-b border-[#1e2540]"
            />
            <div className="max-h-36 overflow-y-auto">
              {availableToAdd.slice(0, 60).map((c) => (
                <button
                  key={c.code + c.name}
                  onClick={() => { addDelegate(committee.id, c.name); setCountrySearch(''); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#1e2540] transition-colors text-left"
                >
                  <span className="text-sm">{getFlagEmoji(c.code)}</span>
                  <span className="text-xs text-[#c0c8d8]">{c.name}</span>
                </button>
              ))}
              {availableToAdd.length === 0 && (
                <div className="px-3 py-3 text-xs text-[#4a5580] text-center">All countries added</div>
              )}
            </div>
            <div className="border-t border-[#1e2540] p-2 flex gap-1.5">
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && customName.trim()) { addDelegate(committee.id, customName.trim()); setCustomName(''); } }}
                placeholder="Custom name (e.g. Donald Trump)..."
                className="flex-1 bg-[#141929] border border-[#1e2540] rounded px-2 py-1 text-white text-xs focus:outline-none placeholder-[#4a5580]"
              />
              <button
                onClick={() => { if (customName.trim()) { addDelegate(committee.id, customName.trim()); setCustomName(''); } }}
                className="text-xs bg-blue-700 hover:bg-blue-600 text-white px-2 py-1 rounded transition-colors"
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
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-[#1e2540] disabled:text-[#3a4060] text-white py-2 rounded-lg text-xs font-bold transition-colors"
          >
            {hasQuorum ? 'Begin Session →' : `Need ${quorum - present} more`}
          </button>
        )}
      </div>
    </div>
  );
}
