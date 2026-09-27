// ============================================================
// src/lib/writeStatus.ts
// Did the chair's write actually land? (audit R-5)
//
// supabase-js RESOLVES on an RLS rejection and returns `error: null` for an update that
// matched zero rows, so a write that never reached the database looked exactly like one
// that did. On venue Wi-Fi a Next, a caucus start or End Debate appeared on the chair
// laptop and nowhere else, with no error, and a later refetch quietly undid it.
//
// Every session write in committeeService now runs through `runWrite`:
//   - the attempt returns 'ok' (landed), 'skipped' (a conditional write correctly did
//     nothing, e.g. the committee had already ended) or 'failed';
//   - an IDEMPOTENT write (phase, caucus, the speaker clock, list positions through the
//     RPCs, suspend/end) is retried with backoff, at most three attempts;
//   - a newer write with the same key supersedes an older one still retrying, so a stale
//     retry can never land on top of a newer value;
//   - the result is published here, and the chair page renders ONE deduplicated toast:
//     "Not saved. Retrying..." while retries run, then "Not saved. Check your connection."
//     with a Retry button if they all failed.
//
// RULE 5 is unchanged: callers still update the UI optimistically first and do not await
// the write for the UI. The boolean each service function resolves with is for the few
// callers that must roll back (End Debate, Suspend) and is handled asynchronously.
// ============================================================

import { OFFLINE_RESILIENCE, isNetworkClassError, beginPendingWrite } from './offlineResilience';

export type WriteResult = 'ok' | 'skipped' | 'failed';

/** What ONE attempt may answer. 'failed-network' = no answer came back at all (offline, a
 *  timeout, a gateway: see isNetworkClassError); runWrite reports it to callers as 'failed',
 *  but with OFFLINE_RESILIENCE on an idempotent write that fails this way is PARKED and
 *  retried when the connection is back instead of being given up. */
export type AttemptResult = WriteResult | 'failed-network';

/** 'failed-network' when the error says the request never got an answer, else 'failed'.
 *  Always 'failed' with the kill switch off. With a `label` the error is logged, except a
 *  network-class one while the switch is on: runWrite logs those ONCE (when the write parks
 *  or gives up), never per attempt (D7). */
export function failedFrom(error: unknown, label?: string): AttemptResult {
  const network = OFFLINE_RESILIENCE && isNetworkClassError(error);
  if (label && !network) console.error(label.endsWith(':') ? label : `${label}:`, error);
  return network ? 'failed-network' : 'failed';
}

export type WriteStatusState = {
  /** At least one write is between a failed attempt and its next retry. */
  retrying: boolean;
  /** Writes that exhausted their attempts, newest last. */
  failed: { key: string; retryable: boolean }[];
  /** Offline resilience: at least one write is parked until the connection is back. */
  parked: boolean;
};

type FailedEntry = { retryable: boolean; rerun: (() => Promise<unknown>) | null };

const generations = new Map<string, number>();
/** Writes (by per-call id, not key) between a failed attempt and their next retry. Two
 *  concurrent writes on one key used to share one entry, so the first to finish cleared the
 *  "Retrying..." state while the other was still retrying. */
const retryingWrites = new Set<number>();
let writeIdSeq = 0;
/** Per key: retries of writes issued at or below this generation are cancelled (S2). */
const cancelledUpTo = new Map<string, number>();
const failedWrites = new Map<string, FailedEntry>();
const listeners = new Set<(s: WriteStatusState) => void>();

// ── Offline resilience (phase 1): parking ────────────────────────────────────────────
// Writes (by per-call id) parked until the connection is back.
const parkedWrites = new Set<number>();
/** Parkable writes whose last attempt failed network-class and that are still in their
 *  backoff: shown as "Offline" at once instead of "Retrying..." (D7). */
const offlineBackoff = new Set<number>();
/** One counter for "when was this write issued": a runWrite call, or a write-chain ticket
 *  taken when the write was QUEUED (committeeService `chained`), so a write that waited on a
 *  chain behind a parked one still counts as issued before a break or a role loss. */
let issueSeq = 0;
/** Per key: writes issued at or before this seq, in their backoff OR parked, are cancelled.
 *  Set only once a break (Suspend / End) has LANDED (cancelWritesIssuedBefore), never before
 *  it: a break that fails offline must not throw away the Moderator's work (D1, D1b). */
