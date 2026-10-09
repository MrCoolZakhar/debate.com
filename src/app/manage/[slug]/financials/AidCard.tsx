'use client';

// The Financial Aid card on the Financials dashboard (9 Oct 2026). Financial
// aid left the manage rail and became a Financials sub-page (/financials/aid);
// this card is the way in, like Invoices and Transactions. It reads one
// head-only count, the same one the rail badge uses (requests still pending),
// so nothing but a number crosses the wire. A failed read shows no number
// rather than a wrong one.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { HeartHandshake } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { Big } from '../store/storeKit';
import { DashCard, TINT_GREEN } from './dashboardKit';

export default function AidCard({ conferenceId, slug, enabled }: { conferenceId: string; slug: string; enabled: boolean }) {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const userId = session?.user?.id ?? null;
  const [pending, setPending] = useState<number | null>(null);

  useEffect(() => {
    if (!userId || !token) return;
    let alive = true;
    getAuthedClient(token)
      .from('financial_aid_requests')
      .select('id', { count: 'exact', head: true })
      .eq('conference_id', conferenceId)
      .eq('status', 'pending')
      .then(({ count, error }) => { if (alive) setPending(error ? null : count ?? 0); });
    return () => { alive = false; };
    // Keyed on the user id, never the token (CLAUDE.md §6).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conferenceId, userId]);

  return (
    <DashCard
      title="Financial Aid"
      icon={{ emoji: 'Heart with ribbon', lucide: HeartHandshake, tint: TINT_GREEN }}
      className={pending ? 'gv-fd-todo' : undefined}
      hint="Let participants ask for help paying, with your own questions, then decide each request. Aid reduces what that person owes."
    >
      {enabled || (pending ?? 0) > 0 ? (
        pending === null ? null : <Big n={pending} cap={pending === 1 ? 'request waiting' : 'requests waiting'} />
      ) : (
        <p className="gv-st-quiet" style={{ fontSize: 14 }}>Off. Participants cannot ask for aid yet</p>
      )}
      <div className="gv-fd-foot">
        <Link href={`/manage/${slug}/financials/aid`} className="gv-st-btn gv-st-outline">
          {(pending ?? 0) > 0 ? 'Review requests' : 'Open financial aid'}
        </Link>
      </div>
    </DashCard>
  );
}
