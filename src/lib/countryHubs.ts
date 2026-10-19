// countryHubs.ts — the discovery hubs under /conferences/in/<slug>: one page
// per country, one for online conferences, one per year and one per busy month.
//
// ONE RULE, used by the hub pages, the country list (/conferences/in), the
// directory (/conferences/all), the conference page's place links and the
// sitemap, so they can never disagree about which hubs exist:
//
//   kind     slug              exists (200)                       indexable (sitemap)
//   country  india             >= 1 listed public conference      >= 1 upcoming
//   online   online            >= 1 listed online conference      >= 1 upcoming
//   year     2026              >= 1 listed conference starting    >= 1 upcoming
//                              that year
//   month    november-2026     >= MONTH_MIN listed conferences    the month is not over
//                              starting that month                and >= 1 is upcoming
//
// A hub that exists but is not indexable renders its past conferences with
// `noindex, follow` and is left out of the sitemap, so Google never meets a
// thin page as a landing page. Every listed public conference therefore
// always has a live country hub (and an online hub when it is online), which
// is what lets its page link its country with no date check.
//
// "Listed" is isListedConference (test and demo rows never count). Slugs
// cannot collide: a country slug is a country name, never `online`, a year or
// `<month>-<year>`. All of these live under the already reserved `in` folder,
// so no conference slug is reserved for them.
//
// The country slug is the country's standard name lower-cased and hyphenated
// ("united-arab-emirates", "turkiye"), taken from the UN_COUNTRIES entry the
// stored name resolves to, so "UAE", "U.A.E." and "United Arab Emirates" all
// land on one hub.

import { getCountryByName, COUNTRY_CONTINENTS, type Continent } from '@/lib/countries';
import { isListedConference, type ListableConference } from '@/lib/publicConferences';

/** A month hub needs at least this many conferences starting in it. */
export const MONTH_MIN = 3;
/** "Recently held": ended within this many days (the country list's cut-off). */
export const RECENT_DAYS = 365;
export const ONLINE_HUB_SLUG = 'online';
export const HUB_INDEX_PATH = '/conferences/in';

const MONTH_SLUGS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export interface HubInput extends ListableConference {
  country?: string | null;
  city?: string | null;
  format?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  dates_tbd?: boolean | null;
  updated_at?: string | null;
}

export type HubKind = 'country' | 'online' | 'year' | 'month';

export interface Hub {
  kind: HubKind;
  slug: string;
  /** "India", "Online", "2026", "November 2026". */
  name: string;
  /** The page's h1. */
  heading: string;
  /** ISO alpha-2, country hubs only. */
  code: string;
  continent: Continent | null;
  year: number | null;
  month: number | null;
  /** Upcoming conferences (not over yet; dates to be decided count). */
  count: number;
  /** Every listed conference the hub holds, past ones included. */
  total: number;
  /** Ended within RECENT_DAYS. */
  recent: number;
  indexable: boolean;
  /** Newest updated_at among its conferences (the sitemap's lastmod). */
  lastModified: string | null;
}

/** Kept for the callers that only ever read country hubs. */
export type CountryHub = Hub;

export function hubPath(slug: string): string {
  return `${HUB_INDEX_PATH}/${slug}`;
}

