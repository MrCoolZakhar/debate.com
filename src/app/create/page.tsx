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
                <span className="text-sm text-[#8892aa]">{delegates.length} selected</span>
              </div>

              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search countries..." autoFocus
                className="w-full bg-[#0f1526] border border-[#1e2540] rounded-xl px-4 py-3 text-white placeholder-[#4a5580] focus:outline-none focus:border-blue-600 transition-colors mb-3" />

              <div className="bg-[#0f1526] border border-[#1e2540] rounded-xl overflow-hidden mb-4">
                <div className="max-h-64 overflow-y-auto p-2 grid grid-cols-2 gap-0.5">
                  {available.slice(0, 100).map((c) => (
                    <button key={c.code + c.name} onClick={() => setDelegates((p) => [...p, c.name])}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#1e2540] transition-colors text-left">
                      <span className="text-base">{getFlagEmoji(c.code)}</span>
                      <span className="text-xs text-[#c0c8d8] truncate">{c.name}</span>
                    </button>
                  ))}
                </div>
                <div className="border-t border-[#1e2540] p-3 flex gap-2">
                  <input type="text" value={customInput} onChange={(e) => setCustomInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && customInput.trim()) { setDelegates((p) => [...p, customInput.trim()]); setCustomInput(''); } }}
                    placeholder="Custom name..."
                    className="flex-1 bg-[#141929] border border-[#1e2540] rounded-lg px-3 py-2 text-white text-sm focus:outline-none placeholder-[#4a5580]" />
                  <button onClick={() => { if (customInput.trim()) { setDelegates((p) => [...p, customInput.trim()]); setCustomInput(''); } }}
                    className="bg-[#1e2540] hover:bg-[#2a3050] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">Add</button>
                </div>
              </div>

              {delegates.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-[#4a5580] font-mono mb-2">SELECTED ({delegates.length})</p>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {delegates.map((name) => (
                      <FlagBadge key={name} name={name} onRemove={() => setDelegates((p) => p.filter((d) => d !== name))} />
                    ))}
                  </div>
                </div>
              )}

              <button onClick={handleCreate} disabled={delegates.length === 0}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-[#1e2540] disabled:text-[#3a4060] text-white py-3.5 rounded-xl font-bold transition-colors">
                Launch Committee →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
