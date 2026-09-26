'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Search, SlidersHorizontal, LayoutGrid, Rows3, Users, Check,
  CalendarDays, Ticket, Globe, CalendarArrowUp, CalendarArrowDown,
  MapPin, Monitor, School, GraduationCap, Plus, Heart, X, Play,
} from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';
import { Emoji3D } from '@/components/neu';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { supabase } from '@/lib/supabase';
import { getCountryByName, getCountryByCode, UN_COUNTRIES, fold, countryIdentity, countryMatchRank } from '@/lib/countries';
import { CircleFlag } from '@/components/CircleFlag';
import { currencySymbol, formatFeeAmountCompact } from '@/lib/utils';
import { fetchDelegatePrices, withDelegatePrice, TBD_PRICE, type DelegatePrice } from '@/lib/publicFees';
import { compareStartDate, hasConcluded, splitConferenceDates } from '@/lib/conferenceDates';
import { conferenceAcronymLabel } from '@/lib/conferenceLabels';
import { ConferenceCard } from '../ConferenceCard';
import VerifiedCheck from '@/components/VerifiedCheck';
import { LogoDisc } from '@/components/LogoDisc';
import { isListedConference } from '@/lib/publicConferences';
import { fetchFeatured, recordSpotlightClick, recordSpotlightView, type FeaturedRow } from '@/lib/spotlight';
import { fetchCreditSponsoredIds } from '@/lib/creditSponsored';
import { CreditSponsoredMark, SpotlightTag, SPOTLIGHT_GLOW, SPOTLIGHT_GLOW_HOVER } from '@/components/conferences/SpotlightTag';
import ConferenceSpotlightDialog, { claimSpotlightDialog } from './ConferenceSpotlightDialog';
import { DatePicker } from '@/components/DatePicker';
import {
  DATE_OPTIONS, PRICE_OPTIONS, ROLE_OPTIONS, matchesDateBucket, matchesDateRange, matchesPrice, matchesRoles,
  parseFacets, readExploreQuery, writeExploreQuery, toDateOnly,
  type DateFilter, type FacetMap, type PriceFilter, type RoleKey,
} from './exploreFilters';

// ── Continent maps ─────────────────────────────────────────────────────────────

const CONTINENT_COUNTRIES: Record<string, string[]> = {
  'north-america': ['United States', 'Canada', 'Mexico', 'Guatemala', 'Belize', 'Honduras', 'El Salvador', 'Nicaragua', 'Costa Rica', 'Panama', 'Cuba', 'Jamaica', 'Haiti', 'Dominican Republic', 'Puerto Rico', 'Trinidad and Tobago', 'Barbados', 'Saint Lucia', 'Grenada', 'Antigua and Barbuda', 'Saint Kitts and Nevis', 'Saint Vincent and the Grenadines', 'Dominica', 'Bahamas'],
  'south-america': ['Brazil', 'Argentina', 'Colombia', 'Chile', 'Peru', 'Venezuela', 'Ecuador', 'Bolivia', 'Paraguay', 'Uruguay', 'Guyana', 'Suriname'],
  'europe': ['United Kingdom', 'Germany', 'France', 'Italy', 'Spain', 'Netherlands', 'Belgium', 'Switzerland', 'Austria', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Poland', 'Czech Republic', 'Hungary', 'Romania', 'Bulgaria', 'Greece', 'Portugal', 'Ireland', 'Croatia', 'Slovakia', 'Slovenia', 'Estonia', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Cyprus', 'Serbia', 'Bosnia and Herzegovina', 'North Macedonia', 'Albania', 'Montenegro', 'Kosovo', 'Moldova', 'Ukraine', 'Belarus', 'Russia', 'Iceland', 'Liechtenstein', 'Monaco', 'Andorra', 'San Marino'],
  'africa': ['Nigeria', 'South Africa', 'Kenya', 'Ghana', 'Ethiopia', 'Tanzania', 'Uganda', 'Rwanda', 'Senegal', 'Ivory Coast', 'Cameroon', 'Zimbabwe', 'Zambia', 'Mozambique', 'Angola', 'Sudan', 'Egypt', 'Morocco', 'Tunisia', 'Algeria', 'Libya', 'Mali', 'Niger', 'Chad', 'Somalia', 'Madagascar', 'Malawi', 'Botswana', 'Namibia', 'Lesotho', 'Eswatini', 'Eritrea', 'Djibouti', 'Comoros', 'Cape Verde', 'Sao Tome and Principe', 'Equatorial Guinea', 'Gabon', 'Republic of the Congo', 'Democratic Republic of the Congo', 'Central African Republic', 'Burundi', 'Benin', 'Togo', 'Sierra Leone', 'Liberia', 'Guinea', 'Guinea-Bissau', 'Gambia', 'Mauritania', 'Mauritius', 'Seychelles'],
  'asia': ['China', 'India', 'Japan', 'South Korea', 'Indonesia', 'Pakistan', 'Bangladesh', 'Vietnam', 'Thailand', 'Malaysia', 'Singapore', 'Philippines', 'Myanmar', 'Cambodia', 'Laos', 'Sri Lanka', 'Nepal', 'Bhutan', 'Mongolia', 'Kazakhstan', 'Uzbekistan', 'Turkmenistan', 'Kyrgyzstan', 'Tajikistan', 'Afghanistan', 'Iran', 'Iraq', 'Saudi Arabia', 'United Arab Emirates', 'Qatar', 'Kuwait', 'Bahrain', 'Oman', 'Yemen', 'Jordan', 'Lebanon', 'Syria', 'Israel', 'Palestine', 'Türkiye', 'Azerbaijan', 'Armenia', 'Georgia', 'Taiwan', 'Hong Kong', 'Macao', 'Brunei', 'East Timor', 'Maldives'],
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

// The rail's Region group, in this order (25 Sep 2026). ?continent=<key>.
const REGION_ORDER = ['africa', 'asia', 'europe', 'north-america', 'south-america', 'oceania'] as const;

// The one main button (owner's taste board two): a forest gradient rounded
// rectangle, sentence case. Second actions use SECONDARY_BUTTON.
const PRIMARY_BUTTON: React.CSSProperties = {
  background: 'linear-gradient(90deg,#1B3828 0%,#2A5A3C 55%,#1E4A31 100%)',
  color: '#FFFFFF', border: 'none', borderRadius: '11px', cursor: 'pointer',
  fontFamily: "var(--font-brand), sans-serif", fontWeight: 700,
};
const SECONDARY_BUTTON: React.CSSProperties = {
  background: '#FFFFFF', color: '#1C1410', border: '1.5px solid #1C1410', borderRadius: '11px', cursor: 'pointer',
  fontFamily: "var(--font-brand), sans-serif", fontWeight: 700,
};

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

// The rail offers two formats and two levels, because that is how people
// actually choose: can I get there in person, or do I attend from my room?
// A hybrid conference is genuinely both, so it answers to BOTH filters. Same
// for a 'both' student level. Row chips still print the real DB value
// ("Hybrid", "HS & Uni") — only the FILTER collapses the third value.
type FormatFilter = 'in-person' | 'online' | '';
type LevelFilter = 'school' | 'university' | '';

function matchesFormat(format: string, filter: FormatFilter): boolean {
  if (!filter) return true;
  return format === filter || format === 'hybrid';
}

function matchesLevel(level: string, filter: LevelFilter): boolean {
  if (!filter) return true;
  return level === filter || level === 'both';
}

// ── Country facets ─────────────────────────────────────────────────────────
// The rail's country list is derived from the conferences on the page, so it
// can never offer a country with nothing behind it. Countries are keyed by ISO
// identity so "Turkey" and "Türkiye" are one row, not two.

interface CountryFacet {
  /** countryIdentity() — ISO code where we know the country, folded name otherwise. */
  id: string;
  /** Canonical display name (Türkiye, not Turkey). */
  name: string;
  /** ISO alpha-2, when the name resolves. Missing → no flag, still filterable. */
  code?: string;
  count: number;
}


/** A conference is "worth travelling for" at this size. */
const BIG_CONFERENCE_DELEGATES = 500;
const BIG_CONFERENCE_LIMIT = 4;


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
  /** Public delegate price (publicFees.displayDelegatePrice); absent = TBD. */
  delegate_price?: DelegatePrice;
  format: string;
  student_level: string;
  logo_url: string | null;
  banner_url: string | null;
  is_public: boolean;
  is_verified?: boolean;
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
        borderRadius: '12px',
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
            className="flex items-center justify-center transition-colors focus:outline-none"
            style={{
              width: '38px', height: '32px', borderRadius: '8px',
              backgroundColor: active ? '#1B3828' : 'transparent',
              color: active ? '#FFFFFF' : '#4A4238',
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
// Sorting is a property of the RESULTS, not of the filters, so it sits at the
// top of the results column beside the view toggle rather than at the bottom
// of the rail where it used to be buried.

type DateSort = 'asc' | 'desc';

function DateSortToggle({ sort, onChange }: { sort: DateSort; onChange: (v: DateSort) => void }) {
  const Icon = sort === 'asc' ? CalendarArrowUp : CalendarArrowDown;
  const label = sort === 'asc' ? 'Soonest first' : 'Latest first';
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={() => onChange(sort === 'asc' ? 'desc' : 'asc')}
      title="Sort by date"
      aria-label={`Sorted by date, ${label}. Click to flip.`}
      className="inline-flex items-center flex-shrink-0 focus:outline-none"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: '42px',
        padding: '0 15px',
        gap: '7px',
        borderRadius: '12px',
        backgroundColor: hover ? 'rgba(27,56,40,0.08)' : 'rgba(237,231,216,0.5)',
        border: '1px solid rgba(221,212,192,0.9)',
        color: hover ? '#1B3828' : '#4A4238',
        fontFamily: "var(--font-brand), sans-serif",
        fontWeight: 700,
        fontSize: '13px',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        transition: 'background-color 140ms ease, color 140ms ease',
      }}
    >
      <Icon size={15} strokeWidth={2.25} style={{ color: '#2A5A3C', flexShrink: 0 }} />
      {label}
    </button>
  );
}

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
        fontFamily: "var(--font-brand), sans-serif", fontWeight: 600, fontSize: '12px',
        color: '#6B5F52', backgroundColor: 'transparent',
        border: '1px solid rgba(154,138,120,0.45)',
        gap: '5px',
        padding: Icon ? '3px 9px 3px 7px' : '3px 9px', borderRadius: '8px', whiteSpace: 'nowrap',
      }}
    >
      {Icon && <Icon size={12.5} strokeWidth={2.25} style={{ color: '#2A5A3C', flexShrink: 0 }} />}
      {label}
    </span>
  );
}

