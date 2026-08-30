'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Search, SlidersHorizontal, ArrowLeft, LayoutGrid, Rows3, Users, ArrowRight, Check,
  CalendarDays, Ticket, Globe, CalendarArrowUp, CalendarArrowDown,
  MapPin, Monitor, School, GraduationCap, Plus,
} from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import FooterLegal from '@/components/FooterLegal';
import { Emoji3D } from '@/components/neu';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { supabase } from '@/lib/supabase';
import { getCountryByName, UN_COUNTRIES } from '@/lib/countries';
import { FlagImg } from '@/components/FlagImg';
import { currencySymbol, formatFeeAmountCompact } from '@/lib/utils';
import { fetchDelegateFees, applyDelegateFee } from '@/lib/publicFees';
import { compareStartDate, hasConcluded, splitConferenceDates } from '@/lib/conferenceDates';
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

// Small lucide icons that showcase HOW a conference happens, so a row reads at
// a glance: format (where it meets) and student level (who it is for).
type RowIcon = React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;

const FORMAT_ICONS: Record<string, RowIcon> = {
  'in-person': MapPin,   // meets in a physical place
  'online': Monitor,     // meets on screen
  'hybrid': Globe,       // both worlds
};

const LEVEL_ICONS: Record<string, RowIcon> = {
  school: School,             // high school
  university: GraduationCap,  // university
  both: GraduationCap,        // HS & Uni
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

// ── List row (myMUN-style directory row) ──────────────────────────────────

// Two-line date range: "Jul 13 – Jul 17" over "2026". A one-day conference
// collapses to just "Aug 30".
function splitDateRange(start: string | null, end: string | null): { range: string; year: string } {
  return splitConferenceDates(start, end);
}

function RowChip({ label, icon: Icon }: { label: string; icon?: RowIcon }) {
  return (
    <span
      className="inline-flex items-center flex-shrink-0"
      style={{
        fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: '10.5px', letterSpacing: '0.09em',
        color: '#6B5F52', backgroundColor: 'transparent',
        border: '1px solid rgba(154,138,120,0.45)',
        gap: '5px',
        padding: Icon ? '3.5px 10px 3.5px 8px' : '3.5px 10px', borderRadius: 9999, whiteSpace: 'nowrap',
        textTransform: 'uppercase',
      }}
    >
      {Icon && <Icon size={12.5} strokeWidth={2.25} style={{ color: '#2A5A3C', flexShrink: 0 }} />}
      {label}
    </span>
  );
}

function ConferenceListRow({
  conf, applied, member, hovered, onHover, onLeave,
}: {
  conf: Conference;
  applied: boolean;
  /** Viewer is already part of this conference (organizer / chair / delegate), takes precedence over `applied`. */
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
        borderBottom: '2px solid rgba(27,56,40,0.16)',
        textDecoration: 'none',
        transition: 'background-color 160ms ease',
      }}
    >
      {/* Round logo, near-white disc, forest fallback with acronym initials */}
      <div
        className="flex-shrink-0 flex items-center justify-center overflow-hidden"
        style={{
          width: '64px', height: '64px', borderRadius: '9999px',
          backgroundColor: conf.logo_url ? '#FDFCF9' : '#1B3828',
          border: '0.5px solid rgba(221,212,192,0.8)',
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

      {/* Name · city/country with flag · badge chips.
          Grows to absorb ALL slack so the metadata columns to its right land in
          the same position on every row (tidy, scannable columns). */}
      <div className="min-w-0" style={{ flex: '1 1 0' }}>
        <div
          className="truncate"
          style={{
            fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: '18px',
            letterSpacing: '0.003em', color: hovered ? '#1B3828' : '#1C1410',
            transition: 'color 160ms ease', lineHeight: 1.2,
          }}
        >
          {conf.acronym || conf.full_name}
        </div>
        <div
          className="flex items-center gap-2 truncate"
          style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 500, fontSize: '14px', color: '#6B5F52', marginTop: '5px' }}
        >
          {countryObj && <FlagImg code={countryObj.code} size={18} className="flex-shrink-0" />}
          <span className="truncate">{conf.city}, {conf.country}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-2.5">
          {conf.format && <RowChip label={formatLabel} icon={FORMAT_ICONS[conf.format]} />}
          {levelLabel && <RowChip label={levelLabel} icon={LEVEL_ICONS[conf.student_level]} />}
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

      {/* Right rail — fixed-width metadata columns, right-aligned. Because the
          name block absorbs all slack, date / delegates / fee sit at identical
          horizontal positions on every row so they read as tidy columns. */}
      <div
        className="hidden sm:flex items-center flex-shrink-0"
        style={{ justifyContent: 'flex-end', gap: '24px' }}
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

      {/* Fee, a gold 3D ticket for paid conferences, forest FREE pill otherwise */}
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
                {formatFeeAmountCompact(conf.fee_amount)}
              </span>
            </span>
          </>
        )}
      </div>
      </div>

      {/* CTA, member (part of the conference) > applied > apply */}
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


