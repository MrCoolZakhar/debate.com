'use client';

import React, { useState, useRef, useEffect, Suspense } from 'react';
import FitToScreen from '@/components/FitToScreen';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createCommittee as createCommitteeInDB } from '@/lib/committeeService';
import { useSettingsStore } from '@/lib/settingsStore';
import { UN_COUNTRIES, getFlagUrl, getCountryByName, getCountryDisplayName, matchesSearch, findCountryFlexible, compareCountryNames } from '@/lib/countries';
import { UNSC_MEMBERS, WHO_MEMBERS, IMF_MEMBERS, WORLD_BANK_MEMBERS, UNEP_MEMBERS, ICC_ROLES, ICJ_ROLES, CRISIS_MEMBERS, FIFA_MEMBERS, HOUSE_OF_COMMONS_ROLES, US_SENATE_MEMBERS, PRESS_ROLES, EUROPEAN_PARLIAMENT_MEMBERS } from '@/lib/presets';
import { Globe, PenLine, ChevronLeft, Megaphone } from 'lucide-react';
import { FlagImg } from '@/components/FlagImg';
import Loader from '@/components/Loader';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { getCommitteeDisplayName } from '@/lib/presetNames';

const COMMITTEE_PRESETS = [
  { name: 'UN Security Council', acronym: 'UNSC', logoPath: '/logos/un.svg', members: UNSC_MEMBERS },
  { name: 'UN Environment Programme', acronym: 'UNEP', logoPath: '/logos/UNEP.png', members: UNEP_MEMBERS },
  { name: 'World Health Organization', acronym: 'WHO', logoPath: '/logos/who.png', members: WHO_MEMBERS },
  { name: 'International Monetary Fund', acronym: 'IMF', logoPath: '/logos/IMF.png', members: IMF_MEMBERS },
  { name: 'World Bank', acronym: 'WB', logoPath: '/logos/worldbank.svg', members: WORLD_BANK_MEMBERS },
  { name: 'UN General Assembly', acronym: 'GA/UNGA', logoPath: '/logos/un.svg', members: UN_COUNTRIES.filter((c) => !['Holy See', 'Kosovo', 'Niue', 'Palestine', 'Taiwan', 'Cook Islands', 'European Union', 'African Union'].includes(c.name)).map((c) => c.name) },
  { name: 'UN Human Rights Council', acronym: 'UNHRC', logoPath: '/logos/UNHRC.png', members: ['Afghanistan','Albania','Algeria','Argentina','Armenia','Bangladesh','Benin','Bolivia','Brazil','Bulgaria','Cameroon','Chile','China','Cuba','Czech Republic','Estonia','Finland','France','Gambia','Germany','Honduras','Iceland','India','Indonesia','Japan','Kazakhstan','Kenya','Libya','Luxembourg','Malawi','Malaysia','Maldives','Marshall Islands','Mexico','Montenegro','Morocco','Namibia','Nepal','Netherlands','Pakistan','Paraguay','Peru','Poland','Qatar','Romania','Senegal','Sierra Leone','Somalia','South Africa','Sudan','Togo','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Venezuela','Vietnam'] },
  { name: 'Economic and Social Council', acronym: 'ECOSOC', logoPath: '/logos/un.svg', members: ['Algeria','Argentina','Armenia','Australia','Austria','Azerbaijan','Bahrain','Bangladesh','Benin','Bolivia','Brazil','Bulgaria','Burundi','Canada','Chile','China','Colombia','Congo','Czech Republic','Denmark','Ecuador','Egypt','El Salvador','Estonia','Ethiopia','France','Germany','Ghana','Greece','Guatemala','Guinea','Haiti','Honduras','Hungary','India','Indonesia','Iran','Ireland','Israel','Italy','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Lesotho','Libya','Malaysia','Maldives','Mali','Malta','Mexico','Mongolia','Morocco','Mozambique','Netherlands','New Zealand','Niger','Norway','Pakistan','Panama','Paraguay','Peru','Philippines','Poland','Qatar','Romania','Russia','Rwanda','Saudi Arabia','Serbia','South Africa','South Korea','Spain','Sweden','Switzerland','Tanzania','Thailand','Togo','Türkiye','Uganda','Ukraine','United Kingdom','United States','Uzbekistan','Venezuela','Vietnam','Zimbabwe'] },
  { name: 'NATO', acronym: 'NATO', logoPath: '/logos/nato.png', members: ['Albania','Belgium','Bulgaria','Canada','Croatia','Czech Republic','Denmark','Estonia','Finland','France','Germany','Greece','Hungary','Iceland','Italy','Latvia','Lithuania','Luxembourg','Montenegro','Netherlands','North Macedonia','Norway','Poland','Portugal','Romania','Slovakia','Slovenia','Spain','Sweden','Türkiye','United Kingdom','United States'] },
  { name: 'G20', acronym: 'G20', logoPath: '/logos/g20.svg', members: ['Argentina','Australia','Brazil','Canada','China','France','Germany','India','Indonesia','Italy','Japan','Mexico','South Korea','Russia','Saudi Arabia','South Africa','Türkiye','United Kingdom','United States'] },
  { name: 'European Union', acronym: 'EU', logoPath: '/logos/eu.png', members: ['Austria','Belgium','Bulgaria','Croatia','Cyprus','Czech Republic','Denmark','Estonia','Finland','France','Germany','Greece','Hungary','Ireland','Italy','Latvia','Lithuania','Luxembourg','Malta','Netherlands','Poland','Portugal','Romania','Slovakia','Slovenia','Spain','Sweden'] },
  { name: 'African Union', acronym: 'AU', logoPath: '/logos/AU.png', members: ['Algeria','Angola','Benin','Botswana','Burkina Faso','Burundi','Cabo Verde','Cameroon','Central African Republic','Chad','Comoros','Congo','Côte d\'Ivoire','DR Congo','Djibouti','Egypt','Equatorial Guinea','Eritrea','Eswatini','Ethiopia','Gabon','Gambia','Ghana','Guinea','Guinea-Bissau','Kenya','Lesotho','Liberia','Libya','Madagascar','Malawi','Mali','Mauritania','Mauritius','Morocco','Mozambique','Namibia','Niger','Nigeria','Rwanda','São Tomé and Príncipe','Senegal','Seychelles','Sierra Leone','Somalia','South Africa','South Sudan','Sudan','Tanzania','Togo','Tunisia','Uganda','Zambia','Zimbabwe'] },
  { name: 'Arab League', acronym: 'LAS', logoPath: '/logos/arab-league.png', members: ['Algeria','Bahrain','Comoros','Djibouti','Egypt','Iraq','Jordan','Kuwait','Lebanon','Libya','Mauritania','Morocco','Oman','Palestine','Qatar','Saudi Arabia','Somalia','Sudan','Syria','Tunisia','United Arab Emirates','Yemen'] },
  { name: 'ASEAN', acronym: 'ASEAN', logoPath: '/logos/asean.png', members: ['Brunei','Cambodia','Indonesia','Laos','Malaysia','Myanmar','Philippines','Singapore','Thailand','Timor-Leste','Vietnam'] },
  { name: 'GA First Committee (Disarmament)',            acronym: 'DISEC',   logoPath: '/logos/un.svg',       members: [] },
  { name: 'GA Fourth Committee (Special Political)',     acronym: 'SPECPOL', logoPath: '/logos/un.svg',       members: [] },
  { name: 'GA Third Committee (Social, Humanitarian)',   acronym: 'SOCHUM',  logoPath: '/logos/un.svg',       members: [] },
  { name: 'GA Sixth Committee (Legal)',                  acronym: 'LEGAL',   logoPath: '/logos/un.svg',       members: [] },
  { name: 'UN Children\'s Fund',                         acronym: 'UNICEF',  logoPath: '/logos/unicef.png',   members: [] },
  { name: 'UN Educational, Scientific & Cultural Org.', acronym: 'UNESCO',  logoPath: '/logos/unesco.png',   members: [] },
  { name: 'UN Refugee Agency',                           acronym: 'UNHCR',   logoPath: '/logos/un.svg',       members: [] },
  { name: 'World Food Programme',                        acronym: 'WFP',     logoPath: '/logos/un.svg',       members: [] },
  { name: 'Food and Agriculture Organization',           acronym: 'FAO',     logoPath: '/logos/fao.png',      members: [] },
  { name: 'International Labour Organization',           acronym: 'ILO',     logoPath: '/logos/un.svg',       members: [] },
  { name: 'International Atomic Energy Agency',          acronym: 'IAEA',    logoPath: '/logos/iaea.png',     members: [] },
  { name: 'UN Development Programme',                   acronym: 'UNDP',    logoPath: '/logos/un.svg',       members: [] },
  { name: 'UN Entity for Gender Equality (UN Women)',   acronym: 'UNW',     logoPath: '/logos/un.svg',       members: [] },
  { name: 'UN Office on Drugs and Crime',               acronym: 'UNODC',   logoPath: '/logos/un.svg',       members: [] },
  { name: 'International Criminal Court',                acronym: 'ICC',       logoPath: '/logos/icc.svg',                 members: ICC_ROLES },
  { name: 'International Court of Justice',              acronym: 'ICJ',       logoPath: '/logos/icj.svg',                 members: ICJ_ROLES },
  { name: 'Crisis Committee',                           acronym: 'Crisis',    logoPath: '/committee-emblems/crisis.svg',  members: CRISIS_MEMBERS },
  { name: 'FIFA Congress',                              acronym: 'FIFA',      logoPath: '/logos/fifa.svg',                members: FIFA_MEMBERS },
  { name: 'House of Commons',                           acronym: 'HoC',       logoPath: '/logos/commons.svg',             members: HOUSE_OF_COMMONS_ROLES },
  { name: 'United States Senate',                       acronym: 'US Senate', logoPath: '/logos/senate.svg',              members: US_SENATE_MEMBERS },
  { name: 'International Press Corps',                   acronym: 'IPC',       logoPath: '/logos/press.svg',               members: PRESS_ROLES },
  { name: 'European Parliament',                        acronym: 'EP',        logoPath: '/logos/eu.png',                  members: EUROPEAN_PARLIAMENT_MEMBERS },
];