const cancelSeqByKey = new Map<string, number>();
/** Per committee: writes issued at or before this seq were dropped because this device
 *  stopped being the Moderator (dropParkedWrites). */
const dropSeqByCommittee = new Map<string, number>();

/** A write-chain ticket (see committeeService `chained`). */
export interface ChainTicket { seq: number }
let activeTicket: ChainTicket | null = null;

/** Take a ticket when a write is QUEUED on a chain (null with the switch off). */
export function issueChainTicket(): ChainTicket | null {
  return OFFLINE_RESILIENCE ? { seq: ++issueSeq } : null;
}

/** Run `fn` with `ticket` visible to the runWrite it calls SYNCHRONOUSLY (runWrite reads it
 *  before its first await). */
export function runWithChainTicket<T>(ticket: ChainTicket | null, fn: () => T): T {
  if (!ticket) return fn();
  const prev = activeTicket;
  activeTicket = ticket;
  try { return fn(); } finally { activeTicket = prev; }
}

const PARK_POLL_MS = 5000;
const PARK_MIN_GAP_MS = 1000;
const parkWaiters = new Set<() => void>();
let parkTriggersInstalled = false;

/** Wake every parked write now (the connection may be back): `online`, tab visible, and the
 *  session sync's catch-ups call this. Harmless when nothing is parked. */
export function nudgeParkedWrites(): void {
  if (parkWaiters.size === 0) return;
  Array.from(parkWaiters).forEach((fn) => fn());
}

function installParkTriggers() {
  if (parkTriggersInstalled || typeof window === 'undefined') return;
  parkTriggersInstalled = true;
  window.addEventListener('online', nudgeParkedWrites);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') nudgeParkedWrites();
  });
}

function waitForParkWake(): Promise<void> {
  return new Promise((resolve) => {
    const done = () => { clearTimeout(timer); parkWaiters.delete(done); resolve(); };
    const timer = setTimeout(done, PARK_POLL_MS);
    parkWaiters.add(done);
  });
}

/**
 * This device stopped being the Moderator (the gavel moved, or it was kicked): every write
 * of this committee it issued so far, parked, backing off or still queued on a chain, gives
 * up without landing ('skipped'), and stale "Not saved" entries of the committee are
 * forgotten (a Retry would now act for a chair who no longer runs the room). Speech / ledger
 * log inserts (`keepOnRoleLoss`) are exempt: they record what already happened. No-op with
 * the switch off.
 */
export function dropParkedWrites(committeeId: string): void {
  if (!OFFLINE_RESILIENCE || !committeeId) return;
  dropSeqByCommittee.set(committeeId, issueSeq);
  for (const fk of Array.from(failedWrites.keys())) {
    if (fk.split('+').some((p) => committeeOfKey(p) === committeeId)) failedWrites.delete(fk);
  }
  nudgeParkedWrites();
  emit();
}

// ── Speaker-write trouble (for the speech logger) ──
// A current_speaker write that has failed at least one attempt and not ended yet (backing
// off, or parked) means the persisted anchor may not hold what the Moderator pressed, so
// `logFloorSpeech` must not trust a read-back of it (it could read a Start that lands a
// minute later and log the whole slot). Tracked per committee, by write id.
const stalledSpeakerWrites = new Map<number, string>();   // writeId -> committeeId
const speakerFailureCount = new Map<string, number>();   // committeeId -> failed attempts

/** For floorSpeech.ts: is a current_speaker write of this committee stalled right now, and
 *  a counter of failed current_speaker attempts (compare two readings to see whether one
 *  failed in between). Always `{ stalledNow: false, mark: 0 }` with the switch off. */
export function speakerWriteTrouble(committeeId: string): { stalledNow: boolean; mark: number } {
  if (!OFFLINE_RESILIENCE) return { stalledNow: false, mark: 0 };
  let stalledNow = false;
  stalledSpeakerWrites.forEach((c) => { if (c === committeeId) stalledNow = true; });
  return { stalledNow, mark: speakerFailureCount.get(committeeId) ?? 0 };
}

