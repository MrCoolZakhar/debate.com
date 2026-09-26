'use client';

// storeApi.ts — every read and write of the Conference Store, and the one
// price rule the client mirrors. Nothing here types a spotlight price: prices
// come from `spotlight_placements` (read once per page) and bundle list prices
// are summed from that same table.
//
// Reads:  my_store, email_allowance, my_spotlights, my_spotlight_stats,
//         spotlight_calendar, spotlight_reach, spotlight_placements,
//         country_continents
// Writes: store_transfer_in / _out, store_add_sponsorship / _remove_sponsorship,
//         book_spotlight, book_spotlight_bundle, cancel_spotlight, buy_email_pack
//
// Every buy answers { ok:false, need_credits } when the conference is short;
// useStoreBuy() below turns that into "buy the difference, then finish by
// itself" exactly once.

import { useCallback, useEffect, useRef, useState } from 'react';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError, plainOrFallback, UserFacingError } from '@/lib/friendlyError';
import { openCreditsPopup } from '@/lib/purchasePopup';
import { refreshCreditsEverywhere } from '@/hooks/useCredits';

// ── Types ──────────────────────────────────────────────────────────────────

export type Placement = 'homepage' | 'explore' | 'region' | 'country';
export const PLACEMENTS: Placement[] = ['homepage', 'explore', 'region', 'country'];

export interface PlacementPrice {
  placement: Placement;
  day_price: number;
  week_price: number;
  capacity: number;
  label: string;
}

export interface StoreState {
  can_use: boolean;
  conference_credits: number;
  mine_in_conference: number;
  your_credits: number;
  sponsorship: { available: number; used: number };
  credit_sponsored: boolean;
}

export interface EmailAllowance {
  free: number;
  used: number;
  extra: number;
  unlimited: boolean;
  remaining: number | null;
  enforced: boolean;
}

export interface SpotlightBooking {
  placement: Placement;
  label: string;
  target: string;
  first_day: string;
  last_day: string;
  days: number;
  dates: string[];
}

export interface SpotlightPurchase {
  purchase_id: string;
  kind: string;
  credits: number;
  description: string | null;
  is_house: boolean;
  status: 'upcoming' | 'live' | 'ended' | 'cancelled';
  cancellable: boolean;
  cancel_until: string | null;
  bookings: SpotlightBooking[] | null;
}

export interface SpotlightStat {
  purchase_id: string;
  placement: Placement;
  views: number;
  clicks: number;
}

export interface CalendarDay {
  day: string;
  taken: number;
  capacity: number;
  /** This conference already has that placement booked on this day. */
  mine?: boolean;
}

export interface Reach { days_counted: number; views_per_week: number | null; ready: boolean }

/** The answer every Store write gives. */
export interface StoreAnswer extends Partial<StoreState> {
  ok?: boolean;
  message?: string;
  field?: string;
  need_credits?: number;
  taken_days?: string[];
  credits?: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

export const CONTINENT_LABELS: Record<string, string> = {
  'north-america': 'North America',
  'south-america': 'South America',
  europe: 'Europe',
  africa: 'Africa',
  asia: 'Asia',
  oceania: 'Oceania',
};

function asInt(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : fallback;
}

export async function authedClient() {
  const client = await getFreshAuthedClient();
  if (!client) throw new UserFacingError('Your session has expired. Refresh the page and sign in again.');
  return client;
}

/** The server's own sentence when it sent one, else ours. */
export function messageOf(a: unknown, fallback: string): string {
  const m = a && typeof a === 'object' && 'message' in a ? (a as { message?: unknown }).message : undefined;
  return typeof m === 'string' && m.length > 0 ? plainOrFallback(m, fallback) : fallback;
}

export function readStoreState(a: StoreAnswer | null | undefined): StoreState | null {
  if (!a || a.ok !== true) return null;
  if (a.can_use === false) return { can_use: false, conference_credits: 0, mine_in_conference: 0, your_credits: 0, sponsorship: { available: 0, used: 0 }, credit_sponsored: false };
  if (a.conference_credits === undefined) return null;
  return {
    can_use: true,
    conference_credits: asInt(a.conference_credits),
    mine_in_conference: asInt(a.mine_in_conference),
    your_credits: asInt(a.your_credits),
    sponsorship: { available: asInt(a.sponsorship?.available), used: asInt(a.sponsorship?.used) },
    credit_sponsored: a.credit_sponsored === true,
  };
}

/** A booking's price: every 7 days at the week price, the rest per day but
 *  never more than a week. The same rule as _spotlight_price in the database. */
export function spotlightPrice(p: PlacementPrice | undefined, days: number): number | null {
  if (!p || days <= 0) return p ? 0 : null;
  return Math.floor(days / 7) * p.week_price + Math.min((days % 7) * p.day_price, p.week_price);
}

/** "25 a week" when a week is the natural unit, else "1 a day". */
export function priceLine(p: PlacementPrice | undefined): string {
  if (!p) return '…';
  return p.day_price * 7 > p.week_price ? `${p.week_price} a week` : `${p.day_price} a day`;
}

export function credits(n: number): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
}

