'use client';

import React, { useState, useRef, Suspense } from 'react';
import FitToScreen from '@/components/FitToScreen';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createCommittee as createCommitteeInDB } from '@/lib/committeeService';
import { useSettingsStore } from '@/lib/settingsStore';
import { UN_COUNTRIES, getCountryByName, getCountryDisplayName, countryMatchRank, findCountryFlexible, compareCountryNames } from '@/lib/countries';
import { UNSC_MEMBERS, WHO_MEMBERS, IMF_MEMBERS, WORLD_BANK_MEMBERS, UNEP_MEMBERS, ICC_ROLES, ICJ_ROLES, CRISIS_MEMBERS, FIFA_MEMBERS, HOUSE_OF_COMMONS_ROLES, US_SENATE_MEMBERS, PRESS_ROLES, EUROPEAN_PARLIAMENT_MEMBERS } from '@/lib/presets';
import { ArrowRight, Check, ChevronDown, ChevronLeft, ClipboardList, CornerDownLeft, Gavel, Globe, Loader2, Megaphone, PenLine, Plus, Search, UserRound, Wand2, X } from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import Loader from '@/components/Loader';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { getCommitteeDisplayName } from '@/lib/presetNames';
import { Chip, Eyebrow, FieldLabel, GhostAction, PageBackdrop, PrimaryAction } from '../join/joinUi';
import { C, GroupLabel, INPUT_CLS, OUTFIT, RowIconButton, SHADOW, StepCard } from './createUi';

/** Older button strings end in an arrow glyph; the build screen draws an icon instead. */
const stripArrow = (s: string) => s.replace(/\s*[→←]\s*$/, '');

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

// The acronym table that used to live here ("uk", "drc", "dprk"…) moved into
// COUNTRY_NAME_ALIASES in countries.ts, where findCountryFlexible consults it
// alongside the retired spellings — one table, understood by every search box
// and every paste importer at once.
function fuzzyMatchCountry(raw: string): string | null {
  return findCountryFlexible(raw);
}

