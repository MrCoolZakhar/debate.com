'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Search, SlidersHorizontal, ArrowLeft, LayoutGrid, Rows3, Users, ArrowRight, Check,
  CalendarDays, Ticket, Globe, ChevronDown, CalendarArrowUp, CalendarArrowDown,
} from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import { Emoji3D } from '@/components/neu';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { supabase } from '@/lib/supabase';
import { getCountryByName, UN_COUNTRIES } from '@/lib/countries';
import { FlagImg } from '@/components/FlagImg';
import { currencySymbol, formatFeeAmount } from '@/lib/utils';
import { ConferenceCard } from '../ConferenceCard';

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

// User-facing labels for student_level DB values ('school' stays 'school' in the DB).
const LEVEL_LABELS: Record<string, string> = {
  school: 'High School',
  university: 'University',
  both: 'HS & Uni',
};

const FORMAT_LABELS: Record<string, string> = {
  'in-person': 'In person',
  'online': 'Online',
  'hybrid': 'Hybrid',
};

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
  organizer_id: string | null;
}

// Resolve a Vercel ISO-3166 alpha-2 code (e.g. "GB") to a full country name
// so it can be matched against conference.country ("United Kingdom").
function countryNameFromCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const hit = UN_COUNTRIES.find(c => c.code.toUpperCase() === code.toUpperCase());
  return hit?.name ?? null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function FilterPill({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3.5 py-2 rounded-full text-[11.5px] font-bold transition-all focus:outline-none"
      style={{
        backgroundColor: active ? '#1B3828' : '#FAF8F3',
        color: active ? '#EED98A' : '#1C1410',
        border: active ? '1px solid #1B3828' : '1.5px solid #D8CDB6',
        fontFamily: "'Outfit', sans-serif",
        letterSpacing: '0.07em',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        if (active) return;
        (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.06)';
        (e.currentTarget as HTMLElement).style.color = '#1B3828';
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(27,56,40,0.35)';
      }}
      onMouseLeave={(e) => {
        if (active) return;
        (e.currentTarget as HTMLElement).style.backgroundColor = '#FAF8F3';
        (e.currentTarget as HTMLElement).style.color = '#1C1410';
        (e.currentTarget as HTMLElement).style.borderColor = '#D8CDB6';
      }}
    >
      {label}
    </button>
  );
}

// ── View toggle (grid / list) ─────────────────────────────────────────────

const VIEW_STORAGE_KEY = 'gavelling-explore-view';
type ExploreView = 'grid' | 'list';

function ViewToggle({ view, onChange }: { view: ExploreView; onChange: (v: ExploreView) => void }) {
  const options: { key: ExploreView; icon: typeof LayoutGrid; label: string }[] = [
    { key: 'grid', icon: LayoutGrid, label: 'Grid view' },
    { key: 'list', icon: Rows3, label: 'List view' },
  ];
  return (
    <div
      className="flex items-center flex-shrink-0"
      role="group"
      aria-label="View"
      style={{
        backgroundColor: 'rgba(237,231,216,0.5)',
        border: '1px solid rgba(221,212,192,0.9)',
        borderRadius: 9999,
        padding: '4px',
        gap: '3px',
      }}
    >
      {options.map(({ key, icon: Icon, label }) => {
        const active = view === key;
        return (
          <button
            key={key}
            type="button"
            aria-label={label}
            aria-pressed={active}
            title={label}
            onClick={() => onChange(key)}
            className="flex items-center justify-center rounded-full transition-colors focus:outline-none"
            style={{
              width: '38px', height: '32px',
              backgroundColor: active ? '#1B3828' : 'transparent',
              color: active ? '#EED98A' : '#4A4238',
              boxShadow: active ? '0 2px 6px rgba(27,56,40,0.25)' : 'none',
            }}
            onMouseEnter={(e) => {
              if (active) return;
              (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.08)';
              (e.currentTarget as HTMLElement).style.color = '#1B3828';
            }}
            onMouseLeave={(e) => {
              if (active) return;
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              (e.currentTarget as HTMLElement).style.color = '#4A4238';
            }}
          >
            <Icon size={17} strokeWidth={2.25} />
          </button>
        );
      })}
    </div>
  );
}

