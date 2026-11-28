'use client';

// ── The Store sale (prompt 85, 27 Nov 2026) ─────────────────────────────────
//
// useStoreSale() is the sale running right now, or null. The answer comes from
// store_sale_now() (anon and authenticated; null when none runs), read ONCE per
// page load through the anon client and kept in one module store, so every
// reader (the Store page, prompt 86's Credits and Unlimited, prompt 87's bar)
// shares it. A failed read is null: no sale shows.
//
// Preview: ?sale_preview=<key> reads that row from store_sales instead and
// treats it as running, with ends_at as stored. It changes the LOOK only; the
// checkout (create-subscription-checkout) still charges what is really running.
//
// useSaleCountdown(endsAt) is display only (Date.now(), one tick a second
// while the tab is visible) and answers null at zero, when the sale UI hides.
// No price is typed here: prices come from src/lib/creditPricing.ts,
// unlimitedPricing() and the sale row.

import { useEffect, useState, useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';

export interface StoreSale {
  key: string;
  title: string;
  starts_at: string;
  ends_at: string;
  credits_bogo: boolean;
  unlimited_year_gift: boolean;
  /** The first year of the yearly plan during the sale, in cents; null = the normal price. */
  unlimited_year_first_cents: number | null;
}

function parseSale(raw: unknown): StoreSale | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  if (typeof a.key !== 'string' || typeof a.ends_at !== 'string' || typeof a.starts_at !== 'string') return null;
  const cents = a.unlimited_year_first_cents;
  return {
    key: a.key,
    title: typeof a.title === 'string' ? a.title : '',
    starts_at: a.starts_at,
    ends_at: a.ends_at,
    credits_bogo: a.credits_bogo === true,
    unlimited_year_gift: a.unlimited_year_gift === true,
    unlimited_year_first_cents: typeof cents === 'number' && Number.isFinite(cents) && cents > 0 ? Math.round(cents) : null,
  };
}

// ── One module store ────────────────────────────────────────────────────────

let current: StoreSale | null = null;
/** True once readSale() has answered (a failed read is known and null). */
let known = false;
let started = false;
const listeners = new Set<() => void>();

function set(next: StoreSale | null) {
  current = next;
  known = true;
  listeners.forEach((l) => l());
}

async function readSale(): Promise<StoreSale | null> {
  let preview: string | null = null;
  try { preview = new URLSearchParams(window.location.search).get('sale_preview'); } catch { preview = null; }
  try {
    if (preview) {
      const { data, error } = await supabase
        .from('store_sales')
        .select('key, title, starts_at, ends_at, credits_bogo, unlimited_year_first_cents')
        .eq('key', preview)
        .maybeSingle();
      return error ? null : parseSale(data);
    }
    const { data, error } = await supabase.rpc('store_sale_now');
    return error ? null : parseSale(data);
  } catch {
    return null;
  }
}

function load() {
  if (started || typeof window === 'undefined') return;
  started = true;
  void readSale().then(set);
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** The sale running right now (or the previewed one), null when none. */
export function useStoreSale(): StoreSale | null {
  const sale = useSyncExternalStore(subscribe, () => current, () => null);
  useEffect(() => { load(); }, []);
  return sale;
}

/** Whether the sale read has answered yet (prompt 94): until then the Store draws
 *  neither the sale nor the plain look, so it never flashes one and jumps to the other. */
export function useStoreSaleKnown(): boolean {
  const k = useSyncExternalStore(subscribe, () => known, () => false);
  useEffect(() => { load(); }, []);
  return k;
}

/** The running sale, dropped to null the moment its ends_at passes (one timer, no tick). */
export function useRunningSale(): StoreSale | null {
  const sale = useStoreSale();
  const [endedKey, setEndedKey] = useState<string | null>(null);
  useEffect(() => {
    if (!sale) return;
    const left = Date.parse(sale.ends_at) - Date.now();
    // setTimeout caps at about 24.8 days; a longer sale is re-checked on the next load.
    if (!Number.isFinite(left) || left > 2_000_000_000) return;
    const id = window.setTimeout(() => setEndedKey(sale.key + sale.ends_at), Math.max(0, left));
    return () => window.clearTimeout(id);
  }, [sale]);
  return !sale || endedKey === sale.key + sale.ends_at ? null : sale;
}

// ── The countdown (display only) ────────────────────────────────────────────

export interface Countdown { d: string; h: string; m: string; s: string }

const two = (n: number) => String(Math.max(0, n)).padStart(2, '0');

function countdownAt(endsAt: string, now: number): Countdown | null {
  const end = Date.parse(endsAt);
  if (!Number.isFinite(end)) return null;
  const left = Math.floor((end - now) / 1000);
  if (left <= 0) return null;
  return {
    d: two(Math.floor(left / 86400)),
    h: two(Math.floor((left % 86400) / 3600)),
    m: two(Math.floor((left % 3600) / 60)),
    s: two(left % 60),
  };
}

/** {d,h,m,s} as two-digit strings until endsAt, null at zero (or with no date). */
export function useSaleCountdown(endsAt: string | null | undefined): Countdown | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    let id: number | null = null;
    const start = () => {
      if (id !== null || document.visibilityState !== 'visible') return;
      id = window.setInterval(() => setNow(Date.now()), 1000);
    };
    const stop = () => { if (id !== null) { window.clearInterval(id); id = null; } };
    const onVis = () => { if (document.visibilityState === 'visible') { setNow(Date.now()); start(); } else stop(); };
    start();
    document.addEventListener('visibilitychange', onVis);
    return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
  }, [endsAt]);
  return endsAt ? countdownAt(endsAt, now) : null;
}

/** "Wednesday 2 December": the UTC day, the day the sale is announced for, wherever the
 *  viewer is (shown in capitals by CSS). The countdown still counts to the exact moment. */
export function saleEndLabel(endsAt: string): string {
  const d = new Date(endsAt);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
}
