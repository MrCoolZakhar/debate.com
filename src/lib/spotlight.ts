// spotlight.ts — Gavelling Spotlight on the public site.
//
// `featured_conferences(p_placement, p_target)` (anon) answers the featured
// row for a placement: booked spotlights first (is_spotlight true), and for
// 'homepage' / 'region' the empty slots filled with the biggest upcoming
// public conferences (is_spotlight false). 'explore' and 'country' return
// booked spotlights only.
//
// `record_spotlight_event(p_booking, 'view'|'click')` counts a view once per
// browser session per booking (sessionStorage) and a click when the card is
// opened. Nothing about the viewer is sent: booking id and the word only.
// Like the conference counter, nothing is counted on localhost, 127.0.0.1 or
// *.vercel.app, which share the production database.

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as anon } from '@/lib/supabase';

export type SpotlightPlacement = 'homepage' | 'explore' | 'region' | 'country';

export interface FeaturedRow {
  conference_id: string;
  slug: string;
  acronym: string;
  full_name: string;
  banner_url: string | null;
  logo_url: string | null;
  city: string | null;
  country: string | null;
  start_date: string | null;
  end_date: string | null;
  /** The line the organiser wrote when booking; null on a filled slot. */
  description: string | null;
  booking_id: string | null;
  is_spotlight: boolean;
}

export async function fetchFeatured(
  client: SupabaseClient,
  placement: SpotlightPlacement,
  target = '',
): Promise<FeaturedRow[]> {
  try {
    const { data, error } = await client.rpc('featured_conferences', { p_placement: placement, p_target: target });
    if (error || !Array.isArray(data)) return [];
    return (data as FeaturedRow[]).filter(r => !!r.conference_id && !!r.slug);
  } catch {
    return [];
  }
}

function countingDisabled(): boolean {
  if (typeof window === 'undefined') return true;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h.endsWith('.vercel.app');
}

/** One view per browser session per booking. */
export function recordSpotlightView(bookingId: string | null | undefined): void {
  if (!bookingId || countingDisabled()) return;
  const flag = `gavelling-spot-view:${bookingId}`;
  try {
    if (sessionStorage.getItem(flag)) return;
    sessionStorage.setItem(flag, '1');
  } catch {
    return;
  }
  void anon.rpc('record_spotlight_event', { p_booking: bookingId, p_kind: 'view' }).then(() => {}, () => {});
}

/** A click, every time the card is opened. */
export function recordSpotlightClick(bookingId: string | null | undefined): void {
  if (!bookingId || countingDisabled()) return;
  void anon.rpc('record_spotlight_event', { p_booking: bookingId, p_kind: 'click' }).then(() => {}, () => {});
}
