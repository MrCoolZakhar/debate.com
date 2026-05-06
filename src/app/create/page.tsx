'use client';

import React, { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createCommittee as createCommitteeInDB } from '@/lib/committeeService';
import { useSettingsStore } from '@/lib/settingsStore';
import { UN_COUNTRIES, getFlagUrl, getCountryByName } from '@/lib/countries';
import { UNSC_MEMBERS, WHO_MEMBERS, IMF_MEMBERS, WORLD_BANK_MEMBERS, UNEP_MEMBERS } from '@/lib/presets';
import { Globe, PenLine, ChevronLeft } from 'lucide-react';
import { FlagImg } from '@/components/FlagImg';

const COMMITTEE_PRESETS = [
  { name: 'UN Security Council', acronym: 'UNSC', members: UNSC_MEMBERS },
  { name: 'UN Environment Programme', acronym: 'UNEP', members: UNEP_MEMBERS },
  { name: 'World Health Organization', acronym: 'WHO', members: WHO_MEMBERS },
  { name: 'International Monetary Fund', acronym: 'IMF', logoPath: '/logos/IMF.png', members: IMF_MEMBERS },
  { name: 'World Bank', acronym: 'WB', members: WORLD_BANK_MEMBERS },
  { name: 'UN General Assembly', acronym: 'GA/UNGA', members: UN_COUNTRIES.map((c) => c.name) },
  { name: 'UN Human Rights Council', acronym: 'UNHRC', members: ['Afghanistan','Albania','Algeria','Argentina','Armenia','Bangladesh','Benin','Bolivia','Brazil','Bulgaria','Cameroon','Chile','China','Cuba','Czech Republic','Estonia','Finland','France','Gambia','Germany','Honduras','Iceland','India','Indonesia','Japan','Kazakhstan','Kenya','Libya','Luxembourg','Malawi','Malaysia','Maldives','Marshall Islands','Mexico','Montenegro','Morocco','Namibia','Nepal','Netherlands','Pakistan','Paraguay','Peru','Poland','Qatar','Romania','Senegal','Sierra Leone','Somalia','South Africa','Sudan','Togo','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Venezuela','Vietnam'] },
  { name: 'Economic and Social Council', acronym: 'ECOSOC', members: ['Algeria','Argentina','Armenia','Australia','Austria','Azerbaijan','Bahrain','Bangladesh','Benin','Bolivia','Brazil','Bulgaria','Burundi','Canada','Chile','China','Colombia','Congo','Czech Republic','Denmark','Ecuador','Egypt','El Salvador','Estonia','Ethiopia','France','Germany','Ghana','Greece','Guatemala','Guinea','Haiti','Honduras','Hungary','India','Indonesia','Iran','Ireland','Israel','Italy','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Lesotho','Libya','Malaysia','Maldives','Mali','Malta','Mexico','Mongolia','Morocco','Mozambique','Netherlands','New Zealand','Niger','Norway','Pakistan','Panama','Paraguay','Peru','Philippines','Poland','Qatar','Romania','Russia','Rwanda','Saudi Arabia','Serbia','South Africa','South Korea','Spain','Sweden','Switzerland','Tanzania','Thailand','Togo','Turkey','Uganda','Ukraine','United Kingdom','United States','Uzbekistan','Venezuela','Vietnam','Zimbabwe'] },
  { name: 'NATO', acronym: 'NATO', logoPath: '/logos/nato.png', members: ['Albania','Belgium','Bulgaria','Canada','Croatia','Czech Republic','Denmark','Estonia','Finland','France','Germany','Greece','Hungary','Iceland','Italy','Latvia','Lithuania','Luxembourg','Montenegro','Netherlands','North Macedonia','Norway','Poland','Portugal','Romania','Slovakia','Slovenia','Spain','Sweden','Turkey','United Kingdom','United States'] },
  { name: 'G20', acronym: 'G20', members: ['Argentina','Australia','Brazil','Canada','China','France','Germany','India','Indonesia','Italy','Japan','Mexico','South Korea','Russia','Saudi Arabia','South Africa','Turkey','United Kingdom','United States'] },
  { name: 'European Union', acronym: 'EU', logoPath: '/logos/eu.png', members: ['Austria','Belgium','Bulgaria','Croatia','Cyprus','Czech Republic','Denmark','Estonia','Finland','France','Germany','Greece','Hungary','Ireland','Italy','Latvia','Lithuania','Luxembourg','Malta','Netherlands','Poland','Portugal','Romania','Slovakia','Slovenia','Spain','Sweden'] },
  { name: 'African Union', acronym: 'AU', members: ['Algeria','Angola','Benin','Botswana','Burkina Faso','Burundi','Cabo Verde','Cameroon','Central African Republic','Chad','Comoros','Congo','Côte d\'Ivoire','DR Congo','Djibouti','Egypt','Equatorial Guinea','Eritrea','Eswatini','Ethiopia','Gabon','Gambia','Ghana','Guinea','Guinea-Bissau','Kenya','Lesotho','Liberia','Libya','Madagascar','Malawi','Mali','Mauritania','Mauritius','Morocco','Mozambique','Namibia','Niger','Nigeria','Rwanda','São Tomé and Príncipe','Senegal','Seychelles','Sierra Leone','Somalia','South Africa','South Sudan','Sudan','Tanzania','Togo','Tunisia','Uganda','Zambia','Zimbabwe'] },
  { name: 'Arab League', acronym: 'LAS', logoPath: '/logos/arab-league.png', members: ['Algeria','Bahrain','Comoros','Djibouti','Egypt','Iraq','Jordan','Kuwait','Lebanon','Libya','Mauritania','Morocco','Oman','Palestine','Qatar','Saudi Arabia','Somalia','Sudan','Syria','Tunisia','United Arab Emirates','Yemen'] },
  { name: 'ASEAN', acronym: 'ASEAN', logoPath: '/logos/asean.png', members: ['Brunei','Cambodia','Indonesia','Laos','Malaysia','Myanmar','Philippines','Singapore','Thailand','Timor-Leste','Vietnam'] },
];