// ── Dates (local calendar days, ISO strings) ──────────────────────────────

export function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDay(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(iso: string, n: number): string {
  const d = parseDay(iso);
  d.setDate(d.getDate() + n);
  return isoDay(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86_400_000);
}

export function fmtDay(iso: string, withYear = false): string {
  return parseDay(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });
}

export interface Range { from: string; to: string }

export function rangeDays(r: Range): number {
  return daysBetween(r.from, r.to) + 1;
}

export function totalDays(ranges: Range[]): number {
  return ranges.reduce((n, r) => n + rangeDays(r), 0);
}

export function sortRanges(ranges: Range[]): Range[] {
  return [...ranges].sort((a, b) => a.from.localeCompare(b.from));
}

// ── Bundles ────────────────────────────────────────────────────────────────

export type BundleKind = 'boost' | 'local_boost' | 'launch' | 'everything';

export interface BundleDef {
  kind: BundleKind;
  name: string;
  /** Credits charged. The list price is summed from spotlight_placements. */
  price: number;
  items: { placement: Placement; days: number }[];
  unlimitedEmails: boolean;
  extraCredits: number;
  cancellable: boolean;
  best?: boolean;
}

export const BUNDLES: BundleDef[] = [
  { kind: 'boost', name: 'Boost', price: 40, items: [{ placement: 'homepage', days: 7 }, { placement: 'explore', days: 14 }], unlimitedEmails: false, extraCredits: 0, cancellable: true },
  { kind: 'local_boost', name: 'Local Boost', price: 20, items: [{ placement: 'region', days: 14 }, { placement: 'country', days: 14 }], unlimitedEmails: false, extraCredits: 0, cancellable: true },
  { kind: 'launch', name: 'Launch', price: 120, items: [{ placement: 'homepage', days: 14 }, { placement: 'explore', days: 28 }, { placement: 'region', days: 28 }], unlimitedEmails: true, extraCredits: 0, cancellable: false },
  { kind: 'everything', name: 'Everything', price: 220, items: [{ placement: 'homepage', days: 28 }, { placement: 'explore', days: 28 }, { placement: 'region', days: 28 }, { placement: 'country', days: 28 }], unlimitedEmails: true, extraCredits: 50, cancellable: false, best: true },
];

/** The unlimited email pack's price, the one buy_email_pack charges. */
export const EMAIL_UNLIMITED_CREDITS = 20;

export function bundleListPrice(b: BundleDef, prices: Record<string, PlacementPrice>): number | null {
  let sum = 0;
  for (const it of b.items) {
    const p = spotlightPrice(prices[it.placement], it.days);
    if (p === null) return null;
    sum += p;
  }
  return sum + (b.unlimitedEmails ? EMAIL_UNLIMITED_CREDITS : 0) + b.extraCredits;
}

export function weeksLabel(days: number): string {
  if (days % 7 === 0) {
    const w = days / 7;
    return `${w} ${w === 1 ? 'week' : 'weeks'}`;
  }
  return `${days} days`;
}

// ── The Store's data ───────────────────────────────────────────────────────

export interface StoreData {
  state: StoreState | null;
  email: EmailAllowance | null;
  spotlights: SpotlightPurchase[];
  stats: SpotlightStat[];
  prices: Record<string, PlacementPrice>;
  continent: string | null;
}

