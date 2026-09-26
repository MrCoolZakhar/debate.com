'use client';

// subscriptionManage.ts — cancel and resume Unlimited inside Gavelling
// (25 Sep 2026).
//
// `my_unlimited_status()` keeps its old keys (status, plan, current_period_end)
// and now also says whether the plan is a real Stripe subscription, whether it
// renews, whether it was cancelled at period end, whether it can be cancelled
// or resumed, and, when status is none, which paid plan lapsed in the last
// 180 days. `useUnlimitedDetail()` reads the whole object once per mount and
// again whenever notifyUnlimitedChanged() fires.
//
// The edge function `manage-subscription` (POST, the user's JWT, the same call
// style as create-billing-portal) takes { action: 'cancel', reasons?, note? }
// or { action: 'resume' } and answers { ok, status } or { ok:false, error }
// with a plain sentence. Both are safe to repeat. After either, callers
// RE-READ my_unlimited_status() rather than trusting local state: the Stripe
// webhook is what syncs cancel_at_period_end, so a cancel made in the Stripe
// portal shows up the same way.

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError, UserFacingError } from '@/lib/friendlyError';
import { extractFunctionErrorMessage } from '@/lib/payments';
import { notifyUnlimitedChanged } from '@/lib/unlimitedStatus';

export interface UnlimitedDetail {
  status: 'none' | 'trial' | 'monthly' | 'annual';
  plan: string | null;
  current_period_end: string | null;
  on_stripe: boolean;
  renews: boolean;
  cancel_at_period_end: boolean;
  can_cancel: boolean;
  can_resume: boolean;
  lapsed_plan: string | null;
  lapsed_at: string | null;
}

const NONE: UnlimitedDetail = {
  status: 'none', plan: null, current_period_end: null, on_stripe: false, renews: false,
  cancel_at_period_end: false, can_cancel: false, can_resume: false, lapsed_plan: null, lapsed_at: null,
};

function parse(data: unknown): UnlimitedDetail {
  const a = (data ?? {}) as Record<string, unknown>;
  const s = a.status;
  return {
    status: s === 'trial' || s === 'monthly' || s === 'annual' ? s : 'none',
    plan: typeof a.plan === 'string' ? a.plan : null,
    current_period_end: typeof a.current_period_end === 'string' ? a.current_period_end : null,
    on_stripe: a.on_stripe === true,
    renews: a.renews === true,
    cancel_at_period_end: a.cancel_at_period_end === true,
    can_cancel: a.can_cancel === true,
    can_resume: a.can_resume === true,
    lapsed_plan: typeof a.lapsed_plan === 'string' ? a.lapsed_plan : null,
    lapsed_at: typeof a.lapsed_at === 'string' ? a.lapsed_at : null,
  };
}

export async function readUnlimitedDetail(): Promise<UnlimitedDetail> {
  const client = await getFreshAuthedClient();
  if (!client) return NONE;
  const { data, error } = await client.rpc('my_unlimited_status');
  if (error) throw error;
  return parse(data);
}

/** The whole status object; null while loading or signed out. */
export function useUnlimitedDetail(): { detail: UnlimitedDetail | null; loading: boolean; reload: () => Promise<void> } {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [detail, setDetail] = useState<UnlimitedDetail | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void readUnlimitedDetail().then(d => { if (!cancelled) setDetail(d); }, () => { if (!cancelled) setDetail(NONE); });
    return () => { cancelled = true; };
  }, [userId, tick]);

  // A purchase, a promo code or a cancel elsewhere: re-read.
  useEffect(() => {
    // notifyUnlimitedChanged has no subscribe API of its own for detail readers;
    // useUnlimitedStatus's listeners drive it. We piggyback through a small
    // module listener set below.
    const l = () => setTick(t => t + 1);
    detailListeners.add(l);
    return () => { detailListeners.delete(l); };
  }, []);

  const reload = useCallback(async () => {
    try {
      const d = await readUnlimitedDetail();
      setDetail(d);
    } catch {
      setTick(t => t + 1);
    }
  }, []);

  return { detail: userId ? detail : null, loading: !!userId && detail === null, reload };
}

const detailListeners = new Set<() => void>();

/** Tell every plan reader (yes/no and detail) that the plan changed. */
export function notifyPlanChanged(userId?: string) {
  notifyUnlimitedChanged(userId);
  detailListeners.forEach(l => l());
}

// ── Cancel reasons (the chips, the same wording in /admin) ────────────────

export const CANCEL_REASONS: { id: string; label: string }[] = [
  { id: 'too_expensive', label: 'Too expensive' },
  { id: 'no_conferences_soon', label: 'No conferences coming up' },
  { id: 'missing_feature', label: 'Missing something I need' },
  { id: 'payment_trouble', label: 'Payment trouble' },
  { id: 'just_trying', label: 'Just trying it out' },
  { id: 'other', label: 'Something else' },
];

export function cancelReasonLabel(id: string): string {
  return CANCEL_REASONS.find(r => r.id === id)?.label ?? id;
}

export const CANCEL_NOTE_MAX = 500;

// ── The edge function ─────────────────────────────────────────────────────

export interface ManageResult {
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  plan: string | null;
}

export async function manageSubscription(
  body: { action: 'cancel'; reasons?: string[]; note?: string } | { action: 'resume' },
): Promise<ManageResult> {
  const supabase = await getFreshAuthedClient();
  if (!supabase) throw new UserFacingError('Your session has expired. Refresh the page and sign in again.');
  const { data, error } = await supabase.functions.invoke('manage-subscription', { body });
  if (error) throw new UserFacingError(await extractFunctionErrorMessage(error));
  const r = data as { ok?: boolean; error?: string; status?: Partial<ManageResult> } | null;
  if (!r?.ok) {
    throw new UserFacingError(r?.error || (body.action === 'cancel'
      ? 'Your subscription could not be cancelled just now. Try again in a moment.'
      : 'Your subscription could not be resumed just now. Try again in a moment.'));
  }
  return {
    cancel_at_period_end: r.status?.cancel_at_period_end === true,
    current_period_end: typeof r.status?.current_period_end === 'string' ? r.status.current_period_end : null,
    plan: typeof r.status?.plan === 'string' ? r.status.plan : null,
  };
}

export function manageErrorText(err: unknown, action: 'cancel' | 'resume'): string {
  return friendlyError(err, action === 'cancel'
    ? 'Your subscription could not be cancelled just now. Try again in a moment.'
    : 'Your subscription could not be resumed just now. Try again in a moment.');
}

/** "6 October 2026", in the reader's locale, long form. */
export function formatLongDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  } catch {
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  }
}
