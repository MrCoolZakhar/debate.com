'use client';
// Gavelling Crisis: live updates.
// The database sends a content-free ping { t: table, op, id } on the public broadcast topic
// crisis:<id> after every change (docs/crisis/sql/003_change_pings.sql). A page listens, and
// re-reads only the slices whose tables changed, through RLS, ~250 ms after the first ping.
// Safety nets: a poll every 20 s while visible and the live channel is NOT connected (a slow 90 s
// poll while it is), a full re-read when the tab comes back or the socket re-subscribes. Works the same for account users and personal-code users.
// 20 Nov 2026 (crisis load hotfix): ONE safety poll per crisis per tab (60 s down, 180 s live, jittered 0.8 to 1.2), owned by the
// shared entry and firing every listener's full re-read at once so the shared reads in api.ts collapse them; a re-subscribe
// re-read runs at most once every 30 s per crisis per tab.
//
// One channel per crisis is shared by every hook on the page (realtime-js hands back the same
// channel for the same topic), so it is reference-counted here and removed only by the last user.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { anonClient } from './client';

export type CrisisTable =
  | 'crises' | 'crisis_cabinets' | 'crisis_members' | 'crisis_characters' | 'crisis_character_secrets'
  | 'crisis_directives' | 'crisis_directive_notes' | 'crisis_news' | 'crisis_resource_types' | 'crisis_resources'
  | 'crisis_map_regions' | 'crisis_map_drafts' | 'crisis_units' | 'crisis_shapes' | 'crisis_messages' | 'crisis_meetings' | 'crisis_meeting_responses' | 'crisis_notifications' | 'crisis_staff_invites' | 'crisis_backroom_messages';

/** `cab` is the cabinet the row belongs to (null = everyone). Only crisis_directives, crisis_resources and crisis_news carry it. */
export interface CrisisPing { t: CrisisTable; op: 'insert' | 'update' | 'delete'; id: string | null; cab?: string | null }

const COALESCE_MS = 250;
/** Poll while the live channel is down, and the slow safety poll while it is up. */
const POLL_MS = 60_000;
const POLL_LIVE_MS = 180_000;
/** A flapping channel re-reads everything at most once in this window (per crisis per tab). */
const RESUBSCRIBE_MIN_GAP_MS = 30_000;
/** Each wait is multiplied by 0.8 to 1.2 so many screens never poll in step. */
const jitter = (ms: number) => Math.round(ms * (0.8 + Math.random() * 0.4));

// The cabinet a non-staff viewer belongs to, per crisis. A ping that names another cabinet is dropped before any listener
// sees it, so a delegate's page does not re-read for every other cabinet's directive. null / unset = no filtering (staff).
const viewerCabinet = new Map<string, string>();
export function setLiveViewerCabinet(crisisId: string, cabinetId: string | null): void {
  if (cabinetId) viewerCabinet.set(crisisId, cabinetId); else viewerCabinet.delete(crisisId);
}

/**
 * A reload that is never dropped: a call that arrives while a run is going queues exactly ONE more run for when it finishes (calls
 * during that wait share it, and it runs the latest function passed). The returned promise settles when the run covering the call
 * has finished. Errors are swallowed here; the run reports its own.
 */
export function createFlight(): (run: () => Promise<void>) => Promise<void> {
  let current: Promise<void> | null = null;
  let queued: Promise<void> | null = null;
  let latest: (() => Promise<void>) | null = null;
  const start = (run: () => Promise<void>): Promise<void> => {
    const p: Promise<void> = run().catch(() => undefined).finally(() => { if (current === p) current = null; });
    current = p;
    return p;
  };
  return (run) => {
    latest = run;
    if (!current) return start(run);
    if (!queued) queued = current.then(() => { queued = null; return start(latest ?? run); });
    return queued;
  };
}

/** `run` wrapped in a flight (see createFlight): the returned function changes only when `run` does. */
export function useSingleFlight(run: () => Promise<void>): () => Promise<void> {
  const [flight] = useState(createFlight);
  return useCallback(() => flight(run), [flight, run]);
}

interface Listener { onPing: (p: CrisisPing) => void; onResubscribe: () => void; onStatus: (live: boolean) => void; onPoll: () => void }
interface Shared { channel: RealtimeChannel; listeners: Set<Listener>; live: boolean; pollTimer: number | null; lastResubAt: number }
const shared = new Map<string, Shared>();

