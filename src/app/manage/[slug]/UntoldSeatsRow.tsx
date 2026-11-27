'use client';

// "N delegates never got their allocation": a dashboard warning line.
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
import { AlertTriangle } from 'lucide-react';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useAuth } from '@/components/AuthProvider';
import { NEU, NEU_GRADIENTS, OUTFIT } from '@/components/neu';

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
  // A warning, not a set-up step (prompt 81): it follows the pending steps as
  // one quieter amber line, never in the checklist's order or count.
  return (
    <button
      type="button"
      onClick={open}
      className="flex items-start gap-2 flex-shrink-0 text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
      style={{ padding: '7px 10px', background: 'transparent', border: 'none', cursor: 'pointer', width: '100%' }}
    >
      <AlertTriangle size={15} strokeWidth={2.2} aria-hidden style={{ color: NEU_GRADIENTS.amber[0], flexShrink: 0, marginTop: 1 }} />
      <span className="min-w-0 [overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 600, lineHeight: 1.4, color: NEU.ink }}>
        {count} delegate{count === 1 ? '' : 's'} never got their allocation.{' '}
        <span style={{ fontWeight: 800, color: NEU.deepGold, textDecoration: 'underline', textUnderlineOffset: 2 }}>Send</span>
      </span>
    </button>
  );
}