function getPresetDisplayName(name: string, lang: string): string {
  return getCommitteeDisplayName(name, lang);
}

const PRESET_ACRONYM_ES: Record<string, string> = {
  'UN Security Council': 'CSNU',
  'UN Environment Programme': 'PNUMA',
  'World Health Organization': 'OMS',
  'International Monetary Fund': 'FMI',
  'World Bank': 'BM',
  'UN General Assembly': 'AGNU',
  'UN Human Rights Council': 'CDHNU',
  'Economic and Social Council': 'ECOSOC',
  'NATO': 'OTAN',
  'G20': 'G20',
  'European Union': 'UE',
  'African Union': 'UA',
  'Arab League': 'LA',
  'ASEAN': 'ASEAN',
};

const PRESET_ACRONYM_FR: Record<string, string> = {
  'UN Security Council': 'CSNU',
  'UN Environment Programme': 'PNUE',
  'World Health Organization': 'OMS',
  'International Monetary Fund': 'FMI',
  'World Bank': 'BM',
  'UN General Assembly': 'AGNU',
  'UN Human Rights Council': 'CDH',
  'Economic and Social Council': 'ECOSOC',
  'NATO': 'OTAN',
  'G20': 'G20',
  'European Union': 'UE',
  'African Union': 'UA',
  'Arab League': 'LA',
  'ASEAN': 'ASEAN',
};

