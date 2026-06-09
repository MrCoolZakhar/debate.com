'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, SlidersHorizontal } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import { getAuthedClient } from '@/lib/supabase-auth';
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

function FilterPill({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-bold tracking-widest transition-all focus:outline-none"
      style={{
        backgroundColor: active ? '#1B3828' : 'transparent',
        color: active ? '#EED98A' : '#1C1410',
        border: active ? '1.5px solid #1B3828' : '1.5px solid #DDD4C0',
        fontFamily: "'Outfit', sans-serif",
        letterSpacing: '0.07em',
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

  return (
    <div
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className="cursor-pointer overflow-hidden"
      style={{
        backgroundColor: '#FAF8F3',
        border: hovered ? '1px solid #1B3828' : '1px solid #DDD4C0',
        borderRadius: '16px',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hovered ? '0 8px 32px rgba(27,56,40,0.10)' : 'none',
        transition: 'all 200ms ease',
      }}
    >
      {/* Top accent strip */}
      <div style={{ height: '6px', background: 'linear-gradient(to right, #1B3828, #3D7A52)' }} />

      <div style={{ padding: '20px' }}>
        {/* Row 1: logo + acronym */}
        <div className="flex items-center justify-between mb-3">
          {conf.logo_url ? (
            <img
              src={conf.logo_url}
              alt={conf.acronym}
              style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #DDD4C0' }}
            />
          ) : (
            <div
              style={{
                width: '40px', height: '40px', borderRadius: '8px',
                backgroundColor: '#EDE7D8', border: '1px solid #DDD4C0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: '10px', fontFamily: "'DM Mono', monospace", color: '#1C1410', fontWeight: 700 }}>
                {initials}
              </span>
            </div>
          )}
          <span style={{ fontSize: '11px', fontFamily: "'DM Mono', monospace", color: '#9A8A78' }}>
            {conf.acronym}
          </span>
        </div>

        {/* Row 2: full name */}
        <p
          className="text-sm font-semibold leading-tight mb-2"
          style={{
            color: '#1C1410', fontFamily: "'Outfit', sans-serif",
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}
        >
          {conf.full_name}
        </p>

        {/* Row 3: city + flag + country */}
        <div className="flex items-center gap-1.5 mb-1">
          {flagUrl && (
            <img
              src={flagUrl}
              alt={conf.country}
              style={{ width: '18px', height: '13px', borderRadius: '3px', objectFit: 'cover', flexShrink: 0 }}
            />
          )}
          <span className="text-xs" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
            {conf.city}, {conf.country}
          </span>
        </div>

        {/* Row 4: dates */}
        <p className="text-xs mb-3" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}>
          {formatDateRange(conf.start_date, conf.end_date)}
        </p>

        {/* Row 5: pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-[10px] px-2 py-0.5 rounded-full"
            style={{ backgroundColor: 'rgba(27,56,40,0.07)', color: '#1C1410', fontFamily: "'DM Mono', monospace" }}
          >
            {conf.expected_delegates} delegates
          </span>
          {conf.fee_amount === 0 ? (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-bold"
              style={{ backgroundColor: 'rgba(61,122,82,0.12)', color: '#1B3828', fontFamily: "'DM Mono', monospace" }}
            >
              FREE
            </span>
          ) : (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'rgba(27,56,40,0.07)', color: '#1C1410', fontFamily: "'DM Mono', monospace" }}
            >
              {conf.fee_currency} {conf.fee_amount.toFixed(0)}
            </span>
          )}
        </div>

        {/* Bottom: Apply link */}
        <div className="mt-3 pt-3 flex justify-end" style={{ borderTop: '1px solid #DDD4C0' }}>
          <span className="text-xs font-bold tracking-widest" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.07em' }}>
            APPLY NOW →
          </span>
        </div>
      </div>
    </div>
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
      const supabase = getAuthedClient('');
      const { data } = await supabase
        .from('conferences')
        .select('id, slug, full_name, acronym, country, city, start_date, end_date, expected_delegates, fee_amount, fee_currency, format, student_level, logo_url, is_public')
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
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '300px 300px',
          mixBlendMode: 'multiply',
          opacity: 0.18,
        }}
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Back link */}
        <div style={{ backgroundColor: '#1B3828' }}>
          <div className="px-6 py-2">
            <Link
              href="/conferences"
              className="text-xs transition-colors"
              style={{ color: 'rgba(238,217,138,0.6)', fontFamily: "'DM Mono', monospace", textDecoration: 'none' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#EED98A'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'rgba(238,217,138,0.6)'; }}
            >
              ← Back to Conferences
            </Link>
          </div>
        </div>

        <SiteNav />

        {/* Hero bar */}
        <div
          className="px-6 md:px-14 py-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
          style={{ backgroundColor: '#1B3828' }}
        >
          <div>
            <p className="text-[10px] tracking-[0.2em] mb-1" style={{ color: '#EED98A', fontFamily: "'DM Mono', monospace" }}>
              CONFERENCES
            </p>
            <h1 className="font-black text-3xl md:text-4xl text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
              Explore Conferences
            </h1>
          </div>
          <button
            onClick={() => router.push('/conferences/new')}
            className="self-start md:self-auto rounded-xl py-2.5 px-6 font-bold text-sm tracking-widest transition-colors focus:outline-none"
            style={{ backgroundColor: '#EED98A', color: '#1B3828', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.07em' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'white'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#EED98A'; }}
          >
            ORGANISE A CONFERENCE →
          </button>
        </div>

        {/* Filter bar — sticky */}
        <div
          className="sticky z-10 px-6 md:px-14 py-3 flex flex-wrap items-center gap-3"
          style={{ top: '72px', backgroundColor: '#FAF8F3', borderBottom: '1px solid #DDD4C0' }}
        >
          {/* Search + active continent tag */}
          <div className="flex items-center gap-2 flex-1 md:flex-none" style={{ minWidth: 0 }}>
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: '#9A8A78' }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conferences..."
                className="w-full md:w-[280px] rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none transition-colors"
                style={{
                  border: '1px solid #DDD4C0',
                  backgroundColor: '#FAF8F3',
                  color: '#1C1410',
                  fontFamily: "'Outfit', sans-serif",
                }}
                onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
                onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
              />
            </div>
            {continentFilter && (
              <span
                className="flex items-center gap-1.5 flex-shrink-0"
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
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.6'; }}
                >
                  ×
                </button>
              </span>
            )}
          </div>

          {/* Continent quick-filter pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {CONTINENT_KEYS.map(key => (
              <FilterPill
                key={key}
                label={CONTINENT_LABELS[key].toUpperCase()}
                active={continentFilter === key}
                onClick={() => setContinentFilter(f => f === key ? '' : key)}
              />
            ))}
          </div>

          <div className="ml-auto flex-shrink-0">
            <button
              onClick={() => setFiltersOpen(v => !v)}
              className="flex items-center gap-2 rounded-xl py-2.5 px-4 font-semibold text-sm transition-colors focus:outline-none"
              style={{
                backgroundColor: filtersOpen ? '#1B3828' : 'transparent',
                color: filtersOpen ? '#EED98A' : '#1C1410',
                border: filtersOpen ? '1px solid #1B3828' : '1px solid #DDD4C0',
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              <SlidersHorizontal size={15} />
              FILTERS
              {hasActiveFilters && (
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: filtersOpen ? '#EED98A' : '#1B3828' }}
                />
              )}
            </button>
          </div>
        </div>

        {/* Filter panel */}
        {filtersOpen && (
          <div
            className="px-6 md:px-14 py-4 flex flex-wrap items-center gap-2"
            style={{ backgroundColor: '#FAF8F3', borderBottom: '1px solid #DDD4C0' }}
          >
            <span className="text-xs font-semibold mr-1" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>Format:</span>
            <FilterPill label="IN-PERSON"  active={formatFilter === 'in-person'}  onClick={() => setFormatFilter(f => f === 'in-person' ? '' : 'in-person')} />
            <FilterPill label="ONLINE"     active={formatFilter === 'online'}     onClick={() => setFormatFilter(f => f === 'online' ? '' : 'online')} />
            <FilterPill label="HYBRID"     active={formatFilter === 'hybrid'}     onClick={() => setFormatFilter(f => f === 'hybrid' ? '' : 'hybrid')} />

            <div className="w-px h-5 mx-1" style={{ backgroundColor: '#DDD4C0' }} />

            <span className="text-xs font-semibold mr-1" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>Level:</span>
            <FilterPill label="SCHOOL"     active={levelFilter === 'school'}     onClick={() => setLevelFilter(l => l === 'school' ? '' : 'school')} />
            <FilterPill label="UNIVERSITY" active={levelFilter === 'university'} onClick={() => setLevelFilter(l => l === 'university' ? '' : 'university')} />
            <FilterPill label="BOTH"       active={levelFilter === 'both'}       onClick={() => setLevelFilter(l => l === 'both' ? '' : 'both')} />

            <div className="w-px h-5 mx-1" style={{ backgroundColor: '#DDD4C0' }} />

            <FilterPill label="APPLICATIONS OPEN" active={applicationsOpen} onClick={() => setApplicationsOpen(v => !v)} />

            <div className="w-px h-5 mx-1" style={{ backgroundColor: '#DDD4C0' }} />

            <span className="text-xs font-semibold mr-1" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>Continent:</span>
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
                className="ml-auto text-xs underline focus:outline-none"
                style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}
              >
                Clear all
              </button>
            )}
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 px-6 md:px-14 py-10">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl animate-pulse"
                  style={{ height: '192px', backgroundColor: '#DDD4C0' }}
                />
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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
            backgroundColor: '#F6F1E9',
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
