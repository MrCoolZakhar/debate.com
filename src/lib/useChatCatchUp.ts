'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Committee } from './types';
import { getMessagesList } from './committeeService';
import { mergeMessagesById } from './chatConversations';
import { reconcileOutbox } from './chatOutbox';

type CommitteeSetter = Dispatch<SetStateAction<Committee | null>>;

/**
 * Fetch the committee's messages and merge them monotonically into local state (RC2/RC3).
 *
 * Union-by-id, never replace: two catch-ups racing each other can only ever ADD rows, so a
 * slow response that resolves last can no longer delete a just-arrived message.
 *
 * Merges the FULL row set including `__system__` / `__log__:` rows — scoring.ts,
 * FeedbackLogPanel and the delegate stats tab read those out of committee.messages.
 */
export async function catchUpMessages(committeeId: string, setCommittee: CommitteeSetter): Promise<void> {
  const fetched = await getMessagesList(committeeId);
  setCommittee((prev) => {
    if (!prev) return prev;
    const merged = mergeMessagesById(prev.messages, fetched);
    return merged === prev.messages ? prev : { ...prev, messages: merged };
  });
  // Rows that landed while chat was closed still need to retire their outbox bubbles,
  // otherwise a delegate who backgrounded the app sees "Sending…" forever.
  reconcileOutbox(committeeId, fetched);
}

/**
 * Catch chat up after any gap in realtime delivery.
 *
 * Supabase Realtime does not replay events missed while the socket was down, which is the
 * NORMAL case for a backgrounded phone: messages received during the gap are never fetched,
 * and the sender's own echo never arrives. This runs a catch-up merge when the tab becomes
 * visible again and when the browser reports it is back online. The caller additionally
 * wires `onReSubscribed` into subscribeToCommittee's status callback.
 */
export function useChatCatchUp(committeeId: string | undefined, setCommittee: CommitteeSetter): void {
  const setterRef = useRef(setCommittee);
  setterRef.current = setCommittee;

  useEffect(() => {
    if (!committeeId) return;
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      catchUpMessages(committeeId, setterRef.current).catch((e) => console.error('chat catch-up failed:', e));
    };
    const onVisible = () => { if (document.visibilityState === 'visible') run(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', run);
    window.addEventListener('focus', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', run);
      window.removeEventListener('focus', onVisible);
    };
  }, [committeeId]);
}

/**
 * Status handler for subscribeToCommittee: runs a catch-up on every re-SUBSCRIBED after the
 * first, i.e. whenever the channel recovered from CHANNEL_ERROR / TIMED_OUT / CLOSED.
 * Returns a stable callback; the first SUBSCRIBED is skipped because the initial load already
 * fetched everything.
 */
export function useReSubscribeCatchUp(setCommittee: CommitteeSetter) {
  const setterRef = useRef(setCommittee);
  setterRef.current = setCommittee;
  const seenFirstRef = useRef(false);

  return useCallback((committeeId: string, status: string) => {
    if (status !== 'SUBSCRIBED') return;
    if (!seenFirstRef.current) { seenFirstRef.current = true; return; }
    catchUpMessages(committeeId, setterRef.current).catch((e) => console.error('chat catch-up failed:', e));
  }, []);
}
