// ============================================================
// src/lib/offlineResilience.ts
// Offline resilience, phase 1 (28 Sep 2026): the Moderator's laptop on bad venue Wi-Fi.
//
// ONE kill switch for everything this phase added. With OFFLINE_RESILIENCE = false every new
// path falls back to the behaviour before it:
//   - runWrite gives up after its three attempts, as before (no parking);
//   - session clients use the plain global fetch (no timeouts, no gateway classification);
//   - slice reads use the shared anon client;
//   - speech / ledger log inserts are single fire-and-forget inserts with no client id;
//   - the chair page applies slices exactly as before (no pending-write protection);
//   - the server clock offset is neither stored nor restored.
//
// What lives here: the switch, the network-class error test, the timeout fetch for session
// clients, and the per-committee registry of writes that are in flight, queued on a write
// chain, or parked (writeStatus.ts), by the slice they write. The chair page consults the
// registry so a sync fetch never lands over a write this device has not managed to save.
// Rules: AGENTS.md, "Offline resilience (phase 1, 28 Sep 2026)".
// ============================================================

/** THE kill switch. false = byte-for-byte the behaviour before phase 1. */
export const OFFLINE_RESILIENCE = true;

/** Per-request timeouts for session clients: a hung request becomes a network-class failure. */
export const WRITE_TIMEOUT_MS = 20_000;
export const READ_TIMEOUT_MS = 12_000;

/** Gateway / edge statuses that mean "the request did not get through", not "refused".
 *  500 is deliberately NOT here: PostgREST answers 500 for deterministic database errors,
 *  and parking one of those would retry it forever instead of saying "Not saved". */
const GATEWAY_STATUSES = new Set([502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527, 530]);

/** Thrown by the timeout fetch for a gateway status on a write (postgrest-js does not retry
 *  a write that throws; a GET that answered 5xx keeps the ordinary error path). */
class GatewayError extends TypeError {
  constructor(status: number) { super(`Gateway ${status}`); this.name = 'GavellingNetworkError'; }
}

/** A timeout, named AbortError on purpose: postgrest-js does not re-run an aborted GET
 *  (it would otherwise retry a timed-out read three more times, up to ~50 s). */
class TimeoutAbort extends Error {
  constructor(ms: number) { super(`Request timed out after ${ms} ms`); this.name = 'AbortError'; }
}

/** A failed session read, named AbortError so postgrest-js does not retry it (see below). */
class ReadFailure extends Error {
  constructor(message: string) { super(message); this.name = 'AbortError'; }
}

