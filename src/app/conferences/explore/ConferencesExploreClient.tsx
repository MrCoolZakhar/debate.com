'use client';

// ── Explore conferences (/conferences/explore), redesigned 26 Sep 2026 ──────
// Owner: "revert the background ... do a complete redesign of the page. Find
// best event platforms and do it that way. I like the top bar for searching."
// Built after Luma discover, Eventbrite, Meetup and Resident Advisor, in
// Gavelling's ivory, white, forest and gold (CLAUDE.md §8, "The Explore page"):
//   1. a compact hero: the title, the count line and the search pill (its
//      When is the ONE date control: All dates, This week, This month, ...)
//   2. one band: the filter chips (a When chip on phones only, where the pill
//      shows only Where), then the places (Near you, the six regions, the
//      countries) as small flag chips scrolling sideways
//   3. the results line (count, sort, view), then booked Spotlights as one
//      row of normal cards with the gold ring, then the feed grouped by month
//      under plain month headers, as a list or the photo-card grid
// Owner, 26 Sep 2026: the gap before the conferences must be "one tab max".
// Every control drives a filter the page already had, and so its existing
// URL parameter. Nothing new is read or invented.

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Search, CalendarDays, Ticket, Globe, MapPin, Monitor, School, GraduationCap, Heart, DoorOpen, Navigation, Plus,
} from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { supabase } from '@/lib/supabase';
import { getCountryByName, getCountryByCode, UN_COUNTRIES, fold, countryIdentity, countryMatchRank } from '@/lib/countries';
import { CircleFlag } from '@/components/CircleFlag';
import { fetchDelegatePrices, withDelegatePrice } from '@/lib/publicFees';
import { compareStartDate, hasConcluded } from '@/lib/conferenceDates';
import { ConferenceCard, ConferenceCardSkeleton } from '../ConferenceCard';
import { GoldWord } from '@/components/BrandHeading';
import {
  ChipLayer, ChoiceRow, chipStyle, FilterChip, PlaceStrip, PRIMARY_BUTTON, SCROLL_CSS, SearchPill, SortMenu, ToggleChip, ViewToggle,
  type DateTab, type ExploreView, type PlaceItem,
} from './ExploreChrome';
import {
  FEED_CSS, FeedRows, FeedSkeleton, MonthHeader, groupByMonth,
  type ExploreConference, type SpotlightItem,
} from './ExploreFeed';
import { isListedConference } from '@/lib/publicConferences';
import { fetchFeatured, recordSpotlightClick, recordSpotlightView, type FeaturedRow } from '@/lib/spotlight';
import { fetchCreditSponsoredIds } from '@/lib/creditSponsored';
import ConferenceSpotlightDialog, { claimSpotlightDialog } from './ConferenceSpotlightDialog';
import {
  PRICE_OPTIONS, ROLE_OPTIONS, matchesDateBucket, matchesDateRange, matchesPrice, matchesRoles,
  parseDateOnly, parseFacets, readExploreQuery, writeExploreQuery, toDateOnly,
  type DateFilter, type FacetMap, type PriceFilter, type RoleKey,
} from './exploreFilters';

const FONT = "var(--font-brand), sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5C5140';
const FOREST = '#1B3828';
const IVORY = '#EDE7D8';
// The paper grain every public page lays over the ivory (pricing, legal).
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

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



// ── Types ──────────────────────────────────────────────────────────────────

type Conference = ExploreConference;

// Resolve a Vercel ISO-3166 alpha-2 code (e.g. "GB") to a full country name
// so it can be matched against conference.country ("United Kingdom").
function countryNameFromCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const hit = UN_COUNTRIES.find(c => c.code.toUpperCase() === code.toUpperCase());
  return hit?.name ?? null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const VIEW_STORAGE_KEY = 'gavelling-explore-view';
