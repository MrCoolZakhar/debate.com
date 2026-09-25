'use client';

// ── Credit prices: the server's tiers, computed locally, never hardcoded ──────
//
// Postgres `credit_price_tiers()` is the one source of a credit's price:
// {unit_cents, max_qty, tiers:[{min_qty, pct}]}. Every price the UI shows is
// computed from that table with the SAME rounding `credit_price_cents(qty)`
// uses server-side, round(qty * unit * (100 - pct) / 100), so a chip, a total
// and Stripe's own amount can never disagree. `create-credit-checkout` takes
// no price from the client at all; what we compute here is only what the
// person reads before they press Pay.
//
// No table, no price. If the RPC cannot be read the UI says so and waits; it
// never falls back to a number written in the client.

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface CreditTier { min_qty: number; pct: number }
export interface CreditPriceTable {
  unitCents: number;
  maxQty: number;
  /** Ascending by min_qty. */
  tiers: CreditTier[];
}

let cached: CreditPriceTable | null = null;
let pending: Promise<CreditPriceTable | null> | null = null;

function parseTable(raw: unknown): CreditPriceTable | null {
  const r = raw as { unit_cents?: unknown; max_qty?: unknown; tiers?: unknown } | null;
  if (!r || typeof r.unit_cents !== 'number' || typeof r.max_qty !== 'number' || !Array.isArray(r.tiers)) return null;
  const tiers = (r.tiers as { min_qty?: unknown; pct?: unknown }[])
    .filter((t) => typeof t.min_qty === 'number' && typeof t.pct === 'number')
    .map((t) => ({ min_qty: t.min_qty as number, pct: t.pct as number }))
    .sort((a, b) => a.min_qty - b.min_qty);
  return { unitCents: r.unit_cents, maxQty: r.max_qty, tiers };
}

/** One read per page load, shared by every caller; anon is enough. */
export async function loadCreditPriceTable(): Promise<CreditPriceTable | null> {
  if (cached) return cached;
  if (pending) return pending;
  pending = (async () => {
    try {
      const { data, error } = await supabase.rpc('credit_price_tiers');
      if (error) return null;
      const table = parseTable(data);
      if (table) cached = table;
      return table;
    } catch {
      return null;
    } finally {
      pending = null;
    }
  })();
  return pending;
}

/** null while loading; `error` true when the table could not be read. */
export function useCreditPriceTable(): { table: CreditPriceTable | null; error: boolean; retry: () => void } {
  const [table, setTable] = useState<CreditPriceTable | null>(cached);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    loadCreditPriceTable().then((t) => {
      if (cancelled) return;
      setTable(t);
      setError(!t);
    });
    return () => { cancelled = true; };
  }, [attempt]);
  return { table, error, retry: () => { setError(false); setAttempt((a) => a + 1); } };
}

/** The discount for a quantity: the highest tier it reaches, else 0. */
export function discountPctFor(qty: number, table: CreditPriceTable): number {
  let pct = 0;
  for (const t of table.tiers) if (qty >= t.min_qty) pct = t.pct;
  return pct;
}

/** What Stripe will charge, in cents, with the server's rounding. */
export function priceCentsFor(qty: number, table: CreditPriceTable): number {
  const pct = discountPctFor(qty, table);
  return Math.round((qty * table.unitCents * (100 - pct)) / 100);
}

/** The undiscounted price, in cents. */
export function listCentsFor(qty: number, table: CreditPriceTable): number {
  return qty * table.unitCents;
}

/** "$1", "$10.80", "$22.50". Whole dollars carry no cents. */
export function formatUsd(cents: number): string {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** The price of one credit at a quantity, e.g. "$0.90 each". */
export function perCreditCents(qty: number, table: CreditPriceTable): number {
  return Math.round(priceCentsFor(qty, table) / qty);
}

/**
 * The nudge (owner, 25 Sep 2026): when a few more credits would cost LESS in
 * total because they reach the next tier, say so. Returns the nearest tier
 * above `qty` whose total is cheaper than the total at `qty`, or null.
 * `extra` credits more, saving `saves` cents. Computed only from the table.
 */
export function nextTierNudge(qty: number, table: CreditPriceTable): { qty: number; extra: number; saves: number } | null {
  const here = priceCentsFor(qty, table);
  for (const t of table.tiers) {
    if (t.min_qty <= qty || t.min_qty > table.maxQty) continue;
    const there = priceCentsFor(t.min_qty, table);
    if (there < here) return { qty: t.min_qty, extra: t.min_qty - qty, saves: here - there };
    // Tiers are ascending; the first one above `qty` decides.
    return null;
  }
  return null;
}

/** "10 or more are 10% off, 25 or more 15% off, 50 or more 20% off, and 100 or
 *  more 25% off": the discount ladder as a sentence fragment, from the table. */
export function describeTiers(table: CreditPriceTable): string {
  const steps = table.tiers.filter((t) => t.pct > 0);
  if (steps.length === 0) return 'there are no bundle discounts at the moment';
  const parts = steps.map((t, i) => `${t.min_qty} or more ${i === 0 ? 'are ' : ''}${t.pct}% off`);
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

// ── Where the pop-up opened from, and which bundles it offers there ──────────

export type CreditsContext = 'header' | 'pricing' | 'manage' | 'apply' | 'pay' | 'organizer';

export const CREDIT_BUNDLES: Record<CreditsContext, number[]> = {
  header: [1, 10, 25, 50, 100],
  pricing: [1, 10, 25, 50, 100],
  manage: [1, 10, 25, 50, 100],
  /** Out of credits while submitting an application: small, quick, 1 first. */
  apply: [1, 5, 10, 20, 25],
  /** A faculty advisor or head delegate on the pay page. */
  pay: [1, 5, 10, 25, 50],
  /** Organisers buying for imports later. */
  organizer: [25, 50, 100, 200],
};

export const DEFAULT_BUNDLE: Record<CreditsContext, number> = {
  header: 10,
  pricing: 10,
  manage: 10,
  apply: 1,
  pay: 5,
  organizer: 50,
};

/** Fallback ceiling until the table says otherwise (it does: max_qty). */
export const CREDITS_MAX_QTY = 500;

export function clampQty(qty: number, table: CreditPriceTable | null): number {
  const max = table?.maxQty ?? CREDITS_MAX_QTY;
  if (!Number.isFinite(qty)) return 1;
  return Math.min(max, Math.max(1, Math.round(qty)));
}