function CommitteeNameInput({ id, value, onChange, onPresetSelect }: {
  id?: string;
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
        id={id}
        type="text"
        autoComplete="off"
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
        className={INPUT_CLS}
      />
      {open && matches.length > 0 && (
        <div className="absolute top-full inset-x-0 mt-2 rounded-2xl overflow-hidden z-40 p-1" style={{ backgroundColor: '#FAF8F3', boxShadow: '0 12px 32px rgba(27,56,40,0.18), 0 2px 8px rgba(27,56,40,0.08), inset 0 0 0 1px rgba(27,56,40,0.10)' }}>
          {matches.slice(0, 6).map((p, i) => (
            <button
              key={p.name}
              onMouseDown={(e) => { e.preventDefault(); onPresetSelect(p); setOpen(false); }}
              type="button"
              className={`w-full flex items-center gap-3 px-3 h-11 rounded-xl text-start transition-colors text-[#1C1410] focus:outline-none ${
                i === 0 ? '' : 'hover:bg-[#1B3828]/[0.05]'
              }`}
              style={i === 0 ? { backgroundColor: 'rgba(27,56,40,0.07)' } : {}}
            >
              {(p as { logoPath?: string }).logoPath ? (
                <img src={(p as { logoPath?: string }).logoPath} alt="" width={22} height={22} className="shrink-0 object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div className="w-[22px] h-[22px] rounded-md shrink-0" style={{ backgroundColor: 'rgba(27,56,40,0.08)' }} />
              )}
              <span className="text-[15px] font-semibold flex-1 truncate">{getPresetDisplayName(p.name, language)}</span>
              <span className="text-[11px] font-extrabold tracking-[0.04em] shrink-0" style={{ color: '#1B3828' }}>{(language === 'es' || language === 'fr') ? (getPresetAcronym(p.name, language) || p.acronym) : p.acronym}</span>
              {i === 0 && <CornerDownLeft size={14} strokeWidth={2.2} className="shrink-0 rtl:-scale-x-100" style={{ color: '#8A7C6B' }} />}
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
  const [pasteOpen, setPasteOpen] = useState(false);

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

  // Ranked, accent-folded, alias-aware (see THE FOLDING RULE in countries.ts):
  // typing "Tu" now surfaces Türkiye, and "Turkey" or "UK" find their country
  // under its current name. Exact/alias/prefix hits sort above substring ones.
  const available = search.trim()
    ? UN_COUNTRIES
        .filter((c) => !delegates.includes(c.name))
        .map((c) => ({ c, rank: countryMatchRank(c.name, search, language) }))
        .filter((x): x is { c: (typeof UN_COUNTRIES)[number]; rank: number } => x.rank !== null)
        .sort((a, b) => a.rank - b.rank || compareCountryNames(a.c.name, b.c.name, language))
        .map((x) => x.c)
    : UN_COUNTRIES.filter((c) => !delegates.includes(c.name));

  const addDelegate = (name: string) => {
    if (!delegates.includes(name)) setDelegates((p) => [...p, name]);
  };

  // The one add path: the + button, the Enter key and the typeahead's first row all
  // land here, so the field can never do something the button does not.
  // An empty field adds nothing: `available` is then every remaining country, and the + button
  // used to add whichever sorted first.
  const typedIsAddable = !!search.trim() && !!(available[0] || !delegates.includes(search.trim()));
  const addTyped = () => {
    if (!search.trim()) return;
    if (available[0]) { addDelegate(available[0].name); setSearch(''); return; }
    const raw = search.trim();
    if (raw && !delegates.includes(raw)) { addDelegate(raw); setSearch(''); }
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
  };

  const grainStyle = {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'repeat',
    backgroundSize: '300px 300px',
    mixBlendMode: 'multiply',
    opacity: 0.18,
  } as const;

  // Language toggle: globe dropdown matching SiteNav. Shared by both screens.
  const langMenu = (
    <div className="relative ms-auto">
      <button
        type="button"
        onClick={() => setShowLangMenu((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={showLangMenu}
        className="flex h-10 items-center gap-1.5 px-3 rounded-xl transition-[background-color,transform] duration-150 active:scale-[0.96] hover:bg-[#1B3828]/[0.08] focus:outline-none"
        style={{ backgroundColor: showLangMenu ? 'rgba(27,56,40,0.08)' : undefined, color: C.forest }}
      >
        <Globe size={15} strokeWidth={2} />
        <span style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', color: C.inkSoft }}>{language.toUpperCase()}</span>
      </button>
      {showLangMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowLangMenu(false)} />
          <div role="menu" className="absolute end-0 top-full mt-2 z-50 rounded-2xl overflow-hidden p-1" style={{ backgroundColor: C.surface, boxShadow: `${SHADOW.card}, inset 0 0 0 1px rgba(27,56,40,0.08)`, minWidth: '160px' }}>
            {([['en', t('settings_english')], ['es', t('settings_spanish')], ['fr', t('settings_french')], ['ar', 'العربية']] as [string, string][]).map(([code, label]) => (
              <button
                key={code}
                type="button"
                role="menuitemradio"
                aria-checked={language === code}
                onClick={() => { setLanguage(code as 'en' | 'es' | 'fr' | 'ar'); setShowLangMenu(false); }}
                className="w-full flex items-center gap-2.5 h-10 px-3 rounded-xl text-start transition-colors hover:bg-[#1B3828]/[0.05] focus:outline-none"
                style={{ fontFamily: OUTFIT, color: language === code ? C.forest : C.inkSoft, fontWeight: language === code ? 800 : 600, fontSize: '13px', backgroundColor: language === code ? 'rgba(27,56,40,0.07)' : undefined }}
              >
                <span style={{ fontSize: '11px', fontWeight: 700, color: C.muted, width: 20 }}>{code.toUpperCase()}</span>
                <span>{label}</span>
                {language === code && <Check size={14} strokeWidth={2.6} className="ms-auto" style={{ color: C.goldDeep }} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );

  if (committeeMode === 'select') {
    return (
      <FitToScreen>
      <div className="h-full w-full flex flex-col overflow-hidden relative" style={{ backgroundColor: '#EDE7D8' }}>
        {/* Grain texture: matches landing page */}
        <div className="pointer-events-none fixed inset-0 z-[1]" style={grainStyle} />
        <nav className="relative z-20 border-b border-[#DDD4C0]/60 px-8 md:px-14 flex items-center shrink-0" style={{ height: '72px', backgroundColor: '#EDE7D8' }}>
          <Link href="/sessions">
            <img src="/GavellingLogo.png" alt="Gavelling" className="h-10 w-auto object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </Link>
          {langMenu}
        </nav>
        <div className="flex-1 flex overflow-hidden">
          <SelectScreen onSelect={() => setCommitteeMode('build')} />
        </div>
      </div>
      </FitToScreen>
    );
  }

  // ── Build screen: one column, top to bottom ────────────────────────────────
  // No FitToScreen here (it re-scaled the whole page to the window and made the
  // type shrink as the roster grew). An ordinary scrolling page, like /join.
  const delegateCount = delegates.length;
  const observerCount = delegates.filter((d) => observers.has(d)).length;
  const presetLogo = COMMITTEE_PRESETS.find((p) => p.name === committeeName)?.logoPath ?? null;
  const summaryName = committeeName.trim() ? getPresetDisplayName(committeeName.trim(), language) : t('create_untitled');
  const countLabel = delegateCount === 1 ? t('create_delegations_count_one') : t('create_delegations_count', { n: delegateCount });
  const observerLabel = observerCount === 1 ? t('create_observers_count_one') : t('create_observers_count', { n: observerCount });
  const ctaLabel = creating ? t('create_creating') : canProceed ? t('create_cta_start') : t('create_cta_needs');
  const removeDelegate = (name: string) => {
    setDelegates((p) => p.filter((d) => d !== name));
    setObservers((prev) => { const n = new Set(prev); n.delete(name); return n; });
  };

  return (
    <div className="relative min-h-screen w-full" style={{ backgroundColor: C.page, WebkitFontSmoothing: 'antialiased', fontFamily: OUTFIT }}>
      <PageBackdrop />

      <nav className="relative z-20 mx-auto flex h-16 w-full max-w-[920px] items-center gap-3 px-4 sm:px-6">
        <Link href="/sessions" className="flex flex-shrink-0 items-center focus:outline-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/GavellingLogo.png" alt="Gavelling" className="h-auto w-[118px] object-contain sm:w-[140px]" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </Link>
        {langMenu}
      </nav>

      <main className="relative z-10 mx-auto w-full max-w-[920px] px-4 pt-1 sm:px-6 sm:pt-3">
        <header className="mb-5 sm:mb-7">
          <GhostAction onClick={() => setCommitteeMode('select')} icon={<ChevronLeft size={16} strokeWidth={2.4} className="rtl:rotate-180" />}>
            {t('create_back')}
          </GhostAction>
          <div className="mt-4">
            <Eyebrow tone="forest">{t('create_mun_title')}</Eyebrow>
            <h1
              className="mt-1.5"
              style={{ fontFamily: OUTFIT, fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.05, color: C.forest, margin: 0, textWrap: 'balance' }}
            >
              {t('create_title')}
            </h1>
          </div>
        </header>

        <div className="flex flex-col gap-4 sm:gap-5">
          {/* ── 1. Committee ─────────────────────────────────────────────── */}
          <StepCard step={1} labelledBy="create-step-committee" title={t('create_step_committee')} hint={t('create_step_committee_hint')}>
            <div className="flex flex-col gap-4">
              <div>
                <FieldLabel htmlFor="create-committee-name">{t('create_committee_name')}</FieldLabel>
                <CommitteeNameInput id="create-committee-name" value={committeeName} onChange={setCommitteeName} onPresetSelect={handleCommitteePreset} />
              </div>
              <div className="grid gap-4 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                <div>
                  <FieldLabel htmlFor="create-topic">{t('create_topic')}</FieldLabel>
                  <input id="create-topic" type="text" value={topic} onChange={(e) => setTopic(e.target.value)}
                    placeholder={language === 'ar' ? 'مثال: الحق في التعليم' : language === 'fr' ? "ex. Le droit à l'éducation" : language === 'es' ? 'ej. El derecho a la educación' : 'e.g. The right to education'}
                    className={INPUT_CLS} />
                </div>
                <div>
                  <FieldLabel htmlFor="create-chair-name">
                    {t('create_chair_name')} <span style={{ fontWeight: 600, color: C.muted, letterSpacing: '0.06em' }}>{t('create_optional')}</span>
                  </FieldLabel>
                  <input id="create-chair-name" type="text" value={chairNames[0]} onChange={(e) => setChairNames([e.target.value])}
                    placeholder={language === 'ar' ? 'اسمك' : language === 'fr' ? 'Votre nom' : language === 'es' ? 'Tu nombre' : 'Your name'}
                    className={INPUT_CLS} />
                </div>
              </div>
            </div>
          </StepCard>

          {/* ── 2. Delegations ───────────────────────────────────────────── */}
          <StepCard
            step={2}
            labelledBy="create-step-delegations"
            title={t('create_step_delegations')}
            hint={t('create_step_delegations_hint')}
            aside={<Chip tone={delegateCount > 0 ? 'gold' : 'muted'} style={{ fontVariantNumeric: 'tabular-nums' }}>{countLabel}</Chip>}
          >
            {/* Add a country: the one add path (+ button, Enter, first typeahead row). */}
            <GroupLabel htmlFor="create-add-country">{t('create_add_country')}</GroupLabel>
            <div className="relative">
              <div className="flex items-center gap-2 rounded-[14px] bg-white/80 ps-3.5 pe-1.5 shadow-[inset_0_0_0_1px_rgba(27,56,40,0.16)] focus-within:shadow-[inset_0_0_0_2px_#1B3828,0_0_0_4px_rgba(27,56,40,0.08)] transition-[box-shadow] duration-150" style={{ height: 50 }}>
                <Search size={17} strokeWidth={2.2} className="shrink-0" style={{ color: C.muted }} />
                <input id="create-add-country" type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                  autoComplete="off"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); addTyped(); }
                    if (e.key === 'Escape') setSearch('');
                  }}
                  placeholder={t('create_add_country_placeholder')}
                  className="flex-1 min-w-0 bg-transparent h-full text-base sm:text-[15px] text-[#1C1410] placeholder-[#8A7C6B] focus:outline-none" />
                <button type="button" onClick={addTyped} disabled={!typedIsAddable} aria-label={t('create_add_btn')}
                  className="shrink-0 flex items-center justify-center gap-1.5 h-[38px] min-w-[38px] px-2.5 sm:px-3.5 rounded-[10px] font-extrabold text-[13px] tracking-[0.02em] transition-[background-color,transform,opacity] duration-150 enabled:active:scale-[0.96] enabled:hover:bg-[#2A5A3C] disabled:opacity-35 disabled:cursor-not-allowed focus:outline-none"
                  style={{ backgroundColor: C.forest, color: C.gold }}>
                  <Plus size={15} strokeWidth={2.8} /> <span className="hidden sm:inline">{t('create_add_btn')}</span>
                </button>
              </div>
              {search && (available.length > 0 || search.trim()) && (
                <div className="absolute top-full inset-x-0 mt-2 rounded-2xl overflow-hidden z-40 p-1"
                  style={{ backgroundColor: C.surface, boxShadow: '0 12px 32px rgba(27,56,40,0.18), 0 2px 8px rgba(27,56,40,0.08), inset 0 0 0 1px rgba(27,56,40,0.10)' }}>
                  {available.slice(0, 5).map((c, i) => (
                    <button key={c.code} type="button" onMouseDown={(e) => { e.preventDefault(); addDelegate(c.name); setSearch(''); }}
                      className={`w-full flex items-center gap-3 px-3 h-11 rounded-xl text-start transition-colors focus:outline-none text-[#1C1410] ${i === 0 ? '' : 'hover:bg-[#1B3828]/[0.05]'}`}
                      style={i === 0 ? { backgroundColor: 'rgba(27,56,40,0.07)' } : {}}>
                      <CircleFlag code={c.code} size={26} decorative />
                      <span className="text-[15px] font-semibold flex-1 truncate">{getCountryDisplayName(c.name, language)}</span>
                      {i === 0 && <CornerDownLeft size={14} strokeWidth={2.2} className="shrink-0 rtl:-scale-x-100" style={{ color: C.muted }} />}
                    </button>
                  ))}
                  {/* "Add as custom" only when the text is not already an exact country: rank 0 covers accents, aliases and the localised name, so typing "turkiye" or "Turquía" no longer offers to add a custom delegation beside the real Türkiye. */}
                  {search.trim() && !delegates.includes(search.trim()) && !available.some((c) => countryMatchRank(c.name, search, language) === 0) && (
                    <button type="button" onMouseDown={(e) => { e.preventDefault(); addDelegate(search.trim()); setSearch(''); }}
                      className="w-full flex items-center gap-3 px-3 h-11 rounded-xl text-start transition-colors text-[#1C1410] hover:bg-[#1B3828]/[0.05] focus:outline-none">
                      <span className="flex items-center justify-center shrink-0 rounded-full" style={{ width: 26, height: 26, backgroundColor: 'rgba(27,56,40,0.08)', color: C.forest }}>
                        <UserRound size={15} strokeWidth={2} />
                      </span>
                      <span className="text-[15px] font-semibold flex-1 truncate">{search.trim()}</span>
                      <span className="text-[12px] shrink-0 font-bold" style={{ color: C.forest }}>{t('create_custom_add')}</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Presets. One row that scrolls sideways on a phone, wraps from sm. */}
            <div className="mt-5">
              <GroupLabel id="create-presets-label">{t('create_quick_bundles')}</GroupLabel>
              <div role="group" aria-labelledby="create-presets-label" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
                {Object.entries(BUNDLES).map(([key, bundle]) => (
                  <button key={key} type="button" onClick={() => addBundle(key)}
                    className="group flex flex-shrink-0 items-center gap-2 h-10 ps-1.5 pe-3 rounded-full text-[13px] font-bold transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.96] focus:outline-none bg-[#1B3828]/[0.055] text-[#1B3828] shadow-[inset_0_0_0_1px_rgba(27,56,40,0.10)] hover:bg-[#1B3828] hover:text-[#EED98A] hover:shadow-[0_4px_14px_rgba(27,56,40,0.22)]">
                    <span className="flex items-center justify-center shrink-0 rounded-full bg-white" style={{ width: 28, height: 28, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)' }}>
                      {bundle.logoPath ? (
                        <img src={bundle.logoPath} alt="" width={18} height={18} className="object-contain" onError={(e) => {
                          // Two bundles (G7, BRICS+) name logos that are not in /public: drop the empty disc.
                          const disc = e.currentTarget.parentElement;
                          const chip = disc?.parentElement;
                          if (disc) disc.style.display = 'none';
                          if (chip) chip.style.paddingInlineStart = '14px';
                        }} />
                      ) : null}
                    </span>
                    <span>{bundle.label}</span>
                    <span className="text-[11.5px] font-semibold tabular-nums text-[#544B3E] group-hover:text-[#EED98A]/70 transition-colors">+{bundle.members.length}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* The roster: full width, FIXED height, scrolls inside. */}
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between gap-3" style={{ minHeight: 32 }}>
                <p className="min-w-0 truncate uppercase" title={t('create_selected_delegates')} style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: C.inkSoft }}>{t('create_selected_delegates')}</p>
                <div className="flex flex-shrink-0 items-center gap-2">
                  {observerCount > 0 && <Chip tone="gold" style={{ fontVariantNumeric: 'tabular-nums' }}>{observerLabel}</Chip>}
                  {delegateCount > 0 && (
                    <button type="button" onClick={() => setDelegates([])}
                      className="h-8 px-2.5 rounded-lg whitespace-nowrap text-[11px] font-extrabold uppercase tracking-[0.1em] transition-[color,background-color,transform] duration-150 active:scale-[0.96] hover:bg-[#8B2020]/[0.07] hover:text-[#8B2020] focus:outline-none"
                      style={{ color: C.inkSoft }}>
                      {t('create_clear_all')}
                    </button>
                  )}
                </div>
              </div>
              <div className="h-[340px] sm:h-[400px] rounded-[18px] overflow-hidden" style={{ backgroundColor: C.surfaceAlt, boxShadow: 'inset 0 1px 2px rgba(27,56,40,0.07), inset 0 0 0 1px rgba(27,56,40,0.08)' }}>
                {delegateCount === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2.5 px-8 text-center">
                    <span className="flex items-center justify-center rounded-full" style={{ width: 52, height: 52, backgroundColor: 'rgba(27,56,40,0.07)', color: C.forest }}>
                      <Globe size={24} strokeWidth={1.75} />
                    </span>
                    <p style={{ fontSize: 16, fontWeight: 800, color: C.forest, textWrap: 'balance' }}>{t('create_no_delegates')}</p>
                    <p style={{ fontSize: 13, color: C.inkSoft, maxWidth: 280, lineHeight: 1.5, textWrap: 'pretty' }}>{t('create_no_delegates_hint')}</p>
                  </div>
                ) : (
                  <ul className="overflow-y-auto h-full p-2 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5 content-start">
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
                      const isObserver = observers.has(name);
                      const display = getCountryDisplayName(name, language);
                      return (
                        <li key={name} className="flex items-center gap-2.5 ps-2.5 pe-1 rounded-xl bg-white/65 hover:bg-white transition-colors" style={{ minHeight: 50, boxShadow: '0 1px 2px rgba(27,56,40,0.05)' }}>
                          <CircleFlag
                            country={name}
                            label={display}
                            size={28}
                            ring={isObserver ? 'rgba(182,135,31,0.7)' : true}
                          />
                          <div className="min-w-0 flex-1">
                            {isEditing ? (
                              <input
                                autoFocus
                                aria-label={display}
                                className="w-full text-[14px] bg-transparent border-b-2 border-[#1B3828] outline-none font-semibold py-0.5"
                                style={{ color: C.ink }}
                                value={editDraft}
                                onChange={(e) => setEditDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') { commitRename(editDraft); }
                                  else if (e.key === 'Escape') { setEditingName(null); }
                                }}
                                onBlur={() => commitRename(editDraft)}
                              />
                            ) : (
                              <span className="block truncate text-[14px] font-semibold leading-tight" style={{ color: C.ink }} title={display}>{display}</span>
                            )}
                            {!isEditing && isObserver && (
                              <span className="block text-[10px] font-extrabold uppercase tracking-[0.12em] mt-0.5" style={{ color: '#8A6414' }}>{t('rollcall_observer')}</span>
                            )}
                          </div>
                          {!isEditing && (
                            <RowIconButton
                              onClick={() => setObservers((prev) => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; })}
                              label={t('create_observer_toggle')}
                              pressed={isObserver}
                              tone={isObserver ? 'gold' : 'neutral'}
                            >
                              <Megaphone size={16} strokeWidth={isObserver ? 2.2 : 1.8} />
                            </RowIconButton>
                          )}
                          {/* Rename and remove are always visible: hover-only made both unreachable on touch. */}
                          {!isEditing && isCustom && (
                            <RowIconButton onClick={() => { setEditingName(name); setEditDraft(name); }} label={display}>
                              <PenLine size={16} strokeWidth={1.8} />
                            </RowIconButton>
                          )}
                          {!isEditing && (
                            <RowIconButton onClick={() => removeDelegate(name)} label={display} tone="danger">
                              <X size={16} strokeWidth={2} />
                            </RowIconButton>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* Paste a list: secondary, last, so opening it moves nothing above. */}
            <div className="mt-4">
              <button type="button" onClick={() => setPasteOpen((v) => !v)} aria-expanded={pasteOpen} aria-controls="create-paste-panel"
                className="flex w-full items-center gap-2.5 h-11 px-3 rounded-xl text-start transition-[background-color,transform] duration-150 active:scale-[0.99] hover:bg-[#1B3828]/[0.05] focus:outline-none"
                style={{ color: C.forest }}>
                <ClipboardList size={17} strokeWidth={2} />
                <span className="flex-1 text-[14px] font-bold">{t('create_paste_toggle')}</span>
                <ChevronDown size={17} strokeWidth={2.2} className="transition-transform duration-200" style={{ transform: pasteOpen ? 'rotate(180deg)' : undefined }} />
              </button>
              {pasteOpen && (
                <div id="create-paste-panel" className="px-1 pt-2">
                  <label htmlFor="create-paste" className="block text-[13px] mb-2" style={{ color: C.inkSoft, textWrap: 'pretty' }}>{t('create_paste_hint')}</label>
                  <textarea id="create-paste" value={pasteText} onChange={(e) => { setPasteText(e.target.value); setPasteError(''); }}
                    placeholder={t('create_paste_placeholder')}
                    rows={5}
                    className="w-full rounded-[14px] bg-white/80 px-4 py-3 text-base sm:text-[15px] leading-relaxed text-[#1C1410] placeholder-[#8A7C6B] resize-y shadow-[inset_0_0_0_1px_rgba(27,56,40,0.16)] focus:outline-none focus:shadow-[inset_0_0_0_2px_#1B3828,0_0_0_4px_rgba(27,56,40,0.08)] transition-[box-shadow] duration-150" />
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <button type="button" onClick={handlePaste} disabled={!pasteText.trim()}
                      className="flex items-center gap-2 h-10 px-4 rounded-xl text-[13px] font-extrabold transition-[background-color,color,transform,opacity] duration-150 enabled:active:scale-[0.96] enabled:hover:bg-[#1B3828] enabled:hover:text-[#EED98A] disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none"
                      style={{ backgroundColor: 'rgba(27,56,40,0.07)', color: C.forest, boxShadow: 'inset 0 0 0 1px rgba(27,56,40,0.14)' }}>
                      <Wand2 size={15} strokeWidth={2.2} />
                      {stripArrow(t('create_auto_match'))}
                    </button>
                    {pasteError && <p role="alert" className="text-[13px] font-semibold" style={{ color: '#8A6414' }}>{pasteError}</p>}
                  </div>
                </div>
              )}
            </div>
          </StepCard>
        </div>

        {/* ── Sticky action bar ────────────────────────────────────────────── */}
        <div
          className="sticky bottom-0 z-30 -mx-4 mt-2 px-4 pt-8 sm:-mx-6 sm:px-6"
          style={{ background: `linear-gradient(to top, ${C.page} 58%, rgba(237,231,216,0))`, paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
        >
          <div className="flex items-center gap-4 rounded-[24px] p-2 sm:p-2.5" style={{ backgroundColor: C.surface, boxShadow: '0 2px 6px rgba(27,56,40,0.08), 0 16px 40px rgba(27,56,40,0.16), inset 0 0 0 1px rgba(27,56,40,0.08)' }}>
            <div className="hidden min-w-0 flex-1 items-center gap-3 ps-1.5 sm:flex" aria-live="polite">
              <span className="flex flex-shrink-0 items-center justify-center rounded-full bg-white" style={{ width: 42, height: 42, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)' }}>
                {presetLogo
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={presetLogo} alt="" width={26} height={26} className="object-contain" />
                  : <Gavel size={19} strokeWidth={2} style={{ color: C.forest }} />}
              </span>
              <div className="min-w-0">
                <p className="truncate" style={{ fontSize: 15, fontWeight: 800, color: committeeName.trim() ? C.forest : C.muted, lineHeight: 1.25 }}>{summaryName}</p>
                <p className="truncate tabular-nums" style={{ fontSize: 12.5, fontWeight: 600, color: C.inkSoft, lineHeight: 1.3 }}>
                  {topic.trim() ? `${topic.trim()} · ${countLabel}` : countLabel}
                </p>
              </div>
            </div>
            <div className="w-full sm:w-auto sm:min-w-[260px]">
              <PrimaryAction
                onClick={handleCreate}
                disabled={!canProceed || creating}
                icon={creating
                  ? <Loader2 size={18} strokeWidth={2.6} className="animate-spin" />
                  : canProceed ? <ArrowRight size={18} strokeWidth={2.6} className="rtl:rotate-180" /> : null}
              >
                {stripArrow(ctaLabel)}
              </PrimaryAction>
            </div>
          </div>
        </div>
      </main>

      {/* Paste review modal */}
      {pasteReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(5,4,3,0.5)', backdropFilter: 'blur(4px)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setPasteReview(null); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="create-review-title" className="w-full max-w-md flex flex-col overflow-hidden"
            style={{ backgroundColor: C.surface, borderRadius: 24, boxShadow: SHADOW.panel, maxHeight: '82vh' }}>
            <div className="px-6 pt-5 pb-4 shrink-0" style={{ boxShadow: 'inset 0 -1px 0 rgba(27,56,40,0.08)' }}>
              <h2 id="create-review-title" style={{ fontSize: 19, fontWeight: 800, color: C.forest, margin: 0 }}>{t('create_review_title')}</h2>
              <p className="mt-0.5" style={{ fontSize: 13, color: C.inkSoft }}>{t('create_review_subtitle').replace('{n}', String(pasteReview.length))}</p>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 p-2">
              {pasteReview.map((r, idx) => {
                const found = getCountryByName(r.name);
                return (
                  <div key={idx} className="flex items-center gap-3 px-3 rounded-xl" style={{ minHeight: 50 }}>
                    {found
                      ? <CircleFlag code={found.code} size={26} decorative />
                      : <span className="flex items-center justify-center shrink-0 rounded-full" style={{ width: 26, height: 26, backgroundColor: 'rgba(27,56,40,0.08)', color: C.forest }}><UserRound size={15} strokeWidth={2} /></span>}
                    {found ? (
                      <span className="text-[14px] flex-1 truncate font-semibold" style={{ color: C.ink }}>{getCountryDisplayName(r.name, language)}</span>
                    ) : (
                      <input value={r.name} onChange={(e) => updateReviewName(idx, e.target.value)}
                        className="text-base sm:text-[14px] flex-1 min-w-0 bg-white rounded-lg px-2.5 h-9 text-[#1C1410] shadow-[inset_0_0_0_1px_rgba(27,56,40,0.18)] focus:outline-none focus:shadow-[inset_0_0_0_2px_#1B3828]" />
                    )}
                    <Chip tone={found ? 'green' : 'gold'}>{found ? t('create_review_country_tag') : t('create_review_custom_tag')}</Chip>
                    <RowIconButton onClick={() => removeReviewIdx(idx)} label={r.name} tone="danger"><X size={16} strokeWidth={2} /></RowIconButton>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-3 px-5 py-4 shrink-0" style={{ boxShadow: 'inset 0 1px 0 rgba(27,56,40,0.08)' }}>
              <GhostAction onClick={() => setPasteReview(null)}>{t('create_review_cancel')}</GhostAction>
              <button type="button" onClick={commitPasteReview} disabled={pasteReview.length === 0}
                className="gv-lift flex-1 h-11 rounded-xl text-[14px] font-extrabold transition-[background-color,transform,opacity] duration-150 enabled:active:scale-[0.96] enabled:hover:bg-[#2A5A3C] disabled:opacity-30 focus:outline-none"
                style={{ backgroundColor: C.forest, color: C.gold }}>
                {t('create_review_proceed')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CreatePage() {
  return (
    <Suspense fallback={<div className="h-screen bg-[#EDE7D8] flex items-center justify-center"><Loader size={72} label="Loading" /></div>}>
      <CreatePageInner />
    </Suspense>
  );
}
