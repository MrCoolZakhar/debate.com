'use client';

// The open seats the People table has just changed on screen, before the
// re-read lands (DELEGATIONS_V2_DB only): a seat someone was placed in is
// hidden from the Open seats card and the place list at once, a seat someone
// was taken out of shows there at once. Each change belongs to one operation
// and is dropped when that operation's re-read (or rollback) is done.
// Module-level, per delegation, read through useSyncExternalStore.

import { useSyncExternalStore } from 'react';
import type { OpenSeat } from '../v2';

export type PendingOpenSeat = OpenSeat & { emblem?: string };

interface Entry { op: number; societyId: string; hide?: string; show?: PendingOpenSeat }

let entries: Entry[] = [];
const listeners = new Set<() => void>();
const EMPTY: Entry[] = [];

function emit() { listeners.forEach(l => l()); }

export function addPendingSeats(op: number, societyId: string, change: { hide?: string | null; show?: PendingOpenSeat | null }) {
  const next: Entry[] = [];
  if (change.hide) next.push({ op, societyId, hide: change.hide });
  if (change.show) next.push({ op, societyId, show: change.show });
  if (next.length === 0) return;
  entries = [...entries, ...next];
  emit();
}

export function dropPendingSeats(op: number) {
  if (!entries.some(e => e.op === op)) return;
  entries = entries.filter(e => e.op !== op);
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** The read seats with this delegation's pending changes laid over them. */
export function usePendingOpenSeats(societyId: string | undefined, seats: OpenSeat[] | null): PendingOpenSeat[] | null {
  const all = useSyncExternalStore(subscribe, () => entries, () => EMPTY);
  if (!seats) return seats;
  // Without a delegation (the Open seats card today) every pending change
  // counts: a page draws one leader card.
  const mine = societyId === undefined ? all : all.filter(e => e.societyId === societyId);
  if (mine.length === 0) return seats;
  const hidden = new Set(mine.map(e => e.hide).filter((x): x is string => !!x));
  const shown = mine.map(e => e.show).filter((x): x is PendingOpenSeat => !!x);
  const base = seats.filter(s => !s.allocation_id || !hidden.has(s.allocation_id));
  const extra = shown.filter(x => !base.some(s =>
    (x.allocation_id && s.allocation_id === x.allocation_id)
    || (s.conference_committee_id === x.conference_committee_id && s.country_code === x.country_code && s.country_name === x.country_name)));
  return [...base, ...extra];
}
