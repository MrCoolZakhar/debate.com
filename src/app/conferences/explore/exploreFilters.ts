// ── Explore filters: the pure part ───────────────────────────────────────────
// Open applications, price and dates (owner, 25 Sep 2026) beside the older
// country / format / level filters. Facets come from ONE call to
// `explore_conference_facets(p_ids)` (anon-callable): per conference the roles
// whose applications are open right now, the delegate fee in its own currency
// (what the card prints, unchanged) and an APPROXIMATE USD figure used only to
// bucket the price filter. Everything here is a function of that row and the
// conference's date-only columns; no React, no I/O.

// ── Facets ───────────────────────────────────────────────────────────────────

export interface ConferenceFacet {
  conference_id: string;
  /** Roles enabled AND inside their application window right now. */
  open_roles: string[];
  delegate_fee: number | null;
  fee_currency: string | null;
  /** Approximate USD, for bucketing only; 0 when free; null when nothing is open. */
  delegate_fee_usd: number | null;
}

export type FacetMap = Map<string, ConferenceFacet>;

export function parseFacets(rows: unknown): FacetMap {
  const out: FacetMap = new Map();
  if (!Array.isArray(rows)) return out;
  for (const r of rows as Partial<ConferenceFacet>[]) {
    if (!r || typeof r.conference_id !== 'string') continue;
    out.set(r.conference_id, {
      conference_id: r.conference_id,
      open_roles: Array.isArray(r.open_roles) ? r.open_roles.filter((x): x is string => typeof x === 'string') : [],
      delegate_fee: typeof r.delegate_fee === 'number' ? r.delegate_fee : r.delegate_fee == null ? null : Number(r.delegate_fee),
      fee_currency: typeof r.fee_currency === 'string' ? r.fee_currency : null,
      delegate_fee_usd: typeof r.delegate_fee_usd === 'number' ? r.delegate_fee_usd : r.delegate_fee_usd == null ? null : Number(r.delegate_fee_usd),
    });
  }
  return out;
}

// ── Open applications ────────────────────────────────────────────────────────

export const ROLE_OPTIONS = [
  { key: 'chair', label: 'Chair' },
  { key: 'delegate', label: 'Delegate' },
  { key: 'observer', label: 'Observer' },
  { key: 'head-delegate', label: 'Head delegate' },
  { key: 'faculty-advisor', label: 'Faculty advisor' },
] as const;

export type RoleKey = (typeof ROLE_OPTIONS)[number]['key'];
const ROLE_KEYS = new Set<string>(ROLE_OPTIONS.map((r) => r.key));

/** A conference matches when ANY selected role is open. No selection = every conference. */
export function matchesRoles(facet: ConferenceFacet | undefined, selected: ReadonlySet<RoleKey>): boolean {
  if (selected.size === 0) return true;
  if (!facet) return false;
  for (const r of facet.open_roles) if (selected.has(r as RoleKey)) return true;
  return false;
}

// ── Price ────────────────────────────────────────────────────────────────────

export type PriceFilter = '' | 'free' | 'under50' | 'under100';

export const PRICE_OPTIONS: { key: PriceFilter; label: string }[] = [
  { key: 'free', label: 'Free' },
  { key: 'under50', label: 'Under $50' },
  { key: 'under100', label: 'Under $100' },
  { key: '', label: 'Any price' },
];

/** From the approximate USD figure. A conference with nothing open matches only Any. */
export function matchesPrice(facet: ConferenceFacet | undefined, filter: PriceFilter): boolean {
  if (filter === '') return true;
  const usd = facet?.delegate_fee_usd;
  if (usd === null || usd === undefined) return false;
  if (filter === 'free') return usd === 0;
  if (filter === 'under50') return usd < 50;
  return usd < 100;
}

// ── Dates ────────────────────────────────────────────────────────────────────

export type DateFilter = '' | 'month' | 'quarter' | 'later';

export const DATE_OPTIONS: { key: DateFilter; label: string }[] = [
  { key: 'month', label: 'This month' },
  { key: 'quarter', label: 'Next 3 months' },
  { key: 'later', label: 'Later' },
  { key: '', label: 'Any time' },
];

