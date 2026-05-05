'use client';

import { useState, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createCommittee as createCommitteeInDB } from '@/lib/committeeService';
import { useSettingsStore } from '@/lib/settingsStore';
import { UN_COUNTRIES, getFlagUrl, getCountryByName } from '@/lib/countries';
import { UNSC_MEMBERS, WHO_MEMBERS, IMF_MEMBERS, WORLD_BANK_MEMBERS, UNEP_MEMBERS } from '@/lib/presets';
import { Mic, Globe, Zap, PenLine, ChevronLeft } from 'lucide-react';

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
        className="w-full bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none focus:border-[#1B3828] focus:ring-2 focus:ring-[#1B3828]/10 transition-all text-sm"
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
    <div className="h-screen flex flex-col overflow-hidden relative" style={{ backgroundColor: '#EDE7D8' }}>
      {/* Grain texture — matches landing page */}
      <div
        className="pointer-events-none fixed inset-0 z-[1]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '300px 300px',
          mixBlendMode: 'multiply',
          opacity: 0.18,
        }}
      />
      <nav className="relative z-20 border-b border-[#DDD4C0]/60 px-8 md:px-14 flex items-center shrink-0" style={{ height: '72px', backgroundColor: '#EDE7D8' }}>
        <Link href="/">
          <img src="/GavellingLogo.png" alt="Gavelling" className="h-10 w-auto object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </Link>
      </nav>

      <div className="flex-1 flex overflow-hidden">
        {committeeMode === 'select' && (
          <div className="flex-1 flex flex-col items-center justify-center px-8 py-6 relative z-10">

            {/* Radial glow behind cards */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: 'radial-gradient(ellipse 65% 55% at 50% 68%, rgba(27,56,40,0.10) 0%, transparent 70%)',
              }}
            />

            {/* Eyebrow */}
            <div className="flex items-center gap-3 mb-4 relative">
              <div className="h-px w-10" style={{ backgroundColor: 'rgba(182,135,31,0.4)' }} />
              <p className="text-xs font-bold tracking-[0.22em] uppercase" style={{ fontFamily: "'DM Mono', monospace", color: '#9A8A78' }}>
                Committee Format
              </p>
              <div className="h-px w-10" style={{ backgroundColor: 'rgba(182,135,31,0.4)' }} />
            </div>

            {/* Two-tone headline */}
            <h1 className="font-black uppercase tracking-wide text-center mb-3 relative" style={{ fontSize: 'clamp(28px, 3.5vw, 48px)', lineHeight: 1.05 }}>
              <span style={{ color: '#1B3828' }}>Select Committee </span>
              <span style={{ color: '#B6871F' }}>Type</span>
            </h1>
            <p className="text-sm text-center mb-12 relative" style={{ color: '#9A8A78', maxWidth: '340px', lineHeight: 1.6 }}>
              Choose a format to get started. More committee types arriving soon.
            </p>

            {/* Cards row */}
            <div className="flex flex-row items-center justify-center gap-6 w-full max-w-4xl relative">

              {/* Regular Debate — coming soon */}
              <div
                className="flex flex-col items-center justify-start rounded-2xl relative overflow-hidden"
                style={{
                  backgroundColor: '#FAF8F3',
                  border: '1.5px solid #DDD4C0',
                  borderTop: '1.5px solid #EDE7D8',
                  width: '220px',
                  flexShrink: 0,
                  minHeight: '380px',
                  padding: '36px 28px 32px',
                  transform: 'scale(0.94) translateY(20px)',
                  boxShadow: '0 4px 6px rgba(27,56,40,0.04), 0 12px 32px rgba(27,56,40,0.08), 0 1px 0px rgba(255,255,255,0.8) inset',
                  cursor: 'not-allowed',
                }}
              >
                {/* SVG illustration — mic */}
                <div className="mb-6 flex items-center justify-center" style={{ width: '72px', height: '72px' }}>
                  <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="72" height="72" rx="18" fill="#EDE7D8"/>
                    <rect x="32" y="14" width="8" height="18" rx="4" stroke="#C8BAA8" strokeWidth="2" fill="none"/>
                    <path d="M24 28c0 6.627 5.373 12 12 12s12-5.373 12-12" stroke="#C8BAA8" strokeWidth="2" strokeLinecap="round" fill="none"/>
                    <line x1="36" y1="40" x2="36" y2="50" stroke="#C8BAA8" strokeWidth="2" strokeLinecap="round"/>
                    <line x1="28" y1="50" x2="44" y2="50" stroke="#C8BAA8" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <h2 className="font-black uppercase tracking-wide mb-2 text-center" style={{ fontSize: '13px', color: '#1C1410', letterSpacing: '0.08em' }}>Regular Debate</h2>
                <p className="text-xs text-center mb-6 leading-relaxed" style={{ color: '#9A8A78' }}>Traditional parliamentary debate format</p>
                <div className="mt-auto flex justify-center w-full">
                  <span
                    className="px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest"
                    style={{ fontFamily: "'DM Mono', monospace", backgroundColor: '#EDE7D8', border: '1px solid #DDD4C0', color: '#9A8A78' }}
                  >
                    Coming Soon
                  </span>
                </div>
              </div>

              {/* Model United Nations — active, elevated center */}
              <div
                className="flex flex-col items-center justify-start rounded-2xl relative overflow-hidden"
                style={{
                  backgroundColor: '#1B3828',
                  border: '1.5px solid #3D7A52',
                  borderTop: '1.5px solid rgba(61,122,82,0.6)',
                  width: '280px',
                  flexShrink: 0,
                  minHeight: '460px',
                  padding: '44px 36px 40px',
                  boxShadow: '0 0 0 1px rgba(61,122,82,0.2), 0 20px 40px rgba(27,56,40,0.25), 0 40px 80px rgba(27,56,40,0.30), 0 1px 0px rgba(255,255,255,0.06) inset',
                  zIndex: 10,
                }}
              >
                {/* Grain on active card */}
                <div
                  className="pointer-events-none absolute inset-0 rounded-2xl"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'repeat',
                    backgroundSize: '300px 300px',
                    mixBlendMode: 'overlay',
                    opacity: 0.07,
                  }}
                />
                {/* SVG illustration — globe */}
                <div className="mb-6 flex items-center justify-center" style={{ width: '88px', height: '88px' }}>
                  <svg width="88" height="88" viewBox="0 0 88 88" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="88" height="88" rx="22" fill="rgba(238,217,138,0.12)"/>
                    <circle cx="44" cy="44" r="20" stroke="#EED98A" strokeWidth="1.5" fill="none"/>
                    <ellipse cx="44" cy="44" rx="10" ry="20" stroke="#EED98A" strokeWidth="1.5" fill="none" opacity="0.6"/>
                    <line x1="24" y1="44" x2="64" y2="44" stroke="#EED98A" strokeWidth="1.5" opacity="0.6"/>
                    <line x1="26" y1="36" x2="62" y2="36" stroke="#EED98A" strokeWidth="1" opacity="0.35"/>
                    <line x1="26" y1="52" x2="62" y2="52" stroke="#EED98A" strokeWidth="1" opacity="0.35"/>
                    <line x1="44" y1="24" x2="44" y2="64" stroke="#EED98A" strokeWidth="1.5" opacity="0.6"/>
                  </svg>
                </div>
                <h2 className="font-black uppercase tracking-wide mb-2 text-center" style={{ fontSize: '16px', color: '#EED98A', letterSpacing: '0.08em', lineHeight: 1.3 }}>
                  Model United<br />Nations
                </h2>
                <p className="text-xs text-center mb-8 leading-relaxed" style={{ color: 'rgba(238,217,138,0.55)' }}>
                  United Nations committee simulation
                </p>
                <div className="mt-auto flex justify-center w-full">
                  <button
                    onClick={() => setCommitteeMode('build')}
                    className="px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all"
                    style={{ backgroundColor: '#EED98A', color: '#1B3828', letterSpacing: '0.12em' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#F5E8A0'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 20px rgba(238,217,138,0.3)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#EED98A'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                  >
                    START →
                  </button>
                </div>
              </div>

              {/* Crisis Committee — coming soon */}
              <div
                className="flex flex-col items-center justify-start rounded-2xl relative overflow-hidden"
                style={{
                  backgroundColor: '#FAF8F3',
                  border: '1.5px solid #DDD4C0',
                  borderTop: '1.5px solid #EDE7D8',
                  width: '220px',
                  flexShrink: 0,
                  minHeight: '380px',
                  padding: '36px 28px 32px',
                  transform: 'scale(0.94) translateY(20px)',
                  boxShadow: '0 4px 6px rgba(27,56,40,0.04), 0 12px 32px rgba(27,56,40,0.08), 0 1px 0px rgba(255,255,255,0.8) inset',
                  cursor: 'not-allowed',
                }}
              >
                {/* SVG illustration — lightning */}
                <div className="mb-6 flex items-center justify-center" style={{ width: '72px', height: '72px' }}>
                  <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="72" height="72" rx="18" fill="#EDE7D8"/>
                    <path d="M40 14L26 38h14l-8 20 20-28H38l2-16z" stroke="#C8BAA8" strokeWidth="2" strokeLinejoin="round" fill="none"/>
                  </svg>
                </div>
                <h2 className="font-black uppercase tracking-wide mb-2 text-center" style={{ fontSize: '13px', color: '#1C1410', letterSpacing: '0.08em' }}>Crisis Committee</h2>
                <p className="text-xs text-center mb-6 leading-relaxed" style={{ color: '#9A8A78' }}>Fast-paced crisis scenarios and directives</p>
                <div className="mt-auto flex justify-center w-full">
                  <span
                    className="px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest"
                    style={{ fontFamily: "'DM Mono', monospace", backgroundColor: '#EDE7D8', border: '1px solid #DDD4C0', color: '#9A8A78' }}
                  >
                    Coming H2 2026
                  </span>
                </div>
              </div>

            </div>
          </div>
        )}

        {committeeMode === 'build' && (
          <div className="flex-1 flex flex-col overflow-hidden px-8 py-6">
            {/* Fix 3 — Header */}
            <div className="flex items-center gap-4 mb-6 shrink-0">
              <button
                onClick={() => setCommitteeMode('select')}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#EDE7D8] border border-[#DDD4C0] hover:bg-[#DDD4C0] text-[#6A5A4A] hover:text-[#1C1410] text-xs font-bold uppercase tracking-wide transition-all"
              >
                <ChevronLeft size={14} /> Back
              </button>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#1B3828] flex items-center justify-center text-[#EED98A]">
                  <PenLine size={15} />
                </div>
                <h1 className="text-xl font-black text-[#1C1410] uppercase tracking-wide">New Committee</h1>
              </div>
            </div>

            {/* Fix 3 — Form inputs */}
            <div className="grid grid-cols-3 gap-4 mb-3 shrink-0">
              <div>
                <label className="block text-[10px] font-bold tracking-[0.12em] text-[#9A8A78] uppercase mb-2">Committee Name</label>
                <CommitteeNameInput value={committeeName} onChange={(v) => { setCommitteeName(v); setIsUNSC(false); }} onPresetSelect={handleCommitteePreset} />
              </div>
              <div>
                <label className="block text-[10px] font-bold tracking-[0.12em] text-[#9A8A78] uppercase mb-2">
                  Chair Name <span className="text-[#9A8A78] font-normal normal-case tracking-normal">( optional)</span>
                </label>
                <input type="text" value={chairNames[0]} onChange={(e) => setChairNames([e.target.value])}
                  placeholder="e.g. John Smith"
                  className="w-full bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none focus:border-[#1B3828] focus:ring-2 focus:ring-[#1B3828]/10 transition-all text-sm" />
              </div>
              <div>
                <label className="block text-[10px] font-bold tracking-[0.12em] text-[#9A8A78] uppercase mb-2">Topic / Agenda Item</label>
                <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. The right to education"
                  className="w-full bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none focus:border-[#1B3828] focus:ring-2 focus:ring-[#1B3828]/10 transition-all text-sm" />
              </div>
            </div>

            {/* Fix 4 — UNSC warning banner */}
            {isUNSC && (
              <div className="mb-3 px-4 py-2.5 rounded-xl text-xs font-medium shrink-0 flex items-center gap-2" style={{ backgroundColor: 'rgba(182,135,31,0.12)', border: '1px solid rgba(182,135,31,0.35)', color: '#1C1410' }}>
                <span className="font-black text-[#B6871F]" style={{ fontFamily: "'DM Mono', monospace" }}>UNSC</span>
                <span><strong>Veto power active:</strong> P5 nations (China, France, Russia, UK, USA) will have veto voting. Configure in <strong>Settings</strong> after session starts.</span>
              </div>
            )}

            <div className="flex-1 grid grid-cols-2 gap-6 min-h-0">
              {/* Fix 5 — Left column */}
              <div className="flex flex-col gap-4 min-h-0">
                <div className="shrink-0">
                  <label className="block text-[10px] font-bold tracking-[0.12em] text-[#9A8A78] uppercase mb-2">Search &amp; Add</label>
                  <div className="relative">
                    <div className="flex items-center bg-[#FAF8F3] border border-[#DDD4C0] focus-within:border-[#1B3828] focus-within:ring-2 focus-within:ring-[#1B3828]/10 rounded-xl overflow-visible transition-all">
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
                            <Globe size={18} strokeWidth={1.5} className="text-[#9A8A78] shrink-0" />
                            <span className="text-sm flex-1">{search.trim()}</span>
                            <span className="text-[10px] text-[#1B3828] shrink-0 font-semibold">Add custom</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="shrink-0">
                  <label className="block text-[10px] font-bold tracking-[0.12em] text-[#9A8A78] uppercase mb-2">Quick Bundles</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(BUNDLES).map(([key, bundle]) => (
                      <button key={key} onClick={() => addBundle(key)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF8F3] border border-[#DDD4C0] hover:bg-[#1B3828] hover:text-[#EED98A] hover:border-[#1B3828] rounded-lg text-xs font-bold uppercase tracking-wide text-[#6A5A4A] transition-all">
                        <span>{bundle.label}</span>
                        <span className="text-[#9A8A78] font-mono text-[10px] ml-1">+{bundle.members.length}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 flex flex-col min-h-0">
                  <label className="block text-[10px] font-bold tracking-[0.12em] text-[#9A8A78] uppercase mb-2">Paste Country List</label>
                  <textarea value={pasteText} onChange={(e) => { setPasteText(e.target.value); setPasteError(''); }}
                    placeholder={'France\nGermany\nBrazil, India...'}
                    className="flex-1 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none focus:border-[#1B3828] focus:ring-2 focus:ring-[#1B3828]/10 transition-all text-sm resize-none min-h-0" />
                  <div className="flex items-center gap-3 mt-2">
                    <button onClick={handlePaste} disabled={!pasteText.trim()}
                      className="px-4 py-2 bg-[#1B3828] hover:bg-[#2A5A3C] disabled:opacity-30 disabled:bg-[#DDD4C0] disabled:text-[#9A8A78] text-[#EED98A] rounded-lg text-xs font-bold uppercase tracking-wide transition-all">
                      Auto-match &amp; Add →
                    </button>
                    {pasteError && <p className="text-xs text-yellow-400 flex-1">{pasteError}</p>}
                  </div>
                </div>
              </div>

              {/* Fix 6 — Delegates panel */}
              <div className="flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-bold tracking-[0.12em] text-[#9A8A78] uppercase">Selected Delegates</label>
                    <span className="text-[10px] font-bold text-[#1B3828] bg-[#EED98A]/30 px-2 py-0.5 rounded-full" style={{ fontFamily: "'DM Mono', monospace" }}>{delegates.length}</span>
                  </div>
                  {delegates.length > 0 && (
                    <button onClick={() => setDelegates([])} className="text-[10px] font-bold text-[#9A8A78] hover:text-[#8B2020] uppercase tracking-wide transition-colors">Clear all</button>
                  )}
                </div>

                <div className="flex-1 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl overflow-hidden mb-4 min-h-0">
                  {delegates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2">
                      <Globe size={28} strokeWidth={1.5} className="text-[#DDD4C0]" />
                      <span className="text-[#9A8A78] text-sm font-medium">No delegates added yet</span>
                    </div>
                  ) : (
                    <div className="overflow-y-auto h-full">
                      {delegates.map((name) => {
                        const found = getCountryByName(name);
                        return (
                          <div key={name} className="flex items-center gap-3 px-4 py-2.5 border-b border-[#DDD4C0]/50 last:border-0 hover:bg-[#DDD4C0] transition-colors group">
                            {found
                              ? <img src={getFlagUrl(found.code)} alt={found.code} className="w-5 h-5 object-contain inline-block" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                              : <Globe size={16} strokeWidth={1.5} className="text-[#9A8A78] shrink-0" />
                            }
                            <span className="text-sm text-[#1C1410] flex-1 truncate">{name}</span>
                            <button onClick={() => setDelegates((p) => p.filter((d) => d !== name))}
                              className="text-[#9A8A78] group-hover:text-red-500 transition-colors text-sm opacity-0 group-hover:opacity-100">✕</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Fix 6 — Start Session button */}
                <button
                  onClick={handleCreate}
                  disabled={!canProceed || creating}
                  className="w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all shrink-0"
                  style={{
                    backgroundColor: canProceed && !creating ? '#1B3828' : '#DDD4C0',
                    color: canProceed && !creating ? '#EED98A' : '#9A8A78',
                    boxShadow: canProceed && !creating ? '0 8px 24px rgba(27,56,40,0.25)' : 'none',
                  }}
                >
                  {creating ? 'CREATING...' : canProceed ? 'START SESSION →' : 'ENTER COMMITTEE NAME & TOPIC ABOVE'}
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
