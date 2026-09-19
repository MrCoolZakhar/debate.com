// publicFees.ts — the single source of truth for the headline delegate fee
// shown on PUBLIC conference surfaces (homepage rail, /conferences/explore,
// the public conference page).
//
// Why this exists: `conferences.fee_amount` / `fee_currency` are legacy
// denormalised columns written once at conference creation and NEVER updated
// afterwards. Organisers edit fees in `application_role_configs` (per role,
// optionally split into dated `fee_phases`). Public surfaces that read the
// conference columns therefore advertise stale — sometimes free — prices.
//
// THE RULE (owner, 18 Sep 2026), implemented once in displayDelegatePrice():
//   1. Until DELEGATE APPLICATIONS ARE SET UP the price is "TBD" (and the
//      public page renders no pricing details). Set up means the
//      conference's `delegate` role config exists and `is_enabled` is true
//      (the role-config trigger only allows that once financial setup is
//      done), whether applications are already open or open in the future.
//      A conference with no delegate role config is TBD too: the
//      conference-level `fee_amount` is never shown any more (the creation
//      wizard no longer asks for a price).
//   2. Once set up it is the DELEGATE price of the CURRENT fee stage, taken
//      at today or, when applications open later, at the opening date (the
//      stage that will apply then): the `fee_phases` entry whose dates
//      contain that day (early bird / regular / late), else the flat
//      `fee_amount` (what checkout charges between phases). A phased config
//      whose flat fee is 0 and has no phase on that day shows the next
//      stage, or the last one, rather than a false "Free".
//   3. A set-up delegate price of 0 is "Free".
//
// Reads the `conference_public_fees` VIEW, not `application_role_configs`
// directly, and that distinction matters. The table's SELECT policy is
// "readable if conference public or organizer", so for an UNPUBLISHED
// conference an anonymous visitor got nothing back and fell through to the
// stale conference column — which is exactly the original bug, just narrowed
// to private conferences. Meanwhile `conferences` itself is readable by anyone
// with the link (USING (true)), so those pages render, stale price and all.
//
// The view is a pricing-only, RLS-bypassing projection that closes that gap.
// It deliberately excludes `custom_questions` (an organiser's draft application
// form), which is why the table's own policy was NOT widened instead. Nothing
// the view exposes is more sensitive than the fee_amount already published on
// the conferences row.

import { activeFeePhase, type FeePhase } from '@/lib/finance';
import { formatFeeCompact } from '@/lib/utils';

/** What a public surface shows for a conference's delegate price. */
export type DelegatePrice =
  | { kind: 'tbd' }
  | { kind: 'free' }
  | { kind: 'paid'; amount: number; currency: string; phase: FeePhase | null };

export const TBD_PRICE: DelegatePrice = { kind: 'tbd' };

/** The delegate role config fields the rule needs (a row of the view, or of
 *  application_role_configs read directly). */
export interface DelegatePriceConfig {
  is_enabled?: boolean | null;
  applications_open_at?: string | null;
  fee_amount: number | string | null;
  fee_currency?: string | null;
  fee_phases?: FeePhase[] | null;
}

// Deliberately structural and shallow: taking the full SupabaseClient type
// here makes TS chase its deeply generic query builder (TS2589) at call sites.
export interface MinimalClient {
  from(table: string): unknown;
}

interface FeeQuery {
  select(cols: string): {
    eq(col: string, val: unknown): {
      in(col: string, vals: readonly string[]): PromiseLike<{ data: DelegateFeeRow[] | null }>;
    };
  };
}

interface DelegateFeeRow extends DelegatePriceConfig {
  conference_id: string;
}

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Applications for this role are set up (enabled), open now or opening later. */
export function applicationsSetUp(cfg: DelegatePriceConfig | null | undefined): boolean {
  return !!cfg && !!cfg.is_enabled;
}

/** Applications are set up but open later than `today`: the opening instant, else null. */
export function upcomingOpening(cfg: DelegatePriceConfig | null | undefined, today: Date = new Date()): Date | null {
  if (!cfg?.applications_open_at) return null;
  const openAt = new Date(cfg.applications_open_at);
  return !Number.isNaN(openAt.getTime()) && openAt.getTime() > today.getTime() ? openAt : null;
}

