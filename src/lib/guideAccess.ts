// guideAccess.ts — who may read a premium guide (25 Sep 2026).
//
// A guide opens with Unlimited OR when the reader bought it for 1 credit,
// forever. `guide_access(p_slug)` (with the caller's JWT) answers
// { signed_in, unlimited, unlocked, can_read }; `unlock_guide(p_slug)` takes
// one credit and answers { ok, unlocked | already | unlimited, message } or
// { ok:false, need_credits:1, balance, message }. The API route asks
// guide_access again server-side; nothing here is the permission.

import { getFreshAuthedClient } from '@/lib/supabase-auth';

export interface GuideAccess {
  signed_in: boolean;
  unlimited: boolean;
  unlocked: boolean;
  can_read: boolean;
}

export async function fetchGuideAccess(slug: string): Promise<GuideAccess | null> {
  try {
    const client = await getFreshAuthedClient();
    if (!client) return { signed_in: false, unlimited: false, unlocked: false, can_read: false };
    const { data, error } = await client.rpc('guide_access', { p_slug: slug });
    if (error || !data) return null;
    const a = data as Record<string, unknown>;
    return {
      signed_in: a.signed_in === true,
      unlimited: a.unlimited === true,
      unlocked: a.unlocked === true,
      can_read: a.can_read === true,
    };
  } catch {
    return null;
  }
}

export type UnlockAnswer =
  | { ok: true; message?: string }
  | { ok: false; need_credits?: number; message?: string };

export async function unlockGuide(slug: string): Promise<UnlockAnswer> {
  const client = await getFreshAuthedClient();
  if (!client) return { ok: false, message: 'Your session has expired. Refresh the page and sign in again.' };
  const { data, error } = await client.rpc('unlock_guide', { p_slug: slug });
  if (error) return { ok: false, message: 'This guide could not be unlocked just now. Try again in a moment.' };
  const a = (data ?? {}) as { ok?: boolean; need_credits?: number; message?: string };
  if (a.ok === true) return { ok: true, message: a.message };
  return { ok: false, need_credits: typeof a.need_credits === 'number' ? a.need_credits : undefined, message: a.message };
}
