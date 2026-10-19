/**
 * CLAIMABLE LISTINGS (plan: docs/conferences/claimable-listings.md, SQL: scratch-claimable-listings.sql)
 * ────────────────────────────────────────────────────────────────────────────
 * A listing is an ordinary `conferences` row with `listed_by = 'gavelling'`, owned by the Gavelling
 * staff account until `transfer_listing_to_organiser` hands it over (then `listed_by = 'organiser'`
 * and it is a normal conference; nothing else moves, the slug stays). Its committees and topics are
 * ordinary `conference_committees` rows; our summary is `conferences.description`.
 *
 * On a listing the UI must hide what belongs to the real organisers: Apply (its roles are closed
 * anyway), the contact email (it is our inbox), the Delegates stat unless `delegates_known`, the
 * secretariat, Ask a question. Show the "Not on Gavelling yet" mark, "Visit their website", the
 * source line from `listing_meta` and "Is this your conference? Claim it free".
 *
 * Writes never come from the client: `upsert_gavelling_listing`, `transfer_listing_to_organiser`
 * and `set_gavelling_listing_hidden` are staff-only RPCs.
 */

import { committeeDisplayName } from '@/lib/presetNames';

export type ListedBy = 'organiser' | 'gavelling';

/** Credit for a free-to-use city photo used as the banner. Null when the banner is the conference's own. */
export interface BannerCredit {
  author: string;
  source_url: string;
  license: string;
  license_url: string | null;
}

/** `conferences.listing_meta` (null on organiser rows). Every field is public. */
export interface ListingMeta {
  checked_at: string;
  sources: { url: string }[];
  banner_credit: BannerCredit | null;
  /** True only when the conference publishes its head count; otherwise `expected_delegates` is a placeholder. */
  delegates_known: boolean;
  added_by: 'claude' | 'admin';
  /** Set by transfer_listing_to_organiser. */
  transferred_at?: string;
}

/** The committee shape `upsert_gavelling_listing` accepts (written as `conference_committees` rows). */
export interface ListingCommittee {
  name: string;
  abbreviation?: string | null;
  type?: 'general-assembly' | 'specialised' | 'crisis' | 'custom' | 'press' | null;
  /** At most 6 accepted; the first 3 are stored (the conference_committees CHECK). */
  topics?: string[];
}

/** The `p` argument of `upsert_gavelling_listing(p jsonb)`. */
export interface ListingUpsertInput {
  id?: string;
  full_name: string;
  acronym: string;
  start_date?: string | null;
  end_date?: string | null;
  dates_tbd?: boolean;
  format: 'in-person' | 'online' | 'hybrid';
  city?: string;
  country?: string;
  student_level?: 'school' | 'university' | 'both';
  expected_delegates?: number;
  summary?: string;
  website_url?: string | null;
  instagram_url?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
  banner_credit?: BannerCredit | null;
  sources?: { url: string }[];
  checked_at?: string;
  committees?: ListingCommittee[];
}

export type ListingUpsertResult =
  | { ok: true; id: string; slug: string; created: boolean; is_public: boolean; meets_bar: boolean }
  | { ok: false; reason: 'on_gavelling' | 'organiser_owned' | 'removed'; id?: string; slug: string };

export function isGavellingListing(c: { listed_by?: string | null } | null | undefined): boolean {
  return c?.listed_by === 'gavelling';
}

/** Today as `YYYY-MM-DD` in UTC, the database's `current_date`. */
function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * A listing whose last day has passed. Past listings stay public (owner, 19 Oct 2026). Dates to be
 * decided are never past.
 */
export function isPastListing(
  c: { start_date?: string | null; end_date?: string | null; dates_tbd?: boolean | null },
  now: Date = new Date(),
): boolean {
  if (c.dates_tbd) return false;
  const last = (c.end_date || c.start_date || '').slice(0, 10);
  return !!last && last < todayUtc(now);
}

/** The short name to show, by the same rule as committees: the acronym when the full name is long. */
export function listingDisplayName(c: { full_name: string; acronym?: string | null }): string {
  return committeeDisplayName(c.full_name, c.acronym);
}

/** `listing_meta` read defensively from a row (null on organiser rows or a malformed value). */
export function listingMeta(c: { listing_meta?: unknown } | null | undefined): ListingMeta | null {
  const m = c?.listing_meta;
  if (!m || typeof m !== 'object' || Array.isArray(m)) return null;
  const o = m as Partial<ListingMeta>;
  if (typeof o.checked_at !== 'string') return null;
  return {
    checked_at: o.checked_at,
    sources: Array.isArray(o.sources) ? o.sources.filter(s => s && typeof s.url === 'string') : [],
    banner_credit: o.banner_credit && typeof o.banner_credit === 'object' ? o.banner_credit : null,
    delegates_known: o.delegates_known === true,
    added_by: o.added_by === 'admin' ? 'admin' : 'claude',
    transferred_at: typeof o.transferred_at === 'string' ? o.transferred_at : undefined,
  };
}