/** The day whose fee stage is shown: today, or the opening date when that is later. */
export function priceDate(cfg: DelegatePriceConfig, today: Date = new Date()): Date {
  return upcomingOpening(cfg, today) ?? today;
}

/** The fee stage that applies on `day`, and its amount. */
export function currentStageAmount(cfg: DelegatePriceConfig, day: Date = new Date()): { amount: number; phase: FeePhase | null } {
  const phases = (cfg.fee_phases ?? []).filter(p => p && p.start_date && p.end_date);
  const active = activeFeePhase(phases, day);
  if (active) return { amount: Number(active.amount) || 0, phase: active };
  const flat = Number(cfg.fee_amount) || 0;
  if (flat > 0 || phases.length === 0) return { amount: flat, phase: null };
  // Phased pricing with a 0 flat fee and no phase on that day (before the
  // first, in a gap, or after the last): the next stage, else the last one.
  const iso = isoDay(day);
  const sorted = [...phases].sort((x, y) => x.start_date.localeCompare(y.start_date));
  const next = sorted.find(p => p.start_date > iso) ?? sorted[sorted.length - 1];
  return { amount: Number(next.amount) || 0, phase: next };
}

/**
 * The public price of ONE role config under the rule above (TBD unless the
 * role is enabled). The delegate headline, and on the public conference page
 * every role in the pricing list and the role picker, go through this.
 */
export function displayRolePrice(
  cfg: DelegatePriceConfig | null | undefined,
  fallbackCurrency: string,
  today: Date = new Date(),
): DelegatePrice {
  if (!cfg || !applicationsSetUp(cfg)) return TBD_PRICE;
  const { amount, phase } = currentStageAmount(cfg, priceDate(cfg, today));
  if (!(amount > 0)) return { kind: 'free' };
  return { kind: 'paid', amount, currency: cfg.fee_currency || fallbackCurrency || 'USD', phase };
}

/**
 * THE public delegate price of a conference (see the rule at the top).
 * `cfg` is the conference's `delegate` role config (null when it has none);
 * `fallbackCurrency` is used when the config carries no currency.
 */
export function displayDelegatePrice(
  cfg: DelegatePriceConfig | null | undefined,
  fallbackCurrency: string,
  today: Date = new Date(),
): DelegatePrice {
  return displayRolePrice(cfg, fallbackCurrency, today);
}

/** Plain-text label: "TBD", "Free" or the compact price ("£120", "₹2.5k"). */
export function delegatePriceLabel(
  price: DelegatePrice,
  labels: { tbd: string; free: string } = { tbd: 'TBD', free: 'Free' },
): string {
  if (price.kind === 'tbd') return labels.tbd;
  if (price.kind === 'free') return labels.free;
  return formatFeeCompact(price.amount, price.currency);
}

/**
 * Batched (single `in()` query) public delegate price for many conferences.
 * Every requested id is in the result; a conference with no delegate role
 * config, or whose read failed, is TBD.
 */
export async function fetchDelegatePrices(
  client: MinimalClient,
  conferences: readonly { id: string; fee_currency?: string | null }[],
  today: Date = new Date(),
): Promise<Map<string, DelegatePrice>> {
  const out = new Map<string, DelegatePrice>();
  const ids = Array.from(new Set(conferences.map(c => c.id).filter(Boolean)));
  if (ids.length === 0) return out;
  const currencyOf = new Map(conferences.map(c => [c.id, c.fee_currency ?? '']));

  const { data } = await (client.from('conference_public_fees') as FeeQuery)
    .select('conference_id, fee_amount, fee_currency, fee_phases, is_enabled, applications_open_at')
    .eq('role', 'delegate')
    .in('conference_id', ids);

  for (const id of ids) out.set(id, TBD_PRICE);
  for (const row of data ?? []) {
    out.set(row.conference_id, displayDelegatePrice(row, currencyOf.get(row.conference_id) ?? '', today));
  }
  return out;
}

/** Attach the resolved public price to a conference row as `delegate_price`. */
export function withDelegatePrice<T extends { id: string }>(
  conf: T,
  prices: Map<string, DelegatePrice>,
): T & { delegate_price: DelegatePrice } {
  return { ...conf, delegate_price: prices.get(conf.id) ?? TBD_PRICE };
}
