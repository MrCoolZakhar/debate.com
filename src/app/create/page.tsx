'use client';

import { useState, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createCommittee as createCommitteeInDB } from '@/lib/committeeService';
import { UN_COUNTRIES, getFlagEmoji, getCountryByName } from '@/lib/countries';
import { UNSC_MEMBERS } from '@/lib/presets';

// ── Committee presets for the autocomplete ────────────────────────────────────
const COMMITTEE_PRESETS = [
  { name: 'UN Security Council', acronym: 'UNSC', icon: '🛡️', members: UNSC_MEMBERS },
  { name: 'UN General Assembly', acronym: 'GA/UNGA', icon: '🌍', members: null },
  { name: 'Human Rights Council', acronym: 'HRC', icon: '⚖️', members: ['Afghanistan','Albania','Algeria','Argentina','Armenia','Bangladesh','Benin','Bolivia','Brazil','Bulgaria','Cameroon','Chile','China','Cuba','Czech Republic','Estonia','Finland','France','Gambia','Germany','Honduras','Iceland','India','Indonesia','Japan','Kazakhstan','Kenya','Libya','Luxembourg','Malawi','Malaysia','Maldives','Marshall Islands','Mexico','Montenegro','Morocco','Namibia','Nepal','Netherlands','Pakistan','Paraguay','Peru','Poland','Qatar','Romania','Senegal','Sierra Leone','Somalia','South Africa','Sudan','Togo','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Venezuela','Vietnam'] },
  { name: 'Economic and Social Council', acronym: 'ECOSOC', icon: '💰', members: ['Algeria','Argentina','Armenia','Australia','Austria','Azerbaijan','Bahrain','Bangladesh','Benin','Bolivia','Brazil','Bulgaria','Burundi','Canada','Chile','China','Colombia','Congo','Czech Republic','Denmark','Ecuador','Egypt','El Salvador','Estonia','Ethiopia','France','Germany','Ghana','Greece','Guatemala','Guinea','Haiti','Honduras','Hungary','India','Indonesia','Iran','Ireland','Israel','Italy','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Lesotho','Libya','Malaysia','Maldives','Mali','Malta','Mexico','Mongolia','Morocco','Mozambique','Netherlands','New Zealand','Niger','Norway','Pakistan','Panama','Paraguay','Peru','Philippines','Poland','Qatar','Romania','Russia','Rwanda','Saudi Arabia','Serbia','South Africa','South Korea','Spain','Sweden','Switzerland','Tanzania','Thailand','Togo','Turkey','Uganda','Ukraine','United Kingdom','United States','Uzbekistan','Venezuela','Vietnam','Zimbabwe'] },
  { name: 'NATO', acronym: 'NATO', icon: '⚔️', members: ['Albania','Belgium','Bulgaria','Canada','Croatia','Czech Republic','Denmark','Estonia','Finland','France','Germany','Greece','Hungary','Iceland','Italy','Latvia','Lithuania','Luxembourg','Montenegro','Netherlands','North Macedonia','Norway','Poland','Portugal','Romania','Slovakia','Slovenia','Spain','Sweden','Turkey','United Kingdom','United States'] },
  { name: 'G20', acronym: 'G20', icon: '💼', members: ['Argentina','Australia','Brazil','Canada','China','France','Germany','India','Indonesia','Italy','Japan','Mexico','South Korea','Russia','Saudi Arabia','South Africa','Turkey','United Kingdom','United States'] },
  { name: 'European Union', acronym: 'EU', icon: '🇪🇺', members: ['Austria','Belgium','Bulgaria','Croatia','Cyprus','Czech Republic','Denmark','Estonia','Finland','France','Germany','Greece','Hungary','Ireland','Italy','Latvia','Lithuania','Luxembourg','Malta','Netherlands','Poland','Portugal','Romania','Slovakia','Slovenia','Spain','Sweden'] },
  { name: 'African Union', acronym: 'AU', icon: '🌍', members: ['Algeria','Angola','Benin','Botswana','Burkina Faso','Burundi','Cabo Verde','Cameroon','Central African Republic','Chad','Comoros','Congo','Côte d\'Ivoire','DR Congo','Djibouti','Egypt','Equatorial Guinea','Eritrea','Eswatini','Ethiopia','Gabon','Gambia','Ghana','Guinea','Guinea-Bissau','Kenya','Lesotho','Liberia','Libya','Madagascar','Malawi','Mali','Mauritania','Mauritius','Morocco','Mozambique','Namibia','Niger','Nigeria','Rwanda','São Tomé and Príncipe','Senegal','Seychelles','Sierra Leone','Somalia','South Africa','South Sudan','Sudan','Tanzania','Togo','Tunisia','Uganda','Zambia','Zimbabwe'] },
  { name: 'Arab League', acronym: 'LAS', icon: '🌙', members: ['Algeria','Bahrain','Comoros','Djibouti','Egypt','Iraq','Jordan','Kuwait','Lebanon','Libya','Mauritania','Morocco','Oman','Palestine','Qatar','Saudi Arabia','Somalia','Sudan','Syria','Tunisia','United Arab Emirates','Yemen'] },
  { name: 'ASEAN', acronym: 'ASEAN', icon: '🌺', members: ['Brunei','Cambodia','Indonesia','Laos','Malaysia','Myanmar','Philippines','Singapore','Thailand','Timor-Leste','Vietnam'] },
];

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

