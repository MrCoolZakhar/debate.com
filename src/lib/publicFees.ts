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
// The resolution rule, mirrored everywhere:
//   1. the conference's `delegate` role config, resolved through
//      `activePhaseFee()` so a time-varying phased fee shows TODAY's price;
//   2. only when no delegate role config row exists at all, fall back to the
//      conference-level columns.
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

import { activePhaseFee, type FeePhase } from '@/lib/finance';

export interface ResolvedFee {
  amount: number;
  currency: string;
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

interface DelegateFeeRow {
  conference_id: string;
  fee_amount: number | null;
  fee_currency: string | null;
  fee_phases: FeePhase[] | null;
}

/**
 * Batched (single `in()` query) headline delegate fee for many conferences.
 *
 * Returns a Map keyed by conference id containing ONLY the conferences that
 * actually have a delegate role config — callers keep their existing
 * conference-level fee for any id missing from the map (the fallback case).
 */
export async function fetchDelegateFees(
  client: MinimalClient,
  conferenceIds: readonly string[],
  today: Date = new Date(),
): Promise<Map<string, ResolvedFee>> {
  const out = new Map<string, ResolvedFee>();
  const ids = Array.from(new Set(conferenceIds.filter(Boolean)));
  if (ids.length === 0) return out;

  const { data } = await (client.from('conference_public_fees') as FeeQuery)
    .select('conference_id, fee_amount, fee_currency, fee_phases')
    .eq('role', 'delegate')
    .in('conference_id', ids);

  for (const row of data ?? []) {
    const { amount } = activePhaseFee({ fee_amount: row.fee_amount, fee_phases: row.fee_phases }, today);
    out.set(row.conference_id, {
      amount: Number(amount) || 0,
      // A blank/absent role currency means "same as the conference" — the
      // caller supplies that; we only surface a currency when we have one.
      currency: row.fee_currency ?? '',
    });
  }
  return out;
}

/** Apply a resolved fee onto a conference row, keeping its currency as the fallback. */
export function applyDelegateFee<T extends { id: string; fee_amount: number; fee_currency: string }>(
  conf: T,
  fees: Map<string, ResolvedFee>,
): T {
  const f = fees.get(conf.id);
  if (!f) return conf;
  return { ...conf, fee_amount: f.amount, fee_currency: f.currency || conf.fee_currency } as T;
}