export function countrySlug(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function monthSlug(year: number, month: number): string {
  return `${MONTH_SLUGS[month - 1]}-${year}`;
}

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function minusDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function lastDay(c: HubInput): string | null {
  return (c.end_date || c.start_date || '').slice(0, 10) || null;
}

/** Not over yet. A conference with no dates yet counts as upcoming. */
export function isUpcomingOn(c: HubInput, today: string): boolean {
  const last = lastDay(c);
  return !last || last >= today;
}

/** Ended, within the last RECENT_DAYS. */
export function isRecentOn(c: HubInput, today: string): boolean {
  const last = lastDay(c);
  return !!last && last < today && last >= minusDays(today, RECENT_DAYS);
}

/** The year and month a dated conference starts in. */
function startMonth(c: HubInput): { year: number; month: number } | null {
  if (c.dates_tbd) return null;
  const m = /^(\d{4})-(\d{2})-\d{2}/.exec((c.start_date ?? '').trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (year < 2000 || year > 2100 || month < 1 || month > 12) return null;
  return { year, month };
}

function blank(kind: HubKind, slug: string, name: string, heading: string, extra: Partial<Hub> = {}): Hub {
  return {
    kind, slug, name, heading, code: '', continent: null, year: null, month: null,
    count: 0, total: 0, recent: 0, indexable: false, lastModified: null, ...extra,
  };
}

/** Every hub one conference belongs to (unsorted, no counts). */
export function hubsOf(c: HubInput): Hub[] {
  const out: Hub[] = [];
  const country = c.country ? getCountryByName(c.country.trim()) : undefined;
  if (country) {
    const code = country.code.toUpperCase();
    out.push(blank('country', countrySlug(country.name), country.name, `Model UN Conferences in ${country.name}`, {
      code,
      continent: COUNTRY_CONTINENTS[code] ?? null,
    }));
  }
  if ((c.format ?? '').toLowerCase() === 'online') {
    out.push(blank('online', ONLINE_HUB_SLUG, 'Online', 'Online Model UN Conferences'));
  }
  const ym = startMonth(c);
  if (ym) {
    out.push(blank('year', String(ym.year), String(ym.year), `Model UN Conferences ${ym.year}`, { year: ym.year }));
    const label = `${MONTH_NAMES[ym.month - 1]} ${ym.year}`;
    out.push(blank('month', monthSlug(ym.year, ym.month), label, `Model UN Conferences in ${label}`, { year: ym.year, month: ym.month }));
  }
  return out;
}

function monthEnd(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

/** Every hub that exists (see the table at the top), with its counts. */
export function allHubs(conferences: readonly HubInput[], today = todayUtc()): Hub[] {
  const bySlug = new Map<string, Hub>();
  for (const c of conferences) {
    if (!isListedConference(c)) continue;
    const upcoming = isUpcomingOn(c, today);
    const recent = !upcoming && isRecentOn(c, today);
    for (const h of hubsOf(c)) {
      const hub = bySlug.get(h.slug) ?? h;
      hub.total += 1;
      if (upcoming) hub.count += 1;
      if (recent) hub.recent += 1;
      if (c.updated_at && (!hub.lastModified || c.updated_at > hub.lastModified)) hub.lastModified = c.updated_at;
      bySlug.set(h.slug, hub);
    }
  }
  const out: Hub[] = [];
  for (const hub of bySlug.values()) {
    if (hub.kind === 'month') {
      if (hub.total < MONTH_MIN) continue;
      hub.indexable = hub.count >= 1 && monthEnd(hub.year!, hub.month!) >= today;
    } else {
      hub.indexable = hub.count >= 1;
    }
    out.push(hub);
  }
  return out.sort(compareHubs);
}

/** Countries largest first; years and months in calendar order. */
function compareHubs(a: Hub, b: Hub): number {
  const kinds: HubKind[] = ['online', 'year', 'month', 'country'];
  if (a.kind !== b.kind) return kinds.indexOf(a.kind) - kinds.indexOf(b.kind);
  if (a.kind === 'year' || a.kind === 'month') return (a.year! - b.year!) || ((a.month ?? 0) - (b.month ?? 0));
  return b.count - a.count || a.name.localeCompare(b.name);
}

/** Indexable country hubs, largest first (Explore, /conferences/all, the sitemap). */
export function countryHubs(conferences: readonly HubInput[], today = todayUtc()): Hub[] {
  return allHubs(conferences, today).filter(h => h.kind === 'country' && h.indexable);
}

/** Does this conference belong to the hub? */
export function inHub(c: HubInput, slug: string): boolean {
  return hubsOf(c).some(h => h.slug === slug);
}

/** The hub for a URL segment, with its conferences split into upcoming
 *  (soonest first, as given) and past (most recent first), or null (404). */
export function resolveHub<T extends HubInput>(
  slug: string,
  conferences: readonly T[],
  today = todayUtc(),
): { hub: Hub; hubs: Hub[]; upcoming: T[]; past: T[] } | null {
  const key = slug.toLowerCase();
  const hubs = allHubs(conferences, today);
  const hub = hubs.find(h => h.slug === key);
  if (!hub) return null;
  const members = conferences.filter(c => isListedConference(c) && inHub(c, key));
  const upcoming = members.filter(c => isUpcomingOn(c, today));
  const past = members
    .filter(c => !isUpcomingOn(c, today))
    .sort((a, b) => (lastDay(b) ?? '').localeCompare(lastDay(a) ?? ''));
  return { hub, hubs, upcoming, past };
}

/** The hubs a conference's own page links to, in reading order (country,
 *  online, month, year), only the ones that exist. */
export function hubsForConference(c: HubInput, hubs: readonly Hub[]): Hub[] {
  const own = new Set(hubsOf(c).map(h => h.slug));
  const order: HubKind[] = ['country', 'online', 'month', 'year'];
  return hubs
    .filter(h => own.has(h.slug))
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}
