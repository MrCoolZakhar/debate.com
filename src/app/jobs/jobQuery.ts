// ── /jobs: the filters, the tab and the chosen listing, to and from the URL ─
//
// One query shape so any view can be shared: role, country and offer repeat;
// region repeats; from / to are ISO dates; deadline is week or month; under10
// is 1; q is the search; conference is one conference's id (the Hiring mark
// on Explore); tab is saved or applications; listing is the chosen listing's id. Pure functions, used by the server page and the client alike.

import type { JobFilters, JobOffer, JobRegion, JobRole } from '@/lib/jobBoard';

export type JobTab = 'all' | 'saved' | 'applications';
export type JobDeadline = '' | 'week' | 'month';

export interface JobQuery {
  roles: JobRole[];
  countries: string[];
  regions: JobRegion[];
  from: string;
  to: string;
  level: '' | 'school' | 'university';
  format: '' | 'in-person' | 'online' | 'hybrid';
  offers: JobOffer[];
  deadline: JobDeadline;
  under10: boolean;
  q: string;
  /** One conference's id, or null. */
  conference: string | null;
  tab: JobTab;
  listing: string | null;
}

export const EMPTY_JOB_QUERY: JobQuery = {
  roles: [], countries: [], regions: [], from: '', to: '', level: '', format: '',
  offers: [], deadline: '', under10: false, q: '', conference: null, tab: 'all', listing: null,
};

const ROLES: JobRole[] = ['chair', 'secretariat', 'staff'];
const REGIONS: JobRegion[] = ['north-america', 'south-america', 'europe', 'africa', 'asia', 'oceania'];
const OFFERS: JobOffer[] = ['paid', 'accommodation', 'travel', 'certificate', 'letter'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** At most this many countries are chosen at once, as on Explore. */
export const MAX_JOB_COUNTRIES = 5;

type ParamSource = { getAll(key: string): string[]; get(key: string): string | null };

/** A plain object from a server page's searchParams, as a ParamSource. */
export function paramSource(raw: Record<string, string | string[] | undefined>): ParamSource {
  return {
    getAll: (k) => {
      const v = raw[k];
      return v === undefined ? [] : Array.isArray(v) ? v : [v];
    },
    get: (k) => {
      const v = raw[k];
      return v === undefined ? null : Array.isArray(v) ? (v[0] ?? null) : v;
    },
  };
}

function uniq<T>(xs: T[]): T[] { return Array.from(new Set(xs)); }

export function readJobQuery(p: ParamSource): JobQuery {
  const level = p.get('level');
  const format = p.get('format');
  const deadline = p.get('deadline');
  const tab = p.get('tab');
  const from = p.get('from') ?? '';
  const to = p.get('to') ?? '';
  const listing = p.get('listing');
  const conference = p.get('conference');
  const regions = uniq(p.getAll('region').filter((r): r is JobRegion => (REGIONS as string[]).includes(r)));
  return {
    roles: uniq(p.getAll('role').filter((r): r is JobRole => (ROLES as string[]).includes(r))),
    // A region replaces any countries (Explore's rule).
    countries: regions.length ? [] : uniq(p.getAll('country').map((c) => c.trim()).filter(Boolean)).slice(0, MAX_JOB_COUNTRIES),
    regions,
    from: ISO_DATE.test(from) ? from : '',
    to: ISO_DATE.test(to) ? to : '',
    level: level === 'school' || level === 'university' ? level : '',
    format: format === 'in-person' || format === 'online' || format === 'hybrid' ? format : '',
    offers: uniq(p.getAll('offer').filter((o): o is JobOffer => (OFFERS as string[]).includes(o))),
    deadline: deadline === 'week' || deadline === 'month' ? deadline : '',
    under10: p.get('under10') === '1',
    q: (p.get('q') ?? '').slice(0, 120),
    conference: conference && UUID.test(conference) ? conference : null,
    tab: tab === 'saved' || tab === 'applications' ? tab : 'all',
    listing: listing && UUID.test(listing) ? listing : null,
  };
}

export function writeJobQuery(q: JobQuery): string {
  const s = new URLSearchParams();
  q.roles.forEach((r) => s.append('role', r));
  q.regions.forEach((r) => s.append('region', r));
  q.countries.forEach((c) => s.append('country', c));
  if (q.from) s.set('from', q.from);
  if (q.to) s.set('to', q.to);
  if (q.level) s.set('level', q.level);
  if (q.format) s.set('format', q.format);
  q.offers.forEach((o) => s.append('offer', o));
  if (q.deadline) s.set('deadline', q.deadline);
  if (q.under10) s.set('under10', '1');
  if (q.q.trim()) s.set('q', q.q.trim());
  if (q.conference) s.set('conference', q.conference);
  if (q.tab !== 'all') s.set('tab', q.tab);
  if (q.listing) s.set('listing', q.listing);
  const str = s.toString();
  return str ? `/jobs?${str}` : '/jobs';
}

/** The server's filter object for a query (the tab and the listing are not filters). */
export function jobFiltersOf(q: JobQuery): JobFilters {
  return {
    roles: q.roles,
    countries: q.countries,
    regions: q.regions,
    from: q.from || undefined,
    to: q.to || undefined,
    level: q.level || undefined,
    format: q.format || undefined,
    offers: q.offers,
    deadline_days: q.deadline === 'week' ? 7 : q.deadline === 'month' ? 30 : undefined,
    under10: q.under10 || undefined,
    q: q.q || undefined,
    conference_id: q.conference || undefined,
  };
}

/** A stable key for the filters alone, to know when to fetch again. */
export function jobFilterKey(q: JobQuery): string {
  return JSON.stringify(jobFiltersOf(q));
}

export function hasJobFilters(q: JobQuery): boolean {
  return q.roles.length > 0 || q.countries.length > 0 || q.regions.length > 0 || !!q.from || !!q.to
    || !!q.level || !!q.format || q.offers.length > 0 || !!q.deadline || q.under10 || !!q.q.trim() || !!q.conference;
}

export const JOB_REGION_LABEL: Record<JobRegion, string> = {
  'north-america': 'North America',
  'south-america': 'South America',
  europe: 'Europe',
  africa: 'Africa',
  asia: 'Asia',
  oceania: 'Oceania',
};
export const JOB_REGIONS = REGIONS;