// ── Filter rail (mymun-style: filters live in a column beside the grid) ────
// One vertical stack of grouped controls, sticky on desktop so filtering never
// means scrolling back to the top. On narrow screens the whole rail collapses
// behind a FILTERS button and expands in flow above the results.

function RailHeading({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-2.5"
      style={{
        fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: '10px',
        letterSpacing: '0.16em', textTransform: 'uppercase', color: '#9A8A78', margin: '0 0 10px',
      }}
    >
      {children}
    </p>
  );
}

/** One filter row. Reads as a list item, not a pill: full width, a check
 *  gutter on the left so the ticked and unticked rows stay optically aligned. */
function RailOption({
  label, active, onClick, icon: Icon, flagCode, note,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: RowIcon;
  flagCode?: string;
  note?: string;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onClick={onClick}
      className="w-full flex items-center text-left focus:outline-none"
      style={{
        gap: '9px',
        padding: '7px 10px',
        borderRadius: '10px',
        backgroundColor: active ? '#1B3828' : 'transparent',
        color: active ? '#EED98A' : '#4A4238',
        border: 'none',
        cursor: 'pointer',
        fontFamily: "'Outfit', sans-serif",
        fontWeight: active ? 700 : 600,
        fontSize: '12.5px',
        transition: 'background-color 140ms ease, color 140ms ease',
      }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.06)'; }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
    >
      {flagCode ? (
        <FlagImg code={flagCode} size={16} />
      ) : Icon ? (
        <Icon size={14} strokeWidth={2.2} style={{ flexShrink: 0, color: active ? '#EED98A' : '#2A5A3C' }} />
      ) : (
        <span
          aria-hidden
          style={{
            width: '14px', height: '14px', borderRadius: '5px', flexShrink: 0,
            border: active ? '1px solid rgba(238,217,138,0.6)' : '1px solid rgba(154,138,120,0.5)',
            backgroundColor: active ? 'rgba(238,217,138,0.2)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {active && <Check size={10} strokeWidth={3.5} style={{ color: '#EED98A' }} />}
        </span>
      )}
      <span className="truncate flex-1">{label}</span>
      {note && (
        <span style={{ fontSize: '9px', letterSpacing: '0.12em', fontWeight: 800, color: active ? 'rgba(238,217,138,0.75)' : '#B6871F' }}>
          {note}
        </span>
      )}
    </button>
  );
}

function FilterRail({
  searchQuery, onSearch,
  region, userCountry, onRegion,
  formatFilter, onFormat,
  levelFilter, onLevel,
  applicationsOpen, onApplicationsOpen,
  dateSort, onDateSort,
  hasActiveFilters, onClear,
}: {
  searchQuery: string; onSearch: (v: string) => void;
  region: string; userCountry: string | null; onRegion: (r: string) => void;
  formatFilter: string; onFormat: (v: 'in-person' | 'online' | 'hybrid' | '') => void;
  levelFilter: string; onLevel: (v: 'school' | 'university' | 'both' | '') => void;
  applicationsOpen: boolean; onApplicationsOpen: (v: boolean) => void;
  dateSort: DateSort; onDateSort: (v: DateSort) => void;
  hasActiveFilters: boolean; onClear: () => void;
}) {
  const userCode = userCountry ? getCountryByName(userCountry)?.code : undefined;

  const group: React.CSSProperties = {
    paddingBottom: '16px',
    marginBottom: '16px',
    borderBottom: '1px solid rgba(221,212,192,0.85)',
  };

  return (
    <div
      style={{
        backgroundColor: 'rgba(250,248,243,0.78)',
        backdropFilter: 'blur(18px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(18px) saturate(1.4)',
        border: '1px solid rgba(221,212,192,0.9)',
        borderRadius: '20px',
        padding: '18px 16px',
        boxShadow: '0 10px 34px rgba(27,56,40,0.09), 0 1px 0 rgba(255,255,255,0.6) inset',
      }}
    >
      {/* Search */}
      <div style={group}>
        <div className="relative flex items-center">
          <Search size={16} className="absolute left-3 pointer-events-none" style={{ color: '#9A8A78' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search name or city…"
            aria-label="Search conferences"
            className="w-full py-2.5 pl-9 pr-3 text-[13px] focus:outline-none"
            style={{
              border: '1px solid rgba(221,212,192,0.9)',
              borderRadius: '11px',
              backgroundColor: '#FFFDF9',
              color: '#1C1410',
              fontFamily: "'Outfit', sans-serif",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(221,212,192,0.9)'; }}
          />
        </div>
      </div>

      {/* Region */}
      <div style={group} role="listbox" aria-label="Region">
        <RailHeading>Region</RailHeading>
        {userCountry && (
          <RailOption
            label={userCountry}
            active={region === 'country'}
            onClick={() => onRegion(region === 'country' ? '' : 'country')}
            flagCode={userCode}
            note="NEAR YOU"
          />
        )}
        <RailOption
          label="All regions"
          active={region === ''}
          onClick={() => onRegion('')}
          icon={Globe}
        />
        {CONTINENT_KEYS.map(key => (
          <RailOption
            key={key}
            label={CONTINENT_LABELS[key]}
            active={region === key}
            onClick={() => onRegion(region === key ? '' : key)}
          />
        ))}
      </div>

      {/* Format */}
      <div style={group} role="listbox" aria-label="Format">
        <RailHeading>Format</RailHeading>
        <RailOption label="In person" active={formatFilter === 'in-person'} onClick={() => onFormat(formatFilter === 'in-person' ? '' : 'in-person')} icon={MapPin} />
        <RailOption label="Online"    active={formatFilter === 'online'}    onClick={() => onFormat(formatFilter === 'online' ? '' : 'online')}    icon={Monitor} />
        <RailOption label="Hybrid"    active={formatFilter === 'hybrid'}    onClick={() => onFormat(formatFilter === 'hybrid' ? '' : 'hybrid')}    icon={Globe} />
      </div>

      {/* Level */}
      <div style={group} role="listbox" aria-label="Student level">
        <RailHeading>Level</RailHeading>
        <RailOption label="High school" active={levelFilter === 'school'}     onClick={() => onLevel(levelFilter === 'school' ? '' : 'school')}         icon={School} />
        <RailOption label="University"  active={levelFilter === 'university'} onClick={() => onLevel(levelFilter === 'university' ? '' : 'university')} icon={GraduationCap} />
        <RailOption label="Both"        active={levelFilter === 'both'}       onClick={() => onLevel(levelFilter === 'both' ? '' : 'both')} />
      </div>

      {/* Sort + applications */}
      <div style={{ ...group, borderBottom: hasActiveFilters ? group.borderBottom : 'none', marginBottom: hasActiveFilters ? 16 : 0, paddingBottom: hasActiveFilters ? 16 : 0 }}>
        <RailHeading>Sort &amp; status</RailHeading>
        <RailOption
          label={dateSort === 'asc' ? 'Soonest first' : 'Latest first'}
          active={false}
          onClick={() => onDateSort(dateSort === 'asc' ? 'desc' : 'asc')}
          icon={dateSort === 'asc' ? CalendarArrowUp : CalendarArrowDown}
        />
        <RailOption label="Applications open" active={applicationsOpen} onClick={() => onApplicationsOpen(!applicationsOpen)} />
      </div>

      {hasActiveFilters && (
        <button
          onClick={onClear}
          className="w-full focus:outline-none"
          style={{
            fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: '11px',
            letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8B2020',
            background: 'transparent', border: '1px solid rgba(139,32,32,0.25)',
            borderRadius: '10px', padding: '8px', cursor: 'pointer',
          }}
        >
          Clear all filters
        </button>
      )}
    </div>
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
  // Seed the search from a ?search= hand-off (the landing-page hero search
  // navigates here with the visitor's query) so the list filters immediately.
  // The on-page search box then owns the value as usual.
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') ?? '');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [formatFilter, setFormatFilter] = useState<'in-person' | 'online' | 'hybrid' | ''>('');
  const [levelFilter, setLevelFilter] = useState<'school' | 'university' | 'both' | ''>('');
  const [applicationsOpen, setApplicationsOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Region: '' = all regions, 'country' = visitor's own country, else a continent key.
  // A ?continent= URL param wins over the geo default.
  const [region, setRegion] = useState<string>(() => searchParams.get('continent') ?? '');
  const [regionTouched, setRegionTouched] = useState<boolean>(() => !!searchParams.get('continent'));
  // Set when geo defaults us into a whole-directory "around you" view because
  // the visitor's own country has too few conferences to lead with.
  const [aroundYouDefault, setAroundYouDefault] = useState(false);
  function changeRegion(r: string) {
    setRegion(r);
    setRegionTouched(true);
  }

  // Date sort, soonest-first by default, one click flips to latest-first.
  const [dateSort, setDateSort] = useState<DateSort>('asc');

  // Grid / list view, restored from localStorage after mount (SSR-safe).
  const [view, setView] = useState<ExploreView>('grid');
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
      if (stored === 'grid' || stored === 'list') setView(stored);
    } catch { /* private mode etc., keep default */ }
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
      const confs = (data as Conference[]) ?? [];

      // Single source of truth for the fee shown on cards: the delegate role
      // config's fee, phase-aware, falling back to the conference-level fee
      // only when no delegate role config exists (see src/lib/publicFees.ts).
      const fees = await fetchDelegateFees(supabase, confs.map(c => c.id));
      setConferences(confs.map(c => applyDelegateFee(c, fees)));
      setLoading(false);
    }
    fetchConferences();
  }, []);

  // Visitor's country, /api/geo (Vercel edge headers), falling back to a
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
      } catch { /* geolocation is best-effort, leave null */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Default view once, when geo resolved and the visitor hasn't touched the
  // control. If the visitor's country already has at least 4 conferences we
  // lead with "Conferences in {country}". Otherwise we fall back to an "around
  // you" view of the whole directory so the grid is never empty on first load,
  // rather than a discouraging country empty state. Geo failure → ALL.
  const geoDefaultApplied = useRef(false);
  useEffect(() => {
    if (geoDefaultApplied.current || regionTouched || loading || !userCountry) return;
    geoDefaultApplied.current = true;
    const localCount = conferences.filter(
      c => c.country.toLowerCase() === userCountry.toLowerCase()
    ).length;
    if (localCount >= 4) {
      setRegion('country');
    } else {
      setAroundYouDefault(true);
    }
  }, [userCountry, loading, regionTouched, conferences]);

  // Conference ids the signed-in viewer already applied to, cards show
  // APPLIED instead of the APPLY pill. Conference ids the viewer is already
  // PART of (organizer, chair, or delegate with an accepted/assigned/checked-in
  // application) show VIEW instead. RLS returns only the viewer's own rows.
  // Two batched queries, never per-row lookups. Anonymous viewer → empty sets.
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
  // Whole-directory fallback we auto-selected on first load, shown under the
  // "Conferences around you" heading. Clears the moment the visitor picks a region.
  const aroundYouMode = aroundYouDefault && region === '' && !regionTouched;

  // Headline count = every conference on the platform, published or still
  // being set up, from a definer RPC (RLS hides unpublished rows from anon, and
  // this returns counts only). It answers "how big is Gavelling", which is a
  // different question from "how many can I click right now" — the results rule
  // below the filters answers that one. Falls back to the browsable count if
  // the RPC is unavailable, so the line is never blank.
  const [totalConferences, setTotalConferences] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.rpc('public_conference_stats').then(({ data }) => {
      if (cancelled) return;
      const row = Array.isArray(data) ? data[0] : data;
      const n = (row as { total_conferences?: number } | null)?.total_conferences;
      if (typeof n === 'number' && n > 0) setTotalConferences(n);
    });
    return () => { cancelled = true; };
  }, []);
  const upcomingCount = useMemo(() => conferences.filter(c => !hasConcluded(c)).length, [conferences]);
  const headlineCount = totalConferences ?? (loading ? null : upcomingCount);

  const filtered = useMemo(() => conferences.filter(c => {
    // Finished conferences are dropped from the directory — nobody browsing for
    // one to attend wants last year's. Their pages stay live, linkable and in
    // the sitemap, so a direct link and Google search still reach them; this
    // only trims what the browse listing puts in front of people. Undated
    // ("dates TBD") conferences are never treated as finished.
    if (hasConcluded(c)) return false;
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
    // Undated (TBD) conferences sort last in BOTH directions, and a null
    // start_date must never reach .localeCompare — see compareStartDate.
    copy.sort((a, b) => compareStartDate(a.start_date, b.start_date, dateSort === 'asc' ? 'asc' : 'desc'));
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
        <SiteNav hideLanguage />

        {/* ── Editorial header ─────────────────────────────────────── */}
        <header className="px-6 md:px-10 pt-8 pb-7">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[11px] mb-5 transition-colors font-semibold"
            style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
          >
            <ArrowLeft size={13} strokeWidth={2.25} />
            Back to conferences
          </Link>

          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
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
                  fontSize: 'clamp(32px, 4vw, 52px)', lineHeight: 1.02, color: '#1C1410', margin: 0,
                }}
              >
                Explore{' '}
                <span style={{ color: '#1B3828' }}>Conferences</span>
                <span style={{ color: '#B6871F' }}>.</span>
              </h1>
              <p
                className="mt-2.5"
                style={{ fontFamily: "'Outfit', sans-serif", fontSize: '14px', color: '#8A7D6C', maxWidth: '460px', lineHeight: 1.6 }}
              >
                {headlineCount === null
                  ? 'Loading the directory…'
                  : `${headlineCount} conference${headlineCount === 1 ? '' : 's'} across every continent. Find where you debate next.`}
              </p>
            </div>

            {/* Organise: a plus and the verb. The old sentence-length label was
                the loudest thing on a page about browsing, not creating. */}
            <button
              onClick={() => router.push('/conferences/new')}
              className="self-start md:self-auto flex-shrink-0 inline-flex items-center gap-2 rounded-full py-3 px-6 font-bold text-[13px] transition-all focus:outline-none"
              style={{
                backgroundColor: '#1B3828', color: '#EED98A',
                fontFamily: "'Outfit', sans-serif", letterSpacing: '0.07em',
                border: 'none', cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(27,56,40,0.22)',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
            >
              <Plus size={17} strokeWidth={2.6} />
              ORGANISE
            </button>
          </div>
        </header>

        {/* ── Directory: filter rail beside the grid ───────────────── */}
        <main className="flex-1 px-6 md:px-10 pb-16 flex flex-col lg:flex-row" style={{ gap: '26px', alignItems: 'flex-start' }}>

          {/* Mobile: the rail folds behind one button rather than pushing the
              results a screen and a half down. */}
          <button
            onClick={() => setFiltersOpen(v => !v)}
            className="lg:hidden w-full flex items-center justify-center gap-2 rounded-full py-3 font-bold text-[12.5px] focus:outline-none"
            style={{
              backgroundColor: filtersOpen ? '#1B3828' : 'rgba(250,248,243,0.8)',
              color: filtersOpen ? '#EED98A' : '#4A4238',
              border: filtersOpen ? '1px solid #1B3828' : '1px solid rgba(221,212,192,0.9)',
              fontFamily: "'Outfit', sans-serif", letterSpacing: '0.09em', cursor: 'pointer',
            }}
          >
            <SlidersHorizontal size={15} />
            FILTERS
            {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: filtersOpen ? '#EED98A' : '#B6871F' }} />}
          </button>

          <aside
            aria-label="Filters"
            className={`${filtersOpen ? 'block' : 'hidden'} lg:block lg:sticky flex-shrink-0`}
            style={{ width: '100%', maxWidth: '250px', top: '20px' }}
          >
            <FilterRail
              searchQuery={searchQuery} onSearch={setSearchQuery}
              region={region} userCountry={userCountry} onRegion={changeRegion}
              formatFilter={formatFilter} onFormat={setFormatFilter}
              levelFilter={levelFilter} onLevel={setLevelFilter}
              applicationsOpen={applicationsOpen} onApplicationsOpen={setApplicationsOpen}
              dateSort={dateSort} onDateSort={setDateSort}
              hasActiveFilters={hasActiveFilters} onClear={clearFilters}
            />
          </aside>

          <section className="flex-1 min-w-0 w-full">
            {/* Results rule — what this column is showing, plus the one control
                that belongs to the results rather than the filters. */}
            {!loading && displayed.length > 0 && (
              <div className="flex items-center gap-4 mb-6">
                <span className="inline-flex items-center gap-2" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: '11.5px', letterSpacing: '0.13em', color: '#9A8A78', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  {aroundYouMode ? (
                    <>
                      <Emoji3D name="Globe with meridians" size={17} fallback={Globe} fallbackColor="#9A8A78" style={{ filter: 'none' }} />
                      CONFERENCES AROUND YOU
                    </>
                  ) : countryMode ? (
                    <>
                      {userCode && <FlagImg code={userCode} size={17} />}
                      CONFERENCES IN {userCountry!.toUpperCase()}
                      {displayed.length < sorted.length ? ` · ${displayed.length} OF ${sorted.length}` : ''}
                    </>
                  ) : (
                    <>
                      <Emoji3D name="Globe with meridians" size={17} fallback={Globe} fallbackColor="#9A8A78" style={{ filter: 'none' }} />
                      SHOWING {sorted.length} {sorted.length === 1 ? 'CONFERENCE' : 'CONFERENCES'}
                    </>
                  )}
                </span>
                <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(221,212,192,0.8)' }} />
                <ViewToggle view={view} onChange={changeView} />
              </div>
            )}

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" style={{ gap: '20px' }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-[20px] overflow-hidden"
                  style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}
                >
                  <div className="animate-pulse" style={{ height: '72px', backgroundColor: '#DDD4C0' }} />
                  <div className="p-4">
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
              /* Country tab is empty, soft local empty state with a reset. */
              <div className="flex flex-col items-center justify-center py-24 text-center">
                {userCode && <FlagImg code={userCode} size={40} />}
                <h2 className="font-semibold text-lg mt-5 mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                  No conferences in {userCountry} yet
                </h2>
                <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                  Be the first to bring one home, or browse the worldwide directory.
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
            <div style={{ borderTop: '2px solid rgba(27,56,40,0.16)' }}>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" style={{ gap: '20px' }}>
              {displayed.map(conf => (
                <ConferenceCard
                  key={conf.id}
                  conf={conf}
                  compact
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

          {/* Country tab, subtle reset to the worldwide directory */}
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
          </section>
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
          <FooterLegal tone="ivory" />
        </footer>
      </div>
    </div>
  );
}