// ── Date sort toggle (soonest ↔ latest) ───────────────────────────────────

type DateSort = 'asc' | 'desc';

function DateSortChip({ sort, onToggle }: { sort: DateSort; onToggle: () => void }) {
  const soonest = sort === 'asc';
  const Icon = soonest ? CalendarArrowUp : CalendarArrowDown;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={soonest ? 'Sorted by date, soonest first — click for latest first' : 'Sorted by date, latest first — click for soonest first'}
      title={soonest ? 'Date · soonest first' : 'Date · latest first'}
      className="flex items-center gap-1.5 rounded-full py-2.5 px-4 font-bold text-[12.5px] transition-colors focus:outline-none flex-shrink-0"
      style={{
        backgroundColor: 'rgba(237,231,216,0.5)',
        color: '#4A4238',
        border: '1px solid rgba(221,212,192,0.9)',
        fontFamily: "'Outfit', sans-serif",
        letterSpacing: '0.07em',
        fontVariantNumeric: 'tabular-nums',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.08)';
        (e.currentTarget as HTMLElement).style.color = '#1B3828';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(237,231,216,0.5)';
        (e.currentTarget as HTMLElement).style.color = '#4A4238';
      }}
    >
      <Icon size={15} strokeWidth={2.25} />
      DATE
      <span aria-hidden style={{ fontSize: '12.5px', lineHeight: 1 }}>{soonest ? '↑' : '↓'}</span>
    </button>
  );
}

// ── Region control (user country · all · continents) ─────────────────────