// Committee name autocomplete input
function CommitteeNameInput({
  value,
  onChange,
  onPresetSelect,
}: {
  value: string;
  onChange: (v: string) => void;
  onPresetSelect: (preset: typeof COMMITTEE_PRESETS[0]) => void;
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = value.trim()
    ? COMMITTEE_PRESETS.filter(
        (p) =>
          p.name.toLowerCase().includes(value.toLowerCase()) ||
          p.acronym.toLowerCase().includes(value.toLowerCase())
      )
    : [];

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="e.g. Human Rights Council or HRC"
        className="w-full bg-[#150F09] border border-[#2E1E0F] rounded-xl px-4 py-3 text-white placeholder-[#7A5A38] focus:outline-none focus:border-[#7B4A1E] transition-colors"
      />
      {open && matches.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#150F09] border border-[#2E1E0F] rounded-xl overflow-hidden z-30 shadow-xl">
          {matches.slice(0, 6).map((p, i) => (
            <button
              key={p.name}
              onMouseDown={(e) => { e.preventDefault(); onPresetSelect(p); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === 0 ? 'bg-[#7B4A1E]/20 text-white' : 'text-[#E8D5B7] hover:bg-[#2E1E0F]'}`}
            >
              <span className="text-lg">{p.icon}</span>
              <span className="text-sm flex-1">{p.name}</span>
              <span className="text-xs text-[#7A5A38] shrink-0">{p.acronym}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CreatePageInner() {
  const router = useRouter();
  const [chairNames, setChairNames] = useState<string[]>(['']);

  const [committeeMode, setCommitteeMode] = useState<'select' | 'build'>('select');
  const [committeeName, setCommitteeName] = useState('');
  const [topic, setTopic] = useState('');
  const [delegates, setDelegates] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [creating, setCreating] = useState(false);
  const [pasteError, setPasteError] = useState('');

  const handleCreate = async () => {
      const names = chairNames.map((n) => n.trim()).filter(Boolean);
      if (!committeeName.trim() || !topic.trim() || names.length === 0) return;
      setCreating(true);
      const code = await createCommitteeInDB(committeeName.trim(), topic.trim(), names, delegates);
      if (code) {
        router.push(`/chair/${code}`);
      } else {
        alert('Something went wrong creating the committee. Please try again.');
        setCreating(false);
      }
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

  const handleCommitteePreset = (preset: typeof COMMITTEE_PRESETS[0]) => {
    setCommitteeName(preset.name);
    if (preset.members !== null) {
      setDelegates(preset.members);
    }
  };

  return (
    <div className="h-screen bg-[#0D0906] flex flex-col overflow-hidden">
      <nav className="border-b border-[#2E1E0F] bg-[#150F09] px-6 h-14 flex items-center justify-between shrink-0">
        <Link href="/" className="flex items-center gap-2">
          <img src="/gavelling-logo.png" alt="Gavelling" className="h-8 w-auto" />
        </Link>
      </nav>

      <div className="flex-1 flex overflow-hidden">

        {/* ── Committee type selection screen ── */}
        {committeeMode === 'select' && (
          <div className="flex-1 flex flex-col items-center justify-center px-8 py-6">
            <h1 className="text-2xl font-black text-white mb-2">Choose Committee Type</h1>
            <p className="text-[#C4A882] text-sm mb-8">Select the type of committee you want to run.</p>
            <div className="flex flex-row gap-4 w-full max-w-4xl">
              {/* Regular Debate — Coming Soon */}
              <div className="flex-1 flex flex-col items-center justify-center bg-[#1A1209] border border-[#2E1E0F] rounded-3xl p-8 min-h-[300px] opacity-60 cursor-not-allowed relative">
                <span className="text-5xl mb-4">🗣️</span>
                <h2 className="text-xl font-black text-white mb-2">Regular Debate</h2>
                <p className="text-[#C4A882] text-sm text-center mb-4">Traditional parliamentary debate</p>
                <span className="px-3 py-1 bg-[#2E1E0F] border border-[#3D2A15] text-[#7A5A38] rounded-full text-xs font-semibold">Coming Soon</span>
              </div>

              {/* MUN — Active */}
              <div
                onClick={() => setCommitteeMode('build')}
                className="flex-1 flex flex-col items-center justify-center bg-[#1A1209] border-2 border-[#7B4A1E] rounded-3xl p-8 min-h-[300px] cursor-pointer hover:bg-[#2E1E0F] hover:border-[#C4A882] transition-all group"
              >
                <span className="text-5xl mb-4">🌍</span>
                <h2 className="text-xl font-black text-white mb-2">Model United Nations</h2>
                <p className="text-[#C4A882] text-sm text-center mb-4">United Nations committee simulation</p>
                <span className="px-4 py-2 bg-[#7B4A1E] group-hover:bg-[#8B5A2B] text-white rounded-xl text-sm font-bold transition-colors">Start →</span>
              </div>

              {/* Crisis — Coming Soon */}
              <div className="flex-1 flex flex-col items-center justify-center bg-[#1A1209] border border-[#2E1E0F] rounded-3xl p-8 min-h-[300px] opacity-60 cursor-not-allowed relative">
                <span className="text-5xl mb-4">⚡</span>
                <h2 className="text-xl font-black text-white mb-2">Crisis Committee</h2>
                <p className="text-[#C4A882] text-sm text-center mb-4">Fast-paced crisis scenarios</p>
                <span className="px-3 py-1 bg-[#2E1E0F] border border-[#3D2A15] text-[#7A5A38] rounded-full text-xs font-semibold">Coming Soon</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Custom: full-screen single-page layout ── */}
        {committeeMode === 'build' && (
        <div className="flex-1 flex flex-col overflow-hidden px-8 py-6">
            <div className="flex items-center gap-3 mb-6 shrink-0">
  <button onClick={() => setCommitteeMode('select')} className="text-sm text-[#C4A882] hover:text-white transition-colors">← Back</button>
  <span className="text-2xl">✏️</span>
  <h1 className="text-2xl font-black text-white">New Committee</h1>
</div>
            </div>

            {/* Name + Topic inline */}
            <div className="grid grid-cols-3 gap-4 mb-5 shrink-0">
              <div>
                <label className="block text-xs font-semibold text-[#C4A882] mb-1.5">Committee Name</label>
                <CommitteeNameInput
                  value={committeeName}
                  onChange={setCommitteeName}
                  onPresetSelect={handleCommitteePreset}
                />
              </div>
              <div>
  <label className="block text-xs font-semibold text-[#C4A882] mb-1.5">Chair Name</label>
  <input type="text" value={chairNames[0]} onChange={(e) => setChairNames([e.target.value])}
    placeholder="e.g. John Smith"
    className="w-full bg-[#150F09] border border-[#2E1E0F] rounded-xl px-4 py-3 text-white placeholder-[#7A5A38] focus:outline-none focus:border-[#7B4A1E] transition-colors" />
</div>
              <div>
                <label className="block text-xs font-semibold text-[#C4A882] mb-1.5">Topic / Agenda Item</label>
                <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. The right to education"
                  className="w-full bg-[#150F09] border border-[#2E1E0F] rounded-xl px-4 py-3 text-white placeholder-[#7A5A38] focus:outline-none focus:border-[#7B4A1E] transition-colors" />
              </div>
            </div>

            {/* Two-column main section — fills remaining height */}
            <div className="flex-1 grid grid-cols-2 gap-6 min-h-0">

              {/* Left: Add countries */}
              <div className="flex flex-col gap-4 min-h-0">
                {/* Search */}
                <div className="shrink-0">
                  <label className="block text-xs font-semibold text-[#C4A882] mb-1.5">Search &amp; Add</label>
                  <div className="relative">
                    <div className="flex items-center bg-[#150F09] border border-[#2E1E0F] focus-within:border-[#7B4A1E] rounded-xl overflow-visible transition-colors">
                      <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); const top = available[0]; if (top) { addDelegate(top.name); setSearch(''); } }
                          if (e.key === 'Escape') setSearch('');
                        }}
                        placeholder="Search countries..."
                        className="flex-1 bg-transparent px-4 py-3 text-white placeholder-[#7A5A38] focus:outline-none text-sm" />
                      {available[0] && search && (
                        <span className="text-xs text-[#7A5A38] px-3 shrink-0">↵ {available[0].name}</span>
                      )}
                    </div>
                    {search && available.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-[#150F09] border border-[#2E1E0F] rounded-xl overflow-hidden z-20 shadow-xl">
                        {available.slice(0, 6).map((c, i) => (
                          <button key={c.code} onMouseDown={(e) => { e.preventDefault(); addDelegate(c.name); setSearch(''); }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === 0 ? 'bg-[#7B4A1E]/20 text-white' : 'text-[#E8D5B7] hover:bg-[#2E1E0F]'}`}>
                            <span className="text-xl">{getFlagEmoji(c.code)}</span>
                            <span className="text-sm flex-1">{c.name}</span>
                            {i === 0 && <span className="ml-auto text-xs text-[#7A5A38]">Enter ↵</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bundles */}
                <div className="shrink-0">
                  <label className="block text-xs font-semibold text-[#C4A882] mb-2">Quick Bundles</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(BUNDLES).map(([key, bundle]) => (
                      <button key={key} onClick={() => addBundle(key)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1A1209] border border-[#2E1E0F] hover:border-[#7B4A1E] rounded-lg text-xs font-semibold text-[#C4A882] hover:text-white transition-all">
                        <span>{bundle.icon}</span>
                        <span>{bundle.label}</span>
                        <span className="text-[#7A5A38]">+{bundle.members.length}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Paste list — fills remaining space */}
                <div className="flex-1 flex flex-col min-h-0">
                  <label className="block text-xs font-semibold text-[#C4A882] mb-1.5">Paste Country List</label>
                  <textarea value={pasteText} onChange={(e) => { setPasteText(e.target.value); setPasteError(''); }}
                    placeholder={'France\nGermany\nBrazil, India...'}
                    className="flex-1 bg-[#150F09] border border-[#2E1E0F] rounded-xl px-4 py-3 text-white placeholder-[#7A5A38] focus:outline-none focus:border-[#7B4A1E] transition-colors text-sm resize-none min-h-0" />
                  <div className="flex items-center gap-3 mt-2">
                    <button onClick={handlePaste} disabled={!pasteText.trim()}
                      className="px-4 py-2 bg-[#1A1209] hover:bg-[#2E1E0F] disabled:opacity-40 border border-[#2E1E0F] text-[#C4A882] rounded-lg text-xs font-semibold transition-colors">
                      Auto-match &amp; Add →
                    </button>
                    {pasteError && <p className="text-xs text-yellow-400 flex-1">{pasteError}</p>}
                  </div>
                </div>
              </div>

              {/* Right: Selected delegates + launch */}
              <div className="flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <label className="text-xs font-semibold text-[#C4A882]">Selected Delegates</label>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-white">{delegates.length} added</span>
                    {delegates.length > 0 && (
                      <button onClick={() => setDelegates([])} className="text-xs text-[#7A5A38] hover:text-red-500 transition-colors">Clear all</button>
                    )}
                  </div>
                </div>

                {/* Scrollable list */}
                <div className="flex-1 bg-[#150F09] border border-[#2E1E0F] rounded-xl overflow-hidden mb-4 min-h-0">
                  {delegates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-[#7A5A38] text-sm gap-2">
                      <span className="text-3xl">🌍</span>
                      <span>No delegates added yet</span>
                    </div>
                  ) : (
                    <div className="overflow-y-auto h-full">
                      {delegates.map((name) => {
                        const found = getCountryByName(name);
                        return (
                          <div key={name} className="flex items-center gap-3 px-4 py-2.5 border-b border-[#2E1E0F]/50 last:border-0 hover:bg-[#2E1E0F] transition-colors group">
                            <span className="text-lg">{found ? getFlagEmoji(found.code) : '🌐'}</span>
                            <span className="text-sm text-white flex-1 truncate">{name}</span>
                            <button onClick={() => setDelegates((p) => p.filter((d) => d !== name))}
                              className="text-[#7A5A38] group-hover:text-red-500 transition-colors text-sm opacity-0 group-hover:opacity-100">✕</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Launch button */}
                <button onClick={() => handleCreate()} disabled={!canProceed || creating}
  className="w-full bg-[#3D6B35] hover:bg-[#4A7C42] disabled:bg-[#2E1E0F] disabled:text-[#7A5A38] text-white py-4 rounded-xl font-bold transition-colors text-base shrink-0">
  {creating ? 'Creating...' : canProceed ? `Start Session →` : 'Enter committee name and topic above'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default function CreatePage() {

  return (
    <Suspense fallback={<div className="h-screen bg-[#0D0906] flex items-center justify-center"><span className="text-[#7A5A38]">Loading...</span></div>}>
      <CreatePageInner />
    </Suspense>
  );
}