function snapshot(): WriteStatusState {
  return {
    retrying: Array.from(retryingWrites).some((id) => !offlineBackoff.has(id)),
    failed: Array.from(failedWrites.entries()).map(([key, f]) => ({ key, retryable: f.retryable })),
    parked: parkedWrites.size > 0 || offlineBackoff.size > 0,
  };
}

function emit() {
  const s = snapshot();
  listeners.forEach((fn) => { try { fn(s); } catch { /* a listener bug must not break writes */ } });
}

export function subscribeWriteStatus(fn: (s: WriteStatusState) => void): () => void {
  listeners.add(fn);
  fn(snapshot());
  return () => { listeners.delete(fn); };
}

/** Retry every failed write that is safe to repeat. Superseded ones are dropped. */
export function retryFailedWrites(): void {
  const entries = Array.from(failedWrites.entries());
  for (const [key, f] of entries) {
    if (!f.retryable || !f.rerun) continue;
    failedWrites.delete(key);
    void f.rerun();
  }
  emit();
}

/**
 * Cancel the pending retries of every write issued so far on these keys (S2). A Suspend or
 * End calls this for the committee's phase, caucus and speaker keys, so a phase, caucus or
 * seat write still backing off from before the break can never land after it. Writes marked
 * `survivesLifecycle` (the conditional floor clear, the live pause: both part of the break
 * itself) are exempt. Their stale failures are forgotten too.
 */
export function cancelPendingRetries(keys: string[]): void {
  let touched = false;
  for (const k of keys) {
    cancelledUpTo.set(k, generations.get(k) ?? 0);
    for (const fk of Array.from(failedWrites.keys())) {
      if (fk === k || fk.split('+').includes(k)) { failedWrites.delete(fk); touched = true; }
    }
  }
  if (touched) emit();
}

/** The current issue counter: take it BEFORE starting a break, pass it to
 *  cancelWritesIssuedBefore once the break has landed. */
export function issueMark(): number {
  return issueSeq;
}

/**
 * Offline resilience, S2 once the break has LANDED (D1, D1b). With OFFLINE_RESILIENCE on,
 * Suspend / End no longer call cancelPendingRetries before the break: they take issueMark()
 * and, only when the break resolved true, call this. Every write on these keys issued at or
 * before `upTo`, whether still in its retry backoff or parked, ends 'skipped' at its next
 * check and never lands; a later network failure of one will not park. Their stale "Not
 * saved" entries are forgotten (what cancelPendingRetries did, now after landing). A write
 * still queued on a chain runs its first attempt as it always did (D4). `survivesLifecycle`
 * writes are exempt. A break that fails cancels nothing.
 */
export function cancelWritesIssuedBefore(keys: string[], upTo: number): void {
  if (!OFFLINE_RESILIENCE) return;
  let touched = false;
  for (const k of keys) {
    cancelSeqByKey.set(k, Math.max(cancelSeqByKey.get(k) ?? 0, upTo));
    for (const fk of Array.from(failedWrites.keys())) {
      if (fk === k || fk.split('+').includes(k)) { failedWrites.delete(fk); touched = true; }
    }
  }
  nudgeParkedWrites();
  if (touched) emit();
}

