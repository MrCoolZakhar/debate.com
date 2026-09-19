/**
 * Motions that are "in flight", kept OUTSIDE MotionsModal (audit M-1, M-2).
 *
 * MotionsModal is unmounted every time the chair closes it, and accepting a caucus closes
 * it on purpose. Anything that has to outlive that lives here, keyed by committee id:
 *
 *  - temp ids: a raised motion shows immediately under `temp-...` while its INSERT runs.
 *    Every action on it (accept, reject, edit, suspend "No") is disabled until the real
 *    UUID lands, because a delete issued with a temp id deletes nothing and the real row
 *    comes back on the next refresh. Losing this set on close is how a caucus accepted
 *    within ~0.3 s of being raised used to return.
 *  - dropped temps: a temp motion removed locally before its insert returned (it fell when
 *    another motion passed). When the real id arrives, that row is deleted at once.
 *  - the notice: "N other motions fell" with Undo, or a failed-save error. Rendered by
 *    <MotionFlightNotice>, which the chair page mounts, so it survives the modal closing.
 *
 * Nothing here writes committee state on a timer and nothing sets localUpdateTime.
 */
import { useSyncExternalStore } from 'react';
import type { Committee, PendingMotion } from '@/lib/types';
import {
  addPendingMotion as addPendingMotionInDB,
  removePendingMotion as removePendingMotionInDB,
} from '@/lib/committeeService';
import { logMotionFailed, logMotionEdited } from '@/lib/motionLog';

export type MotionNotice =
  /** `restore` is null when Undo is not offered (the motion that passed was Suspend or End). */
  | { id: number; kind: 'fell'; count: number; restore: (() => void) | null }
  | { id: number; kind: 'error'; message: 'save_failed' }
  | { id: number; kind: 'blocked'; country: string };

interface CommitteeFlight {
  temps: Set<string>;
  dropped: Set<string>;
  notice: MotionNotice | null;
  /** The committee is suspended or ended (fed by the chair page). Undo never raises into it. */
  closed: boolean;
  /** Per-committee auto-dismiss timer, so one committee's notice never cancels another's. */
  timer: ReturnType<typeof setTimeout> | null;
}

const flights = new Map<string, CommitteeFlight>();
const listeners = new Set<() => void>();
let noticeSeq = 0;
const EMPTY: ReadonlySet<string> = new Set();

function flight(committeeId: string): CommitteeFlight {
  let f = flights.get(committeeId);
  if (!f) { f = { temps: new Set(), dropped: new Set(), notice: null, closed: false, timer: null }; flights.set(committeeId, f); }
  return f;
}
function emit() { listeners.forEach((l) => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

export const isTempMotionId = (id: string) => id.startsWith('temp-');

/** The temp ids still waiting for their insert. The returned Set is replaced, never
 *  mutated, on change, so it is a valid useSyncExternalStore snapshot. */
export function useTempMotionIds(committeeId: string): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, () => flights.get(committeeId)?.temps ?? EMPTY, () => EMPTY);
}

export function useMotionNotice(committeeId: string): MotionNotice | null {
  return useSyncExternalStore(subscribe, () => flights.get(committeeId)?.notice ?? null, () => null);
}

type NoticeInput = MotionNotice extends infer N ? (N extends MotionNotice ? Omit<N, 'id'> : never) : never;

export function showMotionNotice(committeeId: string, notice: NoticeInput, ms = 8000) {
  const f = flight(committeeId);
  f.notice = { ...notice, id: ++noticeSeq } as MotionNotice;
  if (f.timer) clearTimeout(f.timer);
  const id = f.notice.id;
  f.timer = setTimeout(() => {
    const g = flight(committeeId);
    g.timer = null;
    if (g.notice?.id === id) { g.notice = null; emit(); }
  }, ms);
  emit();
}

/** The chair page reports whether the committee is suspended or ended. While it is, a
 *  pending "fell" notice loses its Undo and a restore already in hand does nothing. */
export function setMotionFlightClosed(committeeId: string, closed: boolean) {
  const f = flight(committeeId);
  if (f.closed === closed) return;
  f.closed = closed;
  if (closed && f.notice?.kind === 'fell' && f.notice.restore) {
    f.notice = { ...f.notice, restore: null };
    emit();
  }
}

export function dismissMotionNotice(committeeId: string) {
  const f = flight(committeeId);
  if (!f.notice) return;
  f.notice = null;
  emit();
}

type Update = (updater: (c: Committee) => Committee) => void;

/**
 * Optimistically add a motion and insert it. The temp row is swapped for the real id on
 * success, and DROPPED (with an error notice) on failure, so a failed insert can no longer
 * leave a motion that can never be rejected.
 */
