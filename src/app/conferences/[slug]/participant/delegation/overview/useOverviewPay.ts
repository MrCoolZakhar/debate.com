'use client';

// A leader's own payments for the Overview's "Your Delegation" (owner, 21 Oct
// 2026: "what is paid / owed for the leader, same numbers as the Financials
// card"). The SAME read the leader card's FinancialsCard makes:
// my_pay_overview through readPayOverview (the /pay read, the caller's own
// items only). Leaders only; null for everyone else, before the first answer,
// and after a failed first read (the block is then left out, never an error
// in the Overview). Re-read in place on every landed change on the leader card.

import { useCallback, useEffect, useState } from 'react';
import { readPayOverview, type PayOverview } from '../../../pay/payApi';
import { DELEGATION_CHANGED_EVENT } from '../delegationEvents';

export function useOverviewPay(conferenceId: string, leader: boolean): PayOverview | null {
  const [pay, setPay] = useState<PayOverview | null>(null);

  const reload = useCallback(async () => {
    if (!leader) return;
    try {
      setPay(await readPayOverview(conferenceId));
    } catch {
      // A failed re-read keeps what is shown.
    }
  }, [conferenceId, leader]);

  useEffect(() => { void Promise.resolve().then(reload); }, [reload]);

  useEffect(() => {
    if (!leader) return;
    const again = () => { void reload(); };
    window.addEventListener(DELEGATION_CHANGED_EVENT, again);
    return () => window.removeEventListener(DELEGATION_CHANGED_EVENT, again);
  }, [leader, reload]);

  return leader ? pay : null;
}
