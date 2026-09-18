'use client';

// ── Session sync: one realtime → state pipeline for the chair, delegate and advisor pages ──
//
// What this replaces, and why (audit 14 Sep 2026, R-1 / R-2 / R-3 / R-4 / PERF-1..3 / P-4):
//
//  * ONE shared `fetchSeq` counter per page, so a newer fetch of ANY slice cancelled an older
//    fetch of a DIFFERENT slice. A caucus accept fires 4-5 writes at once; the phone kept the
//    delegates refetch and threw away the committees refetch that carried the caucus. Here
//    every slice has its own counter: a newer fetch of slice X supersedes an older fetch of X
//    and never touches Y.
//  * One refetch per event. 190 "All present" row events meant 190 roster refetches on every
//    phone. Events are now COALESCED: a slice marked dirty is fetched once, a short trailing
//    window (default 200 ms) after the first event that dirtied it.
//  * `committees` events refetched the whole committee (8 queries, every message). Each event
//    now refetches only its own slice; the committee ROW alone for `committees`. Messages are
//    never refetched outside a catch-up: the realtime INSERT payload is merged by id.
//  * A failed read (P-4) is null and is never applied. It is retried a couple of times.
//  * Catch-up (R-4): realtime does not replay what was missed while the socket was down or
//    the tab was asleep. On re-SUBSCRIBED, on the tab becoming visible and on `online`, every
//    slice is refetched through the same sequencing.
//
// This module holds no React state. Pages pass an `apply` callback that decides how a fresh
// slice lands (the chair page defers slices it owns optimistically; see RULE 4 in AGENTS.md)
// and may return a number of milliseconds to fetch that slice again later instead.

import type { Committee, Delegate, SpeakerEntry, PendingMotion, CommitteeDocument } from './types';
import {
  getCommitteeRowById,
  getDelegatesList,
  getSpeakersLists,
  getCurrentSpeakerRow,
  getPendingMotionsList,
  getDocumentsList,
  getMessagesList,
  subscribeToCommittee,
  messageFromRow,
  type CommitteeTable,
  type CommitteeChangePayload,
  type RealtimeStatus,
} from './committeeService';

export type SyncSlice = 'row' | 'delegates' | 'lists' | 'currentSpeaker' | 'motions' | 'documents' | 'messages';

export const ALL_SYNC_SLICES: SyncSlice[] = ['row', 'delegates', 'lists', 'currentSpeaker', 'motions', 'documents', 'messages'];

const SLICE_OF_TABLE: Partial<Record<CommitteeTable, SyncSlice>> = {
  committees: 'row',
  delegates: 'delegates',
  speakers_list: 'lists',
  current_speaker: 'currentSpeaker',
  motions: 'motions',
  documents: 'documents',
  messages: 'messages',
};

export interface SliceData {
  row: Committee;   // row fields only; take them with rowFields()
  delegates: Delegate[];
  lists: { speakersList: SpeakerEntry[]; caucusQueue: SpeakerEntry[] };
  currentSpeaker: { currentSpeaker: SpeakerEntry | null; speakerTimeRemaining: number; speakerStartedAt: string | null; speakerSeatedAt: string | null };
  motions: PendingMotion[];
  documents: CommitteeDocument[];
  messages: Committee['messages'];
}

/** Everything getCommitteeByCode takes from the `committees` row itself. */
export const ROW_FIELDS = [
  'id', 'code', 'name', 'topic', 'chairName', 'chairNames', 'phase', 'speakerTimeLimit', 'caucus',
  'createdAt', 'suspendedAt', 'endedAt', 'expiresAt', 'resumingChair', 'dbChairJoinSuffix',
  'dbHeadChair', 'dbHeadChairDevice', 'dbSeparateChairCode', 'dbSettings', 'dbScoring', 'sessionOrigin',
] as const satisfies readonly (keyof Committee)[];

export type CommitteeRowFields = Pick<Committee, (typeof ROW_FIELDS)[number]>;

