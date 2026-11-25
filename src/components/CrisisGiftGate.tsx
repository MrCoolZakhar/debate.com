'use client';
// The crisis thank-you gift on every Gavelling page (owner, 22 Nov 2026; docs/crisis/sql/056). A signed-in account with an
// unanswered voucher in crisis_gifts (my_open_crisis_gift) gets the same scratch-off pop-up the crisis shows, on any page,
// once the sign-up gates are done. ONE read per account per page visit, keyed on the user id. Never on the crisis
// (it has its own), the session runtimes, auth, apply or pay paths, or over another dialog.
// Platform gifts (crisis_id null, admin_gift_unlimited; owner, 25 Nov 2026) use the same card with no crisis wording.

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useBasicsGateBlocking } from '@/lib/basicsGateState';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { activateMyGift, giftLength, parseGift, type OpenGift } from '@/lib/gifts';
import { isLiveRoomsExcludedPath } from '@/components/liveRooms/LiveRoomsGate';

const GiftCard = dynamic(() => import('@/app/crisis/components/delegate/GiftPrompt').then((m) => m.GiftCard), { ssr: false });

export default function CrisisGiftGate() {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const pathname = usePathname();
  const blocking = useBasicsGateBlocking();
  const excluded = !pathname || pathname.startsWith('/crisis') || isLiveRoomsExcludedPath(pathname);
  const [gift, setGift] = useState<{ uid: string; g: OpenGift | null } | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!uid || excluded || (gift && gift.uid === uid)) return undefined;
    let off = false;
    void (async () => {
      try {
        const client = await getFreshAuthedClient();
        if (!client) return;
        const res = await client.rpc('my_open_crisis_gift');
        if (!off) setGift({ uid, g: res.error ? null : parseGift(res.data) });
      } catch { /* no gift this visit */ }
    })();
    return () => { off = true; };
  }, [uid, excluded, gift]);

  const g = gift && gift.uid === uid ? gift.g : null;

  const activate = useCallback(async () => {
    if (!g) return false;
    const r = await activateMyGift(g.id, uid ?? undefined);
    if (!r.ok) { notifyErr(r.message); return false; }
    notifyOk(r.message);
    setDone(true);
    return true;
  }, [g, uid]);

  const later = useCallback(() => {
    setDone(true);
    notifyOk('Saved. Activate it any time on Manage account, Promo code');
    if (!g) return;
    void (async () => {
      try { const client = await getFreshAuthedClient(); await client?.rpc('save_my_crisis_gift', { p_gift: g.id }); } catch { /* shows again next visit */ }
    })();
  }, [g]);

  if (!g || done || excluded || blocking) return null;
  const length = giftLength(g.amount);
  return (
    <GiftCard
      code={g.code}
      activate={activate}
      onLater={later}
      platform={g.crisis_id ? undefined : { headline: `A gift from Peter: ${length} of Gavelling Unlimited`, length }}
    />
  );
}
