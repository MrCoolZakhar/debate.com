'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCommitteeStore } from '@/lib/store';
import { UN_COUNTRIES, getFlagEmoji, getCountryByName } from '@/lib/countries';
import { PRESETS, CommitteePreset } from '@/lib/presets';

const BUNDLES: Record<string, { label: string; icon: string; members: string[] }> = {
  P5:        { label: 'P5',         icon: '🛡️', members: ['China', 'France', 'Russia', 'United Kingdom', 'United States'] },
  G7:        { label: 'G7',         icon: '💼', members: ['Canada', 'France', 'Germany', 'Italy', 'Japan', 'United Kingdom', 'United States'] },
  BRICS:     { label: 'BRICS+',     icon: '🌏', members: ['Brazil', 'Russia', 'India', 'China', 'South Africa', 'Egypt', 'Ethiopia', 'Iran', 'Saudi Arabia', 'United Arab Emirates'] },
  G20:       { label: 'G20',        icon: '🌐', members: ['Argentina', 'Australia', 'Brazil', 'Canada', 'China', 'France', 'Germany', 'India', 'Indonesia', 'Italy', 'Japan', 'Mexico', 'South Korea', 'Russia', 'Saudi Arabia', 'South Africa', 'Turkey', 'United Kingdom', 'United States'] },
  EU:        { label: 'EU',         icon: '🇪🇺', members: ['Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden'] },
  NATO:      { label: 'NATO',       icon: '⚔️', members: ['Albania', 'Belgium', 'Bulgaria', 'Canada', 'Croatia', 'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Iceland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Montenegro', 'Netherlands', 'North Macedonia', 'Norway', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Turkey', 'United Kingdom', 'United States'] },
  ASEAN:     { label: 'ASEAN',      icon: '🌺', members: ['Brunei', 'Cambodia', 'Indonesia', 'Laos', 'Malaysia', 'Myanmar', 'Philippines', 'Singapore', 'Thailand', 'Timor-Leste', 'Vietnam'] },
  ArabLeague:{ label: 'Arab League',icon: '🌙', members: ['Algeria', 'Bahrain', 'Comoros', 'Djibouti', 'Egypt', 'Iraq', 'Jordan', 'Kuwait', 'Lebanon', 'Libya', 'Mauritania', 'Morocco', 'Oman', 'Palestine', 'Qatar', 'Saudi Arabia', 'Somalia', 'Sudan', 'Syria', 'Tunisia', 'United Arab Emirates', 'Yemen'] },
};

function fuzzyMatchCountry(raw: string): string | null {
  const n = raw.trim().toLowerCase();
  if (!n) return null;
  const exact = UN_COUNTRIES.find((c) => c.name.toLowerCase() === n);
  if (exact) return exact.name;
  const sw = UN_COUNTRIES.find((c) => c.name.toLowerCase().startsWith(n));
  if (sw) return sw.name;
  const inc = UN_COUNTRIES.find((c) => c.name.toLowerCase().includes(n) || n.includes(c.name.toLowerCase()));
  if (inc) return inc.name;
  return null;
}

export default function CreatePage() {
  const router = useRouter();
  const createCommittee = useCommitteeStore((s) => s.createCommittee);

  const [step, setStep] = useState<'preset' | 'details' | 'custom'>('preset');
  const [selectedPreset, setSelectedPreset] = useState<CommitteePreset | null>(null);
  const [committeeName, setCommitteeName] = useState('');
  const [topic, setTopic] = useState('');
  const [delegates, setDelegates] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState('');

  const selectPreset = (preset: CommitteePreset) => {
    setSelectedPreset(preset);
    setCommitteeName(preset.defaultName);
    if (preset.members === null) {
      setDelegates([]);
      setStep('custom');
    } else {
      setDelegates(preset.members);
      setStep('details');
    }
  };

  const handleCreate = (delegateList = delegates) => {
    if (!committeeName.trim() || !topic.trim()) return;
    const code = createCommittee(committeeName.trim(), topic.trim(), ['Chair'], delegateList);
    router.push(`/chair/${code}`);
  };

  const canProceed = committeeName.trim() && topic.trim();

  const available = UN_COUNTRIES.filter(
    (c) => !delegates.includes(c.name) && c.name.toLowerCase().includes(search.toLowerCase())
  );

  const addDelegate = (name: string) => {
    if (!delegates.includes(name)) setDelegates((p) => [...p, name]);
  };

  const addBundle = (key: string) => {
    const bundle = BUNDLES[key];
    if (!bundle) return;
    setDelegates((prev) => [...prev, ...bundle.members.filter((m) => !prev.includes(m))]);
  };

  const handlePaste = () => {
    const lines = pasteText.split(/[\n,]+/).map((l) => l.trim()).filter(Boolean);
    const matched: string[] = [];
    const unmatched: string[] = [];
    for (const line of lines) {
      const found = fuzzyMatchCountry(line);
      if (found && !delegates.includes(found)) matched.push(found);
      else if (!found) unmatched.push(line);
    }
    setDelegates((p) => [...p, ...matched]);
    setPasteError(unmatched.length > 0 ? `Could not match: ${unmatched.join(', ')}` : '');
    setPasteText('');
  };

  return (
    <div className="h-screen bg-[#0a0e1a] flex flex-col overflow-hidden">
      <nav className="border-b border-[#1e2540] px-6 h-14 flex items-center justify-between shrink-0">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold">M</div>
          <span className="font-bold text-white">MUN Command</span>
        </Link>
      </nav>

      <div className="flex-1 flex overflow-hidden">

        {/* ── Preset selection ── */}
        {step === 'preset' && (
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="w-full max-w-lg">
              <h1 className="text-3xl font-black text-white mb-2">New Committee</h1>
              <p className="text-[#8892aa] mb-8">Choose a committee type to get started.</p>
              <div className="space-y-3">
                {PRESETS.map((preset) => (
                  <button key={preset.id} onClick={() => selectPreset(preset)}
                    className="w-full flex items-center gap-5 bg-[#0f1526] hover:bg-[#141929] border border-[#1e2540] hover:border-blue-700/40 rounded-2xl p-5 text-left transition-all group">
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
          </div>
        )}

        {/* ── Details (UNSC / GA — presets with fixed members) ── */}
        {step === 'details' && (
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="w-full max-w-lg">
              <button onClick={() => setStep('preset')} className="text-sm text-[#8892aa] hover:text-white transition-colors mb-6 flex items-center gap-1">← Back</button>
              <div className="flex items-center gap-3 mb-8">
                <span className="text-3xl">{selectedPreset?.icon}</span>
                <div>
                  <h1 className="text-2xl font-black text-white">Committee Details</h1>
                  <p className="text-[#8892aa] text-sm">{selectedPreset?.label} · {delegates.length} delegates</p>
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
                <button onClick={() => handleCreate()} disabled={!canProceed}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-[#1e2540] disabled:text-[#3a4060] text-white py-3.5 rounded-xl font-bold transition-colors">
                  Launch with {delegates.length} delegates →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Custom: full-screen single-page layout ── */}
        {step === 'custom' && (
          <div className="flex-1 flex flex-col overflow-hidden px-8 py-6">
            <div className="flex items-center gap-3 mb-6 shrink-0">
              <button onClick={() => setStep('preset')} className="text-sm text-[#8892aa] hover:text-white transition-colors flex items-center gap-1">← Back</button>
              <span className="text-[#2a3050]">|</span>
              <span className="text-2xl">✏️</span>
              <h1 className="text-2xl font-black text-white">Custom Committee</h1>
            </div>

            {/* Name + Topic inline */}
            <div className="grid grid-cols-2 gap-4 mb-5 shrink-0">
              <div>
                <label className="block text-xs font-semibold text-[#8892aa] mb-1.5">Committee Name</label>
                <input type="text" value={committeeName} onChange={(e) => setCommitteeName(e.target.value)}
                  placeholder="e.g. Human Rights Council"
                  className="w-full bg-[#0f1526] border border-[#1e2540] rounded-xl px-4 py-3 text-white placeholder-[#4a5580] focus:outline-none focus:border-blue-600 transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#8892aa] mb-1.5">Topic / Agenda Item</label>
                <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. The right to education"
                  className="w-full bg-[#0f1526] border border-[#1e2540] rounded-xl px-4 py-3 text-white placeholder-[#4a5580] focus:outline-none focus:border-blue-600 transition-colors" />
              </div>
            </div>

            {/* Two-column main section — fills remaining height */}
            <div className="flex-1 grid grid-cols-2 gap-6 min-h-0">

              {/* Left: Add countries */}
              <div className="flex flex-col gap-4 min-h-0">
                {/* Search */}
                <div className="shrink-0">
                  <label className="block text-xs font-semibold text-[#8892aa] mb-1.5">Search &amp; Add</label>
                  <div className="relative">
                    <div className="flex items-center bg-[#0f1526] border border-[#1e2540] focus-within:border-blue-600 rounded-xl overflow-visible transition-colors">
                      <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); const top = available[0]; if (top) { addDelegate(top.name); setSearch(''); } }
                          if (e.key === 'Escape') setSearch('');
                        }}
                        placeholder="Search countries..."
                        className="flex-1 bg-transparent px-4 py-3 text-white placeholder-[#4a5580] focus:outline-none text-sm" />
                      {available[0] && search && (
                        <span className="text-xs text-[#4a5580] px-3 shrink-0">↵ {available[0].name}</span>
                      )}
                    </div>
                    {search && available.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-[#0f1526] border border-[#1e2540] rounded-xl overflow-hidden z-20 shadow-xl">
                        {available.slice(0, 6).map((c, i) => (
                          <button key={c.code} onMouseDown={(e) => { e.preventDefault(); addDelegate(c.name); setSearch(''); }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === 0 ? 'bg-blue-900/30 text-white' : 'text-[#c0c8d8] hover:bg-[#1e2540]'}`}>
                            <span className="text-xl">{getFlagEmoji(c.code)}</span>
                            <span className="text-sm flex-1">{c.name}</span>
                            {i === 0 && <span className="ml-auto text-xs text-[#4a5580]">Enter ↵</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bundles */}
                <div className="shrink-0">
                  <label className="block text-xs font-semibold text-[#8892aa] mb-2">Quick Bundles</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(BUNDLES).map(([key, bundle]) => (
                      <button key={key} onClick={() => addBundle(key)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0f1526] hover:bg-[#141929] border border-[#1e2540] hover:border-blue-700/40 rounded-lg text-xs font-semibold text-[#c0c8d8] hover:text-white transition-all">
                        <span>{bundle.icon}</span>
                        <span>{bundle.label}</span>
                        <span className="text-[#4a5580]">+{bundle.members.length}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Paste list — fills remaining space */}
                <div className="flex-1 flex flex-col min-h-0">
                  <label className="block text-xs font-semibold text-[#8892aa] mb-1.5">Paste Country List</label>
                  <textarea value={pasteText} onChange={(e) => { setPasteText(e.target.value); setPasteError(''); }}
                    placeholder={'France\nGermany\nBrazil, India...'}
                    className="flex-1 bg-[#0f1526] border border-[#1e2540] rounded-xl px-4 py-3 text-white placeholder-[#4a5580] focus:outline-none focus:border-blue-600 transition-colors text-sm resize-none min-h-0" />
                  <div className="flex items-center gap-3 mt-2">
                    <button onClick={handlePaste} disabled={!pasteText.trim()}
                      className="px-4 py-2 bg-[#1e2540] hover:bg-[#2a3050] disabled:opacity-40 text-white rounded-lg text-xs font-semibold transition-colors">
                      Auto-match &amp; Add →
                    </button>
                    {pasteError && <p className="text-xs text-yellow-400 flex-1">{pasteError}</p>}
                  </div>
                </div>
              </div>

              {/* Right: Selected delegates + launch */}
              <div className="flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <label className="text-xs font-semibold text-[#8892aa]">Selected Delegates</label>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-white">{delegates.length} added</span>
                    {delegates.length > 0 && (
                      <button onClick={() => setDelegates([])} className="text-xs text-[#4a5580] hover:text-red-400 transition-colors">Clear all</button>
                    )}
                  </div>
                </div>

                {/* Scrollable list */}
                <div className="flex-1 bg-[#0f1526] border border-[#1e2540] rounded-xl overflow-hidden mb-4 min-h-0">
                  {delegates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-[#4a5580] text-sm gap-2">
                      <span className="text-3xl">🌍</span>
                      <span>No delegates added yet</span>
                    </div>
                  ) : (
                    <div className="overflow-y-auto h-full">
                      {delegates.map((name) => {
                        const found = getCountryByName(name);
                        return (
                          <div key={name} className="flex items-center gap-3 px-4 py-2.5 border-b border-[#1e2540]/50 last:border-0 hover:bg-[#141929] transition-colors group">
                            <span className="text-lg">{found ? getFlagEmoji(found.code) : '🌐'}</span>
                            <span className="text-sm text-white flex-1 truncate">{name}</span>
                            <button onClick={() => setDelegates((p) => p.filter((d) => d !== name))}
                              className="text-[#3a4060] group-hover:text-red-400 transition-colors text-sm opacity-0 group-hover:opacity-100">✕</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Launch button */}
                <button onClick={() => handleCreate()} disabled={!canProceed}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-[#1e2540] disabled:text-[#3a4060] text-white py-4 rounded-xl font-bold transition-colors text-base shrink-0">
                  {canProceed ? `Start Session →` : 'Enter committee name and topic above'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
