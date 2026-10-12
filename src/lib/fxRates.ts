// fxRates.ts — the ONE place display exchange rates come from (prompt 100).
//
// public.fx_rates holds 1 USD = per_usd units of each currency (166 of them,
// every code in CURRENCY_CODES included), refreshed every day at 00:20 UTC by
// the fx-rates-refresh edge function from open.er-api.com; when the source
// fails, yesterday's rates stay. DISPLAY ONLY: nothing is ever charged at
// these rates.
//
// The table is read once per page load (anon, select only) and shared by every
// caller. Until it lands, and if it cannot be read, fxRate() falls back to the
// small fixed USD_FX table in finance.ts (which the upsell copy keeps using).

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { roundMoney, USD_FX } from '@/lib/finance';

const rates = new Map<string, number>();
let asOf: string | null = null;
let loading: Promise<Map<string, number>> | null = null;
let loaded = false;

/** Reads fx_rates once per page load; every caller gets the same promise. A failed read resolves empty and is retried on the next call. */
export function loadFxRates(): Promise<Map<string, number>> {
  if (loaded) return Promise.resolve(rates);
  if (loading) return loading;
  loading = (async () => {
    try {
      const { data, error } = await supabase.from('fx_rates').select('currency, per_usd, source_updated_at');
      if (error || !Array.isArray(data)) throw error ?? new Error('fx_rates');
      let newest: string | null = null;
      for (const r of data as { currency: string; per_usd: number | string; source_updated_at: string | null }[]) {
        const v = Number(r.per_usd);
        if (r.currency && Number.isFinite(v) && v > 0) rates.set(r.currency.toUpperCase(), v);
        if (r.source_updated_at && (!newest || r.source_updated_at > newest)) newest = r.source_updated_at;
      }
      asOf = newest;
      loaded = rates.size > 0;
      if (!loaded) loading = null;
      return rates;
    } catch {
      loading = null;
      return new Map<string, number>();
    }
  })();
  return loading;
}

/** The newest source_updated_at among the live rates, or null (not loaded, or the fallback table). */
export function fxRatesAsOf(): string | null {
  return loaded ? asOf : null;
}

/** Re-renders once the live rates land. */
export function useFxRates(): { ready: boolean; ratesAsOf: string | null } {
  const [ready, setReady] = useState(loaded);
  useEffect(() => {
    if (loaded) return;
    let alive = true;
    void loadFxRates().then(() => { if (alive && loaded) setReady(true); });
    return () => { alive = false; };
  }, []);
  return { ready, ratesAsOf: ready ? asOf : null };
}

/** 1 USD in this currency: the live rate, else the fixed table, else null. */
export function fxRate(code: string | null | undefined): number | null {
  if (!code) return null;
  const c = code.toUpperCase();
  return rates.get(c) ?? USD_FX[c] ?? null;
}

/** An approximate conversion for display; null when either rate is missing. */
export function convertApprox(amount: number, from: string, to: string): number | null {
  const rf = fxRate(from);
  const rt = fxRate(to);
  if (!rf || !rt) return null;
  return roundMoney((amount / rf) * rt);
}