type DateSort = 'asc' | 'desc';

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
function CountrySearch({ options, chosen, onAdd, idPrefix = 'gv-explore' }: {
  options: CountryFacet[];
  chosen: ReadonlySet<string>;
  onAdd: (id: string) => void;
  /** Unique per mounted panel (the desktop panel and the phone sheet). */
  idPrefix?: string;
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
          aria-controls={`${idPrefix}-country-list`}
          aria-activedescendant={matches[active] ? `${idPrefix}-country-${matches[active].id}` : undefined}
          className="w-full py-2.5 pl-8 pr-3 text-[16px] lg:text-[14px] focus:outline-none"
          style={{
            border: '1px solid rgba(28,20,16,0.18)', borderRadius: '12px',
            backgroundColor: '#FFFFFF', color: '#1C1410', fontFamily: "var(--font-brand), sans-serif",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(28,20,16,0.18)'; }}
        />
      </div>
      {q.trim() && (
        <div id={`${idPrefix}-country-list`} role="listbox" aria-label="Countries" style={{ marginTop: 4 }}>
          {matches.length === 0 ? (
            <p style={{ margin: '4px 10px', fontSize: '11.5px', color: '#6E5F4E', fontFamily: "var(--font-brand), sans-serif" }}>
              No conferences in a country like that
            </p>
          ) : matches.map((c, i) => (
            <button
              key={c.id}
              id={`${idPrefix}-country-${c.id}`}
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

  // List (the month feed, default) or grid, restored from localStorage after
  // mount (SSR-safe).
  const [view, setView] = useState<ExploreView>('list');
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
  const isMember = useCallback(
    (c: Conference) => memberIds.has(c.id) || (!!user && c.organizer_id === user.id),
    [memberIds, user],
  );

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

  // The Spotlight row: the booked spotlights that passed every filter, in the
  // row's order. They lead the page in their own row, so the feed below
  // carries the rest in date order.
  const spotItems = useMemo<SpotlightItem[]>(() => {
    const byId = new Map(filtered.map(c => [c.id, c]));
    return spotlightRows
      .map(r => { const conf = byId.get(r.conference_id); return conf ? { conf, spot: r } : null; })
      .filter((x): x is SpotlightItem => !!x);
  }, [filtered, spotlightRows]);
  const feed = useMemo(() => {
    if (spotItems.length === 0) return sorted;
    const ids = new Set(spotItems.map(s => s.conf.id));
    return sorted.filter(c => !ids.has(c.id));
  }, [sorted, spotItems]);

  // Country tab shows up to 4 local conferences prominently.
  const displayed = countryMode ? feed.slice(0, 4) : feed;
  const months = useMemo(() => groupByMonth(displayed), [displayed]);

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

  // How many continents the listed conferences span, for the header line.
  const continentCount = useMemo(() => {
    const hit = new Set<string>();
    for (const c of conferences) {
      if (hasConcluded(c)) continue;
      const id = countryIdentity(c.country);
      for (const [key, ids] of Object.entries(continentIdentities)) if (ids.has(id)) { hit.add(key); break; }
    }
    return hit.size;
  }, [conferences, continentIdentities]);

  const resultsRef = useRef<HTMLElement>(null);
  function scrollToResults() {
    const el = resultsRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 88;
    if (Math.abs(window.scrollY - top) > 24) window.scrollTo({ top, behavior: 'smooth' });
  }

  const toggleNear = () => { if (nearId) { if (nearActive) removeCountry(nearId); else addCountry(nearId); } };

  // Grid: one column on a phone, two on a tablet, three at 1024, four at 1280
  // (CLAUDE.md §8, "The Explore page"). Plain CSS (below).
  const GRID = 'gv-explore-grid';
  const GRID_GAP: React.CSSProperties = { columnGap: 'clamp(18px, 1.8vw, 28px)', rowGap: 'clamp(32px, 3vw, 40px)' };

  const cardFor = (conf: Conference, spot?: FeaturedRow) => (
    <ConferenceCard
      key={conf.id}
      conf={conf}
      variant="listing"
      href={`/conferences/${conf.slug}`}
      spotlight={!!spot}
      creditSponsored={sponsoredIds.has(conf.id)}
      applied={appliedIds.has(conf.id)}
      member={isMember(conf)}
      hovered={hoveredId === conf.id}
      onHover={() => setHoveredId(conf.id)}
      onLeave={() => setHoveredId(null)}
      // A real link navigates; this only records the spotlight click.
      onClick={() => { if (spot) recordSpotlightClick(spot.booking_id); }}
    />
  );


  // ── Derived for the new chrome ────────────────────────────────────────────
  const todayIso = toDateOnly(new Date());
  const weekEndIso = (() => { const d = new Date(); d.setDate(d.getDate() + 6); return toDateOnly(d); })();
  const thisWeek = !dateFilter && dateFrom === todayIso && dateTo === weekEndIso;
  const customRange = (!!dateFrom || !!dateTo) && !thisWeek;
  const pickBucket = (v: DateFilter) => { setDateFilter(v); setDateFrom(''); setDateTo(''); };
  const dateTabs: DateTab[] = [
    { key: 'any', label: 'All dates', active: !dateFilter && !dateFrom && !dateTo, onClick: () => pickBucket('') },
    { key: 'week', label: 'This week', active: thisWeek, onClick: () => { if (thisWeek) pickBucket(''); else { setDateFilter(''); setDateFrom(todayIso); setDateTo(weekEndIso); } } },
    { key: 'month', label: 'This month', active: dateFilter === 'month' && !dateFrom && !dateTo, onClick: () => pickBucket(dateFilter === 'month' ? '' : 'month') },
    { key: 'quarter', label: 'Next 3 months', active: dateFilter === 'quarter' && !dateFrom && !dateTo, onClick: () => pickBucket(dateFilter === 'quarter' ? '' : 'quarter') },
    { key: 'later', label: 'Later', active: dateFilter === 'later' && !dateFrom && !dateTo, onClick: () => pickBucket(dateFilter === 'later' ? '' : 'later') },
  ];
  const shortDate = (iso: string) => parseDateOnly(iso)?.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) ?? '';
  const rangeSummary = customRange ? `${dateFrom ? shortDate(dateFrom) : 'Any'} to ${dateTo ? shortDate(dateTo) : 'Any'}` : null;

  const roleSummary = roleFilter.size === 0 ? null
    : roleFilter.size === ROLE_OPTIONS.length ? 'Open for every role'
      : `Open for ${ROLE_OPTIONS.filter(r => roleFilter.has(r.key)).map(r => r.label.toLowerCase()).join(', ')}`;
  const priceSummary = PRICE_OPTIONS.find(p => p.key === priceFilter && p.key !== '')?.label ?? null;
  const formatSummary = formatFilter === 'in-person' ? 'In person' : formatFilter === 'online' ? 'Online' : null;
  const levelSummary = levelFilter === 'school' ? 'High school' : levelFilter === 'university' ? 'University' : null;

  // Place rail counts come from everything but the place filter itself.
  const continentCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const c of preRegion) {
      const id = countryIdentity(c.country);
      for (const [key, ids] of Object.entries(continentIdentities)) if (ids.has(id)) { out[key] = (out[key] ?? 0) + 1; break; }
    }
    return out;
  }, [preRegion, continentIdentities]);

  const placeItems: PlaceItem[] = useMemo(() => {
    const items: PlaceItem[] = [];
    items.push({
      key: 'everywhere', label: 'Everywhere', icon: Globe, count: preRegion.length,
      active: !continentKey && countryIds.length === 0, onClick: clearRegion,
    });
    if (userCountry && nearId) {
      items.push({
        key: 'near', label: userCountry, kicker: 'Near you', code: userCode, icon: Navigation, count: userCountryCount,
        active: nearActive, onClick: toggleNear,
      });
    }
    for (const k of REGION_ORDER) {
      items.push({
        key: `region-${k}`, label: CONTINENT_LABELS[k], icon: Globe, count: continentCounts[k] ?? 0,
        active: continentKey === k, onClick: () => changeContinent(continentKey === k ? null : k),
      });
    }
    // Chosen countries first, then the countries with the most conferences.
    const seen = new Set<string>(nearId ? [nearId] : []);
    const countries = [...chipCountries, ...countryFacets.slice(0, 12)];
    for (const c of countries) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      const active = countryIdSet.has(c.id);
      items.push({
        key: `country-${c.id}`, label: c.name, code: c.code, icon: MapPin, count: c.count,
        active, onClick: () => (active ? removeCountry(c.id) : addCountry(c.id)),
      });
    }
    return items;
    // The handlers are plain closures over state already listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preRegion.length, continentKey, countryIds, userCountry, nearId, userCode, userCountryCount, nearActive, continentCounts, chipCountries, countryFacets, countryIdSet]);

  // The results heading: the count as a big number with the words beside it.
  const resultNoun = (n: number) => (n === 1 ? 'conference' : 'conferences');
  const resultsHeading = (() => {
    if (loading) return null;
    if (aroundYouMode) return { flag: undefined as string | undefined, n: sorted.length, words: `${resultNoun(sorted.length)} around the world` };
    if (countryMode) return { flag: userCode, n: sorted.length, words: `${resultNoun(sorted.length)} in ${userCountry}` };
    if (selectedCountry) return { flag: selectedCountry.code, n: sorted.length, words: `${resultNoun(sorted.length)} in ${selectedCountry.name}` };
    return { flag: undefined, n: sorted.length, words: `${resultNoun(sorted.length)}${continentLabel && countryIds.length === 0 ? ` in ${continentLabel}` : ''}` };
  })();

  const facetsLoaded = facets.size > 0;

  const sectionGap = 'clamp(26px, 3vw, 40px)';

  return (
    // Explore is back on the brand ground (owner, 26 Sep 2026: the white page
    // "doesn't fit the brand"): ivory with the site's paper grain. White is
    // for the cards and panels on top of it.
    <div className="min-h-screen flex flex-col relative" style={{ backgroundColor: IVORY, overflowX: 'clip', fontFamily: FONT }}>
      <div
        className="pointer-events-none fixed inset-0 z-0"
        aria-hidden
        style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }}
      />
      <style>{`
        ${SCROLL_CSS}
        ${FEED_CSS}
        .gv-explore-wrap { width: 100%; max-width: 1280px; margin: 0 auto; padding-left: 16px; padding-right: 16px; }
        @media (min-width: 640px) { .gv-explore-wrap { padding-left: 24px; padding-right: 24px; } }
        @media (min-width: 1024px) { .gv-explore-wrap { padding-left: 40px; padding-right: 40px; } }
        .gv-explore-grid { display: grid; grid-template-columns: minmax(0, 1fr); }
        @media (min-width: 640px) { .gv-explore-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (min-width: 1024px) { .gv-explore-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
        @media (min-width: 1280px) { .gv-explore-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
        .gv-explore-band { display: flex; align-items: center; gap: 10px; overflow-x: auto; scrollbar-width: none; padding: 4px 2px; margin: 0 -2px; }
        .gv-explore-band button { flex-shrink: 0; }
        .gv-place-strip { flex-shrink: 0; }
        .gv-band-rule { flex-shrink: 0; width: 1px; height: 26px; background-color: rgba(28,20,16,0.14); }
        @media (min-width: 1024px) {
          .gv-explore-band { overflow: visible; }
          .gv-place-strip { flex: 1 1 0; min-width: 0; overflow-x: auto; scrollbar-width: none; padding: 4px 2px; }
        }
      `}</style>

      <div className="relative z-10 flex flex-col min-h-screen">
        <SiteNav hideLanguage />

        {/* ── 1. Hero: title, count line, the search pill ───────────────── */}
        <header className="gv-explore-wrap" style={{ paddingTop: 'clamp(12px, 1.6vw, 24px)', textAlign: 'center' }}>
          <h1
            style={{
              fontWeight: 800, fontSize: 'clamp(26px, 2.8vw, 38px)', lineHeight: 1.06, letterSpacing: '-0.018em', color: INK, margin: 0,
            }}
          >
            Explore Model UN <GoldWord>Conferences</GoldWord>
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 15, color: INK_SOFT, fontVariantNumeric: 'tabular-nums' }}>
            {headlineCount === null ? (
              'Loading the directory'
            ) : (
              <>
                <span style={{ fontWeight: 800, color: INK }}>{headlineCount.toLocaleString()}</span>
                {` ${headlineCount === 1 ? 'conference' : 'conferences'}`}
                {continentCount > 0 && (
                  <>
                    {' across '}
                    <span style={{ fontWeight: 800, color: INK }}>{continentCount}</span>
                    {` ${continentCount === 1 ? 'continent' : 'continents'}`}
                  </>
                )}
                {'. Running one? '}
                <Link href="/conferences/new" className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] rounded" style={{ fontWeight: 700, color: FOREST, textDecoration: 'underline', textUnderlineOffset: 3 }}>
                  List your conference
                </Link>
              </>
            )}
          </p>
          <div style={{ marginTop: 'clamp(12px, 1.4vw, 18px)' }}>
            <SearchPill
              search={searchQuery} onSearch={setSearchQuery}
              continent={continentKey} continentLabels={CONTINENT_LABELS} onContinent={changeContinent}
              nearCountry={userCountry} nearCode={userCode} nearActive={nearActive} onToggleNear={toggleNear}
              chosenCountryNames={chosenFacets.map(c => c.name)}
              dateFilter={dateFilter} dateFrom={dateFrom} dateTo={dateTo}
              onDate={pickBucket}
              whenLabel={thisWeek ? 'This week' : null}
              whenOptions={dateTabs}
              roles={roleFilter} onToggleRole={toggleRole} onClearRoles={() => setRoleFilter(new Set())}
              onSubmit={scrollToResults}
            />
          </div>
        </header>

        <main className="flex-1" style={{ paddingBottom: 'clamp(40px, 4vw, 64px)' }}>
          {/* ── 2. One band: the filter chips, then the places ─────────────
               Dates live in ONE place, the search pill's When (on phones,
               where the pill shows only Where, a When chip stands in). */}
          <div className="gv-explore-wrap" style={{ marginTop: 'clamp(12px, 1.4vw, 18px)' }}>
            <div role="toolbar" aria-label="Filters and places" className="gv-explore-scroll gv-explore-band">
              <span className="contents sm:hidden">
                <FilterChip
                  label="When" title="When" icon={CalendarDays}
                  active={!dateTabs[0].active}
                  summary={dateTabs.find(t => t.active)?.label ?? rangeSummary}
                  onClear={() => pickBucket('')}
                >
                  <div role="radiogroup" aria-label="When">
                    {dateTabs.map(t => (
                      <ChoiceRow key={t.key} label={t.label} active={t.active} onClick={t.onClick} />
                    ))}
                  </div>
                </FilterChip>
              </span>
              <FilterChip
                label="Open applications" title="Applications open for" icon={DoorOpen}
                active={roleFilter.size > 0} summary={roleSummary} onClear={() => setRoleFilter(new Set())}
              >
                <div role="group" aria-label="Applications open for">
                  {ROLE_OPTIONS.map(r => (
                    <ChoiceRow key={r.key} kind="check" label={r.label} active={roleFilter.has(r.key)} onClick={() => toggleRole(r.key)} />
                  ))}
                </div>
                {facetsFailed && <FacetsNote />}
              </FilterChip>
              <FilterChip
                label="Price" title="Price" icon={Ticket}
                active={!!priceFilter} summary={priceSummary} onClear={() => setPriceFilter('')}
              >
                <div role="radiogroup" aria-label="Price">
                  {PRICE_OPTIONS.map(p => (
                    <ChoiceRow key={p.key || 'any'} label={p.label} active={priceFilter === p.key} onClick={() => setPriceFilter(p.key)} />
                  ))}
                </div>
                <p style={{ margin: '8px 10px 0', fontSize: 12, color: '#6E5F4E' }}>Approximate, converted to USD</p>
                {facetsFailed && <FacetsNote />}
              </FilterChip>
              <FilterChip
                label="Format" title="Format" icon={formatFilter === 'online' ? Monitor : MapPin}
                active={!!formatFilter} summary={formatSummary} onClear={() => setFormatFilter('')}
              >
                <div role="radiogroup" aria-label="Format">
                  <ChoiceRow label="Any format" active={!formatFilter} onClick={() => setFormatFilter('')} />
                  <ChoiceRow label="In person" icon={MapPin} active={formatFilter === 'in-person'} onClick={() => setFormatFilter('in-person')} />
                  <ChoiceRow label="Online" icon={Monitor} active={formatFilter === 'online'} onClick={() => setFormatFilter('online')} />
                </div>
                <p style={{ margin: '8px 10px 0', fontSize: 12, color: '#6E5F4E' }}>Hybrid conferences answer to both</p>
              </FilterChip>
              <FilterChip
                label="Level" title="Level" icon={levelFilter === 'school' ? School : GraduationCap}
                active={!!levelFilter} summary={levelSummary} onClear={() => setLevelFilter('')}
              >
                <div role="radiogroup" aria-label="Level">
                  <ChoiceRow label="Any level" active={!levelFilter} onClick={() => setLevelFilter('')} />
                  <ChoiceRow label="High school" icon={School} active={levelFilter === 'school'} onClick={() => setLevelFilter('school')} />
                  <ChoiceRow label="University" icon={GraduationCap} active={levelFilter === 'university'} onClick={() => setLevelFilter('university')} />
                </div>
              </FilterChip>
              <ToggleChip label="Credit sponsored" icon={Heart} active={sponsoredFilter} onClick={() => setSponsoredFilter(!sponsoredFilter)} />
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] rounded"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 6px', fontFamily: FONT, fontSize: 14, fontWeight: 700, color: INK, textDecoration: 'underline', textUnderlineOffset: 3, whiteSpace: 'nowrap' }}
                >
                  Clear all
                </button>
              )}
              <span aria-hidden className="gv-band-rule" />
              <PlaceStrip
                items={placeItems}
                trailing={<AddCountryChip options={searchCountries} chosen={countryIdSet} onAdd={addCountry} />}
              />
            </div>
          </div>

          {/* ── 6. The feed ───────────────────────────────────────────────── */}
          <section ref={resultsRef} className="gv-explore-wrap" aria-label="Conferences" style={{ marginTop: 'clamp(12px, 1.4vw, 18px)' }}>
            <div className="flex items-center flex-wrap" style={{ gap: '10px 16px', marginBottom: 6 }}>
              {resultsHeading ? (
                <p className="inline-flex items-baseline flex-wrap" style={{ margin: 0, gap: 8, color: INK, fontVariantNumeric: 'tabular-nums' }}>
                  {resultsHeading.flag && <CircleFlag code={resultsHeading.flag} size={22} decorative style={{ alignSelf: 'center' }} />}
                  <span style={{ fontWeight: 800, fontSize: 'clamp(26px, 2.4vw, 32px)', lineHeight: 1 }}>{resultsHeading.n.toLocaleString()}</span>
                  <span style={{ fontWeight: 600, fontSize: 16, color: '#4A4238', overflowWrap: 'anywhere' }}>
                    {resultsHeading.words}
                    {countryMode && displayed.length < feed.length ? `, the first ${displayed.length} below` : ''}
                  </span>
                </p>
              ) : (
                <span style={{ fontWeight: 700, fontSize: 15, color: '#6B5F52' }}>Loading conferences</span>
              )}
              <div className="flex items-center" style={{ gap: 14, marginLeft: 'auto' }}>
                <SortMenu sort={dateSort} onChange={setDateSort} />
                <ViewToggle view={view} onChange={changeView} />
              </div>
            </div>

            {!loading && spotItems.length > 0 && (
              <section aria-label="In the Spotlight" style={{ marginTop: 8 }}>
                <p style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 800, color: INK }}>
                  In the <GoldWord>Spotlight</GoldWord>
                </p>
                <div className={GRID} style={GRID_GAP}>
                  {spotItems.map(({ conf, spot }) => cardFor(conf, spot))}
                </div>
              </section>
            )}

            {loading ? (
              view === 'list' ? (
                <div aria-busy="true" aria-label="Loading conferences"><FeedSkeleton /></div>
              ) : (
                <div className={GRID} style={{ ...GRID_GAP, marginTop: 16 }} aria-busy="true" aria-label="Loading conferences">
                  {Array.from({ length: 8 }).map((_, i) => <ConferenceCardSkeleton key={i} variant="listing" />)}
                </div>
              )
            ) : displayed.length === 0 && spotItems.length === 0 ? (
              // Empty: one line and one button.
              <div className="flex flex-col items-center justify-center text-center" style={{ padding: 'clamp(40px, 7vw, 88px) 0', gap: 16 }}>
                {countryMode && !searchQuery && !formatFilter && !levelFilter ? (
                  <>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 17, color: INK }}>No conferences in {userCountry} yet</p>
                    <button onClick={clearRegion} className="py-3 px-6 text-[15px] focus:outline-none" style={PRIMARY_BUTTON}>
                      Explore all conferences
                    </button>
                  </>
                ) : (
                  <>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 17, color: INK }}>
                      {hasActiveFilters ? 'No conferences match these filters' : 'No conferences listed yet'}
                    </p>
                    <button
                      onClick={() => (hasActiveFilters ? clearFilters() : router.push('/conferences/new'))}
                      className="py-3 px-6 text-[15px] focus:outline-none"
                      style={PRIMARY_BUTTON}
                    >
                      {hasActiveFilters ? 'Clear filters' : 'List your conference'}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-col" style={{ gap: 'clamp(14px, 1.6vw, 22px)' }}>
                {months.map(g => (
                  <section key={g.key} aria-label={g.label}>
                    <MonthHeader label={g.label} count={g.items.length} />
                    {view === 'list' ? (
                      <FeedRows
                        items={g.items}
                        facets={facets}
                        facetsLoaded={facetsLoaded}
                        sponsoredIds={sponsoredIds}
                        appliedIds={appliedIds}
                        isMember={isMember}
                      />
                    ) : (
                      <div className={GRID} style={{ ...GRID_GAP, paddingTop: 6 }}>
                        {g.items.map(conf => cardFor(conf))}
                      </div>
                    )}
                  </section>
                ))}
              </div>
            )}

            {/* Country tab: a quiet way back to the whole directory */}
            {!loading && countryMode && displayed.length > 0 && (
              <div className="flex justify-center" style={{ marginTop: 28 }}>
                <button
                  onClick={clearRegion}
                  className="inline-flex items-center gap-1.5 focus:outline-none"
                  style={{ fontWeight: 700, fontSize: 14.5, color: FOREST, background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
                >
                  <Globe size={15} strokeWidth={2.25} aria-hidden />
                  Explore all conferences
                </button>
              </div>
            )}
          </section>

          {/* A country filter ended the list: name the big rooms elsewhere. */}
          {showBigElsewhere && (
            <section className="gv-explore-wrap" aria-labelledby="gv-explore-big" style={{ marginTop: sectionGap }}>
              <div className="flex items-baseline flex-wrap" style={{ columnGap: 12, rowGap: 4, marginBottom: 16 }}>
                <h2 id="gv-explore-big" style={{ fontWeight: 800, fontSize: 'clamp(22px, 2.2vw, 30px)', color: INK, margin: 0, letterSpacing: '-0.012em' }}>
                  Bigger Conferences Worth <GoldWord>Travelling</GoldWord>
                </h2>
                <p style={{ fontWeight: 500, fontSize: 14, color: '#6B5F52', margin: 0 }}>
                  Outside your filter, {BIG_CONFERENCE_DELEGATES}+ delegates expected
                </p>
              </div>
              <div className={GRID} style={GRID_GAP}>
                {bigElsewhere.map(conf => cardFor(conf))}
              </div>
            </section>
          )}
        </main>

        <SiteFooter />
      </div>

      {spotlightDialog && <ConferenceSpotlightDialog rows={spotlightDialog} onClose={() => setSpotlightDialog(null)} />}
    </div>
  );
}

/** The last chip of the place strip: type to add any country with conferences. */
function AddCountryChip({ options, chosen, onAdd }: {
  options: CountryFacet[];
  chosen: ReadonlySet<string>;
  onAdd: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => { setOpen(false); btn.current?.focus(); }, []);
  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] focus-visible:ring-offset-2"
        style={chipStyle(false)}
      >
        <Plus size={16} strokeWidth={2.4} aria-hidden />
        Another country
      </button>
      <ChipLayer open={open} anchor={btn} onClose={close} title="Add a country">
        <CountrySearch options={options} chosen={chosen} onAdd={(id) => { onAdd(id); close(); }} idPrefix="gv-explore-add" />
      </ChipLayer>
    </>
  );
}