export function useStoreData(conferenceId: string | null, country: string | null) {
  const [data, setData] = useState<StoreData>({ state: null, email: null, spotlights: [], stats: [], prices: {}, continent: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const reload = useCallback(async () => {
    if (!conferenceId) return;
    const mine = ++seq.current;
    try {
      const client = await authedClient();
      const [st, em, sp, ss, pr, cc] = await Promise.all([
        client.rpc('my_store', { p_conf: conferenceId }),
        client.rpc('email_allowance', { p_conf: conferenceId }),
        client.rpc('my_spotlights', { p_conf: conferenceId }),
        client.rpc('my_spotlight_stats', { p_conf: conferenceId }),
        client.from('spotlight_placements').select('placement, day_price, week_price, capacity, label'),
        country
          ? client.from('country_continents').select('continent').eq('country', country).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (mine !== seq.current) return;
      if (st.error) throw st.error;
      const state = readStoreState(st.data as StoreAnswer);
      if (!state) {
        setError(messageOf(st.data, 'The Store could not be read. Refresh the page to try again.'));
        return;
      }
      const e = em.data as (EmailAllowance & { ok?: boolean }) | null;
      const prices: Record<string, PlacementPrice> = {};
      for (const row of (pr.data ?? []) as PlacementPrice[]) prices[row.placement] = row;
      setData({
        state,
        email: e && e.ok ? {
          free: asInt(e.free, 1000), used: asInt(e.used), extra: asInt(e.extra),
          unlimited: e.unlimited === true, remaining: typeof e.remaining === 'number' ? e.remaining : null, enforced: e.enforced === true,
        } : null,
        spotlights: Array.isArray(sp.data) ? (sp.data as SpotlightPurchase[]) : [],
        stats: Array.isArray(ss.data) ? (ss.data as SpotlightStat[]) : [],
        prices,
        continent: (cc.data as { continent?: string } | null)?.continent ?? null,
      });
      setError(null);
    } catch (e) {
      if (mine !== seq.current) return;
      setError(friendlyError(e, 'The Store could not be read. Refresh the page to try again.'));
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [conferenceId, country]);

  useEffect(() => { void reload(); }, [reload]);

  return { data, loading, error, reload };
}

// ── Buying with the top-up path ────────────────────────────────────────────

export type BuyCall = (topUp: boolean) => Promise<StoreAnswer>;

export interface BuyHandlers {
  onDone: (a: StoreAnswer) => void;
  onRefused: (message: string, a: StoreAnswer) => void;
}

/**
 * Runs a Store purchase. First without top-up; when the conference is short:
 *  - if the buyer's OWN credits already cover the shortfall, offer that
 *    (`ownOffer`) and let them confirm with `acceptOwn()`;
 *  - otherwise open the credits pop-up for the difference, and on completion
 *    run the SAME call once with top-up, which moves the shortfall from the
 *    buyer's credits into the conference and completes the purchase.
 * A ref holds the pending call and is consumed once, so a second onComplete
 * or a reopened pop-up can never buy twice.
 */
export function useStoreBuy(yourCredits: number) {
  const [busy, setBusy] = useState(false);
  const [ownOffer, setOwnOffer] = useState<number | null>(null);
  const busyRef = useRef(false);
  const aliveRef = useRef(true);
  const pendingRef = useRef<{ call: BuyCall; h: BuyHandlers } | null>(null);
  const ownRef = useRef<{ call: BuyCall; h: BuyHandlers } | null>(null);
  const yourRef = useRef(yourCredits);
  yourRef.current = yourCredits;

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  const exec = useCallback(async (call: BuyCall, h: BuyHandlers, topUp: boolean) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const a = await call(topUp);
      if (!aliveRef.current) return;
      if (a && a.ok === true) {
        setOwnOffer(null);
        ownRef.current = null;
        refreshCreditsEverywhere();
        h.onDone(a);
        return;
      }
      const need = asInt(a?.need_credits);
      if (need > 0 && !topUp) {
        const shortfall = need - yourRef.current;
        if (shortfall <= 0) {
          ownRef.current = { call, h };
          setOwnOffer(need);
          h.onRefused(messageOf(a, "It seems you don't have enough credits for this"), a);
          return;
        }
        pendingRef.current = { call, h };
        h.onRefused(messageOf(a, "It seems you don't have enough credits for this"), a);
        openCreditsPopup({
          context: 'organizer',
          preselect: shortfall,
          purpose: 'store',
          onComplete: () => {
            const again = pendingRef.current;
            pendingRef.current = null;
            if (!again || !aliveRef.current) return;
            void execRef.current?.(again.call, again.h, true);
          },
        });
        return;
      }
      h.onRefused(messageOf(a, 'That could not be completed. Try again in a moment.'), a ?? {});
    } catch (e) {
      if (!aliveRef.current) return;
      h.onRefused(friendlyError(e, 'That could not be completed. Try again in a moment.'), {});
    } finally {
      busyRef.current = false;
      if (aliveRef.current) setBusy(false);
    }
  }, []);
  const execRef = useRef(exec);
  execRef.current = exec;

  const run = useCallback((call: BuyCall, h: BuyHandlers) => {
    setOwnOffer(null);
    ownRef.current = null;
    void exec(call, h, false);
  }, [exec]);

  const acceptOwn = useCallback(() => {
    const pending = ownRef.current;
    ownRef.current = null;
    setOwnOffer(null);
    if (pending) void exec(pending.call, pending.h, true);
  }, [exec]);

  return { busy, run, ownOffer, acceptOwn };
}

/** One RPC as a BuyCall. */
export function rpcCall(fn: string, args: Record<string, unknown>): BuyCall {
  return async (topUp: boolean) => {
    const client = await authedClient();
    const { data, error } = await client.rpc(fn, { ...args, p_top_up: topUp });
    if (error) throw error;
    return (data ?? {}) as StoreAnswer;
  };
}