/** Forget failed writes that cannot be retried (the toast's close control). */
export function dismissFailedWrites(): void {
  failedWrites.clear();
  emit();
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const BACKOFF_MS = [0, 800, 2000];

/**
 * Run one write with failure reporting and, when `retry` is true, backoff.
 *
 * `keys` name what the write owns (e.g. `${committeeId}:phase`). Issuing a write bumps
 * the generation of each key; a retry whose key has moved on gives up with 'skipped',
 * because the newer write already carries the newer truth.
 */
export interface RunWriteOptions {
  /** Retry automatically with backoff (idempotent writes only). */
  retry: boolean;
  /** May the toast's Retry button run it again later, out of context? Default: `retry`.
   *  False for lifecycle writes (suspend / end), the live pause and the caucus list clear:
   *  re-running those minutes later could suspend a resumed room or wipe a new queue (S3).
   *  Their failure shows "Not saved" with Dismiss only. */
  rerunnable?: boolean;
  /** Exempt from cancelPendingRetries (a write that belongs to the break itself). */
  survivesLifecycle?: boolean;
  /** Exempt from dropParkedWrites (append-only log rows: they record what already happened). */
  keepOnRoleLoss?: boolean;
}

/** `${committeeId}:...` keys belong to a committee; other keys (delegate:, motion:) do not. */
const committeeOfKey = (k: string): string | null => {
  const i = k.indexOf(':');
  if (i <= 0) return null;
  const head = k.slice(0, i);
  return head === 'delegate' || head === 'motion' ? null : head;
};

export async function runWrite(
  keys: string | string[],
  attempt: () => Promise<AttemptResult>,
  opts: RunWriteOptions,
): Promise<WriteResult> {
  // Read FIRST, before any await: set only while a write chain calls us synchronously.
  const ticket = activeTicket;
  const list = Array.isArray(keys) ? keys : [keys];
  const primary = list.join('+');
  const writeId = ++writeIdSeq;
  const issuedAt = OFFLINE_RESILIENCE ? (ticket?.seq ?? ++issueSeq) : 0;
  const mine = list.map((k) => {
    const g = (generations.get(k) ?? 0) + 1;
    generations.set(k, g);
    return g;
  });
  const superseded = () => list.some((k, i) => generations.get(k) !== mine[i]);
  // A LANDED break (cancelWritesIssuedBefore) cancels a write in backoff or parked (D1, D1b).
  const parkCancelled = () => OFFLINE_RESILIENCE && !opts.survivesLifecycle
    && list.some((k) => (cancelSeqByKey.get(k) ?? 0) >= issuedAt);
  // Retries in backoff: the old S2 rule (cancelPendingRetries; with the switch on no break
  // calls it any more) plus a landed break.
  const cancelled = () => !opts.survivesLifecycle && (
    list.some((k, i) => (cancelledUpTo.get(k) ?? 0) >= mine[i]) || parkCancelled());
  const committees = list.map(committeeOfKey).filter((c): c is string => !!c);
  const dropped = () => OFFLINE_RESILIENCE && !opts.keepOnRoleLoss
    && committees.some((c) => (dropSeqByCommittee.get(c) ?? 0) >= issuedAt);
  const rerunnable = opts.rerunnable ?? opts.retry;
  const releasePending = beginPendingWrite(list);
  // The committee whose current_speaker this write touches (key `${id}:speaker...`), or null.
  const speakerCommittee = OFFLINE_RESILIENCE
    ? (list.map((k) => { const c = committeeOfKey(k); return c && (k === `${c}:speaker` || k.startsWith(`${c}:speaker:`)) ? c : null; })
        .find((c): c is string => !!c) ?? null)
    : null;

  try {
    // A new write for a key clears an older failure for the same key: it carries newer truth.
    let touched = false;
    for (const k of list) {
      for (const fk of Array.from(failedWrites.keys())) {
        if (fk === k || fk.split('+').includes(k)) { failedWrites.delete(fk); touched = true; }
      }
    }
    if (touched) emit();

    const attemptOnce = async (): Promise<AttemptResult> => {
      try {
        return await attempt();
      } catch (err) {
        if (OFFLINE_RESILIENCE && isNetworkClassError(err)) return 'failed-network';
        console.error(`Write threw (${primary}):`, err);
        return 'failed';
      }
    };
    const runAttempt = async (): Promise<AttemptResult> => {
      const raw = await attemptOnce();
      if (speakerCommittee && (raw === 'failed' || raw === 'failed-network')) {
        stalledSpeakerWrites.set(writeId, speakerCommittee);
        speakerFailureCount.set(speakerCommittee, (speakerFailureCount.get(speakerCommittee) ?? 0) + 1);
      }
      return raw;
    };

    const delays = opts.retry ? BACKOFF_MS : [0];
    let result: WriteResult = 'failed';
    let lastNetwork = false;
    // Offline resilience: a write that waited on a chain and was issued before this device
    // lost the gavel never starts. (A break does NOT stop a queued write: D4, as before.)
    const startsDead = OFFLINE_RESILIENCE && !!ticket && dropped();
    if (startsDead) result = 'skipped';
    for (let i = 0; !startsDead && i < delays.length; i++) {
      if (i > 0) {
        await sleep(delays[i]);
        if (superseded() || cancelled() || dropped()) { result = 'skipped'; break; }
      }
      const raw = await runAttempt();
      lastNetwork = raw === 'failed-network';
      result = lastNetwork ? 'failed' : (raw as WriteResult);
      if (result !== 'failed') break;
      // D7: a parkable write that failed network-class reads "Offline" from the first
      // failure, not "Retrying..." for three seconds first.
      const offlineNow = OFFLINE_RESILIENCE && lastNetwork && opts.retry && rerunnable;
      if (offlineNow !== offlineBackoff.has(writeId)) {
        if (offlineNow) offlineBackoff.add(writeId); else offlineBackoff.delete(writeId);
        if (retryingWrites.has(writeId)) emit();
      }
      if (opts.retry && i < delays.length - 1 && !retryingWrites.has(writeId)) {
        retryingWrites.add(writeId);
        emit();
      }
    }

    let changed = retryingWrites.delete(writeId);

    // ── Offline resilience: park instead of giving up ──
    // Only an idempotent write that may safely run again later (retry, and not marked
    // rerunnable: false), and only when the LAST failure was network-class. A refusal (RLS,
    // a zero-row "still matches", a 4xx) keeps the "Not saved" path below. The promise stays
    // pending while parked, so a write chain keeps its order behind it.
    if (OFFLINE_RESILIENCE && opts.retry && rerunnable && result === 'failed' && lastNetwork
      && !superseded() && !cancelled() && !parkCancelled() && !dropped()) {
      installParkTriggers();
      parkedWrites.add(writeId);
      offlineBackoff.delete(writeId);
      // D7: logged once when it parks and once when it ends, never per attempt.
      console.warn(`Write parked until the connection is back (${primary}).`);
      emit();
      let lastTry = Date.now();
      // NOT `cancelled()` here: a cancelPendingRetries (switch-off path) must not kill parked
      // work (D1); only a landed break does, through cancelWritesIssuedBefore.
      const dead = () => superseded() || parkCancelled() || dropped();
      for (;;) {
        await waitForParkWake();
        if (dead()) { result = 'skipped'; break; }
        const gap = PARK_MIN_GAP_MS - (Date.now() - lastTry);
        if (gap > 0) {
          await sleep(gap);
          if (dead()) { result = 'skipped'; break; }
        }
        lastTry = Date.now();
        const raw = await runAttempt();
        if (raw === 'failed-network') continue;
        result = raw;   // landed, a correct no-op, or now a real refusal (reported below)
        break;
      }
      parkedWrites.delete(writeId);
      console.warn(`Parked write ended (${primary}): ${result === 'ok' ? 'saved' : result}.`);
      changed = true;
    } else if (OFFLINE_RESILIENCE && result === 'failed' && lastNetwork) {
      console.error(`Write failed: no connection (${primary}).`);
    }
    if (offlineBackoff.delete(writeId)) changed = true;

    if (result === 'failed' && !superseded() && !cancelled() && !parkCancelled() && !dropped()) {
      failedWrites.set(primary, {
        retryable: rerunnable,
        rerun: rerunnable ? () => runWrite(list, attempt, opts) : null,
      });
      changed = true;
    } else if (result === 'ok') {
      // S3: a landed write clears stale failures of the same kind. A landed PHASE write clears
      // every stale failure of that committee: the room has moved on, and a Retry of an older
      // write would now act out of context.
      const phaseLanded = list.some((k) => k.endsWith(':phase'));
      const committeeSet = new Set(committees);
      for (const fk of Array.from(failedWrites.keys())) {
        const parts = fk.split('+');
        const sameKind = parts.some((p) => list.includes(p));
        const sameCommittee = phaseLanded && parts.some((p) => { const c = committeeOfKey(p); return !!c && committeeSet.has(c); });
        if (sameKind || sameCommittee) { failedWrites.delete(fk); changed = true; }
      }
    }
    if (changed) emit();
    return result;
  } finally {
    stalledSpeakerWrites.delete(writeId);
    releasePending();
  }
}

/** Row-count helper: an UPDATE/DELETE that asked for `.select('id')`. */
export function rowsOf(data: unknown): number {
  if (Array.isArray(data)) return data.length;
  return data ? 1 : 0;
}
