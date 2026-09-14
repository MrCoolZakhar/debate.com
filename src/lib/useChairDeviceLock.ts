'use client';

// ── useChairDeviceLock ────────────────────────────────────────────────────────
// One device per signed-in account per session, on /chair/[code] and /voting/[code].
// Contract and RPCs: src/lib/chairDeviceClaims.ts.
//
//   • On load (enabled + signed in) the page claims WITH takeover: opening the page is a
//     deliberate choice to chair from here, so the newest device wins. When that moved
//     the claim ('claimed'), it broadcasts `taken` on `chair-device-<committeeId>`.
//   • Every other check is WITHOUT takeover and can only ever report 'other_device':
//     the realtime `taken` signal (instant), the 30 s re-verify, the tab becoming
//     visible, the browser coming back online and the channel re-subscribing. So an
//     asleep device learns on wake, and two devices can never ping-pong.
//   • The realtime payload is only a HINT: { u: tag of the user id, d: tag of the device
//     token }. A receiver with the same account and a different device asks the server
//     before it believes it, so a forged broadcast costs one RPC and kicks nobody.
//   • `takeBack()` (the "Use this device instead" tap) is the ONLY way a kicked device
//     claims again. It broadcasts too, so the other device gets the same modal.
//   • A network or RPC error never kicks anyone.
//
// Nothing here touches committee state, updateLocal or localUpdateTime (RULES 3 and 4),
// and the only per-interval work is one RPC every 30 s.

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getGavelDeviceId } from '@/lib/gavelDevice';
import { claimChairDevice, shortTag } from '@/lib/chairDeviceClaims';

const REVERIFY_MS = 30_000;

export interface ChairDeviceLock {
  /** Another device of this account holds the committee: render the kick modal and nothing else. */
  kicked: boolean;
  /** Move the claim back to this device. Resolves true when it worked. */
  takeBack: () => Promise<boolean>;
}

export function useChairDeviceLock(opts: {
  code: string;
  committeeId: string | null | undefined;
  userId: string | null | undefined;
  accessToken: string | null | undefined;
  /** Access verified, committee loaded, session not ended. */
  enabled: boolean;
}): ChairDeviceLock {
  const { code, committeeId, userId, enabled } = opts;
  // Kicked FOR a key (account + committee), so a different account or committee starts
  // clean without a reset effect.
  const lockKey = `${userId ?? ''}|${committeeId ?? ''}|${code}`;
  const [kickedKey, setKickedKey] = useState<string | null>(null);
  const kicked = kickedKey === lockKey;
  const kickedRef = useRef(false);
  useEffect(() => { kickedRef.current = kicked; }, [kicked]);
  // The access token refreshes hourly; read it through a ref so a refresh never re-runs
  // the load claim.
  const tokenRef = useRef(opts.accessToken ?? null);
  useEffect(() => { tokenRef.current = opts.accessToken ?? null; }, [opts.accessToken]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const subscribedRef = useRef(false);
  const pendingSendRef = useRef(false);
  const tagsRef = useRef<{ u: string; d: string } | null>(null);
  // Until one claim WITH takeover has succeeded, this device never claimed at all, so a
  // retry must take over too; otherwise a failed first claim would read as "kicked".
  const claimedOnceRef = useRef(false);

  const active = enabled && !!userId && !!committeeId && !!code;

  const sendTaken = useCallback(() => {
    const ch = channelRef.current;
    const tags = tagsRef.current;
    if (!ch || !tags || !subscribedRef.current) { pendingSendRef.current = true; return; }
    pendingSendRef.current = false;
    ch.send({ type: 'broadcast', event: 'taken', payload: { u: tags.u, d: tags.d, at: Date.now() } }).catch(() => {});
  }, []);

  const check = useCallback(async (takeover: boolean, key: string) => {
    const token = tokenRef.current;
    if (!token) return;
    const wantTakeover = takeover || !claimedOnceRef.current;
    const res = await claimChairDevice(code, token, wantTakeover);
    if (res.reason === 'claimed' || res.reason === 'mine') {
      claimedOnceRef.current = true;
      if (res.reason === 'claimed') sendTaken();
    } else if (res.reason === 'other_device' && !wantTakeover) {
      kickedRef.current = true;
      setKickedKey(key);
    }
    // anonymous / not_found / no_token / error: enforce nothing.
  }, [code, sendTaken]);

  useEffect(() => {
    if (!active || !committeeId || !userId) return;
    let alive = true;
    // A new account or committee has not claimed anything yet.
    claimedOnceRef.current = false;
    kickedRef.current = false;
    const deviceId = getGavelDeviceId(code);
    Promise.all([shortTag(userId), shortTag(deviceId)]).then(([u, d]) => {
      if (!alive) return;
      tagsRef.current = { u, d };
      if (pendingSendRef.current) sendTaken();
    });

    const ch = supabase.channel(`chair-device-${committeeId}`);
    channelRef.current = ch;
    ch.on('broadcast', { event: 'taken' }, ({ payload }) => {
      const tags = tagsRef.current;
      const p = payload as { u?: string; d?: string } | undefined;
      if (!tags || !p || p.u !== tags.u || p.d === tags.d) return;
      if (kickedRef.current) return;
      check(false, lockKey);
    });
    let everSubscribed = false;
    ch.subscribe((status) => {
      if (!alive) return;
      subscribedRef.current = status === 'SUBSCRIBED';
      if (status !== 'SUBSCRIBED') return;
      if (pendingSendRef.current) sendTaken();
      // A re-subscribe means we may have missed the signal while disconnected.
      if (everSubscribed && !kickedRef.current) check(false, lockKey);
      everSubscribed = true;
    });

    // The load claim: newest device wins. Deferred a microtask so no state is set from the
    // effect body itself.
    void Promise.resolve().then(() => { if (alive) check(true, lockKey); });

    const reverify = () => { if (alive && !kickedRef.current) check(false, lockKey); };
    const id = setInterval(reverify, REVERIFY_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') reverify(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', reverify);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', reverify);
      subscribedRef.current = false;
      channelRef.current = null;
      supabase.removeChannel(ch);
    };
  }, [active, code, committeeId, userId, lockKey, check, sendTaken]);

  const takeBack = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) return false;
    const res = await claimChairDevice(code, token, true);
    if (res.reason === 'claimed' || res.reason === 'mine' || res.reason === 'anonymous') {
      claimedOnceRef.current = true;
      kickedRef.current = false;
      setKickedKey(null);
      if (res.reason === 'claimed') sendTaken();
      return true;
    }
    return false;
  }, [code, sendTaken]);

  return { kicked: active && kicked, takeBack };
}
