'use client';

// purchaseActivation.ts — what a payment is waiting on (26 Sep 2026).
//
// A payment completes before the Stripe webhook writes what it bought, so
// the plan (waitForUnlimited in unlimitedStatus.ts) and the credit balance
// (pollCreditsUntilChanged in useCredits.ts) are polled until it lands. This
// tiny store publishes which one is being waited on and whether it is taking
// longer than usual, for <PurchaseActivationNotice /> (mounted once by
// PurchasePopupHost).

import { useEffect, useState } from 'react';

export type ActivationKind = 'unlimited' | 'credits';
export type ActivationPhase = 'activating' | 'slow';
export interface Activation { kind: ActivationKind; phase: ActivationPhase }

let current: Activation | null = null;
const listeners = new Set<(a: Activation | null) => void>();

export function setActivation(a: Activation | null) {
  current = a;
  listeners.forEach(l => l(a));
}

export function clearActivation(kind: ActivationKind) {
  if (current?.kind === kind) setActivation(null);
}

export function useActivation(): Activation | null {
  const [a, setA] = useState<Activation | null>(current);
  useEffect(() => {
    listeners.add(setA);
    return () => { listeners.delete(setA); };
  }, []);
  return a;
}

/** The fast-then-slow schedule both pollers use: every 1.5 s for 30 s, then
 *  every 10 s for 2 more minutes. `check` answers true when the thing landed. */
export async function pollWithSchedule(kind: ActivationKind, check: () => Promise<boolean>): Promise<boolean> {
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
  setActivation({ kind, phase: 'activating' });
  try {
    const fastUntil = Date.now() + 30_000;
    while (Date.now() < fastUntil) {
      if (await check()) return true;
      await sleep(1500);
    }
    setActivation({ kind, phase: 'slow' });
    const slowUntil = Date.now() + 120_000;
    while (Date.now() < slowUntil) {
      await sleep(10_000);
      if (await check()) return true;
    }
    return false;
  } finally {
    clearActivation(kind);
  }
}