export function rowFields(fresh: Committee): CommitteeRowFields {
  const out = {} as Record<string, unknown>;
  for (const k of ROW_FIELDS) out[k] = fresh[k];
  return out as CommitteeRowFields;
}

async function fetchSlice<S extends SyncSlice>(committeeId: string, slice: S): Promise<SliceData[S] | null> {
  switch (slice) {
    case 'row': return (await getCommitteeRowById(committeeId)) as SliceData[S] | null;
    case 'delegates': return (await getDelegatesList(committeeId)) as SliceData[S] | null;
    case 'lists': return (await getSpeakersLists(committeeId)) as SliceData[S] | null;
    case 'currentSpeaker': return (await getCurrentSpeakerRow(committeeId)) as SliceData[S] | null;
    case 'motions': return (await getPendingMotionsList(committeeId)) as SliceData[S] | null;
    case 'documents': return (await getDocumentsList(committeeId)) as SliceData[S] | null;
    case 'messages': return (await getMessagesList(committeeId)) as SliceData[S] | null;
    default: return null;
  }
}

/** When the fetch started, and the page's local-write counter at that moment (R-1). */
export interface FetchMeta { startedAt: number; localWriteSeqAtStart: number; catchUp: boolean }

export type ConnectionState = 'live' | 'reconnecting' | 'offline';

export interface SessionSyncOptions {
  committeeId: string;
  /** Realtime tables to bind. Delegate/advisor pages omit feedback + session_broadcasts. */
  tables: CommitteeTable[];
  /** Slices this page keeps in sync (and refetches on catch-up). */
  slices: SyncSlice[];
  /**
   * Land one fresh slice. Return a number of milliseconds to throw this result away and
   * fetch the slice again after that delay (the chair's debounce and local-write guard).
   */
  apply: (slice: SyncSlice, data: SliceData[SyncSlice], meta: FetchMeta) => number | void;
  /** Consume an event before slice mapping (feedback, broadcasts). Return true when handled. */
  onEvent?: (table: CommitteeTable, payload?: CommitteeChangePayload) => boolean | void;
  /** A realtime `messages` INSERT, already mapped. Without it, messages are refetched. */
  onMessage?: (message: Committee['messages'][number]) => void;
  /** Delay before an event-triggered fetch of this slice (default COALESCE_MS). */
  delayFor?: (slice: SyncSlice, table: CommitteeTable) => number;
  /** Should this event mark its slice at all? (The Moderator ignores current_speaker, RULE 6.) */
  wants?: (table: CommitteeTable) => boolean;
  /** The page's local optimistic-write counter, stamped on every fetch (R-1). */
  getLocalWriteSeq?: () => number;
  onConnection?: (state: ConnectionState) => void;
  /** A catch-up (wake / reconnect / online) started, and all its fetches have returned. */
  /** 'failed': every read of the catch-up failed, so nothing fresh was seen. */
  onCatchUp?: (phase: 'start' | 'done' | 'failed') => void;
}

export interface SessionSync {
  /** Fetch this slice after `delayMs` (earliest pending request wins). */
  mark: (slice: SyncSlice, delayMs?: number) => void;
  /** Refetch every slice (or only these) now, as a catch-up. `force` skips the 1 s throttle:
   *  use it when the caller KNOWS its state went stale after the last catch-up started (a
   *  conditional write that did not land, a resync whose snapshot predates a local write). */
  catchUp: (only?: SyncSlice[], opts?: { force?: boolean }) => void;
  /**
   * R-6: may an AUTOMATIC write (caucus expiry, stop-at-zero) trust local state right now?
   * False while a catch-up is outstanding, and false (starting one) when this page has
   * evidently just woken: the heartbeat has not run for WAKE_GAP_MS. Callers re-run when
   * onCatchUp('done') fires.
   */
  isFresh: () => boolean;
  stop: () => void;
}

