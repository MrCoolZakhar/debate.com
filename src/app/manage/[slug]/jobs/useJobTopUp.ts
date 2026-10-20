'use client';

// ── Short on credits: close the pop-up, buy, then the SAME call once more ───
//
// A pop-up never opens another pop-up on top of itself, so a posting or
// promotion pop-up that runs short CLOSES first (the draft is already saved)
// and hands the retry to this hook, which lives on the page that stays
// mounted. It opens the credits pop-up preselected to `need_credits`; its
// onComplete runs the same RPC once with p_top_up true (a ref-guarded
// one-shot, as in participant/DelegationCreditsCard.tsx). Nothing is
// optimistic: the toast only follows an ok answer.

import { useCallback, useEffect, useRef } from 'react';
import { openCreditsPopup } from '@/lib/purchasePopup';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { refreshCreditsEverywhere } from '@/hooks/useCredits';
import type { Refusal } from './jobsApi';

type Retry = () => Promise<{ ok: true } | Refusal>;

export interface TopUpRequest {
  need: number;
  /** The same RPC as before, with p_top_up true. */
  retry: Retry;
  /** The toast after it lands ("Your listing is live"). */
  okMessage: (answer: Record<string, unknown>) => string;
  /** Read the panel again. */
  onSettled: () => void;
}

export function useJobTopUp() {
  const pendingRef = useRef<TopUpRequest | null>(null);
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  return useCallback((req: TopUpRequest) => {
    pendingRef.current = req;
    openCreditsPopup({
      context: 'organizer',
      preselect: Math.max(1, Math.trunc(req.need)),
      purpose: 'store',
      onComplete: () => {
        const again = pendingRef.current;
        pendingRef.current = null;
        if (!again || !aliveRef.current) return;
        void again.retry().then((r) => {
          if (!aliveRef.current) return;
          if (r.ok) {
            refreshCreditsEverywhere();
            notifyOk(again.okMessage(r as Record<string, unknown>), 'jobs');
          } else {
            notifyErr(r.message, 'jobs');
          }
          again.onSettled();
        });
      },
    });
  }, []);
}
