'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCommitteeStore } from '@/lib/store';
import { UN_COUNTRIES, getFlagEmoji, getCountryByName } from '@/lib/countries';
import { PRESETS, CommitteePreset } from '@/lib/presets';

function FlagBadge({ name, onRemove }: { name: string; onRemove: () => void }) {
  const found = getCountryByName(name);
  const flag = found ? getFlagEmoji(found.code) : '🌐';
  return (
    <div className="flex items-center gap-1.5 bg-[#141929] border border-[#1e2540] rounded-lg px-2 py-1.5">
      <span className="text-sm">{flag}</span>
      <span className="text-xs text-[#c0c8d8] max-w-[100px] truncate">{name}</span>
      <button onClick={onRemove} className="text-[#3a4060] hover:text-red-400 transition-colors ml-0.5 text-xs">✕</button>
    </div>
  );
}

export default function CreatePage() {
  const router = useRouter();
  const createCommittee = useCommitteeStore((s) => s.createCommittee);

  const [step, setStep] = useState<'preset' | 'details' | 'delegates'>('preset');
  const [selectedPreset, setSelectedPreset] = useState<CommitteePreset | null>(null);
  const [committeeName, setCommitteeName] = useState('');
  const [topic, setTopic] = useState('');
  const [chairNames, setChairNames] = useState<string[]>(['']);
  const [delegates, setDelegates] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [customInput, setCustomInput] = useState('');

  const selectPreset = (preset: CommitteePreset) => {
    setSelectedPreset(preset);
    setCommitteeName(preset.defaultName);
    if (preset.members) setDelegates(preset.members);
    setStep('details');
  };

  const addChairField = () => setChairNames((p) => [...p, '']);
  const updateChair = (i: number, val: string) =>
    setChairNames((p) => p.map((n, idx) => (idx === i ? val : n)));
  const removeChair = (i: number) =>
    setChairNames((p) => p.filter((_, idx) => idx !== i));

  const available = UN_COUNTRIES.filter(
    (c) => !delegates.includes(c.name) && c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    const names = chairNames.map((n) => n.trim()).filter(Boolean);
    if (!committeeName.trim() || !topic.trim() || names.length === 0) return;
    const code = createCommittee(committeeName.trim(), topic.trim(), names, delegates);
    router.push(`/chair/${code}`);
  };

  const canProceedDetails = committeeName.trim() && topic.trim() && chairNames.some((n) => n.trim());

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col">
      <nav className="border-b border-[#1e2540] px-6 h-14 flex items-center justify-between shrink-0">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold">M</div>
          <span className="font-bold text-white">MUN Command</span>
        </Link>
      </nav>

      <div className="flex-1 flex items-start justify-center px-6 py-10 overflow-y-auto">
        <div className="w-full max-w-xl">

          {/* ── STEP 1: Preset ── */}
          {step === 'preset' && (
            <div>
              <h1 className="text-3xl font-black text-white mb-2">New Committee</h1>
              <p className="text-[#8892aa] mb-8">Choose a committee type to get started.</p>
              <div className="space-y-3">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => selectPreset(preset)}
                    className="w-full flex items-center gap-5 bg-[#0f1526] hover:bg-[#141929] border border-[#1e2540] hover:border-blue-700/40 rounded-2xl p-5 text-left transition-all group"
                  >
                    <span className="text-4xl">{preset.icon}</span>
                    <div className="flex-1">
                      <div className="text-lg font-bold text-white group-hover:text-blue-300 transition-colors">{preset.label}</div>
                      <div className="text-sm text-[#8892aa] mt-0.5">{preset.subtitle}</div>
                    </div>
                    <span className="text-[#4a5580] group-hover:text-white transition-colors text-xl">→</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 2: Details ── */}
          {step === 'details' && (
            <div>
              <button onClick={() => setStep('preset')} className="text-sm text-[#8892aa] hover:text-white transition-colors mb-6 flex items-center gap-1">
                ← Back
              </button>
              <div className="flex items-center gap-3 mb-8">
                <span className="text-3xl">{selectedPreset?.icon}</span>
                <div>
                  <h1 className="text-2xl font-black text-white">Committee Details</h1>
                  <p className="text-[#8892aa] text-sm">{selectedPreset?.label}</p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-[#c0c8d8] mb-2">Committee Name</label>
                  <input type="text" value={committeeName} onChange={(e) => setCommitteeName(e.target.value)}
                    placeholder="e.g. UN Security Council"
                    className="w-full bg-[#0f1526] border border-[#1e2540] rounded-xl px-4 py-3 text-white placeholder-[#4a5580] focus:outline-none focus:border-blue-600 transition-colors" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#c0c8d8] mb-2">Topic / Agenda Item</label>
                  <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. The situation in the Middle East"
                    className="w-full bg-[#0f1526] border border-[#1e2540] rounded-xl px-4 py-3 text-white placeholder-[#4a5580] focus:outline-none focus:border-blue-600 transition-colors" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#c0c8d8] mb-2">Chair(s)</label>
                  <div className="space-y-2">
                    {chairNames.map((name, i) => (
                      <div key={i} className="flex gap-2">
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => updateChair(i, e.target.value)}
                          placeholder={i === 0 ? 'Chair name' : 'Co-chair / AD name'}
                          className="flex-1 bg-[#0f1526] border border-[#1e2540] rounded-xl px-4 py-3 text-white placeholder-[#4a5580] focus:outline-none focus:border-blue-600 transition-colors"
                        />
                        {chairNames.length > 1 && (
                          <button onClick={() => removeChair(i)} className="px-3 text-[#4a5580] hover:text-red-400 transition-colors">✕</button>
                        )}
                      </div>
                    ))}
                    <button onClick={addChairField} className="text-xs text-blue-400 hover:text-blue-300 transition-colors mt-1">
                      + Add co-chair / AD
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => selectedPreset?.members === null ? setStep('delegates') : handleCreate()}
                  disabled={!canProceedDetails}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-[#1e2540] disabled:text-[#3a4060] text-white py-3.5 rounded-xl font-bold transition-colors mt-2"
                >
                  {selectedPreset?.members === null ? 'Next: Add Delegates →' : `Launch with ${delegates.length} delegates →`}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Delegates (custom only) ── */}
          {step === 'delegates' && (
            <div>
              <button onClick={() => setStep('details')} className="text-sm text-[#8892aa] hover:text-white transition-colors mb-6">
                ← Back
              </button>
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-black text-white">Add Delegates</h1>
                <span className="text-sm text-[#8892aa]">{delegates.length} added</span>
              </div>

              {/* Autocomplete search — Enter adds top match */}
              <div className="relative mb-4">
                <div className="flex items-center bg-[#0f1526] border border-[#1e2540] focus-within:border-blue-600 rounded-xl overflow-visible transition-colors">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const top = available[0];
                        if (top) { setDelegates((p) => [...p, top.name]); setSearch(''); }
                        else if (search.trim() && !delegates.includes(search.trim())) {
                          setDelegates((p) => [...p, search.trim()]); setSearch('');
                        }
                      }
                      if (e.key === 'Escape') setSearch('');
                    }}
                    placeholder="Type to search countries..."
                    autoFocus
                    className="flex-1 bg-transparent px-4 py-3.5 text-white placeholder-[#4a5580] focus:outline-none text-base"
                  />
                  {available[0] && search && (
                    <span className="text-xs text-[#4a5580] px-3">↵ {available[0].name}</span>
                  )}
                </div>
                {search && available.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#0f1526] border border-[#1e2540] rounded-xl overflow-hidden z-20 shadow-xl">
                    {available.slice(0, 8).map((c, i) => (
                      <button key={c.code} onMouseDown={(e) => { e.preventDefault(); setDelegates((p) => [...p, c.name]); setSearch(''); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${i === 0 ? 'bg-blue-900/30 text-white' : 'text-[#c0c8d8] hover:bg-[#1e2540]'}`}>
                        <span className="text-2xl">{getFlagEmoji(c.code)}</span>
                        <span className="text-base">{c.name}</span>
                        {i === 0 && <span className="ml-auto text-xs text-[#4a5580]">Enter ↵</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected delegates list */}
              {delegates.length > 0 && (
                <div className="bg-[#0f1526] border border-[#1e2540] rounded-xl overflow-hidden mb-4">
                  <p className="text-xs text-[#4a5580] font-mono px-4 pt-3 pb-1">ADDED ({delegates.length})</p>
                  <div className="max-h-72 overflow-y-auto">
                    {delegates.map((name) => {
                      const found = getCountryByName(name);
                      return (
                        <div key={name} className="flex items-center gap-3 px-4 py-3 border-b border-[#1e2540]/50 last:border-0">
                          <span className="text-2xl">{found ? getFlagEmoji(found.code) : '🌐'}</span>
                          <span className="text-base text-white flex-1">{name}</span>
                          <button onClick={() => setDelegates((p) => p.filter((d) => d !== name))}
                            className="text-[#3a4060] hover:text-red-400 transition-colors text-sm">✕</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <button onClick={handleCreate} disabled={delegates.length === 0}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-[#1e2540] disabled:text-[#3a4060] text-white py-3.5 rounded-xl font-bold transition-colors text-base">
                Launch Committee with {delegates.length} delegate{delegates.length !== 1 ? 's' : ''} →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