export const COALESCE_MS = 200;
const NULL_RETRY_MS = 2000;
const NULL_RETRIES = 2;
const CATCH_UP_THROTTLE_MS = 1000;
// A laptop lid or a locked phone freezes timers. The heartbeat notices the gap on wake,
// even when no visibilitychange or online event fires (a visible tab on a sleeping laptop).
const HEARTBEAT_MS = 2000;
const WAKE_GAP_MS = 10000;
const ONLINE_SETTLE_MS = 8000;

export function startSessionSync(opts: SessionSyncOptions): SessionSync {
  const { committeeId } = opts;
  const enabled = new Set(opts.slices);
  const due = new Map<SyncSlice, number>();
  const catchUpFlag = new Set<SyncSlice>();
  const seq = new Map<SyncSlice, number>();
  /** The seq of the last fetch whose result was APPLIED, per slice (S1). */
  const appliedSeq = new Map<SyncSlice, number>();
  const nullRetries = new Map<SyncSlice, number>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let timerAt = 0;
  let stopped = false;

  // Catch-up bookkeeping: the slices of the current catch-up that have not returned yet.
  let catchUpOutstanding = new Set<SyncSlice>();
  let lastCatchUpAt = 0;
  let catchUpStartedAt = 0;
  /** Did any read of the current catch-up return data? */
  let catchUpSawData = false;
  /** The last catch-up settled with every read failed: local state is not known fresh. */
  let lastCatchUpFailed = false;

  const arm = () => {
    if (stopped) return;
    if (due.size === 0) { if (timer) { clearTimeout(timer); timer = null; } return; }
    const next = Math.min(...Array.from(due.values()));
    if (timer && timerAt <= next) return;
    if (timer) clearTimeout(timer);
    timerAt = next;
    timer = setTimeout(flush, Math.max(0, next - Date.now()));
  };

  const mark = (slice: SyncSlice, delayMs: number = COALESCE_MS) => {
    if (stopped || !enabled.has(slice)) return;
    const at = Date.now() + Math.max(0, delayMs);
    const cur = due.get(slice);
    if (cur === undefined || at < cur) due.set(slice, at);
    arm();
  };

  /** Settle a slice of the current catch-up. Only a fetch that STARTED after the catch-up
   *  did can settle it: an older result can now land (S1), and it must not count as fresh. */
  const settleCatchUp = (slice: SyncSlice, startedAt: number, ok = true) => {
    if (!catchUpOutstanding.has(slice) || startedAt < catchUpStartedAt) return;
    catchUpOutstanding.delete(slice);
    if (ok) catchUpSawData = true;
    if (catchUpOutstanding.size === 0) {
      lastCatchUpFailed = !catchUpSawData;
      opts.onCatchUp?.(catchUpSawData ? 'done' : 'failed');
    }
  };

  async function run(slice: SyncSlice, isCatchUp: boolean) {
    const my = (seq.get(slice) ?? 0) + 1;
    seq.set(slice, my);
    const meta: FetchMeta = { startedAt: Date.now(), localWriteSeqAtStart: opts.getLocalWriteSeq?.() ?? 0, catchUp: isCatchUp };
    let data: SliceData[SyncSlice] | null = null;
    try { data = await fetchSlice(committeeId, slice); } catch (e) { console.error(`session sync: ${slice} fetch failed`, e); }
    if (stopped) return;
    // S1: drop this result only if a NEWER result of this slice has already been applied.
    // Merely being overtaken by a fetch that STARTED later is not enough: under a burst of
    // events every fetch is overtaken by the next one before it returns, and dropping each
    // of them starved the slice until the burst ended. An older result applied first is
    // simply overwritten when the newer one lands. Other slices are never affected.
    if (my < (appliedSeq.get(slice) ?? 0)) return;   // the newer applied result settled its own catch-up
    const superseded = seq.get(slice) !== my;
    if (data === null) {
      // A newer fetch is already in flight: it carries the retry budget.
      if (superseded) return;
      // P-4: keep what we have. Try again shortly, a bounded number of times; a catch-up or
      // the next event resets the budget.
      const n = nullRetries.get(slice) ?? 0;
      if (n < NULL_RETRIES) { nullRetries.set(slice, n + 1); if (isCatchUp) catchUpFlag.add(slice); mark(slice, NULL_RETRY_MS); return; }
      settleCatchUp(slice, meta.startedAt, false);
      return;
    }
    nullRetries.delete(slice);
    let retry: number | void = undefined;
    try { retry = opts.apply(slice, data, meta); } catch (e) { console.error(`session sync: applying ${slice} failed`, e); }
    if (typeof retry !== 'number') appliedSeq.set(slice, Math.max(appliedSeq.get(slice) ?? 0, my));
    if (typeof retry === 'number') {
      if (isCatchUp) catchUpFlag.add(slice);
      mark(slice, retry);
      // A deferred catch-up slice still counts as "seen fresh data" only once it lands.
      return;
    }
    settleCatchUp(slice, meta.startedAt);
  }

  function flush() {
    timer = null;
    if (stopped) return;
    const now = Date.now();
    const ready: SyncSlice[] = [];
    for (const [slice, at] of due) if (at <= now + 5) ready.push(slice);
    for (const slice of ready) {
      due.delete(slice);
      const isCatchUp = catchUpFlag.delete(slice);
      void run(slice, isCatchUp);
    }
    arm();
  }

  const catchUp = (only?: SyncSlice[], copts?: { force?: boolean }) => {
    if (stopped) return;
    const now = Date.now();
    if (!copts?.force && now - lastCatchUpAt < CATCH_UP_THROTTLE_MS) return;
    lastCatchUpAt = now;
    const slices = only ? only.filter((s) => enabled.has(s)) : Array.from(enabled);
    catchUpOutstanding = new Set(slices);
    catchUpStartedAt = now;
    catchUpSawData = false;
    opts.onCatchUp?.('start');
    for (const slice of slices) {
      nullRetries.delete(slice);
      catchUpFlag.add(slice);
      mark(slice, 0);
    }
  };

  // ── Realtime ──
  let seenFirstSubscribed = false;
  let lastStatus: RealtimeStatus | null = null;
  const report = (s: ConnectionState) => { if (!stopped) opts.onConnection?.(s); };
  let statusSeq = 0;
  const onStatus = (status: RealtimeStatus) => {
    if (stopped) return;
    lastStatus = status;
    statusSeq++;
    if (status === 'SUBSCRIBED') {
      report(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'live');
      // Every later SUBSCRIBED is a recovery after CHANNEL_ERROR / TIMED_OUT / CLOSED and
      // needs a full catch-up. The FIRST one closes the gap between the page's own load and
      // the socket opening (a write in that gap was never delivered); the load already
      // fetched every message a moment ago, so that one skips the message history.
      // `force`: a reconnect catch-up must never be swallowed by the 1 s throttle (S5). A
      // wake or visibility catch-up that started just before the socket dropped would
      // otherwise hide every event missed while it was down.
      if (seenFirstSubscribed) catchUp(undefined, { force: true });
      else catchUp(Array.from(enabled).filter((s) => s !== 'messages'), { force: true });
      seenFirstSubscribed = true;
    } else {
      report(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'reconnecting');
    }
  };

  const unsubscribe = subscribeToCommittee(committeeId, (tableName, payload) => {
    if (stopped) return;
    const table = tableName as CommitteeTable;
    if (opts.onEvent?.(table, payload)) return;
    if (opts.wants && !opts.wants(table)) return;
    if (table === 'messages' && opts.onMessage && payload?.eventType === 'INSERT' && payload.new?.id) {
      opts.onMessage(messageFromRow(payload.new));
      return;
    }
    const slice = SLICE_OF_TABLE[table];
    if (!slice) return;
    nullRetries.delete(slice);
    mark(slice, opts.delayFor ? opts.delayFor(slice, table) : COALESCE_MS);
  }, onStatus, opts.tables);

  // ── Wake / network ──
  const onVisible = () => { if (document.visibilityState === 'visible') catchUp(); };
  // Back online is not live yet: the socket still has to (re)join. Show reconnecting until
  // the next SUBSCRIBED. A socket that never noticed the outage emits no new status, so if it
  // still reads SUBSCRIBED after ONLINE_SETTLE_MS with nothing else reported, it is live.
  let onlineSettle: ReturnType<typeof setTimeout> | null = null;
  const onOnline = () => {
    report('reconnecting');
    const statusAtOnline = statusSeq;
    if (onlineSettle) clearTimeout(onlineSettle);
    onlineSettle = setTimeout(() => {
      onlineSettle = null;
      if (statusSeq === statusAtOnline && lastStatus === 'SUBSCRIBED' && navigator.onLine !== false) report('live');
    }, ONLINE_SETTLE_MS);
    catchUp();
  };
  const onOffline = () => report('offline');
  if (typeof window !== 'undefined') {
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    if (navigator.onLine === false) report('offline');
  }

  let lastBeat = Date.now();
  const beat = setInterval(() => {
    const now = Date.now();
    const gap = now - lastBeat;
    lastBeat = now;
    if (gap > WAKE_GAP_MS) catchUp();
  }, HEARTBEAT_MS);

  const isFresh = () => {
    if (stopped) return false;
    if (Date.now() - lastBeat > WAKE_GAP_MS) {
      lastBeat = Date.now();
      catchUp();
    }
    if (catchUpOutstanding.size > 0) return false;
    // Every read of the last catch-up failed: try again (throttled) and do not trust local state.
    if (lastCatchUpFailed) { catchUp(); return false; }
    return true;
  };

  return {
    mark,
    catchUp,
    isFresh,
    stop: () => {
      stopped = true;
      clearInterval(beat);
      if (onlineSettle) { clearTimeout(onlineSettle); onlineSettle = null; }
      if (timer) { clearTimeout(timer); timer = null; }
      due.clear();
      unsubscribe();
      if (typeof window !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisible);
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
      }
    },
  };
}