const BUNDLES: Record<string, { label: string; acronym: string; logoPath?: string; members: string[] }> = {
  P5:         { label: 'P5',          acronym: 'UNSC', logoPath: '/logos/un.png',            members: ['China', 'France', 'Russia', 'United Kingdom', 'United States'] },
  G7:         { label: 'G7',          acronym: 'G7',   logoPath: '/logos/g7.png',            members: ['Canada', 'France', 'Germany', 'Italy', 'Japan', 'United Kingdom', 'United States'] },
  BRICS:      { label: 'BRICS+',      acronym: 'BRICS', logoPath: '/logos/brics.png',        members: ['Brazil', 'Russia', 'India', 'China', 'South Africa', 'Egypt', 'Ethiopia', 'Iran', 'Saudi Arabia', 'United Arab Emirates'] },
  G20:        { label: 'G20',         acronym: 'G20',  logoPath: '/logos/g20.png',           members: ['Argentina', 'Australia', 'Brazil', 'Canada', 'China', 'France', 'Germany', 'India', 'Indonesia', 'Italy', 'Japan', 'Mexico', 'South Korea', 'Russia', 'Saudi Arabia', 'South Africa', 'Turkey', 'United Kingdom', 'United States'] },
  EU:         { label: 'EU',          acronym: 'EU',   logoPath: '/logos/eu.png',            members: ['Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden'] },
  NATO:       { label: 'NATO',        acronym: 'NATO', logoPath: '/logos/nato.png',          members: ['Albania', 'Belgium', 'Bulgaria', 'Canada', 'Croatia', 'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Iceland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Montenegro', 'Netherlands', 'North Macedonia', 'Norway', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Turkey', 'United Kingdom', 'United States'] },
  ASEAN:      { label: 'ASEAN',       acronym: 'ASEAN', logoPath: '/logos/asean.png',        members: ['Brunei', 'Cambodia', 'Indonesia', 'Laos', 'Malaysia', 'Myanmar', 'Philippines', 'Singapore', 'Thailand', 'Timor-Leste', 'Vietnam'] },
  ArabLeague: { label: 'Arab League', acronym: 'LAS',  logoPath: '/logos/arab-league.png',  members: ['Algeria', 'Bahrain', 'Comoros', 'Djibouti', 'Egypt', 'Iraq', 'Jordan', 'Kuwait', 'Lebanon', 'Libya', 'Mauritania', 'Morocco', 'Oman', 'Palestine', 'Qatar', 'Saudi Arabia', 'Somalia', 'Sudan', 'Syria', 'Tunisia', 'United Arab Emirates', 'Yemen'] },
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
        className="w-full bg-white/70 border border-[#C8BAA8] rounded-xl px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none focus:border-[#1B3828] focus:ring-2 focus:ring-[#1B3828]/10 transition-all text-sm"
      />
      {open && matches.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-30" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', boxShadow: '0 8px 32px rgba(27,56,40,0.14), 0 2px 8px rgba(27,56,40,0.08)' }}>
          {matches.slice(0, 6).map((p, i) => (
            <button
              key={p.name}
              onMouseDown={(e) => { e.preventDefault(); onPresetSelect(p); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-[#DDD4C0]/50 last:border-0 ${
                i === 0 ? 'text-[#1C1410]' : 'text-[#1C1410] hover:bg-[#EDE7D8]'
              }`}
              style={i === 0 ? { backgroundColor: 'rgba(27,56,40,0.07)' } : {}}
            >
              {(p as { logoPath?: string }).logoPath ? (
                <img src={(p as { logoPath?: string }).logoPath} alt={p.acronym} width={18} height={18} className="rounded-sm shrink-0 object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div className="w-[22px] h-[22px] rounded-md shrink-0" style={{ backgroundColor: 'rgba(27,56,40,0.08)' }} />
              )}
              <span className="text-sm flex-1">{p.name}</span>
              <span className="text-[10px] font-bold shrink-0" style={{ fontFamily: "'DM Mono', monospace", color: '#1B3828' }}>{p.acronym}</span>
              {i === 0 && <span className="text-[10px] shrink-0" style={{ color: '#9A8A78' }}>↵</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CardVideo({ src, active }: { src: string; active: boolean }) {
  const ref = React.useRef<HTMLVideoElement>(null);
  React.useEffect(() => {
    if (!ref.current) return;
    if (active) {
      ref.current.play().catch(() => {});
    } else {
      ref.current.pause();
    }
  }, [active]);
  return (
    <video
      ref={ref}
      src={src}
      loop
      muted
      playsInline
      className="absolute inset-0 w-full h-full object-cover object-top"
      style={{ opacity: active ? 0.22 : 0.09, transition: 'opacity 0.4s ease' }}
    />
  );
}

function SelectScreen({ onSelect }: { onSelect: () => void }) {
  const [hovered, setHovered] = React.useState<string | null>(null);

  React.useEffect(() => {
    setHovered('mun');
  }, []);

  const cards = [
    {
      id: 'debate',
      video: '/card_debate.mp4',
      title: 'Regular\nDebate',
      subtitle: 'Traditional parliamentary debate format',
      subLabel: null as string | null,
      badge: 'Coming Soon',
      active: false,
      bg: '#1B3828',
      border: 'rgba(182,135,31,0.5)',
      titleColor: '#EED98A',
      subtitleColor: 'rgba(238,217,138,0.5)',
      badgeBg: 'rgba(238,217,138,0.12)',
      badgeBorder: 'rgba(182,135,31,0.5)',
      badgeColor: '#EED98A',
    },
    {
      id: 'mun',
      video: '/card_mun.mp4',
      title: 'Model United\nNations',
      subtitle: 'A UN committee, from opening speech to passed resolution',
      subLabel: null as string | null,
      badge: null,
      active: true,
      bg: '#1B3828',
      border: 'rgba(61,122,82,0.7)',
      titleColor: '#EED98A',
      subtitleColor: 'rgba(238,217,138,0.5)',
      badgeBg: null,
      badgeBorder: null,
      badgeColor: null,
    },
    {
      id: 'crisis',
      video: '/card_crisis.mp4',
      title: 'Crisis\nCommittee',
      subtitle: 'Fast-paced crisis scenarios and directives',
      subLabel: 'Coming Late 2026' as string | null,
      badge: 'Coming Late 2026',
      active: false,
      bg: '#1B3828',
      border: 'rgba(182,135,31,0.5)',
      titleColor: '#EED98A',
      subtitleColor: 'rgba(238,217,138,0.5)',
      badgeBg: 'rgba(238,217,138,0.12)',
      badgeBorder: 'rgba(182,135,31,0.5)',
      badgeColor: '#EED98A',
    },
  ];

  const isHovered = (id: string) => hovered === id;

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 relative z-10 overflow-hidden">

      {/* Bottom surface shadow */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0"
        style={{
          height: '200px',
          background: 'linear-gradient(to top, rgba(27,56,40,0.14) 0%, rgba(27,56,40,0.05) 45%, transparent 100%)',
        }}
      />

      {/* Radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 60% 45% at 50% 72%, rgba(27,56,40,0.09) 0%, transparent 70%)',
        }}
      />

      {/* Headline */}
      <h1
        className="font-black uppercase tracking-wide text-center mb-4 relative"
        style={{ fontSize: 'clamp(30px, 3.8vw, 52px)', lineHeight: 1.05, color: '#1B3828' }}
      >
        Select Committee Type
      </h1>

      {/* Subtitle */}
      <p
        className="text-center mb-12 relative"
        style={{ fontSize: '16px', color: '#6A5A4A', maxWidth: '560px', lineHeight: 1.65, whiteSpace: 'nowrap' }}
      >
        Choose a format to get started. More committee types arriving soon.
      </p>

      {/* Cards row */}
      <div className="flex flex-row items-end justify-center gap-5 relative" style={{ maxWidth: '900px', width: '100%', height: '460px' }}>
        {cards.map((card) => {
          const active = isHovered(card.id);
          const isMun = card.id === 'mun';
          return (
            <div
              key={card.id}
              onMouseEnter={() => setHovered(card.id)}
              onMouseLeave={() => setHovered('mun')}
              className="relative flex flex-col items-center rounded-2xl overflow-hidden"
              style={{
                backgroundColor: card.bg,
                border: card.id === 'mun' ? `1.5px solid ${card.border}` : `1.5px dashed ${card.border}`,
                borderTop: isMun
                  ? '1.5px solid rgba(61,122,82,0.5)'
                  : '1.5px solid rgba(255,255,255,0.9)',
                width: '260px',
                height: '420px',
                marginBottom: '0px',
                padding: '40px 28px 36px',
                transform: active ? 'scale(1.08) translateY(-8px)' : 'scale(1) translateY(0px)',
                transformOrigin: 'bottom center',
                boxShadow: active || isMun
                  ? '0 0 0 1px rgba(61,122,82,0.12), 0 8px 16px rgba(27,56,40,0.18), 0 24px 48px rgba(27,56,40,0.26), 0 48px 80px rgba(27,56,40,0.20)'
                  : '0 2px 4px rgba(27,56,40,0.04), 0 8px 20px rgba(27,56,40,0.07), 0 1px 0 rgba(255,255,255,0.85) inset',
                transition: 'transform 0.18s cubic-bezier(0.2,0,0,1), box-shadow 0.18s cubic-bezier(0.2,0,0,1)',
                cursor: 'default',
                zIndex: active ? 10 : isMun ? 10 : 1,
              }}
            >
              {/* Grain on MUN card */}
              {isMun && (
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'repeat',
                    backgroundSize: '300px 300px',
                    mixBlendMode: 'overlay',
                    opacity: 0.07,
                  }}
                />
              )}

              {/* Video background */}
              <CardVideo src={card.video} active={active} />

              {/* Bottom fade so text is readable over video */}
              <div
                className="pointer-events-none absolute bottom-0 left-0 right-0"
                style={{
                  height: '70%',
                  background: 'linear-gradient(to top, #1B3828 55%, transparent 100%)',
                  zIndex: 1,
                }}
              />

              {/* Content — sits above video fade */}
              <div className="relative flex flex-col items-center w-full flex-1" style={{ zIndex: 2 }}>
                <div className="flex-1" style={{ minHeight: active ? '140px' : '100px', transition: 'min-height 0.4s ease' }} />

                <h2
                  className="font-black uppercase tracking-wide mb-2 text-center whitespace-pre-line"
                  style={{
                    fontSize: active ? '15px' : '12px',
                    color: card.titleColor,
                    letterSpacing: '0.08em',
                    lineHeight: 1.3,
                    transition: 'font-size 0.3s ease',
                  }}
                >
                  {card.title}
                </h2>

                {card.subLabel && (
                  <p className="text-xs text-center mb-1" style={{ color: '#7A5A38' }}>
                    {card.subLabel}
                  </p>
                )}

                <p
                  className="text-center leading-relaxed mb-0"
                  style={{
                    fontSize: active ? '12px' : '11px',
                    color: card.subtitleColor,
                    maxWidth: '180px',
                    transition: 'all 0.3s ease',
                  }}
                >
                  {card.subtitle}
                </p>

                <div className="flex justify-center w-full mt-6">
                  {isMun ? (
                    <button
                      onClick={onSelect}
                      className="px-10 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all"
                      style={{ backgroundColor: '#EED98A', color: '#1B3828', letterSpacing: '0.12em' }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = '#F5E89E';
                        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                        (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(238,217,138,0.35)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = '#EED98A';
                        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                      }}
                    >
                      START →
                    </button>
                  ) : (
                    <span
                      className="px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest"
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        backgroundColor: card.badgeBg ?? '#EDE7D8',
                        border: `1px solid ${card.badgeBorder ?? '#DDD4C0'}`,
                        color: card.badgeColor ?? '#9A8A78',
                      }}
                    >
                      {card.badge}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
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
          <SelectScreen onSelect={() => setCommitteeMode('build')} />
        )}

        {committeeMode === 'build' && (
          <div className="flex-1 flex flex-col overflow-hidden px-8 pt-4 pb-4">
            <div className="relative flex items-center justify-center mb-4 shrink-0">
              <button
                onClick={() => setCommitteeMode('select')}
                className="absolute left-0 flex items-center gap-2 px-3 py-2 rounded-xl bg-[#EDE7D8] border border-[#DDD4C0] hover:bg-[#DDD4C0] text-[#6A5A4A] hover:text-[#1C1410] text-xs font-bold uppercase tracking-wide transition-all"
              >
                <ChevronLeft size={14} /> Back
              </button>
              <h1 className="text-4xl font-black uppercase tracking-wide mb-2" style={{ color: '#1B3828', letterSpacing: '0.06em' }}>New Committee</h1>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-3 shrink-0 mt-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: '#1B3828' }}>Committee Name</label>
                <CommitteeNameInput value={committeeName} onChange={(v) => { setCommitteeName(v); setIsUNSC(false); }} onPresetSelect={handleCommitteePreset} />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: '#1B3828' }}>
                  Chair Name <span className="font-normal" style={{ color: '#9A8A78' }}>(optional)</span>
                </label>
                <input type="text" value={chairNames[0]} onChange={(e) => setChairNames([e.target.value])}
                  placeholder="e.g. John Smith"
                  className="w-full bg-white/70 border border-[#C8BAA8] rounded-xl px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none focus:border-[#1B3828] focus:ring-2 focus:ring-[#1B3828]/10 transition-all text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: '#1B3828' }}>Topic</label>
                <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. The right to education"
                  className="w-full bg-white/70 border border-[#C8BAA8] rounded-xl px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none focus:border-[#1B3828] focus:ring-2 focus:ring-[#1B3828]/10 transition-all text-sm" />
              </div>
            </div>

            {isUNSC && (
              <div className="mb-3 px-4 py-3 rounded-xl text-xs shrink-0 flex items-center gap-3" style={{ backgroundColor: '#1B3828', border: '1px solid #3D7A52', color: 'rgba(238,217,138,0.85)' }}>
                <span className="font-black shrink-0 px-2 py-0.5 rounded-md text-[10px]" style={{ fontFamily: "'DM Mono', monospace", backgroundColor: 'rgba(238,217,138,0.15)', color: '#EED98A', border: '1px solid rgba(238,217,138,0.25)' }}>UNSC</span>
                <span><strong style={{ color: '#EED98A' }}>Veto power active:</strong> P5 nations (China, France, Russia, UK, USA) will have veto voting. Customize in <strong style={{ color: '#EED98A' }}>Settings</strong> after session starts.</span>
              </div>
            )}

            <div className="flex-1 grid grid-cols-2 gap-6 min-h-0">
              <div className="flex flex-col min-h-0">
                {/* Search & Add — label row matches right column label row exactly */}
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <label className="text-xs font-bold uppercase tracking-wide" style={{ color: '#1B3828' }}>Search &amp; Add</label>
                </div>
                <div className="shrink-0 mb-3">
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
                      <div className="absolute top-full left-0 right-0 mt-1 bg-[#FAF8F3] border-2 border-[#C8BAA8] rounded-xl overflow-hidden z-20 shadow-xl">
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

                {/* Quick Bundles */}
                <div className="shrink-0 mb-3">
                  <label className="block text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#1B3828' }}>Quick Bundles</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(BUNDLES).map(([key, bundle]) => (
                      <button key={key} onClick={() => addBundle(key)}
                        className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all"
                        style={{ backgroundColor: '#FAF8F3', color: '#1B3828', border: '1px solid #DDD4C0' }}
                        onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = '#1B3828'; el.style.color = '#EED98A'; el.style.borderColor = '#1B3828'; }}
                        onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = '#FAF8F3'; el.style.color = '#1B3828'; el.style.borderColor = '#DDD4C0'; }}>
                        {bundle.logoPath ? (
                          <img src={bundle.logoPath} alt={bundle.label} width={16} height={16} className="rounded-sm shrink-0 object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                        ) : null}
                        <span>{bundle.label}</span>
                        <span className="font-mono text-[10px] ml-1 group-hover:opacity-60" style={{ color: '#9A8A78' }}>+{bundle.members.length}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Paste Country List — flex-1 to fill remaining space, matching delegates box */}
                <div className="flex-1 flex flex-col min-h-0">
                  <label className="block text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#1B3828' }}>Paste Country List</label>
                  <textarea value={pasteText} onChange={(e) => { setPasteText(e.target.value); setPasteError(''); }}
                    placeholder={'France\nGermany\nBrazil, India...'}
                    className="flex-1 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none focus:border-[#1B3828] focus:ring-2 focus:ring-[#1B3828]/10 transition-all text-sm resize-none min-h-0" />
                </div>

                {/* Auto-match button — same row as Start Session, outside the box */}
                <div className="flex items-center gap-3 mt-3 shrink-0" style={{ height: '56px' }}>
                  <button onClick={handlePaste} disabled={!pasteText.trim()}
                    className="px-6 py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{ backgroundColor: '#1B3828', color: '#EED98A' }}
                    onMouseEnter={(e) => { if (!pasteText.trim()) return; (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(238,217,138,0.2)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}>
                    Auto-match &amp; Add →
                  </button>
                  {pasteError && <p className="text-xs" style={{ color: '#B6871F' }}>{pasteError}</p>}
                </div>
              </div>

              <div className="flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold uppercase tracking-wide" style={{ color: '#1B3828' }}>Selected Delegates</label>
                    <span className="text-[10px] font-bold text-[#1B3828] bg-[#EED98A]/30 px-2 py-0.5 rounded-full" style={{ fontFamily: "'DM Mono', monospace" }}>{delegates.length}</span>
                  </div>
                  {delegates.length > 0 && (
                    <button onClick={() => setDelegates([])} className="text-[10px] font-bold text-[#9A8A78] hover:text-[#8B2020] uppercase tracking-wide transition-colors">Clear all</button>
                  )}
                </div>

                <div className="flex-1 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl overflow-hidden mb-3 min-h-0">
                  {delegates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2 px-8">
                      <p className="text-base font-black uppercase tracking-wide text-center" style={{ color: '#1B3828', fontFamily: "'DM Mono', monospace" }}>No Delegates Yet</p>
                      <p className="text-xs text-center leading-relaxed" style={{ color: '#9A8A78', maxWidth: '200px' }}>Search countries or use Quick Bundles above to get started</p>
                    </div>
                  ) : (
                    <div className="overflow-y-auto h-full">
                      {delegates.map((name) => {
                        const found = getCountryByName(name);
                        return (
                          <div key={name} className="flex items-center gap-3 px-4 py-2.5 border-b border-[#DDD4C0]/50 last:border-0 transition-colors group" onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.06)'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = ''; }}>
                            {found
                              ? <img src={getFlagUrl(found.code)} alt={found.code} className="w-5 h-5 object-contain inline-block" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                              : <Globe size={16} strokeWidth={1.5} className="text-[#9A8A78] shrink-0" />
                            }
                            <span className="text-sm flex-1 truncate font-medium" style={{ color: '#1C1410' }}>{name}</span>
                            <button onClick={() => setDelegates((p) => p.filter((d) => d !== name))}
                              className="text-[#9A8A78] group-hover:text-red-500 transition-colors text-sm opacity-0 group-hover:opacity-100">✕</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleCreate}
                  disabled={!canProceed || creating}
                  className="w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all shrink-0"
                  style={{
                    backgroundColor: canProceed && !creating ? '#1B3828' : '#DDD4C0',
                    color: canProceed && !creating ? '#EED98A' : '#9A8A78',
                    boxShadow: canProceed && !creating ? '0 8px 24px rgba(27,56,40,0.25)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!canProceed || creating) return;
                    (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C';
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(238,217,138,0.2), 0 8px 24px rgba(27,56,40,0.25)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828';
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(27,56,40,0.25)';
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
    <Suspense fallback={<div className="h-screen bg-[#EDE7D8] flex items-center justify-center"><span className="text-[#9A8A78]">Loading...</span></div>}>
      <CreatePageInner />
    </Suspense>
  );
}
