'use client';

// conferenceMoney.ts — the ONE definition of "money" for a conference, read
// from the database through conference_money_summary(). The dashboard money
// card, the Financials overview and the admin conference pop-up all use it,
// so they can never disagree.
//
//   received     succeeded Stripe payments: money that actually came in
//                THROUGH Gavelling. A refunded payment drops out.
//   offline      succeeded non-Stripe payments (organiser marked paid, or
//                approved a proof upload). The organiser says they got it,
//                Gavelling never saw it. Shown on its own, never added to
//                received.
//   outstanding  open / partial invoice balances of ACCEPTED participants
//                (accepted, assigned, checked-in). Waived invoices owe nothing.
//
// applications.payment_status = 'paid' is an ACCESS flag, not money: a free
// registration (a chair, most often) is stamped paid on arrival, and a member
// covered by a delegation pledge is paid with no money of their own. Never
// multiply it by a fee.

import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAuthedClient } from '@/lib/supabase-auth';

export interface CurrencyMoney {
  cur: string;
  received_cents: number; received_count: number;
  offline_cents: number; offline_count: number;
  outstanding_cents: number; outstanding_count: number;
  waived_cents: number; waived_count: number;
}

export interface ConferenceMoney {
  /** The conference's own currency; every top-level figure is in it. */
  currency: string;
  received_cents: number; received_count: number;
  offline_cents: number; offline_count: number;
  outstanding_cents: number; outstanding_count: number;
  waived_cents: number; waived_count: number;
  /** Payments / balances in any other currency, never summed into the above. */
  other_currencies: CurrencyMoney[];
  /** Only with `detail`: money per application (invoices in its own name,
   *  conference currency). An application missing here had no money at all. */
  applications: { id: string; received_cents: number; offline_cents: number }[] | null;
}

export async function fetchConferenceMoney(
  supabase: SupabaseClient,
  conferenceId: string,
  opts: { detail?: boolean } = {},
): Promise<ConferenceMoney | null> {
  const { data, error } = await supabase.rpc('conference_money_summary', {
    p_conference_id: conferenceId,
    p_detail: !!opts.detail,
  });
  if (error || !data) return null;
  return data as ConferenceMoney;
}

/** Major units from cents, in the stored currency. */
export function moneyFromCents(cents: number | null | undefined): number {
  return Math.round(Number(cents) || 0) / 100;
}

/** Per-application money lookup (only filled when fetched with `detail`). */
export function moneyByApplication(m: ConferenceMoney | null): Map<string, { received: number; offline: number }> {
  const out = new Map<string, { received: number; offline: number }>();
  for (const a of m?.applications ?? []) {
    out.set(a.id, { received: moneyFromCents(a.received_cents), offline: moneyFromCents(a.offline_cents) });
  }
  return out;
}

/** React wrapper, keyed on the access token string (never a client object,
 *  which getAuthedClient recreates on every call). `beforeRead` runs first,
 *  e.g. sync_conference_invoices on the Financials pages. */
export function useConferenceMoney(
  accessToken: string | null | undefined,
  conferenceId: string | null | undefined,
  opts: { detail?: boolean; beforeRead?: (c: SupabaseClient) => Promise<unknown> } = {},
): { money: ConferenceMoney | null; loading: boolean } {
  const [state, setState] = useState<{ key: string; money: ConferenceMoney | null } | null>(null);
  const key = `${conferenceId ?? ''}|${opts.detail ? 1 : 0}`;
  useEffect(() => {
    if (!accessToken || !conferenceId) return;
    const client = getAuthedClient(accessToken);
    let cancelled = false;
    (async () => {
      if (opts.beforeRead) await opts.beforeRead(client);
      const money = await fetchConferenceMoney(client, conferenceId, { detail: opts.detail });
      if (!cancelled) setState({ key, money });
    })();
    return () => { cancelled = true; };
  }, [accessToken, conferenceId, key]); // eslint-disable-line react-hooks/exhaustive-deps
  const current = state?.key === key ? state : null;
  return { money: current?.money ?? null, loading: !current };
}
