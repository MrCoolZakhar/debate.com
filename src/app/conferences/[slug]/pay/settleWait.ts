// settleWait.ts — waiting for the Stripe webhook after a card payment (prompt 95).
//
// The payment is done the moment Stripe says so, but the items only turn paid
// when the webhook settles them a few seconds later. So after completion (in
// the pop-up, or on a ?payment=success return from 3-D Secure) the page asks
// my_pay_overview again every 1.5 s for 30 s, then every 10 s for 2 more
// minutes, until `check` says the items show paid. The same schedule as the
// credits purchase (src/lib/purchaseActivation.ts).

import { useEffect, useRef, useState } from 'react';

export type WaitPhase = 'idle' | 'waiting' | 'slow' | 'done' | 'gave_up';

const FAST_MS = 1500;
const FAST_FOR_MS = 30_000;
const SLOW_MS = 10_000;
const SLOW_FOR_MS = 120_000;

/** Runs while `active`; `check` answers true once the payment shows as paid. */
export function useSettleWait(active: boolean, check: () => Promise<boolean>): WaitPhase {
  const [phase, setPhase] = useState<WaitPhase>('idle');
  const checkRef = useRef(check);
  useEffect(() => { checkRef.current = check; });

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const started = Date.now();
    const tick = async () => {
      if (stopped) return;
      let ok = false;
      try { ok = await checkRef.current(); } catch { ok = false; }
      if (stopped) return;
      if (ok) { setPhase('done'); return; }
      const elapsed = Date.now() - started;
      if (elapsed >= FAST_FOR_MS + SLOW_FOR_MS) { setPhase('gave_up'); return; }
      const slow = elapsed >= FAST_FOR_MS;
      setPhase(slow ? 'slow' : 'waiting');
      timer = setTimeout(() => { void tick(); }, slow ? SLOW_MS : FAST_MS);
    };
    // First answer on a microtask, never synchronously inside the effect.
    void Promise.resolve().then(() => { if (!stopped) setPhase('waiting'); return tick(); });
    return () => { stopped = true; if (timer) clearTimeout(timer); };
  }, [active]);

  return active ? phase : 'idle';
}

export const WAITING_LINE = 'Payment received. Updating your items';
export const SLOW_LINE = 'Your payment went through. It can take a minute to show here; this page will update by itself';
