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
// RLS note: policy "Role configs readable if conference public or organizer"
// already lets anon SELECT `application_role_configs` for public conferences,
// so this works unauthenticated. No DB change is needed.

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

  const { data } = await (client.from('application_role_configs') as FeeQuery)
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
