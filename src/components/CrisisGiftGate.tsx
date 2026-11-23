'use client';
// The crisis thank-you gift on every Gavelling page (owner, 22 Nov 2026; docs/crisis/sql/056). A signed-in account with an
// unanswered voucher in crisis_gifts (my_open_crisis_gift) gets the same scratch-off pop-up the crisis shows, on any page,
// once the sign-up gates are done. ONE read per account per page visit, keyed on the user id. Never on the crisis
// (it has its own), the session runtimes, auth, apply or pay paths, or over another dialog.

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useBasicsGateBlocking } from '@/lib/basicsGateState';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { isLiveRoomsExcludedPath } from '@/components/liveRooms/LiveRoomsGate';

const GiftCard = dynamic(() => import('@/app/crisis/components/delegate/GiftPrompt').then((m) => m.GiftCard), { ssr: false });

interface OpenGift { id: string; code: string }

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
        if (!off) setGift({ uid, g: res.error ? null : ((res.data as OpenGift | null) ?? null) });
      } catch { /* no gift this visit */ }
    })();
    return () => { off = true; };
  }, [uid, excluded, gift]);

  const g = gift && gift.uid === uid ? gift.g : null;

  const activate = useCallback(async () => {
    if (!g) return false;
    try {
      const client = await getFreshAuthedClient();
      if (!client) { notifyErr('Sign in to activate your gift.'); return false; }
      const res = await client.rpc('activate_my_crisis_gift', { p_gift: g.id });
      const r = res.data as { ok?: boolean; message?: string } | null;
      if (res.error || !r?.ok) { notifyErr(r?.message ?? 'Could not activate your voucher. Try again.'); return false; }
      notifyOk('Activated. Enjoy two months of Unlimited');
      setDone(true);
      return true;
    } catch { notifyErr('Could not activate your voucher. Try again.'); return false; }
  }, [g]);

  const later = useCallback(() => {
    setDone(true);
    notifyOk('Saved. Activate it any time on Manage account, Promo code');
    if (!g) return;
    void (async () => {
      try { const client = await getFreshAuthedClient(); await client?.rpc('save_my_crisis_gift', { p_gift: g.id }); } catch { /* shows again next visit */ }
    })();
  }, [g]);

  if (!g || done || excluded || blocking) return null;
  return <GiftCard code={g.code} activate={activate} onLater={later} />;
}
