'use client';
// Gavelling Crisis: live updates.
// The database sends a content-free ping { t: table, op, id } on the public broadcast topic
// crisis:<id> after every change (docs/crisis/sql/003_change_pings.sql). A page listens, and
// re-reads only the slices whose tables changed, through RLS, ~250 ms after the first ping.
// Safety nets: a poll every 20 s while visible, a full re-read when the tab comes back or the
// socket re-subscribes. Works the same for account users and personal-code users.

import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { anonClient } from './client';

export type CrisisTable =
  | 'crises' | 'crisis_cabinets' | 'crisis_members' | 'crisis_characters' | 'crisis_character_secrets'
  | 'crisis_directives' | 'crisis_directive_notes' | 'crisis_news' | 'crisis_resource_types' | 'crisis_resources'
  | 'crisis_map_regions' | 'crisis_units' | 'crisis_shapes';

export interface CrisisPing { t: CrisisTable; op: 'insert' | 'update' | 'delete'; id: string | null }

const COALESCE_MS = 250;
const POLL_MS = 20_000;

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
    const channel: RealtimeChannel = anonClient
      .channel(`crisis:${crisisId}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'change' }, (msg) => {
        const ping = (msg as { payload?: CrisisPing }).payload;
        if (!ping || !ping.t) return;
        if (want && !want.has(ping.t)) return;
        pending.add(ping.t);
        pings.push(ping);
        if (timer === null) timer = window.setTimeout(flush, COALESCE_MS);
      });
    let wasSubscribed = false;
    channel.subscribe((status) => {
      const ok = status === 'SUBSCRIBED';
      setLive(ok);
      if (ok && wasSubscribed) cb.current(null, []);
      if (ok) wasSubscribed = true;
    });
    const poll = window.setInterval(() => { if (document.visibilityState === 'visible') cb.current(null, []); }, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') cb.current(null, []); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
      void anonClient.removeChannel(channel);
      setLive(false);
    };
  }, [crisisId, tablesKey]);

  return live;
}
