'use client';

// Is the signed-in user on Gavelling Unlimited right now?
//
// The answer comes from the subscriptions table through the RPC
// my_unlimited_status() (a personal unlimited_* plan, active or trialing, not
// past its period end). profiles.unlimited_status is a dead column: nothing
// ever wrote it, so every profile read 'none' while 129 subscriptions were
// live. Never read that column again.
//
// One read per user per page load, shared by every caller (profile menu,
// account layout), re-read at most once a minute.

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getFreshAuthedClient } from '@/lib/supabase-auth';

export type UnlimitedStatus = 'none' | 'trial' | 'monthly' | 'annual';

interface CacheEntry { at: number; value: UnlimitedStatus; pending?: Promise<UnlimitedStatus> }
const cache = new Map<string, CacheEntry>();
const TTL_MS = 60_000;

async function read(userId: string): Promise<UnlimitedStatus> {
  const hit = cache.get(userId);
  if (hit?.pending) return hit.pending;
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const pending = (async () => {
    const client = await getFreshAuthedClient();
    if (!client) return hit?.value ?? 'none';
    const { data, error } = await client.rpc('my_unlimited_status');
    if (error) return hit?.value ?? 'none';
    const s = (data as { status?: string } | null)?.status;
    const value: UnlimitedStatus = s === 'trial' || s === 'monthly' || s === 'annual' ? s : 'none';
    cache.set(userId, { at: Date.now(), value });
    return value;
  })();
  cache.set(userId, { at: hit?.at ?? 0, value: hit?.value ?? 'none', pending });
  try { return await pending; } finally {
    const cur = cache.get(userId);
    if (cur?.pending === pending) cache.set(userId, { at: cur.at, value: cur.value });
  }
}

/** Forget the cached answer (after a checkout or a cancellation). */
export function forgetUnlimitedStatus(userId?: string) {
  if (userId) cache.delete(userId); else cache.clear();
}

// Every mounted reader (profile menu badge, Manage account, the pop-ups)
// re-reads when a purchase, a promo code or a cancellation changes the plan.
const listeners = new Set<() => void>();

/** Forget the cache AND tell every mounted useUnlimitedStatus to re-read. */
export function notifyUnlimitedChanged(userId?: string) {
  forgetUnlimitedStatus(userId);
  listeners.forEach(l => l());
}

/** null while unknown (signed out, or the first read is in flight). */
export function useUnlimitedStatus(): UnlimitedStatus | null {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = useState<{ userId: string | null; value: UnlimitedStatus | null }>({ userId: null, value: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const l = () => setTick(t => t + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    read(userId).then(v => { if (!cancelled) setState({ userId, value: v }); });
    return () => { cancelled = true; };
  }, [userId, tick]);

  return userId && state.userId === userId ? state.value : null;
}

export function isUnlimited(s: UnlimitedStatus | null): boolean {
  return s === 'trial' || s === 'monthly' || s === 'annual';
}
