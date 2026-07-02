'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, SlidersHorizontal, ArrowRight, ArrowLeft, Users, CalendarDays } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import { supabase } from '@/lib/supabase';
import { getFlagUrl, getCountryByName } from '@/lib/countries';

// ── Continent maps ─────────────────────────────────────────────────────────────

const CONTINENT_COUNTRIES: Record<string, string[]> = {
  'north-america': ['United States', 'Canada', 'Mexico', 'Guatemala', 'Belize', 'Honduras', 'El Salvador', 'Nicaragua', 'Costa Rica', 'Panama', 'Cuba', 'Jamaica', 'Haiti', 'Dominican Republic', 'Puerto Rico', 'Trinidad and Tobago', 'Barbados', 'Saint Lucia', 'Grenada', 'Antigua and Barbuda', 'Saint Kitts and Nevis', 'Saint Vincent and the Grenadines', 'Dominica', 'Bahamas'],
  'south-america': ['Brazil', 'Argentina', 'Colombia', 'Chile', 'Peru', 'Venezuela', 'Ecuador', 'Bolivia', 'Paraguay', 'Uruguay', 'Guyana', 'Suriname'],
  'europe': ['United Kingdom', 'Germany', 'France', 'Italy', 'Spain', 'Netherlands', 'Belgium', 'Switzerland', 'Austria', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Poland', 'Czech Republic', 'Hungary', 'Romania', 'Bulgaria', 'Greece', 'Portugal', 'Ireland', 'Croatia', 'Slovakia', 'Slovenia', 'Estonia', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Cyprus', 'Serbia', 'Bosnia and Herzegovina', 'North Macedonia', 'Albania', 'Montenegro', 'Kosovo', 'Moldova', 'Ukraine', 'Belarus', 'Russia', 'Iceland', 'Liechtenstein', 'Monaco', 'Andorra', 'San Marino'],
  'africa': ['Nigeria', 'South Africa', 'Kenya', 'Ghana', 'Ethiopia', 'Tanzania', 'Uganda', 'Rwanda', 'Senegal', 'Ivory Coast', 'Cameroon', 'Zimbabwe', 'Zambia', 'Mozambique', 'Angola', 'Sudan', 'Egypt', 'Morocco', 'Tunisia', 'Algeria', 'Libya', 'Mali', 'Niger', 'Chad', 'Somalia', 'Madagascar', 'Malawi', 'Botswana', 'Namibia', 'Lesotho', 'Eswatini', 'Eritrea', 'Djibouti', 'Comoros', 'Cape Verde', 'Sao Tome and Principe', 'Equatorial Guinea', 'Gabon', 'Republic of the Congo', 'Democratic Republic of the Congo', 'Central African Republic', 'Burundi', 'Benin', 'Togo', 'Sierra Leone', 'Liberia', 'Guinea', 'Guinea-Bissau', 'Gambia', 'Mauritania', 'Mauritius', 'Seychelles'],
  'asia': ['China', 'India', 'Japan', 'South Korea', 'Indonesia', 'Pakistan', 'Bangladesh', 'Vietnam', 'Thailand', 'Malaysia', 'Singapore', 'Philippines', 'Myanmar', 'Cambodia', 'Laos', 'Sri Lanka', 'Nepal', 'Bhutan', 'Mongolia', 'Kazakhstan', 'Uzbekistan', 'Turkmenistan', 'Kyrgyzstan', 'Tajikistan', 'Afghanistan', 'Iran', 'Iraq', 'Saudi Arabia', 'United Arab Emirates', 'Qatar', 'Kuwait', 'Bahrain', 'Oman', 'Yemen', 'Jordan', 'Lebanon', 'Syria', 'Israel', 'Palestine', 'Turkey', 'Azerbaijan', 'Armenia', 'Georgia', 'Taiwan', 'Hong Kong', 'Macao', 'Brunei', 'East Timor', 'Maldives'],
  'oceania': ['Australia', 'New Zealand', 'Papua New Guinea', 'Fiji', 'Solomon Islands', 'Vanuatu', 'Samoa', 'Kiribati', 'Tonga', 'Micronesia', 'Palau', 'Marshall Islands', 'Nauru', 'Tuvalu', 'Cook Islands'],
};

