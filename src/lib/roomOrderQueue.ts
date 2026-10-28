/**
 * The Room Order Tour de Table queue, derived from the caucus JSONB (23 Oct 2026).
 *
 * A Room Order tour queues numbered placeholders ("Speaker 1".."Speaker N", ids
 * `room-order-N`) that are NOT delegations. `speakers_list.delegate_id` is a uuid column, so
 * they can never be stored there: the queue used to live only in the Moderator's local state,
 * and every lists fetch (tab visible, online, reload, a gavel handover, any speakers_list
 * event) replaced it with the database's empty caucus queue. Commenters never saw it at all.
 *
 * Now the queue is a pure function of the caucus row, which every device already reads:
 *   - the roster size (`caucus.roomOrderSize`, stamped at accept; older tours fall back to the
 *     roster snapshot `caucus.roomOrderCountries`),
 *   - the placeholders already called (`caucus.spokenCountries`) and the one on the floor
 *     (`caucus.currentSpeaker`).
 * The queue is every number from 1 to the size not yet called, in order (then any real
 * delegation the chair queued after them, which IS stored). Placeholders are
 * fungible turn counters (the strip numbers them by position), so there is no order to keep;
 * removing one from the queue lowers `roomOrderSize` by one.
 *
 * Pure. Writes nothing. A-Z / Z-A tours (real delegations) are never touched.
 */
import type { CaucusState, Committee, SpeakerEntry } from './types';

export const ROOM_ORDER_ID_PREFIX = 'room-order-';

export function isRoomOrderCaucus(caucus: CaucusState | null | undefined): boolean {
  return !!caucus && caucus.type === 'moderated' && (caucus.purpose?.includes('Room Order') ?? false);
}

export function roomOrderPlaceholder(n: number): SpeakerEntry {
  return { delegateId: `${ROOM_ORDER_ID_PREFIX}${n}`, country: `Speaker ${n}` };
}

/** The placeholder number of a "Speaker N" name, or null. */
export function roomOrderNumber(name: string | null | undefined): number | null {
  const m = typeof name === 'string' ? name.match(/^Speaker (\d+)$/) : null;
  return m ? Number(m[1]) : null;
}

/** How many turns the tour has, or null when the caucus carries neither field (a tour
 *  accepted by an older bundle): then nothing can be derived. */
export function roomOrderSize(caucus: CaucusState | null | undefined): number | null {
  if (!isRoomOrderCaucus(caucus)) return null;
  const stored = caucus!.roomOrderSize;
  if (typeof stored === 'number' && Number.isFinite(stored) && stored >= 0) return Math.round(stored);
  const roster = caucus!.roomOrderCountries;
  return Array.isArray(roster) ? roster.length : null;
}

/** Placeholder numbers already called: spoken, or on the floor now. */
function calledNumbers(caucus: CaucusState): Set<number> {
  const out = new Set<number>();
  for (const s of caucus.spokenCountries ?? []) {
    const n = roomOrderNumber(s);
    if (n !== null) out.add(n);
  }
  const cur = roomOrderNumber(caucus.currentSpeaker);
  if (cur !== null) out.add(cur);
  return out;
}

/** How many turns have been called so far (spoken or on the floor). */
export function roomOrderTurnsCalled(caucus: CaucusState | null | undefined): number {
  if (!isRoomOrderCaucus(caucus)) return 0;
  return calledNumbers(caucus!).size;
}

/** The queue, or null when it cannot be derived (not a Room Order tour, or no size). */
export function roomOrderQueue(caucus: CaucusState | null | undefined): SpeakerEntry[] | null {
  const size = roomOrderSize(caucus);
  if (size === null) return null;
  const called = calledNumbers(caucus!);
  // Turns already called count toward the size, so a queue that lost one by removal ends
  // at the right length even when the called numbers are not the lowest ones.
  const left = Math.max(0, size - called.size);
  const out: SpeakerEntry[] = [];
  for (let n = 1; out.length < left && n <= size + called.size; n++) {
    if (!called.has(n)) out.push(roomOrderPlaceholder(n));
  }
  return out;
}

/** The placeholders derived from the caucus, then any REAL delegation the chair queued
 *  after them (a stored speakers_list row, e.g. once an extension made room), in `stored`
 *  order. Null when nothing can be derived. */
export function roomOrderQueueWith(caucus: CaucusState | null | undefined, stored: SpeakerEntry[] | undefined): SpeakerEntry[] | null {
  const derived = roomOrderQueue(caucus);
  if (!derived) return null;
  const extras = (stored ?? []).filter((s) => !s.delegateId?.startsWith(ROOM_ORDER_ID_PREFIX));
  return extras.length ? [...derived, ...extras] : derived;
}

function sameQueue(a: SpeakerEntry[] | undefined, b: SpeakerEntry[]): boolean {
  if (!a || a.length !== b.length) return false;
  return a.every((s, i) => s.delegateId === b[i].delegateId && s.country === b[i].country);
}

/**
 * The committee with its Room Order queue derived from the caucus. Returns `c` itself when
 * nothing changes (or this is not a Room Order tour), so a React updater stays a no-op.
 * `floor`: also seat the placeholder named by `caucus.currentSpeaker` as `currentSpeaker`
 * (chair page only: the current_speaker row can never hold a placeholder, so after a reload
 * or on a Commenter it reads empty while the caucus names who is on the floor).
 */
export function withRoomOrderQueue<T extends Committee | null | undefined>(c: T, opts: { floor?: boolean } = {}): T {
  if (!c || c.phase !== 'moderated-caucus') return c;
  const queue = roomOrderQueueWith(c.caucus, c.caucusQueue);
  if (!queue) return c;
  let next: Committee = c;
  if (!sameQueue(c.caucusQueue, queue)) next = { ...next, caucusQueue: queue };
  if (opts.floor) {
    const n = roomOrderNumber(c.caucus!.currentSpeaker);
    const want = n !== null ? roomOrderPlaceholder(n) : null;
    const have = c.currentSpeaker;
    if (want && (have?.delegateId !== want.delegateId || have?.country !== want.country)) {
      next = { ...next, currentSpeaker: want };
    } else if (!want && have?.delegateId?.startsWith(ROOM_ORDER_ID_PREFIX)) {
      next = { ...next, currentSpeaker: null };
    }
  }
  return next as T;
}
