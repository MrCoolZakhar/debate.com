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

import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError, UserFacingError } from '@/lib/friendlyError';
import { extractFunctionErrorMessage } from '@/lib/payments';
import { fetchUnlimitedDetail, notifyUnlimitedChanged, useUnlimitedDetail, type UnlimitedDetail } from '@/lib/unlimitedStatus';

// The plan object and its hook live in unlimitedStatus.ts, ONE store for every
// reader (26 Sep 2026); re-exported here for the callers that import them from
// this file.
export { useUnlimitedDetail, type UnlimitedDetail };
export const readUnlimitedDetail = fetchUnlimitedDetail;

/** Tell every plan reader (yes/no and detail) that the plan changed. */
export function notifyPlanChanged(userId?: string) {
  notifyUnlimitedChanged(userId);
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
