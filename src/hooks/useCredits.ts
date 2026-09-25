'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient, getFreshAuthedClient } from '@/lib/supabase-auth';

// ── One balance, many readers ────────────────────────────────────────────────
// The header counter, the profile menu row, the pop-up's "Your credits" and
// Manage account all read the same number through this hook. A purchase or a
// promo code changes it in ONE place, so `refreshCreditsEverywhere()` tells
// every mounted reader to re-read at once, instead of each page keeping a
// private copy that goes stale until a reload.

const listeners = new Set<() => void>();

export function refreshCreditsEverywhere(): void {
  listeners.forEach((l) => l());
}

/** Reads the balance fresh, off the SDK's current token (never a captured one). */
export async function readCreditBalance(): Promise<number | null> {
  const client = await getFreshAuthedClient();
  if (!client) return null;
  const { data, error } = await client.rpc('credit_balance');
  return !error && typeof data === 'number' ? data : null;
}

/**
 * After a payment: the webhook that grants the credits lands a few seconds
 * later, so poll until the balance moves off `previous` (every 2 s, ~20 s),
 * then refresh every reader. Gives up quietly: the credits still arrive, the
 * next read simply shows them. Resolves with the new balance, or null.
 */
export async function pollCreditsUntilChanged(previous: number | null, opts: { attempts?: number; intervalMs?: number } = {}): Promise<number | null> {
  const attempts = opts.attempts ?? 10;
  const intervalMs = opts.intervalMs ?? 2000;
  for (let i = 0; i < attempts; i++) {
    const now = await readCreditBalance();
    if (now !== null && now !== previous) {
      refreshCreditsEverywhere();
      return now;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  refreshCreditsEverywhere();
  return null;
}

export function useCredits() {
  const { user, session } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user || !session) {
      setBalance(null);
      return;
    }
    setLoading(true);
    const supabase = getAuthedClient(session.access_token);
    const { data, error } = await supabase.rpc('credit_balance');
    if (!error && typeof data === 'number') {
      setBalance(data);
    }
    setLoading(false);
  }, [user, session]);

  useEffect(() => {
    const id = setTimeout(refresh, 0);
    return () => clearTimeout(id);
  }, [refresh]);

  // Re-read when any purchase, refund or promo code says the number moved.
  useEffect(() => {
    const l = () => { void refresh(); };
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, [refresh]);

  return { balance, loading, refresh };
}