export function raiseMotionOptimistic(opts: {
  committee: Pick<Committee, 'id' | 'code' | 'dbChairJoinSuffix'>;
  motion: Omit<PendingMotion, 'id' | 'disruptiveness'>;
  disruptiveness: number;
  motionOrder?: string[];
  update: Update;
  /** Called once with the real id when the insert lands and the motion is still on the
   *  floor. The ledger write for a raise / edit / Undo hangs off this (src/lib/motionLog.ts),
   *  so a motion that never saved is never logged. */
  onSaved?: (realId: string) => void;
}): string {
  const { committee, motion, disruptiveness, motionOrder, update, onSaved } = opts;
  const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const f = flight(committee.id);
  f.temps = new Set([...f.temps, tempId]);
  emit();
  update((c) => ({ ...c, pendingMotions: [...(c.pendingMotions ?? []), { ...motion, id: tempId, disruptiveness }] }));

  const settle = () => {
    const g = flight(committee.id);
    if (g.temps.has(tempId)) { g.temps = new Set([...g.temps].filter((x) => x !== tempId)); emit(); }
  };

  addPendingMotionInDB(committee.id, motion, committee.code, committee.dbChairJoinSuffix ?? undefined, motionOrder)
    .then((realId) => {
      const g = flight(committee.id);
      const wasDropped = g.dropped.delete(tempId);
      if (!realId) {
        update((c) => ({ ...c, pendingMotions: (c.pendingMotions ?? []).filter((m) => m.id !== tempId) }));
        settle();
        if (!wasDropped) showMotionNotice(committee.id, { kind: 'error', message: 'save_failed' });
        return;
      }
      if (wasDropped) {
        // It fell (or was removed) while its insert was in flight: the row must not survive.
        removePendingMotionInDB(realId, committee.code, committee.dbChairJoinSuffix ?? undefined);
        settle();
        return;
      }
      update((c) => ({
        ...c,
        pendingMotions: (c.pendingMotions ?? []).map((m) => (m.id === tempId ? { ...m, id: realId } : m)),
      }));
      settle();
      onSaved?.(realId);
    })
    .catch(() => {
      update((c) => ({ ...c, pendingMotions: (c.pendingMotions ?? []).filter((m) => m.id !== tempId) }));
      settle();
      showMotionNotice(committee.id, { kind: 'error', message: 'save_failed' });
    });
  return tempId;
}

/** Remove a motion locally and in the DB. A temp id is remembered so its row is deleted
 *  the moment the insert returns. */
export function removeMotionEverywhere(
  committee: Pick<Committee, 'id' | 'code' | 'dbChairJoinSuffix'>,
  motionId: string,
  update: Update,
) {
  update((c) => ({ ...c, pendingMotions: (c.pendingMotions ?? []).filter((m) => m.id !== motionId) }));
  if (isTempMotionId(motionId)) {
    flight(committee.id).dropped.add(motionId);
    return;
  }
  removePendingMotionInDB(motionId, committee.code, committee.dbChairJoinSuffix ?? undefined);
}

/**
 * A motion passed: every OTHER pending floor motion falls. They are deleted locally and in
 * the DB, and a notice offers Undo for ~8 s, which raises them again (new rows, same
 * content). Custom motions and join / GSL requests never fall.
 */
export function fellOtherFloorMotions(opts: {
  committee: Pick<Committee, 'id' | 'code' | 'dbChairJoinSuffix' | 'pendingMotions'>;
  passedId: string;
  update: Update;
  motionOrder?: string[];
  rank: (m: PendingMotion) => number;
  /** The type of the motion that passed, when the caller knows it (Suspend / End). */
  passedType?: PendingMotion['type'];
}) {
  const { committee, passedId, update, motionOrder, rank } = opts;
  const passed = (committee.pendingMotions ?? []).find((m) => m.id === passedId);
  // V4: when Suspend or End Debate passed, the fallen motions are gone with the debate. Undo
  // would raise them into a suspended or ended room, so it is not offered at all.
  const lifecyclePassed = opts.passedType === 'suspend-debate' || opts.passedType === 'end-debate'
    || passed?.type === 'suspend-debate' || passed?.type === 'end-debate';
  const fallen = (committee.pendingMotions ?? []).filter(
    (m) => m.id !== passedId
      && (m.type as string) !== 'join-request' && (m.type as string) !== 'gsl-request' && m.type !== 'custom',
  );
  if (fallen.length === 0) return;
  for (const m of fallen) {
    // The History line of a fallen motion says so. A temp one was never logged as raised.
    if (!isTempMotionId(m.id)) logMotionFailed(committee, m, 'fell');
    removeMotionEverywhere(committee, m.id, update);
  }
  if (lifecyclePassed) {
    showMotionNotice(committee.id, { kind: 'fell', count: fallen.length, restore: null });
    return;
  }
  const restore = () => {
    dismissMotionNotice(committee.id);
    // The room was suspended or ended after the notice appeared: nothing to raise into.
    if (flight(committee.id).closed) return;
    for (const m of fallen) {
      const { id: _id, disruptiveness: _d, ...motion } = m;
      void _id; void _d;
      // Linked to its original line (motion-edited), so Undo neither scores a second raise
      // nor leaves the line reading "fell".
      raiseMotionOptimistic({
        committee, motion, disruptiveness: rank(m), motionOrder, update,
        onSaved: (realId) => { if (!isTempMotionId(m.id)) logMotionEdited(committee, m.id, realId, motion); },
      });
    }
  };
  showMotionNotice(committee.id, { kind: 'fell', count: fallen.length, restore });
}
