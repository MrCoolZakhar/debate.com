'use client';
// Gifts of Unlimited (crisis_gifts): crisis thank-you gifts and platform gifts (crisis_id null, admin_gift_unlimited;
// owner, 25 Nov 2026, scratch-platform-gifts.sql). The pop-up is src/components/CrisisGiftGate.tsx, the saved ones
// come back on Manage account, Promo code (account/manage/promo/YourGifts.tsx). The database words the email the same
// way as giftLength: 60 days is 2 months, 30 is 1 month, anything else is days.

import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { notifyUnlimitedChanged } from '@/lib/unlimitedStatus';

export interface OpenGift { id: string; code: string; crisis_id: string | null; amount: number | null; saved?: boolean }

export function parseGift(raw: unknown): OpenGift | null {
  const a = (raw ?? null) as Record<string, unknown> | null;
  if (!a || typeof a.id !== 'string' || typeof a.code !== 'string') return null;
  return {
    id: a.id,
    code: a.code,
    crisis_id: typeof a.crisis_id === 'string' ? a.crisis_id : null,
    amount: typeof a.amount === 'number' ? a.amount : null,
    saved: a.saved === true,
  };
}

/** "2 months", "1 month", "45 days". */
export function giftLength(days: number | null): string {
  const d = days && days > 0 ? days : 60;
  if (d % 30 === 0) return d === 30 ? '1 month' : `${d / 30} months`;
  return d === 1 ? '1 day' : `${d} days`;
}

/** "25 January 2027". */
export function formatUntil(iso: string): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return '';
  return t.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Activate a gift. On success the message is "Unlimited until {date}" and every plan reader re-reads. */
export async function activateMyGift(giftId: string, userId?: string): Promise<{ ok: boolean; message: string }> {
  const fail = 'Could not activate your voucher. Try again.';
  try {
    const client = await getFreshAuthedClient();
    if (!client) return { ok: false, message: 'Sign in to activate your gift.' };
    const res = await client.rpc('activate_my_crisis_gift', { p_gift: giftId });
    const r = res.data as { ok?: boolean; message?: string; until?: string } | null;
    if (res.error || !r?.ok) return { ok: false, message: r?.message ?? fail };
    notifyUnlimitedChanged(userId);
    const until = r.until ? formatUntil(r.until) : '';
    return { ok: true, message: until ? `Unlimited until ${until}` : 'Activated. Enjoy Gavelling Unlimited' };
  } catch {
    return { ok: false, message: fail };
  }
}

/** Every gift the signed-in account can still activate, saved or not. */
export async function fetchMyGifts(): Promise<OpenGift[]> {
  const client = await getFreshAuthedClient();
  if (!client) return [];
  const res = await client.rpc('my_gifts');
  if (res.error || !Array.isArray(res.data)) return [];
  return (res.data as unknown[]).map(parseGift).filter((g): g is OpenGift => !!g);
}
