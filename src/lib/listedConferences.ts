// listedConferences.ts — the server-side read of the public conference list
// for discovery pages (the homepage, /organisers, /conferences/in/[country]).
//
// One select of public conferences, the test/demo rows dropped
// (publicConferences.ts), each row given its public delegate price
// (publicFees.ts) and its delegate application window state. Safe to call from
// a server component: no React hooks in the import graph (applicationWindow.ts
// imports useEffect, so its three checks are mirrored in `windowState` below;
// keep them in step with roleWindowState()).
//
// Every failure degrades to an empty list: a discovery page must render even
// when the database does not answer.

import { supabase } from '@/lib/supabase';
import { fetchDelegatePrices, withDelegatePrice, type DelegatePrice } from '@/lib/publicFees';
import { isListedConference } from '@/lib/publicConferences';
import { fetchFeatured, type FeaturedRow } from '@/lib/spotlight';

export interface ListedConference {
  id: string;
  slug: string;
  full_name: string;
  acronym: string;
  city: string;
  country: string;
  start_date: string;
  end_date: string;
  dates_tbd: boolean;
  fee_amount: number;
  fee_currency: string;
  expected_delegates: number;
  logo_url: string | null;
  banner_url: string | null;
  format?: string;
  is_verified: boolean;
  is_demo: boolean | null;
  updated_at: string | null;
  delegate_price: DelegatePrice;
  /** Delegate applications: 'open' now, 'not_open' yet (set up, opening later),
   *  'closed', or 'disabled' (not set up). */
  window: 'open' | 'not_open' | 'closed' | 'disabled';
}

const COLUMNS =
  'id, slug, full_name, acronym, city, country, start_date, end_date, dates_tbd, fee_amount, fee_currency, expected_delegates, logo_url, banner_url, format, is_verified, is_demo, updated_at';

interface WindowRow {
  conference_id: string;
  is_enabled: boolean | null;
  applications_open_at: string | null;
  applications_close_at: string | null;
}

/** Mirror of roleWindowState() in applicationWindow.ts (the trigger's order). */
function windowState(cfg: WindowRow | undefined, now: number): ListedConference['window'] {
  if (!cfg || !cfg.is_enabled) return 'disabled';
  const openAt = cfg.applications_open_at ? new Date(cfg.applications_open_at).getTime() : null;
  if (openAt !== null && Number.isFinite(openAt) && now < openAt) return 'not_open';
  const closeAt = cfg.applications_close_at ? new Date(cfg.applications_close_at).getTime() : null;
  if (closeAt !== null && Number.isFinite(closeAt) && now > closeAt) return 'closed';
  return 'open';
}

/** Tidy an organiser-typed place ("Mumbai " → "Mumbai"). */
function tidy(s: string | null | undefined): string {
  return (s ?? '').replace(/\s+/g, ' ').trim();
}

/** Every listed public conference, soonest first. */
export async function fetchListedConferences(): Promise<ListedConference[]> {
  try {
    const { data, error } = await supabase
      .from('conferences')
      .select(COLUMNS)
      .eq('is_public', true)
      .order('start_date', { ascending: true, nullsFirst: false });
    if (error || !data) return [];
    const rows = (data as unknown as Omit<ListedConference, 'delegate_price' | 'window'>[])
      .filter(isListedConference)
      .map(r => ({ ...r, full_name: tidy(r.full_name), acronym: tidy(r.acronym), city: tidy(r.city), country: tidy(r.country), dates_tbd: !!r.dates_tbd, is_verified: !!r.is_verified }));
    if (rows.length === 0) return [];

    const [prices, windows] = await Promise.all([
      fetchDelegatePrices(supabase, rows),
      supabase
        .from('conference_public_fees')
        .select('conference_id, is_enabled, applications_open_at, applications_close_at')
        .eq('role', 'delegate')
        .in('conference_id', rows.map(r => r.id))
        .then(({ data: w }) => new Map(((w as WindowRow[]) ?? []).map(x => [x.conference_id, x])), () => new Map<string, WindowRow>()),
    ]);
    const now = Date.now();
    return rows.map(r => ({
      ...withDelegatePrice(r, prices),
      window: windowState(windows.get(r.id), now),
    }));
  } catch {
    return [];
  }
}

/** The homepage's "up next" rail: featured_conferences('homepage'), today's
 *  booked Spotlights first, then the empty slots filled with the upcoming
 *  conferences with the most accepted delegates. Read on the server so the
 *  first paint does not jump. */
export async function fetchFeaturedHomepage(): Promise<FeaturedRow[]> {
  return fetchFeatured(supabase, 'homepage', '');
}

/** Today as YYYY-MM-DD (UTC). A conference is upcoming until its last day has passed. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Not yet over. A conference with no dates yet counts as upcoming. */
export function isUpcoming(c: { start_date: string | null; end_date: string | null }, today = todayIso()): boolean {
  const last = c.end_date || c.start_date;
  return !last || last >= today;
}

export interface JobStats { open: number; hiring: number; chairing: number }

/** The job-board figures on the homepage (open postings only).
 *  Unused since 24 Sep 2026: the homepage job board is hidden until the job
 *  board launches. Kept so it can be read again from src/app/page.tsx. */
export async function fetchJobStats(): Promise<JobStats | null> {
  try {
    const { data, error } = await supabase
      .from('job_postings')
      .select('id, category, conference_id')
      .eq('is_open', true);
    if (error || !data) return null;
    const rows = data as { id: string; category: string | null; conference_id: string | null }[];
    return {
      open: rows.length,
      hiring: new Set(rows.map(r => r.conference_id)).size,
      chairing: rows.filter(r => String(r.category ?? '').toLowerCase().includes('chair')).length,
    };
  } catch {
    return null;
  }
}

export interface PlatformStats { total_conferences: number; published_conferences: number; countries: number }

/** Platform totals (every conference, not only public ones), counts only. */
export async function fetchPlatformStats(): Promise<PlatformStats | null> {
  try {
    const { data, error } = await supabase.rpc('public_conference_stats');
    if (error) return null;
    const row = Array.isArray(data) ? data[0] : data;
    return (row as PlatformStats) ?? null;
  } catch {
    return null;
  }
}