/** Patch the current speaker into a committee exactly the way every page did inline. */
export function withCurrentSpeaker(prev: Committee, cs: SliceData['currentSpeaker'], opts: { includeRemaining: boolean }): Committee {
  const patched: Committee = {
    ...prev,
    currentSpeaker: cs.currentSpeaker,
    speakerStartedAt: cs.speakerStartedAt,
    speakerSeatedAt: cs.speakerSeatedAt,
    ...(opts.includeRemaining ? { speakerTimeRemaining: cs.speakerTimeRemaining } : {}),
    // Drop the new speaker from the local GSL to avoid a transient duplicate before the
    // speakers_list delete event arrives (mirrors getCommitteeByCode).
    speakersList: cs.currentSpeaker
      ? prev.speakersList.filter((s) => s.delegateId !== cs.currentSpeaker!.delegateId)
      : prev.speakersList,
  };
  // In a moderated caucus (incl. Tour de Table) the visible speaker is caucus.currentSpeaker.
  if (prev.caucus && prev.caucus.type === 'moderated') {
    patched.caucus = { ...prev.caucus, currentSpeaker: cs.currentSpeaker?.country ?? null };
    patched.caucusQueue = cs.currentSpeaker
      ? prev.caucusQueue.filter((s) => s.delegateId !== cs.currentSpeaker!.delegateId)
      : prev.caucusQueue;
  }
  return patched;
}

/** Land fresh speakers lists, never duplicating the current speaker into the GSL. */
export function withLists(prev: Committee, lists: SliceData['lists']): Committee {
  return {
    ...prev,
    speakersList: prev.currentSpeaker
      ? lists.speakersList.filter((s) => s.delegateId !== prev.currentSpeaker!.delegateId)
      : lists.speakersList,
    caucusQueue: lists.caucusQueue,
  };
}
