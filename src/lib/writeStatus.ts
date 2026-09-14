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

export type WriteResult = 'ok' | 'skipped' | 'failed';

export type WriteStatusState = {
  /** At least one write is between a failed attempt and its next retry. */
  retrying: boolean;
  /** Writes that exhausted their attempts, newest last. */
  failed: { key: string; retryable: boolean }[];
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

function snapshot(): WriteStatusState {
  return {
    retrying: retryingWrites.size > 0,
    failed: Array.from(failedWrites.entries()).map(([key, f]) => ({ key, retryable: f.retryable })),
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
  attempt: () => Promise<WriteResult>,
  opts: RunWriteOptions,
): Promise<WriteResult> {
  const list = Array.isArray(keys) ? keys : [keys];
  const primary = list.join('+');
  const writeId = ++writeIdSeq;
  const mine = list.map((k) => {
    const g = (generations.get(k) ?? 0) + 1;
    generations.set(k, g);
    return g;
  });
  const superseded = () => list.some((k, i) => generations.get(k) !== mine[i]);
  const cancelled = () => !opts.survivesLifecycle && list.some((k, i) => (cancelledUpTo.get(k) ?? 0) >= mine[i]);
  const rerunnable = opts.rerunnable ?? opts.retry;

  // A new write for a key clears an older failure for the same key: it carries newer truth.
  let touched = false;
  for (const k of list) {
    for (const fk of Array.from(failedWrites.keys())) {
      if (fk === k || fk.split('+').includes(k)) { failedWrites.delete(fk); touched = true; }
    }
  }
  if (touched) emit();

  const delays = opts.retry ? BACKOFF_MS : [0];
  let result: WriteResult = 'failed';
  for (let i = 0; i < delays.length; i++) {
    if (i > 0) {
      await sleep(delays[i]);
      if (superseded() || cancelled()) { result = 'skipped'; break; }
    }
    try {
      result = await attempt();
    } catch (err) {
      console.error(`Write threw (${primary}):`, err);
      result = 'failed';
    }
    if (result !== 'failed') break;
    if (opts.retry && i < delays.length - 1 && !retryingWrites.has(writeId)) {
      retryingWrites.add(writeId);
      emit();
    }
  }

  let changed = retryingWrites.delete(writeId);
  if (result === 'failed' && !superseded() && !cancelled()) {
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
    const committees = new Set(list.map(committeeOfKey).filter((c): c is string => !!c));
    for (const fk of Array.from(failedWrites.keys())) {
      const parts = fk.split('+');
      const sameKind = parts.some((p) => list.includes(p));
      const sameCommittee = phaseLanded && parts.some((p) => { const c = committeeOfKey(p); return !!c && committees.has(c); });
      if (sameKind || sameCommittee) { failedWrites.delete(fk); changed = true; }
    }
  }
  if (changed) emit();
  return result;
}

/** Row-count helper: an UPDATE/DELETE that asked for `.select('id')`. */
export function rowsOf(data: unknown): number {
  if (Array.isArray(data)) return data.length;
  return data ? 1 : 0;
}
