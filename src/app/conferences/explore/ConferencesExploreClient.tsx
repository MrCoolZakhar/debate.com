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
// 27 Sep 2026 (owner's list): the Where field suggests every country (and
// matching conferences) as you type, a pick becomes a removable country chip;
// Near you is the visitor's IP country (/api/geo); the grid of compact cards
// is the default, Spotlights first as wider feature cards; no count lines;
// an "Organise your conference" button beside the title.
// Every control drives a filter the page already had, and so its existing
// URL parameter. Nothing new is read or invented.

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  CalendarDays, Ticket, Globe, MapPin, Monitor, School, GraduationCap, Heart, DoorOpen, Plus, X,
} from 'lucide-react';

/** Country names are matched in English, Spanish and French (localised names
 *  and aliases through countryMatchRank), best rank wins. */
function bestCountryRank(name: string, q: string): number | null {
  let best: number | null = null;
  for (const lang of ['en', 'es', 'fr']) {
    const r = countryMatchRank(name, q, lang);
    if (r !== null && (best === null || r < best)) best = r;
  }
  return best;
}
import SiteNav from '@/components/SiteNav';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { supabase } from '@/lib/supabase';
import { getCountryByName, getCountryByCode, UN_COUNTRIES, fold, countryIdentity, countryMatchRank } from '@/lib/countries';
import { conferenceAcronymLabel } from '@/lib/conferenceLabels';
import { CircleFlag } from '@/components/CircleFlag';
import { fetchDelegatePrices, withDelegatePrice } from '@/lib/publicFees';
import { compareStartDate, hasConcluded } from '@/lib/conferenceDates';
import { ConferenceCard, ConferenceCardSkeleton } from '../ConferenceCard';
import { GoldWord } from '@/components/BrandHeading';
import {
  ChoiceRow, FilterChip, PRIMARY_BUTTON, SCROLL_CSS, SearchPill, SortMenu, ToggleChip, ViewToggle,
  type DateTab, type ExploreView, type SuggestConference, type SuggestCountry,
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
/** The most countries the Where field adds as pills (27 Sep 2026). */
const MAX_PLACE_COUNTRIES = 5;
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

// v2 (27 Sep 2026): the grid became the default, so a 'list' saved under the
// old key (often just the old default being clicked) is not carried over.
const VIEW_STORAGE_KEY = 'gavelling-explore-view-v2';
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
  function changeContinent(k: string | null) {
    setContinent(k);
    // A region replaces any countries (27 Sep 2026).
    if (k) setCountryIds([]);
    setRegionTouched(true);
  }
  function addCountry(id: string) {
    // At most MAX_PLACE_COUNTRIES countries (27 Sep 2026).
    setCountryIds(prev => (prev.includes(id) || prev.length >= MAX_PLACE_COUNTRIES ? prev : [...prev, id]));
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

  // Grid (the compact cards) by default (owner, 27 Sep 2026: "by default in
  // explore have card view first"). Only a visitor who chose the list keeps
  // it, restored from localStorage after mount (SSR-safe).
  const [view, setView] = useState<ExploreView>('grid');
  useEffect(() => {
    try {
      if (window.localStorage.getItem(VIEW_STORAGE_KEY) === 'list') setView('list');
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

  // Near you (27 Sep 2026, owner: "the country that the IP is geographically"):
  // where the visitor IS, never where they are from (Peter, in Indonesia, was
  // shown Slovakia, his nationality). The country comes from /api/geo
  // (Vercel's IP-country header, read on our own server, no third party),
  // asked ONCE per page load. Only when that says nothing (localhost, a
  // missing header) does it fall back to the browser locale's region; with
  // neither there is no near-you. The profile nationality is never used.
  const [userCountry, setUserCountry] = useState<string | null>(null);
  // undefined = still asking; null = /api/geo gave no country.
  const [geoCountry, setGeoCountry] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/geo', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then((j: { countryCode?: string | null; country?: string | null } | null) => {
        if (!cancelled) setGeoCountry(countryNameFromCode(j?.countryCode ?? j?.country ?? null));
      })
      .catch(() => { if (!cancelled) setGeoCountry(null); });
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
    // Identity, not raw strings: a visitor geolocated to "Turkey" must still
    // match conferences stored as "Türkiye". Same rule as the filter below.
    const localId = countryIdentity(userCountry);
    const localCount = conferences.filter(
      c => countryIdentity(c.country) === localId
    ).length;
    // Otherwise the whole directory stays on screen.
    if (localCount >= 4) setCountryIds([localId]);
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

  // Near you: the IP country when /api/geo knows it, else the browser
  // locale's region, else none. Deferred a tick (never set in the effect body).
  useEffect(() => {
    if (geoCountry === undefined) return;
    let cancelled = false;
    void Promise.resolve().then(() => { if (!cancelled) setUserCountry(geoCountry || localeCountry()); });
    return () => { cancelled = true; };
  }, [geoCountry]);

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

  const upcomingCount = useMemo(() => conferences.filter(c => !hasConcluded(c)).length, [conferences]);

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
      const countryHit = bestCountryRank(c.country, searchQuery) !== null;
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


  // Every chosen country resolved to a name and flag, facet or not (a country
  // from a shared link may have nothing under today's other filters).
  const chosenFacets = useMemo<CountryFacet[]>(() => countryIds.map(id => {
    const f = countryFacets.find(c => c.id === id);
    if (f) return f;
    const known = getCountryByCode(id);
    return { id, name: known?.name ?? id, code: known?.code, count: 0 };
  }), [countryIds, countryFacets]);
  // The first chosen country leads the spotlight.
  const firstCountry = chosenFacets[0] ?? null;

  // EVERY country (owner, 27 Sep 2026: "when searching for a country it
  // doesn't appear"), not only those with conferences today, with how many
  // upcoming conferences each has. Non-UN places that conferences use are
  // added from the facets.
  const allCountries = useMemo<CountryFacet[]>(() => {
    const counts = new Map<string, number>();
    for (const c of conferences) {
      if (!c.country || hasConcluded(c)) continue;
      const id = countryIdentity(c.country);
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    const out = new Map<string, CountryFacet>();
    for (const c of UN_COUNTRIES) {
      if (!/^[A-Z]{2}$/.test(c.code) || c.code === 'EU') continue;
      const id = countryIdentity(c.name);
      if (!out.has(id)) out.set(id, { id, name: c.name, code: c.code, count: counts.get(id) ?? 0 });
    }
    for (const f of countryFacets) if (!out.has(f.id)) out.set(f.id, { ...f, count: counts.get(f.id) ?? f.count });
    return [...out.values()];
  }, [conferences, countryFacets]);
  const countryIdSet = useMemo(() => new Set(countryIds), [countryIds]);

  // What the pill's Where suggests while typing: countries (any, ranked by
  // name, localised name and alias) and conferences by name, acronym or city.
  const countrySuggestions = useMemo<SuggestCountry[]>(() => {
    const q = searchQuery.trim();
    if (!q) return [];
    return allCountries
      .filter(c => !countryIdSet.has(c.id))
      .map(c => ({ c, rank: bestCountryRank(c.name, q) }))
      .filter((x): x is { c: CountryFacet; rank: number } => x.rank !== null)
      .sort((a, b) => a.rank - b.rank || b.c.count - a.c.count || a.c.name.localeCompare(b.c.name))
      .slice(0, 5)
      .map(x => x.c);
  }, [allCountries, countryIdSet, searchQuery]);
  const conferenceSuggestions = useMemo<SuggestConference[]>(() => {
    const q = fold(searchQuery);
    if (q.length < 2) return [];
    const out: SuggestConference[] = [];
    for (const c of conferences) {
      if (hasConcluded(c)) continue;
      if (!fold(c.full_name).includes(q) && !fold(c.acronym).includes(q) && !fold(c.city).includes(q)) continue;
      const label = conferenceAcronymLabel(c) || c.full_name;
      const place = [c.city?.trim(), c.country?.trim()].filter(Boolean).join(', ');
      const sub = [label !== c.full_name ? c.full_name : '', place].filter(Boolean).join(' · ');
      out.push({ id: c.id, slug: c.slug, label, sub, logo_url: c.logo_url });
      if (out.length >= 4) break;
    }
    return out;
  }, [conferences, searchQuery]);
  function pickCountry(id: string) {
    setContinent(null);
    addCountry(id);
    setSearchQuery('');
  }

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
  const spotlightRows = useMemo(() => (spotTarget && regionSpots.key === spotTarget ? regionSpots.rows : []), [spotTarget, regionSpots]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    // Undated (TBD) conferences sort last in BOTH directions, and a null
    // start_date must never reach .localeCompare — see compareStartDate.
    copy.sort((a, b) => compareStartDate(a.start_date, b.start_date, dateSort === 'asc' ? 'asc' : 'desc'));
    return copy;
  }, [filtered, dateSort]);

  // The spotlight conferences (27 Sep 2026): first the Country / Region
  // Spotlight of the place in force, then the Explore Spotlight bookings.
  // Spotlights get NO special treatment from the filters (owner): each is
  // looked up in `filtered`, every filter the place included, so a spotlight
  // a filter excludes is not shown at all. Those that pass go first in the
  // grid and stay in their date place in the list. (The Explore row is never
  // REPLACED by the Country row: both are read and merged here.)
  const spotItems = useMemo<SpotlightItem[]>(() => {
    const inFilter = new Map(filtered.map(c => [c.id, c]));
    const out: SpotlightItem[] = [];
    const seen = new Set<string>();
    const push = (r: FeaturedRow, conf: Conference | undefined) => {
      if (!conf || seen.has(conf.id)) return;
      seen.add(conf.id);
      out.push({ conf, spot: r });
    };
    for (const r of spotlightRows) if (spotTarget) push(r, inFilter.get(r.conference_id));
    for (const r of exploreSpots) push(r, inFilter.get(r.conference_id));
    return out;
  }, [filtered, spotlightRows, spotTarget, exploreSpots]);

  // One 'view' per session per spotlight booking that is on screen.
  useEffect(() => {
    for (const s of spotItems) recordSpotlightView(s.spot.booking_id);
  }, [spotItems]);
  const feed = useMemo(() => {
    if (spotItems.length === 0) return sorted;
    const ids = new Set(spotItems.map(s => s.conf.id));
    return sorted.filter(c => !ids.has(c.id));
  }, [sorted, spotItems]);

  // Every result is shown (owner, 27 Sep 2026: "displays too little
  // conferences"); the near-you view used to stop at four.
  const displayed = feed;
  // The list view: every result in the chosen date order, spotlights included
  // in their own date place (the grid alone puts them first).
  const listItems = useMemo(() => {
    const ids = new Set(sorted.map(c => c.id));
    const extra = spotItems.map(s => s.conf).filter(c => !ids.has(c.id));
    if (extra.length === 0) return sorted;
    const all = [...sorted, ...extra];
    all.sort((a, b) => compareStartDate(a.start_date, b.start_date, dateSort === 'asc' ? 'asc' : 'desc'));
    return all;
  }, [sorted, spotItems, dateSort]);
  const listMonths = useMemo(() => groupByMonth(listItems), [listItems]);
  const spotById = useMemo(() => new Map(spotItems.map(s => [s.conf.id, s.spot])), [spotItems]);
  const spotInPlace = useMemo(() => ({
    spotFor: (c: { id: string }) => spotById.get(c.id),
    onOpen: (spot: FeaturedRow) => recordSpotlightClick(spot.booking_id),
  }), [spotById]);

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

  const resultsRef = useRef<HTMLElement>(null);
  function scrollToResults() {
    const el = resultsRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 88;
    if (Math.abs(window.scrollY - top) > 24) window.scrollTo({ top, behavior: 'smooth' });
  }

  const toggleNear = () => { if (nearId) { if (nearActive) removeCountry(nearId); else addCountry(nearId); } };

  // Grid: one column on a phone, two from 600, three from 960, four from 1280,
  // and never more than four (27 Sep 2026: two full rows of four on landing;
  // CLAUDE.md §8, "The Explore page"). Plain CSS (below).
  const GRID = 'gv-explore-grid';
  const GRID_GAP: React.CSSProperties = { columnGap: 'clamp(14px, 1.3vw, 20px)', rowGap: 'clamp(16px, 1.5vw, 22px)' };

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


  const facetsLoaded = facets.size > 0;

  const sectionGap = 'clamp(26px, 3vw, 40px)';

  return (
    // The ivory ground, its paper grain, the server-rendered directory and the
    // footer belong to page.tsx (so they are in the raw HTML); this is the
    // interactive top of the page on that ground.
    <div className="flex flex-col relative" style={{ minHeight: '100vh', fontFamily: FONT }}>
      <style>{`
        ${SCROLL_CSS}
        ${FEED_CSS}
        .gv-explore-grid { display: grid; grid-template-columns: minmax(0, 1fr); }
        @media (min-width: 600px) { .gv-explore-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (min-width: 960px) { .gv-explore-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
        @media (min-width: 1280px) { .gv-explore-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
        .gv-explore-cta { display: inline-flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; white-space: nowrap;
          padding: 10px 18px; font-size: 15px; box-shadow: 0 6px 16px rgba(27,56,40,0.22); transition: transform 160ms ease, box-shadow 160ms ease; }
        .gv-explore-cta:hover { transform: translateY(-1px); box-shadow: 0 10px 22px rgba(27,56,40,0.30); }
        .gv-explore-cta:active { transform: scale(0.98); }
        .gv-explore-cta-top { display: none; }
        .gv-explore-topline { display: flex; align-items: center; gap: 16px; }
        .gv-explore-topline > .gv-explore-pillwrap { flex: 1 1 auto; min-width: 0; max-width: 880px; }
        .gv-explore-topline > .gv-explore-cta-top { margin-left: auto; flex-shrink: 0; }
        .gv-explore-toolbar { display: flex; flex-direction: column; gap: 8px; }
        .gv-explore-toolbar > .gv-explore-band { flex: 1 1 auto; min-width: 0; }
        .gv-explore-sortview { display: flex; align-items: center; justify-content: flex-end; gap: 14px; flex-shrink: 0; }
        @media (min-width: 640px) { .gv-explore-toolbar { flex-direction: row; align-items: center; gap: 16px; } }
        .gv-explore-cta-bottom { display: flex; width: 100%; margin-top: 10px; padding: 13px 24px; font-size: 16px; }
        @media (min-width: 640px) { .gv-explore-cta-top { display: inline-flex; } .gv-explore-cta-bottom { display: none; } }
        @media (prefers-reduced-motion: reduce) { .gv-explore-cta { transition: none; } .gv-explore-cta:hover, .gv-explore-cta:active { transform: none; } }
        .gv-explore-band { display: flex; align-items: center; justify-content: flex-start; gap: 10px; overflow-x: auto; scrollbar-width: none; padding: 4px 2px; margin: 0 -2px; }
        .gv-explore-band button { flex-shrink: 0; }
        @media (min-width: 1024px) { .gv-explore-band { overflow: visible; flex-wrap: wrap; } }
        /* The chosen places, left-aligned under the pill's Where (27 Sep 2026).
           The remove X is a small round button on the pill's top right corner,
           shown on hover or keyboard focus, always on touch screens. */
        .gv-place-chips { list-style: none; margin: 12px 0 0; padding: 0 0 0 14px; display: flex; flex-wrap: wrap; justify-content: flex-start; align-items: center; gap: 10px; max-width: 880px; }
        .gv-place-chip { position: relative; display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px 6px 8px; border-radius: 9999px; background: #FFFFFF;
          box-shadow: 0 1px 2px rgba(27,56,40,0.08), 0 4px 12px rgba(27,56,40,0.08); border: 1px solid rgba(27,56,40,0.08); font-size: 13.5px; font-weight: 700; color: ${INK}; }
        .gv-place-chip-x { position: absolute; top: -7px; right: -7px; width: 22px; height: 22px; border-radius: 9999px; border: 1.5px solid #FFFFFF; cursor: pointer;
          display: inline-flex; align-items: center; justify-content: center; background: ${INK}; color: #FFFFFF;
          box-shadow: 0 2px 6px rgba(28,20,16,0.25); opacity: 0; transform: scale(0.85); transition: opacity 140ms ease, transform 140ms ease; }
        .gv-place-chip:hover .gv-place-chip-x, .gv-place-chip:focus-within .gv-place-chip-x { opacity: 1; transform: scale(1); }
        @media (hover: none) { .gv-place-chip-x { opacity: 1; transform: scale(1); } }
        @media (prefers-reduced-motion: reduce) { .gv-place-chip-x { transition: none; } }
        .gv-place-clear { background: none; border: none; cursor: pointer; padding: 0 6px; font-family: inherit; font-size: 13.5px; font-weight: 700; color: ${INK}; text-decoration: underline; text-underline-offset: 3px; }
      `}</style>

      <div className="flex flex-col flex-1">
        <SiteNav hideLanguage />

        {/* ── 1. Header: the title centred, the search pill centred under it,
             and the places chosen through the pill's Where as small removable
             chips directly under the pill (owner, 27 Sep 2026: "Explore Model
             UN Conferences should be in the middle"; "in the search you should
             be able to add multiple countries"). No band behind anything. The
             "Organise your conference" button sits on the sort / view line
             below, so it never pulls the title off centre; on phones it goes
             full width under the pill. ─────────────────────────────────── */}
        <header className="gv-explore-wrap" style={{ paddingTop: 'clamp(12px, 1.4vw, 22px)' }}>
          {/* 27 Sep 2026: the title larger and on the left with the content;
              the pill hugging the left edge with "Organise your conference"
              on the same line at the right; the chosen places under the pill. */}
          <h1
            style={{
              fontWeight: 800, fontSize: 'clamp(30px, 3.4vw, 48px)', lineHeight: 1.06, letterSpacing: '-0.02em', color: INK, margin: 0,
              textWrap: 'balance',
            }}
          >
            Explore Model UN <GoldWord>Conferences</GoldWord>
          </h1>
          <div className="gv-explore-topline" style={{ marginTop: 'clamp(12px, 1.4vw, 18px)' }}>
            <div className="gv-explore-pillwrap">
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
                countrySuggestions={countrySuggestions}
                conferenceSuggestions={conferenceSuggestions}
                onPickCountry={pickCountry}
                countryLimitReached={!continentKey && countryIds.length >= MAX_PLACE_COUNTRIES}
              />
            </div>
            <Link href="/conferences/new" className="gv-explore-cta gv-explore-cta-top focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] focus-visible:ring-offset-2" style={PRIMARY_BUTTON}>
              <Plus size={17} strokeWidth={2.6} aria-hidden />
              Organise your conference
            </Link>
          </div>
          {(continentKey || chosenFacets.length > 0) && (
            <ul aria-label="Chosen places" className="gv-place-chips">
              {continentKey && continentLabel && (
                <li>
                  <PlaceChip label={continentLabel} icon={<Globe size={15} strokeWidth={2.2} aria-hidden />} onRemove={() => changeContinent(null)} />
                </li>
              )}
              {chosenFacets.map(c => (
                <li key={c.id}>
                  <PlaceChip
                    label={c.name}
                    kicker={c.id === nearId ? 'Near you' : undefined}
                    icon={c.code ? <CircleFlag code={c.code} size={20} decorative /> : <MapPin size={15} strokeWidth={2.2} aria-hidden />}
                    onRemove={() => removeCountry(c.id)}
                  />
                </li>
              ))}
              <li>
                <button type="button" onClick={clearRegion} className="gv-place-clear focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] rounded">
                  Clear
                </button>
              </li>
            </ul>
          )}
          <Link href="/conferences/new" className="gv-explore-cta gv-explore-cta-bottom focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] focus-visible:ring-offset-2" style={PRIMARY_BUTTON}>
            <Plus size={18} strokeWidth={2.6} aria-hidden />
            Organise your conference
          </Link>
        </header>

        <main className="flex-1" style={{ paddingBottom: 'clamp(8px, 1vw, 16px)' }}>
          {/* ── 2. One band: the filter chips, centred under the pill. Places
               are no longer here (owner, 27 Sep 2026): they are added only
               through the pill's Where. Dates live in ONE place, the pill's
               When (on phones, where the pill shows only Where, a When chip
               stands in). */}
          <div className="gv-explore-wrap gv-explore-toolbar" style={{ marginTop: 'clamp(10px, 1.2vw, 14px)', marginBottom: 10 }}>
            <div role="toolbar" aria-label="Filters" className="gv-explore-scroll gv-explore-band">
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
            </div>
            {/* Sort and view, on the chips' line (their own short line on phones) */}
            <div className="gv-explore-sortview">
              {loading && <span className="sr-only" role="status">Loading conferences</span>}
              <SortMenu sort={dateSort} onChange={setDateSort} />
              <ViewToggle view={view} onChange={changeView} />
            </div>
          </div>

          {/* ── 6. The feed ───────────────────────────────────────────────── */}
          <section ref={resultsRef} className="gv-explore-wrap" aria-label="Conferences" style={{ marginTop: 6 }}>
            {loading ? (
              view === 'list' ? (
                <div aria-busy="true" aria-label="Loading conferences"><FeedSkeleton /></div>
              ) : (
                <div className={GRID} style={{ ...GRID_GAP, marginTop: 4 }} aria-busy="true" aria-label="Loading conferences">
                  {Array.from({ length: 10 }).map((_, i) => <ConferenceCardSkeleton key={i} variant="listing" />)}
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
            ) : view === 'grid' ? (
              // The grid: the spotlights are its FIRST cards, the same size as
              // the rest with the gold edge, glow and tag (27 Sep 2026: no big
              // row pushing results below the fold); then one continuous run
              // in the current sort, no month breaks, so every row is full.
              <div className={GRID} style={GRID_GAP}>
                {spotItems.map(s => cardFor(s.conf, s.spot))}
                {displayed.map(conf => cardFor(conf))}
              </div>
            ) : (
              <div className="flex flex-col" style={{ gap: 'clamp(8px, 1vw, 14px)' }}>
                {/* The list is plain date order (27 Sep 2026): each spotlight
                    conference sits in its normal date place with the tag, the
                    gold edge and the glow. Only the grid puts spotlights first. */}
                {listMonths.map(g => (
                  <section key={g.key} aria-label={g.label}>
                    <MonthHeader label={g.label} count={g.items.length} />
                    <FeedRows
                      items={g.items}
                      facets={facets}
                      facetsLoaded={facetsLoaded}
                      sponsoredIds={sponsoredIds}
                      appliedIds={appliedIds}
                      isMember={isMember}
                      inPlace={spotInPlace}
                    />
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
      </div>

      {spotlightDialog && (
        <ConferenceSpotlightDialog
          rows={spotlightDialog}
          onClose={() => setSpotlightDialog(null)}
          // The roles open now, from the same facets as "Open for ..."; null until read.
          openRolesFor={(id) => (facets.size > 0 ? facets.get(id)?.open_roles ?? [] : null)}
        />
      )}
    </div>
  );
}


/** A place chosen through the pill's Where: flag (or globe), name, and the
 *  small round X on its top right corner (hover, focus, always on touch). */
function PlaceChip({ label, kicker, icon, onRemove }: {
  label: string;
  kicker?: string;
  icon: React.ReactNode;
  onRemove: () => void;
}) {
  return (
    <span className="gv-place-chip">
      <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, color: FOREST }}>{icon}</span>
      <span style={{ overflowWrap: 'anywhere', textAlign: 'left' }}>
        {kicker && <span style={{ fontWeight: 600, color: INK_SOFT }}>{kicker}: </span>}
        {label}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        title={`Remove ${label}`}
        className="gv-place-chip-x focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
      >
        <X size={12} strokeWidth={3} aria-hidden />
      </button>
    </span>
  );
}
