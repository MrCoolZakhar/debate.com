'use client';
// Manage account, Promo code: "Your gift" (owner, 25 Nov 2026). Every gift of Unlimited the account can still
// activate (my_gifts(): crisis and platform gifts, saved for later or never answered, code not expired or spent),
// one white card each with Activate. Saving a gift from the pop-up hides it there for good, so this is its way back.
// Read once per account; nothing renders while loading or when there is no gift.

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { activateMyGift, fetchMyGifts, giftLength, type OpenGift } from '@/lib/gifts';
import { OUTFIT, T, W } from '../../accountUi';
import { PrimaryButton, WhiteCard, INK, INK_SOFT } from '../manageUi';

export default function YourGifts() {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const [state, setState] = useState<{ uid: string; gifts: OpenGift[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return undefined;
    let off = false;
    void fetchMyGifts().then((gifts) => { if (!off) setState({ uid, gifts }); });
    return () => { off = true; };
  }, [uid]);

  const gifts = state && state.uid === uid ? state.gifts : [];
  if (!gifts.length) return null;

  async function activate(g: OpenGift) {
    if (busy) return;
    setBusy(g.id);
    const r = await activateMyGift(g.id, uid ?? undefined);
    setBusy(null);
    if (!r.ok) { notifyErr(r.message); return; }
    notifyOk(r.message);
    setState((s) => (s ? { uid: s.uid, gifts: s.gifts.filter((x) => x.id !== g.id) } : s));
  }

  return (
    <div className="mb-8 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))' }}>
      {gifts.map((g) => (
        <WhiteCard key={g.id} className="flex flex-col gap-4">
          <div>
            <p style={{ margin: 0, fontFamily: OUTFIT, fontSize: T.section, fontWeight: W.section, color: INK }}>Your Gift</p>
            <p style={{ margin: '6px 0 0', fontFamily: OUTFIT, fontSize: T.body, lineHeight: 1.5, color: INK_SOFT }}>
              {giftLength(g.amount)} of Gavelling Unlimited {g.crisis_id ? 'for trying Gavelling Crisis' : 'from Peter'}
            </p>
            <p style={{ margin: '8px 0 0', fontFamily: 'Menlo, monospace', fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', color: INK }}>{g.code}</p>
          </div>
          <div>
            <PrimaryButton onClick={() => void activate(g)} disabled={busy !== null} height={44}>
              {busy === g.id ? 'Activating' : 'Activate'}
            </PrimaryButton>
          </div>
        </WhiteCard>
      ))}
    </div>
  );
}