/** (Re)arm the one safety poll of this crisis: POLL_MS while the channel is down, POLL_LIVE_MS while it is up, jittered. */
function schedulePoll(crisisId: string, entry: Shared): void {
  if (entry.pollTimer !== null) window.clearTimeout(entry.pollTimer);
  entry.pollTimer = null;
  if (shared.get(crisisId) !== entry || entry.listeners.size === 0) return;
  entry.pollTimer = window.setTimeout(() => {
    entry.pollTimer = null;
    if (shared.get(crisisId) !== entry) return;
    if (document.visibilityState === 'visible') for (const x of [...entry.listeners]) x.onPoll();
    schedulePoll(crisisId, entry);
  }, jitter(entry.live ? POLL_LIVE_MS : POLL_MS));
}

function join(crisisId: string, l: Listener): () => void {
  let s = shared.get(crisisId);
  if (!s) {
    const listeners = new Set<Listener>();
    const channel = anonClient
      .channel(`crisis:${crisisId}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'change' }, (msg) => {
        const ping = (msg as { payload?: CrisisPing }).payload;
        if (!ping || !ping.t) return;
        const mine = viewerCabinet.get(crisisId);
        if (ping.cab && mine && ping.cab !== mine) return;
        for (const x of listeners) x.onPing(ping);
      });
    const entry: Shared = { channel, listeners, live: false, pollTimer: null, lastResubAt: 0 };
    let wasSubscribed = false;
    channel.subscribe((status) => {
      const ok = status === 'SUBSCRIBED';
      const changed = ok !== entry.live;
      entry.live = ok;
      for (const x of listeners) x.onStatus(ok);
      if (changed) schedulePoll(crisisId, entry);
      if (ok && wasSubscribed && Date.now() - entry.lastResubAt >= RESUBSCRIBE_MIN_GAP_MS) {
        entry.lastResubAt = Date.now();
        for (const x of listeners) x.onResubscribe();
      }
      if (ok) wasSubscribed = true;
    });
    s = entry;
    shared.set(crisisId, s);
  }
  s.listeners.add(l);
  l.onStatus(s.live);
  if (s.pollTimer === null) schedulePoll(crisisId, s);
  return () => {
    const cur = shared.get(crisisId);
    if (!cur) return;
    cur.listeners.delete(l);
    if (cur.listeners.size === 0) {
      if (cur.pollTimer !== null) window.clearTimeout(cur.pollTimer);
      cur.pollTimer = null;
      shared.delete(crisisId);
      void anonClient.removeChannel(cur.channel);
    }
  };
}

/**
 * Call `onChange(tables, pings)` when any of `tables` changed. `tables` = null listens to all.
 * `onChange(null)` means "re-read everything" (poll, tab visible, reconnect).
 * Returns whether the live channel is connected.
 */
export function useCrisisLive(
  crisisId: string | null | undefined,
  tables: CrisisTable[] | null,
  onChange: (changed: Set<CrisisTable> | null, pings: CrisisPing[]) => void,
): boolean {
  const cb = useRef(onChange);
  useEffect(() => { cb.current = onChange; });
  const tablesKey = tables ? [...tables].sort().join(',') : '*';
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!crisisId) return;
    const want = tablesKey === '*' ? null : new Set(tablesKey.split(',') as CrisisTable[]);
    let timer: number | null = null;
    let pending = new Set<CrisisTable>();
    let pings: CrisisPing[] = [];
    const flush = () => {
      timer = null;
      const t = pending; const p = pings;
      pending = new Set(); pings = [];
      if (t.size) cb.current(t, p);
    };
    // The safety poll lives in the shared entry (one per crisis per tab, 20 Nov 2026); it calls onPoll on every listener at once.
    const leave = join(crisisId, {
      onPing: (ping) => {
        if (want && !want.has(ping.t)) return;
        pending.add(ping.t);
        pings.push(ping);
        if (timer === null) timer = window.setTimeout(flush, COALESCE_MS);
      },
      onResubscribe: () => cb.current(null, []),
      onStatus: (ok) => setLive(ok),
      onPoll: () => cb.current(null, []),
    });
    const onVisible = () => { if (document.visibilityState === 'visible') cb.current(null, []); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
      leave();
      setLive(false);
    };
  }, [crisisId, tablesKey]);

  return live;
}