function getPresetAcronym(name: string, lang: string): string {
  if (lang === 'fr') return PRESET_ACRONYM_FR[name] ?? '';
  if (lang === 'es') return PRESET_ACRONYM_ES[name] ?? '';
  return '';
}

const BUNDLES: Record<string, { label: string; acronym: string; logoPath?: string; members: string[] }> = {
  P5:         { label: 'P5',          acronym: 'UNSC', logoPath: '/logos/un.svg',            members: ['China', 'France', 'Russia', 'United Kingdom', 'United States'] },
  G7:         { label: 'G7',          acronym: 'G7',   logoPath: '/logos/g7.png',            members: ['Canada', 'France', 'Germany', 'Italy', 'Japan', 'United Kingdom', 'United States'] },
  BRICS:      { label: 'BRICS+',      acronym: 'BRICS', logoPath: '/logos/brics.png',        members: ['Brazil', 'Russia', 'India', 'China', 'South Africa', 'Egypt', 'Ethiopia', 'Iran', 'Saudi Arabia', 'United Arab Emirates'] },
  G20:        { label: 'G20',         acronym: 'G20',  logoPath: '/logos/g20.svg',           members: ['Argentina', 'Australia', 'Brazil', 'Canada', 'China', 'France', 'Germany', 'India', 'Indonesia', 'Italy', 'Japan', 'Mexico', 'South Korea', 'Russia', 'Saudi Arabia', 'South Africa', 'Türkiye', 'United Kingdom', 'United States'] },
  EU:         { label: 'EU',          acronym: 'EU',   logoPath: '/logos/eu.png',            members: ['Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden'] },
  NATO:       { label: 'NATO',        acronym: 'NATO', logoPath: '/logos/nato.png',          members: ['Albania', 'Belgium', 'Bulgaria', 'Canada', 'Croatia', 'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Iceland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Montenegro', 'Netherlands', 'North Macedonia', 'Norway', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Türkiye', 'United Kingdom', 'United States'] },
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
  return findCountryFlexible(raw);
}

function CommitteeNameInput({ value, onChange, onPresetSelect }: {
  value: string;
  onChange: (v: string) => void;
  onPresetSelect: (preset: typeof COMMITTEE_PRESETS[0]) => void;
}) {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // If the stored value is an exact preset EN name, display the translated version
  const isPreset = COMMITTEE_PRESETS.some((p) => p.name === value);
  const displayValue = isPreset ? getPresetDisplayName(value, language) : value;

  const matches = value.trim()
    ? COMMITTEE_PRESETS.filter((p) => {
        const v = value.toLowerCase();
        const localName = getPresetDisplayName(p.name, language).toLowerCase();
        const localAcronym = getPresetAcronym(p.name, language).toLowerCase();
        return (
          p.name.toLowerCase().includes(v) ||
          p.acronym.toLowerCase().includes(v) ||
          localName.includes(v) ||
          (localAcronym && localAcronym.includes(v))
        );
      })
    : [];
  const topMatch = matches[0] ?? null;

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={displayValue}
        onChange={(e) => {
          // If user edits the translated preset name, treat it as a custom entry
          // (revert to raw typing — clear the preset selection)
          const typed = e.target.value;
          const matchedPreset = COMMITTEE_PRESETS.find(
            (p) => getPresetDisplayName(p.name, language) === typed
          );
          onChange(matchedPreset ? matchedPreset.name : typed);
          setOpen(true);
        }}
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
        placeholder={language === 'ar' ? 'مثال: مجلس حقوق الإنسان' : language === 'fr' ? 'ex. Conseil des droits de l\'homme ou CDH' : language === 'es' ? 'ej. Consejo de Seguridad o CSNU' : 'e.g. Human Rights Council or HRC'}
        className="w-full bg-white/70 border border-[#C8BAA8] rounded-xl px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none focus:border-[#1B3828] focus:ring-2 focus:ring-[#1B3828]/10 transition-all text-sm"
      />
      {open && matches.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-30" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', boxShadow: '0 8px 32px rgba(27,56,40,0.14), 0 2px 8px rgba(27,56,40,0.08)' }}>
          {matches.slice(0, 6).map((p, i) => (
            <button
              key={p.name}
              onMouseDown={(e) => { e.preventDefault(); onPresetSelect(p); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-start transition-colors border-b border-[#DDD4C0]/50 last:border-0 ${
                i === 0 ? 'text-[#1C1410]' : 'text-[#1C1410] hover:bg-[#EDE7D8]'
              }`}
              style={i === 0 ? { backgroundColor: 'rgba(27,56,40,0.07)' } : {}}
            >
              {(p as { logoPath?: string }).logoPath ? (
                <img src={(p as { logoPath?: string }).logoPath} alt={p.acronym} width={18} height={18} className="rounded-sm shrink-0 object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div className="w-[22px] h-[22px] rounded-md shrink-0" style={{ backgroundColor: 'rgba(27,56,40,0.08)' }} />
              )}
              <span className="text-sm flex-1">{getPresetDisplayName(p.name, language)}</span>
              <span className="text-[10px] font-bold shrink-0" style={{ fontFamily: "'DM Mono', monospace", color: '#1B3828' }}>{(language === 'es' || language === 'fr') ? (getPresetAcronym(p.name, language) || p.acronym) : p.acronym}</span>
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
  const t = useT();
  const { language } = useLanguage();
  const [hovered, setHovered] = React.useState<string | null>(null);

  React.useEffect(() => {
    setHovered('mun');
  }, []);

  const cards = [
    {
      id: 'debate',
      video: '/card_debate.mp4',
      title: language === 'ar' ? <>نقاش<br />عادي</> : language === 'fr' ? <>Débat<br />Ordinaire</> : language === 'es' ? <>Debate<br />Regular</> : <>Regular<br />Debate</>,
      subtitle: t('create_debate_subtitle'),
      badge: t('create_coming_soon'),
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
      title: language === 'ar' ? <>محاكاة<br />الأمم المتحدة</> : language === 'fr' ? <>Modèle des<br />Nations Unies</> : language === 'es' ? <>Modelo de<br />Naciones Unidas</> : <>Model United<br />Nations</>,
      subtitle: t('create_mun_subtitle'),
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
      title: language === 'ar' ? <>لجنة<br />الأزمات</> : language === 'fr' ? <>Comité de<br />Crise</> : language === 'es' ? <>Comité de<br />Crisis</> : <>Crisis<br />Committee</>,
      subtitle: t('create_crisis_subtitle'),
      badge: t('create_coming_h2'),
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
    <div className="flex-1 flex flex-col items-center justify-center px-4 md:px-8 relative z-10 overflow-hidden">

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
        style={{ fontSize: 'clamp(30px, 7vw, 48px)', lineHeight: 1.05, color: '#1B3828' }}
      >
        {t('create_select_type')}
      </h1>

      {/* Subtitle */}
      <p
        className="text-center mb-8 md:mb-12 relative px-4"
        style={{ fontSize: '16px', color: '#6A5A4A', maxWidth: '560px', lineHeight: 1.65 }}
      >
        {t('create_choose_format')}
      </p>

      {/* Cards row — horizontal scroll-snap on mobile so all three stay reachable
          within the fixed cockpit width; centered, no-scroll from md up. */}
      <div className="flex flex-row items-end md:justify-center gap-5 relative w-full overflow-x-auto md:overflow-visible px-6 md:px-0 snap-x snap-mandatory" style={{ maxWidth: '900px', height: '460px' }}>
        {cards.map((card) => {
          const active = isHovered(card.id);
          const isMun = card.id === 'mun';
          return (
            <div
              key={card.id}
              onMouseEnter={() => setHovered(card.id)}
              onMouseLeave={() => setHovered('mun')}
              className="relative flex flex-col items-center rounded-2xl overflow-hidden flex-shrink-0 snap-center"
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
                      {t('create_start')}
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
  const t = useT();
  const { language, setLanguage } = useLanguage();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const router = useRouter();
  const { updateSetting } = useSettingsStore();
  const [chairNames, setChairNames] = useState<string[]>(['']);
  const [committeeMode, setCommitteeMode] = useState<'select' | 'build'>('select');
  const [committeeName, setCommitteeName] = useState('');
  const [topic, setTopic] = useState('');
  const [delegates, setDelegates] = useState<string[]>([]);
  const [observers, setObservers] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState('');
  const [pasteReview, setPasteReview] = useState<{ name: string; isCountry: boolean }[] | null>(null);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [creating, setCreating] = useState(false);
  const [isUNSC, setIsUNSC] = useState(false);

  const handleCreate = async () => {
    const names = chairNames.map((n) => n.trim()).filter(Boolean);
    if (!committeeName.trim() || !topic.trim()) return;
    setCreating(true);
    try {
      const result = await createCommitteeInDB(committeeName.trim(), topic.trim(), names.length > 0 ? names : ['Chair'], delegates, Array.from(observers));
      if (result) {
        updateSetting(result.code, 'chairJoinSuffix', result.chairJoinSuffix);
        const creatorName = names.length > 0 ? names[0] : 'Chair';
        router.push(`/chair/${result.code}?chairName=${encodeURIComponent(creatorName)}`);
      } else {
        alert('Failed to create committee. Please try again.');
        setCreating(false);
      }
    } catch (err) {
      console.error('Create committee error:', err);
      alert('Something went wrong. Please try again.');
      setCreating(false);
    }
  };

  const canProceed = committeeName.trim() && topic.trim();

  const available = UN_COUNTRIES.filter(
    (c) => !delegates.includes(c.name) && matchesSearch(c, search, language)
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
    const tokens = pasteText.split(/\r?\n|[,;\t]|\s{2,}|[·•]|\.(?=\s|$)/).map((s) => s.trim()).filter(Boolean);
    const seen = new Set(delegates.map((d) => d.toLowerCase()));
    const review: { name: string; isCountry: boolean }[] = [];
    for (const tok of tokens) {
      const found = fuzzyMatchCountry(tok);
      const name = found ?? tok;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      review.push({ name, isCountry: !!found });
    }
    if (review.length === 0) {
      setPasteError(language === 'ar' ? 'لا جديد لإضافته' : language === 'fr' ? 'Rien de nouveau à ajouter' : language === 'es' ? 'Nada nuevo que agregar' : 'Nothing new to add');
      return;
    }
    setPasteError('');
    setPasteReview(review);
  };

  const updateReviewName = (idx: number, value: string) =>
    setPasteReview((prev) => prev ? prev.map((r, i) => i === idx ? { name: value, isCountry: !!getCountryByName(value.trim()) } : r) : prev);

  const removeReviewIdx = (idx: number) =>
    setPasteReview((prev) => prev ? prev.filter((_, i) => i !== idx) : prev);

  const commitPasteReview = () => {
    if (!pasteReview) return;
    const names = pasteReview.map((r) => r.name.trim()).filter(Boolean);
    setDelegates((prev) => {
      const seen = new Set(prev.map((d) => d.toLowerCase()));
      const add: string[] = [];
      for (const n of names) { const k = n.toLowerCase(); if (!seen.has(k)) { seen.add(k); add.push(n); } }
      return [...prev, ...add];
    });
    setPasteReview(null);
    setPasteText('');
  };

  const handleCommitteePreset = (preset: typeof COMMITTEE_PRESETS[0]) => {
    setCommitteeName(preset.name);
    if (preset.members !== null) setDelegates(preset.members);
    setIsUNSC(preset.acronym === 'UNSC');
  };

  return (
    <FitToScreen>
    <div className="h-full w-full flex flex-col overflow-hidden relative" style={{ backgroundColor: '#EDE7D8' }}>
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
        <Link href="/sessions">
          <img src="/GavellingLogo.png" alt="Gavelling" className="h-10 w-auto object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </Link>
        {/* Language toggle — globe dropdown matching SiteNav */}
        <div className="relative ms-auto">
          <button
            onClick={() => setShowLangMenu((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-colors focus:outline-none"
            style={{ backgroundColor: showLangMenu ? 'rgba(27,56,40,0.08)' : 'transparent', color: '#1B3828' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.08)'; }}
            onMouseLeave={(e) => { if (!showLangMenu) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <Globe size={14} strokeWidth={2} style={{ color: '#1B3828' }} />
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', fontWeight: 700, color: '#6A5A4A' }}>{language.toUpperCase()}</span>
          </button>
          {showLangMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowLangMenu(false)} />
              <div className="absolute right-0 top-full mt-2 z-50 rounded-xl overflow-hidden shadow-xl" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', minWidth: '140px' }}>
                {([['en', t('settings_english')], ['es', t('settings_spanish')], ['fr', t('settings_french')], ['ar', 'العربية']] as [string, string][]).map(([code, label], i) => (
                  <React.Fragment key={code}>
                    {i > 0 && <div style={{ height: '1px', backgroundColor: '#DDD4C0' }} />}
                    <button
                      onClick={() => { setLanguage(code as 'en' | 'es' | 'fr' | 'ar'); setShowLangMenu(false); }}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-start transition-colors focus:outline-none"
                      style={{ color: language === code ? '#1B3828' : '#6A5A4A', fontWeight: language === code ? 800 : 600, fontSize: '13px', backgroundColor: language === code ? 'rgba(27,56,40,0.07)' : 'transparent' }}
                      onMouseEnter={(e) => { if (language !== code) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                      onMouseLeave={(e) => { if (language !== code) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                    >
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: '#9A8A78' }}>{code.toUpperCase()}</span>
                      <span>{label}</span>
                      {language === code && <span className="ms-auto" style={{ color: '#B6871F' }}>✓</span>}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            </>
          )}
        </div>
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
                className="absolute start-0 flex items-center gap-2 px-3 py-2 rounded-xl bg-[#EDE7D8] border border-[#DDD4C0] hover:bg-[#DDD4C0] text-[#6A5A4A] hover:text-[#1C1410] text-xs font-bold uppercase tracking-wide transition-all"
              >
                <ChevronLeft size={14} className="rtl:rotate-180" /> {t('create_back')}
              </button>
              <h1 className="text-4xl font-black uppercase tracking-wide mb-2" style={{ color: '#1B3828', letterSpacing: '0.06em' }}>{t('create_new_committee').toUpperCase()}</h1>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-3 shrink-0 mt-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: '#1B3828' }}>{t('create_committee_name')}</label>
                <CommitteeNameInput value={committeeName} onChange={(v) => { setCommitteeName(v); setIsUNSC(false); }} onPresetSelect={handleCommitteePreset} />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: '#1B3828' }}>
                  {t('create_chair_name')} <span className="font-normal" style={{ color: '#9A8A78' }}>{t('create_optional')}</span>
                </label>
                <input type="text" value={chairNames[0]} onChange={(e) => setChairNames([e.target.value])}
                  placeholder={language === 'ar' ? 'اسمك' : language === 'fr' ? 'Votre nom' : language === 'es' ? 'Tu nombre' : 'Your name'}
                  className="w-full bg-white/70 border border-[#C8BAA8] rounded-xl px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none focus:border-[#1B3828] focus:ring-2 focus:ring-[#1B3828]/10 transition-all text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: '#1B3828' }}>{t('create_topic')}</label>
                <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)}
                  placeholder={language === 'ar' ? 'مثال: الحق في التعليم' : language === 'fr' ? "ex. Le droit à l'éducation" : language === 'es' ? 'ej. El derecho a la educación' : 'e.g. The right to education'}
                  className="w-full bg-white/70 border border-[#C8BAA8] rounded-xl px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none focus:border-[#1B3828] focus:ring-2 focus:ring-[#1B3828]/10 transition-all text-sm" />
              </div>
            </div>

            {isUNSC && (
              <div className="mb-3 px-4 py-3 rounded-xl text-xs shrink-0 flex items-center gap-3" style={{ backgroundColor: '#1B3828', border: '1px solid #3D7A52', color: 'rgba(238,217,138,0.85)' }}>
                <span className="font-black shrink-0 px-2 py-0.5 rounded-md text-[10px]" style={{ fontFamily: "'DM Mono', monospace", backgroundColor: 'rgba(238,217,138,0.15)', color: '#EED98A', border: '1px solid rgba(238,217,138,0.25)' }}>UNSC</span>
                <span>
                  {language === 'ar'
                    ? <><strong style={{ color: '#EED98A' }}>حق النقض مُفعَّل:</strong> ستتمتع دول الخمس الكبار (الصين، فرنسا، روسيا، المملكة المتحدة، الولايات المتحدة) بحق النقض في التصويت. خصّص ذلك من <strong style={{ color: '#EED98A' }}>الإعدادات</strong> بعد بدء الجلسة.</>
                    : language === 'fr'
                    ? <><strong style={{ color: '#EED98A' }}>Droit de veto activé :</strong> les nations du P5 (Chine, France, Russie, RU, États-Unis) auront un droit de veto. Personnalisez dans <strong style={{ color: '#EED98A' }}>Paramètres</strong> après le début de la session.</>
                    : language === 'es'
                    ? <><strong style={{ color: '#EED98A' }}>Poder de Veto activado:</strong> Grupo P5 (China, Francia, Rusia, RU, EE.UU.) tendrán veto. Personaliza en <strong style={{ color: '#EED98A' }}>Configuraciones</strong> al iniciar la sesión.</>
                    : <><strong style={{ color: '#EED98A' }}>Veto power active:</strong> P5 nations (China, France, Russia, UK, USA) will have veto voting. Customize in <strong style={{ color: '#EED98A' }}>Settings</strong> after session starts.</>
                  }
                </span>
              </div>
            )}

            <div className="flex-1 grid grid-cols-2 gap-6 min-h-0">
              <div className="flex flex-col min-h-0">
                {/* Search & Add — label row matches right column label row exactly */}
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <label className="text-xs font-bold uppercase tracking-wide" style={{ color: '#1B3828' }}>{t('create_search_add')}</label>
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
                        placeholder={t('create_search_placeholder')}
                        className="flex-1 bg-transparent px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none text-sm" />
                      {search && (available[0] || search.trim()) && (
                        <span className="text-xs text-[#9A8A78] px-3 shrink-0">↵ {available[0]?.name ?? search.trim()}</span>
                      )}
                    </div>
                    {search && (available.length > 0 || search.trim()) && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-[#FAF8F3] border-2 border-[#C8BAA8] rounded-xl overflow-hidden z-20 shadow-xl">
                        {available.slice(0, 5).map((c, i) => (
                          <button key={c.code} onMouseDown={(e) => { e.preventDefault(); addDelegate(c.name); setSearch(''); }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-start transition-colors ${i === 0 ? 'bg-[#1B3828]/20 text-[#1C1410]' : 'text-[#1C1410] hover:bg-[#DDD4C0]'}`}>
                            <img src={getFlagUrl(c.code)} alt={c.code} className="w-6 h-6 object-contain inline-block" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                            <span className="text-sm flex-1">{getCountryDisplayName(c.name, language)}</span>
                            {i === 0 && <span className="ms-auto text-xs text-[#9A8A78]">Enter ↵</span>}
                          </button>
                        ))}
                        {search.trim() && !delegates.includes(search.trim()) && !available.some((c) => c.name.toLowerCase() === search.trim().toLowerCase()) && (
                          <button onMouseDown={(e) => { e.preventDefault(); addDelegate(search.trim()); setSearch(''); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-start transition-colors text-[#1C1410] hover:bg-[#DDD4C0] border-t border-[#DDD4C0]">
                            <Globe size={18} strokeWidth={1.5} className="text-[#9A8A78] shrink-0" />
                            <span className="text-sm flex-1">{search.trim()}</span>
                            <span className="text-[10px] text-[#1B3828] shrink-0 font-semibold">{t('create_custom_add')}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Bundles */}
                <div className="shrink-0 mb-3">
                  <label className="block text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#1B3828' }}>{t('create_quick_bundles')}</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(BUNDLES).map(([key, bundle]) => (
                      <button key={key} onClick={() => addBundle(key)}
                        className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all gv-lift"
                        style={{ backgroundColor: '#FAF8F3', color: '#1B3828', border: '1px solid #DDD4C0' }}
                        onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = '#1B3828'; el.style.color = '#EED98A'; el.style.borderColor = '#1B3828'; }}
                        onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = '#FAF8F3'; el.style.color = '#1B3828'; el.style.borderColor = '#DDD4C0'; }}>
                        {bundle.logoPath ? (
                          <img src={bundle.logoPath} alt={bundle.label} width={16} height={16} className="rounded-sm shrink-0 object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                        ) : null}
                        <span>{bundle.label}</span>
                        <span className="font-mono text-[10px] ms-1 group-hover:opacity-60" style={{ color: '#9A8A78' }}>+{bundle.members.length}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Paste Country List — flex-1 to fill remaining space, matching delegates box */}
                <div className="flex-1 flex flex-col min-h-0">
                  <label className="block text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#1B3828' }}>{t('create_paste_list')}</label>
                  <textarea value={pasteText} onChange={(e) => { setPasteText(e.target.value); setPasteError(''); }}
                    placeholder={t('create_paste_placeholder')}
                    className="flex-1 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none focus:border-[#1B3828] focus:ring-2 focus:ring-[#1B3828]/10 transition-all text-sm resize-none min-h-0" />
                </div>

                {/* Auto-match button — same row as Start Session, outside the box */}
                <div className="flex items-center gap-3 mt-3 shrink-0" style={{ height: '56px' }}>
                  <button onClick={handlePaste} disabled={!pasteText.trim()}
                    className="px-6 py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{ backgroundColor: '#1B3828', color: '#EED98A' }}
                    onMouseEnter={(e) => { if (!pasteText.trim()) return; (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(238,217,138,0.2)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}>
                    {t('create_auto_match')}
                  </button>
                  {pasteError && <p className="text-xs" style={{ color: '#B6871F' }}>{pasteError}</p>}
                </div>
              </div>

              <div className="flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold uppercase tracking-wide" style={{ color: '#1B3828' }}>{t('create_selected_delegates')}</label>
                    <span className="text-[10px] font-bold text-[#1B3828] bg-[#EED98A]/30 px-2 py-0.5 rounded-full" style={{ fontFamily: "'DM Mono', monospace" }}>{delegates.length}</span>
                  </div>
                  {delegates.length > 0 && (
                    <button onClick={() => setDelegates([])} className="text-[10px] font-bold text-[#9A8A78] hover:text-[#8B2020] uppercase tracking-wide transition-colors">{t('create_clear_all')}</button>
                  )}
                </div>

                <div className="flex-1 bg-[#FAF8F3] border border-[#DDD4C0] rounded-xl overflow-hidden mb-3 min-h-0">
                  {delegates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2 px-8">
                      <p className="text-base font-black uppercase tracking-wide text-center" style={{ color: '#1B3828', fontFamily: "'DM Mono', monospace" }}>{t('create_no_delegates').toUpperCase()}</p>
                      <p className="text-xs text-center leading-relaxed" style={{ color: '#9A8A78', maxWidth: '200px' }}>{t('create_no_delegates_hint')}</p>
                    </div>
                  ) : (
                    <div className="overflow-y-auto h-full">
                      {[...delegates].sort((a, b) => compareCountryNames(a, b, language)).map((name) => {
                        const found = getCountryByName(name);
                        const isCustom = !found;
                        const isEditing = editingName === name;
                        const commitRename = (raw: string) => {
                          const trimmed = raw.trim();
                          if (!trimmed) {
                            setDelegates((p) => p.filter((d) => d !== name));
                            setObservers((prev) => { const n = new Set(prev); n.delete(name); return n; });
                          } else if (trimmed !== name && !delegates.some((d) => d !== name && d === trimmed)) {
                            setDelegates((p) => p.map((d) => d === name ? trimmed : d));
                            setObservers((prev) => { if (!prev.has(name)) return prev; const n = new Set(prev); n.delete(name); n.add(trimmed); return n; });
                          }
                          setEditingName(null);
                        };
                        return (
                          <div key={name} className="flex items-center gap-3 px-4 py-2.5 border-b border-[#DDD4C0]/50 last:border-0 transition-colors group" onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.06)'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = ''; }}>
                            {found
                              ? <img src={getFlagUrl(found.code)} alt={found.code} className="w-5 h-5 object-contain inline-block" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                              : <Globe size={16} strokeWidth={1.5} className="text-[#9A8A78] shrink-0" />
                            }
                            {isEditing ? (
                              <input
                                autoFocus
                                className="text-sm flex-1 bg-transparent border-b border-[#1B3828] outline-none font-medium"
                                style={{ color: '#1C1410' }}
                                value={editDraft}
                                onChange={(e) => setEditDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') { commitRename(editDraft); }
                                  else if (e.key === 'Escape') { setEditingName(null); }
                                }}
                                onBlur={() => commitRename(editDraft)}
                              />
                            ) : (
                              <span className="text-sm flex-1 truncate font-medium" style={{ color: '#1C1410' }}>{getCountryDisplayName(name, language)}</span>
                            )}
                            {!isEditing && observers.has(name) && (
                              <span className="text-[9px] shrink-0 font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md" style={{ backgroundColor: 'rgba(182,135,31,0.15)', color: '#B6871F', border: '1px solid rgba(182,135,31,0.35)' }}>{t('rollcall_observer')}</span>
                            )}
                            {!isEditing && (
                              <button onClick={() => setObservers((prev) => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; })}
                                title={t('create_observer_toggle')} aria-pressed={observers.has(name)}
                                className="shrink-0 transition-transform active:scale-90"
                                style={{ color: observers.has(name) ? '#B6871F' : '#9A8A78' }}>
                                <Megaphone size={15} strokeWidth={1.75} />
                              </button>
                            )}
                            {!isEditing && isCustom && (
                              <button onClick={() => { setEditingName(name); setEditDraft(name); }}
                                className="text-[#9A8A78] hover:text-[#1B3828] transition-colors opacity-0 group-hover:opacity-100 me-1">
                                <PenLine size={13} strokeWidth={2} />
                              </button>
                            )}
                            {!isEditing && (
                              <button onClick={() => { setDelegates((p) => p.filter((d) => d !== name)); setObservers((prev) => { const n = new Set(prev); n.delete(name); return n; }); }}
                                className="text-[#9A8A78] group-hover:text-red-500 transition-colors text-sm opacity-0 group-hover:opacity-100">✕</button>
                            )}
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
                    if (!canProceed || creating) return;
                    (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828';
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(27,56,40,0.25)';
                  }}
                >
                  {creating ? t('create_creating') : canProceed ? t('create_start_session') : t('create_enter_details')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Paste review modal — inside FitToScreen so it scales with the page */}
    {pasteReview && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(5,4,3,0.5)', backdropFilter: 'blur(4px)' }}
        onMouseDown={(e) => { if (e.target === e.currentTarget) setPasteReview(null); }}>
        <div className="w-full max-w-md flex flex-col rounded-2xl shadow-2xl overflow-hidden"
          style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', maxHeight: '78%' }}>
          {/* Header */}
          <div className="px-6 py-4 shrink-0" style={{ borderBottom: '1px solid #DDD4C0' }}>
            <h2 className="text-lg font-black uppercase tracking-wide" style={{ color: '#1B3828', letterSpacing: '0.04em' }}>{t('create_review_title')}</h2>
            <p className="text-xs mt-0.5" style={{ color: '#9A8A78' }}>{t('create_review_subtitle').replace('{n}', String(pasteReview.length))}</p>
          </div>
          {/* List */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {pasteReview.map((r, idx) => {
              const found = getCountryByName(r.name);
              return (
                <div key={idx} className="flex items-center gap-3 px-5 py-2.5 border-b border-[#DDD4C0]/50 last:border-0">
                  {found
                    ? <img src={getFlagUrl(found.code)} alt={found.code} width={20} height={20} className="w-5 h-5 object-contain shrink-0" onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
                    : <Globe size={16} strokeWidth={1.5} className="text-[#9A8A78] shrink-0" />}
                  {found ? (
                    <span className="text-sm flex-1 truncate font-medium" style={{ color: '#1C1410' }}>{getCountryDisplayName(r.name, language)}</span>
                  ) : (
                    <input value={r.name} onChange={(e) => updateReviewName(idx, e.target.value)}
                      className="text-sm flex-1 bg-white border border-[#C8BAA8] rounded-lg px-2.5 py-1.5 text-[#1C1410] focus:outline-none focus:border-[#1B3828] focus:ring-2 focus:ring-[#1B3828]/10" />
                  )}
                  <span className="text-[10px] font-bold uppercase tracking-wide shrink-0 px-2 py-0.5 rounded-full"
                    style={found ? { color: '#1B3828', backgroundColor: 'rgba(27,56,40,0.1)' } : { color: '#B6871F', backgroundColor: 'rgba(182,135,31,0.12)' }}>
                    {found ? t('create_review_country_tag') : t('create_review_custom_tag')}
                  </span>
                  <button onClick={() => removeReviewIdx(idx)} className="text-[#9A8A78] hover:text-red-500 transition-colors text-sm shrink-0">✕</button>
                </div>
              );
            })}
          </div>
          {/* Footer */}
          <div className="flex items-center gap-3 px-6 py-4 shrink-0" style={{ borderTop: '1px solid #DDD4C0' }}>
            <button onClick={() => setPasteReview(null)}
              className="px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wide transition-colors gv-lift"
              style={{ color: '#6A5A4A', backgroundColor: '#EDE7D8', border: '1px solid #DDD4C0' }}>
              {t('create_review_cancel')}
            </button>
            <button onClick={commitPasteReview} disabled={pasteReview.length === 0}
              className="flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all disabled:opacity-30 gv-lift"
              style={{ backgroundColor: '#1B3828', color: '#EED98A' }}
              onMouseEnter={(e) => { if (pasteReview.length) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}>
              {t('create_review_proceed')}
            </button>
          </div>
        </div>
      </div>
    )}
    </FitToScreen>
  );
}

export default function CreatePage() {
  return (
    <Suspense fallback={<div className="h-screen bg-[#EDE7D8] flex items-center justify-center"><Loader size={72} label="Loading" /></div>}>
      <CreatePageInner />
    </Suspense>
  );
}