function ConferenceListRow({
  conf, applied, member, hovered, onHover, onLeave, creditSponsored = false, spotlight = false, onSpotlightClick,
}: {
  conf: Conference;
  creditSponsored?: boolean;
  /** A booked Gavelling Spotlight: the small tag and the gold edge and glow the grid card wears. */
  spotlight?: boolean;
  onSpotlightClick?: () => void;
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
  const price = conf.delegate_price ?? TBD_PRICE;

  // CTA navigates itself and stops the click reaching the row link.
  function onCta(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    router.push(href);
  }

  const ctaBase: React.CSSProperties = {
    fontSize: '13px', padding: '9px 16px',
  };

  return (
    <Link
      href={href}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={spotlight ? onSpotlightClick : undefined}
      className="flex items-center gap-4 md:gap-6 px-2 md:px-4"
      style={spotlight ? {
        // The grid card's spotlight treatment: a gold edge and a soft gold glow.
        paddingTop: '20px',
        paddingBottom: '20px',
        margin: '10px 0',
        borderRadius: '18px',
        backgroundColor: hovered ? '#FFFDF6' : '#FFFFFF',
        boxShadow: hovered ? SPOTLIGHT_GLOW_HOVER : SPOTLIGHT_GLOW,
        textDecoration: 'none',
        transition: 'background-color 160ms ease, box-shadow 200ms ease',
      } : {
        paddingTop: '22px',
        paddingBottom: '22px',
        backgroundColor: hovered ? 'rgba(27,56,40,0.035)' : 'transparent',
        borderBottom: '2px solid rgba(27,56,40,0.16)',
        textDecoration: 'none',
        transition: 'background-color 160ms ease',
      }}
    >
      {/* Round logo: the shared LogoDisc (near-white disc, forest fallback
          with acronym initials), so a circle-cropped logo fills it edge to edge. */}
      <LogoDisc
        src={conf.logo_url}
        alt={conf.acronym}
        size={64}
        fallbackText={initials}
        style={{
          border: '0.5px solid rgba(221,212,192,0.8)',
          boxShadow: hovered ? '0 6px 16px rgba(27,56,40,0.16)' : '0 3px 8px rgba(27,56,40,0.10)',
          transition: 'box-shadow 160ms ease',
        }}
      />

      {/* Name · city/country with flag · badge chips.
          Grows to absorb ALL slack so the metadata columns to its right land in
          the same position on every row (tidy, scannable columns). */}
      <div className="min-w-0" style={{ flex: '1 1 0' }}>
        <div
          className="flex items-center gap-1.5 min-w-0 flex-wrap"
          style={{
            fontFamily: "var(--font-brand), sans-serif", fontWeight: 700, fontSize: '18px',
            letterSpacing: '0.003em', color: hovered ? '#1B3828' : '#1C1410',
            transition: 'color 160ms ease', lineHeight: 1.2,
          }}
        >
          <span style={{ overflowWrap: 'anywhere' }}>{conferenceAcronymLabel(conf) || conf.full_name}</span>
          <VerifiedCheck verified={!!conf.is_verified} size={18} title="Verified conference" />
          {spotlight && <SpotlightTag size="sm" style={{ marginInlineStart: 4 }} />}
        </div>
        {conferenceAcronymLabel(conf) && conf.full_name && conf.full_name !== conferenceAcronymLabel(conf) && (
          <div style={{ fontFamily: "var(--font-brand), sans-serif", fontWeight: 500, fontSize: '13px', color: '#6B5F52', marginTop: '2px', lineHeight: 1.3, overflowWrap: 'anywhere' }}>
            {conf.full_name}
          </div>
        )}
        <div
          className="flex items-center gap-2 min-w-0"
          style={{ fontFamily: "var(--font-brand), sans-serif", fontWeight: 500, fontSize: '14px', color: '#6B5F52', marginTop: '5px' }}
        >
          {countryObj && <CircleFlag code={countryObj.code} size={18} decorative className="flex-shrink-0" />}
          <span style={{ overflowWrap: 'anywhere' }}>{conf.city}, {conf.country}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-2.5">
          {conf.format && <RowChip label={formatLabel} icon={FORMAT_ICONS[conf.format]} />}
          {levelLabel && <RowChip label={levelLabel} icon={LEVEL_ICONS[conf.student_level]} />}
          {/* The fee column is hidden below md, so the mark rides here there */}
          {creditSponsored && <span className="md:hidden inline-flex"><CreditSponsoredMark size="xs" /></span>}
          {/* Mobile-only inline date (right columns hidden below sm) */}
          <span
            className="sm:hidden inline-flex items-center gap-1.5 flex-shrink-0"
            style={{ fontFamily: "var(--font-brand), sans-serif", fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: '12px', color: '#8A7D6C', whiteSpace: 'nowrap' }}
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
        <div style={{ fontFamily: "var(--font-brand), sans-serif", fontVariantNumeric: 'tabular-nums' }}>
          <div style={{ fontWeight: 700, fontSize: '14.5px', color: '#1C1410', whiteSpace: 'nowrap' }}>{range}</div>
          <div style={{ fontWeight: 500, fontSize: '13px', color: '#9A8A78', marginTop: '2px' }}>{year}</div>
        </div>
      </div>

      {/* Delegates */}
      <div className="hidden lg:flex items-center gap-2 flex-shrink-0" style={{ width: '96px' }}>
        {conf.expected_delegates > 0 && (
          <>
            <Users size={18} strokeWidth={2} style={{ color: '#9A8A78', flexShrink: 0 }} />
            <span style={{ fontFamily: "var(--font-brand), sans-serif", fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: '15px', color: '#1C1410' }}>
              {conf.expected_delegates.toLocaleString()}
            </span>
          </>
        )}
      </div>

      {/* Fee, a gold 3D ticket for paid conferences, forest FREE pill for
          free ones, a quiet TBD pill until delegate applications launch */}
      <div className="hidden md:flex flex-col items-start justify-center gap-1 flex-shrink-0" style={{ width: '118px' }}>
        <div className="flex items-center gap-2">
        {price.kind === 'tbd' ? (
          <span
            title="Price to be announced"
            style={{ fontFamily: "var(--font-brand), sans-serif", fontWeight: 700, fontSize: '15px', color: '#6B5F52' }}
          >
            TBD
          </span>
        ) : price.kind === 'free' ? (
          <span style={{ fontFamily: "var(--font-brand), sans-serif", fontWeight: 700, fontSize: '15px', color: '#2A5A3C' }}>
            Free
          </span>
        ) : (
          <>
            <Emoji3D name="Ticket" size={20} fallback={Ticket} fallbackColor="#B6871F" />
            <span className="inline-flex items-baseline gap-0.5">
              <span style={{ fontFamily: "var(--font-brand), sans-serif", fontWeight: 700, fontSize: '13px', color: '#B6871F' }}>
                {currencySymbol(price.currency)}
              </span>
              <span style={{ fontFamily: "var(--font-brand), sans-serif", fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: '15px', color: '#1C1410' }}>
                {formatFeeAmountCompact(price.amount)}
              </span>
            </span>
          </>
        )}
        </div>
        {/* Credit sponsored on its own line under the fee */}
        {creditSponsored && <CreditSponsoredMark size="xs" />}
      </div>
      </div>

      {/* CTA, member (part of the conference) > applied > apply */}
      <div className="hidden sm:flex justify-end flex-shrink-0" style={{ width: '124px' }}>
        {member ? (
          <button type="button" onClick={onCta} className="inline-flex items-center gap-1.5 focus:outline-none"
            style={{ ...SECONDARY_BUTTON, ...ctaBase }}
          >
            View
          </button>
        ) : applied ? (
          <button type="button" onClick={onCta} className="inline-flex items-center gap-1.5 focus:outline-none"
            style={{ ...SECONDARY_BUTTON, ...ctaBase }}
          >
            <Check size={14} strokeWidth={3} style={{ color: '#2A5A3C' }} />
            Applied
          </button>
        ) : (
          <button type="button" onClick={onCta} className="inline-flex items-center gap-1.5 focus:outline-none"
            style={{
              ...PRIMARY_BUTTON, ...ctaBase,
              boxShadow: hovered ? '0 6px 16px rgba(27,56,40,0.26)' : '0 3px 8px rgba(27,56,40,0.18)',
              transition: 'box-shadow 180ms ease',
            }}
          >
            Apply
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
        fontFamily: "var(--font-brand), sans-serif", fontWeight: 800, fontSize: '14px',
        color: '#1C1410', margin: '0 0 8px',
      }}
    >
      {children}
    </p>
  );
}

/** One filter row. Reads as a list item, not a pill: full width, a check
 *  gutter on the left so the ticked and unticked rows stay optically aligned. */
function RailOption({
  label, active, onClick, icon: Icon, flagCode, note, count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: RowIcon;
  flagCode?: string;
  note?: string;
  /** How many conferences sit behind this option. */
  count?: number;
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
        color: active ? '#FFFFFF' : '#4A4238',
        border: 'none',
        cursor: 'pointer',
        fontFamily: "var(--font-brand), sans-serif",
        fontWeight: active ? 700 : 600,
        fontSize: '12.5px',
        transition: 'background-color 140ms ease, color 140ms ease',
      }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.06)'; }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
    >
      {flagCode ? (
        <CircleFlag code={flagCode} size={16} decorative />
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
      <span className="flex-1 min-w-0" style={{ overflowWrap: 'anywhere' }}>{label}</span>
      {note && (
        <span style={{ fontSize: '11px', fontWeight: 700, color: active ? 'rgba(255,255,255,0.8)' : '#8A6414', flexShrink: 0 }}>
          {note}
        </span>
      )}
      {typeof count === 'number' && (
        <span
          style={{
            fontSize: '11px', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
            color: active ? 'rgba(255,255,255,0.8)' : '#6B5F52', flexShrink: 0,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/** Shown under Open Applications and Price when the facets read failed. */
function FacetsNote() {
  return (
    <p role="status" style={{ margin: '8px 10px 0', fontSize: '11.5px', lineHeight: 1.45, color: '#8B2020', fontFamily: "var(--font-brand), sans-serif" }}>
      Filters by open roles and price are unavailable right now
    </p>
  );
}

/** The country from the browser's locale, only when the locale NAMES a region
 *  ("en-GB" → United Kingdom). A bare language ("en") is not a place. */
function localeCountry(): string | null {
  try {
    const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const l of langs) {
      const region = l ? new Intl.Locale(l).region : undefined;
      const name = region ? countryNameFromCode(region) : null;
      if (name) return name;
    }
  } catch { /* an odd locale string: no near-you */ }
  return null;
}

/** Type to find a country; each pick becomes a removable chip above it. The
 *  suggestions sit in the rail's own flow (never a floating layer that the
 *  scrolling rail could clip), from the countries that have conferences. */
function CountrySearch({ options, chosen, onAdd }: {
  options: CountryFacet[];
  chosen: ReadonlySet<string>;
  onAdd: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  const matches = useMemo(() => {
    if (!q.trim()) return [];
    return options
      .filter(c => !chosen.has(c.id))
      .map(c => ({ c, rank: countryMatchRank(c.name, q, 'en') }))
      .filter((x): x is { c: CountryFacet; rank: number } => x.rank !== null)
      .sort((a, b) => a.rank - b.rank || b.c.count - a.c.count || a.c.name.localeCompare(b.c.name))
      .slice(0, 6)
      .map(x => x.c);
  }, [options, chosen, q]);
  const active = Math.min(cursor, Math.max(0, matches.length - 1));

  const pick = (id: string) => { onAdd(id); setQ(''); setCursor(0); };

  return (
    <div>
      <div className="relative flex items-center">
        <Search size={14} className="absolute left-2.5 pointer-events-none" style={{ color: '#9A8A78' }} />
        <input
          type="text"
          value={q}
          onChange={(e) => { setQ(e.target.value); setCursor(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(Math.min(active + 1, matches.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(Math.max(active - 1, 0)); }
            else if (e.key === 'Enter' && matches[active]) { e.preventDefault(); pick(matches[active].id); }
            else if (e.key === 'Escape') { setQ(''); }
          }}
          placeholder="Add a country"
          aria-label="Add a country"
          role="combobox"
          aria-expanded={matches.length > 0}
          aria-controls="gv-explore-country-list"
          aria-activedescendant={matches[active] ? `gv-explore-country-${matches[active].id}` : undefined}
          className="w-full py-2 pl-8 pr-3 text-[12.5px] focus:outline-none"
          style={{
            border: '1px solid rgba(221,212,192,0.9)', borderRadius: '10px',
            backgroundColor: '#FFFDF9', color: '#1C1410', fontFamily: "var(--font-brand), sans-serif",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(221,212,192,0.9)'; }}
        />
      </div>
      {q.trim() && (
        <div id="gv-explore-country-list" role="listbox" aria-label="Countries" style={{ marginTop: 4 }}>
          {matches.length === 0 ? (
            <p style={{ margin: '4px 10px', fontSize: '11.5px', color: '#6E5F4E', fontFamily: "var(--font-brand), sans-serif" }}>
              No conferences in a country like that
            </p>
          ) : matches.map((c, i) => (
            <button
              key={c.id}
              id={`gv-explore-country-${c.id}`}
              type="button"
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(c.id)}
              onMouseEnter={() => setCursor(i)}
              className="w-full flex items-center text-left focus:outline-none"
              style={{
                gap: 8, padding: '6px 10px', borderRadius: 9, border: 'none', cursor: 'pointer',
                backgroundColor: i === active ? 'rgba(27,56,40,0.07)' : 'transparent',
                fontFamily: "var(--font-brand), sans-serif", fontWeight: 600, fontSize: '12.5px', color: '#1C1410',
              }}
            >
              {c.code ? <CircleFlag code={c.code} size={16} decorative /> : <Globe size={14} style={{ color: '#2A5A3C', flexShrink: 0 }} />}
              <span className="flex-1 min-w-0" style={{ overflowWrap: 'anywhere' }}>{c.name}</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#6B5F52', fontVariantNumeric: 'tabular-nums' }}>{c.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterRail({
  searchQuery, onSearch,
  continent, onContinent,
  userCountry, userCountryCount, nearActive, onToggleNear,
  chosenCountries, countryOptions, onAddCountry, onRemoveCountry,
  formatFilter, onFormat,
  levelFilter, onLevel,
  roleFilter, onToggleRole,
  facetsUnavailable,
  priceFilter, onPrice,
  sponsoredFilter, onSponsored,
  dateFilter, onDate,
  dateFrom, dateTo, onDateFrom, onDateTo,
  hasActiveFilters, onClear,
}: {
  searchQuery: string; onSearch: (v: string) => void;
  /** A continent key from REGION_ORDER, or null. */
  continent: string | null;
  onContinent: (k: string | null) => void;
  /** Near you: the profile nationality, else the browser locale's region. */
  userCountry: string | null;
  /** How many conferences currently sit in that country. */
  userCountryCount: number;
  nearActive: boolean;
  onToggleNear: () => void;
  /** Countries picked through the search, shown as removable chips. */
  chosenCountries: CountryFacet[];
  /** Countries present in the results, for the search's suggestions. */
  countryOptions: CountryFacet[];
  onAddCountry: (id: string) => void;
  onRemoveCountry: (id: string) => void;
  formatFilter: FormatFilter; onFormat: (v: FormatFilter) => void;
  levelFilter: LevelFilter; onLevel: (v: LevelFilter) => void;
  /** Open applications: any selected role open right now. */
  roleFilter: ReadonlySet<RoleKey>; onToggleRole: (r: RoleKey) => void;
  /** The facets read failed: say so under Open Applications and Price. */
  facetsUnavailable: boolean;
  priceFilter: PriceFilter; onPrice: (v: PriceFilter) => void;
  sponsoredFilter: boolean; onSponsored: (v: boolean) => void;
  dateFilter: DateFilter; onDate: (v: DateFilter) => void;
  dateFrom: string; dateTo: string; onDateFrom: (v: string) => void; onDateTo: (v: string) => void;
  hasActiveFilters: boolean; onClear: () => void;
}) {
  const userCode = userCountry ? getCountryByName(userCountry)?.code : undefined;
  const todayIso = toDateOnly(new Date());
  const chosenIds = useMemo(() => new Set(chosenCountries.map(c => c.id)), [chosenCountries]);

  const group: React.CSSProperties = {
    paddingBottom: '16px',
    marginBottom: '16px',
    borderBottom: '1px solid rgba(221,212,192,0.85)',
  };

  return (
    <div
      style={{
        // A white floating panel beside the grid (owner's taste board three).
        backgroundColor: '#FFFFFF',
        border: '1px solid rgba(27,56,40,0.06)',
        borderRadius: '20px',
        padding: '18px 16px',
        boxShadow: '0 1px 2px rgba(27,56,40,0.06), 0 12px 32px rgba(27,56,40,0.10)',
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
              fontFamily: "var(--font-brand), sans-serif",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(221,212,192,0.9)'; }}
          />
        </div>
      </div>

      {/* Open applications: which roles a person could apply for today. A
          conference matches when ANY ticked role is open. */}
      <div style={group} role="listbox" aria-label="Open applications" aria-multiselectable="true">
        <RailHeading>Open applications</RailHeading>
        {ROLE_OPTIONS.map(r => (
          <RailOption key={r.key} label={r.label} active={roleFilter.has(r.key)} onClick={() => onToggleRole(r.key)} />
        ))}
        {facetsUnavailable && <FacetsNote />}
      </div>

      {/* Price: bucketed on an approximate USD figure; the cards keep printing
          the real fee in the conference's own currency. */}
      <div style={group} role="listbox" aria-label="Price">
        <RailHeading>Price</RailHeading>
        {PRICE_OPTIONS.map(p => (
          <RailOption key={p.key || 'any'} label={p.label} active={priceFilter === p.key} onClick={() => onPrice(p.key)} icon={p.key === '' ? undefined : Ticket} />
        ))}
        <p style={{ margin: '6px 10px 0', fontSize: '11px', lineHeight: 1.4, color: '#6E5F4E', fontFamily: "var(--font-brand), sans-serif" }}>
          Approximate, converted to USD
        </p>
        {facetsUnavailable && <FacetsNote />}
      </div>

      {/* Credit sponsored: the conference pays applicants' Gavelling credit
          (credit_sponsored_conference_ids), ?sponsored=1 */}
      <div style={group} role="listbox" aria-label="Credit sponsored">
        <RailHeading>Credits</RailHeading>
        <p style={{ margin: '-4px 0 6px', fontSize: '10.5px', lineHeight: 1.3, letterSpacing: '-0.005em', color: '#6E5F4E', fontFamily: "var(--font-brand), sans-serif", whiteSpace: 'nowrap' }}>
          The conference pays your Gavelling credit.
        </p>
        <RailOption label="Credit sponsored" active={sponsoredFilter} onClick={() => onSponsored(!sponsoredFilter)} icon={Heart} />
      </div>

      {/* Dates: quick buckets on the start day, or a custom range through the
          shared DatePicker (date-only values, never a bare new Date()). */}
      <div style={group} role="listbox" aria-label="Dates">
        <RailHeading>Dates</RailHeading>
        {DATE_OPTIONS.map(d => (
          <RailOption key={d.key || 'any'} label={d.label} active={dateFilter === d.key && !dateFrom && !dateTo} onClick={() => { onDate(d.key); onDateFrom(''); onDateTo(''); }} icon={d.key === '' ? undefined : CalendarDays} />
        ))}
        <div className="gv-explore-range" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
          <div>
            <p style={{ margin: '0 0 4px 2px', fontSize: '12px', fontWeight: 700, color: '#6E5F4E', fontFamily: "var(--font-brand), sans-serif" }}>From</p>
            <DatePicker value={dateFrom} onChange={(iso) => { onDateFrom(iso); onDate(''); }} min={todayIso} max={dateTo || undefined} placeholder="Any" />
          </div>
          <div>
            <p style={{ margin: '0 0 4px 2px', fontSize: '12px', fontWeight: 700, color: '#6E5F4E', fontFamily: "var(--font-brand), sans-serif" }}>To</p>
            <DatePicker value={dateTo} onChange={(iso) => { onDateTo(iso); onDate(''); }} min={dateFrom || todayIso} placeholder="Any" />
          </div>
        </div>
      </div>

      {/* Region: the six continents, one at a time (?continent=). Picking one
          puts that continent's Region Spotlight first. */}
      <div style={group} role="listbox" aria-label="Region">
        <RailHeading>Region</RailHeading>
        {REGION_ORDER.map(k => (
          <RailOption key={k} label={CONTINENT_LABELS[k]} active={continent === k} onClick={() => onContinent(continent === k ? null : k)} icon={Globe} />
        ))}
      </div>

      {/* Country: Near you, then any countries typed in (?country=, several).
          The first chosen country's Country Spotlight goes first. */}
      <div style={group}>
        <RailHeading>Country</RailHeading>
        {userCountry && (
          <div role="listbox" aria-label="Near you">
            <RailOption
              label={userCountry}
              active={nearActive}
              onClick={onToggleNear}
              flagCode={userCode}
              note="Near you"
              count={userCountryCount}
            />
          </div>
        )}
        {chosenCountries.length > 0 && (
          <ul className="flex flex-wrap" style={{ listStyle: 'none', margin: '6px 0 8px', padding: 0, gap: 6 }} aria-label="Chosen countries">
            {chosenCountries.map(c => (
              <li key={c.id}>
                <span
                  className="inline-flex items-center"
                  style={{
                    gap: 6, padding: '4px 4px 4px 6px', borderRadius: 10, backgroundColor: '#1B3828', color: '#FFFFFF',
                    fontFamily: "var(--font-brand), sans-serif", fontWeight: 700, fontSize: '12px',
                  }}
                >
                  {c.code ? <CircleFlag code={c.code} size={16} decorative /> : <Globe size={13} style={{ color: '#EED98A' }} />}
                  <span style={{ overflowWrap: 'anywhere' }}>{c.name}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveCountry(c.id)}
                    aria-label={`Remove ${c.name}`}
                    title={`Remove ${c.name}`}
                    className="inline-flex items-center justify-center focus:outline-none"
                    style={{ width: 22, height: 22, borderRadius: 7, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.12)', color: '#FFFFFF' }}
                  >
                    <X size={12} strokeWidth={2.6} aria-hidden />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div style={{ marginTop: userCountry || chosenCountries.length > 0 ? 6 : 0 }}>
          <CountrySearch options={countryOptions} chosen={chosenIds} onAdd={onAddCountry} />
        </div>
      </div>

      {/* Format. Hybrid is not a third choice, it answers to both. */}
      <div style={group} role="listbox" aria-label="Format">
        <RailHeading>Format</RailHeading>
        <RailOption label="In person" active={formatFilter === 'in-person'} onClick={() => onFormat(formatFilter === 'in-person' ? '' : 'in-person')} icon={MapPin} />
        <RailOption label="Online"    active={formatFilter === 'online'}    onClick={() => onFormat(formatFilter === 'online' ? '' : 'online')}    icon={Monitor} />
      </div>

      {/* Level. A conference open to both answers to either. */}
      <div style={{ ...group, borderBottom: hasActiveFilters ? group.borderBottom : 'none', marginBottom: hasActiveFilters ? 16 : 0, paddingBottom: hasActiveFilters ? 16 : 0 }} role="listbox" aria-label="Student level">
        <RailHeading>Level</RailHeading>
        <RailOption label="High school" active={levelFilter === 'school'}     onClick={() => onLevel(levelFilter === 'school' ? '' : 'school')}         icon={School} />
        <RailOption label="University"  active={levelFilter === 'university'} onClick={() => onLevel(levelFilter === 'university' ? '' : 'university')} icon={GraduationCap} />
      </div>

      {hasActiveFilters && (
        <button
          onClick={onClear}
          className="w-full focus:outline-none"
          style={{ ...SECONDARY_BUTTON, fontSize: '13px', padding: '9px' }}
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
  // Every filter is seeded from the URL and written back to it below, so a
  // filtered view can be shared (src/app/conferences/explore/exploreFilters.ts).
  const initialQuery = useMemo(() => readExploreQuery(searchParams), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [searchQuery, setSearchQuery] = useState(initialQuery.search);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [formatFilter, setFormatFilter] = useState<FormatFilter>(
    initialQuery.format === 'in-person' || initialQuery.format === 'online' ? initialQuery.format : '',
  );
  const [levelFilter, setLevelFilter] = useState<LevelFilter>(
    initialQuery.level === 'school' || initialQuery.level === 'university' ? initialQuery.level : '',
  );
  const [roleFilter, setRoleFilter] = useState<Set<RoleKey>>(() => new Set(initialQuery.roles));
  const [priceFilter, setPriceFilter] = useState<PriceFilter>(initialQuery.price);
  const [sponsoredFilter, setSponsoredFilter] = useState<boolean>(initialQuery.sponsored);
  // Conferences whose Store pays applicants' credit (src/lib/creditSponsored.ts).
  const [sponsoredIds, setSponsoredIds] = useState<Set<string>>(() => new Set());
  // Gavelling Spotlight (src/lib/spotlight.ts): the Explore row, read once; the
  // Region and Country rows, read for the filter in force. Booked rows only.
  const [exploreSpots, setExploreSpots] = useState<FeaturedRow[]>([]);
  const [regionSpots, setRegionSpots] = useState<{ key: string; rows: FeaturedRow[] }>({ key: '', rows: [] });
  const [spotlightDialog, setSpotlightDialog] = useState<FeaturedRow[] | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>(initialQuery.when);
  const [dateFrom, setDateFrom] = useState(initialQuery.from);
  const [dateTo, setDateTo] = useState(initialQuery.to);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // Open roles and the approximate USD fee per conference, one RPC for the
  // whole page (explore_conference_facets, anon-callable).
  const [facets, setFacets] = useState<FacetMap>(() => new Map());
  // True when the facets read failed: the two groups then say so instead of
  // silently matching nothing (owner, 25 Sep 2026).
  const [facetsFailed, setFacetsFailed] = useState(false);

  function toggleRole(role: RoleKey) {
    setRoleFilter(prev => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role); else next.add(role);
      return next;
    });
  }

  // Region (one continent key, ?continent=) and countries (ISO identities,
  // several, ?country=Name&country=Name). Both AND with every other filter.
  // A ?continent= or ?country= URL param wins over the near-you default.
  const [continent, setContinent] = useState<string | null>(() => {
    const c = searchParams.get('continent');
    return c && CONTINENT_LABELS[c] ? c : null;
  });
  const [countryIds, setCountryIds] = useState<string[]>(() => {
    const out: string[] = [];
    for (const v of searchParams.getAll('country')) {
      const id = v.trim() ? countryIdentity(v.trim()) : '';
      if (id && !out.includes(id)) out.push(id);
    }
    return out;
  });
  const [regionTouched, setRegionTouched] = useState<boolean>(
    () => !!searchParams.get('continent') || !!searchParams.get('country'),
  );
  // Set when geo defaults us into a whole-directory "around you" view because
  // the visitor's own country has too few conferences to lead with.
  const [aroundYouDefault, setAroundYouDefault] = useState(false);
  function changeContinent(k: string | null) {
    setContinent(k);
    setRegionTouched(true);
  }
  function addCountry(id: string) {
    setCountryIds(prev => (prev.includes(id) ? prev : [...prev, id]));
    setRegionTouched(true);
  }
  function removeCountry(id: string) {
    setCountryIds(prev => prev.filter(x => x !== id));
    setRegionTouched(true);
  }
  function clearRegion() {
    setContinent(null);
    setCountryIds([]);
    setRegionTouched(true);
  }

  // Date sort, soonest-first by default, one click flips to latest-first.
  const [dateSort, setDateSort] = useState<DateSort>(initialQuery.sort);

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
        .select('id, slug, full_name, acronym, country, city, start_date, end_date, expected_delegates, fee_amount, fee_currency, format, student_level, logo_url, banner_url, is_public, is_verified, organizer_id, is_demo')
        .eq('is_public', true)
        .order('start_date', { ascending: true });
      // Test and demo conferences are never listed (src/lib/publicConferences.ts).
      const confs = ((data as (Conference & { is_demo?: boolean | null })[]) ?? []).filter(isListedConference);

      // Single source of truth for the price shown on cards:
      // displayDelegatePrice (src/lib/publicFees.ts). TBD until delegate
      // applications are launched, then the current stage's delegate price.
      const prices = await fetchDelegatePrices(supabase, confs);
      setConferences(confs.map(c => withDelegatePrice(c, prices)));
      setLoading(false);

      // Credit sponsored and the Explore Spotlight row, in the background.
      void fetchCreditSponsoredIds().then(setSponsoredIds);
      void fetchFeatured(supabase, 'explore', '').then(rows => {
        const booked = rows.filter(r => r.is_spotlight);
        setExploreSpots(booked);
        // The Conference Spotlight pop-up, once per site visit, only when a
        // booking is live today.
        if (booked.length > 0 && claimSpotlightDialog()) setSpotlightDialog(booked);
      });

      // One call for every listed id: which roles are open right now and the
      // approximate USD fee, for the Open Applications and Price filters. The
      // anon client, so a signed-out visitor gets the same answer. A failed
      // read leaves the map empty: those two filters then match nothing rather
      // than something invented.
      if (confs.length > 0) {
        const { data: facetRows, error: facetError } = await supabase.rpc('explore_conference_facets', { p_ids: confs.map(c => c.id) });
        const parsed = parseFacets(facetRows);
        setFacets(parsed);
        // An error, or no rows for a non-empty directory, both mean the read
        // did not work (the RPC answers one row per id it was given).
        setFacetsFailed(!!facetError || parsed.size === 0);
      }
    }
    fetchConferences();
  }, []);

  // The address bar follows the filters (replaceState, so Back is not
  // flooded). Region keys keep their existing spelling so an old
  // ?continent= link and ?country= still work in both directions.
  useEffect(() => {
    // The state holds ISO identities; the URL carries country NAMES, which is
    // what the initial `countryIdentity(...)` read expects (an ISO code alone
    // would fold to lower case and never match).
    const country = countryIds.map(id => getCountryByCode(id)?.name ?? id);
    const next = writeExploreQuery({
      search: searchQuery, format: formatFilter, level: levelFilter,
      roles: [...roleFilter], price: priceFilter, when: dateFilter, from: dateFrom, to: dateTo,
      sort: dateSort, continent, country, sponsored: sponsoredFilter,
    });
    const current = window.location.search;
    if (next === current) return;
    window.history.replaceState(window.history.state, '', window.location.pathname + next + window.location.hash);
  }, [searchQuery, formatFilter, levelFilter, roleFilter, priceFilter, dateFilter, dateFrom, dateTo, dateSort, continent, countryIds, sponsoredFilter]);

  // Near you (25 Sep 2026): the signed-in person's profile nationality, else
  // the region named by the browser's locale; hidden when neither says. Filled
  // in the effect under useAuth below.
  const [userCountry, setUserCountry] = useState<string | null>(null);
  // Default view once, when geo resolved and the visitor hasn't touched the
  // control. If the visitor's country already has at least 4 conferences we
  // lead with "Conferences in {country}". Otherwise we fall back to an "around
  // you" view of the whole directory so the grid is never empty on first load,
  // rather than a discouraging country empty state. Geo failure → ALL.
  const geoDefaultApplied = useRef(false);
  useEffect(() => {
    if (geoDefaultApplied.current || regionTouched || loading || !userCountry) return;
    geoDefaultApplied.current = true;
    // Identity, not raw strings: a visitor geolocated to "Turkey" must still
    // match conferences stored as "Türkiye". Same rule as the filter below.
    const localId = countryIdentity(userCountry);
    const localCount = conferences.filter(
      c => countryIdentity(c.country) === localId
    ).length;
    if (localCount >= 4) {
      setCountryIds([localId]);
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

  // Near you: profile nationality for a signed-in person (their locale when
  // it is empty), the locale's region for a visitor.
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    const done = (name: string | null) => { if (!cancelled) setUserCountry(name); };
    if (!user || !session) {
      void Promise.resolve().then(() => done(localeCountry()));
    } else {
      void (async () => {
        try {
          const { data } = await getAuthedClient(session.access_token)
            .from('profiles').select('nationality').eq('id', user.id).maybeSingle();
          const raw = (data as { nationality?: string | null } | null)?.nationality?.trim() ?? '';
          const name = raw ? (getCountryByName(raw)?.name ?? countryNameFromCode(raw)) : null;
          done(name ?? localeCountry());
        } catch {
          done(localeCountry());
        }
      })();
    }
    return () => { cancelled = true; };
  }, [authLoading, user, session]);

  // Owner check rides on the conference rows themselves (organizer_id).
  const isMember = (c: Conference) =>
    memberIds.has(c.id) || (!!user && c.organizer_id === user.id);

  const continentKey = continent;
  const continentLabel = continentKey ? (CONTINENT_LABELS[continentKey] ?? null) : null;
  const nearId = userCountry ? countryIdentity(userCountry) : null;
  const nearActive = !!nearId && countryIds.includes(nearId);
  // Only the near-you country is chosen: the "N conferences in {country}" view.
  const countryMode = !!nearId && countryIds.length === 1 && countryIds[0] === nearId && !continentKey;
  // Whole-directory fallback we auto-selected on first load, shown under the
  // "Conferences around you" heading. Clears the moment the visitor picks a region.
  const aroundYouMode = aroundYouDefault && !continentKey && countryIds.length === 0 && !regionTouched;

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

  // CONTINENT_COUNTRIES resolved to ISO identities once, not per row per render.
  const continentIdentities = useMemo(() => {
    const out: Record<string, Set<string>> = {};
    for (const [key, names] of Object.entries(CONTINENT_COUNTRIES)) {
      out[key] = new Set(names.map(countryIdentity));
    }
    return out;
  }, []);

  // Everything EXCEPT the country/continent filter. The country list and its
  // counts are built from this, so the rail reflects what picking a country
  // would actually give you under the search and chips already applied, and
  // never offers a country that would land on an empty page.
  const preRegion = useMemo(() => conferences.filter(c => {
    // Finished conferences are dropped from the directory — nobody browsing for
    // one to attend wants last year's. Their pages stay live, linkable and in
    // the sitemap, so a direct link and Google search still reach them; this
    // only trims what the browse listing puts in front of people. Undated
    // ("dates TBD") conferences are never treated as finished.
    if (hasConcluded(c)) return false;
    if (searchQuery) {
      // Accent-FOLDED on both sides — see THE FOLDING RULE in countries.ts.
      // A raw `.includes()` meant a conference in Türkiye never surfaced for
      // "Tu" (the second character is `ü`), and the same for São Paulo,
      // Bogotá or Zürich in the city field.
      const q = fold(searchQuery);
      const countryHit = countryMatchRank(c.country, searchQuery, 'en') !== null;
      if (
        !fold(c.full_name).includes(q) &&
        !fold(c.acronym).includes(q) &&
        !fold(c.city).includes(q) &&
        !fold(c.country).includes(q) &&
        // also lets an alias find it: "Turkey" or "UK" surfaces the row even
        // though the country is stored as "Türkiye" / "United Kingdom".
        !countryHit
      ) return false;
    }
    // 'hybrid' answers to both format filters; 'both' to either level filter.
    if (!matchesFormat(c.format, formatFilter)) return false;
    if (!matchesLevel(c.student_level, levelFilter)) return false;
    // Open applications, price and dates, AND across groups like the rest.
    const facet = facets.get(c.id);
    if (!matchesRoles(facet, roleFilter)) return false;
    if (!matchesPrice(facet, priceFilter)) return false;
    if (!matchesDateBucket(c.start_date, dateFilter)) return false;
    if (!matchesDateRange(c.start_date, dateFrom, dateTo)) return false;
    if (sponsoredFilter && !sponsoredIds.has(c.id)) return false;
    return true;
  }), [conferences, searchQuery, formatFilter, levelFilter, facets, roleFilter, priceFilter, dateFilter, dateFrom, dateTo, sponsoredFilter, sponsoredIds]);

  // Countries actually represented in the results. Keyed by ISO identity so a
  // row saved as "Turkey" and one saved as "Türkiye" are one country, labelled
  // with the canonical name. Sorted by count desc, then alphabetically, so the
  // list stays useful as the directory grows past today's 21 countries.
  const countryFacets = useMemo<CountryFacet[]>(() => {
    const byId = new Map<string, CountryFacet>();
    for (const c of preRegion) {
      if (!c.country) continue;
      const id = countryIdentity(c.country);
      const hit = byId.get(id);
      if (hit) { hit.count += 1; continue; }
      const known = getCountryByName(c.country);
      byId.set(id, { id, name: known?.name ?? c.country, code: known?.code, count: 1 });
    }
    return [...byId.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [preRegion]);

  const userCountryId = userCountry ? countryIdentity(userCountry) : null;
  const userCountryCount = useMemo(
    () => (userCountryId ? countryFacets.find(c => c.id === userCountryId)?.count ?? 0 : 0),
    [countryFacets, userCountryId],
  );

  // Every chosen country resolved to a name and flag, facet or not (a country
  // from a shared link may have nothing under today's other filters).
  const chosenFacets = useMemo<CountryFacet[]>(() => countryIds.map(id => {
    const f = countryFacets.find(c => c.id === id);
    if (f) return f;
    const known = getCountryByCode(id);
    return { id, name: known?.name ?? id, code: known?.code, count: 0 };
  }), [countryIds, countryFacets]);
  // The heading's one country (exactly one chosen, and not the near-you view).
  const selectedCountry = chosenFacets.length === 1 && !countryMode ? chosenFacets[0] : null;
  // The first chosen country leads the spotlight.
  const firstCountry = chosenFacets[0] ?? null;

  // The near-you country has its own row, so it is not repeated as a chip or
  // offered in the search.
  const chipCountries = useMemo(
    () => (nearId ? chosenFacets.filter(c => c.id !== nearId) : chosenFacets),
    [chosenFacets, nearId],
  );
  const searchCountries = useMemo(
    () => (nearId ? countryFacets.filter(c => c.id !== nearId) : countryFacets),
    [countryFacets, nearId],
  );
  const countryIdSet = useMemo(() => new Set(countryIds), [countryIds]);

  const filtered = useMemo(() => preRegion.filter(c => {
    // Compared by ISO identity, not by string: a row saved under an older
    // spelling ("Turkey", "Czechia", "Holland") must still count as local.
    if (countryIdSet.size > 0 && !countryIdSet.has(countryIdentity(c.country))) return false;
    if (continentKey) {
      // CONTINENT_COUNTRIES is hand-written and uses several non-canonical
      // names ("Ivory Coast", "Cape Verde", "East Timor", "Democratic Republic
      // of the Congo"), so a raw `.includes(c.country)` dropped those rows out
      // of their own continent. Both sides go through countryIdentity.
      const codes = continentIdentities[continentKey];
      return !!codes && codes.has(countryIdentity(c.country));
    }
    return true;
  }), [preRegion, countryIdSet, continentKey, continentIdentities]);

  // The spotlight row in force: the country's Country Spotlight under a
  // country filter, the continent's Region Spotlight under a continent, else
  // the Explore Spotlight row. Booked rows only; read when the filter changes.
  const spotTarget = firstCountry ? `country:${firstCountry.name}` : continentKey ? `region:${continentKey}` : '';
  useEffect(() => {
    if (!spotTarget) return;
    let cancelled = false;
    const colon = spotTarget.indexOf(':');
    const placement = spotTarget.slice(0, colon) as 'region' | 'country';
    const target = spotTarget.slice(colon + 1);
    void fetchFeatured(supabase, placement, target).then(rows => {
      if (!cancelled) setRegionSpots({ key: spotTarget, rows: rows.filter(r => r.is_spotlight) });
    });
    return () => { cancelled = true; };
  }, [spotTarget]);
  const spotlightRows = useMemo(() => (spotTarget ? (regionSpots.key === spotTarget ? regionSpots.rows : []) : exploreSpots), [spotTarget, regionSpots, exploreSpots]);
  const spotlightById = useMemo(() => new Map(spotlightRows.map(r => [r.conference_id, r])), [spotlightRows]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    // Undated (TBD) conferences sort last in BOTH directions, and a null
    // start_date must never reach .localeCompare — see compareStartDate.
    copy.sort((a, b) => compareStartDate(a.start_date, b.start_date, dateSort === 'asc' ? 'asc' : 'desc'));
    // Spotlight conferences first, in the row's order; they still had to pass
    // every filter above, or they are simply not here.
    if (spotlightById.size === 0) return copy;
    const first = spotlightRows.map(r => copy.find(c => c.id === r.conference_id)).filter((c): c is Conference => !!c);
    const firstIds = new Set(first.map(c => c.id));
    return [...first, ...copy.filter(c => !firstIds.has(c.id))];
  }, [filtered, dateSort, spotlightRows, spotlightById]);

  // One 'view' per session per spotlight booking that is on screen.
  useEffect(() => {
    const shown = new Set(sorted.map(c => c.id));
    for (const r of spotlightRows) if (shown.has(r.conference_id)) recordSpotlightView(r.booking_id);
  }, [sorted, spotlightRows]);

  // Country tab shows up to 4 local conferences prominently.
  const displayed = countryMode ? sorted.slice(0, 4) : sorted;

  // When a country filter has narrowed the page down, the end of the list is
  // the honest moment to say: there are much bigger rooms elsewhere. Upcoming
  // only, 500+ expected delegates, and never something already in the list
  // above. Soonest first, capped, and the block simply does not exist when
  // nothing qualifies.
  const countryFilterActive = countryIds.length > 0;
  const bigElsewhere = useMemo(() => {
    if (!countryFilterActive) return [];
    const shown = new Set(sorted.map(c => c.id));
    return conferences
      .filter(c => !shown.has(c.id) && !hasConcluded(c) && (c.expected_delegates ?? 0) >= BIG_CONFERENCE_DELEGATES)
      .sort((a, b) => compareStartDate(a.start_date, b.start_date, 'asc'))
      .slice(0, BIG_CONFERENCE_LIMIT);
  }, [conferences, sorted, countryFilterActive]);
  // Only when the filter is genuinely narrowing: never under the full directory.
  const showBigElsewhere =
    !loading && countryFilterActive && bigElsewhere.length > 0 && sorted.length < upcomingCount;

  function clearFilters() {
    setFormatFilter('');
    setLevelFilter('');
    setRoleFilter(new Set());
    setPriceFilter('');
    setDateFilter('');
    setDateFrom('');
    setDateTo('');
    setSponsoredFilter(false);
    setContinent(null);
    setCountryIds([]);
    setRegionTouched(true);
    setSearchQuery('');
  }

  const hasActiveFilters =
    !!formatFilter || !!levelFilter || !!searchQuery || !!continentKey || (countryIds.length > 0 && !countryMode)
    || roleFilter.size > 0 || !!priceFilter || !!dateFilter || !!dateFrom || !!dateTo || sponsoredFilter;

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
        <header className="px-6 md:px-10" style={{ paddingTop: 'clamp(24px, 3vw, 40px)', paddingBottom: '28px' }}>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[13px] mb-4 font-bold focus:outline-none"
            style={{ color: '#1B3828', fontFamily: "var(--font-brand), sans-serif" }}
          >
            {/* A small filled triangle pointing back, sized to the text. */}
            <Play size={10} strokeWidth={0} fill="currentColor" aria-hidden style={{ transform: 'rotate(180deg)', flexShrink: 0 }} />
            <span style={{ textDecoration: 'underline', textUnderlineOffset: '3px' }}>Back to home</span>
          </Link>

          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
            <div>
              <p
                className="mb-2 font-bold"
                style={{ fontFamily: "var(--font-brand), sans-serif", fontSize: '14px', color: '#8A6414' }}
              >
                Conference directory
              </p>
              <h1
                style={{
                  fontFamily: "var(--font-brand), sans-serif", fontWeight: 900,
                  fontSize: 'clamp(32px, 4vw, 52px)', lineHeight: 1.02, color: '#1C1410', margin: 0,
                }}
              >
                Explore{' '}
                <span style={{ color: '#1B3828' }}>Conferences</span>
              </h1>
              <p
                className="mt-2.5"
                style={{ fontFamily: "var(--font-brand), sans-serif", fontSize: '14px', color: '#6B5F52', maxWidth: '460px', lineHeight: 1.6 }}
              >
                {headlineCount === null
                  ? 'Loading the directory…'
                  : `${headlineCount} conference${headlineCount === 1 ? '' : 's'} across every continent, find where you debate next`}
              </p>
            </div>

            {/* Organise: a plus and the verb. The old sentence-length label was
                the loudest thing on a page about browsing, not creating. */}
            <button
              onClick={() => router.push('/conferences/new')}
              className="self-start md:self-auto flex-shrink-0 inline-flex items-center gap-2 py-3 px-5 text-[14px] transition-shadow focus:outline-none"
              style={{ ...PRIMARY_BUTTON, boxShadow: '0 6px 18px rgba(27,56,40,0.20)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 10px 24px rgba(27,56,40,0.28)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 18px rgba(27,56,40,0.20)'; }}
            >
              <Plus size={17} strokeWidth={2.6} />
              Organise a conference
            </button>
          </div>
        </header>

        {/* ── Directory: filter rail beside the grid ───────────────── */}
        <style>{`
          @media (min-width: 1024px) {
            .gv-explore-rail { max-height: calc(100dvh - 100px); overflow-y: auto; overscroll-behavior: contain; scrollbar-width: none; }
            .gv-explore-rail::-webkit-scrollbar { display: none; }
          }
        `}</style>
        <main className="flex-1 px-6 md:px-10 flex flex-col lg:flex-row" style={{ gap: '28px', alignItems: 'flex-start', paddingBottom: 'clamp(40px, 4vw, 64px)' }}>

          {/* Mobile: the rail folds behind one button rather than pushing the
              results a screen and a half down. */}
          <button
            onClick={() => setFiltersOpen(v => !v)}
            aria-expanded={filtersOpen}
            className="lg:hidden w-full flex items-center justify-center gap-2 py-3 text-[14px] focus:outline-none"
            style={filtersOpen ? PRIMARY_BUTTON : SECONDARY_BUTTON}
          >
            <SlidersHorizontal size={15} />
            Filters
            {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: filtersOpen ? '#EED98A' : '#B6871F' }} />}
          </button>

          <aside
            aria-label="Filters"
            // Full width on a phone (where it is a disclosed panel), a fixed
            // 250px rail from lg up (where it sits beside the grid). The rail
            // is PINNED and fits the viewport: it scrolls on its own inside
            // `calc(100dvh - 100px)`, so every group is reachable without
            // scrolling the results (owner, 25 Sep 2026).
            className={`gv-explore-rail ${filtersOpen ? 'block' : 'hidden'} lg:block lg:sticky lg:top-[84px] lg:max-w-[250px] flex-shrink-0`}
            style={{ width: '100%' }}
          >
            <FilterRail
              searchQuery={searchQuery} onSearch={setSearchQuery}
              continent={continentKey} onContinent={changeContinent}
              userCountry={userCountry}
              userCountryCount={userCountryCount}
              nearActive={nearActive}
              onToggleNear={() => { if (nearId) { if (nearActive) removeCountry(nearId); else addCountry(nearId); } }}
              chosenCountries={chipCountries}
              countryOptions={searchCountries}
              onAddCountry={addCountry}
              onRemoveCountry={removeCountry}
              formatFilter={formatFilter} onFormat={setFormatFilter}
              levelFilter={levelFilter} onLevel={setLevelFilter}
              roleFilter={roleFilter} onToggleRole={toggleRole}
              facetsUnavailable={facetsFailed}
              priceFilter={priceFilter} onPrice={setPriceFilter}
              sponsoredFilter={sponsoredFilter} onSponsored={setSponsoredFilter}
              dateFilter={dateFilter} onDate={setDateFilter}
              dateFrom={dateFrom} dateTo={dateTo} onDateFrom={setDateFrom} onDateTo={setDateTo}
              hasActiveFilters={hasActiveFilters} onClear={clearFilters}
            />
          </aside>

          <section className="flex-1 min-w-0 w-full">
            {/* Results rule — what this column is showing, plus the one control
                that belongs to the results rather than the filters. The rule's
                LABEL depends on there being results; the view toggle does not,
                so it stays put while you filter down to nothing and back. */}
            <div className="flex items-center gap-3 mb-6 flex-wrap">
              {/* Counts as plain typography: a big number with the word beside
                  it, never a pill or tracked capitals (owner's taste board). */}
              {!loading && displayed.length > 0 ? (
                <span className="inline-flex items-baseline flex-wrap" style={{ gap: '8px', fontFamily: "var(--font-brand), sans-serif", color: '#1C1410', fontVariantNumeric: 'tabular-nums' }}>
                  {aroundYouMode ? (
                    <span style={{ fontWeight: 800, fontSize: '17px' }}>Conferences around you</span>
                  ) : countryMode ? (
                    <>
                      {userCode && <CircleFlag code={userCode} size={18} decorative style={{ alignSelf: 'center' }} />}
                      <span style={{ fontWeight: 800, fontSize: '22px' }}>{displayed.length}</span>
                      <span style={{ fontWeight: 600, fontSize: '15px', color: '#4A4238', overflowWrap: 'anywhere' }}>
                        {displayed.length === 1 ? 'conference' : 'conferences'} in {userCountry}
                        {displayed.length < sorted.length ? ` of ${sorted.length}` : ''}
                      </span>
                    </>
                  ) : selectedCountry ? (
                    <>
                      {selectedCountry.code && <CircleFlag code={selectedCountry.code} size={18} decorative style={{ alignSelf: 'center' }} />}
                      <span style={{ fontWeight: 800, fontSize: '22px' }}>{sorted.length}</span>
                      <span style={{ fontWeight: 600, fontSize: '15px', color: '#4A4238', overflowWrap: 'anywhere' }}>
                        {sorted.length === 1 ? 'conference' : 'conferences'} in {selectedCountry.name}
                      </span>
                    </>
                  ) : (
                    <>
                      <span style={{ fontWeight: 800, fontSize: '22px' }}>{sorted.length}</span>
                      <span style={{ fontWeight: 600, fontSize: '15px', color: '#4A4238', overflowWrap: 'anywhere' }}>
                        {sorted.length === 1 ? 'conference' : 'conferences'}
                        {continentLabel && countryIds.length === 0 ? ` in ${continentLabel}` : ''}
                      </span>
                    </>
                  )}
                </span>
              ) : (
                <span style={{ fontFamily: "var(--font-brand), sans-serif", fontWeight: 700, fontSize: '15px', color: '#6B5F52', whiteSpace: 'nowrap' }}>
                  {loading ? 'Loading conferences' : 'No matches'}
                </span>
              )}
              <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(221,212,192,0.8)', minWidth: '12px' }} />
              {/* Sort and view: the two controls that belong to the results.
                  Kept as one group so they wrap together on a phone rather
                  than splitting across two lines. */}
              <div className="flex items-center gap-2 flex-shrink-0" style={{ marginLeft: 'auto' }}>
                <DateSortToggle sort={dateSort} onChange={setDateSort} />
                <ViewToggle view={view} onChange={changeView} />
              </div>
            </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" style={{ gap: '20px' }}>
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
                {userCode && <CircleFlag code={userCode} size={40} decorative />}
                <h2 className="font-semibold text-lg mt-5 mb-2" style={{ color: '#1C1410', fontFamily: "var(--font-brand), sans-serif" }}>
                  No conferences in {userCountry} yet
                </h2>
                <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: "var(--font-brand), sans-serif" }}>
                  Be the first to bring one home, or browse the worldwide directory
                </p>
                <button
                  onClick={clearRegion}
                  className="py-3 px-6 text-sm focus:outline-none"
                  style={PRIMARY_BUTTON}
                >
                  Explore all conferences
                </button>
              </div>
            ) : (
              /* Two different nothings. "Your filters matched nothing" wants a
                 way back to the full list; "the directory is empty" wants an
                 invitation to fill it. Telling a searcher the product is
                 launching soon, next to 157 conferences, is neither. */
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <EmptySVG />
                <h2 className="font-semibold text-lg mt-6 mb-2" style={{ color: '#1C1410', fontFamily: "var(--font-brand), sans-serif" }}>
                  {hasActiveFilters ? 'Nothing matches that' : 'No conferences listed yet'}
                </h2>
                <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: "var(--font-brand), sans-serif", maxWidth: '360px' }}>
                  {hasActiveFilters
                    ? 'Try a different search, a wider region, or clear the filters to see the whole directory'
                    : 'Gavelling Conferences is launching soon. Be the first to list your conference'}
                </p>
                <button
                  onClick={() => (hasActiveFilters ? clearFilters() : router.push('/conferences/new'))}
                  className="py-3 px-6 text-sm focus:outline-none"
                  style={PRIMARY_BUTTON}
                >
                  {hasActiveFilters ? 'Clear filters' : 'Organise a conference'}
                </button>
              </div>
            )
          ) : view === 'list' ? (
            <div style={{ borderTop: '2px solid rgba(27,56,40,0.16)' }}>
              {displayed.map(conf => (
                <ConferenceListRow
                  key={conf.id}
                  conf={conf}
                  spotlight={spotlightById.has(conf.id)}
                  onSpotlightClick={() => { const spot = spotlightById.get(conf.id); if (spot) recordSpotlightClick(spot.booking_id); }}
                  creditSponsored={sponsoredIds.has(conf.id)}
                  applied={appliedIds.has(conf.id)}
                  member={isMember(conf)}
                  hovered={hoveredId === conf.id}
                  onHover={() => setHoveredId(conf.id)}
                  onLeave={() => setHoveredId(null)}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" style={{ gap: '20px' }}>
              {displayed.map(conf => {
                const spot = spotlightById.get(conf.id);
                return (
                  <ConferenceCard
                    key={conf.id}
                    conf={conf}
                    compact
                    spotlight={!!spot}
                    creditSponsored={sponsoredIds.has(conf.id)}
                    applied={appliedIds.has(conf.id)}
                    member={isMember(conf)}
                    hovered={hoveredId === conf.id}
                    onHover={() => setHoveredId(conf.id)}
                    onLeave={() => setHoveredId(null)}
                    onClick={() => { if (spot) recordSpotlightClick(spot.booking_id); router.push(`/conferences/${conf.slug}`); }}
                  />
                );
              })}
            </div>
          )}

          {/* The list has ended and a country filter is what ended it. Rather
              than stopping at a short list, name the handful of big rooms
              elsewhere and say plainly what they are: far away, and large. */}
          {showBigElsewhere && (
            <section
              aria-label="Bigger conferences elsewhere"
              className="mt-12"
              style={{
                borderTop: '1px solid rgba(221,212,192,0.9)',
                paddingTop: '26px',
              }}
            >
              <div className="flex items-baseline flex-wrap gap-x-3 gap-y-1 mb-5">
                <h2
                  style={{
                    fontFamily: "var(--font-brand), sans-serif", fontWeight: 800, fontSize: 'clamp(20px, 2vw, 26px)',
                    color: '#1C1410', margin: 0,
                  }}
                >
                  Bigger Conferences Worth Travelling For
                </h2>
                <p
                  style={{
                    fontFamily: "var(--font-brand), sans-serif", fontWeight: 500, fontSize: '13px',
                    color: '#8A7D6C', margin: 0,
                  }}
                >
                  Outside your filter, {BIG_CONFERENCE_DELEGATES}+ delegates expected
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" style={{ gap: '20px' }}>
                {bigElsewhere.map(conf => (
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
            </section>
          )}

          {/* Country tab, subtle reset to the worldwide directory */}
          {!loading && countryMode && displayed.length > 0 && (
            <div className="flex justify-center mt-10">
              <button
                onClick={clearRegion}
                className="inline-flex items-center gap-1.5 focus:outline-none"
                style={{
                  fontFamily: "var(--font-brand), sans-serif", fontWeight: 700, fontSize: '14px',
                  color: '#1B3828', background: 'transparent', border: 'none', cursor: 'pointer',
                  textDecoration: 'underline', textUnderlineOffset: '3px',
                }}
              >
                <Globe size={14} strokeWidth={2.25} />
                Explore all conferences
              </button>
            </div>
          )}
          </section>
        </main>

        <SiteFooter />
      </div>
      {spotlightDialog && <ConferenceSpotlightDialog rows={spotlightDialog} onClose={() => setSpotlightDialog(null)} />}
    </div>
  );
}
