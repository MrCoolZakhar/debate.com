'use client';

// ── What a person owes and has paid, from the invoices (owner, 15 Nov 2026) ─
//
// Financials and the invoices are the one source of truth for money.
// applications.payment_status is only an ACCESS flag, so no label, filter,
// count or export on the Applications or Assignment pages reads it for money
// any more. They read money_for_conference (one row per application that has
// money: owed_cents is the /pay total still owed, paid_cents what was paid,
// in_review_cents what waits in a proof review) through this file, and
// moneyState is the ONE definition of the state a person is in.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getFreshAuthedClient } from '@/lib/supabase-auth';

export interface MoneyRow {
  currency: string;
  owedCents: number;
  paidCents: number;
  inReviewCents: number;
}

/** A live manual payment (prompt 138): a proof waiting or a payment started with no proof. */
export interface LivePay { kind: 'proof' | 'started'; createdAt: string | null; expiresAt: string | null }

export type MoneyState = 'paid' | 'review' | 'started' | 'part' | 'owes' | 'none';

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** One row of money_for_conference / money_for_applications, by application id. */
export function moneyMapFrom(data: unknown): Map<string, MoneyRow> {
  const out = new Map<string, MoneyRow>();
  if (!Array.isArray(data)) return out;
  for (const raw of data) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const id = typeof r.application_id === 'string' ? r.application_id : null;
    if (!id) continue;
    out.set(id, {
      currency: typeof r.currency === 'string' && r.currency ? r.currency : 'USD',
      owedCents: num(r.owed_cents),
      paidCents: num(r.paid_cents),
      inReviewCents: num(r.in_review_cents),
    });
  }
  return out;
}

/**
 * Every application's money at one conference. Keyed on the conference id and
 * the user id, never the token. A failed read keeps the last good map and
 * raises `error`; nothing here ever shows a full-screen loader.
 */
export function useConferenceMoney(conferenceId: string | null | undefined): {
  money: Map<string, MoneyRow>;
  loaded: boolean;
  error: boolean;
  reload: () => Promise<void>;
} {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [money, setMoney] = useState<Map<string, MoneyRow>>(() => new Map());
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const seq = useRef(0);

  const reload = useCallback(async () => {
    if (!conferenceId || !userId) return;
    const mine = ++seq.current;
    try {
      const supabase = await getFreshAuthedClient();
      if (!supabase) { if (mine === seq.current) setError(true); return; }
      const { data, error: rpcError } = await supabase.rpc('money_for_conference', { p_conference_id: conferenceId });
      if (mine !== seq.current) return;
      if (rpcError) { setError(true); return; }
      setMoney(moneyMapFrom(data));
      setLoaded(true);
      setError(false);
    } catch {
      if (mine === seq.current) setError(true);
    }
  }, [conferenceId, userId]);

  // The first read starts after the effect, never as a synchronous setState inside it.
  useEffect(() => { void Promise.resolve().then(reload); }, [reload]);

  return { money, loaded, error, reload };
}

/** The ONE money state. The checks run in this order. */
export function moneyState(row: MoneyRow | undefined, live?: LivePay | null): MoneyState {
  if (!row) return 'none';
  if (row.owedCents <= 0 && row.paidCents > 0) return 'paid';
  if (row.inReviewCents > 0) return 'review';
  if (row.owedCents > 0 && live?.kind === 'started') return 'started';
  if (row.owedCents > 0 && row.paidCents > 0) return 'part';
  if (row.owedCents > 0) return 'owes';
  return 'none';
}

export function moneyLabel(state: MoneyState): string {
  switch (state) {
    case 'paid': return 'Paid';
    case 'review': return 'Proof to review';
    case 'started': return 'Payment started';
    case 'part': return 'Part paid';
    case 'owes': return 'Unpaid';
    default: return 'Nothing owed';
  }
}

/** Assignment's Paid filter: paid, or nothing owed. */
export function moneySettled(state: MoneyState): boolean {
  return state === 'paid' || state === 'none';
}

/** Still owes something (the Unpaid filter and tile). */
export function moneyOwing(state: MoneyState): boolean {
  return state === 'owes' || state === 'part' || state === 'started';
}
