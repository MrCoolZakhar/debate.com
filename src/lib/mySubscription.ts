'use client';

// ── The signed-in person's own Unlimited subscription row ───────────────────
//
// `useUnlimitedStatus()` answers the yes/no ("is this person on Unlimited");
// this answers the rest: which plan, until when, and whether it is a trial or
// promo grant (`unlimited_trial`), a paid plan, a renewal that failed
// (`past_due`) or a plan that ended. The Subscription page and the Unlimited
// pop-up both need it (owner, 25 Sep 2026: buying while on a trial is allowed
// and says when the paid plan starts; a failed renewal offers RENEW FOR A
// YEAR). One read per mount off a fresh token, re-read whenever
// notifyUnlimitedChanged() fires.
//
// Plans seen in production: unlimited_trial (trialing / expired),
// unlimited_monthly (active / canceled / expired); yearly rows are
// unlimited_yearly (or unlimited_annual in older code).

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { useUnlimitedStatus } from '@/lib/unlimitedStatus';

export interface SubscriptionRow {
  plan: string;
  status: string;
  current_period_end: string | null;
}

export type SubscriptionKind =
  /** never had one, or nothing left to show */
  | 'none'
  /** a trial or a promo grant: Unlimited now, not paid */
  | 'trial'
  /** a paid plan, active */
  | 'paid'
  /** the latest paid plan's renewal failed */
  | 'past_due'
  /** the latest plan ended (expired or cancelled and past its period) */
  | 'lapsed';

export interface MySubscription {
  row: SubscriptionRow | null;
  kind: SubscriptionKind;
  /** monthly / yearly for a paid or past-due plan, null otherwise */
  cadence: 'monthly' | 'yearly' | null;
  /** when the current period ends (a trial's end, a paid plan's renewal) */
  endsAt: Date | null;
  loading: boolean;
  reload: () => void;
}

export function isTrialPlan(plan: string): boolean {
  return plan === 'unlimited_trial';
}

export function cadenceOf(plan: string): 'monthly' | 'yearly' | null {
  if (!plan.startsWith('unlimited') || isTrialPlan(plan)) return null;
  return plan.endsWith('_monthly') ? 'monthly' : 'yearly';
}

export function classify(rows: SubscriptionRow[], now = Date.now()): { row: SubscriptionRow | null; kind: SubscriptionKind } {
  const inFuture = (r: SubscriptionRow) => r.current_period_end === null || new Date(r.current_period_end).getTime() > now;
  const live = rows.find((r) => (r.status === 'active' || r.status === 'trialing') && inFuture(r)) ?? null;
  if (live) return { row: live, kind: isTrialPlan(live.plan) ? 'trial' : 'paid' };
  const pastDue = rows.find((r) => r.status === 'past_due') ?? null;
  if (pastDue) return { row: pastDue, kind: 'past_due' };
  const latest = rows[0] ?? null;
  if (latest && latest.plan.startsWith('unlimited')) return { row: latest, kind: 'lapsed' };
  return { row: null, kind: 'none' };
}

export function useMySubscription(): MySubscription {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const status = useUnlimitedStatus();
  const [rows, setRows] = useState<SubscriptionRow[] | null>(null);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!userId) { setRows(null); return; }
    let cancelled = false;
    (async () => {
      const client = await getFreshAuthedClient();
      if (!client || cancelled) return;
      const { data } = await client
        .from('subscriptions')
        .select('plan, status, current_period_end')
        .eq('owner_user_id', userId)
        .is('conference_id', null)
        .order('created_at', { ascending: false })
        .limit(5);
      if (!cancelled) setRows((data as SubscriptionRow[] | null) ?? []);
    })();
    return () => { cancelled = true; };
    // `status` is in the list so a purchase (notifyUnlimitedChanged) re-reads.
  }, [userId, tick, status]);

  const { row, kind } = classify(rows ?? []);
  return {
    row,
    kind,
    cadence: row ? cadenceOf(row.plan) : null,
    endsAt: row?.current_period_end ? new Date(row.current_period_end) : null,
    loading: rows === null && !!userId,
    reload,
  };
}

/** "3 November 2026", for "starts when your current Unlimited ends on …". */
export function formatPlanDate(d: Date): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}