const CONTINENT_LABELS: Record<string, string> = {
  'north-america': 'North America',
  'south-america': 'South America',
  'europe': 'Europe',
  'africa': 'Africa',
  'asia': 'Asia',
  'oceania': 'Oceania',
};

const CONTINENT_KEYS = ['north-america', 'south-america', 'europe', 'africa', 'asia', 'oceania'] as const;

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

// ── Types ──────────────────────────────────────────────────────────────────

interface Conference {
  id: string;
  slug: string;
  full_name: string;
  acronym: string;
  country: string;
  city: string;
  start_date: string;
  end_date: string;
  expected_delegates: number;
  fee_amount: number;
  fee_currency: string;
  format: string;
  student_level: string;
  logo_url: string | null;
  banner_url: string | null;
  is_public: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()}–${e.getDate()} ${months[s.getMonth()]} ${s.getFullYear()}`;
  }
  return `${s.getDate()} ${months[s.getMonth()]} – ${e.getDate()} ${months[e.getMonth()]} ${e.getFullYear()}`;
}

// Deterministic forest-tone gradient per conference (used when no banner art exists)
const CARD_GRADIENTS: [string, string][] = [
  ['#16301F', '#2A5A3C'],
  ['#1B3828', '#27573A'],
  ['#122718', '#1B3828'],
  ['#1E4029', '#356744'],
];

function gradientFor(acronym: string): [string, string] {
  let h = 0;
  for (let i = 0; i < acronym.length; i++) h = (h * 31 + acronym.charCodeAt(i)) >>> 0;
  return CARD_GRADIENTS[h % CARD_GRADIENTS.length];
}

function FilterPill({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-[10px] font-bold transition-all focus:outline-none"
      style={{
        backgroundColor: active ? '#1B3828' : 'rgba(237,231,216,0.5)',
        color: active ? '#EED98A' : '#6B5F52',
        border: active ? '1px solid #1B3828' : '1px solid rgba(221,212,192,0.9)',
        fontFamily: "'Outfit', sans-serif",
        letterSpacing: '0.08em',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

// ── Empty state SVG ────────────────────────────────────────────────────────

function EmptySVG() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="28" cy="30" r="21" stroke="#1B3828" strokeWidth="1.5" fill="rgba(237,231,216,0.6)" />
      <line x1="7" y1="30" x2="49" y2="30" stroke="#1B3828" strokeWidth="1" strokeOpacity="0.4" />
      <line x1="28" y1="9" x2="28" y2="51" stroke="#1B3828" strokeWidth="1" strokeOpacity="0.4" />
      <ellipse cx="28" cy="30" rx="10" ry="21" stroke="#1B3828" strokeWidth="1" fill="none" strokeOpacity="0.4" />
      <circle cx="55" cy="56" r="12" stroke="#1B3828" strokeWidth="2" fill="rgba(237,231,216,0.5)" />
      <line x1="63" y1="64" x2="73" y2="74" stroke="#1B3828" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// ── Conference card ────────────────────────────────────────────────────────

function ConferenceCard({
  conf, hovered, onHover, onLeave, onClick,
}: {
  conf: Conference;
  hovered: boolean;
  onHover: () => void;
  onLeave: () => void;
  onClick: () => void;
}) {
  const countryObj = getCountryByName(conf.country);
  const flagUrl = countryObj ? getFlagUrl(countryObj.code) : null;
  const initials = conf.acronym.slice(0, 3).toUpperCase();
  const [g0, g1] = gradientFor(conf.acronym);

  return (
    <article
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className="cursor-pointer overflow-hidden"
      style={{
        backgroundColor: '#FAF8F3',
        border: hovered ? '1px solid rgba(27,56,40,0.55)' : '1px solid #DDD4C0',
        borderRadius: '20px',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: hovered
          ? '0 20px 48px rgba(27,56,40,0.16), 0 2px 8px rgba(27,56,40,0.08)'
          : '0 1px 3px rgba(27,56,40,0.05)',
        transition: 'transform 260ms cubic-bezier(0.22,1,0.36,1), box-shadow 260ms ease, border-color 260ms ease',
      }}
    >
      {/* Banner band */}
      <div className="relative" style={{ height: '104px', overflow: 'hidden' }}>
        {conf.banner_url ? (
          <>
            <img
              src={conf.banner_url}
              alt=""
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                transform: hovered ? 'scale(1.05)' : 'scale(1)',
                transition: 'transform 700ms cubic-bezier(0.22,1,0.36,1)',
              }}
            />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(20,36,27,0.55) 0%, rgba(20,36,27,0.08) 55%)' }} />
          </>
        ) : (
          <>
            <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(120deg, ${g0} 0%, ${g1} 100%)` }} />
            <div style={{ position: 'absolute', inset: 0, backgroundImage: GRAIN, backgroundSize: '300px', mixBlendMode: 'overlay', opacity: 0.1 }} />
            <span
              aria-hidden
              style={{
                position: 'absolute', right: '14px', bottom: '-6px',
                fontFamily: "'DM Mono', monospace", fontSize: '52px', lineHeight: 1,
                color: 'rgba(238,217,138,0.13)', letterSpacing: '0.02em', userSelect: 'none',
              }}
            >
              {conf.acronym.slice(0, 6)}
            </span>
          </>
        )}
        {/* Format chip */}
        <span
          className="absolute top-3 right-3"
          style={{
            fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.12em',
            color: '#FAF8F3', backgroundColor: 'rgba(20,36,27,0.45)',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(250,248,243,0.18)',
            padding: '3px 10px', borderRadius: '9999px',
          }}
        >
          {conf.format.toUpperCase().replace('-', ' ')}
        </span>
      </div>

      {/* Logo overlapping the band — free-floating */}
      <div className="px-5" style={{ marginTop: '-36px', position: 'relative' }}>
        {conf.logo_url ? (
          <img
            src={conf.logo_url}
            alt={conf.acronym}
            style={{
              width: '72px', height: '72px', objectFit: 'contain', display: 'block',
              filter: 'drop-shadow(0 8px 16px rgba(16,28,21,0.35))',
            }}
          />
        ) : (
          <div
            style={{
              width: '56px', height: '56px', borderRadius: '15px',
              backgroundColor: '#EDE7D8', border: '3px solid #FAF8F3',
              boxShadow: '0 4px 12px rgba(27,56,40,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: '12px', fontFamily: "'DM Mono', monospace", color: '#1B3828', fontWeight: 700 }}>
              {initials}
            </span>
          </div>
        )}
      </div>

      <div className="px-5 pt-3 pb-5">
        {/* Acronym eyebrow */}
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.16em', color: '#B6871F', margin: '0 0 3px 0' }}>
          {conf.acronym}
        </p>

        {/* Full name */}
        <h3
          className="text-[15px] font-bold leading-snug mb-2.5"
          style={{
            color: '#1C1410', fontFamily: "'Outfit', sans-serif",
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            minHeight: '2.6em',
          }}
        >
          {conf.full_name}
        </h3>

        {/* Location + dates */}
        <div className="flex items-center gap-1.5 mb-1">
          {flagUrl && (
            <img
              src={flagUrl}
              alt={conf.country}
              style={{ width: '18px', height: '13px', borderRadius: '3px', objectFit: 'cover', flexShrink: 0, boxShadow: '0 1px 2px rgba(27,56,40,0.2)' }}
            />
          )}
          <span className="text-xs" style={{ color: '#6B5F52', fontFamily: "'Outfit', sans-serif", fontWeight: 500 }}>
            {conf.city}, {conf.country}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mb-4">
          <CalendarDays size={12} style={{ color: '#9A8A78', flexShrink: 0 }} />
          <span className="text-[11px]" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}>
            {formatDateRange(conf.start_date, conf.end_date)}
          </span>
        </div>

        {/* Foot row */}
        <div
          className="flex items-center justify-between pt-3.5"
          style={{ borderTop: '1px solid rgba(221,212,192,0.55)' }}
        >
          <div className="flex items-center gap-2">
            <span
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full"
              style={{ backgroundColor: 'rgba(27,56,40,0.06)', color: '#4A4238', fontFamily: "'DM Mono', monospace" }}
            >
              <Users size={10} style={{ color: '#9A8A78' }} />
              {conf.expected_delegates.toLocaleString()}
            </span>
            {conf.fee_amount === 0 ? (
              <span
                className="text-[10px] px-2 py-1 rounded-full font-bold"
                style={{ backgroundColor: 'rgba(61,122,82,0.14)', color: '#2A5A3C', fontFamily: "'DM Mono', monospace", letterSpacing: '0.06em' }}
              >
                FREE
              </span>
            ) : (
              <span
                className="text-[10px] px-2 py-1 rounded-full"
                style={{ backgroundColor: 'rgba(182,135,31,0.1)', color: '#8A6614', fontFamily: "'DM Mono', monospace" }}
              >
                {conf.fee_currency} {conf.fee_amount.toFixed(0)}
              </span>
            )}
          </div>
          <span
            className="flex items-center gap-1 text-[11px] font-bold"
            style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em' }}
          >
            VIEW
            <ArrowRight
              size={13}
              style={{ transform: hovered ? 'translateX(3px)' : 'translateX(0)', transition: 'transform 220ms cubic-bezier(0.22,1,0.36,1)' }}
            />
          </span>
        </div>
      </div>
    </article>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function ConferencesExploreClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [conferences, setConferences] = useState<Conference[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [formatFilter, setFormatFilter] = useState<'in-person' | 'online' | 'hybrid' | ''>('');
  const [levelFilter, setLevelFilter] = useState<'school' | 'university' | 'both' | ''>('');
  const [applicationsOpen, setApplicationsOpen] = useState(false);
  const [continentFilter, setContinentFilter] = useState<string>(() => searchParams.get('continent') ?? '');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchConferences() {
      setLoading(true);
      const { data } = await supabase
        .from('conferences')
        .select('id, slug, full_name, acronym, country, city, start_date, end_date, expected_delegates, fee_amount, fee_currency, format, student_level, logo_url, banner_url, is_public')
        .eq('is_public', true)
        .order('start_date', { ascending: true });
      setConferences((data as Conference[]) ?? []);
      setLoading(false);
    }
    fetchConferences();
  }, []);

  const filtered = conferences.filter(c => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !c.full_name.toLowerCase().includes(q) &&
        !c.acronym.toLowerCase().includes(q) &&
        !c.city.toLowerCase().includes(q) &&
        !c.country.toLowerCase().includes(q)
      ) return false;
    }
    if (formatFilter && c.format !== formatFilter) return false;
    if (levelFilter && c.student_level !== levelFilter) return false;
    if (continentFilter) {
      const countries = CONTINENT_COUNTRIES[continentFilter];
      if (!countries || !countries.includes(c.country)) return false;
    }
    return true;
  });

  function clearFilters() {
    setFormatFilter('');
    setLevelFilter('');
    setApplicationsOpen(false);
    setContinentFilter('');
    setSearchQuery('');
  }

  const hasActiveFilters = !!formatFilter || !!levelFilter || applicationsOpen || !!searchQuery || !!continentFilter;

  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundColor: '#EDE7D8' }}>
      {/* Grain */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: GRAIN,
          backgroundRepeat: 'repeat',
          backgroundSize: '300px 300px',
          mixBlendMode: 'multiply',
          opacity: 0.18,
        }}
      />

      {/* Soft ambient washes behind the header */}
      <div
        aria-hidden
        className="pointer-events-none absolute z-0"
        style={{
          top: '-140px', left: '8%', width: '620px', height: '420px',
          background: 'radial-gradient(ellipse at center, rgba(238,217,138,0.22) 0%, transparent 65%)',
          filter: 'blur(48px)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute z-0"
        style={{
          top: '-80px', right: '4%', width: '520px', height: '380px',
          background: 'radial-gradient(ellipse at center, rgba(42,90,60,0.13) 0%, transparent 65%)',
          filter: 'blur(48px)',
        }}
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        <SiteNav />

        {/* ── Editorial header ─────────────────────────────────────── */}
        <header className="px-6 md:px-14 pt-8 pb-8">
          <Link
            href="/conferences"
            className="inline-flex items-center gap-1.5 text-[11px] mb-6 transition-colors"
            style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace", textDecoration: 'none', letterSpacing: '0.06em' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
          >
            <ArrowLeft size={12} />
            BACK TO CONFERENCES
          </Link>

          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <p
                className="mb-2"
                style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.28em', color: '#B6871F' }}
              >
                CONFERENCE DIRECTORY
              </p>
              <h1
                style={{
                  fontFamily: "'Outfit', sans-serif", fontWeight: 900,
                  fontSize: 'clamp(36px, 4.5vw, 60px)', lineHeight: 1.02, color: '#1C1410', margin: 0,
                }}
              >
                Explore{' '}
                <span style={{ color: '#1B3828' }}>Conferences</span>
                <span style={{ color: '#B6871F' }}>.</span>
              </h1>
              <p
                className="mt-3"
                style={{ fontFamily: "'Outfit', sans-serif", fontSize: '14px', color: '#8A7D6C', maxWidth: '440px', lineHeight: 1.6 }}
              >
                {loading
                  ? 'Loading the directory…'
                  : `${conferences.length} conference${conferences.length === 1 ? '' : 's'} across every continent — find where you debate next.`}
              </p>
            </div>
            <button
              onClick={() => router.push('/conferences/new')}
              className="self-start md:self-auto flex-shrink-0 rounded-2xl py-3.5 px-7 font-bold text-[13px] transition-all focus:outline-none"
              style={{
                backgroundColor: '#1B3828', color: '#EED98A',
                fontFamily: "'Outfit', sans-serif", letterSpacing: '0.07em',
                boxShadow: '0 8px 24px rgba(27,56,40,0.22)',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
            >
              ORGANISE A CONFERENCE →
            </button>
          </div>
        </header>

        {/* ── Floating glass filter bar ────────────────────────────── */}
        <div className="sticky z-30 px-4 md:px-10" style={{ top: '12px' }}>
          <div
            style={{
              backgroundColor: 'rgba(250,248,243,0.72)',
              backdropFilter: 'blur(20px) saturate(1.5)',
              WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
              border: '1px solid rgba(221,212,192,0.85)',
              borderRadius: filtersOpen ? '24px' : '9999px',
              boxShadow: '0 12px 40px rgba(27,56,40,0.12), 0 1px 0 rgba(255,255,255,0.6) inset',
              transition: 'border-radius 260ms ease',
            }}
          >
            <div className="flex items-center gap-2 px-2 py-2 md:px-3 flex-wrap md:flex-nowrap">
              {/* Search */}
              <div className="relative flex items-center flex-1" style={{ minWidth: '180px' }}>
                <Search size={15} className="absolute left-3 pointer-events-none" style={{ color: '#9A8A78' }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, city, country…"
                  className="w-full py-2 pl-9 pr-3 text-sm focus:outline-none"
                  style={{
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: '#1C1410',
                    fontFamily: "'Outfit', sans-serif",
                  }}
                />
              </div>

              {/* Hairline divider */}
              <div className="hidden md:block w-px h-6 flex-shrink-0" style={{ backgroundColor: 'rgba(221,212,192,0.9)' }} />

              {/* Continent pills */}
              <div className="hidden lg:flex items-center gap-1.5 flex-shrink-0">
                {CONTINENT_KEYS.map(key => (
                  <FilterPill
                    key={key}
                    label={CONTINENT_LABELS[key].toUpperCase()}
                    active={continentFilter === key}
                    onClick={() => setContinentFilter(f => f === key ? '' : key)}
                  />
                ))}
              </div>

              {/* Active continent chip (small screens, where the pill row is hidden) */}
              {continentFilter && (
                <span
                  className="flex lg:hidden items-center gap-1.5 flex-shrink-0"
                  style={{
                    backgroundColor: 'rgba(27,56,40,0.08)',
                    border: '1px solid rgba(27,56,40,0.2)',
                    borderRadius: 9999,
                    padding: '3px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#1B3828',
                    fontFamily: "'Outfit', sans-serif",
                  }}
                >
                  {CONTINENT_LABELS[continentFilter]}
                  <button
                    className="focus:outline-none"
                    onClick={() => setContinentFilter('')}
                    style={{ lineHeight: 1, color: '#1B3828', opacity: 0.6 }}
                  >
                    ×
                  </button>
                </span>
              )}

              {/* Filters toggle */}
              <button
                onClick={() => setFiltersOpen(v => !v)}
                className="flex items-center gap-2 rounded-full py-2 px-4 font-bold text-[11px] transition-colors focus:outline-none flex-shrink-0 ml-auto"
                style={{
                  backgroundColor: filtersOpen ? '#1B3828' : 'rgba(237,231,216,0.5)',
                  color: filtersOpen ? '#EED98A' : '#4A4238',
                  border: filtersOpen ? '1px solid #1B3828' : '1px solid rgba(221,212,192,0.9)',
                  fontFamily: "'Outfit', sans-serif",
                  letterSpacing: '0.08em',
                }}
              >
                <SlidersHorizontal size={13} />
                FILTERS
                {hasActiveFilters && (
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: filtersOpen ? '#EED98A' : '#B6871F' }}
                  />
                )}
              </button>
            </div>

            {/* Expanded filter panel — inside the glass container */}
            {filtersOpen && (
              <div
                className="px-4 md:px-5 py-4 flex flex-wrap items-center gap-2"
                style={{ borderTop: '1px solid rgba(221,212,192,0.7)' }}
              >
                <span className="text-[10px] font-bold mr-1" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace", letterSpacing: '0.14em' }}>FORMAT</span>
                <FilterPill label="IN-PERSON"  active={formatFilter === 'in-person'}  onClick={() => setFormatFilter(f => f === 'in-person' ? '' : 'in-person')} />
                <FilterPill label="ONLINE"     active={formatFilter === 'online'}     onClick={() => setFormatFilter(f => f === 'online' ? '' : 'online')} />
                <FilterPill label="HYBRID"     active={formatFilter === 'hybrid'}     onClick={() => setFormatFilter(f => f === 'hybrid' ? '' : 'hybrid')} />

                <div className="w-px h-5 mx-1" style={{ backgroundColor: 'rgba(221,212,192,0.9)' }} />

                <span className="text-[10px] font-bold mr-1" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace", letterSpacing: '0.14em' }}>LEVEL</span>
                <FilterPill label="SCHOOL"     active={levelFilter === 'school'}     onClick={() => setLevelFilter(l => l === 'school' ? '' : 'school')} />
                <FilterPill label="UNIVERSITY" active={levelFilter === 'university'} onClick={() => setLevelFilter(l => l === 'university' ? '' : 'university')} />
                <FilterPill label="BOTH"       active={levelFilter === 'both'}       onClick={() => setLevelFilter(l => l === 'both' ? '' : 'both')} />

                <div className="w-px h-5 mx-1" style={{ backgroundColor: 'rgba(221,212,192,0.9)' }} />

                <FilterPill label="APPLICATIONS OPEN" active={applicationsOpen} onClick={() => setApplicationsOpen(v => !v)} />

                <div className="w-px h-5 mx-1" style={{ backgroundColor: 'rgba(221,212,192,0.9)' }} />

                <span className="text-[10px] font-bold mr-1" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace", letterSpacing: '0.14em' }}>CONTINENT</span>
                {CONTINENT_KEYS.map(key => (
                  <FilterPill
                    key={key}
                    label={CONTINENT_LABELS[key].toUpperCase()}
                    active={continentFilter === key}
                    onClick={() => setContinentFilter(f => f === key ? '' : key)}
                  />
                ))}

                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="ml-auto text-[11px] underline focus:outline-none"
                    style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}
                  >
                    Clear all
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Main content ─────────────────────────────────────────── */}
        <main className="flex-1 px-6 md:px-14 pt-10 pb-16">
          {/* Results rule */}
          {!loading && filtered.length > 0 && (
            <div className="flex items-center gap-4 mb-6">
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.2em', color: '#9A8A78', whiteSpace: 'nowrap' }}>
                SHOWING {filtered.length} {filtered.length === 1 ? 'CONFERENCE' : 'CONFERENCES'}
              </span>
              <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(221,212,192,0.8)' }} />
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-[20px] overflow-hidden"
                  style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}
                >
                  <div className="animate-pulse" style={{ height: '104px', backgroundColor: '#DDD4C0' }} />
                  <div className="p-5">
                    <div className="animate-pulse rounded-full mb-3" style={{ width: '56px', height: '10px', backgroundColor: '#E4DCCB' }} />
                    <div className="animate-pulse rounded-lg mb-2" style={{ width: '80%', height: '16px', backgroundColor: '#E4DCCB' }} />
                    <div className="animate-pulse rounded-lg mb-4" style={{ width: '55%', height: '12px', backgroundColor: '#EDE7D8' }} />
                    <div className="animate-pulse rounded-full" style={{ width: '40%', height: '12px', backgroundColor: '#EDE7D8' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <EmptySVG />
              <h2 className="font-semibold text-lg mt-6 mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                No conferences listed yet
              </h2>
              <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                Gavelling Conferences is launching soon. Be the first to list your conference.
              </p>
              <button
                onClick={() => router.push('/conferences/new')}
                className="rounded-xl py-3 px-6 font-bold text-sm tracking-widest transition-colors focus:outline-none"
                style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.07em' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
              >
                ORGANISE A CONFERENCE →
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map(conf => (
                <ConferenceCard
                  key={conf.id}
                  conf={conf}
                  hovered={hoveredId === conf.id}
                  onHover={() => setHoveredId(conf.id)}
                  onLeave={() => setHoveredId(null)}
                  onClick={() => router.push(`/conferences/${conf.slug}`)}
                />
              ))}
            </div>
          )}
        </main>

        {/* Footer */}
        <footer
          className="relative z-10 border-t border-[#DDD4C0] px-6 py-8"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='0.18'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat',
            backgroundSize: '300px 300px',
            backgroundColor: '#EDE7D8',
          }}
        >
          <div className="flex flex-col items-center gap-4 md:grid md:grid-cols-3 md:gap-0 md:items-center">
            <img
              src="/GavellingLogo.png"
              alt="Gavelling"
              className="h-7 w-auto"
              style={{ filter: 'brightness(0) saturate(100%) invert(18%) sepia(25%) saturate(800%) hue-rotate(100deg) brightness(85%)' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <div className="flex items-center justify-center gap-4">
              <a
                href="https://www.instagram.com/wearegavelling/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                style={{ color: '#9A8A78', transition: 'color 0.15s' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#1B3828'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#9A8A78'; }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                </svg>
              </a>
              <span aria-label="LinkedIn (coming soon)" style={{ color: '#C8BFB0', cursor: 'default' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>
                </svg>
              </span>
            </div>
            <p className="text-xs font-semibold text-[#1B3828] md:text-right">© {new Date().getFullYear()} Gavelling. Built for the MUN community.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
