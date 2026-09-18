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
//   1. Until DELEGATE APPLICATIONS ARE LAUNCHED the price is "TBD". Launched
//      means the conference's `delegate` role config exists, `is_enabled` is
//      true (the organiser opened delegate applications; the role-config
//      trigger only lets that happen once financial setup is done), and its
//      `applications_open_at` is unset or already passed. A conference with
//      no delegate role config at all is TBD too: the conference-level
//      `fee_amount` is never shown any more (the creation wizard no longer
//      asks for a price, so that column is always 0 for new conferences).
//   2. After launch it is the DELEGATE price of the CURRENT fee stage: the
//      `fee_phases` entry whose dates contain today (early bird / regular /
//      late), else the flat `fee_amount` (what checkout charges between
//      phases). A phased config whose flat fee is 0 and has no active phase
//      shows the next stage, or the last one, rather than a false "Free".
//   3. A launched delegate price of 0 is "Free".
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

/** Delegate applications are launched: enabled, and the opening time (if any) has passed. */
export function delegateApplicationsLaunched(
  cfg: DelegatePriceConfig | null | undefined,
  today: Date = new Date(),
): boolean {
  if (!cfg || !cfg.is_enabled) return false;
  if (!cfg.applications_open_at) return true;
  const openAt = new Date(cfg.applications_open_at);
  return Number.isNaN(openAt.getTime()) || openAt.getTime() <= today.getTime();
}

/** The delegate amount of the current fee stage, and that stage. */
function currentStageAmount(cfg: DelegatePriceConfig, today: Date): { amount: number; phase: FeePhase | null } {
  const phases = (cfg.fee_phases ?? []).filter(p => p && p.start_date && p.end_date);
  const active = activeFeePhase(phases, today);
  if (active) return { amount: Number(active.amount) || 0, phase: active };
  const flat = Number(cfg.fee_amount) || 0;
  if (flat > 0 || phases.length === 0) return { amount: flat, phase: null };
  // Phased pricing with a 0 flat fee and today in no phase (before the first,
  // in a gap, or after the last): the next stage, else the last one.
  const iso = isoDay(today);
  const sorted = [...phases].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const next = sorted.find(p => p.start_date > iso) ?? sorted[sorted.length - 1];
  return { amount: Number(next.amount) || 0, phase: next };
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
  if (!cfg || !delegateApplicationsLaunched(cfg, today)) return TBD_PRICE;
  const { amount, phase } = currentStageAmount(cfg, today);
  if (!(amount > 0)) return { kind: 'free' };
  return { kind: 'paid', amount, currency: cfg.fee_currency || fallbackCurrency || 'USD', phase };
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
