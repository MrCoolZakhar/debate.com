'use client';

// Is the signed-in user on Gavelling Unlimited right now, and the rest of the
// plan: ONE store for every reader (26 Sep 2026).
//
// The answer comes from the subscriptions table through the RPC
// my_unlimited_status() (a personal unlimited_* plan, active or trialing, not
// past its period end). profiles.unlimited_status is a dead column: nothing
// ever wrote it, so every profile read 'none' while 129 subscriptions were
// live. Never read that column again.
//
// Before this, the yes/no readers (the profile menu badge, the account rail)
// and the detail reader (Manage account → Subscription) kept separate caches
// and separate listeners, and a purchase refreshed only the first kind: the
// owner paid, the rail said Unlimited and the page beside it said Free until
// a reload. Now the WHOLE object is cached once per user, useUnlimitedStatus()
// and useUnlimitedDetail() both read it, and notifyUnlimitedChanged() (alias
// notifyPlanChanged in subscriptionManage.ts) re-reads it for every reader at
// once. After a payment, waitForUnlimited() polls until the webhook's row
// lands (see below).

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { pollWithSchedule } from '@/lib/purchaseActivation';

export type UnlimitedStatus = 'none' | 'trial' | 'monthly' | 'annual';

export interface UnlimitedDetail {
  status: UnlimitedStatus;
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

export const NO_PLAN: UnlimitedDetail = {
  status: 'none', plan: null, current_period_end: null, on_stripe: false, renews: false,
  cancel_at_period_end: false, can_cancel: false, can_resume: false, lapsed_plan: null, lapsed_at: null,
};

export function parseUnlimitedDetail(data: unknown): UnlimitedDetail {
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

/** One fresh read, no cache. Throws on an RPC error. */
export async function fetchUnlimitedDetail(): Promise<UnlimitedDetail> {
  const client = await getFreshAuthedClient();
  if (!client) return NO_PLAN;
  const { data, error } = await client.rpc('my_unlimited_status');
  if (error) throw error;
  return parseUnlimitedDetail(data);
}

interface CacheEntry { at: number; value: UnlimitedDetail | null; pending?: Promise<UnlimitedDetail> }
const cache = new Map<string, CacheEntry>();
const TTL_MS = 60_000;

async function read(userId: string): Promise<UnlimitedDetail> {
  const hit = cache.get(userId);
  if (hit?.pending) return hit.pending;
  if (hit?.value && Date.now() - hit.at < TTL_MS) return hit.value;
  const pending = (async () => {
    try {
      const value = await fetchUnlimitedDetail();
      cache.set(userId, { at: Date.now(), value });
      return value;
    } catch {
      return hit?.value ?? NO_PLAN;
    }
  })();
  cache.set(userId, { at: hit?.at ?? 0, value: hit?.value ?? null, pending });
  try { return await pending; } finally {
    const cur = cache.get(userId);
    if (cur?.pending === pending) cache.set(userId, { at: cur.at, value: cur.value });
  }
}

/** Forget the cached answer (after a checkout or a cancellation). */
export function forgetUnlimitedStatus(userId?: string) {
  if (userId) cache.delete(userId); else cache.clear();
}

// Every mounted reader (profile menu badge, the account rail, Manage account,
// the pop-ups, premium guides) re-reads when the plan may have changed.
const listeners = new Set<() => void>();

/** Subscribe to plan changes (for readers outside these hooks). */
export function onPlanChanged(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** Forget the cache AND tell every mounted plan reader to re-read. */
export function notifyUnlimitedChanged(userId?: string) {
  forgetUnlimitedStatus(userId);
  listeners.forEach(l => l());
}

/** The whole status object; null while loading or signed out. */
export function useUnlimitedDetail(): { detail: UnlimitedDetail | null; loading: boolean; reload: () => Promise<void> } {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = useState<{ userId: string | null; value: UnlimitedDetail | null }>({ userId: null, value: null });
  const [tick, setTick] = useState(0);

  useEffect(() => onPlanChanged(() => setTick(t => t + 1)), []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void read(userId).then(v => { if (!cancelled) setState({ userId, value: v }); });
    return () => { cancelled = true; };
  }, [userId, tick]);

  // A reload refreshes EVERY reader, never this one alone.
  const reload = useCallback(async () => {
    notifyUnlimitedChanged(userId ?? undefined);
  }, [userId]);

  const detail = userId && state.userId === userId ? state.value : null;
  return { detail, loading: !!userId && detail === null, reload };
}

/** null while unknown (signed out, or the first read is in flight). */
export function useUnlimitedStatus(): UnlimitedStatus | null {
  return useUnlimitedDetail().detail?.status ?? null;
}

export function isUnlimited(s: UnlimitedStatus | null): boolean {
  return s === 'trial' || s === 'monthly' || s === 'annual';
}

// ── After a payment ──────────────────────────────────────────────────────
// The subscription row is written by the Stripe webhook a few seconds after
// the payment, so one read right after checkout can miss it. Poll every 1.5 s
// for up to 30 s until the plan is no longer what it was (usually 'none'),
// then notify every reader at once; past 30 s the notice says it can take a
// minute and checking goes on every 10 s for 2 more minutes
// (pollWithSchedule in purchaseActivation.ts).

let running: Promise<boolean> | null = null;

/** Resolves true once the new plan is visible (every reader notified), false if it never showed. */
export function waitForUnlimited(userId: string | undefined, before: UnlimitedStatus | null = 'none'): Promise<boolean> {
  if (running) return running;
  running = (async () => {
    try {
      const landed = await pollWithSchedule('unlimited', async () => {
        try {
          const d = await fetchUnlimitedDetail();
          return d.status !== (before ?? 'none');
        } catch { return false; }
      });
      return landed;
    } finally {
      // Landed or not, every reader re-reads now.
      notifyUnlimitedChanged(userId);
      running = null;
    }
  })();
  return running;
}