/** 'YYYY-MM-DD' → a LOCAL midnight Date, never `new Date('YYYY-MM-DD')`
 *  (which is UTC midnight and reads one day early west of Greenwich). */
export function parseDateOnly(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toDateOnly(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function startOfToday(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Date buckets are on the conference's START day. "This month": starts on or
 * before the last day of this calendar month (finished conferences are already
 * out of the list). "Next 3 months": starts within 90 days from today. "Later":
 * starts after that. A dates-TBD conference (no start_date) matches Any only.
 */
export function matchesDateBucket(startDate: string | null | undefined, filter: DateFilter, now = new Date()): boolean {
  if (filter === '') return true;
  const start = parseDateOnly(startDate);
  if (!start) return false;
  const today = startOfToday(now);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const in90 = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 90);
  if (filter === 'month') return start <= endOfMonth;
  if (filter === 'quarter') return start <= in90;
  return start > in90;
}

/** A custom from / to range on the START day, both ends inclusive; either end may be empty. */
export function matchesDateRange(startDate: string | null | undefined, from: string, to: string): boolean {
  if (!from && !to) return true;
  const start = parseDateOnly(startDate);
  if (!start) return false;
  const lo = parseDateOnly(from);
  const hi = parseDateOnly(to);
  if (lo && start < lo) return false;
  if (hi && start > hi) return false;
  return true;
}

// ── The URL ──────────────────────────────────────────────────────────────────
// Every active filter is in the query so a filtered view can be shared:
//   ?search= ?continent= ?country= (as before) ?format= ?level= ?roles=a,b
//   ?price= ?when= ?from= ?to= ?sort=desc

export interface ExploreQuery {
  search: string;
  format: string;
  level: string;
  roles: RoleKey[];
  price: PriceFilter;
  when: DateFilter;
  from: string;
  to: string;
  sort: 'asc' | 'desc';
  /** Only conferences whose Store pays applicants' credit (?sponsored=1). */
  sponsored: boolean;
}

export function readExploreQuery(sp: { get(name: string): string | null }): ExploreQuery {
  const roles = (sp.get('roles') ?? '').split(',').map((s) => s.trim()).filter((s): s is RoleKey => ROLE_KEYS.has(s));
  const price = sp.get('price') as PriceFilter | null;
  const when = sp.get('when') as DateFilter | null;
  const isDate = (s: string | null) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  return {
    search: sp.get('search') ?? '',
    format: sp.get('format') ?? '',
    level: sp.get('level') ?? '',
    roles,
    price: price === 'free' || price === 'under50' || price === 'under100' ? price : '',
    when: when === 'month' || when === 'quarter' || when === 'later' ? when : '',
    from: isDate(sp.get('from')) ? (sp.get('from') as string) : '',
    to: isDate(sp.get('to')) ? (sp.get('to') as string) : '',
    sort: sp.get('sort') === 'desc' ? 'desc' : 'asc',
    sponsored: sp.get('sponsored') === '1',
  };
}

/** The query string for the current filters, '' when nothing is set. Keeps
 *  the region keys the page already owns (`continent`, `country`). */
export function writeExploreQuery(q: ExploreQuery & { continent?: string | null; country?: string | null }): string {
  const p = new URLSearchParams();
  if (q.search) p.set('search', q.search);
  if (q.continent) p.set('continent', q.continent);
  if (q.country) p.set('country', q.country);
  if (q.format) p.set('format', q.format);
  if (q.level) p.set('level', q.level);
  if (q.roles.length) p.set('roles', q.roles.join(','));
  if (q.price) p.set('price', q.price);
  if (q.when) p.set('when', q.when);
  if (q.from) p.set('from', q.from);
  if (q.to) p.set('to', q.to);
  if (q.sort === 'desc') p.set('sort', 'desc');
  if (q.sponsored) p.set('sponsored', '1');
  const s = p.toString();
  return s ? `?${s}` : '';
}
