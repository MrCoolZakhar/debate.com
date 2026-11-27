'use client';

// useGuideUnlock — "Unlock this guide · 1 credit" (unlock_guide, yours
// forever). Moved out of PremiumBody (prompt 90) so the guide page's lock card
// and the /guides cards run the SAME flow: a reader short of credits goes to
// the credits pop-up for what is missing, and the unlock runs once by itself
// when the payment completes (consumed exactly once, so a second onComplete
// can never take a second credit).

import { useRef, useState } from 'react';
import { openCreditsPopup } from '@/lib/purchasePopup';
import { refreshCreditsEverywhere } from '@/hooks/useCredits';
import { notifyOk } from '@/lib/appNotify';
import { friendlyError, plainOrFallback } from '@/lib/friendlyError';
import { unlockGuide } from '@/lib/guideAccess';

export function useGuideUnlock(slug: string, onUnlocked: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pendingUnlockRef = useRef(false);
  const unlockRef = useRef<(() => Promise<void>) | null>(null);
  const doneRef = useRef(onUnlocked);
  doneRef.current = onUnlocked;

  const unlock = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const a = await unlockGuide(slug);
      if (a.ok) {
        refreshCreditsEverywhere();
        notifyOk(plainOrFallback(a.message, 'Guide unlocked. It is yours to keep.'), 'guide');
        doneRef.current();
        return;
      }
      if (a.need_credits && a.need_credits > 0) {
        pendingUnlockRef.current = true;
        openCreditsPopup({
          context: 'header',
          preselect: a.need_credits,
          onComplete: () => {
            if (!pendingUnlockRef.current) return;
            pendingUnlockRef.current = false;
            void unlockRef.current?.();
          },
        });
        return;
      }
      setError(plainOrFallback(a.message, 'This guide could not be unlocked just now. Try again in a moment.'));
    } catch (e) {
      setError(friendlyError(e, 'This guide could not be unlocked just now. Try again in a moment.'));
    } finally {
      setBusy(false);
    }
  };
  unlockRef.current = unlock;

  return { unlock, busy, error };
}
