'use client';

// Credits card for a delegation leader (faculty advisor / head delegate) on
// the pay page. Credits are always the signed-in person's OWN balance: the
// applications they file for their delegation spend from it like any other.
// Buying opens the global credits pop-up (src/lib/purchasePopup.ts), which
// takes the payment in place and refreshes every useCredits() reader.
//
// Older delegations may still hold a society pool (society_credit_balance);
// those credits are spent first, so the card says so when there are any.

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useCredits } from '@/hooks/useCredits';
import { openCreditsPopup } from '@/lib/purchasePopup';
import { SectionCard, OUTFIT } from './shared';

export default function DelegationCreditsCard({ societyId }: { societyId: string }) {
  const { session } = useAuth();
  const { balance, loading } = useCredits();

  const [poolBalance, setPoolBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    getAuthedClient(session.access_token)
      .rpc('society_credit_balance', { p_society: societyId })
      .then(({ data }) => {
        if (cancelled) return;
        setPoolBalance(typeof data === 'number' ? data : null);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [societyId, session?.access_token]);

  return (
    <SectionCard>
      <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: '9px', letterSpacing: '0.14em', color: '#B6871F', margin: '0 0 12px 0' }}>
        YOUR CREDITS
      </p>

      <p className="font-black text-2xl mb-1" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
        {loading || balance === null ? '…' : balance}
      </p>
      <p className="text-xs mb-4" style={{ color: '#6B5D4E', fontFamily: OUTFIT, lineHeight: 1.6 }}>
        Credits are yours to spend on any application, including the ones you file for your delegation.
      </p>

      {poolBalance !== null && poolBalance > 0 && (
        <p className="text-xs mb-4" style={{ color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.6 }}>
          Your delegation pool still holds {poolBalance} credit{poolBalance === 1 ? '' : 's'}; they are used first.
        </p>
      )}

      <button
        type="button"
        onClick={() => openCreditsPopup({ context: 'pay' })}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-bold text-sm transition-colors focus:outline-none"
        style={{
          backgroundColor: '#1B3828',
          color: '#EED98A',
          fontFamily: OUTFIT, letterSpacing: '0.06em', border: 'none', cursor: 'pointer',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
      >
        BUY CREDITS
      </button>
    </SectionCard>
  );
}
