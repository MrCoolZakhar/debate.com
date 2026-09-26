'use client';

// "N seated delegates were never told their seat": a dashboard to-do row.
//
// A delegate seated while allocation emails were off (or on manual release and
// never released) sits in conference_allocations with allocation_sent = false.
// SISMUN (23 Sep 2026) had 138 of them while the Assignment bar read "Sending
// automatically". This row counts them and its Send action opens the EXISTING
// release flow on Assignment (the custom picker, everyone unsent ticked). It
// never sends anything itself.
//
// Its own head-only count query, so the dashboard's data loaders are untouched
// and nothing but a number crosses the wire. Renders nothing at zero.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useAuth } from '@/components/AuthProvider';
import { NeuChecklistRow, NEU, NEU_GRADIENTS, OUTFIT } from '@/components/neu';

export default function UntoldSeatsRow({ conferenceId, slug }: { conferenceId: string; slug: string }) {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const router = useRouter();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      // EXACTLY the Assignment picker's targets (allocationTargets in
      // assignment/page.tsx): seats of this conference's committees, reached
      // through the committee, that belong to an application, not yet sent.
      // Same rows, so SEND opens with these people ticked and the row clears
      // once their emails are queued.
      const { count: n, error } = await getAuthedClient(token)
        .from('conference_allocations')
        .select('id, conference_committees!inner(conference_id)', { count: 'exact', head: true })
        .eq('conference_committees.conference_id', conferenceId)
        .not('application_id', 'is', null)
        .eq('allocation_sent', false);
      if (!cancelled && !error) setCount(n ?? 0);
    })();
    return () => { cancelled = true; };
  }, [conferenceId, token]);

  if (count === 0) return null;
  const open = () => router.push(`/manage/${slug}/assignment?release=unsent`);
  return (
    <div className="flex-shrink-0">
      <NeuChecklistRow
        done={false}
        icon={Send}
        emoji="Envelope with arrow"
        gradient={NEU_GRADIENTS.amber}
        title={`${count} seated delegate${count === 1 ? ' was' : 's were'} never told their seat`}
        sub="They have a committee and country but no allocation email yet."
        onClick={open}
        action={(
          <button
            onClick={(e) => { e.stopPropagation(); open(); }}
            className="focus:outline-none"
            style={{
              fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800,
              color: NEU.deepGold, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
            }}
          >
            Send
          </button>
        )}
        dense
      />
    </div>
  );
}
