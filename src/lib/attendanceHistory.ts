'use client';

// ============================================================
// src/lib/attendanceHistory.ts
//
// The roll-call history of one session, for the attendance point (owner, 23 Oct 2026:
// a delegation earns attendance when it was Present or Present and voting at ANY point
// of the session, not only at the moment the board is drawn).
//
// The history is `delegate_status_history(p_committee)` (a read; organisers and the
// session's chairs only), the same RPC the organiser's Attendance view and the record
// export read. scoring.ts stays pure: callers turn the rows into a set with
// `everPresentFromHistory` and pass it in `ScoringOptions`. When the read is refused or
// fails the set is null and attendance follows the current status, exactly as before.
//
// Nothing here writes.
// ============================================================

import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sessionClient } from './sessionClient';
import { everPresentFromHistory } from './scoring';
import type { Committee } from './types';

export interface StatusHistoryRow {
  delegate_id?: string;
  country: string;
  status: string;
  is_observer: boolean;
  kind: string;
  at: string;
}

/** The history rows, or null when the read was refused or failed. */
export async function readStatusHistory(client: SupabaseClient | null, committeeId: string): Promise<StatusHistoryRow[] | null> {
  if (!client || !committeeId) return null;
  try {
    const { data, error } = await client.rpc('delegate_status_history', { p_committee: committeeId });
    const d = data as { ok?: boolean; rows?: StatusHistoryRow[] } | null;
    if (error || !d?.ok || !Array.isArray(d.rows)) return null;
    return d.rows;
  } catch {
    return null;
  }
}

/** The chair's read: through the session client with the chair password header. */
export function readSessionStatusHistory(committee: Pick<Committee, 'id' | 'code' | 'dbChairJoinSuffix'>): Promise<StatusHistoryRow[] | null> {
  return readStatusHistory(sessionClient(committee.code, committee.dbChairJoinSuffix ?? undefined), committee.id);
}

/**
 * The delegations ever present in this session, re-read whenever `rosterSig` changes
 * (a status moved). Null until the first read succeeds, and kept on a failed re-read.
 */
export function useEverPresent(
  committeeId: string | null | undefined,
  read: () => Promise<StatusHistoryRow[] | null>,
  rosterSig: string,
  enabled = true,
): Set<string> | null {
  // Tagged with the committee it was read for, so a new committee never shows the old set.
  const [held, setHeld] = useState<{ id: string; set: Set<string> } | null>(null);
  const readRef = useRef(read);
  // Effects run in order, so the read below always calls the newest `read`.
  useEffect(() => { readRef.current = read; });
  useEffect(() => {
    if (!committeeId || !enabled) return;
    let alive = true;
    void readRef.current().then((rows) => {
      if (!alive || !rows) return;
      const next = everPresentFromHistory(rows) ?? new Set<string>();
      setHeld((prev) => (prev && prev.id === committeeId && prev.set.size === next.size && [...next].every((k) => prev.set.has(k))
        ? prev
        : { id: committeeId, set: next }));
    });
    return () => { alive = false; };
  }, [committeeId, rosterSig, enabled]);
  return held && held.id === committeeId ? held.set : null;
}

/** A stable signature of the roster's statuses, for `useEverPresent`. */
export function rosterStatusSig(delegates: ReadonlyArray<{ country: string; status: string }>): string {
  return delegates.map((d) => `${d.country}:${d.status}`).join('|');
}
