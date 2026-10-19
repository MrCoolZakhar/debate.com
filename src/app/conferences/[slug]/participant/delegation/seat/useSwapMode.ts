'use client';

// The conference's allocation_swap_mode for the People table's drag:
// 'self_serve' (leaders switch seats themselves), 'request' (a switch is a
// request to the organisers) or 'off'. DelegationPanel already holds it; until
// LeaderCard passes it down, the table reads the one column itself, once per
// conference. Unknown counts as 'off', so nothing is offered before it is read.

import { useEffect, useState } from 'react';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import type { SwapMode } from './seatWrites';

function asMode(v: unknown): SwapMode {
  return v === 'self_serve' || v === 'request' ? v : 'off';
}

export function useSwapMode(conferenceId: string, given: string | undefined): SwapMode {
  const [read, setRead] = useState<{ conferenceId: string; mode: SwapMode } | null>(null);
  const needRead = given === undefined;
  useEffect(() => {
    if (!needRead || !conferenceId) return;
    let cancelled = false;
    void (async () => {
      try {
        const c = await getFreshAuthedClient();
        if (!c) return;
        const { data } = await c.from('conferences').select('allocation_swap_mode').eq('id', conferenceId).maybeSingle();
        if (cancelled) return;
        setRead({ conferenceId, mode: asMode((data as { allocation_swap_mode?: string | null } | null)?.allocation_swap_mode) });
      } catch {
        // Stays 'off': nothing is offered that could not be honoured.
      }
    })();
    return () => { cancelled = true; };
  }, [needRead, conferenceId]);
  if (!needRead) return asMode(given);
  return read?.conferenceId === conferenceId ? read.mode : 'off';
}