const methodOf = (input: RequestInfo | URL, init?: RequestInit): string =>
  (init?.method ?? (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET')).toUpperCase();

/**
 * fetch for the SESSION clients only (sessionClient, sessionReadClient). Never the auth or
 * conference clients. Reads (GET / HEAD) time out after READ_TIMEOUT_MS, everything else
 * (writes, RPCs) after WRITE_TIMEOUT_MS, the body included; a caller's own abort signal
 * still works. `sessionClient(code, suffix, { timeout: false })` opts out. A write
 * answered by a gateway status is turned into a network-class throw.
 */
export const resilientFetch: typeof fetch = async (input, init) => {
  const method = methodOf(input, init);
  const isRead = method === 'GET' || method === 'HEAD';
  const ms = isRead ? READ_TIMEOUT_MS : WRITE_TIMEOUT_MS;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, ms);
  const outer = init?.signal ?? null;
  const onOuterAbort = () => controller.abort();
  if (outer) {
    if (outer.aborted) controller.abort();
    else outer.addEventListener('abort', onOuterAbort, { once: true });
  }
  try {
    const res = await fetch(input, { ...(init ?? {}), signal: controller.signal });
    if (!isRead && GATEWAY_STATUSES.has(res.status)) {
      try { await res.body?.cancel(); } catch { /* nothing to release */ }
      throw new GatewayError(res.status);
    }
    // D5: the timer covers the BODY too. Headers can arrive and the body then stall; so the
    // body is read here, under the same AbortController, and handed back as a new Response.
    const nullBody = res.status === 101 || res.status === 204 || res.status === 205 || res.status === 304;
    const body = nullBody ? null : await res.arrayBuffer();
    return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
  } catch (err) {
    if (timedOut) throw new TimeoutAbort(ms);
    // A failed READ is thrown as an AbortError on purpose: postgrest-js re-runs a GET that
    // threw anything else three more times (1, 2, 4 s), so an offline read inside a write
    // took ~15 s to fail. With this our own layers own retrying (runWrite's backoff and
    // parking; the session sync's null retries and catch-ups). A caller's own abort passes.
    if (isRead && !outer?.aborted) {
      const e = err as { name?: string; message?: string } | null;
      throw new ReadFailure(`${e?.name ?? 'Error'}: ${e?.message ?? 'read failed'}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
    if (outer) outer.removeEventListener('abort', onOuterAbort);
  }
};

/**
 * Did this request fail because it never got an answer (offline, DNS, reset, timeout,
 * gateway), as opposed to the database answering "no" (RLS, a constraint, a 4xx)?
 * postgrest-js turns a thrown fetch into `{ message: "<Name>: <msg>", code: '' }`.
 */
export function isNetworkClassError(error: unknown): boolean {
  if (!error) return false;
  const e = error as { name?: unknown; message?: unknown; code?: unknown };
  const code = typeof e.code === 'string' ? e.code : '';
  if (code === 'PGRST002') return true;   // "could not query the database": transient, 503
  if (code && code !== 'ABORT_ERR') return false;   // a Postgres / PostgREST code is an answer
  const name = typeof e.name === 'string' ? e.name : '';
  const message = typeof e.message === 'string' ? e.message : '';
  // A bare TypeError is NOT enough (a bug in our own code is a TypeError too): only the
  // browsers' fetch-failure wording counts.
  if (/^(AbortError|TimeoutError|GavellingNetworkError)$/.test(name)) return true;
  if (/^(AbortError|TimeoutError|FetchError|GavellingNetworkError)\b/.test(message)) return true;
  return /Failed to fetch|NetworkError when attempting|Load failed|network connection was lost|Internet connection appears to be offline|Network request failed/i.test(message);
}

// ── Pending writes by slice ────────────────────────────────────────────────────────────
// The slices a Moderator write can make stale locally. (delegates / motions / documents are
// not optimistic chair state in the same way and keep their own rules.)
export type GuardedSlice = 'row' | 'lists' | 'currentSpeaker';

/** Which committee and slice a write key (runWrite key or write-chain key) belongs to. */
export function sliceOfWriteKey(key: string): { committeeId: string; slice: GuardedSlice } | null {
  const i = key.indexOf(':');
  if (i <= 0) return null;
  const committeeId = key.slice(0, i);
  if (committeeId === 'delegate' || committeeId === 'motion' || committeeId === 'delegate-row') return null;
  const rest = key.slice(i + 1);
  if (rest === 'phase' || rest === 'caucus' || rest === 'lifecycle' || rest === 'topic' || rest === 'agenda'
    || rest === 'speaker-limit' || rest === 'settings') return { committeeId, slice: 'row' };
  if (rest.startsWith('list:')) return { committeeId, slice: 'lists' };
  if (rest === 'speaker' || rest.startsWith('speaker:') || rest === 'current_speaker') return { committeeId, slice: 'currentSpeaker' };
  return null;
}

const pending = new Map<string, number>();   // `${committeeId}|${slice}` -> count
const settledListeners = new Set<(committeeId: string, slice: GuardedSlice) => void>();

/** Count a write as pending on every slice its keys touch. Returns the release function
 *  (idempotent). A no-op when the switch is off. */
export function beginPendingWrite(keys: string[]): () => void {
  if (!OFFLINE_RESILIENCE) return () => {};
  const slots = new Set<string>();
  for (const k of keys) {
    const s = sliceOfWriteKey(k);
    if (s) slots.add(`${s.committeeId}|${s.slice}`);
  }
  if (slots.size === 0) return () => {};
  slots.forEach((slot) => pending.set(slot, (pending.get(slot) ?? 0) + 1));
  let released = false;
  return () => {
    if (released) return;
    released = true;
    slots.forEach((slot) => {
      const n = (pending.get(slot) ?? 1) - 1;
      if (n > 0) { pending.set(slot, n); return; }
      pending.delete(slot);
      const [committeeId, slice] = slot.split('|') as [string, GuardedSlice];
      settledListeners.forEach((fn) => { try { fn(committeeId, slice); } catch { /* a listener bug must not break writes */ } });
    });
  };
}

/** Does this device have a write for this slice in flight, queued or parked? */
export function hasPendingWrite(committeeId: string, slice: GuardedSlice): boolean {
  if (!OFFLINE_RESILIENCE) return false;
  return (pending.get(`${committeeId}|${slice}`) ?? 0) > 0;
}

/** Called when the last pending write of a (committee, slice) settles. */
export function onPendingWritesSettled(fn: (committeeId: string, slice: GuardedSlice) => void): () => void {
  settledListeners.add(fn);
  return () => { settledListeners.delete(fn); };
}

/**
 * The chair page's guard over its sync apply (Moderator only; the page passes whether this
 * device is a Commenter). `holds(slice)` is true while a write for that slice is pending, and
 * remembers that a fetch was held back; when the last pending write for it settles, `refetch`
 * is called once for that slice so another device's changes still arrive.
 */
export function createPendingSliceGuard(
  committeeId: string,
  refetch: (slice: GuardedSlice) => void,
): { holds: (slice: string, isViewOnly: boolean) => boolean; stop: () => void } {
  const held = new Set<GuardedSlice>();
  const off = onPendingWritesSettled((cid, slice) => {
    if (cid !== committeeId || !held.delete(slice)) return;
    refetch(slice);
  });
  return {
    holds: (slice, isViewOnly) => {
      if (!OFFLINE_RESILIENCE || isViewOnly) return false;
      if (slice !== 'row' && slice !== 'lists' && slice !== 'currentSpeaker') return false;
      if (!hasPendingWrite(committeeId, slice)) return false;
      held.add(slice);
      return true;
    },
    stop: () => { off(); held.clear(); },
  };
}

/** How long a held slice waits before it is fetched again anyway (a safety net: the settle
 *  listener normally refetches it the moment the write lands). */
export const PENDING_RECHECK_MS = 2000;

/** A v4 UUID for a client-chosen row id. crypto.randomUUID needs a secure context, so it
 *  falls back to getRandomValues (plain http), then Math.random. */
export function newRowId(): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && typeof c.randomUUID === 'function') {
    try { return c.randomUUID(); } catch { /* insecure context: fall through */ }
  }
  const b = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
