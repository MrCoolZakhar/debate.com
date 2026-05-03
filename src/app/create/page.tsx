'use client';

import { useState, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createCommittee as createCommitteeInDB } from '@/lib/committeeService';
import { useSettingsStore } from '@/lib/settingsStore';
import { UN_COUNTRIES, getFlagUrl, getCountryByName } from '@/lib/countries';
import { UNSC_MEMBERS, WHO_MEMBERS, IMF_MEMBERS, WORLD_BANK_MEMBERS, UNEP_MEMBERS } from '@/lib/presets';
import { Emoji, InstitutionLogo } from '@/components/Emoji';

const COMMITTEE_PRESETS = [
  { name: 'UN Security Council', acronym: 'UNSC', icon: '🛡️', members: UNSC_MEMBERS },
  { name: 'UN Environment Programme', acronym: 'UNEP', icon: '🌿', members: UNEP_MEMBERS },
  { name: 'World Health Organization', acronym: 'WHO', icon: '🏥', members: WHO_MEMBERS },
  { name: 'International Monetary Fund', acronym: 'IMF', icon: '💵', members: IMF_MEMBERS },
  { name: 'World Bank', acronym: 'WB', icon: '🏦', members: WORLD_BANK_MEMBERS },
  { name: 'UN General Assembly', acronym: 'GA/UNGA', icon: '🌍', members: UN_COUNTRIES.map((c) => c.name) },
  { name: 'UN Human Rights Council', acronym: 'UNHRC', icon: '⚖️', members: ['Afghanistan','Albania','Algeria','Argentina','Armenia','Bangladesh','Benin','Bolivia','Brazil','Bulgaria','Cameroon','Chile','China','Cuba','Czech Republic','Estonia','Finland','France','Gambia','Germany','Honduras','Iceland','India','Indonesia','Japan','Kazakhstan','Kenya','Libya','Luxembourg','Malawi','Malaysia','Maldives','Marshall Islands','Mexico','Montenegro','Morocco','Namibia','Nepal','Netherlands','Pakistan','Paraguay','Peru','Poland','Qatar','Romania','Senegal','Sierra Leone','Somalia','South Africa','Sudan','Togo','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Venezuela','Vietnam'] },
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

const COUNTRY_ACRONYMS: Record<string, string> = {
  'uk':   'United Kingdom',
  'us':   'United States',
  'usa':  'United States',
  'uae':  'United Arab Emirates',
  'drc':  'DR Congo',
  'roc':  'Taiwan',
  'rok':  'South Korea',
  'dprk': 'North Korea',
  'car':  'Central African Republic',
  'png':  'Papua New Guinea',
};

function fuzzyMatchCountry(raw: string): string | null {
  const n = raw.trim().toLowerCase();
  if (!n) return null;
  if (COUNTRY_ACRONYMS[n]) return COUNTRY_ACRONYMS[n];
  const exact = UN_COUNTRIES.find((c) => c.name.toLowerCase() === n);
  if (exact) return exact.name;
  const sw = UN_COUNTRIES.find((c) => c.name.toLowerCase().startsWith(n));
  if (sw) return sw.name;
  const inc = UN_COUNTRIES.find((c) => c.name.toLowerCase().includes(n) || n.includes(c.name.toLowerCase()));
  if (inc) return inc.name;
  return null;
}

function CommitteeNameInput({ value, onChange, onPresetSelect }: {
  value: string;
  onChange: (v: string) => void;
  onPresetSelect: (preset: typeof COMMITTEE_PRESETS[0]) => void;
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Always compute matches from value — not gated on `open`
  const matches = value.trim()
    ? COMMITTEE_PRESETS.filter((p) =>
        p.name.toLowerCase().includes(value.toLowerCase()) ||
        p.acronym.toLowerCase().includes(value.toLowerCase()))
    : [];
  const topMatch = matches[0] ?? null;

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && topMatch) {
            e.preventDefault();
            onPresetSelect(topMatch);
            setOpen(false);
          }
          if (e.key === 'Escape') setOpen(false);
        }}
        placeholder="e.g. Human Rights Council or HRC"
        className="w-full bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none focus:border-[#1B3828] transition-colors"
      />
      {open && matches.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl overflow-hidden z-30 shadow-xl">
          {matches.slice(0, 6).map((p, i) => (
            <button
              key={p.name}
              onMouseDown={(e) => { e.preventDefault(); onPresetSelect(p); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                i === 0 ? 'bg-[#1B3828]/20 text-[#1C1410]' : 'text-[#1C1410] hover:bg-[#DDD4C0]'
              }`}
            >
              <span className="text-lg"><Emoji size="1.125rem">{p.icon}</Emoji></span>
              <span className="text-sm flex-1">{p.name}</span>
              <span className="text-xs text-[#9A8A78] shrink-0">{p.acronym}</span>
              {i === 0 && <span className="text-xs text-[#9A8A78] shrink-0">↵</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CreatePageInner() {
  const router = useRouter();
  const { updateSetting } = useSettingsStore();
  const [chairNames, setChairNames] = useState<string[]>(['']);
  const [committeeMode, setCommitteeMode] = useState<'select' | 'build'>('select');
  const [committeeName, setCommitteeName] = useState('');
  const [topic, setTopic] = useState('');
  const [delegates, setDelegates] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState('');
  const [creating, setCreating] = useState(false);
  const [isUNSC, setIsUNSC] = useState(false);

  const handleCreate = async () => {
    const names = chairNames.map((n) => n.trim()).filter(Boolean);
    if (!committeeName.trim() || !topic.trim()) return;
    setCreating(true);
    const result = await createCommitteeInDB(committeeName.trim(), topic.trim(), names.length > 0 ? names : ['Chair'], delegates);
    if (result) {
      updateSetting(result.code, 'chairJoinSuffix', result.chairJoinSuffix);
      updateSetting(result.code, 'separateChairCode', true);
      router.push(`/chair/${result.code}`);
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
    if (preset.members !== null) setDelegates(preset.members);
    setIsUNSC(preset.acronym === 'UNSC');
  };

  return (
    <div className="h-screen bg-[#F6F1E9] flex flex-col overflow-hidden">
      <nav className="border-b border-[#DDD4C0] bg-[#FAF8F3] px-6 h-14 flex items-center justify-between shrink-0">
        <Link href="/" className="flex items-center gap-2">
          <img src="/GavellingLogo.png" alt="Gavelling" className="w-[16vw] h-auto max-h-9 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </Link>
      </nav>

      <div className="flex-1 flex overflow-hidden">
        {committeeMode === 'select' && (
          <div className="flex-1 flex flex-col items-center justify-center px-8 py-6">
            {/* Gavelling logo — large, above card selection */}
            <img
              src="/GavellingLogo.png"
              alt="Gavelling"
              className="mb-6 object-contain"
              style={{ width: 'min(320px, 40vw)', height: 'auto' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <h1 className="text-2xl font-black text-[#1C1410] mb-2">Choose Committee Type</h1>
            <p className="text-[#6A5A4A] text-sm mb-8">Select the type of committee you want to run.</p>
            <div className="flex flex-row gap-4 w-full max-w-4xl">
              <div className="flex-1 flex flex-col items-center justify-center bg-[#EDE7D8] border border-[#DDD4C0] rounded-3xl p-8 min-h-[300px] opacity-50 cursor-not-allowed relative transition-all hover:scale-[1.02]">
                <span className="mb-4"><Emoji size="3.75rem">🗣️</Emoji></span>
                <h2 className="text-xl font-black text-[#1C1410] mb-2">Regular Debate</h2>
                <p className="text-[#6A5A4A] text-sm text-center mb-4">Traditional parliamentary debate</p>
                <span className="px-3 py-1 bg-[#DDD4C0] border border-[#C8BAA8] text-[#9A8A78] rounded-full text-xs font-semibold">Coming Soon</span>
              </div>
              <div onClick={() => setCommitteeMode('build')}
                className="flex-1 flex flex-col items-center justify-center bg-[#EDE7D8] border-2 border-[#1B3828] rounded-3xl p-8 min-h-[300px] cursor-pointer hover:bg-[#DDD4C0] hover:border-[#6A5A4A] hover:scale-[1.04] transition-all group">
                <span className="mb-4"><Emoji size="3.75rem">🌍</Emoji></span>
                <h2 className="text-xl font-black text-[#1C1410] mb-2">Model United Nations</h2>
                <p className="text-[#6A5A4A] text-sm text-center mb-4">United Nations committee simulation</p>
                <span className="px-4 py-2 bg-[#1B3828] group-hover:bg-[#2A5A3C] text-white rounded-xl text-sm font-bold transition-colors">Start →</span>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center bg-[#EDE7D8] border border-[#DDD4C0] rounded-3xl p-8 min-h-[300px] opacity-50 cursor-not-allowed relative transition-all hover:scale-[1.02]">
                <span className="mb-4"><Emoji size="3.75rem">⚡</Emoji></span>
                <h2 className="text-xl font-black text-[#1C1410] mb-2">Crisis Committee</h2>
                <p className="text-[#6A5A4A] text-sm text-center mb-4">Fast-paced crisis scenarios</p>
                <span className="px-3 py-1 bg-[#DDD4C0] border border-[#C8BAA8] text-[#9A8A78] rounded-full text-xs font-semibold">Coming H2 2026</span>
              </div>
            </div>
          </div>
        )}

        {committeeMode === 'build' && (
          <div className="flex-1 flex flex-col overflow-hidden px-8 py-6">
            <div className="flex items-center gap-3 mb-6 shrink-0">
              <button onClick={() => setCommitteeMode('select')} className="text-sm text-[#6A5A4A] hover:text-[#1C1410] transition-colors">← Back</button>
              <span className="text-2xl">✏️</span>
              <h1 className="text-2xl font-black text-[#1C1410]">New Committee</h1>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-3 shrink-0">
              <div>
                <label className="block text-xs font-semibold text-[#6A5A4A] mb-1.5">Committee Name</label>
                <CommitteeNameInput value={committeeName} onChange={(v) => { setCommitteeName(v); setIsUNSC(false); }} onPresetSelect={handleCommitteePreset} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6A5A4A] mb-1.5">
                  Chair Name <span className="text-[#9A8A78] font-normal">(optional)</span>
                </label>
                <input type="text" value={chairNames[0]} onChange={(e) => setChairNames([e.target.value])}
                  placeholder="e.g. John Smith"
                  className="w-full bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none focus:border-[#1B3828] transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6A5A4A] mb-1.5">Topic / Agenda Item</label>
                <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. The right to education"
                  className="w-full bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none focus:border-[#1B3828] transition-colors" />
              </div>
            </div>
            {isUNSC && (
              <div className="mb-3 px-4 py-2.5 bg-amber-900/20 border border-amber-700/40 rounded-xl text-amber-300 text-xs shrink-0">
                <Emoji size="1em">🛡️</Emoji> <strong>UNSC detected:</strong> P5 nations (China, France, Russia, UK, USA) will have veto voting power. You can configure this in <strong>Settings</strong> after the session starts.
              </div>
            )}

            <div className="flex-1 grid grid-cols-2 gap-6 min-h-0">
              <div className="flex flex-col gap-4 min-h-0">
                <div className="shrink-0">
                  <label className="block text-xs font-semibold text-[#6A5A4A] mb-1.5">Search &amp; Add</label>
                  <div className="relative">
                    <div className="flex items-center bg-[#FAF8F3] border border-[#DDD4C0] focus-within:border-[#1B3828] rounded-xl overflow-visible transition-colors">
                      <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (available[0]) { addDelegate(available[0].name); setSearch(''); }
                            else if (search.trim() && !delegates.includes(search.trim())) { addDelegate(search.trim()); setSearch(''); }
                          }
                          if (e.key === 'Escape') setSearch('');
                        }}
                        placeholder="Search countries or add custom…"
                        className="flex-1 bg-transparent px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none text-sm" />
                      {search && (available[0] || search.trim()) && (
                        <span className="text-xs text-[#9A8A78] px-3 shrink-0">↵ {available[0]?.name ?? search.trim()}</span>
                      )}
                    </div>
                    {search && (available.length > 0 || search.trim()) && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl overflow-hidden z-20 shadow-xl">
                        {available.slice(0, 5).map((c, i) => (
                          <button key={c.code} onMouseDown={(e) => { e.preventDefault(); addDelegate(c.name); setSearch(''); }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === 0 ? 'bg-[#1B3828]/20 text-[#1C1410]' : 'text-[#1C1410] hover:bg-[#DDD4C0]'}`}>
                            <img src={getFlagUrl(c.code)} alt={c.code} className="w-6 h-6 object-contain inline-block" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                            <span className="text-sm flex-1">{c.name}</span>
                            {i === 0 && <span className="ml-auto text-xs text-[#9A8A78]">Enter ↵</span>}
                          </button>
                        ))}
                        {search.trim() && !delegates.includes(search.trim()) && !available.some((c) => c.name.toLowerCase() === search.trim().toLowerCase()) && (
                          <button onMouseDown={(e) => { e.preventDefault(); addDelegate(search.trim()); setSearch(''); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors text-[#1C1410] hover:bg-[#DDD4C0] border-t border-[#DDD4C0]">
                            <Emoji size="1.25rem">🌐</Emoji>
                            <span className="text-sm flex-1">{search.trim()}</span>
                            <span className="text-[10px] text-[#1B3828] shrink-0 font-semibold">Add custom</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="shrink-0">
                  <label className="block text-xs font-semibold text-[#6A5A4A] mb-2">Quick Bundles</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(BUNDLES).map(([key, bundle]) => (
                      <button key={key} onClick={() => addBundle(key)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#EDE7D8] border border-[#DDD4C0] hover:border-[#1B3828] rounded-lg text-xs font-semibold text-[#6A5A4A] hover:text-[#1C1410] transition-all">
                        <span>{bundle.icon}</span>
                        <span>{bundle.label}</span>
                        <span className="text-[#9A8A78]">+{bundle.members.length}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 flex flex-col min-h-0">
                  <label className="block text-xs font-semibold text-[#6A5A4A] mb-1.5">Paste Country List</label>
                  <textarea value={pasteText} onChange={(e) => { setPasteText(e.target.value); setPasteError(''); }}
                    placeholder={'France\nGermany\nBrazil, India...'}
                    className="flex-1 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none focus:border-[#1B3828] transition-colors text-sm resize-none min-h-0" />
                  <div className="flex items-center gap-3 mt-2">
                    <button onClick={handlePaste} disabled={!pasteText.trim()}
                      className="px-4 py-2 bg-[#EDE7D8] hover:bg-[#DDD4C0] disabled:opacity-40 border border-[#DDD4C0] text-[#6A5A4A] rounded-lg text-xs font-semibold transition-colors">
                      Auto-match &amp; Add →
                    </button>
                    {pasteError && <p className="text-xs text-yellow-400 flex-1">{pasteError}</p>}
                  </div>
                </div>
              </div>

              <div className="flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <label className="text-xs font-semibold text-[#6A5A4A]">Selected Delegates</label>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-[#1C1410]">{delegates.length} added</span>
                    {delegates.length > 0 && (
                      <button onClick={() => setDelegates([])} className="text-xs text-[#9A8A78] hover:text-red-500 transition-colors">Clear all</button>
                    )}
                  </div>
                </div>

                <div className="flex-1 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl overflow-hidden mb-4 min-h-0">
                  {delegates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-[#9A8A78] text-sm gap-2">
                      <Emoji size="1.875rem">🌍</Emoji>
                      <span>No delegates added yet</span>
                    </div>
                  ) : (
                    <div className="overflow-y-auto h-full">
                      {delegates.map((name) => {
                        const found = getCountryByName(name);
                        return (
                          <div key={name} className="flex items-center gap-3 px-4 py-2.5 border-b border-[#DDD4C0]/50 last:border-0 hover:bg-[#DDD4C0] transition-colors group">
                            {found ? <img src={getFlagUrl(found.code)} alt={found.code} className="w-5 h-5 object-contain inline-block" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : <Emoji size="1.125rem">🌐</Emoji>}
                            <span className="text-sm text-[#1C1410] flex-1 truncate">{name}</span>
                            <button onClick={() => setDelegates((p) => p.filter((d) => d !== name))}
                              className="text-[#9A8A78] group-hover:text-red-500 transition-colors text-sm opacity-0 group-hover:opacity-100">✕</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <button onClick={handleCreate} disabled={!canProceed || creating}
                  className="w-full bg-[#2A5A3C] hover:bg-[#3D7A52] disabled:bg-[#DDD4C0] disabled:text-[#9A8A78] text-[#1C1410] py-4 rounded-xl font-bold transition-colors text-base shrink-0">
                  {creating ? 'Creating...' : canProceed ? 'Start Session →' : 'Enter committee name, chair, and topic above'}
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
    <Suspense fallback={<div className="h-screen bg-[#F6F1E9] flex items-center justify-center"><span className="text-[#9A8A78]">Loading...</span></div>}>
      <CreatePageInner />
    </Suspense>
  );
}