function RegionControl({
  region, userCountry, onChange,
}: {
  region: string; // '' = all, 'country' = user country, else continent key
  userCountry: string | null;
  onChange: (r: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const userCode = userCountry ? getCountryByName(userCountry)?.code : undefined;

  const currentLabel =
    region === 'country' && userCountry ? (
      <>
        {userCode && <FlagImg code={userCode} size={17} />}
        <span className="truncate">{userCountry.toUpperCase()}</span>
      </>
    ) : region && CONTINENT_LABELS[region] ? (
      <span className="truncate">{CONTINENT_LABELS[region].toUpperCase()}</span>
    ) : (
      <>
        <Emoji3D name="Globe with meridians" size={18} fallback={Globe} fallbackColor="#4A4238" style={{ filter: 'none' }} />
        <span className="truncate">ALL REGIONS</span>
      </>
    );

  const optionStyle = (active: boolean): React.CSSProperties => ({
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 700,
    fontSize: '12.5px',
    letterSpacing: '0.06em',
    color: active ? '#EED98A' : '#1C1410',
    backgroundColor: active ? '#1B3828' : 'transparent',
    width: '100%',
    textAlign: 'left' as const,
    padding: '10px 13px',
    borderRadius: '11px',
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
    whiteSpace: 'nowrap',
  });

  function pick(r: string) {
    onChange(r);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Region"
        className="flex items-center gap-2 rounded-full py-2.5 px-4 font-bold text-[12.5px] transition-colors focus:outline-none"
        style={{
          backgroundColor: region ? '#1B3828' : 'rgba(237,231,216,0.5)',
          color: region ? '#EED98A' : '#4A4238',
          border: region ? '1px solid #1B3828' : '1px solid rgba(221,212,192,0.9)',
          fontFamily: "'Outfit', sans-serif",
          letterSpacing: '0.07em',
          maxWidth: '210px',
        }}
        onMouseEnter={(e) => {
          if (region) return;
          (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.08)';
          (e.currentTarget as HTMLElement).style.color = '#1B3828';
        }}
        onMouseLeave={(e) => {
          if (region) return;
          (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(237,231,216,0.5)';
          (e.currentTarget as HTMLElement).style.color = '#4A4238';
        }}
      >
        {currentLabel}
        <ChevronDown size={14} strokeWidth={2.5} style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 180ms ease' }} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Region"
          className="absolute right-0 z-50 mt-2 p-2"
          style={{
            minWidth: '236px',
            backgroundColor: '#FAF8F3',
            border: '1px solid rgba(221,212,192,0.95)',
            borderRadius: '16px',
            boxShadow: '0 16px 44px rgba(27,56,40,0.16), 0 2px 8px rgba(27,56,40,0.08)',
          }}
        >
          {userCountry && (
            <>
              <button role="option" aria-selected={region === 'country'} style={optionStyle(region === 'country')} onClick={() => pick('country')}
                onMouseEnter={(e) => { if (region !== 'country') (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.06)'; }}
                onMouseLeave={(e) => { if (region !== 'country') (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
              >
                {userCode && <FlagImg code={userCode} size={17} />}
                {userCountry.toUpperCase()}
                <span style={{ marginLeft: 'auto', fontSize: '9.5px', letterSpacing: '0.12em', color: region === 'country' ? 'rgba(238,217,138,0.75)' : '#B6871F' }}>NEAR YOU</span>
              </button>
              <div className="my-1 h-px" style={{ backgroundColor: 'rgba(221,212,192,0.7)' }} />
            </>
          )}
          <button role="option" aria-selected={region === ''} style={optionStyle(region === '')} onClick={() => pick('')}
            onMouseEnter={(e) => { if (region !== '') (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.06)'; }}
            onMouseLeave={(e) => { if (region !== '') (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <Emoji3D name="Globe with meridians" size={17} fallback={Globe} fallbackColor={region === '' ? '#EED98A' : '#1C1410'} style={{ filter: 'none' }} />
            ALL REGIONS
          </button>
          {CONTINENT_KEYS.map(key => (
            <button key={key} role="option" aria-selected={region === key} style={optionStyle(region === key)} onClick={() => pick(key)}
              onMouseEnter={(e) => { if (region !== key) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.06)'; }}
              onMouseLeave={(e) => { if (region !== key) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              {CONTINENT_LABELS[key].toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── List row (myMUN-style directory row) ──────────────────────────────────

// Two-line date range: "Jul 13 – Jul 17" over "2026".
function splitDateRange(start: string, end: string): { range: string; year: string } {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const range = `${months[s.getMonth()]} ${s.getDate()} – ${months[e.getMonth()]} ${e.getDate()}`;
  const year = s.getFullYear() === e.getFullYear()
    ? String(s.getFullYear())
    : `${s.getFullYear()}–${String(e.getFullYear()).slice(2)}`;
  return { range, year };
}

function RowChip({ label }: { label: string }) {
  return (
    <span
      className="inline-flex flex-shrink-0"
      style={{
        fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: '10.5px', letterSpacing: '0.09em',
        color: '#6B5F52', backgroundColor: 'transparent',
        border: '1px solid rgba(154,138,120,0.45)',
        padding: '3.5px 10px', borderRadius: 9999, whiteSpace: 'nowrap',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </span>
  );
}

function ConferenceListRow({
  conf, applied, member, hovered, onHover, onLeave,
}: {
  conf: Conference;
  applied: boolean;
  /** Viewer is already part of this conference (organizer / chair / delegate) — takes precedence over `applied`. */
  member: boolean;
  hovered: boolean;
  onHover: () => void;
  onLeave: () => void;
}) {
  const router = useRouter();
  const href = `/conferences/${conf.slug}`;
  const countryObj = getCountryByName(conf.country);
  const initials = conf.acronym.slice(0, 3).toUpperCase();
  const { range, year } = splitDateRange(conf.start_date, conf.end_date);
  const formatLabel = FORMAT_LABELS[conf.format] ?? conf.format;
  const levelLabel = LEVEL_LABELS[conf.student_level];

  // CTA navigates itself and stops the click reaching the row link.
  function onCta(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    router.push(href);
  }

  const ctaBase: React.CSSProperties = {
    fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: '12px', letterSpacing: '0.07em',
    padding: '9px 18px', borderRadius: 9999, border: 'none', cursor: 'pointer',
  };

  return (
    <Link
      href={href}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className="flex items-center gap-4 md:gap-6 px-2 md:px-4"
      style={{
        paddingTop: '22px',
        paddingBottom: '22px',
        backgroundColor: hovered ? 'rgba(27,56,40,0.035)' : 'transparent',
        borderBottom: '1px solid rgba(221,212,192,0.6)',
        textDecoration: 'none',
        transition: 'background-color 160ms ease',
      }}
    >
      {/* Round logo — near-white disc, forest fallback with acronym initials */}
      <div
        className="flex-shrink-0 flex items-center justify-center overflow-hidden"
        style={{
          width: '64px', height: '64px', borderRadius: '9999px',
          backgroundColor: conf.logo_url ? '#FDFCF9' : '#1B3828',
          border: '1px solid rgba(221,212,192,0.8)',
          boxShadow: hovered ? '0 6px 16px rgba(27,56,40,0.16)' : '0 3px 8px rgba(27,56,40,0.10)',
          padding: conf.logo_url ? '8px' : 0,
          transition: 'box-shadow 160ms ease',
        }}
      >
        {conf.logo_url ? (
          <img
            src={conf.logo_url}
            alt={conf.acronym}
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        ) : (
          <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: '15px', letterSpacing: '0.06em', color: '#EED98A', fontVariantNumeric: 'tabular-nums' }}>
            {initials}
          </span>
        )}
      </div>

      {/* Name · city/country with flag · badge chips */}
      <div className="min-w-0" style={{ flex: '0 1 auto', maxWidth: '460px' }}>
        <div
          className="truncate"
          style={{
            fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: '18px',
            letterSpacing: '0.003em', color: hovered ? '#1B3828' : '#1C1410',
            transition: 'color 160ms ease', lineHeight: 1.2,
          }}
        >
          {conf.full_name}
        </div>
        <div
          className="flex items-center gap-2 truncate"
          style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 500, fontSize: '14px', color: '#6B5F52', marginTop: '5px' }}
        >
          {countryObj && <FlagImg code={countryObj.code} size={18} className="flex-shrink-0" />}
          <span className="truncate">{conf.city}, {conf.country}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-2.5">
          {conf.format && <RowChip label={formatLabel} />}
          {levelLabel && <RowChip label={levelLabel} />}
          {/* Mobile-only inline date (right columns hidden below sm) */}
          <span
            className="sm:hidden inline-flex items-center gap-1.5 flex-shrink-0"
            style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: '12px', color: '#8A7D6C', whiteSpace: 'nowrap' }}
          >
            <CalendarDays size={13} style={{ color: '#9A8A78' }} />
            {range} {year}
          </span>
        </div>
      </div>

      {/* Right rail — the three metadata columns spread evenly across the free
          space so the row reads full instead of leaving a wide empty gutter. */}
      <div
        className="hidden sm:flex items-center flex-1 min-w-0"
        style={{ justifyContent: 'space-around', gap: '20px' }}
      >
      {/* Date (two-line) */}
      <div className="flex items-start gap-2 flex-shrink-0" style={{ width: '152px' }}>
        <CalendarDays size={18} strokeWidth={2} style={{ color: '#2A5A3C', marginTop: '2px', flexShrink: 0 }} />
        <div style={{ fontFamily: "'Outfit', sans-serif", fontVariantNumeric: 'tabular-nums' }}>
          <div style={{ fontWeight: 700, fontSize: '14.5px', color: '#1C1410', whiteSpace: 'nowrap' }}>{range}</div>
          <div style={{ fontWeight: 500, fontSize: '13px', color: '#9A8A78', marginTop: '2px' }}>{year}</div>
        </div>
      </div>

      {/* Delegates */}
      <div className="hidden lg:flex items-center gap-2 flex-shrink-0" style={{ width: '96px' }}>
        <Users size={18} strokeWidth={2} style={{ color: '#9A8A78', flexShrink: 0 }} />
        <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: '15px', color: '#1C1410' }}>
          {conf.expected_delegates.toLocaleString()}
        </span>
      </div>

      {/* Fee — a gold 3D ticket for paid conferences, forest FREE pill otherwise */}
      <div className="hidden md:flex items-center gap-2 flex-shrink-0" style={{ width: '118px' }}>
        {conf.fee_amount === 0 ? (
          <span
            style={{
              fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: '12px', letterSpacing: '0.08em',
              color: '#2A5A3C', backgroundColor: 'rgba(42,90,60,0.10)',
              border: '1px solid rgba(42,90,60,0.28)', padding: '4px 12px', borderRadius: 9999,
            }}
          >
            FREE
          </span>
        ) : (
          <>
            <Emoji3D name="Ticket" size={20} fallback={Ticket} fallbackColor="#B6871F" />
            <span className="inline-flex items-baseline gap-0.5">
              <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: '13px', color: '#B6871F' }}>
                {currencySymbol(conf.fee_currency)}
              </span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: '15px', color: '#1C1410' }}>
                {formatFeeAmount(conf.fee_amount)}
              </span>
            </span>
          </>
        )}
      </div>
      </div>

      {/* CTA — member (part of the conference) > applied > apply */}
      <div className="hidden sm:flex justify-end flex-shrink-0" style={{ width: '124px' }}>
        {member ? (
          <button type="button" onClick={onCta} className="inline-flex items-center gap-1.5 focus:outline-none"
            style={{
              ...ctaBase,
              color: '#EAF5EE', backgroundColor: '#2A5A3C',
              boxShadow: '0 3px 8px rgba(27,56,40,0.25), 0 0 0 1px rgba(127,214,160,0.45)',
            }}
          >
            VIEW
            <ArrowRight size={13} strokeWidth={2.75} />
          </button>
        ) : applied ? (
          <button type="button" onClick={onCta} className="inline-flex items-center gap-1.5 focus:outline-none"
            style={{
              ...ctaBase, fontSize: '11px',
              color: '#EAF5EE', backgroundColor: '#2A5A3C',
              boxShadow: '0 3px 8px rgba(27,56,40,0.25), 0 0 0 1px rgba(127,214,160,0.45)',
            }}
          >
            APPLIED
            <Check size={13} strokeWidth={3} />
          </button>
        ) : (
          <button type="button" onClick={onCta} className="inline-flex items-center gap-1.5 focus:outline-none"
            style={{
              ...ctaBase,
              color: '#1B3828', backgroundColor: hovered ? '#F3E3A1' : '#EED98A',
              boxShadow: '0 3px 8px rgba(182,135,31,0.28), 0 0 0 1px rgba(182,135,31,0.22)',
              transition: 'background-color 180ms ease',
            }}
          >
            APPLY
            <ArrowRight size={13} strokeWidth={2.75} />
          </button>
        )}
      </div>
    </Link>
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
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Region: '' = all regions, 'country' = visitor's own country, else a continent key.
  // A ?continent= URL param wins over the geo default.
  const [region, setRegion] = useState<string>(() => searchParams.get('continent') ?? '');
  const [regionTouched, setRegionTouched] = useState<boolean>(() => !!searchParams.get('continent'));
  function changeRegion(r: string) {
    setRegion(r);
    setRegionTouched(true);
  }

  // Date sort — soonest-first by default, one click flips to latest-first.
  const [dateSort, setDateSort] = useState<DateSort>('asc');

  // Grid / list view — restored from localStorage after mount (SSR-safe).
  const [view, setView] = useState<ExploreView>('grid');
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
      if (stored === 'grid' || stored === 'list') setView(stored);
    } catch { /* private mode etc. — keep default */ }
  }, []);
  function changeView(v: ExploreView) {
    setView(v);
    try { window.localStorage.setItem(VIEW_STORAGE_KEY, v); } catch { /* ignore */ }
  }

  useEffect(() => {
    async function fetchConferences() {
      setLoading(true);
      const { data } = await supabase
        .from('conferences')
        .select('id, slug, full_name, acronym, country, city, start_date, end_date, expected_delegates, fee_amount, fee_currency, format, student_level, logo_url, banner_url, is_public, organizer_id')
        .eq('is_public', true)
        .order('start_date', { ascending: true });
      setConferences((data as Conference[]) ?? []);
      setLoading(false);
    }
    fetchConferences();
  }, []);

  // Visitor's country — /api/geo (Vercel edge headers), falling back to a
  // keyless IP lookup in local dev. Best-effort; null keeps region = ALL.
  const [userCountry, setUserCountry] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/geo');
        if (res.ok) {
          const data = await res.json();
          const country = countryNameFromCode(data.countryCode) ?? (data.country ? countryNameFromCode(data.country) : null);
          if (!cancelled && country) {
            setUserCountry(country);
            return;
          }
        }
      } catch { /* fall through to the keyless lookup */ }
      try {
        const res = await fetch('https://ipapi.co/json/');
        if (res.ok) {
          const data = await res.json();
          const country = countryNameFromCode(data.country_code) ?? (typeof data.country_name === 'string' && getCountryByName(data.country_name) ? data.country_name : null);
          if (!cancelled && country) setUserCountry(country);
        }
      } catch { /* geolocation is best-effort — leave null */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Default the region to the visitor's country once — when geo resolved and
  // the visitor hasn't touched the control. Zero local conferences shows the
  // country empty state with its "explore all" reset. Geo failure → ALL.
  const geoDefaultApplied = useRef(false);
  useEffect(() => {
    if (geoDefaultApplied.current || regionTouched || loading || !userCountry) return;
    geoDefaultApplied.current = true;
    setRegion('country');
  }, [userCountry, loading, regionTouched]);

  // Conference ids the signed-in viewer already applied to — cards show
  // APPLIED instead of the APPLY pill. Conference ids the viewer is already
  // PART of (organizer, chair, or delegate with an accepted/assigned/checked-in
  // application) show VIEW instead. RLS returns only the viewer's own rows.
  // Two batched queries — never per-row lookups. Anonymous viewer → empty sets.
  const { user, session, loading: authLoading } = useAuth();
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (authLoading) return;
    if (!user || !session) { setAppliedIds(new Set()); setMemberIds(new Set()); return; }
    let cancelled = false;
    (async () => {
      const authed = getAuthedClient(session.access_token);
      const [appsRes, orgRes] = await Promise.all([
        authed.from('applications').select('conference_id, status').eq('user_id', user.id),
        authed.from('conference_organizers').select('conference_id').eq('user_id', user.id),
      ]);
      if (cancelled) return;
      const apps = (appsRes.data as { conference_id: string; status: string }[]) ?? [];
      setAppliedIds(new Set(apps.map(a => a.conference_id)));
      const MEMBER_STATUSES = new Set(['accepted', 'assigned', 'checked-in']);
      const members = new Set<string>();
      for (const a of apps) if (MEMBER_STATUSES.has(a.status)) members.add(a.conference_id);
      for (const o of ((orgRes.data as { conference_id: string }[]) ?? [])) members.add(o.conference_id);
      setMemberIds(members);
    })();
    return () => { cancelled = true; };
  }, [authLoading, user, session]);

  // Owner check rides on the conference rows themselves (organizer_id).
  const isMember = (c: Conference) =>
    memberIds.has(c.id) || (!!user && c.organizer_id === user.id);

  const countryMode = region === 'country' && !!userCountry;

  const filtered = useMemo(() => conferences.filter(c => {
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
    if (countryMode) {
      if (c.country.toLowerCase() !== userCountry!.toLowerCase()) return false;
    } else if (region && region !== 'country') {
      const countries = CONTINENT_COUNTRIES[region];
      if (!countries || !countries.includes(c.country)) return false;
    }
    return true;
  }), [conferences, searchQuery, formatFilter, levelFilter, region, countryMode, userCountry]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => dateSort === 'asc'
      ? a.start_date.localeCompare(b.start_date)
      : b.start_date.localeCompare(a.start_date));
    return copy;
  }, [filtered, dateSort]);

  // Country tab shows up to 4 local conferences prominently.
  const displayed = countryMode ? sorted.slice(0, 4) : sorted;

  function clearFilters() {
    setFormatFilter('');
    setLevelFilter('');
    setApplicationsOpen(false);
    setRegion('');
    setRegionTouched(true);
    setSearchQuery('');
  }

  const hasActiveFilters = !!formatFilter || !!levelFilter || applicationsOpen || !!searchQuery || (!!region && region !== 'country');

  const userCode = userCountry ? getCountryByName(userCountry)?.code : undefined;

  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundColor: '#EDE7D8', overflowX: 'clip' }}>
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
            className="inline-flex items-center gap-1.5 text-[11px] mb-6 transition-colors font-semibold"
            style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
          >
            <ArrowLeft size={13} strokeWidth={2.25} />
            Back to conferences
          </Link>

          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <p
                className="mb-2 font-bold"
                style={{ fontFamily: "'Outfit', sans-serif", fontSize: '12px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#B6871F' }}
              >
                Conference directory
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

        {/* ── Floating glass filter bar — one uncrowded row ─────────── */}
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
            <div className="flex items-center gap-2.5 px-2.5 py-2.5 md:px-4 flex-wrap md:flex-nowrap">
              {/* Search */}
              <div className="relative flex items-center flex-1" style={{ minWidth: '190px' }}>
                <Search size={18} className="absolute left-3.5 pointer-events-none" style={{ color: '#9A8A78' }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, city, country…"
                  className="w-full py-2.5 pl-11 pr-3 text-[15px] focus:outline-none"
                  style={{
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: '#1C1410',
                    fontFamily: "'Outfit', sans-serif",
                  }}
                />
              </div>

              {/* Hairline divider */}
              <div className="hidden md:block w-px h-7 flex-shrink-0" style={{ backgroundColor: 'rgba(221,212,192,0.9)' }} />

              {/* Region — visitor's country first, then all / continents */}
              <RegionControl region={region} userCountry={userCountry} onChange={changeRegion} />

              {/* Date sort — soonest ↔ latest */}
              <DateSortChip sort={dateSort} onToggle={() => setDateSort(s => (s === 'asc' ? 'desc' : 'asc'))} />

              {/* View toggle (grid / list) */}
              <ViewToggle view={view} onChange={changeView} />

              {/* Hairline divider */}
              <div className="hidden md:block w-px h-7 flex-shrink-0" style={{ backgroundColor: 'rgba(221,212,192,0.9)' }} />

              {/* Filters toggle — format / level / applications live in the drawer */}
              <button
                onClick={() => setFiltersOpen(v => !v)}
                className="flex items-center gap-2 rounded-full py-2.5 px-4 font-bold text-[12.5px] transition-colors focus:outline-none flex-shrink-0"
                style={{
                  backgroundColor: filtersOpen ? '#1B3828' : 'rgba(237,231,216,0.5)',
                  color: filtersOpen ? '#EED98A' : '#4A4238',
                  border: filtersOpen ? '1px solid #1B3828' : '1px solid rgba(221,212,192,0.9)',
                  fontFamily: "'Outfit', sans-serif",
                  letterSpacing: '0.07em',
                }}
              >
                <SlidersHorizontal size={15} />
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
                <span className="text-[11px] font-bold mr-1" style={{ color: '#6B5F52', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.14em', textTransform: 'uppercase' }}>Format</span>
                <FilterPill label="IN-PERSON"  active={formatFilter === 'in-person'}  onClick={() => setFormatFilter(f => f === 'in-person' ? '' : 'in-person')} />
                <FilterPill label="ONLINE"     active={formatFilter === 'online'}     onClick={() => setFormatFilter(f => f === 'online' ? '' : 'online')} />
                <FilterPill label="HYBRID"     active={formatFilter === 'hybrid'}     onClick={() => setFormatFilter(f => f === 'hybrid' ? '' : 'hybrid')} />

                <div className="w-px h-5 mx-1" style={{ backgroundColor: 'rgba(221,212,192,0.9)' }} />

                <span className="text-[11px] font-bold mr-1" style={{ color: '#6B5F52', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.14em', textTransform: 'uppercase' }}>Level</span>
                <FilterPill label="HIGH SCHOOL" active={levelFilter === 'school'}     onClick={() => setLevelFilter(l => l === 'school' ? '' : 'school')} />
                <FilterPill label="UNIVERSITY" active={levelFilter === 'university'} onClick={() => setLevelFilter(l => l === 'university' ? '' : 'university')} />
                <FilterPill label="BOTH"       active={levelFilter === 'both'}       onClick={() => setLevelFilter(l => l === 'both' ? '' : 'both')} />

                <div className="w-px h-5 mx-1" style={{ backgroundColor: 'rgba(221,212,192,0.9)' }} />

                <FilterPill label="APPLICATIONS OPEN" active={applicationsOpen} onClick={() => setApplicationsOpen(v => !v)} />

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
          {!loading && displayed.length > 0 && (
            <div className="flex items-center gap-4 mb-7">
              <span className="inline-flex items-center gap-2" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: '11.5px', letterSpacing: '0.13em', color: '#9A8A78', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                {countryMode ? (
                  <>
                    {userCode && <FlagImg code={userCode} size={17} />}
                    NEAR YOU — {displayed.length < sorted.length
                      ? `${displayed.length} OF ${sorted.length}`
                      : displayed.length} IN {userCountry!.toUpperCase()}
                  </>
                ) : (
                  <>
                    <Emoji3D name="Globe with meridians" size={17} fallback={Globe} fallbackColor="#9A8A78" style={{ filter: 'none' }} />
                    SHOWING {sorted.length} {sorted.length === 1 ? 'CONFERENCE' : 'CONFERENCES'}
                  </>
                )}
              </span>
              <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(221,212,192,0.8)' }} />
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
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
          ) : displayed.length === 0 ? (
            countryMode && !searchQuery && !formatFilter && !levelFilter ? (
              /* Country tab is empty — soft local empty state with a reset. */
              <div className="flex flex-col items-center justify-center py-24 text-center">
                {userCode && <FlagImg code={userCode} size={40} />}
                <h2 className="font-semibold text-lg mt-5 mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                  No conferences in {userCountry} yet
                </h2>
                <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                  Be the first to bring one home — or browse the worldwide directory.
                </p>
                <button
                  onClick={() => changeRegion('')}
                  className="rounded-xl py-3 px-6 font-bold text-sm tracking-widest transition-colors focus:outline-none"
                  style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.07em' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
                >
                  EXPLORE ALL CONFERENCES →
                </button>
              </div>
            ) : (
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
            )
          ) : view === 'list' ? (
            <div style={{ borderTop: '1px solid rgba(221,212,192,0.6)' }}>
              {displayed.map(conf => (
                <ConferenceListRow
                  key={conf.id}
                  conf={conf}
                  applied={appliedIds.has(conf.id)}
                  member={isMember(conf)}
                  hovered={hoveredId === conf.id}
                  onHover={() => setHoveredId(conf.id)}
                  onLeave={() => setHoveredId(null)}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
              {displayed.map(conf => (
                <ConferenceCard
                  key={conf.id}
                  conf={conf}
                  applied={appliedIds.has(conf.id)}
                  member={isMember(conf)}
                  hovered={hoveredId === conf.id}
                  onHover={() => setHoveredId(conf.id)}
                  onLeave={() => setHoveredId(null)}
                  onClick={() => router.push(`/conferences/${conf.slug}`)}
                />
              ))}
            </div>
          )}

          {/* Country tab — subtle reset to the worldwide directory */}
          {!loading && countryMode && displayed.length > 0 && (
            <div className="flex justify-center mt-10">
              <button
                onClick={() => changeRegion('')}
                className="inline-flex items-center gap-1.5 focus:outline-none transition-colors"
                style={{
                  fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: '11px',
                  letterSpacing: '0.1em', color: '#9A8A78',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  textTransform: 'uppercase',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
              >
                <Globe size={13} strokeWidth={2.25} />
                Explore all conferences
                <ArrowRight size={12} strokeWidth={2.5} />
              </button>
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
