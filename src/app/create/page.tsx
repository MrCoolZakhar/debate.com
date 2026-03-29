'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCommitteeStore } from '@/lib/store';
import { UN_COUNTRIES, getFlagEmoji, getCountryByName } from '@/lib/countries';

function FlagBadge({ name, onRemove }: { name: string; onRemove: () => void }) {
  const found = getCountryByName(name);
  const flag = found ? getFlagEmoji(found.code) : '🌐';
  return (
    <div className="flex items-center gap-1.5 bg-[#141929] border border-[#1e2540] rounded-lg px-2 py-1.5 group">
      <span className="text-sm">{flag}</span>
      <span className="text-xs text-[#c0c8d8] max-w-[100px] truncate">{name}</span>
      <button onClick={onRemove} className="text-[#3a4060] hover:text-red-400 transition-colors ml-0.5">✕</button>
    </div>
  );
}

export default function CreatePage() {
  const router = useRouter();
  const createCommittee = useCommitteeStore((s) => s.createCommittee);

  const [step, setStep] = useState(1);
  const [committeeName, setCommitteeName] = useState('');
  const [topic, setTopic] = useState('');
  const [chairName, setChairName] = useState('');
  const [delegates, setDelegates] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [customName, setCustomName] = useState('');

  const available = UN_COUNTRIES.filter(
    (c) =>
      !delegates.includes(c.name) &&
      c.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (name: string) => {
    setDelegates((prev) =>
      prev.includes(name) ? prev.filter((d) => d !== name) : [...prev, name]
    );
  };

  const addCustom = () => {
    const name = customName.trim();
    if (name && !delegates.includes(name)) {
      setDelegates((prev) => [...prev, name]);
    }
    setCustomName('');
  };

  const handleCreate = () => {
    if (!committeeName.trim() || !topic.trim() || !chairName.trim()) return;
    const code = createCommittee(committeeName.trim(), topic.trim(), chairName.trim(), delegates);
    router.push(`/chair/${code}`);
  };

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col">
      <nav className="border-b border-[#1e2540] px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold">M</div>
          <span className="font-bold text-white">MUN Command</span>
        </Link>
      </nav>

      <div className="flex-1 flex items-start justify-center px-6 py-10">
        <div className="w-full max-w-2xl">
          {/* Steps */}
          <div className="flex items-center gap-3 mb-8">
            {[1, 2].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step >= s ? 'bg-blue-600 text-white' : 'bg-[#1e2540] text-[#4a5580]'}`}>{s}</div>
                {s < 2 && <div className={`w-12 h-0.5 ${step > s ? 'bg-blue-600' : 'bg-[#1e2540]'}`} />}
              </div>
            ))}
            <span className="text-sm text-[#8892aa] ml-2">{step === 1 ? 'Committee details' : 'Add delegates'}</span>
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <h1 className="text-2xl font-black text-white mb-6">Create Committee</h1>
              <div>
                <label className="block text-sm font-medium text-[#c0c8d8] mb-2">Committee Name</label>
                <input type="text" value={committeeName} onChange={(e) => setCommitteeName(e.target.value)}
                  placeholder="e.g. Security Council" autoFocus
                  className="w-full bg-[#0f1526] border border-[#1e2540] rounded-xl px-4 py-3 text-white placeholder-[#4a5580] focus:outline-none focus:border-blue-600 transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#c0c8d8] mb-2">Topic</label>
                <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. The situation in the Middle East"
                  className="w-full bg-[#0f1526] border border-[#1e2540] rounded-xl px-4 py-3 text-white placeholder-[#4a5580] focus:outline-none focus:border-blue-600 transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#c0c8d8] mb-2">Your Name (Chair)</label>
                <input type="text" value={chairName} onChange={(e) => setChairName(e.target.value)}
                  placeholder="Your name"
                  className="w-full bg-[#0f1526] border border-[#1e2540] rounded-xl px-4 py-3 text-white placeholder-[#4a5580] focus:outline-none focus:border-blue-600 transition-colors" />
              </div>
              <button
                onClick={() => setStep(2)}
                disabled={!committeeName.trim() || !topic.trim() || !chairName.trim()}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-[#1e2540] disabled:text-[#3a4060] text-white py-3 rounded-xl font-bold transition-colors mt-2"
              >
                Next: Add Delegates →
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-black text-white">Add Delegates</h1>
                <span className="text-sm text-[#8892aa]">{delegates.length} selected</span>
              </div>

              {/* Search */}
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search countries..."
                autoFocus
                className="w-full bg-[#0f1526] border border-[#1e2540] rounded-xl px-4 py-3 text-white placeholder-[#4a5580] focus:outline-none focus:border-blue-600 transition-colors"
              />

              {/* Country grid */}
              <div className="bg-[#0f1526] border border-[#1e2540] rounded-xl overflow-hidden">
                <div className="max-h-72 overflow-y-auto p-2 grid grid-cols-2 gap-1">
                  {available.slice(0, 100).map((c) => (
                    <button
                      key={c.code + c.name}
                      onClick={() => toggle(c.name)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#1e2540] transition-colors text-left"
                    >
                      <span className="text-base">{getFlagEmoji(c.code)}</span>
                      <span className="text-xs text-[#c0c8d8] truncate">{c.name}</span>
                    </button>
                  ))}
                  {available.length === 0 && (
                    <div className="col-span-2 text-center py-6 text-[#4a5580] text-sm">No more countries to add</div>
                  )}
                </div>
                {/* Custom entry */}
                <div className="border-t border-[#1e2540] p-3 flex gap-2">
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addCustom()}
                    placeholder="Add custom name (e.g. European Union)..."
                    className="flex-1 bg-[#141929] border border-[#1e2540] rounded-lg px-3 py-2 text-white text-sm focus:outline-none placeholder-[#4a5580]"
                  />
                  <button onClick={addCustom} className="bg-[#1e2540] hover:bg-[#2a3050] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                    Add
                  </button>
                </div>
              </div>

              {/* Selected delegates */}
              {delegates.length > 0 && (
                <div>
                  <p className="text-xs text-[#4a5580] mb-2 font-mono">SELECTED DELEGATES</p>
                  <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                    {delegates.map((name) => (
                      <FlagBadge key={name} name={name} onRemove={() => setDelegates((prev) => prev.filter((d) => d !== name))} />
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(1)} className="flex-1 border border-[#1e2540] hover:border-[#2a3050] text-[#8892aa] hover:text-white py-3 rounded-xl font-semibold transition-colors">
                  ← Back
                </button>
                <button
                  onClick={handleCreate}
                  className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold transition-colors"
                >
                  Launch Committee →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
